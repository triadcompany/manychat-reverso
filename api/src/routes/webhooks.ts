import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { safeEqual } from "../auth.js";
import { handleInbound, upsertContact } from "../dispatch.js";
import { parseEvolutionPayload } from "../channels/evolution.js";
import { parseInstagramPayload, verifyMetaSignature } from "../channels/instagram.js";

async function firstSeen(id: string, source: string) {
  try {
    await prisma.webhookEvent.create({ data: { id, source } });
    return true;
  } catch {
    return false; // duplicado
  }
}

export async function webhookRoutes(app: FastifyInstance) {
  // Precisamos do corpo cru para validar a assinatura HMAC da Meta.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    (req as any).rawBody = body;
    try { done(null, JSON.parse(body as string)); } catch (e) { done(e as Error, undefined); }
  });

  app.get("/webhooks/instagram", async (req, reply) => {
    const q = req.query as Record<string, string>;
    if (q["hub.mode"] === "subscribe" && env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN && q["hub.verify_token"] === env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN)
      return reply.type("text/plain").send(q["hub.challenge"]);
    return reply.code(403).send();
  });

  app.post("/webhooks/instagram", async (req, reply) => {
    if (!env.INSTAGRAM_APP_SECRET || !verifyMetaSignature((req as any).rawBody, req.headers["x-hub-signature-256"] as string, env.INSTAGRAM_APP_SECRET))
      return reply.code(401).send();
    reply.send({ ok: true }); // responde logo; a Meta reenvia se demorar
    for (const ev of parseInstagramPayload(req.body)) {
      try {
        const channel = await prisma.channel.findFirst({ where: { type: "INSTAGRAM", externalId: ev.accountId, active: true } });
        if (!channel) { app.log.warn({ accountId: ev.accountId }, "webhook sem canal (ID salvo difere de entry[].id?)"); continue; }
        if (!(await firstSeen(ev.kind === "comment" ? ev.commentId : ev.mid, "instagram"))) continue;
        const contact = await upsertContact(channel, ev.fromId, { username: ev.kind === "comment" ? ev.username : undefined });
        await handleInbound(channel, contact, ev.kind === "comment"
          ? { kind: "comment", text: ev.text, postId: ev.postId, commentId: ev.commentId }
          : { kind: "dm", text: ev.text });
      } catch (err) { app.log.error(err); }
    }
  });

  app.post("/webhooks/evolution", async (req, reply) => {
    const token = (req.headers["x-webhook-token"] as string | undefined) ?? "";
    if (!env.EVOLUTION_WEBHOOK_TOKEN || !safeEqual(token, env.EVOLUTION_WEBHOOK_TOKEN)) return reply.code(401).send();
    reply.send({ ok: true });
    const ev = parseEvolutionPayload(req.body);
    if (!ev) return;
    try {
      const channel = await prisma.channel.findFirst({ where: { type: "WHATSAPP", externalId: ev.instance, active: true } });
      if (!channel || !(await firstSeen(ev.id, "evolution"))) return;
      const contact = await upsertContact(channel, ev.fromPhone, { name: ev.name });
      await handleInbound(channel, contact, { kind: "dm", text: ev.text });
    } catch (err) { app.log.error(err); }
  });
}

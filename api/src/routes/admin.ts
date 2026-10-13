import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { issueToken, requireAuth, safeEqual } from "../auth.js";
import { prisma } from "../db.js";
import { env } from "../env.js";

const graphSchema = z.object({ nodes: z.array(z.any()), edges: z.array(z.any()) });

export async function adminRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ ok: true }));

  app.post("/auth/login", async (req, reply) => {
    const { password } = z.object({ password: z.string() }).parse(req.body);
    if (!safeEqual(password, env.ADMIN_PASSWORD)) return reply.code(401).send({ error: "invalid" });
    return { token: issueToken() };
  });

  app.register(async (api) => {
    api.addHook("preHandler", requireAuth);

    api.get("/contacts", async () =>
      prisma.contact.findMany({ include: { tags: { include: { tag: true } }, channel: true }, orderBy: { lastSeenAt: "desc" }, take: 200 }));

    api.get("/tags", async () => prisma.tag.findMany({ orderBy: { name: "asc" } }));
    api.post("/tags", async (req) => {
      const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
      return prisma.tag.upsert({ where: { name }, create: { name }, update: {} });
    });

    api.get("/fields", async () => prisma.customField.findMany({ orderBy: { key: "asc" } }));
    api.post("/fields", async (req) => {
      const d = z.object({ key: z.string().regex(/^[a-z0-9_]+$/), label: z.string(), type: z.string().default("text") }).parse(req.body);
      return prisma.customField.create({ data: d });
    });

    api.get("/channels", async () =>
      (await prisma.channel.findMany()).map(({ accessToken, ...c }) => ({ ...c, hasToken: !!accessToken })));
    api.post("/channels", async (req) => {
      const d = z.object({
        type: z.enum(["INSTAGRAM", "WHATSAPP"]), name: z.string(), externalId: z.string(), accessToken: z.string().optional(),
      }).parse(req.body);
      return prisma.channel.create({ data: d });
    });

    api.get("/flows", async () => prisma.flow.findMany({ orderBy: { updatedAt: "desc" } }));
    api.post("/flows", async (req) => {
      const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
      return prisma.flow.create({ data: { name } });
    });
    api.get("/flows/:id", async (req, reply) => {
      const f = await prisma.flow.findUnique({ where: { id: (req.params as any).id } });
      return f ?? reply.code(404).send({ error: "not_found" });
    });
    api.put("/flows/:id", async (req) => {
      const d = z.object({ name: z.string().optional(), status: z.enum(["DRAFT", "LIVE", "PAUSED"]).optional(), graph: graphSchema.optional() }).parse(req.body);
      return prisma.flow.update({ where: { id: (req.params as any).id }, data: d });
    });
  });
}

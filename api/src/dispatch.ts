import type { Channel, Contact } from "@prisma/client";
import { prisma } from "./db.js";
import { sendWhatsApp } from "./channels/evolution.js";
import { sendInstagram } from "./channels/instagram.js";
import { findTrigger, runFrom } from "./engine/engine.js";
import type { Effects, FlowGraph } from "./engine/types.js";

type Inbound = { kind: "comment" | "dm"; text: string; postId?: string; commentId?: string };

export async function upsertContact(channel: Channel, externalId: string, data: { name?: string; username?: string }) {
  return prisma.contact.upsert({
    where: { channelId_externalId: { channelId: channel.id, externalId } },
    create: { channelId: channel.id, externalId, ...data },
    update: { lastSeenAt: new Date(), ...data },
  });
}

function buildEffects(channel: Channel, contact: Contact, inbound: Inbound): Effects {
  let firstComment = inbound.kind === "comment"; // resposta privada: 1ª mensagem vai por comment_id
  return {
    async sendMessage(msg) {
      await prisma.message.create({ data: { contactId: contact.id, direction: "out", body: msg as object } });
      if (channel.type === "WHATSAPP") return sendWhatsApp(channel.externalId, contact.externalId, msg);
      const recipient = firstComment && inbound.commentId ? { comment_id: inbound.commentId } : { id: contact.externalId };
      firstComment = false;
      return sendInstagram(channel.accessToken ?? "", channel.externalId, recipient, msg);
    },
    async addTag(name) {
      const tag = await prisma.tag.upsert({ where: { name }, create: { name }, update: {} });
      await prisma.contactTag.upsert({
        where: { contactId_tagId: { contactId: contact.id, tagId: tag.id } },
        create: { contactId: contact.id, tagId: tag.id }, update: {},
      });
    },
    async removeTag(name) {
      const tag = await prisma.tag.findUnique({ where: { name } });
      if (tag) await prisma.contactTag.deleteMany({ where: { contactId: contact.id, tagId: tag.id } });
    },
    async setField(field, value) {
      const cur = (await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).fields as Record<string, string>;
      await prisma.contact.update({ where: { id: contact.id }, data: { fields: { ...cur, [field]: value } } });
    },
  };
}

/** Retoma uma execução parada em espera de resposta, ou dispara o primeiro fluxo LIVE que casa. */
export async function handleInbound(channel: Channel, contact: Contact, inbound: Inbound) {
  await prisma.message.create({ data: { contactId: contact.id, direction: "in", body: { text: inbound.text } } });
  const tags = (await prisma.contactTag.findMany({ where: { contactId: contact.id }, include: { tag: true } })).map((t) => t.tag.name);
  const state = { tags, fields: contact.fields as Record<string, string> };
  const fx = buildEffects(channel, contact, inbound);

  const flows = await prisma.flow.findMany({ where: { status: "LIVE" } });
  for (const flow of flows) {
    const graph = flow.graph as unknown as FlowGraph;
    const trigger = findTrigger(graph, inbound);
    if (!trigger) continue;
    const run = await prisma.flowRun.create({ data: { flowId: flow.id, contactId: contact.id, channelId: channel.id } });
    try {
      const res = await runFrom(graph, trigger.id, state, fx, inbound.text);
      await prisma.flowRun.update({
        where: { id: run.id },
        data: res.status === "waiting"
          ? { status: "WAITING", nodeId: res.nodeId, resumeAt: res.resumeAt }
          : { status: "DONE" },
      });
    } catch (err) {
      await prisma.flowRun.update({ where: { id: run.id }, data: { status: "FAILED", context: { error: String(err) } } });
      throw err;
    }
    return; // só o primeiro fluxo que casa
  }
}

/** Retoma execuções cuja espera venceu. Chamado periodicamente pelo servidor. */
export async function resumeDue() {
  const due = await prisma.flowRun.findMany({
    where: { status: "WAITING", resumeAt: { lte: new Date() } },
    include: { flow: true, contact: true, channel: true }, take: 50,
  });
  for (const run of due) {
    // Marca como ACTIVE antes de executar para outro tick não pegar a mesma execução.
    const claimed = await prisma.flowRun.updateMany({ where: { id: run.id, status: "WAITING" }, data: { status: "ACTIVE" } });
    if (claimed.count === 0 || !run.nodeId) continue;
    const tags = (await prisma.contactTag.findMany({ where: { contactId: run.contactId }, include: { tag: true } })).map((t) => t.tag.name);
    try {
      const res = await runFrom(run.flow.graph as unknown as FlowGraph, run.nodeId,
        { tags, fields: run.contact.fields as Record<string, string> }, buildEffects(run.channel, run.contact, { kind: "dm", text: "" }));
      await prisma.flowRun.update({ where: { id: run.id }, data: res.status === "waiting"
        ? { status: "WAITING", nodeId: res.nodeId, resumeAt: res.resumeAt } : { status: "DONE", nodeId: null, resumeAt: null } });
    } catch (err) {
      await prisma.flowRun.update({ where: { id: run.id }, data: { status: "FAILED", context: { error: String(err) } } });
    }
  }
}

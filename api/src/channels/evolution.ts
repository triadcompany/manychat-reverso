import type { Button } from "../engine/types.js";
import { env } from "../env.js";
import { toWhatsAppSendFormat } from "./phone.js";

export async function sendWhatsApp(instance: string, phone: string, msg: { text?: string; buttons?: Button[] }) {
  if (!env.EVOLUTION_API_URL || !env.EVOLUTION_API_KEY) throw new Error("Evolution API não configurada");
  const links = (msg.buttons ?? []).filter((b) => b.url).map((b) => `${b.label}: ${b.url}`);
  const text = [msg.text ?? "", ...links].filter(Boolean).join("\n");
  const res = await fetch(`${env.EVOLUTION_API_URL}/message/sendText/${instance}`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: env.EVOLUTION_API_KEY },
    body: JSON.stringify({ number: toWhatsAppSendFormat(phone), text }),
  });
  if (!res.ok) throw new Error(`evolution send ${res.status}: ${await res.text()}`);
}

export type WaEvent = { instance: string; fromPhone: string; name?: string; text: string; id: string };

/** Evento `messages.upsert` da Evolution; ignora mensagens enviadas por nós. */
export function parseEvolutionPayload(body: any): WaEvent | null {
  if (body?.event !== "messages.upsert") return null;
  const d = body.data;
  if (!d || d.key?.fromMe) return null;
  const jid: string = d.key?.remoteJid ?? "";
  if (!jid.endsWith("@s.whatsapp.net")) return null; // ignora grupos
  const text = d.message?.conversation ?? d.message?.extendedTextMessage?.text;
  if (!text) return null;
  return { instance: body.instance, fromPhone: jid.split("@")[0], name: d.pushName, text, id: d.key.id };
}

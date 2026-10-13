import { createHmac } from "node:crypto";
import { safeEqual } from "../auth.js";
import type { Button } from "../engine/types.js";

const HOST = "https://graph.instagram.com";

/** Valida X-Hub-Signature-256 sobre o corpo CRU (não o JSON reserializado). */
export function verifyMetaSignature(rawBody: string, header: string | undefined, appSecret: string) {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return safeEqual(header.slice(7), expected);
}

type Recipient = { id: string } | { comment_id: string };

export async function sendInstagram(
  token: string,
  igBusinessId: string,
  recipient: Recipient,
  msg: { text?: string; buttons?: Button[]; fileUrl?: string },
) {
  const links = (msg.buttons ?? []).filter((b) => b.url);
  const message = msg.fileUrl
    ? { attachment: { type: "file", payload: { url: msg.fileUrl } } }
    : links.length
      ? {
          attachment: {
            type: "template",
            payload: {
              template_type: "button",
              text: msg.text ?? "",
              buttons: links.map((b) => ({ type: "web_url", url: b.url, title: b.label })),
            },
          },
        }
      : { text: msg.text ?? "" };
  const res = await fetch(`${HOST}/${igBusinessId}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ recipient, message }),
  });
  if (!res.ok) throw new Error(`instagram send ${res.status}: ${await res.text()}`);
}

export type IgEvent =
  | { kind: "comment"; accountId: string; commentId: string; fromId: string; username?: string; text: string; postId?: string }
  | { kind: "dm"; accountId: string; fromId: string; text: string; mid: string };

/** Extrai eventos úteis do payload da Meta. `entry[].id` é o ID que casa com Channel.externalId. */
export function parseInstagramPayload(body: any): IgEvent[] {
  const out: IgEvent[] = [];
  for (const entry of body?.entry ?? []) {
    for (const ch of entry.changes ?? []) {
      if (ch.field !== "comments") continue;
      const v = ch.value ?? {};
      if (!v.id || !v.from?.id || v.from.id === entry.id) continue;
      out.push({
        kind: "comment", accountId: entry.id, commentId: v.id, fromId: v.from.id,
        username: v.from.username, text: v.text ?? "", postId: v.media?.id,
      });
    }
    for (const m of entry.messaging ?? []) {
      if (m.message?.is_echo || !m.message?.text) continue; // ignora a própria mensagem enviada
      out.push({ kind: "dm", accountId: entry.id, fromId: m.sender.id, text: m.message.text, mid: m.message.mid });
    }
  }
  return out;
}

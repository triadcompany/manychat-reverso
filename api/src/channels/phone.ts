/** Só dígitos, com DDI 55 se vier sem. */
export function toE164Brazil(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.startsWith("55") && d.length >= 12 ? d : `55${d}`;
}

/**
 * Alguns celulares BR estão no WhatsApp SEM o nono dígito. Com o 9, a Evolution API
 * responde 200 mas a mensagem nunca chega. Formato de envio: remove o 9 após o DDD.
 */
export function toWhatsAppSendFormat(raw: string): string {
  const e164 = toE164Brazil(raw);
  // 55 + DDD(2) + 9 + 8 dígitos = 13
  if (e164.length === 13 && e164[4] === "9") return e164.slice(0, 4) + e164.slice(5);
  return e164;
}

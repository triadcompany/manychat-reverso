import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "./env.js";

const sign = (v: string) => createHmac("sha256", env.SESSION_SECRET).update(v).digest("hex");

export const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Token = expiração.assinatura, sem dependência de JWT. */
export function issueToken(ttlMs = 7 * 24 * 3600 * 1000) {
  const exp = String(Date.now() + ttlMs);
  return `${exp}.${sign(exp)}`;
}

export function verifyToken(token?: string) {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  return !!exp && !!sig && safeEqual(sig, sign(exp)) && Number(exp) > Date.now();
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const token = req.headers.authorization?.replace(/^Bearer /, "");
  if (!verifyToken(token)) return reply.code(401).send({ error: "unauthorized" });
}

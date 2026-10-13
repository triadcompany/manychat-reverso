import cors from "@fastify/cors";
import Fastify from "fastify";
import { env } from "./env.js";
import { adminRoutes } from "./routes/admin.js";
import { webhookRoutes } from "./routes/webhooks.js";

const app = Fastify({ logger: true });

// Allowlist explícita. TODO header customizado novo enviado pelo painel precisa entrar
// em allowedHeaders, senão o preflight derruba todas as chamadas autenticadas.
await app.register(cors, {
  origin: env.CORS_ORIGINS.split(",").map((s) => s.trim()),
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
});

await app.register(webhookRoutes);
await app.register(adminRoutes);

await app.listen({ port: env.PORT, host: "0.0.0.0" });

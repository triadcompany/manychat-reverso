import cors from "@fastify/cors";
import Fastify from "fastify";
import { env } from "./env.js";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resumeDue } from "./dispatch.js";
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
await app.register(adminRoutes, { prefix: "/api" });

// Painel web (build do Vite), servido pela mesma origem. Nenhum service worker por enquanto:
// se um dia houver, sw.js e manifest.json devem sair com no-cache.
const webDist = fileURLToPath(new URL("../../web/dist", import.meta.url));
if (existsSync(webDist)) {
  await app.register(fastifyStatic, {
    root: webDist,
    setHeaders: (res, path) => {
      res.setHeader("cache-control", path.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-cache");
    },
  });
  app.setNotFoundHandler((req, reply) => (req.method === "GET" && !req.url.startsWith("/api") ? reply.sendFile("index.html") : reply.code(404).send({ error: "not_found" })));
}

setInterval(() => resumeDue().catch((e) => app.log.error(e)), 15_000);

await app.listen({ port: env.PORT, host: "0.0.0.0" });

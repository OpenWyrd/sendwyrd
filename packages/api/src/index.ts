/**
 * SendWyrd API — Hono on Cloudflare Workers.
 *
 * Mounts at https://sendwyrd.com/api/* once routes are configured.
 * Implements the wire spec at what/docs/spec/spec_mop_v1.md.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { PROTOCOL_VERSION } from "@sendwyrd/core";
import type { Env } from "./env.js";
import { wyrdsRoutes } from "./routes/wyrds.js";
import { repliesRoutes } from "./routes/replies.js";
import { authorsRoutes } from "./routes/authors.js";

type App = Hono<{ Bindings: Env }>;

const app: App = new Hono<{ Bindings: Env }>();

app.use("*", logger());

// CORS — only allow the canonical web origin and the .app variant.
app.use(
  "/api/*",
  cors({
    origin: (origin) => {
      if (origin === "https://sendwyrd.com") return origin;
      if (origin === "https://sendwyrd.app") return origin;
      // Dev: allow localhost on common ports.
      if (origin?.startsWith("http://127.0.0.1:")) return origin;
      if (origin?.startsWith("http://localhost:")) return origin;
      return null;
    },
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "MOP-Protocol-Version", "X-Mop-Auth"],
    maxAge: 600,
  }),
);

// Protocol-version header — middleware that enforces and echoes.
app.use("/api/*", async (c, next) => {
  const incoming = c.req.header("MOP-Protocol-Version");
  if (incoming && incoming !== String(PROTOCOL_VERSION)) {
    return c.json(
      { error: "protocol_version_unsupported" },
      426,
      { "MOP-Protocol-Version": String(PROTOCOL_VERSION) },
    );
  }
  await next();
  c.header("MOP-Protocol-Version", String(PROTOCOL_VERSION));
});

// Health.
app.get("/api/v1/health", (c) =>
  c.json({ ok: true, protocol_version: PROTOCOL_VERSION }),
);

// Routes per spec_mop_v1.md.
app.route("/api/v1/wyrds", wyrdsRoutes);
app.route("/api/v1/wyrds", repliesRoutes); // mounts /:handle/replies inside wyrds tree
app.route("/api/v1/authors", authorsRoutes);

// 404 fallback.
app.notFound((c) => c.json({ error: "not_found" }, 404));

// Error handler.
app.onError((err, c) => {
  console.error("api_error", err);
  return c.json({ error: "internal" }, 500);
});

export default app;

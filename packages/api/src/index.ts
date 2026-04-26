/**
 * SendWyrd API — Hono on Cloudflare Workers.
 *
 * Mounts at https://sendwyrd.com/api/* once routes are configured.
 * Implements the wire spec at what/docs/spec/spec_mop_v1.md.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import * as Sentry from "@sentry/cloudflare";
import { PROTOCOL_VERSION } from "@sendwyrd/core";
import type { Env } from "./env.js";
import { wyrdsRoutes } from "./routes/wyrds.js";
import { repliesRoutes } from "./routes/replies.js";
import { authorsRoutes } from "./routes/authors.js";
import { redactBeforeSend } from "./sentryRedact.js";

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
  // Forward to Sentry if configured. Sentry.captureException is a no-op
  // when DSN is unset.
  try {
    Sentry.captureException(err);
  } catch {
    // Never let an observability layer take down the API.
  }
  return c.json({ error: "internal" }, 500);
});

/**
 * Worker entrypoint wrapped with Sentry. When SENTRY_DSN is unset/empty,
 * the SDK initializes in no-op mode (per renderer-contract §16: telemetry
 * is opt-in, default-deny). When set, all events flow through
 * redactBeforeSend before transmission.
 *
 * The wrapper signature (per @sentry/cloudflare docs): a (env) => options
 * factory plus the Worker handler object.
 */
export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN || undefined,
    // Conservative default — no performance traces in v1; pure error
    // reporting. A future ADR may revisit if there's a defensible
    // privacy story for traces.
    tracesSampleRate: 0,
    // Strip PII at the SDK layer too (defense in depth; redactBeforeSend
    // is the load-bearing scrub).
    sendDefaultPii: false,
    beforeSend: redactBeforeSend,
    beforeBreadcrumb: (breadcrumb) => {
      // Drop console + storage breadcrumbs at source, before they ever
      // hit the event buffer. redactBeforeSend repeats this for events
      // assembled from non-breadcrumb sources.
      if (breadcrumb.category === "console") return null;
      if (breadcrumb.category === "storage") return null;
      return breadcrumb;
    },
  }),
  app,
);

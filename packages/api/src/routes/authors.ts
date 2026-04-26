/**
 * Author presence-check route per spec_mop_v1.md §15.
 *
 *   GET /api/v1/authors/:k_origin_pub_b64u/handles  — lists handles for sweep on recovery.
 *
 * Stubbed at scaffolding time — return 501 until Phase G.
 */

import { Hono } from "hono";
import type { Env } from "../env.js";

const NOT_IMPLEMENTED = { error: "not_implemented" } as const;

export const authorsRoutes = new Hono<{ Bindings: Env }>().get(
  "/:k_origin_pub/handles",
  (c) => c.json(NOT_IMPLEMENTED, 501),
);

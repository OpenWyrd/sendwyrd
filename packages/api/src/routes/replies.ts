/**
 * Reply routes per spec_mop_v1.md §14.
 *
 * Endpoints:
 *   POST /api/v1/wyrds/:handle/replies  submit reply (anonymous, ECIES-encrypted)
 *   GET  /api/v1/wyrds/:handle/replies  fetch replies (K_origin-signed)
 *
 * Stubbed at scaffolding time — return 501 until Phase G.
 */

import { Hono } from "hono";
import type { Env } from "../env.js";

const NOT_IMPLEMENTED = { error: "not_implemented" } as const;

export const repliesRoutes = new Hono<{ Bindings: Env }>()
  .post("/:handle/replies", (c) => c.json(NOT_IMPLEMENTED, 501))
  .get("/:handle/replies", (c) => c.json(NOT_IMPLEMENTED, 501));

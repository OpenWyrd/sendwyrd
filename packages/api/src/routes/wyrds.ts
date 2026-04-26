/**
 * Wyrd routes per spec_mop_v1.md §9–§13.
 *
 * Endpoints:
 *   POST   /api/v1/wyrds            publish
 *   GET    /api/v1/wyrds/:handle    fetch (fragment-form data)
 *   DELETE /api/v1/wyrds/:handle    burn (K_origin-signed)
 *
 * Implementation is intentionally stubbed at scaffolding time — these handlers
 * return 501 Not Implemented until Phase G (implementation) wires them up.
 */

import { Hono } from "hono";
import type { Env } from "../env.js";

const NOT_IMPLEMENTED = { error: "not_implemented" } as const;

export const wyrdsRoutes = new Hono<{ Bindings: Env }>()
  // POST /api/v1/wyrds — publish.
  .post("/", (c) => c.json(NOT_IMPLEMENTED, 501))
  // GET /api/v1/wyrds/:handle — fetch envelope (fragment-form access).
  .get("/:handle", (c) => c.json({ ...NOT_IMPLEMENTED, handle: c.req.param("handle") }, 501))
  // DELETE /api/v1/wyrds/:handle — burn.
  .delete("/:handle", (c) => c.json(NOT_IMPLEMENTED, 501));

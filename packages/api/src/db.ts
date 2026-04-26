/**
 * Drizzle Neon HTTP client (Workers-compatible).
 * One client per request; Neon HTTP driver pools at the edge.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./db/schema.js";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export function makeDb(databaseUrl: string): Db {
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

export { schema };

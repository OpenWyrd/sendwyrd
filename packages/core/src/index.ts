/**
 * @sendwyrd/core — DEPRECATED re-export shim.
 *
 * This package has been renamed to @openwyrd/mop and relicensed Apache-2.0.
 * The full implementation now lives at https://github.com/openwyrd/mop-js.
 *
 * Migrate at your convenience:
 *   - import { composeWyrd } from "@sendwyrd/core";   // still works (this shim)
 *   - import { composeWyrd } from "@openwyrd/mop";    // canonical going forward
 *
 * This shim will be `npm deprecate`'d 60 days after v0.2.0 ships.
 */
export * from "@openwyrd/mop";

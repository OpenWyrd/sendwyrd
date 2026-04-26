#!/usr/bin/env node
/**
 * SendWyrd MCP server entry point.
 *
 * Run via:
 *   npx @sendwyrd/mcp
 *
 * Or wired into Claude Code's ~/.claude.json:
 *   { "mcpServers": { "sendwyrd": { "command": "npx", "args": ["-y", "@sendwyrd/mcp"] } } }
 *
 * Environment:
 *   SENDWYRD_ORIGIN          override origin (default https://sendwyrd.com)
 *   SENDWYRD_PASSPHRASE      passphrase for protected-mode seed
 *   SENDWYRD_PASSPHRASE_CMD  command whose stdout yields the passphrase
 *                            (e.g. "pass sendwyrd"). No shell expansion.
 *   XDG_CONFIG_HOME          override config root (default ~/.config)
 */

import { startServer } from "./server.js";

startServer().catch((e) => {
  process.stderr.write(`sendwyrd-mcp fatal: ${(e as Error).stack ?? e}\n`);
  process.exit(1);
});

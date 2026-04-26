#!/usr/bin/env node
/**
 * End-to-end smoke against a live SendWyrd origin.
 *
 *   SENDWYRD_ORIGIN=https://sendwyrd.com node scripts/smoke.mjs
 *
 * Spawns dist/index.js, drives the MCP protocol over stdio, runs:
 *   init → compose → view → burn → view (expect gone)
 *
 * Uses a tmpdir as XDG_CONFIG_HOME so it never touches your real config.
 */

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ORIGIN = process.env.SENDWYRD_ORIGIN ?? "https://sendwyrd.com";
const tmp = mkdtempSync(join(tmpdir(), "sendwyrd-mcp-smoke-"));
console.error(`smoke: using tmp config dir ${tmp}`);
console.error(`smoke: origin ${ORIGIN}`);

const child = spawn(process.execPath, ["dist/index.js"], {
  stdio: ["pipe", "pipe", "inherit"],
  env: {
    ...process.env,
    XDG_CONFIG_HOME: tmp,
    SENDWYRD_ORIGIN: ORIGIN,
  },
});

const pending = new Map();
let nextId = 1;
let buffer = "";

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      console.error(`smoke: non-JSON line ${line.slice(0, 80)}`);
      continue;
    }
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve } = pending.get(msg.id);
      pending.delete(msg.id);
      resolve(msg);
    }
  }
});

function send(method, params) {
  const id = nextId++;
  const msg = { jsonrpc: "2.0", id, method, params };
  child.stdin.write(JSON.stringify(msg) + "\n");
  return new Promise((resolve) => pending.set(id, { resolve }));
}

function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

async function callTool(name, args = {}) {
  const res = await send("tools/call", { name, arguments: args });
  if (res.error) throw new Error(`${name}: ${JSON.stringify(res.error)}`);
  const text = res.result?.content?.[0]?.text;
  if (res.result?.isError) throw new Error(`${name}: ${text}`);
  return JSON.parse(text);
}

async function main() {
  await send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke", version: "0" },
  });
  notify("notifications/initialized");

  console.error("→ sendwyrd_init");
  const init = await callTool("sendwyrd_init", {});
  console.error(`  installed=${init.installed} mode=${init.mode}`);

  console.error("→ sendwyrd_compose");
  const composed = await callTool("sendwyrd_compose", {
    body: `mcp smoke test ${new Date().toISOString()}`,
    ttl_seconds: 600,
    replies_enabled: false,
  });
  console.error(`  url=${composed.url}`);

  console.error("→ sendwyrd_view");
  const viewed = await callTool("sendwyrd_view", { url: composed.url });
  if (viewed.status !== "live")
    throw new Error(`expected live, got ${viewed.status}`);
  if (!viewed.body.startsWith("mcp smoke test"))
    throw new Error(`view body mismatch: ${viewed.body}`);
  console.error(`  body roundtripped OK`);

  console.error("→ sendwyrd_burn");
  const burnt = await callTool("sendwyrd_burn", {
    handle: composed.handle,
  });
  if (!burnt.burned) throw new Error(`burn failed: ${JSON.stringify(burnt)}`);
  console.error(`  burned at ${burnt.gone_at}`);

  console.error("→ sendwyrd_view (post-burn)");
  const after = await callTool("sendwyrd_view", { url: composed.url });
  if (after.status !== "gone")
    throw new Error(`expected gone, got ${after.status}`);
  console.error(`  status=gone reason=${after.reason}`);

  console.error("→ sendwyrd_history");
  const history = await callTool("sendwyrd_history", {});
  if (history.count !== 1)
    throw new Error(`expected 1 history entry, got ${history.count}`);
  console.error(`  history.count=${history.count}`);

  console.error("\nALL SMOKE CHECKS PASSED");
}

main()
  .catch((e) => {
    console.error(`SMOKE FAILED: ${e.message}`);
    process.exitCode = 1;
  })
  .finally(() => {
    child.stdin.end();
    child.kill();
    rmSync(tmp, { recursive: true, force: true });
  });

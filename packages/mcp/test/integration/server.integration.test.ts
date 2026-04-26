/**
 * Integration test for the SendWyrd MCP server.
 *
 * Spawns the actual built `dist/index.js` as a child process, drives the MCP
 * JSON-RPC protocol over stdio (newline-delimited per the SDK's
 * StdioServerTransport), and exercises every tool end-to-end against a tiny
 * localhost mock of the SendWyrd HTTP API.
 *
 * The crypto primitives in @sendwyrd/core have their own unit tests; this
 * suite verifies that the MCP wires them together correctly — i.e. the right
 * HTTP calls are made with payloads the server-side would accept, and that
 * stdio framing, schema validation, and tool wiring all hold.
 *
 * If `dist/index.js` is missing the suite is skipped with a clear message —
 * run `pnpm --filter @sendwyrd/mcp build` first.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AddressInfo } from "node:net";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST_PATH = resolve(HERE, "..", "..", "dist", "index.js");
const HAS_DIST = existsSync(DIST_PATH);

// -- mock API ---------------------------------------------------------------

interface StoredWyrd {
  handle: string;
  envelope: string;
  k_origin_pub: string;
  ttl_seconds: number;
  replies_enabled: boolean;
  published_at: number;
  expires_at: number;
  publish_signature: string;
  publish_timestamp_ms: number;
  burned: boolean;
  gone_at?: number;
}

interface MockApi {
  url: string;
  /** Map of handle -> wyrd record. */
  wyrds: Map<string, StoredWyrd>;
  /** Map of handle -> list of submitted reply blobs. */
  replies: Map<string, Array<{ reply_blob: string; received_at: number }>>;
  /** Map of k_origin_pub_b64u -> presence handles to return. */
  presenceFixtures: Map<string, Array<{
    handle: string;
    published_at: number;
    expires_at: number;
    gone_at: number | null;
    gone_reason: "expired" | "burned" | "key_mismatch" | null;
    replies_enabled: boolean;
  }>>;
  /** Recorded request log for assertions. */
  requests: Array<{ method: string; path: string }>;
  close: () => Promise<void>;
}

async function startMockApi(): Promise<MockApi> {
  const wyrds = new Map<string, StoredWyrd>();
  const replies = new Map<string, Array<{ reply_blob: string; received_at: number }>>();
  const presenceFixtures = new Map<string, Array<{
    handle: string;
    published_at: number;
    expires_at: number;
    gone_at: number | null;
    gone_reason: "expired" | "burned" | "key_mismatch" | null;
    replies_enabled: boolean;
  }>>();
  const requests: Array<{ method: string; path: string }> = [];

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const method = req.method ?? "GET";
    const path = req.url ?? "/";
    requests.push({ method, path });

    const json = (status: number, body: unknown): void => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    const empty = (status: number): void => {
      res.writeHead(status);
      res.end();
    };

    let body = "";
    for await (const chunk of req) body += chunk;
    let parsed: any = null;
    if (body.length > 0) {
      try {
        parsed = JSON.parse(body);
      } catch {
        // ignore — some endpoints do not send a body
      }
    }

    // POST /api/v1/wyrds  — publish
    //
    // CRITICAL: The MCP encrypts the body with AAD = ver || handle ||
    // expires_at_be || replies_enabled, where expires_at = publish_timestamp_ms
    // + ttl_seconds * 1000. The decryption on view uses the expires_at this
    // server returns. So the mock MUST derive expires_at from the client's
    // publish_timestamp_ms (NOT a fresh `Date.now()`), or the AAD won't match
    // and decrypt will fail. This mirrors the real api worker's behavior.
    if (method === "POST" && path === "/api/v1/wyrds") {
      // Matches core/src/types.ts PERMANENT_EXPIRES_AT_MS (year ~9999).
      const PERMANENT_EXPIRES_AT_MS = 253_370_764_800_000;
      const ttl: number = parsed.ttl_seconds;
      const ts: number = parsed.publish_timestamp_ms;
      const expires_at =
        ttl === 0 ? PERMANENT_EXPIRES_AT_MS : ts + ttl * 1000;
      const record: StoredWyrd = {
        handle: parsed.handle,
        envelope: parsed.envelope,
        k_origin_pub: parsed.k_origin_pub,
        ttl_seconds: ttl,
        replies_enabled: parsed.replies_enabled,
        published_at: ts,
        expires_at,
        publish_signature: parsed.publish_signature,
        publish_timestamp_ms: ts,
        burned: false,
      };
      wyrds.set(record.handle, record);
      json(201, {
        handle: record.handle,
        published_at: record.published_at,
        expires_at: record.expires_at,
      });
      return;
    }

    // GET /api/v1/wyrds/{handle}
    const getMatch = path.match(/^\/api\/v1\/wyrds\/([A-Za-z0-9_-]{16})$/);
    if (method === "GET" && getMatch) {
      const handle = getMatch[1]!;
      const w = wyrds.get(handle);
      if (!w) {
        json(404, { error: "not_found" });
        return;
      }
      if (w.burned) {
        json(410, {
          status: "gone",
          reason: "burned",
          gone_at: w.gone_at ?? Date.now(),
        });
        return;
      }
      json(200, {
        handle: w.handle,
        envelope: w.envelope,
        k_origin_pub: w.k_origin_pub,
        published_at: w.published_at,
        expires_at: w.expires_at,
        replies_enabled: w.replies_enabled,
      });
      return;
    }

    // DELETE /api/v1/wyrds/{handle}
    if (method === "DELETE" && getMatch) {
      const handle = getMatch[1]!;
      const w = wyrds.get(handle);
      if (!w) {
        json(404, { error: "not_found" });
        return;
      }
      if (w.burned) {
        json(410, {
          status: "gone",
          reason: "burned",
          gone_at: w.gone_at ?? Date.now(),
        });
        return;
      }
      const gone_at = Date.now();
      w.burned = true;
      w.gone_at = gone_at;
      json(200, { handle: w.handle, gone_at, gone_reason: "burned" });
      return;
    }

    // POST /api/v1/wyrds/{handle}/replies
    const replyMatch = path.match(
      /^\/api\/v1\/wyrds\/([A-Za-z0-9_-]{16})\/replies$/,
    );
    if (method === "POST" && replyMatch) {
      const handle = replyMatch[1]!;
      const received_at = Date.now();
      const list = replies.get(handle) ?? [];
      list.push({ reply_blob: parsed.reply_blob, received_at });
      replies.set(handle, list);
      json(202, { received_at });
      return;
    }

    // GET /api/v1/wyrds/{handle}/replies
    if (method === "GET" && replyMatch) {
      const handle = replyMatch[1]!;
      const list = replies.get(handle) ?? [];
      json(200, { handle, replies: list });
      return;
    }

    // GET /api/v1/authors/{k_pub}/handles
    const authorMatch = path.match(
      /^\/api\/v1\/authors\/([A-Za-z0-9_-]+)\/handles$/,
    );
    if (method === "GET" && authorMatch) {
      const k_pub = authorMatch[1]!;
      const handles = presenceFixtures.get(k_pub) ?? [];
      json(200, { k_origin_pub: k_pub, handles });
      return;
    }

    empty(404);
  });

  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${addr.port}`;

  return {
    url,
    wyrds,
    replies,
    presenceFixtures,
    requests,
    close: () =>
      new Promise<void>((r) => {
        server.close(() => r());
      }),
  };
}

// -- MCP client over stdio --------------------------------------------------

interface McpClient {
  child: ChildProcessWithoutNullStreams;
  call: (name: string, args?: Record<string, unknown>) => Promise<any>;
  send: (method: string, params?: unknown) => Promise<any>;
  notify: (method: string, params?: unknown) => void;
  stop: () => Promise<void>;
}

function startMcp(env: Record<string, string>): McpClient {
  const child = spawn(process.execPath, [DIST_PATH], {
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      ...env,
      // Ensure no host SENDWYRD_PASSPHRASE leaks into protected mode
      SENDWYRD_PASSPHRASE: "",
      SENDWYRD_PASSPHRASE_CMD: "",
    },
  }) as ChildProcessWithoutNullStreams;

  const pending = new Map<number, { resolve: (m: any) => void; reject: (e: Error) => void }>();
  let nextId = 1;
  let buffer = "";
  let stderr = "";

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      let msg: any;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (msg.id !== undefined && pending.has(msg.id)) {
        const { resolve } = pending.get(msg.id)!;
        pending.delete(msg.id);
        resolve(msg);
      }
    }
  });

  child.on("exit", (code) => {
    for (const [, { reject }] of pending) {
      reject(new Error(`mcp exited (code=${code}) before reply. stderr=${stderr.slice(-300)}`));
    }
    pending.clear();
  });

  function send(method: string, params?: unknown): Promise<any> {
    const id = nextId++;
    const msg = { jsonrpc: "2.0", id, method, params };
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      child.stdin.write(JSON.stringify(msg) + "\n");
    });
  }

  function notify(method: string, params?: unknown): void {
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  }

  async function call(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<any> {
    const res = await send("tools/call", { name, arguments: args });
    if (res.error) {
      throw new Error(
        `${name}: jsonrpc error ${JSON.stringify(res.error)} | stderr=${stderr.slice(-300)}`,
      );
    }
    const text = res.result?.content?.[0]?.text;
    if (text === undefined) {
      throw new Error(
        `${name}: no text content in result: ${JSON.stringify(res.result)}`,
      );
    }
    if (res.result?.isError) {
      // Surface as a structured error so tests can assert on substrings.
      const e: Error & { isToolError?: boolean; toolText?: string } = new Error(text);
      e.isToolError = true;
      e.toolText = text;
      throw e;
    }
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async function stop(): Promise<void> {
    if (child.exitCode === null && !child.killed) {
      try {
        child.stdin.end();
      } catch {}
      child.kill();
      await new Promise<void>((r) => {
        if (child.exitCode !== null) return r();
        child.once("exit", () => r());
      });
    }
  }

  return { child, call, send, notify, stop };
}

async function initialize(client: McpClient): Promise<void> {
  await client.send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "integration-test", version: "0" },
  });
  client.notify("notifications/initialized");
}

// -- suite ------------------------------------------------------------------

describe.skipIf(!HAS_DIST)(
  "MCP server integration (spawned dist/index.js)",
  () => {
    let api: MockApi;
    let configDir: string;
    let client: McpClient;

    beforeAll(() => {
      if (!HAS_DIST) {
        // The describe.skipIf already handles this, but keep an explicit
        // hint in case CI logs only the failing assertion.
        // eslint-disable-next-line no-console
        console.warn(
          `dist/index.js missing at ${DIST_PATH} — run pnpm --filter @sendwyrd/mcp build first.`,
        );
      }
    });

    beforeEach(async () => {
      api = await startMockApi();
      configDir = mkdtempSync(join(tmpdir(), "sendwyrd-mcp-int-"));
      client = startMcp({
        XDG_CONFIG_HOME: configDir,
        SENDWYRD_ORIGIN: api.url,
      });
      await initialize(client);
    });

    afterEach(async () => {
      await client.stop();
      await api.close();
      rmSync(configDir, { recursive: true, force: true });
    });

    // -- listing ----------------------------------------------------------

    it("exposes all 13 expected tools via tools/list", async () => {
      const res = await client.send("tools/list", {});
      const names: string[] = (res.result?.tools ?? []).map(
        (t: { name: string }) => t.name,
      );
      const expected = [
        "sendwyrd_status",
        "sendwyrd_init",
        "sendwyrd_unlock",
        "sendwyrd_lock",
        "sendwyrd_compose",
        "sendwyrd_view",
        "sendwyrd_burn",
        "sendwyrd_reply",
        "sendwyrd_attest",
        "sendwyrd_history",
        "sendwyrd_inbox",
        "sendwyrd_recover",
        "sendwyrd_forget",
      ];
      for (const t of expected) expect(names).toContain(t);
      expect(names.length).toBeGreaterThanOrEqual(13);
    });

    // -- 1. status (pre-init) ---------------------------------------------

    it("sendwyrd_status reports absent + locked before init", async () => {
      const s = await client.call("sendwyrd_status");
      expect(s.seed_mode).toBe("absent");
      expect(s.unlocked).toBe(false);
      expect(s.origin).toBe(api.url);
      expect(s.history.total).toBe(0);
    });

    // -- 2. init then status ----------------------------------------------

    it("sendwyrd_init generates a 12-word mnemonic; status flips to open+unlocked", async () => {
      const init = await client.call("sendwyrd_init", {});
      expect(init.installed).toBe("fresh");
      expect(init.mode).toBe("open");
      expect(typeof init.mnemonic).toBe("string");
      expect(init.mnemonic.split(/\s+/)).toHaveLength(12);

      const s = await client.call("sendwyrd_status");
      expect(s.seed_mode).toBe("open");
      expect(s.unlocked).toBe(true);
    });

    // -- 3. init refuses double-install -----------------------------------

    it("sendwyrd_init twice rejects with a 'seed already exists' error", async () => {
      await client.call("sendwyrd_init", {});
      let captured: Error & { toolText?: string } | null = null;
      try {
        await client.call("sendwyrd_init", {});
      } catch (e) {
        captured = e as Error & { toolText?: string };
      }
      expect(captured).not.toBeNull();
      expect(captured!.message).toMatch(/seed already exists/i);
    });

    // -- 4. compose -------------------------------------------------------

    it("sendwyrd_compose POSTs to the mock and returns a fragment URL", async () => {
      await client.call("sendwyrd_init", {});
      const composed = await client.call("sendwyrd_compose", {
        body: "hello world",
        ttl_seconds: 600,
        replies_enabled: false,
      });
      expect(composed.handle).toMatch(/^[A-Za-z0-9_-]{16}$/);
      expect(composed.url).toBe(`${api.url}/w/${composed.handle}#${composed.url.split("#")[1]}`);
      // Mock should have stored the wyrd
      expect(api.wyrds.has(composed.handle)).toBe(true);
      // POST should have been recorded
      expect(api.requests.some((r) => r.method === "POST" && r.path === "/api/v1/wyrds")).toBe(true);
    });

    // -- 5. view (round-trip) ---------------------------------------------

    it("sendwyrd_view fetches and decrypts a wyrd composed in this session", async () => {
      await client.call("sendwyrd_init", {});
      const body = "the body that round-trips";
      const composed = await client.call("sendwyrd_compose", {
        body,
        ttl_seconds: 600,
      });
      const viewed = await client.call("sendwyrd_view", { url: composed.url });
      expect(viewed.status).toBe("live");
      expect(viewed.kind).toBe("wyrd");
      expect(viewed.body).toBe(body);
      expect(viewed.handle).toBe(composed.handle);
    });

    // -- 6. burn ----------------------------------------------------------

    it("sendwyrd_burn DELETEs and reports burned: true", async () => {
      await client.call("sendwyrd_init", {});
      const composed = await client.call("sendwyrd_compose", { body: "to burn" });
      const burnt = await client.call("sendwyrd_burn", {
        handle: composed.handle,
      });
      expect(burnt.burned).toBe(true);
      expect(burnt.handle).toBe(composed.handle);
      expect(typeof burnt.gone_at).toBe("number");
      expect(api.wyrds.get(composed.handle)?.burned).toBe(true);
    });

    // -- 7. view post-burn ------------------------------------------------

    it("sendwyrd_view on a burned wyrd returns status=gone", async () => {
      await client.call("sendwyrd_init", {});
      const composed = await client.call("sendwyrd_compose", { body: "tombstone target" });
      await client.call("sendwyrd_burn", { handle: composed.handle });
      const after = await client.call("sendwyrd_view", { url: composed.url });
      expect(after.status).toBe("gone");
      expect(after.reason).toBe("burned");
    });

    // -- 8. history -------------------------------------------------------

    it("sendwyrd_history returns the entries created by compose", async () => {
      await client.call("sendwyrd_init", {});
      const composed = await client.call("sendwyrd_compose", { body: "first" });
      const hist = await client.call("sendwyrd_history", {});
      expect(hist.count).toBe(1);
      expect(hist.entries[0].handle).toBe(composed.handle);
    });

    // -- 9. lock ----------------------------------------------------------

    it("sendwyrd_lock is a no-op in open mode and does not error", async () => {
      await client.call("sendwyrd_init", {});
      const locked = await client.call("sendwyrd_lock", {});
      expect(locked.locked).toBe(true);
      // Still able to compose because open mode does not require a cached seed
      const composed = await client.call("sendwyrd_compose", { body: "after lock" });
      expect(composed.handle).toMatch(/^[A-Za-z0-9_-]{16}$/);
    });

    // -- 10. reply --------------------------------------------------------

    it("sendwyrd_reply ECIES-encrypts and POSTs to /replies", async () => {
      await client.call("sendwyrd_init", {});
      const composed = await client.call("sendwyrd_compose", {
        body: "open for replies",
        replies_enabled: true,
        ttl_seconds: 600,
      });
      const replied = await client.call("sendwyrd_reply", {
        target_url: composed.url,
        body: "and a reply!",
      });
      expect(replied.sent).toBe(true);
      expect(replied.target_handle).toBe(composed.handle);
      expect(typeof replied.received_at).toBe("number");
      expect(api.replies.get(composed.handle)?.length).toBe(1);
    });

    // -- 11. attest -------------------------------------------------------

    it("sendwyrd_attest publishes a 3-line attestation body that parses", async () => {
      await client.call("sendwyrd_init", {});
      const composed = await client.call("sendwyrd_compose", {
        body: "to be attested",
        ttl_seconds: 600,
      });
      const attest = await client.call("sendwyrd_attest", {
        target_handle: composed.handle,
      });
      expect(attest.target_handle).toBe(composed.handle);
      expect(attest.attestation_handle).toMatch(/^[A-Za-z0-9_-]{16}$/);
      // Now view the attestation: this exercises the cross-verify path inside
      // sendwyrd_view (which fetches the target's K_origin_pub from the mock).
      const viewed = await client.call("sendwyrd_view", { url: attest.attestation_url });
      expect(viewed.status).toBe("live");
      expect(viewed.kind).toBe("attestation");
      expect(viewed.target_handle).toBe(composed.handle);
      expect(viewed.attestation_verified).toBe(true);
    });

    // -- 12. inbox --------------------------------------------------------

    it("sendwyrd_inbox decrypts replies submitted via sendwyrd_reply", async () => {
      await client.call("sendwyrd_init", {});
      const composed = await client.call("sendwyrd_compose", {
        body: "inbox owner",
        replies_enabled: true,
        ttl_seconds: 600,
      });
      const replyText = "this is the secret reply";
      await client.call("sendwyrd_reply", {
        target_url: composed.url,
        body: replyText,
      });
      const inbox = await client.call("sendwyrd_inbox", {
        handle: composed.handle,
      });
      expect(inbox.count).toBe(1);
      expect(inbox.entries).toHaveLength(1);
      expect(inbox.entries[0].target_handle).toBe(composed.handle);
      expect(inbox.entries[0].replies).toHaveLength(1);
      expect(inbox.entries[0].replies[0].body).toBe(replyText);
    });

    // -- 13. recover ------------------------------------------------------

    it("sendwyrd_recover sweeps presence-check; returns 0 against an empty mock", async () => {
      await client.call("sendwyrd_init", {});
      // Mock returns empty for every k_origin_pub by default.
      const rec = await client.call("sendwyrd_recover", { gap_limit: 3 });
      expect(rec.recovered_count).toBe(0);
      // gap_limit=3 means we scan indices 0..2 then stop. scanned_to == 2.
      expect(rec.scanned_to).toBe(2);
      // Confirm the MCP actually hit the presence-check endpoint.
      const presenceCalls = api.requests.filter(
        (r) =>
          r.method === "GET" && r.path.startsWith("/api/v1/authors/"),
      );
      expect(presenceCalls.length).toBeGreaterThanOrEqual(3);
    });

    // -- error path: invalid URL on view ---------------------------------

    it("sendwyrd_view rejects an obviously invalid URL with isError", async () => {
      await client.call("sendwyrd_init", {});
      let captured: Error | null = null;
      try {
        await client.call("sendwyrd_view", { url: "not-a-url" });
      } catch (e) {
        captured = e as Error;
      }
      expect(captured).not.toBeNull();
      expect(captured!.message).toMatch(/invalid wyrd URL/i);
    });
  },
);

// If dist is missing, surface a single explicit failure-style notice via a
// describe block that runs only in that case, so CI doesn't silently green
// when nothing executed.
describe.skipIf(HAS_DIST)("MCP server integration — DIST MISSING", () => {
  it("dist/index.js must exist; run `pnpm --filter @sendwyrd/mcp build` first", () => {
    expect(HAS_DIST).toBe(true);
  });
});

/**
 * MCP server: builds a McpServer over stdio and registers every tool.
 *
 * Tool surface (verbs only — no subscriptions, no polling, no auto-reply,
 * per the relay-primitive philosophy):
 *
 *   sendwyrd_status       — report config + seed + history state
 *   sendwyrd_init         — generate or import a mnemonic
 *   sendwyrd_unlock       — decrypt protected seed (cache for process)
 *   sendwyrd_lock         — clear in-memory cached seed
 *   sendwyrd_compose      — publish a wyrd, return URL
 *   sendwyrd_view         — fetch + decrypt a wyrd from URL
 *   sendwyrd_burn         — Schnorr-signed DELETE
 *   sendwyrd_reply        — ECIES-encrypted one-shot reply to author
 *   sendwyrd_attest       — re-sign target_handle, publish attestation wyrd
 *   sendwyrd_history      — dump local wyrd history
 *   sendwyrd_inbox        — fetch+decrypt replies for own wyrds
 *   sendwyrd_recover      — HD sweep via presence-check
 *
 * Resources (read-only browsable state):
 *
 *   sendwyrd-mcp://wyrd/{handle}  — body of a wyrd in your local history
 */

import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  b64uDecode,
  b64uEncode,
  buildFragmentUrl,
  composeAttestationBody,
  composeWyrd,
  decryptFromBase64Url,
  decryptReply,
  deriveOriginKey,
  encryptReply,
  parseAttestationBody,
  parseWyrdUrl,
  signAuthorshipAttestation,
  verifyAuthorshipAttestation,
  TTL_SECONDS_DEFAULT,
} from "@sendwyrd/core";
import { loadConfig, type McpConfig } from "./config.js";
import {
  burn as apiBurn,
  fetchReplies,
  fetchWyrd,
  presenceCheck,
  publish,
  submitReply,
} from "./api.js";
import {
  bumpCounter,
  findHistory,
  forgetSeed,
  getSeedMode,
  installFreshSeed,
  installImportedSeed,
  isUnlocked,
  listHistory,
  loadSeed,
  lock,
  markGone,
  mergeHistory,
  upsertHistory,
  type HistoryEntry,
} from "./store.js";

const SERVER_NAME = "sendwyrd";
const SERVER_VERSION = "0.1.0";
const GAP_LIMIT = 20;

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function ok(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

function err(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

function asJson(v: unknown): string {
  return JSON.stringify(v, null, 2);
}

export async function startServer(): Promise<void> {
  const cfg = loadConfig();
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions: [
        "SendWyrd MCP — agent-callable verbs over the SendWyrd capability protocol.",
        "",
        "First call should be `sendwyrd_status`. If no seed exists, call `sendwyrd_init`.",
        "Compose with `sendwyrd_compose`. View any wyrd URL with `sendwyrd_view`.",
        "Burn / reply / attest are signed verbs — they require an unlocked seed.",
        "",
        "Live wyrds in your local history are also exposed as MCP resources at",
        "`sendwyrd-mcp://wyrd/{handle}`, browsable via resources/list.",
        "",
        "Verbs only: there are no subscriptions, polling, or watch tools by design.",
        "SendWyrd is a relay primitive, not a chat host.",
      ].join("\n"),
    },
  );

  registerStatus(server, cfg);
  registerInit(server, cfg);
  registerUnlock(server, cfg);
  registerLock(server);
  registerCompose(server, cfg);
  registerView(server, cfg);
  registerBurn(server, cfg);
  registerReply(server, cfg);
  registerAttest(server, cfg);
  registerHistory(server, cfg);
  registerInbox(server, cfg);
  registerRecover(server, cfg);
  registerForget(server, cfg);
  registerWyrdResource(server, cfg);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// -- resources ---------------------------------------------------------------

function registerWyrdResource(server: McpServer, cfg: McpConfig): void {
  // Each live history entry is a readable resource. Listing returns one
  // entry per non-burned wyrd; reading fetches the envelope and decrypts
  // with the locally-stored K_read. Recovered entries (no K_read) read as
  // a metadata-only placeholder so an agent can still cite the URI.
  server.resource(
    "wyrd",
    new ResourceTemplate("sendwyrd-mcp://wyrd/{handle}", {
      list: async () => ({
        resources: listHistory(cfg)
          .filter((e) => !e.gone_at)
          .map((e) => ({
            uri: `sendwyrd-mcp://wyrd/${e.handle}`,
            name: e.nickname ?? e.handle,
            description: e.is_attestation
              ? `attestation (n=${e.n}, expires ${new Date(
                  e.expires_at,
                ).toISOString()})`
              : `wyrd (n=${e.n}, expires ${new Date(
                  e.expires_at,
                ).toISOString()})`,
            mimeType: "text/plain",
          })),
      }),
    }),
    async (uri, vars) => {
      const handle = Array.isArray(vars.handle) ? vars.handle[0] : vars.handle;
      if (!handle) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: "(invalid resource URI: missing handle)",
            },
          ],
        };
      }
      const entry = findHistory(cfg, handle);
      if (!entry) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: "(handle not in local history)",
            },
          ],
        };
      }
      if (entry.gone_at) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `(${entry.gone_reason ?? "gone"} at ${new Date(
                entry.gone_at,
              ).toISOString()})`,
            },
          ],
        };
      }
      if (!entry.k_read_b64u) {
        // Recovered entry — the body is sealed without K_read.
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `(body sealed — recovered entry has no K_read; n=${entry.n}, k_origin_pub=${entry.k_origin_pub_b64u})`,
            },
          ],
        };
      }
      const result = await fetchWyrd(cfg.origin, handle);
      if (result.kind === "not_found") {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: "(not found on origin)",
            },
          ],
        };
      }
      if (result.kind === "gone") {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `(${result.data.reason} at ${result.data.gone_at})`,
            },
          ],
        };
      }
      if (result.kind === "error") {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `(fetch failed: HTTP ${result.status})`,
            },
          ],
        };
      }
      const env = result.data;
      try {
        const body = await decryptFromBase64Url(env.envelope, {
          k_read: b64uDecode(entry.k_read_b64u),
          handle: b64uDecode(handle),
          expires_at_ms: env.expires_at,
          replies_enabled: env.replies_enabled,
        });
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: body }],
        };
      } catch (e) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "text/plain",
              text: `(decrypt failed: ${(e as Error).message})`,
            },
          ],
        };
      }
    },
  );
}

// -- lifecycle ---------------------------------------------------------------

function registerStatus(server: McpServer, cfg: McpConfig): void {
  server.tool(
    "sendwyrd_status",
    "Report MCP server config: origin, seed mode, unlocked-or-not, history count. Always safe to call.",
    {},
    async () => {
      const mode = getSeedMode(cfg);
      const history = listHistory(cfg);
      const live = history.filter((h) => !h.gone_at).length;
      const gone = history.length - live;
      const passphraseSource = cfg.passphrase
        ? process.env.SENDWYRD_PASSPHRASE_CMD
          ? "SENDWYRD_PASSPHRASE_CMD"
          : "SENDWYRD_PASSPHRASE"
        : null;
      return ok(
        asJson({
          origin: cfg.origin,
          config_dir: cfg.configDir,
          seed_mode: mode,
          unlocked: isUnlocked(cfg),
          passphrase_source: passphraseSource,
          history: { total: history.length, live, gone },
          server_version: SERVER_VERSION,
        }),
      );
    },
  );
}

function registerInit(server: McpServer, cfg: McpConfig): void {
  server.tool(
    "sendwyrd_init",
    "Initialize a new SendWyrd identity. Either generates a fresh BIP-39 mnemonic (default) or imports an existing one. If a passphrase is given (or SENDWYRD_PASSPHRASE is set), the seed is encrypted on disk; otherwise stored open. Refuses to overwrite an existing seed — call sendwyrd_forget first to replace.",
    {
      mnemonic: z
        .string()
        .optional()
        .describe(
          "Optional existing BIP-39 mnemonic to import. If omitted, a fresh one is generated.",
        ),
      words: z
        .union([z.literal(12), z.literal(24)])
        .optional()
        .describe("Mnemonic length when generating fresh. Default 12."),
      passphrase: z
        .string()
        .optional()
        .describe(
          "Optional passphrase. If provided, seed is stored encrypted (PBKDF2-AES-GCM). Otherwise stored open.",
        ),
    },
    async ({ mnemonic, words, passphrase }) => {
      const pass = passphrase ?? cfg.passphrase ?? undefined;
      try {
        if (mnemonic) {
          await installImportedSeed(cfg, { mnemonic, passphrase: pass });
          return ok(
            asJson({
              installed: "imported",
              mode: pass ? "protected" : "open",
              hint: "run sendwyrd_recover to rebuild local history from prior wyrds.",
            }),
          );
        }
        const { mnemonic: m } = await installFreshSeed(cfg, {
          words: (words ?? 12) as 12 | 24,
          passphrase: pass,
        });
        return ok(
          asJson({
            installed: "fresh",
            mode: pass ? "protected" : "open",
            mnemonic: m,
            warning:
              "Store this mnemonic securely. Without it you cannot recover wyrds you author.",
          }),
        );
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );
}

function registerUnlock(server: McpServer, cfg: McpConfig): void {
  server.tool(
    "sendwyrd_unlock",
    "Decrypt the on-disk passphrase-protected seed and cache it for the lifetime of this MCP process. Only meaningful in protected mode.",
    {
      passphrase: z.string().describe("The passphrase that protects the seed."),
    },
    async ({ passphrase }) => {
      try {
        await loadSeed(cfg, passphrase);
        return ok(asJson({ unlocked: true }));
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );
}

function registerLock(server: McpServer): void {
  server.tool(
    "sendwyrd_lock",
    "Clear the in-memory cached seed and passphrase. Subsequent signed operations will require sendwyrd_unlock again. No-op in open mode.",
    {},
    async () => {
      lock();
      return ok(asJson({ locked: true }));
    },
  );
}

function registerForget(server: McpServer, cfg: McpConfig): void {
  server.tool(
    "sendwyrd_forget",
    "Wipe all on-disk state (seed, history, config). Destructive; call only if you intend to fully reset this MCP install. The mnemonic is still recoverable from your own backup if you have one.",
    {
      confirm: z
        .literal("yes-i-am-sure")
        .describe("Pass the literal string 'yes-i-am-sure' to proceed."),
    },
    async ({ confirm }) => {
      if (confirm !== "yes-i-am-sure") return err("confirm token mismatch");
      forgetSeed(cfg);
      return ok(asJson({ forgotten: true }));
    },
  );
}

// -- compose / view / burn ---------------------------------------------------

function registerCompose(server: McpServer, cfg: McpConfig): void {
  server.tool(
    "sendwyrd_compose",
    [
      "Publish a wyrd. Returns the canonical fragment-form URL to share.",
      "Body cap: 300 Unicode codepoints (URLs do not count).",
      "ttl_seconds=0 means permanent. Default 7,776,000 = 90 days.",
      "replies_enabled=true allows ECIES one-shot replies via sendwyrd_reply.",
    ].join(" "),
    {
      body: z
        .string()
        .min(1)
        .describe("UTF-8 plaintext body, ≤300 codepoints (URLs excluded)."),
      ttl_seconds: z
        .number()
        .int()
        .min(0)
        .max(31_536_000)
        .optional()
        .describe(
          "Time-to-live in seconds. 0 = permanent. Default 7776000 (90 days).",
        ),
      replies_enabled: z
        .boolean()
        .optional()
        .describe("Whether the wyrd accepts replies. Default false."),
    },
    async ({ body, ttl_seconds, replies_enabled }) => {
      try {
        const sc = await loadSeed(cfg);
        const n = sc.counter;
        // Per spec §5.2: bump the counter BEFORE publish so the index is
        // consumed even if publish fails. Failure of bump itself is the only
        // case where we abort.
        await bumpCounter(cfg, n + 1);

        const result = await composeWyrd({
          plaintext: body,
          seed: sc.seed,
          n,
          ttl_seconds: ttl_seconds ?? TTL_SECONDS_DEFAULT,
          replies_enabled: replies_enabled ?? false,
        });

        const pub = await publish(cfg.origin, result.publish_payload);
        const url = buildFragmentUrl(
          cfg.origin,
          pub.handle,
          result.k_read_b64u,
        );

        const entry: HistoryEntry = {
          handle: pub.handle,
          n,
          k_origin_pub_b64u: result.publish_payload.k_origin_pub,
          k_read_b64u: result.k_read_b64u,
          published_at: pub.published_at,
          expires_at: pub.expires_at,
          replies_enabled: replies_enabled ?? false,
        };
        upsertHistory(cfg, entry);

        return ok(
          asJson({
            url,
            handle: pub.handle,
            n,
            published_at: pub.published_at,
            expires_at: pub.expires_at,
            replies_enabled: replies_enabled ?? false,
          }),
        );
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );
}

function registerView(server: McpServer, cfg: McpConfig): void {
  server.tool(
    "sendwyrd_view",
    "Fetch and decrypt a wyrd by URL. Accepts fragment form (sendwyrd.com/w/H#K) or public form (.../w/H/k/K). If the body is an authorship attestation, the result includes verification status.",
    {
      url: z.string().describe("A SendWyrd URL — fragment or public form."),
    },
    async ({ url }) => {
      try {
        const parsed = parseWyrdUrl(url);
        if (parsed.form === "invalid") {
          return err(`invalid wyrd URL: ${parsed.reason}`);
        }
        const result = await fetchWyrd(cfg.origin, parsed.handle);
        if (result.kind === "not_found") {
          return ok(asJson({ status: "not_found", handle: parsed.handle }));
        }
        if (result.kind === "gone") {
          return ok(asJson({ handle: parsed.handle, ...result.data }));
        }
        if (result.kind === "error") {
          return err(`fetch failed: HTTP ${result.status}`);
        }
        const env = result.data;
        const body = await decryptFromBase64Url(env.envelope, {
          k_read: b64uDecode(parsed.k_read),
          handle: b64uDecode(env.handle),
          expires_at_ms: env.expires_at,
          replies_enabled: env.replies_enabled,
        });
        const attest = parseAttestationBody(body);
        if (attest) {
          // Cross-fetch the target's K_origin_pub for verification.
          const targetFetch = await fetchWyrd(cfg.origin, attest.target_handle);
          let verified: boolean | "indeterminate" = "indeterminate";
          if (targetFetch.kind === "live" || targetFetch.kind === "gone") {
            const target_pub =
              targetFetch.kind === "live"
                ? targetFetch.data.k_origin_pub
                : null;
            if (target_pub) {
              verified = verifyAuthorshipAttestation({
                target_handle_b64u: attest.target_handle,
                target_k_origin_pub_b64u: target_pub,
                sig_b64u: attest.sig_b64u,
              });
            }
          }
          return ok(
            asJson({
              status: "live",
              kind: "attestation",
              handle: env.handle,
              target_handle: attest.target_handle,
              attestation_verified: verified,
              published_at: env.published_at,
              expires_at: env.expires_at,
              k_origin_pub: env.k_origin_pub,
              replies_enabled: env.replies_enabled,
            }),
          );
        }
        return ok(
          asJson({
            status: "live",
            kind: "wyrd",
            handle: env.handle,
            body,
            published_at: env.published_at,
            expires_at: env.expires_at,
            k_origin_pub: env.k_origin_pub,
            replies_enabled: env.replies_enabled,
          }),
        );
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );
}

function registerBurn(server: McpServer, cfg: McpConfig): void {
  server.tool(
    "sendwyrd_burn",
    "Burn a wyrd you authored. Requires the handle to be in your local history (so we know which HD index to re-derive K_origin_priv from). Server returns 410 Gone for the next 30 days, then 404.",
    {
      handle: z
        .string()
        .describe("16-char base64url handle of the wyrd to burn."),
    },
    async ({ handle }) => {
      try {
        const entry = findHistory(cfg, handle);
        if (!entry) {
          return err(
            "handle not in local history — cannot derive private key. Try sendwyrd_recover first.",
          );
        }
        const sc = await loadSeed(cfg);
        const k = deriveOriginKey(sc.seed, entry.n);
        const result = await apiBurn(cfg.origin, {
          handle,
          k_origin_priv: k.k_origin_priv,
        });
        if (result.kind === "burned") {
          markGone(cfg, handle, "burned", result.data.gone_at);
          return ok(
            asJson({
              burned: true,
              handle,
              gone_at: result.data.gone_at,
            }),
          );
        }
        if (result.kind === "already_gone") {
          markGone(cfg, handle, "burned");
          return ok(asJson({ burned: false, status: "already_gone" }));
        }
        if (result.kind === "not_found") {
          return ok(asJson({ burned: false, status: "not_found" }));
        }
        return err(`burn failed: HTTP ${result.status}`);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );
}

// -- reply / attest ----------------------------------------------------------

function registerReply(server: McpServer, cfg: McpConfig): void {
  server.tool(
    "sendwyrd_reply",
    "Send an ECIES-encrypted one-shot reply to the author of `target_url`. Reply cap: 300 codepoints. The author can read the reply via sendwyrd_inbox; you cannot read your own reply once sent.",
    {
      target_url: z.string().describe("URL of the wyrd you are replying to."),
      body: z.string().min(1).describe("Reply body, ≤300 codepoints."),
    },
    async ({ target_url, body }) => {
      try {
        const parsed = parseWyrdUrl(target_url);
        if (parsed.form === "invalid") {
          return err(`invalid target URL: ${parsed.reason}`);
        }
        // Need the target's K_origin_pub from its publish record.
        const targetFetch = await fetchWyrd(cfg.origin, parsed.handle);
        if (targetFetch.kind !== "live") {
          return err(
            `target wyrd not available for reply (status: ${targetFetch.kind})`,
          );
        }
        if (!targetFetch.data.replies_enabled) {
          return err("target wyrd has replies disabled");
        }
        const blob = await encryptReply({
          plaintext: body,
          handle: b64uDecode(parsed.handle),
          k_origin_pub: b64uDecode(targetFetch.data.k_origin_pub),
        });
        const res = await submitReply(cfg.origin, {
          handle: parsed.handle,
          reply_blob: b64uEncode(blob),
        });
        return ok(
          asJson({
            sent: true,
            target_handle: parsed.handle,
            received_at: res.received_at,
          }),
        );
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );
}

function registerAttest(server: McpServer, cfg: McpConfig): void {
  server.tool(
    "sendwyrd_attest",
    "Publish a static authorship attestation: re-derive K_origin_priv for a target wyrd you authored, sign the canonical message, and emit a 3-line attestation-formatted wyrd that anyone can verify against the target's published K_origin_pub. If target_handle is omitted, attests the most-recent non-attestation, non-burned wyrd in your local history.",
    {
      target_handle: z
        .string()
        .optional()
        .describe(
          "16-char base64url handle of the wyrd to attest authorship of. If omitted, the most-recent non-attestation, non-burned wyrd in your history is used.",
        ),
      ttl_seconds: z
        .number()
        .int()
        .min(0)
        .max(31_536_000)
        .optional()
        .describe(
          "TTL of the attestation wyrd. 0 = permanent. Default 7776000 (90 days).",
        ),
    },
    async ({ target_handle, ttl_seconds }) => {
      try {
        let targetEntry: HistoryEntry | undefined;
        let resolvedTargetHandle: string;
        if (target_handle) {
          targetEntry = findHistory(cfg, target_handle);
          resolvedTargetHandle = target_handle;
          if (!targetEntry) {
            return err(
              "target_handle not in local history — cannot derive private key for attestation. Try sendwyrd_recover first.",
            );
          }
        } else {
          // Ergonomic default: the most-recent attestable wyrd.
          // Sorted by listHistory (newest first); pick the first that's
          // mine to attest — non-attestation, non-burned, not the
          // attestation we'd be composing of an earlier attestation.
          targetEntry = listHistory(cfg).find(
            (e) => !e.is_attestation && !e.gone_at,
          );
          if (!targetEntry) {
            return err(
              "no attestable wyrd in local history (need at least one non-attestation, non-burned wyrd you authored). Run sendwyrd_compose or sendwyrd_recover first.",
            );
          }
          resolvedTargetHandle = targetEntry.handle;
        }

        const sc = await loadSeed(cfg);
        const sig_b64u = signAuthorshipAttestation({
          seed: sc.seed,
          n: targetEntry.n,
          target_handle_b64u: resolvedTargetHandle,
        });
        const body = composeAttestationBody({
          target_handle: resolvedTargetHandle,
          sig_b64u,
        });

        // Now compose a normal wyrd whose body is the attestation.
        const n = sc.counter;
        await bumpCounter(cfg, n + 1);
        const result = await composeWyrd({
          plaintext: body,
          seed: sc.seed,
          n,
          ttl_seconds: ttl_seconds ?? TTL_SECONDS_DEFAULT,
          replies_enabled: false,
        });
        const pub = await publish(cfg.origin, result.publish_payload);
        const url = buildFragmentUrl(
          cfg.origin,
          pub.handle,
          result.k_read_b64u,
        );

        upsertHistory(cfg, {
          handle: pub.handle,
          n,
          k_origin_pub_b64u: result.publish_payload.k_origin_pub,
          k_read_b64u: result.k_read_b64u,
          published_at: pub.published_at,
          expires_at: pub.expires_at,
          replies_enabled: false,
          nickname: `attestation of ${resolvedTargetHandle}`,
          is_attestation: true,
        });

        return ok(
          asJson({
            attestation_url: url,
            attestation_handle: pub.handle,
            target_handle: resolvedTargetHandle,
            target_was_inferred: !target_handle,
          }),
        );
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );
}

// -- history / inbox / recover -----------------------------------------------

function registerHistory(server: McpServer, cfg: McpConfig): void {
  server.tool(
    "sendwyrd_history",
    "List wyrds you authored that are recorded locally. No network call. Includes burned/expired entries marked gone.",
    {
      include_gone: z
        .boolean()
        .optional()
        .describe("Include gone (burned/expired) entries. Default true."),
    },
    async ({ include_gone }) => {
      const all = listHistory(cfg);
      const filtered =
        include_gone === false ? all.filter((e) => !e.gone_at) : all;
      return ok(asJson({ count: filtered.length, entries: filtered }));
    },
  );
}

function registerInbox(server: McpServer, cfg: McpConfig): void {
  server.tool(
    "sendwyrd_inbox",
    "Fetch and decrypt replies for one wyrd, or all reply-enabled wyrds in your history. One-shot read — no subscription. Replies whose target is gone/expired are skipped.",
    {
      handle: z
        .string()
        .optional()
        .describe(
          "Optional specific handle. If omitted, sweeps all reply-enabled wyrds in history.",
        ),
    },
    async ({ handle }) => {
      try {
        const sc = await loadSeed(cfg);
        const targets = handle
          ? listHistory(cfg).filter((e) => e.handle === handle)
          : listHistory(cfg).filter((e) => e.replies_enabled && !e.gone_at);
        if (targets.length === 0) {
          return ok(
            asJson({
              count: 0,
              entries: [],
              note: handle
                ? "handle not found in local history"
                : "no reply-enabled live wyrds in history",
            }),
          );
        }
        const entries: Array<{
          target_handle: string;
          target_nickname?: string;
          replies: Array<{ body: string; received_at: number }>;
        }> = [];
        for (const t of targets) {
          const k = deriveOriginKey(sc.seed, t.n);
          const replies = await fetchReplies(cfg.origin, {
            handle: t.handle,
            k_origin_priv: k.k_origin_priv,
          });
          const decoded: Array<{ body: string; received_at: number }> = [];
          for (const r of replies) {
            try {
              const body = await decryptReply({
                blob: b64uDecode(r.reply_blob),
                handle: b64uDecode(t.handle),
                k_origin_priv: k.k_origin_priv,
              });
              decoded.push({ body, received_at: r.received_at });
            } catch {
              // skip undecryptable; logged but not surfaced
            }
          }
          entries.push({
            target_handle: t.handle,
            ...(t.nickname ? { target_nickname: t.nickname } : {}),
            replies: decoded,
          });
        }
        const total = entries.reduce((s, e) => s + e.replies.length, 0);
        return ok(asJson({ count: total, entries }));
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );
}

function registerRecover(server: McpServer, cfg: McpConfig): void {
  server.tool(
    "sendwyrd_recover",
    "HD recovery sweep: derive K_origin at m/300'/n' for n=0,1,2,... and presence-check each against the server. Stops after 20 consecutive empty indices (BIP-44 gap limit). Updates the local history with reconstructed entries (without k_read — bodies stay sealed unless you also have the URL).",
    {
      gap_limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Consecutive-empty stop threshold. Default 20."),
    },
    async ({ gap_limit }) => {
      try {
        const sc = await loadSeed(cfg);
        const limit = gap_limit ?? GAP_LIMIT;
        let n = 0;
        let consecutiveEmpty = 0;
        const recovered: HistoryEntry[] = [];
        while (consecutiveEmpty < limit) {
          const k = deriveOriginKey(sc.seed, n);
          const presence = await presenceCheck(cfg.origin, {
            k_origin_pub: k.k_origin_pub,
            k_origin_priv: k.k_origin_priv,
          });
          if (presence.handles.length === 0) {
            consecutiveEmpty++;
          } else {
            consecutiveEmpty = 0;
            for (const h of presence.handles) {
              recovered.push({
                handle: h.handle,
                n,
                k_origin_pub_b64u: b64uEncode(k.k_origin_pub),
                published_at: h.published_at,
                expires_at: h.expires_at,
                replies_enabled: h.replies_enabled,
                ...(h.gone_at ? { gone_at: h.gone_at } : {}),
                ...(h.gone_reason && h.gone_reason !== "key_mismatch"
                  ? { gone_reason: h.gone_reason }
                  : {}),
                recovered: true,
              });
            }
          }
          n++;
        }
        const nextN = n - limit;
        const merged = mergeHistory(cfg, recovered);
        // Only advance the on-disk counter if recovery found a higher index.
        if (nextN > sc.counter) {
          await bumpCounter(cfg, nextN);
        }
        return ok(
          asJson({
            scanned_to: n - 1,
            next_n: Math.max(nextN, sc.counter),
            recovered_count: recovered.length,
            new_in_history: merged.added,
          }),
        );
      } catch (e) {
        return err((e as Error).message);
      }
    },
  );
}

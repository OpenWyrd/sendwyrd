/**
 * GET /api/v1/unfurl?url=<encoded URL>
 *
 * Server-side OpenGraph metadata fetch. The renderer in the web client
 * calls this when it encounters an external HTTP(S) URL inside a wyrd
 * body and wants to surface a preview card. The client cannot fetch the
 * remote URL directly because most sites don't expose CORS for that, so
 * we proxy on the worker.
 *
 * Privacy posture (recipient-side, per ADR-013-style framing): the host
 * sees an unfurl request whenever a recipient renders a wyrd containing
 * an external URL. The host does NOT see the wyrd body, the wyrd handle,
 * or any author binding — only the raw URL the recipient asked about.
 * The worker does not log unfurl URLs (no Sentry breadcrumb, no DB
 * insert, no analytics). Cache hits are served from Cloudflare's edge
 * cache without further visibility.
 *
 * Safety:
 *   - http(s) only; no other schemes
 *   - Accept: text/html only
 *   - Response size cap: 256 KiB; longer responses are truncated
 *   - Subrequest timeout: 5 seconds via AbortSignal
 *   - Cache: 1 hour (CF Cache API). Repeat unfurls of the same URL across
 *     recipients hit cache and never reach the origin host again.
 *   - SSRF: Cloudflare Workers' fetch refuses RFC 1918 / loopback at the
 *     platform layer regardless of DNS, so we lean on that as the
 *     load-bearing block. As defense-in-depth we additionally refuse
 *     literal-IP hosts in private/loopback/link-local ranges, plus
 *     `.local` / `.internal` TLDs, before any subrequest, and we
 *     re-validate the final URL after redirect-follow so a public→private
 *     bounce can't slip through. If/when we move to a self-hosted egress,
 *     this filter must stay (and gain DNS-resolution + per-redirect
 *     re-fetch logic).
 */

import { Hono } from "hono";
import type { Env } from "../env.js";
import { rateLimit, clientIp } from "../rateLimit.js";

type App = Hono<{ Bindings: Env }>;

export const unfurlRoutes: App = new Hono<{ Bindings: Env }>();

const MAX_BYTES = 256 * 1024;
const TIMEOUT_MS = 5_000;
const CACHE_TTL_S = 3600;

// Limits per metadata field — we surface short previews, not the page.
const TITLE_MAX = 240;
const DESC_MAX = 480;
const URL_MAX = 2048;

interface UnfurlMeta {
  ok: true;
  title: string | null;
  description: string | null;
  image: string | null;
  hostname: string;
}
interface UnfurlError {
  ok: false;
  reason: "invalid_url" | "fetch_failed" | "non_html" | "no_meta";
}

unfurlRoutes.get("/", async (c) => {
  const rl = await rateLimit(c, "RL_UNFURL", clientIp(c));
  if (rl) return rl;

  const raw = c.req.query("url");
  if (!raw || raw.length > URL_MAX) {
    return c.json<UnfurlError>({ ok: false, reason: "invalid_url" }, 400);
  }
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return c.json<UnfurlError>({ ok: false, reason: "invalid_url" }, 400);
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return c.json<UnfurlError>({ ok: false, reason: "invalid_url" }, 400);
  }
  // Defense-in-depth alongside CF Workers' platform-level RFC 1918 block:
  // refuse hostnames that obviously target internal/loopback infra so a
  // typo or future egress-policy change can't open an SSRF window.
  if (isUnsafeHost(target.hostname)) {
    return c.json<UnfurlError>({ ok: false, reason: "invalid_url" }, 400);
  }

  // Cache key: a stable canonical of the request. We include the query
  // string only on the unfurl-endpoint side (not the target's), and we
  // cache the response object directly via the CF Cache API.
  const cacheKey = new Request(
    `https://sendwyrd.com/api/v1/unfurl?url=${encodeURIComponent(target.toString())}`,
    { method: "GET" },
  );
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const meta = await fetchUnfurl(target);
  const status = meta.ok ? 200 : 404;
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": `public, max-age=${CACHE_TTL_S}`,
    "Access-Control-Allow-Origin": "https://sendwyrd.com",
  });
  const res = new Response(JSON.stringify(meta), { status, headers });
  // Stash a clone in cache; consume the original ourselves.
  c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
});

async function fetchUnfurl(target: URL): Promise<UnfurlMeta | UnfurlError> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // HEAD-check first to learn the content-type without pulling the body.
    // If it's an image, return the URL itself as the card image — that
    // covers CDN image URLs (gstatic, imgur direct, cloudfront) which
    // serve images at extensionless paths.
    const head = await fetch(target.toString(), {
      method: "HEAD",
      headers: {
        "User-Agent": "SendWyrdUnfurl/1.0 (+https://sendwyrd.com)",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!isFinalUrlSafe(head)) return { ok: false, reason: "fetch_failed" };
    if (head.ok) {
      const ct = head.headers.get("content-type") ?? "";
      if (ct.startsWith("image/")) {
        return {
          ok: true,
          title: null,
          description: null,
          image: target.toString(),
          hostname: target.hostname,
        };
      }
    }

    const res = await fetch(target.toString(), {
      method: "GET",
      headers: {
        Accept: "text/html",
        "User-Agent": "SendWyrdUnfurl/1.0 (+https://sendwyrd.com)",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!isFinalUrlSafe(res)) return { ok: false, reason: "fetch_failed" };
    if (!res.ok) return { ok: false, reason: "fetch_failed" };
    const ct = res.headers.get("content-type") ?? "";
    if (ct.startsWith("image/")) {
      // Some servers ignore HEAD requests; double-check on the GET path.
      return {
        ok: true,
        title: null,
        description: null,
        image: target.toString(),
        hostname: target.hostname,
      };
    }
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      return { ok: false, reason: "non_html" };
    }
    const html = await readBoundedText(res, MAX_BYTES);
    const meta = extractMeta(html, target);
    if (!meta.title && !meta.description && !meta.image) {
      return { ok: false, reason: "no_meta" };
    }
    return {
      ok: true,
      title: meta.title,
      description: meta.description,
      image: meta.image,
      hostname: target.hostname,
    };
  } catch {
    return { ok: false, reason: "fetch_failed" };
  } finally {
    clearTimeout(t);
  }
}

/**
 * After redirects are followed, the Response carries the final URL on
 * `res.url`. Re-validate against isUnsafeHost so a public→private bounce
 * is refused even though we asked for `redirect: "follow"`.
 */
function isFinalUrlSafe(res: Response): boolean {
  if (!res.url) return true;
  try {
    const u = new URL(res.url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    return !isUnsafeHost(u.hostname);
  } catch {
    return false;
  }
}

async function readBoundedText(res: Response, max: number): Promise<string> {
  if (!res.body) return await res.text();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    total += value.length;
    if (total >= max) {
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
      break;
    }
  }
  return new TextDecoder("utf-8", { fatal: false, ignoreBOM: false }).decode(
    concat(chunks),
  );
}

function concat(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

interface ParsedMeta {
  title: string | null;
  description: string | null;
  image: string | null;
}

/**
 * Pull og:title, og:description, og:image (with twitter: fallbacks) and a
 * <title> + <meta name="description"> last-resort. Regex-based, intentionally
 * conservative. No HTML parsing library — Workers bundle size + start-time
 * matter more than handling exotic edge cases.
 */
export function extractMeta(html: string, target: URL): ParsedMeta {
  const title =
    findMeta(html, "og:title") ??
    findMeta(html, "twitter:title") ??
    findTitle(html);
  const description =
    findMeta(html, "og:description") ??
    findMeta(html, "twitter:description") ??
    findMetaName(html, "description");
  const image =
    findMeta(html, "og:image") ??
    findMeta(html, "twitter:image") ??
    findMeta(html, "twitter:image:src") ??
    null;
  return {
    title: clip(decodeEntities(title), TITLE_MAX),
    description: clip(decodeEntities(description), DESC_MAX),
    image: resolveImageUrl(image, target),
  };
}

// Pre-tokenize the document into individual <meta ...> tags via a single
// linear pass. Earlier versions ran open-ended regex like /<meta[^>]+.../
// directly against up to 256 KiB of attacker-controlled HTML, which
// catastrophically backtracks if the input lacks a closing `>`. Splitting
// by tag bounds the per-tag regex to METATAG_MAX bytes — turning the
// hot path from O(N²)+backtracking into O(N) tokenize + O(K * METATAG_MAX)
// match.
const METATAG_MAX = 4096;
const META_TAG_RE = /<meta\b([^>]{0,4096})>/gi;

function metaTags(html: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  META_TAG_RE.lastIndex = 0;
  while ((m = META_TAG_RE.exec(html)) !== null) {
    const inner = m[1] ?? "";
    if (inner.length < METATAG_MAX) out.push(inner);
    if (out.length > 512) break; // hard cap on tag count
  }
  return out;
}

const ATTR_RE = /(\w[\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;

function parseAttrs(inner: string): Record<string, string> {
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(inner)) !== null) {
    const name = (m[1] ?? "").toLowerCase();
    const val = m[2] ?? m[3] ?? m[4] ?? "";
    if (name && !(name in out)) out[name] = val;
  }
  return out;
}

function findMetaWith(
  html: string,
  attrName: "property" | "name",
  attrValue: string,
): string | null {
  const want = attrValue.toLowerCase();
  for (const inner of metaTags(html)) {
    const attrs = parseAttrs(inner);
    if ((attrs[attrName] ?? "").toLowerCase() === want) {
      const content = attrs.content;
      if (typeof content === "string" && content.length > 0) return content;
    }
  }
  return null;
}

function findMeta(html: string, prop: string): string | null {
  return findMetaWith(html, "property", prop);
}

function findMetaName(html: string, name: string): string | null {
  return findMetaWith(html, "name", name);
}

function findTitle(html: string): string | null {
  // Bound the open `<title` opener gap to 256 chars so attacker can't
  // induce backtracking by omitting the closing `>`.
  const m = html.match(/<title\b[^>]{0,256}>([\s\S]{0,1000}?)<\/title>/i);
  return m ? (m[1] ?? "").trim() : null;
}

function clip(s: string | null, max: number): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max - 1) + "…" : trimmed;
}

function resolveImageUrl(raw: string | null, base: URL): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed, base);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.toString().length > URL_MAX) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Defense-in-depth host filter. CF Workers' fetch already refuses RFC 1918
 * and link-local destinations at the platform layer (see header comment),
 * but this guard rejects URLs that *obviously* target internal infra so
 * we never emit those subrequests in the first place. It is intentionally
 * conservative: any literal IP in a private/reserved range, any *.local /
 * *.internal hostname, and a couple of well-known names get refused. We
 * deliberately do NOT do DNS resolution here — that would add latency and
 * still wouldn't beat rebinding (each fetch resolves independently at CF).
 */
function isUnsafeHost(hostnameRaw: string): boolean {
  const host = hostnameRaw.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (
    host === "localhost" ||
    host === "ip6-localhost" ||
    host === "ip6-loopback" ||
    host === "broadcasthost"
  ) {
    return true;
  }
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host.endsWith(".localhost") || host.endsWith(".localdomain")) return true;
  // IPv4 literal — block private / loopback / link-local / reserved.
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [, aS, bS, cS] = v4;
    const a = Number(aS);
    const b = Number(bS);
    const c = Number(cS);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved / future
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
    if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  }
  // IPv6 literal — block loopback / link-local / unique-local / unspecified.
  if (host.includes(":")) {
    if (host === "::" || host === "::1") return true;
    if (host.startsWith("fe80:") || host.startsWith("fe80::")) return true;
    if (host.startsWith("fc") || host.startsWith("fd")) return true; // ULA
    if (host.startsWith("ff")) return true; // multicast
    // IPv4-mapped IPv6: ::ffff:a.b.c.d — let the v4 path catch it via a re-parse.
    const mapped = host.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (mapped && mapped[1]) return isUnsafeHost(mapped[1]);
  }
  return false;
}

function decodeEntities(s: string | null): string | null {
  if (s == null) return null;
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number.parseInt(n, 10);
      return code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      const code = Number.parseInt(h, 16);
      return code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : "";
    });
}

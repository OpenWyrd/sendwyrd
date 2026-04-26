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
 *   - We DO NOT attempt SSRF-defense beyond the http(s) scheme check.
 *     Cloudflare Workers' fetch routes through public DNS — RFC 1918
 *     ranges aren't reachable. If/when we move to a self-hosted egress,
 *     reintroduce explicit private-IP blocks.
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

function findMeta(html: string, prop: string): string | null {
  // Match either order: <meta property="og:foo" content="..."> or
  // <meta content="..." property="og:foo">. Quotes can be " or '.
  const a = new RegExp(
    `<meta[^>]+property\\s*=\\s*["']${escapeRegex(prop)}["'][^>]*content\\s*=\\s*["']([^"']*)["']`,
    "i",
  );
  const m1 = html.match(a);
  if (m1) return m1[1] ?? null;
  const b = new RegExp(
    `<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*property\\s*=\\s*["']${escapeRegex(prop)}["']`,
    "i",
  );
  const m2 = html.match(b);
  return m2 ? m2[1] ?? null : null;
}

function findMetaName(html: string, name: string): string | null {
  const a = new RegExp(
    `<meta[^>]+name\\s*=\\s*["']${escapeRegex(name)}["'][^>]*content\\s*=\\s*["']([^"']*)["']`,
    "i",
  );
  const m1 = html.match(a);
  if (m1) return m1[1] ?? null;
  const b = new RegExp(
    `<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*name\\s*=\\s*["']${escapeRegex(name)}["']`,
    "i",
  );
  const m2 = html.match(b);
  return m2 ? m2[1] ?? null : null;
}

function findTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]{0,1000}?)<\/title>/i);
  return m ? (m[1] ?? "").trim() : null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

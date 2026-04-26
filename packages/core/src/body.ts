/**
 * Body parser per spec_mop_v1.md §6.2 + §8.1.
 *
 * Splits a UTF-8 plaintext body into typed segments:
 *   - text
 *   - sendwyrd:// transitive reference
 *   - inline media URL (image/video/audio)
 *   - generic http(s) URL (renders as link or OG card)
 *
 * URL detection regex per spec §6.2:
 *   (https?|sendwyrd):\/\/[^\s]+
 *
 * Trailing punctuation stripping (`.,;:!?)>]}'"` ) keeps natural prose
 * intact while still detecting URLs cleanly.
 */

const MEDIA_IMAGE = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "avif",
  "heic",
]);
const MEDIA_VIDEO = new Set(["mp4", "webm", "mov"]);
const MEDIA_AUDIO = new Set(["mp3", "wav", "ogg", "opus"]);
const TRAILING_PUNCT = /[.,;:!?)\]}'">]+$/;

/** Hosts whose /w/{handle}... URLs are treated as wyrd transitive references. */
const SENDWYRD_HOSTS = new Set(["sendwyrd.com", "sendwyrd.app"]);
const WYRD_PATH_PATTERN = /^\/w\/[A-Za-z0-9_-]{16}(?:\/k\/[A-Za-z0-9_-]{43})?$/;

// URL detection has two arms:
//   1. Explicit-scheme: https://, http://, sendwyrd:// — anything starting
//      with a known scheme up to the next whitespace.
//   2. Bare-domain: lowercase-only hostnames with a 2-24 letter TLD, e.g.
//      `example.com` or `www.example.co.uk/path`. Lowercase-only is a
//      pragmatic constraint: real URLs are conventionally lowercase, and
//      it eliminates false positives like "Mr.Smith" (mixed case).
//      Negative lookbehind on `@` rules out email local-host parts. The
//      \b boundary keeps periods at sentence ends out of the match.
const SCHEME_URL_PATTERN = String.raw`(?:https?|sendwyrd):\/\/[^\s]+`;
const BARE_DOMAIN_PATTERN = String.raw`(?<![@\w-])[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,24}(?:\/[^\s]*)?\b`;
const URL_REGEX = new RegExp(
  `(${SCHEME_URL_PATTERN})|(${BARE_DOMAIN_PATTERN})`,
  "g",
);

export type UrlSegmentType = "sendwyrd" | "image" | "video" | "audio" | "link";

export type BodySegment =
  | { kind: "text"; value: string }
  | {
      kind: "url";
      /** As-typed by the author. Bare-domain URLs lack a scheme. */
      url: string;
      /** Always has a scheme; safe to use as an `<a href>` value. */
      href: string;
      type: UrlSegmentType;
      hostname: string;
    };

/**
 * If `url` lacks a scheme (bare domain), return `https://` + url. Otherwise
 * return as-is. Used to construct an href that always works in `<a>`.
 */
export function urlToHref(url: string): string {
  return /^[a-z]+:\/\//i.test(url) ? url : `https://${url}`;
}

/**
 * Parse a body into segments. Stable: input → output mapping is total.
 */
export function parseBody(body: string): BodySegment[] {
  const segments: BodySegment[] = [];
  let cursor = 0;

  // Reset regex (stateful with /g flag)
  URL_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_REGEX.exec(body)) !== null) {
    const [rawUrl] = match;
    const start = match.index;

    // Strip trailing punctuation from the URL itself.
    const trailing = rawUrl.match(TRAILING_PUNCT);
    const trailingLen = trailing ? trailing[0].length : 0;
    const url = trailingLen > 0 ? rawUrl.slice(0, -trailingLen) : rawUrl;
    const end = start + url.length;

    // Push text before the URL.
    if (start > cursor) {
      segments.push({ kind: "text", value: body.slice(cursor, start) });
    }

    const href = urlToHref(url);
    segments.push({
      kind: "url",
      url,
      href,
      type: classifyUrl(href),
      hostname: extractHostname(href),
    });

    cursor = end;
    URL_REGEX.lastIndex = end;
  }

  if (cursor < body.length) {
    segments.push({ kind: "text", value: body.slice(cursor) });
  }
  return segments;
}

function classifyUrl(url: string): UrlSegmentType {
  if (url.startsWith("sendwyrd://")) return "sendwyrd";
  // Parse for hostname + pathname.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "link";
  }
  // HTTPS URLs on the canonical sendwyrd hosts pointing at /w/{handle}...
  // are transitive wyrd references — render as preview cards.
  if (
    SENDWYRD_HOSTS.has(parsed.hostname) &&
    WYRD_PATH_PATTERN.test(parsed.pathname)
  ) {
    return "sendwyrd";
  }
  const lastDot = parsed.pathname.lastIndexOf(".");
  if (lastDot === -1) return "link";
  const ext = parsed.pathname.slice(lastDot + 1).toLowerCase();
  if (MEDIA_IMAGE.has(ext)) return "image";
  if (MEDIA_VIDEO.has(ext)) return "video";
  if (MEDIA_AUDIO.has(ext)) return "audio";
  return "link";
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * Count codepoints that count toward the 300-cap.
 *
 * URLs (https?:// and sendwyrd://) are EXCLUDED from the cap. Rationale:
 * URLs are long and shouldn't crowd out actual prose content. The cap is
 * a *prose* budget, not a *body* budget.
 *
 * Spec amendment to §8.2 / ADR-012: cap counts non-URL codepoints only.
 */
export function countCountableCodepoints(body: string): number {
  let n = 0;
  for (const seg of parseBody(body)) {
    if (seg.kind === "text") {
      for (const _ of seg.value) n++;
    }
    // url segments contribute 0 to the cap.
  }
  return n;
}

/**
 * Parse any wyrd reference URL into handle + k_read.
 * Accepts:
 *   - sendwyrd://w/{handle}#{k_read}            (fragment)
 *   - sendwyrd://w/{handle}/k/{k_read}          (path)
 *   - https://sendwyrd.com/w/{handle}#{k_read}  (fragment)
 *   - https://sendwyrd.com/w/{handle}/k/{k_read}(path)
 *   - https://sendwyrd.app/...                  (mirror host)
 */
export function parseSendwyrdUrl(
  url: string,
): { handle: string; k_read: string; form: "fragment" | "public" } | null {
  // Normalize sendwyrd:// to https://sendwyrd.com/ for URL parsing.
  let synthetic = url;
  if (url.startsWith("sendwyrd://")) {
    synthetic = "https://sendwyrd.com/" + url.slice("sendwyrd://".length);
  }
  let parsed: URL;
  try {
    parsed = new URL(synthetic);
  } catch {
    return null;
  }
  // Only canonical sendwyrd hosts qualify (after sendwyrd:// rewrite, or for HTTPS originals).
  if (!SENDWYRD_HOSTS.has(parsed.hostname)) return null;

  // Path form: /w/{handle}/k/{k_read}
  const pathFormMatch = parsed.pathname.match(
    /^\/w\/([A-Za-z0-9_-]{16})\/k\/([A-Za-z0-9_-]{43})$/,
  );
  if (pathFormMatch) {
    return {
      handle: pathFormMatch[1]!,
      k_read: pathFormMatch[2]!,
      form: "public",
    };
  }
  // Fragment form: /w/{handle}#{k_read}
  const handleMatch = parsed.pathname.match(/^\/w\/([A-Za-z0-9_-]{16})$/);
  if (handleMatch) {
    const fragment = parsed.hash.startsWith("#")
      ? parsed.hash.slice(1)
      : parsed.hash;
    if (fragment.length === 43 && /^[A-Za-z0-9_-]+$/.test(fragment)) {
      return { handle: handleMatch[1]!, k_read: fragment, form: "fragment" };
    }
  }
  return null;
}

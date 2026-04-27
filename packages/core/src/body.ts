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

// Token detection has four arms:
//   1. Explicit-scheme URL: https://, http://, sendwyrd:// — anything starting
//      with a known scheme up to the next whitespace.
//   2. Bare-domain URL: lowercase-only hostnames with a 2-24 letter TLD, e.g.
//      `example.com` or `www.example.co.uk/path`. Lowercase-only is a
//      pragmatic constraint: real URLs are conventionally lowercase, and
//      it eliminates false positives like "Mr.Smith" (mixed case).
//      Negative lookbehind on `@` rules out email local-host parts. The
//      \b boundary keeps periods at sentence ends out of the match.
//   3. Lightning: BOLT11 invoices (`lnbc1…`), BOLT12 offers/invoices/requests
//      (`lno1…`/`lni1…`/`lnr1…`), bare LNURL (`lnurl1…`), the `lightning:`
//      URI scheme catch-all, and Lightning addresses on a small allowlist
//      of well-known providers (`user@getalby.com` etc.). Email-shape
//      strings on off-allowlist domains stay text — matched only when
//      `lightning:` prefix is explicit.
//   4. Bitcoin: bech32/m segwit + taproot (`bc1`/`tb1`/`bcrt1`), bare legacy
//      P2PKH/P2SH (`1…`/`3…` Base58Check), and the `bitcoin:` URI scheme.
//      Detection feeds detect-and-handoff rendering per ADR-023.
const SCHEME_URL_PATTERN = String.raw`(?:https?|sendwyrd):\/\/[^\s]+`;
const BARE_DOMAIN_PATTERN = String.raw`(?<![@\w-])[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,24}(?:\/[^\s]*)?\b`;
const BOLT11_PATTERN = String.raw`(?:lnbc|lntb|lnbcrt|lnsb)\d*[munp]?1[ac-hj-np-z02-9]{50,}`;
const BOLT12_PATTERN = String.raw`(?:lno|lni|lnr)1[ac-hj-np-z02-9]{50,}`;
const LNURL_PATTERN = String.raw`lnurl1[ac-hj-np-z02-9]{50,}`;
const LIGHTNING_URI_PATTERN = String.raw`lightning:[^\s]+`;

/**
 * Lightning-address allowlist per ADR-023. Off-list addresses must be opted
 * in via the `lightning:` URI prefix — bare email-format strings on unknown
 * domains stay text to avoid false-positives on real correspondence.
 *
 * Easy to extend; no protocol change required.
 */
export const LN_ADDRESS_DOMAINS: readonly string[] = [
  "getalby.com",
  "walletofsatoshi.com",
  "strike.me",
  "coinos.io",
  "mutinywallet.com",
  "blink.sv",
  "phoenix.acinq.co",
  "sats.mobi",
  "bitnob.com",
  "primal.net",
];
const LN_ADDRESS_PATTERN = String.raw`\b[a-z0-9._%+-]+@(?:${LN_ADDRESS_DOMAINS.map((d) => d.replace(/\./g, "\\.")).join("|")})\b`;

const LIGHTNING_PATTERN = `(?:${LIGHTNING_URI_PATTERN}|${BOLT12_PATTERN}|${BOLT11_PATTERN}|${LNURL_PATTERN}|${LN_ADDRESS_PATTERN})`;

const BITCOIN_URI_PATTERN = String.raw`bitcoin:[^\s]+`;
// bech32(m) for segwit (`bc1q…`) and taproot (`bc1p…`); also `tb1…` testnet
// and `bcrt1…` regtest. Charset excludes b/i/o/1 in the data part.
const BTC_BECH32_PATTERN = String.raw`\b(?:bc|tb|bcrt)1[ac-hj-np-z02-9]{6,87}\b`;
// Base58Check legacy. The prefix `1` (P2PKH) or `3` (P2SH), then 25–34 chars
// of Base58. Word boundaries trim sentence punctuation. False-positive risk
// in normal prose is essentially zero at 26+ chars of Base58.
const BTC_LEGACY_PATTERN = String.raw`\b[13][1-9A-HJ-NP-Za-km-z]{25,34}\b`;
const BITCOIN_PATTERN = `(?:${BITCOIN_URI_PATTERN}|${BTC_BECH32_PATTERN}|${BTC_LEGACY_PATTERN})`;

const TOKEN_REGEX = new RegExp(
  `(${SCHEME_URL_PATTERN})|(${BARE_DOMAIN_PATTERN})|(${LIGHTNING_PATTERN})|(${BITCOIN_PATTERN})`,
  "g",
);

export type UrlSegmentType = "sendwyrd" | "image" | "video" | "audio" | "link";
export type LightningSegmentType =
  | "bolt11"
  | "bolt12"
  | "lnurl"
  | "uri"
  | "address";
export type BitcoinSegmentType = "bech32" | "legacy" | "uri";

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
    }
  | {
      kind: "lightning";
      /** As-typed by the author. */
      payload: string;
      /** A `lightning:` URI safe to use in `<a href>` for OS-level handler. */
      href: string;
      type: LightningSegmentType;
    }
  | {
      kind: "bitcoin";
      /** As-typed by the author. */
      payload: string;
      /** A `bitcoin:` URI safe to use in `<a href>` for OS-level handler. */
      href: string;
      type: BitcoinSegmentType;
      /** Address part — for URI form, the payment target sans `bitcoin:`
       * scheme and query string. For bare addresses, identical to payload. */
      address: string;
      /** BIP-21 `amount=` parameter, decimal BTC string (e.g. `0.001`). */
      amount?: string;
      /** BIP-21 `label=` parameter, URL-decoded. */
      label?: string;
      /** BIP-21 `message=` parameter, URL-decoded. */
      message?: string;
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
  TOKEN_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_REGEX.exec(body)) !== null) {
    const [raw, schemeUrl, bareDomain, lightning, bitcoin] = match;
    const start = match.index;

    // Strip trailing punctuation from the matched token.
    const trailing = raw.match(TRAILING_PUNCT);
    const trailingLen = trailing ? trailing[0].length : 0;
    const token = trailingLen > 0 ? raw.slice(0, -trailingLen) : raw;
    const end = start + token.length;

    // Push text before the token.
    if (start > cursor) {
      segments.push({ kind: "text", value: body.slice(cursor, start) });
    }

    if (lightning) {
      segments.push(buildLightningSegment(token));
    } else if (bitcoin) {
      segments.push(buildBitcoinSegment(token));
    } else {
      // URL arm: scheme or bare domain (the regex group tells us which but
      // both end up as `kind: "url"`; classifyUrl handles the rest).
      void schemeUrl;
      void bareDomain;
      const href = urlToHref(token);
      segments.push({
        kind: "url",
        url: token,
        href,
        type: classifyUrl(href),
        hostname: extractHostname(href),
      });
    }

    cursor = end;
    TOKEN_REGEX.lastIndex = end;
  }

  if (cursor < body.length) {
    segments.push({ kind: "text", value: body.slice(cursor) });
  }
  return segments;
}

function buildLightningSegment(
  token: string,
): Extract<BodySegment, { kind: "lightning" }> {
  const lower = token.toLowerCase();
  let type: LightningSegmentType;
  let href: string;
  if (lower.startsWith("lightning:")) {
    type = "uri";
    href = token;
  } else if (
    lower.startsWith("lno1") ||
    lower.startsWith("lni1") ||
    lower.startsWith("lnr1")
  ) {
    type = "bolt12";
    href = `lightning:${token}`;
  } else if (lower.startsWith("lnurl1")) {
    type = "lnurl";
    href = `lightning:${token}`;
  } else if (lower.includes("@")) {
    type = "address";
    href = `lightning:${token}`;
  } else {
    type = "bolt11";
    href = `lightning:${token}`;
  }
  return { kind: "lightning", payload: token, href, type };
}

function buildBitcoinSegment(
  token: string,
): Extract<BodySegment, { kind: "bitcoin" }> {
  const lower = token.toLowerCase();
  let type: BitcoinSegmentType;
  let href: string;
  let address = token;
  let amount: string | undefined;
  let label: string | undefined;
  let message: string | undefined;

  if (lower.startsWith("bitcoin:")) {
    type = "uri";
    href = token;
    // BIP-21: bitcoin:<address>[?amount=<amount>[&label=<label>][&message=<message>][&...]]
    const afterScheme = token.slice("bitcoin:".length);
    const qIdx = afterScheme.indexOf("?");
    address = qIdx === -1 ? afterScheme : afterScheme.slice(0, qIdx);
    if (qIdx !== -1) {
      const query = afterScheme.slice(qIdx + 1);
      try {
        const params = new URLSearchParams(query);
        amount = params.get("amount") ?? undefined;
        label = params.get("label") ?? undefined;
        message = params.get("message") ?? undefined;
      } catch {
        // Malformed query — ignore params, surface bare address only.
      }
    }
  } else if (
    lower.startsWith("bc1") ||
    lower.startsWith("tb1") ||
    lower.startsWith("bcrt1")
  ) {
    type = "bech32";
    href = `bitcoin:${token}`;
  } else {
    type = "legacy";
    href = `bitcoin:${token}`;
  }
  return {
    kind: "bitcoin",
    payload: token,
    href,
    type,
    address,
    amount,
    label,
    message,
  };
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
 * URLs (https?://, sendwyrd://), Lightning tokens (BOLT11/BOLT12/LNURL,
 * allowlisted addresses, `lightning:` URI) and Bitcoin tokens (bech32/m,
 * legacy, `bitcoin:` URI) are EXCLUDED from the cap. Rationale: long
 * opaque payloads — URLs and bech32-encoded invoices and addresses alike
 * — shouldn't crowd out actual prose. The cap is a *prose* budget, not a
 * *body* budget.
 *
 * Spec amendment to §8.2 / ADR-012 / ADR-023: cap counts text codepoints only.
 */
export function countCountableCodepoints(body: string): number {
  let n = 0;
  for (const seg of parseBody(body)) {
    if (seg.kind === "text") {
      for (const _ of seg.value) n++;
    }
    // url, lightning, and bitcoin segments contribute 0 to the cap.
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

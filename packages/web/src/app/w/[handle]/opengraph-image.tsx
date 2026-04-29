/**
 * Per-handle OpenGraph card for fragment-form wyrd URLs.
 *
 * Replaces the static brand banner with a per-link credential card. Renders
 * the handle (already public — it's in the URL the crawler is unfurling)
 * plus a TTL class chip derived from envelope timestamps. Server can't
 * render plaintext: K_read lives in the URL fragment, never reaches the
 * host (RFC 3986 §3.5, ADR-021). Every field shown here is server-known
 * and already returned by GET /api/v1/wyrds/{handle} — zero new leakage,
 * just visual formatting of already-public envelope metadata.
 *
 * 404 / network error fall back to a brand-only variant. We never show
 * absolute timestamps because crawlers cache OG images for hours-to-days
 * and a "expires in 3h" line goes stale and lies. TTL class is monotonic
 * and stays correct for the cached lifetime.
 */
import { ImageResponse } from "next/og";
import { PERMANENT_EXPIRES_AT_MS } from "@sendwyrd/core";

export const runtime = "edge";
export const alt = "SendWyrd — encrypted wyrd";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

const API_BASE = process.env.SENDWYRD_API_BASE ?? "https://sendwyrd.com";

interface Envelope {
  handle: string;
  published_at: number;
  expires_at: number;
  replies_enabled: boolean;
}

async function fetchEnvelope(handle: string): Promise<Envelope | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/wyrds/${handle}`, {
      headers: { "MOP-Protocol-Version": "1" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Envelope;
  } catch {
    return null;
  }
}

function ttlClass(env: Envelope): string {
  if (env.expires_at >= PERMANENT_EXPIRES_AT_MS) return "PERMANENT";
  const lifetimeSec = (env.expires_at - env.published_at) / 1000;
  if (lifetimeSec < 3600) return "EPHEMERAL";
  if (lifetimeSec < 86_400) return "SHORT-LIVED";
  if (lifetimeSec < 86_400 * 30) return "STANDARD";
  return "LONG-LIVED";
}

function formatHandle(h: string): string {
  return h.match(/.{1,4}/g)?.join(" ") ?? h;
}

const SIGIL_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="40" height="40">` +
  `<path d="M 5 5 L 16 18 L 11 27" fill="none" stroke="#ededed" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="M 27 5 L 16 18 L 21 27" fill="none" stroke="#ededed" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="M 16 5 L 16 18" fill="none" stroke="#ededed" stroke-width="1.5" stroke-linecap="round"/>` +
  `<circle cx="16" cy="18" r="1.5" fill="#ededed"/>` +
  `</svg>`;
const SIGIL_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(SIGIL_SVG)}`;

export default async function OgImage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const env = await fetchEnvelope(handle);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0a0a0a",
        color: "#ededed",
        padding: "56px 72px",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Top bar: sigil + wordmark, TTL chip on the right */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SIGIL_DATA_URL} width={40} height={40} alt="" />
          <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.5 }}>
            SendWyrd
          </span>
        </div>
        {env && (
          <div
            style={{
              display: "flex",
              fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
              fontSize: 18,
              color: "#8a8a8a",
              letterSpacing: 3,
              border: "1px solid #2a2a2a",
              padding: "8px 16px",
              borderRadius: 4,
            }}
          >
            {ttlClass(env)}
          </div>
        )}
      </div>

      {/* Center: handle (mono, grouped) + label */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
        }}
      >
        {env ? (
          <div
            style={{
              display: "flex",
              fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
              fontSize: 72,
              letterSpacing: 6,
              color: "#ededed",
            }}
          >
            {formatHandle(env.handle)}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              fontSize: 92,
              fontWeight: 600,
              letterSpacing: -1.5,
              color: "#ededed",
            }}
          >
            SendWyrd
          </div>
        )}
        <div
          style={{
            display: "flex",
            fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
            fontSize: 22,
            letterSpacing: 4,
            color: "#8a8a8a",
          }}
        >
          {env ? "ENCRYPTED WYRD" : "ENCRYPTED · TAP TO DECRYPT"}
        </div>
      </div>

      {/* Bottom: tap-to-decrypt cue, right-aligned */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          width: "100%",
        }}
      >
        {env && (
          <div
            style={{
              display: "flex",
              fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
              fontSize: 20,
              color: "#8a8a8a",
              letterSpacing: 3,
            }}
          >
            tap to decrypt →
          </div>
        )}
      </div>
    </div>,
    { ...size },
  );
}

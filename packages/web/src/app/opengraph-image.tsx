/**
 * Root-level OpenGraph card. Inherited by every page that doesn't supply its
 * own colocated `opengraph-image.tsx` (e.g. /w/[handle] overrides with a
 * per-handle credential card). Renders the sigil + wordmark + tagline so
 * shares of `/`, `/about`, `/build`, `/compose`, `/settings`, etc. unfurl
 * with a brand card on WhatsApp / iMessage / Telegram / Facebook / Signal
 * instead of a bare URL.
 *
 * No `runtime = "edge"` export — see the note in /w/[handle]/opengraph-image.tsx.
 */
import { ImageResponse } from "next/og";

export const alt = "SendWyrd — hyperlinks for conversational objects";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SIGIL_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="120" height="120">` +
  `<path d="M 5 5 L 16 18 L 11 27" fill="none" stroke="#ededed" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="M 27 5 L 16 18 L 21 27" fill="none" stroke="#ededed" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="M 16 5 L 16 18" fill="none" stroke="#ededed" stroke-width="1.5" stroke-linecap="round"/>` +
  `<circle cx="16" cy="18" r="1.5" fill="#ededed"/>` +
  `</svg>`;
const SIGIL_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(SIGIL_SVG)}`;

export default async function OgImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0a0a0a",
        color: "#ededed",
        padding: "72px 96px",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 36,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={SIGIL_DATA_URL} width={120} height={120} alt="" />
        <div
          style={{
            display: "flex",
            fontSize: 108,
            fontWeight: 600,
            letterSpacing: -2,
            color: "#ededed",
          }}
        >
          SendWyrd
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 32,
            color: "#8a8a8a",
            letterSpacing: -0.5,
          }}
        >
          Hyperlinks for conversational objects.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
          fontSize: 20,
          color: "#555",
          letterSpacing: 3,
        }}
      >
        <span>SENDWYRD.COM</span>
        <span>OPENWYRD MOP</span>
      </div>
    </div>,
    { ...size },
  );
}

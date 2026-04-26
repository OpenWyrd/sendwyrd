/**
 * Renders a wyrd body with URL detection + auto-embed per spec §6.2 + §8.1.
 *
 * URL types:
 *   - sendwyrd:// → inline preview card from `transitives` map
 *   - image / video / audio → inline media element
 *   - link → clickable hostname-captioned link
 *
 * The component is pure (no async) — caller resolves transitive references
 * via lib/resolveBody.ts and passes the map in.
 */

import { parseBody, type BodySegment } from "@sendwyrd/core";
import type { ResolutionMap } from "@/lib/resolveBody";

interface Props {
  body: string;
  transitives?: ResolutionMap;
}

const SHARED_TEXT_STYLE: React.CSSProperties = {
  margin: 0,
  color: "var(--color-ink)",
  fontFamily: "var(--font-mono)",
  whiteSpace: "pre-wrap",
  lineHeight: 1.6,
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

export function WyrdBody({ body, transitives = {} }: Props) {
  const segments = parseBody(body);
  return (
    <div style={SHARED_TEXT_STYLE}>
      {segments.map((seg, i) => (
        <Segment key={i} seg={seg} transitives={transitives} />
      ))}
    </div>
  );
}

function Segment({
  seg,
  transitives,
}: {
  seg: BodySegment;
  transitives: ResolutionMap;
}) {
  if (seg.kind === "text") {
    return <span>{seg.value}</span>;
  }
  if (seg.type === "sendwyrd") {
    return <SendwyrdEmbed url={seg.url} resolved={transitives[seg.url]} />;
  }
  if (seg.type === "image") return <ImageEmbed url={seg.url} hostname={seg.hostname} />;
  if (seg.type === "video") return <VideoEmbed url={seg.url} hostname={seg.hostname} />;
  if (seg.type === "audio") return <AudioEmbed url={seg.url} hostname={seg.hostname} />;
  return (
    <a
      href={seg.url}
      target="_blank"
      rel="noreferrer"
      style={{
        color: "var(--color-accent)",
        textDecoration: "underline",
        textDecorationThickness: "1px",
        textUnderlineOffset: "2px",
        overflowWrap: "anywhere",
      }}
    >
      {seg.url}
    </a>
  );
}

function EmbedFrame({ children, hostname }: { children: React.ReactNode; hostname: string }) {
  return (
    <span
      style={{
        display: "block",
        marginTop: "var(--spacing-3)",
        marginBottom: "var(--spacing-3)",
        paddingTop: "var(--spacing-3)",
        paddingBottom: "var(--spacing-3)",
        borderTop: "1px solid var(--color-hairline)",
        borderBottom: "1px solid var(--color-hairline)",
      }}
    >
      {children}
      {hostname && (
        <span
          style={{
            display: "block",
            marginTop: "var(--spacing-2)",
            fontSize: "var(--text-microcaption)",
            color: "var(--color-ink-subtle)",
          }}
        >
          {hostname}
        </span>
      )}
    </span>
  );
}

function ImageEmbed({ url, hostname }: { url: string; hostname: string }) {
  return (
    <EmbedFrame hostname={hostname}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        style={{ display: "block", maxWidth: "100%", height: "auto" }}
      />
    </EmbedFrame>
  );
}

function VideoEmbed({ url, hostname }: { url: string; hostname: string }) {
  return (
    <EmbedFrame hostname={hostname}>
      <video
        controls
        preload="none"
        style={{ display: "block", maxWidth: "100%", height: "auto" }}
      >
        <source src={url} />
      </video>
    </EmbedFrame>
  );
}

function AudioEmbed({ url, hostname }: { url: string; hostname: string }) {
  return (
    <EmbedFrame hostname={hostname}>
      <audio controls preload="none" style={{ display: "block", width: "100%" }}>
        <source src={url} />
      </audio>
    </EmbedFrame>
  );
}

function SendwyrdEmbed({
  url,
  resolved,
}: {
  url: string;
  resolved?: import("@/lib/resolveBody").ResolvedRef;
}) {
  // For sendwyrd:// scheme URLs, rewrite to canonical https://sendwyrd.com.
  // For URLs that are already https://sendwyrd.com/.app, use as-is.
  const link = url.startsWith("sendwyrd://")
    ? (typeof window !== "undefined" ? window.location.origin + "/" : "https://sendwyrd.com/") +
      url.slice("sendwyrd://".length)
    : url;
  if (!resolved) {
    // Loading or not resolved yet — show as link.
    return (
      <a
        href={link}
        style={{
          color: "var(--color-accent)",
          textDecoration: "underline",
          textDecorationThickness: "1px",
          textUnderlineOffset: "2px",
          overflowWrap: "anywhere",
        }}
      >
        {url}
      </a>
    );
  }
  if (resolved.kind === "gone") {
    return (
      <EmbedFrame hostname="sendwyrd · referenced wyrd">
        <span style={{ color: "var(--color-ink-muted)" }}>
          {resolved.reason === "burned"
            ? "(this wyrd was withdrawn by its author)"
            : "(this wyrd's time is up)"}
        </span>
      </EmbedFrame>
    );
  }
  if (resolved.kind === "missing" || resolved.kind === "error") {
    return (
      <a
        href={link}
        style={{
          color: "var(--color-accent)",
          textDecoration: "underline",
          textDecorationThickness: "1px",
          textUnderlineOffset: "2px",
        }}
      >
        {url} (unavailable)
      </a>
    );
  }
  // Resolved + ready: render preview card with truncated body.
  const codepoints = Array.from(resolved.body);
  let preview = codepoints.slice(0, 100).join("");
  if (codepoints.length > 100) preview += "…";
  return (
    <a
      href={link}
      style={{
        display: "block",
        marginTop: "var(--spacing-3)",
        marginBottom: "var(--spacing-3)",
        paddingTop: "var(--spacing-3)",
        paddingBottom: "var(--spacing-3)",
        paddingLeft: "var(--spacing-4)",
        paddingRight: "var(--spacing-4)",
        borderTop: "1px solid var(--color-hairline)",
        borderBottom: "1px solid var(--color-hairline)",
        borderLeft: "1px solid var(--color-hairline)",
        borderRight: "1px solid var(--color-hairline)",
        textDecoration: "none",
        color: "var(--color-ink)",
        background: "var(--color-surface)",
      }}
    >
      <span
        style={{
          display: "block",
          fontSize: "var(--text-microcaption)",
          color: "var(--color-ink-subtle)",
          marginBottom: "var(--spacing-2)",
        }}
      >
        wyrd · {resolved.handle}
      </span>
      <span
        style={{
          display: "block",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-caption)",
          lineHeight: 1.5,
          color: "var(--color-ink)",
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          wordBreak: "break-word",
        }}
      >
        {preview}
      </span>
    </a>
  );
}

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

"use client";

import { useState } from "react";
import { isAttestationBody, parseBody, type BodySegment } from "@sendwyrd/core";
import type { ResolutionMap } from "@/lib/resolveBody";
import { AttestationBanner } from "@/components/AttestationBanner";
import { LinkEmbed } from "@/components/LinkEmbed";

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
  // Authorship-attestation wyrds get a verification banner instead of the
  // raw structured body. The shape check is strict (entire-body match),
  // so a normal body that merely mentions "sendwyrd-attestation/v1" still
  // renders as text + URL segments.
  if (isAttestationBody(body)) {
    return <AttestationBanner body={body} />;
  }
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
    return <SendwyrdEmbed url={seg.href} resolved={transitives[seg.href]} />;
  }
  // Auto-embed media uses href (always has a scheme). LinkEmbed renders
  // the OG card via the unfurl proxy; it also uses href to fetch and as
  // the navigation target.
  if (seg.type === "image") return <ImageEmbed url={seg.href} hostname={seg.hostname} />;
  if (seg.type === "video") return <VideoEmbed url={seg.href} hostname={seg.hostname} />;
  if (seg.type === "audio") return <AudioEmbed url={seg.href} hostname={seg.hostname} />;
  return <LinkEmbed url={seg.href} hostname={seg.hostname} />;
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
  const [broken, setBroken] = useState(false);
  if (broken) {
    // The URL classified as image by extension but didn't actually serve
    // an image (404, CORS, hotlink-block, content-type mismatch). Fall
    // through to the OG-unfurl path so the user still gets a useful card.
    return <LinkEmbed url={url} hostname={hostname} />;
  }
  return (
    <EmbedFrame hostname={hostname}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
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

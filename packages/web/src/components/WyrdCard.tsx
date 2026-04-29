"use client";

/**
 * Adaptive card layout for a decrypted wyrd body.
 *
 *   - Text-only body → defers to <WyrdBody> (single inline flow).
 *   - Body with image / video / Lightning / Bitcoin → split-banner layout:
 *     prose on the left, media carousel on the right. The carousel cycles
 *     through every media slot in body order (1 image → static; N media →
 *     prev/next + dots).
 *   - Body that is *only* media (no prose) → carousel full-width.
 *   - Narrow viewports stack vertically (prose on top, carousel below).
 *
 * Inline-vs-carousel partition:
 *
 *   Carousel slot:  url(image), url(video), lightning, bitcoin
 *   Stay inline:    text, url(link), url(audio), url(sendwyrd transitive)
 *
 * Audio stays inline because there's nothing visual to slide; sendwyrd
 * transitives stay inline because the embed *is* a quote and reads as
 * part of the prose.
 *
 * Same component intended for both `/w/{handle}` and (eventually) the
 * Nostr inline-render reference embed — Nostr clients that adopt the
 * decrypt-render NIP can drop in this layout post-decrypt and get image
 * previews + payment QRs without re-implementing the body parser.
 */

import { useEffect, useMemo, useState } from "react";
import { isAttestationBody, parseBody, type BodySegment } from "@sendwyrd/core";
import QRCode from "qrcode-svg";
import type { ResolutionMap } from "@/lib/resolveBody";
import { AttestationBanner } from "@/components/AttestationBanner";
import { WyrdBody } from "@/components/WyrdBody";

interface Props {
  body: string;
  transitives?: ResolutionMap;
}

// Discriminated unions: Extract<X, {kind:"url"; type:"image"}> won't narrow
// `type` (which on the source is the broad UrlSegmentType union), so we
// build the media variant by intersection.
type UrlSeg = Extract<BodySegment, { kind: "url" }>;
type PaymentSegment = Extract<
  BodySegment,
  { kind: "lightning" } | { kind: "bitcoin" }
>;
type MediaUrlSeg = UrlSeg & { type: "image" | "video" };
type MediaSegment = MediaUrlSeg | PaymentSegment;

function isMedia(seg: BodySegment): seg is MediaSegment {
  if (seg.kind === "lightning" || seg.kind === "bitcoin") return true;
  if (seg.kind === "url" && (seg.type === "image" || seg.type === "video"))
    return true;
  return false;
}

function reconstructInlineBody(segments: BodySegment[]): string {
  // Rebuild the body string with carousel-bound segments dropped, so we
  // can hand the remaining prose back to <WyrdBody>. After isMedia, what
  // remains is text + url(sendwyrd|audio|link); payment kinds always go
  // to the carousel.
  return segments
    .map((s) => {
      if (isMedia(s)) return "";
      if (s.kind === "text") return s.value;
      if (s.kind === "url") return s.url;
      return "";
    })
    .join("");
}

export function WyrdCard({ body, transitives = {} }: Props) {
  const segments = useMemo(() => parseBody(body), [body]);
  const media = useMemo(() => segments.filter(isMedia), [segments]);
  const inlineBody = useMemo(() => reconstructInlineBody(segments), [segments]);
  const narrow = useIsNarrow(720);

  if (isAttestationBody(body)) {
    return <AttestationBanner body={body} />;
  }

  const hasMedia = media.length > 0;
  const hasProse = inlineBody.trim().length > 0;

  if (!hasMedia) {
    return (
      <div style={{ ...cardOuterStyle, ...textBannerStyle }}>
        <WyrdBody body={body} transitives={transitives} />
      </div>
    );
  }

  const carousel = <MediaCarousel media={media} />;

  if (!hasProse) {
    return (
      <div style={{ ...cardOuterStyle, ...mediaOnlyStyle }}>{carousel}</div>
    );
  }

  if (narrow) {
    return (
      <div style={cardOuterStyle}>
        <div style={stackedProseStyle}>
          <WyrdBody body={inlineBody} transitives={transitives} />
        </div>
        <div style={stackedDividerStyle} />
        <div style={stackedMediaStyle}>{carousel}</div>
      </div>
    );
  }

  return (
    <div style={{ ...cardOuterStyle, ...splitStyle }}>
      <div style={leftStyle}>
        <WyrdBody body={inlineBody} transitives={transitives} />
      </div>
      <div style={vDividerStyle} />
      <div style={rightStyle}>{carousel}</div>
    </div>
  );
}

function MediaCarousel({ media }: { media: MediaSegment[] }) {
  const [index, setIndex] = useState(0);
  if (media.length === 0) return null;
  const safeIndex = Math.min(index, media.length - 1);
  const current = media[safeIndex] as MediaSegment;
  const multi = media.length > 1;

  function go(delta: number) {
    setIndex((i) => (i + delta + media.length) % media.length);
  }

  return (
    <div style={carouselWrapStyle}>
      <div style={slideStyle}>
        <Slide seg={current} />
      </div>
      {multi && (
        <div style={carouselControlsStyle}>
          <button
            type="button"
            onClick={() => go(-1)}
            style={carouselNavStyle}
            aria-label="previous"
          >
            ◀
          </button>
          <div style={dotsStyle} aria-hidden="true">
            {media.map((_, i) => (
              <span
                key={i}
                style={i === safeIndex ? dotActiveStyle : dotStyle}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(1)}
            style={carouselNavStyle}
            aria-label="next"
          >
            ▶
          </button>
          <span style={counterStyle} aria-live="polite">
            {safeIndex + 1} / {media.length}
          </span>
        </div>
      )}
    </div>
  );
}

function Slide({ seg }: { seg: MediaSegment }) {
  if (seg.kind === "url") {
    if (seg.type === "image") {
      return <ImageSlide url={seg.href} hostname={seg.hostname} />;
    }
    return <VideoSlide url={seg.href} hostname={seg.hostname} />;
  }
  return <PaymentSlide seg={seg} />;
}

function ImageSlide({ url, hostname }: { url: string; hostname: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <a href={url} style={brokenLinkStyle}>
        {hostname}
      </a>
    );
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={url}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      style={mediaFillStyle}
    />
  );
}

function VideoSlide({ url }: { url: string; hostname: string }) {
  return (
    <video controls preload="metadata" style={mediaFillStyle}>
      <source src={url} />
    </video>
  );
}

const PAYMENT_LABELS: Record<string, string> = {
  bolt11: "BOLT11 invoice",
  bolt12: "BOLT12 offer",
  lnurl: "LNURL",
  uri: "lightning",
  address: "lightning address",
  bech32: "BTC address",
  legacy: "BTC address",
};

function paymentLabel(seg: PaymentSegment): string {
  if (seg.kind === "bitcoin") {
    if (seg.amount) {
      const truncated =
        seg.address.length > 14
          ? `${seg.address.slice(0, 8)}…${seg.address.slice(-4)}`
          : seg.address;
      return `${seg.amount} BTC to ${truncated}`;
    }
    if (seg.type === "uri") return "bitcoin";
  }
  return PAYMENT_LABELS[seg.type] ?? "payment";
}

function PaymentSlide({ seg }: { seg: PaymentSegment }) {
  const [copied, setCopied] = useState(false);
  const glyph = seg.kind === "lightning" ? "⚡" : "₿";
  const label = paymentLabel(seg);

  const qrSvg = useMemo(() => {
    const qr = new QRCode({
      content: seg.href,
      padding: 2,
      width: 220,
      height: 220,
      ecl: "M",
      join: true,
      container: "svg-viewbox",
    });
    return qr.svg();
  }, [seg.href]);

  function copy() {
    void navigator.clipboard.writeText(seg.payload);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div style={paymentSlideStyle}>
      <span
        // QRCode lib output is bounded, never executed. Local render —
        // host never sees this payload.
        dangerouslySetInnerHTML={{ __html: qrSvg }}
        style={qrBoxStyle}
      />
      <div style={paymentMetaStyle}>
        <span style={paymentLabelStyle}>
          <span aria-hidden="true">{glyph}</span> {label}
        </span>
        <div style={paymentActionsStyle}>
          <a href={seg.href} style={paymentOpenStyle}>
            open in wallet
          </a>
          <button type="button" onClick={copy} style={paymentCopyStyle}>
            {copied ? "copied" : "copy"}
          </button>
        </div>
      </div>
    </div>
  );
}

function useIsNarrow(threshold: number): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const update = () => setNarrow(window.innerWidth < threshold);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [threshold]);
  return narrow;
}

const cardOuterStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--color-hairline)",
  background: "var(--color-surface)",
  display: "flex",
  flexDirection: "column",
};
const textBannerStyle: React.CSSProperties = {
  padding: "var(--spacing-6) var(--spacing-5)",
};
const mediaOnlyStyle: React.CSSProperties = {
  padding: "var(--spacing-3)",
};
const splitStyle: React.CSSProperties = {
  flexDirection: "row",
  alignItems: "stretch",
  minHeight: 320,
};
const leftStyle: React.CSSProperties = {
  flex: "1 1 0",
  minWidth: 0,
  padding: "var(--spacing-5)",
  display: "flex",
  alignItems: "center",
};
const rightStyle: React.CSSProperties = {
  flex: "1 1 0",
  minWidth: 0,
  display: "flex",
  alignItems: "stretch",
  padding: "var(--spacing-3)",
};
const vDividerStyle: React.CSSProperties = {
  flex: "0 0 1px",
  background: "var(--color-hairline)",
};
const stackedProseStyle: React.CSSProperties = {
  padding: "var(--spacing-5)",
};
const stackedDividerStyle: React.CSSProperties = {
  height: 1,
  background: "var(--color-hairline)",
};
const stackedMediaStyle: React.CSSProperties = {
  padding: "var(--spacing-3)",
};
const carouselWrapStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: "var(--spacing-2)",
  alignItems: "stretch",
};
const slideStyle: React.CSSProperties = {
  flex: "1 1 auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 220,
};
const mediaFillStyle: React.CSSProperties = {
  display: "block",
  maxWidth: "100%",
  maxHeight: 420,
  width: "auto",
  height: "auto",
};
const brokenLinkStyle: React.CSSProperties = {
  color: "var(--color-accent)",
  textDecoration: "underline",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
};
const carouselControlsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--spacing-2)",
  justifyContent: "center",
  paddingTop: "var(--spacing-1)",
};
const carouselNavStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--color-hairline-strong)",
  padding: "var(--spacing-1) var(--spacing-2)",
  color: "var(--color-ink-muted)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
  cursor: "pointer",
  lineHeight: 1.2,
};
const dotsStyle: React.CSSProperties = {
  display: "inline-flex",
  gap: 6,
  alignItems: "center",
};
const dotStyle: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "var(--color-hairline-strong)",
  cursor: "pointer",
};
const dotActiveStyle: React.CSSProperties = {
  ...dotStyle,
  background: "var(--color-ink)",
};
const counterStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-microcaption)",
  color: "var(--color-ink-subtle)",
  marginLeft: "var(--spacing-2)",
};
const paymentSlideStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "var(--spacing-3)",
};
const qrBoxStyle: React.CSSProperties = {
  display: "block",
  width: 220,
  height: 220,
  border: "1px solid var(--color-hairline)",
  background: "var(--color-ground)",
  padding: 4,
};
const paymentMetaStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "var(--spacing-2)",
};
const paymentLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
  color: "var(--color-ink)",
};
const paymentActionsStyle: React.CSSProperties = {
  display: "inline-flex",
  gap: "var(--spacing-2)",
};
const paymentOpenStyle: React.CSSProperties = {
  padding: "var(--spacing-1) var(--spacing-3)",
  border: "1px solid var(--color-hairline-strong)",
  background: "var(--color-ground)",
  color: "var(--color-ink)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
  textDecoration: "none",
};
const paymentCopyStyle: React.CSSProperties = {
  padding: "var(--spacing-1) var(--spacing-3)",
  border: "1px solid var(--color-hairline-strong)",
  background: "var(--color-ground)",
  color: "var(--color-ink)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
  cursor: "pointer",
};

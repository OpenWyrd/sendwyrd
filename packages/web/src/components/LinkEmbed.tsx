"use client";

/**
 * LinkEmbed — surface a preview card for an arbitrary external HTTP(S)
 * URL using OpenGraph metadata fetched via the SendWyrd unfurl proxy.
 *
 * Privacy posture (recipient-side): the unfurl request goes through
 * sendwyrd.com — the host learns "someone is rendering a wyrd that
 * contains URL X." The host doesn't see the wyrd handle, the wyrd body,
 * or any author binding — just the raw URL the recipient asked about.
 * This matches the pragmatic-privacy framing: cypherpunk on
 * authorship/content, pragmatic on recipient-side rendering.
 *
 * Behavior:
 *   - Fetch /api/v1/unfurl?url=…
 *   - On {ok: true}: render an image (if og:image), title, description,
 *     hostname caption — clickable link to the target.
 *   - On {ok: false} or any error: fall back to a plain text link.
 *   - Image-only renderings: when the URL itself is image-extension-
 *     classified, the renderer uses ImageEmbed directly (no fetch). This
 *     component is only used for the "link" segment type.
 */

import { useEffect, useState } from "react";

interface UnfurlMeta {
  ok: true;
  title: string | null;
  description: string | null;
  image: string | null;
  hostname: string;
}
interface UnfurlError {
  ok: false;
  reason: string;
}
type UnfurlResp = UnfurlMeta | UnfurlError;

type State =
  | { kind: "loading" }
  | { kind: "ready"; meta: UnfurlMeta }
  | { kind: "fallback" };

interface Props {
  url: string;
  hostname: string;
}

export function LinkEmbed({ url, hostname }: Props) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [imageBroken, setImageBroken] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/v1/unfurl?url=${encodeURIComponent(url)}`,
          { headers: { "MOP-Protocol-Version": "1" }, cache: "default" },
        );
        if (cancelled) return;
        const data = (await res.json()) as UnfurlResp;
        if (!cancelled) {
          if (data.ok) setState({ kind: "ready", meta: data });
          else setState({ kind: "fallback" });
        }
      } catch {
        if (!cancelled) setState({ kind: "fallback" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (state.kind === "fallback") {
    return <PlainLink url={url} />;
  }

  if (state.kind === "loading") {
    // Render the link inline while the fetch is in-flight. If the unfurl
    // succeeds we swap to a card; if it fails we keep this rendering.
    return <PlainLink url={url} />;
  }

  const meta = state.meta;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "block",
        marginTop: "var(--spacing-3)",
        marginBottom: "var(--spacing-3)",
        border: "1px solid var(--color-hairline)",
        textDecoration: "none",
        color: "var(--color-ink)",
        background: "var(--color-surface)",
        overflow: "hidden",
      }}
    >
      {meta.image && !imageBroken && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meta.image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageBroken(true)}
          style={{
            display: "block",
            width: "100%",
            maxHeight: 320,
            objectFit: "cover",
          }}
        />
      )}
      <div
        style={{
          padding: "var(--spacing-3) var(--spacing-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-2)",
        }}
      >
        {meta.title && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-caption)",
              color: "var(--color-ink)",
              lineHeight: 1.4,
              overflowWrap: "anywhere",
            }}
          >
            {meta.title}
          </span>
        )}
        {meta.description && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-microcaption)",
              color: "var(--color-ink-muted)",
              lineHeight: 1.5,
              overflowWrap: "anywhere",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {meta.description}
          </span>
        )}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-microcaption)",
            color: "var(--color-ink-subtle)",
          }}
        >
          {meta.hostname || hostname}
        </span>
      </div>
    </a>
  );
}

function PlainLink({ url }: { url: string }) {
  return (
    <a
      href={url}
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
      {url}
    </a>
  );
}

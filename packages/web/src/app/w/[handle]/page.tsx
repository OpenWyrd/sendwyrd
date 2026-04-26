"use client";

/**
 * Fragment-form view per visual_direction_v1.md §10.4.
 *
 * Server-renders a shell; client decrypts using K_read from the URL fragment.
 * Per renderer-contract §4: K_read is held in memory only, never persisted,
 * cleared on visibility-hidden or unload.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { decryptFromBase64Url, b64uDecode, type FetchEnvelopeResponse } from "@sendwyrd/core";
import { fetchWyrd } from "@/lib/api";
import { PrivacyIndicator } from "@/components/PrivacyIndicator";
import { WyrdBody } from "@/components/WyrdBody";
import { ReplyForm } from "@/components/ReplyForm";
import { Nav } from "@/components/Nav";
import { resolveTransitives, type ResolutionMap } from "@/lib/resolveBody";

type State =
  | { kind: "loading" }
  | { kind: "ready"; data: FetchEnvelopeResponse; body: string; transitives: ResolutionMap }
  | { kind: "gone"; reason: string; gone_at: string }
  | { kind: "missing_key" }
  | { kind: "decrypt_failed" }
  | { kind: "not_found" }
  | { kind: "network_error" };

export default function FragmentView() {
  const params = useParams<{ handle: string }>();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    const handle = params.handle;
    if (!handle) return;

    const k_read_b64u = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    if (!k_read_b64u || k_read_b64u.length !== 43) {
      setState({ kind: "missing_key" });
      return;
    }

    (async () => {
      const result = await fetchWyrd(handle);
      if (cancelled) return;
      if (result.kind === "gone") {
        setState({
          kind: "gone",
          reason: result.data.reason,
          gone_at: result.data.gone_at,
        });
        return;
      }
      if (result.kind === "not_found") {
        setState({ kind: "not_found" });
        return;
      }
      if (result.kind === "error") {
        setState({ kind: "network_error" });
        return;
      }
      try {
        const handleBytes = b64uDecode(result.data.handle);
        const k_read = b64uDecode(k_read_b64u);
        const body = await decryptFromBase64Url(result.data.envelope, {
          k_read,
          handle: handleBytes,
          expires_at_ms: result.data.expires_at,
          replies_enabled: result.data.replies_enabled,
        });
        const transitives = await resolveTransitives(body);
        if (!cancelled) setState({ kind: "ready", data: result.data, body, transitives });
      } catch {
        if (!cancelled) setState({ kind: "decrypt_failed" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params.handle]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "var(--spacing-12) var(--spacing-6)",
        gap: "var(--spacing-8)",
      }}
    >
      <Nav />

      {state.kind === "loading" && (
        <p style={metaStyle}>…</p>
      )}

      {state.kind === "missing_key" && (
        <p style={metaStyle}>
          This URL is missing its read key. The fragment must contain the key.
        </p>
      )}

      {state.kind === "decrypt_failed" && (
        <p style={metaStyle}>
          This URL doesn&apos;t match a live wyrd. The key may be wrong.
        </p>
      )}

      {state.kind === "not_found" && (
        <p style={metaStyle}>This URL doesn&apos;t match a live wyrd.</p>
      )}

      {state.kind === "network_error" && (
        <p style={metaStyle}>
          This wyrd couldn&apos;t be fetched. Check your connection.
        </p>
      )}

      {state.kind === "gone" && (
        <article style={panelStyle}>
          <PrivacyIndicator state="sealed" />
          <p style={{ ...goneStyle, marginTop: "var(--spacing-6)" }}>
            {state.reason === "burned"
              ? `This wyrd was withdrawn by its author on ${formatDate(state.gone_at)}.`
              : state.reason === "expired"
                ? `This wyrd's time is up. It expired on ${formatDate(state.gone_at)}.`
                : `This URL doesn't match a live wyrd. The key may be wrong, or the wyrd was published with different metadata.`}
          </p>
        </article>
      )}

      {state.kind === "ready" && (
        <article style={panelStyle}>
          <PrivacyIndicator state="sealed" />
          <div
            style={{
              paddingTop: "var(--spacing-6)",
              paddingBottom: "var(--spacing-3)",
            }}
          >
            <WyrdBody body={state.body} transitives={state.transitives} />
          </div>
          <p
            style={{
              margin: 0,
              color: "var(--color-ink-subtle)",
              fontSize: "var(--text-microcaption)",
              fontFamily: "var(--font-mono)",
            }}
          >
            Sent {formatDate(new Date(state.data.published_at).toISOString())} ·
            expires {formatDate(new Date(state.data.expires_at).toISOString())}
          </p>
          {state.data.replies_enabled && (
            <ReplyForm
              handle={state.data.handle}
              k_origin_pub_b64u={state.data.k_origin_pub}
            />
          )}
        </article>
      )}
    </main>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const panelStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "var(--max-content)",
};
const metaStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-mono)",
  color: "var(--color-ink-muted)",
};
const goneStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-mono)",
  color: "var(--color-ink-muted)",
};

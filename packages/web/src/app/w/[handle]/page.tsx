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
import {
  decryptFromBase64Url,
  b64uDecode,
  deriveOriginKey,
  PERMANENT_EXPIRES_AT_MS,
  type FetchEnvelopeResponse,
} from "@sendwyrd/core";
import { burnWyrd, fetchWyrd } from "@/lib/api";
import { PrivacyIndicator } from "@/components/PrivacyIndicator";
import { WyrdBody } from "@/components/WyrdBody";
import { ReplyForm } from "@/components/ReplyForm";
import { Nav } from "@/components/Nav";
import { resolveTransitives, type ResolutionMap } from "@/lib/resolveBody";
import { getSeed, isUnlocked, unlockSeed } from "@/lib/seedClient";
import {
  listHistory,
  markHistoryEntryGone,
  type HistoryEntry,
} from "@/lib/wyrdHistory";

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
  const [historyEntry, setHistoryEntry] = useState<HistoryEntry | null>(null);

  // Look up the local history entry for this handle once on mount. The author
  // is whoever holds an entry whose handle matches AND whose K_origin_pub
  // matches what the host stores. We re-check the K_origin_pub once the live
  // fetch returns, below.
  useEffect(() => {
    if (!params.handle) return;
    const entry = listHistory().find((e) => e.handle === params.handle) ?? null;
    setHistoryEntry(entry);
  }, [params.handle]);

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
          <PrivacyIndicator />
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
          <header style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--spacing-3)" }}>
            <PrivacyIndicator />
          </header>
          <div
            style={{
              paddingTop: "var(--spacing-2)",
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
            Sent {formatDate(new Date(state.data.published_at).toISOString())}
            {!isPermanent(state.data.expires_at) && (
              <> · expires {formatDate(new Date(state.data.expires_at).toISOString())}</>
            )}
          </p>
          {state.data.replies_enabled && (
            <ReplyForm
              handle={state.data.handle}
              k_origin_pub_b64u={state.data.k_origin_pub}
            />
          )}
          <ShareAffordance />
          {historyEntry &&
            !historyEntry.gone_at &&
            historyEntry.k_origin_pub_b64u === state.data.k_origin_pub && (
              <BurnAffordance
                handle={state.data.handle}
                n={historyEntry.n}
                onBurned={(gone_at) => {
                  markHistoryEntryGone(state.data.handle, "burned", gone_at);
                  setState({
                    kind: "gone",
                    reason: "burned",
                    gone_at: new Date(gone_at).toISOString(),
                  });
                }}
                onAlreadyGone={(reason, gone_at_iso) => {
                  const gone_at_ms = new Date(gone_at_iso).getTime();
                  if (reason === "burned" || reason === "expired") {
                    markHistoryEntryGone(state.data.handle, reason, gone_at_ms);
                  }
                  setState({
                    kind: "gone",
                    reason,
                    gone_at: gone_at_iso,
                  });
                }}
              />
            )}
        </article>
      )}
    </main>
  );
}

/**
 * Share the current URL. Visible to all viewers (not author-gated) — anyone
 * with the URL can forward it; this just makes copying it one click instead
 * of fishing in the address bar.
 *
 * Web Share API on supporting platforms (mobile + some desktops) opens the
 * native share sheet; otherwise falls back to clipboard with an inline
 * "copied" flash. The URL copied is exactly what the user is looking at —
 * fragment included, so K_read travels with the URL and never leaves the
 * device for the host.
 */
function ShareAffordance() {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ url });
        return;
      }
    } catch (e: unknown) {
      const err = e as { name?: string };
      if (err?.name === "AbortError") return;
      // share() rejected for some other reason — fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this URL", url);
    }
  }

  return (
    <div style={shareRowStyle}>
      <button
        type="button"
        onClick={() => void handleShare()}
        style={shareTriggerStyle}
        aria-label="Share this wyrd's URL"
      >
        {copied ? "copied" : "share"}
      </button>
    </div>
  );
}

/**
 * Small, restrained author-only affordance. Two-stage: a single muted "burn"
 * link reveals a confirm row with terse final copy + the actual "burn" button.
 * Esc cancels. Visual posture matches Settings' Danger pattern (transparent
 * background, --color-danger border + text).
 */
function BurnAffordance({
  handle,
  n,
  onBurned,
  onAlreadyGone,
}: {
  handle: string;
  n: number;
  onBurned: (gone_at: number) => void;
  onAlreadyGone: (reason: string, gone_at_iso: string) => void;
}) {
  const [stage, setStage] = useState<"idle" | "confirm" | "burning">("idle");
  const [error, setError] = useState<string | null>(null);
  const [needsPassphrase, setNeedsPassphrase] = useState(false);
  const [passphrase, setPassphrase] = useState("");

  // Esc cancels confirm / passphrase prompt.
  useEffect(() => {
    if (stage !== "confirm") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setStage("idle");
        setError(null);
        setNeedsPassphrase(false);
        setPassphrase("");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage]);

  async function unlockAndBurn() {
    setError(null);
    try {
      await unlockSeed(passphrase);
      setPassphrase("");
      setNeedsPassphrase(false);
      await doBurn();
    } catch {
      setError("Wrong passphrase.");
    }
  }

  async function doBurn() {
    if (!isUnlocked()) {
      setNeedsPassphrase(true);
      return;
    }
    const seedRec = getSeed();
    if (!seedRec) {
      setError("No seed available on this device.");
      return;
    }
    setStage("burning");
    setError(null);
    try {
      const k = deriveOriginKey(seedRec.seed, n);
      const result = await burnWyrd({ handle, k_origin_priv: k.k_origin_priv });
      if (result.kind === "burned") {
        onBurned(result.data.gone_at);
        return;
      }
      if (result.kind === "already_gone") {
        onAlreadyGone(result.data.reason, result.data.gone_at);
        return;
      }
      if (result.kind === "not_found") {
        setStage("confirm");
        setError("The host has no record of this wyrd.");
        return;
      }
      if (result.kind === "signature_invalid") {
        setStage("confirm");
        setError("Signature rejected. The seed on this device may not match this wyrd.");
        return;
      }
      setStage("confirm");
      setError(`Burn failed (${result.status}).`);
    } catch (e) {
      setStage("confirm");
      setError(e instanceof Error ? e.message : "Burn failed.");
    }
  }

  if (stage === "idle") {
    return (
      <div style={burnRowStyle}>
        <button
          type="button"
          onClick={() => {
            setStage("confirm");
            setError(null);
          }}
          style={burnTriggerStyle}
        >
          burn
        </button>
      </div>
    );
  }

  return (
    <div style={burnPanelStyle}>
      <p style={burnCopyStyle}>
        Burn this wyrd? This cannot be undone. The host will return 410 Gone
        with a tombstone for 30 days, then nothing.
      </p>
      {needsPassphrase ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void unlockAndBurn();
          }}
          style={{ display: "flex", gap: "var(--spacing-3)", flexWrap: "wrap" }}
        >
          <input
            type="password"
            autoComplete="current-password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="passphrase"
            autoFocus
            style={burnInputStyle}
          />
          <button type="submit" style={burnConfirmStyle} disabled={!passphrase}>
            unlock and burn
          </button>
          <button
            type="button"
            onClick={() => {
              setStage("idle");
              setNeedsPassphrase(false);
              setPassphrase("");
              setError(null);
            }}
            style={burnCancelStyle}
          >
            cancel
          </button>
        </form>
      ) : (
        <div style={{ display: "flex", gap: "var(--spacing-3)", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void doBurn()}
            disabled={stage === "burning"}
            style={burnConfirmStyle}
          >
            {stage === "burning" ? "burning…" : "burn"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStage("idle");
              setError(null);
            }}
            disabled={stage === "burning"}
            style={burnCancelStyle}
          >
            cancel
          </button>
        </div>
      )}
      {error && <p style={burnErrorStyle}>{error}</p>}
    </div>
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

function isPermanent(expires_at_ms: number): boolean {
  return expires_at_ms >= PERMANENT_EXPIRES_AT_MS - 1000;
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
const shareRowStyle: React.CSSProperties = {
  marginTop: "var(--spacing-8)",
  paddingTop: "var(--spacing-4)",
  borderTop: "1px solid var(--color-hairline)",
  display: "flex",
  justifyContent: "flex-end",
};
const shareTriggerStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  padding: 0,
  color: "var(--color-ink-subtle)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-microcaption)",
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};
const burnRowStyle: React.CSSProperties = {
  marginTop: "var(--spacing-8)",
  paddingTop: "var(--spacing-4)",
  borderTop: "1px solid var(--color-hairline)",
  display: "flex",
  justifyContent: "flex-end",
};
const burnTriggerStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  padding: 0,
  color: "var(--color-ink-subtle)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-microcaption)",
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};
const burnPanelStyle: React.CSSProperties = {
  marginTop: "var(--spacing-8)",
  paddingTop: "var(--spacing-4)",
  borderTop: "1px solid var(--color-hairline)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--spacing-3)",
};
const burnCopyStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
  color: "var(--color-ink-muted)",
  lineHeight: 1.6,
};
const burnConfirmStyle: React.CSSProperties = {
  padding: "var(--spacing-2) var(--spacing-5)",
  border: "1px solid var(--color-danger)",
  background: "transparent",
  color: "var(--color-danger)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
  cursor: "pointer",
};
const burnCancelStyle: React.CSSProperties = {
  padding: "var(--spacing-2) var(--spacing-5)",
  border: "1px solid var(--color-hairline-strong)",
  background: "transparent",
  color: "var(--color-ink-muted)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
  cursor: "pointer",
};
const burnInputStyle: React.CSSProperties = {
  flex: "1 1 200px",
  minWidth: 0,
  padding: "var(--spacing-2) var(--spacing-3)",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid var(--color-hairline-strong)",
  color: "var(--color-ink)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
  outline: "none",
};
const burnErrorStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-microcaption)",
  color: "var(--color-danger)",
};

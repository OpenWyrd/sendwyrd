"use client";

/**
 * Inbox per visual_direction_v1.md §10.7.
 *
 * Lists the user's locally-tracked wyrd history (from compose). For each
 * wyrd: shows preview, dates, and (if replies_enabled) lets the user fetch
 * + decrypt incoming replies via Schnorr-signed GET to the API.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  b64uDecode,
  b64uEncode,
  buildFragmentUrl,
  decryptReply,
  deriveOriginKey,
  fetchRepliesMessage,
  schnorrSign,
} from "@sendwyrd/core";
import { hasSeed, isUnlocked, unlockSeed, getSeed } from "@/lib/seedClient";
import { listHistory, type HistoryEntry } from "@/lib/wyrdHistory";

type Filter = "all" | "live" | "gone";

interface Reply {
  text: string;
  received_at: number;
}

interface RepliesView {
  loading: boolean;
  replies?: Reply[];
  error?: string;
}

export default function InboxPage() {
  const router = useRouter();
  const [unlocked, setUnlocked] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [now, setNow] = useState(Date.now());
  const [repliesByHandle, setRepliesByHandle] = useState<Record<string, RepliesView>>({});

  useEffect(() => {
    if (!hasSeed()) {
      router.replace("/onboarding");
      return;
    }
    setUnlocked(isUnlocked());
    setHistory(listHistory());
    setNow(Date.now());
  }, [router]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setUnlockError(null);
    try {
      await unlockSeed(passphrase);
      setUnlocked(true);
      setPassphrase("");
    } catch {
      setUnlockError("Wrong passphrase.");
    }
  }

  async function loadReplies(entry: HistoryEntry) {
    setRepliesByHandle((m) => ({ ...m, [entry.handle]: { loading: true } }));
    try {
      const seedRec = getSeed();
      if (!seedRec) {
        setUnlocked(false);
        setRepliesByHandle((m) => ({
          ...m,
          [entry.handle]: { loading: false, error: "session_expired" },
        }));
        return;
      }
      const k = deriveOriginKey(seedRec.seed, entry.n);
      const handleBytes = b64uDecode(entry.handle);
      const ts = Date.now();
      const messageHash = fetchRepliesMessage({ handle: handleBytes, fetch_timestamp_ms: ts });
      const signature = schnorrSign(messageHash, k.k_origin_priv);
      const auth = `${b64uEncode(signature)}:${ts}`;

      const res = await fetch(`/api/v1/wyrds/${entry.handle}/replies`, {
        headers: {
          "MOP-Protocol-Version": "1",
          "X-Mop-Auth": auth,
        },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "unknown" }));
        setRepliesByHandle((m) => ({
          ...m,
          [entry.handle]: { loading: false, error: j.error ?? "unknown" },
        }));
        return;
      }
      const data = (await res.json()) as {
        handle: string;
        replies: Array<{ reply_blob: string; received_at: number }>;
      };
      const decoded: Reply[] = [];
      for (const r of data.replies) {
        try {
          const blob = b64uDecode(r.reply_blob);
          const text = await decryptReply({
            blob,
            handle: handleBytes,
            k_origin_priv: k.k_origin_priv,
          });
          decoded.push({ text, received_at: r.received_at });
        } catch {
          decoded.push({ text: "(decrypt failed)", received_at: r.received_at });
        }
      }
      setRepliesByHandle((m) => ({
        ...m,
        [entry.handle]: { loading: false, replies: decoded },
      }));
    } catch (e: any) {
      setRepliesByHandle((m) => ({
        ...m,
        [entry.handle]: { loading: false, error: e?.message ?? "unknown" },
      }));
    }
  }

  if (!unlocked) {
    return (
      <main style={pageStyle}>
        <h1 style={wordmarkStyle}>SendWyrd</h1>
        <form onSubmit={handleUnlock} style={panelStyle}>
          <p style={{ margin: 0, marginBottom: "var(--spacing-6)", color: "var(--color-ink-muted)" }}>
            Enter your passphrase to unlock the seed for this session.
          </p>
          <input
            type="password"
            autoComplete="current-password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="passphrase"
            autoFocus
            style={inputStyle}
          />
          {unlockError && <p style={errorStyle}>{unlockError}</p>}
          <button type="submit" style={{ ...btnStyle, marginTop: "var(--spacing-6)" }}>
            Unlock
          </button>
        </form>
      </main>
    );
  }

  const filtered = history.filter((e) => {
    const isGone = e.expires_at <= now;
    if (filter === "live") return !isGone;
    if (filter === "gone") return isGone;
    return true;
  });

  return (
    <main style={pageStyle}>
      <h1 style={wordmarkStyle}>SendWyrd</h1>
      <section style={{ ...panelStyle, maxWidth: "var(--max-list)" }}>
        <p style={{ margin: 0, marginBottom: "var(--spacing-6)", color: "var(--color-ink-muted)", fontSize: "var(--text-caption)" }}>
          {history.length} wyrd{history.length === 1 ? "" : "s"} on this device
        </p>

        <div style={{ display: "flex", gap: "var(--spacing-4)", marginBottom: "var(--spacing-6)" }}>
          {(["all", "live", "gone"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                background: "transparent",
                border: "none",
                color: filter === f ? "var(--color-ink)" : "var(--color-ink-muted)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-caption)",
                cursor: "pointer",
                padding: 0,
                textDecoration: filter === f ? "underline" : "none",
                textUnderlineOffset: "4px",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <p style={{ margin: 0, color: "var(--color-ink-muted)", fontSize: "var(--text-caption)" }}>
            {history.length === 0
              ? "No wyrds yet. Compose one to begin."
              : "No wyrds match this filter."}
          </p>
        )}

        {filtered.map((entry) => {
          const isGone = entry.expires_at <= now;
          const replyState = repliesByHandle[entry.handle];
          const url = buildFragmentUrl(window.location.origin, entry.handle, entry.k_read_b64u);
          return (
            <article
              key={entry.handle}
              style={{
                paddingTop: "var(--spacing-4)",
                paddingBottom: "var(--spacing-4)",
                borderTop: "1px solid var(--color-hairline)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--spacing-3)", flexWrap: "wrap" }}>
                <a
                  href={url}
                  style={{
                    color: "var(--color-ink)",
                    textDecoration: "none",
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-caption)",
                    overflowWrap: "anywhere",
                    flex: "1 1 0",
                    minWidth: 0,
                  }}
                >
                  {entry.handle}
                </a>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-microcaption)",
                    color: isGone ? "var(--color-ink-subtle)" : "var(--color-mark-sealed)",
                  }}
                >
                  {isGone ? "expired" : "live"}
                </span>
              </div>
              <p style={{ margin: 0, marginTop: "var(--spacing-2)", color: "var(--color-ink-subtle)", fontSize: "var(--text-microcaption)", fontFamily: "var(--font-mono)" }}>
                Sent {formatDate(entry.published_at)} · expires {formatDate(entry.expires_at)}
                {entry.replies_enabled && " · replies on"}
              </p>
              {entry.replies_enabled && !isGone && (
                <div style={{ marginTop: "var(--spacing-3)" }}>
                  {!replyState && (
                    <button
                      onClick={() => loadReplies(entry)}
                      style={{
                        background: "transparent",
                        border: "1px solid var(--color-hairline)",
                        color: "var(--color-ink-muted)",
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--text-microcaption)",
                        padding: "var(--spacing-2) var(--spacing-3)",
                        cursor: "pointer",
                      }}
                    >
                      Load replies
                    </button>
                  )}
                  {replyState?.loading && (
                    <span style={{ color: "var(--color-ink-subtle)", fontSize: "var(--text-microcaption)" }}>…</span>
                  )}
                  {replyState?.error && (
                    <span style={{ color: "var(--color-danger)", fontSize: "var(--text-microcaption)" }}>
                      {replyState.error}
                    </span>
                  )}
                  {replyState?.replies && replyState.replies.length === 0 && (
                    <p style={{ margin: 0, color: "var(--color-ink-subtle)", fontSize: "var(--text-microcaption)" }}>
                      No replies.
                    </p>
                  )}
                  {replyState?.replies && replyState.replies.length > 0 && (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                      {replyState.replies.map((r, i) => (
                        <li
                          key={i}
                          style={{
                            paddingTop: "var(--spacing-3)",
                            paddingBottom: "var(--spacing-3)",
                            paddingLeft: "var(--spacing-4)",
                            borderLeft: "1px solid var(--color-hairline-strong)",
                            marginTop: "var(--spacing-2)",
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--text-caption)",
                            whiteSpace: "pre-wrap",
                            color: "var(--color-ink)",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {r.text}
                          <span
                            style={{
                              display: "block",
                              marginTop: "var(--spacing-2)",
                              fontSize: "var(--text-microcaption)",
                              color: "var(--color-ink-subtle)",
                            }}
                          >
                            {formatDate(r.received_at)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "var(--spacing-12) var(--spacing-6)",
  gap: "var(--spacing-8)",
};
const wordmarkStyle: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--text-h2)",
  fontWeight: 600,
  margin: 0,
  color: "var(--color-ink)",
};
const panelStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "var(--max-content)",
  fontFamily: "var(--font-mono)",
  color: "var(--color-ink)",
};
const btnStyle: React.CSSProperties = {
  padding: "var(--spacing-3) var(--spacing-6)",
  border: "1px solid var(--color-hairline-strong)",
  background: "transparent",
  color: "var(--color-ink)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-body)",
  cursor: "pointer",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "var(--spacing-3) var(--spacing-4)",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid var(--color-hairline)",
  color: "var(--color-ink)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-body)",
  outline: "none",
};
const errorStyle: React.CSSProperties = {
  color: "var(--color-danger)",
  margin: 0,
  marginTop: "var(--spacing-3)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
};

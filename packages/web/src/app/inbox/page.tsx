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
  PERMANENT_EXPIRES_AT_MS,
} from "@sendwyrd/core";
import { hasSeed, isUnlocked, unlockSeed, getSeed } from "@/lib/seedClient";
import { listHistory, renameHistoryEntry, type HistoryEntry } from "@/lib/wyrdHistory";
import { Segmented } from "@/components/Segmented";
import { Nav } from "@/components/Nav";

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
  const [renamingHandle, setRenamingHandle] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  function startRename(entry: HistoryEntry) {
    setRenamingHandle(entry.handle);
    setRenameDraft(entry.nickname ?? "");
  }
  function commitRename(handle: string) {
    renameHistoryEntry(handle, renameDraft);
    setRenamingHandle(null);
    setRenameDraft("");
    setHistory(listHistory());
  }
  function cancelRename() {
    setRenamingHandle(null);
    setRenameDraft("");
  }

  useEffect(() => {
    if (!hasSeed()) {
      router.replace("/onboarding");
      return;
    }
    setUnlocked(isUnlocked());
    setHistory(listHistory());
    setNow(Date.now());
  }, [router]);

  // Auto-load replies for every wyrd that has them enabled, after unlock.
  useEffect(() => {
    if (!unlocked) return;
    const seedRec = getSeed();
    if (!seedRec) return;
    const live = history.filter((e) => e.replies_enabled && e.expires_at > Date.now());
    for (const entry of live) {
      if (repliesByHandle[entry.handle]) continue;
      void loadReplies(entry);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, history]);

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
        <Nav />
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
      <Nav />
      <section style={{ ...panelStyle, maxWidth: "var(--max-list)" }}>
        <p style={{ margin: 0, marginBottom: "var(--spacing-6)", color: "var(--color-ink-muted)", fontSize: "var(--text-caption)" }}>
          {history.length} wyrd{history.length === 1 ? "" : "s"} on this device
        </p>

        <div style={{ marginBottom: "var(--spacing-6)" }}>
          <Segmented
            name="filter"
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
            size="sm"
            ariaLabel="Filter"
            options={[
              { value: "all", label: "all" },
              { value: "live", label: "live" },
              { value: "gone", label: "gone" },
            ]}
          />
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
              <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--spacing-3)", flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ flex: "1 1 0", minWidth: 0 }}>
                  {renamingHandle === entry.handle ? (
                    <form
                      onSubmit={(e) => { e.preventDefault(); commitRename(entry.handle); }}
                      style={{ display: "flex", gap: "var(--spacing-2)", alignItems: "center" }}
                    >
                      <input
                        type="text"
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        autoFocus
                        placeholder="add a name…"
                        maxLength={80}
                        style={{
                          flex: "1 1 0",
                          minWidth: 0,
                          background: "transparent",
                          border: "none",
                          borderBottom: "1px solid var(--color-hairline-strong)",
                          color: "var(--color-ink)",
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--text-caption)",
                          outline: "none",
                          padding: "var(--spacing-1) 0",
                        }}
                      />
                      <button type="submit" style={inlineBtn}>save</button>
                      <button type="button" onClick={cancelRename} style={inlineBtn}>cancel</button>
                    </form>
                  ) : (
                    <a
                      href={url}
                      style={{
                        color: "var(--color-ink)",
                        textDecoration: "none",
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--text-caption)",
                        overflowWrap: "anywhere",
                        display: "block",
                      }}
                    >
                      {entry.nickname || entry.handle}
                    </a>
                  )}
                  {entry.nickname && renamingHandle !== entry.handle && (
                    <span
                      style={{
                        display: "block",
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--text-microcaption)",
                        color: "var(--color-ink-subtle)",
                        marginTop: "var(--spacing-1)",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {entry.handle}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-3)", flexShrink: 0 }}>
                  {entry.replies_enabled && replyState?.replies && replyState.replies.length > 0 && (
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--text-microcaption)",
                        color: "var(--color-accent)",
                        padding: "2px 6px",
                        border: "1px solid var(--color-hairline-strong)",
                      }}
                    >
                      {replyState.replies.length} {replyState.replies.length === 1 ? "reply" : "replies"}
                    </span>
                  )}
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
              </div>
              <p style={{ margin: 0, marginTop: "var(--spacing-2)", color: "var(--color-ink-subtle)", fontSize: "var(--text-microcaption)", fontFamily: "var(--font-mono)", display: "flex", gap: "var(--spacing-3)", flexWrap: "wrap", alignItems: "center" }}>
                <span>
                  Sent {formatDate(entry.published_at)}
                  {entry.expires_at >= PERMANENT_EXPIRES_AT_MS - 1000
                    ? " · never expires"
                    : ` · expires ${formatDate(entry.expires_at)}`}
                  {entry.replies_enabled && " · replies on"}
                </span>
                {renamingHandle !== entry.handle && (
                  <button onClick={() => startRename(entry)} style={inlineBtn}>
                    {entry.nickname ? "rename" : "add name"}
                  </button>
                )}
              </p>
              {entry.replies_enabled && !isGone && (
                <div style={{ marginTop: "var(--spacing-3)" }}>
                  {replyState?.loading && (
                    <span style={{ color: "var(--color-ink-subtle)", fontSize: "var(--text-microcaption)" }}>
                      loading replies…
                    </span>
                  )}
                  {replyState?.error && (
                    <span style={{ color: "var(--color-danger)", fontSize: "var(--text-microcaption)" }}>
                      {replyState.error}
                    </span>
                  )}
                  {replyState?.replies && replyState.replies.length === 0 && (
                    <p style={{ margin: 0, color: "var(--color-ink-subtle)", fontSize: "var(--text-microcaption)" }}>
                      no replies yet
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
const inlineBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  padding: 0,
  color: "var(--color-ink-muted)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-microcaption)",
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};

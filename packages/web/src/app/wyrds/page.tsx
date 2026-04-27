"use client";

/**
 * My Wyrds per visual_direction_v1.md §10.7.
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
  composeAttestationBody,
  composeWyrd,
  decryptReply,
  deriveOriginKey,
  fetchRepliesMessage,
  schnorrSign,
  signAuthorshipAttestation,
  PERMANENT_EXPIRES_AT_MS,
} from "@sendwyrd/core";
import {
  hasSeed,
  isUnlocked,
  unlockSeed,
  getSeed,
  consumeNextIndex,
} from "@/lib/seedClient";
import {
  addHistoryEntry,
  listHistory,
  markHistoryEntryGone,
  renameHistoryEntry,
  type HistoryEntry,
} from "@/lib/wyrdHistory";
import {
  listInbox,
  removeInboxEntry,
  renameInboxEntry,
  type InboxEntry,
} from "@/lib/wyrdInbox";
import { burnWyrd, fetchWyrd, publishWyrd } from "@/lib/api";
import { requestPersistence } from "@/lib/persistentStorage";
import { Segmented } from "@/components/Segmented";
import { Nav } from "@/components/Nav";

type View = "outbox" | "inbox";
type Filter = "all" | "live" | "gone";

/**
 * Liveness state for an inbox entry, computed by re-fetching the handle
 * from the relay at view time. Per ADR-024 we never cache plaintext on
 * the inbox; status is always fresh-from-relay. `expired` distinguishes
 * a TTL'd-out wyrd from a manually-burned one when the tombstone has
 * `reason` populated.
 */
type LivenessState =
  | { kind: "checking" }
  | { kind: "live"; expires_at: number }
  | { kind: "gone"; reason: "burned" | "expired" | "unknown"; gone_at: number }
  | { kind: "unreachable" };

interface BurnUiState {
  /** confirm: row showed prompt; burning: request in flight; error: surfaced. */
  stage: "confirm" | "burning" | "error";
  error?: string;
}

interface AttestUiState {
  /**
   * confirm: row showed prompt; publishing: request in flight; success:
   * attestation wyrd published, URL ready to copy; error: surfaced.
   */
  stage: "confirm" | "publishing" | "success" | "error";
  url?: string;
  error?: string;
}

interface Reply {
  text: string;
  received_at: number;
}

interface RepliesView {
  loading: boolean;
  replies?: Reply[];
  error?: string;
}

export default function WyrdsPage() {
  const router = useRouter();
  const [unlocked, setUnlocked] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [inbox, setInbox] = useState<InboxEntry[]>([]);
  const [inboxLiveness, setInboxLiveness] = useState<
    Record<string, LivenessState>
  >({});
  const [view, setView] = useState<View>("outbox");
  const [filter, setFilter] = useState<Filter>("all");
  const [now, setNow] = useState(Date.now());
  const [repliesByHandle, setRepliesByHandle] = useState<
    Record<string, RepliesView>
  >({});
  const [renamingHandle, setRenamingHandle] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [burnByHandle, setBurnByHandle] = useState<Record<string, BurnUiState>>(
    {},
  );
  const [attestByHandle, setAttestByHandle] = useState<
    Record<string, AttestUiState>
  >({});

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

  function startBurn(entry: HistoryEntry) {
    setBurnByHandle((m) => ({ ...m, [entry.handle]: { stage: "confirm" } }));
  }
  function cancelBurn(handle: string) {
    setBurnByHandle((m) => {
      const next = { ...m };
      delete next[handle];
      return next;
    });
  }

  function startAttest(entry: HistoryEntry) {
    setAttestByHandle((m) => ({ ...m, [entry.handle]: { stage: "confirm" } }));
  }
  function cancelAttest(handle: string) {
    setAttestByHandle((m) => {
      const next = { ...m };
      delete next[handle];
      return next;
    });
  }

  async function confirmAttest(entry: HistoryEntry) {
    const seedRec = getSeed();
    if (!seedRec) {
      setUnlocked(false);
      setAttestByHandle((m) => ({
        ...m,
        [entry.handle]: {
          stage: "error",
          error: "Session expired — passphrase needed again.",
        },
      }));
      return;
    }
    setAttestByHandle((m) => ({
      ...m,
      [entry.handle]: { stage: "publishing" },
    }));
    try {
      const sig_b64u = signAuthorshipAttestation({
        seed: seedRec.seed,
        n: entry.n,
        target_handle_b64u: entry.handle,
      });
      const body = composeAttestationBody({
        target_handle: entry.handle,
        sig_b64u,
      });

      let n: number;
      try {
        n = await consumeNextIndex();
      } catch {
        setUnlocked(false);
        setAttestByHandle((m) => ({
          ...m,
          [entry.handle]: {
            stage: "error",
            error: "Session expired — passphrase needed again.",
          },
        }));
        return;
      }

      const result = await composeWyrd({
        plaintext: body,
        seed: seedRec.seed,
        n,
        ttl_seconds: 0, // permanent — attestations exist to be durable evidence
        replies_enabled: false,
      });

      const resp = await publishWyrd(result.publish_payload);
      if ("error" in resp) {
        setAttestByHandle((m) => ({
          ...m,
          [entry.handle]: {
            stage: "error",
            error: `Publish failed: ${resp.error}`,
          },
        }));
        return;
      }

      addHistoryEntry({
        handle: result.handle,
        n,
        k_origin_pub_b64u: b64uEncode(result.k_origin.k_origin_pub),
        k_read_b64u: result.k_read_b64u,
        published_at: resp.published_at,
        expires_at: resp.expires_at,
        replies_enabled: false,
      });
      void requestPersistence();
      setHistory(listHistory());

      const url = buildFragmentUrl(
        window.location.origin,
        result.handle,
        result.k_read_b64u,
      );
      setAttestByHandle((m) => ({
        ...m,
        [entry.handle]: { stage: "success", url },
      }));
    } catch (e: any) {
      setAttestByHandle((m) => ({
        ...m,
        [entry.handle]: {
          stage: "error",
          error: e?.message ?? "Attestation failed.",
        },
      }));
    }
  }

  async function confirmBurn(entry: HistoryEntry) {
    const seedRec = getSeed();
    if (!seedRec) {
      setUnlocked(false);
      setBurnByHandle((m) => ({
        ...m,
        [entry.handle]: { stage: "error", error: "session_expired" },
      }));
      return;
    }
    setBurnByHandle((m) => ({ ...m, [entry.handle]: { stage: "burning" } }));
    try {
      const k = deriveOriginKey(seedRec.seed, entry.n);
      const result = await burnWyrd({
        handle: entry.handle,
        k_origin_priv: k.k_origin_priv,
      });
      if (result.kind === "burned") {
        markHistoryEntryGone(entry.handle, "burned", result.data.gone_at);
        setHistory(listHistory());
        cancelBurn(entry.handle);
        return;
      }
      if (result.kind === "already_gone") {
        const reason = result.data.reason;
        const gone_at_ms = new Date(result.data.gone_at).getTime();
        if (reason === "burned" || reason === "expired") {
          markHistoryEntryGone(entry.handle, reason, gone_at_ms);
        }
        setHistory(listHistory());
        cancelBurn(entry.handle);
        return;
      }
      if (result.kind === "not_found") {
        setBurnByHandle((m) => ({
          ...m,
          [entry.handle]: {
            stage: "error",
            error: "Host has no record of this wyrd.",
          },
        }));
        return;
      }
      if (result.kind === "signature_invalid") {
        setBurnByHandle((m) => ({
          ...m,
          [entry.handle]: {
            stage: "error",
            error: "Signature rejected. Seed may not match this wyrd.",
          },
        }));
        return;
      }
      setBurnByHandle((m) => ({
        ...m,
        [entry.handle]: {
          stage: "error",
          error: `burn failed (${result.status})`,
        },
      }));
    } catch (e: any) {
      setBurnByHandle((m) => ({
        ...m,
        [entry.handle]: {
          stage: "error",
          error: e?.message ?? "burn failed",
        },
      }));
    }
  }

  useEffect(() => {
    if (!hasSeed()) {
      router.replace("/onboarding");
      return;
    }
    setUnlocked(isUnlocked());
    setHistory(listHistory());
    setInbox(listInbox());
    setNow(Date.now());
  }, [router]);

  // Auto-load replies for every wyrd that has them enabled, after unlock.
  useEffect(() => {
    if (!unlocked) return;
    const seedRec = getSeed();
    if (!seedRec) return;
    const live = history.filter(
      (e) => e.replies_enabled && e.expires_at > Date.now() && !e.gone_at,
    );
    for (const entry of live) {
      if (repliesByHandle[entry.handle]) continue;
      void loadReplies(entry);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, history]);

  // Inbox liveness — refetch each entry when the inbox view is active.
  // Per ADR-024 we never cache plaintext on the inbox; liveness is fresh
  // from the relay each time the user opens the view. Skips entries we've
  // already classified in this session (cheap re-renders don't re-fetch).
  useEffect(() => {
    if (view !== "inbox") return;
    if (inbox.length === 0) return;
    const toFetch = inbox.filter((e) => !inboxLiveness[e.handle]);
    if (toFetch.length === 0) return;
    setInboxLiveness((m) => {
      const next = { ...m };
      for (const e of toFetch) next[e.handle] = { kind: "checking" };
      return next;
    });
    void Promise.all(
      toFetch.map(async (entry) => {
        try {
          const res = await fetchWyrd(entry.handle);
          if (res.kind === "live") {
            setInboxLiveness((m) => ({
              ...m,
              [entry.handle]: {
                kind: "live",
                expires_at: res.data.expires_at,
              },
            }));
          } else if (res.kind === "gone") {
            const reason =
              res.data.reason === "burned" || res.data.reason === "expired"
                ? res.data.reason
                : "unknown";
            const gone_at = new Date(res.data.gone_at).getTime();
            setInboxLiveness((m) => ({
              ...m,
              [entry.handle]: { kind: "gone", reason, gone_at },
            }));
          } else {
            setInboxLiveness((m) => ({
              ...m,
              [entry.handle]: { kind: "unreachable" },
            }));
          }
        } catch {
          setInboxLiveness((m) => ({
            ...m,
            [entry.handle]: { kind: "unreachable" },
          }));
        }
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, inbox]);

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
      const messageHash = fetchRepliesMessage({
        handle: handleBytes,
        fetch_timestamp_ms: ts,
      });
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
          decoded.push({
            text: "(decrypt failed)",
            received_at: r.received_at,
          });
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
          <p
            style={{
              margin: 0,
              marginBottom: "var(--spacing-6)",
              color: "var(--color-ink-muted)",
            }}
          >
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
          <button
            type="submit"
            style={{ ...btnStyle, marginTop: "var(--spacing-6)" }}
          >
            Unlock
          </button>
        </form>
      </main>
    );
  }

  const filtered = history.filter((e) => {
    const isGone = e.expires_at <= now || !!e.gone_at;
    if (filter === "live") return !isGone;
    if (filter === "gone") return isGone;
    return true;
  });

  function removeFromInbox(handle: string) {
    removeInboxEntry(handle);
    setInbox(listInbox());
  }

  return (
    <main style={pageStyle}>
      <Nav />
      <section style={{ ...panelStyle, maxWidth: "var(--max-list)" }}>
        <div style={{ marginBottom: "var(--spacing-4)" }}>
          <Segmented
            name="view"
            value={view}
            onChange={(v) => setView(v as View)}
            size="sm"
            ariaLabel="View"
            options={[
              { value: "outbox", label: "outbox" },
              { value: "inbox", label: "inbox" },
            ]}
          />
        </div>

        {view === "inbox" ? (
          <InboxView
            inbox={inbox}
            liveness={inboxLiveness}
            renamingHandle={renamingHandle}
            renameDraft={renameDraft}
            onStartRename={(h, n) => {
              setRenamingHandle(h);
              setRenameDraft(n ?? "");
            }}
            onRenameDraftChange={setRenameDraft}
            onCommitRename={(h) => {
              renameInboxEntry(h, renameDraft);
              setRenamingHandle(null);
              setRenameDraft("");
              setInbox(listInbox());
            }}
            onCancelRename={() => {
              setRenamingHandle(null);
              setRenameDraft("");
            }}
            onRemove={removeFromInbox}
          />
        ) : (
          <>
            <p
              style={{
                margin: 0,
                marginBottom: "var(--spacing-6)",
                color: "var(--color-ink-muted)",
                fontSize: "var(--text-caption)",
              }}
            >
              {history.length} wyrd{history.length === 1 ? "" : "s"} on this
              device{" "}
              <span style={{ color: "var(--color-ink-subtle)" }}>
                (local to this browser — clearing site data wipes the list;
                relay wyrds still age out on their own TTL, and your seed is
                what recovers handles from elsewhere)
              </span>
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
              <p
                style={{
                  margin: 0,
                  color: "var(--color-ink-muted)",
                  fontSize: "var(--text-caption)",
                }}
              >
                {history.length === 0
                  ? "No wyrds yet. Compose one to begin."
                  : "No wyrds match this filter."}
              </p>
            )}

            {filtered.map((entry) => {
              const isExpired = entry.expires_at <= now && !entry.gone_at;
              const isBurned =
                entry.gone_reason === "burned" ||
                (!!entry.gone_at && entry.gone_reason !== "expired");
              const isGone = isExpired || !!entry.gone_at;
              const replyState = repliesByHandle[entry.handle];
              const burnUi = burnByHandle[entry.handle];
              const attestUi = attestByHandle[entry.handle];
              // Recovered-from-mnemonic entries lack k_read_b64u (read key isn't
              // seed-derivable). Fall through to a non-link rendering in that case.
              const url = entry.k_read_b64u
                ? buildFragmentUrl(
                    window.location.origin,
                    entry.handle,
                    entry.k_read_b64u,
                  )
                : null;
              const statusLabel = isBurned
                ? "burned"
                : isExpired
                  ? "expired"
                  : "live";
              const statusColor = isGone
                ? "var(--color-ink-subtle)"
                : "var(--color-mark-sealed)";
              return (
                <article
                  key={entry.handle}
                  style={{
                    paddingTop: "var(--spacing-4)",
                    paddingBottom: "var(--spacing-4)",
                    borderTop: "1px solid var(--color-hairline)",
                    opacity: isGone ? 0.7 : 1,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "var(--spacing-3)",
                      flexWrap: "wrap",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ flex: "1 1 0", minWidth: 0 }}>
                      {renamingHandle === entry.handle ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            commitRename(entry.handle);
                          }}
                          style={{
                            display: "flex",
                            gap: "var(--spacing-2)",
                            alignItems: "center",
                          }}
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
                              borderBottom:
                                "1px solid var(--color-hairline-strong)",
                              color: "var(--color-ink)",
                              fontFamily: "var(--font-mono)",
                              fontSize: "var(--text-caption)",
                              outline: "none",
                              padding: "var(--spacing-1) 0",
                            }}
                          />
                          <button type="submit" style={inlineBtn}>
                            save
                          </button>
                          <button
                            type="button"
                            onClick={cancelRename}
                            style={inlineBtn}
                          >
                            cancel
                          </button>
                        </form>
                      ) : url ? (
                        <a
                          href={url}
                          style={{
                            color: "var(--color-ink)",
                            textDecoration: isBurned ? "line-through" : "none",
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--text-caption)",
                            overflowWrap: "anywhere",
                            display: "block",
                          }}
                        >
                          {entry.nickname || entry.handle}
                        </a>
                      ) : (
                        <span
                          style={{
                            color: "var(--color-ink)",
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--text-caption)",
                            overflowWrap: "anywhere",
                            display: "block",
                          }}
                        >
                          {entry.nickname || entry.handle}
                        </span>
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
                            textDecoration: isBurned ? "line-through" : "none",
                          }}
                        >
                          {entry.handle}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--spacing-3)",
                        flexShrink: 0,
                      }}
                    >
                      {entry.replies_enabled &&
                        !isGone &&
                        replyState?.replies &&
                        replyState.replies.length > 0 && (
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "var(--text-microcaption)",
                              color: "var(--color-accent)",
                              padding: "2px 6px",
                              border: "1px solid var(--color-hairline-strong)",
                            }}
                          >
                            {replyState.replies.length}{" "}
                            {replyState.replies.length === 1
                              ? "reply"
                              : "replies"}
                          </span>
                        )}
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--text-microcaption)",
                          color: statusColor,
                        }}
                      >
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      marginTop: "var(--spacing-2)",
                      color: "var(--color-ink-subtle)",
                      fontSize: "var(--text-microcaption)",
                      fontFamily: "var(--font-mono)",
                      display: "flex",
                      gap: "var(--spacing-3)",
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <span>
                      Sent {formatDate(entry.published_at)}
                      {entry.expires_at >= PERMANENT_EXPIRES_AT_MS - 1000
                        ? " · never expires"
                        : ` · expires ${formatDate(entry.expires_at)}`}
                      {entry.replies_enabled && " · replies on"}
                      {entry.recovered && " · recovered (no read key)"}
                    </span>
                    {renamingHandle !== entry.handle && (
                      <button
                        onClick={() => startRename(entry)}
                        style={inlineBtn}
                      >
                        {entry.nickname ? "rename" : "add name"}
                      </button>
                    )}
                    {!isGone && !burnUi && (
                      <button
                        onClick={() => startBurn(entry)}
                        style={burnInlineBtn}
                        aria-label={`Burn ${entry.nickname || entry.handle}`}
                      >
                        burn
                      </button>
                    )}
                    {!isGone && !attestUi && (
                      <button
                        onClick={() => startAttest(entry)}
                        style={inlineBtn}
                        aria-label={`Attest authorship of ${entry.nickname || entry.handle}`}
                      >
                        attest authorship
                      </button>
                    )}
                  </p>
                  {burnUi && (
                    <div
                      style={{
                        marginTop: "var(--spacing-3)",
                        padding: "var(--spacing-3)",
                        border: "1px solid var(--color-hairline-strong)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--spacing-3)",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontFamily: "var(--font-mono)",
                          fontSize: "var(--text-microcaption)",
                          color: "var(--color-ink-muted)",
                          lineHeight: 1.5,
                        }}
                      >
                        Burn this wyrd? This cannot be undone. The host will
                        return 410 Gone with a tombstone for 30 days, then
                        nothing.
                      </p>
                      <div
                        style={{
                          display: "flex",
                          gap: "var(--spacing-3)",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          onClick={() => void confirmBurn(entry)}
                          disabled={burnUi.stage === "burning"}
                          style={burnConfirmBtn}
                        >
                          {burnUi.stage === "burning" ? "burning…" : "burn"}
                        </button>
                        <button
                          onClick={() => cancelBurn(entry.handle)}
                          disabled={burnUi.stage === "burning"}
                          style={burnCancelBtn}
                        >
                          cancel
                        </button>
                      </div>
                      {burnUi.stage === "error" && burnUi.error && (
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--text-microcaption)",
                            color: "var(--color-danger)",
                          }}
                        >
                          {burnUi.error}
                        </span>
                      )}
                    </div>
                  )}
                  {attestUi && (
                    <div
                      style={{
                        marginTop: "var(--spacing-3)",
                        padding: "var(--spacing-3)",
                        border: "1px solid var(--color-hairline-strong)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--spacing-3)",
                      }}
                    >
                      {attestUi.stage !== "success" && (
                        <p
                          style={{
                            margin: 0,
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--text-microcaption)",
                            color: "var(--color-ink-muted)",
                            lineHeight: 1.5,
                          }}
                        >
                          Publish a permanent wyrd that proves you authored this
                          one. The attestation contains only the target handle
                          and a signature — never the original body. Share the
                          new URL alongside the original; a renderer fetching
                          both shows a verification banner.
                        </p>
                      )}
                      {attestUi.stage !== "success" && (
                        <div
                          style={{
                            display: "flex",
                            gap: "var(--spacing-3)",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            onClick={() => void confirmAttest(entry)}
                            disabled={attestUi.stage === "publishing"}
                            style={inlineBtn}
                          >
                            {attestUi.stage === "publishing"
                              ? "publishing…"
                              : "publish attestation"}
                          </button>
                          <button
                            onClick={() => cancelAttest(entry.handle)}
                            disabled={attestUi.stage === "publishing"}
                            style={inlineBtn}
                          >
                            cancel
                          </button>
                        </div>
                      )}
                      {attestUi.stage === "success" && attestUi.url && (
                        <>
                          <p
                            style={{
                              margin: 0,
                              fontFamily: "var(--font-mono)",
                              fontSize: "var(--text-microcaption)",
                              color: "var(--color-ink-muted)",
                              lineHeight: 1.5,
                            }}
                          >
                            Attestation published. Share alongside the original:
                          </p>
                          <a
                            href={attestUi.url}
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: "var(--text-microcaption)",
                              color: "var(--color-ink)",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {attestUi.url}
                          </a>
                          <div
                            style={{
                              display: "flex",
                              gap: "var(--spacing-3)",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              onClick={() =>
                                void navigator.clipboard.writeText(
                                  attestUi.url!,
                                )
                              }
                              style={inlineBtn}
                            >
                              copy URL
                            </button>
                            <button
                              onClick={() => cancelAttest(entry.handle)}
                              style={inlineBtn}
                            >
                              done
                            </button>
                          </div>
                        </>
                      )}
                      {attestUi.stage === "error" && attestUi.error && (
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "var(--text-microcaption)",
                            color: "var(--color-danger)",
                          }}
                        >
                          {attestUi.error}
                        </span>
                      )}
                    </div>
                  )}
                  {entry.replies_enabled && !isGone && (
                    <div style={{ marginTop: "var(--spacing-3)" }}>
                      {replyState?.loading && (
                        <span
                          style={{
                            color: "var(--color-ink-subtle)",
                            fontSize: "var(--text-microcaption)",
                          }}
                        >
                          loading replies…
                        </span>
                      )}
                      {replyState?.error && (
                        <span
                          style={{
                            color: "var(--color-danger)",
                            fontSize: "var(--text-microcaption)",
                          }}
                        >
                          {replyState.error}
                        </span>
                      )}
                      {replyState?.replies &&
                        replyState.replies.length === 0 && (
                          <p
                            style={{
                              margin: 0,
                              color: "var(--color-ink-subtle)",
                              fontSize: "var(--text-microcaption)",
                            }}
                          >
                            no replies yet
                          </p>
                        )}
                      {replyState?.replies && replyState.replies.length > 0 && (
                        <ul
                          style={{ listStyle: "none", padding: 0, margin: 0 }}
                        >
                          {replyState.replies.map((r, i) => (
                            <li
                              key={i}
                              style={{
                                paddingTop: "var(--spacing-3)",
                                paddingBottom: "var(--spacing-3)",
                                paddingLeft: "var(--spacing-4)",
                                borderLeft:
                                  "1px solid var(--color-hairline-strong)",
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
          </>
        )}
      </section>
    </main>
  );
}

function InboxView({
  inbox,
  liveness,
  renamingHandle,
  renameDraft,
  onStartRename,
  onRenameDraftChange,
  onCommitRename,
  onCancelRename,
  onRemove,
}: {
  inbox: InboxEntry[];
  liveness: Record<string, LivenessState>;
  renamingHandle: string | null;
  renameDraft: string;
  onStartRename: (handle: string, current?: string) => void;
  onRenameDraftChange: (s: string) => void;
  onCommitRename: (handle: string) => void;
  onCancelRename: () => void;
  onRemove: (handle: string) => void;
}) {
  if (inbox.length === 0) {
    return (
      <>
        <p
          style={{
            margin: 0,
            marginBottom: "var(--spacing-4)",
            color: "var(--color-ink-muted)",
            fontSize: "var(--text-caption)",
          }}
        >
          0 wyrds opened in this browser{" "}
          <span style={{ color: "var(--color-ink-subtle)" }}>
            (the inbox is local to this browser only — there is no relay-side
            record of wyrds you&apos;ve received, by design)
          </span>
        </p>
        <p
          style={{
            margin: 0,
            color: "var(--color-ink-muted)",
            fontSize: "var(--text-caption)",
          }}
        >
          When you open a wyrd URL, it&apos;ll appear here.
        </p>
      </>
    );
  }
  return (
    <>
      <p
        style={{
          margin: 0,
          marginBottom: "var(--spacing-6)",
          color: "var(--color-ink-muted)",
          fontSize: "var(--text-caption)",
        }}
      >
        {inbox.length} wyrd{inbox.length === 1 ? "" : "s"} opened in this
        browser{" "}
        <span style={{ color: "var(--color-ink-subtle)" }}>
          (local to this browser — never queried from the relay, never
          recoverable from your seed; clearing site data wipes the list)
        </span>
      </p>
      {inbox.map((entry) => {
        const url = `/w/${entry.handle}#${entry.k_read_b64u}`;
        const live = liveness[entry.handle];
        const isGone = live?.kind === "gone";
        const statusLabel =
          live?.kind === "checking"
            ? "checking…"
            : live?.kind === "live"
              ? "live"
              : live?.kind === "gone"
                ? live.reason === "burned"
                  ? "burned"
                  : live.reason === "expired"
                    ? "expired"
                    : "gone"
                : live?.kind === "unreachable"
                  ? "unreachable"
                  : "";
        const statusColor =
          live?.kind === "live"
            ? "var(--color-mark-sealed)"
            : live?.kind === "gone" || live?.kind === "unreachable"
              ? "var(--color-ink-subtle)"
              : "var(--color-ink-muted)";
        return (
          <article
            key={entry.handle}
            style={{
              paddingTop: "var(--spacing-4)",
              paddingBottom: "var(--spacing-4)",
              borderTop: "1px solid var(--color-hairline)",
              opacity: isGone ? 0.7 : 1,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "var(--spacing-3)",
                flexWrap: "wrap",
                alignItems: "flex-start",
              }}
            >
              <div style={{ flex: "1 1 0", minWidth: 0 }}>
                {renamingHandle === entry.handle ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      onCommitRename(entry.handle);
                    }}
                    style={{
                      display: "flex",
                      gap: "var(--spacing-2)",
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="text"
                      value={renameDraft}
                      onChange={(e) => onRenameDraftChange(e.target.value)}
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
                    <button type="submit" style={inboxInlineBtn}>
                      save
                    </button>
                    <button
                      type="button"
                      onClick={onCancelRename}
                      style={inboxInlineBtn}
                    >
                      cancel
                    </button>
                  </form>
                ) : (
                  <a
                    href={url}
                    style={{
                      color: "var(--color-ink)",
                      textDecoration:
                        live?.kind === "gone" && live.reason === "burned"
                          ? "line-through"
                          : "none",
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
                      textDecoration:
                        live?.kind === "gone" && live.reason === "burned"
                          ? "line-through"
                          : "none",
                    }}
                  >
                    {entry.handle}
                  </span>
                )}
              </div>
              {statusLabel && (
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-microcaption)",
                    color: statusColor,
                    flexShrink: 0,
                  }}
                >
                  {statusLabel}
                </span>
              )}
            </div>
            <p
              style={{
                margin: 0,
                marginTop: "var(--spacing-2)",
                color: "var(--color-ink-subtle)",
                fontSize: "var(--text-microcaption)",
                fontFamily: "var(--font-mono)",
                display: "flex",
                gap: "var(--spacing-3)",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <span>
                First opened {formatDate(entry.first_seen_at)}
                {entry.last_viewed_at !== entry.first_seen_at &&
                  ` · last opened ${formatDate(entry.last_viewed_at)}`}
              </span>
              {renamingHandle !== entry.handle && (
                <button
                  onClick={() => onStartRename(entry.handle, entry.nickname)}
                  style={inboxInlineBtn}
                >
                  {entry.nickname ? "rename" : "add name"}
                </button>
              )}
              <button
                onClick={() => onRemove(entry.handle)}
                style={inboxInlineBtn}
                aria-label={`Remove ${entry.nickname || entry.handle} from inbox`}
              >
                remove
              </button>
            </p>
          </article>
        );
      })}
    </>
  );
}

const inboxInlineBtn: React.CSSProperties = {
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

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
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
const burnInlineBtn: React.CSSProperties = {
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
const burnConfirmBtn: React.CSSProperties = {
  padding: "var(--spacing-2) var(--spacing-4)",
  border: "1px solid var(--color-danger)",
  background: "transparent",
  color: "var(--color-danger)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-microcaption)",
  cursor: "pointer",
};
const burnCancelBtn: React.CSSProperties = {
  padding: "var(--spacing-2) var(--spacing-4)",
  border: "1px solid var(--color-hairline-strong)",
  background: "transparent",
  color: "var(--color-ink-muted)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-microcaption)",
  cursor: "pointer",
};

"use client";

/**
 * Compose page per visual_direction_v1.md §10.2.
 *
 * Flow (post-account-less redesign):
 *   - If no seed exists, auto-generate one in open mode and proceed silently.
 *   - If seed is in open mode, no unlock UI is shown — the user just types.
 *   - If seed is in protected mode, prompt for passphrase to unlock.
 */

import { useState, useEffect } from "react";
import {
  composeWyrd,
  countCountableCodepoints,
  buildFragmentUrl,
  generateSeed,
  BODY_CODEPOINT_CAP,
  TTL_SECONDS_DEFAULT,
} from "@sendwyrd/core";
import {
  hasSeed,
  isUnlocked,
  unlockSeed,
  getSeed,
  storeOpenSeed,
  consumeNextIndex,
} from "@/lib/seedClient";
import { publishWyrd } from "@/lib/api";
import { addHistoryEntry } from "@/lib/wyrdHistory";
import { b64uEncode } from "@sendwyrd/core";
import { Segmented, Toggle } from "@/components/Segmented";
import { Nav } from "@/components/Nav";
import { InstallAffordance } from "@/components/InstallAffordance";
import { requestPersistence } from "@/lib/persistentStorage";

const TTL_PRESETS: Array<{ label: string; seconds: number }> = [
  { label: "1 day", seconds: 86_400 },
  { label: "10 days", seconds: 864_000 },
  { label: "90 days", seconds: 7_776_000 },
  { label: "never", seconds: 0 },
];

export default function ComposePage() {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [ttl, setTtl] = useState(TTL_SECONDS_DEFAULT);
  const [repliesEnabled, setRepliesEnabled] = useState(true);
  const [sending, setSending] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // First-mount: ensure a seed exists. If not, auto-generate in open mode.
  // Also accept Web Share Target prefill (?text=, ?title=, ?url=) — when the
  // PWA is registered as a share target, the OS routes shared content here.
  useEffect(() => {
    (async () => {
      if (!hasSeed()) {
        const { seed, mnemonic } = generateSeed(12);
        storeOpenSeed({ seed, counter: 0, mnemonic });
      }
      setUnlocked(isUnlocked());

      // Prefill from Web Share Target query params, if any. Order: title,
      // text, url joined by newlines (e.g., shared link + comment).
      try {
        const params = new URLSearchParams(window.location.search);
        const t = params.get("text") ?? "";
        const u = params.get("url") ?? "";
        const ti = params.get("title") ?? "";
        const parts = [ti, t, u].filter(Boolean);
        if (parts.length > 0) {
          const joined = parts.join("\n");
          // Codepoint-aware truncation: keep up to BODY_CODEPOINT_CAP. If
          // the share is over-cap, the user trims it themselves; we don't
          // silently drop the tail.
          const codepoints = Array.from(joined);
          const trimmed =
            codepoints.length > BODY_CODEPOINT_CAP
              ? codepoints.slice(0, BODY_CODEPOINT_CAP).join("")
              : joined;
          setBody(trimmed);
        }
      } catch {
        // Reading window.location.search shouldn't throw, but be defensive.
      }

      setReady(true);
    })();
  }, []);

  const count = countCountableCodepoints(body);
  const overCap = count > BODY_CODEPOINT_CAP;

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

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (overCap || count === 0 || sending) return;
    setError(null);
    setSending(true);
    try {
      const seedRec = getSeed();
      if (!seedRec) {
        setUnlocked(false);
        setError("Session expired — passphrase needed again.");
        setSending(false);
        return;
      }

      let n: number;
      try {
        n = await consumeNextIndex();
      } catch {
        // Cache cleared between unlock and send (e.g. lockSeed/forgetSeed).
        // Send the user back to unlock — they'll retry from there.
        setUnlocked(false);
        setError("Session expired — passphrase needed again.");
        setSending(false);
        return;
      }

      const result = await composeWyrd({
        plaintext: body,
        seed: seedRec.seed,
        n,
        ttl_seconds: ttl,
        replies_enabled: repliesEnabled,
      });

      const resp = await publishWyrd(result.publish_payload);
      if ("error" in resp) {
        setError(`Publish failed: ${resp.error}`);
        setSending(false);
        return;
      }

      addHistoryEntry({
        handle: result.handle,
        n,
        k_origin_pub_b64u: b64uEncode(result.k_origin.k_origin_pub),
        k_read_b64u: result.k_read_b64u,
        published_at: resp.published_at,
        expires_at: resp.expires_at,
        replies_enabled: repliesEnabled,
      });

      // First explicit save — request persistent storage. Idempotent across
      // calls; the browser decides silently. We do not block on it.
      void requestPersistence();

      const origin = window.location.origin;
      const url = buildFragmentUrl(origin, result.handle, result.k_read_b64u);
      setShareUrl(url);
    } catch (e: any) {
      setError(e?.message ?? "Compose failed.");
    } finally {
      setSending(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!ready) {
    return (
      <main style={pageStyle}>
        <Nav />
      </main>
    );
  }

  if (!unlocked) {
    // Only protected-mode seeds can be locked. Open mode is always unlocked.
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

  if (shareUrl) {
    return (
      <main style={pageStyle}>
        <Nav />
        <article style={panelStyle}>
          <p
            style={{
              margin: 0,
              marginBottom: "var(--spacing-4)",
              color: "var(--color-ink-muted)",
            }}
          >
            Sent. Share this URL — it&apos;s the only way to read your wyrd.
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "var(--spacing-3)",
              padding: "var(--spacing-3) var(--spacing-4)",
              border: "1px solid var(--color-hairline)",
              borderRadius: 4,
              fontSize: "var(--text-caption)",
              color: "var(--color-ink)",
              maxWidth: "100%",
            }}
          >
            <span
              style={{
                flex: "1 1 0",
                minWidth: 0,
                overflowWrap: "anywhere",
                wordBreak: "break-word",
                fontFamily: "var(--font-mono)",
              }}
            >
              {shareUrl}
            </span>
            <button
              onClick={handleCopy}
              aria-label="Copy share URL"
              style={{
                flexShrink: 0,
                background: "transparent",
                border: "none",
                color: copied
                  ? "var(--color-mark-sealed)"
                  : "var(--color-accent)",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-caption)",
                transition: "opacity 200ms linear",
              }}
            >
              {copied ? "✓ copied" : "copy"}
            </button>
          </div>
          <button
            onClick={() => {
              setShareUrl(null);
              setBody("");
              setRepliesEnabled(true);
              setTtl(TTL_SECONDS_DEFAULT);
            }}
            style={{ ...btnStyle, marginTop: "var(--spacing-8)" }}
          >
            Compose another
          </button>
        </article>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <Nav />
      <InstallAffordance variant="wyrd" />
      <form onSubmit={handleSend} style={panelStyle}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="A wyrd…"
          rows={6}
          autoFocus
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            borderBottom: "1px solid var(--color-hairline)",
            color: "var(--color-ink)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-body)",
            lineHeight: 1.6,
            resize: "vertical",
            padding: "var(--spacing-3) 0",
            outline: "none",
          }}
        />

        <p
          style={{
            margin: 0,
            marginTop: "var(--spacing-2)",
            textAlign: "right",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-caption)",
            color: overCap ? "var(--color-danger)" : "var(--color-ink-muted)",
            transition: "color 120ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {count} / {BODY_CODEPOINT_CAP}
        </p>

        <div style={{ marginTop: "var(--spacing-6)" }}>
          <p style={fieldLabelStyle}>Expires in</p>
          <Segmented
            name="ttl"
            value={String(ttl)}
            onChange={(v) => setTtl(Number(v))}
            layout="wrap"
            size="sm"
            ariaLabel="Time to live"
            options={TTL_PRESETS.map((p) => ({
              value: String(p.seconds),
              label: p.label,
            }))}
          />
        </div>

        <div style={{ marginTop: "var(--spacing-6)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-4)",
              flexWrap: "wrap",
            }}
          >
            <p style={{ ...fieldLabelStyle, margin: 0 }}>Replies</p>
            <Toggle
              name="replies"
              value={repliesEnabled}
              onChange={setRepliesEnabled}
              ariaLabel="Allow replies"
            />
          </div>
          <p
            style={{
              ...hintStyle,
              marginTop: "var(--spacing-2)",
              marginBottom: 0,
            }}
          >
            {repliesEnabled
              ? "Useful when this wyrd is relayed person-to-person. The nth recipient can reach you privately — only you can read replies, not the host or anyone in the chain."
              : "One-way only — recipients cannot reply through this wyrd."}
          </p>
        </div>

        {error && <p style={errorStyle}>{error}</p>}

        <button
          type="submit"
          disabled={overCap || count === 0 || sending}
          style={{
            ...btnStyle,
            marginTop: "var(--spacing-8)",
            opacity: overCap || count === 0 || sending ? 0.4 : 1,
            cursor:
              overCap || count === 0 || sending ? "not-allowed" : "pointer",
          }}
        >
          {sending ? "Composing…" : "Compose"}
        </button>
      </form>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "var(--spacing-12) var(--spacing-6)",
  gap: "var(--spacing-12)",
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
const fieldLabelStyle: React.CSSProperties = {
  margin: 0,
  marginBottom: "var(--spacing-2)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-microcaption)",
  textTransform: "lowercase",
  letterSpacing: "0.05em",
  color: "var(--color-ink-muted)",
};
const hintStyle: React.CSSProperties = {
  margin: 0,
  color: "var(--color-ink-subtle)",
  fontSize: "var(--text-microcaption)",
  fontFamily: "var(--font-mono)",
};
const errorStyle: React.CSSProperties = {
  color: "var(--color-danger)",
  margin: 0,
  marginTop: "var(--spacing-3)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-caption)",
};

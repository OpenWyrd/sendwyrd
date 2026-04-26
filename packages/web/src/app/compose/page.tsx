"use client";

/**
 * Compose page per visual_direction_v1.md §10.2.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  composeWyrd,
  countCountableCodepoints,
  buildFragmentUrl,
  buildPublicUrl,
  BODY_CODEPOINT_CAP,
  TTL_SECONDS_DEFAULT,
} from "@sendwyrd/core";
import {
  hasSeed,
  isUnlocked,
  unlockSeed,
  getSeed,
  consumeNextIndex,
} from "@/lib/seedClient";
import { publishWyrd } from "@/lib/api";
import { addHistoryEntry } from "@/lib/wyrdHistory";
import { b64uEncode } from "@sendwyrd/core";
import { Segmented, Toggle } from "@/components/Segmented";

const TTL_PRESETS: Array<{ label: string; seconds: number }> = [
  { label: "1 day", seconds: 86_400 },
  { label: "1 week", seconds: 604_800 },
  { label: "1 month", seconds: 2_592_000 },
  { label: "90 days", seconds: 7_776_000 },
  { label: "1 year", seconds: 31_536_000 },
];

export default function ComposePage() {
  const router = useRouter();
  const [unlocked, setUnlocked] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [ttl, setTtl] = useState(TTL_SECONDS_DEFAULT);
  const [form, setForm] = useState<"sealed" | "open">("sealed");
  const [repliesEnabled, setRepliesEnabled] = useState(false);
  const [sending, setSending] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!hasSeed()) {
      router.replace("/onboarding");
      return;
    }
    setUnlocked(isUnlocked());
  }, [router]);

  // URLs are excluded from the cap (spec amendment §8.2 / ADR-012).
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

      // Need passphrase to persist the bumped counter pre-publish.
      const pp = window.prompt("Confirm passphrase to consume the next index");
      if (!pp) {
        setSending(false);
        return;
      }
      let n: number;
      try {
        n = await consumeNextIndex(pp);
      } catch {
        setError("Passphrase incorrect — index not consumed.");
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

      // Persist to local wyrd history so the inbox can find this wyrd later.
      addHistoryEntry({
        handle: result.handle,
        n,
        k_origin_pub_b64u: b64uEncode(result.k_origin.k_origin_pub),
        k_read_b64u: result.k_read_b64u,
        published_at: resp.published_at,
        expires_at: resp.expires_at,
        replies_enabled: repliesEnabled,
      });

      const origin = window.location.origin;
      const url =
        form === "sealed"
          ? buildFragmentUrl(origin, result.handle, result.k_read_b64u)
          : buildPublicUrl(origin, result.handle, result.k_read_b64u);
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
          {unlockError && (
            <p style={errorStyle}>{unlockError}</p>
          )}
          <button type="submit" style={{ ...btnStyle, marginTop: "var(--spacing-6)" }}>
            Unlock
          </button>
        </form>
      </main>
    );
  }

  if (shareUrl) {
    return (
      <main style={pageStyle}>
        <h1 style={wordmarkStyle}>SendWyrd</h1>
        <article style={panelStyle}>
          <p style={{ margin: 0, marginBottom: "var(--spacing-4)", color: "var(--color-ink-muted)" }}>
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
                color: copied ? "var(--color-mark-sealed)" : "var(--color-accent)",
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
              setRepliesEnabled(false);
              setForm("sealed");
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
      <h1 style={wordmarkStyle}>SendWyrd</h1>
      <form onSubmit={handleSend} style={panelStyle}>
        {/* Form toggle: Sealed (default) / Open */}
        <div style={{ marginBottom: "var(--spacing-6)" }}>
          <Segmented
            name="form"
            value={form}
            onChange={(v) => setForm(v)}
            layout="wrap"
            ariaLabel="Privacy form"
            options={[
              {
                value: "sealed",
                label: "Sealed · host cannot read",
                accent: "var(--color-mark-sealed)",
              },
              {
                value: "open",
                label: "Open · host can read",
                accent: "var(--color-mark-open)",
              },
            ]}
          />
        </div>

        {/* Body */}
        <textarea
          value={body}
          onChange={(e) => {
            const next = e.target.value;
            // Cap by *countable* codepoints (URLs excluded). Allow pastes that
            // contain a long URL; only block when prose exceeds the cap.
            if (countCountableCodepoints(next) > BODY_CODEPOINT_CAP) {
              return; // refuse the keystroke / paste
            }
            setBody(next);
          }}
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

        {/* Counter */}
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

        {/* TTL selector */}
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

        {/* Replies toggle */}
        <div style={{ marginTop: "var(--spacing-6)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-4)", flexWrap: "wrap" }}>
            <p style={{ ...fieldLabelStyle, margin: 0 }}>Replies</p>
            <Toggle
              name="replies"
              value={repliesEnabled}
              onChange={setRepliesEnabled}
              ariaLabel="Allow replies"
            />
          </div>
          <p style={{ ...hintStyle, marginTop: "var(--spacing-2)", marginBottom: 0 }}>
            {repliesEnabled
              ? "Recipients may send you one anonymous reply each."
              : "Recipients cannot reply."}
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
            cursor: overCap || count === 0 || sending ? "not-allowed" : "pointer",
          }}
        >
          {sending ? "Sending…" : "Send"}
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

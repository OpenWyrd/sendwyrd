"use client";

/**
 * Anonymous reply submission per spec §14.1.
 * ECIES to the wyrd's K_origin_pub, anonymous to the host.
 * Multiple replies per recipient are allowed (architecture can't enforce
 * per-recipient throttling without identity, and shouldn't pretend to).
 */

import { useState } from "react";
import {
  encryptReply,
  b64uDecode,
  b64uEncode,
  countCodepoints,
  REPLY_CODEPOINT_CAP,
} from "@sendwyrd/core";

interface Props {
  handle: string;
  k_origin_pub_b64u: string;
}

export function ReplyForm({ handle, k_origin_pub_b64u }: Props) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const count = countCodepoints(body);
  const overCap = count > REPLY_CODEPOINT_CAP;
  const canSend = !sending && count > 0 && !overCap;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setError(null);
    setSending(true);
    try {
      const handleBytes = b64uDecode(handle);
      const k_origin_pub = b64uDecode(k_origin_pub_b64u);
      const blob = await encryptReply({
        plaintext: body,
        handle: handleBytes,
        k_origin_pub,
      });
      const res = await fetch(`/api/v1/wyrds/${handle}/replies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "MOP-Protocol-Version": "1",
        },
        body: JSON.stringify({
          reply_blob: b64uEncode(blob),
          submit_timestamp_ms: Date.now(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "unknown" }));
        setError(`Reply failed: ${j.error}`);
        setSending(false);
        return;
      }
      setBody("");
      setSentCount((n) => n + 1);
      setJustSent(true);
      setSending(false);
      // Brief confirmation flash, then form is ready for another reply.
      setTimeout(() => setJustSent(false), 2500);
    } catch (e: any) {
      setError(e?.message ?? "Reply failed");
      setSending(false);
    }
  }

  return (
    <section
      style={{
        marginTop: "var(--spacing-12)",
        paddingTop: "var(--spacing-6)",
        borderTop: "1px solid var(--color-hairline-strong)",
      }}
    >
      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-2)",
          marginBottom: "var(--spacing-4)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-h3)",
            fontWeight: 500,
            color: "var(--color-ink)",
            letterSpacing: "-0.01em",
          }}
        >
          DM Author
        </h2>
        <details className="reply-disclosure">
          <summary
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-microcaption)",
              color: "var(--color-ink-subtle)",
              cursor: "pointer",
              listStyle: "none",
            }}
          >
            What is a DM?
          </summary>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--spacing-2)",
              marginTop: "var(--spacing-3)",
            }}
          >
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-caption)",
                color: "var(--color-ink-muted)",
                lineHeight: 1.5,
              }}
            >
              Only the author can read this. Useful when you got this wyrd
              forwarded through other people — your message reaches the author
              directly, without going back through the chain.
            </p>
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-caption)",
                color: "var(--color-ink-muted)",
                lineHeight: 1.5,
              }}
            >
              One-shot. The author can read your DM but can&apos;t reply to it
              through SendWyrd. If you want a back-and-forth, put a way to
              reach you inside the message itself.
            </p>
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-microcaption)",
                color: "var(--color-ink-subtle)",
              }}
            >
              anonymous · encrypted on your device · ECIES (secp256k1) ·
              AES-256-GCM
            </p>
          </div>
        </details>
      </header>

      <form onSubmit={handleSubmit}>
        <textarea
          value={body}
          onChange={(e) => {
            if (countCodepoints(e.target.value) > REPLY_CODEPOINT_CAP) return;
            setBody(e.target.value);
          }}
          rows={4}
          placeholder="Type your reply…"
          disabled={sending}
          style={{
            width: "100%",
            background: "var(--color-surface)",
            border: "1px solid var(--color-hairline)",
            borderRadius: 4,
            color: "var(--color-ink)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-caption)",
            lineHeight: 1.6,
            padding: "var(--spacing-3) var(--spacing-4)",
            resize: "vertical",
            outline: "none",
            opacity: sending ? 0.6 : 1,
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "var(--spacing-3)",
            marginTop: "var(--spacing-3)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-microcaption)",
              color: overCap
                ? "var(--color-danger)"
                : "var(--color-ink-subtle)",
            }}
          >
            {count} / {REPLY_CODEPOINT_CAP}
            {sentCount > 0 && (
              <>
                {" · "}
                {sentCount} sent
              </>
            )}
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-3)",
            }}
          >
            {justSent && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-microcaption)",
                  color: "var(--color-mark-sealed)",
                }}
              >
                ✓ sent
              </span>
            )}
            <button
              type="submit"
              disabled={!canSend}
              style={{
                padding: "var(--spacing-2) var(--spacing-5)",
                border: "1px solid var(--color-hairline-strong)",
                background: canSend ? "var(--color-ink)" : "transparent",
                color: canSend
                  ? "var(--color-ground)"
                  : "var(--color-ink-muted)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-caption)",
                cursor: canSend ? "pointer" : "not-allowed",
                transition:
                  "background 120ms cubic-bezier(0.4, 0, 0.2, 1), color 120ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
        {error && (
          <p
            style={{
              margin: 0,
              marginTop: "var(--spacing-2)",
              color: "var(--color-danger)",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-microcaption)",
            }}
          >
            {error}
          </p>
        )}
      </form>
    </section>
  );
}

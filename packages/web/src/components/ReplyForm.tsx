"use client";

/**
 * Anonymous reply submission per spec §14.1.
 * Composer encrypts via ECIES to the wyrd's K_origin_pub, POSTs the blob.
 * No author signature required (recipient is anonymous to host).
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
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = countCodepoints(body);
  const overCap = count > REPLY_CODEPOINT_CAP;
  const canSend = !sending && !sent && count > 0 && !overCap;

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
      setSent(true);
    } catch (e: any) {
      setError(e?.message ?? "Reply failed");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <p
        style={{
          margin: 0,
          marginTop: "var(--spacing-8)",
          paddingTop: "var(--spacing-4)",
          borderTop: "1px solid var(--color-hairline)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-caption)",
          color: "var(--color-ink-muted)",
        }}
      >
        Reply sent. The author will see it.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginTop: "var(--spacing-8)",
        paddingTop: "var(--spacing-4)",
        borderTop: "1px solid var(--color-hairline)",
      }}
    >
      <p
        style={{
          margin: 0,
          marginBottom: "var(--spacing-3)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-caption)",
          color: "var(--color-ink-muted)",
        }}
      >
        Reply (anonymous, encrypted to the author)
      </p>
      <textarea
        value={body}
        onChange={(e) => {
          if (countCodepoints(e.target.value) > REPLY_CODEPOINT_CAP) return;
          setBody(e.target.value);
        }}
        rows={4}
        placeholder="…"
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          borderBottom: "1px solid var(--color-hairline)",
          color: "var(--color-ink)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-caption)",
          lineHeight: 1.6,
          padding: "var(--spacing-2) 0",
          resize: "vertical",
          outline: "none",
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "var(--spacing-3)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-microcaption)",
            color: overCap ? "var(--color-danger)" : "var(--color-ink-subtle)",
          }}
        >
          {count} / {REPLY_CODEPOINT_CAP}
        </span>
        <button
          type="submit"
          disabled={!canSend}
          style={{
            padding: "var(--spacing-2) var(--spacing-4)",
            border: "1px solid var(--color-hairline-strong)",
            background: "transparent",
            color: "var(--color-ink)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-caption)",
            cursor: canSend ? "pointer" : "not-allowed",
            opacity: canSend ? 1 : 0.4,
          }}
        >
          {sending ? "Sending…" : "Send reply"}
        </button>
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
  );
}

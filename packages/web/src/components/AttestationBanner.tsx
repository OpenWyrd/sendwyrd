"use client";

/**
 * Renders an authorship-attestation wyrd as a verification banner.
 *
 * On mount: parses the body into {target_handle, sig}, fetches the target
 * wyrd's K_origin_pub from the host, runs Schnorr verify, and surfaces
 * the result. Three terminal states:
 *
 *   verified  — signature valid against the target's K_origin
 *   failed    — body parses but signature fails verify
 *   missing   — target handle returns 404 (can't verify)
 *
 * The banner intentionally surfaces the cryptographic claim plainly: an
 * attestation only proves "the holder of K_origin_priv for the target
 * signed this." Anyone forwarding the attestation URL alongside the
 * original target URL produces a verifiable authorship chain.
 */

import { useEffect, useState } from "react";
import {
  parseAttestationBody,
  verifyAuthorshipAttestation,
} from "@sendwyrd/core";

type State =
  | { kind: "loading" }
  | {
      kind: "verified";
      target_handle: string;
      target_url: string;
    }
  | { kind: "failed"; target_handle: string }
  | { kind: "missing"; target_handle: string }
  | { kind: "malformed" }
  | { kind: "error" };

interface Props {
  body: string;
}

const API_BASE = "/api/v1";

export function AttestationBanner({ body }: Props) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    const parts = parseAttestationBody(body);
    if (!parts) {
      setState({ kind: "malformed" });
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/wyrds/${parts.target_handle}`, {
          headers: { "MOP-Protocol-Version": "1" },
          cache: "no-store",
        });
        if (cancelled) return;
        if (res.status === 404) {
          setState({ kind: "missing", target_handle: parts.target_handle });
          return;
        }
        if (!res.ok && res.status !== 410) {
          setState({ kind: "error" });
          return;
        }
        // 410 Gone exposes the K_origin_pub on the tombstone; we accept
        // that for verification too — burned/expired authorship still verifies.
        const data = await res.json();
        const ok = verifyAuthorshipAttestation({
          target_handle_b64u: parts.target_handle,
          target_k_origin_pub_b64u: data.k_origin_pub,
          sig_b64u: parts.sig_b64u,
        });
        if (cancelled) return;
        if (ok) {
          const target_url =
            typeof window !== "undefined"
              ? `${window.location.origin}/w/${parts.target_handle}`
              : `https://sendwyrd.com/w/${parts.target_handle}`;
          setState({
            kind: "verified",
            target_handle: parts.target_handle,
            target_url,
          });
        } else {
          setState({ kind: "failed", target_handle: parts.target_handle });
        }
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [body]);

  return (
    <article style={containerStyle}>
      <p style={kickerStyle}>Authorship attestation</p>
      {state.kind === "loading" && (
        <p style={metaStyle}>Verifying signature…</p>
      )}
      {state.kind === "malformed" && (
        <p style={metaStyle}>This wyrd looks like an attestation but is malformed.</p>
      )}
      {state.kind === "missing" && (
        <p style={metaStyle}>
          The target wyrd ({state.target_handle}) was not found. The
          signature can&apos;t be verified without it.
        </p>
      )}
      {state.kind === "error" && (
        <p style={metaStyle}>Couldn&apos;t reach the host to verify.</p>
      )}
      {state.kind === "failed" && (
        <p style={{ ...metaStyle, color: "var(--color-danger)" }}>
          ✗ Signature did not verify against the target&apos;s K_origin.
          Treat as unverified.
        </p>
      )}
      {state.kind === "verified" && (
        <>
          <p style={{ ...metaStyle, color: "var(--color-mark-sealed)" }}>
            ✓ Signature verifies. The author of this attestation holds
            the seed that produced wyrd {state.target_handle}.
          </p>
          <p style={metaStyle}>
            <a href={state.target_url} style={linkStyle}>
              Open the target wyrd
            </a>
            {" "}— if you also hold its read key, you can confirm the
            content end-to-end.
          </p>
        </>
      )}
    </article>
  );
}

const containerStyle: React.CSSProperties = {
  width: "100%",
  padding: "var(--spacing-4) var(--spacing-5)",
  border: "1px solid var(--color-hairline-strong)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--spacing-2)",
  fontFamily: "var(--font-mono)",
};

const kickerStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "var(--text-microcaption)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-ink-subtle)",
};

const metaStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "var(--text-caption)",
  color: "var(--color-ink)",
  lineHeight: 1.5,
  overflowWrap: "anywhere",
};

const linkStyle: React.CSSProperties = {
  color: "var(--color-accent)",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};

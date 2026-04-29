/**
 * Fragment-form view: server-streamed envelope, client-side decrypt.
 *
 * The page renders an immediate shell (`<Suspense fallback>`) so TTFB is
 * dominated by Next's render time, not by the api worker → Postgres
 * round trip. The shell streams to the browser immediately; the browser
 * starts loading JS chunks. The async `<EnvelopeResolver>` fetches the
 * envelope from the api worker (in-CF-network) and streams the resolved
 * `<FragmentClient>` (with the envelope embedded) once it's ready.
 *
 * Effect: TTFB stays low, JS load happens in parallel with the envelope
 * fetch, and there's no client-side round trip — the envelope is in the
 * stream by the time JS hydrates.
 *
 * K_read still lives in the URL fragment and never reaches the server
 * (per RFC 3986). The envelope is encrypted; SSR-embedding it leaks
 * nothing the api worker doesn't already expose at /api/v1/wyrds/{handle}.
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import FragmentClient, { type InitialFetch } from "./FragmentClient";

// Force a fresh render per request — burns and tombstones must reflect
// immediately. Streamed responses still respect this; we just don't cache
// at the edge.
export const dynamic = "force-dynamic";

interface Params {
  handle: string;
}

// OG/Twitter text metadata. The image itself is rendered by the colocated
// `opengraph-image.tsx` route — Next 15 wires it into og:image and (as
// fallback) twitter:image automatically, so we deliberately omit `images:`
// here. Critical: in Next 15.5.x, an explicit `images:` array overrides
// the file-based route and makes the dynamic per-handle card unreachable.
// The image carries handle + TTL class only — server-known envelope
// metadata, no plaintext (K_read lives in the URL fragment and never
// reaches the host per RFC 3986 §3.5; ADR-021 §Revisited 2026-04-28).
export const metadata: Metadata = {
  title: "Encrypted Wyrd",
  description: "An encrypted message. Tap to decrypt.",
  openGraph: {
    title: "Encrypted Wyrd",
    description: "An encrypted message. Tap to decrypt.",
    siteName: "SendWyrd",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Encrypted Wyrd",
    description: "An encrypted message. Tap to decrypt.",
  },
};

const API_BASE = process.env.SENDWYRD_API_BASE ?? "https://sendwyrd.com";

async function fetchEnvelope(handle: string): Promise<InitialFetch> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/wyrds/${handle}`, {
      headers: { "MOP-Protocol-Version": "1" },
      cache: "no-store",
    });
    if (res.status === 404) return { kind: "not_found" };
    if (res.status === 410) {
      const t = (await res.json()) as { reason: string; gone_at: string };
      return { kind: "gone", reason: t.reason, gone_at: t.gone_at };
    }
    if (!res.ok) return { kind: "error" };
    const data = await res.json();
    return { kind: "ok", data };
  } catch {
    return { kind: "error" };
  }
}

async function EnvelopeResolver({ handle }: { handle: string }) {
  const initial = await fetchEnvelope(handle);
  return <FragmentClient handle={handle} initial={initial} />;
}

function LoadingShell() {
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
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-mono)",
          color: "var(--color-ink-muted)",
        }}
      >
        …
      </p>
    </main>
  );
}

export default async function FragmentView({
  params,
}: {
  params: Promise<Params>;
}) {
  const { handle } = await params;
  return (
    <Suspense fallback={<LoadingShell />}>
      <EnvelopeResolver handle={handle} />
    </Suspense>
  );
}

/**
 * Public-form view per visual_direction_v1.md §10.5.
 * Server-side fetch + decrypt; renders SSR HTML with the body inline.
 * OpenGraph metadata derived from body for cross-post previews.
 */

import { notFound } from "next/navigation";
import {
  decryptFromBase64Url,
  b64uDecode,
  HANDLE_CHARS,
  K_READ_CHARS,
  PERMANENT_EXPIRES_AT_MS,
} from "@sendwyrd/core";
import { PrivacyIndicator } from "@/components/PrivacyIndicator";
import { WyrdBody } from "@/components/WyrdBody";
import { Nav } from "@/components/Nav";
import { resolveTransitives, type ResolutionMap } from "@/lib/resolveBody";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ handle: string; k_read: string }>;
}

interface FetchResult {
  kind: "ready" | "gone";
  body?: string;
  transitives?: ResolutionMap;
  reason?: string;
  gone_at?: string;
  published_at?: number;
  expires_at?: number;
}

async function fetchAndDecrypt(handle: string, k_read: string): Promise<FetchResult | null> {
  if (handle.length !== HANDLE_CHARS || k_read.length !== K_READ_CHARS) return null;
  // Hardcoded canonical host for v1. Local dev hits sendwyrd.com directly.
  // (Worker-to-worker fetch on the same zone goes through CF edge — adds ~10ms,
  // acceptable for v1; revisit with a service binding if it bites.)
  const url = `https://sendwyrd.com/api/v1/wyrds/${handle}`;
  const res = await fetch(url, {
    headers: { "MOP-Protocol-Version": "1" },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (res.status === 410) {
    const t = await res.json();
    return { kind: "gone", reason: t.reason, gone_at: t.gone_at };
  }
  if (!res.ok) return null;
  const data = await res.json();
  try {
    const handleBytes = b64uDecode(data.handle);
    const k_read_bytes = b64uDecode(k_read);
    const body = await decryptFromBase64Url(data.envelope, {
      k_read: k_read_bytes,
      handle: handleBytes,
      expires_at_ms: data.expires_at,
      replies_enabled: data.replies_enabled,
    });
    const transitives = await resolveTransitives(body);
    return {
      kind: "ready",
      body,
      transitives,
      published_at: data.published_at,
      expires_at: data.expires_at,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle, k_read } = await params;
  const result = await fetchAndDecrypt(handle, k_read);
  if (!result || result.kind === "gone" || !result.body) {
    return { title: "SendWyrd", description: "Hyperlinks for conversation." };
  }
  // OG description = first 200 codepoints, truncated cleanly at a word boundary.
  const codepoints = Array.from(result.body);
  let truncated = codepoints.slice(0, 200).join("");
  if (codepoints.length > 200) {
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > 100) truncated = truncated.slice(0, lastSpace);
    truncated += "…";
  }
  return {
    title: "A wyrd · SendWyrd",
    description: truncated,
    openGraph: {
      title: "A wyrd · SendWyrd",
      description: truncated,
      type: "article",
      url: `https://sendwyrd.com/w/${handle}/k/${k_read}`,
    },
    twitter: {
      card: "summary",
      title: "A wyrd · SendWyrd",
      description: truncated,
    },
  };
}

export default async function PublicFormView({ params }: PageProps) {
  const { handle, k_read } = await params;
  const result = await fetchAndDecrypt(handle, k_read);
  if (!result) notFound();

  if (result.kind === "gone") {
    return (
      <main style={pageStyle}>
        <Nav />
        <article style={panelStyle}>
          <PrivacyIndicator state="open" />
          <p style={{ ...goneStyle, marginTop: "var(--spacing-6)" }}>
            {result.reason === "burned"
              ? `This wyrd was withdrawn by its author on ${formatDate(result.gone_at!)}.`
              : `This wyrd's time is up. It expired on ${formatDate(result.gone_at!)}.`}
          </p>
        </article>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <Nav />
      <article style={panelStyle}>
        <header style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--spacing-3)" }}>
          <PrivacyIndicator state="open" />
        </header>
        <div
          style={{
            paddingTop: "var(--spacing-2)",
            paddingBottom: "var(--spacing-3)",
          }}
        >
          <WyrdBody body={result.body!} transitives={result.transitives} />
        </div>
        <p
          style={{
            margin: 0,
            color: "var(--color-ink-subtle)",
            fontSize: "var(--text-microcaption)",
            fontFamily: "var(--font-mono)",
          }}
        >
          Sent {formatDate(new Date(result.published_at!).toISOString())}
          {result.expires_at! < PERMANENT_EXPIRES_AT_MS - 1000 && (
            <> · expires {formatDate(new Date(result.expires_at!).toISOString())}</>
          )}
        </p>
      </article>
    </main>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
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
};
const goneStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-mono)",
  color: "var(--color-ink-muted)",
};

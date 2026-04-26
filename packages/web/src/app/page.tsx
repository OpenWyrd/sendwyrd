/**
 * Landing page.
 *
 * Layout per visual_direction_v1.md §10.1. Real copy lives in Phase F;
 * this is a placeholder that respects the structure (wordmark, sigil,
 * specimen, prose, single CTA).
 */

import Link from "next/link";

export default function LandingPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--spacing-24) var(--spacing-6)",
        gap: "var(--spacing-12)",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-display)",
          fontWeight: 600,
          letterSpacing: "-0.02em",
          margin: 0,
        }}
      >
        SendWyrd
      </h1>

      {/* TODO Phase F — replace with the wyrd sigil (visual_direction_v1.md §7) */}
      <div
        aria-hidden
        style={{
          width: 96,
          height: 96,
          border: "1px solid var(--color-hairline)",
          color: "var(--color-ink-subtle)",
        }}
      />

      {/* Specimen placeholder — Phase F populates with a real-feeling demo wyrd. */}
      <article
        style={{
          width: "100%",
          maxWidth: "var(--max-content)",
          paddingTop: "var(--spacing-6)",
          paddingBottom: "var(--spacing-6)",
          borderTop: "1px solid var(--color-hairline)",
          borderBottom: "1px solid var(--color-hairline)",
          fontFamily: "var(--font-mono)",
          color: "var(--color-ink)",
        }}
      >
        <p style={{ margin: 0 }}>
          {/* Specimen body placeholder. */}
          A wyrd is a short, encrypted message that lives at a URL and
          disappears when its time is up. Send it through the channels you
          already use.
        </p>
        <p
          style={{
            margin: 0,
            marginTop: "var(--spacing-3)",
            color: "var(--color-ink-muted)",
            fontSize: "var(--text-caption)",
            textAlign: "right",
          }}
        >
          287 / 300
        </p>
      </article>

      <Link
        href="/compose"
        style={{
          padding: "var(--spacing-3) var(--spacing-6)",
          border: "1px solid var(--color-hairline-strong)",
          color: "var(--color-ink)",
          textDecoration: "none",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-body)",
        }}
      >
        Compose a wyrd
      </Link>
    </main>
  );
}

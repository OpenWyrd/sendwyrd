/**
 * Landing page per visual_direction_v1.md §10.1.
 *
 * Layout: wordmark → breathing wyrd sigil → specimen wyrd (with privacy
 * indicator + mono body + caption) → one paragraph of prose explaining the
 * primitive (no use-case lead, per ADR-015) → single CTA.
 *
 * No nav bar, no footer, no testimonials, no pricing, no feature comparison.
 * One column, breathes, ends.
 */

import Link from "next/link";
import { WyrdSigil } from "@/components/WyrdSigil";
import { PrivacyIndicator } from "@/components/PrivacyIndicator";

export default function LandingPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "var(--spacing-20) var(--spacing-6) var(--spacing-24)",
        gap: "var(--spacing-16)",
      }}
    >
      {/* Wordmark */}
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-display)",
          fontWeight: 600,
          letterSpacing: "-0.02em",
          margin: 0,
          color: "var(--color-ink)",
        }}
      >
        SendWyrd
      </h1>

      {/* Breathing sigil — landing only */}
      <WyrdSigil
        size={96}
        breathing
        ariaLabel="SendWyrd sigil"
        className=""
      />

      {/* Specimen — a real-feeling rendered wyrd, demonstrating the form.
          Per ADR-015 (use-case agnostic), the body reads naturally for any
          of the four candidate use cases. */}
      <article
        style={{
          width: "100%",
          maxWidth: "var(--max-content)",
          fontFamily: "var(--font-mono)",
        }}
      >
        <PrivacyIndicator />

        <p
          style={{
            margin: 0,
            paddingTop: "var(--spacing-6)",
            paddingBottom: "var(--spacing-3)",
            color: "var(--color-ink)",
            whiteSpace: "pre-wrap",
            lineHeight: 1.6,
          }}
        >
          {
            "Looking for someone who's negotiated a SAFE conversion in a post-bridge round at YC. Specifically the cap-table mechanics when there are two outstanding notes. Pass this along if it lands — happy to compare notes."
          }
        </p>

        <p
          style={{
            margin: 0,
            color: "var(--color-ink-muted)",
            fontSize: "var(--text-caption)",
            textAlign: "right",
          }}
        >
          213 / 300
        </p>
      </article>

      {/* Prose — what is this. Per ADR-015, no use-case lead. */}
      <section
        style={{
          width: "100%",
          maxWidth: "var(--max-content)",
          fontFamily: "var(--font-mono)",
          color: "var(--color-ink-muted)",
          lineHeight: 1.6,
        }}
      >
        <p style={{ margin: 0, marginBottom: "var(--spacing-4)" }}>
          A wyrd is a short, encrypted message that lives at a URL and dissolves
          when its time is up. You compose. You share the URL through the
          channels you already use. The protocol stays out of the way.
        </p>
        <p style={{ margin: 0, marginBottom: "var(--spacing-4)" }}>
          No accounts. No feed. No archive. Capability over identity. The thing
          you send takes its course.
        </p>
        <p style={{ margin: 0 }}>
          Intent and action over theatrical consensus. Depth over breadth.
        </p>
      </section>

      {/* CTA */}
      <Link
        href="/compose"
        style={{
          padding: "var(--spacing-3) var(--spacing-6)",
          border: "1px solid var(--color-hairline-strong)",
          color: "var(--color-ink)",
          textDecoration: "none",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-body)",
          letterSpacing: "0.02em",
        }}
      >
        Compose a wyrd
      </Link>
      <p
        style={{
          margin: 0,
          color: "var(--color-ink-subtle)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-microcaption)",
          textAlign: "center",
        }}
      >
        no account · no signup · just compose ·{" "}
        <Link
          href="/about"
          style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 2 }}
        >
          why
        </Link>
      </p>
    </main>
  );
}

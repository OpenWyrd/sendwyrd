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
import { InstallAffordance } from "@/components/InstallAffordance";

function SpecimenWyrd({ body, count }: { body: string; count: number }) {
  return (
    <article
      className="landing-specimen"
      style={{ width: "100%", fontFamily: "var(--font-mono)" }}
    >
      <PrivacyIndicator />
      <p
        style={{
          margin: 0,
          paddingTop: "var(--spacing-4)",
          paddingBottom: "var(--spacing-2)",
          color: "var(--color-ink)",
          whiteSpace: "pre-wrap",
          lineHeight: 1.6,
          fontStyle: "italic",
        }}
      >
        {body}
      </p>
      <p
        style={{
          margin: 0,
          color: "var(--color-ink-muted)",
          fontSize: "var(--text-caption)",
          textAlign: "right",
        }}
      >
        {count} / 300
      </p>
    </article>
  );
}

export default function LandingPage() {
  return (
    <main
      className="landing"
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
      <span className="landing-sigil">
        <WyrdSigil
          size={96}
          breathing
          ariaLabel="SendWyrd sigil"
          className=""
        />
      </span>

      {/* Specimens — two real-feeling rendered wyrds, demonstrating the form
          across distinct use cases (per ADR-015, use-case agnostic). */}
      <div
        className="landing-specimens"
        style={{
          width: "100%",
          maxWidth: "var(--max-content)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-5)",
        }}
      >
        <SpecimenWyrd
          body="Anyone worked through a SAFE conversion with bridge notes outstanding? Pass forward if so."
          count={90}
        />
        <SpecimenWyrd
          body="I have 100 cows to sell at XYZ location. Any buyers in the area?"
          count={64}
        />
      </div>

      {/* Prose — what is this. Per ADR-015, no use-case lead. */}
      <section
        className="landing-prose"
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

      <InstallAffordance />
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
          style={{
            color: "inherit",
            textDecoration: "underline",
            textUnderlineOffset: 2,
          }}
        >
          about
        </Link>
      </p>
    </main>
  );
}

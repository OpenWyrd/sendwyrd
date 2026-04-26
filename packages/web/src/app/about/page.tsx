import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About · SendWyrd",
  description:
    "Social message objects you can pass anywhere, across any app or website by sharing a link.",
};

const points: string[] = [
  "Every social media platform has lock-in, and every messaging app limits social shareability. What if instead you had messages which you share with people you think are relevant, and they can pass them forward. Depth over breadth.",
  "6 degrees of separation rule-of-thumb. If you embed a request — “I am such-and-such person, and I want to find people who might be interested in such-and-such project” — and your friends pass that to a person who is more likely than them to know someone like that, and it iterates, can the global social graph become faster to traverse?",
  "If you broker introductions for people, can you have a single object — a digital envelope of sorts — that you hand off to the most relevant person, rather than having to orchestrate the connection chain?",
  "Within the tradeoffs of security and reach, can a useful balance be found with capability links where you rely on human judgement as to whether you trust the graph of people downstream?",
  "Can the inherent absence of public blasting of messages be a way to foster relationships focused on intent and action rather than bloviating theatrically about opinions, as if being “right” via group consensus has any material relevance?",
  "The entire internet has been contorted by dopamine and philosophies of constraints built up over millennia, which weakens the individual — and yet the most powerful force will be found in the most capable human network. Rather than receding from the web, can AI revealing what is inhuman allow us to discover the power of human networks collaborating and accumulating resources to their advantage?",
];

export default function AboutPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding:
          "var(--spacing-20) var(--spacing-6) var(--spacing-24)",
        gap: "var(--spacing-12)",
      }}
    >
      <header
        style={{
          width: "100%",
          maxWidth: "var(--max-content)",
          fontFamily: "var(--font-mono)",
          color: "var(--color-ink)",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-h1)",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            margin: 0,
            marginBottom: "var(--spacing-4)",
          }}
        >
          Hyperlinks for conversation.
        </h1>
        <p
          style={{
            margin: 0,
            color: "var(--color-ink-muted)",
            lineHeight: 1.6,
          }}
        >
          Social message objects you can pass anywhere, across any app or
          website by sharing a link.
        </p>
      </header>

      <ol
        style={{
          width: "100%",
          maxWidth: "var(--max-content)",
          padding: 0,
          margin: 0,
          listStyle: "none",
          fontFamily: "var(--font-mono)",
          color: "var(--color-ink)",
          lineHeight: 1.7,
          counterReset: "about-counter",
        }}
      >
        {points.map((p, i) => (
          <li
            key={i}
            style={{
              counterIncrement: "about-counter",
              padding: "var(--spacing-6) 0",
              borderTop:
                i === 0 ? "none" : "1px solid var(--color-hairline)",
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "var(--spacing-4)",
              alignItems: "baseline",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                color: "var(--color-ink-subtle)",
                fontVariantNumeric: "tabular-nums",
                fontSize: "var(--text-microcaption)",
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <p style={{ margin: 0 }}>{p}</p>
          </li>
        ))}
      </ol>

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
    </main>
  );
}

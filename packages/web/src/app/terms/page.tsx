import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Terms · SendWyrd",
  description: "Terms of use for SendWyrd.",
  robots: { index: false, follow: false },
};

const pStyle: React.CSSProperties = { margin: 0 };
const headingStyle: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--text-h3)",
  fontWeight: 600,
  letterSpacing: "-0.01em",
  margin: 0,
  marginTop: "var(--spacing-6)",
  marginBottom: "var(--spacing-3)",
  color: "var(--color-ink)",
};
const linkStyle: React.CSSProperties = {
  color: "inherit",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};

export default function TermsPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "var(--spacing-8) var(--spacing-6) var(--spacing-24)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--spacing-8)",
      }}
    >
      <Nav />

      <article
        style={{
          width: "100%",
          maxWidth: "var(--max-content)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-caption)",
          lineHeight: 1.7,
          color: "var(--color-ink-muted)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-3)",
        }}
      >
        <header>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--text-h2)",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              margin: 0,
              color: "var(--color-ink)",
            }}
          >
            Terms of use
          </h1>
          <p
            style={{
              ...pStyle,
              marginTop: "var(--spacing-2)",
              fontSize: "var(--text-microcaption)",
              color: "var(--color-ink-subtle)",
            }}
          >
            Last updated: 2026-04-26
          </p>
        </header>

        <p style={pStyle}>
          SendWyrd is operated as a personal project and is provided as-is,
          without warranty of any kind. Use of the service constitutes
          acceptance of these terms.
        </p>

        <h2 style={headingStyle}>1. Lawful use</h2>
        <p style={pStyle}>
          You will not use SendWyrd to publish, transmit, or attempt to transmit
          content that is illegal where you reside or where the recipient
          resides. This includes, without limitation: child sexual abuse
          material; content that incites or facilitates violence or terrorism;
          content covered by export-control or sanctions law; and content that
          violates a third party&apos;s intellectual property rights.
        </p>

        <h2 style={headingStyle}>2. No accounts</h2>
        <p style={pStyle}>
          SendWyrd does not maintain user accounts. You alone hold the seed
          material that authenticates you as the author of any wyrd you publish.
          Lost seed material cannot be recovered, and the operator cannot
          recover, reissue, or transfer your wyrds for you.
        </p>

        <h2 style={headingStyle}>3. Encrypted by design</h2>
        <p style={pStyle}>
          Message bodies are end-to-end encrypted in your browser before they
          leave your device. The operator does not have access to plaintext and
          cannot read the contents of any wyrd. The operator can, in response to
          credible legal process or operational necessity, remove a wyrd&apos;s
          encrypted envelope from storage; doing so renders the wyrd permanently
          unrecoverable.
        </p>

        <h2 style={headingStyle}>4. No expectation of permanence</h2>
        <p style={pStyle}>
          The default time-to-live for a wyrd is finite. Permanent (
          <code>ttl=0</code>) wyrds are best-effort and are not guaranteed
          against operational removal, infrastructure migration, or service
          shutdown. Treat SendWyrd as transport, not as durable storage.
        </p>

        <h2 style={headingStyle}>5. Limitation of liability</h2>
        <p style={pStyle}>
          To the fullest extent permitted by law, the operator&apos;s aggregate
          liability arising from your use of SendWyrd is limited to the amount
          you have paid to use the service, which is zero. The service is
          provided without any express or implied warranty of merchantability,
          fitness for a particular purpose, or non-infringement.
        </p>

        <h2 style={headingStyle}>6. Reports and contact</h2>
        <p style={pStyle}>
          Concerns about content, takedown requests, and legal correspondence
          may be directed to{" "}
          <a
            href="https://x.com/deltaclimbs"
            style={linkStyle}
            rel="noreferrer"
          >
            @deltaclimbs
          </a>
          . Credible reports will be reviewed; the operator reserves the right
          to remove encrypted envelopes from storage at its discretion.
        </p>

        <h2 style={headingStyle}>7. Changes</h2>
        <p style={pStyle}>
          These terms may change. Continued use of the service after a change
          constitutes acceptance of the revised terms.
        </p>

        <p
          style={{
            ...pStyle,
            marginTop: "var(--spacing-6)",
            fontSize: "var(--text-microcaption)",
            color: "var(--color-ink-subtle)",
          }}
        >
          <Link href="/about" style={linkStyle}>
            ← back to about
          </Link>
        </p>
      </article>
    </main>
  );
}

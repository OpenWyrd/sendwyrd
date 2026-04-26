import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "About · SendWyrd",
  description:
    "Social message objects you can pass anywhere, across any app or website by sharing a link.",
};

const points: string[] = [
  "Every social media platform has lock-in, and every messaging app limits social shareability. What if instead you had messages which you share with people you think are relevant, and they can pass them forward? Depth over breadth.",
  "6 degrees of separation rule-of-thumb. If you embed a request — “I am such-and-such person, and I want to find people who might be interested in such-and-such project” — and your friends pass that to a person who is more likely than them to know someone like that, and it iterates, can the global social graph become faster to traverse?",
  "If you broker introductions for people, can you have a single object — a digital envelope of sorts — that you hand off to the most relevant person, rather than having to orchestrate the connection chain?",
  "Within the tradeoffs of security and reach, can a useful balance be found with capability links where you rely on human judgement as to whether you trust the graph of people downstream?",
  "Can the inherent absence of public blasting of messages be a way to foster relationships focused on intent and action rather than bloviating theatrically about opinions, as if being “right” via group consensus has any material relevance?",
  "The entire internet has been contorted by dopamine and philosophies of constraints built up over millennia, which weakens the individual — and yet the most powerful force will be found in the most capable human network. Rather than receding from the web, can AI revealing what is inhuman allow us to discover the power of human networks collaborating and accumulating resources to their advantage?",
];

const pStyle: React.CSSProperties = { margin: 0 };
const ulStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: "var(--spacing-5)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--spacing-3)",
};
const linkStyle: React.CSSProperties = {
  color: "inherit",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};

function Subhead({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: "var(--font-display)",
        fontSize: "var(--text-h3)",
        fontWeight: 600,
        letterSpacing: "-0.01em",
        margin: 0,
        marginBottom: "calc(-1 * var(--spacing-8))",
        paddingBottom: "var(--spacing-3)",
        borderBottom: "1px solid var(--color-hairline)",
      }}
    >
      {children}
    </h2>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-4)",
      }}
    >
      {children}
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "0.95em",
        color: "var(--color-ink-muted)",
      }}
    >
      {children}
    </code>
  );
}

export default function AboutPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding:
          "var(--spacing-12) var(--spacing-6) var(--spacing-24)",
        gap: "var(--spacing-12)",
      }}
    >
      <Nav />
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

      <article
        style={{
          width: "100%",
          maxWidth: "var(--max-content)",
          fontFamily: "var(--font-mono)",
          color: "var(--color-ink)",
          lineHeight: 1.7,
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-12)",
        }}
      >
        <Subhead>How it works</Subhead>

        <Section>
          <p style={pStyle}>
            A wyrd is a 300-codepoint, end-to-end-encrypted text block that
            becomes a shareable URL — a portable, composable, forward-worthy
            conversational artifact that travels through existing messaging
            rails (iMessage, Signal, WhatsApp, Slack, email) rather than a
            native feed or discovery layer.
          </p>
          <p style={pStyle}>The URL takes one canonical form:</p>
          <p
            style={{
              ...pStyle,
              padding: "var(--spacing-3) var(--spacing-4)",
              border: "1px solid var(--color-hairline)",
              color: "var(--color-ink-muted)",
              overflowWrap: "anywhere",
            }}
          >
            https://sendwyrd.com/w/{"{handle}"}#{"{K_read}"}
          </p>
          <p style={pStyle}>
            The handle is in the path; the read key is in the URL fragment.
            Browsers don&apos;t transmit fragments to servers — so the host
            stays body-blind. Anyone holding the URL can read the wyrd;
            whoever you share it with can forward it to whoever they think
            is relevant.
          </p>
          <p style={pStyle}>
            No accounts. No feed. No archive. Default 90-day TTL — pick
            shorter, or none. Brittleness is the architecture, not an
            oversight.
          </p>
          <p style={pStyle}>
            The protocol carries text only. Identity, signing, trust, and
            provenance are either inlined into the body (a name, a Nostr
            signature) or inherited from the share channel — &ldquo;Mike
            sent me this.&rdquo; Trust rides the rail.
          </p>
          <p style={pStyle}>
            One pragmatic recipient-side note: when a wyrd body contains
            an external URL, the renderer asks the host to fetch
            OpenGraph metadata so the link surfaces as a preview card.
            The host sees the URL but not the wyrd it came from. The
            wyrd&apos;s body is still encrypted end-to-end and never
            leaves the recipient&apos;s browser. This is the cypherpunk-
            on-content, pragmatic-on-rendering trade we accept in v1.
          </p>
        </Section>

        <Subhead>Architecture</Subhead>

        <Section>
          <p style={pStyle}>
            The architecture refuses identity. The protocol carries text and
            capability keys; nothing else. No accounts, no usernames, no
            logins, no PKI.
          </p>
          <p style={pStyle}>
            Each wyrd has its own random <Code>K_origin</Code> keypair, derived
            at <Code>m/300&apos;/n&apos;</Code> for an incrementing{" "}
            <Code>n</Code>. Two wyrds composed by the same person produce
            different <Code>K_origin_pub</Code> values. The host cannot tell
            whether two wyrds came from the same author. Counting distinct{" "}
            <Code>K_origin_pub</Code> values equals counting wyrds, not people.
          </p>
          <p style={pStyle}>
            Possession of the URL is access. Forwarding is the default and the
            point. There is no friend graph, no follower list, no broadcast
            surface, no &ldquo;who&rdquo; primitive of any kind.
          </p>
        </Section>

        <Subhead>Cryptography</Subhead>

        <Section>
          <ul style={ulStyle}>
            <li>
              <strong>Body envelope</strong>: AES-256-GCM via the Web Crypto
              API. <Code>K_read</Code> is 32 bytes of CSPRNG, generated
              per-wyrd at compose time.
            </li>
            <li>
              <strong>Author keys</strong>: secp256k1; signatures via BIP-340
              Schnorr (publish, burn). One keypair per wyrd.
            </li>
            <li>
              <strong>Replies</strong>: ECIES — anyone with the URL encrypts a
              reply to <Code>K_origin_pub</Code>; only the author can decrypt.
              One-shot.
            </li>
            <li>
              <strong>Seed</strong>: BIP-39 mnemonic (12 or 24 words). HD path:{" "}
              <Code>m/300&apos;/n&apos;</Code> (BIP-43 flat purpose, hardened
              indices).
            </li>
            <li>
              <strong>Distribution</strong>: <Code>K_read</Code> lives in the
              URL fragment. Browsers do not transmit fragments to servers
              (RFC 3986). The host is body-blind on every request.
            </li>
            <li>
              <strong>AAD binding</strong>: every envelope binds version,
              handle, expiry, and reply-mode into the AES-GCM authenticated
              data. Tampering any field fails decryption.
            </li>
          </ul>
        </Section>

        <Subhead>Brittleness</Subhead>

        <Section>
          <p style={pStyle}>
            <Code>K_read</Code> is per-wyrd random, not derived from your seed.
            If you lose the URL, the body becomes unreadable — even if you
            still hold your mnemonic.
          </p>
          <p style={pStyle}>
            Mnemonic recovery rebuilds your wyrd-handle list and your author
            keys (you can decrypt replies, burn old wyrds, prove authorship)
            but cannot reconstruct <Code>K_read</Code> for sealed wyrds whose
            URLs you&apos;ve lost. The protocol refuses durable archive on
            purpose.
          </p>
          <p style={pStyle}>
            Default TTL is 90 days. Local storage may evict. Mnemonic backup is
            the only recovery path the protocol offers — and even that
            recovers identity, not content. Nietzschean: content fits a moment,
            then is gone.
          </p>
        </Section>

        <Subhead>Authorship attestations</Subhead>

        <Section>
          <p style={pStyle}>
            Each wyrd has its own random <Code>K_origin</Code> keypair, so
            two wyrds by the same person sign with different keys. That is
            what keeps the host blind to authorship — and it also means
            authorship can&apos;t be proven by reusing one signing key.
          </p>
          <p style={pStyle}>
            If the question of authorship comes up after the fact, the
            author can publish an attestation wyrd: a small structured
            body whose Schnorr signature is produced by the original
            wyrd&apos;s <Code>K_origin_priv</Code> (re-derived from the
            seed at the original index). Anyone fetches the original
            wyrd&apos;s <Code>K_origin_pub</Code> from the host and
            verifies. The chain holds without storing any persistent
            identity — the seed is the proof.
          </p>
          <p style={pStyle}>
            This sits outside the main flow on purpose. Most wyrds never
            need attestation; the protocol is forwarding-by-default, and
            stable provenance is a heavy thing to add to a forwardable
            artifact. The mechanism is here when it&apos;s the right
            tool, not pushed into routine composition.
          </p>
        </Section>

        <Subhead>Why not Nostr</Subhead>

        <Section>
          <p style={pStyle}>
            Nostr is identity-first. Each user has a stable{" "}
            <Code>npub</Code>/<Code>nsec</Code> keypair. Events are signed by
            that stable key, posted to relays, aggregated by clients into
            feeds. Most events are public broadcasts.
          </p>
          <p style={pStyle}>
            SendWyrd makes the opposite call. No stable per-user key — per-wyrd
            random <Code>K_origin</Code>. No public broadcast — the URL is the
            only path. The host stays blind. The protocol refuses durable
            archive.
          </p>
          <p style={pStyle}>
            The two solve different problems. Nostr optimizes for{" "}
            <em>censorship-resistant public broadcasting</em> — important.
            SendWyrd optimizes for{" "}
            <em>host-blind ephemeral handoff through trust networks</em> — a
            different problem in the same neighborhood. They compose. A wyrd
            body can carry a signed Nostr event — the recipient verifies the
            signature against an <Code>npub</Code>, and SendWyrd is just
            transport for an attestation that already stands on its own.
            Alternatively, the wyrd URL is forwarded by a trusted identity
            source — a Nostr key, a domain, a known account — that signs the
            act of sending. Either way, the attestation lives outside the
            protocol. SendWyrd doesn&apos;t model identity; it composes with
            whatever attestation layer the participants choose to bring.
          </p>
          <p style={pStyle}>
            The deepest difference is the archive. Nostr accumulates an
            indelible signed event log per identity (a feature for some uses;
            an anti-feature for opinion-publishing-as-identity-building).
            SendWyrd refuses the archive on purpose.
          </p>
        </Section>

        <Subhead>Stack</Subhead>

        <Section>
          <ul style={ulStyle}>
            <li>
              <strong>Web</strong>: Next.js on Cloudflare Workers (OpenNext);
              installable PWA.
            </li>
            <li>
              <strong>API</strong>: Hono on Cloudflare Workers.
            </li>
            <li>
              <strong>Database</strong>: Neon Postgres. Stores encrypted
              envelopes only; no plaintext anywhere on the host.
            </li>
            <li>
              <strong>API / build on this</strong>:{" "}
              <a href="/build" style={linkStyle}>
                /build
              </a>
              .
            </li>
            <li>
              <strong>By</strong>:{" "}
              <a
                href="https://x.com/deltaclimbs"
                style={linkStyle}
                rel="noreferrer"
              >
                @deltaclimbs
              </a>
              .
            </li>
          </ul>
        </Section>
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
          letterSpacing: "0.02em",
        }}
      >
        Compose a wyrd
      </Link>
    </main>
  );
}

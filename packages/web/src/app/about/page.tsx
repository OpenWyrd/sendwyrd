import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { PrivacyIndicator } from "@/components/PrivacyIndicator";

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

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="about-section" open={defaultOpen}>
      <summary className="about-section-summary">
        <span className="about-section-chevron" aria-hidden="true">
          ›
        </span>
        <span>{title}</span>
      </summary>
      <div className="about-section-body">{children}</div>
    </details>
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

function SpecimenWyrd({ body, count }: { body: string; count: number }) {
  return (
    <article
      style={{
        fontFamily: "var(--font-mono)",
        padding: "var(--spacing-3) var(--spacing-4)",
        border: "1px solid var(--color-hairline)",
      }}
    >
      <PrivacyIndicator />
      <p
        style={{
          margin: 0,
          paddingTop: "var(--spacing-3)",
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

export default function AboutPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "var(--spacing-12) var(--spacing-6) var(--spacing-24)",
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
          Hyperlinks for conversational objects.
        </h1>
        <p
          style={{
            margin: 0,
            color: "var(--color-ink-muted)",
            lineHeight: 1.6,
          }}
        >
          Social message objects you can pass anywhere, across any app or
          website by sharing a link. The conversation that emerges around them
          is up to the people passing them along.
        </p>
      </header>

      <div
        style={{
          width: "100%",
          maxWidth: "var(--max-content)",
          fontFamily: "var(--font-mono)",
          color: "var(--color-ink)",
          lineHeight: 1.7,
        }}
      >
        <CollapsibleSection title="Example Wyrds">
          <p style={pStyle}>
            A wyrd is a tweet-length introduction for whatever the sender wants
            to pass forward — a question, an artifact, a signal, a connection.
            The same shape carries many kinds of weight.
          </p>
          <SpecimenWyrd
            body={
              "Two sources flagging a serious supply disruption by Q3. Nothing public yet. Pass quietly to anyone who'd want time to think before the cycle catches up."
            }
            count={154}
          />
          <SpecimenWyrd
            body={
              "Looking for a staff systems engineer who's shipped at scale. Two-person team, post-revenue, intentionally quiet. Forward if a name comes to mind."
            }
            count={150}
          />
          <SpecimenWyrd
            body={
              "Have 20 cows to sell near Nairobi. Contact Alex at +254 660-540-7701 over WhatsApp if interested."
            }
            count={96}
          />
          <SpecimenWyrd
            body={
              "In Tokyo Apr 30 – May 3. Pass to anyone here worth knowing — happy to be pointed in interesting directions."
            }
            count={108}
          />
          <p style={pStyle}>
            None of these need a paragraph of explanation when shared. The wyrd
            is the introduction. As that pattern normalizes, a wyrd URL
            appearing in an iMessage or a DM becomes recognizable on sight as a
            high-signal object — passed by someone who thought it was worth your
            time.
          </p>
        </CollapsibleSection>

        <CollapsibleSection title="How it works">
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
            https://sendwyrd.com/w/{"{object_handle}"}#{"{K_read}"}
          </p>
          <p style={pStyle}>
            The object handle (a per-wyrd random identifier — not a user handle)
            is in the path; the read key is in the URL fragment. Browsers
            don&apos;t transmit fragments to servers — so the host stays
            body-blind. Anyone holding the URL can read the wyrd; whoever you
            share it with can forward it to whoever they think is relevant.
          </p>
          <p style={pStyle}>
            No accounts. No feed. No archive. Default 90-day TTL — pick shorter,
            or none. Mosaic quality is the architecture, not an oversight.
          </p>
          <p style={pStyle}>
            The protocol carries text only. Identity, signing, trust, and
            provenance are either inlined into the body (a name, a Nostr
            signature) or inherited from the share channel — &ldquo;a friend
            sent me this.&rdquo; Trust rides the rail.
          </p>
          <p style={pStyle}>
            One pragmatic recipient-side note: when a wyrd body contains an
            external URL, the renderer asks the host to fetch OpenGraph metadata
            so the link surfaces as a preview card. The host sees the URL but
            not the wyrd it came from. The wyrd&apos;s body is still encrypted
            end-to-end and never leaves the recipient&apos;s browser. This is
            the cypherpunk- on-content, pragmatic-on-rendering trade we accept
            in v1.
          </p>
        </CollapsibleSection>

        <CollapsibleSection title="Motivation">
          <ol
            style={{
              padding: 0,
              margin: 0,
              listStyle: "none",
              counterReset: "about-counter",
            }}
          >
            {points.map((p, i) => (
              <li
                key={i}
                style={{
                  counterIncrement: "about-counter",
                  padding: "var(--spacing-5) 0",
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
        </CollapsibleSection>

        <CollapsibleSection title="Architecture">
          <p style={pStyle}>
            The architecture refuses identity. The protocol carries text and
            capability keys; nothing else. No accounts, no usernames, no logins,
            no PKI.
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
        </CollapsibleSection>

        <CollapsibleSection title="Cryptography">
          <ul style={ulStyle}>
            <li>
              <strong>Body envelope</strong>: AES-256-GCM via the Web Crypto
              API. <Code>K_read</Code> is 32 bytes derived from your seed via
              HKDF-SHA256 at compose time, one fresh subkey per wyrd index.
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
              URL fragment. Browsers do not transmit fragments to servers (RFC
              3986). The host is body-blind on every request.
            </li>
            <li>
              <strong>AAD binding</strong>: every envelope binds version,
              handle, expiry, and reply-mode into the AES-GCM authenticated
              data. Tampering any field fails decryption.
            </li>
          </ul>
        </CollapsibleSection>

        <CollapsibleSection title="Mosaic Mesh Quality">
          <p style={pStyle}>
            SendWyrd is a <strong>mosaic mesh network</strong>. Mesh: each wyrd
            hops across whatever platforms people already use — iMessage to
            Twitter DM to Slack to email — routed by human judgement, not
            algorithms. Mosaic: each wyrd is a tile, independently meaningful;
            lost tiles leave gaps but don&apos;t break the wyrds that remain.
            SendWyrd doesn&apos;t own a network and refuses an archive that
            would hold the whole picture; the assembly lives in the social graph
            itself.
          </p>
          <p style={pStyle}>
            <Code>K_read</Code> is HKDF-derived from your seed at the
            wyrd&apos;s index. The URL fragment still carries it — recipients
            don&apos;t need your seed — but mnemonic recovery reconstructs full
            share URLs for every wyrd you&apos;ve authored, not just the
            metadata.
          </p>
          <p style={pStyle}>
            Forward secrecy is enforced by deletion, not by key loss: the
            default TTL is 90 days, and burn drops the ciphertext from the
            relay. Once the relay no longer holds the bytes, no key can decrypt
            them. The mosaic stays mosaic — wyrds fit a moment, then are gone.
          </p>
        </CollapsibleSection>

        <CollapsibleSection title="Authorship attestations">
          <p style={pStyle}>
            Each wyrd has its own random <Code>K_origin</Code> keypair, so two
            wyrds by the same person sign with different keys. That is what
            keeps the host blind to authorship — and it also means authorship
            can&apos;t be proven by reusing one signing key.
          </p>
          <p style={pStyle}>
            To prove authorship after the fact, open{" "}
            <a href="/wyrds" style={linkStyle}>
              /wyrds
            </a>
            , find the wyrd, and tap <strong>attest authorship</strong>.
            SendWyrd re-derives that wyrd&apos;s <Code>K_origin_priv</Code> from
            your seed at the original index, signs a canonical message bound to
            the target handle, and publishes a new permanent wyrd whose body is
            the three-line attestation:
          </p>
          <p
            style={{
              ...pStyle,
              padding: "var(--spacing-3) var(--spacing-4)",
              border: "1px solid var(--color-hairline)",
              color: "var(--color-ink-muted)",
              whiteSpace: "pre",
              overflowX: "auto",
            }}
          >
            {`sendwyrd-attestation/v1
target=<object_handle>
sig=<base64url-signature>`}
          </p>
          <p style={pStyle}>
            Share the attestation URL alongside the original. A renderer opening
            the attestation fetches the original&apos;s{" "}
            <Code>K_origin_pub</Code> from the host and verifies the signature,
            surfacing a verification banner. No persistent identity is stored on
            either side — the seed is the only thing that has to survive.
          </p>
          <p style={pStyle}>
            Most wyrds never need an attestation; forwarding-by-default is the
            norm and stable provenance is a heavy thing to bind to a forwardable
            artifact. The mechanism exists for the case where it&apos;s the
            right tool, not for routine composition.
          </p>
        </CollapsibleSection>

        <CollapsibleSection title="Bitcoin & Lightning">
          <p style={pStyle}>
            SendWyrd is a relay primitive. It does not handle payments, mint
            invoices, custody funds, resolve LNURL endpoints, or run any payment
            infrastructure. Wallets handle payment; SendWyrd hands off.
          </p>
          <p style={pStyle}>
            When a wyrd body contains a payment token, the renderer detects it
            client-side on the decrypted text and excludes it from the
            300-codepoint cap (same treatment as URLs — the cap is for prose,
            not addresses). Detected forms:
          </p>
          <ul style={ulStyle}>
            <li>
              <strong>Lightning</strong>: BOLT11 invoices, BOLT12 offers /
              invoices / invoice-requests, bare LNURL, and the{" "}
              <Code>lightning:</Code> URI scheme. Lightning addresses (
              <Code>user@domain</Code>) are auto-detected when the domain is on
              a small allowlist of well-known providers; off-list addresses opt
              in by prefixing with <Code>lightning:</Code>. Bare email-format
              strings on off-list domains stay text — no false positives on
              normal correspondence.
            </li>
            <li>
              <strong>Bitcoin</strong>: native segwit and taproot bech32 /
              bech32m (<Code>bc1</Code> / <Code>tb1</Code> / <Code>bcrt1</Code>
              ), legacy P2PKH / P2SH, and the <Code>bitcoin:</Code> URI scheme
              (BIP-21).
            </li>
          </ul>
          <p style={pStyle}>
            Detected tokens render as labelled inline chips with an OS-handler
            link (<Code>bitcoin:</Code> / <Code>lightning:</Code>) and a copy
            button. Click expands an inline QR code rendered fully in the
            recipient&apos;s browser — no external requests, no third-party QR
            service, the host never sees the content. The QR is just bytes
            painted from a string the recipient already has.
          </p>
          <p style={pStyle}>
            From there, the user&apos;s wallet takes over via the
            <Code> bitcoin:</Code> / <Code>lightning:</Code> URI handoff at the
            OS level. SendWyrd never bridges, never connects, never settles.
          </p>
        </CollapsibleSection>

        <CollapsibleSection title="Nostr comparison and compatibility">
          <p style={pStyle}>
            SendWyrd and Nostr solve different problems in the same
            neighborhood. Many people will want both.
          </p>
          <p style={pStyle}>
            Nostr is identity-first. Each user has a stable <Code>npub</Code>/
            <Code>nsec</Code> keypair. Events are signed by that stable key,
            posted to relays, aggregated by clients into feeds. The dominant
            mode is public broadcast against a durable, signed event log per
            identity. Nostr is built for{" "}
            <em>censorship-resistant public speech under stable identity</em>.
          </p>
          <p style={pStyle}>
            SendWyrd is capability-first. The URL is the access primitive; the
            handle is per-wyrd random, addressed by capability rather than
            pubkey. Each wyrd gets its own <Code>K_origin</Code> — two wyrds by
            the same author look unlinked to the host. There is no relay-side
            feed and no aggregation surface; the relay only resolves a handle to
            an encrypted envelope. SendWyrd is built for{" "}
            <em>host-blind ephemeral handoff through trust networks</em>.
          </p>
          <p style={pStyle}>Concretely:</p>
          <ul style={ulStyle}>
            <li>
              <strong>Addressing</strong>: Nostr — pubkey-addressed signed
              events. SendWyrd — capability-URL-addressed encrypted envelopes.
            </li>
            <li>
              <strong>Identity</strong>: Nostr — stable <Code>npub</Code> per
              person. SendWyrd — fresh per-wyrd <Code>K_origin</Code>;
              unlinkable at the relay.
            </li>
            <li>
              <strong>Distribution</strong>: Nostr — relay aggregation, client
              feeds. SendWyrd — out-of-band forwarding through whatever rails
              people already use.
            </li>
            <li>
              <strong>Persistence</strong>: Nostr — durable signed event log.
              SendWyrd — TTL-bounded ciphertext, default 90 days, burnable.
            </li>
          </ul>
          <p style={pStyle}>
            The two compose. A wyrd body can carry a signed Nostr event — the
            recipient verifies the signature against an <Code>npub</Code>, and
            SendWyrd is just transport for an attestation that already stands on
            its own. Alternatively, the wyrd URL is forwarded by a trusted Nostr
            identity that signs the act of sending. SendWyrd doesn&apos;t model
            identity; it composes with whatever attestation layer the
            participants choose to bring.
          </p>
        </CollapsibleSection>

        <CollapsibleSection title="Stack">
          <ul style={ulStyle}>
            <li>
              <strong>Protocol</strong>: OpenWyrd MOP. SendWyrd is the canonical
              reference implementation; the wire spec is open and independently
              implementable. Spec at{" "}
              <a
                href="https://openwyrd.org/spec"
                style={linkStyle}
                rel="noreferrer"
              >
                openwyrd.org/spec
              </a>
              ; project home at{" "}
              <a href="https://openwyrd.org" style={linkStyle} rel="noreferrer">
                openwyrd.org
              </a>
              .
            </li>
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
        </CollapsibleSection>

        <CollapsibleSection title="Reading & Music Recs">
          <ul style={ulStyle}>
            <li>
              <em>The Dawn of Day</em> — Friedrich Nietzsche.
            </li>
            <li>Symphony No. 8 — Anton Bruckner.</li>
          </ul>
        </CollapsibleSection>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: "var(--max-content)",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <Link
          href="/compose"
          style={{
            padding: "var(--spacing-4) var(--spacing-8)",
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
      </div>

      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-microcaption)",
          color: "var(--color-ink-subtle)",
          letterSpacing: "0.02em",
        }}
      >
        <Link
          href="/terms"
          style={{ color: "inherit", textDecoration: "none" }}
        >
          terms
        </Link>
      </p>
    </main>
  );
}

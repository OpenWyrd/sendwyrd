import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Build · SendWyrd",
  description:
    "Building on SendWyrd — REST API, wire spec, reference implementation, agent-friendly notes.",
};

export default function BuildPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "var(--spacing-20) var(--spacing-6) var(--spacing-24)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
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
          Building on SendWyrd.
        </h1>
        <p
          style={{
            margin: 0,
            color: "var(--color-ink-muted)",
            lineHeight: 1.6,
          }}
        >
          A protocol with a public REST API. No accounts, no API keys, no
          gatekeepers. Sign your own wyrds; the host stays blind.
        </p>
      </header>

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
        <Section title="What ships today">
          <ul style={ulStyle}>
            <li>
              <strong>REST API</strong> at <Code>sendwyrd.com/api/v1/*</Code> —
              publish, fetch, burn, replies, presence-check. No auth tokens;
              per-wyrd Schnorr signatures gate destructive ops.
            </li>
            <li>
              <strong>Wire spec</strong> — byte-for-byte description of every
              endpoint, envelope layout, signed payload, and error code.
              Currently at v1.0.4-draft. Available on request while the
              implementation repo stays private; reach out to{" "}
              <a
                href="https://x.com/deltaclimbs"
                style={linkStyle}
                rel="noreferrer"
              >
                @deltaclimbs
              </a>
              .
            </li>
            <li>
              <strong>Reference TS package</strong> <Code>@sendwyrd/core</Code>{" "}
              — compose/decrypt envelope, HD derivation, URL parsing, ECIES
              replies, Schnorr sign/verify. On npm. Install with{" "}
              <Code>pnpm add @sendwyrd/core</Code>. v0.1.x unstable; semver
              discipline from v1.0.0.
            </li>
            <li>
              <strong>MCP server</strong> — <Code>@sendwyrd/mcp</Code> on npm,
              stdio, exposes the wyrd verbs to MCP-capable clients (Claude Code,
              Claude Desktop, Cursor, Zed). Install with{" "}
              <Code>npx -y @sendwyrd/mcp</Code>.
            </li>
          </ul>
        </Section>

        <Section title="For builders">
          <p style={pStyle}>
            The wire is plain HTTP + JSON. No accounts, no API keys. Every
            destructive operation is gated by a per-wyrd Schnorr signature from{" "}
            <Code>K_origin_priv</Code>; every read is open to anyone holding the
            URL fragment containing <Code>K_read</Code>.
          </p>
          <p style={pStyle}>
            To publish: derive a <Code>K_origin</Code> keypair, generate a
            random 32-byte <Code>K_read</Code>, AES-256-GCM-encrypt the body
            with the AAD bound to handle/expiry/reply-mode, Schnorr-sign the
            <Code>publish_message</Code>, POST. The reference TS module shows
            the full pipeline in ~50 lines.
          </p>
          <p style={pStyle}>
            <strong>If you&apos;re in JS/TS</strong>: install{" "}
            <Code>@sendwyrd/core</Code> from npm. It exports{" "}
            <Code>composeWyrd</Code>, <Code>decryptFromBase64Url</Code>,{" "}
            <Code>deriveOriginKey</Code>, <Code>buildFragmentUrl</Code>, and{" "}
            <Code>parseWyrdUrl</Code>. The package is unstable below v1.0.0; pin
            if you depend on it.
          </p>
          <p style={pStyle}>
            <strong>If you&apos;re in another language</strong>: the spec is
            implementable from primitives in any language with secp256k1 +
            BIP-32 + AES-256-GCM. The Schnorr signatures are BIP-340; the HD
            derivation is BIP-32 hardened; the seed format is BIP-39. All
            standard.
          </p>
        </Section>

        <Section title="For agents">
          <p style={pStyle}>
            An agent is just a client. There is no &ldquo;agent&rdquo; primitive
            in the protocol — agents publish wyrds with their own seeds, derive
            their own per-wyrd <Code>K_origin</Code> keys, and are
            indistinguishable from any other composer at the wire. This is by
            design: identity is not the protocol&apos;s concern.
          </p>
          <p style={pStyle}>
            If your agent runs in an MCP-capable client, the official server is
            the path of least resistance. <Code>@sendwyrd/mcp</Code> ships 13
            verbs over stdio: <Code>compose</Code> / <Code>view</Code> /{" "}
            <Code>burn</Code> / <Code>reply</Code> / <Code>attest</Code> as the
            wyrd verbs, <Code>init</Code> / <Code>unlock</Code> /{" "}
            <Code>lock</Code> / <Code>forget</Code> / <Code>status</Code> for
            seed lifecycle, <Code>history</Code> / <Code>inbox</Code> /{" "}
            <Code>recover</Code> for local state. Drop the snippet below into{" "}
            <Code>~/.claude.json</Code> (or the equivalent config for Claude
            Desktop, Cursor, Zed) and the tools appear in the model&apos;s tool
            list on restart.
          </p>
          <pre style={preStyle}>
            {`{
  "mcpServers": {
    "sendwyrd": {
      "command": "npx",
      "args": ["-y", "@sendwyrd/mcp"]
    }
  }
}`}
          </pre>
          <p style={pStyle}>
            Verbs only. No subscriptions, no polling tools, no auto-reply — that
            would push SendWyrd toward the conversation-hosting layer it was
            designed to refuse.
          </p>
          <p style={pStyle}>What&apos;s natively well-suited to agents:</p>
          <ul style={ulStyle}>
            <li>
              Composing intro requests and routing them through trust networks
              (the use case in the manifesto).
            </li>
            <li>
              Reading shared URLs an agent receives from a human (or another
              agent) and acting on the body.
            </li>
            <li>
              Serving as the back-channel for replies: an agent can hold its
              <Code>K_origin_priv</Code> and accept ECIES replies routed through
              the wyrd&apos;s URL.
            </li>
            <li>
              Inter-agent capability handoff: pass a wyrd URL between agents the
              same way you&apos;d pass it between humans.
            </li>
          </ul>
          <p style={pStyle}>
            What&apos;s deliberately NOT supported: long-lived agent identities,
            account/key rotation tracking, or any host-side primitive that lets
            one agent enumerate another agent&apos;s wyrds. The protocol&apos;s
            mosaic quality applies to agents the same as humans.
          </p>
        </Section>

        <Section title="Endpoints">
          <ul style={ulStyle}>
            <li>
              <Code>POST /api/v1/wyrds</Code> — publish a wyrd
            </li>
            <li>
              <Code>GET /api/v1/wyrds/{"{object_handle}"}</Code> — fetch the
              encrypted envelope (decrypt client-side with <Code>K_read</Code>)
            </li>
            <li>
              <Code>DELETE /api/v1/wyrds/{"{object_handle}"}</Code> — burn
              (Schnorr-signed)
            </li>
            <li>
              <Code>POST /api/v1/wyrds/{"{object_handle}"}/replies</Code> —
              submit a reply (ECIES-encrypted to <Code>K_origin_pub</Code>)
            </li>
            <li>
              <Code>GET /api/v1/wyrds/{"{object_handle}"}/replies</Code> — fetch
              replies (Schnorr-signed query)
            </li>
            <li>
              <Code>GET /api/v1/authors/{"{K_origin_pub_b64u}"}/handles</Code> —
              presence-check for HD recovery sweep
            </li>
            <li>
              <Code>GET /api/v1/health</Code> — liveness probe
            </li>
          </ul>
          <p style={pStyle}>
            Every endpoint returns JSON. Every binary value is base64url without
            padding. Every error has a structured code (see spec §17).
          </p>
        </Section>

        <Section title="Roadmap">
          <p style={pStyle}>
            What&apos;s deliberately deferred (with no current ETA):
          </p>
          <ul style={ulStyle}>
            <li>
              <strong>OpenAPI / JSON Schema</strong> generated from the wire
              spec for cross-language client codegen.
            </li>
            <li>
              <strong>Python client SDK</strong> for the AI/agent ecosystem.
            </li>
          </ul>
          <p style={pStyle}>
            Anti-roadmap (will not ship; would violate VISION):
          </p>
          <ul style={ulStyle}>
            <li>
              Server-side compose endpoint that takes plaintext (host-blindness
              violation).
            </li>
            <li>
              API keys, accounts, agent identities (capability-over-identity
              violation).
            </li>
            <li>
              Webhooks / push notifications (ADR-010: zero notification
              primitive at the protocol layer).
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
const preStyle: React.CSSProperties = {
  margin: 0,
  padding: "var(--spacing-4)",
  border: "1px solid var(--color-hairline)",
  fontFamily: "var(--font-mono)",
  fontSize: "0.9em",
  color: "var(--color-ink-muted)",
  overflowX: "auto",
  whiteSpace: "pre",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-4)",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-h3)",
          fontWeight: 600,
          letterSpacing: "-0.01em",
          margin: 0,
          paddingBottom: "var(--spacing-3)",
          borderBottom: "1px solid var(--color-hairline)",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
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

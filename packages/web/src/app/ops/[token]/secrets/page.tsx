import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { setSecretAction } from "./actions";

/**
 * /ops/[token]/secrets — set a Cloudflare Worker secret without leaving
 * the browser. Same capability-URL gate as the dashboard (URL token
 * validated server-side against OPS_DASH_SECRET).
 *
 * Workflow: pick worker (web or api), enter the secret name (uppercase
 * convention), paste the value, hit Set. The server action calls
 * Cloudflare's API directly — no chat round-trip.
 */

export const metadata: Metadata = {
  title: "Set secret · Ops · SendWyrd",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function SecretsPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{
    status?: string;
    msg?: string;
    name?: string;
    worker?: string;
  }>;
}) {
  const { token } = await params;
  const expected = process.env.OPS_DASH_SECRET ?? "";

  if (!expected || token.length !== expected.length || token !== expected) {
    notFound();
  }

  const sp = await searchParams;
  const banner =
    sp.status === "success"
      ? {
          ok: true as const,
          text: `set ${sp.name ?? ""} on ${sp.worker ?? ""}`,
        }
      : sp.status === "error"
        ? { ok: false as const, text: sp.msg ?? "error" }
        : null;

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "var(--spacing-12) var(--spacing-6) var(--spacing-24)",
        fontFamily: "var(--font-mono)",
        color: "var(--color-ink)",
        maxWidth: "var(--max-content)",
        margin: "0 auto",
      }}
    >
      <header
        style={{
          paddingBottom: "var(--spacing-3)",
          borderBottom: "1px solid var(--color-hairline)",
          marginBottom: "var(--spacing-8)",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-h2)",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            margin: 0,
          }}
        >
          set secret
        </h1>
        <Link
          href={`/ops/${token}`}
          style={{
            color: "var(--color-ink-subtle)",
            textDecoration: "underline",
            textUnderlineOffset: 2,
            fontSize: "var(--text-microcaption)",
          }}
        >
          ← ops
        </Link>
      </header>

      {banner && (
        <div
          style={{
            padding: "var(--spacing-3) var(--spacing-4)",
            border: `1px solid ${banner.ok ? "var(--color-mark-sealed)" : "var(--color-danger)"}`,
            color: banner.ok ? "var(--color-mark-sealed)" : "var(--color-danger)",
            fontSize: "var(--text-caption)",
            marginBottom: "var(--spacing-6)",
            overflowWrap: "anywhere",
          }}
          role={banner.ok ? "status" : "alert"}
        >
          {banner.ok ? "✓ " : "✗ "}
          {banner.text}
        </div>
      )}

      <form
        action={setSecretAction}
        autoComplete="off"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-5)",
        }}
      >
        <input type="hidden" name="token" value={token} />

        <Field label="worker">
          <select
            name="worker"
            defaultValue="sendwyrd-web"
            required
            style={inputStyle}
          >
            <option value="sendwyrd-web">sendwyrd-web</option>
            <option value="sendwyrd-api">sendwyrd-api</option>
          </select>
        </Field>

        <Field
          label="name"
          hint="UPPER_SNAKE_CASE, starts with a letter, A–Z + 0–9 + _"
        >
          <input
            type="text"
            name="name"
            required
            placeholder="MY_SECRET_NAME"
            spellCheck={false}
            autoCapitalize="characters"
            pattern="^[A-Z][A-Z0-9_]{0,63}$"
            style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
          />
        </Field>

        <Field
          label="value"
          hint="never shown back. POSTs server-side, then sets via wrangler."
        >
          <input
            type="password"
            name="value"
            required
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="new-password"
            style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
          />
        </Field>

        <button
          type="submit"
          style={{
            padding: "var(--spacing-3) var(--spacing-6)",
            border: "1px solid var(--color-hairline-strong)",
            background: "transparent",
            color: "var(--color-ink)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-body)",
            letterSpacing: "0.02em",
            cursor: "pointer",
            alignSelf: "flex-start",
            marginTop: "var(--spacing-3)",
          }}
        >
          Set secret
        </button>
      </form>

      <section style={{ marginTop: "var(--spacing-12)" }}>
        <h2
          style={{
            fontSize: "var(--text-microcaption)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--color-ink-subtle)",
            margin: 0,
            marginBottom: "var(--spacing-3)",
          }}
        >
          notes
        </h2>
        <ul
          style={{
            margin: 0,
            paddingLeft: "var(--spacing-5)",
            color: "var(--color-ink-muted)",
            fontSize: "var(--text-caption)",
            lineHeight: 1.7,
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-2)",
          }}
        >
          <li>
            Sets a runtime worker secret via the Cloudflare API (equivalent
            to <code>wrangler secret put</code>).
          </li>
          <li>
            Build-time env vars (<code>NEXT_PUBLIC_*</code>) are NOT settable
            here — those live as GitHub Actions secrets and need a workflow
            re-run to take effect. Set those via{" "}
            <code>gh secret set</code> from a shell.
          </li>
          <li>
            Setting a secret takes effect on the next request the worker
            handles (no redeploy needed).
          </li>
        </ul>
      </section>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-2)",
        fontFamily: "var(--font-mono)",
      }}
    >
      <span
        style={{
          fontSize: "var(--text-microcaption)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--color-ink-subtle)",
        }}
      >
        {label}
      </span>
      {children}
      {hint && (
        <span
          style={{
            fontSize: "var(--text-microcaption)",
            color: "var(--color-ink-subtle)",
          }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "var(--spacing-3) var(--spacing-4)",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid var(--color-hairline-strong)",
  color: "var(--color-ink)",
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-body)",
  outline: "none",
  width: "100%",
};

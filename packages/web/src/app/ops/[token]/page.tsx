import { notFound } from "next/navigation";
import type { Metadata } from "next";

/**
 * /ops/[token] — Operational dashboard.
 *
 * Capability-URL gated: the URL fragment after /ops/ is the capability.
 * Validated server-side against OPS_DASH_SECRET in the worker env.
 * Anyone with the URL sees the dashboard; the token isn't a per-user
 * credential. Treat the URL like the SendWyrd model — share with intent.
 *
 * Server-renders, no client JS, auto-refresh via meta tag.
 * Pulls live data from Sentry's REST API (token in worker env, never
 * exposed to clients).
 */

export const metadata: Metadata = {
  title: "Ops · SendWyrd",
  description: "Operational dashboard.",
  robots: { index: false, follow: false },
};

// Always render at request time; no caching.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SENTRY_ORG = "sendwyrd";
const PROJECTS = ["sendwyrd-web", "sendwyrd-api"] as const;
const SITE_ORIGIN = "https://sendwyrd.com";

interface SentryIssue {
  id: string;
  title: string;
  level: string;
  count: string;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  permalink: string;
  status: string;
  project?: string;
}

interface HealthResult {
  ok: boolean;
  ms: number;
  detail?: string;
}

async function checkHealth(url: string): Promise<HealthResult> {
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const ms = Date.now() - t0;
    return { ok: r.ok, ms, detail: `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, detail: (e as Error).message };
  }
}

async function fetchIssues(
  project: string,
  token: string,
): Promise<{ issues: SentryIssue[]; error?: string }> {
  try {
    const url = `https://sentry.io/api/0/projects/${SENTRY_ORG}/${project}/issues/?statsPeriod=24h&limit=10&query=is:unresolved&sort=date`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      return { issues: [], error: `HTTP ${r.status}` };
    }
    const data = (await r.json()) as SentryIssue[];
    return { issues: data.map((i) => ({ ...i, project })) };
  } catch (e) {
    return { issues: [], error: (e as Error).message };
  }
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function levelColor(level: string): string {
  switch (level) {
    case "fatal":
    case "error":
      return "var(--color-danger)";
    case "warning":
      return "var(--color-mark-sealed)";
    default:
      return "var(--color-ink-subtle)";
  }
}

export default async function OpsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const expected = process.env.OPS_DASH_SECRET || "";
  const sentryToken = process.env.SENTRY_AUTH_TOKEN || "";

  // Capability gate. Constant-time-ish comparison via length pre-check.
  if (
    !expected ||
    token.length !== expected.length ||
    token !== expected
  ) {
    notFound();
  }

  // Parallel fetch: health + per-project issues.
  const [apiHealth, webHealth, ...projectResults] = await Promise.all([
    checkHealth(`${SITE_ORIGIN}/api/v1/health`),
    checkHealth(`${SITE_ORIGIN}/`),
    ...PROJECTS.map((p) =>
      sentryToken
        ? fetchIssues(p, sentryToken)
        : Promise.resolve({ issues: [], error: "no token" }),
    ),
  ]);

  const allIssues = projectResults
    .flatMap((r) => r.issues)
    .sort(
      (a, b) =>
        new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime(),
    )
    .slice(0, 15);

  const release = process.env.NEXT_PUBLIC_RELEASE || "unknown";
  const renderedAt = new Date().toISOString();

  return (
    <>
      <meta httpEquiv="refresh" content="30" />
      <main
        style={{
          minHeight: "100vh",
          padding:
            "var(--spacing-12) var(--spacing-6) var(--spacing-24)",
          fontFamily: "var(--font-mono)",
          color: "var(--color-ink)",
          maxWidth: "var(--max-list)",
          margin: "0 auto",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            paddingBottom: "var(--spacing-3)",
            borderBottom: "1px solid var(--color-hairline)",
            marginBottom: "var(--spacing-8)",
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
            ops
          </h1>
          <span
            style={{
              fontSize: "var(--text-microcaption)",
              color: "var(--color-ink-subtle)",
            }}
          >
            {renderedAt} · refreshes 30s
          </span>
        </header>

        {/* Health */}
        <Section title="health">
          <Row
            label="api"
            value={`${apiHealth.detail} · ${apiHealth.ms}ms`}
            ok={apiHealth.ok}
          />
          <Row
            label="web"
            value={`${webHealth.detail} · ${webHealth.ms}ms`}
            ok={webHealth.ok}
          />
        </Section>

        {/* Sentry summary */}
        <Section title="sentry · last 24h · unresolved">
          {PROJECTS.map((p, i) => {
            const r = projectResults[i] ?? { issues: [], error: "no result" };
            const count = r.issues.length;
            const isOk = !r.error;
            const value = r.error
              ? `error: ${r.error}`
              : count === 0
                ? "no issues"
                : `${count} issue${count === 1 ? "" : "s"}`;
            return <Row key={p} label={p} value={value} ok={isOk} muted={count === 0} />;
          })}
        </Section>

        {/* Issues list */}
        <Section title="recent issues">
          {allIssues.length === 0 ? (
            <p
              style={{
                margin: 0,
                padding: "var(--spacing-3) 0",
                color: "var(--color-ink-subtle)",
                fontSize: "var(--text-caption)",
              }}
            >
              {sentryToken ? "(no unresolved issues in the last 24h)" : "(sentry token not configured)"}
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
              }}
            >
              {allIssues.map((issue) => (
                <li
                  key={issue.id}
                  style={{
                    padding: "var(--spacing-3) 0",
                    borderBottom:
                      "1px solid var(--color-hairline)",
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: "var(--spacing-4)",
                    alignItems: "baseline",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--text-microcaption)",
                      color: levelColor(issue.level),
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      minWidth: "60px",
                    }}
                  >
                    {issue.level}
                  </span>
                  <a
                    href={issue.permalink}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: "var(--color-ink)",
                      textDecoration: "none",
                      overflowWrap: "anywhere",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "var(--text-caption)",
                        textDecoration: "underline",
                        textUnderlineOffset: 2,
                      }}
                    >
                      {issue.title}
                    </span>
                    <br />
                    <span
                      style={{
                        fontSize: "var(--text-microcaption)",
                        color: "var(--color-ink-subtle)",
                      }}
                    >
                      {issue.project} · {issue.count} event
                      {issue.count === "1" ? "" : "s"}
                      {issue.userCount > 0 &&
                        ` · ${issue.userCount} user${issue.userCount === 1 ? "" : "s"}`}
                    </span>
                  </a>
                  <span
                    style={{
                      fontSize: "var(--text-microcaption)",
                      color: "var(--color-ink-subtle)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {relativeTime(issue.lastSeen)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="build">
          <Row
            label="release"
            value={release === "unknown" ? "unknown" : release.slice(0, 12)}
            ok
          />
        </Section>

        <footer
          style={{
            marginTop: "var(--spacing-8)",
            paddingTop: "var(--spacing-4)",
            borderTop: "1px solid var(--color-hairline)",
            fontSize: "var(--text-microcaption)",
            color: "var(--color-ink-subtle)",
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "var(--spacing-3)",
          }}
        >
          <span>
            <a
              href="https://sendwyrd.sentry.io/issues/"
              target="_blank"
              rel="noreferrer"
              style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 2 }}
            >
              full sentry
            </a>
            {" · "}
            <a
              href="https://dash.cloudflare.com/"
              target="_blank"
              rel="noreferrer"
              style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 2 }}
            >
              cloudflare
            </a>
            {" · "}
            <a
              href="https://github.com/DeltaClimbs/sendwyrd/actions"
              target="_blank"
              rel="noreferrer"
              style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 2 }}
            >
              actions
            </a>
          </span>
          <span>capability-gated · do not share</span>
        </footer>
      </main>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: "var(--spacing-8)" }}>
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
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  ok,
  muted,
}: {
  label: string;
  value: string;
  ok: boolean;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "var(--spacing-2) 0",
        borderBottom: "1px solid var(--color-hairline)",
        fontSize: "var(--text-caption)",
        color: muted ? "var(--color-ink-muted)" : "var(--color-ink)",
      }}
    >
      <span>
        <span
          style={{
            color: ok
              ? "var(--color-mark-sealed)"
              : "var(--color-danger)",
            marginRight: "var(--spacing-3)",
          }}
        >
          {ok ? "✓" : "✗"}
        </span>
        {label}
      </span>
      <span style={{ color: "var(--color-ink-muted)" }}>{value}</span>
    </div>
  );
}

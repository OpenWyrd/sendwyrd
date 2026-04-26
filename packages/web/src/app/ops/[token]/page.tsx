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

interface UsageStats {
  generated_at: string;
  wyrds: {
    total: number;
    last_24h: number;
    last_7d: number;
    active: number;
    burned: number;
    expired: number;
  };
  replies: { total: number; last_24h: number; last_7d: number };
}

async function fetchStats(
  token: string,
): Promise<{ stats?: UsageStats; error?: string }> {
  try {
    const r = await fetch(`${SITE_ORIGIN}/api/v1/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { error: `HTTP ${r.status}` };
    return { stats: (await r.json()) as UsageStats };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

interface EdgeStats {
  hours: number;
  requests: number;
  uniques: number;
  page_views: number;
  bytes: number;
}

const ZONE_ID = "8c4dd97cddeb4550d6a885cd17c5e5ce";

async function fetchEdgeAnalytics(
  cfToken: string,
): Promise<{ stats?: EdgeStats; error?: string }> {
  try {
    // Round to the hour boundary. CF's Time scalar accepts ISO8601;
    // we strip seconds/millis so the bucketing aligns with hourly groups.
    const roundHour = (d: Date): string => {
      const t = new Date(d);
      t.setUTCMinutes(0, 0, 0);
      return t.toISOString().replace(/\.\d+Z$/, "Z");
    };
    const since = roundHour(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const until = roundHour(new Date());
    const query = `query($z:String!,$s:Time!,$u:Time!){viewer{zones(filter:{zoneTag:$z}){httpRequests1hGroups(limit:100,filter:{datetime_geq:$s,datetime_lt:$u}){sum{requests bytes pageViews}uniq{uniques}}}}}`;
    const r = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        query,
        variables: { z: ZONE_ID, s: since, u: until },
      }),
    });
    if (!r.ok) return { error: `HTTP ${r.status}` };
    const data = (await r.json()) as {
      errors?: Array<{ message: string }>;
      data?: {
        viewer?: {
          zones?: Array<{
            httpRequests1hGroups?: Array<{
              sum: { requests: number; bytes: number; pageViews: number };
              uniq: { uniques: number };
            }>;
          }>;
        };
      };
    };
    if (data.errors?.length)
      return { error: data.errors[0]?.message ?? "unknown" };
    const groups = data.data?.viewer?.zones?.[0]?.httpRequests1hGroups ?? [];
    let requests = 0;
    let uniques = 0;
    let page_views = 0;
    let bytes = 0;
    for (const g of groups) {
      requests += g.sum.requests;
      uniques += g.uniq.uniques;
      page_views += g.sum.pageViews;
      bytes += g.sum.bytes;
    }
    return {
      stats: { hours: groups.length, requests, uniques, page_views, bytes },
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)}MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)}GB`;
}

function formatNum(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
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
  if (!expected || token.length !== expected.length || token !== expected) {
    notFound();
  }

  const cfAnalyticsToken = process.env.CF_ANALYTICS_TOKEN || "";

  // Parallel fetch: health + per-project issues + usage stats + edge analytics.
  const [apiHealth, webHealth, statsResult, edgeResult, ...projectResults] =
    await Promise.all([
      checkHealth(`${SITE_ORIGIN}/api/v1/health`),
      checkHealth(`${SITE_ORIGIN}/`),
      fetchStats(token),
      cfAnalyticsToken
        ? fetchEdgeAnalytics(cfAnalyticsToken)
        : Promise.resolve({ error: "no cf analytics token" } as {
            stats?: EdgeStats;
            error?: string;
          }),
      ...PROJECTS.map((p) =>
        sentryToken
          ? fetchIssues(p, sentryToken)
          : Promise.resolve({ issues: [], error: "no token" }),
      ),
    ]);

  const allIssues = projectResults
    .flatMap((r) => r.issues)
    .sort(
      (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime(),
    )
    .slice(0, 15);

  const release = process.env.NEXT_PUBLIC_RELEASE || "unknown";
  const releaseNumber = process.env.NEXT_PUBLIC_RELEASE_NUMBER || "";
  const renderedAt = new Date().toISOString();

  return (
    <>
      <meta httpEquiv="refresh" content="30" />
      <main
        style={{
          minHeight: "100vh",
          padding: "var(--spacing-12) var(--spacing-6) var(--spacing-24)",
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

        {/* Usage */}
        <Section title="usage">
          {statsResult.error ? (
            <Row
              label="stats"
              value={`error: ${statsResult.error}`}
              ok={false}
            />
          ) : statsResult.stats ? (
            <>
              <UsageRow
                label="wyrds published"
                total={statsResult.stats.wyrds.total}
                d24={statsResult.stats.wyrds.last_24h}
                d7={statsResult.stats.wyrds.last_7d}
              />
              <UsageRow
                label="replies sent"
                total={statsResult.stats.replies.total}
                d24={statsResult.stats.replies.last_24h}
                d7={statsResult.stats.replies.last_7d}
              />
              <Row
                label="active wyrds"
                value={`${formatNum(statsResult.stats.wyrds.active)} live · ${formatNum(statsResult.stats.wyrds.burned)} burned · ${formatNum(statsResult.stats.wyrds.expired)} expired`}
                ok
                muted
              />
            </>
          ) : (
            <Row label="stats" value="loading" ok muted />
          )}
        </Section>

        {/* Edge analytics (Cloudflare) */}
        <Section title="edge · last 24h">
          {edgeResult.error ? (
            <Row
              label="cloudflare"
              value={`error: ${edgeResult.error}`}
              ok={false}
            />
          ) : edgeResult.stats ? (
            <>
              <Row
                label="distinct IPs"
                value={formatNum(edgeResult.stats.uniques)}
                ok
              />
              <Row
                label="page views"
                value={formatNum(edgeResult.stats.page_views)}
                ok
                muted
              />
              <Row
                label="requests"
                value={formatNum(edgeResult.stats.requests)}
                ok
                muted
              />
              <Row
                label="bytes served"
                value={formatBytes(edgeResult.stats.bytes)}
                ok
                muted
              />
              <p
                style={{
                  margin: 0,
                  marginTop: "var(--spacing-3)",
                  fontSize: "var(--text-microcaption)",
                  color: "var(--color-ink-subtle)",
                  lineHeight: 1.6,
                }}
              >
                distinct IPs ≠ distinct users. includes CI runners (~1 per
                deploy), crawlers, vulnerability scanners, cert transparency
                monitors, and probes — most of the count is non-human.
                cloudflare bot scoring requires a paid plan; not wired. the real
                human-action signal is &ldquo;wyrds published&rdquo; and
                &ldquo;replies sent&rdquo; in the usage section above.
              </p>
            </>
          ) : (
            <Row label="edge" value="loading" ok muted />
          )}
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
            return (
              <Row
                key={p}
                label={p}
                value={value}
                ok={isOk}
                muted={count === 0}
              />
            );
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
              {sentryToken
                ? "(no unresolved issues in the last 24h)"
                : "(sentry token not configured)"}
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
                    borderBottom: "1px solid var(--color-hairline)",
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
            label="deploy"
            value={
              releaseNumber
                ? release === "unknown"
                  ? `#${releaseNumber}`
                  : `#${releaseNumber} · ${release.slice(0, 7)}`
                : release === "unknown"
                  ? "unknown"
                  : release.slice(0, 12)
            }
            ok
          />
        </Section>

        <p
          style={{
            margin: 0,
            marginTop: "var(--spacing-4)",
            fontSize: "var(--text-microcaption)",
            color: "var(--color-ink-subtle)",
          }}
        >
          <a
            href={`/ops/${token}/secrets`}
            style={{
              color: "inherit",
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            set a worker secret →
          </a>
        </p>

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
              style={{
                color: "inherit",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              full sentry
            </a>
            {" · "}
            <a
              href="https://dash.cloudflare.com/"
              target="_blank"
              rel="noreferrer"
              style={{
                color: "inherit",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              cloudflare
            </a>
            {" · "}
            <a
              href="https://github.com/DeltaClimbs/sendwyrd/actions"
              target="_blank"
              rel="noreferrer"
              style={{
                color: "inherit",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
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

function UsageRow({
  label,
  total,
  d24,
  d7,
}: {
  label: string;
  total: number;
  d24: number;
  d7: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto auto",
        gap: "var(--spacing-4)",
        alignItems: "baseline",
        padding: "var(--spacing-2) 0",
        borderBottom: "1px solid var(--color-hairline)",
        fontSize: "var(--text-caption)",
      }}
    >
      <span>{label}</span>
      <span
        style={{
          color: "var(--color-ink-muted)",
          fontVariantNumeric: "tabular-nums",
          minWidth: "5ch",
          textAlign: "right",
        }}
      >
        <span style={{ color: "var(--color-ink)" }}>{formatNum(d24)}</span>
        <span
          style={{
            color: "var(--color-ink-subtle)",
            fontSize: "var(--text-microcaption)",
            marginLeft: "var(--spacing-2)",
          }}
        >
          24h
        </span>
      </span>
      <span
        style={{
          color: "var(--color-ink-muted)",
          fontVariantNumeric: "tabular-nums",
          minWidth: "5ch",
          textAlign: "right",
        }}
      >
        <span style={{ color: "var(--color-ink)" }}>{formatNum(d7)}</span>
        <span
          style={{
            color: "var(--color-ink-subtle)",
            fontSize: "var(--text-microcaption)",
            marginLeft: "var(--spacing-2)",
          }}
        >
          7d
        </span>
      </span>
      <span
        style={{
          color: "var(--color-ink-muted)",
          fontVariantNumeric: "tabular-nums",
          minWidth: "6ch",
          textAlign: "right",
        }}
      >
        <span style={{ color: "var(--color-ink)" }}>{formatNum(total)}</span>
        <span
          style={{
            color: "var(--color-ink-subtle)",
            fontSize: "var(--text-microcaption)",
            marginLeft: "var(--spacing-2)",
          }}
        >
          all
        </span>
      </span>
    </div>
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
            color: ok ? "var(--color-mark-sealed)" : "var(--color-danger)",
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

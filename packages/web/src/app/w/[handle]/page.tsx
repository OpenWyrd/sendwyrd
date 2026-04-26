/**
 * Fragment-form view: server component that SSR-fetches the encrypted
 * envelope from the api worker and embeds it in the initial HTML, so the
 * client can decrypt the moment hydration runs — no second round trip.
 *
 * K_read still lives in the URL fragment and never reaches the server
 * (per RFC 3986). The envelope is encrypted; SSR-embedding it leaks
 * nothing the api worker doesn't already expose at /api/v1/wyrds/{handle}.
 */

import FragmentClient, { type InitialFetch } from "./FragmentClient";

// We never want this page cached on the edge — burns and tombstones must
// be reflected immediately, and each render does a fresh envelope fetch.
export const dynamic = "force-dynamic";

interface Params {
  handle: string;
}

const API_BASE = process.env.SENDWYRD_API_BASE ?? "https://sendwyrd.com";

async function fetchEnvelope(handle: string): Promise<InitialFetch> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/wyrds/${handle}`, {
      headers: { "MOP-Protocol-Version": "1" },
      cache: "no-store",
    });
    if (res.status === 404) return { kind: "not_found" };
    if (res.status === 410) {
      const t = (await res.json()) as { reason: string; gone_at: string };
      return { kind: "gone", reason: t.reason, gone_at: t.gone_at };
    }
    if (!res.ok) return { kind: "error" };
    const data = await res.json();
    return { kind: "ok", data };
  } catch {
    return { kind: "error" };
  }
}

export default async function FragmentView({
  params,
}: {
  params: Promise<Params>;
}) {
  const { handle } = await params;
  const initial = await fetchEnvelope(handle);
  return <FragmentClient handle={handle} initial={initial} />;
}

"use server";

/**
 * Server action: set a Cloudflare Worker secret via the Cloudflare API.
 *
 * Capability-gated by OPS_DASH_SECRET (token in form data, validated
 * against env). Only allows known worker scripts (sendwyrd-{web,api}).
 *
 * Uses CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID from worker env.
 * Trust class: same as SENTRY_AUTH_TOKEN already in worker env (full
 * deploy-capable token in runtime). Justified for capability-URL-gated
 * ops; documented in the security tradeoff notes.
 */

import { redirect } from "next/navigation";

const ALLOWED_WORKERS = ["sendwyrd-web", "sendwyrd-api"] as const;
type AllowedWorker = (typeof ALLOWED_WORKERS)[number];

function isAllowedWorker(s: string): s is AllowedWorker {
  return (ALLOWED_WORKERS as readonly string[]).includes(s);
}

export async function setSecretAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const worker = String(formData.get("worker") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const value = String(formData.get("value") ?? "");

  const expected = process.env.OPS_DASH_SECRET ?? "";

  // Capability gate (same constant-time-ish check as the page).
  if (!expected || token.length !== expected.length || token !== expected) {
    redirect(`/ops/${token}/secrets?status=error&msg=unauthorized`);
  }

  // Worker name allowlist.
  if (!isAllowedWorker(worker)) {
    redirect(
      `/ops/${token}/secrets?status=error&msg=${encodeURIComponent(`unknown worker: ${worker}`)}`,
    );
  }

  // Secret name validation: ALL_CAPS_WITH_UNDERSCORES, common convention.
  if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(name)) {
    redirect(
      `/ops/${token}/secrets?status=error&msg=${encodeURIComponent("name must match /^[A-Z][A-Z0-9_]{0,63}$/")}`,
    );
  }

  if (!value) {
    redirect(
      `/ops/${token}/secrets?status=error&msg=${encodeURIComponent("value is empty")}`,
    );
  }

  const cfToken = process.env.CLOUDFLARE_API_TOKEN ?? "";
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
  if (!cfToken || !accountId) {
    redirect(
      `/ops/${token}/secrets?status=error&msg=${encodeURIComponent("worker missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID")}`,
    );
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${worker}/secrets`;
  let result: { ok: boolean; status: number; body: string };
  try {
    const r = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${cfToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, text: value, type: "secret_text" }),
      signal: AbortSignal.timeout(10000),
    });
    const body = await r.text();
    result = { ok: r.ok, status: r.status, body };
  } catch (e) {
    redirect(
      `/ops/${token}/secrets?status=error&msg=${encodeURIComponent(`fetch failed: ${(e as Error).message}`)}`,
    );
  }

  if (!result.ok) {
    let errMsg = `HTTP ${result.status}`;
    try {
      const parsed = JSON.parse(result.body) as {
        errors?: Array<{ message: string }>;
      };
      if (parsed.errors?.length) {
        errMsg = parsed.errors.map((e) => e.message).join("; ");
      }
    } catch {
      // body wasn't JSON; keep status
    }
    redirect(
      `/ops/${token}/secrets?status=error&msg=${encodeURIComponent(errMsg)}`,
    );
  }

  redirect(
    `/ops/${token}/secrets?status=success&name=${encodeURIComponent(name)}&worker=${encodeURIComponent(worker)}`,
  );
}

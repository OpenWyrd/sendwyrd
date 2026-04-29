/**
 * End-to-end smoke test against the live production API at sendwyrd.com.
 * Composes, signs, publishes, fetches, and decrypts a wyrd using only
 * @sendwyrd/core primitives. Verifies the full pipeline.
 *
 * Run with:
 *   pnpm --filter @sendwyrd/core exec tsx scripts/e2e-smoke.ts
 */

import {
  composeWyrd,
  decryptFromBase64Url,
  generateSeed,
  b64uDecode,
  buildFragmentUrl,
} from "@sendwyrd/core";

const ORIGIN = "https://sendwyrd.com";

async function main() {
  console.log("=== SendWyrd E2E smoke test ===\n");

  console.log("1) Generate ephemeral seed");
  const { seed, mnemonic } = generateSeed(12);
  console.log(`   seed bytes: ${seed.length}`);
  console.log(`   mnemonic words: ${mnemonic.split(" ").length}\n`);

  console.log("2) Compose a wyrd");
  const plaintext =
    "E2E smoke test — confirming the full publish/fetch/decrypt loop on sendwyrd.com.";
  const result = await composeWyrd({
    plaintext,
    seed,
    n: 0,
    ttl_seconds: 3600,
    replies_enabled: false,
  });
  console.log(`   handle: ${result.handle}`);
  console.log(`   k_read: ${result.k_read_b64u.slice(0, 12)}...`);
  console.log(
    `   envelope: ${result.publish_payload.envelope.length} chars b64u\n`,
  );

  console.log("3) POST /api/v1/wyrds");
  const pubRes = await fetch(`${ORIGIN}/api/v1/wyrds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "MOP-Protocol-Version": "1",
    },
    body: JSON.stringify(result.publish_payload),
  });
  const pubBody = await pubRes.json();
  console.log(`   ${pubRes.status} ${JSON.stringify(pubBody)}\n`);
  if (!pubRes.ok) {
    console.error("FAIL: publish");
    process.exit(1);
  }

  console.log("4) GET /api/v1/wyrds/{handle}");
  const fetchRes = await fetch(`${ORIGIN}/api/v1/wyrds/${result.handle}`, {
    headers: { "MOP-Protocol-Version": "1" },
  });
  const fetched = (await fetchRes.json()) as {
    handle: string;
    envelope: string;
    k_origin_pub: string;
    published_at: number;
    expires_at: number;
    replies_enabled: boolean;
  };
  console.log(
    `   ${fetchRes.status} envelope ${fetched.envelope.length} chars\n`,
  );
  if (!fetchRes.ok) {
    console.error("FAIL: fetch");
    process.exit(1);
  }

  console.log("5) Decrypt");
  const handleBytes = b64uDecode(fetched.handle);
  const decrypted = await decryptFromBase64Url(fetched.envelope, {
    k_read: result.k_read,
    handle: handleBytes,
    expires_at_ms: fetched.expires_at,
    replies_enabled: fetched.replies_enabled,
  });
  console.log(`   plaintext: "${decrypted}"\n`);

  if (decrypted !== plaintext) {
    console.error("FAIL: roundtrip mismatch");
    console.error(`expected: ${plaintext}`);
    console.error(`actual:   ${decrypted}`);
    process.exit(1);
  }

  console.log("6) Construct share URL");
  const url = buildFragmentUrl(ORIGIN, result.handle, result.k_read_b64u);
  console.log(`   ${url}\n`);

  console.log(
    "✓ ALL CHECKS PASSED — full publish/fetch/decrypt roundtrip works on production.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * E2E reply roundtrip against production.
 * 1. Author publishes wyrd with replies_enabled
 * 2. Anonymous recipient encrypts + submits reply (ECIES to K_origin_pub)
 * 3. Author fetches replies (Schnorr-signed) + decrypts
 * 4. Verifies plaintext matches
 */

import {
  composeWyrd,
  encryptReply,
  decryptReply,
  generateSeed,
  b64uDecode,
  b64uEncode,
  fetchRepliesMessage,
  schnorrSign,
} from "@sendwyrd/core";

const ORIGIN = "https://sendwyrd.com";

async function main() {
  console.log("=== Reply E2E ===\n");

  console.log("1) Author composes wyrd with replies_enabled");
  const { seed } = generateSeed(12);
  const compose = await composeWyrd({
    plaintext:
      "Reply roundtrip test — recipients can encrypt to my K_origin_pub.",
    seed,
    n: 0,
    ttl_seconds: 3600,
    replies_enabled: true,
  });
  const handleBytes = b64uDecode(compose.handle);

  const pubRes = await fetch(`${ORIGIN}/api/v1/wyrds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "MOP-Protocol-Version": "1",
    },
    body: JSON.stringify(compose.publish_payload),
  });
  if (!pubRes.ok) {
    console.error("publish failed", await pubRes.json());
    process.exit(1);
  }
  console.log(`   handle: ${compose.handle}`);
  console.log(`   replies_enabled: true\n`);

  console.log("2) Recipient encrypts reply via ECIES");
  const replyText =
    "I have notes on the cap-table mechanic. Happy to share — my email is m@example.com.";
  const blob = await encryptReply({
    plaintext: replyText,
    handle: handleBytes,
    k_origin_pub: compose.k_origin.k_origin_pub,
  });
  console.log(`   blob bytes: ${blob.length}\n`);

  console.log("3) Submit reply (anonymous)");
  const submitRes = await fetch(
    `${ORIGIN}/api/v1/wyrds/${compose.handle}/replies`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "MOP-Protocol-Version": "1",
      },
      body: JSON.stringify({
        reply_blob: b64uEncode(blob),
        submit_timestamp_ms: Date.now(),
      }),
    },
  );
  if (submitRes.status !== 202) {
    console.error("submit failed", submitRes.status, await submitRes.json());
    process.exit(1);
  }
  console.log(
    `   ${submitRes.status} ${JSON.stringify(await submitRes.json())}\n`,
  );

  console.log("4) Author fetches replies (signed)");
  const ts = Date.now();
  const messageHash = fetchRepliesMessage({
    handle: handleBytes,
    fetch_timestamp_ms: ts,
  });
  const signature = schnorrSign(messageHash, compose.k_origin.k_origin_priv);
  const auth = `${b64uEncode(signature)}:${ts}`;

  const fetchRes = await fetch(
    `${ORIGIN}/api/v1/wyrds/${compose.handle}/replies`,
    {
      headers: { "MOP-Protocol-Version": "1", "X-Mop-Auth": auth },
    },
  );
  if (!fetchRes.ok) {
    console.error("fetch failed", fetchRes.status, await fetchRes.json());
    process.exit(1);
  }
  const data = (await fetchRes.json()) as {
    handle: string;
    replies: Array<{ reply_blob: string; received_at: number }>;
  };
  console.log(`   replies count: ${data.replies.length}\n`);

  console.log("5) Author decrypts reply");
  const replyBlob = b64uDecode(data.replies[0]!.reply_blob);
  const decrypted = await decryptReply({
    blob: replyBlob,
    handle: handleBytes,
    k_origin_priv: compose.k_origin.k_origin_priv,
  });
  console.log(`   decrypted: "${decrypted}"\n`);

  if (decrypted !== replyText) {
    console.error("FAIL: reply roundtrip mismatch");
    console.error(`expected: ${replyText}`);
    console.error(`actual:   ${decrypted}`);
    process.exit(1);
  }

  console.log("✓ Reply E2E roundtrip works on production.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

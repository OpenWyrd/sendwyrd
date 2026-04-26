import { composeWyrd, generateSeed, buildFragmentUrl } from "../src/index.js";
const ORIGIN = "https://sendwyrd.com";
const { seed } = generateSeed(12);
const r = await composeWyrd({
  plaintext: "Permanent wyrd test.",
  seed,
  n: 0,
  ttl_seconds: 0,
  replies_enabled: false,
});
const pub = await fetch(`${ORIGIN}/api/v1/wyrds`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "MOP-Protocol-Version": "1" },
  body: JSON.stringify(r.publish_payload),
});
const body = await pub.json();
console.log(`Publish: ${pub.status}`);
console.log(
  `expires_at: ${body.expires_at} (${new Date(body.expires_at).toISOString()})`,
);
console.log(
  `Permanent? ${body.expires_at >= 253370764800000 - 1000 ? "✓ YES" : "✗ NO"}`,
);

import { composeWyrd, generateSeed, buildPublicUrl } from "../src/index.js";
const ORIGIN = "https://sendwyrd.com";
const { seed } = generateSeed(12);
const result = await composeWyrd({
  plaintext: "Public-form smoke test — this body should appear in SSR HTML and OG description.",
  seed, n: 0, ttl_seconds: 3600, replies_enabled: false,
});
const r = await fetch(`${ORIGIN}/api/v1/wyrds`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "MOP-Protocol-Version": "1" },
  body: JSON.stringify(result.publish_payload),
});
console.log("Publish:", r.status, await r.json());
const url = buildPublicUrl(ORIGIN, result.handle, result.k_read_b64u);
console.log("Public URL:", url);

const view = await fetch(url);
const html = await view.text();
console.log("View status:", view.status);
const m = html.match(/<meta name="description" content="([^"]+)"/);
console.log("OG description:", m?.[1]?.slice(0, 100) ?? "(not found)");
const inBody = html.includes("Public-form smoke test");
console.log("Body in SSR HTML:", inBody);

import { composeWyrd, generateSeed, buildPublicUrl } from "../src/index.js";
const ORIGIN = "https://sendwyrd.com";

async function publish(payload: any) {
  const r = await fetch(`${ORIGIN}/api/v1/wyrds`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "MOP-Protocol-Version": "1" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`publish ${r.status}`);
  return r.json();
}

const { seed } = generateSeed(12);

console.log("1) Compose CHILD wyrd");
const child = await composeWyrd({
  plaintext: "Inner wyrd: this should appear as a card preview inside the parent.",
  seed, n: 0, ttl_seconds: 3600, replies_enabled: false,
});
await publish(child.publish_payload);
const childUrl = `sendwyrd://w/${child.handle}#${child.k_read_b64u}`;
console.log(`   handle: ${child.handle}\n`);

console.log("2) Compose PARENT wyrd referencing child via sendwyrd:// URL");
const parent = await composeWyrd({
  plaintext: `Read this thread: ${childUrl}\n\nMore thoughts after the inline.`,
  seed, n: 1, ttl_seconds: 3600, replies_enabled: false,
});
await publish(parent.publish_payload);
console.log(`   handle: ${parent.handle}\n`);

console.log("3) Fetch parent via public form (SSR + transitive resolve)");
const url = buildPublicUrl(ORIGIN, parent.handle, parent.k_read_b64u);
const html = await (await fetch(url)).text();

const checks: Array<[string, boolean]> = [
  ["Parent body 'Read this thread' present", html.includes("Read this thread")],
  ["sendwyrd:// link rendered", html.includes(`sendwyrd://w/${child.handle}`) || html.includes(`/w/${child.handle}`)],
  ["Child preview body present (transitive expansion)", html.includes("Inner wyrd")],
  ["Card 'wyrd ·' label present", html.includes("wyrd<!-- --> · ")],
];
let ok = true;
for (const [label, pass] of checks) {
  console.log(`   ${pass ? "✓" : "✗"} ${label}`);
  if (!pass) ok = false;
}
console.log(`\n${ok ? "✓ Transitive embed works" : "✗ Transitive embed failing"}`);
process.exit(ok ? 0 : 1);

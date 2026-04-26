import { composeWyrd, generateSeed, buildPublicUrl, buildFragmentUrl } from "../src/index.js";
const ORIGIN = "https://sendwyrd.com";
async function publish(p:any){const r=await fetch(`${ORIGIN}/api/v1/wyrds`,{method:"POST",headers:{"Content-Type":"application/json","MOP-Protocol-Version":"1"},body:JSON.stringify(p)});if(!r.ok)throw new Error("publish "+r.status);return r.json();}
const { seed } = generateSeed(12);
const child = await composeWyrd({plaintext:"Inner wyrd content for embed.",seed,n:0,ttl_seconds:3600,replies_enabled:false});
await publish(child.publish_payload);
const childHttpsUrl = buildFragmentUrl(ORIGIN, child.handle, child.k_read_b64u);
console.log("child:", childHttpsUrl);

const parent = await composeWyrd({plaintext:`Embed test: ${childHttpsUrl}`,seed,n:1,ttl_seconds:3600,replies_enabled:false});
await publish(parent.publish_payload);
const parentUrl = buildPublicUrl(ORIGIN, parent.handle, parent.k_read_b64u);
console.log("parent (public):", parentUrl);

const html = await (await fetch(parentUrl)).text();
console.log("Inner content in SSR:", html.includes("Inner wyrd content for embed") ? "✓ YES" : "✗ NO");
console.log("Card label 'wyrd · ' rendered:", html.match(/wyrd<!-- --> · <!-- -->[A-Za-z0-9_-]{16}/) ? "✓ YES" : "✗ NO");

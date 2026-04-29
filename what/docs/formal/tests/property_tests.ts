/*
 * Tier 3 — property-based tests for OpenWyrd MOP v1.
 *
 * These exercise the public API of @openwyrd/mop (resolved through the
 * @sendwyrd/core re-export shim) and check the spec-implementation
 * correspondence for the properties the formal verification effort
 * (Tier 1 ProVerif, Tier 2 CryptoVerif) proves at the abstract layer.
 *
 * Properties checked:
 *
 *   P1 — envelope round-trip          (encrypt → decrypt returns input)
 *   P2 — AAD tamper integrity         (any AAD change → decrypt fails)
 *   P3 — wrong-key rejection          (decrypt with wrong K_read fails)
 *   P4 — HD K_read determinism        (same (seed, n) → same key)
 *   P5 — HD K_read distinctness       (n1 ≠ n2 → distinct keys)
 *   P6 — HD seed isolation            (different seeds → distinct keys)
 *   P7 — K_origin / K_read separation (different domains never overlap)
 *   P8 — reply blob round-trip        (encryptReply → decryptReply)
 *   P9 — reply handle-binding         (cross-handle reply fails)
 *
 * Each property runs N_ITER times with fresh random inputs.
 *
 * Run from the repo root:
 *   pnpm exec tsx what/docs/formal/tests/property_tests.ts
 *
 * Authoritative tests for @openwyrd/mop live in the mop-js repo. This
 * file is a verification-effort regression harness, not a replacement.
 */

import {
  encryptEnvelope,
  decryptEnvelope,
  generateKRead,
  deriveReadKey,
  deriveOriginKey,
  encryptReply,
  decryptReply,
  generateSeed,
} from "@sendwyrd/core";

const N_ITER = 50;
const HANDLE_BYTES = 12;
const K_READ_BYTES = 32;

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(label: string, predicate: () => boolean | Promise<boolean>) {
  return Promise.resolve(predicate())
    .then((ok) => {
      if (ok) {
        pass++;
      } else {
        fail++;
        failures.push(label);
        console.error(`  FAIL: ${label}`);
      }
    })
    .catch((err) => {
      fail++;
      failures.push(`${label} (threw: ${(err as Error).message})`);
      console.error(`  FAIL: ${label} threw: ${(err as Error).message}`);
    });
}

async function expectThrows(label: string, fn: () => Promise<unknown>) {
  return check(label, async () => {
    try {
      await fn();
      return false; // expected throw, didn't
    } catch {
      return true;
    }
  });
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

function randomString(): string {
  const lengths = [0, 1, 50, 200, 300];
  const len = lengths[Math.floor(Math.random() * lengths.length)];
  let s = "";
  for (let i = 0; i < len; i++) {
    s += String.fromCodePoint(0x20 + Math.floor(Math.random() * 95));
  }
  return s;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

async function run() {
  console.log(`OpenWyrd MOP — property tests (${N_ITER} iterations each)\n`);

  // ----- P1: envelope round-trip ----------------------------------------
  console.log("P1 — envelope round-trip");
  for (let i = 0; i < N_ITER; i++) {
    const plaintext = randomString();
    const k_read = generateKRead();
    const handle = randomBytes(HANDLE_BYTES);
    const expires_at_ms = Date.now() + 86_400_000;
    const replies_enabled = Math.random() < 0.5;
    const env = await encryptEnvelope({
      plaintext,
      k_read,
      handle,
      expires_at_ms,
      replies_enabled,
    });
    const decrypted = await decryptEnvelope({
      envelope: env,
      k_read,
      handle,
      expires_at_ms,
      replies_enabled,
    });
    await check(
      `P1[${i}] round-trip preserves plaintext`,
      () => decrypted === plaintext,
    );
  }

  // ----- P2: AAD tamper integrity ---------------------------------------
  console.log("P2 — AAD tamper integrity");
  for (let i = 0; i < 10; i++) {
    const plaintext = randomString() || "x";
    const k_read = generateKRead();
    const handle = randomBytes(HANDLE_BYTES);
    const expires_at_ms = Date.now() + 86_400_000;
    const replies_enabled = false;
    const env = await encryptEnvelope({
      plaintext,
      k_read,
      handle,
      expires_at_ms,
      replies_enabled,
    });
    // Tamper handle
    const otherHandle = randomBytes(HANDLE_BYTES);
    await expectThrows(`P2[${i}] tampered handle rejected`, () =>
      decryptEnvelope({
        envelope: env,
        k_read,
        handle: otherHandle,
        expires_at_ms,
        replies_enabled,
      }),
    );
    // Tamper expires_at_ms
    await expectThrows(`P2[${i}] tampered expires_at rejected`, () =>
      decryptEnvelope({
        envelope: env,
        k_read,
        handle,
        expires_at_ms: expires_at_ms + 1,
        replies_enabled,
      }),
    );
    // Tamper replies_enabled
    await expectThrows(`P2[${i}] tampered replies_enabled rejected`, () =>
      decryptEnvelope({
        envelope: env,
        k_read,
        handle,
        expires_at_ms,
        replies_enabled: !replies_enabled,
      }),
    );
  }

  // ----- P3: wrong-key rejection ----------------------------------------
  console.log("P3 — wrong-key rejection");
  for (let i = 0; i < 10; i++) {
    const plaintext = randomString() || "y";
    const k_read = generateKRead();
    const wrong_k_read = generateKRead();
    const handle = randomBytes(HANDLE_BYTES);
    const expires_at_ms = Date.now() + 86_400_000;
    const env = await encryptEnvelope({
      plaintext,
      k_read,
      handle,
      expires_at_ms,
      replies_enabled: false,
    });
    await expectThrows(`P3[${i}] wrong K_read rejected`, () =>
      decryptEnvelope({
        envelope: env,
        k_read: wrong_k_read,
        handle,
        expires_at_ms,
        replies_enabled: false,
      }),
    );
  }

  // ----- P4: HD K_read determinism --------------------------------------
  console.log("P4 — HD K_read determinism");
  for (let i = 0; i < N_ITER; i++) {
    const { seed } = generateSeed(12);
    const n = Math.floor(Math.random() * 1_000_000);
    const k1 = deriveReadKey(seed, n);
    const k2 = deriveReadKey(seed, n);
    await check(`P4[${i}] same (seed,n) → same K_read`, () =>
      bytesEqual(k1, k2),
    );
    await check(`P4[${i}] K_read length = ${K_READ_BYTES}`, () =>
      k1.length === K_READ_BYTES,
    );
  }

  // ----- P5: HD K_read distinctness across n ---------------------------
  console.log("P5 — HD K_read distinctness across n");
  for (let i = 0; i < N_ITER; i++) {
    const { seed } = generateSeed(12);
    const n1 = Math.floor(Math.random() * 1_000_000);
    let n2 = n1;
    while (n2 === n1) n2 = Math.floor(Math.random() * 1_000_000);
    const k1 = deriveReadKey(seed, n1);
    const k2 = deriveReadKey(seed, n2);
    await check(`P5[${i}] different n → different K_read`, () =>
      !bytesEqual(k1, k2),
    );
  }

  // ----- P6: HD seed isolation -----------------------------------------
  console.log("P6 — HD seed isolation");
  for (let i = 0; i < N_ITER; i++) {
    const { seed: s1 } = generateSeed(12);
    const { seed: s2 } = generateSeed(12);
    const n = Math.floor(Math.random() * 1_000_000);
    const k1 = deriveReadKey(s1, n);
    const k2 = deriveReadKey(s2, n);
    await check(`P6[${i}] different seed → different K_read`, () =>
      !bytesEqual(k1, k2),
    );
  }

  // ----- P7: K_origin / K_read domain separation -----------------------
  console.log("P7 — K_origin / K_read domain separation");
  for (let i = 0; i < N_ITER; i++) {
    const { seed } = generateSeed(12);
    const n = Math.floor(Math.random() * 1_000_000);
    const k_read = deriveReadKey(seed, n);
    const { k_origin_priv } = deriveOriginKey(seed, n);
    await check(
      `P7[${i}] K_read ≠ K_origin_priv at same (seed, n)`,
      () => !bytesEqual(k_read, k_origin_priv),
    );
  }

  // ----- P8: reply blob round-trip --------------------------------------
  console.log("P8 — reply blob round-trip");
  for (let i = 0; i < N_ITER; i++) {
    const { seed } = generateSeed(12);
    const n = Math.floor(Math.random() * 1_000_000);
    const { k_origin_priv, k_origin_pub } = deriveOriginKey(seed, n);
    const handle = randomBytes(HANDLE_BYTES);
    const plaintext = randomString() || "z";
    const blob = await encryptReply({ plaintext, handle, k_origin_pub });
    const decrypted = await decryptReply({ blob, handle, k_origin_priv });
    await check(`P8[${i}] reply round-trip preserves plaintext`, () =>
      decrypted === plaintext,
    );
  }

  // ----- P9: reply handle-binding ---------------------------------------
  console.log("P9 — reply handle-binding");
  for (let i = 0; i < 10; i++) {
    const { seed } = generateSeed(12);
    const n = Math.floor(Math.random() * 1_000_000);
    const { k_origin_priv, k_origin_pub } = deriveOriginKey(seed, n);
    const handle1 = randomBytes(HANDLE_BYTES);
    const handle2 = randomBytes(HANDLE_BYTES);
    const blob = await encryptReply({
      plaintext: "for handle1",
      handle: handle1,
      k_origin_pub,
    });
    await expectThrows(
      `P9[${i}] decrypting under wrong handle rejected`,
      () => decryptReply({ blob, handle: handle2, k_origin_priv }),
    );
  }

  // ----- summary --------------------------------------------------------
  console.log(`\n=== Summary ===`);
  console.log(`Passed: ${pass}`);
  console.log(`Failed: ${fail}`);
  if (fail > 0) {
    console.log(`\nFailures:`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log(`\nAll properties hold across ${pass} checks.`);
}

run().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(2);
});

# @sendwyrd/core

The reference TypeScript implementation of the SendWyrd protocol — compose / decrypt / sign primitives, HD derivation, URL parsing, wire types.

The wire spec is the source of truth. This package is the canonical client implementation.

## Why

SendWyrd is an identity-less, host-blind, capability-URL relay primitive. There are no accounts, no API keys, no PKI. Every wyrd is encrypted client-side; every destructive operation is gated by a per-wyrd Schnorr signature; the relay sees ciphertext and signatures, never plaintext or recipients.

This package gives JS/TS builders the exact primitives the canonical web client and the `@sendwyrd/mcp` server use: HD-derived keys (BIP-32 hardened, BIP-39 seeds), AES-256-GCM envelope encryption with AAD bound to handle/expiry/reply-mode, BIP-340 Schnorr signatures, ECIES one-shot replies, and the canonical fragment-URL parser.

## Install

```bash
npm install @sendwyrd/core
# or
pnpm add @sendwyrd/core
```

## Quick example

```ts
import {
  composeWyrd,
  generateSeed,
  buildFragmentUrl,
  parseWyrdUrl,
  decryptFromBase64Url,
} from "@sendwyrd/core";

// Compose: derive a per-wyrd K_origin from an HD seed, encrypt, sign.
const { seed } = generateSeed(12);
const composed = await composeWyrd({
  plaintext: "hello, naked text",
  seed,
  n: 0,
  ttl_seconds: 7_776_000, // 90 days
  replies_enabled: false,
});

// POST composed.publish_payload to https://sendwyrd.com/api/v1/wyrds.
// Then build the canonical share URL (handle in path, K_read in fragment):
const url = buildFragmentUrl(
  "https://sendwyrd.com",
  composed.handle,
  composed.k_read_b64u,
);

// View: parse the URL, fetch the envelope, decrypt with K_read.
const parsed = parseWyrdUrl(url);
if (parsed.kind === "fragment") {
  // const envelopeB64u = await fetchEnvelope(parsed.handle);
  // const plaintext = await decryptFromBase64Url(envelopeB64u, parsed.k_read_b64u, parsed.handle, expires_at_ms, replies_enabled);
}
```

## Public API

| Export | Purpose |
|--------|---------|
| `composeWyrd` | Derive K_origin, encrypt body, sign publish payload |
| `decryptFromBase64Url` / `decryptEnvelope` | Decrypt a wyrd envelope with K_read |
| `deriveOriginKey` / `deriveReadKey` | HD derivation at index `n` (BIP-32 hardened, purpose `300'`) |
| `generateSeed` / `mnemonicToSeed` / `isValidMnemonic` | BIP-39 seed lifecycle |
| `encryptSeedRecord` / `decryptSeedRecord` | Passphrase-protected seed storage (PBKDF2-AES-GCM) |
| `parseWyrdUrl` / `buildFragmentUrl` | Canonical fragment-URL parsing and construction |
| `encryptReply` / `decryptReply` | ECIES one-shot replies to `K_origin_pub` |
| `signAuthorshipAttestation` / `verifyAuthorshipAttestation` | Static authorship attestations |
| `parseBody` | Body segmentation (sendwyrd / link / lightning / bitcoin) |
| `schnorrSign` / `schnorrVerify` | BIP-340 Schnorr primitives |
| `b64uEncode` / `b64uDecode` | Base64url without padding |

Wire constants (`BODY_CODEPOINT_CAP`, `TTL_SECONDS_DEFAULT`, `HANDLE_BYTES`, `K_READ_BYTES`, etc.) are exported from `./types`.

## Stability

This package is **pre-1.0 and unstable**. The wire spec is at `v1.0.4-draft` and may churn; the package version tracks implementation, not spec compatibility.

- `0.1.x`: API may change between minor versions without warning. Pin exactly if you depend on it.
- `1.0.0`: semver discipline begins. Breaking changes only on majors.

## License

MIT.

---
type: spec
created: 2026-04-25
updated: 2026-04-26
last_edited_by: agent_spec_patch
status: draft
tags: [spec, mop, protocol, wire, v1]
spec_version: "1.0.3-draft"
---

# MOP Protocol Specification — v1

## 1. Overview

This document specifies the wire-level behavior of the **MOP (Message Object Protocol) v1** — the protocol underlying **SendWyrd**. It consolidates every architectural decision in ADRs 003 through 020 into a single implementable reference. Each section cites the governing ADR(s) for rationale; this document does not restate rationale — it states the answer in implementation-grade form.

### 1.1 Scope

In scope:
- URL canonical forms and parsing rules
- HD key derivation
- Wyrd publish, fetch, delete operations
- Reply-blob submit and fetch operations
- Encryption envelope formats
- HTTP transport bindings (methods, paths, payloads, error codes)
- Rate-limit baseline numbers (operational; tunable)
- Tombstone semantics

Out of scope (handled elsewhere):
- Renderer behavior (Phase C — `renderer_contract_v1.md`)
- Visual / UX / IA direction (Phase D — `visual_direction_v1.md`)
- Database schema, exact server implementation choices (Phase E — repo scaffolding)
- Operational rate-limit tuning beyond baseline (host-operator runbook)

### 1.2 Normative language

The keywords **MUST**, **MUST NOT**, **SHALL**, **SHOULD**, **SHOULD NOT**, **MAY** in this document are to be interpreted as described in RFC 2119.

### 1.3 Versioning

This is **MOP v1**. The protocol-version marker is `1` (integer). Clients and servers MUST send and check the `MOP-Protocol-Version: 1` HTTP header on every request and response. A server receiving an unknown protocol-version MUST respond with `426 Upgrade Required`.

---

## 2. Terminology

| Term | Meaning |
|------|---------|
| **wyrd** | One published unit. Tweet-sized (≤300 codepoints), end-to-end encrypted, capability-addressed, immutable post-publish, default-90-day-TTL. Plural: *wyrds*. |
| **handle** | A 12-byte client-generated random identifier for a wyrd, base64url-encoded (16 chars no padding) for transport. Globally unique within the host (uniqueness validated server-side; collision-on-insert returns 409). Client-generated because the AAD per §7.2 binds the ciphertext to the handle, and `publish_message` (§9.2) signs the handle — both require the handle to exist before the envelope is encrypted and signed. |
| **K_read** | A 32-byte symmetric key, AES-256 used for the body envelope. Generated client-side at compose time. Distributed via the URL fragment — browsers do not transmit fragments to the host, so the host stays body-blind. |
| **K_origin** | A secp256k1 keypair (`K_origin_priv` / `K_origin_pub`) bound to one wyrd. Authorizes destructive (delete) and reply-fetch operations on that wyrd. Derived from the user's HD seed at path `m/300'/n'`. |
| **seed** | The user's BIP-39 mnemonic (encoded as 32 bytes via PBKDF2 per BIP-39). The root of all `K_origin` derivations on this user's device. |
| **handle URL** | The shareable URL that identifies a wyrd and carries the read capability in the fragment. |
| **origin URL** | The author-held private URL encoding the master seed (or an HD branch). Used for client-side inbox aggregation per ADR-009. Never sent to any server. |
| **reply blob** | An ECIES-encrypted envelope containing one reply text. Submitted by a recipient when reply mode is enabled on a wyrd. |
| **tombstone** | The `410 Gone` response served for a wyrd that has expired or been burned. |

---

## 3. Cryptographic primitives

Per ADRs 005 and 020.

| Primitive | Algorithm | Library reference |
|-----------|-----------|-------------------|
| Symmetric AEAD | AES-256-GCM, 96-bit IV, 128-bit auth tag | Web Crypto API (`crypto.subtle`) |
| ECC curve | secp256k1 | `@noble/secp256k1` |
| Signatures | secp256k1 Schnorr (BIP-340) — 64-byte sig over 32-byte X-only pubkey | `@noble/secp256k1` |
| ECDH | secp256k1 with SEC1 compressed pubkeys (33 bytes) | `@noble/secp256k1` |
| Hash | SHA-256 | Web Crypto API |
| KDF | HKDF-SHA256 | Web Crypto API |
| HD derivation | BIP-32 (hardened only) | `@scure/bip32` |
| Mnemonic | BIP-39 (English wordlist) | `@scure/bip39` |
| Random | CSPRNG (`crypto.getRandomValues`) | Web Crypto API |

All binary values in JSON payloads and URLs MUST be base64url-encoded **without padding** (RFC 4648 §5). All multi-byte integers in binary envelopes MUST be big-endian.

---

## 4. URL canonical form

Per ADR-021 (supersedes the two-form addressing originally specified in ADR-004).

A wyrd is reachable via a single URL form. The host is body-blind on every request: the read capability lives in the URL fragment, which browsers do not transmit to the server.

### 4.1 Form

```
https://sendwyrd.com/w/{handle}#{K_read_b64u}
```

- The handle (16 chars b64u) appears in the path.
- The 32-byte `K_read` (43 chars b64u) appears in the URL fragment.
- Browsers MUST NOT transmit the fragment to the server. The server therefore observes only the handle and serves the encrypted envelope; the renderer decrypts client-side.
- This is the only form a composer produces. Clients SHOULD make this form trivial to copy and share.

Example:
```
https://sendwyrd.com/w/aB3cD9eFgHiJkLmN#XQ8aR2vN5mP7tQ1kY4jH6sL9wR3pK0xV8nC2bM5gT3eU
```

Anyone holding the URL can read the wyrd. "Public sharing" is therefore a property of who possesses the URL, not of an addressing form. The protocol does not bless a host-readable form for OG previews or search indexing — link previews on social platforms do not unfurl, and recipients must actually visit the URL to engage. This is intentional per VISION.

### 4.2 URL parsing rules

A client receiving a URL classifies it by inspecting the path:

- Path matches `^/w/([A-Za-z0-9_-]{16})$` → fragment form. Read `K_read` from the URL fragment. If the fragment is empty, the URL is malformed.
- Path matches `^/w/([A-Za-z0-9_-]{16})/k/([A-Za-z0-9_-]{43})$` → **legacy path form**. Recognized at parse time only, to permit transitional resolution of URLs shared in the wild prior to ADR-021. Composers MUST NOT emit this form. Renderers SHOULD redirect path-form URLs to the fragment form (see §11).
- Anything else → not a wyrd URL.

The handle character class `[A-Za-z0-9_-]` is base64url. The handle length is exactly 16 chars (12 bytes encoded). The `K_read` length is exactly 43 chars (32 bytes encoded).

---

## 5. HD key derivation

Per ADR-017.

### 5.1 Path

Per-wyrd `K_origin` keypairs are derived from the user's BIP-39 seed via BIP-32 hardened derivation at path:

```
m / 300' / n'
```

Both levels are hardened. The purpose code `300'` is a custom BIP-43 purpose (Spartan-300 anchor; collision-safe with BIP-44 wallet paths). The index `n'` is a 31-bit unsigned integer (`0` through `2^31 - 1`).

### 5.2 Index management

- Each device persists a **next-free-index counter** (`next_n`) alongside the encrypted seed.
- On compose: `n := next_n`; `next_n := next_n + 1`; persist atomically before publish.
- On publish failure: the index is consumed (do not reuse). `next_n` advances regardless.
- On BIP-39 import on a fresh device: counter resets to 0; client performs a **sweep** to discover used indices.

### 5.3 Sweep on recovery

On fresh-device recovery from a BIP-39 mnemonic:
1. Initialize `n := 0`, `gap := 0`.
2. Derive `K_origin_pub` at index `n`.
3. Query the canonical host: `GET /a/{K_origin_pub_b64u}` (presence-check endpoint, see §11.7).
4. If the host returns 200 OK with a list of handles → `gap := 0`, record handles for this index, `n := n + 1`, repeat.
5. If the host returns 404 → `gap := gap + 1`, `n := n + 1`, repeat.
6. Stop when `gap >= 20`.
7. Set `next_n := n - gap` (highest occupied index + 1).

The gap-limit value `20` is the BIP-44 convention. Hosts MAY require a signature on the presence-check (to avoid public-pubkey enumeration), implementation-defined.

### 5.4 Master inbox URL

The "master inbox URL" referenced in ADR-009 is a device-local, never-transmitted URL that encodes the seed (or an HD branch). The canonical encoding is:

```
sendwyrd://inbox#{seed_b64u}
```

Where `seed_b64u` is the 32-byte BIP-39 seed (post-PBKDF2) encoded base64url. The `sendwyrd://` scheme is intentionally non-standard to discourage accidental web-share. This URL MUST NEVER be transmitted to any server, included in HTTP headers, or pasted into any UI that copies to clipboard without explicit confirmation.

Implementations MAY also support encoding only an HD branch (e.g., `xprv`-rooted at `m/300'`) for limited scopes (a per-device sub-identity). v1 does not specify this; reserved for future use.

### 5.5 What HD recovery does and does NOT restore

`K_read` is **per-wyrd random, NOT seed-derived**. It is 32 bytes from CSPRNG generated at compose time (§7.3) and distributed exclusively via the URL fragment.

This means the BIP-39 sweep on a fresh device (§5.3) reconstructs:

- The user's list of published wyrd handles per `K_origin_pub`.
- Each wyrd's `K_origin_priv` (from `m/300'/n'`) — sufficient to **decrypt replies** (ECIES with `K_origin_priv`, §14.3) and **burn** the wyrd (sign delete, §12).

It does NOT reconstruct:

- `K_read` for any wyrd. After local-storage loss, the user's sealed wyrd bodies are unreadable unless the user retained the share URL (which carries `K_read` in its fragment) somewhere outside the device — e.g., a copied link in a notes app, an email, a chat message.

This is intentional per VISION P4 ("brittleness as feature"): the protocol refuses durable archive of plaintext bodies. The mnemonic restores authorship and operational control (reply-reading, burn) but not historical readability. Users SHOULD understand that **brittleness is the contract, not a bug** — if they need a body to survive device loss, they must retain the share URL elsewhere on purpose.

The asymmetry is deliberate. Operational keys (`K_origin`) are deterministic and recoverable so the user keeps lifecycle control over their published wyrds. Read keys (`K_read`) are ephemeral and unrecoverable so the host cannot be coerced into reconstructing plaintext, and so a stolen seed alone cannot retroactively unseal historical bodies.

---

## 6. Wyrd structure

A wyrd at rest on the host consists of:

| Field | Type | Source |
|-------|------|--------|
| `handle` | 12 bytes binary (16 chars b64u in transport) | Client-generated at compose; server validates uniqueness on insert and rejects collisions with 409 |
| `K_origin_pub` | 33 bytes binary (SEC1 compressed; 44 chars b64u in transport) | Client; derived from seed at `m/300'/n'` |
| `envelope` | binary blob (see §7) | Client; encrypted body |
| `published_at` | unix epoch milliseconds (uint64) | Client-asserted within ±60s replay window; server validates and stores as-is. Never `server_now` directly. |
| `expires_at` | unix epoch milliseconds (uint64) | Server; `published_at + ttl_ms` (or `253_370_764_800_000` if `ttl_seconds == 0` for permanent — discouraged, see ADR-006) |
| `replies_enabled` | boolean | Client; per ADR-008 |
| `gone_at` | unix epoch milliseconds (uint64), nullable | Server; set when expired or burned |
| `gone_reason` | enum: `expired` \| `burned`, nullable | Server; per ADR-018 |

Wyrds are immutable post-publish (ADR-006). The host MUST reject any modification request other than `DELETE`.

---

## 7. Encryption envelope

Per ADR-020.

### 7.1 Envelope binary layout

```
+--------+--------+--------------------+-----------+
| ver(1) | iv(12) | ciphertext(N)      | tag(16)   |
+--------+--------+--------------------+-----------+
```

- `ver` (1 byte): `0x01` for envelope version 1. (Distinct from protocol version; allows envelope rotation independent of protocol.)
- `iv` (12 bytes): random AES-GCM IV from CSPRNG. Unique per envelope.
- `ciphertext` (variable, bounded by §7.4): AES-256-GCM ciphertext over the plaintext body.
- `tag` (16 bytes): GCM authentication tag.

The Web Crypto API produces ciphertext with the tag appended, matching this layout naturally.

### 7.2 AAD binding

The GCM additional authenticated data (AAD) is the byte concatenation:

```
AAD := ver(1) || handle(12) || expires_at_be(8) || replies_enabled(1)
```

Total: 22 bytes. The AAD binds the ciphertext to its handle, expiry, and reply mode. The server stores `expires_at` and `replies_enabled` and provides them to the client at fetch (see §11.2 response). The client MUST recompute the AAD from server-provided fields and use it during AES-GCM-decrypt; tag verification fails if any AAD field has been tampered with.

This prevents:
- Ciphertext substitution between handles (handle bound to ciphertext).
- TTL extension/contraction by the host (`expires_at` bound).
- `replies_enabled` flipping (host cannot toggle reply mode after publish).

### 7.3 K_read derivation

`K_read` is **32 random bytes from CSPRNG** generated at compose time. No KDF intermediate; the bytes ARE the AES-256 key. This minimizes attack surface and matches the URL-fragment-distribution model.

### 7.4 Size limits

Per ADRs 011 and 012:
- Plaintext body: ≤ 300 Unicode codepoints, encoded UTF-8. UTF-8 max bytes per codepoint is 4, so plaintext ≤ 1200 bytes.
- Envelope: MUST NOT exceed `1 + 12 + 1200 + 16 = 1229` bytes. Servers SHOULD allow up to 1500 bytes envelope to accommodate UTF-8 edge cases and future minor changes; values above 1500 are rejected.

---

## 8. Body format

Per ADRs 007, 011, 012.

### 8.1 Body grammar

The body is **plain UTF-8 text**. There is no markdown, no formatting language, no schema. URLs embedded in the text are detected by the renderer at view time.

URL detection: a substring is a URL if it matches:

```
^(https?|sendwyrd):\/\/[^\s]+
```

The renderer aggressively auto-embeds detected URLs per ADR-011.

### 8.2 Codepoint counting

The 300-codepoint cap is enforced by counting **Unicode codepoints**, not bytes and not grapheme clusters. The composer MUST count using the same algorithm the server uses. Reference algorithm:

```javascript
function codepointCount(str) {
  let n = 0;
  for (const _ of str) n++;  // for...of iterates by codepoint
  return n;
}
```

Empty body is allowed at the protocol layer (length zero) but composers SHOULD warn the user.

### 8.3 Transitive capability references

A wyrd body MAY contain other `sendwyrd://` URLs (full handle URLs of other wyrds). When rendered, the renderer recursively dereferences these URLs to inline previews, subject to the renderer's recursion cap (specified in `renderer_contract_v1.md`). This produces the "thread-via-quoting" behavior of ADR-007.

---

## 9. Wyrd publish

### 9.1 Endpoint

```
POST /api/v1/wyrds
Content-Type: application/json
MOP-Protocol-Version: 1
```

### 9.2 Request body

```json
{
  "handle": "<base64url 16-char client-generated handle>",
  "envelope": "<base64url envelope, see §7.1>",
  "k_origin_pub": "<base64url 33-byte SEC1 compressed pubkey>",
  "ttl_seconds": 7776000,
  "replies_enabled": false,
  "publish_signature": "<base64url 64-byte BIP-340 Schnorr sig>",
  "publish_timestamp_ms": 1745625600000
}
```

Fields:
- `handle` — REQUIRED. 12 random bytes from CSPRNG, base64url-encoded (16 chars). Client-generated. Server validates format and uniqueness; collision returns 409 with `error: "handle_collision_retry"` (client retries with a fresh handle).
- `envelope` — REQUIRED. The encrypted body envelope.
- `k_origin_pub` — REQUIRED. The per-wyrd origin pubkey, derived from the seed at `m/300'/n'`.
- `ttl_seconds` — REQUIRED. Unsigned integer. Server-accepted range is `[0, 31_536_000]` (1 year max). Default in composer SHOULD be `7_776_000` (90 days, ADR-006). Value `0` is the **permanent-storage sentinel**: the server stores `expires_at = 253_370_764_800_000` (year 9999, unix ms) and the wyrd never naturally expires (it can still be burned). Permanence is discouraged per ADR-006 — composers SHOULD NOT default to `0` and SHOULD warn the user when `0` is selected — but it is a valid value.
- `replies_enabled` — REQUIRED. Per ADR-008.
- `publish_signature` — REQUIRED. BIP-340 Schnorr signature by `K_origin_priv` over `publish_message` (defined below).
- `publish_timestamp_ms` — REQUIRED. Client-asserted unix epoch ms. Server rejects if outside `[server_now - 60s, server_now + 60s]` (replay-window guard).

`publish_message` (the signed payload):

```
publish_message := SHA-256(
  "mop:v1:publish" ||
  handle(12) ||
  envelope ||
  ttl_seconds_be(8) ||
  replies_enabled(1) ||
  publish_timestamp_ms_be(8)
)
```

This binds the signature to the exact handle, envelope, TTL, reply mode, and timestamp. The handle IS in the signed payload because it is client-generated: the client picks 12 random bytes, encrypts the envelope with the handle bound into the AAD (§7.2), then signs the resulting `publish_message`. The server validates the signature against the handle the client supplied and rejects on uniqueness collision (§9.3 step 5).

### 9.3 Server behavior

1. Validate `handle` matches `^[A-Za-z0-9_-]{16}$` (base64url, 12 bytes).
2. Validate envelope size (≤ 1500 bytes).
3. Validate `k_origin_pub` is a valid secp256k1 SEC1-compressed pubkey.
4. Validate `ttl_seconds` is in `[0, 31_536_000]`.
5. Validate `publish_timestamp_ms` is within ±60s of server clock.
6. Reconstruct `publish_message` (including the client-supplied handle) and verify `publish_signature` against `k_origin_pub`.
7. Insert the wyrd record with `published_at := publish_timestamp_ms`, `expires_at := publish_timestamp_ms + ttl_seconds * 1000` (or `253_370_764_800_000` if `ttl_seconds == 0`). Handle uniqueness is enforced as a primary-key constraint; on duplicate insertion the server returns `409 Conflict` with `error: "handle_collision_retry"` and the client SHOULD retry with a fresh 12-byte handle. Collision probability at 96-bit entropy is negligible (~1 in 2^48 after 2^48 wyrds by birthday bound), so retry is a safety net rather than a hot path.
8. Return 201.

### 9.4 Response (success)

```
HTTP/1.1 201 Created
Content-Type: application/json
MOP-Protocol-Version: 1

{
  "handle": "<base64url 16-char>",
  "published_at": 1745625600123,
  "expires_at": 1753401600123
}
```

### 9.5 Response (failure)

See §17 for error codes. Common failure responses:
- `400 Bad Request` — malformed JSON, invalid base64url, wrong field types, handle format mismatch.
- `409 Conflict` — handle already exists (`error: "handle_collision_retry"`). Client retries with a fresh handle.
- `413 Payload Too Large` — envelope exceeds 1500 bytes.
- `422 Unprocessable Entity` — signature verification failed; pubkey malformed; timestamp outside replay window; `ttl_seconds` out of range.
- `429 Too Many Requests` — rate-limit (see §16).

---

## 10. Wyrd fetch

### 10.1 Endpoint

```
GET /w/{handle}
MOP-Protocol-Version: 1
```

The `/w/` prefix is for renderer-served URLs. Fragment-form fetch returns the encrypted envelope and metadata — the renderer decrypts client-side after page load.

### 10.2 Server behavior

If the renderer receives this request as the canonical first-party client (browser navigation to the URL), the server returns the static HTML shell of the renderer with the envelope and metadata embedded as JSON. The renderer then reads `K_read` from the URL fragment (which the server never observed) and decrypts client-side.

For programmatic / API access, the server provides the JSON envelope at:

```
GET /api/v1/wyrds/{handle}
MOP-Protocol-Version: 1
```

### 10.3 Response (live wyrd)

```
HTTP/1.1 200 OK
Content-Type: application/json
MOP-Protocol-Version: 1

{
  "handle": "<base64url 16-char>",
  "envelope": "<base64url envelope>",
  "k_origin_pub": "<base64url 33-byte>",
  "published_at": 1745625600123,
  "expires_at": 1753401600123,
  "replies_enabled": false
}
```

### 10.4 Response (gone — expired or burned)

Per ADR-018. See §13.

### 10.5 Response (not found, never existed, or tombstone retention expired)

```
HTTP/1.1 404 Not Found
MOP-Protocol-Version: 1
```

---

## 11. Legacy public-path-form redirect

Per ADR-021, the public-path addressing form was removed in spec v1.0.2. URLs of the form `/w/{handle}/k/{K_read_b64u}` shared in the wild prior to that change continue to resolve via a transitional client-side redirect:

```
GET /w/{handle}/k/{K_read_b64u}
→ HTML shell that immediately runs:
  window.location.replace(`/w/${handle}#${K_read_b64u}`)
```

The host briefly observes `K_read` in the redirect request path (since it was always in the path for this URL form). After redirect the K_read lives in the fragment and is never sent to the server again. No new privacy regression vs. the legacy contract.

The server does not decrypt server-side. There is no JSON variant. There are no OG / SEO metadata. Recipients land on the fragment-form view (§10) and decrypt client-side.

---

## 12. Wyrd delete (burn)

Per ADR-006.

### 12.1 Endpoint

```
DELETE /api/v1/wyrds/{handle}
MOP-Protocol-Version: 1
Content-Type: application/json
```

### 12.2 Request body

```json
{
  "delete_signature": "<base64url 64-byte BIP-340 Schnorr sig>",
  "delete_timestamp_ms": 1745700000000
}
```

`delete_message`:

```
delete_message := SHA-256(
  "mop:v1:delete" ||
  handle(12) ||
  delete_timestamp_ms_be(8)
)
```

The signature is by `K_origin_priv` (per the wyrd's `K_origin_pub`). Timestamp replay window: ±60s.

### 12.3 Server behavior

1. Look up wyrd by handle. If not found → 404. If already gone → 410 (the wyrd is already burned/expired; idempotent).
2. Verify signature using stored `K_origin_pub`.
3. Verify timestamp within replay window.
4. Set `gone_at := server_now`, `gone_reason := "burned"`. Delete envelope ciphertext immediately. Delete any associated reply blobs immediately (see §13.4).
5. Return 200.

### 12.4 Response

```
HTTP/1.1 200 OK
Content-Type: application/json
MOP-Protocol-Version: 1

{
  "handle": "<base64url 16-char>",
  "gone_at": 1745700001234,
  "gone_reason": "burned"
}
```

---

## 13. Tombstone responses

Per ADR-018.

### 13.1 Tombstone shape

When a wyrd's `gone_at` is non-null and the response is within the 30-day retention window:

```
HTTP/1.1 410 Gone
Content-Type: application/json
MOP-Protocol-Version: 1

{
  "status": "gone",
  "reason": "expired" | "burned" | "key_mismatch",
  "gone_at": "2026-07-23T14:21:00.123Z"
}
```

- `reason: "expired"` — natural TTL fire.
- `reason: "burned"` — `K_origin`-signed delete request honored.
- `reason: "key_mismatch"` — legacy public-form redirect (§11) hit with a `K_read` whose tag verification failed against the stored envelope. Operationally a 410 because the URL claims a key that doesn't match. Removed for fragment-form fetches, which never decrypt server-side.

### 13.2 Retention

- For 30 days post `gone_at`, the host serves the 410 response.
- After 30 days, the host deletes tombstone metadata and serves 404 instead.
- Retention is host-operator policy; the canonical SendWyrd host uses 30 days. Other hosts (post-federation) MAY differ but SHOULD document.

### 13.3 What tombstones MUST NOT contain

- No `K_origin_pub`.
- No envelope or ciphertext fingerprint.
- No body fragment, hash, or content-derived metadata.
- No author identifier of any kind.

### 13.4 Reply blob deletion on burn

When a wyrd is burned, all associated reply blobs are deleted immediately. Reply-fetch endpoints (§14) on a burned wyrd return 410 with the same tombstone shape.

---

## 14. Replies

Per ADRs 008 and 020.

### 14.1 Submit reply

```
POST /api/v1/wyrds/{handle}/replies
Content-Type: application/json
MOP-Protocol-Version: 1
```

Server first checks `replies_enabled` on the target wyrd. If false → `403 Forbidden` with body `{"error": "replies_disabled"}`. If wyrd is gone → 410.

Request body:

```json
{
  "reply_blob": "<base64url reply-blob, see §14.3>",
  "submit_timestamp_ms": 1745626000000
}
```

No signature is required from the replier — replies are anonymous to the host (no replier `K_origin` exists). The blob is encrypted to the wyrd's `K_origin_pub` and only the wyrd's author can decrypt it.

Server behavior:
1. Validate `reply_blob` size (see §14.4).
2. Per-object reply rate-limit (per ADR-013 and §16).
3. Persist blob with `received_at := server_now`.
4. Return 202.

Response:
```
HTTP/1.1 202 Accepted
Content-Type: application/json
MOP-Protocol-Version: 1

{
  "received_at": 1745626001234
}
```

### 14.2 Fetch replies (signed)

```
GET /api/v1/wyrds/{handle}/replies
MOP-Protocol-Version: 1
X-Mop-Auth: <sig_b64u>:<unix_ms>
```

#### 14.2.1 Canonical `X-Mop-Auth` header format

Endpoints that require `K_origin`-signed authentication carry the signature in a single HTTP header named `X-Mop-Auth`. The value is colon-delimited with exactly two fields:

```
X-Mop-Auth: <sig_b64u>:<unix_ms>
```

- `<sig_b64u>` — base64url-encoded BIP-340 Schnorr signature (64 bytes raw → 86 chars b64u, no padding) over the per-endpoint signed message.
- `<unix_ms>` — unsigned decimal integer, unix epoch milliseconds, the timestamp that was incorporated into the signed message.
- Separator: a single literal ASCII colon `:`. There is no surrounding whitespace.
- Replay window: server rejects with `422 timestamp_outside_window` if `|unix_ms - server_now| > 60_000`.
- Signature verification failure: server returns `422 signature_invalid` (never 401 — 401 means the header was absent).

This format is shared by §14.2 (fetch replies) and §15.2 (presence-check). Both endpoints differ only in the per-endpoint `*_message` they sign; the header encoding is identical.

The author's `K_origin_priv` signs:

```
fetch_replies_message := SHA-256(
  "mop:v1:fetch_replies" ||
  handle(12) ||
  fetch_timestamp_ms_be(8)
)
```

Server verifies the signature against stored `K_origin_pub` and timestamp within replay window.

Response:

```
HTTP/1.1 200 OK
Content-Type: application/json
MOP-Protocol-Version: 1

{
  "handle": "<base64url 16-char>",
  "replies": [
    {
      "reply_blob": "<base64url>",
      "received_at": 1745626001234
    }
  ]
}
```

Replies are returned in `received_at` ascending order. The author decrypts each blob client-side using `K_origin_priv` via ECIES (§14.3).

### 14.3 Reply blob format

```
+----------+----------+--------------------+----------+
| ver(1)   | e_pub(33)| ciphertext(N)      | tag(16)  |
+----------+----------+--------------------+----------+
```

- `ver` (1 byte): `0x01`.
- `e_pub` (33 bytes): SEC1-compressed ephemeral secp256k1 pubkey, freshly generated by the replier per blob.
- `ciphertext` (variable): AES-256-GCM ciphertext over the reply plaintext.
- `tag` (16 bytes): GCM auth tag.

Encryption:
1. Replier generates ephemeral keypair `(e_priv, e_pub)`.
2. Compute `shared := ECDH(e_priv, K_origin_pub)` → 32 bytes (X coordinate of the resulting point).
3. Derive AES key:
   ```
   aes_key := HKDF-SHA256(
     ikm = shared,
     salt = "",
     info = "mop:v1:reply:aes_key:" || handle(12) || e_pub(33),
     L = 32
   )
   ```
4. Derive IV:
   ```
   iv := HKDF-SHA256(
     ikm = shared,
     salt = "",
     info = "mop:v1:reply:iv:" || handle(12) || e_pub(33),
     L = 12
   )
   ```
5. AAD: `version(1) || handle(12) || e_pub(33)` (46 bytes).
6. `ciphertext, tag := AES-256-GCM-Encrypt(plaintext, key=aes_key, iv=iv, aad=AAD)`.
7. Reply blob := `version(1) || e_pub(33) || ciphertext || tag(16)`.

Decryption (by author, with `K_origin_priv`): mirror steps 2–6 with `shared := ECDH(K_origin_priv, e_pub)`.

### 14.4 Reply size limits

Reply plaintext: ≤ `REPLY_CODEPOINT_CAP = 300` codepoints — **the same cap as a wyrd body**. Replies are a forensic primitive, not a chat surface; making them as terse as the wyrds they reply to keeps the protocol from drifting toward conversation-hosting (anti-XKCD-927). Reply blob hard ceiling: `REPLY_BLOB_BYTE_CEILING = 2500` bytes (envelope overhead headroom over the wyrd 1500-byte ceiling, accommodating the 33-byte ephemeral pubkey and reply-specific framing). Tunable in a future ADR if real usage demands it; the current values are deliberate.

### 14.5 Reply replay protection

Replies are NOT signature-replay-protected — the host accepts duplicate-looking blobs (different ephemeral keys produce different ciphertexts even for identical plaintext, so duplicate detection is not possible without breaking encryption). The per-object rate limit (§16) is the floor defense against reply spam.

---

## 15. Presence-check (HD recovery)

Per §5.3.

### 15.1 Endpoint

```
GET /api/v1/authors/{K_origin_pub_b64u}/handles
MOP-Protocol-Version: 1
```

Returns the list of wyrd handles published under this `K_origin_pub`. Used by clients during HD sweep on recovery to locate published wyrds.

### 15.2 Auth

The canonical host MAY require this endpoint to be signed (to prevent open enumeration of authorship clusters by adversaries scanning random pubkeys). Implementation-defined; canonical SendWyrd host will require an `X-Mop-Auth` header per the canonical format defined in §14.2.1:

```
X-Mop-Auth: <sig_b64u>:<unix_ms>
```

Where the signed message is:

```
presence_check_message := SHA-256(
  "mop:v1:presence_check" ||
  K_origin_pub(33) ||
  presence_timestamp_ms_be(8)
)
```

Signature is by `K_origin_priv` matching the queried pubkey.

### 15.3 Response

```
HTTP/1.1 200 OK
Content-Type: application/json
MOP-Protocol-Version: 1

{
  "k_origin_pub": "<base64url 33-byte>",
  "handles": [
    {
      "handle": "<base64url 16-char>",
      "published_at": 1745625600123,
      "expires_at": 1753401600123,
      "gone_at": null,
      "gone_reason": null,
      "replies_enabled": false
    }
  ]
}
```

#### Per-entry shape

Each element of `handles` carries the same keys regardless of liveness state:

- **Live entries** (not expired, not burned): `gone_at: null` and `gone_reason: null` — both fields MUST be present and explicitly null. Clients MUST NOT infer liveness from key absence; the keys are always present.
- **Tombstoned entries** within the 30-day retention window: `gone_at: <unix_ms>` and `gone_reason: "expired" | "burned"`.
- **Past-retention entries** are omitted from the list (server filters them out; the entry is not returned at all).

#### Empty result

When the queried `K_origin_pub` has zero published wyrds (or all of them are past tombstone retention), the server returns:

```
HTTP/1.1 200 OK
Content-Type: application/json
MOP-Protocol-Version: 1

{
  "k_origin_pub": "<base64url 33-byte>",
  "handles": []
}
```

This is **200 OK with an empty array**, never 404. Proof-of-possession (the valid `X-Mop-Auth` signature) succeeded; "you have zero" is a valid answer to "what handles do you have?". 404 is reserved for the lookup-of-a-nonexistent-wyrd case (`GET /api/v1/wyrds/{handle}` on an unknown handle).

---

## 16. Rate limits (operational baseline)

Per ADR-013. These are operational policy at the canonical SendWyrd host; tunable.

| Limit | Value |
|-------|-------|
| Wyrd publishes per IP per minute | 5 |
| Wyrd publishes per IP per hour | 50 |
| Reply submits per IP per minute | 20 |
| Reply submits per IP per hour | 200 |
| Reply submits per wyrd per hour | 100 |
| Authenticated reads (signed) per IP per second | 10 |
| Anonymous reads (fetch-by-handle) per IP per second | 50 |
| Presence-check requests per IP per minute | 10 |

Exceeding any limit returns `429 Too Many Requests` with body:

```json
{
  "error": "rate_limited",
  "retry_after_seconds": 30
}
```

The `Retry-After` HTTP header SHOULD also be set. Numbers are ADR-013 starting points; canonical host operator (initially Michael) SHALL tune at launch.

---

## 17. Error code inventory

| HTTP | Body `error` value | Meaning |
|------|--------------------|---------|
| 400 | `malformed_request` | JSON parse failure or schema mismatch. |
| 400 | `invalid_base64url` | Field that should be base64url is not. |
| 401 | `signature_required` | Endpoint needs `X-Mop-Auth` and it's missing. (Distinct from `signature_invalid` below — 401 means the header was absent; 422 means a header was present but verification failed.) |
| 403 | `replies_disabled` | Reply-submit on a wyrd where `replies_enabled = false`. |
| 404 | `not_found` | Handle does not exist (or tombstone retention expired). |
| 409 | `handle_collision_retry` | Client-supplied handle is already taken. Client retries with fresh 12-byte handle. |
| 410 | (see §13) | Tombstone — wyrd is gone. |
| 413 | `payload_too_large` | Envelope or reply blob exceeds size cap. |
| 422 | `signature_invalid` | Schnorr signature failed verification. Returned by `POST /api/v1/wyrds`, `DELETE /api/v1/wyrds/{handle}`, `GET /api/v1/wyrds/{handle}/replies`, and `GET /api/v1/authors/{K_origin_pub}/handles`. Never 401 — 401 is reserved for `signature_required` (header missing). |
| 422 | `timestamp_outside_window` | Client timestamp outside ±60s replay window. |
| 422 | `pubkey_invalid` | `k_origin_pub` not a valid secp256k1 point. |
| 422 | `ttl_out_of_range` | `ttl_seconds` outside `[0, 31_536_000]`. (`0` is the permanent-storage sentinel and is accepted; see §9.2.) |
| 426 | `protocol_version_unsupported` | Client sent a `MOP-Protocol-Version` the server doesn't speak. |
| 429 | `rate_limited` | Rate-limit hit. |
| 500 | `internal` | Unexpected server error. Body is intentionally generic. |

---

## 18. Compatibility notes

- **`MOP-Protocol-Version: 1` header** is mandatory on every request and response. Servers SHOULD reject requests without it (`400 malformed_request`).
- **Content-Type** is `application/json` for all API endpoints. `Content-Type` mismatches return `400`.
- **CORS** policy on the canonical host: allow `https://sendwyrd.com` and `https://sendwyrd.app` origins for `/api/v1/*`. Reject all other origins. (Renderer-served `/w/{handle}` is HTML and not CORS-relevant.)

---

## 19. Open implementation questions (deferred)

Items that the wire spec deliberately leaves to implementation phase (Phase E) or to follow-on ADRs:

1. **Database schema** — Drizzle/Postgres concrete schema. Implementation phase.
2. **Wrangler / Cloudflare Workers configuration** — environment variables, KV/Durable Object bindings, R2 bucket configuration. Phase E.
3. **R2 storage layout** — whether envelopes live in Postgres `bytea` or in R2 with Postgres pointers. Performance-tuning question; default to Postgres for v1 simplicity, migrate envelopes to R2 if Postgres bytea sizes become operationally painful.
4. **Operational rate-limit tuning numbers** — ADR-013 baseline; tune at launch from real traffic.
5. **HSTS, CSP, COEP, COOP headers** — security-headers stack on canonical host. Phase E.
6. **Health-check / liveness endpoints** — implementation detail.
7. **Backup and disaster recovery** — operational, not protocol.
8. **OG image generator** — removed per ADR-021. There is no host-readable form; link previews on social platforms do not unfurl by design.
9. **Analytics / observability** — anything that doesn't break ADR-003 host-blindness. Phase E.

---

## 20. References

- ADR-003 — Capability-based privacy posture.
- ADR-004 — Two-key model and two-form addressing.
- ADR-005 — Bitcoin cryptography stack.
- ADR-006 — Object lifecycle.
- ADR-007 — Body schema (text + embedded URLs).
- ADR-008 — Replies.
- ADR-009 — Inbox aggregation client-side.
- ADR-010 — Notifications (zero protocol primitive).
- ADR-011 — Body plain text + aggressive auto-embed.
- ADR-012 — Body size cap (300 codepoints).
- ADR-013 — v1 abuse posture.
- ADR-014 — Canonical renderer; first-party clients only.
- ADR-015 — v1 use-case agnostic.
- ADR-016 — Brand SendWyrd / domain sendwyrd.com.
- ADR-017 — HD path `m/300'/n'`.
- ADR-018 — Tombstone with structured metadata.
- ADR-019 — Privacy-posture indicator (amended by ADR-021 — now monomorphic Sealed-only).
- ADR-020 — v1 stack.
- ADR-021 — Single-form addressing (supersedes the two-form addressing in ADR-004 and the symmetric indicator in ADR-019).

---

## 21. Changelog

- **v1.0.3-draft (2026-04-26)** — sync to shipped post-Tier-1. Six drift points reconciled with the deployed API (`packages/api/src/routes/{wyrds,authors,replies}.ts`):
  1. **`published_at` is client-asserted** (§6 wyrd-structure table, §9.3 step 7). The server stores `publish_timestamp_ms` as-is after validating it is within the ±60s replay window. The server never substitutes `server_now`. This preserves the AAD binding (§7.2) — `expires_at = publish_timestamp_ms + ttl_seconds * 1000` is computed from the client's signed timestamp, so the server cannot extend or contract TTL.
  2. **§15 empty list returns `200 OK` with `handles: []`** (§15.3). Proof-of-possession passed; "you have zero" is a valid answer. 404 is reserved for unknown-handle lookups, never for empty author results.
  3. **`X-Mop-Auth` header format canonicalized** (§14.2.1, referenced by §15.2). Format: `<sig_b64u>:<unix_ms>` — base64url Schnorr signature, single ASCII colon, decimal unix-ms timestamp. Both reply-fetch and presence-check share the encoding.
  4. **`gone_at: null` for live entries** (§15.3 per-entry shape). Each `handles[]` element always carries `gone_at` and `gone_reason` keys. Live entries set both to `null`. Tombstoned entries within retention populate them. Past-retention entries are omitted from the array entirely. Clients MUST NOT infer liveness from key absence.
  5. **`K_read` non-derivability note** (§5.5). HD recovery restores `K_origin` (operational keys: read replies, burn) but NOT `K_read` (per-wyrd random, fragment-only). Sealed bodies become unreadable after local-storage loss unless the share URL was retained elsewhere. Brittleness is the contract per VISION P4, not a bug. Asymmetry is deliberate: operational control survives device loss; historical readability does not.
  6. **`signature_invalid` returns 422, not 401** (§17 error inventory, clarified). 401 (`signature_required`) means the `X-Mop-Auth` header was absent. 422 (`signature_invalid`) means a header was present but Schnorr verification failed. Endpoints affected: publish, delete, fetch-replies, presence-check.
- **v1.0.2-draft (2026-04-26)** — single-form addressing per ADR-021. Public path-form (`/w/{handle}/k/{K_read}`) removed. Composers emit only the fragment form. §4 collapsed to a single canonical form. §11 retained as a legacy-redirect stub (transitional client-side redirect from path → fragment). Privacy-posture indicator (§ADR-019) is now monomorphic Sealed. OG / SEO metadata generation removed — link previews on social platforms do not unfurl by design.
- **v1.0.1-draft (2026-04-25)** — sync to shipped: client-generated handle (now signed in `publish_message`), `ttl_seconds = 0` accepted as permanent-storage sentinel (year-9999 `expires_at`), `REPLY_CODEPOINT_CAP = 300` and `REPLY_BLOB_BYTE_CEILING = 2500` (replies match wyrd-body terseness; anti-scope-creep). Cross-ref fixes: error-code section renumbered §15→§17 and rate-limits §14→§16 in §9.5.
- **v1.0.0-draft (2026-04-25)** — initial wire spec consolidating ADRs 003–020.

---
type: session
created: 2026-04-26
updated: 2026-04-26
status: completed
last_edited_by: agent_overnight
session_id: session_agent_20260426_core_tests
tier: 1
tags: [session, sendwyrd, tests, core, crypto, vitest, t-d]
---

# Session — Vitest unit test suite for `packages/core` (Task D)

## Intent

`packages/core` (~1,650 LOC of pure crypto / HD / URL / body / reply / encoding
functions) had zero unit tests, only e2e smoke against production. Land a real
unit test suite covering envelope, signature byte layout, HD derivation, URL
parsing, body segmentation + codepoint counting, ECIES replies, and base64url
encoding.

## Decisions

1. **Test runner: vitest** — modern TypeScript-native, integrates cleanly with
   ESM + the existing tsconfig. `tsx` was already a devDep for e2e scripts;
   vitest pairs naturally and adds zero system-level deps.
2. **Test layout: `packages/core/test/`** (mirrors `src/`) rather than colocated
   `__tests__`. Keeps the source tree clean.
3. **Coverage provider: `@vitest/coverage-v8`** — built-in to vitest 2.x, no
   istanbul or extra build step.
4. **Added a `tsconfig.test.json`** that includes both `src/` and `test/` so
   the test files can be typechecked under the same strict settings the source
   uses (`tsc --noEmit` for `packages/core` itself only includes `src/`, which
   is correct for the package's own typecheck).
5. **Extended scope beyond the seven brief'd files** to also cover `compose.ts`
   and `seedStore.ts`. They're exported from `index.ts` and would otherwise
   pull total package coverage below the workspace ≥80% target. Cheap wins.

## Files added

- `packages/core/test/encoding.test.ts` — 7 tests
- `packages/core/test/envelope.test.ts` — 22 tests
- `packages/core/test/sign.test.ts` — 11 tests
- `packages/core/test/hd.test.ts` — 18 tests
- `packages/core/test/url.test.ts` — 18 tests
- `packages/core/test/body.test.ts` — 30 tests
- `packages/core/test/reply.test.ts` — 14 tests
- `packages/core/test/compose.test.ts` — 10 tests (extra)
- `packages/core/test/seedStore.test.ts` — 12 tests (extra)
- `packages/core/vitest.config.ts`
- `packages/core/tsconfig.test.json`

## Files modified

- `packages/core/package.json` — added `vitest` + `@vitest/coverage-v8` devDeps;
  added `test`, `test:watch`, `test:coverage` scripts.
- `.gitignore` — added `coverage/`.
- `pnpm-lock.yaml` — regenerated.

## What's covered

| File          | Stmts  | Branch | Funcs | Lines  |
|---------------|--------|--------|-------|--------|
| body.ts       | 94.28% | 90.24% | 100%  | 94.28% |
| compose.ts    | 96.96% | 87.5%  | 100%  | 96.96% |
| encoding.ts   | 100%   | 100%   | 100%  | 100%   |
| envelope.ts   | 96.39% | 95.65% | 100%  | 96.39% |
| hd.ts         | 91.66% | 88.88% | 100%  | 91.66% |
| reply.ts      | 96.19% | 94.73% | 100%  | 96.19% |
| seedStore.ts  | 91.72% | 83.33% | 100%  | 91.72% |
| sign.ts       | 100%   | 100%   | 100%  | 100%   |
| types.ts      | 100%   | 100%   | 100%  | 100%   |
| url.ts        | 100%   | 100%   | 100%  | 100%   |
| **All files** | **95.66%** | **91.56%** | **97.61%** | **95.66%** |

Uncovered lines in non-trivial files are exclusively the `bufferSource()` /
`bs()` SharedArrayBuffer-fallback branches (impossible in Node test
environment) and a defensive `if (!privateKey) throw` in `hd.ts:54-55`
(unreachable in normal use because BIP-32 hardened derivation always returns
a private key when the parent has one).

`index.ts` shows 0% only because it's a pure re-export barrel; v8 coverage
treats the file's single line as not "executed" but every export is exercised.

## Test highlights

- **Envelope**: encrypt/decrypt round-trip with known inputs; AAD binding for
  every field (handle, expires_at, replies_enabled) — change one and decrypt
  must fail; tampered ciphertext / tampered tag / wrong K_read; empty body /
  300-codepoint body / mixed emoji+CJK+RTL body; envelope wire layout
  (`ver(1) || iv(12) || ciphertext || tag(16)`).
- **Sign**: re-derives `publishMessage` byte layout independently and asserts
  byte equality with the implementation (`SHA-256("mop:v1:publish" || handle ||
  envelope || ttl_be(8) || replies_enabled(1) || ts_be(8))`); same for
  delete/fetch_replies/presence_check; Schnorr sign+verify round-trip;
  signature breaks under tampered timestamp or envelope; wrong-key rejection.
- **HD**: BIP-39 known-vector seed for the canonical
  "abandon×11 about" mnemonic (verified against the published BIP-39 test
  vector seed hex); derivation path `m/300'/n'` matches manual `@scure/bip32`
  derivation byte-for-byte; hardened-only verified by direct comparison
  (`n=0'` vs `n=0`); SEC1 compressed pubkey (33 bytes, 0x02/0x03 prefix);
  X-only pubkey == compressed.slice(1); rejection of out-of-range `n`.
- **URL**: fragment + legacy public-path parsing; rejects malformed inputs
  (missing handle, wrong handle length, non-base64url chars, missing fragment,
  wrong fragment length, non-URL strings); `buildFragmentUrl` ↔ `parseWyrdUrl`
  round-trip identity.
- **Body**: segmentation of text + sendwyrd:// + https:// + image/video/audio
  URLs; trailing-punctuation stripping; `countCountableCodepoints` excludes
  URL chars (per spec amendment to §8.2 noted in source); empty / URL-only /
  emoji / ZWJ-joined bodies. **The codepoint cap is enforced at compose-time
  in `compose.ts`, not at parse-time** — `parseBody` is total over all inputs.
- **Reply**: ECIES round-trip; **HKDF info string format independently
  re-derived** (uses the documented `mop:v1:reply:aes_key:` || handle || e_pub
  info bytes against the actual ephemeral pubkey extracted from the blob —
  spec-conformance check, not just round-trip); AAD binding (wrong handle
  fails); tampered ciphertext / tag / e_pub all rejected; wrong author key
  rejected.
- **Encoding**: round-trip on byte arrays of various sizes, including the full
  `0x00..0xff` range; no-padding assertion; URL-safe alphabet (`-`/`_`)
  produced and decoded.
- **Compose** (extra): end-to-end happy path — handle is 16 chars b64u, k_read
  is 32 bytes, expires_at = ts + ttl*1000, envelope decrypts, signature
  verifies against signed message hash; ttl=0 sentinel → PERMANENT_EXPIRES_AT_MS;
  empty body / cap+1 / negative ttl / over-1-year ttl all rejected.
- **SeedStore** (extra): generate 12-word + 24-word mnemonics with valid
  checksums; encrypt/decrypt round-trip carries seed + counter + mnemonic;
  wrong passphrase fails (AAD via PBKDF2-derived key, AES-GCM tag); short
  records and bad version rejected; PBKDF2 iters use OWASP 2024 floor (≥600k);
  tests use 1000 iters via the `iterations` override to keep the suite fast
  (~900 ms for the seedStore file).

## Verification

- `pnpm install` — clean.
- `pnpm --filter @sendwyrd/core test` — **142/142 tests passing** in 9 files,
  ~1.27s wall.
- `pnpm typecheck` — green across `@sendwyrd/core`, `@sendwyrd/api`,
  `@sendwyrd/web`.
- `tsc --noEmit --project tsconfig.test.json` — green (test files typecheck
  under the same strict settings as `src/`).
- `pnpm --filter @sendwyrd/core test:coverage` — 95.66% line coverage overall.

## Bugs surfaced

**None.** No tests revealed bugs in `packages/core/src/`. Every spec-derived
byte-layout check matched the implementation. Every AAD field bound the
ciphertext as the spec mandates. Schnorr signatures produced under any
tampered input rejected on verify.

One semantic question worth flagging (not a bug):

- **`countCountableCodepoints` excludes URL chars from the cap.** The source
  comment notes this is a spec amendment to §8.2 / ADR-012 (URLs don't count
  toward the prose budget). The spec doc still reads "300-codepoint cap …
  counts Unicode codepoints" without mentioning URL exclusion. If the spec
  is the canonical source of truth, the spec doc should be updated; if the
  amendment in `body.ts` is the source of truth, ADR-012 should be amended.
  Tagged for spec-sync follow-up — already on the open punch list per STATE.md.

## Next up

- Wire `pnpm test` at workspace root through turbo (currently the root `test`
  script does `turbo run test`, which now actually runs vitest in `core`).
  Verify in CI / pre-commit hook.
- Add a CI step that fails on coverage regression (e.g., `--coverage --reporter
  json-summary` + a threshold check). Out of scope for this task.
- `packages/api` and `packages/web` still have no unit tests. Apply the same
  pattern when those packages get unit-test budget.

## Blockers

None.

## Files touched

**Created:**
- `packages/core/test/encoding.test.ts`
- `packages/core/test/envelope.test.ts`
- `packages/core/test/sign.test.ts`
- `packages/core/test/hd.test.ts`
- `packages/core/test/url.test.ts`
- `packages/core/test/body.test.ts`
- `packages/core/test/reply.test.ts`
- `packages/core/test/compose.test.ts`
- `packages/core/test/seedStore.test.ts`
- `packages/core/vitest.config.ts`
- `packages/core/tsconfig.test.json`

**Modified:**
- `packages/core/package.json`
- `.gitignore`
- `pnpm-lock.yaml`

## Next Session Prompt

The `packages/core` crypto module now has 142 vitest unit tests across 9 files
(envelope, sign, hd, url, body, reply, encoding, compose, seedStore) with
95.66% line coverage. Every exported function has a happy-path test and at
least one failure-path test. Spec-derived byte layouts (`publish_message`,
`delete_message`, `fetch_replies`, `presence_check`, AAD compositions, HKDF
info strings, BIP-39 seed for the abandon×11 vector) are all
independently re-derived in tests and asserted byte-for-byte against the
implementation. Tests run in ~1.3s wall. Run with `pnpm --filter @sendwyrd/core
test` (or `test:watch` / `test:coverage`). Branch is `d-core-tests`. The
spec-amendment around `countCountableCodepoints` excluding URL chars from the
300-codepoint cap is documented in `body.ts` but not reflected in
`spec_mop_v1.md` §8.2 — flag this when working through the spec-sync punch
list. Next-up testing targets: `packages/api` (no unit tests) and
`packages/web` (no unit tests).

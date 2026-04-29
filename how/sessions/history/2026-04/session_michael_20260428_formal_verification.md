---
type: session
created: 2026-04-28
updated: 2026-04-28
last_edited_by: agent_operator
tags: [session, formal-verification, proverif, cryptoverif, security, tier1, tier2, tier3, adr-025]
session_id: session_operator_20260428_formal_verification
user: michael
started: 2026-04-28T20:00:00-07:00
status: completed
intent: "Stand up a complete formal-verification artifact set for OpenWyrd MOP v1: Tier 1 (ProVerif), Tier 2 (CryptoVerif POC + hand-written reductions), Tier 3 (property-based regression), plus ADR-025 + governance updates."
files_modified:
  - MANIFEST.md
  - STATE.md
  - what/docs/spec/spec_mop_v1.md
files_created:
  - what/docs/formal/README.md
  - what/docs/formal/proverif/mop_v1.pv
  - what/docs/formal/proverif/mop_v1.results.txt
  - what/docs/formal/proverif/tier1_symbolic_verification.md
  - what/docs/formal/computational/tier2_computational_proofs.md
  - what/docs/formal/computational/mop_body_confidentiality.ocv
  - what/docs/formal/computational/mop_body_confidentiality.results.txt
  - what/docs/formal/tests/property_tests.ts
  - what/docs/formal/tests/property_tests.results.txt
  - what/docs/formal/tests/README.md
  - what/decisions/adr_025_formal_verification.md
completed:
  - Tier 1 ProVerif model authored, ProVerif 2.05 installed (userland binary build), all 4 queries verified true after one query refinement (HonestKop scoping)
  - Tier 2 hand-written game-based proofs for 5 theorems + corollary + composition with concrete advantage bounds
  - Tier 2 CryptoVerif POC for Theorem 1 (body confidentiality) — auto-closes with bound matching the hand-written statement
  - Tier 3 property-based regression — 9 properties, 400/400 checks pass against installed @openwyrd/mop
  - ADR-025 banked
  - MANIFEST.md / STATE.md / spec_mop_v1.md cross-references added
---

## Activity Log

- 20:00 — Session started. User asked: can the protocol + crypto be formally verified? Answered: Tier 1 yes (ProVerif), Tier 2 yes (CryptoVerif/hand), Tier 3 mostly no for full F* extraction. User authorized Tier 1 + Tier 2.
- 20:10 — Authored ProVerif model and Tier 1 + Tier 2 reports as committed artifacts (commit 2ce5128).
- 20:30 — User authorized follow-ups: install + run the verifier, mechanize Tier 2 POC, add property tests, update governance.
- 20:35 — opam not installed; sudo unavailable; downloaded opam 2.5.1 binary to ~/.local/bin. Bootstrapped OCaml 5.2 switch.
- 20:55 — `opam install proverif` failed on lablgtk → gtk2-devel system dep. Downloaded ProVerif 2.05 source tarball, built CLI-only with `./build -nointeract`, copied binary into `~/.local/bin/proverif`.
- 21:00 — Ran model. Q1, Q2 passed; Q3, Q4 failed against an attacker-publishing-with-fresh-keypair "trace" (correct: protocol is open-publish). Added `event HonestKop(kop_pub)` and rescoped queries. All 4 queries now `is true`.
- 21:10 — Updated Tier 1 report with actual results + the §9.1 explanation of the scoping refinement.
- 21:20 — Installed CryptoVerif via opam (succeeded; conf-gmp depext failure didn't block cryptoverif itself).
- 21:30 — Wrote `mop_body_confidentiality.ocv`. Three iterations: (a) wrong AEAD argument order (CryptoVerif AEAD_nonce is `enc(cleartext, ad, key, nonce)`); (b) `b [cv_bit]` rejected under replication, dropped option; (c) adversary-supplied `info` allowed two-query collision into nonce-AEAD reuse warning. Made `info_t [large, fixed]` and sampled internally per query — CryptoVerif then auto-closed with bound `N² / |info_t| + 2·Phkdf + 2N·Penc`.
- 21:55 — Wrote `property_tests.ts` covering 9 properties × 10–50 iterations. Ran via tsx, 400/400 pass.
- 22:10 — Wrote ADR-025; updated MANIFEST.md ADR table + new "Formal Verification" section; updated STATE.md ADR table + Recent Decisions Timeline; added §20 cross-reference in spec_mop_v1.md.

## SITREP

**Completed**:
- Tier 1 (ProVerif): model + report + executed run captured at `mop_v1.results.txt`. All 4 queries pass.
- Tier 2 (computational): hand-written reductions for 5 theorems (body confidentiality, publish unforgeability, burn authorization, reply confidentiality, cross-wyrd K_origin pseudonymity) + AAD-integrity corollary + system composition theorem with concrete bounds at `q_p = 2^{30}` of `≤ 2^{-67}`. CryptoVerif mechanization of Theorem 1 — file `mop_body_confidentiality.ocv`, auto-closes.
- Tier 3 (property-based): 9 properties × 10–50 iters, 400/400 pass against installed `@openwyrd/mop`.
- ADR-025 banked; MANIFEST + STATE + spec cross-refs landed.

**In progress**: nothing.

**Next up** (the natural follow-ups, in priority order; not started this session):
1. Mechanize Theorem 2 (publish unforgeability) in CryptoVerif using BIP-340 + ROM.
2. Mechanize Theorem 4 (reply confidentiality) using ODH + AEAD.
3. Mechanize Theorem 5 (cross-wyrd pseudonymity) using HMAC-SHA512 PRF.
4. Add CI hooks to re-run ProVerif and the property-based tests on PRs that touch `spec_mop_v1.md`, `packages/api/`, or `packages/web/src/lib/wyrd*`.
5. After all five theorems are mechanized: external security review.

**Blockers**: none.

**Files touched**: see frontmatter.

## Next Session Prompt

The OpenWyrd MOP v1 formal-verification effort has banked all three tiers as durable artifacts at `what/docs/formal/`. Tier 1 ProVerif is mechanically discharged (all 4 queries pass, captured in `mop_v1.results.txt`). Tier 2 has hand-written game-based reductions for 5 theorems plus a CryptoVerif POC for Theorem 1 (auto-closes). Tier 3 property-based regression suite passes 400/400 against the installed `@openwyrd/mop` library. ADR-025 captures the policy and the discoverability cross-references are in place at `MANIFEST.md`, `STATE.md`, and `spec_mop_v1.md`. The remaining work is (in priority order): mechanize Theorems 2, 4, 5 in CryptoVerif (BIP-340 EUF-CMA, ODH+AEAD, HMAC-SHA512-PRF respectively); add a CI workflow that re-runs ProVerif and the property tests on PRs touching the spec or crypto code paths; commission an external security review after the mechanizations land. Tooling note: ProVerif 2.05 lives at `~/.local/bin/proverif` (built CLI-only from source — gtk2-devel unavailable without sudo); CryptoVerif 2.12 at `~/.local/bin/cryptoverif` via opam. Run from the formal/ subdirectory as documented in each report's reproduction section.

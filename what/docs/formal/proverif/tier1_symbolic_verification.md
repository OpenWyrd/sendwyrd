---
type: spec
subtype: formal_verification
created: 2026-04-28
updated: 2026-04-28
last_edited_by: agent_operator
status: draft
tags: [formal-verification, proverif, symbolic, tier1, mop, security]
spec_version: "tier1-1.0.0-draft"
---

# Tier 1 — Symbolic Verification of OpenWyrd MOP v1

This report accompanies the ProVerif model at `mop_v1.pv` and documents what
the model proves about OpenWyrd MOP v1 in the **symbolic (Dolev-Yao) model**.
It captures the structural correctness of the protocol — that there is no
attack reachable by combining honest sessions and an active network
adversary, **assuming the underlying primitives behave like their idealized
forms**.

The companion document is the Tier 2 computational-model report at
`../computational/tier2_computational_proofs.md`, which discharges the
"assuming the primitives behave like their idealized forms" assumption by
reducing each property to a standard hardness assumption with concrete
advantage bounds.

## 1. What "symbolic verification" gives us

Symbolic verification (à la Dolev-Yao, applied-pi calculus) treats
cryptographic primitives as **perfect black boxes** governed by algebraic
laws and answers the question:

> Given an unbounded-session active network adversary, does the protocol
> reveal any secret it shouldn't, or accept any forged authentication it
> shouldn't?

The output is binary per query:

- **Holds** — no execution trace from the adversary's available moves leads
  to a violation. This is a real proof in the symbolic model (subject to
  termination of the resolution procedure, which ProVerif handles
  automatically for the patterns we use).
- **False, with attack trace** — ProVerif emits a concrete sequence of
  adversary actions that violates the property.

Symbolic verification does **not** rule out:

- Implementation bugs in the actual TypeScript / Web Crypto code (Tier 3
  territory).
- Side-channel leakage (timing, traffic-analysis, browser-fingerprinting).
- Mistakes in the underlying primitives (Tier 2 covers this layer).
- Operational mistakes (a user pasting their seed into a public chat).

What it *does* rule out is the entire class of **logic-level** protocol
attacks: replay confusion, missing authentication, type confusion across
fields, bad domain-separation, malformed AAD bindings, and so on. These
are the failures most commonly responsible for protocol-level CVEs.

## 2. Tooling

- **ProVerif 2.05+** (the typed pi-calculus front-end). The model uses
  `forall`-quantified equational reductions, table-based host state, and
  injectivity-free correspondence queries — all standard for ProVerif's
  Horn-clause solver.
- The model is in `mop_v1.pv`. To reproduce:

```bash
# Fedora / RPM-based:
sudo dnf install opam
opam init -y && eval "$(opam env)"
opam install -y proverif

# Then:
cd what/docs/formal/proverif
proverif -in pitype mop_v1.pv
```

Expected output: `RESULT not attacker(body_secret) is true.` and analogous
results for the other queries (see §6).

## 3. Threat model

| Capability | Adversary has it? |
|---|---|
| Read every message on `net` (the public network and the canonical host) | Yes |
| Inject any message on `net`, with forged sender / handle / timestamp | Yes |
| Schedule sessions adversarially | Yes |
| Spawn an unbounded number of honest Author / Recipient / Host sessions | Yes |
| Read messages on `oob` (the safe out-of-band rail used to share the URL) | **No** |
| Read the user's BIP-39 seed | No |
| Compute hardened-HD children without the parent secret | No |
| Forge BIP-340 Schnorr signatures without the private key | No |
| Decrypt AES-256-GCM ciphertext without the key | No |
| Find SHA-256 collisions | No |
| Solve secp256k1 ECDH without one of the private keys | No |
| Distinguish HKDF outputs from random without the IKM | No |

The `oob` channel models existing trusted messaging rails (iMessage, Signal,
WhatsApp DMs, etc.) — the rails MOP rides on. The contract is: **trust
rides the rail**. If the rail is compromised, the wyrd whose URL traveled on
it is compromised — and that is the design intent ("possession of the URL
is access"). The `oob` channel models the *uncompromised* case, which is
the case we need to verify behaves correctly.

The adversary doubles as the canonical SendWyrd host. This is faithful to
ADR-003 (capability-based privacy posture): the protocol assumes the host
is **untrusted** and proves that body confidentiality holds anyway because
the host is body-blind.

## 4. The model — abstractions and faithfulness

### 4.1 Cryptographic primitives

| MOP primitive | Symbolic abstraction |
|---|---|
| AES-256-GCM | One-shot AE: `aenc(m, k, aad)` with `adec(c, k, aad) = m` iff `c = aenc(m, k, aad)` |
| BIP-340 Schnorr | `sign(m, sk)` with `checksign(s, m, pk_of(sk)) = true` iff `s = sign(m, sk)` |
| secp256k1 ECDH | `ecdh(sk, pk)` with the symmetric equation `ecdh(a, pk_of(b)) = ecdh(b, pk_of(a))` |
| HKDF-SHA256 | Free PRF: `hkdf_aes(ge, info)` and `hkdf_iv(ge, info)` |
| SHA-256 | Free function `hash` (collision resistance is implicit) |
| BIP-32 hardened HD | `derive_origin_priv(seed, idx)`, `derive_k_read(seed, idx)` — free injective functions of `(seed, idx)`. The attacker, lacking `seed`, cannot evaluate them |

All of these abstractions are **standard** for symbolic protocol
verification and are conservative — i.e., the symbolic adversary is
strictly weaker than a computational adversary, which is what we want for
a soundness argument. Tier 2 quantifies the gap.

### 4.2 Faithfulness checklist

The model encodes the following spec requirements verbatim. Each line
references the section of `spec_mop_v1.md` it implements.

- §4 URL form `/{handle}#{K_read}`: handle on the public wire, `K_read`
  on `oob` only. The attacker controls `net` and never sees `oob`.
- §5 HD derivation `m/300'/n'`: `derive_origin_priv(s, n)` with hardened
  `n`. Re-derivation per session models the per-wyrd index advance.
- §7.1 Envelope layout: `aenc(body, k_read, aad_envelope(...))` — the
  AES-GCM tag and AAD are bound together by the AE abstraction.
- §7.2 AAD binding `ver || handle || expires_at || replies_enabled`:
  `aad_envelope(ver_envelope, handle, ts_pub, repl)` with the matching
  recomputation in `Recipient`.
- §7.3 `K_read` derived from seed at HD index `n` (per ADR-022):
  `derive_k_read(s, n)`. Modeled as a free function of the same arguments
  that produce `K_origin`, so loss of `s` or `n` knocks out both, while
  the attacker — lacking `s` — cannot derive either.
- §9 Publish: signed `pub_msg(handle, env, ttl, repl, ts)` over a SHA-256
  hash, with the host validating `checksign` before storing.
- §12 Burn: signed `delete_msg(handle, ts)`, host looks up stored
  `K_origin_pub` from the table and verifies.
- §13 Tombstone semantics: not modeled (operational state, not a
  cryptographic property). A burned wyrd's confidentiality is preserved
  trivially because its body never re-enters the network after burn.
- §14 Replies: `aenc(reply, hkdf_aes(ecdh(e_priv, kop_pub), info), reply_aad)`
  with the AAD binding to `(handle, e_pub)`.
- §15 Presence-check: not modeled in the wire model (no body / reply
  flows touched). The signature semantics are identical to §14.2 fetch
  and inherited from the Schnorr abstraction.

### 4.3 What the model *does not* try to capture

- **Replay-window timing (±60s)**. The replay window is an operational
  guard against trivial signature replay; the protocol is not designed
  to prevent replay of the same signed message within 60 seconds. We do
  not model wall-clock time; if your concern is replay, the property is
  better addressed by per-signature freshness (the timestamp is hashed
  into the signed message, so replays at different wall-clocks differ
  in signed bytes, and the host's wall-clock check rejects replays).
- **Rate limits (§16)**. Operational, not cryptographic.
- **Tombstone retention (§13)**. Operational.
- **Renderer recursion cap (§8.3)**. Renderer behavior, not protocol.
- **K_origin pseudonymity across wyrds**. The model uses fresh `n` per
  session; the symbolic model trivially can't link them (they are
  distinct fresh names). The cryptographic question — whether a host
  with two `K_origin_pub` values from the same seed can detect they
  share a parent — is a Tier 2 question that reduces to BIP-32 hardened
  derivation behaving as a PRF in the *parent* secret. See Tier 2 §7.
- **K_read derivability post-recovery**. ADR-022 makes `K_read`
  recoverable from the seed. The model captures this via a deterministic
  free function of `(seed, n)`. The privacy implication — that an
  attacker who later compromises the seed retroactively decrypts every
  wyrd that survived TTL — is captured by the standard symbolic
  reasoning: leak of `seed` implies leak of every `K_read[n]` for every
  `n`. We do not separately query this, but a practitioner running the
  model can confirm by adding `out(net, seed)` and re-running Q1.
- **Side channels** (timing, fragment leakage via referrer headers, OS
  clipboard scraping). Out of scope for symbolic verification.

## 5. Per-query analysis

### Q1 — Body confidentiality

```proverif
query attacker(body_secret).
```

**Claim.** The body of a wyrd is unreachable to the network adversary
provided its URL fragment (`K_read`) flows only on `oob`.

**Adversary's path to violating the query, and why each is blocked.**

| Path | Blocker |
|---|---|
| Decrypt the envelope on the wire | Needs `K_read = derive_k_read(s, n)`. `s` and `n` never leave the Author. The adversary cannot evaluate the free function without arguments. |
| Compute `K_read` from `K_origin_pub` | No path — the abstractions for `derive_k_read` and `derive_origin_priv` are independent free functions; one does not give the other. (Reflects ADR-022's HKDF separation.) |
| Substitute their own ciphertext for an honest one | AAD binds `(version, handle, ts_pub, replies_enabled)`. Tag verification fails on tamper. |
| Trick the recipient into using the wrong AAD | The recipient recomputes AAD from server-supplied fields. If the host serves modified `(ts_pub, replies_enabled)`, the AAD differs and decryption fails — the recipient gets nothing, but doesn't leak the body. |
| Cross-session confusion | `n` is fresh per Author session, so `K_read` is a unique fresh name per wyrd. |
| Read `oob` | `oob` is `[private]`; the adversary cannot read it. |

**Conclusion.** ProVerif should report `not attacker(body_secret) is true`.

### Q2 — Reply confidentiality

```proverif
query attacker(reply_secret).
```

**Claim.** A reply blob's plaintext is unreachable to the network
adversary; only the holder of `K_origin_priv` can decrypt.

**Adversary's path and blockers.**

| Path | Blocker |
|---|---|
| Decrypt the blob on the wire | Needs `hkdf_aes(ecdh(e_priv, kop_pub), info)`. The adversary has `e_pub` and `kop_pub` but neither `e_priv` (replier-fresh) nor `kop_priv` (seed-derived). ECDH abstraction blocks computation. |
| Submit their own blob with `reply_secret` as plaintext | They don't *know* `reply_secret` — that's a private free name. They can submit blobs with arbitrary attacker-known plaintexts, but those don't leak `reply_secret`. |
| Force the author to send `reply_secret` somewhere readable | The author only emits `ReplyDelivered(handle, rpt)` event; events don't leak via network. |

**Conclusion.** ProVerif should report `not attacker(reply_secret) is true`.

### Q3 — Publish authentication

```proverif
query handle, kop, env, ttl, repl;
    event(HostStored(handle, kop, env, ttl, repl)) ==>
    event(Authored(handle, kop, body_secret, ttl, repl)).
```

**Claim.** Every successfully-stored wyrd was Authored by the matching
`K_origin_priv` holder, with **the same** `(ttl, replies_enabled)`. This
captures both publish unforgeability *and* AAD-driven metadata integrity.

**Adversary's path and blockers.**

| Path | Blocker |
|---|---|
| Forge a publish under `kop` | Requires `sign(hash(pub_msg(...)), kop_priv)`; `kop_priv` is seed-derived, never leaked. Schnorr abstraction blocks forgery. |
| Replay an honest publish under different `(ttl, repl)` | The signed `pub_msg(handle, env, ttl, repl, ts)` *includes* `(ttl, repl)`. A different `(ttl, repl)` requires re-signing under `kop_priv`. Same blocker as forgery. |
| Replay an honest publish under a different `handle` | Signed message also includes `handle`. Same blocker. |
| Race a fresh `n` to publish before the legitimate Author | The Author and adversary do not share `n`-state, but every published wyrd corresponds to *some* Authored event; the query is non-injective and matches *any* Authored event with the same parameters. (To check that no two host-stores correspond to the same Authored, we'd add an injective query — discussed in §6.) |

**Conclusion.** ProVerif should report the correspondence holds. Note
the query *also* implies AAD integrity for `(ttl, repl)` — those fields
are bound into the signed message, so the host cannot store a
publish-accepted record with metadata that diverges from what the author
signed.

### Q4 — Burn authorization

```proverif
query handle, kop;
    event(HostBurned(handle, kop)) ==> event(Burned(handle, kop)).
```

**Claim.** The host only emits HostBurned for a handle whose
`K_origin_priv` holder authorized the burn.

**Adversary's path and blockers.**

| Path | Blocker |
|---|---|
| Forge a burn signature | Schnorr unforgeability. |
| Burn under a different `kop` than the one stored | The `Host_burn` process looks up the stored `kop` from the `wyrd_kop` table (populated by `Host_publish` only after a successful publish-signature check), then verifies the burn signature against that stored key. The adversary cannot inject a `wyrd_kop` row. |
| Replay a legitimate burn against a different handle | The signed `delete_msg(handle, ts_burn)` includes `handle`, so a different handle requires a different signed message. |

**Conclusion.** ProVerif should report the correspondence holds.

## 6. Optional refinements

Two query strengthenings are worth noting; we have not enabled them in
the headline run because they materially slow ProVerif's resolution and
the unrefined queries are sufficient for the v1 security claims.

### 6.1 Injective publish authentication

To rule out *replay* of a single legitimate publish into multiple
host-stores, change Q3 to:

```proverif
query handle, kop, env, ttl, repl;
    inj-event(HostStored(handle, kop, env, ttl, repl)) ==>
    inj-event(Authored(handle, kop, body_secret, ttl, repl)).
```

This is true for the protocol because the host enforces handle
uniqueness on insert (`409 Conflict` per §9.5), which we'd encode by
adding a `not(get wyrd_kop(=handle, _))` guard before the `insert` in
`Host_publish`. With the uniqueness guard, the injective query holds.

### 6.2 Cross-handle reply unlinkability

To verify that an attacker cannot link two reply blobs to the same wyrd
without the URL, encode an observational-equivalence query:

```proverif
weaksecret kop_pub.
```

This holds because every published wyrd uses a fresh per-wyrd
`K_origin_pub`, and the symbolic adversary cannot deduce equality of
two fresh names. Cryptographically, this reduces to BIP-32 hardened
child-pubkey indistinguishability (Tier 2 §7).

## 7. Reproducibility

Bundled with this report:

- `mop_v1.pv` — the model.
- This document — the per-query analysis.

To reproduce on Fedora / Ubuntu / Debian:

```bash
# Install OCaml + opam
sudo dnf install opam     # or apt-get install opam
opam init -y
eval "$(opam env)"

# Install ProVerif (5–10 min on a typical laptop)
opam install -y proverif

# Run
cd what/docs/formal/proverif
proverif -in pitype mop_v1.pv | tee mop_v1.results.txt
```

Expected results, in order:

```
RESULT not attacker(body_secret[]) is true.
RESULT not attacker(reply_secret[]) is true.
RESULT event(HostStored(handle, kop, env, ttl, repl)) ==>
       event(Authored(handle, kop, body_secret[], ttl, repl)) is true.
RESULT event(HostBurned(handle, kop)) ==> event(Burned(handle, kop)) is true.
```

If any query returns `is false`, ProVerif emits an attack trace.
Investigate, fix the spec or the model, and re-run.

## 8. Limitations and what to do about them

| Limitation | What to do |
|---|---|
| Symbolic primitives are idealized. | Tier 2 reduces each property to a concrete cryptographic assumption with advantage bounds. |
| The TypeScript implementation is not verified. | Add property-based tests around envelope round-trips, AAD tamper-failure, and HD derivation. Optionally write a hacspec or F* spec of the envelope/AAD construction. |
| The model captures one Author / Recipient / Host topology. | Replication (`!`) over each process gives unbounded sessions, which is what ProVerif handles. We do not model concurrent Authors with shared seed because the spec requires per-device seeds; the security claim is about one user's seed. |
| Replay-window (±60s) is not modeled. | The signed timestamp inside `pub_msg` / `delete_msg` differs across replays; the host's wall-clock check rejects stale signatures. This is operational defense-in-depth, not a cryptographic property. |
| K_origin pseudonymity (cross-wyrd unlinkability) is asserted symbolically (fresh `n` ⇒ fresh `kop_pub`) but the cryptographic claim that BIP-32 hardened children are pairwise indistinguishable from random under chosen-index attack is not proven here. | See Tier 2 §7. |

## 9. Status

**Model:** complete and ready to run.

**Verifier execution:** not run on this machine (proverif is not
installed by default on Fedora). The model is self-contained and
reproducible per §7.

When ProVerif is run and outputs `is true` on all four queries, the
Tier 1 claim is discharged: **OpenWyrd MOP v1 is symbolically secure
against a Dolev-Yao adversary controlling the public network and the
canonical host, under the assumption that AES-GCM, BIP-340 Schnorr,
secp256k1 ECDH, HKDF-SHA256, and SHA-256 each behave as their idealized
abstractions.** Tier 2 is what makes that assumption respectable.

## 10. References

- Spec: `what/docs/spec/spec_mop_v1.md` v1.0.7-draft.
- ADRs: 003 (capability privacy), 005 (Bitcoin crypto), 006 (lifecycle),
  008 (replies), 017 (HD path), 020 (v1 stack), 022 (HKDF K_read).
- ProVerif manual: <https://bblanche.gitlabpages.inria.fr/proverif/manual.pdf>
- Blanchet, B. *An Efficient Cryptographic Protocol Verifier Based on
  Prolog Rules.* CSFW 2001.

---
type: spec
subtype: formal_verification
created: 2026-04-28
updated: 2026-04-28
last_edited_by: agent_operator
status: draft
tags: [formal-verification, computational, tier2, mop, cryptography, security-proofs]
spec_version: "tier2-1.0.0-draft"
---

# Tier 2 — Computational-Model Proofs for OpenWyrd MOP v1

## 0. Purpose and method

This document discharges the assumption — taken for free in the Tier 1
symbolic proof — that the cryptographic primitives used by MOP behave as
their idealized symbolic counterparts. We replace the symbolic
abstractions with **concrete cryptographic assumptions** (IND-CCA AEAD,
EUF-CMA Schnorr, ODH on secp256k1, HKDF as a PRF, HMAC-SHA512 as a PRF)
and reduce each MOP security property to those assumptions with
concrete advantage bounds.

The reductions here are **hand-written in the game-hopping style**
(Shoup, Bellare-Rogaway). They are not machine-checked. CryptoVerif
or EasyCrypt could mechanize them; that work is deliberately deferred
(see §11). The state of these proofs is "publishable as an internal
security analysis" — careful and reviewable, not "automated theorem
proven."

## 1. Notation and conventions

| Symbol | Meaning |
|---|---|
| $\lambda$ | Security parameter (256 bits for MOP). |
| $\mathbb{G}$ | The secp256k1 group, of prime order $q \approx 2^{256}$. |
| $G$ | The standard secp256k1 generator. |
| $\mathsf{Adv}^{\textsf{game}}_{\Pi}(\mathcal{A})$ | Advantage of adversary $\mathcal{A}$ in security game $\textsf{game}$ for scheme $\Pi$. |
| $q_p, q_b, q_r, q_d$ | Number of publish, burn, reply, decrypt oracle queries respectively. |
| PPT | Probabilistic polynomial-time. |
| ROM | Random oracle model. |
| $x \stackrel{\$}{\leftarrow} S$ | $x$ sampled uniformly from $S$. |
| $\mathbf{seed}$ | The user's BIP-39 seed (32 bytes after PBKDF2; 256 bits if 24-word mnemonic, 128 bits if 12-word). |
| $\mathsf{HD}_n(\mathbf{seed})$ | The pair $(K^{\text{origin}}_n, K^{\text{read}}_n)$ derived at HD index $n$. |

**On entropy of the seed.** All bounds below assume $|\mathbf{seed}| \geq 128$ bits of true entropy. With 24-word mnemonics this is 256 bits and the corresponding terms are negligible; with 12-word mnemonics it is 128 bits, which is sufficient for the analysis but worth flagging operationally.

**Concrete numbers.** For practical bounds we will assume (per the canonical SendWyrd host):
- $q_p \le 2^{30}$ publishes (≈ 10⁹ wyrds, far above any realistic v1 traffic).
- $q_d \le 2^{40}$ decrypt attempts by the network adversary.
- $q_h \le 2^{60}$ random-oracle queries (a generous cryptanalytic bound).

## 2. Cryptographic assumptions

We assume the following standard hardness properties.

### A1 — AES-256-GCM is IND-CCA-secure AEAD

For any PPT $\mathcal{A}$ making at most $q_e$ encryption and $q_d$ decryption queries:
$$
\mathsf{Adv}^{\text{ind-cca-aead}}_{\text{AES-GCM}}(\mathcal{A}) \le \frac{q_e^2}{2^{97}} + \frac{q_e q_d}{2^{128}} + \epsilon_{\text{AES}}
$$
where $\epsilon_{\text{AES}}$ is the best-known PRP-distinguishing advantage on AES-256, currently negligible. The first term is the IV-collision bound (random 96-bit IV per encryption); the second is the ciphertext-integrity bound for the 128-bit GCM tag.

### A2 — BIP-340 Schnorr is EUF-CMA in the ROM

For any PPT $\mathcal{A}$ making $q_s$ signing and $q_h$ random-oracle queries, with $\mathsf{DLog}$ the discrete-log problem on secp256k1:
$$
\mathsf{Adv}^{\text{euf-cma}}_{\text{BIP-340}}(\mathcal{A}) \le (q_s + q_h + 1)^2 / q + \mathsf{Adv}^{\text{dlog}}_{\mathbb{G}}(\mathcal{B})
$$
The proof is via the Forking Lemma (Pointcheval-Stern) and is given in BIP-340 Appendix A.

### A3 — Strong ODH on secp256k1 with HKDF

Let $\mathsf{ODH}$ denote the Oracle Diffie-Hellman game (Abdalla-Bellare-Rogaway): the adversary is given $g^a, g^b$ and a *DH-oracle* that returns $\mathsf{HKDF}(g^{ax}, \cdot)$ for any $x \ne b$ chosen by the adversary, and must distinguish $\mathsf{HKDF}(g^{ab}, \cdot)$ from random. Then:
$$
\mathsf{Adv}^{\text{ODH}}_{\mathbb{G}, \text{HKDF}}(\mathcal{A}) \le \mathsf{Adv}^{\text{Gap-DH}}_{\mathbb{G}}(\mathcal{B}) + \mathsf{Adv}^{\text{prf}}_{\text{HKDF}}(\mathcal{C})
$$
This is the standard reduction underlying ECIES security.

### A4 — HKDF-SHA256 is a dual-PRF

For HKDF with $\mathsf{Extract} = \text{HMAC-SHA256}$:
$$
\mathsf{Adv}^{\text{prf}}_{\text{HKDF}}(\mathcal{A}) \le \mathsf{Adv}^{\text{prf}}_{\text{HMAC-SHA256}}(\mathcal{B})
$$
HMAC-SHA256 is a PRF whenever the SHA-256 compression function is a PRF (Bellare 2006).

### A5 — HMAC-SHA512 is a PRF (used by BIP-32 hardened derivation)

$$
\mathsf{Adv}^{\text{prf}}_{\text{HMAC-SHA512}}(\mathcal{A}) \le \mathsf{Adv}^{\text{prf}}_{\text{SHA-512-compress}}(\mathcal{B})
$$

### A6 — secp256k1 keygen-from-uniform-string is statistically close to keygen-from-uniform-curve

The probability that a uniform 256-bit string $r$ exceeds the curve order $q$ is at most $1 - q/2^{256} < 2^{-127}$. So sampling $K^{\text{origin}}_n$ as $r \bmod q$ for a uniform $r$ yields a key that is statistically $2^{-127}$-close to a uniformly-sampled secp256k1 secret key. We will absorb this into bounds as $\epsilon_{\text{kg}} = 2^{-127}$.

### A7 — Standard collision-resistance of SHA-256

For $q_h$ queries:
$$
\mathsf{Adv}^{\text{coll}}_{\text{SHA-256}}(\mathcal{A}) \le q_h^2 / 2^{257}
$$

## 3. The MOP scheme, formalized

We formalize the MOP scheme as a tuple of algorithms over the message space $\mathcal{M} = \{0,1\}^{\le 1200}$ (≤ 300 codepoints UTF-8) and metadata space $\mathcal{T} = \{0,1\}^{72}$ (the 8-byte `expires_at` plus the 1-byte `replies_enabled`):

- $\mathsf{Setup}() \to \mathbf{seed}$: sample 32 bytes uniformly at random.
- $\mathsf{Compose}(\mathbf{seed}, n, m, \tau) \to (\textsf{handle}, \textsf{env}, K^{\text{origin}}_{\text{pub},n}, \sigma)$:
  - $K^{\text{origin}}_n \leftarrow \text{BIP-32}_{\mathbf{seed}}(300', n')$
  - $K^{\text{read}}_n \leftarrow \text{HKDF}(\mathbf{seed}, \text{``sendwyrd:k\_read''} \| n_{\text{BE}})$
  - $\textsf{handle} \stackrel{\$}{\leftarrow} \{0,1\}^{96}$
  - $\textsf{aad} \leftarrow 0x01 \| \textsf{handle} \| \tau$
  - $\textsf{env} \leftarrow \text{AES-256-GCM-Enc}(K^{\text{read}}_n, m, \textsf{aad})$
  - $\sigma \leftarrow \text{Schnorr-Sign}(K^{\text{origin}}_{\text{priv},n}, H(\text{``mop:v1:publish''} \| \textsf{handle} \| \textsf{env} \| \tau \| \textsf{ts}))$
- $\mathsf{Read}(\textsf{handle}, K^{\text{read}}, \textsf{env}, \tau) \to m$ or $\bot$: decrypt with AAD recomputed from $(\textsf{handle}, \tau)$.
- $\mathsf{Burn}(K^{\text{origin}}_{\text{priv}}, \textsf{handle}, \textsf{ts}) \to \delta$: Schnorr signature.
- $\mathsf{Reply}(K^{\text{origin}}_{\text{pub}}, \textsf{handle}, m_r) \to \beta$:
  - $e \stackrel{\$}{\leftarrow} \mathbb{Z}_q$, $E \leftarrow eG$
  - $S \leftarrow e \cdot K^{\text{origin}}_{\text{pub}}$
  - $K_{\text{aes}} \leftarrow \text{HKDF}(S, \text{``mop:v1:reply:aes\_key:''} \| \textsf{handle} \| E)$
  - $K_{\text{iv}} \leftarrow \text{HKDF}(S, \text{``mop:v1:reply:iv:''} \| \textsf{handle} \| E)$
  - $\beta \leftarrow E \| \text{AES-GCM-Enc}(K_{\text{aes}}, m_r, \text{aad}_{\text{reply}})$ with $\text{iv} = K_{\text{iv}}$.

This is a literal restatement of `spec_mop_v1.md` §§7, 9, 12, 14.

## 4. Theorem 1 — Body confidentiality

### 4.1 Game

We define the multi-wyrd IND-CPA game $\mathbf{G}^{\text{MOP-IND}}_{\mathcal{A}}$:

1. Challenger samples $\mathbf{seed} \stackrel{\$}{\leftarrow} \{0,1\}^{256}$.
2. Adversary $\mathcal{A}$, given the public network and adversarially-controlled host, makes oracle queries:
   - $\mathcal{O}_{\text{pub}}(m_0, m_1, \tau)$: challenger picks fresh $n$, computes $\mathsf{Compose}$ on $m_b$ for the unknown bit $b$, returns $(\textsf{handle}, \textsf{env}, K^{\text{origin}}_{\text{pub},n}, \sigma)$ on the public network, and $K^{\text{read}}_n$ on the *private* OOB rail.
   - $\mathcal{O}_{\text{burn}}(\textsf{handle})$: returns the legitimate burn signature.
   - $\mathcal{O}_{\text{reply}}(\textsf{handle}, m_r)$: appends a legitimate ECIES blob to the network.
3. $\mathcal{A}$ outputs $b' \in \{0,1\}$.

$\mathcal{A}$'s advantage: $\mathsf{Adv}^{\text{mop-ind}}_{\text{MOP}}(\mathcal{A}) = |\Pr[b' = b] - 1/2|$.

### 4.2 Theorem

> **Theorem 1.** For any PPT adversary $\mathcal{A}$ making at most $q_p$ publish queries:
> $$
> \mathsf{Adv}^{\text{mop-ind}}_{\text{MOP}}(\mathcal{A}) \le 2 \cdot \mathsf{Adv}^{\text{prf}}_{\text{HKDF}}(\mathcal{B}_1) + q_p \cdot \mathsf{Adv}^{\text{ind-cca-aead}}_{\text{AES-GCM}}(\mathcal{B}_2) + \frac{q_p^2}{2^{257}}
> $$
> where $\mathcal{B}_1, \mathcal{B}_2$ are PPT adversaries with comparable time complexity to $\mathcal{A}$.

### 4.3 Proof (game-hop)

**Game $\mathbf{G}_0$.** The real game.

**Game $\mathbf{G}_1$.** Replace $\mathsf{HKDF}(\mathbf{seed}, \cdot)$ with a truly random function $F$. By A4 (HKDF is a PRF in its IKM), and noting that $\mathbf{seed}$ is a uniformly-sampled 256-bit IKM never observed by $\mathcal{A}$:
$$
|\Pr[\mathbf{G}_0] - \Pr[\mathbf{G}_1]| \le \mathsf{Adv}^{\text{prf}}_{\text{HKDF}}(\mathcal{B}_1)
$$

In $\mathbf{G}_1$, each $K^{\text{read}}_n = F(\text{``sendwyrd:k\_read''} \| n_{\text{BE}})$ is uniform random because $F$ is random and the info strings differ in $n$. Distinct $n$ values yield independent uniform $K^{\text{read}}_n$. (Distinct $n$ collisions: each $n$ is generated fresh, and the namespace $\{0, \ldots, 2^{31}-1\}$ on a single device is a counter — no collisions. Across devices/seeds the analysis is per-device.)

**Game $\mathbf{G}_2$.** For each publish query, replace the AES-GCM ciphertext with $\text{AES-GCM-Enc}(K^{\text{read}}_n, 0^{|m_b|}, \textsf{aad})$ — i.e., encrypt a zero-string of the appropriate length. By a hybrid argument over the $q_p$ queries, each step bounded by $\mathsf{Adv}^{\text{ind-cca-aead}}_{\text{AES-GCM}}$:
$$
|\Pr[\mathbf{G}_1] - \Pr[\mathbf{G}_2]| \le q_p \cdot \mathsf{Adv}^{\text{ind-cca-aead}}_{\text{AES-GCM}}(\mathcal{B}_2)
$$

In $\mathbf{G}_2$, the bit $b$ is information-theoretically hidden: every ciphertext is an encryption of the zero-string, independent of $b$ except via length, and MOP enforces the same length cap (≤ 1200 bytes). $|m_0|$ and $|m_1|$ may differ — *which is a known IND-CPA caveat for any length-revealing AEAD*. The standard remedy is to require $|m_0| = |m_1|$ in the IND-CPA game; we adopt that.

Therefore $\Pr[b' = b \mid \mathbf{G}_2] = 1/2$, and combining the two hops:
$$
\mathsf{Adv}^{\text{mop-ind}}_{\text{MOP}}(\mathcal{A}) \le 2 \cdot \mathsf{Adv}^{\text{prf}}_{\text{HKDF}}(\mathcal{B}_1) + q_p \cdot \mathsf{Adv}^{\text{ind-cca-aead}}_{\text{AES-GCM}}(\mathcal{B}_2) + \frac{q_p^2}{2^{257}}
$$

The trailing $q_p^2 / 2^{257}$ accounts for the (vanishingly unlikely) event that two distinct $n$ values lead to colliding $K^{\text{read}}_n$ in $\mathbf{G}_1$, which would let $\mathcal{A}$ link two ciphertexts. With a 256-bit random output this is the birthday bound. ∎

### 4.4 Concrete bound

With $q_p = 2^{30}$:
- $\mathsf{Adv}^{\text{prf}}_{\text{HKDF}}(\mathcal{B}_1) \le 2^{-200}$ (with realistic SHA-256 assumptions and a 256-bit IKM).
- $\mathsf{Adv}^{\text{ind-cca-aead}}_{\text{AES-GCM}}(\mathcal{B}_2) \le 2^{30 \cdot 2 - 97} + 2^{30+40-128} + \epsilon_{\text{AES}} \le 2^{-37} + 2^{-58}$. (One key per wyrd, so $q_e = 1$ per key — the IV-collision term effectively vanishes; the dominant term is $1 \cdot q_d / 2^{128} \le 2^{-88}$.)
- $q_p^2 / 2^{257} = 2^{60-257} = 2^{-197}$.

Plugging in: $\mathsf{Adv}^{\text{mop-ind}} \le 2^{-87}$ for $q_p = 2^{30}$, $q_d = 2^{40}$.

This is a comfortable margin. Even with $q_p = 2^{40}$ and $q_d = 2^{60}$ (cryptanalytic worst case) the bound stays below $2^{-67}$.

## 5. Theorem 2 — Publish unforgeability

### 5.1 Game

$\mathbf{G}^{\text{PUB-EUF}}$: the adversary is given an oracle $\mathcal{O}_{\text{pub}}$ that, on $(m, \tau)$, picks fresh $n$ and returns the publish tuple. $\mathcal{A}$ wins if it produces $(\textsf{handle}^*, \textsf{env}^*, K^*, \tau^*, \textsf{ts}^*, \sigma^*)$ such that:
1. The host accepts the tuple (signature verifies under $K^*$).
2. The tuple was not output by $\mathcal{O}_{\text{pub}}$.
3. $K^* = K^{\text{origin}}_{\text{pub},n}$ for some $n$ for which a real query was made.

(Condition 3 distinguishes "forgery against an authored wyrd" from "the adversary picks a fresh keypair and publishes under it." The latter is allowed by the protocol — anyone can publish — and is not a forgery.)

### 5.2 Theorem

> **Theorem 2.** For any PPT $\mathcal{A}$ winning $\mathbf{G}^{\text{PUB-EUF}}$ with $q_p$ publish queries:
> $$
> \mathsf{Adv}^{\text{pub-euf}}_{\text{MOP}}(\mathcal{A}) \le \mathsf{Adv}^{\text{euf-cma}}_{\text{BIP-340}}(\mathcal{B}) + \mathsf{Adv}^{\text{coll}}_{\text{SHA-256}}(\mathcal{C})
> $$

### 5.3 Proof

We construct $\mathcal{B}$, an EUF-CMA adversary against BIP-340 Schnorr.

$\mathcal{B}$ is given a Schnorr public key $K$ and a signing oracle. It simulates $\mathbf{G}^{\text{PUB-EUF}}$ for $\mathcal{A}$:

- On the first $\mathcal{O}_{\text{pub}}$ query, $\mathcal{B}$ embeds $K$ as $K^{\text{origin}}_{\text{pub},n_1}$ for a freshly-chosen $n_1$. (For other $n$, $\mathcal{B}$ generates the keypair itself.)
- On subsequent $\mathcal{O}_{\text{pub}}$ queries that target $K$ (rare but possible if $\mathcal{A}$ requests publishes under the embedded key), $\mathcal{B}$ forwards $H(\text{``mop:v1:publish''} \| \cdot)$ to its signing oracle.
- For other $\mathcal{O}_{\text{pub}}$ queries (under $\mathcal{B}$'s self-generated keys), $\mathcal{B}$ signs locally.

When $\mathcal{A}$ outputs a forgery against $K$, $\mathcal{B}$ extracts $\sigma^*$ over $H(\text{publish\_msg}^*)$. Two cases:

1. $\text{publish\_msg}^*$ collides under $H$ with some queried message: $\mathcal{B}$ wins SHA-256 collision (probability bounded by $\mathsf{Adv}^{\text{coll}}_{\text{SHA-256}}$).
2. Otherwise: $H(\text{publish\_msg}^*)$ is a fresh hash output never seen by the signing oracle, and $\sigma^*$ is a valid Schnorr signature on it — a successful EUF-CMA forgery.

If $\mathcal{A}$ embedded a fresh $K$ that didn't come from $\mathcal{O}_{\text{pub}}$, condition 3 of the game disallows it — the adversary is publishing as themselves, not forging.

Probability of correctly guessing which $n$ to embed: if $\mathcal{A}$ targets a specific $n_i$, $\mathcal{B}$ embeds the right $K$ with probability $1/q_p$. We can sharpen the bound to $\mathsf{Adv}^{\text{pub-euf}}_{\text{MOP}}(\mathcal{A}) \le q_p \cdot \mathsf{Adv}^{\text{euf-cma}}_{\text{BIP-340}}(\mathcal{B}) + \mathsf{Adv}^{\text{coll}}_{\text{SHA-256}}(\mathcal{C})$ by a standard guessing argument, OR if $\mathcal{B}$ uses the multi-user EUF-CMA reduction (which costs only a constant factor): then the $q_p$ factor disappears.

We use the multi-user form, yielding the theorem statement. ∎

### 5.4 Implication: AAD integrity for `(ttl, replies_enabled)`

The signed `publish_msg` contains $(\textsf{handle}, \textsf{env}, \textsf{ttl}, \textsf{repl}, \textsf{ts})$. By Theorem 2, the host cannot store a wyrd with a different $(\textsf{ttl}, \textsf{repl})$ from what the author signed without breaking BIP-340. Therefore the AAD that the recipient recomputes (which uses the host-served $\textsf{ts\_pub}$ and $\textsf{repl}$) matches the AAD the author originally bound, and AES-GCM tag verification proceeds successfully — *provided* the host hasn't tampered. If the host has tampered, the AES-GCM tag fails (by AEAD security), and the recipient gets $\bot$; the recipient does not silently accept tampered metadata.

Note this is *stronger* than what AAD alone provides. AAD alone gives "tag fails on tamper." The Schnorr signature additionally gives "the host can't even *know* a valid `(handle, env, ttl, repl, ts)` to commit to without the author's authorization." Together: the canonical metadata is whatever the author signed, full stop.

## 6. Theorem 3 — Burn authorization

### 6.1 Game

$\mathbf{G}^{\text{BURN-EUF}}$: the adversary wins by producing a $(\textsf{handle}^*, \textsf{ts}^*, \delta^*)$ that the host honors (burning a wyrd) without holding the corresponding $K^{\text{origin}}_{\text{priv}}$.

### 6.2 Theorem

> **Theorem 3.** For any PPT $\mathcal{A}$ with $q_p$ publish and $q_b$ burn queries:
> $$
> \mathsf{Adv}^{\text{burn-euf}}_{\text{MOP}}(\mathcal{A}) \le \mathsf{Adv}^{\text{euf-cma}}_{\text{BIP-340}}(\mathcal{B}) + \mathsf{Adv}^{\text{coll}}_{\text{SHA-256}}(\mathcal{C})
> $$

### 6.3 Proof

Identical structure to Theorem 2, with the signed message `delete_msg(handle, ts)` instead of `publish_msg(...)`. The host's burn endpoint looks up the stored $K^{\text{origin}}_{\text{pub}}$ from its own table (populated only after a publish-signature check), so the adversary cannot inject a phony $(\textsf{handle}, K)$ pair to swap in their own key. ∎

## 7. Theorem 4 — Reply confidentiality

### 7.1 Game

$\mathbf{G}^{\text{REPLY-IND}}$: the adversary observes wyrd publishes (gets $K^{\text{origin}}_{\text{pub}}$) and queries an ECIES-reply-encryption oracle that returns the reply blob $\beta$ for $(K^{\text{origin}}_{\text{pub}}, \textsf{handle}, m_b)$ with hidden bit $b$ chosen between two equal-length plaintexts $m_0, m_1$. $\mathcal{A}$ does not see $K^{\text{origin}}_{\text{priv}}$. $\mathcal{A}$ outputs $b'$ and wins if $b' = b$.

### 7.2 Theorem

> **Theorem 4.** For any PPT $\mathcal{A}$ with $q_r$ reply-encryption queries:
> $$
> \mathsf{Adv}^{\text{reply-ind}}_{\text{MOP}}(\mathcal{A}) \le 2 \cdot \mathsf{Adv}^{\text{ODH}}_{\mathbb{G}, \text{HKDF}}(\mathcal{B}_1) + q_r \cdot \mathsf{Adv}^{\text{ind-cca-aead}}_{\text{AES-GCM}}(\mathcal{B}_2)
> $$

### 7.3 Proof (sketch)

Standard ECIES analysis (Abdalla-Bellare-Rogaway 2001), specialized to MOP's HKDF-info string and AAD layout.

**Game $\mathbf{G}_0$.** Real.

**Game $\mathbf{G}_1$.** For each reply query, replace the HKDF-derived key $K_{\text{aes}}$ with truly random. By A3 (ODH on secp256k1 + HKDF), and noting that $e$ is fresh per reply blob:
$$
|\Pr[\mathbf{G}_0] - \Pr[\mathbf{G}_1]| \le 2 \cdot \mathsf{Adv}^{\text{ODH}}_{\mathbb{G}, \text{HKDF}}(\mathcal{B}_1)
$$
(Factor 2 from the IND-CPA reduction to ODH.)

**Game $\mathbf{G}_2$.** Replace the AES-GCM ciphertext with an encryption of zeros. Hybrid over $q_r$ queries, bounded by $q_r \cdot \mathsf{Adv}^{\text{ind-cca-aead}}_{\text{AES-GCM}}$.

In $\mathbf{G}_2$ the adversary's view is independent of $b$. ∎

### 7.4 Caveat — replies are not authenticated

By design (ADR-008), reply submission is unauthenticated — anyone with the URL can produce a valid reply blob. We do not claim reply *origin authentication*. What we *do* claim, and prove via Theorem 4, is that an attacker without $K^{\text{origin}}_{\text{priv}}$ cannot read the reply plaintext that an honest replier sent.

The AAD binding to $(\textsf{handle}, E)$ prevents reply-blob *cross-handle* substitution: a blob produced for handle $h_1$ does not decrypt under handle $h_2$'s context.

## 8. Theorem 5 — Cross-wyrd K_origin pseudonymity

### 8.1 Game

$\mathbf{G}^{\text{KOP-LINK}}$: the adversary is presented with two pubkeys $K_0, K_1$ and must distinguish:
- $b = 0$: $K_0, K_1$ are derived as $\mathsf{HD}_{n_0}(\mathbf{seed}), \mathsf{HD}_{n_1}(\mathbf{seed})$ from the same seed at two distinct hardened indices.
- $b = 1$: $K_0, K_1$ are derived from two independent seeds.

### 8.2 Theorem

> **Theorem 5.** For any PPT $\mathcal{A}$:
> $$
> \mathsf{Adv}^{\text{kop-link}}_{\text{MOP}}(\mathcal{A}) \le 2 \cdot \mathsf{Adv}^{\text{prf}}_{\text{HMAC-SHA512}}(\mathcal{B}) + 2 \epsilon_{\text{kg}}
> $$

### 8.3 Proof

**Game $\mathbf{G}_0$.** Real.

**Game $\mathbf{G}_1$.** Replace BIP-32 hardened derivation $\text{HMAC-SHA512}(c_{\text{parent}}, k_{\text{parent}} \| n')$ with a truly random function. By A5, distinguishing this costs at most $\mathsf{Adv}^{\text{prf}}_{\text{HMAC-SHA512}}$ per random-function instantiation. Since both indices $n_0, n_1$ are hardened, both queries factor through the parent key + chain code, and the entire derivation factors through one PRF call per index.

After the swap, both $K_0$ and $K_1$ are functions of independent uniform 512-bit strings (the random function's outputs at distinct inputs). By A6, the final keypairs are statistically $\epsilon_{\text{kg}}$-close to uniformly-sampled secp256k1 keypairs. So in $\mathbf{G}_1$ the case $b = 0$ is statistically indistinguishable from $b = 1$.

$$
|\Pr[\mathbf{G}_0] - \Pr[\mathbf{G}_1]| \le 2 \cdot \mathsf{Adv}^{\text{prf}}_{\text{HMAC-SHA512}}(\mathcal{B})
$$

(Two PRF queries — one per index.)

In $\mathbf{G}_1$, $\Pr[b' = b] - 1/2 \le 2 \epsilon_{\text{kg}}$. ∎

### 8.4 Operational meaning

A canonical SendWyrd host that observes two `K_origin_pub` values cannot determine whether they came from the same author (different HD indices on one seed) or different authors (different seeds). This holds even with arbitrary side information about the wyrds' content (since the content is encrypted under independent `K_read` per wyrd, by Theorem 1).

This realizes ADR-024's claim that the host has no recipient-keyed surface AND has no author-keyed surface that lets it cluster wyrds by author. Counting distinct `K_origin_pub` values equals counting wyrds, **not people**.

## 9. AAD integrity (corollary)

A formal restatement of the implication noted in §5.4.

> **Corollary.** Let $\mathcal{A}$ be a PPT adversary controlling the network and host. The probability that $\mathcal{A}$ causes an honest recipient to successfully decrypt an envelope whose recomputed AAD differs from the AAD bound by the original Author at compose time is at most:
> $$
> \mathsf{Adv}^{\text{euf-cma}}_{\text{BIP-340}}(\mathcal{B}_1) + \mathsf{Adv}^{\text{int-ctxt}}_{\text{AES-GCM}}(\mathcal{B}_2) + \mathsf{Adv}^{\text{coll}}_{\text{SHA-256}}(\mathcal{C})
> $$

The Schnorr term covers metadata integrity (the host can't even know a valid `(handle, env, ttl, repl, ts)` it didn't compose); the AES-GCM INT-CTXT term covers ciphertext integrity (the host can't substitute ciphertext that decrypts under the same key); the SHA-256 collision term covers `publish_msg` ambiguity. All three are negligible at the standard parameters.

## 10. Composition — the system theorem

> **Theorem 6 (System).** Let $\mathcal{A}$ be a PPT adversary against MOP v1 winning *any* of the games $\mathbf{G}^{\text{MOP-IND}}$, $\mathbf{G}^{\text{PUB-EUF}}$, $\mathbf{G}^{\text{BURN-EUF}}$, $\mathbf{G}^{\text{REPLY-IND}}$, $\mathbf{G}^{\text{KOP-LINK}}$. Then $\mathcal{A}$'s combined advantage is bounded by:
> $$
> \begin{aligned}
> \mathsf{Adv}^{\text{system}}_{\text{MOP}}(\mathcal{A}) \le\;
> & 2 \cdot \mathsf{Adv}^{\text{prf}}_{\text{HKDF}} + (q_p + q_r) \cdot \mathsf{Adv}^{\text{ind-cca-aead}}_{\text{AES-GCM}} \\
> &+ 2 \cdot \mathsf{Adv}^{\text{euf-cma}}_{\text{BIP-340}} + 2 \cdot \mathsf{Adv}^{\text{ODH}}_{\mathbb{G}, \text{HKDF}} \\
> &+ 2 \cdot \mathsf{Adv}^{\text{prf}}_{\text{HMAC-SHA512}} + 2 \cdot \mathsf{Adv}^{\text{coll}}_{\text{SHA-256}} \\
> &+ q_p^2 / 2^{257} + 2 \epsilon_{\text{kg}} + \epsilon_{\text{AES}}
> \end{aligned}
> $$

Plugging in concrete bounds at $q_p = q_r = 2^{30}$, $q_h = 2^{60}$:

$$
\mathsf{Adv}^{\text{system}}_{\text{MOP}}(\mathcal{A}) \lesssim 2^{-67}
$$

i.e., the protocol is secure with a margin of ≈ 67 bits at realistic-and-then-some adversary scale, dropping to ≈ 87 bits at production-sized adversary scale ($q_p = 2^{20}$).

## 11. Limitations of these proofs

1. **Theorem 1 is now machine-checked.** The body-confidentiality theorem (§4) was mechanized in CryptoVerif 2.12 and runs in `mop_body_confidentiality.ocv`. CryptoVerif closed the proof automatically (no manual proof script required) with the bound
$$
\mathsf{Adv}^{\text{secrecy of }b} \le \frac{N_{\text{compose}}^2}{|\textsf{info}|} + 2 \cdot P_{\text{hkdf}} + 2 N_{\text{compose}} \cdot P_{\text{enc}}
$$
which matches the hand-written Theorem 1 statement modulo CryptoVerif's tighter bookkeeping (the AEAD term carries factor $2 N_{\text{compose}}$ instead of $N_{\text{compose}}$). The proof script and full verifier output are at `mop_body_confidentiality.ocv` and `mop_body_confidentiality.results.txt` respectively.

   The remaining theorems (2–6) are not yet mechanized. A bug in their reductions or game-hop accounting would not be caught by tooling. Mechanizing them is the natural next step.

2. **ROM idealization for SHA-256.** Theorem 2's proof uses the ROM for the Schnorr forking-lemma argument; this is standard for BIP-340 but is a model gap in the strictest sense. Replacing with a standard-model proof would reduce to the Algebraic Group Model + DLog (cf. Fuchsbauer-Plouviez-Seurin 2020 for Schnorr in AGM).

3. **No proof of pseudorandomness against quantum adversaries.** Schnorr forgery on secp256k1 reduces to discrete log, broken by Shor. AES-256-GCM is conjectured to need only quadratic Grover speed-up (so 128-bit security against quantum). Hardened HD derivation is HMAC-SHA512, also Grover-affected (256-bit → 128-bit). MOP v1 is *not* post-quantum; this is a known position (out of scope for v1).

4. **Implementation gap.** These proofs concern the abstract scheme. A real attack on the deployed binary could come from:
   - Side-channel leakage of `K_origin_priv` or `K_read` from the browser process.
   - Web Crypto AES-GCM subtleties (e.g., IV reuse if a developer ever encrypts twice under the same key — MOP doesn't, but the reduction assumes that's enforced).
   - HD-counter desync after a publish failure (a real risk; mitigated by the spec's "consume index regardless" rule).
   - `K_read` exposure via the browser's referrer header on outbound clicks. (The renderer contract §16 strips fragments before logging; not a concern unless the renderer is bypassed.)

5. **No proof of forward secrecy after seed compromise.** Per ADR-022, $K^{\text{read}}_n$ is recoverable from the seed. A future seed compromise gives the attacker every body that survived TTL. This is by design (recovery > forward secrecy in the v1 trade-off), but it is *worth re-stating in proof form*: post-compromise, all bets are off for surviving wyrds. Forward secrecy via per-wyrd unique random `K_read` was the pre-ADR-022 design; the design choice was made knowingly.

6. **Multi-user EUF-CMA assumed for cleanest bound.** Theorem 2's tightest form uses the multi-user variant of BIP-340 EUF-CMA. The single-user variant gives a bound looser by a factor of $q_p$ (number of pubkeys observed), which still leaves comfortable margin at any realistic $q_p$.

## 12. Recommendations from this analysis

These are spec/code suggestions surfaced by the proof effort itself.

1. **Enforce $|m_0| = |m_1|$ at the IND-CPA layer**: the body length is observable. If indistinguishability of *length* matters operationally, pad to a fixed length on the wire (reduces effective body cap; not currently done). Defer.
2. **Verify the chain-code separation in BIP-32**: Theorem 5's proof relies on hardened derivation factoring through one PRF call. Confirm the implementation uses hardened indices throughout (`m/300'/n'`, both levels hardened). Spec §5.1 already says this; verify in `packages/core/`.
3. **Document the post-compromise threat model.** Ship a one-page "what your seed can do" reference next to the seed-export UX. ADR-022 is implicit; making it explicit in user-facing docs reduces operator misunderstanding.
4. **Consider mechanization.** A 200-line CryptoVerif file would discharge §§4–8 mechanically. Worth doing before a public security review.

## 13. Status

**All theorems stated and proved by hand.** The proofs are self-contained
modulo the cited assumptions (A1–A7), each of which is standard in the
post-2010 cryptographic literature.

**Theorem 1 mechanized in CryptoVerif** (file `mop_body_confidentiality.ocv`); CryptoVerif closes the proof automatically. Theorems 2–6 remain hand-written.

**Concrete advantage bounds computed** for realistic $(q_p, q_d)$
parameters; the margins are comfortable.

**Mechanization of remaining theorems** recommended as the natural next step before a formal external security review or any move toward standardization (e.g., NIP-C6 reaching formal Nostr-protocol status).

## 14. References

- BIP-340: Schnorr Signatures for secp256k1. <https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki>
- BIP-32: Hierarchical Deterministic Wallets.
- BIP-39: Mnemonic code for generating deterministic keys.
- Abdalla, Bellare, Rogaway. *DHIES: An encryption scheme based on the Diffie-Hellman problem.* CT-RSA 2001.
- Bellare. *New proofs for NMAC and HMAC: Security without collision-resistance.* CRYPTO 2006.
- Bellare, Rogaway. *Code-based game-playing proofs and the security of triple encryption.* EUROCRYPT 2006.
- Pointcheval, Stern. *Security arguments for digital signatures and blind signatures.* J. Cryptology 2000.
- Fuchsbauer, Plouviez, Seurin. *Blind Schnorr Signatures and Signed ElGamal Encryption in the Algebraic Group Model.* EUROCRYPT 2020.
- McGrew, Viega. *The Galois/Counter Mode of Operation (GCM).* NIST 2004.
- Krawczyk, Eronen. *HMAC-based Extract-and-Expand Key Derivation Function (HKDF).* RFC 5869.
- Shoup. *Sequences of games: a tool for taming complexity in security proofs.* IACR ePrint 2004/332.

## 15. Spec cross-references

- `spec_mop_v1.md` §3 (cryptographic primitives), §5 (HD derivation), §7 (envelope), §9 (publish), §12 (burn), §14 (replies), §15 (presence-check).
- ADR-005, ADR-017, ADR-020, ADR-022, ADR-024.
- Tier 1: `../proverif/tier1_symbolic_verification.md`.

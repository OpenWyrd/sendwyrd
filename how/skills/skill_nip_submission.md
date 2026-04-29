---
name: skill_nip_submission
type: skill
created: 2026-04-26
updated: 2026-04-26
status: active
last_edited_by: agent_operator
tags: [skill, process, nostr, nip, submission, governance]
skill_type: process
---

# Skill — Submitting a NIP to `nostr-protocol/nips`

A process skill (human-driven). Walks through the operator's actions to ship the **Capability-URL References** NIP from draft to merged-and-numbered. Reuse for any future NIP work.

## When to invoke

- A spec draft exists in `what/docs/spec/nip_*.md` and is ready for ecosystem submission.
- Operator has confirmed they want to go public with the spec under their own handle.

## Inputs

- The draft markdown (e.g. `what/docs/spec/nip_capability_url_v1.md`).
- A Nostr identity (npub) for pre-discussion. The operator's npub if one exists; otherwise the operator generates one for this workflow.
- A GitHub identity. The operator's GitHub user is canonical.

## Phase 1 — Pre-discussion (1–3 weeks)

The PR that lands cold tends to invite rewrite requests. Drop the draft on:

| Channel | What to post | Notes |
|---------|--------------|-------|
| **Nostr feed** (kind:1) | "Drafted a NIP for capability-URL references — looking for spec feedback. <link to gist or repo>" | Pin yourself; tag known NIP authors via `p` tags: fiatjaf (`npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6`), Pablo (`npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft`), jb55 (`npub1xtscya34g58tk0z605fvr788k263gsu6cy9x0mhnm87echrgufzsevkk5s`), Vitor (`npub1gcxzte5zlkncx26j68ez60fzkvtkm9e0vrwdcvsjakxf9mu9qewqlfnj5z`). |
| **Nostr Builders Telegram** (`t.me/nostr_protocol`) | Same draft + 1-paragraph TLDR. Ask for sanity-check on tag schema and any conflicts with existing NIPs. | This is where the editor (fiatjaf) usually weighs in. |
| **`nostr-protocol/nips` Issues** | Open an issue titled "Proposal: NIP-XX capability-URL references — pre-discussion." Link to the draft. | Optional but encouraged for non-trivial NIPs. |
| **X / cypherpunk Twitter** | Draft thread; ping `@jb55`, `@dergigi`, `@hodlbod`, anyone who's authored a NIP. | Lower-signal than Telegram but reaches client maintainers. |

**Goals of pre-discussion:**

1. Catch design problems before the PR (cheaper to fix in markdown than in PR review threads).
2. Identify potential co-authors. NIPs with 2+ authors carry more weight.
3. Surface tag/kind conflicts with existing NIPs.
4. Get one or two Nostr-client maintainers to express interest. *Without* that, even a merged NIP sits dead.

Iterate the draft based on feedback. Do not rush to PR.

## Phase 2 — Submit the PR

When pre-discussion has stabilized the spec:

1. Fork `nostr-protocol/nips` to the operator's GitHub.
2. Add the markdown file as `XX.md` where `XX` is the next unused integer in the catalog. Check `README.md` of the upstream repo for the current high-water mark; pick the next free number. (Reviewers will reassign if there's a conflict.)
3. Update the upstream `README.md` table to add a row for the new NIP. (Not always required; check current convention.)
4. Open the PR with this template:

```markdown
## NIP-XX: Capability-URL References

Adds a tag schema and rendering convention for Nostr events that reference
capability-encrypted artifacts hosted off-Nostr — where the read key lives
in the URL fragment, the host is read-blind, and the event author is
referencing or sharing the artifact rather than embedding its body.

### Why

Capability URLs (e.g. `https://example.com/cap/{id}#{read_key}`) are a
real privacy primitive used by several systems. Naked-pasted into a Nostr
event, they render as plain text. NIP-aware clients can render them as
first-class objects: encryption badge, expiry hint, distinguish citation
from access-grant.

The schema is **scheme-agnostic** — any artifact protocol whose URLs
follow the `<canonical>#<read_key>` shape can plug in by registering an
opaque scheme-id. No central registry; first-claim by precedent.

### Backward compatibility

Uses `kind:1` text notes with additive tags. Non-aware clients render
exactly as they do today. Aware clients enhance.

### Pre-discussion

[Link to Nostr thread / Telegram thread / Issue]

### Reference implementation

Inline TypeScript template builder in the spec; produces an unsigned
event template ready for any signer.

### Open questions

- [list anything from pre-discussion that landed inconclusive]
```

5. Post the PR link back to all pre-discussion channels. Encourage participants to leave comments on the PR.

## Phase 3 — Review (2–8 weeks)

Expect:

- **Editorial pushback** on tag names, kind choice, redundancy in `content` vs tags.
- **Privacy nitpicks** on what gets indexed vs sealed. Address all of them — the privacy section is load-bearing for adoption.
- **"Why a new NIP and not a convention?"** — answer: rendering asymmetry requires a stable reference; without a NIP each client invents its own tag names.
- **"Why kind:1 and not a new kind?"** — answer: backward compat + max reach + this is fundamentally a social-graph artifact.
- **Number bikeshedding.** Reviewers may ask to use a higher number. Comply; it's their catalog.

Iterate until consensus. fiatjaf has effective veto-by-not-merging.

**Anti-patterns to avoid:**

- Don't argue about brand or naming at this stage; this NIP is scheme-agnostic by design and that's the strength.
- Don't try to add features mid-PR. Stabilize the spec before submission; mid-PR scope additions get rejected.
- Don't disclose any private system that uses this NIP unless the operator decides to. The spec stands on its own.

## Phase 4 — Merge

Merge does NOT mean adoption. Merge means the spec is canonical-enough to be referenced as "NIP-XX." Adoption is a separate process (Phase 5).

After merge:

1. Update the in-repo file `what/docs/spec/nip_capability_url_v1.md` to replace `NIP-XX` with the assigned number throughout.
2. Add the NIP to the project `STATE.md` under "What's Banked" → "Architectural decisions" or a new "External standards" subsection.
3. Update `MEMORY.md` index with a pointer if the NIP becomes load-bearing for any future SendWyrd surface.

## Phase 5 — Adoption (months, or never)

Convince Nostr clients to render the NIP. This is ecosystem-relations work:

- Identify 2–3 target clients. Damus/Amethyst/Primal/Coracle/Snort/Iris are the major rendering surfaces.
- File issues on those clients' repos: "Implement NIP-XX (capability-URL references)." Link spec, link reference TS implementation. Offer to PR if they're shorthanded.
- Post adoption screenshots / demos on Nostr. Network-effect helps; clients implement what they see other clients implementing.

Realistic outcomes:

- **Best case** (months): 2–3 clients ship rendering. Wyrd-shape becomes a recognizable Schelling shape on Nostr.
- **Median case** (months-to-year): 1 client ships. Useful but limited reach.
- **Worst case** (forever): merged but unimplemented. The spec is still a real claim — anyone who wants the rendering pattern can pick it up later — but it doesn't move distribution today.

The spec authorship credit lands on merge regardless of adoption.

## Outputs / artifacts

- Open PR or merged PR on `nostr-protocol/nips`.
- Pre-discussion threads on Nostr / Telegram / X (links recorded in `STATE.md`).
- Updated in-repo spec with assigned NIP number.
- Issues filed on target client repos (Phase 5).

## When to skip

- The draft is generic and no one in the operator's network has expressed interest. Hold for traffic.
- The operator's bandwidth is committed to higher-priority work. NIPs are months of engagement; submitting half-heartedly wastes everyone's time.

## Reusable for other NIPs

This skill is the same for any future NIP work — wyrd-attestation NIP, capability-URL DM-discovery NIP, etc. The draft, pre-discussion, PR, review, merge, adoption phases are stable.

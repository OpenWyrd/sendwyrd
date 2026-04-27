#!/usr/bin/env bash
# One-shot NIP-C6 PR submission against nostr-protocol/nips.
#
# Forks nostr-protocol/nips to your GitHub account, clones it under
# /tmp, drops the NIP-C6 spec in as C6.md, adds it to the README list
# in the right alphabetical-hex spot (after C7, before EE), commits,
# pushes, and opens the PR with the prepared description.
#
# Prerequisites:
#   - gh authed (run `gh auth status` to verify; `gh auth login` if not)
#   - Run from any directory; script CDs to a /tmp working dir.
#
# Usage:
#   bash scripts/submit_nip_c6.sh
#
# Idempotent-ish: if the fork already exists, gh fork is a no-op.
# If the branch already exists locally, you'll need to delete it
# (`rm -rf /tmp/nips-c6-submission`) and re-run.

set -euo pipefail

REPO_SPEC="$(git rev-parse --show-toplevel)/what/docs/spec/nip_capability_url_v1.md"
WORK_DIR="/tmp/nips-c6-submission"
BRANCH="nip-c6-capability-url-references"
PR_TITLE="NIP-C6: Capability-URL References"

if [ ! -f "$REPO_SPEC" ]; then
  echo "ERROR: spec not found at $REPO_SPEC" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "ERROR: gh not authed. Run 'gh auth login' first." >&2
  exit 1
fi

# Fork + clone (idempotent on existing fork)
echo "==> forking nostr-protocol/nips..."
rm -rf "$WORK_DIR"
gh repo fork nostr-protocol/nips --clone --remote --remote-name upstream "$WORK_DIR" 2>&1 \
  | grep -vE "^! |^✓ Created fork|^✓ Cloned" || true

# If gh repo fork didn't clone (because the fork already existed), do it now
if [ ! -d "$WORK_DIR/.git" ]; then
  GH_USER=$(gh api user --jq .login)
  git clone "https://github.com/${GH_USER}/nips.git" "$WORK_DIR"
  cd "$WORK_DIR"
  git remote add upstream https://github.com/nostr-protocol/nips.git || true
  git fetch upstream
  git checkout -B master upstream/master
  git push origin master --force-with-lease || true
fi

cd "$WORK_DIR"

echo "==> creating branch $BRANCH..."
git checkout -B "$BRANCH"

echo "==> writing C6.md..."
cp "$REPO_SPEC" C6.md

echo "==> updating README.md list..."
# Insert "- [NIP-C6: Capability-URL References](C6.md)" between C0 and C7.
# Uses awk for portability (sed -i differs between GNU and BSD).
awk '
  /^- \[NIP-C0:/ {
    print
    print "- [NIP-C6: Capability-URL References](C6.md)"
    next
  }
  { print }
' README.md > README.md.tmp && mv README.md.tmp README.md

# Sanity check the insertion landed
if ! grep -q "NIP-C6: Capability-URL References" README.md; then
  echo "ERROR: README insertion failed — check anchors manually" >&2
  exit 1
fi

echo "==> staging + committing..."
git add C6.md README.md
git commit -m "Add NIP-C6: Capability-URL References

Tag schema and rendering convention for Nostr events that reference
capability-encrypted artifacts hosted off-Nostr — where the read key
lives in the URL fragment, the host is read-blind, and the event
author is referencing or sharing the artifact rather than embedding
its body.

Scheme-agnostic: any artifact protocol whose URLs follow the
\`<canonical>#<read_key>\` shape can plug in via an opaque scheme-id.
No central registry; first-claim by precedent.

Distinguishes \"reference\" (k tag absent — citing the artifact) from
\"share\" (k tag present — handing out bearer access) on the same
schema. Public-feed (kind:1) primary form; NIP-17 gift-wrap secondary.

Inline TypeScript reference implementation. Backward-compatible:
non-aware clients render as ordinary text notes; aware clients
enhance with metadata-aware UI."

echo "==> pushing branch to origin..."
git push -u origin "$BRANCH" --force-with-lease

echo "==> opening PR..."
gh pr create \
  --repo nostr-protocol/nips \
  --base master \
  --title "$PR_TITLE" \
  --body "$(cat <<'EOF'
## NIP-C6: Capability-URL References

Adds a tag schema and rendering convention for Nostr events that reference capability-encrypted artifacts hosted off-Nostr — where the read key lives in the URL fragment, the host is read-blind, and the event author is referencing or sharing the artifact rather than embedding its body.

### Why

Capability URLs (e.g. `https://example.com/cap/{id}#{read_key}`) are a real privacy primitive used by several systems. Pasted naked into a Nostr event, they render as plain text. NIP-aware clients can render them as first-class objects: encryption badge, expiry hint, and — most importantly — distinguish *citation* (`c` tag, no `k`) from *access-grant* (`c` + `k`).

The schema is **scheme-agnostic**. Any artifact protocol whose URLs follow the `<canonical>#<read_key>` shape can plug in via an opaque `scheme-id`. No central registry; first-claim by precedent.

### Backward compatibility

Uses `kind:1` text notes with additive tags. Non-aware clients render exactly as they do today (the URL appears as a clickable link in `content`). Aware clients see the `c` tag, dispatch by `scheme-id`, and apply enhanced rendering. Aware clients MUST NOT hide events whose `scheme-id` they don't recognize.

### Reference vs. share

Two semantics on the same schema:

- **Reference** (`c` tag, `k` absent): "I'm talking about this artifact." Doesn't broadcast bearer access.
- **Share** (`c` tag + `k` tag): "I'm handing out read access." `k` tag carries the read key; treat as bearer capability.

The distinction matters because pasting a URL+fragment into a public Nostr event leaks the read key to anyone who reads the post. The `c`-only form gives authors a way to *cite* an artifact without granting access.

### NIP-17 DM context

The same schema serves as the inner sealed event of a NIP-17 gift-wrap. `k` tag MAY be present in DM context since the transport is end-to-end encrypted to the recipient.

### Reference implementation

Inline TypeScript template builder in the spec; produces an unsigned event template ready for any Nostr signer (NIP-07, raw nsec, etc.).

### Number choice

Picked `C6` after checking that no PR (open, closed, or merged) currently claims it. Decimal alternatives in the 90s and 100s are heavily contested (3+ open PRs each). Happy to renumber per editor preference.

### Open questions

- Whether the canonical event should be `kind:1` with additive tags (current proposal) or a new dedicated kind. Argument for `kind:1`: backward compat + max reach + this is fundamentally a social-graph artifact. Argument for new kind: cleaner semantics. Open to discussion.
- Whether the spec should standardize a `scheme-id` registration mechanism (probably not — open-ended is fine, IANA-shaped registries are heavy).

EOF
)"

echo
echo "==> done. PR opened against nostr-protocol/nips."
echo "==> next: drop the link in pre-discussion channels per how/skills/skill_nip_submission.md"

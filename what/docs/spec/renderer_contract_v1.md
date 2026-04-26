---
type: spec
created: 2026-04-25
updated: 2026-04-25
last_edited_by: agent_michael
status: draft
tags: [spec, mop, renderer, contract, v1, web, ios, android]
spec_version: "1.0.0-draft"
---

# Renderer Behavioral Contract — v1

## 1. Overview

This document specifies the behavior any **first-party SendWyrd renderer** MUST exhibit. Per ADR-014, v1 ships a single canonical renderer with three first-party implementations — web, iOS, Android — that all conform to this contract. A "renderer" here means the code path that parses an incoming wyrd URL, fetches the host response, decrypts the envelope (fragment form) or trusts the host (path form), parses the body, and presents the result to a user.

This contract is **observable** behavior — what a user sees and what side effects the client produces — not implementation. Implementations MAY share code (e.g., a TypeScript core compiled to WASM) or be re-implemented per platform; the contract holds either way.

### 1.1 Scope

In scope:
- URL parsing entry rules (renderer-side)
- Decryption flow (fragment form vs path form)
- Body rendering (typography, URL detection, auto-embed)
- Capability-traversal rules (transitive `sendwyrd://` references)
- OG-fetch policy
- Recursion-cap and cycle-detection
- Privacy-posture indicator (Sealed/Open) behavior
- Composer (compose-time renderer responsibilities)
- Tombstone rendering
- Empty/error states
- Motion / microinteraction budget
- Telemetry boundaries (what MUST NOT leave the device)
- Per-platform key storage requirements

Out of scope:
- Wire format (Phase B — `spec_mop_v1.md`)
- Visual specifics: exact colors, type scale, glyph library (Phase D — `visual_direction_v1.md`)
- Build/deploy choices (Phase E)
- Marketing copy (Phase F)

### 1.2 Normative language

RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) apply.

### 1.3 Compliance

A renderer is **conformant** with this contract if and only if:
- All MUST-level requirements pass.
- Observable behavior is identical across web / iOS / Android implementations for any given input.
- A future automated conformance test suite (deferred) covers each numbered MUST.

---

## 2. URL parsing entry

The renderer is invoked when:

- **Web**: a browser navigation arrives at `https://sendwyrd.com/w/{handle}` or `https://sendwyrd.com/w/{handle}/k/{K_read}`.
- **iOS / Android native**: the OS opens a URL via the SendWyrd URL scheme handler, app intent filter (Android), or universal link (iOS) — domain `sendwyrd.com`, path prefix `/w/`.

### 2.1 URL classification (renderer-side)

The renderer MUST classify the incoming URL using the rules in `spec_mop_v1.md` §4.3:

- `^/w/([A-Za-z0-9_-]{16})$` → **fragment form**. Renderer MUST read `K_read` from the URL fragment (web) or from the URL fragment carried by the OS-level open intent (native).
- `^/w/([A-Za-z0-9_-]{16})/k/([A-Za-z0-9_-]{43})$` → **path form**. Renderer MUST read `K_read` from the path. Renderer MUST ignore the fragment if present.
- Anything else → renderer MUST present a generic "this URL is not a wyrd" error page. MUST NOT fetch the URL. MUST NOT log the URL to telemetry.

### 2.2 Pre-fetch behaviors (web)

Web renderer MUST:
- Strip any query string before fetching. The wire protocol uses no query parameters in v1; query strings are a leak vector (referrer headers, server logs).
- NOT include the `Referer` header in fetches initiated from a wyrd URL. Use `Referrer-Policy: no-referrer` on the renderer page.
- NOT submit the URL to any analytics or telemetry endpoint. (See §16.)

---

## 3. Authoritative state

The renderer's authoritative state for one wyrd is the JSON object returned by `GET /api/v1/wyrds/{handle}` (fragment form) or `GET /w/{handle}/k/{K_read}` with `Accept: application/json` (path form). The renderer MUST treat all of the following as authoritative:

- `handle`
- `envelope` or `body` (depending on form)
- `k_origin_pub`
- `published_at`
- `expires_at`
- `replies_enabled`

The renderer MUST NOT cache wyrds beyond the lifetime of the page/session unless the user has explicitly saved a wyrd to a local "kept" store (post-v1 feature; not in scope here).

---

## 4. Decryption (fragment form)

### 4.1 Flow

1. Page loads with the renderer shell + embedded JSON containing the encrypted envelope.
2. After DOM ready, JS reads `K_read` from `window.location.hash` (web) or the fragment carried by the open intent (native).
3. JS reconstructs the AAD per `spec_mop_v1.md` §7.2.
4. JS decrypts the envelope via Web Crypto API (web) or platform AES-GCM primitive (native).
5. On tag verification failure, renderer MUST display the **key-mismatch state** (see §13.3) and MUST NOT retry, MUST NOT emit telemetry containing the URL or `K_read`.
6. On success, the plaintext body is held in memory; rendering proceeds (§6).

### 4.2 K_read handling rules

The renderer MUST:
- Treat `K_read` as a secret. Hold only in memory. MUST NOT persist to disk, localStorage, sessionStorage, IndexedDB, cookies, OS keychain, or any other durable storage.
- Clear `K_read` from memory on page unload / app backgrounded for > 30 seconds.
- NOT include `K_read` in any HTTP request the renderer initiates. The fragment is fragment-form; the server already does not see it. Do not accidentally re-submit it.
- NOT include `K_read` in any console.log, error-report payload, screenshot caption, or accessibility description.

### 4.3 URL display in browser address bar

Web renderer:
- The browser's address bar shows the full URL including the fragment. This is unavoidable for the user but is a leak vector for screen-sharing or screenshots. The renderer SHOULD warn first-time users about screenshot risk in onboarding (Phase F). v1 does not auto-truncate or mask the address bar.

Native renderer (iOS / Android):
- The native shell controls the visible URL. The renderer SHOULD show only the handle (not `K_read`) in any visible "share this URL"-style UI surface, with a separate "Copy share link" affordance that yields the full URL.

---

## 5. Decryption (path form)

In path form, the host already has `K_read` (it is in the URL path the host received). The host's response is one of:

- HTML (default for browser navigation): server-rendered HTML with the body inlined, OG metadata in `<head>`, and the standard renderer chrome.
- JSON (with `Accept: application/json`): plaintext body in the JSON payload.

The renderer in path form does NOT perform client-side decryption — the host already did it. The renderer's job is to render the plaintext returned and surface the **Open** privacy-posture indicator (§10).

### 5.1 Trust assumption in path form

Path form means the user has accepted that the canonical SendWyrd host can read the body. The renderer MUST NOT pretend otherwise. The Open indicator (§10.4) is mandatory and visible.

---

## 6. Body rendering

### 6.1 Typography

The renderer MUST present body text:
- In a monospaced typeface (per Phase D direction; canonical default is the Söhne Mono / Berkeley Mono / Geist Mono family or a platform monospace fallback).
- At a comfortable reading size (Phase D specifies; minimum 16px equivalent on web, dynamic-type-respecting on native).
- With line-breaks preserved as in the plaintext (`\n` → visual line break). Multiple consecutive newlines collapse to a single empty-line gap.
- Without modifying or normalizing Unicode beyond NFC for display purposes. The body is the body.
- Selectable / copyable as plain text.

The renderer MUST NOT:
- Apply markdown rendering (no `**bold**`, no `[link](url)` styling, no `# heading` rendering). Per ADR-011, body is plain text.
- Auto-correct, auto-capitalize, or modify the text in any way.
- Apply syntax highlighting.

### 6.2 URL detection

The renderer MUST scan the body for URLs matching:

```
URL_PATTERN := (https?|sendwyrd):\/\/[^\s]+
```

Matched URLs are inline-clickable and may auto-embed (§7).

The renderer MUST classify each matched URL:
- **`sendwyrd://` URL** → transitive capability reference (§8).
- **`http(s)://` URL with media-suffix path** (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.avif`, `.heic`, `.mp4`, `.webm`, `.mov`, `.mp3`, `.wav`, `.ogg`, `.opus`, case-insensitive) → media auto-embed (§7.1).
- **`http(s)://` URL otherwise** → OG-card auto-embed (§7.2).

URL classification MUST be by suffix only, not by content-type fetch (which would leak intent). Suffix list is fixed in this contract; new suffixes require a contract revision.

---

## 7. Auto-embed (per ADR-011)

### 7.1 Media embed

For URLs matching the media-suffix list:

| Suffix family | Renderer action |
|---------------|-----------------|
| Image (`.jpg`, `.png`, `.gif`, `.webp`, `.avif`, `.heic`) | Render `<img src="{url}">` inline at body width, responsive height, with `loading="lazy"` and `referrerpolicy="no-referrer"`. Native: equivalent platform image view with no-referrer fetch. |
| Video (`.mp4`, `.webm`, `.mov`) | Render a click-to-play video element (NOT autoplay). With `preload="none"` to avoid auto-fetch on render. |
| Audio (`.mp3`, `.wav`, `.ogg`, `.opus`) | Render a click-to-play audio element. `preload="none"`. |

### 7.2 OG-card embed

For non-media `http(s)://` URLs, the renderer fetches OpenGraph metadata client-side and renders a card with: title, description, hostname, and (if available) preview image.

OG fetch policy (§9) governs how/where the fetch happens.

### 7.3 Embed visual treatment

Per Phase D direction. Common rules:
- Embeds are visually distinct from body text (hairline rule above and below, slight indent, mono caption with hostname).
- Embed never visually dominates the wyrd; max width = body width; max height capped (Phase D).
- Embed errors (image 404, OG fetch fail) fall back to a plain inline link with no decorative chrome.

### 7.4 Embed disabling

The renderer SHOULD provide a per-session toggle ("Hide embeds") for accessibility and privacy-conscious users. Default: embeds on (per ADR-011). User preference MAY persist locally; MUST NOT be transmitted to the host.

---

## 8. Transitive capability references (`sendwyrd://`)

### 8.1 Resolution

When the body contains a URL matching `^sendwyrd:\/\/`, the renderer:
1. Treats the rest of the URL as a relative path against the canonical host: `sendwyrd://w/{handle}#{K_read}` resolves to `https://sendwyrd.com/w/{handle}#{K_read}`.
2. Fetches the referenced wyrd (using fragment-form fetch).
3. Decrypts the referenced envelope (if the referenced URL is fragment form with `K_read`).
4. Renders an inline preview of the referenced wyrd's body (truncated to first 100 codepoints by default; click-to-expand reveals full).

### 8.2 Recursion cap

The renderer MUST cap transitive resolution at **depth 2**:
- Depth 0 = the wyrd the user navigated to.
- Depth 1 = wyrds referenced from depth-0.
- Depth 2 = wyrds referenced from depth-1.
- Depth ≥ 3 = renderer MUST NOT auto-resolve. Renders the URL as a plain link with no preview.

### 8.3 Cycle detection

The renderer MUST track the set of handles encountered during transitive resolution within one render pass. If a handle is encountered twice in one pass, the second occurrence renders as a plain link with a "(referenced earlier)" inline annotation. This prevents infinite-loop attacks via mutually-referencing wyrds.

### 8.4 Reference budget

The renderer MUST NOT issue more than **20 transitive fetches** per render pass total (across all depths). On exceeding the budget, remaining unresolved references render as plain links.

### 8.5 Failed reference

If a transitive fetch returns 404, 410, or fails network-wise: render the link as a plain link with an inline annotation per the response:
- 410 expired/burned: "(this wyrd is gone)"
- 404 / network fail: "(unavailable)"

---

## 9. OG-fetch policy (per ADR-011)

The renderer fetches OpenGraph metadata for non-media `http(s)://` URLs to produce embed cards.

### 9.1 Fetch direction (recipient-side privacy posture)

Per ADR-011, recipient-side privacy is **not hardened in v1**. The renderer fetches OG metadata directly from the third-party origin client-side. This means:
- Third-party hosts learn the recipient's IP, user agent, and rough timing.
- Tracking-pixel attacks via embedded image URLs are accepted as in-scope-but-undefended.

The renderer MUST set on every OG fetch:
- `Referrer-Policy: no-referrer` (so the third-party host does not learn which wyrd contained the link).
- A generic User-Agent (not "SendWyrd-Renderer/1.0" — that fingerprints; use a standard browser UA or platform default).
- No cookies, no auth headers, no SendWyrd-specific identifying headers.

### 9.2 Fetch budget

Per render pass: max 5 OG fetches concurrently, max 20 total. Excess URLs render as plain links.

### 9.3 OG cache

The renderer MAY cache OG-fetch results in memory for the session, keyed by URL. MUST NOT persist OG cache to disk.

### 9.4 OG fetch failure

On fetch error / timeout (5s default): render the URL as a plain link, no card.

---

## 10. Privacy-posture indicator (per ADR-019)

### 10.1 Mandatory display

The renderer MUST display a privacy-posture indicator on every rendered wyrd (live wyrds and tombstones alike — tombstones inherit the form they were navigated to via).

### 10.2 Two states

- **Sealed** — fragment-form URL was used to reach this wyrd. Host did not see `K_read`. Body is host-blind.
- **Open** — path-form URL was used. Host received `K_read` and could read the body.

### 10.3 Glyph and copy

Per Phase D, anchored by research:
- Glyph: knotted thread (Sealed) / unknotted thread (Open). Two-stroke hairline, ~14–16px, mono register.
- Copy: literal, terse, austere.
  - *Sealed · host cannot read this*
  - *Open · host can read this*

### 10.4 Behavior

- Position: top of rendered content area, below the wordmark, above the body. Hairline rule above and below.
- Same x-position, same scale, same weight in both states. NO asymmetric "warn-on-Open-only" treatment.
- Color: monochrome accent. Phase D specifies exact tokens; baseline is graphite for Sealed, parchment/bone for Open, both desaturated, within 10% luminance.
- Static. NO motion on mount. NO pulse, NO shimmer.
- Hover/tap: reveal one-sentence explanation. 100ms opacity fade on tooltip mount; otherwise no animation.
- Persistent for the lifetime of the page. NEVER auto-dismiss.

### 10.5 What the indicator MUST NOT say

- No identity claim.
- No host-trust badge.
- No content classification (NSFW, etc.).
- No verification status.

---

## 11. Composer (compose-time renderer)

### 11.1 Codepoint counter

The composer MUST display a live codepoint count of the current body in the form:

```
{count} / 300
```

Position: adjacent to the body input, mono-styled, same family as body text.

Counting algorithm: Unicode codepoints (per `spec_mop_v1.md` §8.2). MUST match the server algorithm. The composer MUST prevent the user from typing past 300 codepoints (truncate paste, block keystrokes after cap). MUST NOT silently allow over-cap and reject at publish.

The counter MAY use Disney follow-through (Phase D) — counter snaps to new value, kerning settles 120ms later. This is the entire microinteraction budget for the counter.

### 11.2 Body input

The composer's body input MUST be a plain textarea (no rich-text editor). MUST NOT auto-correct, auto-format, or transform input. MUST preserve `\n` as user typed.

### 11.3 Form toggle (Sealed / Open)

The composer MUST surface a toggle for the publish form (Sealed default, Open opt-in). On toggle:
- Display a one-sentence explanation of the consequence.
- Do NOT use red/yellow/green warning colors. Per Phase D, use the same monochrome state colors as the indicator.
- Default: Sealed. The toggle to Open requires an explicit user action.

### 11.4 Replies-enabled toggle

The composer MUST surface the `replies_enabled` toggle. Default: off (per ADR-008). On toggle, display: *"Replies enabled. Recipients may send you one anonymous reply each."*

### 11.5 TTL selector

The composer MUST allow the user to select a TTL between 1 day and 1 year. Default: 90 days (per ADR-006). The selector SHOULD use a small set of presets (1 day / 1 week / 1 month / 90 days / 1 year) plus a custom-days input.

### 11.6 Publish flow

On publish:
1. Composer derives next HD index `n` from the local seed counter; advances counter.
2. Composer derives `K_origin_priv`, `K_origin_pub` at `m/300'/n'`.
3. Composer generates random 32-byte `K_read`.
4. Composer encrypts body envelope per `spec_mop_v1.md` §7.
5. Composer computes Schnorr signature over `publish_message`.
6. Composer POSTs to `/api/v1/wyrds`.
7. On success: composer constructs the share URL using the form selected (Sealed → fragment; Open → path).
8. Composer presents the share URL with copy-affordance, and (if Open) presents a pre-filled "share via" affordance for native share sheets.

### 11.7 Failure handling

On publish failure (network, server, rate-limit, validation):
- Display a single-line error in body-text style, no icon, no toast.
- Do NOT auto-retry destructively. The HD index `n` is consumed regardless of publish success — the next compose uses `n+1`.

---

## 12. Tombstone rendering

When the host returns 410 Gone (per `spec_mop_v1.md` §13):

| `reason` | Rendered text | Tone |
|----------|---------------|------|
| `expired` | *"This wyrd's time is up. It expired on {gone_at}."* | Quiet, observational. |
| `burned` | *"This wyrd was withdrawn by its author on {gone_at}."* | Quiet, observational. |
| `key_mismatch` | *"This URL doesn't match a live wyrd. The key may be wrong, or the wyrd was published with different metadata."* | Neutral, informational. |

The renderer MUST display the `gone_at` timestamp formatted in the user's locale (date only, not minute-precise).

The renderer MUST NOT display:
- Retry button.
- "Request access" button.
- Author contact affordance.
- Animation, illustration, or "sorry"-style copy.

The renderer MUST display the privacy-posture indicator (§10) on tombstone pages — the form the user navigated to is still meaningful.

---

## 13. Empty / error states

### 13.1 Empty inbox (post-v1; sketch only)

When the inbox view has no replies: single line of body-text-styled prose, no illustration, no CTA. Phase F specifies copy.

### 13.2 Network failure on fetch

Single line: *"This wyrd couldn't be fetched. Check your connection."* No icon, no toast, no auto-retry.

### 13.3 Decryption failure (fragment form, key mismatch)

Single line: *"This URL doesn't match a live wyrd. The key may be wrong."* Treated similarly to 410 `key_mismatch`. The renderer MUST NOT log the URL or `K_read` to telemetry.

### 13.4 Protocol-version mismatch

If the host returns 426: *"This wyrd uses a newer SendWyrd version than your client. Update to read it."* No auto-update prompt; release-channel gating is platform-specific.

---

## 14. Motion / microinteraction budget

Per Phase D research synthesis, the renderer is **aggressively static**. Motion budget per render pass:

1. **Wyrd sigil breathing** on the canonical landing surface only — 4–6s opacity drift, 0.6 → 1.0 → 0.6, infinite loop. NOT on rendered wyrd pages.
2. **Codepoint counter follow-through** — 120ms kerning settle on counter update.
3. **Tooltip fade-in** on hover/tap of the privacy-posture indicator — 100ms opacity.
4. **Embed lazy-load fade-in** when an OG card or media element loads — 200ms opacity, no transform.

That is the entire budget. Implementations MUST NOT add additional motion without contract revision.

---

## 15. Accessibility (minima)

The renderer MUST:
- Pass WCAG 2.2 AA on all text contrast (Phase D color tokens chosen accordingly).
- Respect `prefers-reduced-motion`: the wyrd sigil breathing and counter follow-through collapse to static when reduced motion is set.
- Provide screen-reader-readable labels for the privacy-posture indicator (e.g., "Sealed: host cannot read this wyrd").
- Support keyboard-only navigation through composer, share-affordance, and embed expand/collapse.
- Native: respect platform dynamic type / accessibility text size.
- Web: meet AAA contrast on body text where feasible (the wyrd body is the load-bearing content; high-contrast is a brand value, not just an accessibility requirement).

---

## 16. Telemetry boundaries

The renderer MUST NOT transmit to *any* destination (canonical host, third-party analytics, error reporting, metrics):

- Full URL of any wyrd (`{handle}` + fragment is unsafe; `{handle}` alone is barely-safe but still leaks browsing patterns).
- Any value of `K_read`.
- Any plaintext body, even hashes/fingerprints of body.
- The HD seed or any derived `K_origin_priv`.
- The user's `next_n` counter.
- The contents of any reply blob (encrypted or decrypted).
- Email or contact info (the renderer never collects any).
- IP address (transmitted by network layer; not the renderer's concern, but the renderer MUST NOT add it explicitly).

The renderer MAY transmit:
- Crash/error reports with stack traces, **provided** sensitive values (URLs, keys, bodies) have been rigorously redacted before send. Library choice matters here; default-deny is the posture.
- Aggregate, non-identifying counters (e.g., "this client made N publish requests this session") at the host level — only after a future ADR establishes what's acceptable. v1 defaults to no telemetry.

### 16.1 Crash report redaction rules

If a renderer crash report is produced:
- Strip URL fragments unconditionally.
- Strip URL paths matching the wyrd-URL pattern, leaving only `https://sendwyrd.com/w/[REDACTED]`.
- Strip stack-trace local-variable values. Stack frames stay.
- Redact `K_read`, `K_origin_priv`, seed, body string variables by name match.

---

## 17. Per-platform key storage

### 17.1 Web

- The HD seed (and `next_n` counter) lives in the browser's IndexedDB, encrypted with a key derived from a user-set passphrase via PBKDF2 (≥ 600,000 iterations, SHA-256). Implementation reference: `argon2id` is preferred where available (post-v1 if not), but PBKDF2 is the v1 floor.
- The encrypted seed ciphertext is the *only* persistent secret in browser storage.
- The user's passphrase is held in memory for the session (cleared on tab close or 30 minutes of inactivity, whichever first).
- Web MUST NOT use cookies for the seed. MUST NOT sync the seed to any cloud store. MUST NOT auto-fill from password managers (use `autocomplete="off"` on the passphrase input).

### 17.2 iOS

- The HD seed lives in the iOS Keychain, item class `kSecClassGenericPassword`, accessibility `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, with biometric-protected access (`kSecAccessControlBiometryCurrentSet` if Face ID / Touch ID is enabled on the device, else passcode).
- `next_n` counter lives alongside the seed in the same Keychain item (or a sibling).
- Keychain backup to iCloud Keychain MUST be disabled for the seed item (`kSecAttrSynchronizable: false`).
- Per-device seed; multiple iOS devices on the same user require explicit user-action import (write seed to one, read on the other via QR or copy/paste).

### 17.3 Android

- The HD seed lives in the Android Keystore via `EncryptedSharedPreferences` or equivalent, with `MasterKey` configured for `KeyScheme.AES256_GCM` and `setRequestStrongBoxBacked(true)` where StrongBox is available.
- Biometric-protected access via `BiometricPrompt` with `setAllowedAuthenticators(BIOMETRIC_STRONG | DEVICE_CREDENTIAL)`.
- Android backup MUST be excluded for the seed (no `android:allowBackup` for the encrypted prefs file).

### 17.4 Cross-platform sync

v1 does NOT support automatic cross-device sync of the seed. Recovery is via BIP-39 mnemonic export on one device + import on another. This is intentional (per ADR-005 and VISION P4 brittleness-as-feature): cloud-sync of the seed would defeat the device-local + opt-in-backup posture.

---

## 18. Native shell strategy (per ADR-014)

The shared cryptographic and parser core (`packages/core` per ADR-020) is the load-bearing logic. Two viable native implementations:

- **Path A — WASM core**: compile the TypeScript core to WASM; native shells (Swift / Kotlin) wrap it for UI and OS-keychain integration.
- **Path B — Re-implementation**: Swift and Kotlin re-implement the core against this contract.

Path A reduces behavioral-drift risk; Path B is more idiomatic per platform. Decision deferred to implementation phase. Whichever path is chosen, all observable behavior in this contract MUST hold across all three platforms.

A future **automated conformance test suite** (deferred) will run identical input fixtures against all three implementations and assert observable-output equality.

---

## 19. Versioning

This contract is **renderer-contract v1**. Renderer implementations MUST advertise their contract version in the User-Agent (web) or app-version-info structures (native). Servers MAY use this for compatibility heuristics; v1 has no server-side dependency on this version, but federation-era hosts may.

---

## 20. References

- ADR-003 — Capability-based privacy posture.
- ADR-004 — Two-key model and two-form addressing.
- ADR-006 — Object lifecycle.
- ADR-007 — Body schema (text + embedded URLs).
- ADR-008 — Replies.
- ADR-011 — Body plain text + aggressive auto-embed.
- ADR-012 — Body size cap (300 codepoints).
- ADR-014 — Canonical renderer; first-party clients only.
- ADR-018 — Tombstone with structured metadata.
- ADR-019 — Symmetric privacy-posture indicator.
- ADR-020 — v1 stack.
- `spec_mop_v1.md` — Wire spec.
- `visual_direction_research_notes.md` — Phase D source notes.

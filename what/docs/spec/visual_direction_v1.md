---
type: spec
created: 2026-04-25
updated: 2026-04-25
last_edited_by: agent_michael
status: draft
tags: [spec, mop, sendwyrd, visual, design, ux, v1]
spec_version: "1.0.0-draft"
---

# Visual Direction — SendWyrd v1

This is the formal Phase D spec. Synthesized from three parallel research streams (`visual_direction_research_notes.md`), reconciled through the lens of the user's voice register (cypherpunk-Nostr-adjacent, Nietzschean, anti-feed/anti-algorithm) and SendWyrd's product register (austere, ephemeral, capability-gated, mystic-coded via *wyrd* etymology).

This document fixes color tokens, typography, spacing, motion, iconography, the privacy-indicator glyph spec, the wyrd sigil concept, IA, and screen-by-screen flows. Implementation in Phase E will translate these into design tokens (CSS variables, Tailwind theme, Swift / Kotlin equivalents) and component primitives.

## 1. Aesthetic Stance (one paragraph)

**Dark-first. Mono as the load-bearing voice. Hairline rules instead of shadows. One signature mark that breathes once and is otherwise static. Color used as a structural cue, not a celebration. Empty states say one thing. The product trusts the user to know what just happened.**

The brand register sits between Vercel-grade chromatic restraint and Mullvad-coded cypherpunk austerity, with a single etymological wink (the wyrd sigil) earning the *fated/woven* connotation without LARP. Linear and Cal.com are too saturated for this product; iA Writer and Mullvad are the closer cousins.

## 2. Color tokens

Dark theme is canonical. Light theme is a faithful mirror for daytime / accessibility / system-pref users.

### 2.1 Dark theme (canonical)

| Token | Hex | Use |
|-------|-----|-----|
| `--ground` | `#0A0A0A` | Page background. Near-black, slightly warmer than pure black. |
| `--surface` | `#141414` | Subtle elevation (composer card, inbox row hover). |
| `--hairline` | `#222222` | 1px rules and borders. The product's load-bearing chrome. |
| `--hairline-strong` | `#3A3A3A` | Active focus rings, selected-item rules. |
| `--ink` | `#EDEDED` | Body text. Off-white, never pure white. |
| `--ink-muted` | `#888888` | Secondary text (timestamps, captions, counter). |
| `--ink-subtle` | `#555555` | Metadata, helper text, placeholders. |
| `--accent` | `#7A8AA8` | Single accent. Desaturated rune-blue. Used on focus, active state, the wyrd sigil, and one decorative gradient. Never on body text. |
| `--accent-soft` | `#3D4452` | The accent at lower luminance — used in the landing-page haze gradient only. |
| `--mark-sealed` | `#9DA0A8` | Sealed indicator glyph color. Cool graphite. |
| `--mark-open` | `#C2BCA8` | Open indicator glyph color. Warm parchment. Within 10% luminance of `--mark-sealed`; symmetric. |
| `--danger` | `#A87A7A` | Errors. Desaturated, body-text register, not alarm-red. |

### 2.2 Light theme (mirror)

| Token | Hex | Use |
|-------|-----|-----|
| `--ground` | `#F8F4ED` | Bone / paper. Same warmth as `--mark-open` in dark theme; ground is its own indicator that we are in light mode. |
| `--surface` | `#F0EBE0` | Subtle elevation. |
| `--hairline` | `#D8D2C4` | 1px rules. |
| `--hairline-strong` | `#A8A095` | Active focus rings. |
| `--ink` | `#1A1A1F` | Body text. Near-black with a hair of blue. |
| `--ink-muted` | `#666666` | Secondary text. |
| `--ink-subtle` | `#999999` | Metadata. |
| `--accent` | `#5E6F8A` | Same rune-blue family, slightly darkened for contrast on light ground. |
| `--accent-soft` | `#B8C0CC` | Landing haze. |
| `--mark-sealed` | `#3A3F4A` | Cool ink. |
| `--mark-open` | `#6F6354` | Oxidized warm ink. Within 10% luminance of `--mark-sealed`. |
| `--danger` | `#6F4A4A` | Errors. |

### 2.3 Theme switching

- Default: respects `prefers-color-scheme: dark`. If unset, defaults to dark.
- User can override via Settings (theme toggle: System / Dark / Light). Preference persists in the same encrypted local storage as the seed.
- The wordmark and sigil glyph re-render under the active theme; no separate asset variants — one stroke definition, color-of-the-current-ink at render time.

### 2.4 What's intentionally NOT in the palette

- No green-success / red-error / yellow-warning semantic color triplet. This is a v1 deliberate constraint: errors are body-text-styled prose in `--danger`, never iconified or banner-styled. Per the renderer-contract motion budget and ADR-019's "informational, not alarmist" stance.
- No gradient panels behind feature blocks. The single permitted decorative gradient is the landing-page haze (§ 6.2), nowhere else.
- No saturated brand-CTA color. The accent is desaturated by design.

## 3. Typography

### 3.1 Type families

| Slot | Family (with fallbacks) | Why |
|------|-------------------------|-----|
| **Wordmark / display** | `Söhne`, fallback `ABC Diatype`, fallback `Geist Sans`, fallback platform sans | Neo-grotesque with humanist warmth; Pitch / Resend / Cal-grade brand register without being indistinguishable from them. Wordmark only — paid license is reserved for one display moment per page. |
| **In-product body & UI** | `Berkeley Mono`, fallback `Geist Mono`, fallback `Söhne Mono`, fallback `JetBrains Mono`, fallback `ui-monospace` | Mono-as-voice. Carries the cypherpunk register and reinforces "every codepoint is counted." The 300-cap becomes typographic. Body text, codepoint counter, timestamps, message IDs, command-style copy. |
| **Long-form prose** (rare in v1) | Platform sans (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, etc.) | Settings descriptions, error messages where mono would be overweight. Used minimally. |

If Söhne licensing is impractical at scale, ABC Diatype or Geist Sans are acceptable substitutes — all neo-grotesque, all sit in the same warmth band. **Web font loading must not block render**: use `font-display: swap` and ship the fallback metric-matched (`size-adjust`, `ascent-override`).

### 3.2 Type scale

All sizes in rem (1rem = 16px on the user's browser default).

| Slot | Size | Weight | Line height | Tracking |
|------|------|--------|-------------|----------|
| Display (wordmark, hero) | 3rem (48px) | 600 | 1.0 | -2% |
| H1 (page title) | 2rem (32px) | 600 | 1.1 | -1% |
| H2 (section title) | 1.5rem (24px) | 500 | 1.2 | -0.5% |
| H3 (subsection) | 1.125rem (18px) | 500 | 1.3 | 0 |
| **Body** (mono) | 1rem (16px) | 400 | 1.6 | 0 |
| Body emphasized (mono) | 1rem (16px) | 500 | 1.6 | 0 |
| Caption (mono) | 0.875rem (14px) | 400 | 1.4 | 0 |
| Microcaption (mono) | 0.75rem (12px) | 400 | 1.3 | +1% |
| Codepoint counter (mono) | 0.875rem (14px) | 500 | 1.0 | 0 |

### 3.3 Mobile dynamic type

iOS / Android renderers MUST respect platform dynamic type. The above sizes are baseline; multiply by the user's platform scaling factor at render time. Mono fonts MUST scale; do not switch to a non-mono fallback at large sizes.

## 4. Spacing system

Base unit: **4px**. All paddings, margins, gaps are multiples of base.

| Token | Value | Common use |
|-------|-------|------------|
| `--space-1` | 4px | Within tight stacks (icon + label) |
| `--space-2` | 8px | Inside card padding, between adjacent inputs |
| `--space-3` | 12px | Caption-to-content |
| `--space-4` | 16px | Standard component internal padding |
| `--space-5` | 20px | — |
| `--space-6` | 24px | Mobile horizontal page padding; section content padding |
| `--space-8` | 32px | Stack between H2 and following content |
| `--space-12` | 48px | Desktop horizontal page padding; section dividers |
| `--space-16` | 64px | Large vertical section gap |
| `--space-20` | 80px | Hero-area vertical breathing room |
| `--space-24` | 96px | Landing-page section vertical rhythm |

### 4.1 Layout

- Max content width for body text: **640px**. Wyrds are short; wide measure makes mono unreadable.
- Max content width for inbox / list views: **720px**.
- Max page width (chrome, container): **1080px**.
- Centered single-column layout. No multi-column dashboards in v1.

### 4.2 Density

Aggressive whitespace. Each surface is one island. No card decoration beyond hairline rules. No drop shadows. No rounded corners except on input fields and the share-URL chip (radius `4px`, never larger).

## 5. Iconography

### 5.1 Library

- **Default**: `lucide-react` (web), platform-native equivalents (SF Symbols on iOS, Material Symbols on Android) — used for utility icons (close, copy, share, settings gear, theme switch).
- All icons MUST be hairline stroke (1.25px) at 20px size, scaling proportionally.
- Icons MUST use `currentColor` for stroke; theme adapts automatically.

### 5.2 Custom glyph family

SendWyrd ships a small custom glyph family for brand-load-bearing moments:
- The **wyrd sigil** (§ 7).
- The **Sealed** thread-knot indicator (§ 6).
- The **Open** unknotted-thread indicator (§ 6).

These three glyphs are the entire custom inventory. New custom glyphs require a contract revision.

## 6. Privacy-posture indicator (Sealed / Open)

Per ADR-019 + renderer-contract § 10.

### 6.1 Glyph specifications

Both indicators share a **viewBox of `0 0 16 16`** and use **two-stroke hairline construction at 1.25px stroke-width** with `stroke-linecap: round`.

#### Sealed (knotted thread)

```
Two strokes:
  Stroke A: starts at (3, 4), curves through (8, 8), ends at (13, 12).
  Stroke B: starts at (3, 12), curves through (8, 8), ends at (13, 4).
The two strokes cross at the center and tie at (8, 8) via a small overhand
loop (radius ~1.5).
```

Visual read: two threads crossing and tying. The knot is the binding. Color: `--mark-sealed`.

#### Open (unknotted thread)

```
Two strokes:
  Stroke A: parallel curve from (3, 6) to (13, 6), gentle arc upward.
  Stroke B: parallel curve from (3, 10) to (13, 10), gentle arc downward.
The two strokes are parallel, never touch.
```

Visual read: two threads, loose, untied. Color: `--mark-open`.

### 6.2 Indicator placement and treatment

- Position: top of rendered content area, immediately below the wordmark, above the body. Hairline rule above and below the indicator strip.
- Layout (left to right): glyph (16px) → 8px gap → label text → (optional) interpunct → muted explanation.
  - Sealed label: `Sealed · host cannot read this`
  - Open label: `Open · host can read this`
  - Label uses Caption (mono, 14px, weight 400). Color matches the glyph (`--mark-sealed` / `--mark-open`).
- Hover/tap: the explanation expands inline (one sentence), 100ms opacity fade. No animation on mount.
- Same x-position, same scale, same weight in both states. Symmetric. Asymmetry is glyph-topology only.
- NO motion on mount. NO pulse, shimmer, or color transition.

### 6.3 Indicator on tombstones

When the renderer displays a 410 Gone (per `spec_mop_v1.md` §13), the indicator is preserved (the form the user navigated to is still meaningful) but the glyph color drops to `--ink-subtle` to convey "this no longer applies in the same way." Label text is unchanged.

## 7. The wyrd sigil

The single brand-load-bearing custom mark. Used in three places, never elsewhere:

1. **Wordmark lockup** — small mark integrated into the SendWyrd wordmark (centered between *Send* and *Wyrd*, or replacing the center stroke of the W).
2. **Splash screen / launch state** on native; **landing-page hero** on web.
3. **Browser tab favicon** and platform app icon.

### 7.1 Concept

A geometric mark formed from **three intersecting hairline strokes** that converge at a single knot-point near the center. Reads as both:
- A stylized **W** (wyrd; the wordmark letter).
- A **three-strand braid converging into a knot** (the Norns weaving fate; the etymological wink).

ViewBox `0 0 32 32`, stroke-width 1.25px, `currentColor`. The exact stroke geometry is design-implementation work in Phase E; the brief is "geometric, three-stroke, converging knot, reads as W on first glance and as braid on second."

### 7.2 Breathing animation (landing only)

- The sigil on the landing-page hero (and **only** there) has a slow opacity drift: `opacity: 0.6 → 1.0 → 0.6`, period **4.5s**, easing `cubic-bezier(0.4, 0, 0.2, 1)` (ease-in-out), infinite loop.
- All other instances of the sigil (wordmark, favicon, native launch state) are **static**. The breathing is a one-place flourish, not a brand pattern.
- Respects `prefers-reduced-motion: reduce` — collapses to static at full opacity (`1.0`).

### 7.3 What the sigil is NOT

- Not a chrome decoration. Does not appear in section dividers, button icons, list bullets, or anywhere not enumerated above.
- Not animated outside the landing breathing.
- Not the indicator glyph (the Sealed/Open thread glyphs are separate).

## 8. Motion budget (reaffirmed)

Per renderer-contract § 14. Total motion inventory across the entire product:

| Item | Where | Timing | Easing |
|------|-------|--------|--------|
| Sigil breathing | Landing hero only | 4.5s loop, 0.6 ↔ 1.0 opacity | ease-in-out |
| Codepoint counter follow-through | Composer counter on update | 120ms kerning settle | cubic-bezier(0.4, 0, 0.2, 1) |
| Tooltip fade-in | Privacy-indicator hover/tap | 100ms opacity | linear |
| Embed lazy-load fade-in | OG card / media element on load | 200ms opacity, no transform | linear |

That is the entire motion budget. Anything else is a contract violation.

## 9. Information architecture

### 9.1 Web — screen inventory (v1)

| Route | Purpose | Auth requirement |
|-------|---------|------------------|
| `/` | Landing — what is SendWyrd, single CTA to compose | None |
| `/compose` | New wyrd composer | Seed loaded (passphrase entered) |
| `/w/{handle}` | Fragment-form wyrd view | None (renderer decrypts client-side) |
| `/w/{handle}/k/{K_read}` | Public-form wyrd view | None (host decrypts server-side) |
| `/inbox` | Author's inbox (HD-aggregated wyrds + replies) | Seed loaded |
| `/settings` | Seed mgmt, theme toggle, advanced | Seed loaded |
| `/onboarding` | First-run flow (generate seed, mnemonic, passphrase) | None (creates seed) |

### 9.2 Native (iOS / Android) — screen mapping

Same screen inventory, mapped to native navigation patterns:
- Landing → app cold-launch state, brief.
- Compose, View → primary tabs.
- Inbox, Settings → secondary tabs / sheet.
- Onboarding → first-launch full-screen sheet.

## 10. Screen-by-screen flows

### 10.1 Landing (`/`)

**Layout**:
- Top: SendWyrd wordmark, centered, 48px from top.
- Hero: the wyrd sigil (large, ~96px, breathing). Centered.
- Below sigil: a **specimen wyrd** — a real-feeling rendered wyrd in mono, with a live (non-functional, just visual) `287 / 300` counter ticking on a fixed cycle. Hairline rule below.
- Below specimen: one paragraph of body-text-styled prose explaining the primitive. Per ADR-015, no use-case lead — the copy is *what is this* not *what is this for*. (Phase F writes the exact copy.)
- Below prose: single CTA button — `Compose a wyrd` — secondary-button styled (hairline border, no fill, mono label).
- No nav bar, no footer with links to social, no testimonials, no pricing, no feature comparison. The page is one column, breathes, ends.

**Behavior**:
- Sigil breathes per § 7.2.
- Specimen counter cycles 0 → 300 over 8s, holds at 300 for 2s, resets, repeats. Respects reduced motion (holds at a static value if user prefers).
- CTA navigates to `/compose`.

### 10.2 Compose (`/compose`)

**Layout**:
- Top: wordmark.
- Privacy-form selector: two-position toggle, **Sealed** (default selected) / **Open**. Glyph + label per § 6.1. One-line explanation of consequence below the toggle, in `--ink-subtle`.
- Body input: single textarea, mono, no border (just a hairline rule below). Auto-grows up to a max-height; thereafter scrolls within itself. Placeholder: empty.
- Codepoint counter: bottom-right of the textarea, mono, 14px. `0 / 300` initially. Updates per keystroke with 120ms follow-through.
- TTL selector: small horizontal radio group below the textarea: `1 day · 1 week · 1 month · 90 days · 1 year`. Default `90 days`.
- Replies-enabled toggle: secondary control below TTL. Default off. One-line consequence below.
- Send button: full-width on mobile, right-aligned on desktop. Label: `Send`. Disabled until body length > 0 and ≤ 300.
- On send: button label transitions to `Sending…`, then on success replaces the entire compose surface with the **share state** (§ 10.3).

### 10.3 Share state (post-publish)

**Layout**:
- The composed wyrd is shown in mono, read-only, with a hairline rule above and below.
- Privacy indicator (§ 6) shows the form selected.
- A **share URL chip**: hairline border, mono URL text truncated with ellipsis if too long, copy-icon at the right end. Clicking the chip copies the URL to clipboard; the icon transitions to a checkmark for 2s, then back. (This is the one acceptable iconic state-transition outside motion budget — exception note below.)
- A `Compose another` link below, secondary-button styled.

**Motion exception**: the copy-icon → checkmark transition (200ms, opacity + crossfade) is the one motion not in § 8's enumerated budget. Justification: copy-feedback is operational not decorative; accessibility requires confirmation that the action took. This is a v1 sanctioned exception. Future motion additions require ADR-level justification.

### 10.4 View — fragment form (`/w/{handle}`)

**Layout**:
- Wordmark (top, smaller — 24px — to give body real estate).
- Privacy indicator (Sealed).
- Body, mono, in a max-640px column.
- Embeds inline per renderer-contract § 7 (auto-embedded media + OG cards), each with hairline rule above.
- Below body: small mono caption with `published_at` and `expires_at` (e.g., `Sent 2026-04-25 · expires 2026-07-24`).
- If `replies_enabled`: a `Send a reply` affordance below the caption. Tapping reveals a textarea (max 1000 codepoints) with a `Send` button. Single one-shot submission per VISION P5 / ADR-008.
- No nav, no footer, no engagement metrics. Just the wyrd.

### 10.5 View — public form (`/w/{handle}/k/{K_read}`)

Identical to fragment-form view, but:
- Privacy indicator shows **Open**.
- The host has already decrypted; renderer just renders.
- Server-rendered HTML includes OG metadata for social-card preview.

### 10.6 View — tombstone (410 Gone)

- Wordmark, privacy indicator (color dropped to `--ink-subtle` per § 6.3), then a single line of mono prose:
  - `expired`: *"This wyrd's time is up. It expired on {date}."*
  - `burned`: *"This wyrd was withdrawn by its author on {date}."*
  - `key_mismatch`: *"This URL doesn't match a live wyrd. The key may be wrong, or the wyrd was published with different metadata."*
- No retry, no illustration, no contact-author affordance. (Per renderer-contract § 12.)

### 10.7 Inbox (`/inbox`)

**Layout**:
- Wordmark.
- One-line caption: `{N} wyrds · {M} unread replies` (or empty: a single line of mono prose, no illustration).
- A vertical list of the user's wyrds (HD-aggregated per ADR-009). Each row:
  - First 60 codepoints of the wyrd body, truncated with ellipsis.
  - Status pill (Sealed / Open / Expired / Burned / Replied) — text only, no fill, in the corresponding color from § 2.
  - `published_at` in mono caption.
  - Hairline rule between rows.
- Tapping a row navigates to that wyrd's view route.
- Filter: small mono toggle above the list — `All · Live · Has replies · Gone`. Persists in session only.

### 10.8 Settings (`/settings`)

Plain list of sections, hairline-ruled:
- **Backup mnemonic** — reveals the BIP-39 mnemonic with a tap-to-reveal interaction (passphrase re-entry required). Warns once: *"Anyone with this mnemonic can publish wyrds as you. Treat it like a key."*
- **Change passphrase** — re-entry of current, then new, then confirm.
- **Theme** — System / Dark / Light radio group.
- **About** — version, links to spec/repo (text links, no icons).
- **Danger zone** — `Forget seed on this device` (red-ish text, double-confirm flow).

### 10.9 Onboarding (`/onboarding`)

Three steps, full-screen, single column, mono throughout. No progress dots, no illustrations.

**Step 1 — Generate**: *"Your seed is your authorship. SendWyrd generates one for you now. It lives only on this device."* Single button: `Generate seed`.

**Step 2 — Mnemonic**: 12-word BIP-39 mnemonic in a 4×3 grid, mono, large. Below: *"Write this down somewhere offline. If you lose this device and didn't write it down, your seed is gone — that's how SendWyrd works."* Single button: `I wrote it down`. The button is disabled for 5 seconds to enforce the user actually reads.

**Step 3 — Passphrase**: passphrase input (no autocomplete) + confirm. Passphrase encrypts the seed at rest on this device. Single button: `Set passphrase`.

Then redirect to `/compose`.

## 11. Component principles

- **Buttons**: hairline-bordered, no fill (primary/secondary distinction is by label weight, not color). On hover: `--accent` border. On press: `--accent` border + `--surface` fill.
- **Inputs**: hairline rule below only (no full border). Focus: rule becomes `--accent`, 1.5px (still hairline).
- **Cards**: do not exist. Replaced by hairline-ruled regions.
- **Modals**: avoid. Replace with full-screen routes or inline-expanded sections.
- **Toasts**: avoid. Inline status replaces.
- **Loading states**: a single mono ellipsis `…` cycling through 1/2/3 dots over 1s, no spinner.

## 12. Accessibility

- WCAG 2.2 AA on all body text; AAA where feasible (the body is the load-bearing content).
- All custom glyphs (sigil, Sealed, Open) MUST have aria-label fallbacks.
- Mono fonts: confirm AAA contrast at 14px caption size on both themes (re-tune `--ink-muted` if needed during implementation).
- Reduced-motion: kills sigil breathing, counter follow-through, fade-ins. Respect it strictly.
- Keyboard navigation: tab order matches reading order. Focus rings are `--accent` 1.5px.

## 13. What's deferred to implementation

These are intentionally not specified at this phase — they're token / framework concerns belonging to Phase E:

- Exact CSS-variable file layout (`tokens.css`, theme switching).
- Tailwind config (extending theme; preset for the design tokens).
- Native parity tokens (Swift / Kotlin equivalents of the CSS variables).
- Exact type-loading strategy (which files, which subsetting).
- Iconography set selection — Lucide pinned version, custom glyph SVG export.
- Exact wyrd-sigil stroke geometry — design-implementation work.

## 14. References

- ADR-019 — privacy-posture indicator (governs § 6).
- ADR-014 — first-party canonical renderer (governs § 9 / § 10).
- ADR-015 — use-case agnostic (governs § 10.1 landing copy stance).
- `renderer_contract_v1.md` § 14 — motion budget (locked here in § 8).
- `visual_direction_research_notes.md` — research synthesis source.

---
type: working_notes
created: 2026-04-25
updated: 2026-04-25
last_edited_by: agent_operator
status: draft
tags: [phase_d, visual_direction, research_synthesis, working_notes]
---

# Visual Direction Research — Working Notes

These are raw research synthesis notes from three parallel research streams. Phase D will produce a formal proposal at `what/docs/spec/visual_direction_v1.md` synthesized from these notes.

## Stream 1 — SaaS / Dev-Tool Minimal Aesthetic

**Convergent pattern (2025–2026):**
- Two-typeface dominance: Inter / Inter Display (Linear, Cal, Stripe-adjacent) and Geist Sans / Geist Mono (Vercel orbit). Mono pairing is no longer optional for "for developers" register.
- Weight strategy: barbell — 400 body, 500/600 UI, 700 display. Aggressive size jumps.
- Color: near-pure neutrals + exactly **one** saturated accent. Stripe `#635BFF`, Linear `~#5E6AD2`, Cursor cyan. Vercel goes further — barely uses an accent at all.
- Spacing: 4/8px base; 80–120px section vertical rhythm; max width ~1200–1280px. Whitespace is the dominant material.
- Motion: restrained, not decorative. 120–180ms transitions, springs over linear, Rauno-style follow-through.
- Iconography: hairline (1–1.25px), Lucide as default.
- Density: aggressively low. Each section is an island.

**Recommended moves for SendWyrd:**
1. **Vercel-grade chromatic restraint: dark-first, near-zero accent, one mystic gradient.** Pure black or near-black (`#0A0A0A`) with off-white type (`#EDEDED`). One signature accent — not saturated indigo (too SaaS-generic) — pick desaturated rune-blue `~#7A8AA8` or oxidized copper. One decorative gradient appears exactly once (behind hero) as faint volumetric haze.
2. **Geist Mono (or equivalent) as the load-bearing voice, not Geist Sans.** Set message body, 300-codepoint counter, timestamps, message IDs in mono. Headings in tighter sans (Geist Sans, or step out and use Söhne Mono / Berkeley Mono). Mono-as-narrator carries cypherpunk register.
3. **Brittleness rendered as type, not chrome.** Hero shows raw message specimen with exact character counter ticking (`287 / 300`), monospaced, single column, no card chrome, no rounded corners, ruled hairlines (1px `#222`) instead of shadows. Steal Rauno's Disney follow-through for counter.
4. **Signature flourish = wyrd sigil that breathes.** Single rune-like geometric mark, 1px hairline stroke, slow 4–6 second opacity drift (0.6 → 1.0 → 0.6). The *only* ambient motion on the page.

**Avoid:** rainbow/holo gradients (Plaid), live-cursor multiplayer (Liveblocks), painted/organic backdrops (Cursor), friendly mascots. Stay in the Vercel/Resend/Rauno corner; lean colder than they do.

## Stream 2 — Consumer-Product Minimal Aesthetic

**Convergent pattern:**
- Color: off-white grounds with near-black ink, never pure #FFF/#000. Craft = paper-cream; Bear = warm-neutral with theme accents; Things = cool gray-white + single saturated blue. 2026 trend = "Minimalism 3.0": warm neutrals (clay, hazelnut, gray) + single bold accent.
- Typography: split into Apple-tier (system stacks: SF Pro, New York) and brand-forward (custom Söhne-class faces with humanist warmth — Bear Sans, iA Mono/Duo/Quattro, Pitch in Söhne). Dev-tool tells (Inter, Plex) **absent** from consumer-warm.
- Identity moves: one signature flourish per product, never two. Bear's bear silhouette, Nothing's dot-matrix, Arc's rainbow gradient, iA's typewriter caret. *Etymological or functional, never ornamental.*
- First-impression vs daily-use: marketing surfaces tolerate illustration; product UI strips it.

**Recommended moves for SendWyrd:**
1. **Söhne or Söhne-adjacent for the wordmark; system stack for UI.** Reserve Söhne (or GT America / ABC Diatype) for wordmark + marketing + one onboarding display moment. In-product: SF Pro on iOS, platform sans elsewhere. *Custom typeface in-product is a tax you pay forever.*
2. **Wyrd-thread as monogram, never as ornament.** Steal Nothing's discipline: the brand grid exists in *exactly one place*. Build a single hairline thread-knot or three-strand braid integrated into the W or send-glyph. Render once in the mark, once on splash, never in chrome.
3. **Cool-paper ground, single saturated accent — Things-cool, not Headspace-warm.** Off-white at `#FAFAF7` with cool gray ink `#1A1A1F`, one signal color reserved for *send confirmed* + active state. Avoid clay/terracotta. Pick desaturated indigo or slate-blue.
4. **Quiet state mood — Apple Reminders, not Slack.** Empty inbox: one sentence, period, no illustration. Sent confirmation: haptic + checkmark, no toast copy. Errors: body-text line in muted red, no icon, no exclamation. *The app trusts you to know what just happened.*

## Stream 3 — Privacy-App UX Patterns (Sealed/Open Indicator)

**Convergent pattern:**
- Field has converged on **normalization, not warning theater.** Signal removed the per-message lock toggle. Element walking back warning shields ("warnings that can be easily ignored"). Mullvad/Cryptee skip locks/shields entirely — typography + copy + absence-of-clutter signals seriousness.
- Iconography splits: locks dominate (Signal, Proton, Tuta), shields for institutional framing (Element, Tuta-enterprise), abstract glyphs for principled brands (Session, Mullvad).
- Voice axes: *calm-reassuring* (Signal, Proton, Wire) vs *austere-principled* (Mullvad, Cryptee). No serious app uses red-banner alarm UX on its own surfaces.
- Common mistakes: (1) asymmetric warnings train users to read absence-of-badge as safe; (2) over-iconography desensitizes; (3) conflating *encrypted* with *verified identity*.

**Recommended moves for SendWyrd Sealed/Open indicator:**
1. **Glyph: thread/sigil, not lock.** Lock is exhausted, generic, browser-TLS-coded. *Wyrd* supplies native semantic: **knotted thread for Sealed, unknotted/open thread for Open.** Two-stroke hairline, ~14–16px, monospaced register. Symmetric by construction.
2. **Copy: literal, terse, austere — Mullvad-style.**
   - *Sealed · host cannot read this*
   - *Open · host can read this*
   Avoid poetic register here — wordmark/chrome carries *wyrd* poetry; the indicator is operational metadata, reads like a port number.
3. **Placement: top-of-content, left-aligned, hairline-ruled.** Set directly under wordmark, separated by hairline rule — reads as document metadata (byline-style), not UI control. Same x-position both states, same scale, same weight. No fill, no pill, no chip.
4. **Color: monochrome accent for state — not red/green.** *Graphite* for Sealed, *parchment/bone* for Open. Both desaturated, within 10% luminance of each other. Contrast is informational; color does no warning work.
5. **Motion: static.** No pulse, no shimmer, no mount animation. Motion turns metadata into an interrupt. Only acceptable: 100ms opacity fade on hover when explanation tooltip mounts.
6. **Bias check:** resist making Sealed feel "rewarding" (green check, sparkle). Symmetric means symmetric. If a designer asks "can we make Sealed pop more?" — answer is no.

## Synthesis Direction (CTO Call, Pre-Phase-D Draft)

The three streams point in mostly-coherent directions with one real tension to resolve:

**Tension: dark-first (Stream 1) vs light-first (Stream 2).**

**Resolution: dark-first is the canonical brand surface; light theme is available for daytime/accessibility.** Reasoning:
- User voice profile is cypherpunk-Nostr-adjacent, Nietzschean, anti-feed. Dark-first matches register.
- Linear/Vercel ride dark; SendWyrd's "fate cast forward" mystic resonance lives more naturally in the dark.
- Things-coded cool-paper is too soft for the SendWyrd brand register. Apply consumer-warmth lessons to *register and microcopy*, not to chromatic posture.

**Cohered direction (Phase D will formalize):**
- **Color**: Dark-first canonical. Near-black ground `#0A0A0A`, off-white type `#EDEDED`. Single accent = desaturated rune-blue or oxidized copper. Light theme available, mirrored.
- **Typography**: Söhne (or ABC Diatype / Geist Sans) for wordmark + marketing display. **Mono as load-bearing in-product voice** (Berkeley Mono / Geist Mono / Söhne Mono) for message body, codepoint counter, timestamps, message IDs. System stack for non-canonical UI text.
- **Signature flourish**: single hairline thread-knot or rune-mark glyph — appears in wordmark, in splash, and as the breathing sigil (4–6s opacity drift) on the canonical landing page. Nowhere else.
- **Privacy indicator**: knotted/unknotted thread glyph + Mullvad-terse literal copy + top-of-content hairline-ruled placement + static (no motion).
- **Microinteraction budget**: Rauno-style Disney follow-through on the codepoint counter (one place, 120ms). Otherwise static.
- **Iconography**: 1px hairline, Lucide as default starting point, custom thread-glyph family for SendWyrd-specific moments.
- **Whitespace**: aggressive. Each surface is one island.
- **State mood**: Apple Reminders / Mullvad — composure, not celebration. Errors quiet, successes acknowledged not feted.

This is *not* the Phase D proposal yet — it's the synthesized starting point that Phase D will turn into a complete spec (color tokens, type scales, motion timings, glyph library, IA, screen-by-screen flows).

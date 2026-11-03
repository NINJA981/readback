---
name: Readback
description: Spellcheck that has read the thread. A quiet compose overlay in brass on cold slate.
colors:
  # Dark (primary theme: popup, options, site). OKLCH is canonical; hex in prose.
  bg-dark: "oklch(0.165 0.01 250)"
  surface-dark: "oklch(0.20 0.012 250)"
  surface-2-dark: "oklch(0.235 0.013 250)"
  surface-3-dark: "oklch(0.27 0.014 250)"
  border-dark: "oklch(0.285 0.013 250)"
  border-strong-dark: "oklch(0.50 0.015 250)"
  text-dark: "oklch(0.94 0.006 250)"
  text-muted-dark: "oklch(0.80 0.012 250)"
  text-subtle-dark: "oklch(0.69 0.012 250)"
  brass-dark: "oklch(0.76 0.10 72)"
  brass-hover-dark: "oklch(0.81 0.09 75)"
  on-brass-dark: "oklch(0.17 0.02 70)"
  brass-soft-dark: "oklch(0.28 0.04 75)"
  brass-text-dark: "oklch(0.80 0.09 75)"
  slip-dark: "oklch(0.70 0.17 25)"
  danger-dark: "oklch(0.77 0.13 25)"
  danger-soft-dark: "oklch(0.28 0.06 25)"
  success-dark: "oklch(0.76 0.13 150)"
  success-soft-dark: "oklch(0.28 0.05 150)"
  # Light (Gmail overlay on light themes, light site/popup)
  bg-light: "oklch(0.98 0.003 250)"
  surface-light: "oklch(1 0 0)"
  surface-2-light: "oklch(0.955 0.005 250)"
  surface-3-light: "oklch(0.93 0.006 250)"
  border-light: "oklch(0.905 0.008 250)"
  border-strong-light: "oklch(0.60 0.012 250)"
  text-light: "oklch(0.22 0.012 250)"
  text-muted-light: "oklch(0.46 0.012 250)"
  text-subtle-light: "oklch(0.5 0.012 250)"
  brass-light: "oklch(0.50 0.10 62)"
  brass-hover-light: "oklch(0.45 0.09 62)"
  on-brass-light: "oklch(0.99 0.006 80)"
  brass-soft-light: "oklch(0.95 0.03 75)"
  brass-text-light: "oklch(0.48 0.10 62)"
  slip-light: "oklch(0.56 0.20 27)"
  danger-light: "oklch(0.54 0.19 27)"
  danger-soft-light: "#ffe8e6"
  success-light: "oklch(0.52 0.12 150)"
  success-soft-light: "oklch(0.95 0.035 150)"
typography:
  hero:
    fontFamily: "'Hubot Sans Variable', 'Mona Sans Variable', system-ui, sans-serif"
    fontSize: "clamp(3.5rem, 2rem + 6vw, 7.5rem)"
    fontWeight: 650
    lineHeight: 0.92
    letterSpacing: "-0.035em"
    fontVariation: "'wdth' 112"
  display:
    fontFamily: "'Hubot Sans Variable', 'Mona Sans Variable', system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 650
    lineHeight: 1.05
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 112"
  h1:
    fontFamily: "'Hubot Sans Variable', 'Mona Sans Variable', system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 106"
  h2:
    fontFamily: "'Hubot Sans Variable', 'Mona Sans Variable', system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.27
    letterSpacing: "-0.015em"
    fontVariation: "'wdth' 104"
  h3:
    fontFamily: "'Mona Sans Variable', system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 550
    lineHeight: 1.41
    letterSpacing: "-0.01em"
  lead:
    fontFamily: "'Mona Sans Variable', system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 420
    lineHeight: 1.53
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Mona Sans Variable', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 420
    lineHeight: 1.6
    letterSpacing: "-0.005em"
  ui:
    fontFamily: "'Mona Sans Variable', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 450
    lineHeight: 1.43
    letterSpacing: "0em"
  label-strong:
    fontFamily: "'Mona Sans Variable', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.29
    letterSpacing: "0em"
  label:
    fontFamily: "'Mona Sans Variable', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 520
    lineHeight: 1.38
    letterSpacing: "0em"
  caption:
    fontFamily: "'Mona Sans Variable', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 450
    lineHeight: 1.33
    letterSpacing: "0.005em"
  micro:
    fontFamily: "'Mona Sans Variable', system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 520
    lineHeight: 1.45
    letterSpacing: "0.01em"
  mono:
    fontFamily: "'Geist Mono Variable', ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 450
    lineHeight: 1.38
    letterSpacing: "0em"
    fontFeature: "'tnum' 1"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  full: "9999px"
spacing:
  "0.5": "2px"
  "1": "4px"
  "1.5": "6px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
  "12": "48px"
  "16": "64px"
  "24": "96px"
  "32": "128px"
components:
  button-primary:
    backgroundColor: "{colors.brass-dark}"
    textColor: "{colors.on-brass-dark}"
    typography: "{typography.label-strong}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
    height: "28px"
  button-primary-hover:
    backgroundColor: "{colors.brass-hover-dark}"
    textColor: "{colors.on-brass-dark}"
  button-primary-light:
    backgroundColor: "{colors.brass-light}"
    textColor: "{colors.on-brass-light}"
    typography: "{typography.label-strong}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
    height: "28px"
  button-secondary:
    backgroundColor: "{colors.surface-2-dark}"
    textColor: "{colors.text-dark}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
    height: "28px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted-dark}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
    height: "28px"
  ask-pill-open:
    backgroundColor: "{colors.brass-soft-dark}"
    textColor: "{colors.brass-text-dark}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
    height: "26px"
  ask-pill-open-light:
    backgroundColor: "{colors.brass-soft-light}"
    textColor: "{colors.brass-text-light}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
    height: "26px"
  ask-pill-covered:
    backgroundColor: "{colors.success-soft-dark}"
    textColor: "{colors.success-dark}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
    height: "26px"
  guard-card:
    backgroundColor: "{colors.surface-2-dark}"
    textColor: "{colors.text-dark}"
    typography: "{typography.ui}"
    rounded: "{rounded.lg}"
    padding: "12px"
    width: "320px"
  guard-card-light:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.text-light}"
    typography: "{typography.ui}"
    rounded: "{rounded.lg}"
    padding: "12px"
    width: "320px"
  citation:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.text-muted-dark}"
    typography: "{typography.mono}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
  ledger-row:
    backgroundColor: "transparent"
    textColor: "{colors.text-dark}"
    typography: "{typography.ui}"
    rounded: "{rounded.sm}"
    padding: "6px 8px"
    height: "32px"
  ledger-row-active:
    backgroundColor: "{colors.surface-3-dark}"
    textColor: "{colors.text-dark}"
  keycap:
    backgroundColor: "{colors.surface-2-dark}"
    textColor: "{colors.text-muted-dark}"
    typography: "{typography.micro}"
    rounded: "{rounded.xs}"
    padding: "0 5px"
    height: "20px"
  text-input:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.text-dark}"
    typography: "{typography.ui}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
    height: "32px"
  context-chip:
    backgroundColor: "{colors.surface-2-dark}"
    textColor: "{colors.text-muted-dark}"
    typography: "{typography.caption}"
    rounded: "{rounded.xs}"
    padding: "2px 8px"
    height: "22px"
  popup-shell:
    backgroundColor: "{colors.bg-dark}"
    textColor: "{colors.text-dark}"
    typography: "{typography.ui}"
    rounded: "0px"
    width: "360px"
    height: "480px"
  playground-pane:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.text-dark}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "20px"
---

# Design System: Readback

> The visual system for every Readback surface. Colour direction **D5 Bronze Vault** and type pairing **T8: Hubot Sans + Mona Sans + Geist Mono** are fixed; tokens are normative. `.impeccable/design.json` is the machine-readable sidecar of this file.

## Overview

**Creative North Star: "The Readback Line"**

A pilot reads an instruction back to the tower before acting on it. Readback does the same for a reply: it reads your draft back against what the other person actually wrote. The whole visual system serves one idea: **a thin brass line connecting what you typed to what they said.** It shows up literally in the hero (a 1 px brass hairline from a squiggled word to the thread token it was checked against). It also shows up as a material: brass instrument markings on cold slate, the way a cockpit panel labels only what you need, exactly where you need it.

Readback lives inside someone else's app, many times a day, and almost always says nothing. So it's quiet by default. Squiggles appear at 0 ms with no animation. The pill is one small object. The card speaks in one plain sentence plus the evidence. The system spends its boldness in exactly one place: **the swap-back**, the half-second where a wrong word turns into the right one in place, letters and digits sliding home. The landing page amplifies that moment. The product only lets it happen when the user clicks.

Density is compact (Raycast-like) in every surface the product draws. Marketing gets the comfortable scale and one poster-size headline.

**Key Characteristics:**
- Dark-first brass-on-slate for Readback's own surfaces (popup, options, site). The Gmail overlay follows the host's theme.
- One accent, brass, used as a signal: open asks, focus, the primary fix and the readback line. Never for errors.
- Slips are red squiggles (product brief: \"two red squiggles land\"), always paired with a citation, never with a generic "spelling" label.
- Evidence is set in Geist Mono: the cited amount, name or date the guard compared against.
- Depth from a cold surface ladder and hairlines. Shadows only on things that float over a host page.
- Zero motion on keystrokes. One choreographed moment on the fix.

## Colors

Cold slate neutrals (hue 250, chroma ≤ 0.016) under a warm brass accent (hue 62–75): metal on steel. Values follow the D5 direction. OKLCH is canonical, and the hex values are computed sRGB. Contrast was computed with WCAG 2 and APCA on 2026-10-20 (script in the ADR's token-check step).

### Primary
- **Instrument Brass** (dark `oklch(0.76 0.10 72)` #d9a767 · light `oklch(0.50 0.10 62)` #8b551c): primary fix button, focus ring, open-ask pill text, the readback line, the active tab indicator and links in prose. Dark: 8.86:1 on bg (Lc 59, labels ≥ 14px/600 or 15px/500 per ). Light: 5.82:1 on bg, 6.15:1 on white.
- **Brass Hover** (dark #e3b97e · light #784817): hover and pressed fill for brass buttons.
- **On Brass** (dark `oklch(0.17 0.02 70)` #150e06, 8.82:1 · light #fefbf7, 5.96:1): label colour on brass fills.
- **Brass Soft** (dark #342611 · light #fbecd9): open-ask pill background, `::selection`, hovered citation token.
- **Brass Text** (dark #e0b67b, 7.79:1 on brass-soft · light #854f15, 5.79:1 on brass-soft): brass as text on soft brass.

### Semantic
- **Slip Red** (dark `oklch(0.70 0.17 25)` #f66d67 · light `oklch(0.56 0.20 27)` #d02c2a): **only** the squiggle stroke. It is more saturated than danger text so a 1.5 px wavy line reads at a glance. 5.15:1 on Gmail white, 5.6:1 on Gmail's dark grey #202124.
- **Danger** (dark #fc928a · light #c52c2a) on **Danger Soft** (dark #421c19 · light #ffe8e6), at 6.81:1 and 4.76:1: the slip icon and rule label in the guard card, and the highlight's background tint on the active slip.
- **Success** (dark #6fc884 · light #287c42) on **Success Soft** (dark #15301b · light #dff6e2), at 6.98:1 and 4.55:1: the covered pill, answered checks and "Fixed" confirmation.
- No warning or info colours. The accent sits on the warning hue (65–80), so "attention" states use brass with an icon, and informational states are neutral with an icon.

### Neutral (cold slate)

| Role | Dark | Light | Use |
|---|---|---|---|
| bg | `oklch(0.165 0.01 250)` #0b0f13 | `oklch(0.98 0.003 250)` #f7f9fa | Page and popup background |
| surface | #12171b | #ffffff | Panes, cards at rest |
| surface-2 | #1a1f24 | #eef0f3 | Guard card, inputs on surface, secondary buttons |
| surface-3 | #21272d | #e5e8ec | Hovered/selected rows, keycap pressed |
| border | #252b30 | #dce0e5 | Hairlines, dividers |
| border-strong | #5d646c (3.21:1) | #7b8187 (3.73:1) | Input borders, switch tracks, focusable outlines |
| text | #e8ebef (16.08:1) | #161b20 (16.41:1) | Primary text |
| text-muted | #b8bec5 (10.27:1) | #53595f (6.71:1) | Secondary text, citations |
| text-subtle | #969ca3 (6.94:1, Lc 48) | #5e646a (5.66:1 on bg, 4.88:1 on surface-3) | Meta only; in dark only for ≥ 13px meta labels. Light was #6c7278 (4.26:1 on surface-2) until QA round 1 |

### Brand distance
Brass dark #d9a767 is ΔE_OK **0.069** from PostHog #f7a501 (the nearest blocklisted colour). Brass light #8b551c is **0.112** from Oura gold #af751b. Both clear the 0.06 floor. CI rechecks this with culori.

### Named Rules
**The Brass Means Reading Rule.** Brass says "Readback is reading this with you": open asks, focus and the fix. It never marks a mistake. Mistakes are red, carry an icon and are always cited.

**The No Orphan Red Rule.** A red squiggle never appears without a reachable citation: hover, Alt+Shift+J, or the ledger's slip list. Colour is never the only carrier of meaning.

**The Five Percent Rule.** Brass covers ≤ 5% of pixels on any screen, with at most one brass-filled button per view.

## Typography

**Display Font:** Hubot Sans Variable (wdth 75–125, wght 200–900), fallback Mona Sans Variable, then system-ui
**UI/Body Font:** Mona Sans Variable (wdth 75–125, wght 200–900), fallback system-ui
**Mono Font:** Geist Mono Variable (wght 100–900), fallback ui-monospace

**Character:** a wide, engineered display (Hubot at `wdth 104–112`) over a regular-width grotesque (Mona at `wdth 100`), so the contrast is width, not style. Geist Mono is the evidence voice: it sets only what was quoted from the thread or what must be read exactly (amounts, IDs, dates, names inside citations, keycaps). Weights are sub-default throughout (420/450/520/550/600/650), a quality borrowed from the email-client reference: warmer than 400/500/700 and never shouty.

All fonts are bundled from Fontsource 5.3.0 packages as Latin-subset variable woff2, with no network fonts anywhere. Extension budget: ≤ 40 KB per face after subsetting. Metric-matched fallbacks use `size-adjust` for CLS 0.

### Hierarchy
Compact scale for product surfaces (popup, overlay, options, playground chrome). T8 sets the default UI text at 14/20 rather than the more common compact 13/20, because the overlay sits next to Gmail's 14px body text, and anything smaller looks like a footnote.

| Token | Face | Size / LH | Weight | Tracking | Use |
|---|---|---|---|---|---|
| hero | Hubot wdth 112 | clamp(56→120px) / 0.92 | 650 | −0.035em | Landing H1 only, one per page |
| display | Hubot wdth 112 | 44 / 46 | 650 | −0.025em | README and landing section openers |
| h1 | Hubot wdth 106 | 28 / 32 | 600 | −0.02em | Options page title, playground title |
| h2 | Hubot wdth 104 | 22 / 28 | 600 | −0.015em | Options section titles |
| h3 | Mona | 17 / 24 | 550 | −0.01em | Panel and card titles, guard card message |
| lead | Mona | 17 / 26 | 420 | −0.01em | Landing body lead (comfortable scale) |
| body | Mona | 15 / 24 | 420 | −0.005em | Long text, playground editors, prose ≤ 68ch |
| ui | Mona | 14 / 20 | 450 | 0 | **Default UI text**, ledger rows |
| label-strong | Mona | 14 / 18 | 600 | 0 | Brass-filled button labels |
| label | Mona | 13 / 18 | 520 | 0 | Secondary/ghost buttons, pill, toggles |
| caption | Mona | 12 / 16 | 450 | +0.005em | Meta, timestamps, helper text |
| micro | Mona | 11 / 16 | 520 | +0.01em | Keycaps, tiny counts |
| mono | Geist Mono | 13 / 18 | 450 | 0 | Citations, values, IDs; `tnum` on |

Comfortable scale for the landing body: lead 17/26, body 16/26 Mona 420, h2 28/34 Hubot 600 wdth 108, h1 36/40 Hubot 600 wdth 110.

**Features:** `font-synthesis: none`; `font-optical-sizing: auto`; `tabular-nums` on every count, amount and date; `font-variant-ligatures: none` on mono. `text-wrap: balance` on headings, `pretty` on paragraphs. Curly quotes and `…` throughout. No stylistic sets are adopted until verified in the shipped woff2 (Stage 2 checks Mona's and Hubot's `ss0x` lists).

### Named Rules
**The Evidence Is Mono Rule.** Geist Mono sets only text quoted from the thread or text that must be read exactly. It never sets decorative labels, eyebrows or headings.

**The Three Hubots Rule.** Hubot Sans appears in at most 3 places per screen. In the extension it appears only on the options page title and section titles. The popup and overlay are Mona-only.

**The No Caps Rule.** No all-caps labels and no tracked-out eyebrows anywhere. Taxonomy, where real, is sentence case at label size in text-muted.

## Layout

- **Base unit 4px.** Tokens: 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96, 128.
- **Compact controls:** height 28 (sm), 32 (md), 36 (lg). Button padding 6 × 12. Input padding 6 × 10. List rows 32. Card padding 12–16. Never 32+ inside a card.
- **Popup:** body width 360, height 480, padding 12. The primary task (status plus site toggle) is fully visible without scrolling. Only the guard list region scrolls if needed (`scrollbar-gutter: stable`).
- **Overlay (Gmail):** the ask pill docks 8px inside the compose editor's bottom-right corner, above Gmail's toolbar row and never over it. It is measured from the editor's rect, re-anchored on resize and scroll with a `ResizeObserver` and rAF. The guard card anchors below the slip's first client rect (flips above when there's < 220px of space), offset 6px, kept inside the viewport with 8px insets.
- **Options:** single column, max-width 720, gutters 16/24/32 at 375/768/1440, section gap 32, a left in-page nav at ≥ 1024.
- **Playground:** two panes (thread | reply) at ≥ 960 on a 12-column grid with 24px gaps (5 + 7 columns, so the reply is wider because it's the working surface). They stack at < 960 with the thread collapsed to a 6-line preview that expands. The ledger and slip list sit in a 320px inspector at ≥ 1280 and below the reply otherwise.
- **Landing:** content max 1200, prose 68ch, sections 96 desktop / 64 mobile, left-aligned. Every layout follows the reference widths (375 / 768 / 1440). No horizontal scroll at 375.
- **Z-index:** overlay shadow host `2147483647`. Inside it: pill 10, card 20, swap-back ghost 30.

## Elevation & Depth

Readback's own surfaces are flat and tonal: depth comes from the cold surface ladder (+0.035 L per step in dark) and 1px hairlines, with the dark top-edge highlight `inset 0 1px 0 oklch(1 0 0 / 0.05)`. Shadows exist only for objects that **float over someone else's page** (the guard card, ledger popover and pill over Gmail) and for dialogs on the site. They are layered, tinted with the slate hue and never blurry blobs.

### Shadow vocabulary
- **e1 ring** (`0 0 0 1px var(--border), 0 1px 2px oklch(0.25 0.02 250 / 0.04)`): inputs and resting cards in light theme.
- **e3 float** (light: `0 0 0 1px oklch(0.25 0.02 250 / 0.08), 0 2px 4px -1px oklch(0.25 0.02 250 / 0.08), 0 8px 16px -4px oklch(0.25 0.02 250 / 0.14)`; dark: `0 0 0 1px var(--border), inset 0 1px 0 oklch(1 0 0 / 0.05), 0 12px 24px -8px oklch(0 0 0 / 0.55)`): guard card, ledger popover, pill (pill uses only the ring and the first drop layer).
- **e4 modal** (light: `0 0 0 1px oklch(0.25 0.02 250 / 0.08), 0 8px 16px -4px oklch(0.25 0.02 250 / 0.10), 0 24px 48px -12px oklch(0.25 0.02 250 / 0.22)`; dark: `0 0 0 1px oklch(1 0 0 / 0.06), 0 24px 48px -12px oklch(0 0 0 / 0.6)`): ⌘K palette and site dialogs.
- **Scrim:** `oklch(0.12 0.01 250 / 0.45)` light, `/ 0.65` dark.

### Named Rules
**The Guest Shadow Rule.** A shadow means "this floats over a page we don't own". Nothing inside our own pages gets a shadow except e4 dialogs.

## Shapes

**Standard-tight radius:** xs 4 (keycaps, context chip, highlight tint), sm 6 (buttons, inputs, citation block, ledger rows), md 8 (popup sections, playground editors), lg 10 (guard card, ledger popover, playground panes), full (the ask pill and switch thumbs only).

- **One CTA grammar: rectangles.** Every button is a 6px rectangle. The ask pill is full-radius because it is a status object, not a button you'd mistake for a CTA. It is the only pill in the product.
- **Concentric nesting:** the guard card (10) with 12px padding holds a citation block at 6, and its buttons at 6.
- **The squiggle** is `text-decoration: wavy underline 1.5px`, `text-underline-offset: 3px`, in Slip Red. The active slip adds a `danger-soft` background tint inside the highlight (radius is impossible in `::highlight`, so the tint is square by necessity).
- **The readback line** is a 1px brass SVG path with a 3px brass dot at each end: a quarter-ellipse elbow from the squiggled word's baseline to the cited token's baseline. It is used only where both ends are on screen (playground, landing, guard card).
- **Icons:** Lucide, 16px, 1.5 stroke. Slip uses `circle-alert`. Open ask uses an 8px hollow brass ring. Looks-answered uses the same ring dotted (SVG `stroke-dasharray: 2 2`). Answered uses a 16px `check` in success.

## Components

Each component lists its states. "Light" variants use the same geometry with light tokens, chosen by host luminance (overlay) or `prefers-color-scheme` / the theme toggle (own pages).

### Buttons
- **Primary (brass):** 28px tall, 6 × 12 padding, label-strong 14/600 in both themes. Dark labels on brass measure Lc 61 (8.82:1), which meets the contrast rule for brass labels only at ≥ 14px/600, so primary labels never drop to 13px. Hover: brass-hover (100 ms colour). Pressed: `scale(.97)` 100 ms. Focus-visible: 2px brass outline, offset 2px. Loading: label kept, 14px spinner prepended, width locked, `aria-busy`. Disabled: never used on submit; elsewhere `opacity .5` with a tooltip explaining why.
- **Secondary:** surface-2 fill, text, 1px border.
- **Ghost:** text-muted, hover surface-3. Used for **Ignore** and **Dismiss**.

### Ask pill (overlay, docked)
- **Shape:** full radius, 26px tall, 4 × 10 padding, label 13/520 `tnum`. Icon 8px ring, then count text.
- **States:**
  - **Hidden:** no asks extracted, and no slips. Nothing renders, and the shadow host keeps `display:none`.
  - **Open (brass):** brass-soft background, brass-text, text `3 asks · 1 open`.
  - **Looks answered (brass, dotted):** nothing is open but at least one ask is only a guess (the dotted ring). Brass-soft background, brass-text, the dotted 8px ring, text `3 look answered` (the number of dotted asks; `1 looks answered`). Never success green and never `All covered`: coverage stays the dotted ring until the user confirms.
  - **Covered (success):** only when every ask is confirmed. Success-soft background, success text, check icon, text `All covered`. The colour change takes 150 ms. The count rolls with NumberFlow when the last *open* ask is covered by confirming it.
  - **With slips:** a 6px slip-red dot and `1 slip` segment are appended after a 1px border divider (`3 asks · 1 open | 1 slip`). Clicking the slip segment jumps to the slip.
  - **Fixed confirmation (6 s):** `Fixed: Kathryn · Undo Ctrl+Z` replaces the text, then reverts.
  - **Separator exception:** the middle dot in `3 asks · 1 open` and `Fixed: Kathryn · Undo Ctrl+Z` is a deliberate exception to the no-middle-dot copy rule. The pill is a one-line status, and a comma reads as a sentence (`3 asks, 1 open`) where the dot reads as two separate readouts. It is used in the pill and the popup status row only, never in prose.
  - **Loading:** none. The pill appears only after the first check, which takes ≤ 16 ms. There is no skeleton because there's nothing to wait for.
  - **Error:** the adapter self-test fails, so the pill doesn't render (fail silent). The status shows in the popup.
- **Interaction:** click or Alt+Shift+L opens the ledger. `aria-live="polite"` announces count changes at most once per 2 s.

### Ledger (popover from the pill)
- 300px wide, lg radius, e3, 8px padding. Sections: **Asks** (≤ 5 rows) and **Slips** (all flags, each with a Fix button, which is the keyboard-accessible list behind every squiggle).
- **Row:** 32px. State icon, ask text (1 line, ellipsis, full text in `title`), right-aligned actions on hover/focus: **Confirm** (check), **Answer inline**, **Dismiss** (x, with `aria-label`). Row actions stay visible on touch.
- **Empty:** `No asks in the last message.` and, below in caption, `Readback only lists direct questions and requests.`
- **Overflow:** `+2 more not shown` in caption.
- **Error:** not applicable (the ledger never opens without data).
- **Success:** all rows checked, plus a header line `Everything she asked is covered.`

### Guard card (the citation tooltip)
- **Geometry:** 320px wide, lg radius, 12px padding, surface-2 (dark) or surface (light), e3. Opens after 300 ms of hover, or instantly from the keyboard. Entry `opacity 0 → 1, scale .96 → 1` over 160 ms `--ease-out`, origin at the slip. Exit 120 ms.
- **Content, top to bottom:**
  1. Message line (h3 17/24 550): `Signs as Kathryn`, `Thread says $1,250. Digits swapped?` or `The 10th is a Tuesday.`
  2. Citation block (mono 13/18, surface/bg, sm radius): the thread line with the matched token in text colour plus a brass underline, and the source in caption beneath (`From her signature`, `To: Kathryn Moss`, `Her message, 2 Nov`).
  3. Actions: primary **Change to Kathryn** (one or two fixes), ghost **Ignore**, overflow menu with **Never flag "Catherine"**. Keycap hints: `↵` on the primary, `Esc` to close.
- **States:** rest; keyboard-focused (focus ring on the primary); applying (a 0 ms text swap, then the card closes and swap-back plays); fix unavailable (the host refused `insertText`): the message becomes `Couldn't edit this box. "Kathryn" is copied, so paste it over the word.`, the primary becomes **Copy again**, and nothing is lost.
- **A11y:** `role="dialog"` with `aria-labelledby` set to the message. Focus moves in on keyboard open only. Esc returns focus to the editor at the slip's end.

### Swap-back ghost
- A transient element in the shadow root, positioned over the fixed range's rect and set in the host editor's computed font (family, size, weight and letter-spacing are read with `getComputedStyle`). It plays the morph (see the signature moment), then removes itself. The real text underneath is already correct from frame 0. The ghost covers it with a `background` sampled from the editor's computed background colour. If sampling fails (images, gradients), the ghost is skipped and the fix is instant.

### Context chip (generic adapter)
- 22px tall, xs radius, caption, surface-2, docked 6px above the field's top-right corner: `Context: 84 words from this page` plus a **Clear** ghost button.
- **Empty:** not shown. **Error:** `No text selected. Select the message first.` for 4 s. **Success:** the chip itself.

### Textarea mirror
- An invisible clone of the textarea's box and font metrics inside the shadow root, with transparent text, the squiggle as a positioned `text-decoration`, and pointer-events off except on slip spans, which open the guard card.

### Keycap
- 20px tall, min-width 20, padding 0 × 5, xs radius, micro 11/520, surface-2, 1px border, `box-shadow: inset 0 -1px 0 var(--border)`. **Pressed echo (M9):** when the user presses the matching shortcut, `data-pressed` applies `translateY(1px)` and drops the inset for 120 ms.

### Popup (360 × 480)
Header row: wordmark set in Mona 14/600 (text, no logo art), the site switch on the right. Then the status block, guard toggles, privacy line and footer links.
- **Empty (not a mail page):** `Readback checks your reply against the message you're answering.` Primary **Open the playground**. Secondary text: `On any site: select the message, right-click, choose "Use as Readback context".` Keycap hint `Alt Shift R`.
- **Loading:** none needed. The popup reads cached tab status from `chrome.storage.session` synchronously and first paint is ≤ 100 ms. If the tab status is older than 2 s, a 1-line skeleton matching the status text width shows after a 150 ms delay.
- **Active / success:** `Reading this reply` (h3), then `3 asks · 1 open` and `1 slip: "Catherine" → Kathryn` as two ledger-style rows. Clicking a row focuses the tab and opens the card.
- **Error (layout not recognised):** an icon plus `Gmail's layout wasn't recognised, so Readback is staying out of the way.` Next step: `Select her message and choose "Use as Readback context".` Secondary: **Copy diagnostics** (selector self-test results only, no mail text).
- **Off for this site:** `Readback is off on mail.google.com.` with the switch to turn it on.
- **Privacy line (always):** caption `0 network requests. Readback never sends your mail anywhere.` with a link **How to check**.

### Options (full tab)
- Sections: **Guards** (a toggle per guard with a one-line example each, set in mono), **Ignored words** (a list with remove buttons), **Looks-answered model** (off / on, with its bundled size and status), **Your data** (what is stored, where, **Clear all**), **Shortcuts**.
- **Empty (ignored words):** `Nothing ignored yet. Choose "Never flag" on any squiggle to add a word here.`
- **Loading (model enabling):** an inline progress row `Loading the on-device model… 1.4 s` with a determinate bar if > 2 s. No spinner-only states.
- **Error (model failed):** `The model couldn't start in this browser (WebAssembly was blocked). Looks-answered still works with word matching.` Actions **Try again** and **Copy error details**.
- **Success:** `Model ready. Runs on this device, 0 requests.` plus an Undo toast for **Clear all** (6 s, Ctrl+Z).

### Playground (app screen on the site)
- Header: title (h1 Hubot), sample picker (select), guard toggles, ⌘K hint.
- Panes: thread (paste area, sender/signature detection preview) and reply (the contenteditable with live squiggles, the docked pill and the guard cards). The readback line draws only on hover/focus of a slip.
- **Empty (no thread):** `Paste the message you're replying to.` plus **Load a sample thread** (primary) and a hint `or press ⌘K`. The reply pane is disabled-looking but focusable, saying `Your reply goes here. Readback checks it against the thread on the left.`
- **Loading:** none (synchronous engine).
- **Error:** paste too large (> 50,000 characters): `That's longer than Readback reads (50,000 characters). Paste just the last message.` Unparseable input never errors: the playground shows `0 asks, 0 names found` with a tip.
- **Success:** a clean reply shows the covered pill and a quiet line `No slips against this thread.`
- **Sample label:** every loaded sample shows a `Sample thread` context chip.

### Landing page (Persuade surface)
Sections follow `docs/LANDING.md`: hero (live playground in demo mode), the real product in motion, three proofs (one per guard), how it works (SVG diagram), and install.
- **Empty / loading:** the hero poster (a static frame of the playground at t = 4.6 s) is server HTML and the LCP element, so there's no loader. The live playground hydrates over it.
- **Error:** if JS fails, the poster plus a static transcript of the demo remain, and the playground link still works without JS (a `<noscript>` note).
- **Success:** the CTA row (`Add to Chrome`, `Firefox build`, `Try the playground`). Store links only once listings exist; until then the CTA is **Install from source** with the copyable command.

### Command palette (⌘K / Ctrl+K, playground + options)
- Instant open (0 ms), 640px wide, 20vh from the top, input 48px at lead size, 36px rows with a right-aligned keycap.
- Commands: Load sample (6 entries), Clear thread, Clear reply, Next slip (`J`), Open ledger (`L`), Toggle name/number/date guard, Toggle asks, Copy share link, Export result as JSON, Switch theme (System/Light/Dark), Open options. Empty search: `No command matches "xyz".`

### Shortcut map
| Action | Keys | Scope |
|---|---|---|
| Open popup | Alt+Shift+R | Extension command |
| Next slip (open its card) | Alt+Shift+J | Extension command, active compose |
| Open ledger | Alt+Shift+L | Extension command, active compose |
| Apply primary fix | Enter | Guard card focused |
| Second fix | Shift+Enter | Guard card with two fixes |
| Ignore in this thread | I | Guard card focused |
| Close card or ledger | Esc | Overlay |
| Command palette | ⌘K / Ctrl+K | Playground, options |
| Next / previous slip | J / K | Playground when no input is focused |

## Signature moment: "Swap-back" (squiggle-to-fix)

**Event:** the user applies a fix. It's rare and meaningful, never on the core typing loop. It combines the **M3 text morph** (letters) and **M5 rolling digits** (numbers) into one Readback-specific moment, plus the **readback line**. Studio note: if another app claims M3 or M5 as its signature, Readback's distinct version is the combined swap-back with the line, and the swap test still holds.

### Frame by frame (60 fps, playground capture; Gmail runs the same steps 3–6)

| t (ms) | Frame | What happens | Token |
|---|---|---|---|
| 0 | Typed | The comma after `Catherine` is typed. The engine runs (≤ 16 ms). The squiggle **appears fully drawn**, with no draw-in animation (P1: keystroke feedback is instant). | `--dur-0` |
| +300 | Hover dwell | The pointer has rested 300 ms on the squiggle. The highlight switches to `readback-slip-active` (danger-soft tint, 0 ms). | n/a |
| +300 → +460 | Card in | The guard card scales `.96 → 1` and fades in from the slip's rect origin. | 160 ms `--ease-out` |
| +300 → +540 | Readback line | The 1px brass path draws from the squiggle's baseline to `Kathryn` in the cited signature (`stroke-dashoffset` length → 0). The target token gets brass-soft. *Playground and landing only. In Gmail the line runs inside the card from the message to the citation block.* | 240 ms `--ease-in-out` |
| click (C) | Commit | Text is replaced in the editor at C+0 (the real edit is never delayed). The card exits. The squiggle is removed at C+0 because the flag no longer exists. | exit 120 ms |
| C → C+280 | Morph | The ghost shows `Catherine` and morphs to `Kathryn`: shared letters (`a t h r n`) slide to their new x on `SPRING.snappy` (visualDuration .18, bounce 0). Leaving letters (`C`, `e`, `i`, `e`) fade with blur 0 → 2px over 100 ms. Arriving letters (`K`, `y`) fade in from blur 2px and y +3px over 150 ms, starting at C+80. | 280 ms total |
| C → C+240 | Digit roll (numbers) | For `$1,520 → $1,250`, each changed digit rolls vertically in its column in the direction of change (masked edges, `tnum`). Unchanged glyphs (`$`, `1`, `,`, `0`) stay still. | 240 ms `--ease-out` |
| C+280 | Settle | The ghost is removed and the real text shows (pixel-identical). The pill text crossfades to `Fixed: Kathryn · Undo Ctrl+Z` (150 ms, 2px blur on the outgoing text). | 150 ms |
| C+6280 | Revert | The pill returns to its count text. | 150 ms |
| Later (last ask covered) | Pill flip | The count rolls (`1 open → 0 open`, NumberFlow), then background and text cross to success over 150 ms and the check path draws (`pathLength 0 → 1`, 150 ms). The pill's width is reserved in `ch`, so CLS = 0. | 150 + 150 ms |

**Interruptibility:** the morph is CSS/WAAPI on the ghost only. Any keystroke during the morph removes the ghost at once, because the real text is already correct. A second fix starts its own ghost.

**Reduced motion:** no morph, roll or line draw. The card appears with a 150 ms fade. The fix is instant. The pill crossfades colour (150 ms) without the roll. The readback line appears fully drawn while the card is open.

**Screenshot-ability:** the playground's `?demo=signature&t=<ms>` renders any frame above deterministically (all motion derives from the timeline's `t`, not wall-clock time). Frames t = 4,600 (card + line) and t = 9,800 (clean reply, brass dotted pill `3 look answered`) are the poster frames.

## Landing 3D / immersive plan: CSS/SVG only, by decision

**The sentence the visual says:** *"Your reply was checked against her own words."* A flat line between two words says that exactly. A 3D object would only decorate it (3P2: 3D must explain something the flat version can't).

- **Decision:** no WebGL, no R3F, no shader. The hero is the **real playground** in demo mode (DOM text, real engine), with the readback line as inline SVG. That follows two rules: ("show the real thing") and 3P10 ("the DOM stays the source of truth"), the same choice Linear makes with 0 canvases.
- **Patterns used (≤ 2):** **T1 poster-first handoff**, with a static frame of the demo as the server-rendered LCP image under the live DOM demo, and **T21 (CSS version)**, two real-UI cards (thread and reply) in a shallow stack: `perspective: 1200px`, the thread card at `rotateY(4deg) translateZ(-24px)` and the reply flat. The perspective is removed at < 768px and under reduced motion.
- **Atmosphere:** one radial brass glow at ≤ 6% alpha behind the reply card, plus static SVG `feTurbulence` grain at 4% opacity (T23, ≈ 400 B). No animated gradient.
- **Pre-rendered deliverables:** README GIF (800px, ≤ 3 MB, ≤ 6 s), LinkedIn MP4 1:1 and 4:5, the landing poster AVIF (≤ 80 KB) and the OG card PNG (1200 × 630), all captured from `?demo=signature` with Playwright frame stepping and encoded with the bible's ffmpeg commands. There's no WebGL, so no SwiftShader flags are needed.
- **Budgets:** initial JS ≤ 120 KB gz (it includes the engine for the live hero; if it goes over, the hero hydrates the engine on idle and the poster carries the first paint). 3D chunk: none (0 KB). CLS 0. LCP = poster or H1, ≤ 2.0 s.
- **Tier 0 / reduced motion / no JS:** the poster frame plus a `Play the demo` button (no autoplay under reduced motion). The demo, when played, is instant cuts between key frames.
- **Autoplay:** the hero demo plays once when ≥ 50% in view, then rests on the final frame. **Replay** and **Pause** buttons (32px, bottom-right) satisfy WCAG 2.2.2. It never loops.

## Do's and Don'ts

### We never
1. **We never touch the host's text or DOM without a click.** No wrapped spans, no injected styles, no auto-corrections. Squiggles are highlights. Fixes happen only on Click or Enter, through the editor's own undo stack.
2. **We never use brass to mark a mistake.** Brass is reading, focus and the fix. Slips are red, with an icon and a citation, every time.
3. **We never animate a keystroke.** Squiggles, counts and chips change at 0 ms while the user types. Motion is reserved for the fix (swap-back) and the pill's final flip.

### Do:
- **Do** cite the thread in every slip message, in the reader's terms: `Signs as Kathryn`, not `Possible misspelling`.
- **Do** set every quoted value in Geist Mono with `tnum`, exactly as the thread wrote it.
- **Do** follow the host's theme in the overlay (measure the editor background luminance) and `prefers-color-scheme` in our own pages, with a System/Light/Dark toggle on the site.
- **Do** keep one brass-filled button per view (the primary fix in the card, **Open the playground** in the empty popup, **Load a sample thread** in the empty playground).
- **Do** label every synthetic example `Sample thread`.
- **Do** reserve pill and count widths in `ch` so nothing shifts.

### Don't:
- **Don't** use warning amber or info blue anywhere. Their hues collide with brass or add a second accent.
- **Don't** add a draw-in animation to squiggles, a stagger to ledger rows, or hover lift on anything.
- **Don't** use pills for buttons. The ask pill is the only full-radius element besides switch thumbs.
- **Don't** show a model's guess as a fact: model-derived coverage is always the dotted ring until the user confirms.
- **Don't** place the pill over Gmail's toolbar or Send button, or anywhere a click could be mistaken for sending.
- **Don't** reproduce reference-brand surfaces (no lavender, no red stripes, no white CTA, no indigo hero, no #010102/#07080a ladders), names or proprietary fonts.

## Blend notes

| Reference | We took | We rejected | Our version differs by |
|---|---|---|---|
| **superhuman** | Sub-default weights for warmth (Mona 420/450/520 vs 400/500/700); one action per surface; shortcuts learned through ⌘K | Indigo hero, twilight portrait photography, violet pill CTA, the deep-teal closing band, warm grey ink | Our neutrals are cold slate (D5), the warmth lives only in brass, and the hero is product UI, not a person |
| **raycast** | Elevation from a surface ladder, not shadows; keycaps shown inline for every shortcut (with the M9 pressed echo); 12–16px in-card padding; zero-animation open; real product UI as the hero | The red stripe hero, the white primary CTA, Inter + ss03, dark-only | We ship a re-derived light theme (the Gmail overlay needs it). Primary is brass, not white. Type is T8 |
| **linear.app** | Accent restricted to focus, primary and link emphasis; hairline borders; negative display tracking; the 12/13/14 small-type ladder; mono for identifiers only | Lavender accent, #010102 canvas and its ladder, the custom typefaces, the refusal of light mode | Our ladder is slate hue 250 at fixed lightness steps, our accent is warm, and our mono is evidence (quoted values) rather than IDs |

## Appendix B pre-flight checklist, ticked

- [x] **Archetype and blend notes, with what was rejected:** keyboard-first writing tool / quiet compose overlay (product brief), using A6 + A1 references (superhuman, raycast, linear.app), see Blend notes.
- [x] **Direction with adjustments, re-checked against §4.4:** D5 Bronze Vault. Adjustments: added `surface-3`, `brass-text`, `slip` (squiggle stroke); no warning/info semantics. ΔE_OK 0.069 / 0.112 ≥ 0.06.
- [x] **Pairing, scale, font features:** T8 Hubot Sans + Mona Sans + Geist Mono. Compact in product (UI 14/20 by T8), comfortable on marketing. `tnum` on numbers, `font-synthesis: none`, no stylistic sets until verified.
- [x] **Radius, CTA grammar, theme default:** standard-tight 4/6/8/10; rectangular CTAs; dark-first for own surfaces, host-matched overlay.
- [x] **Three "we never" constraints (P8):** see Do's and Don'ts.
- [x] **One or two signature moments and their event:** Swap-back (M3 + M5 + readback line) on applying a fix; the pill flip on the last ask covered is its quiet echo.
- [x] **Shortcut map and cmdk command list:** see Components → Command palette and Shortcut map.
- [x] **Empty, loading, error and success copy for every primary screen:** popup, ledger, guard card, context chip, options, playground, landing (Components).
- [x] **Target platforms and their §8 constraints:** Chrome MV3 + Firefox 140+ extension (§8.3: popup 360 × 480, ≤ 100 ms first paint, shadow DOM content UI at z 2147483647, bundled fonts, `prefers-color-scheme`), static site (§8.1 widths). Platform matrix in SPEC §9.

### §11.10 3D pre-flight additions
- [x] **The one sentence and the T-patterns (≤ 2):** "Your reply was checked against her own words." T1 + T21 (CSS). No WebGL by decision.
- [ ] **Poster, loop and OG card rendered from the scene via the capture kit:** Stage 2 (playground capture, not R3F).
- [ ] **`size-limit` entries:** initial ≤ 120 KB defined in the ADR; 3D chunk not applicable (0 KB). To be wired in Stage 2.
- [ ] **Tier 0 / reduced-motion / no-JS screenshots passing §9:** Stage 2.

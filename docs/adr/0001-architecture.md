# ADR-0001: Readback architecture (WXT extension, pure-TS engine, Highlight-API overlay, static playground)

**Status:** Accepted (Stage 1, Architect)
**Date:** 2026-10-20
**Deciders:** Readback maintainers. Stage 2 builders may amend this ADR through a follow-up ADR, never by silent drift.

## Context

Readback checks a reply draft against the message it answers: names, numbers and dates through near-miss guards (the lead), plus a supporting ask pill. See [`SPEC.md`](../../SPEC.md). These forces shape the architecture:

1. **Host hostility.** Gmail's compose DOM is obfuscated, re-rendered often and owned by Google. The common failure: Grammarly-class overlays glitch, and eating a Send gets you uninstalled. Readback must never change Gmail's editor DOM, never intercept Send, and fail silently.
2. **Privacy.** No hosted backend, no telemetry, and keys and data stay local. This MVP has no LLM and no BYO key, so the extension makes **zero** requests.
3. **Latency.** Guards run on every keystroke. Target: ≤ 100 ms to visible feedback. Our engine budget is p95 ≤ 16 ms per check, so feedback lands in the same frame as the keystroke.
4. **Testability without a Gmail account.** Agents can't log in to Gmail, so the engine must be pure and fixture-driven, the Gmail adapter must run against saved DOM fixtures, and the playground must double as the harness.
5. **Two browsers.** Chrome MV3 first, plus a Firefox MV3 build. WXT handles manifest differences.
6. **Optional model.** MiniLM refines only the dotted "looks answered" state. Everything else is deterministic.

## Decision

A **pnpm monorepo** with one pure-TypeScript engine shared by three hosts:

- the **WXT extension** (Gmail adapter, generic selection adapter, popup, options, background, optional model host);
- the **static site** (landing + paste-thread playground), built with Vite;
- the **test harness** (vitest for the engine and corpus, Playwright for the extension and site).

Squiggles are drawn with the **CSS Custom Highlight API**. All Readback UI lives in **one shadow root** per tab. Fixes go through the editor's own input path on an explicit click or Enter.

## Stack (versions pinned exactly, checked with `npm view <pkg> version` on 2026-10-20)

Toolchain on this machine: Node **24.18.0**, pnpm **10.34.6** (npm's latest is 12.14.0, but the repo pins the installed major through `packageManager: "pnpm@10.34.6"` so builds are reproducible here), git 2.55.0.

| Package | Version | Role | Notes |
|---|---|---|---|
| `wxt` | **0.21.4** | Extension framework (MV3, Chrome + Firefox) | Peers: vite ^6.3.4 \|\| ^7 \|\| ^8 ✓; node ≥ 22 ✓ |
| `@wxt-dev/module-react` | **1.2.2** | React in WXT entrypoints | Peer wxt ≥ 0.19.16 ✓ |
| `typescript` | **7.0.2** | Type checking (`tsc --noEmit` through the native compiler) | TS 7 is the native-port line. If any tool needs the classic JS compiler API, fall back to **6.0.3** and record it here |
| `react`, `react-dom` | **19.3.1** | UI for popup, options, overlay, site | |
| `@types/react`, `@types/react-dom` | **19.3.0** | | |
| `vite` | **8.3.4** | Site build (WXT brings its own Vite through the same peer range) | |
| `@vitejs/plugin-react` | **6.1.2** | Site React transform | Peer vite ^8 ✓ |
| `tailwindcss`, `@tailwindcss/vite` | **4.3.3** | Utility CSS bound to DESIGN.md role tokens (`@theme inline`) | Raw palette utilities banned by a CI grep |
| `@radix-ui/react-tooltip` | **1.4.1** | Site and options tooltips | The overlay guard card is custom (anchored to a Range, not an element) |
| `@radix-ui/react-popover` | **1.3.1** | Ledger popover in options/playground | |
| `@radix-ui/react-switch` | **1.4.1** | Guard toggles | |
| `@radix-ui/react-tabs` | **1.2.1** | Options sections | |
| `cmdk` | **1.1.1** | ⌘K palette in the playground and options | |
| `motion` | **14.4.0** | Swap-back morph, pill flip, popovers | `MotionConfig reducedMotion="user"` |
| `@number-flow/react` | **0.6.2** | Pill count roll (M5) | Respects reduced motion |
| `lucide-react` | **1.60.0** | Icons (16 px, 1.5 stroke), tree-shaken | |
| `chrono-node` | **2.10.3** | Date parsing for the date guard (English only) | MIT |
| `@huggingface/transformers` | **4.3.1** | Optional MiniLM embeddings (feature-extraction) | Pulls `onnxruntime-web` 1.31.0-dev.20260914 (a dev build, 145 MB unpacked). Pin and audit what gets copied into the package |
| `@fontsource-variable/hubot-sans` | **5.3.0** | Display face (wdth 75–125, wght 200–900) | Bundled, Latin subset |
| `@fontsource-variable/mona-sans` | **5.3.0** | UI face (wdth 75–125, wght 200–900) | Bundled, Latin subset |
| `@fontsource-variable/geist-mono` | **5.3.0** | Mono for cited values, IDs, keycaps | Bundled, Latin subset |
| `vitest`, `@vitest/coverage-v8` | **5.0.5** | Unit, corpus, coverage | Peer vite ^8 ✓ |
| `happy-dom` | **21.0.3** | DOM for adapter unit tests (text-index mapping) | |
| `@playwright/test` | **1.64.1** | e2e with the unpacked extension, visual capture | Chromium is installed locally |
| `@axe-core/playwright` | **4.14.0** | Accessibility gate | |
| `culori` | **4.0.2** | CI token checks: contrast, ΔE_OK brand distance, gamut | |
| `size-limit`, `@size-limit/file` | **14.2.0** | Bundle budgets | |
| `@biomejs/biome` | **2.5.15** | Lint + format, including the `noRestrictedGlobals` network ban | One tool instead of ESLint + Prettier |
| `@types/chrome` | **0.3.5** | Only for APIs WXT's `browser` types don't cover (`offscreen`) | |
| `@types/node` | **24.19.2** | Matches the installed Node major | npm latest is 26.6.5; pinned to the runtime major |
| `fflate` | **0.8.3** | Compresses the playground share link (hash fragment only) | |

Not used: an LLM SDK, a backend, analytics, remote fonts, `webextension-polyfill` (WXT's `browser` covers it), and three.js/R3F (the landing is CSS/SVG only, see DESIGN.md §3D plan).

## Module layout

```
readback/
├─ package.json                 # workspace root: scripts, packageManager, engines
├─ pnpm-workspace.yaml
├─ biome.json                   # includes the network-API ban
├─ .size-limit.cjs
├─ packages/
│  ├─ engine/                   # PURE TS: no DOM, no browser APIs, no I/O
│  │  └─ src/
│  │     ├─ types.ts            # SPEC §7 data model
│  │     ├─ index.ts            # check(context, draft, opts) → CheckResult; VERSION
│  │     ├─ text/               # sentence split, tokenise, normalise, quote/signature/forward strip
│  │     ├─ harvest/            # names (signature, from, to, greeting), numbers, dates
│  │     ├─ guards/
│  │     │  ├─ name.ts          # Damerau-Levenshtein (OSA) + variant table
│  │     │  ├─ variants.ts      # ~120 curated pairs, data only
│  │     │  ├─ number.ts        # kind, normalise, transposition/substitution, counter-offer frame
│  │     │  └─ date.ts          # chrono-node wrapper, weekday mismatch, thread near-miss
│  │     ├─ asks/               # extractor, coordinated split, stop-list, cap 5
│  │     ├─ coverage/           # lexical evidence; model-score adapter interface (no model code here)
│  │     └─ cite.ts             # message + citation strings (single source of copy)
│  ├─ ui/                       # shared React components + tokens.css (DESIGN.md → CSS vars)
│  │  └─ src/{tokens.css, fonts.css, GuardCard, AskPill, Ledger, SwapBack, Keycap, ReadbackLine}
│  └─ fixtures/                 # data shared by unit, corpus and e2e tests
│     ├─ threads/*.json         # labelled corpus: thread, draft(s), expected asks/flags
│     ├─ gmail/*.html           # Gmail-shaped DOM snapshots + *.expected.json
│     └─ pages/*.html           # generic-adapter pages (textarea, contenteditable)
├─ apps/
│  ├─ extension/                # WXT
│  │  ├─ wxt.config.ts          # manifest: permissions, CSP, commands, gecko min version
│  │  ├─ entrypoints/
│  │  │  ├─ gmail.content/      # matches https://mail.google.com/*; css: highlights.css (manifest)
│  │  │  ├─ selection.content/  # registration: 'runtime'; injected through scripting on demand
│  │  │  ├─ background.ts       # context menu, commands, offscreen lifecycle, message router
│  │  │  ├─ offscreen/          # Chrome only: MiniLM host (index.html + main.ts)
│  │  │  ├─ popup/              # 360×480 React
│  │  │  └─ options/            # full tab React
│  │  ├─ src/
│  │  │  ├─ adapters/gmail/{selectors.ts, selfTest.ts, thread.ts, compose.ts}
│  │  │  ├─ adapters/generic/{selection.ts, textareaMirror.ts}
│  │  │  ├─ overlay/{mount.tsx, highlights.ts, hitTest.ts, textIndex.ts, applyFix.ts}
│  │  │  ├─ model/{client.ts, host.ts}   # message protocol; host runs transformers.js
│  │  │  └─ storage.ts          # typed wrappers: settings, ignore, thread state
│  │  └─ public/models/all-MiniLM-L6-v2/  # bundled ONNX (q8) + tokenizer; ORT wasm copied at build
│  └─ site/                     # Vite static site
│     └─ src/{landing/, playground/, demo/timeline.ts, capture/}
├─ e2e/                         # Playwright specs: extension, gmail fixtures, playground, privacy, a11y, capture
└─ docs/adr/
```

**Dependency rule:** `engine` depends only on `chrono-node`. `ui` depends on `engine` types, React and Motion. `apps/*` depend on both. CI fails on a reverse import (Biome `noRestrictedImports`) or on any DOM global inside `packages/engine` (tsconfig `lib: ["ES2023"]`, no `dom`).

## Runtime architecture

```
 Gmail tab (mail.google.com)                                    Extension
 ┌───────────────────────────────────────────────┐   ┌──────────────────────────┐
 │ Gmail DOM (never mutated by us)               │   │ background (SW / event)  │
 │   compose editor [contenteditable]            │   │  · context menu, commands│
 │        ▲ input / selectionchange (passive)    │   │  · settings broadcast    │
 │ ┌──────┴─────────── content script ────────┐  │   │  · offscreen lifecycle   │
 │ │ GmailAdapter → ThreadContext (once/open) │  │   └──────────┬───────────────┘
 │ │ TextIndex: editor text ↔ (node, offset)  │  │              │ runtime messages
 │ │ engine.check(ctx, draft)  ≤16 ms p95     │◄─┼── settings ──┤
 │ │   → flags → CSS.highlights (no DOM edit) │  │              │ embed(texts)
 │ │   → asks  → pill state                   │──┼──────────────►┌───────────────────────┐
 │ │ Shadow root host (one per tab, z max):   │  │              │ offscreen doc (Chrome) │
 │ │   AskPill · GuardCard · SwapBack ghost   │  │              │ / background (Firefox) │
 │ └──────────────────────────────────────────┘  │              │ transformers.js MiniLM │
 │ manifest css: ::highlight(readback-*)         │              │ local files only       │
 └───────────────────────────────────────────────┘              └───────────────────────┘
```

### Content script (Gmail)
1. **Boot** at `document_idle`. Read `Settings` from `chrome.storage.local`. Do nothing if the extension or the site is disabled.
2. **Detect compose** with one `MutationObserver` on `document.body` (subtree, childList only), throttled to animation frames, looking for `div[contenteditable="true"][role="textbox"][g_editable="true"]`. Selectors and fallback chains live only in `adapters/gmail/selectors.ts`.
3. **Self-test** runs once per compose: the thread container, the latest message body, the sender and the editor must all resolve. On failure, record a `layout-unrecognised` status (popup reads it), render nothing and stop.
4. **Build `ThreadContext`** once per compose: latest message not from the user (`[data-message-id]` order, own address from the account chip), with `.gmail_quote`/`blockquote` and `.gmail_signature` separated, sender name/email, sent date from the timestamp's `title`, and To/Cc chips from the compose (`[email]` attributes). Harvest names, numbers and dates through the engine.
5. **On `input`** (and `selectionchange` for caret-aware cards), rebuild the `TextIndex` (TreeWalker over text nodes, block boundaries as `\n`), run `engine.check`, and diff the flags.
6. **Paint flags:** one `Highlight` per guard family (`readback-slip`, plus `readback-slip-active` for the hovered or focused one), registered in `CSS.highlights`. Ranges come from `TextIndex.toRange(span)`. The `::highlight()` rules ship in a manifest-declared content-script stylesheet, so no `<style>` node is added to the page.
7. **Theme:** read the computed background luminance of the editor to choose the light or dark highlight set (`readback-slip` vs `readback-slip-dark`) and the overlay theme. Gmail's theme is independent of `prefers-color-scheme`.
8. **Hover:** a passive `pointermove` on the editor tests pointer coordinates against each flag's `range.getClientRects()` and opens the GuardCard after 300 ms. **Alt+Shift+J** is a manifest command routed back to the tab: it focuses the flag nearest after the caret.
9. **Fix:** select the flag's range, then `document.execCommand('insertText', false, replacement)`. It is deprecated but still the only cross-browser way to write into a host contenteditable that keeps the host's undo stack and model in sync. Wrapped in a capability check, with a fallback of copying the replacement to the clipboard and saying so. Then play the SwapBack ghost over the new range rect.
10. **Cleanup:** a WXT `ctx` invalidation hook removes highlights, the shadow host and listeners when the compose closes, the URL changes or the extension reloads.

### Generic adapter
- `background` creates the context-menu item `Use as Readback context` (contexts: `selection`). On click, `scripting.executeScript` injects `selection.content` into that tab (`activeTab` grants access) and passes the selection text.
- The script builds a `ThreadContext` with `source: 'selection'` (no sender or recipients, so the name guard harvests names from the text's greeting, sign-off and capitalised tokens), then attaches to the next focused `textarea` or `contenteditable`.
- **contenteditable:** same highlight path as Gmail. **textarea:** `textareaMirror.ts` renders a positioned mirror (same font metrics, transparent text, our underline) inside the shadow root, synced on input and scroll.

### Model (optional)
- Off by default. When enabled in options, `model/client.ts` asks the background to ensure a host. On **Chrome** that is an `offscreen` document (reason `WORKERS`) created on demand and closed after 5 min idle. On **Firefox** it is the background event page itself.
- The host imports `@huggingface/transformers` with `env.allowRemoteModels = false`, `env.localModelPath = browser.runtime.getURL('/models/')`, and `env.backends.onnx.wasm.wasmPaths = browser.runtime.getURL('/ort/')`. It runs `pipeline('feature-extraction', 'all-MiniLM-L6-v2', { dtype: 'q8' })` with `pooling: 'mean', normalize: true`.
- Protocol: `{ type: 'embed', texts: string[] } → { vectors: Float32Array[] }`. The engine's coverage module takes a `ScoreFn` and never imports the model.
- **Package size:** the q8 model is about 23 MB and the ORT wasm adds tens of MB. Stage 2 must **measure** it. If the Chrome zip exceeds 60 MB, ship a `lite` flavour (`pnpm build:lite`, no model, lexical coverage only) as the store default and document the full build as a sideload. The model is never downloaded at runtime, because that would break the zero-request policy.

### Permissions and manifest
- `permissions`: `storage`, `contextMenus`, `activeTab`, `scripting`, `offscreen` (Chrome only).
- `host_permissions`: `https://mail.google.com/*`.
- `content_security_policy.extension_pages`: `script-src 'self'; object-src 'self'` (`'wasm-unsafe-eval'` joins it only when the optional MiniLM host ships; QA round 1 removed it because nothing uses WebAssembly yet).
- `commands`: `_execute_action` (Alt+Shift+R), `next-slip` (Alt+Shift+J), `open-ledger` (Alt+Shift+L).
- Firefox: `browser_specific_settings.gecko.id` and `strict_min_version: "140.0"` (Custom Highlight API shipped in Firefox 140).
- `web_accessible_resources`: fonts only, matched to `https://mail.google.com/*`. The model and wasm are not web-accessible because they load only in extension pages.

### Site (landing + playground)
- Vite SPA with two routes (`/`, `/playground`) prerendered to static HTML. No server, no third-party requests, self-hosted fonts.
- The playground imports `packages/engine` and `packages/ui` directly. Its editor is a plain `contenteditable` that goes through the same `TextIndex` and highlight code (shared through `packages/ui`), so screenshots show the real mechanism.
- `demo/timeline.ts` is a pure function `(ms) → { draftText, caret, pointer, openCard, fixProgress }` that drives the playground in `?demo=` mode. `window.__rb.frame(ms)` sets it and resolves after two rAFs. That makes every frame reproducible.

## Options considered

### Decision 1: how to draw squiggles inside Gmail

| Option | Complexity | Host-DOM impact | Robustness | Notes |
|---|---|---|---|---|
| **A. CSS Custom Highlight API** (chosen) | Low | None | High: ranges only | Chrome 105+, Firefox 140+, Safari 17.2+. No events on highlights, so hover needs rect hit-testing |
| B. Wrap tokens in `<span>`s (Grammarly-classic) | Med | Mutates the editor | Low: fights Gmail's model, breaks undo and autosave | Rejected: violates "never change Gmail's DOM" |
| C. Absolutely-positioned overlay underlines | High | None | Med: drift on scroll, zoom and reflow | Kept only as the textarea fallback |

**Why A:** it is the only option that is both non-invasive and cheap to keep aligned, which is the robustness story this product needs. **Open risk:** which properties `::highlight()` honours (wavy `text-decoration`) in Firefox. Stage 2 runs a spike. If wavy isn't honoured, the Firefox fallback is a solid underline plus a `danger-soft` background on the highlight.

### Decision 2: framework for the extension

| Option | Complexity | Pros | Cons |
|---|---|---|---|
| **A. WXT 0.21.4** (chosen) | Low | File-based entrypoints, Chrome + Firefox MV3 from one source, `createShadowRootUi`, content-script ctx invalidation, manifest-declared CSS | Pre-1.0 API churn |
| B. Plasmo | Low | Similar DX | Slower release cadence, heavier abstractions |
| C. Hand-rolled Vite + manifest | High | Full control | Rebuilds what WXT gives for free (HMR, Firefox manifest diffs, zipping) |

### Decision 3: where the model runs (Chrome)

| Option | Pros | Cons |
|---|---|---|
| **A. Offscreen document** (chosen) | Long-lived while in use, a DOM context for wasm and WebGPU, isolated from Gmail's CSP | Chrome only, so Firefox uses its background page |
| B. Service worker | No extra document | Killed after ~30 s idle, which forces model reloads |
| C. Content script | Closest to the data | Page CSP and memory pressure in Gmail's tab, and ships wasm into every Gmail load |

### Decision 4: overlay UI technology

| Option | Pros | Cons |
|---|---|---|
| **A. React 19 in one WXT shadow root** (chosen) | One component library across popup, options, overlay and site, so the playground shows the real components | About 58 KB gz React baseline in the content script |
| B. Vanilla DOM for the overlay, React elsewhere | Smaller content script | Two implementations of GuardCard and AskPill drift apart, and the playground stops being proof |

Budget (`size-limit`): Gmail content script ≤ **150 KB gz** (React ~58 + engine + chrono subset + UI). Popup ≤ 90 KB gz. Site initial ≤ 120 KB gz.

## Trade-off analysis

- **Determinism over recall.** The guards are near-miss only and accept missing some slips (`$1,250` → `$1,260` on an amount stays silent) in exchange for few false positives (measured: about 2 false squiggles per 100 real replies, see README). That is the core defence against Grammarly-style fatigue, and it is gated by "0 false positives on the deliberate set".
- **`execCommand('insertText')`** is deprecated, but it is the only editor-agnostic way to make a fix that the host's undo stack understands. The alternative (synthetic `beforeinput`/`InputEvent` with `insertReplacementText`) isn't honoured consistently by Gmail. If browsers remove `execCommand`, the fallback is copy-to-clipboard plus selecting the range.
- **Bundling the model** respects the zero-request rule but costs package size. It is opt-in at runtime, and stage 2 measures it. A lite flavour is ready if needed.
- **React in the content script** costs about 58 KB gz but buys one source of truth for the components the landing page sells.

## Testing approach and fixture strategy

| Layer | Tool | What | Gate |
|---|---|---|---|
| Engine unit | vitest 5.0.5 | Every AC marked U in SPEC §10; DL distance, variant table symmetry, number kinds, chrono spike (AC-3.5), ask splitting | 100% of ACs; ≥ 90% line coverage on `packages/engine` |
| Corpus | vitest (`pnpm test:corpus`) | `packages/fixtures/threads/*.json`: ≥ 60 labelled messages at MVP (asks, near-miss slips and a **deliberate set** of counter-offers, different people and new dates) | Ask precision ≥ 0.90, guard false positives on the deliberate set = 0, recall reported (not gated) |
| Adapter unit | vitest + happy-dom 21.0.3 | `TextIndex` offset↔(node, offset) round-trips across `<div>`, `<br>`, nested `<span>`, emoji and RTL text; quote, signature and forward stripping on Gmail HTML | Round-trip identity on every fixture |
| Extension e2e | Playwright 1.64.1, Chromium persistent context with `--load-extension=apps/extension/.output/chrome-mv3` | `context.route('https://mail.google.com/**')` fulfils from `packages/fixtures/gmail/*.html`, so the real content script runs on its real match pattern with **no** real network. Typing is scripted through `page.keyboard` | All E ACs; MutationObserver proof (AC-4.1) |
| Privacy | Playwright request listeners on the whole suite | Any request whose URL is not `chrome-extension://`, `moz-extension://`, `data:`, `blob:` or the fixture/localhost origin fails the run | AC-G.2 |
| Playground e2e | Playwright against `vite preview` | Samples, demo timeline, URL state, 0 requests after load | AC-9.x |
| Visual capture | Playwright, DPR 2, `?demo=signature&t=` | Frame strips for the signature moment (light, dark, reduced motion); README GIF and LinkedIn MP4 encoded with ffmpeg | Repeat-run pixel diff = 0 |
| Accessibility | @axe-core/playwright 4.14.0 | Popup, options, playground, landing, overlay shadow root, both themes | 0 violations |
| Tokens | Node script with culori 4.0.2 | Every text/background role pair meets the DESIGN.md contrast table; accent ΔE_OK ≥ 0.06 from the blocklist; no raw palette utilities | Fail CI on regression |
| Firefox smoke | `wxt build -b firefox` plus web-ext lint (manual run in Stage 2) | Builds and lints; manual check of highlights in Firefox ≥ 140 | Recorded in HANDOFF.md |

**Gmail fixtures are honest approximations.** Agents have no Gmail account, so `packages/fixtures/gmail/*.html` are hand-built to mirror Gmail's public DOM conventions (`[data-message-id]`, `.gmail_quote`, `.gmail_signature`, `[email]` chips, `g_editable` editor), with synthetic content. Each has an `expected.json`. A human with an account should later replace them with sanitised real snapshots (script: `pnpm fixtures:sanitize <saved.html>` strips text to synthetic placeholders while keeping structure). Until then, HANDOFF.md lists live-Gmail behaviour as **unverified**.

**Synthetic content rules:** fixture people, companies and amounts are invented, plausible and messy (long names, accents, `O'Brien`, an 80-character company, RTL names, `1.250,00 €`). Every sample shown on the site is labelled `Sample thread`.

## Consequences

- **Easier:** proving the privacy claim (one host permission, zero requests, CI-enforced); recording frame-perfect demos; keeping the engine correct (pure functions plus a corpus); surviving Gmail changes (selectors in one file, silent failure, generic fallback).
- **Harder:** hover affordances need rect hit-testing because highlights get no events; the textarea path needs a mirror; Firefox needs `strict_min_version` 140; model packaging is heavy.
- **Revisit:** package size once measured (lite flavour?); `execCommand` support each Chrome major; whether Edge needs its own QA pass; Outlook web adapter after the Gmail fixtures stabilise; a trademark check of the name "Readback" (not done).

## Action items

1. [ ] Scaffold the workspace with the exact versions above (`pnpm add -E`), `packageManager: "pnpm@10.34.6"`, `engines.node: ">=24"`.
2. [ ] Engine: types, text utils, harvest, the three guards, asks, coverage, cite. Unit tests for every U acceptance criterion. Run the chrono spike (AC-3.5) first.
3. [ ] Corpus: 60 labelled messages including the deliberate set, plus `pnpm test:corpus` with precision gates.
4. [ ] `packages/ui`: tokens.css from DESIGN.md, fonts (Latin subsets), GuardCard, AskPill, Ledger, SwapBack, ReadbackLine, Keycap.
5. [ ] Extension: WXT config and manifest, Gmail adapter with self-test, TextIndex, highlights, hit-test, applyFix, overlay mount, generic adapter, popup, options, storage.
6. [ ] Highlight spike in Chrome and Firefox 140+ (wavy `text-decoration` in `::highlight`). Record the result here.
7. [ ] Model host (offscreen/background), the bundling script, and a **measured** package size. Decide on the lite default.
8. [ ] Site: landing and playground, demo timeline, capture script, README GIF and LinkedIn MP4.
9. [ ] CI scripts: lint (network ban), typecheck, unit, corpus, e2e, privacy, axe, tokens, size-limit.
10. [ ] Update HANDOFF.md with verified versus unverified behaviour.

## Note on LLM usage

Readback uses **no LLM**. The only model is the optional on-device sentence-embedding MiniLM, which is not a generative model and makes no API calls, so the claude-api skill wasn't applicable. If a future ADR adds a BYO-key refinement (for example, an LLM explaining a slip), it must be opt-in, keep the key in `chrome.storage.local`, never log it, default to a current Claude model chosen through that skill, and keep every guard working without it.

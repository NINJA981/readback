# HANDOFF: Readback

**Current stage:** 1 (Architect) is complete. Next: Stage 2 (Build).
**Last updated:** 2026-10-20

## What's done (Stage 1)

There is no code yet. Stage 1 produced the planning documents only:

| File | What it holds |
|---|---|
| `SPEC.md` | Problem, users, daily trigger, **weakness fix** (§4: guards lead, one mechanism per frame, playground as demo and harness, frame-perfect capture), features F1–F11, non-goals, data model, privacy and network policy, platform matrix, testable acceptance criteria (AC-x.y, tagged U/F/E/V), and the 10 s shot-by-shot demo |
| `docs/adr/0001-architecture.md` | Stack pinned with `npm view` (2026-10-20), module layout, runtime architecture (content script → engine → CSS highlights, shadow-root overlay, offscreen MiniLM host), options and trade-offs, testing approach and fixture strategy, action items |
| `DESIGN.md` | Google Stitch format. D5 Bronze Vault (OKLCH, light + dark, contrast-checked) and T8 Hubot/Mona/Geist Mono; scale, spacing, radius, elevation and motion; every surface in every state; the **Swap-back** signature moment frame by frame; the CSS/SVG-only landing plan; three "we never" rules; Appendix B checklist ticked |
| `.impeccable/design.json` | Sidecar: motion and shadow tokens, tonal ramps, 5 component snippets, narrative |
| `docs/LANDING.md` | The 5-beat landing narrative, hero concept ("the readback line"), draft copy, README beats and a LinkedIn draft |
| `PRODUCT.md` | Rewritten. The stale stub from the aborted run claimed a send-time warning, a BYO key and Outlook/Slack support, all of which contradict picks.json |

Scope authority remains `_studio/picks.json` → `readback`. Key decisions:
- **No send interception**, ever.
- **No LLM and no BYO key**, so the extension makes zero network requests.
- MiniLM is optional and **bundled** (never downloaded).
- The landing page uses **no WebGL**: the hero is the real playground plus an SVG line.

## How to run

Nothing to run yet. Stage 2 will add:

```
pnpm install
pnpm dev                 # WXT dev (Chrome)       → apps/extension
pnpm dev:firefox         # WXT dev (Firefox 140+)
pnpm dev:site            # landing + playground   → apps/site
pnpm test                # vitest: engine + corpus gates
pnpm test:e2e            # Playwright: extension on Gmail fixtures, playground, privacy, axe
pnpm build && pnpm zip   # chrome-mv3 + firefox-mv3 packages
pnpm capture             # README GIF / LinkedIn MP4 / poster from ?demo=signature
```

Toolchain: Node 24.18.0, pnpm 10.34.6 (pinned via `packageManager`), Playwright Chromium, ffmpeg.

## Stage 2 starting order (from ADR action items)

1. Scaffold the workspace with exact versions (`pnpm add -E`).
2. **Run the chrono-node spike first (AC-3.5):** does `Thursday the 10th` keep a certain weekday and day?
3. Engine, guards and the asks extractor with unit tests, then the 60-message corpus with precision gates.
4. `packages/ui` tokens and components from DESIGN.md.
5. Extension: Gmail adapter + self-test, TextIndex, highlights, hit-test, fix path, overlay, generic adapter, popup, options.
6. **Highlight spike in Firefox 140+** (wavy `text-decoration` inside `::highlight`).
7. Model host and bundling, then **measure the package size** and decide whether to ship a lite default.
8. Site, playground, demo timeline and captures.

## Known issues and open risks

- **Gmail fixtures will be synthetic.** No Gmail account is available to agents. Live-Gmail behaviour stays **unverified** until a human captures sanitised real snapshots.
- **`::highlight` + wavy underline in Firefox** is unverified (the API shipped in Firefox 140; property support isn't confirmed). The fallback is in the ADR.
- **`execCommand('insertText')`** is deprecated. It is the fix path today, with a copy-to-clipboard fallback.
- **Package size with MiniLM** (q8 ≈ 23 MB plus ORT wasm) is unmeasured. `@huggingface/transformers` 4.3.1 depends on a dev build of onnxruntime-web (`1.31.0-dev.20260914`).
- **TypeScript 7.0.2** is the native-port line. If any tool needs the classic compiler API, fall back to 6.0.3 and amend the ADR.
- **pnpm:** npm's latest is 12.14.0, but the installed 10.34.6 is pinned deliberately.
- **Signature-moment uniqueness across the studio:** Swap-back combines bible M3 + M5 + the readback line. If another studio app also claims M3 or M5, the critic should check the swap test.
- **The `@google/design.md` linter (0.4.0)** exited 0 but printed nothing, not even `--help`, on this Windows/Git Bash setup, so DESIGN.md lint is **inconclusive**. A local check confirmed the frontmatter YAML parses and every `{token.ref}` resolves.
- **Trademark check of "Readback"** has not been done (council risk).
- **Council risks carried forward:** Gemini in Gmail could add a similar check; guard catches are rare, so daily value leans on the ask pill; the Gmail adapter needs maintenance; mobile is out.

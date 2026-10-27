# HANDOFF: Readback site (Stage 3b)

Landing page at `/` and the installable web app at `/app/`, one static Vite build in this folder. It has its own `package.json` and lockfile. Nothing outside `site/` was changed except the new "Web app" section (section 12) of `../SPEC.md`. The root `HANDOFF.md` belongs to the product-UI agent and was not touched; fold this file into it at merge time.

**Last updated:** 2026-10-27

## How to run

```
cd site
pnpm install
pnpm dev                 # Vite dev server (the service worker and CSP are build-only)
pnpm build               # dist/ : index.html, app/index.html, app/sw.js, app/manifest.webmanifest
pnpm preview             # http://localhost:4173 (the e2e suite uses this)
pnpm test                # vitest: sample threads against the real engine
pnpm test:e2e            # Playwright against the preview server (build first)
pnpm typecheck
pnpm assets              # re-render the hero posters and og.png (needs the repo build and ffmpeg)
```

The route is `/app/`. Static hosts redirect `/app` to `/app/`; the dev and preview servers do it with a small middleware (`appSlash` in `vite.config.ts`). `base` is `./`, so the build works from any sub-path.

## What is here

| Part               | Where                                                      | Notes                                                                                                                                                                                                                                                                  |
| ------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landing            | `index.html`, `src/landing/*`                              | Hero with the signature moment (live DOM demo over a server-rendered AVIF poster), how it works, privacy proof with live counters, install, open-source call to action. Plain TypeScript, no framework. The demo, the engine and the mini playgrounds are lazy chunks. |
| Web app            | `app/index.html`, `src/app/*`                              | React 19. Mobile-first at 375 px, scales to 768 and 1440. States: empty (Try a sample), loading, error (Try again), success, too-long thread, reply without thread, offline banner.                                                                                    |
| Engine access      | `src/shared/engine.ts`                                     | The only window onto the core. Re-exports from `@/core/index` (the `@` alias is the repo's `src/`). Nothing is re-implemented.                                                                                                                                         |
| PWA                | `public/app/manifest.webmanifest`, `scripts/pwa-plugin.ts` | The plugin writes `app/sw.js` at build time with a precache list taken from the app page's real module graph, adds the CSP meta, and preloads the display fonts.                                                                                                       |
| Posters, icons, og | `public/`, `scripts/build-assets.mjs`                      | Rendered from the real UI (the page itself) with Playwright, then AVIF. No stock art, no invented screenshots.                                                                                                                                                         |
| Tests              | `tests/samples.test.ts`, `e2e/*.spec.ts`                   | See SPEC section 12 (AC-W.1 to AC-W.12).                                                                                                                                                                                                                               |

## Engine adapter

None is needed. `src/core/index.ts` is free of `chrome.*` and `browser.*`, so the site imports it directly through the alias. `vite.config.ts` has one small plugin (`resolveRepoDeps`) so that bare imports made by files under the repo's `src/` (`chrono-node`) resolve from `site/node_modules`; the site therefore builds with only its own `pnpm install`.

## 3D and tiers

The landing uses no WebGL, by decision (DESIGN.md "Landing 3D plan"). The only "3D" is a shallow CSS `perspective` stack of two cards. `src/shared/tier.ts` picks tier 0 (poster and a Play button, flat cards: reduced motion, Save-Data, <= 2 GB memory, <= 2 cores, no 3D transforms), tier 1 (flat cards, demo plays once: phones and touch) or tier 2 (CSS stack, demo plays once). There is no `<canvas>` to lose, so "no WebGL" needs no separate fallback.

## Privacy enforcement

Both pages carry a CSP meta (production build only) with `connect-src 'none'`, `default-src 'none'`, `base-uri 'none'`, `form-action 'none'`; inline scripts are allowed by hash. A page script cannot make a fetch, XHR, WebSocket or beacon at all. The footer and the landing's privacy section read counters from the browser's own resource timeline. The service worker handles same-origin GET only.

## Measured results (last run, 2026-10-27)

| Check                                                          | Result                                                                                                                                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`                 | clean, 8 unit tests, 17 e2e tests                                                                                                                                        |
| Root `eslint site`                                             | clean (the root config lints `site/`; prettier check is clean too)                                                                                                       |
| Lighthouse `/`, mobile and desktop                             | Accessibility 100, Best practices 100, SEO 92, Agentic 67 (see below)                                                                                                    |
| Lighthouse `/app/`, mobile and desktop                         | Accessibility 100, Best practices 100, SEO 91, Agentic 67 (see below)                                                                                                    |
| Trace `/`, mobile profile (375 px, 4x CPU, Fast 4G, cache off) | LCP 1,684 ms (the h1), CLS 0.00                                                                                                                                          |
| Trace `/app/`, same profile                                    | LCP 714 ms (the h1), CLS 0.00                                                                                                                                            |
| Landing initial JS                                             | about 6 KB gz (page code 2.5 KB plus a 3.5 KB preload helper); the engine (33 KB gz), demo and mini playgrounds are dynamic imports                                      |
| App JS                                                         | 80 KB gz (React and the app), engine 33 KB gz as a separate chunk                                                                                                        |
| Corpus numbers on the landing                                  | "0 of 48" is the deliberate-case set in `tests/corpus`; "4 to 9 ms" are three p95 batches from `tests/unit/engine/performance.test.ts` on a loaded laptop (budget 16 ms) |

**Why SEO and Agentic are below 100:** Lighthouse checks `robots.txt` and `llms.txt` by calling `fetch` from inside the page, and the page's own CSP (`connect-src 'none'`) refuses it. Both files exist, are valid and are served (200). With the CSP meta stripped from a copy of `dist`, the landing scores 100 in all four categories. The strict CSP is kept on purpose because it is the privacy proof; a crawler fetches those files directly and is not affected.

## Fixed in this pass

- The CSP script hash was computed over CRLF text while browsers hash LF, so the inline theme script was blocked on both pages. The plugin now normalises line endings before hashing.
- The service worker missed every module and font on hosts that send `Vary: Origin` (module scripts send an `Origin` header the precache requests did not), so the app did not actually work offline there. Lookups now use `ignoreVary`.
- The "Keep it on your home screen" card arrived late (`beforeinstallprompt`) and pushed the page down (CLS 0.13 on mobile). It is now a floating card, CLS 0.
- The ask pill's touch hit area was clipped by its editor; it sits 2 px higher so the 44 px target is whole.
- A landing figure of "1.3 to 3 ms" did not match the test suite (4.2, 8.5 and 9.0 ms p95 per batch) and was replaced with the measured numbers.

## Not verified, and known issues

- **Real phones.** Everything was checked in desktop Chromium with mobile emulation (375 px, touch). Not run on iOS Safari or Android Chrome. iOS does not fire `beforeinstallprompt`, so there the install card never appears; Add to Home Screen from the share sheet works with the manifest and apple-touch-icon but was not tried. The service worker has not been tested in Safari.
- **Firefox.** The landing and app were not opened in Firefox.
- **Installed PWA offline.** The offline test reloads in a browser tab with the network off. An installed standalone window was not tested.
- **Hosting.** No host is configured. `base: './'` and relative links should work from a sub-path, but this was only served from the preview root. The page has no repository link yet: the install command shows `<repository-url>` and the page says the link goes there once the project is published. There is no star badge and no store link.
- **Screenshots.** `docs/screenshots/` exists, but the page's product visuals are live HTML and CSS reproductions of the real UI built from the engine, not images of the extension, so they cannot drift from the guards. They are labelled `Sample thread`.
- **Hero demo capture.** The landing supports `?demo=signature&t=<ms>` and `window.__rb` for frame-exact capture (that is how the posters were made), but the 10 s video and GIF for the README and the LinkedIn post (SPEC section 11) are not rendered here.
- The two audit failures above are an audit artifact of the strict CSP, not a bug, but anyone reading the Lighthouse report will see them.

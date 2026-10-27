# Readback

Spellcheck that has read the thread you're replying to.

Readback underlines near-miss slips in your reply by checking them against the message you are answering: `Catherine` when she signs `Kathryn`, `$1,520` when the thread says `$1,250`, `Thursday the 10th` when the 10th is a Tuesday. A small pill counts the asks you haven't covered yet. Everything runs on your device, there is no account, no backend and no telemetry, and nothing blocks Send.

**Status: early development (Stage 2 of the build).** The engine, storage, Gmail and generic adapters, and highlight painting work and are tested. The hover card, one-click fix UI, ask pill and the web playground are not built yet. Behaviour on live Gmail is unverified; see [HANDOFF.md](HANDOFF.md).

- Product spec: [SPEC.md](SPEC.md)
- Architecture: [docs/adr/0001-architecture.md](docs/adr/0001-architecture.md), amended by [0002](docs/adr/0002-flat-layout-and-core-entry.md)
- Visual system: [DESIGN.md](DESIGN.md)

## Develop

```
pnpm install
pnpm dev          # Chrome
pnpm build        # .output/chrome-mv3, load it unpacked
pnpm test         # unit, corpus gates, adapters
pnpm test:e2e     # builds, then Playwright with the extension loaded
pnpm lint && pnpm typecheck
```

Node 24 and pnpm 10.34.6. The engine lives in `src/engine` and is pure TypeScript; `src/core/index.ts` is the one entry the extension and the web app share.

## Privacy

The extension makes no network requests. Its only host permission is `https://mail.google.com/*`; other sites are reached only after you choose "Use as Readback context" on a selection. Settings and your ignore list stay in `chrome.storage.local`; per-reply choices are hashed ids in `chrome.storage.session`. Message text is never stored or logged.

## License

MIT

## What this changes

<!-- One or two sentences. Link the issue if there is one. -->

## How it was checked

- [ ] `pnpm lint` and `pnpm typecheck`
- [ ] `pnpm test` (unit and corpus gates)
- [ ] `pnpm test:e2e` if the content script, overlay, popup or options changed
- [ ] `pnpm --dir site test:e2e` if the web app or landing changed
- [ ] New corpus case added for a guard or ask change (see CONTRIBUTING.md)

## Privacy

- [ ] No new network call, permission or storage of mail text
- [ ] Any example text uses invented people, addresses and amounts

# Product

<!-- impeccable:product-schema 1 -->

> Source note: rewritten in Stage 1 (Architect) by an unattended agent, replacing a stale stub from an aborted run that contradicted the studio scope (it mentioned a send-time warning, a BYO Anthropic key and Outlook/Slack support). No interview was possible. Every fact below comes from `_studio/picks.json` (entry `readback`, authoritative), the council transcript `W2-9-1-readback.md` and the Stage 1 weakness fix. Inferred items are marked *(inferred)*.

## Platform

web (browser extension + static site)

## Stack

WXT browser extension (Chrome MV3 first, Firefox 140+ build), a pure-TypeScript engine, React 19 UI, and a static Vite site with the landing page and the paste-thread playground. Pinned versions: `docs/adr/0001-architecture.md`.

## Users

People who reply to email and messages in a browser every day: office workers, freelancers juggling client asks, small-business owners, and parents answering school and landlord threads. They are mid-reply inside Gmail (or any text box, using the selection adapter), often in a hurry, and their job is to send a reply with the right names, amounts and dates that answers what was asked.

## Product Purpose

Readback is spellcheck that has read the thread. It underlines near-miss slips in your reply against the message you're answering (a misspelled name from her signature, two swapped digits in her amount, a weekday that doesn't match the date), cites the line it checked against, and fixes it in one click. A small supporting pill counts the asks in her message that your draft hasn't covered yet. Success means fewer follow-up emails caused by a wrong detail or a missed question, with no account, no setup and nothing leaving the device.

## Positioning

The conversation is the spellcheck dictionary, and only near-misses fire. Grammarly, Gmail and Outlook check the draft on its own. Apple Smart Reply covers question coverage, but only in Apple Mail and by writing the reply for you. ThreadClear is paste-based. Nobody cross-checks your own draft's names, amounts and dates against the thread, live and on-device. So Readback leads with the guards, and the question pill is supporting value.

## Operating Context

- Runs passively in Gmail reply compose boxes. Nothing to open for the core loop.
- Used many times a day. Most replies trigger nothing, and guard catches are rare but valuable (council risk: daily visible value depends on the pill).
- The host app owns the page. Readback never changes Gmail's DOM (squiggles use the CSS Custom Highlight API), **never intercepts or delays Send**, and fails silently (a missing pill, never a lost email).
- Gmail can be light, dark or themed, independent of the OS theme *(inferred)*.

## Capabilities and Constraints

- Deterministic guards and ask extraction. The optional on-device MiniLM (bundled, never downloaded) only refines the dotted "looks answered" state.
- No hosted backend, no telemetry, no account, no LLM, no BYO key. The extension makes zero network requests, enforced in CI.
- Settings and ignore lists go in `chrome.storage.local`. Per-thread state goes in `chrome.storage.session` under hashed keys. Mail text stays in memory only and is never logged.
- Only one host permission (`mail.google.com`). Other sites only through `activeTab` after the user picks "Use as Readback context".
- Out of scope: mobile, Outlook web and WhatsApp Web (stretch), send interception, AI writing.
- Undecided: store listing names; trademark check of "Readback" (not done, council risk).

## Brand Commitments

- Name: Readback, from the aviation practice of reading an instruction back to confirm it.
- Visual direction assigned by the studio: D5 Bronze Vault colours, T8 type pairing (Hubot Sans + Mona Sans + Geist Mono). See `DESIGN.md`.
- Voice: plain, specific, calm. Never cute, never alarmist. Every slip message cites the thread ("She signs Kathryn"). Errors name the problem and the next step.

## Evidence on Hand

- No users, testimonials, install counts, benchmarks or press exist. None may be invented.
- The demo thread (Sam replying to Kathryn Moss about a $1,250 deposit, keys on Thursday 12 November 2026) is synthetic and is labelled `Sample thread` wherever it appears.
- Evidence to produce during the build: corpus precision and false-positive numbers from CI, check-latency p95, the "0 network requests" capture, measured package size and real captures of the extension.

## Product Principles

1. Never cost the user a send. No interception, no blocking, no text change without a click.
2. Deterministic first. Every squiggle and chip is explainable by a rule; the model only refines.
3. Near-miss only. Flag slips, never deliberate changes (a counter-offer, a different person, a new date).
4. Cite the thread. A squiggle without its evidence is noise.
5. Local, verifiably. Zero requests, and the user can check it in DevTools.

## Accessibility & Inclusion

WCAG 2.2 AA on every surface we draw (popup, overlay, options, playground, landing) in both themes, a full keyboard path for every slip and ask (Alt+Shift+J, Alt+Shift+L, Enter, Esc), `prefers-reduced-motion` honoured, and no information carried by colour alone (squiggles have a citation card and a list in the ledger).

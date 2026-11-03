# Thread corpus: provenance and limits

Everything in this folder is **synthetic**. People, companies, addresses, order
numbers and amounts are invented. Nothing was copied from a real mailbox.

| File          | What it is                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `asks.json`   | 64 labelled incoming messages. `asks` lists the asks a human reader would say the sender is making. `[]` means the message asks for nothing. Covers single and coordinated asks, bullet lists, boilerplate (`Let me know if you have any questions`), quoted history, signatures, forwards, newsletters, receipts, recruiter, school, contractor and support mail, a chat-style one-liner and one non-English message.                                               |
| `guards.json` | `threads` (26 synthetic incoming messages with sender and recipients) and `cases` (32 `slip` cases the guards should flag and 53 `deliberate` cases they must stay silent on: counter-offers, different people, a genuinely new date, kind and currency mismatches, correct weekdays, user-ignored words, sentence-initial look-alikes, neighbouring room and flight numbers). Each flag label names the guard and the draft token, and optionally the thread value. |

## How the labels were written

By hand, from SPEC §5 and §10, not from engine output. When a run disagreed with
a label, the label was re-read against the spec first:

- `a61` (German question) was first labelled "no ask", which contradicted the
  spec's language-neutral `?` rule, so the **label** was corrected.
- `a22` (a newsletter footer question) is not a request to the reader, so the
  **engine** got two boilerplate patterns (`src/engine/asks/boilerplate.ts`).

## Gates (tests/corpus/corpus.test.ts)

- Ask precision >= 0.90 (gated), ask recall floor 0.80.
- Guard false positives on the deliberate set = 0 (gated).
- Guard recall on the slip set is reported, with a floor of 0.90.

## Limits, stated plainly

- The corpus was written by the same author as the engine, in one sitting. The
  precision it reports is an **optimistic** estimate, not a measurement on real
  mail. 64 messages is a regression net, not a benchmark.
- English-centric. Non-English text is only covered by language-neutral rules.
- The live-Gmail behaviour is not covered here. See `tests/fixtures/gmail/README.md`.
- Replace or extend this corpus with sanitised real threads when a human can
  supply them; the gates will then say something about real mail.

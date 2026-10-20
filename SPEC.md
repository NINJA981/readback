# Readback: product spec

> Stage 1 (Architect). Scope authority: `_studio/picks.json` entry `readback` (refined_scope, signature_moment, risks). The weakness fix from the stage brief adds emphasis and never overrides picks.json. Architecture and pinned versions: [`docs/adr/0001-architecture.md`](docs/adr/0001-architecture.md). Visual system: [`DESIGN.md`](DESIGN.md). Landing narrative: [`docs/LANDING.md`](docs/LANDING.md).

**One line:** spellcheck that has read the thread you're replying to.

Readback underlines near-miss slips in your reply by checking them against the message you are answering: `Catherine` when she signs `Kathryn`, `$1,520` when the thread says `$1,250`, `Thursday the 10th` when the 10th is a Tuesday. Each squiggle cites the thread and fixes in one click. A small pill counts the asks you haven't covered yet. Everything runs on the device, and nothing blocks Send.

---

## 1. Problem

The costliest reply mistakes aren't grammar. They're mismatches with the conversation:

- You misspell the name in her own signature.
- You swap two digits in the amount she quoted.
- You confirm a weekday that doesn't match the date.
- You answer two of her four questions.

Grammarly, Gmail and Outlook check the draft on its own. None of them compares it with the thread, so these errors get past every checker and turn into a follow-up email, a wrong deposit or a missed handover.

## 2. Users

People who reply to email and messages in a browser every day: office workers, freelancers juggling client asks, small-business owners, and parents answering school and landlord threads. There's no account and no setup, and it works in Gmail on the web from the first reply.

Out of scope: mobile mail apps and desktop mail clients. The council risk list flags mobile as out.

## 3. Daily trigger

The trigger is opening a reply. Readback runs passively in every Gmail reply compose box, so there's nothing to open and no habit to build.

- **Guards (the lead).** They stay silent until they catch a near-miss. Most replies show nothing. When they fire, the catch is worth a lot.
- **Ask pill (supporting).** It appears only when the incoming message contains asks, which happens several times a day for most office workers. It is the daily-visible value that covers the gaps between guard catches.
- **Generic adapter.** On any other site, select the message you're answering, right-click and choose **Use as Readback context**. Readback then checks whatever text box you type into next.

## 4. Weakness fix (council lowest scores: demo 6, novelty 7)

The council scored novelty 7 because Apple Smart Reply and ThreadClear already cover "did you answer every question". It scored the demo 6 because four mechanisms in one compose box read as busy and close to Grammarly. This spec answers both points:

| Council finding | What this spec does | Where |
|---|---|---|
| Question coverage is not novel (Apple Smart Reply, ThreadClear) | **The product leads with the three near-miss guards.** Store copy, landing hero, README, onboarding and the popup all open with the guards. The ask checklist is folded into one supporting pill that stays collapsed by default. | §5 F1–F3 lead, F6 supporting; LANDING.md beat 1 |
| Novelty is "twist-on-existing" | The mechanism is new: **the thread is the dictionary**. Every rule compares draft tokens with tokens harvested from the thread (signature, To chips, quoted amounts, IDs and dates), and only near-misses fire. We found no tool that does this (audit, W2-9-1). | §5 F1–F3, §8 rules |
| Demo is busy (4 mechanisms in one frame) | **One mechanism per frame.** The hero frame is a single squiggle-to-fix moment: squiggle, citation, one click, then the letters swap back. Send interception is dropped completely (picks.json: no send interception), so there is no fourth mechanism. The ask pill is one small object, not a row of chips. | §9 demo script; DESIGN.md signature moment |
| Demo looks like Grammarly in a still frame | The still frame carries a visible **readback line**: a brass hairline from the squiggled word to the exact thread token it was checked against. No grammar checker draws that. The squiggle is paired with a citation (`She signs Kathryn`), never a generic "spelling" label. | DESIGN.md signature moment; LANDING.md hero |
| Viewers can't try it without installing | The **paste-thread playground** runs the same engine in the page. It is the landing demo, the README GIF source (deterministic frame capture) and the agents' test harness. | F9 |
| The squiggle-to-fix moment must be screenshot-able | The playground has a deterministic demo timeline (`?demo=signature&t=<ms>`). Any frame can be rendered exactly and captured by Playwright, so the README GIF, the LinkedIn MP4 and the landing poster are frame-perfect rather than screen recordings. | F9, ADR §Testing |
| Guards mustn't need a model | All three guards and the ask extractor are deterministic TypeScript. MiniLM only refines the optional dotted "looks answered" state. | F7 |

## 5. MVP features

Priority order matches the pitch order. F1–F5 are the product's lead. F6–F7 support it. F8–F11 are platform and trust.

### F1. Name guard
Underlines a name in the draft that is a near-miss of a name the thread gives you.

- **Sources (harvested names):** the sender's display name, the sender's signature block, the To and Cc chips of the reply, and the greeting of the incoming message.
- **Match rule:** a capitalised draft token (length ≥ 3, not in the common-word stop-list) is flagged when it is not itself a harvested name and either:
  - its Damerau-Levenshtein distance to a harvested name is 1 (names ≤ 5 letters) or ≤ 2 (names ≥ 6 letters), with a matching first letter or a known phonetic pair; or
  - the variant table pairs it with a harvested name (Catherine/Kathryn/Katherine/Kathrine, Steven/Stephen, Jon/John, Sara/Sarah, Ann/Anne, Philip/Phillip, Geoff/Jeff, Megan/Meghan, Shaun/Sean/Shawn, Aimee/Amy, Jaime/Jamie, about 120 pairs, see ADR).
- **Never fires** when the draft names someone who isn't a near-miss (`Kathryn` vs `Bob`), when both spellings appear in the thread, or on a name the user has ignored.
- **Tooltip:** `She signs Kathryn`, `To: Kathryn Moss`, or `Thread says Kathryn` (wording depends on source), with the cited line shown underneath.
- **Fix:** replaces the token with the thread spelling.

### F2. Number guard
Underlines a number that is a transposition or near-miss of an amount, ID or reference quoted in the thread.

- **Thread numbers:** currency amounts (`$1,250`, `1.250,00 €`, `£980`), plain amounts with a unit (`1250 USD`, `14 nights`), and IDs (order, invoice, booking, tracking, account or phone-style tokens of 4+ digits, alphanumeric IDs such as `INV-20931`).
- **Match rule** (on the normalised digit string, same length, same kind):
  - **Amounts:** flagged only for a single transposition of two digits (`1250` vs `1520`, adjacent or one apart). A single-digit substitution never fires on amounts, because a different amount is usually a counter-offer (`$1,250` vs `$1,200` or `$1,350` stays silent).
  - **IDs:** flagged for a single transposition **or** a single-digit substitution (`48213` vs `48231`, `48213` vs `48218`), because nobody counter-offers an order number.
- **Never fires** when the draft number appears verbatim anywhere in the thread, when units or currencies differ, or when the number sits in a counter-offer frame ("instead of", "how about", "could we do", "we can offer").
- **Tooltip:** `Thread says $1,250. Digits swapped?` / `Order #48213 in the thread. One digit differs.`
- **Fix:** replaces the number with the thread's value, keeping the draft's formatting style (currency symbol and separators).

### F3. Date guard
Underlines a date whose weekday doesn't match its day number, or that is a near-miss of a date proposed in the thread.

- **Parser:** chrono-node (English) with the incoming message's sent date as the reference date (falling back to today).
- **Rules:**
  - **Weekday mismatch:** the draft gives both a weekday and a day number (`Thursday the 10th`, `Thu 10 Nov`), and the calendar disagrees. Message: `The 10th is a Tuesday.`
  - **Thread near-miss:** the thread proposes a date (`Thursday the 12th`) and the draft gives the same weekday with a different day, or the same day with a different weekday, within ±7 days. Message: `Thread says Thursday the 12th.`
- **Never fires** on a date that matches neither of those (a genuinely different proposal such as `Monday the 23rd` stays silent), or on relative dates without a day number (`next Friday`).
- **Fixes:** two buttons when both make sense: `Thursday the 12th` (thread date) and `Tuesday the 10th` (keep the number, fix the weekday).

### F4. Squiggles that never touch the host DOM
- Every flag is drawn with the **CSS Custom Highlight API** (`CSS.highlights` plus `::highlight()` rules from the manifest-declared content-script stylesheet). Gmail's editor DOM is never wrapped, annotated or re-rendered.
- In a `<textarea>` (generic adapter), where highlights can't reach, a mirror layer inside Readback's own shadow root draws the underline over the text.
- Hit-testing for hover uses `Range.getClientRects()`, so no listeners are attached to host elements beyond one passive `pointermove` and `input` on the active editor.

### F5. Citation tooltip and one-click fix
- Hovering a squiggle for 300 ms, or pressing **Alt+Shift+J** (next slip), opens the guard card: the rule in one line, the cited thread snippet with the matched token highlighted, a primary fix button, **Ignore** (this thread), and **Never flag "Catherine"** (global).
- **Fix** replaces exactly that range through the editor's own input path (`execCommand('insertText')` on a selection of the range), so Gmail's model, autosave and **Ctrl+Z** undo all see a normal edit. This is the only way Readback changes text, and it only happens on a click or Enter.
- After a fix, the corrected word plays the **swap-back** morph (DESIGN.md signature moment) and the pill shows `Fixed: Kathryn · Undo Ctrl+Z` for 6 s.

### F6. Ask pill (supporting)
- **Extractor (conservative):** reads only the latest incoming message, with quoted history (`.gmail_quote`, `On … wrote:`), signature (`.gmail_signature`, `-- ` delimiter, sign-off heuristics) and forwarded content stripped. Forwards are skipped entirely.
- **An ask is:** a sentence ending in `?`, or a direct second-person request (`can you`, `could you`, `would you`, `will you`, `please <verb>`, `let me know whether|if|when|which`).
- **Coordinated asks split:** `can you confirm the $1,250 deposit, drop off the keys on Thursday the 12th, and send the signed lease back?` becomes 3 asks when every segment starts with a verb from the request-verb list.
- **Stop-list** for boilerplate: `let me know if you have any questions`, `any questions?`, `thoughts?`, `how are you?`, `hope you're well`, `does that make sense?` and about 40 more.
- **Cap:** at most 5 asks. Extras are dropped by position, and the ledger says `+2 more not shown`. Every ask can be dismissed.
- **UI:** one pill docked to the compose box (`3 asks · 1 open`, brass while any ask is open, success green with a check when all are covered). Clicking the pill or pressing **Alt+Shift+L** opens the ledger: up to 5 rows, each with its state and a dismiss button. The pill **never** blocks or delays Send. If the adapter breaks, the pill is simply missing.

### F7. Coverage states (free typing is the default)
- **Open:** no evidence in the draft.
- **Looks answered (dotted ring):** deterministic lexical evidence (the ask's key terms such as amounts, names, dates and nouns, at ≥ 50% overlap, or a yes/no answer cue next to a key term), or, when the optional on-device MiniLM is enabled, cosine similarity ≥ 0.62 between the ask and a draft sentence. The threshold is calibrated on the fixture corpus.
- **Answered (solid check):** the user confirms with a click or Enter on the row, or an **Answer inline** slot is filled. Answer inline is an optional power move from the ledger row menu: it inserts `> ask` plus an empty line at the caret through the editor's input path.
- The pill counts dotted and solid both as covered. The ledger shows the difference.

### F8. Adapters
- **Gmail (first):** detects reply and forward compose boxes, both inline and pop-out. It builds the thread context from the open conversation: the latest message not sent by the user, sender name, signature block, sent date, To and Cc chips. All selectors live in one module with fallback chains and a self-test. When the self-test fails, the adapter goes silent and the popup says `Gmail's layout wasn't recognised. Select the message and use "Use as Readback context".`
- **Generic "use selection as context":** a context-menu item (`Use as Readback context`) on selected text in any page, injected on demand through `activeTab` + `scripting`, so there is no broad host permission. The next focused `textarea` or `contenteditable` on that tab is checked against the selection until the tab navigates or the user clears it. A small chip by the field says `Context: 84 words from this page · Clear`.
- **Playground adapter:** the paste-thread page (F9) feeds the same engine.

### F9. Paste-thread playground (landing demo + test harness)
- A static page on the site (`/playground`, also embedded as the landing hero). Paste or type a thread on the left and a reply on the right, and the same engine runs live, with squiggles, citations, fixes, the ask pill and the readback line.
- **Samples:** 6 synthetic threads, each labelled `Sample thread`: landlord deposit (the hero), client invoice, school trip, order support, recruiter scheduling and contractor quote. Each one exercises a different guard plus one "never fires" case.
- **Deterministic demo timeline:** `?demo=signature` plays the signature moment. `&t=<ms>` freezes any frame, and `window.__rb.frame(ms)` steps frames for capture. Typing is scripted at a fixed cadence, and no `Date.now()` or randomness is used.
- **State in the URL:** sample id and guard toggles go in the query string. Pasted text stays in the page and in `sessionStorage` only, and is never put in a URL unless the user clicks **Copy share link**, which compresses it into the hash fragment. The fragment is never sent to a server.
- **Test harness:** Playwright drives the playground for engine-in-DOM tests and frame captures.

### F10. Popup and options
- **Popup (360 × 480):** status for this tab (`Reading this reply: 3 asks, 1 slip` / `Not a reply page` / `Layout not recognised`), an on/off switch for this site, guard toggles, the privacy line `0 network requests. Check in DevTools →`, and links to Options and the Playground. Opens with **Alt+Shift+R**.
- **Options (full tab, max-width 720):** guards and thresholds, ignored names and numbers (with removal), the optional on-device model (enable, its size, status and a remove action), the data panel (`What Readback stores` with **Clear all**), and keyboard shortcuts.

### F11. Privacy panel
- Shows exactly what is stored and where (§7), the network policy, and how to verify it: open DevTools → Network on Gmail and type a reply; Readback adds 0 requests.

## 6. Non-goals

- **No send interception**, no send-time card and no delay of Send in any form (picks.json: "There is no send interception").
- No AI writing, rewriting, tone or grammar checking. Readback never generates text.
- No hosted backend, account, sync, telemetry, analytics or crash reporting.
- No LLM and no BYO-key calls in the MVP. The only model is the optional bundled MiniLM.
- No Outlook web or WhatsApp Web adapters in the MVP (stretch, after Gmail fixtures are stable).
- No mobile.
- No reading of mail the user hasn't opened: only the thread in the active compose view is read.
- No permanent storage of message bodies.
- No length-mirror chip (cut from the refined scope to keep the compose box quiet).

## 7. Data model

All types live in `packages/engine/src/types.ts`. They are pure data with no DOM references.

```ts
type Source = 'gmail' | 'selection' | 'playground';

interface ThreadContext {
  source: Source;
  threadKey: string;            // SHA-256(source + thread id or selection text); never the raw id
  sentAt?: string;              // ISO date of the latest incoming message (date guard reference)
  latestMessage: string;        // quotes, signature and forwards stripped
  signatureBlock?: string;
  sender?: Person;              // display name + email local part only
  recipients: Person[];         // To/Cc chips of the reply
  harvested: Harvest;           // computed once per context
}
interface Person { name: string; emailLocal?: string; role: 'sender' | 'to' | 'cc' }
interface Harvest {
  names: TokenRef[];            // with source: 'signature' | 'from' | 'to' | 'greeting' | 'body'
  numbers: NumberRef[];         // kind: 'amount' | 'id', digits, currency/unit, display text
  dates: DateRef[];             // chrono components incl. certain weekday/day/month
}
interface TokenRef { text: string; source: string; span: Span; line: string }   // line = cited snippet
interface Span { start: number; end: number }                                   // UTF-16 offsets

interface Draft { text: string; version: number }  // flattened editor text (adapter maps offsets to DOM)

interface Ask {
  id: string;                   // hash(threadKey + normalised ask text)
  text: string; span: Span;     // in latestMessage
  keyTerms: string[];
  state: 'open' | 'looks-answered' | 'answered' | 'dismissed';
  evidence?: { kind: 'lexical' | 'model' | 'inline-slot' | 'user'; draftSpan?: Span; score?: number };
}

interface Flag {
  id: string;                   // hash(threadKey + guard + draft token + cited token)
  guard: 'name' | 'number' | 'date';
  draftSpan: Span; found: string;
  expected: string;             // thread value
  rule: 'variant' | 'edit-distance' | 'transposition' | 'substitution' | 'weekday-mismatch' | 'thread-near-miss';
  message: string;              // "She signs Kathryn"
  citation: TokenRef;
  fixes: { label: string; replacement: string }[];   // 1–2
}

interface CheckResult { asks: Ask[]; flags: Flag[]; truncatedAsks: number; ms: number }

interface Settings {                              // chrome.storage.local, key "settings"
  enabled: boolean; disabledSites: string[];      // origins
  guards: { name: boolean; number: boolean; date: boolean; asks: boolean };
  model: { enabled: boolean; threshold: number };
  theme: 'system' | 'light' | 'dark';
}
interface IgnoreList {                            // chrome.storage.local, key "ignore"
  names: string[]; numbers: string[];             // global "never flag X" (the user's own words only)
}
interface ThreadState {                           // chrome.storage.session, key "t:<threadKey>"
  dismissedAsks: string[]; confirmedAsks: string[]; ignoredFlags: string[]; updatedAt: number;
}
```

## 8. Privacy model

| Data | Where | Lifetime | Notes |
|---|---|---|---|
| Thread text, draft text | Memory of the content script only | Until the compose box closes or the tab navigates | Never written to storage, never logged, never sent anywhere |
| Selection context (generic adapter) | Memory of the content script on that tab | Until navigation or **Clear** | Same rules |
| `Settings`, `IgnoreList` | `chrome.storage.local` | Until the user clears it | `IgnoreList` holds only words the user chose to ignore |
| `ThreadState` (dismissed, confirmed, ignored ids) | `chrome.storage.session` | Browser session | Keys are SHA-256 hashes, values are hashed ids, no message text |
| MiniLM model files | Inside the extension package | Install lifetime | Loaded from the extension origin only; `env.allowRemoteModels = false` |
| Playground text | Page memory + `sessionStorage` | Tab session | Hash-fragment share link only on explicit click |

**Network policy: zero requests.**
- The extension makes **no network requests at all**: no backend, telemetry, remote fonts, model download or update check beyond the browser's own store updates.
- The only host permission is `https://mail.google.com/*`. Other sites are reached only through `activeTab` after a user gesture (context-menu click).
- Extension CSP: `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`, with no remote origins.
- The site (landing + playground) is static. It loads no third-party scripts, fonts or analytics, and the playground makes no requests after page load.
- **Enforced in CI:** an e2e test records every request from the extension and the playground while running the fixture suite and fails on any non-`chrome-extension://` / non-`localhost` request. A lint rule bans `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` and `EventSource` outside an empty allow-list.
- **Logging:** a `log()` wrapper is compiled out in production. It accepts only enum codes and counts, never strings derived from mail.

## 9. Platform matrix

| Target | Status | Minimum | Notes |
|---|---|---|---|
| Chrome (MV3) | **Primary** | Chrome 121+ | CSS Custom Highlight API (105+); `offscreen` document for MiniLM; keyboard commands |
| Edge (MV3) | Same package as Chrome | Edge 121+ | Unverified until tested; listed as "should work" |
| Firefox (MV3) | Secondary build (`wxt build -b firefox`) | Firefox 140+ | Custom Highlight API shipped in 140; `browser_specific_settings.gecko.strict_min_version = "140.0"`; MiniLM runs in the background event page; no `offscreen` |
| Safari | Not in MVP | n/a | |
| Gmail web (mail.google.com) | Adapter 1 | Current Gmail UI | Reply and forward compose, inline and pop-out; light, dark and themed Gmail |
| Any page: textarea / contenteditable | Generic adapter | Same as browser | Via **Use as Readback context** |
| Site: landing + playground | Static (Vite) | Last 2 versions of evergreen browsers | Works without the extension |

## 10. Acceptance criteria (testable)

IDs are referenced by tests. **U** = vitest unit, **F** = fixture corpus, **E** = Playwright e2e (Chromium with the extension loaded and Gmail fixtures served through route interception), **V** = visual capture.

**F1 Name guard**
- AC-1.1 (U) Thread signed `Kathryn`, draft `Hi Catherine,` → 1 flag, rule `variant`, message `She signs Kathryn`, fix `Kathryn`.
- AC-1.2 (U) To chip `Jon Reyes`, draft `Thanks John` → 1 flag, rule `edit-distance`.
- AC-1.3 (U) Thread names `Kathryn`, draft mentions `Bob` → 0 flags.
- AC-1.4 (U) Thread contains both `Catherine` and `Kathryn` → `Catherine` in the draft is not flagged.
- AC-1.5 (U) A global ignore of `Catherine` → 0 flags in any thread.
- AC-1.6 (F) Name-guard false positives on the "deliberate" fixture set = 0.

**F2 Number guard**
- AC-2.1 (U) Thread `$1,250`, draft `$1,520` → 1 flag `transposition`, message `Thread says $1,250. Digits swapped?`, fix `$1,250`.
- AC-2.2 (U) Thread `$1,250`, draft `$1,100`, `$1,200` or `$1,350` → 0 flags.
- AC-2.3 (U) Thread `order #48213`, draft `#48231` and, separately, `#48218` → 1 flag each (`transposition`, `substitution`).
- AC-2.4 (U) Thread `$1,250`, draft `could we do $1,520 instead?` → 0 flags (counter-offer frame).
- AC-2.5 (U) Thread `1.250,00 €`, draft `1.520,00 €` → 1 flag. Thread `$1,250`, draft `1,520 nights` → 0 flags (kind mismatch).
- AC-2.6 (F) Number-guard false positives on the deliberate set = 0.

**F3 Date guard**
- AC-3.1 (U) Reference date Mon 2 Nov 2026, draft `Thursday the 10th` → flag `weekday-mismatch`, message `The 10th is a Tuesday.`
- AC-3.2 (U) Thread proposes `Thursday the 12th`, draft `Thursday the 10th` → message `Thread says Thursday the 12th.`, fixes `Thursday the 12th` and `Tuesday the 10th`.
- AC-3.3 (U) Thread proposes `Thursday the 12th`, draft `Monday the 23rd` → 0 flags.
- AC-3.4 (U) Draft `next Friday` → 0 flags.
- AC-3.5 (U) A spike test proves chrono-node 2.10.3 reports a certain weekday and day for `Thursday the 10th` without silently adjusting the day. If it adjusts, the guard reads the raw weekday token next to the parsed span (documented in the ADR).

**F4 Highlights**
- AC-4.1 (E) After a flag on the Gmail fixture, a `MutationObserver` on the compose editor records **0 mutations** caused by Readback (only the scripted typing).
- AC-4.2 (E) `CSS.highlights.has('readback-slip')` is true, and the highlight's range text equals the flagged token.
- AC-4.3 (E) Generic adapter on a `<textarea>` fixture: the mirror underline's bounding box overlaps the token's measured box within 2 px.

**F5 Tooltip + fix**
- AC-5.1 (E) Hovering the squiggle for 300 ms shows the card with the message and the cited line. Alt+Shift+J opens it from the keyboard and focuses the primary fix.
- AC-5.2 (E) Clicking the fix changes the editor text to `Kathryn`. Then **Ctrl+Z** restores `Catherine`. The flag disappears after the fix and returns after the undo.
- AC-5.3 (E) The card is reachable and operable by keyboard only (Tab, Enter, Esc), and focus returns to the editor caret on close.
- AC-5.4 (V) Swap-back frames match the DESIGN.md timeline within ±1 frame at 60 fps in the playground capture.

**F6 Ask pill**
- AC-6.1 (U) The hero sample yields exactly 3 asks from one coordinated sentence.
- AC-6.2 (U) `Let me know if you have any questions!` yields 0 asks. Quoted history and signature yield 0 asks. A forwarded message yields 0 asks.
- AC-6.3 (U) A message with 8 asks yields 5, with `truncatedAsks = 3`.
- AC-6.4 (F) Ask precision ≥ 0.90 on the labelled corpus (≥ 60 messages at MVP), reported by `pnpm test:corpus` and gated in CI.
- AC-6.5 (E) The pill text and colour flip from `1 open` (brass) to `All covered` (success) when the draft covers the last ask. No layout shift (CLS 0 on the pill's bounding box).
- AC-6.6 (E) Dismissing an ask updates the count immediately (0 ms) and persists for that thread in `chrome.storage.session`.

**F7 Coverage**
- AC-7.1 (U) With the model off, the lexical evidence rule marks `confirm the $1,250 deposit` as looks-answered for the draft `The $1,250 deposit is confirmed.`
- AC-7.2 (U) Confirming a looks-answered ask sets the state to `answered`. Answer inline inserts `> ask` and counts as answered once the next line has text.
- AC-7.3 (E) With the model enabled, the first inference finishes in under 1.5 s on the CI runner, later ones in under 150 ms, and 0 network requests are made.

**F8 Adapters**
- AC-8.1 (E) On each Gmail fixture (inline reply, pop-out reply, forward, light theme, dark theme, a thread with quoted history, a thread with a long signature), the adapter extracts sender, signature and recipients exactly as the fixture's expected JSON says.
- AC-8.2 (E) On a Gmail fixture with renamed classes, the self-test fails and the adapter renders nothing. No error reaches the page console.
- AC-8.3 (E) Generic adapter: select text on a fixture page, use the context-menu command, then type in a textarea on that page and see a flag. Navigating clears the context.

**F9 Playground**
- AC-9.1 (E) `/playground?sample=deposit` renders 3 asks and, after the scripted draft, 2 flags, using the same engine build as the extension (asserted through the engine version string).
- AC-9.2 (V) `?demo=signature&t=<ms>` renders the same pixels on repeated runs (screenshot diff = 0 at DPR 2).
- AC-9.3 (E) The playground issues 0 network requests after `load`.
- AC-9.4 (E) Pasted text never appears in `location.href` unless **Copy share link** is clicked.

**F10 Popup / options**
- AC-10.1 (E) The popup's first paint is ≤ 100 ms (performance mark) and it is usable at 360 × 480 without vertical scroll.
- AC-10.2 (E) Turning a guard off in the popup removes its squiggles in the open compose within 100 ms.
- AC-10.3 (E) Options → **Clear all** empties `chrome.storage.local` and `session` of Readback keys.

**Global**
- AC-G.1 (U) Engine check time for a 2,000-word thread plus a 500-word draft is p95 ≤ 16 ms on the CI runner (excluding the model).
- AC-G.2 (E) 0 non-local network requests across the whole e2e suite.
- AC-G.3 (E) axe-core reports 0 violations on the popup, options, playground and landing in both themes.
- AC-G.4 (E) The content script's injected UI lives in one shadow root, and the page's computed styles are unchanged (snapshot of `document.styleSheets.length` and the editor's computed font).

## 11. Demo script (10 s, shot by shot)

Recorded from the playground's deterministic timeline (`?demo=signature`), captured frame by frame at 1080 × 1080 for LinkedIn and 1200 × 750 for the README. The sample thread is synthetic and labelled `Sample thread` in a corner of every frame. All times are from frame 0.

| # | Time | Shot | On screen | Caption (burned in at most once, bottom-left, mono 13 px) |
|---|---|---|---|---|
| 1 | 0.0–1.4 s | Static wide | Left: Kathryn Moss's message, ending `…can you confirm the $1,250 deposit, drop off the keys on Thursday the 12th, and send the signed lease back? Thanks, Kathryn`. Right: an empty reply with the caret blinking. The ask pill reads `3 asks · 3 open` in brass. | none |
| 2 | 1.4–3.0 s | Typing | `Hi Catherine,` is typed at 14 chars/s. As the comma lands, a red squiggle appears under `Catherine` at 0 ms (no animation). | none |
| 3 | 3.0–4.2 s | Card | The pointer rests on the squiggle. At 3.3 s the guard card opens (160 ms, origin at the word): `She signs Kathryn`, with the signature line `Thanks, Kathryn` cited and `Kathryn` underlined in brass. The **readback line** (1 px brass hairline) draws from the squiggle to `Kathryn` in the thread over 240 ms. | `Checked against her signature.` |
| 4 | 4.2–5.0 s | Fix | Click **Change to Kathryn**. Swap-back: `Catherine` morphs into `Kathryn`. The shared letters (`a`, `t`, `h`, `r`, `n`) slide into place, `C`, `e`, `i` and the final `e` blur out, and `K` and `y` blur in (280 ms). The squiggle is gone. | none |
| 5 | 5.0–6.6 s | Typing | `The $1,520 deposit is confirmed` is typed. A squiggle lands under `$1,520`. The pill rolls to `2 open` because the deposit ask now looks answered (dotted). | none |
| 6 | 6.6–7.6 s | Card + fix | Card: `Thread says $1,250. Digits swapped?` Click the fix. Swap-back digit roll: the `5` and `2` trade places vertically (M5-style roll, 240 ms). | `$1,520 → $1,250, from her own email.` |
| 7 | 7.6–9.2 s | Typing | `, and I'll drop the keys off Thursday the 12th and send the lease tonight.` is typed. The pill rolls `1 open` → `0 open`, then flips from brass to success green with a check: `All covered` (150 ms colour, 1 frame of check draw). | none |
| 8 | 9.2–10.0 s | Hold | A clean reply, no squiggles, green pill. A corner chip reads `0 network requests`. Last frame equals the poster. | `Readback. Spellcheck that read the thread.` |

The 10 s cut shows two guard catches (name, number) and one supporting pill flip. That is one mechanism shown twice, plus the resolve. The date guard gets its own 4 s loop on the landing page (beat 3, proof 3).

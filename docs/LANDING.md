# Landing page: narrative, hero concept and draft copy

> Mode: **Persuade**. Structure: the 5 beats from `_studio/3D_INSPIRATION.md` §3.1, in ≤ 7 viewports at 1440 × 900. Visual rules: [`DESIGN.md`](../DESIGN.md) (D5 Bronze Vault, T8, CSS/SVG only, no WebGL by decision). Every example on the page is a synthetic **Sample thread** and is labelled as one. There are no testimonials, install counts, star counts or invented stats: the GitHub stars badge from beat 5 is shown only once the repository is public, and it comes from the live shields endpoint with no number hard-coded.

**Who must act:** someone who replies to email all day and has been burned by a wrong name or a wrong number.
**What they should believe:** "It checks my reply against *their* message, it only speaks up when it's nearly certain, and it never sends my mail anywhere."
**Proof we can honestly show:** the live playground (the real engine), the fixture-corpus precision number from CI (published only once measured), the "0 network requests" DevTools capture, and the zero-host-permission manifest excerpt.

**Lead with the guards.** The ask pill appears on the page only as supporting value in beat 3. It is never the headline (council weakness fix, SPEC §4).

---

## Beat 1: Hook (viewport 1)

**Hero concept: "The readback line."** The left 5 columns hold the H1, one sentence and the CTA row. The right 7 columns hold the **live playground in demo mode**: Kathryn's sample message on a thread card set slightly back (CSS T21: `rotateY(4deg)`, `translateZ(-24px)`), and Sam's reply card in front. When the hero is ≥ 50% in view, the demo plays once (10 s, SPEC §11). `Catherine` gets its red squiggle, the guard card opens, and a 1px brass line draws from the squiggle to `Kathryn` in her signature. One click, and the letters swap back. Then the same for `$1,520`. The demo rests on the final frame: a clean reply and a green pill. **Replay** and **Pause** buttons sit bottom-right.

- The poster (frame t = 4,600: card open, line drawn) is server-rendered AVIF and is the LCP element. The live DOM demo hydrates over it.
- Reduced motion: the poster plus a `Play the demo` button that steps through 4 key frames with instant cuts.
- Below 768px, the cards stack (reply first, thread collapsed to its last 3 lines, signature visible) and the line becomes a short vertical connector.

**H1 (hero scale, Hubot 650, wdth 112):**
> Spellcheck that read the thread.

**Sub (lead 17/26):**
> Readback underlines the slips your spellchecker can't see: her name spelled wrong, her amount with two digits swapped, a Thursday that's really a Tuesday. Every squiggle shows the line in her email it was checked against. It runs in your browser and sends nothing.

**CTA row:** primary **Add to Chrome** (or **Install from source** until the store listing exists), secondary **Try it with your own thread** (links to `/playground`), and a text link **Firefox build**.

**Meta line under the CTAs (caption, text-muted):**
> Works in Gmail. On any other site, select the message and choose "Use as Readback context". Free and open source.

**Alternate H1s for testing (pick one, never stack them):**
- "Your spellchecker hasn't read her email. Readback has."
- "It knows how to spell your landlord's name."

## Beat 2: The real product in motion (viewport 2)

A single wide frame of the extension in a Gmail-shaped compose box: a real capture, not a mock-up, and labelled `Sample thread · Gmail fixture`. It shows a 6 s muted loop (MP4, ≤ 600 KB, `preload="none"`, played on view, paused off-screen).

**Heading (h2 comfortable, Hubot 600):**
> It sits in the reply box and stays quiet.

**Body (≤ 68ch):**
> Most replies get nothing from Readback: no banner, no score, no rewrite. When a name, number or date in your draft nearly matches one in her message, it underlines it. Hover to see why, click to fix. Ctrl+Z undoes it like any other edit.

**Caption row (structured, not middle-dotted):** three label/value pairs set in a 3-column grid: `Changes to Gmail's page: none`, `Blocks Send: never`, `Network requests: 0`.

## Beat 3: Three proof moments (viewports 3–5, one per guard)

Each proof gets its own viewport: a 4–6 s loop from the playground capture on one side and one heading plus one sentence on the other, alternating sides. Under each loop is a **never fires** footnote, the line that sets Readback apart from a nagging checker.

### Proof 1: names
- **Loop:** `Hi Catherine,` → squiggle → `She signs Kathryn` → fix → swap-back.
- **Heading:** "Names, checked against her signature."
- **Line:** "Readback reads the names in her signature and your To field, and catches the near-misses: Catherine for Kathryn, John for Jon, Stephen for Steven."
- **Never fires:** "Write to Bob when the thread says Kathryn, and nothing happens. A different person isn't a typo."

### Proof 2: numbers
- **Loop:** `The $1,520 deposit` → `Thread says $1,250. Digits swapped?` → fix → digits roll back into place.
- **Heading:** "Amounts and order numbers, digit by digit."
- **Line:** "Swapped digits against the amounts and IDs in her message are flagged. Order numbers are flagged for a single wrong digit too."
- **Never fires:** "Counter-offer $1,200 and Readback stays quiet. It flags transpositions, not negotiations."

### Proof 3: dates (plus the supporting ask pill)
- **Loop:** `drop the keys Thursday the 10th` → `The 10th is a Tuesday. Thread says Thursday the 12th.` → two fix buttons → `Thursday the 12th`. In the same loop, the docked pill goes `1 open → 1 looks answered` (brass, dotted ring): it turns green only once the user confirms the ask.
- **Heading:** "Dates that don't match the calendar, or her message."
- **Line:** "Weekday and date that disagree, or a near-miss of the day she proposed. And a small pill counts what she asked that you haven't answered yet, so you don't need to reread."
- **Never fires:** "Propose a different day entirely and Readback assumes you meant it."

## Beat 4: The how (viewport 6)

An SVG architecture diagram drawn in tokens (slate strokes, brass for the one data path that matters). Following the 3D_INSPIRATION §3.7 template, every step shows a number, and numbers appear only once they are measured in CI (placeholders below are marked `[measured in Stage 2]` and must not ship as-is).

**Heading:** "How it works, without a server."

1. **The decision.** "The thread is the dictionary. Readback compares your draft only with the message you're answering, never with English in general."
2. **The naive version.** "A grammar-style checker flags every unknown word. Run on real replies, that means a wall of red. Readback only flags near-misses: an edit distance of 1–2 on a name from the thread, a digit swap on an amount from the thread." Number: `false positives on the deliberate set: [measured in Stage 2]`.
3. **The trick.** "Squiggles are drawn with the browser's CSS Custom Highlight API, so Gmail's own page is never changed. Fixes go through the editor's normal undo." Number: `check time per keystroke, p95: [measured in Stage 2] ms`.
4. **How it degrades.** "If Gmail changes its layout, Readback goes silent instead of guessing, and the select-as-context path still works anywhere. The optional on-device model only adds 'looks answered'. Every guard works without it."
5. **Stack + license.** "TypeScript, WXT, chrono-node, optional MiniLM via transformers.js. MIT licensed." Plus a **What it stores** table (SPEC §8) and the manifest's permission list rendered as code: `storage, contextMenus, activeTab, scripting` plus one host, `mail.google.com`.

**Privacy callout (one short paragraph, no shield icon):**
> Open DevTools, go to the Network tab, and write a reply in Gmail. Readback adds zero requests. There is no server to send anything to.

## Beat 5: Install (viewport 7) + footer

**Heading:** "Add it to your browser."

- Primary **Add to Chrome**, secondary **Firefox (140 or later)**. Until store listings exist, the primary block is a copyable command set in Geist Mono:
  ```
  git clone <repo> && cd readback && pnpm install && pnpm build
  ```
  followed by `Load apps/extension/.output/chrome-mv3 as an unpacked extension.`
- Platform line: `Chrome, Edge (untested) and Firefox 140+. Gmail on the web. Any text box via "Use as Readback context".`
- The GitHub stars badge from the live shields endpoint, only after the repo is public.
- **Footer:** a `<nav>` list of four links (Playground, Source, Privacy, License), with no middle-dot separators. It carries the note `"Readback" is a working name; trademark not yet checked.` until that check is done (council risk).

---

## README: the same beats in text (3D_INSPIRATION §3.1)

1. **One line:** "Spellcheck that read the thread: Readback underlines names, amounts and dates in your reply that nearly match the message you're answering."
2. **Hero GIF:** the 10 s demo, 800px wide, ≤ 3 MB, captured from `?demo=signature`.
3. **Why, in 3 bullets:** catches the slips spellcheck can't (names, digits, dates); only near-misses, so it stays quiet; runs on your device with 0 requests.
4. **How it feels:** the three proof loops.
5. **Install.**
6. **How it works:** the diagram plus the five steps above.
7. **Credits and license.**

## LinkedIn post (draft)

> Spellcheck knows how to spell "definitely". It doesn't know how to spell your landlord's name.
>
> So I built Readback, a browser extension that reads the email you're replying to and underlines the slips it can see: Catherine when she signs Kathryn, $1,520 when she wrote $1,250, Thursday the 10th when the 10th is a Tuesday. Click once and it fixes it.
>
> It runs entirely in your browser. Zero network requests. Open source.
>
> [native MP4, 1:1, the 10 s demo]

(The post carries the copy. The video burns in at most the one end caption from SPEC §11.)

## Copy rules for this page

- Sentence case everywhere. No all-caps eyebrows, no `→` on buttons, no accented word inside a headline.
- Name what the user sees ("her signature", "the amount she wrote"), never internals ("Damerau-Levenshtein") outside beat 4.
- Never claim Outlook, Slack or mobile support. Never claim store availability before it exists.
- Any number on the page comes from CI output or the manifest. Unmeasured numbers don't ship.

# Launch kit: Readback 0.1.0

Everything here is built from the real extension and web app (`node scripts/launch-assets.mjs`).
The mail client in the images, "Postwick", and every person and number in it are invented. The
images show the production extension build running on a synthetic, Gmail-shaped page; nothing here
is a capture of live Gmail.

## Files

| File | Size | Use |
| --- | --- | --- |
| `readback-demo.gif` | 960 px wide | README hero; LinkedIn image if no video is made |
| `store-1-name.png` | 1280 x 800 | Store screenshot 1: the name card |
| `store-2-number.png` | 1280 x 800 | Store screenshot 2: the swapped-digits card |
| `store-3-ledger.png` | 1280 x 800 | Store screenshot 3: the ledger (asks and slips) |
| `store-*@2x.png` | 2560 x 1600 | Sharp copies for the README and the post |
| `app-phone.png` | 390 x 844 @2x | The web app on a phone (for "try it without installing") |
| `social-preview.png` | 1280 x 640 | GitHub Settings > Social preview |
| `readback-0.1.0-chrome.zip` | | Chrome Web Store upload / GitHub release asset |
| `readback-0.1.0-firefox.zip` | | AMO upload / GitHub release asset |
| `readback-0.1.0-sources.zip` | | AMO source package (the build is bundled) |

## Before posting (checklist)

- [ ] Push the repository and confirm `https://github.com/NINJA981/readback` resolves.
- [ ] Enable GitHub Pages (Settings > Pages > Source: GitHub Actions), run the Pages workflow, and
      open `https://ninja981.github.io/readback/app/` on a phone.
- [ ] Create release `v0.1.0` with the two zips (and the sources zip).
- [ ] Upload `social-preview.png` in Settings > Social preview. Set the description and topics below.
- [ ] Turn on private vulnerability reporting (SECURITY.md points to it).
- [ ] CI shows green on `main` (the badge in the README reads from it).

**Repository description:** Spellcheck that has read the thread you're replying to. Flags near-miss
names, amounts and dates. On-device.

**Topics:** `browser-extension`, `chrome-extension`, `firefox-addon`, `email`, `spellcheck`,
`privacy`, `local-first`, `typescript`

## LinkedIn post (draft, about 1,260 characters with hashtags)

> Spellcheck knows how to spell "definitely". It doesn't know how to spell your landlord's name.
> Mine does now, and it reads the thread to find out.
>
> A reply can be spelled perfectly and still be wrong: "Hi Catherine" to someone who signs Kathryn,
> $1,520 when she wrote $1,250, "Thursday the 10th" when the 10th is a Tuesday. No spellchecker
> catches those, because every word is a real word. It just isn't the word in the thread.
>
> So I built Readback, an open-source browser extension:
> - It underlines a name, amount or date in your reply that nearly matches the message you're
>   answering, and shows the line it checked against.
> - One click (or Enter) fixes it. Ctrl+Z undoes it. Nothing ever blocks Send.
> - It runs entirely on your device. No server, no account, no AI model.
>
> I tested it on 2,735 real replies from public mail archives: about 1.8 wrong
> underlines per 100 replies, and it caught 95% of order numbers with swapped or changed digits
> in a seeded test.
>
> Honest limits: it was built against a mock of Gmail's page, so it hasn't been run on live Gmail
> yet, and it reads English only.
>
> Try it on your phone, no install: https://ninja981.github.io/readback/app/
> Source (MIT): https://github.com/NINJA981/readback
>
> #opensource #browserextension #privacy

Attach `readback-demo.gif` (or the three store images as a carousel). If you test link reach,
move the two links to the first comment and leave "Links in the first comment" in the post.

**Alt text, GIF:** A reply in a mail app. The writer types "Hi Catherine,". A red wavy line
appears under Catherine, and a card reads "Signs as Kathryn" with Kathryn's signature quoted
underneath. The writer presses Enter and the name changes to Kathryn.

**Alt text, store 1:** A mail thread from Kathryn Moss about a $1,250 deposit. In the reply,
Catherine, $1,520 and Thursday the 10th each have a red wavy underline. A card over Catherine says
"Signs as Kathryn" and offers "Change to Kathryn". A pill at the bottom reads "3 asks · 1 open,
3 slips".

**Alt text, store 2:** The same reply with a card over $1,520: "Thread says $1,250. Digits
swapped?", quoting the line from the thread with $1,250 highlighted, and a "Change to $1,250"
button.

**Alt text, store 3:** A ledger panel over the reply lists Kathryn's three asks (confirm the
deposit, drop off the keys, send the signed lease back) and three slips with Fix buttons:
Catherine to Kathryn, $1,520 to $1,250, and Thursday the 10th to Thursday the 12th.

**Alt text, phone:** The Readback web app on a phone. A reply reads "Hi Catherine," and "The
$1,520 deposit is confirmed", both underlined in red. Below, a Slips list offers Fix for Catherine
to Kathryn and $1,520 to $1,250, and the three asks are marked "Looks answered".

## Store copy

**Name:** Readback

**Short description (Chrome, 132 characters max):**
Spellcheck that has read the thread: flags names, amounts and dates in your reply that nearly match
the email you're answering.

(127 characters.)

**Detailed description:**

Readback checks your reply against the message you're answering, and only speaks up for
near-misses:

- A name that is one or two letters off, or a known variant: "Catherine" when she signs "Kathryn".
- Swapped digits in an amount or an order number: "$1,520" when the thread says "$1,250".
- A weekday that doesn't match its date: "Thursday the 10th" when the 10th is a Tuesday.

Each underline shows the line from the thread it was checked against. One click fixes it, and
Ctrl+Z undoes the fix. A deliberate change, like a counter-offer or a different person, stays
quiet. A small pill counts the questions in the message your reply hasn't covered yet.

Works in Gmail on the web. On any other site, select the message, right-click and choose "Use as
Readback context".

Private by design: there is no server, account or analytics. The extension makes no network
requests. Your mail is read in the page and never stored; settings and the words you choose to
ignore stay in your browser.

Limitations: English only. On real mail it shows about 1.8 wrong underlines per 100 replies;
Ignore and Never flag silence them.

Open source (MIT): https://github.com/NINJA981/readback

**Single purpose (Chrome privacy tab):** Check a reply being written in the browser against the
message it answers, and underline near-miss names, amounts and dates.

**Permission justifications:**

- Host `https://mail.google.com/*`: the content script reads the open thread and the reply box in
  Gmail to compare them. Nothing is sent anywhere.
- `storage`: keeps settings, ignored words and dismissed questions in the browser.
- `contextMenus`: adds "Use as Readback context" to the right-click menu.
- `activeTab` and `scripting`: after the user chooses that menu item, injects the checker into the
  current tab only.

**Data disclosure:** Readback does not collect or transmit user data. (Firefox manifest:
`data_collection_permissions: none`.)

**Privacy policy URL:** `https://github.com/NINJA981/readback#privacy`

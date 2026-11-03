# Security policy

Readback reads the mail you are replying to. Its promise is that nothing it reads leaves the page,
so a security report is taken seriously even when it looks small.

## Report a problem privately

Use GitHub's private vulnerability reporting: open the repository's **Security** tab and choose
**Report a vulnerability** (or go to `/security/advisories/new` on this repository). Please do not
open a public issue for a security problem.

Include what you found, how to reproduce it, and the version (`manifest.json` or the popup footer).
If your report needs a sample thread, use invented names, addresses and amounts.

You should get a first reply within 7 days. This is a small volunteer project, so a fix can take
longer; the advisory will say where it stands.

## In scope

- Any path by which thread text, reply text or settings leave the browser (network requests, other
  extensions, page scripts on the mail site reading Readback's state).
- Mail text written to `chrome.storage`, logs or anywhere other than page memory.
- Readback changing a reply without a click, or delaying or blocking Send.
- Script injection through the overlay, the popup, the options page or the web app (including the
  share link).
- Permission creep: anything that would need more than `storage`, `contextMenus`, `activeTab`,
  `scripting` and the one host permission `https://mail.google.com/*`.

## Out of scope

- Wrong or missing squiggles. File those as a normal issue (there is a template for each).
- Problems that need an already compromised browser or operating system.

## Supported versions

Only the latest release gets fixes. There is one release so far, 0.1.0.

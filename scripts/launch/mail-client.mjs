/**
 * Dresses a synthetic mail fixture as "Postwick", a fictional mail client, for
 * launch screenshots. The Gmail-shaped markup the adapter reads is untouched;
 * only a stylesheet, a top bar and a folder list are added around it, so the
 * real content script binds exactly as it does in the e2e suite.
 *
 * Postwick, its people and its addresses are invented. Nothing here imitates a
 * real mail product's look, name or logo.
 */

const CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  margin: 0; height: 100vh; overflow: hidden;
  display: grid; grid-template-columns: 232px 1fr; grid-template-rows: 60px 1fr;
  font: 14px/1.5 "Segoe UI", system-ui, sans-serif; color: #1d2430; background: #f3f4f6;
}
header {
  grid-column: 1 / -1; display: flex; align-items: center; gap: 24px;
  padding: 0 20px; background: #ffffff; border-bottom: 1px solid #e4e7eb;
}
.pw-brand { display: flex; align-items: center; gap: 10px; width: 192px; font-weight: 650; font-size: 17px; letter-spacing: -0.01em; color: #24324a; }
.pw-mark { width: 26px; height: 26px; border-radius: 7px; background: #2f6f73; position: relative; }
.pw-mark::after { content: ""; position: absolute; inset: 8px 6px 7px; border: 2px solid #ffffff; border-top: 0; border-radius: 0 0 4px 4px; }
.pw-search { flex: 1; max-width: 560px; height: 38px; border-radius: 10px; background: #f1f3f5; color: #7a8494; display: flex; align-items: center; padding: 0 14px; }
header a[aria-label] {
  margin-left: auto; width: 34px; height: 34px; border-radius: 50%; background: #d9e6e6; color: transparent;
  overflow: hidden; position: relative; text-decoration: none;
}
header a[aria-label]::after { content: "SO"; position: absolute; inset: 0; display: grid; place-items: center; color: #24324a; font-size: 12px; font-weight: 650; }
.pw-nav { padding: 16px 12px; background: #f3f4f6; }
.pw-compose { display: block; width: 100%; height: 42px; border: 0; border-radius: 12px; background: #2f6f73; color: #ffffff; font: 600 14px/1 "Segoe UI", system-ui, sans-serif; margin-bottom: 16px; }
.pw-nav ul { list-style: none; margin: 0; padding: 0; }
.pw-nav li { display: flex; justify-content: space-between; padding: 8px 12px; border-radius: 8px; color: #3b4555; }
.pw-nav li.on { background: #e1ecec; color: #1d3f42; font-weight: 600; }
.pw-nav li span:last-child { color: #7a8494; font-size: 12.5px; }
div[role="main"] { overflow: auto; padding: 24px 40px 40px; background: #ffffff; border-top-left-radius: 14px; }
h2.hP { margin: 4px 0 20px; font-size: 21px; font-weight: 600; letter-spacing: -0.01em; }
.adn { border: 1px solid #e4e7eb; border-radius: 12px; padding: 18px 22px; max-width: 900px; }
table.cf { width: 100%; border-collapse: collapse; }
h3.iw { margin: 0; font-size: 14.5px; display: flex; align-items: center; gap: 10px; }
h3.iw::before { content: "KM"; width: 32px; height: 32px; border-radius: 50%; background: #efe3d3; color: #6b4a1f; display: grid; place-items: center; font-size: 12px; font-weight: 650; }
td.gH { text-align: right; color: #7a8494; font-size: 13px; }
.a3s { margin-top: 10px; font-size: 14.5px; line-height: 1.6; padding-left: 42px; }
.gmail_signature { color: #6a7382; margin-top: 10px; }
.ip.iq { margin-top: 16px; border: 1px solid #cfd5dc; border-radius: 12px; padding: 12px 22px 14px; max-width: 900px; box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05); }
.aoD.hl { display: flex; align-items: center; gap: 8px; padding-bottom: 8px; border-bottom: 1px solid #eef0f3; color: #7a8494; }
.aoD.hl::before { content: "To"; }
.afV { background: #eef2f4; color: #24324a; border-radius: 999px; padding: 2px 10px; font-size: 13px; }
div[g_editable="true"] { outline: none; min-height: 190px !important; padding: 12px 0; font-size: 14.5px; line-height: 1.6; }
.pw-send { display: flex; align-items: center; gap: 12px; padding-top: 8px; }
.pw-send button { height: 36px; padding: 0 18px; border: 0; border-radius: 10px; background: #2f6f73; color: #ffffff; font: 600 14px/1 "Segoe UI", system-ui, sans-serif; }
.pw-send span { color: #7a8494; font-size: 13px; }
`;

const NAV = `
<nav class="pw-nav" aria-label="Folders">
  <button class="pw-compose" type="button">New message</button>
  <ul>
    <li class="on"><span>Inbox</span><span>4</span></li>
    <li><span>Starred</span><span></span></li>
    <li><span>Sent</span><span></span></li>
    <li><span>Drafts</span><span>1</span></li>
    <li><span>Archive</span><span></span></li>
  </ul>
</nav>`;

/** Returns the fixture HTML dressed as the fictional Postwick client. */
export function dressAsPostwick(fixtureHtml) {
  return fixtureHtml
    .replace(
      /<title>[^<]*<\/title>/,
      '<title>Postwick: Lease and deposit, 14 Larchmont Road</title>',
    )
    .replace('</head>', `<style>${CSS}</style></head>`)
    .replace(
      '<header>',
      '<header><div class="pw-brand"><span class="pw-mark" aria-hidden="true"></span>Postwick</div><div class="pw-search">Search mail</div>',
    )
    .replace('</header>', `</header>${NAV}`)
    .replace(
      '</form>',
      '<div class="pw-send"><button type="button">Send</button><span>Draft saved</span></div></form>',
    );
}

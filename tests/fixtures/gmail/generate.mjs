// Generates the Gmail-shaped DOM fixtures in this folder and their expected
// JSON. Run: node tests/fixtures/gmail/generate.mjs
//
// PROVENANCE: nothing here was captured from a real Gmail account (agents have
// none). The markup mirrors Gmail's publicly observable DOM conventions
// (`[data-message-id]`, `.a3s.aiL`, `.gmail_quote`, `.gmail_signature`,
// `span.gD[email]`, `span.g3[title]`, `[email]` recipient chips, a
// `g_editable` contenteditable) and every person, address, company and amount
// is invented. See README.md in this folder. Replace with sanitised real
// snapshots when a human can capture them.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const lines = (arr) => arr.map((l) => (l === '' ? '<div><br></div>' : `<div>${esc(l)}</div>`)).join('');

/** A message in the conversation. `own` messages show "me" as the sender. */
function message(m, i) {
  const sender = m.own
    ? `<span class="gD" email="sam.ortiz@example.com" name="me">me</span>`
    : `<span class="gD" email="${m.email}" name="${esc(m.name)}" data-hovercard-id="${m.email}">${esc(m.name)}</span>`;
  const sig = m.signature
    ? `<div class="gmail_signature" data-smartmail="gmail_signature"><div dir="ltr">${m.signature.map(esc).join('<br>')}</div></div>`
    : '';
  const quote = m.quote
    ? `<div class="gmail_quote"><div dir="ltr" class="gmail_attr">${esc(m.quote.attr)}</div><blockquote class="gmail_quote" style="margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex">${lines(m.quote.lines)}</blockquote></div>`
    : '';
  return `
    <div class="h7">
      <div class="adn ads" data-message-id="#msg-f:${1700000000000 + i}" data-legacy-thread-id="18c4a1f2b3d4e5f6">
        <div class="gs">
          <div class="gE iv gt"><table class="cf gJ"><tbody><tr class="acZ">
            <td class="gF gK"><h3 class="iw">${sender}</h3></td>
            <td class="gH"><span class="g3" title="${m.sent}">${m.sentShort}</span></td>
          </tr></tbody></table></div>
          <div class="ii gt"><div class="a3s aiL"><div dir="ltr">${lines(m.lines)}${sig}${quote}</div></div></div>
        </div>
      </div>
    </div>`;
}

/** The compose: inline reply, pop-out reply, forward or a brand-new message. */
function compose(kind, opts) {
  const chips = (opts.to ?? [])
    .map((p) => `<span class="afV" email="${p.email}" name="${esc(p.name)}" data-name="${esc(p.name)}">${esc(p.name)}</span>`)
    .join('');
  const ccChips = (opts.cc ?? [])
    .map((p) => `<span class="afV" email="${p.email}" name="${esc(p.name)}" data-name="${esc(p.name)}">${esc(p.name)}</span>`)
    .join('');
  const subject = opts.subject ?? '';
  const editorStyle = opts.editorStyle ?? 'direction: ltr; min-height: 200px;';
  const body = opts.editorHtml ?? '<div><br></div>';
  const editor = `<div id=":b8" class="Am Al editable LW-avf tS-tW" contenteditable="true" role="textbox" g_editable="true" aria-label="Message Body" aria-multiline="true" tabindex="1" style="${editorStyle}">${body}</div>`;
  const header = `
      <div class="aoD hl">${chips}</div>
      ${ccChips ? `<div class="aoD hl cc" name="cc">${ccChips}</div>` : ''}
      ${subject ? `<input name="subjectbox" class="aoT" value="${esc(subject)}">` : ''}
      <input type="hidden" name="from" value="Sam Ortiz &lt;sam.ortiz@example.com&gt;">`;
  if (kind === 'popout') {
    return `<div role="dialog" class="AD" aria-label="${esc(subject || 'New Message')}">${header}${editor}</div>`;
  }
  return `<div class="ip iq"><form class="bAs">${header}${editor}</form></div>`;
}

function page({ title, messages, composeKind, composeOpts, bodyStyle = '', rename = false }) {
  const thread = `
  <div role="main" class="nH bkK">
    <h2 class="hP">${esc(title)}</h2>
    ${messages.map(message).join('')}
    ${composeKind === 'popout' || composeKind === 'new' ? '' : compose(composeKind, composeOpts)}
  </div>
  ${composeKind === 'popout' || composeKind === 'new' ? compose('popout', composeOpts) : ''}`;
  let html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(title)} - sam.ortiz@example.com - Gmail (fixture)</title></head>
<body style="${bodyStyle}">
  <header><a aria-label="Google Account: Sam Ortiz (sam.ortiz@example.com)" href="https://accounts.google.com/SignOutOptions?hl=en">Sam</a></header>
  ${thread}
</body></html>
`;
  if (rename) {
    // A Gmail layout change: classes, message attributes, the main role and the
    // sender/timestamp markup all change. The compose editor itself still looks like a textbox.
    html = html
      .replace(/ class="(?!Am Al editable)[^"]*"/g, (m) => m.replace('class="', 'class="x-'))
      .replace(/data-message-id/g, 'data-mid')
      .replace(/data-legacy-thread-id/g, 'data-tid')
      .replace(/role="main"/g, 'role="region"')
      .replace(/ email="/g, ' mail="');
  }
  return html;
}

const kathryn = { email: 'kathryn.moss@example.com', name: 'Kathryn Moss' };
const heroLines = [
  'Hi Sam,',
  '',
  'Great news, the flat at 14 Larchmont Road is yours from the 1st. Before I hand over the keys, can you confirm the $1,250 deposit, drop off the keys on Thursday the 12th, and send the signed lease back?',
  '',
  'Let me know if you have any questions!',
  '',
  'Thanks,',
  'Kathryn',
];
const hero = {
  ...kathryn,
  sent: 'Mon, Nov 2, 2026, 9:14 AM',
  sentShort: '9:14 AM',
  lines: heroLines,
  signature: ['Kathryn Moss', 'Property Manager, Larchmont Lettings'],
};
const heroMessage = heroLines.join('\n');

const expectedReady = (extra = {}) => ({
  status: 'ready',
  threadId: '18c4a1f2b3d4e5f6',
  sentAt: '2026-11-02',
  sender: { name: 'Kathryn Moss', emailLocal: 'kathryn.moss', role: 'sender' },
  recipients: [{ name: 'Kathryn Moss', emailLocal: 'kathryn.moss', role: 'to' }],
  signatureBlock: 'Kathryn Moss\nProperty Manager, Larchmont Lettings',
  ...extra,
});

const ownSig =
  '<div class="gmail_signature" data-smartmail="gmail_signature"><div dir="ltr">Sam Ortiz<br>Mobile 555-0142</div></div>';

const fixtures = {
  'inline-reply': {
    html: page({
      title: 'Lease and deposit, 14 Larchmont Road',
      messages: [hero],
      composeKind: 'inline',
      composeOpts: { to: [kathryn], editorHtml: `<div><br></div>${ownSig}` },
    }),
    expected: expectedReady({ message: heroMessage, kind: 'reply' }),
  },
  'popout-reply': {
    html: page({
      title: 'Lease and deposit, 14 Larchmont Road',
      messages: [hero],
      composeKind: 'popout',
      composeOpts: {
        to: [kathryn],
        cc: [{ email: 'accounts@larchmont.example.com', name: 'Larchmont Accounts' }],
        subject: 'Re: Lease and deposit, 14 Larchmont Road',
      },
    }),
    expected: expectedReady({
      message: heroMessage,
      kind: 'reply',
      recipients: [
        { name: 'Kathryn Moss', emailLocal: 'kathryn.moss', role: 'to' },
        { name: 'Larchmont Accounts', emailLocal: 'accounts', role: 'cc' },
      ],
    }),
  },
  forward: {
    html: page({
      title: 'Lease and deposit, 14 Larchmont Road',
      messages: [hero],
      composeKind: 'inline',
      composeOpts: {
        to: [{ email: 'jo.park@example.com', name: 'Jo Park' }],
        subject: 'Fwd: Lease and deposit, 14 Larchmont Road',
      },
    }),
    expected: expectedReady({
      message: heroMessage,
      kind: 'forward',
      recipients: [{ name: 'Jo Park', emailLocal: 'jo.park', role: 'to' }],
    }),
  },
  'theme-light': {
    html: page({
      title: 'Lease and deposit, 14 Larchmont Road',
      messages: [hero],
      composeKind: 'inline',
      composeOpts: { to: [kathryn], editorStyle: 'direction: ltr; min-height: 200px; background: rgb(255, 255, 255); color: rgb(32, 33, 36);' },
      bodyStyle: 'background: rgb(255, 255, 255)',
    }),
    expected: expectedReady({ message: heroMessage, kind: 'reply', hostTheme: 'light' }),
  },
  'theme-dark': {
    html: page({
      title: 'Lease and deposit, 14 Larchmont Road',
      messages: [hero],
      composeKind: 'inline',
      composeOpts: { to: [kathryn], editorStyle: 'direction: ltr; min-height: 200px; background: rgb(32, 33, 36); color: rgb(232, 234, 237);' },
      bodyStyle: 'background: rgb(32, 33, 36)',
    }),
    expected: expectedReady({ message: heroMessage, kind: 'reply', hostTheme: 'dark' }),
  },
  'quoted-history': {
    html: page({
      title: 'Lease and deposit, 14 Larchmont Road',
      messages: [
        {
          ...kathryn,
          sent: 'Fri, Oct 30, 2026, 4:40 PM',
          sentShort: 'Oct 30',
          lines: ['Hi Sam,', '', 'The flat is still available. Viewing slots are Tuesday the 3rd at 5pm.', '', 'Kathryn'],
        },
        { own: true, sent: 'Fri, Oct 30, 2026, 6:02 PM', sentShort: 'Oct 30', lines: ['Hi Catherine,', '', 'Is the flat still available? Could you send the lease?', '', 'Sam'] },
        {
          ...hero,
          lines: [...heroLines, '', ''],
          quote: {
            attr: 'On Fri, Oct 30, 2026 at 6:02 PM Sam Ortiz <sam.ortiz@example.com> wrote:',
            lines: ['Hi Catherine,', 'Is the flat still available? Could you send the lease for $950 a month?'],
          },
        },
      ],
      composeKind: 'inline',
      composeOpts: {
        to: [kathryn],
        editorHtml: `<div><br></div><div class="gmail_quote"><div class="gmail_attr">On Mon, Nov 2, 2026 at 9:14 AM Kathryn Moss wrote:</div><blockquote class="gmail_quote">Great news, the flat at 14 Larchmont Road is yours</blockquote></div>`,
      },
    }),
    expected: expectedReady({ message: heroMessage.replace(/\n+$/, ''), kind: 'reply' }),
  },
  'long-signature': {
    html: page({
      title: 'Lease and deposit, 14 Larchmont Road',
      messages: [
        {
          ...hero,
          signature: [
            'Kathryn Moss',
            'Property Manager, Larchmont Lettings & Estate Management (Northern Region)',
            'Tel 555-0100 | Fax 555-0101',
            'Unit 4, 210 Harbour Street, Brightwater BW2 4QP',
            'Registered in England, company no. 04839217',
            'This email and any attachments are confidential and intended solely for the addressee.',
          ],
        },
      ],
      composeKind: 'inline',
      composeOpts: { to: [kathryn] },
    }),
    expected: expectedReady({
      message: heroMessage,
      kind: 'reply',
      signatureBlock: [
        'Kathryn Moss',
        'Property Manager, Larchmont Lettings & Estate Management (Northern Region)',
        'Tel 555-0100 | Fax 555-0101',
        'Unit 4, 210 Harbour Street, Brightwater BW2 4QP',
        'Registered in England, company no. 04839217',
        'This email and any attachments are confidential and intended solely for the addressee.',
      ].join('\n'),
    }),
  },
  'own-last': {
    html: page({
      title: 'Lease and deposit, 14 Larchmont Road',
      messages: [
        hero,
        { own: true, sent: 'Mon, Nov 2, 2026, 11:30 AM', sentShort: '11:30 AM', lines: ['Thanks Kathryn, I will confirm tomorrow.', '', 'Sam'] },
      ],
      composeKind: 'inline',
      composeOpts: { to: [kathryn] },
    }),
    expected: expectedReady({ message: heroMessage, kind: 'reply' }),
  },
  'renamed-classes': {
    html: page({
      title: 'Lease and deposit, 14 Larchmont Road',
      messages: [hero],
      composeKind: 'popout',
      composeOpts: { to: [kathryn], subject: 'Re: Lease and deposit, 14 Larchmont Road' },
      rename: true,
    }),
    expected: { status: 'layout-unrecognised', failed: ['thread'] },
  },
  'new-message': {
    html: page({
      title: 'Inbox',
      messages: [hero],
      composeKind: 'new',
      composeOpts: { to: [], subject: '' },
    }),
    expected: { status: 'not-a-reply' },
  },
};

mkdirSync(here, { recursive: true });
for (const [name, f] of Object.entries(fixtures)) {
  writeFileSync(join(here, `${name}.html`), f.html);
  writeFileSync(join(here, `${name}.expected.json`), `${JSON.stringify(f.expected, null, 2)}\n`);
}
console.log(`wrote ${Object.keys(fixtures).length} fixtures`);

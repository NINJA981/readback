/**
 * Every Gmail selector Readback uses lives in this file, each as a fallback
 * chain (ordered, most specific first). Nothing else in the code base may name
 * a Gmail class or attribute. The chains follow Gmail's public DOM conventions;
 * `tests/fixtures/gmail/` holds hand-built approximations, and live-Gmail
 * behaviour stays unverified until a human captures real snapshots
 * (HANDOFF.md, Known issues).
 */
import type { SelectorChain } from '../query';

export const GMAIL_ORIGIN = 'https://mail.google.com';

export const SELECTORS = {
  /** The compose editor: a contenteditable textbox. */
  composeEditor: [
    'div[contenteditable="true"][role="textbox"][g_editable="true"]',
    'div[contenteditable="true"][role="textbox"][aria-label][aria-multiline="true"]',
    'div.editable[contenteditable="true"][role="textbox"]',
  ],
  /** The compose window or inline reply box that wraps the editor. */
  composeContainer: ['div[role="dialog"]', 'div.M9', 'div.aoI', 'form.bAs', 'div.nH.Hd'],
  /** Subject input inside a compose (its value starts with "Re:" or "Fwd:"). */
  subjectInput: ['input[name="subjectbox"]', 'input[aria-label="Subject"]'],
  /** Containers of recipient chips, by field. */
  ccArea: ['[name="cc"]', '[aria-label^="Cc"]', '.aoD.hl.cc', '[data-field="cc"]'],
  /** A recipient chip carrying the address. */
  recipientChip: ['span[email]', 'div[data-hovercard-id][email]', '[data-hovercard-id*="@"]'],
  /** The open conversation. */
  threadContainer: ['div[role="main"]', 'div.nH.bkK', 'div[data-thread-perm-id]', 'div.aeF'],
  /** One message in the conversation. */
  message: ['[data-message-id]', 'div.adn.ads', 'div.gs'],
  /** The rendered body of an expanded message. */
  messageBody: ['div.a3s.aiL', 'div.a3s', 'div.ii.gt', '[data-message-id] div[dir="ltr"]'],
  /** Subtrees left out of the incoming text: quoted history and trimmed-content toggles. */
  quote: ['.gmail_quote', 'blockquote.gmail_quote', 'div.gmail_extra', '.adL', '.ajR', 'div.yj6qo'],
  /** The signature block inside a message or the compose. */
  signature: ['.gmail_signature', '[data-smartmail="gmail_signature"]'],
  /** Sender element of a message header (carries `email` and `name`). */
  sender: ['span.gD[email]', 'h3.iw span[email]', 'span[email].gD', '.gE.iv.gt span[email]'],
  /** Timestamp element of a message (the absolute time is its `title`). */
  timestamp: ['span.g3[title]', 'span[title].g3', '.gH span.g3', 'td.gH span[title]'],
  /** Account chip whose label carries the signed-in address. */
  account: [
    'a[aria-label*="Google Account"]',
    'a[href^="https://accounts.google.com/SignOutOptions"]',
  ],
  /** Hidden From input inside a compose (multi-account senders). */
  fromInput: ['input[name="from"]', '[name="from"]'],
} as const satisfies Record<string, SelectorChain>;

export type SelectorId = keyof typeof SELECTORS;

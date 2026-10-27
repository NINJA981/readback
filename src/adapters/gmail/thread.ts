/**
 * Reads the open Gmail conversation into an engine `ContextInput`: the latest
 * message not sent by the user, its sender, signature and sent date, and the
 * reply's To and Cc chips. A self-test names which lookups failed, so a Gmail
 * layout change makes the adapter go silent instead of reading the wrong thing
 * (SPEC F8, AC-8.2). Failed check names are selector ids only, never page text.
 */
import { elementText } from '../../dom/text-index';
import { parseTimestamp } from '../../engine/harvest/dates';
import type { ContextInput } from '../../engine/index';
import type { Person } from '../../engine/types';
import { closestOf, queryAll, queryFirst } from '../query';
import { describeCompose, isNotDraft, readRecipients } from './compose';
import type { ComposeInfo } from './compose';
import { SELECTORS } from './selectors';

/** Check ids shown in the popup's "layout not recognised" row. Lower-case slugs. */
export type CheckId = 'editor' | 'thread' | 'message' | 'body' | 'sender';

export interface SelfTest {
  ok: boolean;
  failed: CheckId[];
}

export type GmailRead =
  /** A reply or forward whose context was read. */
  | { status: 'ready'; compose: ComposeInfo; input: ContextInput; selfTest: SelfTest }
  /** A new message with no thread to read: nothing to do, nothing wrong. */
  | { status: 'not-a-reply'; compose: ComposeInfo }
  /** The self-test failed: stay silent and tell the popup. */
  | { status: 'layout-unrecognised'; compose: ComposeInfo; selfTest: SelfTest };

interface MessageParts {
  element: Element;
  body: Element;
  sender: Element | undefined;
}

const text = (el: Element | undefined): string => el?.textContent.replace(/\s+/g, ' ').trim() ?? '';
const attr = (el: Element | undefined, name: string): string =>
  el?.getAttribute(name)?.trim() ?? '';

/** The signed-in address, from the account chip's label or the compose's From field. */
export function ownAddressOf(doc: Document, container: Element): string | undefined {
  const emailRe = /[^\s()<>@]+@[^\s()<>@]+\.[^\s()<>@]+/;
  const from = queryFirst(container, SELECTORS.fromInput) as HTMLInputElement | undefined;
  const fromValue = from?.value || from?.getAttribute('value') || '';
  const fromMatch = emailRe.exec(fromValue);
  if (fromMatch) return fromMatch[0].toLowerCase();
  const account = queryFirst(doc, SELECTORS.account);
  const label = account?.getAttribute('aria-label') ?? '';
  const match = emailRe.exec(label);
  return match ? match[0].toLowerCase() : undefined;
}

function isOwnMessage(sender: Element | undefined, own: string | undefined): boolean {
  if (!sender) return false;
  const email = attr(sender, 'email').toLowerCase();
  if (own && email === own) return true;
  // Gmail labels the user's own messages "me" in the header.
  return /^me$/i.test(attr(sender, 'name') || text(sender));
}

/** Messages of the open conversation, newest last, with their bodies resolved. */
function expandedMessages(thread: Element): MessageParts[] {
  const out: MessageParts[] = [];
  for (const element of queryAll(thread, SELECTORS.message)) {
    const body = queryFirst(element, SELECTORS.messageBody);
    if (!body) continue;
    // Skip an outer element whose inner message was already listed.
    if (out.some((m) => element.contains(m.element) || m.element.contains(element))) continue;
    out.push({ element, body, sender: queryFirst(element, SELECTORS.sender) });
  }
  return out;
}

function threadIdOf(doc: Document, thread: Element, message: Element): string {
  const stamped =
    attr(message, 'data-legacy-thread-id') ||
    attr(message, 'data-thread-id') ||
    attr(closestOf(message, ['[data-thread-perm-id]']) ?? thread, 'data-thread-perm-id');
  if (stamped) return stamped;
  const hash = doc.location.hash;
  if (hash.length > 1) return hash;
  return `${text(queryFirst(thread, ['h2.hP', 'h2[data-thread-perm-id]', 'h2']))}|${attr(message, 'data-message-id')}`;
}

function senderOf(el: Element | undefined): Person | undefined {
  if (!el) return undefined;
  const email = attr(el, 'email');
  const at = email.indexOf('@');
  const name = attr(el, 'name') || text(el) || (at > 0 ? email.slice(0, at) : '');
  if (!name) return undefined;
  return { name, ...(at > 0 ? { emailLocal: email.slice(0, at) } : {}), role: 'sender' };
}

/** Reads the conversation behind a compose editor. */
export function readGmailThread(doc: Document, editor: HTMLElement): GmailRead {
  const compose = describeCompose(editor);
  if (compose.kind === 'new') return { status: 'not-a-reply', compose };

  const failed: CheckId[] = [];
  if (!editor.isContentEditable && editor.getAttribute('contenteditable') !== 'true') {
    failed.push('editor');
  }

  const thread = queryFirst(doc, SELECTORS.threadContainer);
  if (!thread) failed.push('thread');

  const messages = thread ? expandedMessages(thread) : [];
  if (thread && queryAll(thread, SELECTORS.message).length === 0) failed.push('message');
  else if (thread && messages.length === 0) failed.push('body');

  const own = ownAddressOf(doc, compose.container);
  const latest = [...messages].reverse().find((m) => !isOwnMessage(m.sender, own));
  if (thread && messages.length > 0 && !latest) failed.push('message');
  if (latest && !latest.sender) failed.push('sender');

  const selfTest: SelfTest = { ok: failed.length === 0, failed };
  if (!selfTest.ok || !thread || !latest)
    return { status: 'layout-unrecognised', compose, selfTest };

  const signatureEl = queryFirst(latest.body, SELECTORS.signature);
  const signatureBlock = signatureEl ? elementText(signatureEl) : '';
  const timestamp = queryFirst(latest.element, SELECTORS.timestamp);
  const sentAt = parseTimestamp(attr(timestamp, 'title') || text(timestamp));
  const sender = senderOf(latest.sender);

  const input: ContextInput = {
    source: 'gmail',
    threadId: threadIdOf(doc, thread, latest.element),
    ...(sentAt ? { sentAt } : {}),
    message: elementText(latest.body, { exclude: isNotDraft }),
    ...(signatureBlock ? { signatureBlock } : {}),
    ...(sender ? { sender } : {}),
    recipients: readRecipients(compose.container),
  };
  return { status: 'ready', compose, input, selfTest };
}

/**
 * Gmail compose boxes: finding them, telling a reply from a forward or a new
 * message, reading the To and Cc chips, and building the draft text index.
 * DOM reads only; the editor is never modified.
 */
import type { Person } from '../../engine/types';
import { buildTextIndex } from '../../dom/text-index';
import type { TextIndex } from '../../dom/text-index';
import { closestOf, matchesAny, queryAll, queryFirst } from '../query';
import { SELECTORS } from './selectors';

export type ComposeKind = 'reply' | 'forward' | 'new';

export interface ComposeInfo {
  editor: HTMLElement;
  container: Element;
  kind: ComposeKind;
}

const MAX_RECIPIENTS = 20;
const FORWARD_RE = /^\s*(?:fwd?|fw|wg|tr|rv)\s*:/i;
const REPLY_RE = /^\s*(?:re|aw|sv|res|ref)\s*:/i;

/** Compose editors currently in the document (hidden ones excluded). */
export function findComposeEditors(root: ParentNode): HTMLElement[] {
  return queryAll(root, SELECTORS.composeEditor).filter(
    (el) =>
      el.isConnected && el.getAttribute('aria-hidden') !== 'true' && !el.hasAttribute('hidden'),
  );
}

/** The compose window or inline reply box that wraps an editor. */
export function composeContainerOf(editor: HTMLElement): Element {
  return closestOf(editor, SELECTORS.composeContainer) ?? editor.parentElement ?? editor;
}

const readSubject = (container: Element): string => {
  const input = queryFirst(container, SELECTORS.subjectInput) as HTMLInputElement | undefined;
  return input?.value || input?.getAttribute('value') || '';
};

export function composeKindOf(editor: HTMLElement, container: Element): ComposeKind {
  const subject = readSubject(container);
  if (FORWARD_RE.test(subject)) return 'forward';
  if (REPLY_RE.test(subject)) return 'reply';
  // An inline reply has no subject box: it lives inside the open conversation.
  const thread = closestOf(editor, SELECTORS.threadContainer);
  const inline =
    thread !== undefined && container !== thread && !matchesAny(container, ['div[role="dialog"]']);
  return inline && subject === '' ? 'reply' : 'new';
}

export function describeCompose(editor: HTMLElement): ComposeInfo {
  const container = composeContainerOf(editor);
  return { editor, container, kind: composeKindOf(editor, container) };
}

const emailLocal = (email: string | null): string | undefined => {
  const at = email?.indexOf('@') ?? -1;
  return email && at > 0 ? email.slice(0, at) : undefined;
};

/** Display name for a chip: its `name` / `data-name` attribute, else its text without the address. */
function chipName(chip: Element): string {
  const attr = chip.getAttribute('name') ?? chip.getAttribute('data-name');
  const text = (attr ?? chip.textContent).replace(/\s+/g, ' ').trim();
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/[,;]+$/, '')
    .trim();
}

/** To and Cc chips of a compose, deduplicated by address. */
export function readRecipients(container: Element): Person[] {
  const ccAreas = queryAll(container, SELECTORS.ccArea);
  const out: Person[] = [];
  const seen = new Set<string>();
  for (const chip of queryAll(container, SELECTORS.recipientChip)) {
    const email = chip.getAttribute('email') ?? chip.getAttribute('data-hovercard-id');
    const local = emailLocal(email);
    const name = chipName(chip) || local || '';
    if (!name) continue;
    const key = (email ?? name).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const inCc = ccAreas.some((area) => area === chip || area.contains(chip));
    out.push({ name, ...(local ? { emailLocal: local } : {}), role: inCc ? 'cc' : 'to' });
    if (out.length >= MAX_RECIPIENTS) break;
  }
  return out;
}

/** Subtrees of the editor that are not the user's new text: quoted history and their own signature. */
export const isNotDraft = (el: Element): boolean =>
  matchesAny(el, SELECTORS.quote) || matchesAny(el, SELECTORS.signature);

/** Text index of the new text in the compose editor. */
export function draftIndexOf(editor: HTMLElement): TextIndex {
  return buildTextIndex(editor, { exclude: isNotDraft });
}

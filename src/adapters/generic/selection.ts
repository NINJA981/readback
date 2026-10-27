/**
 * Generic adapter, part 1: "Use as Readback context" (SPEC F8). The user
 * selects the message they are answering on any page; Readback then checks
 * the next textarea or contenteditable they type in against that selection.
 * Pure helpers: no extension API, so the web app can reuse them.
 */
import { MAX_SELECTION_CHARS } from '../../messaging/protocol';
import type { ContextInput } from '../../engine/index';

/** Context-menu item id and title (registered by the background). */
export const CONTEXT_MENU_ID = 'readback-use-selection';
export const CONTEXT_MENU_TITLE = 'Use as Readback context';

/** Fewest words a selection needs to count as a message. */
export const MIN_CONTEXT_WORDS = 3;

export function wordCount(text: string): number {
  const m = text.match(/\S+/g);
  return m ? m.length : 0;
}

/**
 * The engine input for a selection, or undefined if it is too short to be a
 * message. The selection text itself is the thread id, hashed by the engine.
 */
export function selectionContextInput(raw: string): ContextInput | undefined {
  const message = raw.replace(/\r\n?/g, '\n').trim().slice(0, MAX_SELECTION_CHARS);
  if (wordCount(message) < MIN_CONTEXT_WORDS) return undefined;
  return { source: 'selection', threadId: message, message, recipients: [] };
}

/** The chip by the field: `Context: 84 words from this page · Clear` (DESIGN.md). */
export function contextChipLabel(words: number): string {
  return `Context: ${words} ${words === 1 ? 'word' : 'words'} from this page`;
}

export type EditableKind = 'textarea' | 'contenteditable';

/**
 * The editable element a focus event landed on, or undefined if it is not a
 * field Readback should check: password fields, read-only and disabled fields
 * are always skipped. Only `textarea` and `contenteditable` qualify.
 */
export function editableKindOf(el: Element | null): EditableKind | undefined {
  if (!el) return undefined;
  const tag = el.tagName.toLowerCase();
  if (tag === 'textarea') {
    const t = el as HTMLTextAreaElement;
    return t.readOnly || t.disabled ? undefined : 'textarea';
  }
  if (tag === 'input') {
    // Single-line inputs hold names and search terms, not replies.
    return undefined;
  }
  const editable = el.getAttribute('contenteditable');
  if (editable === 'true' || editable === '' || editable === 'plaintext-only') {
    if (el.getAttribute('aria-readonly') === 'true') return undefined;
    return 'contenteditable';
  }
  return undefined;
}

/** The outermost contenteditable host for a focus target inside rich text. */
export function editableHostOf(el: Element | null): Element | undefined {
  for (let node = el; node; node = node.parentElement) {
    if (editableKindOf(node)) return node;
  }
  return undefined;
}

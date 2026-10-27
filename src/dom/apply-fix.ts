/**
 * Applies a fix through the editor's own input path (SPEC F5, ADR-0001
 * §Content script 9): select the range, then `execCommand('insertText')`, so
 * the host's model, autosave and Ctrl+Z all see a normal edit. If the host
 * refuses, the replacement is copied to the clipboard and the caller says so
 * (DESIGN.md guard card "fix unavailable" state). Nothing else ever edits text.
 */

export type FixOutcome = 'inserted' | 'copied' | 'failed';

export interface ClipboardLike {
  writeText(text: string): Promise<void>;
}

interface ExecDocument {
  execCommand?: (command: string, showUi?: boolean, value?: string) => boolean;
  queryCommandSupported?: (command: string) => boolean;
  getSelection(): Selection | null;
}

function canInsertText(doc: ExecDocument): boolean {
  if (typeof doc.execCommand !== 'function') return false;
  try {
    return doc.queryCommandSupported ? doc.queryCommandSupported('insertText') : true;
  } catch {
    return false;
  }
}

async function copy(clipboard: ClipboardLike | undefined, text: string): Promise<FixOutcome> {
  if (!clipboard) return 'failed';
  try {
    await clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** Replaces `range` in a contenteditable with `replacement`. */
export async function applyFixToRange(options: {
  doc: Document;
  range: Range;
  replacement: string;
  clipboard?: ClipboardLike;
}): Promise<FixOutcome> {
  const { range, replacement, clipboard } = options;
  const doc = options.doc as unknown as ExecDocument;
  const expected = range.toString();
  if (canInsertText(doc)) {
    const selection = doc.getSelection();
    if (selection) {
      try {
        selection.removeAllRanges();
        selection.addRange(range);
        const ok = doc.execCommand?.('insertText', false, replacement) ?? false;
        if (ok) return 'inserted';
      } catch {
        // fall through to the clipboard
      }
      // Leave the slip selected so the user can paste over it.
      if (range.toString() === expected) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }
  return copy(clipboard, replacement);
}

/** Replaces `start..end` in a textarea or input, keeping native undo where possible. */
export async function applyFixToField(options: {
  doc: Document;
  field: HTMLTextAreaElement | HTMLInputElement;
  start: number;
  end: number;
  replacement: string;
  clipboard?: ClipboardLike;
}): Promise<FixOutcome> {
  const { field, start, end, replacement, clipboard } = options;
  const doc = options.doc as unknown as ExecDocument;
  const before = field.value;
  if (start < 0 || end > before.length || start > end) return 'failed';
  field.focus();
  field.setSelectionRange(start, end);
  if (canInsertText(doc)) {
    try {
      if (doc.execCommand?.('insertText', false, replacement) && field.value !== before) {
        return 'inserted';
      }
    } catch {
      // fall through
    }
  }
  return copy(clipboard, replacement);
}

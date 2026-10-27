/**
 * Generic adapter controller (SPEC F8): the user selects the message they are
 * answering on any page and chooses "Use as Readback context". The next
 * textarea or contenteditable they focus is then checked against the selection
 * until the page navigates or they clear it. Nothing is stored: the selection
 * lives in this closure only.
 */
import {
  contextChipLabel,
  editableHostOf,
  editableKindOf,
  selectionContextInput,
  wordCount,
} from '../adapters/generic/selection';
import { createContentEditableTarget, createTextareaTarget } from '../adapters/target';
import type { DraftTarget } from '../adapters/target';
import { createHighlightPainter } from '../dom/highlights';
import type { HighlightPainter } from '../dom/highlights';
import { createContext } from '../engine/index';
import { createComposeSession } from '../state/session';
import type { ComposeSession } from '../state/session';
import type { ReadbackStorage } from '../storage/repository';
import type { TabStatus } from '../storage/tab-status';
import { bindDraft } from './binding';
import type { Binding } from './binding';
import { createOverlayHost } from './overlay-host';
import type { OverlayHost } from './overlay-host';
import { statusFrom } from './status';

export interface SelectionControllerDeps {
  doc: Document;
  storage: ReadbackStorage;
  report(status: TabStatus): void;
  painter?: HighlightPainter;
  now?: () => number;
}

export interface SelectionController {
  /** "Use as Readback context". False when the selection is too short to be a message. */
  useSelection(text: string): Promise<boolean>;
  clear(): void;
  session(): ComposeSession | undefined;
  stop(): void;
}

export function createSelectionController(deps: SelectionControllerDeps): SelectionController {
  const { doc, storage } = deps;
  const now = deps.now ?? (() => Date.now());
  const painter = deps.painter ?? createHighlightPainter();

  let context: ReturnType<typeof createContext> | undefined;
  const currentContext = (): typeof context => context;
  const isStopped = (): boolean => stopped;
  let words = 0;
  let binding: Binding | undefined;
  let host: OverlayHost | undefined;
  let chip: HTMLElement | undefined;
  let stopped = false;

  const getHost = (): OverlayHost => (host ??= createOverlayHost(doc));

  const report = (status: Omit<TabStatus, 'updatedAt'>): void => {
    try {
      deps.report({ ...status, updatedAt: now() });
    } catch {
      // A stale popup status is acceptable.
    }
  };

  const removeChip = (): void => {
    chip?.remove();
    chip = undefined;
  };

  const placeChip = (field: HTMLElement): void => {
    if (!chip) return;
    const rect = field.getBoundingClientRect();
    chip.style.left = `${Math.max(8, rect.left)}px`;
    chip.style.top = `${rect.bottom + 6}px`;
  };

  const showChip = (field: HTMLElement): void => {
    removeChip();
    const el = doc.createElement('div');
    el.className = 'rb-chip';
    el.setAttribute('role', 'status');
    const label = doc.createElement('span');
    label.textContent = contextChipLabel(words);
    const clearButton = doc.createElement('button');
    clearButton.type = 'button';
    clearButton.textContent = 'Clear';
    clearButton.addEventListener('click', () => {
      controller.clear();
    });
    el.append(label, doc.createTextNode(' · '), clearButton);
    getHost().root.append(el);
    chip = el;
    placeChip(field);
  };

  const unbind = (): void => {
    binding?.destroy();
    binding = undefined;
    removeChip();
  };

  const attach = async (field: Element): Promise<void> => {
    if (!context || stopped) return;
    const kind = editableKindOf(field);
    if (!kind) return;
    if (binding?.target.element === field) return;
    unbind();
    const [settings, ignore, threadState] = await Promise.all([
      storage.getSettings(),
      storage.getIgnore(),
      storage.getThreadState(context.threadKey),
    ]);
    // The context may have been cleared while the settings loaded.
    const current = currentContext();
    if (!current || isStopped()) return;
    const session = createComposeSession({
      context: current,
      settings,
      ignore,
      threadState,
      effects: {
        saveThreadState: (key, state) => storage.setThreadState(key, state),
        saveIgnore: async (list) => {
          await storage.setIgnore(list);
        },
      },
    });
    const h = getHost();
    let target: DraftTarget;
    let mirrorHost: ParentNode | undefined;
    if (kind === 'textarea') {
      const area = field as HTMLTextAreaElement;
      mirrorHost = h.root;
      // The textarea target resolves rects through the binding's mirror.
      target = createTextareaTarget(area, () => []);
    } else {
      target = createContentEditableTarget(field as HTMLElement);
    }
    binding = bindDraft({
      target,
      session,
      painter,
      ...(mirrorHost ? { mirrorHost } : {}),
      onChange: (snap) => {
        report(statusFrom(snap, 'selection-context', words));
      },
    });
    showChip(field as HTMLElement);
  };

  const onFocusIn = (event: FocusEvent): void => {
    const target = event.target instanceof Element ? editableHostOf(event.target) : undefined;
    if (target) void attach(target);
  };
  const onReposition = (): void => {
    if (binding) placeChip(binding.target.element);
  };
  const onNavigate = (): void => {
    controller.clear();
  };

  doc.addEventListener('focusin', onFocusIn, true);
  const view = doc.defaultView;
  view?.addEventListener('scroll', onReposition, { capture: true, passive: true });
  view?.addEventListener('resize', onReposition, { passive: true });
  view?.addEventListener('popstate', onNavigate);
  view?.addEventListener('hashchange', onNavigate);

  const controller: SelectionController = {
    async useSelection(text) {
      const input = selectionContextInput(text);
      if (!input) return false;
      unbind();
      context = createContext(input);
      words = wordCount(input.message);
      report({
        state: 'selection-context',
        asks: 0,
        open: 0,
        slips: 0,
        contextWords: words,
        failedChecks: [],
      });
      const active = doc.activeElement;
      const field = active ? editableHostOf(active) : undefined;
      if (field) await attach(field);
      return true;
    },
    clear() {
      unbind();
      context = undefined;
      words = 0;
      report({ state: 'idle', asks: 0, open: 0, slips: 0, contextWords: 0, failedChecks: [] });
    },
    session: () => binding?.session,
    stop() {
      stopped = true;
      unbind();
      context = undefined;
      doc.removeEventListener('focusin', onFocusIn, true);
      view?.removeEventListener('scroll', onReposition, true);
      view?.removeEventListener('resize', onReposition);
      view?.removeEventListener('popstate', onNavigate);
      view?.removeEventListener('hashchange', onNavigate);
      host?.destroy();
      host = undefined;
    },
  };
  return controller;
}

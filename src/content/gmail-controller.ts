/**
 * Gmail content-script controller. Finds reply composes, runs the adapter
 * self-test, builds the thread context once per compose, and binds the editor
 * to a compose session. When anything looks wrong it goes silent and reports a
 * status the popup can show (SPEC F8). Browser-API access is injected through
 * `GmailControllerDeps`, so the controller runs in tests and e2e without the
 * extension runtime.
 *
 * Only the first reply compose is bound at a time; binding every open compose
 * at once is a Stage 3 item (HANDOFF.md).
 */
import { findComposeEditors, isNotDraft } from '../adapters/gmail/compose';
import { readGmailThread } from '../adapters/gmail/thread';
import { createContentEditableTarget } from '../adapters/target';
import { createHighlightPainter } from '../dom/highlights';
import type { HighlightPainter } from '../dom/highlights';
import { createContext } from '../engine/index';
import { createComposeSession } from '../state/session';
import type { ComposeSession, SessionSnapshot } from '../state/session';
import { isSiteEnabled } from '../state/settings';
import type { ReadbackStorage } from '../storage/repository';
import type { TabStatus } from '../storage/tab-status';
import { bindDraft } from './binding';
import type { Binding } from './binding';
import { statusFrom } from './status';

export interface GmailControllerDeps {
  doc: Document;
  storage: ReadbackStorage;
  /** Sends counts and an enum to the background for the popup. */
  report(status: TabStatus): void;
  painter?: HighlightPainter;
  now?: () => number;
  schedule?: (run: () => void) => void;
}

export interface GmailController {
  /** The session of the bound compose, if any (the popup's slip list reads it). */
  session(): ComposeSession | undefined;
  stop(): void;
}

export async function startGmailController(deps: GmailControllerDeps): Promise<GmailController> {
  const { doc, storage } = deps;
  const now = deps.now ?? (() => Date.now());
  const painter = deps.painter ?? createHighlightPainter();
  const schedule =
    deps.schedule ??
    ((run: () => void) => {
      (doc.defaultView ?? globalThis).requestAnimationFrame(run);
    });

  // Independent reads in parallel.
  const [initialSettings, ignore] = await Promise.all([storage.getSettings(), storage.getIgnore()]);
  let settings = initialSettings;
  let binding: Binding | undefined;
  let boundEditor: HTMLElement | undefined;
  let layoutFailure: TabStatus | undefined;
  let stopped = false;
  let pending = false;
  let scanQueued = false;

  const origin = doc.location.origin;
  const report = (status: Omit<TabStatus, 'updatedAt'>): void => {
    try {
      deps.report({ ...status, updatedAt: now() });
    } catch {
      // The popup simply shows a stale status.
    }
  };
  const idle = (state: TabStatus['state']): Omit<TabStatus, 'updatedAt'> => ({
    state,
    asks: 0,
    open: 0,
    slips: 0,
    contextWords: 0,
    failedChecks: [],
  });

  const unbind = (): void => {
    binding?.destroy();
    binding = undefined;
    boundEditor = undefined;
  };

  const bind = async (editor: HTMLElement): Promise<void> => {
    const read = readGmailThread(doc, editor);
    if (read.status === 'not-a-reply') return;
    if (read.status === 'layout-unrecognised') {
      layoutFailure = {
        ...idle('layout-unrecognised'),
        failedChecks: read.selfTest.failed,
        updatedAt: now(),
      };
      report(layoutFailure);
      return;
    }
    layoutFailure = undefined;
    const context = createContext(read.input);
    const threadState = await storage.getThreadState(context.threadKey);
    // The compose may have closed while the state loaded.
    if (stopped || !editor.isConnected) return;
    const session = createComposeSession({
      context,
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
    const target = createContentEditableTarget(editor, { exclude: isNotDraft });
    boundEditor = editor;
    binding = bindDraft({
      target,
      session,
      painter,
      onChange: (snap: SessionSnapshot) => {
        report(statusFrom(snap));
      },
    });
  };

  const scan = (): void => {
    scanQueued = false;
    if (stopped) return;
    if (!isSiteEnabled(settings, origin)) {
      if (binding) unbind();
      report(idle('site-off'));
      return;
    }
    if (boundEditor && !boundEditor.isConnected) unbind();
    if (binding || pending) return;
    const [editor] = findComposeEditors(doc);
    if (!editor) {
      if (!layoutFailure) report(idle('idle'));
      return;
    }
    pending = true;
    void bind(editor).finally(() => {
      pending = false;
    });
  };

  const queueScan = (): void => {
    if (scanQueued || stopped) return;
    scanQueued = true;
    schedule(scan);
  };

  // One observer on the body, childList only (ADR-0001 §Content script 2).
  const observer = new MutationObserver(queueScan);
  observer.observe(doc.body, { childList: true, subtree: true });

  const stopSettings = storage.watchSettings((next) => {
    settings = next;
    if (binding) binding.session.setSettings(next);
    queueScan();
  });
  const stopIgnore = storage.watchIgnore((next) => {
    binding?.session.setIgnore(next);
  });

  queueScan();

  return {
    session: () => binding?.session,
    stop() {
      stopped = true;
      observer.disconnect();
      stopSettings();
      stopIgnore();
      unbind();
    },
  };
}

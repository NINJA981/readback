/**
 * Gmail content-script controller. Finds reply composes, runs the adapter
 * self-test, builds the thread context once per compose, and binds the editor
 * to a compose session. When anything looks wrong it goes silent and reports a
 * status the popup can show (SPEC F8). Browser-API access is injected through
 * `GmailControllerDeps`, so the controller runs in tests and e2e without the
 * extension runtime.
 *
 * One compose is bound at a time: the first open compose that is a reply or a
 * forward (a new-message compose earlier in the page is skipped).
 */
import { findComposeEditors, isNotDraft } from '../adapters/gmail/compose';
import { readGmailThread } from '../adapters/gmail/thread';
import { createContentEditableTarget } from '../adapters/target';
import { createHighlightPainter } from '../dom/highlights';
import type { HighlightPainter } from '../dom/highlights';
import { createContext } from '../engine/index';
import { attachOverlay } from '../overlay/controller';
import type { OverlayController } from '../overlay/controller';
import { createComposeSession } from '../state/session';
import type { ComposeSession, SessionSnapshot } from '../state/session';
import { isSiteEnabled } from '../state/settings';
import type { ReadbackStorage } from '../storage/repository';
import type { TabStatus } from '../storage/tab-status';
import { bindDraft } from './binding';
import type { Binding } from './binding';
import { createOverlayHost } from './overlay-host';
import type { OverlayHost } from './overlay-host';
import { createStatusReporter, statusFrom } from './status';

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
  /** Alt+Shift+J: open the next slip's card. */
  nextSlip(): void;
  /** Alt+Shift+L: open the ask ledger. */
  openLedger(): void;
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
  let overlay: OverlayController | undefined;
  let overlayHost: OverlayHost | undefined;
  let overlayFailed = false;
  let boundEditor: HTMLElement | undefined;
  let stopped = false;
  let pending = false;
  let scanQueued = false;

  const origin = doc.location.origin;
  const report = createStatusReporter((status) => {
    deps.report(status);
  }, now);
  const idle = (state: TabStatus['state']): Omit<TabStatus, 'updatedAt'> => ({
    state,
    asks: 0,
    open: 0,
    unconfirmed: 0,
    slips: 0,
    contextWords: 0,
    failedChecks: [],
  });

  const unbind = (): void => {
    overlay?.destroy();
    overlay = undefined;
    overlayHost?.destroy();
    overlayHost = undefined;
    overlayFailed = false;
    binding?.destroy();
    binding = undefined;
    boundEditor = undefined;
  };

  const bind = async (
    editor: HTMLElement,
    read: ReturnType<typeof readGmailThread>,
  ): Promise<void> => {
    if (read.status === 'not-a-reply') return;
    if (read.status === 'layout-unrecognised') {
      report({ ...idle('layout-unrecognised'), failedChecks: read.selfTest.failed });
      return;
    }
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
    // The overlay mounts the first time there is something to draw, so a reply
    // with no asks and no slips adds nothing to the page (not even the host node).
    let needsOverlay = false as boolean;
    binding = bindDraft({
      target,
      session,
      painter,
      onChange: (snap: SessionSnapshot) => {
        report(statusFrom(snap));
        if (snap.pill.tone !== 'hidden') {
          needsOverlay = true;
          if (binding) mountOverlay(binding);
        }
      },
    });
    if (needsOverlay) mountOverlay(binding);
  };

  /** The overlay is optional: if it cannot mount, squiggles and the popup still work. */
  const mountOverlay = (bound: Binding): void => {
    if (overlay || overlayFailed) return;
    try {
      overlayHost = createOverlayHost(doc);
      overlay = attachOverlay({ doc, host: overlayHost, binding: bound });
    } catch {
      overlayFailed = true;
      overlayHost?.destroy();
      overlayHost = undefined;
    }
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
    // Bind the first compose that is a reply; a new-message compose is skipped, not a dead end.
    let editor: HTMLElement | undefined;
    let read: ReturnType<typeof readGmailThread> | undefined;
    for (const candidate of findComposeEditors(doc)) {
      const attempt = readGmailThread(doc, candidate);
      if (attempt.status === 'not-a-reply') continue;
      editor = candidate;
      read = attempt;
      break;
    }
    if (!editor || !read) {
      report(idle('idle'));
      return;
    }
    pending = true;
    void bind(editor, read).finally(() => {
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
    nextSlip: () => {
      overlay?.nextSlip();
    },
    openLedger: () => {
      overlay?.openLedger();
    },
    stop() {
      stopped = true;
      observer.disconnect();
      stopSettings();
      stopIgnore();
      unbind();
    },
  };
}

/**
 * Generic adapter content script. Registered at runtime only: the background
 * injects it into the active tab after a "Use as Readback context" click
 * (`activeTab` + `scripting`), so the extension has no broad host permission.
 */
import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createSelectionController } from '../content/selection-controller';
import { parseMessage } from '../messaging/protocol';
import type { MessageReplies } from '../messaging/protocol';
import { extensionStorage } from '../platform/runtime-storage';

export default defineContentScript({
  matches: [],
  registration: 'runtime',
  main(ctx) {
    // Injected again on every menu click: keep one controller per page.
    const flag = globalThis as { __readbackSelection?: boolean };
    if (flag.__readbackSelection) return;
    flag.__readbackSelection = true;
    const controller = createSelectionController({
      doc: document,
      storage: extensionStorage(),
      report: (status) => {
        void browser.runtime.sendMessage({ type: 'tab-status', status }).catch(() => undefined);
      },
    });
    ctx.onInvalidated(() => {
      controller.stop();
      flag.__readbackSelection = false;
    });

    browser.runtime.onMessage.addListener((raw: unknown, _sender, sendResponse) => {
      const message = parseMessage(raw);
      if (!message) return undefined;
      if (message.type === 'use-selection') void controller.useSelection(message.text);
      else if (message.type === 'clear-selection') controller.clear();
      else if (message.type === 'next-slip') controller.nextSlip();
      else if (message.type === 'open-ledger') controller.openLedger();
      else if (message.type === 'get-slips') {
        const flags = controller.session()?.getSnapshot().result.flags ?? [];
        const reply: MessageReplies['get-slips'] = {
          slips: flags.map((f) => ({ found: f.found, expected: f.expected, message: f.message })),
        };
        sendResponse(reply);
      }
      return undefined;
    });
  },
});

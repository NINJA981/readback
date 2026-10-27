/**
 * Gmail content script. Matches only mail.google.com (the extension's one host
 * permission). The squiggle stylesheet is declared in the manifest through the
 * CSS import below, so no <style> node is added to Gmail's DOM.
 */
import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { startGmailController } from '../content/gmail-controller';
import { GMAIL_ORIGIN } from '../adapters/gmail/selectors';
import { parseMessage } from '../messaging/protocol';
import type { MessageReplies } from '../messaging/protocol';
import { extensionStorage } from '../platform/runtime-storage';
import '../styles/highlights.css';

export default defineContentScript({
  matches: [`${GMAIL_ORIGIN}/*`],
  runAt: 'document_idle',
  cssInjectionMode: 'manifest',
  async main(ctx) {
    const controller = await startGmailController({
      doc: document,
      storage: extensionStorage(),
      report: (status) => {
        void browser.runtime.sendMessage({ type: 'tab-status', status }).catch(() => undefined);
      },
    });
    ctx.onInvalidated(() => {
      controller.stop();
    });

    browser.runtime.onMessage.addListener((raw: unknown, _sender, sendResponse) => {
      const message = parseMessage(raw);
      if (message?.type === 'next-slip') controller.nextSlip();
      if (message?.type === 'open-ledger') controller.openLedger();
      if (message?.type !== 'get-slips') return undefined;
      const flags = controller.session()?.getSnapshot().result.flags ?? [];
      const reply: MessageReplies['get-slips'] = {
        slips: flags.map((f) => ({ found: f.found, expected: f.expected, message: f.message })),
      };
      sendResponse(reply);
      return undefined;
    });
  },
});

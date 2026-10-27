/**
 * Background (service worker on Chrome, event page on Firefox). Routes the
 * context menu, the keyboard commands and the content scripts' status reports.
 * It reads no mail and keeps nothing in memory between wake-ups: everything it
 * needs is in storage or in the message.
 */
import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { CONTEXT_MENU_ID, CONTEXT_MENU_TITLE } from '../adapters/generic/selection';
import { parseMessage } from '../messaging/protocol';
import type { ReadbackMessage } from '../messaging/protocol';
import { allowSessionInContentScripts } from '../platform/extension-storage';
import { extensionStorage } from '../platform/runtime-storage';

const SELECTION_SCRIPT = '/content-scripts/selection.js';

async function sendToTab(tabId: number, message: ReadbackMessage): Promise<void> {
  try {
    await browser.tabs.sendMessage(tabId, message);
  } catch {
    // No Readback script in that tab (restricted page, or not loaded yet).
  }
}

async function useSelection(tabId: number, text: string): Promise<void> {
  try {
    await browser.scripting.executeScript({ target: { tabId }, files: [SELECTION_SCRIPT] });
  } catch {
    return; // restricted page: activeTab does not reach it
  }
  await sendToTab(tabId, { type: 'use-selection', text });
}

export default defineBackground(() => {
  void allowSessionInContentScripts();

  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.removeAll(() => {
      browser.contextMenus.create({
        id: CONTEXT_MENU_ID,
        title: CONTEXT_MENU_TITLE,
        contexts: ['selection'],
      });
    });
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== CONTEXT_MENU_ID || tab?.id === undefined || !info.selectionText) return;
    void useSelection(tab.id, info.selectionText);
  });

  browser.commands.onCommand.addListener((command) => {
    if (command !== 'next-slip' && command !== 'open-ledger') return;
    void browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id !== undefined) void sendToTab(tab.id, { type: command });
    });
  });

  browser.runtime.onMessage.addListener((raw: unknown, sender) => {
    const message = parseMessage(raw);
    // Only content scripts report status; the sender's tab id is the key.
    if (message?.type === 'tab-status' && sender.tab?.id !== undefined) {
      void extensionStorage().setTabStatus(sender.tab.id, message.status);
    }
    return undefined;
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    void extensionStorage().clearTabStatus(tabId);
  });
  browser.tabs.onUpdated.addListener((tabId, change) => {
    if (change.status === 'loading') void extensionStorage().clearTabStatus(tabId);
  });
});

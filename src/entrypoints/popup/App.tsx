/**
 * Popup entry (360 x 480): live data in, `PopupView` out. First paint is the
 * shell from storage alone (no waiting on the tab); the status fills in when
 * the active tab answers, with a one-line skeleton if that takes over 150 ms
 * (DESIGN.md §Popup "Loading"). A recorded reading status is verified by
 * pinging the tab, so a closed reply never shows as still being read.
 */
import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { parseSlips } from '../../messaging/protocol';
import type { SlipSummary } from '../../messaging/protocol';
import { GMAIL_URL, PLAYGROUND_URL } from '../../platform/links';
import { extensionStorage } from '../../platform/runtime-storage';
import { diagnostics, hostOf } from '../../state/popup-state';
import { setGuard, setSiteEnabled, toOrigin } from '../../state/settings';
import type { TabStatus } from '../../storage/tab-status';
import { PopupView } from '../../ui/PopupView';
import type { PopupActions } from '../../ui/PopupView';
import { updateSettings, useSettings } from '../../ui/stores';
import { useTheme } from '../../ui/use-theme';

interface ActiveTab {
  id: number | undefined;
  url: string | undefined;
  status: TabStatus | undefined;
  slips: SlipSummary[];
}

const SKELETON_DELAY_MS = 150;

async function askTab(tabId: number): Promise<SlipSummary[] | undefined> {
  try {
    return parseSlips(await browser.tabs.sendMessage(tabId, { type: 'get-slips' }));
  } catch {
    return undefined; // no Readback script in that tab
  }
}

async function loadActiveTab(): Promise<ActiveTab> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return { id: undefined, url: undefined, status: undefined, slips: [] };
  const stored = await extensionStorage().getTabStatus(tab.id);
  // A reading status is only believed while the tab's script still answers; a
  // reply that closed or a reloaded extension leaves a stale record behind.
  const live = stored?.state === 'reading' || stored?.state === 'selection-context';
  const slips = live ? await askTab(tab.id) : [];
  const status = live && slips === undefined ? undefined : stored;
  return { id: tab.id, url: tab.url, status, slips: slips ?? [] };
}

/** The active tab, plus whether a stale status is still being verified. */
function useActiveTab(): { tab: ActiveTab | undefined; checking: boolean } {
  const [tab, setTab] = useState<ActiveTab>();
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      if (live) setChecking(true);
    }, SKELETON_DELAY_MS);
    loadActiveTab().then(
      (next) => {
        if (!live) return;
        setTab(next);
        setChecking(false);
      },
      () => {
        if (!live) return;
        setTab({ id: undefined, url: undefined, status: undefined, slips: [] });
        setChecking(false);
      },
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, []);
  return { tab, checking: checking && tab === undefined };
}

export function App() {
  const settings = useSettings();
  const { tab, checking } = useActiveTab();
  const [copied, setCopied] = useState(false);
  useTheme(settings.value.theme);

  useEffect(() => {
    // A mark the e2e budget test reads (SPEC AC-10.1: first paint <= 100 ms).
    if (settings.loaded) performance.mark('readback-popup-ready');
  }, [settings.loaded]);

  if (!settings.loaded) return <main className="h-[480px] w-[360px] bg-bg" />;

  const url = tab?.url;
  const status = tab?.status;
  const sendToTab = (type: 'open-ledger' | 'next-slip' | 'clear-selection'): void => {
    const id = tab?.id;
    if (id === undefined) return;
    void browser.tabs.sendMessage(id, { type }).catch(() => undefined);
    // Bring the tab forward, then get out of the way so the card has the page.
    void browser.tabs.update(id, { active: true }).catch(() => undefined);
    if (type !== 'clear-selection') window.close();
  };

  const actions: PopupActions = {
    toggleSite(on) {
      const origin = url ? toOrigin(url) : undefined;
      if (origin) void updateSettings((s) => setSiteEnabled(s, origin, on));
    },
    toggleGuard(guard, on) {
      void updateSettings((s) => setGuard(s, guard, on));
    },
    openOptions() {
      void browser.runtime.openOptionsPage();
      window.close();
    },
    openPlayground() {
      if (PLAYGROUND_URL) void browser.tabs.create({ url: PLAYGROUND_URL });
      window.close();
    },
    openGmail() {
      void browser.tabs.create({ url: GMAIL_URL });
      window.close();
    },
    openPrivacy() {
      void browser.tabs.create({ url: `${browser.runtime.getURL('/options.html')}#privacy` });
      window.close();
    },
    openLedger: () => {
      sendToTab('open-ledger');
    },
    openSlip: () => {
      sendToTab('next-slip');
    },
    clearContext: () => {
      sendToTab('clear-selection');
    },
    copyDiagnostics() {
      const text = diagnostics(status, browser.runtime.getManifest().version);
      navigator.clipboard.writeText(text).then(
        () => {
          setCopied(true);
          setTimeout(() => {
            setCopied(false);
          }, 2000);
        },
        () => undefined,
      );
    },
  };

  return (
    <PopupView
      settings={settings.value}
      host={hostOf(url)}
      url={url}
      status={status}
      slips={tab?.slips ?? []}
      checking={checking}
      playground={PLAYGROUND_URL !== undefined}
      diagnosticsCopied={copied}
      actions={actions}
    />
  );
}

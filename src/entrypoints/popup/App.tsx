/**
 * Popup placeholder (Stage 2): real status and real switches over the real
 * storage layer, with the visual polish left to the UI stage. 360 x 480.
 */
import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { extensionStorage } from '../../platform/runtime-storage';
import {
  GUARD_KEYS,
  isSiteEnabled,
  setGuard,
  setSiteEnabled,
  toOrigin,
} from '../../state/settings';
import type { Guard } from '../../state/settings';
import { statusLine } from '../../state/status-text';
import type { TabStatus } from '../../storage/tab-status';
import { GhostButton, Section, SwitchRow } from '../../ui/controls';
import { updateSettings, useSettings } from '../../ui/stores';
import { useTheme } from '../../ui/use-theme';

const GUARD_LABELS: Record<Guard, string> = {
  name: 'Names',
  number: 'Numbers',
  date: 'Dates',
  asks: 'Ask pill',
};

interface ActiveTab {
  url: string | undefined;
  status: TabStatus | undefined;
}

/** The active tab's URL and last reported status, read in parallel. */
async function loadActiveTab(): Promise<ActiveTab> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return { url: undefined, status: undefined };
  const status = await extensionStorage().getTabStatus(tab.id);
  return { url: tab.url, status };
}

function useActiveTab(): ActiveTab | undefined {
  const [state, setState] = useState<ActiveTab>();
  useEffect(() => {
    let live = true;
    loadActiveTab().then(
      (next) => {
        if (live) setState(next);
      },
      () => {
        if (live) setState({ url: undefined, status: undefined });
      },
    );
    return () => {
      live = false;
    };
  }, []);
  return state;
}

export function App() {
  const settings = useSettings();
  const tab = useActiveTab();
  useTheme(settings.value.theme);

  if (!settings.loaded || !tab) return <main className="h-[480px] w-[360px] bg-bg" />;

  const origin = tab.url ? toOrigin(tab.url) : undefined;
  const siteOn = tab.url ? isSiteEnabled(settings.value, tab.url) : true;
  const line = statusLine(tab.status);

  return (
    <main className="flex h-[480px] w-[360px] flex-col gap-3 bg-bg p-3 text-text">
      <header className="flex items-center justify-between px-2">
        <h1 className="text-h3 font-semibold">Readback</h1>
        <GhostButton
          onClick={() => {
            void browser.runtime.openOptionsPage();
          }}
        >
          Options
        </GhostButton>
      </header>

      <p
        role="status"
        className={`rounded-md border border-border bg-surface px-3 py-2 text-ui ${
          line.tone === 'problem'
            ? 'text-danger'
            : line.tone === 'active'
              ? 'text-brass-text'
              : 'text-text-muted'
        }`}
      >
        {line.text}
      </p>

      <Section title="This site">
        {origin ? (
          <SwitchRow
            label="Check replies here"
            hint={origin.replace(/^https?:\/\//, '')}
            checked={siteOn}
            onChange={(on) => {
              void updateSettings((s) => setSiteEnabled(s, origin, on));
            }}
          />
        ) : (
          <p className="px-2 text-caption text-text-subtle">
            Open a page to switch Readback on or off for it.
          </p>
        )}
      </Section>

      <Section title="Checks">
        {GUARD_KEYS.map((guard) => (
          <SwitchRow
            key={guard}
            label={GUARD_LABELS[guard]}
            checked={settings.value.guards[guard]}
            onChange={(on) => {
              void updateSettings((s) => setGuard(s, guard, on));
            }}
          />
        ))}
      </Section>

      <p className="mt-auto px-2 text-caption text-text-subtle">
        0 network requests. Everything runs on this device.
      </p>
    </main>
  );
}

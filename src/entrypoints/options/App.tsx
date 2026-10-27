/**
 * Options placeholder (Stage 2): guards, theme, the ignore lists with removal,
 * and the data panel with Clear all, all wired to the real storage layer.
 * Layout and polish follow in the UI stage. Single column, max-width 720.
 */
import { useState } from 'react';
import { extensionStorage } from '../../platform/runtime-storage';
import { removeIgnored } from '../../state/ignore';
import type { IgnoreKind } from '../../state/ignore';
import { GUARD_KEYS, THEMES, setGuard, setTheme } from '../../state/settings';
import type { Guard } from '../../state/settings';
import type { StorageInventory } from '../../storage/repository';
import { GhostButton, PrimaryButton, SecondaryButton, Section, SwitchRow } from '../../ui/controls';
import { updateIgnore, updateSettings, useIgnore, useSettings } from '../../ui/stores';
import { useTheme } from '../../ui/use-theme';

const GUARD_LABELS: Record<Guard, { label: string; hint: string }> = {
  name: { label: 'Names', hint: 'Underline a name that is a near-miss of one in the thread.' },
  number: { label: 'Numbers', hint: 'Catch swapped digits in amounts and IDs.' },
  date: { label: 'Dates', hint: 'Catch a weekday that does not match its date.' },
  asks: { label: 'Ask pill', hint: 'Count the asks you have not covered yet.' },
};

function IgnoreList({ kind, title, empty }: { kind: IgnoreKind; title: string; empty: string }) {
  const ignore = useIgnore();
  const entries = ignore.value[kind];
  return (
    <Section title={title} as="h3">
      {entries.length === 0 ? (
        <p className="px-2 text-caption text-text-subtle">{empty}</p>
      ) : (
        <ul className="flex flex-col">
          {entries.map((entry) => (
            <li
              key={entry}
              className="flex items-center justify-between rounded-sm px-2 py-1 hover:bg-surface-3"
            >
              <span className="font-mono text-label">{entry}</span>
              <GhostButton
                aria-label={`Stop ignoring ${entry}`}
                onClick={() => {
                  void updateIgnore((l) => removeIgnored(l, kind, entry));
                }}
              >
                Remove
              </GhostButton>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function DataPanel() {
  const [inventory, setInventory] = useState<StorageInventory>();
  const [confirming, setConfirming] = useState(false);

  const refresh = (): void => {
    extensionStorage()
      .inventory()
      .then(setInventory, () => undefined);
  };

  return (
    <Section title="What Readback stores">
      <p className="px-2 text-caption text-text-muted">
        Your settings and the words you chose to ignore, on this device. Per-reply choices live in
        this browser session only and hold hashed ids, never message text. Readback makes no network
        requests.
      </p>
      <div className="flex items-center gap-2 px-2">
        <SecondaryButton onClick={refresh}>Show what is stored</SecondaryButton>
        {confirming ? (
          <>
            <PrimaryButton
              onClick={() => {
                void extensionStorage()
                  .clearAll()
                  .then(() => {
                    setConfirming(false);
                    refresh();
                  });
              }}
            >
              Clear everything
            </PrimaryButton>
            <GhostButton
              onClick={() => {
                setConfirming(false);
              }}
            >
              Cancel
            </GhostButton>
          </>
        ) : (
          <GhostButton
            onClick={() => {
              setConfirming(true);
            }}
          >
            Clear all
          </GhostButton>
        )}
      </div>
      {inventory ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 px-2 text-label text-text-muted tabular">
          <dt>Settings saved</dt>
          <dd>{inventory.settings ? 'yes' : 'no'}</dd>
          <dt>Ignored names</dt>
          <dd>{inventory.ignoredNames}</dd>
          <dt>Ignored numbers</dt>
          <dd>{inventory.ignoredNumbers}</dd>
          <dt>Replies remembered this session</dt>
          <dd>{inventory.threads}</dd>
        </dl>
      ) : null}
    </Section>
  );
}

export function App() {
  const settings = useSettings();
  useTheme(settings.value.theme);
  if (!settings.loaded) return <main className="min-h-screen bg-bg" />;

  return (
    <main className="mx-auto flex min-h-screen max-w-[720px] flex-col gap-8 bg-bg px-4 py-8 text-text md:px-6 lg:px-8">
      <h1 className="font-display text-h1 font-semibold">Readback options</h1>

      <Section title="Checks">
        {GUARD_KEYS.map((guard) => (
          <SwitchRow
            key={guard}
            label={GUARD_LABELS[guard].label}
            hint={GUARD_LABELS[guard].hint}
            checked={settings.value.guards[guard]}
            onChange={(on) => {
              void updateSettings((s) => setGuard(s, guard, on));
            }}
          />
        ))}
      </Section>

      <Section title="Appearance">
        <div role="radiogroup" aria-label="Theme" className="flex gap-2 px-2">
          {THEMES.map((theme) => (
            <button
              key={theme}
              type="button"
              role="radio"
              aria-checked={settings.value.theme === theme}
              onClick={() => {
                void updateSettings((s) => setTheme(s, theme));
              }}
              className={`h-7 rounded-sm border px-3 text-label capitalize ${
                settings.value.theme === theme
                  ? 'border-brass bg-brass-soft text-brass-text'
                  : 'border-border bg-surface-2 text-text-muted hover:bg-surface-3'
              }`}
            >
              {theme}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Never flag">
        <IgnoreList
          kind="names"
          title="Names"
          empty="No ignored names. “Never flag” on a slip adds one."
        />
        <IgnoreList kind="numbers" title="Numbers" empty="No ignored numbers." />
      </Section>

      <DataPanel />
    </main>
  );
}

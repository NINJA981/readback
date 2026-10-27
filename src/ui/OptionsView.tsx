/**
 * The options page (DESIGN.md §Options): one column, max-width 720, with an
 * in-page nav beside it from 1024px. A function of its props, so the
 * screenshot gallery renders every state (model loading, model error, the
 * Clear-all undo toast) without a browser extension around it.
 */
import type { ReactNode } from 'react';
import type { IgnoreList, Settings } from '../engine/types';
import type { IgnoreKind } from '../state/ignore';
import { GUARD_KEYS, THEMES } from '../state/settings';
import type { Guard, Theme } from '../state/settings';
import type { StorageInventory } from '../storage/repository';
import { CheckIcon, CircleAlertIcon, UndoIcon } from '../overlay/ui/icons';
import { GhostButton, SecondaryButton, Shortcut, SwitchRow } from './controls';

export const SECTIONS = [
  { id: 'guards', label: 'Checks' },
  { id: 'ignored', label: 'Ignored words' },
  { id: 'model', label: 'Looks-answered model' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'data', label: 'Your data' },
  { id: 'shortcuts', label: 'Shortcuts' },
  { id: 'privacy', label: 'Check the network' },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

const GUARD_COPY: Record<Guard, { label: string; hint: string; example: string }> = {
  name: {
    label: 'Names',
    hint: 'Underline a name that nearly matches one in the thread.',
    example: 'Catherine → Kathryn',
  },
  number: {
    label: 'Numbers',
    hint: 'Catch swapped digits in amounts and IDs. A different amount is left alone.',
    example: '$1,520 → $1,250',
  },
  date: {
    label: 'Dates',
    hint: 'Catch a weekday that does not match its date.',
    example: 'Thursday the 10th → Tuesday the 10th',
  },
  asks: {
    label: 'Ask pill',
    hint: 'Count the asks in the last message that your reply has not covered.',
    example: '3 asks · 1 open',
  },
};

export type ModelStatus =
  /** Switch off. */
  | { kind: 'off'; sizeMb: number }
  /** Starting; `ms` is how long it has taken so far. */
  | { kind: 'loading'; ms: number; progress?: number }
  | { kind: 'ready'; sizeMb: number }
  | { kind: 'error'; reason: string }
  /** The model is not part of this build. */
  | { kind: 'unavailable' };

export interface OptionsActions {
  toggleGuard: (guard: Guard, on: boolean) => void;
  setTheme: (theme: Theme) => void;
  removeIgnored: (kind: IgnoreKind, entry: string) => void;
  toggleModel: (on: boolean) => void;
  retryModel: () => void;
  copyModelError: () => void;
  clearAll: () => void;
  undoClear: () => void;
}

export interface OptionsViewProps {
  settings: Settings;
  ignore: IgnoreList;
  model: ModelStatus;
  inventory: StorageInventory | undefined;
  hostPermissions: readonly string[];
  /** The "Cleared. Undo" toast is showing. */
  clearedToast: boolean;
  actions: OptionsActions;
}

function Heading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="font-display text-h2 font-semibold tracking-[-0.015em] [font-variation-settings:'wdth'_104]"
    >
      {children}
    </h2>
  );
}

function Panel({ id, title, children }: { id: SectionId; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-8 flex-col gap-3">
      <Heading id={`${id}-title`}>{title}</Heading>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-label tabular">{children}</span>;
}

function IgnoreRows({
  kind,
  entries,
  onRemove,
}: {
  kind: IgnoreKind;
  entries: readonly string[];
  onRemove: (kind: IgnoreKind, entry: string) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <h3 className="px-2 text-label font-semibold text-text-muted">
        {kind === 'names' ? 'Names' : 'Numbers'}
      </h3>
      <ul className="flex flex-col">
        {entries.map((entry) => (
          <li
            key={entry}
            className="flex h-8 items-center justify-between rounded-sm px-2 hover:bg-surface-3"
          >
            <Mono>{entry}</Mono>
            <GhostButton
              aria-label={`Stop ignoring ${entry}`}
              onClick={() => {
                onRemove(kind, entry);
              }}
            >
              Remove
            </GhostButton>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModelPanel({
  settings,
  model,
  actions,
}: Pick<OptionsViewProps, 'settings' | 'model' | 'actions'>) {
  const on = settings.model.enabled;
  const status = (() => {
    switch (model.kind) {
      case 'unavailable':
        return (
          <p className="flex items-start gap-2 text-ui text-text-muted">
            <CircleAlertIcon className="mt-0.5 shrink-0 text-text-subtle" />
            <span>Not included in this build. Looks-answered uses word matching.</span>
          </p>
        );
      case 'off':
        return (
          <p className="text-ui text-text-muted">
            Off. Looks-answered uses word matching. The model adds <Mono>{model.sizeMb} MB</Mono>{' '}
            and runs on this device.
          </p>
        );
      case 'loading': {
        const seconds = (model.ms / 1000).toFixed(1);
        return (
          <div className="flex flex-col gap-2" role="status">
            <p className="text-ui text-text-muted tabular">
              Loading the on-device model… {seconds} s
            </p>
            {model.ms > 2000 ? (
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                {...(model.progress !== undefined
                  ? { 'aria-valuenow': Math.round(model.progress * 100) }
                  : {})}
              >
                <div
                  className="h-full rounded-full bg-brass"
                  style={{ width: `${Math.round((model.progress ?? 0) * 100)}%` }}
                />
              </div>
            ) : null}
          </div>
        );
      }
      case 'ready':
        return (
          <p className="flex items-center gap-2 text-ui text-success" role="status">
            <CheckIcon />
            <span>Model ready. Runs on this device, 0 requests.</span>
          </p>
        );
      case 'error':
        return (
          <div className="flex flex-col gap-3" role="alert">
            <p className="flex items-start gap-2 text-ui">
              <CircleAlertIcon className="mt-0.5 shrink-0 text-danger" />
              <span>
                The model couldn’t start in this browser ({model.reason}). Looks-answered still
                works with word matching.
              </span>
            </p>
            <div className="flex gap-2">
              <SecondaryButton onClick={actions.retryModel}>Try again</SecondaryButton>
              <GhostButton onClick={actions.copyModelError}>Copy error details</GhostButton>
            </div>
          </div>
        );
    }
  })();

  return (
    <>
      <p className="px-2 text-ui text-text-muted">
        An optional on-device model (MiniLM) can refine the dotted {'“'}looks answered{'”'} state.
        It never decides alone: you still confirm.
      </p>
      <SwitchRow
        label="Use the on-device model"
        checked={on && model.kind !== 'unavailable'}
        disabled={model.kind === 'unavailable'}
        disabledReason="The model is not included in this build."
        onChange={actions.toggleModel}
      />
      <div className="px-2">{status}</div>
    </>
  );
}

export function OptionsView(props: OptionsViewProps) {
  const { settings, ignore, actions } = props;
  const none = ignore.names.length === 0 && ignore.numbers.length === 0;
  const inv = props.inventory;

  return (
    <div className="mx-auto min-h-screen max-w-[920px] bg-bg px-4 py-8 text-text md:px-6 lg:grid lg:grid-cols-[168px_minmax(0,1fr)] lg:gap-10 lg:px-8">
      <nav aria-label="On this page" className="hidden lg:block">
        <ul className="sticky top-8 flex flex-col gap-0.5">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="block rounded-sm px-2 py-1 text-label text-text-muted transition-colors duration-100 hover:bg-surface-3 hover:text-text"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <main className="flex max-w-[720px] flex-col gap-8">
        <header className="flex flex-col gap-1">
          <h1 className="font-display text-h1 font-semibold tracking-[-0.02em] [font-variation-settings:'wdth'_106]">
            Readback options
          </h1>
          <p className="text-ui text-text-muted">
            Everything here is stored on this device. Readback has no account and makes no network
            requests.
          </p>
        </header>

        <Panel id="guards" title="Checks">
          {GUARD_KEYS.map((guard) => (
            <SwitchRow
              key={guard}
              label={GUARD_COPY[guard].label}
              hint={
                <>
                  {GUARD_COPY[guard].hint} <Mono>{GUARD_COPY[guard].example}</Mono>
                </>
              }
              checked={settings.guards[guard]}
              onChange={(on) => {
                actions.toggleGuard(guard, on);
              }}
            />
          ))}
        </Panel>

        <Panel id="ignored" title="Ignored words">
          {none ? (
            <p className="px-2 text-ui text-text-muted">
              Nothing ignored yet. Choose {'“'}Never flag{'”'} on any squiggle to add a word here.
            </p>
          ) : (
            <>
              <IgnoreRows kind="names" entries={ignore.names} onRemove={actions.removeIgnored} />
              <IgnoreRows
                kind="numbers"
                entries={ignore.numbers}
                onRemove={actions.removeIgnored}
              />
            </>
          )}
        </Panel>

        <Panel id="model" title="Looks-answered model">
          <ModelPanel settings={settings} model={props.model} actions={actions} />
        </Panel>

        <Panel id="appearance" title="Appearance">
          <div role="radiogroup" aria-label="Theme" className="flex gap-2 px-2">
            {THEMES.map((theme) => (
              <button
                key={theme}
                type="button"
                role="radio"
                aria-checked={settings.theme === theme}
                onClick={() => {
                  actions.setTheme(theme);
                }}
                className={`h-7 rounded-sm border px-3 text-label capitalize transition-colors duration-100 ${
                  settings.theme === theme
                    ? 'border-brass bg-brass-soft text-brass-text'
                    : 'border-border bg-surface-2 text-text-muted hover:bg-surface-3'
                }`}
              >
                {theme}
              </button>
            ))}
          </div>
          <p className="px-2 text-caption text-text-muted">
            On Gmail, the overlay follows Gmail’s own light or dark theme, not this setting.
          </p>
        </Panel>

        <Panel id="data" title="Your data">
          <p className="px-2 text-ui text-text-muted">
            Your settings and the words you chose to ignore live in this browser on this device.
            Choices you make about a reply (dismissed asks, ignored slips) are kept for this browser
            session only, as hashed ids with no message text. Mail text is never stored.
          </p>
          <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 rounded-md border border-border bg-surface px-3 py-2 text-ui tabular">
            <dt className="text-text-muted">Settings saved</dt>
            <dd className="text-right">{inv ? (inv.settings ? 'Yes' : 'No') : '—'}</dd>
            <dt className="text-text-muted">Ignored names</dt>
            <dd className="text-right">{inv ? inv.ignoredNames : '—'}</dd>
            <dt className="text-text-muted">Ignored numbers</dt>
            <dd className="text-right">{inv ? inv.ignoredNumbers : '—'}</dd>
            <dt className="text-text-muted">Replies remembered this session</dt>
            <dd className="text-right">{inv ? inv.threads : '—'}</dd>
          </dl>
          <div className="px-2 pt-1">
            <SecondaryButton onClick={actions.clearAll}>Clear all</SecondaryButton>
          </div>
        </Panel>

        <Panel id="shortcuts" title="Shortcuts">
          <ul className="flex flex-col">
            {(
              [
                ['Open Readback', ['Alt', 'Shift', 'R']],
                ['Open the next slip in a reply', ['Alt', 'Shift', 'J']],
                ['Open the ask ledger', ['Alt', 'Shift', 'L']],
                ['Apply the fix in a card', ['↵']],
                ['Apply the second fix', ['Shift', '↵']],
                ['Ignore a slip in this reply', ['I']],
                ['Close a card or the ledger', ['Esc']],
                ['Command palette (this page)', ['Ctrl', 'K']],
              ] as const
            ).map(([label, keys]) => (
              <li key={label} className="flex h-8 items-center justify-between rounded-sm px-2">
                <span className="text-ui">{label}</span>
                <Shortcut keys={keys} />
              </li>
            ))}
          </ul>
          <p className="px-2 text-caption text-text-muted">
            The first three are browser shortcuts. Change them at{' '}
            <Mono>chrome://extensions/shortcuts</Mono>.
          </p>
        </Panel>

        <Panel id="privacy" title="Check the network">
          <p className="px-2 text-ui text-text-muted">
            Readback adds no requests. Check it yourself:
          </p>
          <ol className="flex list-decimal flex-col gap-1 pl-8 pr-2 text-ui marker:text-text-subtle">
            <li>Open Gmail, press F12 and choose the Network tab.</li>
            <li>Type a reply with a slip in it, then hover the squiggle.</li>
            <li>
              Readback’s count of requests is 0. Mail text stays in the page and never reaches
              storage.
            </li>
          </ol>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 px-2 text-ui">
            <dt className="text-text-muted">Sites it can read</dt>
            <dd>
              {props.hostPermissions.length === 0 ? (
                <span className="text-text-muted">None</span>
              ) : (
                props.hostPermissions.map((h) => (
                  <span key={h} className="mr-3">
                    <Mono>{h}</Mono>
                  </span>
                ))
              )}
            </dd>
            <dt className="text-text-muted">Other sites</dt>
            <dd>
              Only after you choose {'“'}Use as Readback context{'”'} on selected text.
            </dd>
          </dl>
        </Panel>
      </main>

      {props.clearedToast ? (
        <div
          role="status"
          className="fixed bottom-4 left-4 z-40 flex items-center gap-3 rounded-lg bg-surface-2 py-2 pl-4 pr-2 text-ui shadow-e4"
        >
          <span>Cleared.</span>
          <button
            type="button"
            onClick={actions.undoClear}
            className="inline-flex h-7 items-center gap-2 rounded-sm px-2 text-label text-brass-text hover:bg-surface-3"
          >
            <UndoIcon />
            Undo
            <Shortcut keys={['Ctrl', 'Z']} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

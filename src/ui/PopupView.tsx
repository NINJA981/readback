/**
 * The popup, 360 x 480 (DESIGN.md §Popup). A function of its props: the page
 * entry (src/entrypoints/popup) feeds it live data, the screenshot gallery
 * feeds it fixtures. Mona Sans only (Three Hubots Rule), one brass-filled
 * button at most, no scroll for the primary task.
 */
import type { ReactNode } from 'react';
import type { Settings } from '../engine/types';
import type { SlipSummary } from '../messaging/protocol';
import { contextChipLabel } from '../adapters/generic/selection';
import { GUARD_KEYS, isSiteEnabled } from '../state/settings';
import type { Guard } from '../state/settings';
import { popupScreen } from '../state/popup-state';
import type { PopupScreen } from '../state/popup-state';
import { LAYOUT_NOT_RECOGNISED } from '../state/status-text';
import type { TabStatus } from '../storage/tab-status';
import { AskRing, CheckIcon, CircleAlertIcon } from '../overlay/ui/icons';
import {
  GhostButton,
  PrimaryButton,
  SecondaryButton,
  Shortcut,
  SwitchRow,
  SwitchTrack,
} from './controls';

export const GUARD_COPY: Record<Guard, { label: string; example: string }> = {
  name: { label: 'Names', example: 'Catherine → Kathryn' },
  number: { label: 'Numbers', example: '$1,520 → $1,250' },
  date: { label: 'Dates', example: 'Thu 10th → Tue 10th' },
  asks: { label: 'Ask pill', example: '3 asks · 1 open' },
};

export interface PopupActions {
  toggleSite: (on: boolean) => void;
  toggleGuard: (guard: Guard, on: boolean) => void;
  openOptions: () => void;
  openPlayground: () => void;
  openGmail: () => void;
  openPrivacy: () => void;
  openLedger: () => void;
  openSlip: () => void;
  clearContext: () => void;
  copyDiagnostics: () => void;
}

export interface PopupViewProps {
  settings: Settings;
  /** Host of the active tab, e.g. mail.google.com; undefined on non-web pages. */
  host: string | undefined;
  url: string | undefined;
  status: TabStatus | undefined;
  slips: SlipSummary[];
  /** The cached status is stale and the tab is being asked again. */
  checking: boolean;
  /** Whether a playground exists to link to (set per build, see src/platform/links.ts). */
  playground: boolean;
  diagnosticsCopied: boolean;
  actions: PopupActions;
}

const quote = (s: string): string => `“${s}”`;

function Row({
  icon,
  children,
  onClick,
  label,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  label?: string;
}) {
  const body = (
    <>
      <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
    </>
  );
  const cls = 'flex h-8 w-full items-center gap-2 rounded-sm px-2 text-ui';
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`${cls} transition-colors duration-100 hover:bg-surface-3`}
    >
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function ReadingBlock({
  status,
  slips,
  actions,
}: Pick<PopupViewProps, 'status' | 'slips' | 'actions'>) {
  const s = status;
  if (!s) return null;
  const first = slips[0];
  return (
    <>
      <h2 className="px-2 text-h3 font-[550] tracking-[-0.01em]">Reading this reply</h2>
      <ul className="mt-1 flex flex-col">
        <li>
          {s.asks === 0 ? (
            <Row icon={<CheckIcon className="text-text-subtle" />}>
              <span className="text-text-muted">No asks in the last message</span>
            </Row>
          ) : (
            <Row
              icon={
                s.open === 0 ? (
                  <CheckIcon className="text-success" />
                ) : (
                  <span className="text-brass-text">
                    <AskRing />
                  </span>
                )
              }
              onClick={actions.openLedger}
              label="Open the ask ledger"
            >
              <span className={`tabular ${s.open === 0 ? 'text-success' : 'text-brass-text'}`}>
                {s.open === 0 ? 'All covered' : `${plural(s.asks, 'ask', 'asks')} · ${s.open} open`}
              </span>
            </Row>
          )}
        </li>
        <li>
          {s.slips === 0 ? (
            <Row icon={<CheckIcon className="text-text-subtle" />}>
              <span className="text-text-muted">No slips against this thread</span>
            </Row>
          ) : (
            <Row
              icon={<CircleAlertIcon className="text-danger" />}
              onClick={actions.openSlip}
              label="Open the next slip"
            >
              <span className="tabular">{plural(s.slips, 'slip', 'slips')}</span>
              {first ? (
                <>
                  <span className="text-text-muted">: {quote(first.found)} → </span>
                  <span className="font-mono text-label">{first.expected}</span>
                </>
              ) : null}
            </Row>
          )}
        </li>
      </ul>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-2 text-caption text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Shortcut keys={['Alt', 'Shift', 'J']} /> next slip
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Shortcut keys={['Alt', 'Shift', 'L']} /> ledger
        </span>
      </p>
    </>
  );
}

function StatusBlock(props: PopupViewProps & { siteOn: boolean }) {
  const { actions, host, status, checking } = props;
  const screen: PopupScreen = popupScreen(status, props.siteOn, props.url);

  if (checking) {
    // One line, same height as the status it replaces, after the caller's 150 ms delay.
    return (
      <div className="px-2 py-1" aria-busy="true" aria-live="polite">
        <div className="h-6 w-44 animate-pulse rounded-xs bg-surface-3" />
        <span className="sr-only">Checking this tab</span>
      </div>
    );
  }

  switch (screen) {
    case 'reading':
      return <ReadingBlock status={status} slips={props.slips} actions={actions} />;
    case 'selection':
      return (
        <div className="flex flex-col gap-1">
          <h2 className="px-2 text-h3 font-[550] tracking-[-0.01em]">Using your selection</h2>
          <p className="px-2 text-ui text-text-muted tabular">
            {contextChipLabel(status?.contextWords ?? 0)}
          </p>
          <div className="px-2 pt-1">
            <SecondaryButton onClick={actions.clearContext}>Clear context</SecondaryButton>
          </div>
        </div>
      );
    case 'layout-error':
      return (
        <div className="flex flex-col gap-2 px-2">
          <div className="flex items-start gap-2">
            <CircleAlertIcon className="mt-0.5 shrink-0 text-danger" />
            <h2 className="text-h3 font-[550] tracking-[-0.01em]">
              Gmail’s layout wasn’t recognised, so Readback is staying out of the way.
            </h2>
          </div>
          <p className="text-ui text-text-muted">
            Select the message and choose {quote('Use as Readback context')}.
          </p>
          <div>
            <SecondaryButton onClick={actions.copyDiagnostics}>
              {props.diagnosticsCopied ? 'Copied' : 'Copy diagnostics'}
            </SecondaryButton>
          </div>
          <span className="sr-only">{LAYOUT_NOT_RECOGNISED}</span>
        </div>
      );
    case 'off':
      return (
        <div className="flex flex-col gap-1 px-2">
          <h2 className="text-h3 font-[550] tracking-[-0.01em]">
            Readback is off{host ? ` on ${host}` : ''}.
          </h2>
          <p className="text-ui text-text-muted">
            Turn the switch above back on to check replies here.
          </p>
        </div>
      );
    case 'idle-mail':
      return (
        <div className="flex flex-col gap-1 px-2">
          <h2 className="text-h3 font-[550] tracking-[-0.01em]">No reply open</h2>
          <p className="text-ui text-text-muted">
            Open a reply in Gmail and Readback starts reading it against the message you’re
            answering.
          </p>
        </div>
      );
    case 'idle':
      return (
        <div className="flex flex-col gap-3 px-2">
          <p className="text-ui text-text-muted">
            Readback checks your reply against the message you’re answering.
          </p>
          {props.playground ? (
            <div>
              <PrimaryButton onClick={actions.openPlayground}>Open the playground</PrimaryButton>
            </div>
          ) : (
            <div>
              <PrimaryButton onClick={actions.openGmail}>Open Gmail</PrimaryButton>
            </div>
          )}
          <p className="text-caption text-text-muted">
            On any site: select the message, right-click, choose {quote('Use as Readback context')}.
          </p>
        </div>
      );
  }
}

export function PopupView(props: PopupViewProps) {
  const { settings, host, actions } = props;
  const siteOn = props.url ? isSiteEnabled(settings, props.url) : true;
  const showSite = host !== undefined;

  return (
    <main className="flex h-[480px] w-[360px] flex-col bg-bg p-3 text-text">
      <header className="flex h-8 items-center justify-between gap-3 px-2">
        <h1 className="text-ui font-semibold">Readback</h1>
        {showSite ? (
          <button
            type="button"
            role="switch"
            aria-checked={siteOn}
            aria-label={`Check replies on ${host}`}
            onClick={() => {
              actions.toggleSite(!siteOn);
            }}
            className="flex h-7 items-center gap-2 rounded-sm pl-2 text-caption text-text-muted hover:bg-surface-3"
          >
            <span className="max-w-40 truncate">{host}</span>
            <SwitchTrack checked={siteOn} />
          </button>
        ) : null}
      </header>

      <div className="mt-2 min-h-33 py-1">
        <StatusBlock {...props} siteOn={siteOn} />
      </div>

      <section aria-labelledby="checks-heading" className="mt-auto border-t border-border pt-2">
        <h2 id="checks-heading" className="px-2 pb-1 text-label font-semibold text-text-muted">
          Checks
        </h2>
        {GUARD_KEYS.map((guard) => (
          <SwitchRow
            key={guard}
            label={GUARD_COPY[guard].label}
            hint={<span className="font-mono text-caption">{GUARD_COPY[guard].example}</span>}
            checked={settings.guards[guard]}
            onChange={(on) => {
              actions.toggleGuard(guard, on);
            }}
          />
        ))}
      </section>

      <footer className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
        <p className="px-2 text-caption text-text-muted">
          0 network requests. Readback never sends your mail anywhere.{' '}
          <button
            type="button"
            onClick={actions.openPrivacy}
            className="rounded-xs text-brass-text underline decoration-1 underline-offset-2 hover:text-brass-hover"
          >
            How to check
          </button>
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <GhostButton onClick={actions.openOptions}>Options</GhostButton>
            {props.playground ? (
              <GhostButton onClick={actions.openPlayground}>Playground</GhostButton>
            ) : null}
          </div>
          <span className="flex items-center gap-2 pr-2 text-caption text-text-muted">
            Open <Shortcut keys={['Alt', 'Shift', 'R']} />
          </span>
        </div>
      </footer>
    </main>
  );
}

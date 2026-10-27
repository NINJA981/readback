import { useEffect, useRef } from 'react';
import type * as Engine from '../shared/engine';
import { THEME_LABEL } from '../shared/theme';
import type { Theme } from '../shared/theme';
import { Icon } from './Icon';
import type { InstallState } from './hooks';

type Settings = Engine.Settings;
type IgnoreList = Engine.IgnoreList;

const GUARDS: readonly { key: keyof Settings['guards']; label: string; example: string }[] = [
  { key: 'name', label: 'Names', example: 'Catherine → Kathryn' },
  { key: 'number', label: 'Numbers', example: '$1,520 → $1,250' },
  { key: 'date', label: 'Dates', example: 'Thursday the 10th → the 12th' },
  { key: 'asks', label: 'Asks', example: '3 asks · 1 open' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  ignore: IgnoreList;
  theme: Theme;
  engineVersion: string;
  install: InstallState;
  canShare: boolean;
  hasText: boolean;
  onGuard: (key: keyof Settings['guards'], on: boolean) => void;
  onTheme: (t: Theme) => void;
  onRemoveIgnored: (kind: 'names' | 'numbers', entry: string) => void;
  onShare: () => void;
  onInstall: () => void;
  onClearAll: () => void;
}

export function SettingsDialog(p: Props): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (p.open && !d.open) d.showModal();
    if (!p.open && d.open) d.close();
  }, [p.open]);

  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const total = p.ignore.names.length + p.ignore.numbers.length;

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="settings-h"
      aria-modal="true"
      onClose={p.onClose}
      onClick={(e) => {
        if (e.target === ref.current) p.onClose();
      }}
    >
      <div className="dialog__body">
        <header className="dialog__head">
          <h2 className="t-h1" id="settings-h">
            Settings
          </h2>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            aria-label="Close settings"
            onClick={p.onClose}
          >
            <Icon name="x" />
          </button>
        </header>

        <section aria-labelledby="g-h">
          <h3 className="t-h3" id="g-h">
            Guards
          </h3>
          <ul className="rows">
            {GUARDS.map((g) => (
              <li key={g.key} className="row row--setting">
                <span className="row__text">
                  <span className="row__title" id={`gl-${g.key}`}>
                    {g.label}
                  </span>
                  <span className="t-mono subtle">{g.example}</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={p.settings.guards[g.key]}
                  aria-labelledby={`gl-${g.key}`}
                  className="switch-hit"
                  onClick={() => {
                    p.onGuard(g.key, !p.settings.guards[g.key]);
                  }}
                >
                  <span
                    className="switch"
                    aria-hidden="true"
                    data-on={p.settings.guards[g.key] ? '' : undefined}
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="t-h">
          <h3 className="t-h3" id="t-h">
            Theme
          </h3>
          <div
            className="segmented"
            role="radiogroup"
            aria-labelledby="t-h"
            onKeyDown={(e) => {
              // One Tab stop for the group; arrows move the choice and the focus together.
              const order = ['system', 'light', 'dark'] as const;
              const i = order.indexOf(p.theme);
              let next: number;
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % order.length;
              else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
                next = (i + order.length - 1) % order.length;
              else return;
              e.preventDefault();
              const target = order[next];
              if (target) p.onTheme(target);
              e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
            }}
          >
            {(['system', 'light', 'dark'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={p.theme === t}
                tabIndex={p.theme === t ? 0 : -1}
                className="seg"
                onClick={() => {
                  p.onTheme(t);
                }}
              >
                {THEME_LABEL[t]}
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="i-h">
          <h3 className="t-h3" id="i-h">
            Never flag
          </h3>
          {total === 0 ? (
            <p className="muted t-ui">
              Nothing ignored yet. Choose “Never flag” on any squiggle to add a word here.
            </p>
          ) : (
            <ul className="rows">
              {(['names', 'numbers'] as const).flatMap((kind) =>
                p.ignore[kind].map((entry) => (
                  <li key={`${kind}-${entry}`} className="row row--setting">
                    <span className="row__text">
                      <span className="row__title mono-inline">{entry}</span>
                      <span className="t-caption subtle">
                        {kind === 'names' ? 'Name' : 'Number'}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="btn btn--ghost btn--icon"
                      aria-label={`Stop ignoring ${entry}`}
                      onClick={() => {
                        p.onRemoveIgnored(kind, entry);
                      }}
                    >
                      <Icon name="x" />
                    </button>
                  </li>
                )),
              )}
            </ul>
          )}
        </section>

        <section aria-labelledby="a-h">
          <h3 className="t-h3" id="a-h">
            This app
          </h3>
          <div className="stack">
            {p.install.installed ? (
              <p className="muted t-ui">Installed. It opens like any app and works offline.</p>
            ) : p.install.available ? (
              <button type="button" className="btn btn--secondary" onClick={p.onInstall}>
                <Icon name="download" /> Install this app
              </button>
            ) : (
              <p className="muted t-ui">
                {ios
                  ? 'To install: tap Share, then Add to Home Screen.'
                  : 'To install: use your browser menu, then Install app or Add to Home screen.'}{' '}
                It works offline once this page has loaded.
              </p>
            )}
            {p.canShare && (
              <div>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={p.onShare}
                  disabled={!p.hasText}
                >
                  <Icon name="share-2" /> Copy share link
                </button>
                <p className="t-caption subtle share-note">
                  Your text goes into the part of the link after the #, which browsers never send to
                  a server. Only click this if you mean to share the text.
                </p>
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="d-h">
          <h3 className="t-h3" id="d-h">
            Your data
          </h3>
          <p className="muted t-ui">
            Settings and the words you chose to ignore stay in this browser’s local storage. The
            text boxes live in memory and this tab’s session storage. Nothing is uploaded.
          </p>
          <button type="button" className="btn btn--secondary" onClick={p.onClearAll}>
            <Icon name="trash-2" /> Clear all
          </button>
        </section>

        <p className="t-caption subtle">
          Engine {p.engineVersion}, the same code as the extension. Site {__SITE_VERSION__}.
        </p>
      </div>
    </dialog>
  );
}

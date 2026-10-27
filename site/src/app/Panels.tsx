import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type * as Engine from '../shared/engine';
import { snippet } from '../shared/snippet';
import { Icon } from './Icon';

type Eng = typeof Engine;

// ---- guard card ------------------------------------------------------------------

interface CardProps {
  eng: Eng;
  flag: Engine.Flag;
  sentAt: string | undefined;
  mode: 'sheet' | 'popover';
  pos: { left: number; top: number } | null;
  keyboardInset: number;
  /** Move focus into the card (keyboard-opened only). */
  focusIn: boolean;
  onFix: (index: number) => void;
  onIgnore: () => void;
  onNever: () => void;
  onClose: () => void;
}

export function GuardCard(p: CardProps): React.JSX.Element {
  const { flag } = p;
  const ref = useRef<HTMLDivElement>(null);
  const parts = snippet(flag.citation.line, flag.citation.text);
  const canNever = flag.guard !== 'date';

  useEffect(() => {
    if (p.focusIn) ref.current?.querySelector<HTMLElement>('[data-primary]')?.focus();
  }, [p.focusIn, flag.id]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') p.onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [p]);

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' && e.shiftKey && flag.fixes.length > 1) {
      e.preventDefault();
      p.onFix(1);
    } else if ((e.key === 'i' || e.key === 'I') && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      p.onIgnore();
    }
  };

  const style =
    p.mode === 'popover' && p.pos
      ? { left: p.pos.left, top: p.pos.top }
      : { '--kb': `${p.keyboardInset}px` };

  return (
    <div
      ref={ref}
      className={`gcard gcard--${p.mode}`}
      role="dialog"
      aria-labelledby="gcard-msg"
      style={style}
      onKeyDown={onKeyDown}
      data-open
    >
      <div className="gcard__msg">
        <Icon name="circle-alert" />
        <span id="gcard-msg">{flag.message}</span>
        {p.mode === 'sheet' && (
          <button
            type="button"
            className="btn btn--ghost btn--icon gcard__close"
            aria-label="Close"
            onClick={p.onClose}
          >
            <Icon name="x" />
          </button>
        )}
      </div>
      <div className="cite">
        {parts.before}
        {parts.token && <b>{parts.token}</b>}
        {parts.after}
        <span className="cite__src">{p.eng.citationSource(flag.citation, p.sentAt)}</span>
      </div>
      <div className="gcard__actions">
        {flag.fixes.map((f, i) => (
          <button
            key={f.label}
            type="button"
            className={`btn ${i === 0 ? 'btn--primary' : 'btn--secondary'} btn--compact`}
            data-primary={i === 0 ? '' : undefined}
            onClick={() => {
              p.onFix(i);
            }}
          >
            {f.label}
          </button>
        ))}
        <button type="button" className="btn btn--ghost btn--compact" onClick={p.onIgnore}>
          Ignore
        </button>
        {canNever && (
          <button type="button" className="btn btn--ghost btn--compact" onClick={p.onNever}>
            Never flag “{flag.found}”
          </button>
        )}
      </div>
      <p className="gcard__hint t-caption muted">
        <span className="keycap">↵</span> change <span className="keycap">I</span> ignore{' '}
        <span className="keycap">Esc</span> close
      </p>
    </div>
  );
}

// ---- slips and asks ---------------------------------------------------------------

interface SlipListProps {
  flags: readonly Engine.Flag[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onFix: (flag: Engine.Flag, index: number) => void;
}

export function SlipList({ flags, activeId, onOpen, onFix }: SlipListProps): React.JSX.Element {
  return (
    <section className="panel" aria-labelledby="slips-h">
      <h2 className="t-h3" id="slips-h">
        Slips
      </h2>
      {flags.length === 0 ? (
        <p className="muted t-ui" data-testid="no-slips">
          No slips against this thread.
        </p>
      ) : (
        <ul className="rows">
          {flags.map((f) => (
            <li key={f.id} className="row" data-active={f.id === activeId ? '' : undefined}>
              <button
                type="button"
                className="row__main"
                onClick={() => {
                  onOpen(f.id);
                }}
              >
                <span className="row__icon">
                  <Icon name="circle-alert" />
                </span>
                <span className="row__text">
                  <span className="row__title">
                    <span className="mono-inline found">{f.found}</span>
                    <span aria-hidden="true"> to </span>
                    <span className="sr-only"> should be </span>
                    <span className="mono-inline">{f.expected}</span>
                  </span>
                  <span className="t-caption muted">{f.message}</span>
                </span>
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--compact row__fix"
                onClick={() => {
                  onFix(f, 0);
                }}
              >
                Fix
              </button>
            </li>
          ))}
        </ul>
      )}
      {flags.length > 0 && (
        <p className="t-caption subtle slips-hint">
          <span className="keycap">J</span>
          <span className="keycap">K</span> next and previous slip
        </p>
      )}
    </section>
  );
}

interface LedgerProps {
  eng: Eng;
  asks: readonly Engine.Ask[];
  truncated: number;
  result: Engine.CheckResult;
  onAction: (a: {
    type: 'confirm-ask' | 'unconfirm-ask' | 'dismiss-ask' | 'restore-ask';
    id: string;
  }) => void;
}

export function AskLedger({
  eng,
  asks,
  truncated,
  result,
  onAction,
}: LedgerProps): React.JSX.Element {
  const shown = asks.filter((a) => a.state !== 'dismissed');
  const dismissed = asks.filter((a) => a.state === 'dismissed');
  const header = eng.ledgerHeader(result);
  const confirmed = eng.ledgerConfirmed(result);
  return (
    <section className="panel" id="ledger" aria-labelledby="asks-h" tabIndex={-1}>
      <h2 className="t-h3" id="asks-h">
        Asks in the last message
      </h2>
      {header && <p className={confirmed ? 't-ui success-text' : 't-ui muted'}>{header}</p>}
      {shown.length === 0 ? (
        <p className="muted t-caption">Readback only lists direct questions and requests.</p>
      ) : (
        <ul className="rows">
          {shown.map((a) => (
            <li key={a.id} className="row" data-state={a.state}>
              <span className="row__icon" aria-hidden="true">
                {a.state === 'answered' ? (
                  <Icon name="check" />
                ) : (
                  <span
                    className="ring"
                    data-dotted={a.state === 'looks-answered' ? '' : undefined}
                  />
                )}
              </span>
              <span className="row__text">
                <span className="row__title">{a.text}</span>
                <span className="t-caption muted">
                  {a.state === 'open' && 'Open'}
                  {a.state === 'looks-answered' && 'Looks answered'}
                  {a.state === 'answered' && 'Answered'}
                </span>
              </span>
              <span className="row__actions">
                {a.state === 'answered' && a.evidence?.kind === 'user' ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon btn--compact"
                    aria-label={`Undo confirm: ${a.text}`}
                    onClick={() => {
                      onAction({ type: 'unconfirm-ask', id: a.id });
                    }}
                  >
                    <Icon name="undo-2" />
                  </button>
                ) : a.state === 'answered' ? null : (
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon btn--compact"
                    aria-label={`Confirm answered: ${a.text}`}
                    onClick={() => {
                      onAction({ type: 'confirm-ask', id: a.id });
                    }}
                  >
                    <Icon name="check" />
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--ghost btn--icon btn--compact"
                  aria-label={`Dismiss: ${a.text}`}
                  onClick={() => {
                    onAction({ type: 'dismiss-ask', id: a.id });
                  }}
                >
                  <Icon name="x" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {truncated > 0 && <p className="t-caption subtle">{eng.overflowLabel(truncated)}</p>}
      {dismissed.length > 0 && (
        <p className="t-caption subtle">
          {dismissed.length} dismissed.{' '}
          <button
            type="button"
            className="linklike"
            onClick={() => {
              for (const a of dismissed) onAction({ type: 'restore-ask', id: a.id });
            }}
          >
            Restore
          </button>
        </p>
      )}
    </section>
  );
}

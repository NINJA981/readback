/**
 * The ledger (DESIGN.md "Ledger"): a popover from the pill listing up to five
 * asks and every slip. It is also the keyboard-accessible list behind every
 * squiggle (the No Orphan Red Rule). Rows are 32px; their actions show on
 * hover and focus, and stay visible on touch.
 */
import { useEffect, useRef } from 'react';
import type { LedgerModel } from '../model';
import type { OverlayActions } from '../types';
import { AskRing, CheckIcon, CircleAlertIcon, ReplyIcon, UndoIcon, XIcon } from './icons';
import { Keycap, trapTab } from './parts';

export interface LedgerProps {
  id: string;
  model: LedgerModel;
  actions: Pick<
    OverlayActions,
    | 'closeLedger'
    | 'confirmAsk'
    | 'dismissAsk'
    | 'restoreDismissed'
    | 'answerInline'
    | 'jumpToSlip'
    | 'fix'
  >;
  /** Focus the first control on open (keyboard open); pointer opens leave focus in the editor. */
  autoFocus: boolean;
  open: boolean;
}

function StateIcon({ state }: { state: LedgerModel['asks'][number]['state'] }) {
  if (state === 'answered') {
    return (
      <span className="rb-row-icon" data-state="answered">
        <CheckIcon />
      </span>
    );
  }
  return (
    <span className="rb-row-icon" data-state={state}>
      <AskRing dotted={state === 'looks-answered'} />
    </span>
  );
}

export function Ledger({ id, model, actions, autoFocus, open }: LedgerProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!autoFocus || !open) return;
    const first = ref.current?.querySelector<HTMLElement>('button');
    (first ?? ref.current)?.focus({ preventScroll: true });
  }, [autoFocus, open]);

  const keep = (e: React.MouseEvent): void => {
    e.preventDefault();
  };

  return (
    <div
      ref={ref}
      id={id}
      className="rb-ledger"
      data-state={open ? 'open' : 'closing'}
      role="dialog"
      aria-label="Asks and slips"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          actions.closeLedger();
        }
        trapTab(e, ref.current);
      }}
    >
      {model.empty ? (
        <div className="rb-ledger-empty">
          <p className="rb-ledger-title">{model.header}</p>
          <p className="rb-caption">{model.emptyHint}</p>
        </div>
      ) : null}

      {model.asks.length > 0 ? (
        <section aria-labelledby={`${id}-asks`}>
          <h3 className="rb-ledger-h" id={`${id}-asks`}>
            Asks
          </h3>
          {model.header ? <p className="rb-ledger-title rb-ledger-ok">{model.header}</p> : null}
          <ul className="rb-rows">
            {model.asks.map((ask) => (
              <li className="rb-row" key={ask.id} data-state={ask.state}>
                <StateIcon state={ask.state} />
                <span className="rb-row-text" title={ask.text}>
                  <span className="rb-sr">{ask.stateLabel}: </span>
                  {ask.text}
                </span>
                <span className="rb-row-actions">
                  {ask.canConfirm ? (
                    <button
                      type="button"
                      className="rb-icon-btn"
                      aria-label={`Mark as answered: ${ask.text}`}
                      title="Mark as answered"
                      onMouseDown={keep}
                      onClick={() => {
                        actions.confirmAsk(ask.id);
                      }}
                    >
                      <CheckIcon />
                    </button>
                  ) : null}
                  {ask.canAnswerInline ? (
                    <button
                      type="button"
                      className="rb-icon-btn"
                      aria-label={`Answer inline: ${ask.text}`}
                      title="Answer inline"
                      onMouseDown={keep}
                      onClick={() => {
                        actions.answerInline(ask.id);
                      }}
                    >
                      <ReplyIcon />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rb-icon-btn"
                    aria-label={`Dismiss: ${ask.text}`}
                    title="Dismiss"
                    onMouseDown={keep}
                    onClick={() => {
                      actions.dismissAsk(ask.id);
                    }}
                  >
                    <XIcon />
                  </button>
                </span>
              </li>
            ))}
          </ul>
          {model.overflow ? <p className="rb-caption rb-ledger-note">{model.overflow}</p> : null}
        </section>
      ) : null}

      {model.slips.length > 0 ? (
        <section aria-labelledby={`${id}-slips`}>
          <h3 className="rb-ledger-h" id={`${id}-slips`}>
            Slips
          </h3>
          <ul className="rb-rows">
            {model.slips.map((slip) => (
              <li className="rb-row" key={slip.id} data-state="slip">
                <span className="rb-row-icon" data-state="slip">
                  <CircleAlertIcon />
                </span>
                <button
                  type="button"
                  className="rb-row-text rb-row-link"
                  title={slip.message}
                  onMouseDown={keep}
                  onClick={() => {
                    actions.jumpToSlip(slip.id);
                  }}
                >
                  <span className="rb-mono rb-strike">{slip.found}</span>
                  <span aria-hidden="true"> → </span>
                  <span className="rb-sr"> to </span>
                  <span className="rb-mono">{slip.expected}</span>
                </button>
                <span className="rb-row-actions rb-row-actions-always">
                  <button
                    type="button"
                    className="rb-btn rb-btn-secondary rb-btn-sm"
                    aria-label={`Fix: change ${slip.found} to ${slip.expected}`}
                    onMouseDown={keep}
                    onClick={() => {
                      actions.fix(slip.id, 0);
                    }}
                  >
                    Fix
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {model.dismissed > 0 ? (
        <button
          type="button"
          className="rb-btn rb-btn-ghost rb-btn-sm rb-restore"
          onMouseDown={keep}
          onClick={actions.restoreDismissed}
        >
          <UndoIcon />
          Restore {model.dismissed} dismissed
        </button>
      ) : null}

      <p className="rb-ledger-foot rb-caption" aria-hidden="true">
        <Keycap>Esc</Keycap> close
      </p>
    </div>
  );
}

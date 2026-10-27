/**
 * Root of the overlay inside Readback's shadow root. Props-driven: it reads a
 * compose session and a small UI store and calls actions. It knows nothing
 * about Gmail, the DOM of the host page or the extension APIs, so the popup
 * gallery and the playground render the very same components.
 */
import { useId, useSyncExternalStore } from 'react';
import type { ComposeSession } from '../../state/session';
import type { Store } from '../../state/store';
import { cardModel, ledgerModel } from '../model';
import type { OverlayActions, OverlayUi } from '../types';
import { GuardCard } from './GuardCard';
import { Ledger } from './Ledger';
import { Pill } from './Pill';
import { usePresence, useLastValue } from './parts';

export interface OverlayAppProps {
  session: ComposeSession;
  ui: Store<OverlayUi>;
  actions: OverlayActions;
  /** True when the ledger was opened with the keyboard, so focus moves into it. */
  ledgerFocus: () => boolean;
}

/** Pill height and the gap between the pill and the ledger above it. */
const PILL_H = 26;
const DOCK_INSET = 8;
const LEDGER_GAP = 6;

export function OverlayApp({ session, ui, actions, ledgerFocus }: OverlayAppProps) {
  const snap = useSyncExternalStore(
    (listener) => session.subscribe(listener),
    () => session.getSnapshot(),
  );
  const state = useSyncExternalStore(
    (listener) => ui.subscribe(listener),
    () => ui.getSnapshot(),
  );
  const ledgerId = useId();

  const flag = state.card ? snap.result.flags.find((f) => f.id === state.card?.flagId) : undefined;
  const cardPresent = Boolean(state.card && flag);
  const card = usePresence(cardPresent, 120);
  const lastCard = useLastValue(state.card);
  const lastFlag = useLastValue(flag);
  const ledger = usePresence(state.ledgerOpen, 120);

  const { dock, viewport } = state;
  const showPill = snap.pill.tone !== 'hidden' || snap.fixed !== undefined;
  const right = dock ? viewport.width - dock.right + DOCK_INSET : 0;
  const bottom = dock ? viewport.height - dock.bottom + DOCK_INSET : 0;

  const firstSlip = snap.result.flags[0];

  return (
    <div className="rb-root" data-theme={state.theme}>
      {showPill && dock ? (
        <div className="rb-dock" style={{ right, bottom }}>
          <Pill
            model={snap.pill}
            fixed={snap.fixed?.replacement}
            ledgerOpen={state.ledgerOpen}
            ledgerId={ledgerId}
            onToggle={actions.toggleLedger}
            onJumpToSlip={() => {
              if (firstSlip) actions.jumpToSlip(firstSlip.id);
            }}
          />
        </div>
      ) : null}

      {ledger.rendered && dock ? (
        <div
          className="rb-ledger-pos"
          style={{
            right,
            bottom: bottom + PILL_H + LEDGER_GAP,
            maxHeight: Math.max(160, dock.bottom - PILL_H - 2 * DOCK_INSET - LEDGER_GAP - 8),
          }}
        >
          <Ledger
            id={ledgerId}
            model={ledgerModel(snap)}
            actions={actions}
            autoFocus={ledgerFocus()}
            open={ledger.open}
          />
        </div>
      ) : null}

      {card.rendered && lastCard && lastFlag ? (
        <GuardCard
          model={cardModel(lastFlag, snap.context.sentAt)}
          state={lastCard}
          viewport={viewport}
          open={card.open}
          onFix={(index) => {
            actions.fix(lastFlag.id, index);
          }}
          onIgnore={() => {
            actions.ignore(lastFlag.id);
          }}
          onNeverFlag={() => {
            actions.neverFlag(lastFlag.id);
          }}
          onClose={actions.closeCard}
          onPointer={actions.cardPointer}
        />
      ) : null}
    </div>
  );
}

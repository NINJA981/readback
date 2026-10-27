/**
 * The ask pill (DESIGN.md "Ask pill"): one small object docked inside the
 * compose box. Brass while asks are open, success green once all are covered,
 * a slip segment when there are flags, and a six-second "Fixed" confirmation.
 *
 * Motion lives in exactly one place: the last open ask being covered rolls the
 * count 1 to 0, then the colour crosses over and the check draws. Counts change
 * at 0 ms while typing (the "never animate a keystroke" rule).
 */
import { useEffect, useId, useRef, useState } from 'react';
import { fixedLabel } from '../model';
import type { PillModel } from '../../state/summary';
import { AskRing, CheckIcon } from './icons';
import { prefersReducedMotion } from './parts';

export interface PillProps {
  model: PillModel;
  /** Corrected word while the six-second confirmation is showing. */
  fixed: string | undefined;
  ledgerOpen: boolean;
  ledgerId: string;
  onToggle: () => void;
  onJumpToSlip: () => void;
}

const ROLL_MS = 150;

/** A single digit that rolls from `from` to `to` inside a masked cell. */
function Roll({ from, to }: { from: number; to: number }) {
  const dir = to >= from ? 'up' : 'down';
  return (
    <span className="rb-roll" data-dir={dir} aria-hidden="true">
      <span className="rb-roll-out">{from}</span>
      <span className="rb-roll-in">{to}</span>
    </span>
  );
}

export function Pill({ model, fixed, ledgerOpen, ledgerId, onToggle, onJumpToSlip }: PillProps) {
  // Detect "the last open ask just got covered" while rendering, so the first
  // painted frame is already the roll and never a flash of "All covered".
  const [seen, setSeen] = useState({ tone: model.tone, open: model.open });
  const [rolling, setRolling] = useState<{ from: number } | undefined>();
  if (seen.tone !== model.tone || seen.open !== model.open) {
    setSeen({ tone: model.tone, open: model.open });
    if (
      seen.tone === 'open' &&
      model.tone === 'covered' &&
      seen.open > 0 &&
      !prefersReducedMotion()
    ) {
      setRolling({ from: seen.open });
    }
  }
  useEffect(() => {
    if (!rolling) return undefined;
    const id = setTimeout(() => {
      setRolling(undefined);
    }, ROLL_MS);
    return () => {
      clearTimeout(id);
    };
  }, [rolling]);

  const announce = useThrottled(model.announcement, 2000);
  const regionId = useId();

  const hasAsks = model.total > 0;
  const covered = model.tone === 'covered' && !rolling;
  const tone = fixed ? 'covered' : covered ? 'covered' : 'open';

  // The label remounts (and so crossfades) only when its mode changes: into and out of the
  // six-second "Fixed" line, and when the last-ask roll hands over. A count that changes while
  // the user types swaps in place at 0 ms ("never animate a keystroke").
  let label: React.ReactNode;
  let labelKey: string;
  if (fixed) {
    label = fixedLabel(fixed);
    labelKey = 'fixed';
  } else if (rolling) {
    label = (
      <>
        {model.total} {model.total === 1 ? 'ask' : 'asks'} · <Roll from={rolling.from} to={0} />{' '}
        open
      </>
    );
    labelKey = 'rolling';
  } else {
    label = model.label;
    labelKey = 'count';
  }
  const reserve = fixed ? [] : reservedLabels(model.total);

  return (
    <>
      <div className="rb-pill" data-tone={tone} role="group" aria-label="Readback">
        {hasAsks || fixed ? (
          <button
            type="button"
            className="rb-pill-main"
            aria-expanded={ledgerOpen}
            aria-controls={ledgerOpen ? ledgerId : undefined}
            aria-haspopup="dialog"
            onClick={onToggle}
            onMouseDown={(e) => {
              e.preventDefault();
            }}
          >
            <span className="rb-pill-icon">
              {tone === 'covered' ? (
                <CheckIcon draw={!fixed} />
              ) : (
                <AskRing dotted={!fixed && model.dotted} />
              )}
            </span>
            <span className="rb-pill-text">
              <span className="rb-pill-label" key={labelKey}>
                {label}
              </span>
              {reserve.map((text) => (
                <span className="rb-pill-reserve" aria-hidden="true" key={text}>
                  {text}
                </span>
              ))}
            </span>
          </button>
        ) : null}
        {model.slips > 0 ? (
          <>
            {hasAsks || fixed ? <span className="rb-pill-sep" aria-hidden="true" /> : null}
            <button
              type="button"
              className="rb-pill-slip"
              onClick={onJumpToSlip}
              onMouseDown={(e) => {
                e.preventDefault();
              }}
            >
              <span className="rb-pill-dot" aria-hidden="true" />
              {model.slipLabel}
            </button>
          </>
        ) : null}
      </div>
      <div className="rb-sr" role="status" aria-live="polite" id={regionId}>
        {announce}
      </div>
    </>
  );
}

/**
 * Every count label the pill can show for `total` asks, stacked invisibly under the visible one
 * so the pill is exactly as wide as its widest state: no layout shift when it flips, and no
 * dead space after the text (figures are tabular, so one digit stands for all).
 */
export function reservedLabels(total: number): string[] {
  if (total === 0) return [];
  const asks = total === 1 ? 'ask' : 'asks';
  return [
    `${total} ${asks} · ${total} open`,
    `${total} look answered`,
    '1 looks answered',
    'All covered',
  ];
}

/** Passes `value` through at most once per `ms`, so screen readers are not flooded. */
function useThrottled(value: string, ms: number): string {
  // Starts empty so the first state is announced as a change, not read at load.
  const [shown, setShown] = useState('');
  const last = useRef(0);
  useEffect(() => {
    if (value === shown) return undefined;
    const wait = Math.max(0, last.current + ms - Date.now());
    const id = setTimeout(() => {
      last.current = Date.now();
      setShown(value);
    }, wait);
    return () => {
      clearTimeout(id);
    };
  }, [value, shown, ms]);
  return shown;
}

/**
 * Overlay scenes: the real `OverlayApp` over a mock compose editor, driven by a
 * real compose session on the synthetic "Sample thread". The host page's theme
 * is independent of the gallery's (as in Gmail): the overlay follows the host.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import { createComposeSession, createContext, createStore } from '../src/core/index';
import type { ComposeSession, ContextInput } from '../src/core/index';
import { ContextChip } from '../src/overlay/chip';
import { INITIAL_UI } from '../src/overlay/types';
import type { OverlayActions, OverlayUi } from '../src/overlay/types';
import { OverlayApp } from '../src/overlay/ui/OverlayApp';
import { DEPOSIT_DRAFT_SLIPS, DEPOSIT_INPUT } from '../tests/fixtures/samples';

type Host = 'light' | 'dark';

export const OVERLAY_SCENES = [
  'overlay:pill',
  'overlay:card-name',
  'overlay:card-number',
  'overlay:card-date',
  'overlay:card-notice',
  'overlay:card-above',
  'overlay:ledger',
  'overlay:ledger-covered',
  'overlay:ledger-empty',
  'overlay:ledger-overflow',
  'overlay:chip',
];

const noop = (): void => undefined;
const actions: OverlayActions = {
  fix: noop,
  ignore: noop,
  neverFlag: noop,
  closeCard: noop,
  cardPointer: noop,
  toggleLedger: noop,
  closeLedger: noop,
  confirmAsk: noop,
  dismissAsk: noop,
  restoreDismissed: noop,
  answerInline: noop,
  jumpToSlip: noop,
};

interface FrameProps {
  label: string;
  host: Host;
  input?: ContextInput;
  draft: string;
  width?: number;
  height?: number;
  prepare?: (s: ComposeSession) => void;
  /** Which flag the card is open on, and how. */
  card?: { flag: number; via?: 'hover' | 'keyboard'; notice?: 'copied' | 'failed'; fix?: number };
  ledger?: boolean;
  fixed?: string;
}

/** Splits the draft around the current flags so each slip can be a measurable span. */
function segments(session: ComposeSession): { text: string; flag?: string }[] {
  const { draft, result } = session.getSnapshot();
  const out: { text: string; flag?: string }[] = [];
  let at = 0;
  for (const f of [...result.flags].sort((a, b) => a.draftSpan.start - b.draftSpan.start)) {
    out.push({ text: draft.slice(at, f.draftSpan.start) });
    out.push({ text: draft.slice(f.draftSpan.start, f.draftSpan.end), flag: f.id });
    at = f.draftSpan.end;
  }
  out.push({ text: draft.slice(at) });
  return out;
}

function Frame(props: FrameProps) {
  const { host, width = 560, height = 300 } = props;
  const frame = useRef<HTMLDivElement>(null);
  const editor = useRef<HTMLDivElement>(null);

  const session = useMemo(() => {
    const s = createComposeSession({
      context: createContext(props.input ?? DEPOSIT_INPUT),
      today: new Date('2026-11-02T09:00:00Z'),
    });
    s.setDraft(props.draft);
    props.prepare?.(s);
    if (props.fixed) s.markFixed(props.fixed);
    return s;
    // The gallery renders each frame once.
  }, []);
  const ui = useMemo(() => createStore<OverlayUi>({ ...INITIAL_UI, theme: host }), [host]);

  useLayoutEffect(() => {
    const f = frame.current?.getBoundingClientRect();
    const e = editor.current?.getBoundingClientRect();
    if (!f || !e) return;
    const rel = (r: DOMRect) => ({
      left: r.left - f.left,
      top: r.top - f.top,
      right: r.right - f.left,
      bottom: r.bottom - f.top,
    });
    const flags = session.getSnapshot().result.flags;
    const wanted = props.card ? flags[props.card.flag] : undefined;
    const span = wanted ? frame.current?.querySelector(`[data-flag="${wanted.id}"]`) : null;
    ui.setState({
      ...ui.getSnapshot(),
      theme: host,
      viewport: { width, height },
      dock: rel(e),
      ledgerOpen: props.ledger ?? false,
      card:
        wanted && span && props.card
          ? {
              flagId: wanted.id,
              via: props.card.via ?? 'hover',
              anchor: rel(span.getBoundingClientRect()),
              ...(props.card.notice
                ? {
                    notice: {
                      kind: props.card.notice,
                      replacement: wanted.fixes[0]?.replacement ?? '',
                      fixIndex: props.card.fix ?? 0,
                    },
                  }
                : {}),
            }
          : undefined,
    });
  }, [host, height, width, props.card, props.ledger, session, ui]);

  const activeId = props.card ? session.getSnapshot().result.flags[props.card.flag]?.id : undefined;

  return (
    <figure style={{ margin: 0 }}>
      <figcaption className="frame-label">{props.label}</figcaption>
      <div className="frame" ref={frame} style={{ width, height }}>
        <div className="host" data-host={host}>
          <div className="editor" ref={editor}>
            {segments(session).map((seg, i) =>
              seg.flag ? (
                <span
                  key={i}
                  className="sq"
                  data-flag={seg.flag}
                  data-active={seg.flag === activeId}
                >
                  {seg.text}
                </span>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </div>
        </div>
        <OverlayApp
          session={session}
          ui={ui}
          actions={actions}
          ledgerFocus={() => props.card?.via === 'keyboard' || Boolean(props.ledger)}
        />
      </div>
    </figure>
  );
}

const NO_ASKS: ContextInput = {
  ...DEPOSIT_INPUT,
  threadId: 'sample:no-asks',
  message:
    'Hi Sam,\n\nThe flat at 14 Larchmont Road is yours from the 1st. The deposit is $1,250.\n\nThanks,\nKathryn',
};

const MANY_ASKS: ContextInput = {
  ...DEPOSIT_INPUT,
  threadId: 'sample:many-asks',
  message:
    'Hi Sam,\n\nCan you confirm the $1,250 deposit? Could you drop off the keys on Thursday the 12th? Will you send the signed lease back? Can you share your bank details? Could you tell me the move-in time? Would you send the insurance certificate? Can you confirm the number of keys? Please send the utility account numbers.\n\nThanks,\nKathryn',
};

const DATE_DRAFT =
  "Hi Kathryn,\n\nThe $1,250 deposit is confirmed, and I'll drop the keys off Thursday the 10th.\n\nSam";

const confirmAll = (s: ComposeSession): void => {
  for (const a of s.getSnapshot().result.asks) s.dispatch({ type: 'confirm-ask', id: a.id });
};

export function OverlayScenes({ name, theme }: { name: string; theme: Host }) {
  const h = theme;
  const frames = (() => {
    switch (name) {
      case 'pill':
        return [
          <Frame key="a" label="Open asks" host={h} draft="Hi Kathryn," height={140} />,
          <Frame
            key="b"
            label="Open asks and slips"
            host={h}
            draft={DEPOSIT_DRAFT_SLIPS}
            height={140}
          />,
          <Frame
            key="c"
            label="All covered"
            host={h}
            draft="Hi Kathryn,"
            prepare={confirmAll}
            height={140}
          />,
          <Frame
            key="d"
            label="Fixed, for six seconds"
            host={h}
            draft="Hi Kathryn,"
            fixed="Kathryn"
            height={140}
          />,
          <Frame
            key="e"
            label="Slips only (no asks in the message)"
            host={h}
            input={NO_ASKS}
            draft="Hi Catherine,"
            height={140}
          />,
        ];
      case 'card-name':
        return [
          <Frame
            key="a"
            label="Name guard"
            host={h}
            draft={DEPOSIT_DRAFT_SLIPS}
            card={{ flag: 0 }}
            height={390}
          />,
        ];
      case 'card-number':
        return [
          <Frame
            key="a"
            label="Number guard"
            host={h}
            draft={DEPOSIT_DRAFT_SLIPS}
            card={{ flag: 1 }}
            height={390}
          />,
        ];
      case 'card-date':
        return [
          <Frame
            key="a"
            label="Date guard, two fixes"
            host={h}
            draft={DATE_DRAFT}
            card={{ flag: 0, via: 'keyboard' }}
            height={470}
          />,
        ];
      case 'card-notice':
        return [
          <Frame
            key="a"
            label="Host refused the edit, replacement copied"
            host={h}
            draft={DEPOSIT_DRAFT_SLIPS}
            card={{ flag: 0, notice: 'copied' }}
            height={450}
          />,
          <Frame
            key="b"
            label="Host refused, clipboard unavailable"
            host={h}
            draft={DEPOSIT_DRAFT_SLIPS}
            card={{ flag: 0, notice: 'failed' }}
            height={450}
          />,
        ];
      case 'card-above':
        return [
          <Frame
            key="a"
            label="Flips above near the bottom edge"
            host={h}
            draft={'\n\n\n\n\n\n\n\n\nHi Catherine,'}
            card={{ flag: 0 }}
            height={300}
          />,
        ];
      case 'ledger':
        return [
          <Frame
            key="a"
            label="Ledger, asks and slips"
            host={h}
            draft={DEPOSIT_DRAFT_SLIPS}
            ledger
            height={420}
          />,
        ];
      case 'ledger-covered':
        return [
          <Frame
            key="a"
            label="Ledger, everything covered"
            host={h}
            draft="Hi Kathryn,"
            prepare={confirmAll}
            ledger
            height={300}
          />,
        ];
      case 'ledger-empty':
        return [
          <Frame
            key="a"
            label="Ledger, nothing to list"
            host={h}
            input={{ ...NO_ASKS, message: 'Hi Sam, thanks for your note.\n\nKathryn' }}
            draft="Hi Kathryn,"
            ledger
            height={300}
          />,
        ];
      case 'ledger-overflow':
        return [
          <Frame
            key="a"
            label="Ledger, more asks than the cap, one dismissed"
            host={h}
            input={MANY_ASKS}
            draft="Hi Kathryn,"
            prepare={(s) => {
              const [first] = s.getSnapshot().result.asks;
              if (first) s.dispatch({ type: 'dismiss-ask', id: first.id });
            }}
            ledger
            height={500}
          />,
        ];
      case 'chip':
        return [<ChipFrames key="a" host={h} />];
      default:
        return [];
    }
  })();
  return <div className="stage">{frames}</div>;
}

function ChipFrames({ host }: { host: Host }) {
  const view = (kind: 'context' | 'error', text: string) => ({
    kind,
    text,
    field: { left: 40, top: 90, right: 520, bottom: 210 },
    viewport: { width: 560, height: 260 },
    theme: host,
    ...(kind === 'context' ? { onClear: noop } : {}),
  });
  return (
    <>
      {(
        [
          ['Context set, field focused', view('context', 'Context: 84 words from this page')],
          ['No text selected', view('error', 'No text selected. Select the message first.')],
        ] as const
      ).map(([label, v]) => (
        <figure key={label} style={{ margin: 0 }}>
          <figcaption className="frame-label">{label}</figcaption>
          <div className="frame" style={{ width: 560, height: 260 }}>
            <div className="host" data-host={host}>
              <div className="editor" style={{ inset: '90px 40px 50px 40px' }}>
                Hi Kathryn, thanks for the note.
              </div>
            </div>
            <ContextChip view={v} />
          </div>
        </figure>
      ))}
    </>
  );
}

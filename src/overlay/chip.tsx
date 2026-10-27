/**
 * The context chip (DESIGN.md "Context chip"): 22px, docked 6px above the
 * field's top-right corner, `Context: 84 words from this page · Clear`. It
 * lives in its own React root inside Readback's shadow root so the generic
 * adapter can show it with or without a bound field (and for its 4 s error).
 */
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { RectLike } from '../dom/geometry';
import { CircleAlertIcon } from './ui/icons';

export interface ChipView {
  kind: 'context' | 'error';
  text: string;
  /** The field to dock to; undefined docks to the viewport's bottom-right. */
  field: RectLike | undefined;
  viewport: { width: number; height: number };
  theme: 'light' | 'dark';
  onClear?: () => void;
}

const GAP = 6;
const VIEWPORT_INSET = 16;

export function ContextChip({ view }: { view: ChipView }) {
  const { field, viewport } = view;
  let style: React.CSSProperties;
  if (!field) {
    style = { right: VIEWPORT_INSET, bottom: VIEWPORT_INSET };
  } else if (field.top > 40) {
    style = { right: viewport.width - field.right, bottom: viewport.height - field.top + GAP };
  } else {
    style = { right: viewport.width - field.right, top: field.bottom + GAP };
  }
  return (
    <div className="rb-root" data-theme={view.theme}>
      <div className="rb-chip" data-kind={view.kind} role="status" style={style}>
        {view.kind === 'error' ? <CircleAlertIcon width={14} height={14} /> : null}
        <span>{view.text}</span>
        {view.kind === 'context' && view.onClear ? (
          <button
            type="button"
            className="rb-chip-clear"
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            onClick={view.onClear}
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

export interface ChipHost {
  show(view: ChipView): void;
  hide(): void;
  destroy(): void;
}

/** Mounts the chip into `parent` (the shadow root). */
export function mountChip(doc: Document, parent: ParentNode): ChipHost {
  const container = doc.createElement('div');
  parent.append(container);
  let root: Root | undefined = createRoot(container);
  return {
    show(view) {
      root?.render(createElement(ContextChip, { view }));
    },
    hide() {
      root?.render(null);
    },
    destroy() {
      root?.unmount();
      root = undefined;
      container.remove();
    },
  };
}

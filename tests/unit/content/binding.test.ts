// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createTextareaTarget } from '../../../src/adapters/target';
import { TYPING_PAUSE_MS, bindDraft } from '../../../src/content/binding';
import type { Binding } from '../../../src/content/binding';
import { createHighlightPainter } from '../../../src/dom/highlights';
import { createContext } from '../../../src/engine/index';
import { createComposeSession, wordInProgressAt } from '../../../src/state/session';
import { DEPOSIT_INPUT } from '../../fixtures/samples';

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function setup() {
  const field = document.createElement('textarea');
  document.body.append(field);
  const mirrorHost = document.createElement('div');
  document.body.append(mirrorHost);
  const session = createComposeSession({
    context: createContext(DEPOSIT_INPUT, new Date(2026, 10, 2)),
    today: new Date(2026, 10, 2),
  });
  const painter = createHighlightPainter({
    registry: { set: () => undefined, delete: () => true },
    create: (ranges) => ({ ranges }),
  });
  const binding = bindDraft({
    target: createTextareaTarget(field, () => []),
    session,
    painter,
    mirrorHost,
  });
  const typeAtEnd = (value: string): void => {
    field.value = value;
    field.focus();
    field.setSelectionRange(value.length, value.length);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const found = (): string[] => session.getSnapshot().result.flags.map((f) => f.found);
  return { field, mirrorHost, session, binding, typeAtEnd, found };
}

let current: Binding | undefined;
afterEach(() => {
  current?.destroy();
  current = undefined;
  document.body.replaceChildren();
});

describe('word in progress', () => {
  it('finds the caret only at the end of a word that is still open', () => {
    expect(wordInProgressAt('Hi Catheri', 10)).toBe(10);
    expect(wordInProgressAt('Hi Catherine,', 13)).toBeUndefined();
    expect(wordInProgressAt('Hi Catherine and', 12)).toBe(12);
    expect(wordInProgressAt('Hi Catherine and', 5)).toBeUndefined(); // inside a word
    expect(wordInProgressAt('Hi ', 3)).toBeUndefined();
    expect(wordInProgressAt('Hi', undefined)).toBeUndefined();
  });

  it('holds back a squiggle on the half-typed word, then shows it when the word ends or typing pauses', async () => {
    const t = setup();
    current = t.binding;
    t.typeAtEnd('Hi Catheri');
    expect(t.found()).toEqual([]);
    await wait(30);
    t.typeAtEnd('Hi Catherine');
    expect(t.found()).toEqual([]);
    await wait(TYPING_PAUSE_MS + 80);
    expect(t.found()).toEqual(['Catherine']);
    await wait(30);
    t.typeAtEnd('Hi Catherine,');
    expect(t.found()).toEqual(['Catherine']);
  });
});

describe('textarea mirror placement', () => {
  it('follows the field when the page scrolls or resizes, not only when the field scrolls', async () => {
    const t = setup();
    current = t.binding;
    let top = 100;
    t.field.getBoundingClientRect = () =>
      ({ left: 10, top, width: 300, height: 120, right: 310, bottom: top + 120 }) as DOMRect;
    t.typeAtEnd('Hi Catherine, the $1,520 deposit.');
    const mirror = t.mirrorHost.querySelector<HTMLElement>('[data-readback-mirror]')!;
    expect(mirror.style.top).toBe('100px');

    top = 40; // the page scrolled up by 60 px
    window.dispatchEvent(new Event('scroll'));
    await wait(40);
    expect(mirror.style.top).toBe('40px');

    top = 70;
    window.dispatchEvent(new Event('resize'));
    await wait(40);
    expect(mirror.style.top).toBe('70px');
  });
});

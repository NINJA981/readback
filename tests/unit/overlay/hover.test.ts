import { describe, expect, it } from 'vitest';
import { DWELL_MS, GRACE_MS, createHoverIntent } from '../../../src/overlay/hover';
import type { Timers } from '../../../src/overlay/hover';

/** Manual clock: timers fire only when the test advances time. */
function clock() {
  let now = 0;
  let next = 1;
  const pending = new Map<number, { at: number; run: () => void }>();
  const timers: Timers = {
    set(run, ms) {
      const id = next++;
      pending.set(id, { at: now + ms, run });
      return id;
    },
    clear(id) {
      pending.delete(id);
    },
  };
  return {
    timers,
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const due = [...pending.entries()]
          .filter(([, t]) => t.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        now = due[1].at;
        pending.delete(due[0]);
        due[1].run();
      }
      now = end;
    },
    get pending() {
      return pending.size;
    },
  };
}

function setup() {
  const c = clock();
  const log: string[] = [];
  const intent = createHoverIntent({
    timers: c.timers,
    onOpen: (id) => log.push(`open:${id}`),
    onClose: () => log.push('close'),
  });
  return { c, log, intent };
}

describe('hover intent (guard card opens after 300 ms)', () => {
  it('opens only after the pointer has rested for the dwell', () => {
    const { c, log, intent } = setup();
    intent.over('a');
    c.advance(DWELL_MS - 1);
    expect(log).toEqual([]);
    c.advance(1);
    expect(log).toEqual(['open:a']);
    expect(intent.openId).toBe('a');
  });

  it('moving off the slip before the dwell cancels the open', () => {
    const { c, log, intent } = setup();
    intent.over('a');
    c.advance(200);
    intent.over(undefined);
    c.advance(1000);
    expect(log).toEqual([]);
  });

  it('repeated moves over the same slip do not restart the dwell', () => {
    const { c, log, intent } = setup();
    intent.over('a');
    c.advance(150);
    intent.over('a');
    intent.over('a');
    c.advance(150);
    expect(log).toEqual(['open:a']);
  });

  it('closes after the grace period when the pointer leaves both slip and card', () => {
    const { c, log, intent } = setup();
    intent.over('a');
    c.advance(DWELL_MS);
    intent.over(undefined);
    c.advance(GRACE_MS - 1);
    expect(log).toEqual(['open:a']);
    c.advance(1);
    expect(log).toEqual(['open:a', 'close']);
    expect(intent.openId).toBeUndefined();
  });

  it('the pointer can cross the gap from the slip into the card', () => {
    const { c, log, intent } = setup();
    intent.over('a');
    c.advance(DWELL_MS);
    intent.over(undefined);
    c.advance(100);
    intent.cardEnter();
    c.advance(2000);
    expect(log).toEqual(['open:a']);
    // Leaving the card (and not returning to the slip) closes it.
    intent.cardLeave();
    c.advance(GRACE_MS);
    expect(log).toEqual(['open:a', 'close']);
  });

  it('coming back onto the slip within the grace period keeps the card', () => {
    const { c, log, intent } = setup();
    intent.over('a');
    c.advance(DWELL_MS);
    intent.over(undefined);
    c.advance(100);
    intent.over('a');
    c.advance(2000);
    expect(log).toEqual(['open:a']);
  });

  it('hovering another slip swaps the card after its own dwell, never closing in between', () => {
    const { c, log, intent } = setup();
    intent.over('a');
    c.advance(DWELL_MS);
    intent.over('b');
    c.advance(DWELL_MS - 1);
    expect(log).toEqual(['open:a']);
    c.advance(1);
    expect(log).toEqual(['open:a', 'open:b']);
  });

  it('cancel() drops every pending timer (typing, scroll, destroy)', () => {
    const { c, log, intent } = setup();
    intent.over('a');
    intent.cancel();
    expect(c.pending).toBe(0);
    c.advance(1000);
    expect(log).toEqual([]);
  });

  it('closed() resets state when something else closed the card (Esc, a fix)', () => {
    const { c, log, intent } = setup();
    intent.over('a');
    c.advance(DWELL_MS);
    intent.closed();
    intent.over(undefined);
    c.advance(1000);
    expect(log).toEqual(['open:a']);
    expect(intent.openId).toBeUndefined();
  });
});

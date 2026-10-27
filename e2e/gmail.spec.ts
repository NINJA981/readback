import { expect, highlightTexts, isLocalRequest, readLocal, readSession, test } from './fixtures';

const EDITOR = 'div[g_editable="true"]';

test.describe('Gmail fixture, real content script on its real match pattern', () => {
  test('AC-4.2 / AC-4.1: slips are highlighted and the editor DOM is never touched by Readback', async ({
    openGmail,
    worker,
    requests,
  }) => {
    const page = await openGmail('inline-reply');
    await page.locator(EDITOR).click();
    await page.keyboard.press('Control+Home'); // above the user's own signature, as in Gmail

    // Record every mutation inside the editor from here on.
    await page.evaluate(() => {
      const w = window as unknown as { __mutations: MutationRecord[] };
      w.__mutations = [];
      new MutationObserver((records) => w.__mutations.push(...records)).observe(
        document.querySelector('div[g_editable="true"]')!,
        { subtree: true, childList: true, attributes: true, characterData: true },
      );
    });

    await page.keyboard.type('Hi Catherine,');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('The $1,520 deposit is confirmed.');

    await expect.poll(() => highlightTexts(page, 'readback-slip')).toEqual(['Catherine', '$1,520']);
    expect(await page.evaluate(() => CSS.highlights.has('readback-slip'))).toBe(true);

    // Everything recorded so far came from the scripted typing. Let Readback settle,
    // then make sure it adds nothing on its own.
    const afterTyping = await page.evaluate(
      () => (window as unknown as { __mutations: unknown[] }).__mutations.length,
    );
    await page.waitForTimeout(500);
    const later = await page.evaluate(
      () => (window as unknown as { __mutations: unknown[] }).__mutations.length,
    );
    expect(later).toBe(afterTyping);

    // Readback adds no nodes or attributes inside Gmail's compose; it registers highlights.
    // The one shadow host sits on <html>, never inside Gmail's compose.
    expect(await page.locator(`${EDITOR} readback-overlay`).count()).toBe(0);
    expect(await page.locator('readback-overlay').count()).toBe(1);
    expect(
      await page.evaluate(() => {
        const w = window as unknown as { __mutations: MutationRecord[] };
        return w.__mutations.filter((m) => m.type === 'attributes').map((m) => m.attributeName);
      }),
    ).toEqual([]);

    // The popup status is counts only (3 asks, 2 slips) and the thread text never reaches storage.
    await expect
      .poll(async () => {
        const entry = Object.entries(await readSession(worker)).find(([k]) => k.startsWith('tab:'));
        return entry?.[1];
      })
      .toMatchObject({ state: 'reading', asks: 3, slips: 2 });
    const stored = JSON.stringify([await readSession(worker), await readLocal(worker)]);
    for (const secret of ['Kathryn', 'Catherine', 'deposit', '1,250', 'Larchmont']) {
      expect(stored).not.toContain(secret);
    }

    // AC-G.2: nothing left this machine.
    expect(requests.urls.filter((u) => !isLocalRequest(u))).toEqual([]);
  });

  test('a corrected draft clears the highlight', async ({ openGmail }) => {
    const page = await openGmail('inline-reply');
    await page.locator(EDITOR).click();
    await page.keyboard.press('Control+Home'); // above the user's own signature, as in Gmail
    await page.keyboard.type('Hi Catherine,');
    await expect.poll(() => highlightTexts(page, 'readback-slip')).toEqual(['Catherine']);
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Hi Kathryn,');
    await expect.poll(() => highlightTexts(page, 'readback-slip')).toEqual([]);
  });

  test('picks the dark highlight set on a dark host', async ({ openGmail }) => {
    const page = await openGmail('theme-dark');
    await page.locator(EDITOR).click();
    await page.keyboard.press('Control+Home'); // above the user's own signature, as in Gmail
    await page.keyboard.type('Hi Catherine,');
    await expect.poll(() => highlightTexts(page, 'readback-slip-dark')).toEqual(['Catherine']);
    expect(await highlightTexts(page, 'readback-slip')).toEqual([]);
  });

  test('AC-8.2: renamed classes make the self-test fail, nothing is drawn and the console stays clean', async ({
    context,
    openGmail,
    worker,
  }) => {
    const errors: string[] = [];
    const messages: string[] = [];
    context.on('weberror', (e) => errors.push(e.error().message));
    context.on('console', (m) => messages.push(`${m.type()}: ${m.text()}`));
    const page = await openGmail('renamed-classes');
    await page.locator(EDITOR).click();
    await page.keyboard.press('Control+Home'); // above the user's own signature, as in Gmail
    await page.keyboard.type('Hi Catherine, $1,520');
    await page.waitForTimeout(400);
    expect(await highlightTexts(page, 'readback-slip')).toEqual([]);
    await expect
      .poll(async () => {
        const entry = Object.entries(await readSession(worker)).find(([k]) => k.startsWith('tab:'));
        return entry?.[1];
      })
      .toMatchObject({ state: 'layout-unrecognised', failedChecks: ['thread'] });
    expect(errors).toEqual([]);
    expect(messages.filter((m) => /readback/i.test(m))).toEqual([]);
    expect(messages.filter((m) => m.startsWith('error'))).toEqual([]);
  });

  test('a new message (not a reply) is left alone', async ({ openGmail }) => {
    const page = await openGmail('new-message');
    await page.locator(EDITOR).click();
    await page.keyboard.press('Control+Home'); // above the user's own signature, as in Gmail
    await page.keyboard.type('Hi Catherine, $1,520');
    await page.waitForTimeout(400);
    expect(await highlightTexts(page, 'readback-slip')).toEqual([]);
  });
});

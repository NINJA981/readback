import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/**
 * Every WCAG 2.x level A and AA rule axe knows, including 2.2 target size, plus the experimental
 * `label-content-name-mismatch` rule (WCAG 2.5.3) that default axe runs leave off. The default run
 * is how two label-in-name violations passed a "zero axe violations" gate in QA round 1.
 */
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

export function axeBuilder(page: Page, disable: string[] = []): AxeBuilder {
  return new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .options({ rules: { 'label-content-name-mismatch': { enabled: true } } })
    .disableRules(disable);
}

export async function violationsOf(builder: AxeBuilder): Promise<string[]> {
  const results = await builder.analyze();
  return results.violations.map(
    (v) => `${v.id} (${v.impact ?? '?'}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
}

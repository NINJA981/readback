/**
 * Selector chains. Host pages change class names without notice, so every
 * lookup is an ordered list of selectors tried until one matches. A chain
 * that matches nothing is how the adapter self-test notices a layout change.
 */
export type SelectorChain = readonly string[];

/** First element matched by the first selector in the chain that matches. */
export function queryFirst(root: ParentNode, chain: SelectorChain): HTMLElement | undefined {
  for (const selector of chain) {
    let found: Element | null;
    try {
      found = root.querySelector(selector);
    } catch {
      continue;
    }
    if (found) return found as HTMLElement;
  }
  return undefined;
}

/** All elements matched by the first selector in the chain that matches anything. */
export function queryAll(root: ParentNode, chain: SelectorChain): HTMLElement[] {
  for (const selector of chain) {
    let found: HTMLElement[];
    try {
      found = Array.from(root.querySelectorAll<HTMLElement>(selector));
    } catch {
      continue;
    }
    if (found.length > 0) return found;
  }
  return [];
}

/** The nearest ancestor-or-self matching any selector of the chain. */
export function closestOf(el: Element, chain: SelectorChain): Element | undefined {
  for (const selector of chain) {
    let found: Element | null;
    try {
      found = el.closest(selector);
    } catch {
      continue;
    }
    if (found) return found;
  }
  return undefined;
}

/** True when the element matches any selector of the chain. */
export function matchesAny(el: Element, chain: SelectorChain): boolean {
  return chain.some((selector) => {
    try {
      return el.matches(selector);
    } catch {
      return false;
    }
  });
}

/**
 * Helpers for the citation block: the thread line the guard compared against,
 * trimmed around the matched token (DESIGN.md Guard card, item 2).
 */

export interface SnippetParts {
  before: string;
  token: string;
  after: string;
}

const collapse = (s: string): string => s.replace(/\s+/g, ' ').trim();

/**
 * Trims `line` to about `reach` characters either side of `token` and splits it
 * so the token can be underlined. When the token is not in the line, the whole
 * (collapsed, shortened) line is returned with an empty token.
 */
export function snippet(line: string, token: string, reach = 34): SnippetParts {
  const flat = collapse(line);
  const at = token ? flat.indexOf(token) : -1;
  if (at < 0) {
    const cut = flat.length > reach * 2 ? `${flat.slice(0, reach * 2).trimEnd()}…` : flat;
    return { before: cut, token: '', after: '' };
  }
  const start = Math.max(0, at - reach);
  const end = Math.min(flat.length, at + token.length + reach);
  const before = flat.slice(start, at);
  const after = flat.slice(at + token.length, end);
  return {
    before: `${start > 0 ? '…' : ''}${start > 0 ? before.replace(/^\S*\s/, '') : before}`,
    token,
    after: `${after}${end < flat.length ? '…' : ''}`,
  };
}

/** The first occurrence of `token` inside the first occurrence of `line` in `raw`, or undefined. */
export function locateCitation(
  raw: string,
  line: string,
  token: string,
): { start: number; end: number } | undefined {
  if (!token) return undefined;
  const flatLine = line.trim();
  const lineAt = flatLine ? raw.indexOf(flatLine) : -1;
  const from = lineAt >= 0 ? lineAt : 0;
  const within = lineAt >= 0 ? flatLine : raw;
  const tokenAt = within.indexOf(token);
  if (tokenAt < 0) return undefined;
  return { start: from + tokenAt, end: from + tokenAt + token.length };
}

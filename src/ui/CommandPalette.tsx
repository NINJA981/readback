/**
 * Command palette (DESIGN.md "Command palette", Ctrl/Cmd+K). Opens instantly,
 * 640px wide, 20vh from the top, 48px input, 36px rows with the shortcut set
 * as a keycap on the right. Built on plain elements (no cmdk): a filtered list,
 * arrow keys, Enter and Esc, with focus returned to where it came from.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Keycap } from './controls';

export interface Command {
  id: string;
  label: string;
  /** Extra words the filter matches, not shown. */
  keywords?: string;
  hint?: readonly string[];
  run: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  commands: readonly Command[];
  onClose: () => void;
}

export function CommandPalette({ open, commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const returnTo = useRef<Element | null>(null);

  // Reset when opened (state derived during render, not mirrored by an effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery('');
      setActive(0);
    }
  }

  useEffect(() => {
    if (!open) return undefined;
    returnTo.current = document.activeElement;
    inputRef.current?.focus();
    return () => {
      const el = returnTo.current;
      if (el instanceof HTMLElement) el.focus();
    };
  }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.keywords ?? ''}`.toLowerCase().includes(q));
  }, [commands, query]);

  if (!open) return null;

  const run = (c: Command | undefined): void => {
    if (!c) return;
    onClose();
    c.run();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[20vh]"
      style={{ background: 'var(--rb-scrim)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-[640px] overflow-hidden rounded-lg bg-surface text-text shadow-e4"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => Math.min(matches.length - 1, i + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            run(matches[active]);
          }
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={matches[active] ? `${listId}-${matches[active].id}` : undefined}
          placeholder="Type a command"
          spellCheck={false}
          autoComplete="off"
          className="h-12 w-full border-b border-border bg-transparent px-4 text-h3 font-[420] text-text placeholder:text-text-subtle focus:outline-none"
        />
        <ul id={listId} role="listbox" className="max-h-[50vh] overflow-auto p-2">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-ui text-text-muted">
              No command matches {'“'}
              {query.trim()}
              {'”'}.
            </li>
          ) : (
            matches.map((c, i) => (
              <li
                key={c.id}
                id={`${listId}-${c.id}`}
                role="option"
                aria-selected={i === active}
                onMouseMove={() => {
                  setActive(i);
                }}
                onClick={() => {
                  run(c);
                }}
                className={`flex h-9 cursor-pointer items-center justify-between rounded-sm px-3 text-ui ${
                  i === active ? 'bg-surface-3' : ''
                }`}
              >
                <span>{c.label}</span>
                {c.hint ? (
                  <span className="flex gap-1">
                    {c.hint.map((k) => (
                      <Keycap key={k}>{k}</Keycap>
                    ))}
                  </span>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

import { useEffect, useId, useMemo, useRef, useState } from 'react';

export interface Command {
  id: string;
  label: string;
  /** Extra words the filter matches, not shown. */
  keywords?: string;
  /** Keys shown as keycaps on the right. */
  hint?: readonly string[];
  run: () => void;
}

interface Props {
  open: boolean;
  commands: readonly Command[];
  onClose: () => void;
}

/**
 * Command palette (DESIGN.md "Command palette", Ctrl/Cmd+K). A native modal `<dialog>`, so the
 * page behind it is inert, Esc closes it and focus returns to where it came from. A filtered
 * list with arrow keys and Enter; no library.
 */
export function Palette({ open, commands, onClose }: Props): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setQuery('');
      setActive(0);
      d.showModal();
      inputRef.current?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.keywords ?? ''}`.toLowerCase().includes(q));
  }, [commands, query]);

  const run = (c: Command | undefined): void => {
    if (!c) return;
    onClose();
    // After the dialog has closed and returned focus, so a command may move focus itself.
    window.setTimeout(c.run, 0);
  };

  const current = matches[active];

  return (
    <dialog
      ref={ref}
      className="palette"
      aria-label="Command palette"
      aria-modal="true"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <input
        ref={inputRef}
        className="palette__input"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => Math.min(matches.length - 1, i + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            run(current);
          }
        }}
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={current ? `${listId}-${current.id}` : undefined}
        aria-label="Type a command"
        placeholder="Type a command"
        spellCheck={false}
        autoComplete="off"
      />
      <ul id={listId} role="listbox" className="palette__list" aria-label="Commands">
        {matches.length === 0 ? (
          <li className="palette__empty" role="presentation">
            No command matches “{query.trim()}”.
          </li>
        ) : (
          matches.map((c, i) => (
            <li
              key={c.id}
              id={`${listId}-${c.id}`}
              role="option"
              aria-selected={i === active}
              className="palette__row"
              data-active={i === active ? '' : undefined}
              onMouseMove={() => {
                setActive(i);
              }}
              onClick={() => {
                run(c);
              }}
            >
              <span>{c.label}</span>
              {c.hint && (
                <span className="palette__keys" aria-hidden="true">
                  {c.hint.map((k) => (
                    <span className="keycap" key={k}>
                      {k}
                    </span>
                  ))}
                </span>
              )}
            </li>
          ))
        )}
      </ul>
    </dialog>
  );
}

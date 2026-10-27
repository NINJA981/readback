/**
 * Controls shared by the popup and the options page. Plain elements and
 * DESIGN.md role tokens; each control does one thing (no boolean mode props).
 * Brass is used as a signal: a switch that is on carries it as a thin border,
 * a soft tint and the thumb, never a solid fill (Five Percent Rule), and the
 * one filled brass button per view is PrimaryButton.
 */
import type { ComponentProps, ReactNode } from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Visible label; also the accessible name. */
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  /** Explains a disabled switch (also exposed as its description). */
  disabledReason?: string;
}

/** The track and thumb on their own, for rows that lay the label out themselves. */
export function SwitchTrack({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-5 w-9 shrink-0 items-center rounded-full border px-px transition-colors duration-100 ${
        checked
          ? 'justify-end border-brass bg-brass-soft'
          : 'justify-start border-border-strong bg-surface-2'
      }`}
    >
      <span
        className={`size-3.5 rounded-full transition-colors duration-100 ${
          checked ? 'mx-0.5 bg-brass' : 'mx-0.5 bg-text-subtle'
        }`}
      />
    </span>
  );
}

/** A labelled on/off switch (role="switch"); the whole row is the click target. */
export function SwitchRow({
  checked,
  onChange,
  label,
  hint,
  disabled,
  disabledReason,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      title={disabled ? disabledReason : undefined}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      className={`flex min-h-8 w-full items-center justify-between gap-3 rounded-sm px-2 py-1 text-left text-ui ${
        disabled ? 'opacity-50' : 'hover:bg-surface-3'
      }`}
    >
      <span className="flex min-w-0 flex-col">
        <span>{label}</span>
        {hint ? <span className="text-caption text-text-muted">{hint}</span> : null}
      </span>
      <SwitchTrack checked={checked} />
    </button>
  );
}

type ButtonProps = ComponentProps<'button'>;

/** Brass fill: at most one per view (DESIGN.md Five Percent Rule). 14px/600 so the label passes APCA. */
export function PrimaryButton({ className = '', ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-7 items-center justify-center gap-2 rounded-sm bg-brass px-3 text-ui font-semibold text-on-brass transition-[background-color,transform] duration-100 hover:bg-brass-hover active:scale-[.97] ${className}`}
    />
  );
}

export function SecondaryButton({ className = '', ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-7 items-center justify-center gap-2 rounded-sm border border-border bg-surface-2 px-3 text-label text-text transition-colors duration-100 hover:bg-surface-3 ${className}`}
    />
  );
}

export function GhostButton({ className = '', ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-7 items-center justify-center gap-2 rounded-sm px-2.5 text-label text-text-muted transition-colors duration-100 hover:bg-surface-3 hover:text-text ${className}`}
    />
  );
}

/** A keyboard key, set as DESIGN.md "Keycap": 20px, micro type, hairline and a lower edge. */
export function Keycap({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-xs bg-surface-2 px-1.5 font-ui text-micro text-text-muted shadow-[0_0_0_1px_var(--rb-border),inset_0_-1px_0_var(--rb-border)]">
      {children}
    </kbd>
  );
}

/** A group of keycaps for one shortcut: `Alt` `Shift` `R`. */
export function Shortcut({ keys }: { keys: readonly string[] }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((k) => (
        <Keycap key={k}>{k}</Keycap>
      ))}
    </span>
  );
}

/** A titled group. `heading` renders at the level the page needs. */
export function Section({
  title,
  children,
  as: Heading = 'h2',
}: {
  title: string;
  children: ReactNode;
  as?: 'h2' | 'h3';
}) {
  return (
    <section className="flex flex-col gap-1">
      <Heading className="px-2 text-label font-semibold text-text-muted">{title}</Heading>
      {children}
    </section>
  );
}

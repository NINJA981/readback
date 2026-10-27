/**
 * Small controls shared by the popup and the options page. Plain elements and
 * DESIGN.md role tokens; each control does one thing (no boolean mode props).
 */
import type { ComponentProps, ReactNode } from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Visible label; also the accessible name. */
  label: ReactNode;
  hint?: ReactNode;
}

/** A labelled on/off switch (role="switch"); the whole row is the click target. */
export function SwitchRow({ checked, onChange, label, hint }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => {
        onChange(!checked);
      }}
      className="flex min-h-8 w-full items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-ui hover:bg-surface-3"
    >
      <span className="flex flex-col">
        <span>{label}</span>
        {hint ? <span className="text-caption text-text-subtle">{hint}</span> : null}
      </span>
      <span
        aria-hidden="true"
        className={`flex h-5 w-10 shrink-0 rounded-full border p-0.5 ${
          checked
            ? 'justify-end border-brass bg-brass'
            : 'justify-start border-border-strong bg-surface-2'
        }`}
      >
        <span className={`size-4 rounded-full ${checked ? 'bg-on-brass' : 'bg-text-muted'}`} />
      </span>
    </button>
  );
}

type ButtonProps = ComponentProps<'button'>;

/** Brass fill: at most one per view (DESIGN.md Five Percent Rule). */
export function PrimaryButton(props: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className="h-7 rounded-sm bg-brass px-3 text-ui font-semibold text-on-brass transition-colors duration-100 hover:bg-brass-hover active:scale-[.97]"
    />
  );
}

export function SecondaryButton(props: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className="h-7 rounded-sm border border-border bg-surface-2 px-3 text-label text-text hover:bg-surface-3"
    />
  );
}

export function GhostButton(props: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className="h-7 rounded-sm px-2.5 text-label text-text-muted hover:bg-surface-3"
    />
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

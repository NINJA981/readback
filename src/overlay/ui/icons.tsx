/**
 * Lucide icons (ISC licence), 16px, 1.5 stroke, as inline SVG: DESIGN.md
 * "Icons". Only the glyphs the overlay uses, so nothing else is bundled into
 * the content script. State rings are drawn by hand.
 */
import type { ReactNode, SVGProps } from 'react';

function Svg({ children, ...rest }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const CircleAlertIcon = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </Svg>
);

export const CheckIcon = ({ draw, ...p }: SVGProps<SVGSVGElement> & { draw?: boolean }) => (
  <Svg {...p}>
    <path d="M20 6 9 17l-5-5" pathLength={1} className={draw ? 'rb-check-draw' : undefined} />
  </Svg>
);

export const XIcon = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Svg>
);

export const EllipsisIcon = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </Svg>
);

export const ReplyIcon = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <polyline points="15 10 20 15 15 20" />
    <path d="M4 4v7a4 4 0 0 0 4 4h12" />
  </Svg>
);

export const UndoIcon = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
  </Svg>
);

/** Open ask: an 8px hollow brass ring. Looks answered: the same ring, dotted. */
export function AskRing({ dotted }: { dotted?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className="rb-ring"
    >
      <circle
        cx="8"
        cy="8"
        r="3.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray={dotted ? '2 2' : undefined}
      />
    </svg>
  );
}

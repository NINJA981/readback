/**
 * Lucide icons (ISC), 16px, 1.5 stroke (DESIGN.md Shapes). One module serves
 * both pages: the landing page builds markup strings, React uses `<Icon>`.
 * Only the icons listed here end up in the bundle.
 */
import arrowLeft from 'lucide-static/icons/arrow-left.svg?raw';
import check from 'lucide-static/icons/check.svg?raw';
import chevronDown from 'lucide-static/icons/chevron-down.svg?raw';
import circleAlert from 'lucide-static/icons/circle-alert.svg?raw';
import copy from 'lucide-static/icons/copy.svg?raw';
import download from 'lucide-static/icons/download.svg?raw';
import externalLink from 'lucide-static/icons/external-link.svg?raw';
import info from 'lucide-static/icons/info.svg?raw';
import lock from 'lucide-static/icons/lock.svg?raw';
import monitor from 'lucide-static/icons/monitor.svg?raw';
import moon from 'lucide-static/icons/moon.svg?raw';
import pause from 'lucide-static/icons/pause.svg?raw';
import play from 'lucide-static/icons/play.svg?raw';
import rotateCcw from 'lucide-static/icons/rotate-ccw.svg?raw';
import share2 from 'lucide-static/icons/share-2.svg?raw';
import slidersHorizontal from 'lucide-static/icons/sliders-horizontal.svg?raw';
import sun from 'lucide-static/icons/sun.svg?raw';
import trash2 from 'lucide-static/icons/trash-2.svg?raw';
import undo2 from 'lucide-static/icons/undo-2.svg?raw';
import wifiOff from 'lucide-static/icons/wifi-off.svg?raw';
import x from 'lucide-static/icons/x.svg?raw';

const inner = (raw: string): string =>
  raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .trim();

const RAW = {
  'arrow-left': arrowLeft,
  check,
  'chevron-down': chevronDown,
  'circle-alert': circleAlert,
  copy,
  download,
  'external-link': externalLink,
  info,
  lock,
  monitor,
  moon,
  pause,
  play,
  'rotate-ccw': rotateCcw,
  'share-2': share2,
  'sliders-horizontal': slidersHorizontal,
  sun,
  'trash-2': trash2,
  'undo-2': undo2,
  'wifi-off': wifiOff,
  x,
} as const;

export type IconName = keyof typeof RAW;

const PATHS = Object.fromEntries(
  (Object.entries(RAW) as [IconName, string][]).map(([name, raw]) => [name, inner(raw)]),
) as Record<IconName, string>;

/** The `<svg>` element's inner markup for an icon. */
export const iconInner = (name: IconName): string => PATHS[name];

/** A complete decorative `<svg>` string (hidden from assistive tech). */
export function iconSvg(name: IconName, size = 16): string {
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[name]}</svg>`;
}

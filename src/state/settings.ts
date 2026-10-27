/**
 * Settings: defaults, validation and pure updates (SPEC §7 `Settings`).
 *
 * Storage hands back `unknown` (a newer or older build may have written it,
 * or the user may have edited it in DevTools), so every read goes through
 * `parseSettings`, which never throws and fills gaps from the defaults.
 */
import type { GuardToggles, Settings } from '../engine/types';

export type Guard = keyof GuardToggles;
export type Theme = Settings['theme'];

export const GUARD_KEYS: readonly Guard[] = ['name', 'number', 'date', 'asks'];
export const THEMES: readonly Theme[] = ['system', 'light', 'dark'];

/** Cosine threshold bounds for the optional model (SPEC F7). */
export const MODEL_THRESHOLD_MIN = 0.3;
export const MODEL_THRESHOLD_MAX = 0.95;

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  enabled: true,
  disabledSites: [],
  guards: { name: true, number: true, date: true, asks: true },
  model: { enabled: false, threshold: 0.62 },
  theme: 'system',
});

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

/**
 * Normalises a site to its origin (`https://mail.google.com`). Returns
 * undefined for anything that is not an http(s) origin, so junk never reaches
 * the disabled-sites list.
 */
export function toOrigin(site: string): string | undefined {
  const m = /^(https?):\/\/([^/?#\s]+)/i.exec(site.trim());
  if (!m?.[1] || !m[2]) return undefined;
  return `${m[1].toLowerCase()}://${m[2].toLowerCase()}`;
}

function parseSites(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out = new Set<string>();
  for (const s of v) {
    if (typeof s !== 'string') continue;
    const origin = toOrigin(s);
    if (origin) out.add(origin);
  }
  return [...out].sort();
}

function clampThreshold(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_SETTINGS.model.threshold;
  return Math.min(MODEL_THRESHOLD_MAX, Math.max(MODEL_THRESHOLD_MIN, v));
}

/** Reads settings from untrusted storage data. Never throws. */
export function parseSettings(raw: unknown): Settings {
  const r = isRecord(raw) ? raw : {};
  const g = isRecord(r.guards) ? r.guards : {};
  const m = isRecord(r.model) ? r.model : {};
  const theme = THEMES.find((t) => t === r.theme) ?? DEFAULT_SETTINGS.theme;
  return {
    enabled: bool(r.enabled, DEFAULT_SETTINGS.enabled),
    disabledSites: parseSites(r.disabledSites),
    guards: {
      name: bool(g.name, true),
      number: bool(g.number, true),
      date: bool(g.date, true),
      asks: bool(g.asks, true),
    },
    model: {
      enabled: bool(m.enabled, DEFAULT_SETTINGS.model.enabled),
      threshold: clampThreshold(m.threshold),
    },
    theme,
  };
}

export function setGuard(settings: Settings, guard: Guard, on: boolean): Settings {
  return { ...settings, guards: { ...settings.guards, [guard]: on } };
}

export function setTheme(settings: Settings, theme: Theme): Settings {
  return { ...settings, theme };
}

export function setModel(settings: Settings, patch: Partial<Settings['model']>): Settings {
  const model = { ...settings.model, ...patch };
  return {
    ...settings,
    model: { enabled: model.enabled, threshold: clampThreshold(model.threshold) },
  };
}

/** Whether Readback runs on `site` (a URL or origin). */
export function isSiteEnabled(settings: Settings, site: string): boolean {
  if (!settings.enabled) return false;
  const origin = toOrigin(site);
  return origin === undefined || !settings.disabledSites.includes(origin);
}

/** Turns Readback on or off for one site. Unknown sites are left unchanged. */
export function setSiteEnabled(settings: Settings, site: string, on: boolean): Settings {
  const origin = toOrigin(site);
  if (!origin) return settings;
  const rest = settings.disabledSites.filter((s) => s !== origin);
  return { ...settings, disabledSites: on ? rest : [...rest, origin].sort() };
}

/** Number of guards switched on (the popup's "3 of 4 checks on"). */
export function enabledGuardCount(settings: Settings): number {
  return GUARD_KEYS.filter((k) => settings.guards[k]).length;
}

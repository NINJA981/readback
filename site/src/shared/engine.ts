/**
 * The site's one window onto the Readback core. Everything the landing page
 * and the web app need from the engine comes through here, from the repo's
 * `src/core` entry (the `@` Vite alias points at the repo's `src/`), which is
 * free of `chrome.*` / `browser.*`. Nothing in this file re-implements logic.
 *
 * Loaded with a dynamic `import()` so the engine (and chrono-node) arrive in
 * their own chunk, after first paint.
 */
export {
  DEFAULT_SETTINGS,
  EMPTY_IGNORE,
  ENGINE_VERSION,
  addIgnored,
  applyFixToField,
  check,
  citationSource,
  createComposeSession,
  createContext,
  createReadbackStorage,
  createWebArea,
  fixedLabel,
  hitTest,
  isCovered,
  ledgerConfirmed,
  ledgerHeader,
  mirrorSegments,
  overflowLabel,
  parseIgnoreList,
  parseSettings,
  pillModel,
  placeCard,
  removeIgnored,
  setGuard,
  slipSummary,
  splitMessage,
} from '@/core/index';
export type {
  Ask,
  IgnoreList,
  CheckResult,
  ComposeSession,
  ContextInput,
  Flag,
  PillModel,
  SessionSnapshot,
  Settings,
  ThreadContext,
} from '@/core/index';

/**
 * Readback core: the one entry module both the browser extension and the
 * phone-friendly web app (`site/`) import. Everything re-exported here is free
 * of `chrome.*` / `browser.*`. Browser-API access sits behind small adapters:
 * `StorageArea` (storage), `DraftTarget` (editable fields) and the effects a
 * `ComposeSession` is given.
 *
 * Layers, bottom to top (ADR-0002):
 *   engine   pure TypeScript, no DOM: harvest, guards, asks, coverage, hashing
 *   state    pure state machines and view models (compose session, settings)
 *   storage  typed access on top of any StorageArea (memory, extension, web)
 *   dom      TextIndex, CSS highlights, fixes, geometry (DOM, no extension API)
 *   adapters Gmail and generic-selection readers, draft targets, textarea mirror
 */

// engine
export * from '../engine/index';

// state
export { diffFlags, hasChanges, nextFlag, previousFlag } from '../state/flags-diff';
export type { FlagDiff } from '../state/flags-diff';
export {
  EMPTY_IGNORE,
  MAX_ENTRY_LENGTH,
  MAX_IGNORED,
  addIgnored,
  isIgnored,
  parseIgnoreList,
  removeIgnored,
} from '../state/ignore';
export type { IgnoreKind } from '../state/ignore';
export { createComposeSession } from '../state/session';
export type {
  ComposeSession,
  SessionEffects,
  SessionOptions,
  SessionSnapshot,
} from '../state/session';
export {
  DEFAULT_SETTINGS,
  GUARD_KEYS,
  MODEL_THRESHOLD_MAX,
  MODEL_THRESHOLD_MIN,
  THEMES,
  enabledGuardCount,
  isSiteEnabled,
  parseSettings,
  setGuard,
  setModel,
  setSiteEnabled,
  setTheme,
  toOrigin,
} from '../state/settings';
export type { Theme } from '../state/settings';
export { createStore } from '../state/store';
export type { Store } from '../state/store';
export {
  FIXED_CONFIRMATION_MS,
  fixedLabel,
  isCovered,
  ledgerHeader,
  overflowLabel,
  pillModel,
  slipSummary,
} from '../state/summary';
export type { PillModel, PillTone } from '../state/summary';
export {
  MAX_IDS,
  emptyThreadState,
  isEmptyThreadState,
  isId,
  isThreadKey,
  parseThreadState,
  reduceThreadState,
} from '../state/thread-state';
export type { ThreadAction } from '../state/thread-state';

// storage
export { createMemoryArea } from '../storage/area';
export type { StorageArea, StorageChange } from '../storage/area';
export { IGNORE_KEY, SETTINGS_KEY, isReadbackKey, tabKeyOf, threadKeyOf } from '../storage/keys';
export { MAX_THREADS, createReadbackStorage } from '../storage/repository';
export type { ReadbackStorage, StorageDeps, StorageInventory } from '../storage/repository';
export { STALE_STATUS_MS, TAB_STATES, isStale, parseTabStatus } from '../storage/tab-status';
export type { TabState, TabStatus } from '../storage/tab-status';
export { browserWebStorage, createWebArea } from '../platform/web-storage';
export type { WebAreaOptions, WebStorageLike } from '../platform/web-storage';

// messaging
export { MAX_SELECTION_CHARS, parseMessage, parseSlips } from '../messaging/protocol';
export type { MessageReplies, ReadbackMessage, SlipSummary } from '../messaging/protocol';

// dom
export { applyFixToField, applyFixToRange } from '../dom/apply-fix';
export type { ClipboardLike, FixOutcome } from '../dom/apply-fix';
export { effectiveBackground, hitTest, placeCard, themeForBackground } from '../dom/geometry';
export type { Placement, RectLike, SlipRects } from '../dom/geometry';
export { HIGHLIGHT_NAMES, createHighlightPainter } from '../dom/highlights';
export type { HighlightPainter, HighlightTheme } from '../dom/highlights';
export { buildTextIndex, elementText } from '../dom/text-index';
export type { DomPosition, TextIndex, TextIndexOptions } from '../dom/text-index';

// adapters
export { createTextareaMirror, mirrorSegments } from '../adapters/generic/textarea-mirror';
export type {
  MirrorSegment,
  MirrorSlip,
  TextareaMirror,
} from '../adapters/generic/textarea-mirror';
export {
  CONTEXT_MENU_ID,
  CONTEXT_MENU_TITLE,
  contextChipLabel,
  editableHostOf,
  editableKindOf,
  selectionContextInput,
  wordCount,
} from '../adapters/generic/selection';
export type { EditableKind } from '../adapters/generic/selection';
export { createContentEditableTarget, createTextareaTarget } from '../adapters/target';
export type { DraftTarget } from '../adapters/target';
export { draftIndexOf, findComposeEditors } from '../adapters/gmail/compose';
export { readGmailThread } from '../adapters/gmail/thread';
export type { CheckId, GmailRead, SelfTest } from '../adapters/gmail/thread';
export { GMAIL_ORIGIN } from '../adapters/gmail/selectors';

/**
 * The extension's storage: `chrome.storage.local` for settings and the ignore
 * list, `chrome.storage.session` for per-thread and per-tab state (SPEC §8).
 * One shared instance per extension context.
 */
import { createReadbackStorage } from '../storage/repository';
import type { ReadbackStorage } from '../storage/repository';
import { createExtensionArea } from './extension-storage';

let instance: ReadbackStorage | undefined;

export function extensionStorage(): ReadbackStorage {
  instance ??= createReadbackStorage({
    local: createExtensionArea('local'),
    session: createExtensionArea('session'),
  });
  return instance;
}

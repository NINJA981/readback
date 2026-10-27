import { DEFAULT_SETTINGS } from '../src/state/settings';
import type { StorageInventory } from '../src/storage/repository';
import { OptionsView } from '../src/ui/OptionsView';
import type { ModelStatus, OptionsActions } from '../src/ui/OptionsView';

export const OPTIONS_SCENES = [
  'options:default',
  'options:filled',
  'options:model-off',
  'options:model-loading',
  'options:model-loading-bar',
  'options:model-ready',
  'options:model-error',
  'options:cleared',
];

const noop = (): void => undefined;
const actions: OptionsActions = {
  toggleGuard: noop,
  setTheme: noop,
  removeIgnored: noop,
  toggleModel: noop,
  retryModel: noop,
  copyModelError: noop,
  clearAll: noop,
  undoClear: noop,
};

const inventory = (patch: Partial<StorageInventory>): StorageInventory => ({
  settings: true,
  ignoredNames: 0,
  ignoredNumbers: 0,
  threads: 0,
  tabs: 0,
  ...patch,
});

export function OptionsScene({ name }: { name: string }) {
  const settings = DEFAULT_SETTINGS;
  let model: ModelStatus = { kind: 'unavailable' };
  let ignore = { names: [] as string[], numbers: [] as string[] };
  let inv = inventory({});
  let toast = false;
  switch (name) {
    case 'filled':
      ignore = { names: ['Catherine', 'Dr Reyes'], numbers: ['1520', 'INV-20931'] };
      inv = inventory({ ignoredNames: 2, ignoredNumbers: 2, threads: 3 });
      break;
    case 'model-off':
      model = { kind: 'off', sizeMb: 23 };
      break;
    case 'model-loading':
      model = { kind: 'loading', ms: 1400 };
      break;
    case 'model-loading-bar':
      model = { kind: 'loading', ms: 3800, progress: 0.62 };
      break;
    case 'model-ready':
      model = { kind: 'ready', sizeMb: 23 };
      break;
    case 'model-error':
      model = { kind: 'error', reason: 'WebAssembly was blocked' };
      break;
    case 'cleared':
      toast = true;
      break;
  }
  const on = name.startsWith('model-') && name !== 'model-off' ? true : false;
  return (
    <OptionsView
      settings={{ ...settings, model: { ...settings.model, enabled: on } }}
      ignore={ignore}
      model={model}
      inventory={inv}
      hostPermissions={['https://mail.google.com/*']}
      clearedToast={toast}
      actions={actions}
    />
  );
}

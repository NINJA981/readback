/**
 * Options entry: live storage in, `OptionsView` out, plus the page's keyboard
 * layer (Ctrl/Cmd+K palette, Ctrl+Z to undo Clear all).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { extensionStorage } from '../../platform/runtime-storage';
import { removeIgnored } from '../../state/ignore';
import { GUARD_KEYS, THEMES, setGuard, setTheme } from '../../state/settings';
import type { Settings, IgnoreList } from '../../engine/types';
import type { StorageInventory } from '../../storage/repository';
import { CommandPalette } from '../../ui/CommandPalette';
import type { Command } from '../../ui/CommandPalette';
import { OptionsView, SECTIONS } from '../../ui/OptionsView';
import type { OptionsActions } from '../../ui/OptionsView';
import { updateIgnore, updateSettings, useIgnore, useSettings } from '../../ui/stores';
import { useTheme } from '../../ui/use-theme';

const TOAST_MS = 6000;
const GUARD_LABEL = {
  name: 'names',
  number: 'numbers',
  date: 'dates',
  asks: 'the ask pill',
} as const;

export function App() {
  const settings = useSettings();
  const ignore = useIgnore();
  const [inventory, setInventory] = useState<StorageInventory>();
  const [cleared, setCleared] = useState<{ settings: Settings; ignore: IgnoreList }>();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useTheme(settings.value.theme);

  const refreshInventory = useCallback((): void => {
    extensionStorage()
      .inventory()
      .then(setInventory, () => undefined);
  }, []);

  useEffect(() => {
    refreshInventory();
  }, [refreshInventory, settings.value, ignore.value]);

  const undoClear = useCallback((): void => {
    if (!cleared) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    const { settings: s, ignore: i } = cleared;
    setCleared(undefined);
    void updateSettings(() => s).then(() => updateIgnore(() => i));
  }, [cleared]);

  // Ctrl/Cmd+K opens the palette; Ctrl/Cmd+Z undoes Clear all while its toast shows.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'z' && cleared) {
        e.preventDefault();
        undoClear();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [cleared, undoClear]);

  const actions: OptionsActions = useMemo(
    () => ({
      toggleGuard(guard, on) {
        void updateSettings((s) => setGuard(s, guard, on));
      },
      setTheme(theme) {
        void updateSettings((s) => setTheme(s, theme));
      },
      removeIgnored(kind, entry) {
        void updateIgnore((l) => removeIgnored(l, kind, entry));
      },
      // The on-device model is not part of this build (ADR-0002), so these are no-ops.
      toggleModel() {},
      retryModel() {},
      copyModelError() {},
      clearAll() {
        const storage = extensionStorage();
        void Promise.all([storage.getSettings(), storage.getIgnore()]).then(
          async ([s, i]) => {
            await storage.clearAll();
            setCleared({ settings: s, ignore: i });
            refreshInventory();
            if (toastTimer.current) clearTimeout(toastTimer.current);
            toastTimer.current = setTimeout(() => {
              setCleared(undefined);
            }, TOAST_MS);
          },
          () => undefined,
        );
      },
      undoClear,
    }),
    [refreshInventory, undoClear],
  );

  const commands: Command[] = useMemo(() => {
    const goTo = (id: string) => (): void => {
      window.location.hash = id;
      document.getElementById(id)?.scrollIntoView();
    };
    return [
      ...SECTIONS.map((s) => ({ id: `go-${s.id}`, label: `Go to ${s.label}`, run: goTo(s.id) })),
      ...GUARD_KEYS.map((g) => ({
        id: `toggle-${g}`,
        label: `Toggle ${GUARD_LABEL[g]}`,
        keywords: 'check guard switch',
        run: () => {
          void updateSettings((s) => setGuard(s, g, !s.guards[g]));
        },
      })),
      ...THEMES.map((t) => ({
        id: `theme-${t}`,
        label: `Switch theme: ${t[0]?.toUpperCase()}${t.slice(1)}`,
        keywords: 'appearance dark light system',
        run: () => {
          void updateSettings((s) => setTheme(s, t));
        },
      })),
      {
        id: 'clear',
        label: 'Clear all stored data',
        keywords: 'delete reset',
        run: actions.clearAll,
      },
    ];
  }, [actions.clearAll]);

  if (!settings.loaded) return <main className="min-h-screen bg-bg" />;

  return (
    <>
      <OptionsView
        settings={settings.value}
        ignore={ignore.value}
        model={{ kind: 'unavailable' }}
        inventory={inventory}
        hostPermissions={(browser.runtime.getManifest().host_permissions ?? []) as string[]}
        clearedToast={cleared !== undefined}
        actions={actions}
      />
      <CommandPalette
        open={paletteOpen}
        commands={commands}
        onClose={() => {
          setPaletteOpen(false);
        }}
      />
    </>
  );
}

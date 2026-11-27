import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { accessibleAccent, hexToRgb, readableOn } from '@/core/color';
import { SHORTCUTS } from '@/core/config';
import { t } from '@/core/i18n';
import type { PickMode } from '@/core/messages';
import { DEFAULTS, getState, setState, updateState, watchState, type State, type ThemeSetting } from '@/core/storage';

/**
 * A value from extension storage, kept in sync across the popup, side panel and
 * overlay. `loaded` is false until the first read completes, so pages can avoid
 * flashing an empty state.
 */
export function useStored<K extends keyof State>(
  key: K,
): [value: State[K], update: (next: State[K] | ((current: State[K]) => State[K])) => void, loaded: boolean] {
  const [value, setValue] = useState<State[K]>(DEFAULTS[key]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    void getState(key).then((stored) => {
      if (!live) return;
      setValue(stored);
      setLoaded(true);
    });
    const unwatch = watchState(key, (next) => setValue(next));
    return () => {
      live = false;
      unwatch();
    };
  }, [key]);

  // Function updates run against storage, so a change made meanwhile in another view
  // (or by the in-page picker) is built on rather than overwritten. The local value is
  // updated optimistically; the storage watcher then delivers the stored result.
  const update = useCallback(
    (next: State[K] | ((current: State[K]) => State[K])) => {
      if (typeof next === 'function') {
        const fn = next as (current: State[K]) => State[K];
        setValue(fn);
        void updateState(key, fn);
      } else {
        setValue(next);
        void setState(key, next);
      }
    },
    [key],
  );

  return [value, update, loaded];
}

/**
 * Exposes the inspected colour as a small sample on top of the green UI. The
 * displayed value is lightened on dark surfaces (or darkened on light ones)
 * just enough to stay legible; the picked colour itself is never changed.
 */
export function useLiveAccent(hex?: string | null, theme: ThemeSetting = 'system'): void {
  useEffect(() => {
    const root = document.documentElement;
    const query = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = () => {
      if (!hex) {
        root.style.removeProperty('--pk-sample');
        root.style.removeProperty('--pk-sample-ink');
        return;
      }
      const color = hexToRgb(hex);
      if (!color) return;
      const dark = theme === 'dark' || (theme === 'system' && query.matches);
      const display = accessibleAccent(hex, dark ? '#16161A' : '#F0F0F2', 3);
      root.style.setProperty('--pk-sample', display);
      root.style.setProperty('--pk-sample-ink', readableOn(hexToRgb(display) ?? color));
    };

    apply();
    if (theme === 'system') query.addEventListener('change', apply);
    return () => {
      query.removeEventListener('change', apply);
      root.style.removeProperty('--pk-sample');
      root.style.removeProperty('--pk-sample-ink');
    };
  }, [hex, theme]);
}

/**
 * The picker shortcuts as Chrome actually has them. Users can change or clear them at
 * chrome://extensions/shortcuts, and Chrome skips a default that clashes with another
 * extension, so the manifest defaults are only shown until the real values load.
 * An empty string means no shortcut is set.
 */
export function useShortcuts(): Record<PickMode, string> {
  const [shortcuts, setShortcuts] = useState<Record<PickMode, string>>({ ...SHORTCUTS });
  useEffect(() => {
    let live = true;
    void browser.commands
      .getAll()
      .then((commands) => {
        if (!live) return;
        const find = (name: string) => commands.find((c) => c.name === name)?.shortcut ?? '';
        setShortcuts({ color: find('pick-color'), font: find('inspect-font') });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return shortcuts;
}

/** "Alt+Shift+C", or a note that there is none. For tooltips. */
export const shortcutTitle = (shortcut: string) =>
  shortcut ? t('ui_shortcut_title', shortcut) : t('ui_shortcut_none');

/** Applies the user's theme setting to the page. "system" defers to the OS. */
export function useTheme(): void {
  const [settings] = useStored('settings');
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);
}

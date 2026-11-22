import { useCallback, useEffect, useState } from 'react';
import { accessibleAccent, hexToRgb, readableOn } from '@/core/color';
import { DEFAULTS, getState, setState, watchState, type State, type ThemeSetting } from '@/core/storage';

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

  const update = useCallback(
    (next: State[K] | ((current: State[K]) => State[K])) => {
      setValue((current) => {
        const resolved = typeof next === 'function' ? (next as (c: State[K]) => State[K])(current) : next;
        void setState(key, resolved);
        return resolved;
      });
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
      const display = accessibleAccent(hex, dark ? '#1D2B23' : '#EEF5F0');
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

/** Applies the user's theme setting to the page. "system" defers to the OS. */
export function useTheme(): void {
  const [settings] = useStored('settings');
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);
}

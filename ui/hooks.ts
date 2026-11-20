import { useCallback, useEffect, useState } from 'react';
import { DEFAULTS, getState, setState, watchState, type State } from '@/core/storage';

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

/** Applies the user's theme setting to the page. "system" defers to the OS. */
export function useTheme(): void {
  const [settings] = useStored('settings');
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);
}

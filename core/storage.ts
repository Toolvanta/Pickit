// Typed wrapper around chrome.storage.local. Everything PickKit stores stays on the
// user's device; nothing here talks to a server.

import { browser } from 'wxt/browser';
import type { ColorFormat } from './color';

export type ThemeSetting = 'system' | 'light' | 'dark';

export interface Settings {
  format: ColorFormat;
  upperHex: boolean;
  theme: ThemeSetting;
  historyLimit: number;
}

export interface ColorEntry {
  id: string;
  hex: string;
  ts: number;
  /** Hostname the colour was picked on, or "screen" for the system eyedropper. */
  origin: string;
  /** CSS custom property whose value matched the picked colour, if any. */
  token?: string;
}

export type FontSourceKind = 'google' | 'adobe' | 'hosted' | 'system' | 'generic';

export interface FontEntry {
  id: string;
  ts: number;
  origin: string;
  /** The family judged to be rendering the text. */
  family: string;
  /** False when detection relied on measurement and could be wrong. */
  certain: boolean;
  stack: string;
  size: number;
  weight: number;
  style: string;
  lineHeight: string;
  letterSpacing: string;
  color: string;
  source: FontSourceKind;
  sourceLabel: string;
  link?: string;
}

export interface Palette {
  id: string;
  name: string;
  colors: string[];
  ts: number;
}

export interface Stats {
  picks: number;
  ratingDismissed: boolean;
}

export interface State {
  settings: Settings;
  colors: ColorEntry[];
  fonts: FontEntry[];
  savedFonts: FontEntry[];
  palettes: Palette[];
  stats: Stats;
}

export const DEFAULTS: State = {
  settings: { format: 'hex', upperHex: true, theme: 'system', historyLimit: 100 },
  colors: [],
  fonts: [],
  savedFonts: [],
  palettes: [],
  stats: { picks: 0, ratingDismissed: false },
};

export const HISTORY_LIMITS = [50, 100, 250, 500];
const FONT_HISTORY_LIMIT = 50;

/** Works in insecure contexts too, unlike crypto.randomUUID(). */
export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function getState<K extends keyof State>(key: K): Promise<State[K]> {
  const stored = await browser.storage.local.get(key);
  const value = stored[key] as State[K] | undefined;
  if (value === undefined) return DEFAULTS[key];
  // Settings gain fields over time; fill gaps so old installs keep working.
  if (key === 'settings' || key === 'stats') return { ...DEFAULTS[key], ...value };
  return value;
}

export async function setState<K extends keyof State>(key: K, value: State[K]): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

export async function updateState<K extends keyof State>(
  key: K,
  update: (current: State[K]) => State[K],
): Promise<State[K]> {
  const next = update(await getState(key));
  await setState(key, next);
  return next;
}

/** Subscribes to changes of one key. Returns an unsubscribe function. */
export function watchState<K extends keyof State>(key: K, onChange: (value: State[K]) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area !== 'local' || !(key in changes)) return;
    const value = changes[key].newValue as State[K] | undefined;
    onChange(value === undefined ? DEFAULTS[key] : value);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

/** Adds a picked colour to history. Re-picking a colour moves it to the top instead of duplicating it. */
export async function addColor(entry: Omit<ColorEntry, 'id' | 'ts'>): Promise<void> {
  const { historyLimit } = await getState('settings');
  await updateState('colors', (colors) => {
    const rest = colors.filter((c) => c.hex.toLowerCase() !== entry.hex.toLowerCase());
    return [{ ...entry, id: newId(), ts: Date.now() }, ...rest].slice(0, historyLimit);
  });
  await updateState('stats', (stats) => ({ ...stats, picks: stats.picks + 1 }));
}

const sameFont = (a: FontEntry, b: Omit<FontEntry, 'id' | 'ts'>) =>
  a.family === b.family && a.size === b.size && a.weight === b.weight && a.style === b.style;

export async function addFont(entry: Omit<FontEntry, 'id' | 'ts'>): Promise<void> {
  await updateState('fonts', (fonts) =>
    [{ ...entry, id: newId(), ts: Date.now() }, ...fonts.filter((f) => !sameFont(f, entry))].slice(
      0,
      FONT_HISTORY_LIMIT,
    ),
  );
}

export async function saveFont(entry: Omit<FontEntry, 'id' | 'ts'>): Promise<void> {
  await updateState('savedFonts', (fonts) => [
    { ...entry, id: newId(), ts: Date.now() },
    ...fonts.filter((f) => !sameFont(f, entry)),
  ]);
}

export async function clearAllData(): Promise<void> {
  const settings = await getState('settings');
  await browser.storage.local.clear();
  await setState('settings', settings);
}

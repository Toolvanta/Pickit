// Typed wrapper around chrome.storage.local. Everything Pickit stores stays on the
// user's device; nothing here talks to a server.

import { browser } from 'wxt/browser';
import { COLOR_FORMATS, type ColorFormat } from './color';

export type ThemeSetting = 'system' | 'light' | 'dark';

export interface Settings {
  format: ColorFormat;
  upperHex: boolean;
  theme: ThemeSetting;
  historyLimit: number;
  /** Sync palettes and favourites through chrome.storage.sync. Off unless turned on. */
  sync: boolean;
}

export interface ColorEntry {
  id: string;
  hex: string;
  ts: number;
  /** Hostname the colour was picked on, or "screen" for the system eyedropper. */
  origin: string;
  /** CSS custom property whose value matched the picked colour, if any. */
  token?: string;
  /** Pinned by the user in the history list. */
  favorite?: boolean;
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
  /** Pinned in the recent-font list. Saved fonts are favourites by definition. */
  favorite?: boolean;
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
  settings: { format: 'hex', upperHex: true, theme: 'system', historyLimit: 100, sync: false },
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
  if (key === 'stats') return { ...DEFAULTS[key], ...value };
  if (key === 'settings') {
    const merged = { ...DEFAULTS.settings, ...(value as Settings) };
    // A format removed in a later version must not leave the UI with no selection.
    if (!COLOR_FORMATS.includes(merged.format)) merged.format = DEFAULTS.settings.format;
    return merged as State[K];
  }
  return value;
}

export async function setState<K extends keyof State>(key: K, value: State[K]): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

/**
 * Read-modify-write against what is in storage now, not a possibly stale copy in a
 * React component. Within one origin (the popup, side panel and settings share the
 * extension's), a Web Lock queues concurrent updates so none is lost. The overlay runs
 * in the page's origin, where the lock cannot coordinate, but its read-to-write window
 * is a single storage round trip.
 */
export async function updateState<K extends keyof State>(
  key: K,
  update: (current: State[K]) => State[K],
): Promise<State[K]> {
  const run = async () => {
    const next = update(await getState(key));
    await setState(key, next);
    return next;
  };
  // Only in Pickit's own pages. In a web page (the overlay) the lock would live in the
  // page's origin, where it coordinates nothing and the page itself could hold it.
  const ownPage = typeof location !== 'undefined' && location.protocol === 'chrome-extension:';
  const locks = ownPage && typeof navigator !== 'undefined' ? navigator.locks : undefined;
  return locks ? locks.request(`pickit:${key}`, run) : run();
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

/**
 * Trims history to `limit` by dropping the oldest unpinned entries. Favourites are
 * never dropped, so history can exceed the limit only when favourites alone do.
 */
export function trimHistory<T extends { favorite?: boolean }>(colors: T[], limit: number): T[] {
  let excess = colors.length - limit;
  if (excess <= 0) return colors;
  const drop = new Set<T>();
  for (let i = colors.length - 1; i >= 0 && excess > 0; i--) {
    if (colors[i].favorite) continue;
    drop.add(colors[i]);
    excess -= 1;
  }
  return colors.filter((c) => !drop.has(c));
}

/** Adds a picked colour to history. Re-picking a colour moves it to the top instead of duplicating it. */
export async function addColor(entry: Omit<ColorEntry, 'id' | 'ts'>): Promise<void> {
  const { historyLimit } = await getState('settings');
  await updateState('colors', (colors) => {
    const existing = colors.find((c) => c.hex.toLowerCase() === entry.hex.toLowerCase());
    const rest = colors.filter((c) => c.hex.toLowerCase() !== entry.hex.toLowerCase());
    return trimHistory([{ ...entry, id: newId(), ts: Date.now(), favorite: existing?.favorite }, ...rest], historyLimit);
  });
  await updateState('stats', (stats) => ({ ...stats, picks: stats.picks + 1 }));
}

const sameFont = (a: FontEntry, b: Omit<FontEntry, 'id' | 'ts'>) =>
  a.family === b.family && a.size === b.size && a.weight === b.weight && a.style === b.style;

export async function addFont(entry: Omit<FontEntry, 'id' | 'ts'>): Promise<void> {
  await updateState('fonts', (fonts) => {
    // Re-inspecting a font moves it to the top but keeps it pinned if it was.
    const existing = fonts.find((f) => sameFont(f, entry));
    const next = { ...entry, id: newId(), ts: Date.now(), ...(existing?.favorite ? { favorite: true } : {}) };
    return trimHistory([next, ...fonts.filter((f) => !sameFont(f, entry))], FONT_HISTORY_LIMIT);
  });
}

export async function saveFont(entry: Omit<FontEntry, 'id' | 'ts'>): Promise<void> {
  await updateState('savedFonts', (fonts) => [
    { ...entry, id: newId(), ts: Date.now() },
    ...fonts.filter((f) => !sameFont(f, entry)),
  ]);
}

/** Pins or unpins a colour without changing its place in history. */
export async function toggleColorFavorite(id: string): Promise<void> {
  await updateState('colors', (colors) =>
    colors.map((color) => (color.id === id ? { ...color, favorite: !color.favorite } : color)),
  );
}

/** Pins or unpins a recently inspected font. Saved fonts stay saved independently. */
export async function toggleFontFavorite(id: string): Promise<void> {
  await updateState('fonts', (fonts) => fonts.map((font) => (font.id === id ? { ...font, favorite: !font.favorite } : font)));
}

/** Everything Pickit stores, with defaults filled in. Used for backups. */
export async function getAllState(): Promise<State> {
  const keys = Object.keys(DEFAULTS) as (keyof State)[];
  const entries = await Promise.all(keys.map(async (key) => [key, await getState(key)] as const));
  return Object.fromEntries(entries) as unknown as State;
}

/** Replaces everything Pickit stores, e.g. when restoring a backup. */
export async function replaceAllState(state: State): Promise<void> {
  // Write first, then drop keys the backup does not have. Clearing first would leave a
  // moment with no settings, which other views and the sync engine would see.
  await browser.storage.local.set(state);
  const stale = Object.keys(await browser.storage.local.get(null)).filter((key) => !(key in state));
  if (stale.length) await browser.storage.local.remove(stale);
}

/** Removes history, fonts, palettes and stats from this device. Settings stay, and so does synced data elsewhere. */
export async function clearAllData(): Promise<void> {
  const keys = Object.keys(await browser.storage.local.get(null)).filter((key) => key !== 'settings');
  if (keys.length) await browser.storage.local.remove(keys);
}

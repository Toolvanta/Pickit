// Optional sync of palettes and favourite colours through chrome.storage.sync, so they
// follow the person to every Chrome where they are signed in. Off by default.
//
// Layout in storage.sync (quota: 100 KB total, 8 KB per item, 512 items):
//   'p:<palette id>' -> one palette per item, so palettes merge independently
//   'favs'           -> the favourite colours as one list
// History and fonts stay local: they are large, change constantly and are rarely
// wanted on another machine.
//
// Everything here is pure; background.ts wires it to the storage events.

import type { ColorEntry, Palette } from './storage';

export const PALETTE_PREFIX = 'p:';
export const FAVOURITES_KEY = 'favs';
/** Per-item limit is 8192 bytes including the key; leave room for JSON overhead. */
const ITEM_LIMIT = 8000;

export interface SyncedFavourite {
  hex: string;
  token?: string;
  origin: string;
}

export const paletteKey = (id: string) => `${PALETTE_PREFIX}${id}`;
export const isPaletteKey = (key: string) => key.startsWith(PALETTE_PREFIX);

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Palettes added or edited, and ids removed, between two local snapshots. */
export function paletteChanges(before: Palette[], after: Palette[]): { upserts: Palette[]; removals: string[] } {
  const old = new Map(before.map((p) => [p.id, p]));
  const next = new Set(after.map((p) => p.id));
  return {
    upserts: after.filter((p) => !same(old.get(p.id), p)),
    removals: before.filter((p) => !next.has(p.id)).map((p) => p.id),
  };
}

/** Inserts or replaces a palette that arrived from another device. Order is kept; new ones go last. */
export function upsertPalette(list: Palette[], incoming: Palette): Palette[] {
  // Another device or an older version may send repeated colours; keep each once.
  const palette = { ...incoming, colors: [...new Set(incoming.colors)] };
  const index = list.findIndex((p) => p.id === palette.id);
  if (index === -1) return [...list, palette];
  if (same(list[index], palette)) return list;
  const copy = [...list];
  copy[index] = palette;
  return copy;
}

export function removePalette(list: Palette[], id: string): Palette[] {
  return list.some((p) => p.id === id) ? list.filter((p) => p.id !== id) : list;
}

/** The favourites part of history, in a stable order, as stored in sync. */
export function favouritesOf(colors: ColorEntry[]): SyncedFavourite[] {
  const seen = new Set<string>();
  const result: SyncedFavourite[] = [];
  for (const c of colors) {
    const hex = c.hex.toUpperCase();
    if (!c.favorite || seen.has(hex)) continue;
    seen.add(hex);
    result.push(c.token ? { hex, token: c.token, origin: c.origin } : { hex, origin: c.origin });
  }
  return result.sort((a, b) => a.hex.localeCompare(b.hex));
}

/**
 * Makes local history agree with a favourites list from another device: colours in the
 * list become favourites (added to history if missing), others lose the flag.
 */
export function applyFavourites(colors: ColorEntry[], favourites: SyncedFavourite[], newId: () => string): ColorEntry[] {
  const wanted = new Map(favourites.map((f) => [f.hex.toUpperCase(), f]));
  let changed = false;
  const next = colors.map((c) => {
    const fav = wanted.has(c.hex.toUpperCase());
    if (Boolean(c.favorite) === fav) return c;
    changed = true;
    const { favorite: _drop, ...rest } = c;
    return fav ? { ...rest, favorite: true } : rest;
  });
  const present = new Set(colors.map((c) => c.hex.toUpperCase()));
  const missing = favourites.filter((f) => !present.has(f.hex.toUpperCase()));
  if (!missing.length && !changed) return colors;
  return [
    ...next,
    ...missing.map((f) => ({ id: newId(), ts: Date.now(), hex: f.hex, origin: f.origin, ...(f.token ? { token: f.token } : {}), favorite: true })),
  ];
}

/** Union of two favourite lists, used when sync is first turned on so nothing is lost. */
export function mergeFavourites(a: SyncedFavourite[], b: SyncedFavourite[]): SyncedFavourite[] {
  const byHex = new Map<string, SyncedFavourite>();
  for (const f of [...b, ...a]) byHex.set(f.hex.toUpperCase(), { ...f, hex: f.hex.toUpperCase() });
  return [...byHex.values()].sort((x, y) => x.hex.localeCompare(y.hex));
}

/** Whether a value fits in one storage.sync item. */
export function fitsItem(key: string, value: unknown): boolean {
  return new TextEncoder().encode(key + JSON.stringify(value)).length <= ITEM_LIMIT;
}

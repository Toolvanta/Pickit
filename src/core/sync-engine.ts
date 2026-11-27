// Runs in the background worker. Mirrors palettes and favourites between
// storage.local (what the UI reads) and storage.sync (what Chrome copies between
// devices) while the "Sync" setting is on. Listeners are registered synchronously at
// worker start-up, so a storage change wakes the worker even after it has gone idle.
//
// Ordering rules that keep the two sides from fighting:
//   - Every handler runs through one queue, so events are applied in the order they
//     arrived and never interleave.
//   - Local edits are pushed after a short pause (typing a palette name is one write,
//     not one per keystroke), which also keeps within sync's write-rate limit.
//   - storage.sync reports our own writes back to us. A sync event whose value is what
//     this device last pushed is that echo and is ignored; so is any remote value for a
//     key with a local edit still waiting to be pushed (the local edit is newer).

import { browser } from 'wxt/browser';
import { getState, newId, updateState, type ColorEntry, type Palette, type Settings } from './storage';
import {
  applyFavourites,
  FAVOURITES_KEY,
  favouritesOf,
  fitsItem,
  isPaletteKey,
  mergeFavourites,
  paletteChanges,
  paletteKey,
  PALETTE_PREFIX,
  removePalette,
  upsertPalette,
  type SyncedFavourite,
} from './sync';

/** Last problem talking to storage.sync, shown in Settings. Not part of State: it is not user data. */
export const SYNC_STATUS_KEY = 'syncStatus';
export interface SyncStatus {
  ok: boolean;
  at: number;
  error?: 'quota' | 'too-large' | 'unavailable';
}

const PUSH_DELAY_MS = 800;
const json = (v: unknown) => JSON.stringify(v ?? null);

/** Serialises all sync work. */
let queue: Promise<unknown> = Promise.resolve();
const enqueue = (task: () => Promise<void>) => {
  queue = queue.then(task).catch(() => {});
  return queue;
};

/** What this device last wrote to each sync key (JSON), to recognise echoes. */
const lastPushed = new Map<string, string>();
/** Local edits waiting to be pushed: key -> value (undefined = remove). */
const pending = new Map<string, unknown>();
let pushTimer: ReturnType<typeof setTimeout> | undefined;

async function setStatus(status: Omit<SyncStatus, 'at'>): Promise<void> {
  await browser.storage.local.set({ [SYNC_STATUS_KEY]: { ...status, at: Date.now() } });
}

async function syncEnabled(): Promise<boolean> {
  return (await getState('settings')).sync;
}

async function flush(): Promise<void> {
  if (!pending.size) return;
  const batch = new Map(pending);
  pending.clear();
  const sets: Record<string, unknown> = {};
  const removes: string[] = [];
  for (const [key, value] of batch) {
    if (value === undefined) removes.push(key);
    else if (fitsItem(key, value)) sets[key] = value;
    else await setStatus({ ok: false, error: 'too-large' });
  }
  try {
    const current = await browser.storage.sync.get([...Object.keys(sets), ...removes]);
    const changed = Object.fromEntries(Object.entries(sets).filter(([key, value]) => json(current[key]) !== json(value)));
    const remove = removes.filter((key) => key in current);
    for (const [key, value] of Object.entries(changed)) lastPushed.set(key, json(value));
    for (const key of remove) lastPushed.set(key, json(undefined));
    if (Object.keys(changed).length) await browser.storage.sync.set(changed);
    if (remove.length) await browser.storage.sync.remove(remove);
    await setStatus({ ok: true });
  } catch (error) {
    const message = String((error as Error)?.message ?? error);
    await setStatus({ ok: false, error: /quota|MAX_WRITE/i.test(message) ? 'quota' : 'unavailable' });
  }
}

function schedulePush(items: Record<string, unknown>, removals: string[] = []): void {
  // A value sync already holds needs no push. This is also how changes that arrived from
  // another device (and were just written locally) avoid being queued as "local edits",
  // which would make the engine ignore the next remote change to the same key.
  for (const [key, value] of Object.entries(items)) {
    if (lastPushed.get(key) !== json(value)) pending.set(key, value);
  }
  for (const key of removals) {
    if (lastPushed.get(key) !== json(undefined)) pending.set(key, undefined);
  }
  if (!pending.size) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void enqueue(flush), PUSH_DELAY_MS);
}

/** First run after sync is turned on: merge both sides so nothing on either is lost. */
async function initialMerge(): Promise<void> {
  let remote: Record<string, unknown>;
  try {
    remote = await browser.storage.sync.get(null);
  } catch {
    await setStatus({ ok: false, error: 'unavailable' });
    return;
  }
  const remotePalettes = Object.entries(remote)
    .filter(([key]) => isPaletteKey(key))
    .map(([, value]) => value as Palette);
  const remoteFavs = (remote[FAVOURITES_KEY] as SyncedFavourite[] | undefined) ?? [];

  // Palettes on another device but not here are added; where both have one, this
  // device's copy wins and is pushed.
  const palettes = await updateState('palettes', (local) =>
    remotePalettes.reduce((list, p) => (list.some((l) => l.id === p.id) ? list : upsertPalette(list, p)), local),
  );
  const favourites = mergeFavourites(favouritesOf(await getState('colors')), remoteFavs);
  await updateState('colors', (local) => applyFavourites(local, favourites, newId));
  schedulePush({ ...Object.fromEntries(palettes.map((p) => [paletteKey(p.id), p])), [FAVOURITES_KEY]: favourites });
}

type Changes = Record<string, { oldValue?: unknown; newValue?: unknown }>;

async function onLocalChange(changes: Changes): Promise<void> {
  if (changes.settings) {
    const before = changes.settings.oldValue as Settings | undefined;
    const after = changes.settings.newValue as Settings | undefined;
    // Only an actual switch from off to on. A settings write after "Clear data" or a
    // restore has no old value and must not pull remote data back in.
    if (before && !before.sync && after?.sync) await initialMerge();
  }
  if (!(await syncEnabled())) return;
  // A key that disappears entirely means this device's data was cleared. That is
  // local housekeeping, not a request to delete palettes everywhere.
  if (changes.palettes && changes.palettes.newValue !== undefined) {
    const { upserts, removals } = paletteChanges(
      (changes.palettes.oldValue as Palette[] | undefined) ?? [],
      changes.palettes.newValue as Palette[],
    );
    schedulePush(Object.fromEntries(upserts.map((p) => [paletteKey(p.id), p])), removals.map(paletteKey));
  }
  if (changes.colors && changes.colors.newValue !== undefined) {
    const before = favouritesOf((changes.colors.oldValue as ColorEntry[] | undefined) ?? []);
    const after = favouritesOf(changes.colors.newValue as ColorEntry[]);
    if (json(before) !== json(after)) schedulePush({ [FAVOURITES_KEY]: after });
  }
}

async function onSyncChange(changes: Changes): Promise<void> {
  if (!(await syncEnabled())) return;
  for (const [key, change] of Object.entries(changes)) {
    const incoming = json(change.newValue);
    if (lastPushed.get(key) === incoming) continue; // our own write coming back
    if (pending.has(key)) continue; // a newer local edit is about to overwrite it
    if (isPaletteKey(key)) {
      const id = key.slice(PALETTE_PREFIX.length);
      const palette = change.newValue as Palette | undefined;
      await updateState('palettes', (list) => (palette ? upsertPalette(list, palette) : removePalette(list, id)));
    } else if (key === FAVOURITES_KEY) {
      const favourites = (change.newValue as SyncedFavourite[] | undefined) ?? [];
      await updateState('colors', (list) => applyFavourites(list, favourites, newId));
    }
    lastPushed.set(key, incoming);
  }
}

export function startSync(): void {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') void enqueue(() => onLocalChange(changes as Changes));
    else if (area === 'sync') void enqueue(() => onSyncChange(changes as Changes));
  });
}

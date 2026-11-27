import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { browser } from 'wxt/browser';
import { startSync } from '../src/core/sync-engine';
import { clearAllData, DEFAULTS, getState, setState, type Palette } from '../src/core/storage';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const PUSHED = 1100; // push delay is 800 ms
const pal = (id: string, name: string): Palette => ({ id, name, colors: ['#000000'], ts: 1 });

describe('sync engine', () => {
  beforeAll(() => startSync());

  beforeEach(async () => {
    await browser.storage.local.clear();
    await browser.storage.sync.clear();
    await setState('settings', { ...DEFAULTS.settings, sync: false });
    await wait(20);
  });

  it('pushes local palettes once sync is turned on, then each edit after a pause', async () => {
    await setState('palettes', [pal('a', 'Brand')]);
    await setState('settings', { ...DEFAULTS.settings, sync: true });
    await wait(PUSHED);
    expect(await browser.storage.sync.get('p:a')).toEqual({ 'p:a': pal('a', 'Brand') });

    // Rapid edits, like typing a name, become one push with the final value.
    for (const name of ['B', 'Br', 'Bra', 'Bran', 'Brand 2']) await setState('palettes', [pal('a', name)]);
    await wait(PUSHED);
    expect(((await browser.storage.sync.get('p:a'))['p:a'] as Palette).name).toBe('Brand 2');
    // And the echo of that push did not roll the local copy back.
    expect((await getState('palettes'))[0].name).toBe('Brand 2');
  });

  it('applies changes from another device', async () => {
    await setState('settings', { ...DEFAULTS.settings, sync: true });
    await wait(PUSHED);
    await browser.storage.sync.set({ 'p:z': pal('z', 'From laptop') });
    await wait(50);
    expect((await getState('palettes')).map((p) => p.name)).toEqual(['From laptop']);
    await browser.storage.sync.remove('p:z');
    await wait(50);
    expect(await getState('palettes')).toEqual([]);
  });

  it('keeps synced palettes on other devices when this device clears its data', async () => {
    await setState('palettes', [pal('a', 'Brand')]);
    await setState('settings', { ...DEFAULTS.settings, sync: true });
    await wait(PUSHED);
    await clearAllData();
    await wait(PUSHED);
    expect(await getState('palettes')).toEqual([]);
    expect(Object.keys(await browser.storage.sync.get(null))).toContain('p:a');
    expect((await getState('settings')).sync).toBe(true);
  });

  it('does nothing while sync is off', async () => {
    await setState('palettes', [pal('a', 'Brand')]);
    await wait(PUSHED);
    expect(await browser.storage.sync.get(null)).toEqual({});
    await browser.storage.sync.set({ 'p:z': pal('z', 'Elsewhere') });
    await wait(50);
    expect((await getState('palettes')).map((p) => p.id)).toEqual(['a']);
  });
}, 15000);




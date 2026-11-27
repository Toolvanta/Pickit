import { describe, expect, it } from 'vitest';
import type { ColorEntry, Palette } from '../src/core/storage';
import {
  applyFavourites,
  favouritesOf,
  fitsItem,
  mergeFavourites,
  paletteChanges,
  removePalette,
  upsertPalette,
} from '../src/core/sync';

const pal = (id: string, colors: string[] = ['#000000']): Palette => ({ id, name: id, colors, ts: 1 });
const col = (id: string, hex: string, favorite = false): ColorEntry => ({ id, hex, ts: 1, origin: 'x', ...(favorite ? { favorite } : {}) });
let n = 0;
const nextId = () => `new${++n}`;

describe('palette sync', () => {
  it('reports edits, additions and deletions between snapshots', () => {
    const before = [pal('a'), pal('b'), pal('c')];
    const after = [pal('a'), pal('b', ['#FFFFFF']), pal('d')];
    const { upserts, removals } = paletteChanges(before, after);
    expect(upserts.map((p) => p.id)).toEqual(['b', 'd']);
    expect(removals).toEqual(['c']);
  });
  it('applies remote palettes in place and appends new ones', () => {
    const list = [pal('a'), pal('b')];
    expect(upsertPalette(list, pal('b', ['#FFFFFF'])).map((p) => p.colors[0])).toEqual(['#000000', '#FFFFFF']);
    expect(upsertPalette(list, pal('c')).map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(upsertPalette(list, pal('a'))).toBe(list);
    expect(removePalette(list, 'a').map((p) => p.id)).toEqual(['b']);
    expect(removePalette(list, 'zzz')).toBe(list);
  });
  it('checks the per-item quota', () => {
    expect(fitsItem('p:x', pal('x'))).toBe(true);
    expect(fitsItem('p:x', pal('x', Array(1200).fill('#000000')))).toBe(false);
  });
});

describe('favourite sync', () => {
  it('lists favourites once, upper-cased and sorted', () => {
    const favs = favouritesOf([col('1', '#ff0000', true), col('2', '#00FF00'), col('3', '#FF0000', true), col('4', '#0000ff', true)]);
    expect(favs.map((f) => f.hex)).toEqual(['#0000FF', '#FF0000']);
  });
  it('marks, unmarks and adds colours to match another device', () => {
    const local = [col('1', '#FF0000', true), col('2', '#00FF00')];
    const next = applyFavourites(local, [{ hex: '#00FF00', origin: 'x' }, { hex: '#123456', origin: 'y' }], nextId);
    expect(next.find((c) => c.hex === '#FF0000')?.favorite).toBeUndefined();
    expect(next.find((c) => c.hex === '#00FF00')?.favorite).toBe(true);
    expect(next.find((c) => c.hex === '#123456')).toMatchObject({ favorite: true, origin: 'y' });
  });
  it('returns the same list when nothing changes, so no write echoes back', () => {
    const local = [col('1', '#FF0000', true)];
    expect(applyFavourites(local, [{ hex: '#ff0000', origin: 'x' }], nextId)).toBe(local);
  });
  it('merges both sides when sync is first turned on', () => {
    expect(mergeFavourites([{ hex: '#aa0000', origin: 'a' }], [{ hex: '#AA0000', origin: 'b' }, { hex: '#00AA00', origin: 'b' }]).map((f) => f.hex)).toEqual([
      '#00AA00',
      '#AA0000',
    ]);
  });
});

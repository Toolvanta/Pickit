import { describe, expect, it } from 'vitest';
import { addFont, getState, setState, toggleFontFavorite, trimHistory, type ColorEntry } from '../src/core/storage';

const entry = (id: string, favorite = false): ColorEntry => ({ id, hex: '#000000', ts: 0, origin: 'test', favorite });
const ids = (colors: ColorEntry[]) => colors.map((c) => c.id);

describe('trimHistory', () => {
  it('leaves history under the limit alone', () => {
    const colors = [entry('a'), entry('b')];
    expect(trimHistory(colors, 5)).toBe(colors);
  });
  it('drops the oldest entries first', () => {
    expect(ids(trimHistory([entry('a'), entry('b'), entry('c'), entry('d')], 2))).toEqual(['a', 'b']);
  });
  it('never drops favourites, removing the oldest unpinned entries instead', () => {
    const colors = [entry('a'), entry('b'), entry('c', true), entry('d'), entry('e', true)];
    expect(ids(trimHistory(colors, 3))).toEqual(['a', 'c', 'e']);
  });
  it('keeps every favourite even when they alone exceed the limit', () => {
    const colors = [entry('a'), entry('b', true), entry('c', true), entry('d', true)];
    expect(ids(trimHistory(colors, 2))).toEqual(['b', 'c', 'd']);
  });
});

describe('font history', () => {
  const font = (family: string) => ({
    origin: 'x', family, certain: true, stack: family, size: 16, weight: 400, style: 'normal',
    lineHeight: '1.5', letterSpacing: 'normal', color: '#000000', source: 'google' as const, sourceLabel: 'Google Fonts',
  });
  it('keeps a font pinned when it is inspected again, and never trims favourites', async () => {
    await setState('fonts', []);
    await addFont(font('Inter'));
    const [inter] = await getState('fonts');
    await toggleFontFavorite(inter.id);
    await addFont(font('Inter'));
    expect((await getState('fonts'))[0]).toMatchObject({ family: 'Inter', favorite: true });
    for (let i = 0; i < 60; i++) await addFont(font(`Font ${i}`));
    const fonts = await getState('fonts');
    expect(fonts.length).toBe(50);
    expect(fonts.some((f) => f.family === 'Inter' && f.favorite)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { parseBackup, serializeBackup } from '../src/core/backup';
import { DEFAULTS, type State } from '../src/core/storage';

const state: State = {
  ...DEFAULTS,
  settings: { format: 'oklch', upperHex: false, theme: 'dark', historyLimit: 250, sync: true },
  colors: [{ id: 'a', hex: '#3B5BDB', ts: 1, origin: 'example.com', token: '--brand', favorite: true }],
  palettes: [{ id: 'p', name: 'Brand', colors: ['#3B5BDB', '#E8590C'], ts: 2 }],
  stats: { picks: 12, ratingDismissed: true },
};

describe('backups', () => {
  it('round-trips everything Pickit stores', () => {
    const result = parseBackup(serializeBackup(state));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state).toEqual(state);
    expect(result.counts).toEqual({ colors: 1, fonts: 0, palettes: 1 });
  });

  it('rejects files that are not Pickit backups', () => {
    expect(parseBackup('not json').ok).toBe(false);
    expect(parseBackup('{"hello":1}').ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'pickit', version: 99, data: {} })).ok).toBe(false);
  });

  it('drops malformed entries and unsafe values instead of trusting them', () => {
    const text = JSON.stringify({
      app: 'pickit',
      version: 1,
      data: {
        settings: { format: 'cmyk', theme: 'neon', historyLimit: 7, upperHex: 'yes' },
        colors: [{ hex: 'not-a-colour' }, { hex: '#abc', origin: 'x' }, 'junk'],
        fonts: [{ family: 'Inter', size: 16, weight: 400, link: 'javascript:alert(1)', source: 'evil' }],
        palettes: [{ name: 'P', colors: ['#fff', 'red', 42] }],
      },
    });
    const result = parseBackup(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.settings).toEqual(DEFAULTS.settings);
    expect(result.state.colors.map((c) => c.hex)).toEqual(['#AABBCC']);
    expect(result.state.fonts[0].link).toBeUndefined();
    expect(result.state.fonts[0].source).toBe('generic');
    expect(result.state.palettes[0].colors).toEqual(['#FFFFFF']);
  });
});

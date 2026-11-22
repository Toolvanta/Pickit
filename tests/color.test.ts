import { describe, expect, it } from 'vitest';
import {
  contrastRatio, formatColor, hexToRgb, nearestColorName, oklchToRgb, parseColor, rgbToHex, rgbToHsl,
  rgbToOklch, sameColor, shades, wcag,
} from '../src/core/color';

const red = { r: 255, g: 0, b: 0, a: 1 };
const white = { r: 255, g: 255, b: 255, a: 1 };
const black = { r: 0, g: 0, b: 0, a: 1 };

describe('hex', () => {
  it('parses short, long and alpha forms', () => {
    expect(hexToRgb('#f00')).toEqual(red);
    expect(hexToRgb('FF0000')).toEqual(red);
    expect(hexToRgb('#ff000080')?.a).toBeCloseTo(0.502, 2);
    expect(hexToRgb('#12')).toBeNull();
    expect(hexToRgb('#gggggg')).toBeNull();
  });
  it('formats with case and alpha', () => {
    expect(rgbToHex(red)).toBe('#FF0000');
    expect(rgbToHex(red, false)).toBe('#ff0000');
    expect(rgbToHex({ ...red, a: 0.5 })).toBe('#FF000080');
  });
});

describe('conversions', () => {
  it('converts to HSL', () => {
    expect(rgbToHsl(red)).toEqual({ h: 0, s: 100, l: 50 });
    expect(rgbToHsl({ r: 128, g: 128, b: 128, a: 1 }).s).toBe(0);
  });
  it('matches the reference OKLCH value for red', () => {
    const { l, c, h } = rgbToOklch(red);
    expect(l).toBeCloseTo(0.628, 3);
    expect(c).toBeCloseTo(0.2577, 3);
    expect(h).toBeCloseTo(29.23, 1);
  });
  it('round-trips through OKLCH', () => {
    for (const hex of ['#5548E0', '#17794A', '#FBBF24', '#000000', '#FFFFFF', '#808080']) {
      const source = hexToRgb(hex)!;
      const { l, c, h } = rgbToOklch(source);
      expect(sameColor(oklchToRgb(l, c, h), source, 1)).toBe(true);
    }
  });
  it('clamps out-of-gamut OKLCH into sRGB', () => {
    const c = oklchToRgb(0.7, 0.4, 150);
    for (const v of [c.r, c.g, c.b]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
  });
});

describe('formatColor', () => {
  it('writes each format', () => {
    expect(formatColor(red, 'hex')).toBe('#FF0000');
    expect(formatColor(red, 'rgb')).toBe('rgb(255, 0, 0)');
    expect(formatColor(red, 'hsl')).toBe('hsl(0, 100%, 50%)');
    expect(formatColor(red, 'oklch')).toBe('oklch(62.8% 0.258 29.2)');
    expect(formatColor({ ...red, a: 0.5 }, 'rgb')).toBe('rgba(255, 0, 0, 0.5)');
  });
});

describe('parseColor', () => {
  it('reads the syntaxes found in computed styles and tokens', () => {
    expect(parseColor('rgb(255, 0, 0)')).toEqual(red);
    expect(parseColor('rgba(255, 0, 0, 0.5)')?.a).toBe(0.5);
    expect(parseColor('rgb(255 0 0 / 50%)')?.a).toBe(0.5);
    expect(parseColor('hsl(0, 100%, 50%)')).toEqual(red);
    expect(parseColor('color(srgb 1 0 0)')).toEqual(red);
    expect(parseColor('0 100% 50%')).toEqual(red);
    expect(parseColor('Red')).toEqual(red);
    expect(parseColor('rebeccapurple')).toEqual({ r: 102, g: 51, b: 153, a: 1 });
    expect(parseColor('transparent')?.a).toBe(0);
    expect(sameColor(parseColor('oklch(62.8% 0.2577 29.23)')!, red, 1)).toBe(true);
  });
  it('rejects non-colours', () => {
    for (const value of ['', 'banana', '12px', 'rgb(1, 2)', 'url(x.png)']) expect(parseColor(value)).toBeNull();
  });
});

describe('contrast', () => {
  it('computes WCAG ratios', () => {
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5);
    expect(contrastRatio(white, white)).toBe(1);
    expect(contrastRatio(hexToRgb('#767676')!, white)).toBeCloseTo(4.54, 2);
  });
  it('applies the thresholds', () => {
    expect(wcag(4.5)).toEqual({ aaNormal: true, aaLarge: true, aaaNormal: false, aaaLarge: true });
    expect(wcag(2.9)).toEqual({ aaNormal: false, aaLarge: false, aaaNormal: false, aaaLarge: false });
  });
  it('flattens translucent text onto the background first', () => {
    expect(contrastRatio({ ...black, a: 0 }, white)).toBe(1);
  });
});

describe('shades and names', () => {
  it('builds an 11-step scale from light to dark', () => {
    const scale = shades(hexToRgb('#5548E0')!);
    expect(scale.map((s) => s.step)).toEqual([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);
    const lightness = scale.map((s) => rgbToOklch(hexToRgb(s.hex)!).l);
    for (let i = 1; i < lightness.length; i++) expect(lightness[i]).toBeLessThan(lightness[i - 1]);
  });
  it('names colours', () => {
    expect(nearestColorName(red)).toBe('Red');
    expect(nearestColorName(hexToRgb('#6A5ACD')!)).toBe('Slate Blue');
    expect(nearestColorName(hexToRgb('#FEFEFE')!)).toBe('White');
  });
});

import { describe, expect, it } from 'vitest';
import {
  accessibleAccent, contrastRatio, formatColor, hexToRgb, nearestColorName, parseColor, rgbToHex,
  rgbToHsl, shades, wcag,
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
});

describe('formatColor', () => {
  it('writes each format', () => {
    expect(formatColor(red, 'hex')).toBe('#FF0000');
    expect(formatColor(red, 'rgb')).toBe('rgb(255, 0, 0)');
    expect(formatColor(red, 'hsl')).toBe('hsl(0, 100%, 50%)');
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
  });
  it('rejects non-colours', () => {
    for (const value of ['', 'banana', '12px', 'rgb(1, 2)', 'url(x.png)', 'oklch(62.8% 0.258 29.2)']) {
      expect(parseColor(value)).toBeNull();
    }
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
  it('keeps the live accent readable on each theme surface', () => {
    const dark = accessibleAccent('#5548E0', '#262624');
    expect(contrastRatio(hexToRgb(dark)!, hexToRgb('#262624')!)).toBeGreaterThanOrEqual(4.5);
    expect(rgbToHsl(hexToRgb(dark)!).h).toBeCloseTo(rgbToHsl(hexToRgb('#5548E0')!).h, 0);
    const light = accessibleAccent('#FBBF24', '#F4F3EF');
    expect(contrastRatio(hexToRgb(light)!, hexToRgb('#F4F3EF')!)).toBeGreaterThanOrEqual(4.5);
    expect(accessibleAccent('#5548E0', '#F4F3EF')).toBe('#5548E0');
  });
});

describe('shades and names', () => {
  it('builds an 11-step scale from light to dark', () => {
    const scale = shades(hexToRgb('#5548E0')!);
    expect(scale.map((s) => s.step)).toEqual([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);
    const lightness = scale.map((s) => rgbToHsl(hexToRgb(s.hex)!).l);
    for (let i = 1; i < lightness.length; i++) expect(lightness[i]).toBeLessThan(lightness[i - 1]);
  });
  it('names colours', () => {
    expect(nearestColorName(red)).toBe('Red');
    expect(nearestColorName(hexToRgb('#6A5ACD')!)).toBe('Slate Blue');
    expect(nearestColorName(hexToRgb('#FEFEFE')!)).toBe('White');
  });
});

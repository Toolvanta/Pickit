import { describe, expect, it } from 'vitest';
import {
  accessibleAccent, contrastRatio, formatColor, hexToRgb, nearestColorName, parseColor, rgbToHex,
  apcaContrast, rgbToHsl, sameColor, shades, simulateVision, suggestContrastFix, wcag,
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
    for (const value of ['', 'banana', '12px', 'rgb(1, 2)', 'url(x.png)', 'oklch(0.5 0.1)', 'color(rec2020 1 0 0)']) {
      expect(parseColor(value)).toBeNull();
    }
  });
  it('reads modern colour spaces as Chrome serialises them', () => {
    const near = (value: string, expected: { r: number; g: number; b: number }) => {
      const parsed = parseColor(value);
      expect(parsed, value).not.toBeNull();
      expect(sameColor(parsed!, { ...expected, a: 1 }), `${value} → ${JSON.stringify(parsed)}`).toBe(true);
    };
    near('oklch(0.627955 0.257683 29.2339)', red);
    near('oklch(62.7955% 0.257683 29.2339deg)', red);
    near('oklab(0.627955 0.224863 0.125846)', red);
    near('lab(54.2917 80.8125 69.8851)', red);
    near('lch(54.2917 106.839 40.8526)', red);
    near('oklch(1 0 0)', white);
    near('oklch(0 0 none)', black);
    near('color(srgb-linear 0.21586 0.21586 0.21586)', { r: 128, g: 128, b: 128 });
    near('color(display-p3 1 0 0)', red); // Wider than sRGB: clipped.
    near('color(xyz-d65 0.95046 1 1.08906)', white);
    expect(parseColor('oklch(0.7 0.1 0.5turn)')).toEqual(parseColor('oklch(0.7 0.1 180)'));
    expect(parseColor('oklch(0.7 0.1 200 / 0.5)')?.a).toBe(0.5);
    expect(parseColor('hsl(120deg 100% 25%)')).toEqual({ r: 0, g: 128, b: 0, a: 1 });
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

describe('oklch output', () => {
  it('formats sRGB colours as CSS oklch()', () => {
    expect(formatColor(red, 'oklch')).toBe('oklch(62.8% 0.2577 29.23)');
    expect(formatColor(white, 'oklch')).toBe('oklch(100% 0 0)');
    expect(formatColor({ ...red, a: 0.5 }, 'oklch')).toBe('oklch(62.8% 0.2577 29.23 / 0.5)');
  });
  it('round-trips through parseColor', () => {
    for (const hex of ['#3B5BDB', '#E8590C', '#2B8A3E', '#808080']) {
      const rgb = hexToRgb(hex)!;
      expect(sameColor(parseColor(formatColor(rgb, 'oklch'))!, rgb)).toBe(true);
    }
  });
});

describe('apca', () => {
  it('matches the APCA reference values', () => {
    expect(apcaContrast(black, white)).toBeCloseTo(106.04, 1);
    expect(apcaContrast(white, black)).toBeCloseTo(-107.88, 1);
    expect(apcaContrast(hexToRgb('#888888')!, white)).toBeCloseTo(63.06, 1);
    expect(apcaContrast(white, white)).toBe(0);
  });
});

describe('simulateVision', () => {
  it('keeps neutrals neutral and collapses red-green for protanopia', () => {
    expect(sameColor(simulateVision(white, 'protanopia'), white)).toBe(true);
    const red2 = simulateVision(red, 'deuteranopia');
    const green = simulateVision({ r: 0, g: 160, b: 0, a: 1 }, 'deuteranopia');
    // Both read as olive/yellow-ish: blue channel stays low and red ~ green.
    expect(Math.abs(red2.r - red2.g)).toBeLessThan(140);
    expect(Math.abs(green.r - green.g)).toBeLessThan(60);
    const grey = simulateVision(red, 'achromatopsia');
    expect(grey.r).toBe(grey.g);
    expect(grey.g).toBe(grey.b);
  });
});

describe('suggestContrastFix', () => {
  it('returns a passing colour close to the original', () => {
    for (const [fgHex, bgHex] of [['#8FA3FF', '#FFFFFF'], ['#3B5BDB', '#17171C'], ['#F59F00', '#FFFFFF'], ['#777777', '#808080']]) {
      const fg = hexToRgb(fgHex)!;
      const bg = hexToRgb(bgHex)!;
      const fix = suggestContrastFix(fg, bg, 4.5);
      expect(fix, fgHex).not.toBeNull();
      expect(contrastRatio(fix!, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('returns the colour unchanged when it already passes', () => {
    expect(suggestContrastFix(black, white)).toEqual(black);
  });
  it('returns null when no lightness can reach the target', () => {
    expect(suggestContrastFix(red, hexToRgb('#777777')!, 21)).toBeNull();
  });
});

describe('nearestColorName (OKLab)', () => {
  it('names colours perceptually', () => {
    expect(nearestColorName(red)).toBe('Red');
    expect(nearestColorName(hexToRgb('#0F0F10')!)).toBe('Black');
    expect(nearestColorName(hexToRgb('#3B5BDB')!)).toMatch(/Blue/);
  });
});

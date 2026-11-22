// Colour maths shared by the overlay, popup and side panel.
// Pure functions only: no DOM, so everything here is unit-testable.

import { COLOR_NAMES } from './color-names';

/** r, g, b in 0–255; a in 0–1. */
export interface RGB {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type ColorFormat = 'hex' | 'rgb' | 'hsl';
export const COLOR_FORMATS: ColorFormat[] = ['hex', 'rgb', 'hsl'];

export interface FormatOptions {
  upperHex?: boolean;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round = (n: number, places = 0) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

/** sRGB gamma expansion, shared by colour parsing and WCAG luminance. */
const toLinear = (v: number) => {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};

export function rgb(r: number, g: number, b: number, a = 1): RGB {
  return { r, g, b, a };
}

// ---------- HEX ----------

export function rgbToHex(c: RGB, upper = true): string {
  const part = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  let hex = `#${part(c.r)}${part(c.g)}${part(c.b)}`;
  if (c.a < 1) hex += part(c.a * 255);
  return upper ? hex.toUpperCase() : hex;
}

export function hexToRgb(input: string): RGB | null {
  const hex = input.trim().replace(/^#/, '');
  if (!/^([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return null;
  const full = hex.length <= 4 ? [...hex].map((ch) => ch + ch).join('') : hex;
  const n = (i: number) => parseInt(full.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: full.length === 8 ? round(n(6) / 255, 3) : 1 };
}

// ---------- HSL ----------

export function rgbToHsl(c: RGB): { h: number; s: number; l: number } {
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb(h: number, s: number, l: number, a = 1): RGB {
  const sat = clamp(s, 0, 100) / 100;
  const lig = clamp(l, 0, 100) / 100;
  const hue = ((h % 360) + 360) % 360;
  const k = (n: number) => (n + hue / 30) % 12;
  const f = (n: number) => lig - sat * Math.min(lig, 1 - lig) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255), a };
}

// ---------- Formatting and parsing ----------

export function formatColor(c: RGB, format: ColorFormat, opts: FormatOptions = {}): string {
  const alpha = c.a < 1 ? round(c.a, 2) : null;
  switch (format) {
    case 'hex':
      return rgbToHex(c, opts.upperHex ?? true);
    case 'rgb': {
      const body = `${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}`;
      return alpha === null ? `rgb(${body})` : `rgba(${body}, ${alpha})`;
    }
    case 'hsl': {
      const { h, s, l } = rgbToHsl(c);
      const body = `${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%`;
      return alpha === null ? `hsl(${body})` : `hsla(${body}, ${alpha})`;
    }
  }
}

const NAMED = new Map(COLOR_NAMES.map(([name, hex]) => [name.toLowerCase().replace(/\s+/g, ''), hex]));

function parseAlpha(token: string | undefined): number {
  if (token === undefined) return 1;
  const n = parseFloat(token);
  if (Number.isNaN(n)) return 1;
  return clamp(token.endsWith('%') ? n / 100 : n, 0, 1);
}

/**
 * Parses the colour syntaxes PickKit meets in practice: hex, rgb()/rgba(), hsl()/hsla(),
 * color(srgb …), named colours, and bare "H S% L%" triplets used by some design-token
 * setups. Returns null for anything else.
 */
export function parseColor(input: string): RGB | null {
  const value = input.trim().toLowerCase();
  if (!value) return null;
  if (value === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (value.startsWith('#') || /^[0-9a-f]{6}$/.test(value)) return hexToRgb(value);

  const named = NAMED.get(value);
  if (named) return hexToRgb(named);

  const triplet = value.match(/^(-?[\d.]+)(?:deg)?\s+([\d.]+)%\s+([\d.]+)%$/);
  if (triplet) return hslToRgb(parseFloat(triplet[1]), parseFloat(triplet[2]), parseFloat(triplet[3]));

  const fn = value.match(/^([a-z]+)\(\s*([^)]*)\)$/);
  if (!fn) return null;
  const name = fn[1];
  const [main, alphaPart] = fn[2].split('/').map((part) => part.trim());
  const tokens = main.split(/[\s,]+/).filter(Boolean);

  if (name === 'rgb' || name === 'rgba') {
    if (tokens.length < 3) return null;
    const ch = (t: string) => (t.endsWith('%') ? (parseFloat(t) / 100) * 255 : parseFloat(t));
    const [r, g, b] = tokens.slice(0, 3).map(ch);
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255), a: parseAlpha(alphaPart ?? tokens[3]) };
  }
  if (name === 'hsl' || name === 'hsla') {
    if (tokens.length < 3) return null;
    const [h, s, l] = tokens.slice(0, 3).map(parseFloat);
    if ([h, s, l].some(Number.isNaN)) return null;
    return hslToRgb(h, s, l, parseAlpha(alphaPart ?? tokens[3]));
  }
  if (name === 'color' && tokens[0] === 'srgb' && tokens.length >= 4) {
    const [r, g, b] = tokens.slice(1, 4).map((t) => (t.endsWith('%') ? parseFloat(t) / 100 : parseFloat(t)) * 255);
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255), a: parseAlpha(alphaPart) };
  }
  return null;
}

// ---------- Contrast (WCAG 2.x) ----------

export function luminance(c: RGB): number {
  return 0.2126 * toLinear(c.r) + 0.7152 * toLinear(c.g) + 0.0722 * toLinear(c.b);
}

/** Flattens a translucent colour onto an opaque background. */
export function compositeOver(fg: RGB, bg: RGB): RGB {
  const mix = (f: number, b: number) => f * fg.a + b * (1 - fg.a);
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a: 1 };
}

export function contrastRatio(fg: RGB, bg: RGB): number {
  const a = luminance(fg.a < 1 ? compositeOver(fg, bg) : fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export interface WcagResult {
  aaNormal: boolean;
  aaLarge: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
}

export function wcag(ratio: number): WcagResult {
  return { aaNormal: ratio >= 4.5, aaLarge: ratio >= 3, aaaNormal: ratio >= 7, aaaLarge: ratio >= 4.5 };
}

/** Black or white, whichever is more legible on top of `bg`. */
export function readableOn(bg: RGB): '#000000' | '#FFFFFF' {
  return luminance(bg) > 0.179 ? '#000000' : '#FFFFFF';
}

/**
 * Keeps a picked colour usable as text/accents on a known surface. The hue and
 * saturation stay put; only lightness moves until the contrast target is met.
 * Used for the live accent so a dark picked colour does not disappear on dark UI.
 */
export function accessibleAccent(hex: string, background: string, target = 4.5): string {
  const fg = hexToRgb(hex);
  const bg = hexToRgb(background);
  if (!fg || !bg) return hex;
  if (contrastRatio(fg, bg) >= target) return rgbToHex(fg);

  const { h, s, l } = rgbToHsl(fg);
  const lighten = luminance(bg) < 0.3;
  for (let step = 1; step <= 20; step++) {
    const t = step / 20;
    const nextL = lighten ? l + (100 - l) * t : l * (1 - t);
    const candidate = rgbToHex(hslToRgb(h, s, nextL));
    if (contrastRatio(hexToRgb(candidate)!, bg) >= target) return candidate;
  }
  return lighten ? '#FFFFFF' : '#000000';
}

// ---------- Shades ----------

export const SHADE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
const SHADE_LIGHTNESS = [97, 93, 86, 78, 69, 60, 52, 44, 36, 28, 20];
const SHADE_SATURATION = [0.25, 0.45, 0.7, 0.85, 0.95, 1, 1, 0.95, 0.85, 0.75, 0.65];

/** A 50–950 HSL scale that keeps the source hue and reads evenly light to dark. */
export function shades(c: RGB): { step: number; hex: string }[] {
  const { h, s } = rgbToHsl(c);
  const peak = Math.max(s, 20);
  return SHADE_STEPS.map((step, i) => ({
    step,
    hex: rgbToHex(hslToRgb(h, peak * SHADE_SATURATION[i], SHADE_LIGHTNESS[i])),
  }));
}

// ---------- Names ----------

const NAME_RGB = COLOR_NAMES.map(([name, hex]) => ({ name, rgb: hexToRgb(hex)! }));

/** Closest CSS colour name by luma-weighted RGB distance, e.g. "Slate Blue". */
export function nearestColorName(c: RGB): string {
  let best = NAME_RGB[0];
  let bestDistance = Infinity;
  for (const entry of NAME_RGB) {
    const dr = entry.rgb.r - c.r;
    const dg = entry.rgb.g - c.g;
    const db = entry.rgb.b - c.b;
    const d = 0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db;
    if (d < bestDistance) {
      bestDistance = d;
      best = entry;
    }
  }
  return best.name;
}

/** True when two colours are within `tolerance` per channel (screenshots round slightly). */
export function sameColor(a: RGB, b: RGB, tolerance = 1): boolean {
  return (
    Math.abs(a.r - b.r) <= tolerance && Math.abs(a.g - b.g) <= tolerance && Math.abs(a.b - b.b) <= tolerance
  );
}

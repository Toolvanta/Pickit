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

export type ColorFormat = 'hex' | 'rgb' | 'hsl' | 'oklch';
export const COLOR_FORMATS: ColorFormat[] = ['hex', 'rgb', 'hsl', 'oklch'];

export interface FormatOptions {
  upperHex?: boolean;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round = (n: number, places = 0) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
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

// ---------- OKLab / OKLCH (Björn Ottosson's reference matrices) ----------

const toLinear = (v: number) => {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055) * 255;

export function rgbToOklab(c: RGB): { L: number; a: number; b: number } {
  const r = toLinear(c.r);
  const g = toLinear(c.g);
  const b = toLinear(c.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** Linear-light sRGB for an OKLab colour. Values outside 0–1 are out of gamut. */
function oklabToLinear(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function rgbToOklch(c: RGB): { l: number; c: number; h: number } {
  const lab = rgbToOklab(c);
  const chroma = Math.hypot(lab.a, lab.b);
  let h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  if (h < 0) h += 360;
  // Hue is meaningless for greys; report 0 rather than floating-point noise.
  return { l: lab.L, c: chroma, h: chroma < 0.0005 ? 0 : h };
}

/** Converts OKLCH to sRGB, reducing chroma until the colour fits the sRGB gamut. */
export function oklchToRgb(l: number, c: number, h: number, alpha = 1): RGB {
  const rad = (h * Math.PI) / 180;
  const inGamut = (lin: number[]) => lin.every((v) => v >= -0.0005 && v <= 1.0005);
  let chroma = c;
  let lin = oklabToLinear(l, chroma * Math.cos(rad), chroma * Math.sin(rad));
  if (!inGamut(lin)) {
    let lo = 0;
    let hi = c;
    for (let i = 0; i < 18; i++) {
      chroma = (lo + hi) / 2;
      lin = oklabToLinear(l, chroma * Math.cos(rad), chroma * Math.sin(rad));
      if (inGamut(lin)) lo = chroma;
      else hi = chroma;
    }
    lin = oklabToLinear(l, lo * Math.cos(rad), lo * Math.sin(rad));
  }
  const ch = (v: number) => clamp(Math.round(fromLinear(clamp(v, 0, 1))), 0, 255);
  return { r: ch(lin[0]), g: ch(lin[1]), b: ch(lin[2]), a: alpha };
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
    case 'oklch': {
      const { l, c: chroma, h } = rgbToOklch(c);
      const body = `${round(l * 100, 1)}% ${round(chroma, 3)} ${round(h, 1)}`;
      return alpha === null ? `oklch(${body})` : `oklch(${body} / ${alpha})`;
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
 * oklch(), color(srgb …), named colours, and bare "H S% L%" triplets used by some
 * design-token setups. Returns null for anything else.
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
  if (name === 'oklch') {
    if (tokens.length < 3) return null;
    const l = tokens[0].endsWith('%') ? parseFloat(tokens[0]) / 100 : parseFloat(tokens[0]);
    const c = tokens[1].endsWith('%') ? (parseFloat(tokens[1]) / 100) * 0.4 : parseFloat(tokens[1]);
    const h = parseFloat(tokens[2]);
    if ([l, c, h].some(Number.isNaN)) return null;
    return oklchToRgb(l, c, h, parseAlpha(alphaPart));
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

// ---------- Shades ----------

export const SHADE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
const SHADE_LIGHTNESS = [0.975, 0.94, 0.885, 0.815, 0.72, 0.63, 0.545, 0.46, 0.385, 0.31, 0.225];
const SHADE_CHROMA = [0.18, 0.36, 0.58, 0.8, 0.95, 1, 1, 0.95, 0.85, 0.74, 0.6];

/** A 50–950 scale built in OKLCH so steps look evenly spaced and keep the source hue. */
export function shades(c: RGB): { step: number; hex: string }[] {
  const { c: chroma, h } = rgbToOklch(c);
  const peak = Math.max(chroma, 0.02);
  return SHADE_STEPS.map((step, i) => ({
    step,
    hex: rgbToHex(oklchToRgb(SHADE_LIGHTNESS[i], peak * SHADE_CHROMA[i], h)),
  }));
}

// ---------- Names ----------

const NAME_LAB = COLOR_NAMES.map(([name, hex]) => ({ name, lab: rgbToOklab(hexToRgb(hex)!) }));

/** Nearest CSS colour name by perceptual (OKLab) distance, e.g. "Slate Blue". */
export function nearestColorName(c: RGB): string {
  const lab = rgbToOklab(c);
  let best = NAME_LAB[0];
  let bestDistance = Infinity;
  for (const entry of NAME_LAB) {
    const d = (entry.lab.L - lab.L) ** 2 + (entry.lab.a - lab.a) ** 2 + (entry.lab.b - lab.b) ** 2;
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

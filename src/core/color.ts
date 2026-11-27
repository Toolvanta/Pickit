// Colour maths shared by the overlay, popup and side panel.
// Pure functions only: no DOM, so everything here is unit-testable.

import { COLOR_NAMES } from './color-names';
import { t } from './i18n';

/** r, g, b in 0-255; a in 0-1. */
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
    case 'oklch': {
      const { l, c: chroma, h } = rgbToOklch(c);
      // Achromatic colours have no meaningful hue; CSS writes it as 0.
      const hue = chroma < 0.0005 ? 0 : round(h, 2);
      const body = `${round(l * 100, 2)}% ${round(chroma, 4)} ${hue}`;
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
 * Parses the colour syntaxes Pickit meets in practice: hex, rgb()/rgba(), hsl()/hsla(),
 * oklch(), oklab(), lab(), lch(), color() in srgb / srgb-linear / display-p3 / xyz,
 * named colours, and bare "H S% L%" triplets used by some design-token setups.
 * Wide-gamut colours are clipped to sRGB. Returns null for anything else.
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
    const h = parseHue(tokens[0]);
    const [s, l] = tokens.slice(1, 3).map((t) => channel(t, 100));
    if ([h, s, l].some(Number.isNaN)) return null;
    return hslToRgb(h, s, l, parseAlpha(alphaPart ?? tokens[3]));
  }

  // Modern syntaxes. Chrome's getComputedStyle keeps these in their own colour space,
  // so pages styled with them (Tailwind v4 uses oklch throughout) only parse through here.
  const alpha = parseAlpha(alphaPart);
  if (name === 'oklab' || name === 'oklch') {
    if (tokens.length < 3) return null;
    const l = channel(tokens[0], 1);
    let a: number;
    let b: number;
    if (name === 'oklab') {
      a = channel(tokens[1], 0.4);
      b = channel(tokens[2], 0.4);
    } else {
      const c = channel(tokens[1], 0.4);
      const h = (parseHue(tokens[2]) * Math.PI) / 180;
      a = c * Math.cos(h);
      b = c * Math.sin(h);
    }
    if ([l, a, b].some(Number.isNaN)) return null;
    return fromLinearSrgb(oklabToLinearSrgb(l, a, b), alpha);
  }
  if (name === 'lab' || name === 'lch') {
    if (tokens.length < 3) return null;
    const l = channel(tokens[0], 100);
    let a: number;
    let b: number;
    if (name === 'lab') {
      a = channel(tokens[1], 125);
      b = channel(tokens[2], 125);
    } else {
      const c = channel(tokens[1], 150);
      const h = (parseHue(tokens[2]) * Math.PI) / 180;
      a = c * Math.cos(h);
      b = c * Math.sin(h);
    }
    if ([l, a, b].some(Number.isNaN)) return null;
    return fromLinearSrgb(mul(XYZ65_TO_LSRGB, mul(D50_TO_D65, labToXyzD50(l, a, b))), alpha);
  }
  if (name === 'color' && tokens.length >= 4) {
    const v = tokens.slice(1, 4).map((t) => channel(t, 1)) as Vec3;
    if (v.some(Number.isNaN)) return null;
    switch (tokens[0]) {
      case 'srgb':
        return fromLinearSrgb(v.map((x) => toLinearUnit(x)) as Vec3, alpha);
      case 'srgb-linear':
        return fromLinearSrgb(v, alpha);
      case 'display-p3':
        return fromLinearSrgb(mul(XYZ65_TO_LSRGB, mul(P3_TO_XYZ65, v.map((x) => toLinearUnit(x)) as Vec3)), alpha);
      case 'xyz':
      case 'xyz-d65':
        return fromLinearSrgb(mul(XYZ65_TO_LSRGB, v), alpha);
      case 'xyz-d50':
        return fromLinearSrgb(mul(XYZ65_TO_LSRGB, mul(D50_TO_D65, v)), alpha);
    }
  }
  return null;
}

// ---------- Colour-space conversion (CSS Color 4 matrices) ----------

type Vec3 = [number, number, number];
type Mat3 = [Vec3, Vec3, Vec3];

const mul = (m: Mat3, v: Vec3): Vec3 => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];

const XYZ65_TO_LSRGB: Mat3 = [
  [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
];
const D50_TO_D65: Mat3 = [
  [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
  [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
  [0.012314014864481998, -0.020507649298898964, 1.330365926242124],
];
const P3_TO_XYZ65: Mat3 = [
  [0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
  [0.2289745640697488, 0.6917385218365064, 0.079286914093745],
  [0, 0.04511338185890264, 1.043944368900976],
];

/** A channel value; `none` is 0 and percentages are scaled to `percentOf`. */
function channel(token: string | undefined, percentOf: number): number {
  if (token === undefined) return NaN;
  if (token === 'none') return 0;
  return token.endsWith('%') ? (parseFloat(token) / 100) * percentOf : parseFloat(token);
}

/** A hue in degrees, accepting the deg, turn, rad and grad units. */
function parseHue(token: string | undefined): number {
  if (token === undefined) return NaN;
  if (token === 'none') return 0;
  const n = parseFloat(token);
  if (token.endsWith('turn')) return n * 360;
  if (token.endsWith('grad')) return n * 0.9;
  if (token.endsWith('rad')) return (n * 180) / Math.PI;
  return n;
}

/** sRGB transfer function on a 0-1 value (also used by Display P3). */
const toLinearUnit = (x: number) => Math.sign(x) * toLinear(Math.abs(x) * 255);
const fromLinearUnit = (x: number) => {
  const v = Math.abs(x);
  return Math.sign(x) * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
};

/** Linear-light sRGB to an 8-bit colour. Out-of-gamut values are clipped. */
function fromLinearSrgb(v: Vec3, a: number): RGB {
  const [r, g, b] = v.map((x) => clamp(Math.round(fromLinearUnit(x) * 255), 0, 255));
  return { r, g, b, a };
}

function oklabToLinearSrgb(l: number, a: number, b: number): Vec3 {
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

function labToXyzD50(l: number, a: number, b: number): Vec3 {
  const e = 216 / 24389;
  const k = 24389 / 27;
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const x = fx ** 3 > e ? fx ** 3 : (116 * fx - 16) / k;
  const y = l > k * e ? fy ** 3 : l / k;
  const z = fz ** 3 > e ? fz ** 3 : (116 * fz - 16) / k;
  return [x * 0.3457 / 0.3585, y, z * (1 - 0.3457 - 0.3585) / 0.3585];
}

// ---------- Contrast (WCAG 2.x) ----------

function luminance(c: RGB): number {
  return 0.2126 * toLinear(c.r) + 0.7152 * toLinear(c.g) + 0.0722 * toLinear(c.b);
}

/** Flattens a translucent colour onto an opaque background. */
function compositeOver(fg: RGB, bg: RGB): RGB {
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

const SHADE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
const SHADE_LIGHTNESS = [97, 93, 86, 78, 69, 60, 52, 44, 36, 28, 20];
const SHADE_SATURATION = [0.25, 0.45, 0.7, 0.85, 0.95, 1, 1, 0.95, 0.85, 0.75, 0.65];

/** A 50-950 HSL scale that keeps the source hue and reads evenly light to dark. */
export function shades(c: RGB): { step: number; hex: string }[] {
  const { h, s } = rgbToHsl(c);
  const peak = Math.max(s, 20);
  return SHADE_STEPS.map((step, i) => ({
    step,
    hex: rgbToHex(hslToRgb(h, peak * SHADE_SATURATION[i], SHADE_LIGHTNESS[i])),
  }));
}

// ---------- Names ----------

let nameLab: { name: string; lab: Vec3 }[] | null = null;

/**
 * Closest CSS colour name, e.g. "Slate Blue". Distance is measured in OKLab, which
 * tracks how different two colours look; plain RGB distance over-weights blues and
 * names dark colours badly.
 */
export function nearestColorName(c: RGB): string {
  nameLab ??= COLOR_NAMES.map(([name, hex]) => ({ name, lab: rgbToOklab(hexToRgb(hex)!) }));
  const lab = rgbToOklab(c);
  let best = nameLab[0];
  let bestDistance = Infinity;
  for (const entry of nameLab) {
    // Hue differences count double: otherwise a near-black like #17171F is closer to
    // Midnight Blue (similar lightness) than to Black, which is not how it reads.
    const d = (entry.lab[0] - lab[0]) ** 2 + 4 * ((entry.lab[1] - lab[1]) ** 2 + (entry.lab[2] - lab[2]) ** 2);
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

// ---------- OKLab / OKLCH output ----------

/** sRGB to OKLab [L 0-1, a, b]. */
export function rgbToOklab(c: RGB): Vec3 {
  const r = toLinear(c.r);
  const g = toLinear(c.g);
  const b = toLinear(c.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** sRGB to OKLCH: lightness 0-1, chroma (0 to about 0.37 in sRGB), hue in degrees. */
function rgbToOklch(c: RGB): { l: number; c: number; h: number } {
  const [l, a, b] = rgbToOklab(c);
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return { l, c: Math.hypot(a, b), h: h < 0 ? h + 360 : h };
}

function oklchToRgb(l: number, c: number, h: number): RGB {
  const rad = (h * Math.PI) / 180;
  return fromLinearSrgb(oklabToLinearSrgb(l, c * Math.cos(rad), c * Math.sin(rad)), 1);
}

// ---------- APCA (WCAG 3 draft) ----------

/**
 * APCA lightness contrast (Lc), the method proposed for WCAG 3. Polarity matters:
 * positive for dark text on a light background, negative for light text on dark.
 * Uses the published APCA-W3 0.0.98G-4g constants.
 */
export function apcaContrast(text: RGB, background: RGB): number {
  const y = (c: RGB) => {
    const ch = (v: number) => (clamp(v, 0, 255) / 255) ** 2.4;
    const raw = 0.2126729 * ch(c.r) + 0.7151522 * ch(c.g) + 0.072175 * ch(c.b);
    return raw < 0.022 ? raw + (0.022 - raw) ** 1.414 : raw;
  };
  const txt = y(text.a < 1 ? compositeOver(text, background) : text);
  const bg = y(background);
  if (Math.abs(bg - txt) < 0.0005) return 0;
  if (bg > txt) {
    const sapc = (bg ** 0.56 - txt ** 0.57) * 1.14;
    return sapc < 0.1 ? 0 : (sapc - 0.027) * 100;
  }
  const sapc = (bg ** 0.65 - txt ** 0.62) * 1.14;
  return sapc > -0.1 ? 0 : (sapc + 0.027) * 100;
}

/** What an APCA Lc value is good for, following the APCA readability guidance. */
export function apcaUse(lc: number): string {
  const v = Math.abs(lc);
  if (v >= 90) return t('apca_use_body_any_size');
  if (v >= 75) return t('apca_use_body_from_18px');
  if (v >= 60) return t('apca_use_content_from_24px');
  if (v >= 45) return t('apca_use_headlines_large_text');
  if (v >= 30) return t('apca_use_placeholders_non_text');
  if (v >= 15) return t('apca_use_dividers_decoration');
  return t('apca_use_not_readable');
}

// ---------- Colour-vision deficiency simulation ----------

export type VisionType = 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia';

export interface VisionTypeInfo {
  value: VisionType;
  /** Interface text, looked up when read so it follows the browser's language. */
  readonly label: string;
  readonly note: string;
}

export const VISION_TYPES: VisionTypeInfo[] = [
  {
    value: 'protanopia',
    get label() {
      return t('vision_protanopia_label');
    },
    get note() {
      return t('vision_protanopia_note');
    },
  },
  {
    value: 'deuteranopia',
    get label() {
      return t('vision_deuteranopia_label');
    },
    get note() {
      return t('vision_deuteranopia_note');
    },
  },
  {
    value: 'tritanopia',
    get label() {
      return t('vision_tritanopia_label');
    },
    get note() {
      return t('vision_tritanopia_note');
    },
  },
  {
    value: 'achromatopsia',
    get label() {
      return t('vision_achromatopsia_label');
    },
    get note() {
      return t('vision_achromatopsia_note');
    },
  },
];

// Machado, Oliveira & Fernandes (2009), severity 1.0, applied in linear sRGB.
const CVD: Record<Exclude<VisionType, 'achromatopsia'>, Mat3> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

/** How a colour appears with a given colour-vision deficiency. */
export function simulateVision(c: RGB, type: VisionType): RGB {
  if (type === 'achromatopsia') {
    const y = luminance(c);
    return fromLinearSrgb([y, y, y], c.a);
  }
  return fromLinearSrgb(mul(CVD[type], [toLinear(c.r), toLinear(c.g), toLinear(c.b)]), c.a);
}

// ---------- Contrast fixes ----------

/**
 * The closest colour to `fg` that reaches `target` WCAG contrast on `bg`. Hue and
 * chroma stay put in OKLCH; only lightness moves. Both darker and lighter are tried
 * and the smaller change wins. Null when neither direction can reach the target.
 */
export function suggestContrastFix(fg: RGB, bg: RGB, target = 4.5): RGB | null {
  const solid = { ...fg, a: 1 };
  if (contrastRatio(solid, bg) >= target) return solid;
  const { l, c, h } = rgbToOklch(solid);

  const search = (toward: 0 | 1): RGB | null => {
    // Pure black or white is the best either direction can do.
    if (contrastRatio(oklchToRgb(toward, 0, h), bg) < target) return null;
    let fail = l;
    let pass: number = toward;
    for (let i = 0; i < 24; i++) {
      const mid = (fail + pass) / 2;
      if (contrastRatio(oklchToRgb(mid, c, h), bg) >= target) pass = mid;
      else fail = mid;
    }
    // Saturated colours can leave the sRGB gamut near the extremes; clipping may cost
    // a little contrast, so step further until it passes, shedding chroma if needed.
    let chroma = c;
    let result = oklchToRgb(pass, chroma, h);
    for (let step = 0; step < 40 && contrastRatio(result, bg) < target; step++) {
      pass = toward ? Math.min(1, pass + 0.005) : Math.max(0, pass - 0.005);
      chroma *= 0.95;
      result = oklchToRgb(pass, chroma, h);
    }
    return contrastRatio(result, bg) >= target ? result : null;
  };

  const darker = search(0);
  const lighter = search(1);
  if (!darker || !lighter) return darker ?? lighter;
  const base = rgbToOklab(solid);
  const dist = (x: RGB) => {
    const v = rgbToOklab(x);
    return (v[0] - base[0]) ** 2 + (v[1] - base[1]) ** 2 + (v[2] - base[2]) ** 2;
  };
  return dist(darker) <= dist(lighter) ? darker : lighter;
}

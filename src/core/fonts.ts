// Font inspection. `parseFontStack`, `weightName` and `fontCss` are pure; the rest
// reads the live page and therefore only runs inside the overlay.

import { parseColor, rgbToHex } from './color';
import type { FontEntry, FontSourceKind } from './storage';

export type FontInfo = Omit<FontEntry, 'id' | 'ts'>;

const GENERIC = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif',
  'ui-monospace', 'ui-rounded', 'emoji', 'math', 'fangsong',
]);

const WEIGHT_NAMES: Record<number, string> = {
  100: 'Thin', 200: 'Extra Light', 300: 'Light', 400: 'Regular', 500: 'Medium',
  600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black',
};

/** Splits a font-family value into family names, honouring quotes and escaped commas. */
export function parseFontStack(stack: string): string[] {
  const families: string[] = [];
  let current = '';
  let quote: string | null = null;
  for (const ch of stack) {
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ',') {
      families.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  families.push(current.trim());
  return families.filter(Boolean);
}

export function isGenericFamily(family: string): boolean {
  return GENERIC.has(family.toLowerCase());
}

export function weightName(weight: number): string {
  const nearest = Math.min(900, Math.max(100, Math.round(weight / 100) * 100));
  return WEIGHT_NAMES[nearest];
}

/** "1.5 · 24px" style label for a stored line height. */
export function lineHeightLabel(font: Pick<FontEntry, 'lineHeight' | 'size'>): string {
  if (font.lineHeight === 'normal') return 'Normal';
  const ratio = parseFloat(font.lineHeight);
  return `${font.lineHeight} · ${Math.round(ratio * font.size * 10) / 10}px`;
}

/** A ready-to-paste CSS block for an inspected font. */
export function fontCss(font: FontInfo): string {
  const lines = [
    `font-family: ${font.stack};`,
    `font-size: ${font.size}px;`,
    `font-weight: ${font.weight};`,
  ];
  if (font.style !== 'normal') lines.push(`font-style: ${font.style};`);
  lines.push(`line-height: ${font.lineHeight};`);
  if (font.letterSpacing !== 'normal') lines.push(`letter-spacing: ${font.letterSpacing};`);
  lines.push(`color: ${font.color};`);
  return lines.join('\n');
}

// ---------- Live-page detection ----------

export interface Detection {
  family: string;
  /** Web fonts the page has loaded are certain; measured system fonts are a best guess. */
  certain: boolean;
  kind: 'web' | 'local' | 'generic';
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;
const normalise = (family: string) => family.replace(/^["']|["']$/g, '').trim().toLowerCase();

let measureCtx: CanvasRenderingContext2D | null = null;
const localCache = new Map<string, boolean>();
const SAMPLE = 'mmmmmmmmwwwwlliI10OQ@#&g';
const BASELINES = ['monospace', 'serif', 'sans-serif'];

/**
 * Whether a family is installed on this device: text set in `"Family", <generic>` is
 * measured against the generic alone. A different width for any generic means the
 * family was found and used.
 */
function isLocallyAvailable(family: string): boolean {
  const key = family.toLowerCase();
  const cached = localCache.get(key);
  if (cached !== undefined) return cached;
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return false;
  const ctx = measureCtx;
  const quoted = `"${family.replace(/["\\]/g, '\\$&')}"`;
  const available = BASELINES.some((base) => {
    ctx.font = `72px ${base}`;
    const baseWidth = ctx.measureText(SAMPLE).width;
    ctx.font = `72px ${quoted}, ${base}`;
    return ctx.measureText(SAMPLE).width !== baseWidth;
  });
  localCache.set(key, available);
  return available;
}

/** Families the page has actually loaded as web fonts (not merely declared). */
function loadedWebFamilies(): Set<string> {
  const loaded = new Set<string>();
  for (const face of document.fonts) {
    if (face.status === 'loaded') loaded.add(normalise(face.family));
  }
  return loaded;
}

const detectionCache = new Map<string, Detection>();

/** Works out which family in a stack is really rendering the text. */
export function detectRenderedFamily(stack: string): Detection {
  const cached = detectionCache.get(stack);
  if (cached) return cached;
  const web = loadedWebFamilies();
  let result: Detection | null = null;
  for (const family of parseFontStack(stack)) {
    if (isGenericFamily(family)) {
      result = { family, certain: false, kind: 'generic' };
      break;
    }
    if (web.has(family.toLowerCase())) {
      result = { family, certain: true, kind: 'web' };
      break;
    }
    if (isLocallyAvailable(family)) {
      result = { family, certain: false, kind: 'local' };
      break;
    }
  }
  result ??= { family: 'Browser default', certain: false, kind: 'generic' };
  // Web fonts can finish loading after the first hover, so only cache settled answers.
  if (document.fonts.status === 'loaded') detectionCache.set(stack, result);
  return result;
}

let faceHosts: Map<string, Set<string>> | null = null;

/** Maps each @font-face family to the hosts its files come from. Cross-origin sheets are skipped. */
function fontFaceHosts(): Map<string, Set<string>> {
  if (faceHosts) return faceHosts;
  const hosts = new Map<string, Set<string>>();
  const visit = (rules: CSSRuleList) => {
    for (const rule of rules) {
      if (rule instanceof CSSFontFaceRule) {
        const family = normalise(rule.style.getPropertyValue('font-family'));
        const src = rule.style.getPropertyValue('src');
        const set = hosts.get(family) ?? new Set<string>();
        for (const match of src.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
          try {
            set.add(new URL(match[1], rule.parentStyleSheet?.href ?? location.href).host);
          } catch {
            // data: URLs and malformed values carry no host worth reporting.
          }
        }
        hosts.set(family, set);
      } else if ('cssRules' in rule) {
        visit((rule as CSSGroupingRule).cssRules);
      }
    }
  };
  for (const sheet of document.styleSheets) {
    try {
      visit(sheet.cssRules);
    } catch {
      // Cross-origin stylesheet without CORS: its rules are not readable.
    }
  }
  faceHosts = hosts;
  return hosts;
}

const googleSpecimen = (family: string) =>
  `https://fonts.google.com/specimen/${encodeURIComponent(family).replace(/%20/g, '+')}`;

function linkedFromGoogle(family: string): boolean {
  const needle = family.toLowerCase();
  for (const link of document.querySelectorAll<HTMLLinkElement>('link[href*="fonts.googleapis.com"]')) {
    let href = link.href.toLowerCase();
    try {
      href = decodeURIComponent(href);
    } catch {
      // Keep the raw href if it is not valid percent-encoding.
    }
    if (href.replace(/\+/g, ' ').includes(`family=${needle}`) || href.replace(/\+/g, ' ').includes(`|${needle}`)) {
      return true;
    }
  }
  return false;
}

export function fontSource(detection: Detection): { source: FontSourceKind; label: string; link?: string } {
  if (detection.kind === 'generic') return { source: 'generic', label: 'Browser default' };
  if (detection.kind === 'local') return { source: 'system', label: 'Installed on this device' };

  const hosts = [...(fontFaceHosts().get(detection.family.toLowerCase()) ?? [])];
  if (hosts.some((h) => h.endsWith('gstatic.com') || h.endsWith('googleapis.com')) || linkedFromGoogle(detection.family)) {
    return { source: 'google', label: 'Google Fonts', link: googleSpecimen(detection.family) };
  }
  if (hosts.some((h) => h.includes('typekit')) || (!hosts.length && document.querySelector('link[href*="typekit.net"], script[src*="typekit.net"]'))) {
    return { source: 'adobe', label: 'Adobe Fonts' };
  }
  if (!hosts.length) return { source: 'hosted', label: 'Web font' };
  const external = hosts.find((h) => h !== location.host);
  return { source: 'hosted', label: external ? `Hosted on ${external}` : 'Self-hosted' };
}

/** Everything the font card shows for one element. */
export function inspectElement(el: Element): FontInfo {
  const cs = getComputedStyle(el);
  const size = round(parseFloat(cs.fontSize) || 16, 2);
  const detection = detectRenderedFamily(cs.fontFamily);
  const source = fontSource(detection);
  const lineHeightPx = parseFloat(cs.lineHeight);
  const spacingPx = parseFloat(cs.letterSpacing);
  const color = parseColor(cs.color);
  return {
    origin: location.hostname,
    family: detection.family,
    certain: detection.certain,
    stack: cs.fontFamily,
    size,
    weight: parseInt(cs.fontWeight, 10) || 400,
    style: cs.fontStyle,
    lineHeight: Number.isNaN(lineHeightPx) ? 'normal' : String(round(lineHeightPx / size, 2)),
    letterSpacing: Number.isNaN(spacingPx) || spacingPx === 0 ? 'normal' : `${round(spacingPx / size, 3)}em`,
    color: color ? rgbToHex(color) : cs.color,
    source: source.source,
    sourceLabel: source.label,
    link: source.link,
  };
}

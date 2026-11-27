// Whole-page summary of colours and typography. `scanPage` runs inside the overlay;
// the types are shared with the side panel that renders the result.

import { parseColor, rgbToHex } from './color';
import { detectRenderedFamily, fontSource, resetFontCaches } from './fonts';
import type { FontSourceKind } from './storage';

export interface ScanColor {
  hex: string;
  /** How many elements use the colour in each role. */
  text: number;
  background: number;
  border: number;
}

export interface ScanFont {
  family: string;
  certain: boolean;
  source: FontSourceKind;
  sourceLabel: string;
  link?: string;
  /** Number of text elements rendered in this family. */
  count: number;
  sizes: number[];
  weights: number[];
}

export interface ScanResult {
  title: string;
  host: string;
  colors: ScanColor[];
  fonts: ScanFont[];
  /** True when the page had more elements than the scan limit. */
  truncated: boolean;
}

const MAX_ELEMENTS = 6000;
const MAX_COLORS = 48;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK', 'TITLE', 'BR']);

function hasOwnText(el: Element): boolean {
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.nodeValue && node.nodeValue.trim()) return true;
  }
  return false;
}

const GRADIENT_COLOR = /(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^()]*\)|#[0-9a-f]{3,8}\b/gi;

/** Colour stops in a computed `background-image`, e.g. from linear-gradient(). Images are ignored. */
export function gradientColors(backgroundImage: string): string[] {
  if (!backgroundImage || backgroundImage === 'none' || !backgroundImage.includes('gradient(')) return [];
  // url() arguments can contain anything, including text that looks like a colour.
  const withoutUrls = backgroundImage.replace(/url\((?:"[^"]*"|'[^']*'|[^)]*)\)/g, '');
  return withoutUrls.match(GRADIENT_COLOR) ?? [];
}

export function scanPage(ignore: Element): ScanResult {
  resetFontCaches();
  const colors = new Map<string, ScanColor>();
  const fonts = new Map<string, ScanFont & { sizeSet: Set<number>; weightSet: Set<number> }>();

  const addColor = (value: string, role: 'text' | 'background' | 'border') => {
    const parsed = parseColor(value);
    if (!parsed || parsed.a < 0.1) return;
    // Translucent colours are grouped under their opaque base. Otherwise every alpha
    // step of one brand colour (#0A66FF at 10%, 20%, …) would be listed separately.
    const hex = rgbToHex({ ...parsed, a: 1 });
    const entry = colors.get(hex) ?? { hex, text: 0, background: 0, border: 0 };
    entry[role] += 1;
    colors.set(hex, entry);
  };

  let visited = 0;
  let truncated = false;

  /** Visits one element and, recursively, its open shadow root and same-origin iframe. */
  const visit = (node: Element) => {
    if (node === ignore || SKIP_TAGS.has(node.tagName)) return;
    if (visited >= MAX_ELEMENTS) {
      truncated = true;
      return;
    }
    visited += 1;
    if (typeof node.checkVisibility === 'function' && !node.checkVisibility()) return;

    // Each document has its own window; an iframe's elements need its getComputedStyle.
    const view = node.ownerDocument.defaultView ?? window;
    const cs = view.getComputedStyle(node);
    addColor(cs.backgroundColor, 'background');
    for (const color of gradientColors(cs.backgroundImage)) addColor(color, 'background');
    for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
      if (cs[`border${side}Style`] !== 'none' && parseFloat(cs[`border${side}Width`]) > 0) {
        addColor(cs[`border${side}Color`], 'border');
        break;
      }
    }
    // SVG icons and illustrations paint with fill and stroke, not background and border.
    if (node instanceof view.SVGElement && !(node instanceof view.SVGSVGElement)) {
      if (cs.fill && cs.fill !== 'none' && !cs.fill.startsWith('url(')) addColor(cs.fill, 'background');
      if (cs.stroke && cs.stroke !== 'none' && !cs.stroke.startsWith('url(') && parseFloat(cs.strokeWidth) > 0) {
        addColor(cs.stroke, 'border');
      }
    }

    if (node.shadowRoot) walk(node.shadowRoot);
    if (node instanceof view.HTMLIFrameElement) {
      try {
        // Same-origin frames only; cross-origin ones throw or return null.
        const inner = node.contentDocument?.documentElement;
        if (inner) walk(inner);
      } catch {
        // Cross-origin frame.
      }
    }

    if (!hasOwnText(node)) return;
    addColor(cs.color, 'text');

    const detection = detectRenderedFamily(cs.fontFamily);
    let font = fonts.get(detection.family);
    if (!font) {
      const source = fontSource(detection);
      font = {
        family: detection.family,
        certain: detection.certain,
        source: source.source,
        sourceLabel: source.label,
        link: source.link,
        count: 0,
        sizes: [],
        weights: [],
        sizeSet: new Set(),
        weightSet: new Set(),
      };
      fonts.set(detection.family, font);
    }
    font.count += 1;
    font.sizeSet.add(Math.round(parseFloat(cs.fontSize) * 10) / 10);
    font.weightSet.add(parseInt(cs.fontWeight, 10) || 400);
  };

  /** Walks the elements under `root` in document order (a TreeWalker skips shadow roots). */
  function walk(root: Node) {
    const walker = (root.ownerDocument ?? document).createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    // nodeType, not instanceof: an iframe's elements come from another window's Element.
    let node = root.nodeType === Node.ELEMENT_NODE ? (root as Element) : (walker.nextNode() as Element | null);
    while (node && !truncated) {
      visit(node);
      node = walker.nextNode() as Element | null;
    }
  }

  walk(document.documentElement);

  const total = (c: ScanColor) => c.text + c.background + c.border;
  return {
    title: document.title,
    host: location.hostname,
    colors: [...colors.values()].sort((a, b) => total(b) - total(a)).slice(0, MAX_COLORS),
    fonts: [...fonts.values()]
      .sort((a, b) => b.count - a.count)
      .map(({ sizeSet, weightSet, ...font }) => ({
        ...font,
        sizes: [...sizeSet].sort((a, b) => a - b),
        weights: [...weightSet].sort((a, b) => a - b),
      })),
    truncated,
  };
}

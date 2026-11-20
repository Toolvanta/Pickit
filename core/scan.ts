// Whole-page summary of colours and typography. `scanPage` runs inside the overlay;
// the types are shared with the side panel that renders the result.

import { parseColor, rgbToHex } from './color';
import { detectRenderedFamily, fontSource } from './fonts';
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

export function scanPage(ignore: Element): ScanResult {
  const colors = new Map<string, ScanColor>();
  const fonts = new Map<string, ScanFont & { sizeSet: Set<number>; weightSet: Set<number> }>();

  const addColor = (value: string, role: 'text' | 'background' | 'border') => {
    const parsed = parseColor(value);
    if (!parsed || parsed.a < 0.1) return;
    const hex = rgbToHex(parsed);
    const entry = colors.get(hex) ?? { hex, text: 0, background: 0, border: 0 };
    entry[role] += 1;
    colors.set(hex, entry);
  };

  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT);
  let visited = 0;
  let truncated = false;
  for (let node = walker.currentNode as Element | null; node; node = walker.nextNode() as Element | null) {
    if (node === ignore || SKIP_TAGS.has(node.tagName)) continue;
    if (visited >= MAX_ELEMENTS) {
      truncated = true;
      break;
    }
    visited += 1;
    if (typeof node.checkVisibility === 'function' && !node.checkVisibility()) continue;

    const cs = getComputedStyle(node);
    addColor(cs.backgroundColor, 'background');
    for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
      if (cs[`border${side}Style`] !== 'none' && parseFloat(cs[`border${side}Width`]) > 0) {
        addColor(cs[`border${side}Color`], 'border');
        break;
      }
    }

    if (!hasOwnText(node)) continue;
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
  }

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

// Token awareness: after a pick, find a CSS custom property on the page whose value
// is the picked colour, so designers see `--brand-600` as well as the raw value.

import { parseColor, sameColor, type RGB } from '../color';

const MAX_PROPERTIES = 3000;

/**
 * Custom property names declared on the page. Collected afresh on every pick: single-page
 * apps add stylesheets as they navigate, so a cached list would go stale. Walking the
 * rules is cheap next to the screenshot each pick already needs.
 */
function collectPropertyNames(el: Element | null): string[] {
  const names = new Set<string>();
  const visit = (rules: CSSRuleList) => {
    for (const rule of rules) {
      if (names.size >= MAX_PROPERTIES) return;
      if (rule instanceof CSSStyleRule) {
        for (const name of rule.style) {
          if (name.startsWith('--')) names.add(name);
        }
      }
      if ('cssRules' in rule) visit((rule as CSSGroupingRule).cssRules);
    }
  };
  // Sheets attached by scripts (constructable stylesheets) are not in document.styleSheets.
  // Pickit's own cursor sheet is adopted too, but it declares no custom properties.
  for (const sheet of [...document.styleSheets, ...document.adoptedStyleSheets]) {
    try {
      visit(sheet.cssRules);
    } catch {
      // Cross-origin stylesheet without CORS: not readable, skip it.
    }
  }
  // Tokens set inline, e.g. <html style="--brand: #0af">, on the element or its ancestors.
  for (let node: Element | null = el ?? document.documentElement; node; node = node.parentElement) {
    if (!(node instanceof HTMLElement || node instanceof SVGElement)) continue;
    for (const name of node.style) {
      if (name.startsWith('--')) names.add(name);
    }
  }
  return [...names];
}

const COLOR_LIKE = /^(#|rgb|hsl|color\(|(ok)?(lab|lch)\(|[a-z]+$|-?[\d.]+(deg)?\s+[\d.]+%\s+[\d.]+%$)/i;

/** Name of a custom property resolving to `color` at `el`, or null. */
export function findToken(color: RGB, el: Element | null): string | null {
  const scope = el ?? document.documentElement;
  const computed = getComputedStyle(scope);
  for (const name of collectPropertyNames(el)) {
    const value = computed.getPropertyValue(name).trim();
    if (!value || value.length > 48 || !COLOR_LIKE.test(value)) continue;
    const parsed = parseColor(value);
    if (parsed && parsed.a === 1 && sameColor(parsed, color)) return name;
  }
  return null;
}

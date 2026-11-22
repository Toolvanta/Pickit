// Token awareness: after a pick, find a CSS custom property on the page whose value
// is the picked colour, so designers see `--brand-600` as well as the raw value.

import { parseColor, sameColor, type RGB } from '../color';

const MAX_PROPERTIES = 3000;
let propertyNames: string[] | null = null;

function collectPropertyNames(): string[] {
  if (propertyNames) return propertyNames;
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
  for (const sheet of document.styleSheets) {
    try {
      visit(sheet.cssRules);
    } catch {
      // Cross-origin stylesheet without CORS: not readable, skip it.
    }
  }
  propertyNames = [...names];
  return propertyNames;
}

const COLOR_LIKE = /^(#|rgb|hsl|color\(|[a-z]+$|-?[\d.]+(deg)?\s+[\d.]+%\s+[\d.]+%$)/i;

/** Name of a custom property resolving to `color` at `el`, or null. */
export function findToken(color: RGB, el: Element | null): string | null {
  const scope = el ?? document.documentElement;
  const computed = getComputedStyle(scope);
  for (const name of collectPropertyNames()) {
    const value = computed.getPropertyValue(name).trim();
    if (!value || value.length > 48 || !COLOR_LIKE.test(value)) continue;
    const parsed = parseColor(value);
    if (parsed && parsed.a === 1 && sameColor(parsed, color)) return name;
  }
  return null;
}

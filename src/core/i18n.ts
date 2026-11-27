// Interface text. Every string a person reads lives in public/_locales/<lang>/messages.json
// and is looked up here, so Chrome shows Pickit in the browser's language.
//
// Conventions for messages.json:
//   - Keys are snake_case with an area prefix: popup_…, colors_…, contrast_…, overlay_…
//   - Values go in with {0}, {1}… for substitutions (not Chrome's $placeholders$, so the
//     same text works in tests and in the preview harness, where chrome.i18n is absent).
//   - Counted text has one key per plural category: key_one, key_other, and in languages
//     that need them key_zero / key_two / key_few / key_many (see tp()).

import { browser } from 'wxt/browser';
import en from '../../public/_locales/en/messages.json';

type Messages = Record<string, { message: string; description?: string }>;
const fallback = en as Messages;

function lookup(key: string): string {
  try {
    // WXT types getMessage to the keys it has generated; ours are looked up dynamically.
    const message = (browser.i18n.getMessage as (name: string) => string)(key);
    if (message) return message;
  } catch {
    // No chrome.i18n (unit tests, preview harness): use English below.
  }
  return fallback[key]?.message ?? key;
}

const fill = (text: string, subs: (string | number)[]) =>
  subs.length ? text.replace(/\{(\d)\}/g, (match, i: string) => (subs[+i] === undefined ? match : String(subs[+i]))) : text;

/** Interface text for `key`, with {0}, {1}… replaced by `subs`. */
export function t(key: string, ...subs: (string | number)[]): string {
  return fill(lookup(key), subs);
}

/** The browser's UI language, e.g. "de" or "pt-BR". */
export function uiLocale(): string {
  try {
    return browser.i18n.getUILanguage() || 'en';
  } catch {
    return 'en';
  }
}

let rules: Intl.PluralRules | null = null;

/**
 * Counted text: picks key_one / key_few / key_other… for `n` using the language's plural
 * rules, falling back to key_other. {0} is the formatted count; further subs follow.
 */
export function tp(key: string, n: number, ...subs: (string | number)[]): string {
  rules ??= new Intl.PluralRules(uiLocale());
  const category = rules.select(n);
  let text = lookup(`${key}_${category}`);
  if (text === `${key}_${category}`) text = lookup(`${key}_other`);
  return fill(text, [new Intl.NumberFormat(uiLocale()).format(n), ...subs]);
}

/** "ltr" or "rtl" for the UI language (Arabic is right-to-left). */
export function textDirection(): 'ltr' | 'rtl' {
  try {
    return browser.i18n.getMessage('@@bidi_dir') === 'rtl' ? 'rtl' : 'ltr';
  } catch {
    return 'ltr';
  }
}

/** Sets lang and dir on an extension page so text shapes, wraps and mirrors correctly. */
export function applyDocumentLocale(): void {
  document.documentElement.lang = uiLocale();
  document.documentElement.dir = textDirection();
}

/** "3 min ago", "yesterday", in the UI language. */
export function relativeTime(ts: number): string {
  const format = new Intl.RelativeTimeFormat(uiLocale(), { numeric: 'auto' });
  const minutes = Math.round((ts - Date.now()) / 60000);
  if (minutes > -1) return format.format(0, 'minute');
  if (minutes > -60) return format.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours > -24) return format.format(hours, 'hour');
  return format.format(Math.round(hours / 24), 'day');
}

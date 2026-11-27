/// <reference types="vite/client" />
// Guards the translation files: every key the code uses exists in English, every
// language has every English key, and translations keep their {0} substitutions.

import { describe, expect, it } from 'vitest';

type Messages = Record<string, { message: string; description?: string }>;

// Vite inlines these at test time, so no Node file APIs (or @types/node) are needed.
const localeFiles = import.meta.glob('../public/_locales/*/messages.json', { eager: true, import: 'default' }) as Record<string, Messages>;
const sources = import.meta.glob('../src/**/*.{ts,tsx}', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

const langOf = (path: string) => path.split('/').slice(-2)[0];
const locales = Object.fromEntries(Object.entries(localeFiles).map(([path, messages]) => [langOf(path), messages]));
const read = (lang: string) => locales[lang];
const en = read('en');
const languages = Object.keys(locales).filter((lang) => lang !== 'en');

const usedKeys = new Set<string>();
const usedPlurals = new Set<string>();
for (const text of Object.values(sources)) {
  for (const m of text.matchAll(/\bt\(\s*'([a-z0-9_]+)'/g)) usedKeys.add(m[1]);
  for (const m of text.matchAll(/\btp\(\s*'([a-z0-9_]+)'/g)) usedPlurals.add(m[1]);
}

const placeholders = (s: string) => [...s.matchAll(/\{(\d)\}/g)].map((m) => m[1]).sort().join(',');
const PLURAL = /_(zero|one|two|few|many|other)$/;

describe('i18n', () => {
  it('finds interface text in the source', () => {
    expect(usedKeys.size + usedPlurals.size).toBeGreaterThan(50);
  });

  it('has an English message for every key the code uses', () => {
    const missing = [...usedKeys].filter((key) => !en[key]);
    const missingPlural = [...usedPlurals].filter((key) => !en[`${key}_other`] || !en[`${key}_one`]);
    expect(missing).toEqual([]);
    expect(missingPlural).toEqual([]);
  });

  it('has no unused English messages', () => {
    const store = new Set(['extName', 'extDescription', 'actionTitle', 'cmdPickColor', 'cmdInspectFont']);
    const unused = Object.keys(en).filter((key) => {
      if (store.has(key) || usedKeys.has(key)) return false;
      const base = key.replace(PLURAL, '');
      return !(PLURAL.test(key) && usedPlurals.has(base));
    });
    expect(unused).toEqual([]);
  });

  it.each(languages)('%s has every message, with the same substitutions', (lang) => {
    const messages = read(lang);
    const missing = Object.keys(en).filter((key) => {
      if (messages[key]) return false;
      // A language may use other plural categories than English; it only needs _other.
      return !(PLURAL.test(key) && messages[key.replace(PLURAL, '_other')]);
    });
    expect(missing).toEqual([]);
    const broken = Object.entries(messages)
      .filter(([key, value]) => {
        if (PLURAL.test(key)) {
          // Plural forms may or may not spell out the count ({0}); other substitutions must match.
          const source = en[key.replace(PLURAL, '_other')];
          const strip = (s: string) => placeholders(s).replace(/^0,?/, '');
          return source && strip(source.message) !== strip(value.message);
        }
        const source = en[key];
        return source && placeholders(source.message) !== placeholders(value.message);
      })
      .map(([key]) => key);
    expect(broken).toEqual([]);
    for (const value of Object.values(messages)) expect(value.message.trim()).not.toBe('');
  });
});

// Product-level constants. Anything that changes at launch time lives here so it is
// not scattered through the UI code.

import { browser } from 'wxt/browser';

/** Number of colour picks after which the popup asks for a store rating (once). */
export const RATING_PROMPT_AFTER_PICKS = 20;

/** Review page on the Chrome Web Store. Resolves correctly once the extension is published. */
export const storeReviewUrl = () =>
  `https://chromewebstore.google.com/detail/${browser.runtime.id}/reviews`;

/**
 * Page opened when someone uninstalls, typically a short feedback form.
 * Left empty until a form exists; the background worker skips it while empty.
 */
export const UNINSTALL_FEEDBACK_URL = '';

export const SHORTCUTS = { color: 'Alt+Shift+C', font: 'Alt+Shift+F' } as const;

/** URLs where Chrome never lets an extension run, whatever permissions it holds. */
export function isRestrictedUrl(url: string | undefined): boolean {
  if (!url) return false;
  return (
    /^(chrome|chrome-extension|chrome-search|chrome-untrusted|devtools|edge|brave|about|view-source):/i.test(url) ||
    /^https:\/\/chromewebstore\.google\.com\//i.test(url) ||
    /^https:\/\/chrome\.google\.com\/webstore/i.test(url)
  );
}

/**
 * Sponsor shown on Pickit's own pages. The UTM tags let the sponsor see visits came
 * from Pickit; they carry nothing about the person or the pages they visit.
 */
export const SPONSOR = {
  name: 'ToolEnhancer',
  url: 'https://toolenhancer.com/?utm_source=pickit&utm_medium=extension&utm_campaign=sponsor',
} as const;

/** The maker and the project's public pages, shown in the About areas. */
export const CREATOR = {
  name: 'Shoaib Arif',
  github: 'https://github.com/Toolvanta/Pickit',
  linkedin: 'https://www.linkedin.com/in/shoaibmarif/',
  portfolio: 'https://shoaibarif.vercel.app/',
} as const;

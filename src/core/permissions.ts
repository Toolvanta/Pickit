// Optional all-sites access. Pickit installs with `activeTab` only, which Chrome grants
// when the toolbar icon or a shortcut is used - but not for clicks inside the side
// panel. Users who work from the side panel can opt in to all-sites access here.

import { browser } from 'wxt/browser';

const ALL_SITES = { origins: ['<all_urls>'] };

export async function hasAllSites(): Promise<boolean> {
  try {
    return await browser.permissions.contains(ALL_SITES);
  } catch {
    return false;
  }
}

/** Must be called directly from a click handler: Chrome requires a user gesture. */
export async function requestAllSites(): Promise<boolean> {
  try {
    return await browser.permissions.request(ALL_SITES);
  } catch {
    return false;
  }
}

/** Calls `onChange` whenever the all-sites grant is added or removed. Returns an unsubscribe function. */
export function watchAllSites(onChange: (granted: boolean) => void): () => void {
  const update = () => void hasAllSites().then(onChange);
  browser.permissions.onAdded.addListener(update);
  browser.permissions.onRemoved.addListener(update);
  return () => {
    browser.permissions.onAdded.removeListener(update);
    browser.permissions.onRemoved.removeListener(update);
  };
}

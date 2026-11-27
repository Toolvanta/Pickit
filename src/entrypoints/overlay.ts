// In-page script. Not listed in the manifest: the background worker injects it into a
// tab only when a picker or a page scan is invoked. It never watches the page on its own.

import { browser } from 'wxt/browser';
import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import type { OverlayRequest, PickMode, ScanResponse } from '@/core/messages';
import { startFontInspector } from '@/core/overlay/font-inspector';
import { startColorPicker } from '@/core/overlay/loupe';
import { getShell } from '@/core/overlay/shell';
import { scanPage } from '@/core/scan';
import { getState } from '@/core/storage';

declare global {
  interface Window {
    /** Set by the running copy; answers whether that copy can still reach the extension. */
    __pickitAlive?: () => boolean;
  }
}

/** False once the extension has been updated or reloaded and this copy is orphaned. */
function contextAlive(): boolean {
  try {
    return Boolean(browser.runtime?.id);
  } catch {
    return false;
  }
}

export default defineUnlistedScript(() => {
  // The worker pings before injecting, but guard against a double injection. A copy left
  // behind by an extension update cannot talk to the extension any more; let the new
  // copy take over instead of refusing to start.
  if (window.__pickitAlive?.()) return;
  window.__pickitAlive = contextAlive;

  let stopActive: (() => void) | null = null;
  /** Bumped on every start, so a start that finishes late does not mount a second picker. */
  let generation = 0;

  async function start(mode: PickMode) {
    const mine = ++generation;
    stopActive?.();
    stopActive = null;

    const settings = await getState('settings');
    if (mine !== generation) return; // a newer start arrived while settings loaded

    const shell = getShell();
    shell.setTheme(settings.theme);
    let stop: (() => void) | null = null;
    const onDone = () => {
      // Only clear the slot if it still belongs to this picker.
      if (stopActive === stop) stopActive = null;
    };
    stop = mode === 'color' ? startColorPicker(shell, settings, onDone) : startFontInspector(shell, settings, onDone);
    stopActive = stop;
  }

  browser.runtime.onMessage.addListener((message: OverlayRequest, _sender, sendResponse) => {
    switch (message.t) {
      case 'pk:ping':
        sendResponse({ ok: true });
        break;
      case 'pk:start':
        void start(message.mode);
        sendResponse({ ok: true });
        break;
      case 'pk:stop':
        generation += 1;
        stopActive?.();
        stopActive = null;
        sendResponse({ ok: true });
        break;
      case 'pk:scan': {
        // The overlay host is passed so the scan skips Pickit's own element.
        const own = document.querySelector('pickit-overlay') ?? document.createElement('div');
        const response: ScanResponse = { ok: true, result: scanPage(own) };
        sendResponse(response);
        break;
      }
    }
    return undefined;
  });
});

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
    __pickkitLoaded?: boolean;
  }
}

export default defineUnlistedScript(() => {
  // The worker pings before injecting, but guard anyway against a double injection.
  if (window.__pickkitLoaded) return;
  window.__pickkitLoaded = true;

  let stopActive: (() => void) | null = null;

  async function start(mode: PickMode) {
    stopActive?.();
    stopActive = null;

    const settings = await getState('settings');
    const shell = getShell();
    shell.setTheme(settings.theme);
    const onDone = () => {
      stopActive = null;
    };
    stopActive =
      mode === 'color' ? startColorPicker(shell, settings, onDone) : startFontInspector(shell, onDone);
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
      case 'pk:scan': {
        // The overlay host is passed so the scan skips PickKit's own element.
        const own = document.querySelector('pickkit-overlay') ?? document.createElement('div');
        const response: ScanResponse = { ok: true, result: scanPage(own) };
        sendResponse(response);
        break;
      }
    }
    return undefined;
  });
});

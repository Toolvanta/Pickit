// Service worker. It owns everything that needs extension privileges: injecting the
// overlay, taking tab screenshots, relaying page scans, and handling keyboard commands.

import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { isRestrictedUrl, UNINSTALL_FEEDBACK_URL } from '@/core/config';
import { startSync } from '@/core/sync-engine';
import type {
  BackgroundRequest,
  CaptureResponse,
  FailureReason,
  OverlayRequest,
  PickMode,
  ScanResponse,
  StartResponse,
} from '@/core/messages';

export default defineBackground(() => {
  startSync();

  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') void browser.tabs.create({ url: browser.runtime.getURL('/welcome.html') });
  });

  if (UNINSTALL_FEEDBACK_URL) void browser.runtime.setUninstallURL(UNINSTALL_FEEDBACK_URL);

  // The toolbar icon opens the popup; the side panel is opened from inside it.
  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

  const send = (tabId: number, message: OverlayRequest) => browser.tabs.sendMessage(tabId, message);

  async function failureFor(tabId: number): Promise<FailureReason> {
    try {
      const tab = await browser.tabs.get(tabId);
      if (isRestrictedUrl(tab.url)) return 'restricted';
    } catch {
      return 'unknown';
    }
    return 'no-access';
  }

  /** Makes sure the overlay script is running in the tab, injecting it if needed. */
  async function ensureOverlay(tabId: number): Promise<void> {
    try {
      const pong = await send(tabId, { t: 'pk:ping' });
      if (pong?.ok) return;
    } catch {
      // Not injected yet.
    }
    await browser.scripting.executeScript({ target: { tabId }, files: ['/overlay.js'] });
  }

  async function start(tabId: number, mode: PickMode): Promise<StartResponse> {
    try {
      await ensureOverlay(tabId);
      await send(tabId, { t: 'pk:start', mode });
      return { ok: true };
    } catch {
      return { ok: false, reason: await failureFor(tabId) };
    }
  }

  async function scan(windowId: number): Promise<ScanResponse> {
    const [tab] = await browser.tabs.query({ active: true, windowId });
    if (!tab?.id) return { ok: false, reason: 'unknown' };
    try {
      await ensureOverlay(tab.id);
      return (await send(tab.id, { t: 'pk:scan' })) as ScanResponse;
    } catch {
      return { ok: false, reason: await failureFor(tab.id) };
    }
  }

  async function capture(windowId: number | undefined): Promise<CaptureResponse> {
    try {
      const dataUrl =
        windowId === undefined
          ? await browser.tabs.captureVisibleTab({ format: 'png' })
          : await browser.tabs.captureVisibleTab(windowId, { format: 'png' });
      return { ok: true, dataUrl };
    } catch {
      return { ok: false, reason: 'no-access' };
    }
  }

  async function openPanel(windowId: number | undefined): Promise<void> {
    if (windowId === undefined) return;
    try {
      await browser.sidePanel.open({ windowId });
    } catch {
      // Chrome only allows this inside a user gesture; the button supplies one.
    }
  }

  browser.runtime.onMessage.addListener((message: BackgroundRequest, sender, sendResponse) => {
    let reply: Promise<unknown>;
    switch (message.t) {
      case 'start':
        reply = start(message.tabId, message.mode);
        break;
      case 'capture':
        reply = capture(sender.tab?.windowId);
        break;
      case 'scan':
        reply = scan(message.windowId);
        break;
      case 'stop':
        reply = browser.tabs
          .query({ active: true, windowId: message.windowId })
          .then(([tab]) => (tab?.id === undefined ? undefined : send(tab.id, { t: 'pk:stop' })))
          .catch(() => undefined);
        break;
      case 'openPanel':
        reply = openPanel(sender.tab?.windowId);
        break;
      default:
        return undefined;
    }
    reply.then(sendResponse, () => sendResponse({ ok: false, reason: 'unknown' }));
    return true; // Keep the channel open for the async reply.
  });

  browser.commands.onCommand.addListener(async (command, tab) => {
    const mode: PickMode | null =
      command === 'pick-color' ? 'color' : command === 'inspect-font' ? 'font' : null;
    if (!mode || !tab?.id) return;
    const result = await start(tab.id, mode);
    if (result.ok) return;
    const tabId = tab.id;
    await browser.action.setBadgeBackgroundColor({ color: '#c2343f', tabId });
    await browser.action.setBadgeText({ text: '!', tabId });
    setTimeout(() => void browser.action.setBadgeText({ text: '', tabId }).catch(() => {}), 3000);
  });
});

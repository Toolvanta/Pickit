// Message contracts between the popup / side panel, the background worker and the
// in-page overlay. Keeping them in one file means a renamed field fails the type check
// everywhere at once.

import type { ScanResult } from './scan';

export type PickMode = 'color' | 'font';

/** Sent to the background worker. */
export type BackgroundRequest =
  | { t: 'start'; mode: PickMode; tabId: number }
  | { t: 'capture' }
  | { t: 'scan'; windowId: number };

/** Sent from the background worker to the overlay running in a tab. */
export type OverlayRequest = { t: 'pk:ping' } | { t: 'pk:start'; mode: PickMode } | { t: 'pk:scan' };

export type FailureReason =
  /** Browser pages, the Web Store and similar: extensions can never run here. */
  | 'restricted'
  /** A normal page PickKit has not been invoked on, so `activeTab` does not cover it. */
  | 'no-access'
  | 'unknown';

export type StartResponse = { ok: true } | { ok: false; reason: FailureReason };
export type CaptureResponse = { ok: true; dataUrl: string } | { ok: false; reason: FailureReason };
export type ScanResponse = { ok: true; result: ScanResult } | { ok: false; reason: FailureReason };

// Colour picker: a magnifier that follows the cursor over a screenshot of the tab.
//
// The screenshot is a snapshot, so it goes stale when the page scrolls or resizes.
// The loupe dims while stale and recaptures once movement settles. Chrome allows
// roughly two captures per second, so captures are spaced out accordingly.

import { browser } from 'wxt/browser';
import { formatColor, hexToRgb, nearestColorName, rgbToHex, type RGB } from '../color';
import type { BackgroundRequest, CaptureResponse } from '../messages';
import { addColor, type Settings } from '../storage';
import { copyText, h, hintBar, swatch, type Shell } from './shell';
import { findToken } from './tokens';

const CELLS = 11; // Pixels shown across the loupe. Odd, so there is a centre pixel.
const CELL = 12; // CSS pixels per magnified pixel.
const SIZE = CELLS * CELL;
const HALF = (CELLS - 1) / 2;
const OFFSET = 24; // Gap between the cursor and the loupe.
const LOUPE_HEIGHT = SIZE + 44; // Canvas plus the value chip.
const MIN_CAPTURE_GAP_MS = 550;
const SETTLE_MS = 160;

interface EyeDropperLike {
  open(): Promise<{ sRGBHex: string }>;
}
declare global {
  interface Window {
    EyeDropper?: new () => EyeDropperLike;
  }
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function decodeDataUrl(dataUrl: string): Promise<ImageBitmap> {
  // Decoded by hand rather than with fetch()/<img> so the page's CSP cannot block it.
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return createImageBitmap(new Blob([bytes], { type: 'image/png' }));
}

/** Starts the colour picker. Returns a function that stops it. */
export function startColorPicker(shell: Shell, settings: Settings, onDone: () => void): () => void {
  const canScreenPick = typeof window.EyeDropper === 'function';

  const canvas = h('canvas');
  const chipSwatch = swatch('transparent');
  const chipValue = h('span', { class: 'pk-chip-value' });
  const chipName = h('span', { class: 'pk-chip-name' });
  const loupe = h('div', { class: 'pk-loupe' }, canvas, h('div', { class: 'pk-chip' }, chipSwatch, chipValue, chipName));
  const catcher = h('div', { class: 'pk-catch' });
  const hints: [string, string][] = [
    ['Click', 'Copy colour'],
    ['Shift+Click', 'Pick several'],
  ];
  if (canScreenPick) hints.push(['S', 'Pick from screen']);
  hints.push(['Esc', 'Cancel']);
  const hint = hintBar(hints);
  const ui = h('div', null, catcher, loupe, hint);
  shell.root.append(ui);
  shell.retain();

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(SIZE * dpr);
  canvas.height = Math.round(SIZE * dpr);
  const loupeCtx = canvas.getContext('2d')!;

  let work: OffscreenCanvas | null = null;
  let workCtx: OffscreenCanvasRenderingContext2D | null = null;
  let scale = dpr; // Screenshot pixels per CSS pixel; measured from the real capture.
  let x = 0;
  let y = 0;
  let hasPointer = false;
  let stale = true;
  let capturing = false;
  let recapture = false;
  let lastCapture = 0;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const format = (color: RGB) => formatColor(color, settings.format, { upperHex: settings.upperHex });

  function pixelAt(px: number, py: number): RGB | null {
    if (!work || !workCtx) return null;
    const sx = Math.min(work.width - 1, Math.max(0, Math.floor(px * scale)));
    const sy = Math.min(work.height - 1, Math.max(0, Math.floor(py * scale)));
    const [r, g, b] = workCtx.getImageData(sx, sy, 1, 1).data;
    return { r, g, b, a: 1 };
  }

  function render() {
    if (!hasPointer) return;
    const flipX = x + OFFSET + SIZE + 8 > window.innerWidth;
    const flipY = y + OFFSET + LOUPE_HEIGHT + 8 > window.innerHeight;
    const left = flipX ? x - OFFSET - SIZE : x + OFFSET;
    const top = flipY ? y - OFFSET - LOUPE_HEIGHT : y + OFFSET;
    loupe.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    loupe.toggleAttribute('data-on', true);
    loupe.toggleAttribute('data-stale', stale);
    if (stale || !work) return;

    const sx = Math.floor(x * scale);
    const sy = Math.floor(y * scale);
    loupeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    loupeCtx.imageSmoothingEnabled = false;
    loupeCtx.clearRect(0, 0, SIZE, SIZE);
    loupeCtx.drawImage(work, sx - HALF, sy - HALF, CELLS, CELLS, 0, 0, SIZE, SIZE);

    loupeCtx.strokeStyle = 'rgba(0, 0, 0, 0.14)';
    loupeCtx.lineWidth = 1;
    loupeCtx.beginPath();
    for (let i = 1; i < CELLS; i++) {
      loupeCtx.moveTo(i * CELL + 0.5, 0);
      loupeCtx.lineTo(i * CELL + 0.5, SIZE);
      loupeCtx.moveTo(0, i * CELL + 0.5);
      loupeCtx.lineTo(SIZE, i * CELL + 0.5);
    }
    loupeCtx.stroke();
    // Centre pixel: a dark ring inside a white one stays visible on any colour.
    const c = HALF * CELL;
    loupeCtx.strokeStyle = '#000';
    loupeCtx.strokeRect(c - 0.5, c - 0.5, CELL + 2, CELL + 2);
    loupeCtx.strokeStyle = '#fff';
    loupeCtx.lineWidth = 2;
    loupeCtx.strokeRect(c + 1, c + 1, CELL - 1, CELL - 1);

    const color = pixelAt(x, y);
    if (!color) return;
    chipSwatch.style.background = rgbToHex(color);
    chipValue.textContent = format(color);
    chipName.textContent = nearestColorName(color);
  }

  async function capture() {
    if (stopped) return;
    if (capturing) {
      recapture = true;
      return;
    }
    capturing = true;
    try {
      const wait = MIN_CAPTURE_GAP_MS - (Date.now() - lastCapture);
      if (wait > 0) await sleep(wait);
      if (stopped) return;
      // Our own UI must not be in the screenshot.
      shell.setVisible(false);
      await nextFrame();
      await nextFrame();
      const request: BackgroundRequest = { t: 'capture' };
      const response = (await browser.runtime.sendMessage(request)) as CaptureResponse;
      lastCapture = Date.now();
      shell.setVisible(true);
      if (stopped) return;
      if (!response?.ok) {
        shell.toast({ title: 'PickKit cannot read this page', sub: 'Click the toolbar icon and try again' });
        stop();
        return;
      }
      const bitmap = await decodeDataUrl(response.dataUrl);
      work = new OffscreenCanvas(bitmap.width, bitmap.height);
      workCtx = work.getContext('2d', { willReadFrequently: true });
      workCtx?.drawImage(bitmap, 0, 0);
      bitmap.close();
      scale = work.width / window.innerWidth;
      stale = false;
      render();
    } catch {
      shell.setVisible(true);
      if (!stopped) {
        shell.toast({ title: 'Could not capture the page', sub: 'Try again' });
        stop();
      }
    } finally {
      capturing = false;
      if (recapture && !stopped) {
        recapture = false;
        void capture();
      }
    }
  }

  function markStale() {
    stale = true;
    render();
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => void capture(), SETTLE_MS);
  }

  async function commit(color: RGB, origin: string, element: Element | null) {
    // Held so the shell outlives the picker until the confirmation toast is showing.
    shell.retain();
    try {
      const hex = rgbToHex(color);
      const text = format(color);
      const token = element ? findToken(color, element) : null;
      const copied = await copyText(text);
      await addColor({ hex, origin, token: token ?? undefined });
      shell.toast({
        title: copied ? `Copied ${text}` : `Saved ${text}`,
        sub: token ?? nearestColorName(color),
        color: hex,
      });
    } finally {
      shell.release();
    }
  }

  function pick(keepGoing: boolean) {
    if (stale) return;
    const color = pixelAt(x, y);
    if (!color) return;
    const under = document.elementsFromPoint(x, y).find((el) => el !== shell.host) ?? null;
    void commit(color, location.hostname, under);
    if (!keepGoing) stop();
  }

  async function pickFromScreen() {
    if (!window.EyeDropper) return;
    const dropper = new window.EyeDropper();
    shell.retain();
    stop();
    try {
      const { sRGBHex } = await dropper.open();
      const color = hexToRgb(sRGBHex);
      if (color) await commit(color, 'screen', null);
    } catch {
      // The user pressed Esc in the system eyedropper.
    } finally {
      shell.release();
    }
  }

  const onMove = (e: PointerEvent) => {
    x = e.clientX;
    y = e.clientY;
    hasPointer = true;
    render();
  };
  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    x = e.clientX;
    y = e.clientY;
    pick(e.shiftKey);
  };
  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    stop();
  };
  const onKey = (e: KeyboardEvent) => {
    const nudge: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (e.key === 'Escape') stop();
    else if (e.key === 'Enter') pick(e.shiftKey);
    else if (e.key.toLowerCase() === 's' && canScreenPick && !e.ctrlKey && !e.metaKey && !e.altKey) void pickFromScreen();
    else if (nudge[e.key] && hasPointer) {
      // One screenshot pixel per press, ten with Shift.
      const step = (e.shiftKey ? 10 : 1) / scale;
      x = Math.min(window.innerWidth - 1, Math.max(0, x + nudge[e.key][0] * step));
      y = Math.min(window.innerHeight - 1, Math.max(0, y + nudge[e.key][1] * step));
      render();
    } else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  catcher.addEventListener('pointermove', onMove);
  catcher.addEventListener('click', onClick);
  catcher.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('scroll', markStale, { capture: true, passive: true });
  window.addEventListener('resize', markStale);

  function stop() {
    if (stopped) return;
    stopped = true;
    clearTimeout(settleTimer);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', markStale, true);
    window.removeEventListener('resize', markStale);
    ui.remove();
    shell.setVisible(true);
    shell.release();
    onDone();
  }

  void capture();
  return stop;
}

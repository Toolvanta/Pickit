// Renders the Chrome Web Store artwork into store/ at the exact sizes the store asks for.
//
//   npm run store
//
// It builds nothing itself (the npm script runs `wxt build` first), starts the preview
// server on a spare port, opens scripts/store/scenes.html in headless Chrome once per
// scene and saves a PNG. Uses the Chrome DevTools Protocol over Node's built-in
// WebSocket, so no browser-automation dependency is needed. Set CHROME_PATH if Chrome
// is installed somewhere unusual.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '../..');
const OUT = join(ROOT, 'store');
const PORT = 4519;
const DEBUG_PORT = 9333;

const SHOTS = [
  ['colour', 'screenshots/1-pick-colours.png'],
  ['font', 'screenshots/2-detect-fonts.png'],
  ['workspace', 'screenshots/3-workspace.png'],
  ['contrast', 'screenshots/4-contrast.png'],
  ['palettes', 'screenshots/5-palettes.png'],
  ['tile', 'promo/small-tile-440x280.png'],
  ['marquee', 'promo/marquee-1400x560.png'],
];
const SIZES = { tile: [440, 280], marquee: [1400, 560] };

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error('Chrome not found. Set CHROME_PATH to your Chrome or Chromium binary.');
  return found;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(url, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch {
      // Not up yet.
    }
    await sleep(200);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

/** Minimal DevTools Protocol client for one page. */
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  return { send, close: () => ws.close() };
}

const server = spawn(process.execPath, [join(ROOT, 'scripts/preview.mjs')], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
});
const profile = join(tmpdir(), `pickit-store-${Date.now()}`);
const chrome = spawn(
  findChrome(),
  ['--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`, '--hide-scrollbars', '--force-device-scale-factor=1', 'about:blank'],
  { stdio: 'ignore' },
);

try {
  await waitFor(`http://localhost:${PORT}/store/scenes.html`);
  const targets = await (await waitFor(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  const cdp = await connect(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  for (const [scene, file] of SHOTS) {
    const [width, height] = SIZES[scene] ?? [1280, 800];
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: `http://localhost:${PORT}/store/scenes.html?scene=${scene}` });
    let ready = false;
    for (let i = 0; i < 60 && !ready; i++) {
      await sleep(250);
      const { result } = await cdp.send('Runtime.evaluate', { expression: "document.body?.dataset.ready === '1'" });
      ready = result.value === true;
    }
    if (!ready) throw new Error(`Scene "${scene}" never became ready`);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale: 1 } });
    const path = join(OUT, file);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, Buffer.from(data, 'base64'));
    console.log(`${file}  ${width}x${height}`);
  }
  copyFileSync(join(ROOT, 'public/icon/128.png'), join(OUT, 'icon-128.png'));
  console.log('icon-128.png  128x128');
  cdp.close();
} finally {
  chrome.kill();
  server.kill();
}

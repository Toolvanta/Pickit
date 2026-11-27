// UI preview server. Serves the built extension pages in an ordinary browser tab with a
// stand-in for the chrome.* APIs, so the popup, side panel, settings and overlay can be
// looked at without loading the extension. Run `npm run build` first.
//
//   node scripts/preview.mjs   ->   http://localhost:4517/harness.html
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.env.PORT) || 4517;
// Paths are resolved from this file so the server works from any working directory.
const ROOT = join(import.meta.dirname, '..');
const BUILD = join(ROOT, '.output/chrome-mv3');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/\\/g, '/');
  const local =
    path === '/__stub.js'
      ? join(ROOT, 'scripts/preview/stub.js')
      : path.startsWith('/store/')
        ? join(ROOT, 'scripts', path)
        : path === '/harness.html' || path === '/'
        ? join(ROOT, 'scripts/preview/harness.html')
        : join(BUILD, path);
  try {
    let body = await readFile(local);
    const type = TYPES[extname(local)] ?? 'application/octet-stream';
    if (type.startsWith('text/html') && !local.endsWith('harness.html') && !path.startsWith('/store/')) {
      body = body.toString().replace('<head>', '<head><script src="/__stub.js"></script>');
    }
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, () => console.log(`Pickit preview: http://localhost:${PORT}/harness.html`));

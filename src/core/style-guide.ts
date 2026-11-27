// Draws a page's colours and typography as a single shareable image.
// Canvas is used directly (rather than rendering HTML) so the output is identical
// on every machine and needs no extra permissions to save.

import { hexToRgb, nearestColorName, readableOn } from './color';
import { t } from './i18n';
import type { ScanResult } from './scan';

const WIDTH = 1200;
const PAD = 64;
const COLUMNS = 6;
const GAP = 20;
const SWATCH_W = (WIDTH - PAD * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
const SWATCH_H = 150;
const FONT_ROW = 92;
const MAX_COLORS = 18;
const MAX_FONTS = 6;
const UI_FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const MONO_FONT = "'Cascadia Code', Consolas, Menlo, monospace";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function renderStyleGuide(scan: ScanResult): HTMLCanvasElement {
  const colors = scan.colors.slice(0, MAX_COLORS);
  const fonts = scan.fonts.slice(0, MAX_FONTS);
  const colorRows = Math.ceil(colors.length / COLUMNS);
  const height =
    PAD + 96 + 56 + colorRows * (SWATCH_H + GAP) + 36 + 56 + fonts.length * FONT_ROW + 72;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, height);

  let y = PAD;
  ctx.fillStyle = '#17171f';
  ctx.font = `650 34px ${UI_FONT}`;
  ctx.fillText(scan.host || t('styleguide_default_title'), PAD, y + 30);
  ctx.fillStyle = '#5a5a6b';
  ctx.font = `400 16px ${UI_FONT}`;
  const title = scan.title.length > 110 ? `${scan.title.slice(0, 107)}…` : scan.title;
  ctx.fillText(title, PAD, y + 62);
  y += 96;

  const heading = (text: string) => {
    ctx.fillStyle = '#858596';
    ctx.font = `600 13px ${UI_FONT}`;
    ctx.letterSpacing = '1px';
    ctx.fillText(text.toUpperCase(), PAD, y + 16);
    ctx.letterSpacing = '0px';
    y += 40;
  };

  heading(t('styleguide_colours_heading'));
  colors.forEach((color, i) => {
    const x = PAD + (i % COLUMNS) * (SWATCH_W + GAP);
    const top = y + Math.floor(i / COLUMNS) * (SWATCH_H + GAP);
    const rgb = hexToRgb(color.hex);
    roundRect(ctx, x, top, SWATCH_W, SWATCH_H, 12);
    ctx.fillStyle = color.hex;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (!rgb) return;
    ctx.fillStyle = rgb.a < 0.6 ? '#000000' : readableOn(rgb);
    ctx.font = `600 15px ${MONO_FONT}`;
    ctx.fillText(color.hex, x + 14, top + SWATCH_H - 34);
    ctx.globalAlpha = 0.75;
    ctx.font = `400 12px ${UI_FONT}`;
    ctx.fillText(nearestColorName(rgb), x + 14, top + SWATCH_H - 14);
    ctx.globalAlpha = 1;
  });
  y += colorRows * (SWATCH_H + GAP) + 36;

  heading(t('styleguide_typography_heading'));
  fonts.forEach((font) => {
    ctx.fillStyle = '#17171f';
    ctx.font = `600 30px "${font.family.replace(/"/g, '')}", ${UI_FONT}`;
    ctx.fillText(font.family, PAD, y + 30);
    ctx.fillStyle = '#5a5a6b';
    ctx.font = `400 14px ${UI_FONT}`;
    const sizes = font.sizes.slice(0, 10).map((s) => `${s}px`).join('  ');
    ctx.fillText(t('styleguide_font_details', font.sourceLabel, font.weights.join(', '), sizes), PAD, y + 56);
    ctx.strokeStyle = '#e2e2ea';
    ctx.beginPath();
    ctx.moveTo(PAD, y + FONT_ROW - 16);
    ctx.lineTo(WIDTH - PAD, y + FONT_ROW - 16);
    ctx.stroke();
    y += FONT_ROW;
  });

  ctx.fillStyle = '#858596';
  ctx.font = `400 13px ${UI_FONT}`;
  ctx.fillText(t('styleguide_footer', 'Pickit'), PAD, height - 36);
  return canvas;
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      resolve();
    }, 'image/png');
  });
}

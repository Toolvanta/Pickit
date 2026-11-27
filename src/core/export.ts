// Turns a list of colours into code a developer can paste. Pure, so it is unit-tested.

import { t } from './i18n';

export type ExportFormat = 'css' | 'scss' | 'tailwind' | 'tokens' | 'json' | 'svg';

export const EXPORT_FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'tailwind', label: 'Tailwind' },
  {
    value: 'tokens',
    // A getter so the label is looked up when shown, not when this module first loads.
    get label() {
      return t('export_format_tokens');
    },
  },
  { value: 'json', label: 'JSON' },
  { value: 'svg', label: 'SVG' },
];

/** File suffix for downloads, including the leading dot. */
export function exportExtension(format: ExportFormat): string {
  if (format === 'tailwind') return '.txt';
  if (format === 'tokens') return '.tokens.json';
  return `.${format}`;
}

/** "Brand Colours!" -> "brand-colours". Falls back to "palette" for names with no letters or digits. */
export function slug(name: string): string {
  const value = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return value || 'palette';
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (ch) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[ch] ?? ch,
  );
}

/**
 * Code for a list of colours. `keys` names each colour (e.g. 50…950 for a shade scale);
 * without them the colours are numbered from 1.
 */
export function exportColors(name: string, colors: string[], format: ExportFormat, keys?: (string | number)[]): string {
  const key = slug(name);
  const names = colors.map((_, i) => String(keys?.[i] ?? i + 1));
  switch (format) {
    case 'css':
      return [':root {', ...colors.map((c, i) => `  --${key}-${names[i]}: ${c};`), '}'].join('\n');
    case 'scss':
      return colors.map((c, i) => `$${key}-${names[i]}: ${c};`).join('\n');
    case 'tailwind':
      return [
        '// tailwind.config.js → theme.extend.colors',
        `'${key}': {`,
        ...colors.map((c, i) => `  ${/^\d+$/.test(names[i]) ? names[i] : `'${names[i]}'`}: '${c}',`),
        '},',
      ].join('\n');
    case 'tokens': {
      // W3C Design Tokens (DTCG) format, read by Tokens Studio, Style Dictionary and others.
      const group: Record<string, { $type: 'color'; $value: string }> = {};
      colors.forEach((c, i) => {
        group[names[i]] = { $type: 'color', $value: c };
      });
      return JSON.stringify({ [key]: group }, null, 2);
    }
    case 'json':
      return JSON.stringify({ name, colors }, null, 2);
    case 'svg': {
      const size = 96;
      const rows = colors
        .map(
          (color, i) =>
            `  <rect x="${i * size}" y="32" width="${size}" height="${size}" fill="${escapeXml(color)}"/>\n` +
            `  <text x="${i * size + 8}" y="150" fill="#1b1b19" font-family="ui-monospace, monospace" font-size="11">${escapeXml(color)}</text>`,
        )
        .join('\n');
      return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${colors.length * size}" height="168" viewBox="0 0 ${colors.length * size} 168" role="img">`,
        `  <title>${escapeXml(name)}</title>`,
        rows,
        '</svg>',
      ].join('\n');
    }
  }
}

// Turns a list of colours into code a developer can paste. Pure, so it is unit-tested.

export type ExportFormat = 'css' | 'scss' | 'tailwind' | 'json' | 'svg';

export const EXPORT_FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'tailwind', label: 'Tailwind' },
  { value: 'json', label: 'JSON' },
  { value: 'svg', label: 'SVG' },
];

/** File suffix for downloads, including the leading dot. */
export function exportExtension(format: ExportFormat): string {
  return format === 'tailwind' ? '.txt' : `.${format}`;
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

export function exportColors(name: string, colors: string[], format: ExportFormat): string {
  const key = slug(name);
  switch (format) {
    case 'css':
      return [':root {', ...colors.map((c, i) => `  --${key}-${i + 1}: ${c};`), '}'].join('\n');
    case 'scss':
      return colors.map((c, i) => `$${key}-${i + 1}: ${c};`).join('\n');
    case 'tailwind':
      return [
        '// tailwind.config.js → theme.extend.colors',
        `'${key}': {`,
        ...colors.map((c, i) => `  ${i + 1}: '${c}',`),
        '},',
      ].join('\n');
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

// Turns a list of colours into code a developer can paste. Pure, so it is unit-tested.

export type ExportFormat = 'css' | 'scss' | 'tailwind' | 'json';

export const EXPORT_FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'tailwind', label: 'Tailwind' },
  { value: 'json', label: 'JSON' },
];

/** "Brand Colours!" -> "brand-colours". Falls back to "palette" for names with no letters or digits. */
export function slug(name: string): string {
  const value = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return value || 'palette';
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
  }
}

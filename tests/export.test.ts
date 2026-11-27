import { describe, expect, it } from 'vitest';
import { isRestrictedUrl } from '../src/core/config';
import { exportColors, exportExtension, slug } from '../src/core/export';

describe('slug', () => {
  it('makes a CSS-safe name', () => {
    expect(slug('Brand Colours!')).toBe('brand-colours');
    expect(slug('  example.com ')).toBe('example-com');
    expect(slug('***')).toBe('palette');
  });
});

describe('exportColors', () => {
  const colors = ['#5548E0', '#17794A'];
  it('writes CSS variables', () => {
    expect(exportColors('Brand', colors, 'css')).toBe(':root {\n  --brand-1: #5548E0;\n  --brand-2: #17794A;\n}');
  });
  it('writes SCSS variables', () => {
    expect(exportColors('Brand', colors, 'scss')).toBe('$brand-1: #5548E0;\n$brand-2: #17794A;');
  });
  it('writes a Tailwind colour group', () => {
    expect(exportColors('Brand', colors, 'tailwind')).toContain("'brand': {\n  1: '#5548E0',\n  2: '#17794A',\n},");
  });
  it('writes valid JSON', () => {
    expect(JSON.parse(exportColors('Brand', colors, 'json'))).toEqual({ name: 'Brand', colors });
  });
  it('writes a self-contained SVG swatch sheet', () => {
    const svg = exportColors('Brand <3', colors, 'svg');
    expect(svg).toContain('<svg');
    expect(svg).toContain('Brand &lt;3');
    expect(svg).toContain('#5548E0');
  });
  it('maps formats to download extensions', () => {
    expect(exportExtension('css')).toBe('.css');
    expect(exportExtension('json')).toBe('.json');
    expect(exportExtension('svg')).toBe('.svg');
  });
});

describe('isRestrictedUrl', () => {
  it('flags pages extensions cannot run on', () => {
    expect(isRestrictedUrl('chrome://extensions')).toBe(true);
    expect(isRestrictedUrl('https://chromewebstore.google.com/detail/x')).toBe(true);
    expect(isRestrictedUrl('about:blank')).toBe(true);
  });
  it('allows ordinary pages', () => {
    expect(isRestrictedUrl('https://example.com')).toBe(false);
    expect(isRestrictedUrl(undefined)).toBe(false);
  });
});

describe('named keys and design tokens', () => {
  const scale = ['#EEF2FF', '#3B5BDB', '#1E2A78'];
  const keys = [50, 500, 950];
  it('uses shade keys in CSS and Tailwind', () => {
    expect(exportColors('Brand', scale, 'css', keys)).toContain('--brand-500: #3B5BDB;');
    expect(exportColors('Brand', scale, 'tailwind', keys)).toContain("  950: '#1E2A78',");
  });
  it('quotes non-numeric Tailwind keys', () => {
    expect(exportColors('Brand', ['#000000'], 'tailwind', ['dark'])).toContain("  'dark': '#000000',");
  });
  it('writes W3C design tokens', () => {
    expect(JSON.parse(exportColors('Brand', scale, 'tokens', keys))).toEqual({
      brand: {
        50: { $type: 'color', $value: '#EEF2FF' },
        500: { $type: 'color', $value: '#3B5BDB' },
        950: { $type: 'color', $value: '#1E2A78' },
      },
    });
    expect(exportExtension('tokens')).toBe('.tokens.json');
  });
});

import { describe, expect, it } from 'vitest';
import { isRestrictedUrl } from '../core/config';
import { exportColors, slug } from '../core/export';

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

import { describe, expect, it } from 'vitest';
import { fontCss, isGenericFamily, lineHeightLabel, parseFontStack, weightName, type FontInfo } from '../core/fonts';

describe('parseFontStack', () => {
  it('splits families and strips quotes', () => {
    expect(parseFontStack('"Helvetica Neue", Arial, sans-serif')).toEqual(['Helvetica Neue', 'Arial', 'sans-serif']);
    expect(parseFontStack("'Open Sans',system-ui")).toEqual(['Open Sans', 'system-ui']);
  });
  it('keeps commas that are inside quotes', () => {
    expect(parseFontStack('"Foo, Bar", serif')).toEqual(['Foo, Bar', 'serif']);
  });
  it('ignores empty entries', () => {
    expect(parseFontStack('Arial,, ')).toEqual(['Arial']);
  });
});

describe('helpers', () => {
  it('recognises generic families', () => {
    expect(isGenericFamily('Sans-Serif')).toBe(true);
    expect(isGenericFamily('Arial')).toBe(false);
  });
  it('names weights, snapping variable-font values', () => {
    expect(weightName(400)).toBe('Regular');
    expect(weightName(650)).toBe('Bold');
    expect(weightName(1)).toBe('Thin');
  });
  it('labels line height', () => {
    expect(lineHeightLabel({ lineHeight: '1.5', size: 16 })).toBe('1.5 · 24px');
    expect(lineHeightLabel({ lineHeight: 'normal', size: 16 })).toBe('Normal');
  });
});

describe('fontCss', () => {
  const base: FontInfo = {
    origin: 'example.com',
    family: 'Inter',
    certain: true,
    stack: 'Inter, sans-serif',
    size: 16,
    weight: 500,
    style: 'normal',
    lineHeight: '1.5',
    letterSpacing: 'normal',
    color: '#17171F',
    source: 'google',
    sourceLabel: 'Google Fonts',
  };
  it('omits properties left at their defaults', () => {
    expect(fontCss(base)).toBe(
      ['font-family: Inter, sans-serif;', 'font-size: 16px;', 'font-weight: 500;', 'line-height: 1.5;', 'color: #17171F;'].join('\n'),
    );
  });
  it('includes style and spacing when set', () => {
    const css = fontCss({ ...base, style: 'italic', letterSpacing: '0.02em' });
    expect(css).toContain('font-style: italic;');
    expect(css).toContain('letter-spacing: 0.02em;');
  });
});

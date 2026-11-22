import { describe, expect, it } from 'vitest';
import { harmonies } from '../src/core/harmony';

describe('harmonies', () => {
  it('returns the five standard schemes with the base colour first', () => {
    const result = harmonies('#5548E0');
    expect(result.map((scheme) => scheme.kind)).toEqual([
      'complementary',
      'analogous',
      'triadic',
      'split',
      'tetradic',
    ]);
    expect(result.every((scheme) => scheme.colors[0] === '#5548E0')).toBe(true);
    expect(result.map((scheme) => scheme.colors.length)).toEqual([2, 3, 3, 3, 4]);
  });

  it('rotates hue while keeping a valid hex colour', () => {
    const [complement] = harmonies('#FF0000');
    expect(complement.colors[1]).toBe('#00FFFF');
    expect(harmonies('#000000').every((scheme) => scheme.colors.every((color) => /^#[0-9A-F]{6}$/.test(color)))).toBe(true);
  });

  it('ignores invalid input', () => {
    expect(harmonies('not-a-colour')).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { gradientColors } from '../src/core/scan';

describe('gradientColors', () => {
  it('reads colour stops from computed gradients', () => {
    expect(gradientColors('linear-gradient(90deg, rgb(255, 0, 0) 0%, rgba(0, 0, 255, 0.5) 100%)')).toEqual([
      'rgb(255, 0, 0)',
      'rgba(0, 0, 255, 0.5)',
    ]);
    expect(gradientColors('radial-gradient(oklch(0.7 0.1 200), color(display-p3 1 0 0))')).toEqual([
      'oklch(0.7 0.1 200)',
      'color(display-p3 1 0 0)',
    ]);
  });
  it('reads every layer of a multi-background', () => {
    expect(gradientColors('url("a.png"), linear-gradient(rgb(1, 2, 3), rgb(4, 5, 6))')).toEqual([
      'rgb(1, 2, 3)',
      'rgb(4, 5, 6)',
    ]);
  });
  it('ignores plain images and colour-like text inside url()', () => {
    expect(gradientColors('none')).toEqual([]);
    expect(gradientColors('url("rgb(1, 2, 3).png")')).toEqual([]);
    expect(gradientColors('url("rgb(9, 9, 9).png"), linear-gradient(rgb(1, 2, 3), rgb(4, 5, 6))')).toEqual([
      'rgb(1, 2, 3)',
      'rgb(4, 5, 6)',
    ]);
  });
});

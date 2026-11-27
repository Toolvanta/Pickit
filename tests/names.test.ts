import { describe, expect, it } from 'vitest';
import { hexToRgb, nearestColorName } from '../src/core/color';

const name = (hex: string) => nearestColorName(hexToRgb(hex)!);

describe('colour names read the way the colour looks', () => {
  it.each([
    ['#17171F', 'Black'],
    ['#FF0000', 'Red'],
    ['#FFFFFF', 'White'],
    ['#808080', 'Gray'],
    ['#FFA500', 'Orange'],
    ['#2B8A3E', /Green/],
    ['#3B5BDB', /Blue/],
  ] as const)('%s → %s', (hex, expected) => {
    expect(name(hex)).toMatch(expected);
  });
});

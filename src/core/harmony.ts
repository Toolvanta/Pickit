// Colour harmonies. Pure hue rotations around a base colour — no page access, no
// network, and no dependency on a colour library.

import { hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from './color';

export type HarmonyKind = 'complementary' | 'analogous' | 'triadic' | 'split' | 'tetradic';

export interface Harmony {
  kind: HarmonyKind;
  label: string;
  /** Hue offsets, in degrees, from the base colour. The base is always first. */
  colors: string[];
}

const RECIPES: { kind: HarmonyKind; label: string; offsets: number[] }[] = [
  { kind: 'complementary', label: 'Complementary', offsets: [0, 180] },
  { kind: 'analogous', label: 'Analogous', offsets: [0, 30, 330] },
  { kind: 'triadic', label: 'Triadic', offsets: [0, 120, 240] },
  { kind: 'split', label: 'Split complement', offsets: [0, 150, 210] },
  { kind: 'tetradic', label: 'Tetradic', offsets: [0, 90, 180, 270] },
];

/** Builds the five standard harmonies for a hex colour. Invalid input yields no rows. */
export function harmonies(hex: string): Harmony[] {
  const base = hexToRgb(hex);
  if (!base) return [];
  const { h, s, l } = rgbToHsl(base);

  return RECIPES.map(({ kind, label, offsets }) => ({
    kind,
    label,
    colors: offsets.map((offset) => {
      const hue = ((h + offset) % 360 + 360) % 360;
      return rgbToHex(hslToRgb(hue, s, l), true);
    }),
  }));
}

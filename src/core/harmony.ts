// Colour harmonies. Pure hue rotations around a base colour - no page access, no
// network, and no dependency on a colour library.

import { hexToRgb, hslToRgb, rgbToHex, rgbToHsl } from './color';
import { t } from './i18n';

export type HarmonyKind = 'complementary' | 'analogous' | 'triadic' | 'split' | 'tetradic';

export interface Harmony {
  kind: HarmonyKind;
  label: string;
  /** Hue offsets, in degrees, from the base colour. The base is always first. */
  colors: string[];
}

// Labels are functions so the text is looked up in the browser's language when used.
const RECIPES: { kind: HarmonyKind; label: () => string; offsets: number[] }[] = [
  { kind: 'complementary', label: () => t('harmony_complementary'), offsets: [0, 180] },
  { kind: 'analogous', label: () => t('harmony_analogous'), offsets: [0, 30, 330] },
  { kind: 'triadic', label: () => t('harmony_triadic'), offsets: [0, 120, 240] },
  { kind: 'split', label: () => t('harmony_split_complement'), offsets: [0, 150, 210] },
  { kind: 'tetradic', label: () => t('harmony_tetradic'), offsets: [0, 90, 180, 270] },
];

/** Builds the five standard harmonies for a hex colour. Invalid input yields no rows. */
export function harmonies(hex: string): Harmony[] {
  const base = hexToRgb(hex);
  if (!base) return [];
  const { h, s, l } = rgbToHsl(base);

  return RECIPES.map(({ kind, label, offsets }) => ({
    kind,
    label: label(),
    colors: offsets.map((offset) => {
      const hue = ((h + offset) % 360 + 360) % 360;
      return rgbToHex(hslToRgb(hue, s, l), true);
    }),
  }));
}

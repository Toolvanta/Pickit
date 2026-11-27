// Single gating point for a future paid tier. Every feature is enabled today; if a
// paid plan is introduced, change `currentPlan()` and the `FREE` set, and nothing else.

export type Feature =
  | 'screen-picker'
  | 'page-scan'
  | 'contrast'
  | 'shades'
  | 'palettes'
  | 'export'
  | 'style-guide'
  | 'harmonies'
  | 'search'
  | 'favorites'
  | 'commands';

export type Plan = 'free' | 'pro';

const FREE: ReadonlySet<Feature> = new Set<Feature>([
  'screen-picker',
  'page-scan',
  'contrast',
  'shades',
  'palettes',
  'export',
  'style-guide',
  'harmonies',
  'search',
  'favorites',
  'commands',
]);

function currentPlan(): Plan {
  return 'free';
}

export function isEnabled(feature: Feature): boolean {
  return currentPlan() === 'pro' || FREE.has(feature);
}

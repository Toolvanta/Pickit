// Backup files: everything Pickit stores, as one JSON file the user keeps. Importing
// validates every field, because a backup is a file from disk and may have been edited
// or come from somewhere else.

import { COLOR_FORMATS, hexToRgb, rgbToHex } from './color';
import { t } from './i18n';
import { DEFAULTS, HISTORY_LIMITS, type ColorEntry, type FontEntry, type Palette, type State } from './storage';

const APP = 'pickit';
const VERSION = 1;
const FONT_SOURCES = new Set(['google', 'adobe', 'hosted', 'system', 'generic']);

export function serializeBackup(state: State): string {
  return JSON.stringify({ app: APP, version: VERSION, exportedAt: new Date().toISOString(), data: state }, null, 2);
}

export type BackupResult = { ok: true; state: State; counts: Record<'colors' | 'fonts' | 'palettes', number> } | { ok: false; error: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 200): string | null => (typeof v === 'string' && v.length <= max ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const hex = (v: unknown): string | null => {
  const s = str(v, 16);
  const rgb = s ? hexToRgb(s) : null;
  return rgb ? rgbToHex(rgb) : null;
};
const id = (v: unknown) => str(v, 64) ?? Math.random().toString(36).slice(2, 10);

function readColors(v: unknown): ColorEntry[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((item): ColorEntry[] => {
    if (!isObject(item)) return [];
    const h = hex(item.hex);
    if (!h) return [];
    const token = str(item.token, 120);
    return [
      {
        id: id(item.id),
        hex: h,
        ts: num(item.ts) ?? Date.now(),
        origin: str(item.origin, 253) ?? 'imported',
        ...(token ? { token } : {}),
        ...(item.favorite === true ? { favorite: true } : {}),
      },
    ];
  });
}

function readFonts(v: unknown): FontEntry[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((item): FontEntry[] => {
    if (!isObject(item)) return [];
    const family = str(item.family, 200);
    const size = num(item.size);
    const weight = num(item.weight);
    if (!family || size === null || weight === null) return [];
    const source = str(item.source, 20);
    const link = str(item.link, 500);
    return [
      {
        id: id(item.id),
        ts: num(item.ts) ?? Date.now(),
        origin: str(item.origin, 253) ?? 'imported',
        family,
        certain: item.certain === true,
        stack: str(item.stack, 500) ?? family,
        size,
        weight,
        style: str(item.style, 40) ?? 'normal',
        lineHeight: str(item.lineHeight, 40) ?? 'normal',
        letterSpacing: str(item.letterSpacing, 40) ?? 'normal',
        color: str(item.color, 60) ?? '#000000',
        source: source && FONT_SOURCES.has(source) ? (source as FontEntry['source']) : 'generic',
        sourceLabel: str(item.sourceLabel, 120) ?? '',
        // Only Google Fonts specimen links are ever stored; anything else is dropped.
        ...(link && link.startsWith('https://fonts.google.com/') ? { link } : {}),
        ...(item.favorite === true ? { favorite: true } : {}),
      },
    ];
  });
}

function readPalettes(v: unknown): Palette[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((item): Palette[] => {
    if (!isObject(item) || !Array.isArray(item.colors)) return [];
    return [
      {
        id: id(item.id),
        name: str(item.name, 120) ?? t('backup_imported_palette_name'),
        // Different spellings (#abc, #AABBCC) normalise to the same colour; keep one.
        colors: [...new Set(item.colors.map(hex).filter((c): c is string => c !== null))],
        ts: num(item.ts) ?? Date.now(),
      },
    ];
  });
}

/** Parses and validates a backup file. Unknown or malformed entries are dropped, not trusted. */
export function parseBackup(text: string): BackupResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: t('backup_error_invalid_json') };
  }
  if (!isObject(raw) || raw.app !== APP || !isObject(raw.data)) {
    return { ok: false, error: t('backup_error_not_pickit') };
  }
  if (typeof raw.version !== 'number' || raw.version > VERSION) {
    return { ok: false, error: t('backup_error_newer_version') };
  }
  const data = raw.data;
  const settingsIn = isObject(data.settings) ? data.settings : {};
  const format = COLOR_FORMATS.find((f) => f === settingsIn.format) ?? DEFAULTS.settings.format;
  const theme = (['system', 'light', 'dark'] as const).find((v) => v === settingsIn.theme) ?? DEFAULTS.settings.theme;
  const limit = HISTORY_LIMITS.find((n) => n === settingsIn.historyLimit) ?? DEFAULTS.settings.historyLimit;
  const statsIn = isObject(data.stats) ? data.stats : {};

  const state: State = {
    settings: {
      format,
      upperHex: typeof settingsIn.upperHex === 'boolean' ? settingsIn.upperHex : DEFAULTS.settings.upperHex,
      theme,
      historyLimit: limit,
      sync: settingsIn.sync === true,
    },
    colors: readColors(data.colors),
    fonts: readFonts(data.fonts),
    savedFonts: readFonts(data.savedFonts),
    palettes: readPalettes(data.palettes),
    stats: {
      picks: Math.max(0, Math.floor(num(statsIn.picks) ?? 0)),
      ratingDismissed: statsIn.ratingDismissed === true,
    },
  };
  return {
    ok: true,
    state,
    counts: { colors: state.colors.length, fonts: state.fonts.length + state.savedFonts.length, palettes: state.palettes.length },
  };
}

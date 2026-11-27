import { type JSX } from 'react';
import { hexToRgb, rgbToHex, rgbToHsl } from '@/core/color';
import { harmonies, type Harmony } from '@/core/harmony';
import { t, tp } from '@/core/i18n';
import { newId } from '@/core/storage';
import { copy, inDefaultFormat, toast } from '@/ui/components';
import { useStored } from '@/ui/hooks';
import './harmonies.css';

/** HSL saturation (%) below which hue rotation produces no visible change. */
const GREY_SATURATION = 4;

/** Quiet, rule-separated harmony rows for the side panel's current colour. */
export function Harmonies({ hex }: { hex: string }): JSX.Element | null {
  const [settings] = useStored('settings');
  const [palettes, setPalettes] = useStored('palettes');

  const rows = harmonies(hex);
  if (rows.length === 0) return null;

  // harmonies() normalises to uppercase hex; the recipes put the base in the
  // middle of the analogous row, so always move it to the front ourselves.
  const baseRgb = hexToRgb(hex);
  const baseHex = baseRgb ? rgbToHex(baseRgb) : '';

  // Harmonies rotate the hue. Greys, black and white have (almost) none, so every row
  // would repeat the base colour. Say so instead of showing identical swatches.
  const baseHsl = baseRgb ? rgbToHsl(baseRgb) : null;
  // Near-black and near-white also lose their hue, however saturated HSL says they are.
  if (baseHsl && (baseHsl.s < GREY_SATURATION || baseHsl.l < 3 || baseHsl.l > 97)) {
    return (
      <section className="harmonies" aria-label={t('harmonies_aria')}>
        <p className="muted small">{t('harmonies_neutral_message')}</p>
      </section>
    );
  }

  function addAll(harmony: Harmony) {
    const existing = palettes.find((palette) => palette.name === harmony.label);
    const wanted = [...new Set(harmony.colors)];

    if (!existing) {
      const id = newId();
      setPalettes((list) => [...list, { id, name: harmony.label, colors: wanted, ts: Date.now() }]);
      toast(tp('harmonies_toast_added_new_palette', wanted.length, harmony.label));
      return;
    }

    const missing = wanted.filter((color) => !existing.colors.includes(color));
    if (missing.length === 0) {
      toast(t('harmonies_toast_already_in_palette', harmony.label));
      return;
    }
    setPalettes((list) =>
      list.map((palette) =>
        palette.id === existing.id
          ? { ...palette, colors: [...palette.colors, ...missing.filter((c) => !palette.colors.includes(c))] }
          : palette,
      ),
    );
    toast(tp('harmonies_toast_added_to_palette', missing.length, harmony.label));
  }

  return (
    <section className="harmonies" aria-label={t('harmonies_aria')}>
      {rows.map((harmony) => {
        const others = harmony.colors.filter((color) => color.toUpperCase() !== baseHex.toUpperCase());
        const swatches = [baseHex || harmony.colors[0], ...others];

        return (
          <div className="harmonies-row" key={harmony.kind}>
            <div className="harmonies-head">
              <span className="harmonies-label">{harmony.label}</span>
              <button
                type="button"
                className="harmonies-add"
                aria-label={t('harmonies_add_all_aria', harmony.label)}
                title={t('harmonies_add_all_title', harmony.label)}
                onClick={() => addAll(harmony)}
              >
                {t('harmonies_add_palette_button')}
              </button>
            </div>
            <div className="harmonies-strip" role="group" aria-label={t('harmonies_strip_aria', harmony.label)}>
              {swatches.map((color, index) => {
                const value = inDefaultFormat(color, settings);
                const isBase = index === 0;
                return (
                  <button
                    key={`${color}-${index}`}
                    type="button"
                    className="harmonies-swatch"
                    style={{ backgroundColor: color }}
                    title={isBase ? t('harmonies_swatch_title_base', value) : t('harmonies_swatch_title', value)}
                    aria-label={
                      isBase
                        ? t('harmonies_swatch_copy_base_aria', value, harmony.label)
                        : t('harmonies_swatch_copy_aria', value, harmony.label)
                    }
                    onClick={() => void copy(value, t('harmonies_toast_copied_value', value))}
                  >
                    {isBase && <span className="harmonies-base" aria-hidden="true">{t('harmonies_base_badge')}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}

import { type JSX } from 'react';
import { hexToRgb, rgbToHex } from '@/core/color';
import { harmonies, type Harmony } from '@/core/harmony';
import { newId } from '@/core/storage';
import { copy, inDefaultFormat, toast } from '@/ui/components';
import { useStored } from '@/ui/hooks';
import './harmonies.css';

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

  function addAll(harmony: Harmony) {
    const existing = palettes.find((palette) => palette.name === harmony.label);
    const wanted = [...new Set(harmony.colors)];

    if (!existing) {
      setPalettes([...palettes, { id: newId(), name: harmony.label, colors: wanted, ts: Date.now() }]);
      toast(`Added ${wanted.length} ${wanted.length === 1 ? 'colour' : 'colours'} to a new ${harmony.label} palette`);
      return;
    }

    const missing = wanted.filter((color) => !existing.colors.includes(color));
    if (missing.length === 0) {
      toast(`${harmony.label} colours are already in the palette`);
      return;
    }
    setPalettes(palettes.map((palette) => (palette.id === existing.id ? { ...palette, colors: [...palette.colors, ...missing] } : palette)));
    toast(`Added ${missing.length} ${missing.length === 1 ? 'colour' : 'colours'} to ${harmony.label}`);
  }

  return (
    <section className="harmonies" aria-label="Colour harmonies">
      <h3>Harmonies</h3>
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
                aria-label={`Add all to palette: ${harmony.label}`}
                title={`Add all ${harmony.label} colours to a palette`}
                onClick={() => addAll(harmony)}
              >
                Add all to palette
              </button>
            </div>
            <div className="harmonies-strip" role="group" aria-label={`${harmony.label} colours`}>
              {swatches.map((color, index) => {
                const value = inDefaultFormat(color, settings);
                const isBase = index === 0;
                return (
                  <button
                    key={`${color}-${index}`}
                    type="button"
                    className="harmonies-swatch"
                    style={{ backgroundColor: color }}
                    title={`${value}${isBase ? ' · base' : ''} · click to copy`}
                    aria-label={`Copy ${value} from ${harmony.label}${isBase ? ' (base)' : ''}`}
                    onClick={() => void copy(value, `Copied ${value}`)}
                  >
                    {isBase && <span className="harmonies-base" aria-hidden="true">base</span>}
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

import { useState } from 'react';
import { browser } from 'wxt/browser';
import { hexToRgb, nearestColorName, rgbToHex, shades } from '@/core/color';
import { isEnabled } from '@/core/features';
import type { BackgroundRequest, StartResponse } from '@/core/messages';
import { addColor, newId, type Settings } from '@/core/storage';
import { ColorFormats, copy, Empty, inDefaultFormat, timeAgo, toast } from '@/ui/components';
import { useStored } from '@/ui/hooks';
import { Icon } from '@/ui/icons';

const NEW_PALETTE = '__new__';

export function Colors(props: { settings: Settings; onContrast: (role: 'fg' | 'bg', hex: string) => void }) {
  const { settings } = props;
  const [colors, setColors, loaded] = useStored('colors');
  const [palettes, setPalettes] = useStored('palettes');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const current = colors.find((c) => c.id === selectedId) ?? colors[0];
  const rgb = current ? hexToRgb(current.hex) : null;
  const canScreenPick = isEnabled('screen-picker') && 'EyeDropper' in window;

  async function pickFromPage() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) return;
    const request: BackgroundRequest = { t: 'start', mode: 'color', tabId: tab.id };
    const response = (await browser.runtime.sendMessage(request)) as StartResponse;
    if (!response.ok) {
      toast(response.reason === 'restricted' ? 'PickKit cannot run on this page' : 'Click the PickKit toolbar icon on this tab first');
    }
  }

  async function pickFromScreen() {
    if (!window.EyeDropper) return;
    try {
      const { sRGBHex } = await new window.EyeDropper().open();
      const picked = hexToRgb(sRGBHex);
      if (!picked) return;
      const hex = rgbToHex(picked);
      await addColor({ hex, origin: 'screen' });
      await copy(inDefaultFormat(hex, settings));
      setSelectedId(null);
    } catch {
      // Cancelled with Esc.
    }
  }

  function addToPalette(target: string, hex: string) {
    if (target === NEW_PALETTE) {
      setPalettes([...palettes, { id: newId(), name: `Palette ${palettes.length + 1}`, colors: [hex], ts: Date.now() }]);
      toast('Added to a new palette');
      return;
    }
    const palette = palettes.find((p) => p.id === target);
    if (!palette) return;
    if (palette.colors.includes(hex)) {
      toast(`Already in ${palette.name}`);
      return;
    }
    setPalettes(palettes.map((p) => (p.id === target ? { ...p, colors: [...p.colors, hex] } : p)));
    toast(`Added to ${palette.name}`);
  }

  return (
    <div className="stack">
      <div className="row">
        <button type="button" className="btn btn-primary grow" onClick={() => void pickFromPage()}>
          <Icon name="pipette" /> Pick from page
        </button>
        {canScreenPick && (
          <button type="button" className="btn grow" onClick={() => void pickFromScreen()}>
            <Icon name="monitor" /> Pick from screen
          </button>
        )}
      </div>

      {loaded && !current && (
        <Empty icon="pipette" title="No colours yet">
          Colours you pick are kept here so you can copy them again, compare them and build palettes.
        </Empty>
      )}

      {current && rgb && (
        <section className="card stack">
          <div className="row">
            <div className="detail-swatch" style={{ background: current.hex }} />
            <div className="grow">
              <div className="strong truncate">{nearestColorName(rgb)}</div>
              <div className="muted small truncate">
                {current.origin === 'screen' ? 'Picked from screen' : current.origin} · {timeAgo(current.ts)}
              </div>
              {current.token && <div className="mono small truncate">{current.token}</div>}
            </div>
          </div>

          <ColorFormats hex={current.hex} settings={settings} />

          {isEnabled('shades') && (
            <div>
              <h3>Shades</h3>
              <div className="shades">
                {shades(rgb).map((shade) => (
                  <button
                    key={shade.step}
                    type="button"
                    className="shade"
                    style={{ background: shade.hex }}
                    title={`${shade.step} · ${shade.hex}`}
                    aria-label={`Copy shade ${shade.step}, ${shade.hex}`}
                    onClick={() => void copy(inDefaultFormat(shade.hex, settings))}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="row wrap">
            <select
              className="select grow"
              aria-label="Add this colour to a palette"
              value=""
              onChange={(e) => e.target.value && addToPalette(e.target.value, current.hex)}
            >
              <option value="">Add to palette…</option>
              {palettes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value={NEW_PALETTE}>New palette</option>
            </select>
            <button type="button" className="btn" title="Use as text colour in the contrast checker" onClick={() => props.onContrast('fg', current.hex)}>
              As text
            </button>
            <button type="button" className="btn" title="Use as background in the contrast checker" onClick={() => props.onContrast('bg', current.hex)}>
              As background
            </button>
          </div>
        </section>
      )}

      {colors.length > 0 && (
        <section className="stack">
          <div className="row between">
            <h3>History · {colors.length}</h3>
            {confirmClear ? (
              <div className="row">
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  onClick={() => {
                    setColors([]);
                    setConfirmClear(false);
                  }}
                >
                  Clear all
                </button>
                <button type="button" className="btn btn-small btn-ghost" onClick={() => setConfirmClear(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <div className="row">
                {current && (
                  <button
                    type="button"
                    className="btn btn-small btn-ghost"
                    onClick={() => {
                      setColors(colors.filter((c) => c.id !== current.id));
                      setSelectedId(null);
                    }}
                  >
                    Remove selected
                  </button>
                )}
                <button type="button" className="btn btn-small btn-ghost" onClick={() => setConfirmClear(true)}>
                  Clear
                </button>
              </div>
            )}
          </div>
          <div className="swatch-grid">
            {colors.map((color) => (
              <button
                key={color.id}
                type="button"
                className="swatch"
                style={{ background: color.hex }}
                title={inDefaultFormat(color.hex, settings)}
                aria-label={`Select ${color.hex}`}
                aria-pressed={color.id === current?.id}
                onClick={() => setSelectedId(color.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

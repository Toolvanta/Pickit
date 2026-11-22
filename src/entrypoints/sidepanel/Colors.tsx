import { useMemo, useState } from 'react';
import { browser } from 'wxt/browser';
import { hexToRgb, nearestColorName, readableOn, rgbToHex, shades } from '@/core/color';
import { isEnabled } from '@/core/features';
import type { BackgroundRequest, StartResponse } from '@/core/messages';
import { addColor, newId, toggleColorFavorite, type Settings } from '@/core/storage';
import { ColorFormats, copy, Empty, IconButton, inDefaultFormat, timeAgo, toast } from '@/ui/components';
import { useStored } from '@/ui/hooks';
import { Icon } from '@/ui/icons';
import { SearchField } from '@/ui/search';
import { Harmonies } from './Harmonies';

const NEW_PALETTE = '__new__';

export function Colors(props: {
  settings: Settings;
  onContrast: (role: 'fg' | 'bg', hex: string) => void;
  /** Optionally controlled by App so the context header can follow the selection. */
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}) {
  const { settings } = props;
  const [colors, setColors, loaded] = useStored('colors');
  const [palettes, setPalettes] = useStored('palettes');
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [query, setQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const selectedId = props.selectedId !== undefined ? props.selectedId : localSelected;
  const select = (id: string | null) => {
    if (props.onSelect) props.onSelect(id);
    else setLocalSelected(id);
  };

  const current = colors.find((c) => c.id === selectedId) ?? colors[0];
  const rgb = current ? hexToRgb(current.hex) : null;

  const filteredColors = useMemo(() => {
    const term = query.trim().toLowerCase();
    return colors.filter((color) => {
      if (favoritesOnly && !color.favorite) return false;
      if (!term) return true;
      const colorRgb = hexToRgb(color.hex);
      const name = colorRgb ? nearestColorName(colorRgb) : '';
      return [color.hex, color.token, color.origin, name].some((value) => value?.toLowerCase().includes(term));
    });
  }, [colors, favoritesOnly, query]);

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
      select(null);
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
      <section className="stack" style={{ gap: 6 }}>
        <div className="eyebrow">Capture</div>
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
      </section>

      {loaded && !current && (
        <Empty icon="pipette" title="No colours yet">
          Colours you pick are kept here so you can copy them again, compare them and build palettes.
        </Empty>
      )}

      {current && rgb && (
        <section key={current.id} className="card color-hero pop-in">
          <div className="hero-top">
            <div className="hero-swatch" style={{ backgroundColor: current.hex, color: readableOn(rgb) }} aria-hidden="true">
              <span className="mono">{current.hex}</span>
            </div>
            <div className="hero-meta grow">
              <div className="eyebrow">Selected colour</div>
              <h2 className="hero-name truncate">{nearestColorName(rgb)}</h2>
              <div className="hero-sub truncate">
                {current.origin === 'screen' ? 'Picked from screen' : current.origin} · {timeAgo(current.ts)}
              </div>
              {current.token && (
                <span className="badge badge-live mono truncate" title={current.token}>
                  {current.token}
                </span>
              )}
            </div>
            <IconButton
              icon="heart"
              active={Boolean(current.favorite)}
              label={current.favorite ? 'Remove from favourites' : 'Add to favourites'}
              onClick={() => void toggleColorFavorite(current.id)}
            />
          </div>

          <ColorFormats hex={current.hex} settings={settings} />

          {isEnabled('shades') && (
            <div className="stack" style={{ gap: 6 }}>
              <div className="mini-head">
                <h3>Shades</h3>
                <span className="faint small">Tap to copy</span>
              </div>
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

          <div className="divider" />

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
              <Icon name="type" size={14} /> As text
            </button>
            <button type="button" className="btn" title="Use as background in the contrast checker" onClick={() => props.onContrast('bg', current.hex)}>
              <Icon name="layers" size={14} /> As background
            </button>
          </div>
        </section>
      )}

      {current && rgb && <Harmonies hex={current.hex} />}

      {colors.length > 0 && (
        <section className="stack">
          <div className="section-head">
            <div>
              <div className="eyebrow">History</div>
              <h3>{filteredColors.length} {filteredColors.length === 1 ? 'colour' : 'colours'}</h3>
            </div>
            {confirmClear ? (
              <div className="row">
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  onClick={() => {
                    setColors([]);
                    select(null);
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
                      select(null);
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
          <div className="filter-row">
            <SearchField
              label="Search colours"
              placeholder="Search hex, name, token…"
              value={query}
              onChange={setQuery}
            />
            <button
              type="button"
              className={`btn btn-small${favoritesOnly ? ' btn-primary' : ''}`}
              aria-pressed={favoritesOnly}
              onClick={() => setFavoritesOnly((value) => !value)}
            >
              <Icon name="heart" size={13} /> Favourites
            </button>
          </div>
          <div className="history-stage">
            {filteredColors.length === 0 ? (
              <div className="muted small filter-empty">No colours match this search.</div>
            ) : (
              <div className="swatch-grid">
                {filteredColors.map((color, index) => (
                  <button
                    key={color.id}
                    type="button"
                    className="swatch history-swatch"
                    data-index={index + 1}
                    data-favorite={color.favorite ? 'true' : undefined}
                    style={{ background: color.hex }}
                    title={`${inDefaultFormat(color.hex, settings)}${color.favorite ? ' · favourite' : ''}`}
                    aria-label={`Select ${color.hex}${color.favorite ? ', favourite' : ''}`}
                    aria-pressed={color.id === current?.id}
                    onClick={() => select(color.id)}
                  >
                    {color.id === current?.id && (
                      <span className="swatch-check">
                        <Icon name="check" size={11} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

import { useMemo, useState, type CSSProperties } from 'react';
import { hexToRgb, nearestColorName, readableOn, rgbToHex, rgbToOklab, shades, type RGB } from '@/core/color';
import { exportColors, slug } from '@/core/export';
import { isEnabled } from '@/core/features';
import { t, tp } from '@/core/i18n';
import { addColor, newId, toggleColorFavorite, type Settings } from '@/core/storage';
import { ColorFormats, copy, Empty, IconButton, inDefaultFormat, Segmented, timeAgo, toast } from '@/ui/components';
import { useStored } from '@/ui/hooks';
import { Icon } from '@/ui/icons';
import { SearchField } from '@/ui/search';
import { Harmonies } from './Harmonies';

const NEW_PALETTE = '__new__';

type Explore = 'shades' | 'harmonies';

/** Index of the shade closest to `rgb`, so the scale can show where the colour sits. */
function nearestShade(rgb: RGB, scale: { hex: string }[]): number {
  const base = rgbToOklab(rgb);
  let best = 0;
  let bestDistance = Infinity;
  scale.forEach((shade, index) => {
    const lab = rgbToOklab(hexToRgb(shade.hex)!);
    const d = (lab[0] - base[0]) ** 2 + (lab[1] - base[1]) ** 2 + (lab[2] - base[2]) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = index;
    }
  });
  return best;
}

function Shades({ rgb, settings }: { rgb: RGB; settings: Settings }) {
  const scale = shades(rgb);
  const nearest = nearestShade(rgb, scale);
  const name = slug(nearestColorName(rgb));
  const keys = scale.map((s) => s.step);
  const hexes = scale.map((s) => s.hex);

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="shades" role="group" aria-label={t('colors_shade_scale_aria')}>
        {scale.map((shade, index) => (
          <button
            key={shade.step}
            type="button"
            className="shade"
            data-nearest={index === nearest ? '' : undefined}
            style={{ '--shade': shade.hex, '--shade-ink': readableOn(hexToRgb(shade.hex)!) } as CSSProperties}
            title={
              index === nearest
                ? t('colors_shade_title_nearest', shade.step, inDefaultFormat(shade.hex, settings))
                : t('colors_shade_title', shade.step, inDefaultFormat(shade.hex, settings))
            }
            aria-label={t('colors_shade_copy_aria', shade.step, inDefaultFormat(shade.hex, settings))}
            onClick={() => void copy(inDefaultFormat(shade.hex, settings))}
          >
            <span className="shade-chip" />
            <span className="shade-step">{shade.step}</span>
          </button>
        ))}
      </div>
      <div className="row wrap explore-actions">
        <span className="faint small grow">{t('colors_copy_scale_as')}</span>
        <button type="button" className="btn btn-small" onClick={() => void copy(exportColors(name, hexes, 'css', keys), t('colors_toast_copied_css_variables'))}>
          CSS
        </button>
        <button type="button" className="btn btn-small" onClick={() => void copy(exportColors(name, hexes, 'tailwind', keys), t('colors_toast_copied_tailwind_scale'))}>
          Tailwind
        </button>
        <button type="button" className="btn btn-small" onClick={() => void copy(exportColors(name, hexes, 'tokens', keys), t('colors_toast_copied_design_tokens'))}>
          {t('colors_copy_scale_tokens')}
        </button>
      </div>
    </div>
  );
}

export function Colors(props: {
  settings: Settings;
  onContrast: (role: 'fg' | 'bg', hex: string) => void;
  /** Starts the in-page colour picker. App owns it so a failure can show the access prompt. */
  onPickFromPage: () => void;
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
  const [explore, setExplore] = useState<Explore>('shades');

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
  const favoriteCount = colors.filter((c) => c.favorite).length;

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
      const id = newId();
      setPalettes((list) => [...list, { id, name: t('colors_default_palette_name', list.length + 1), colors: [hex], ts: Date.now() }]);
      toast(t('colors_toast_added_new_palette'));
      return;
    }
    const palette = palettes.find((p) => p.id === target);
    if (!palette) return;
    if (palette.colors.includes(hex)) {
      toast(t('colors_toast_already_in_palette', palette.name));
      return;
    }
    setPalettes((list) =>
      list.map((p) => (p.id === target && !p.colors.includes(hex) ? { ...p, colors: [...p.colors, hex] } : p)),
    );
    toast(t('colors_toast_added_to_palette', palette.name));
  }

  const ink = rgb ? readableOn(rgb) : '#000000';

  return (
    <div className="stack colors-tab">
      <div className="capture">
        <button type="button" className="btn btn-primary btn-lg grow" onClick={props.onPickFromPage}>
          <Icon name="pipette" /> {t('colors_pick_from_page')}
        </button>
        {canScreenPick && (
          <button type="button" className="btn btn-lg" title={t('colors_screen_pick_title')} onClick={() => void pickFromScreen()}>
            <Icon name="monitor" /> {t('colors_screen_pick')}
          </button>
        )}
      </div>

      {loaded && !current && (
        <Empty icon="pipette" title={t('colors_empty_title')}>
          {t('colors_empty_body', t('colors_pick_from_page'))}
        </Empty>
      )}

      {current && rgb && (
        <section key={current.id} className="hero" aria-label={t('colors_selected_aria')}>
          <div className="hero-swatch" style={{ backgroundColor: current.hex, color: ink } as CSSProperties}>
            <div className="hero-swatch-top">
              {current.token ? (
                <span className="hero-token mono truncate" title={t('colors_token_match_title', current.token)}>
                  {current.token}
                </span>
              ) : (
                <span />
              )}
              <button
                type="button"
                className="hero-fav"
                aria-pressed={Boolean(current.favorite)}
                aria-label={current.favorite ? t('colors_favorite_remove') : t('colors_favorite_add')}
                title={current.favorite ? t('colors_favorite_remove') : t('colors_favorite_add')}
                onClick={() => void toggleColorFavorite(current.id)}
              >
                <Icon name="heart" size={16} />
              </button>
            </div>
            <button
              type="button"
              className="hero-copy"
              title={t('colors_copy_default_format_title')}
              onClick={() => void copy(inDefaultFormat(current.hex, settings), t('colors_toast_copied_colour'))}
            >
              <span className="hero-name">{nearestColorName(rgb)}</span>
              <span className="hero-value mono">
                {inDefaultFormat(current.hex, settings)} <Icon name="copy" size={13} />
              </span>
            </button>
          </div>
          <div className="hero-sub">
            <Icon name={current.origin === 'screen' ? 'monitor' : 'page'} size={13} />
            <span className="truncate">{current.origin === 'screen' ? t('colors_origin_screen') : current.origin}</span>
            <span aria-hidden="true">·</span>
            <span className="nowrap">{timeAgo(current.ts)}</span>
          </div>

          <ColorFormats hex={current.hex} settings={settings} />

          <div className="hero-actions">
            <select
              className="select"
              aria-label={t('colors_add_to_palette_aria')}
              value=""
              onChange={(e) => e.target.value && addToPalette(e.target.value, current.hex)}
            >
              <option value="">{t('colors_add_to_palette_placeholder')}</option>
              {palettes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value={NEW_PALETTE}>{t('colors_new_palette_option')}</option>
            </select>
            <button type="button" className="btn" title={t('colors_as_text_title')} onClick={() => props.onContrast('fg', current.hex)}>
              <Icon name="type" size={14} /> {t('colors_as_text')}
            </button>
            <button type="button" className="btn" title={t('colors_as_bg_title')} onClick={() => props.onContrast('bg', current.hex)}>
              <Icon name="layers" size={14} /> {t('colors_as_bg')}
            </button>
          </div>
        </section>
      )}

      {colors.length > 0 && (
        <section className="section" aria-labelledby="history-title">
          <div className="section-title-row">
            <h3 id="history-title">
              {t('colors_history_title')} <span className="count">{colors.length}</span>
            </h3>
            {confirmClear ? (
              <div className="row">
                <span className="small muted">{tp('colors_clear_all_confirm', colors.length)}</span>
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  onClick={() => {
                    // Favourites survive a clear; they are the colours you chose to keep.
                    setColors((list) => list.filter((c) => c.favorite));
                    select(null);
                    setConfirmClear(false);
                  }}
                >
                  {t('colors_clear')}
                </button>
                <button type="button" className="btn btn-small btn-ghost" onClick={() => setConfirmClear(false)}>
                  {t('colors_cancel')}
                </button>
              </div>
            ) : (
              <div className="row" style={{ gap: 2 }}>
                {current && (
                  <IconButton
                    icon="trash"
                    label={t('colors_remove_selected')}
                    onClick={() => {
                      setColors((list) => list.filter((c) => c.id !== current.id));
                      select(null);
                    }}
                  />
                )}
                <button type="button" className="btn btn-small btn-ghost" onClick={() => setConfirmClear(true)}>
                  {t('colors_clear')}
                </button>
              </div>
            )}
          </div>
          <div className="filter-row">
            <SearchField label={t('colors_search_label')} placeholder={t('colors_search_placeholder')} value={query} onChange={setQuery} />
            <button
              type="button"
              className={`chip-toggle${favoritesOnly ? ' is-on' : ''}`}
              aria-pressed={favoritesOnly}
              title={t('colors_favorites_only_title')}
              onClick={() => setFavoritesOnly((value) => !value)}
            >
              <Icon name="heart" size={13} /> {favoriteCount}
            </button>
          </div>
          {filteredColors.length === 0 ? (
            <div className="muted small filter-empty">
              {favoritesOnly && !query ? t('colors_no_favorites') : t('colors_no_search_match')}
            </div>
          ) : (
            <div className="swatch-grid">
              {filteredColors.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  className="swatch history-swatch"
                  data-favorite={color.favorite ? 'true' : undefined}
                  style={{ background: color.hex }}
                  title={
                    color.favorite
                      ? t('colors_swatch_title_favorite', inDefaultFormat(color.hex, settings))
                      : t('colors_swatch_title', inDefaultFormat(color.hex, settings))
                  }
                  aria-label={color.favorite ? t('colors_swatch_select_favorite_aria', color.hex) : t('colors_swatch_select_aria', color.hex)}
                  aria-pressed={color.id === current?.id}
                  onClick={() => select(color.id)}
                  onDoubleClick={() => void copy(inDefaultFormat(color.hex, settings))}
                >
                  {color.favorite && (
                    <span className="swatch-fav" style={{ color: readableOn(hexToRgb(color.hex)!) }} aria-hidden="true">
                      <Icon name="heart" size={10} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          <p className="faint small">{t('colors_history_hint')}</p>
        </section>
      )}

      {current && rgb && (isEnabled('shades') || isEnabled('harmonies')) && (
        <section className="section" aria-label={t('colors_explore_aria')}>
          <div className="section-title-row">
            <h3>{t('colors_explore')}</h3>
            <div style={{ width: 190 }}>
              <Segmented<Explore>
                label={t('colors_explore')}
                value={explore}
                options={[
                  { value: 'shades', label: t('colors_explore_shades') },
                  { value: 'harmonies', label: t('colors_explore_harmonies') },
                ]}
                onChange={setExplore}
              />
            </div>
          </div>
          {explore === 'shades' ? <Shades rgb={rgb} settings={settings} /> : <Harmonies hex={current.hex} />}
        </section>
      )}
    </div>
  );
}

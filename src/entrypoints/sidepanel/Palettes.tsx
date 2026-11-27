import { useState, type KeyboardEvent } from 'react';
import { hexToRgb, parseColor, rgbToHex, simulateVision, VISION_TYPES, type VisionType } from '@/core/color';
import { downloadText } from '@/core/download';
import { EXPORT_FORMATS, exportColors, exportExtension, type ExportFormat } from '@/core/export';
import { t, tp } from '@/core/i18n';
import { newId, type Palette, type Settings } from '@/core/storage';
import { ColorBar, copy, Empty, IconButton, inDefaultFormat, toast } from '@/ui/components';
import { useStored } from '@/ui/hooks';
import { Icon } from '@/ui/icons';

function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

type Vision = 'normal' | VisionType;

/** How a swatch is drawn: the real colour, or as seen with a colour-vision deficiency. */
const seen = (hex: string, vision: Vision) => {
  const rgb = vision === 'normal' ? null : hexToRgb(hex);
  return rgb ? rgbToHex(simulateVision(rgb, vision as VisionType)) : hex;
};

function PaletteCard(props: {
  palette: Palette;
  settings: Settings;
  vision: Vision;
  /** Edits are passed as updaters and applied to the stored palette, not to this render's copy. */
  onChange: (update: (palette: Palette) => Palette) => void;
  onDelete: () => void;
}) {
  const { palette, settings, onChange, vision } = props;
  const [format, setFormat] = useState<ExportFormat>('css');
  const [draft, setDraft] = useState('');
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const parsedDraft = parseColor(draft);

  const setColors = (update: (colors: string[]) => string[]) => onChange((p) => ({ ...p, colors: update(p.colors) }));

  function addDraft() {
    if (!parsedDraft) return;
    const hex = rgbToHex(parsedDraft);
    setColors((colors) => (colors.includes(hex) ? colors : [...colors, hex]));
    setDraft('');
  }

  function onSwatchKey(e: KeyboardEvent, index: number) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      setColors((colors) => colors.filter((_, i) => i !== index));
    } else if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const to = index + (e.key === 'ArrowLeft' ? -1 : 1);
      setColors((colors) => move(colors, index, to));
    }
  }

  return (
    <article className="card palette-card stack">
      <div className="section-head">
        <div className="grow">
          <input
            className="input name-input"
            aria-label={t('palettes_name_label')}
            value={palette.name}
            onChange={(e) => {
              const name = e.target.value;
              onChange((p) => ({ ...p, name }));
            }}
          />
          <div className="faint small">{tp('palettes_colour_count', palette.colors.length)}</div>
        </div>
        {confirmDelete ? (
          <>
            <button type="button" className="btn btn-small btn-danger" onClick={props.onDelete}>
              {t('palettes_delete_confirm')}
            </button>
            <button type="button" className="btn btn-small btn-ghost" onClick={() => setConfirmDelete(false)}>
              {t('palettes_delete_cancel')}
            </button>
          </>
        ) : (
          <IconButton icon="trash" label={t('palettes_delete_palette')} onClick={() => setConfirmDelete(true)} />
        )}
      </div>

      {palette.colors.length === 0 ? (
        <div className="palette-ribbon palette-ribbon-empty">{t('palettes_empty_ribbon')}</div>
      ) : (
        <>
          <div className="palette-ribbon" role="group" aria-label={t('palettes_swatches_label', palette.name)}>
            {palette.colors.map((hex, index) => (
              <button
                key={`${hex}-${index}`}
                type="button"
                className="palette-ribbon-swatch"
                style={{ background: seen(hex, vision), opacity: dragFrom === index ? 0.4 : 1 }}
                title={t('palettes_swatch_title', inDefaultFormat(hex, settings))}
                aria-label={t('palettes_swatch_aria', hex)}
                draggable
                onDragStart={() => setDragFrom(index)}
                onDragEnd={() => setDragFrom(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = dragFrom;
                  if (from !== null) setColors((colors) => move(colors, from, index));
                  setDragFrom(null);
                }}
                onClick={() => void copy(inDefaultFormat(hex, settings))}
                onKeyDown={(e) => onSwatchKey(e, index)}
              />
            ))}
          </div>
          <div className="faint small palette-hint">{t('palettes_swatch_hint')}</div>
        </>
      )}

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          addDraft();
        }}
      >
        <input
          className="input mono grow"
          placeholder={t('palettes_add_placeholder')}
          aria-label={t('palettes_add_label')}
          aria-invalid={draft !== '' && !parsedDraft}
          spellCheck={false}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="btn" disabled={!parsedDraft}>
          <Icon name="plus" /> {t('palettes_add_button')}
        </button>
      </form>

      {palette.colors.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <div className="mini-head">
            <select
              className="select select-small"
              aria-label={t('palettes_export_format_label')}
              value={format}
              onChange={(e) => setFormat(e.target.value as ExportFormat)}
            >
              {EXPORT_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <div className="row">
              <button
                type="button"
                className="btn btn-small"
                onClick={() => void copy(exportColors(palette.name, palette.colors, format), t('palettes_copied_export'))}
              >
                <Icon name="copy" /> {t('palettes_copy_button')}
              </button>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => {
                  downloadText(palette.name, exportColors(palette.name, palette.colors, format), exportExtension(format));
                  toast(t('palettes_downloaded_palette', palette.name));
                }}
              >
                <Icon name="download" /> {t('palettes_file_button')}
              </button>
            </div>
          </div>
          <pre className="code">{exportColors(palette.name, palette.colors, format)}</pre>
        </div>
      )}
    </article>
  );
}

export function Palettes({ settings }: { settings: Settings }) {
  const [palettes, setPalettes, loaded] = useStored('palettes');
  const [vision, setVision] = useState<Vision>('normal');
  const allColors = [...new Set(palettes.flatMap((palette) => palette.colors))];

  const create = () => {
    const id = newId();
    setPalettes((list) => [...list, { id, name: t('palettes_default_name', list.length + 1), colors: [], ts: Date.now() }]);
  };

  return (
    <div className="stack">
      <div className="section-title-row">
        <h3>
          {t('palettes_heading')} <span className="count">{palettes.length}</span>
        </h3>
        {palettes.length > 0 && (
          <select
            className="select select-small"
            aria-label={t('palettes_vision_label')}
            title={t('palettes_vision_title')}
            value={vision}
            onChange={(e) => setVision(e.target.value as Vision)}
          >
            <option value="normal">{t('palettes_vision_typical')}</option>
            {VISION_TYPES.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {loaded && palettes.length === 0 ? (
        <Empty
          icon="palette"
          title={t('palettes_empty_title')}
          action={
            <button type="button" className="btn btn-primary" style={{ marginTop: 8 }} onClick={create}>
              <Icon name="plus" /> {t('palettes_new_palette')}
            </button>
          }
        >
          {t('palettes_empty_body')}
        </Empty>
      ) : (
        <button type="button" className="btn" onClick={create}>
          <Icon name="plus" /> {t('palettes_new_palette')}
        </button>
      )}

      {allColors.length > 0 && (
        <section className="stack" style={{ gap: 8 }}>
          <div className="mini-head">
            <h3>{t('palettes_all_colours_heading')}</h3>
            <button
              type="button"
              className="btn btn-small btn-ghost"
              onClick={() => {
                downloadText('pickit-colours', exportColors('Pickit', allColors, 'css'), '.css');
                toast(t('palettes_downloaded_all'));
              }}
            >
              <Icon name="download" size={13} /> {t('palettes_export_all')}
            </button>
          </div>
          <ColorBar
            colors={allColors.map((hex) => ({ hex, weight: 1 }))}
            onSelect={(hex) => void copy(inDefaultFormat(hex, settings), t('palettes_copied_colour'))}
          />
        </section>
      )}

      {palettes.map((palette) => (
        <PaletteCard
          key={palette.id}
          palette={palette}
          settings={settings}
          vision={vision}
          onChange={(update) => setPalettes((list) => list.map((p) => (p.id === palette.id ? update(p) : p)))}
          onDelete={() => setPalettes((list) => list.filter((p) => p.id !== palette.id))}
        />
      ))}
    </div>
  );
}

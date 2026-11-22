import { useState, type KeyboardEvent } from 'react';
import { parseColor, rgbToHex } from '@/core/color';
import { downloadText } from '@/core/download';
import { EXPORT_FORMATS, exportColors, exportExtension, type ExportFormat } from '@/core/export';
import { newId, type Palette, type Settings } from '@/core/storage';
import { ColorBar, copy, Empty, IconButton, inDefaultFormat, Segmented, toast } from '@/ui/components';
import { useStored } from '@/ui/hooks';
import { Icon } from '@/ui/icons';

function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from === to) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function PaletteCard(props: { palette: Palette; settings: Settings; onChange: (palette: Palette) => void; onDelete: () => void }) {
  const { palette, settings, onChange } = props;
  const [format, setFormat] = useState<ExportFormat>('css');
  const [draft, setDraft] = useState('');
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const parsedDraft = parseColor(draft);

  const setColors = (colors: string[]) => onChange({ ...palette, colors });

  function addDraft() {
    if (!parsedDraft) return;
    const hex = rgbToHex(parsedDraft);
    if (!palette.colors.includes(hex)) setColors([...palette.colors, hex]);
    setDraft('');
  }

  function onSwatchKey(e: KeyboardEvent, index: number) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      setColors(palette.colors.filter((_, i) => i !== index));
    } else if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      setColors(move(palette.colors, index, index + (e.key === 'ArrowLeft' ? -1 : 1)));
    }
  }

  return (
    <article className="card palette-card stack">
      <div className="section-head">
        <div className="grow">
          <div className="eyebrow">Palette</div>
          <input
            className="input name-input"
            aria-label="Palette name"
            value={palette.name}
            onChange={(e) => onChange({ ...palette, name: e.target.value })}
          />
          <div className="faint small">{palette.colors.length} {palette.colors.length === 1 ? 'colour' : 'colours'}</div>
        </div>
        {confirmDelete ? (
          <>
            <button type="button" className="btn btn-small btn-danger" onClick={props.onDelete}>
              Delete
            </button>
            <button type="button" className="btn btn-small btn-ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </>
        ) : (
          <IconButton icon="trash" label="Delete palette" onClick={() => setConfirmDelete(true)} />
        )}
      </div>

      {palette.colors.length === 0 ? (
        <div className="palette-ribbon palette-ribbon-empty">Add a colour below or from the Colours tab.</div>
      ) : (
        <>
          <div className="palette-ribbon" role="list" aria-label={`${palette.name} swatches`}>
            {palette.colors.map((hex, index) => (
              <button
                key={hex}
                type="button"
                role="listitem"
                className="palette-ribbon-swatch"
                style={{ background: hex, opacity: dragFrom === index ? 0.4 : 1 }}
                title={`${inDefaultFormat(hex, settings)} · click to copy, drag to reorder, Delete to remove`}
                aria-label={`${hex}. Enter copies, Delete removes, Alt plus arrow keys reorder.`}
                draggable
                onDragStart={() => setDragFrom(index)}
                onDragEnd={() => setDragFrom(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragFrom !== null) setColors(move(palette.colors, dragFrom, index));
                  setDragFrom(null);
                }}
                onClick={() => void copy(inDefaultFormat(hex, settings))}
                onKeyDown={(e) => onSwatchKey(e, index)}
              />
            ))}
          </div>
          <div className="faint small palette-hint">Drag to reorder · Alt + ←/→ to move · Delete to remove</div>
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
          placeholder="#5548E0 or rgb(…)"
          aria-label="Colour to add"
          aria-invalid={draft !== '' && !parsedDraft}
          spellCheck={false}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="btn" disabled={!parsedDraft}>
          <Icon name="plus" /> Add
        </button>
      </form>

      {palette.colors.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <div className="mini-head">
            <h3>Export</h3>
            <div className="row">
              <button
                type="button"
                className="btn btn-small"
                onClick={() => void copy(exportColors(palette.name, palette.colors, format), 'Copied export')}
              >
                <Icon name="copy" /> Copy
              </button>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => {
                  downloadText(palette.name, exportColors(palette.name, palette.colors, format), exportExtension(format));
                  toast(`Downloaded ${palette.name}`);
                }}
              >
                <Icon name="download" /> File
              </button>
            </div>
          </div>
          <Segmented<ExportFormat> label="Export format" value={format} options={EXPORT_FORMATS} onChange={setFormat} />
          <pre className="code">{exportColors(palette.name, palette.colors, format)}</pre>
        </div>
      )}
    </article>
  );
}

export function Palettes({ settings }: { settings: Settings }) {
  const [palettes, setPalettes, loaded] = useStored('palettes');
  const allColors = [...new Set(palettes.flatMap((palette) => palette.colors))];

  const create = () =>
    setPalettes([...palettes, { id: newId(), name: `Palette ${palettes.length + 1}`, colors: [], ts: Date.now() }]);

  return (
    <div className="stack">
      <div className="section-head">
        <div>
          <div className="eyebrow">Colour library</div>
          <h3>{palettes.length} {palettes.length === 1 ? 'palette' : 'palettes'}</h3>
        </div>
      </div>

      {loaded && palettes.length === 0 ? (
        <Empty
          icon="palette"
          title="No palettes yet"
          action={
            <button type="button" className="btn btn-primary" style={{ marginTop: 8 }} onClick={create}>
              <Icon name="plus" /> New palette
            </button>
          }
        >
          Group colours into a palette, then export them as CSS variables, SCSS, Tailwind or JSON.
        </Empty>
      ) : (
        <button type="button" className="btn" onClick={create}>
          <Icon name="plus" /> New palette
        </button>
      )}

      {allColors.length > 0 && (
        <section className="stack" style={{ gap: 8 }}>
          <div className="mini-head">
            <h3>All colours</h3>
            <button
              type="button"
              className="btn btn-small btn-ghost"
              onClick={() => {
                downloadText('pickkit-colours', exportColors('PickKit', allColors, 'css'), '.css');
                toast('Downloaded all colours');
              }}
            >
              <Icon name="download" size={13} /> Export all
            </button>
          </div>
          <ColorBar
            colors={allColors.map((hex) => ({ hex, weight: 1 }))}
            onSelect={(hex) => void copy(inDefaultFormat(hex, settings), 'Copied colour')}
          />
        </section>
      )}

      {palettes.map((palette) => (
        <PaletteCard
          key={palette.id}
          palette={palette}
          settings={settings}
          onChange={(next) => setPalettes(palettes.map((p) => (p.id === next.id ? next : p)))}
          onDelete={() => setPalettes(palettes.filter((p) => p.id !== palette.id))}
        />
      ))}
    </div>
  );
}

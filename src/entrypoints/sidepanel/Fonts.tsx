import { useState } from 'react';
import { fontCss, lineHeightLabel, weightName } from '@/core/fonts';
import { saveFont, type FontEntry } from '@/core/storage';
import { copy, Empty, IconButton, Segmented, toast } from '@/ui/components';
import { useStored } from '@/ui/hooks';

type View = 'recent' | 'saved';

function FontCard(props: { font: FontEntry; saved: boolean; onSave?: () => void; onRemove: () => void }) {
  const { font } = props;
  return (
    <article className="card stack">
      <div className="row between">
        <div className="grow">
          <div className="row">
            <span className="font-name truncate">{font.family}</span>
            {!font.certain && (
              <span className="badge" title="Best guess based on fonts installed on the device">
                Likely
              </span>
            )}
          </div>
          <div className="muted small truncate">
            {font.sourceLabel} · {font.origin}
          </div>
        </div>
        <span className="dot" style={{ background: font.color }} title={font.color} />
      </div>

      <dl className="facts">
        <div>
          <dt>Size</dt>
          <dd>{font.size}px</dd>
        </div>
        <div>
          <dt>Weight</dt>
          <dd>
            {font.weight} {weightName(font.weight)}
          </dd>
        </div>
        <div>
          <dt>Line height</dt>
          <dd>{lineHeightLabel(font)}</dd>
        </div>
        <div>
          <dt>Spacing</dt>
          <dd>{font.letterSpacing === 'normal' ? 'Normal' : font.letterSpacing}</dd>
        </div>
      </dl>

      <div className="row">
        <button type="button" className="btn btn-small grow" onClick={() => void copy(fontCss(font), 'Copied font CSS')}>
          Copy CSS
        </button>
        {font.link && (
          <a className="btn btn-small" href={font.link} target="_blank" rel="noreferrer">
            Google Fonts
          </a>
        )}
        {props.onSave && !props.saved && <IconButton icon="bookmark" label="Save font" onClick={props.onSave} />}
        <IconButton icon="trash" label="Remove" onClick={props.onRemove} />
      </div>
    </article>
  );
}

export function Fonts() {
  const [recent, setRecent, loaded] = useStored('fonts');
  const [saved, setSaved] = useStored('savedFonts');
  const [view, setView] = useState<View>('recent');
  const list = view === 'recent' ? recent : saved;
  const isSaved = (font: FontEntry) =>
    saved.some((s) => s.family === font.family && s.size === font.size && s.weight === font.weight && s.style === font.style);

  return (
    <div className="stack">
      <Segmented<View>
        label="Font list"
        value={view}
        options={[
          { value: 'recent', label: `Recent · ${recent.length}` },
          { value: 'saved', label: `Saved · ${saved.length}` },
        ]}
        onChange={setView}
      />

      {loaded && list.length === 0 && (
        <Empty icon="type" title={view === 'recent' ? 'No fonts inspected yet' : 'No saved fonts'}>
          {view === 'recent'
            ? 'Start the font inspector on any page and click a piece of text to keep its details here.'
            : 'Save a font from the inspector or from Recent to keep it for later.'}
        </Empty>
      )}

      {list.map((font) => (
        <FontCard
          key={font.id}
          font={font}
          saved={isSaved(font)}
          onSave={
            view === 'recent'
              ? async () => {
                  const { id: _id, ts: _ts, ...info } = font;
                  await saveFont(info);
                  toast('Saved to your fonts');
                }
              : undefined
          }
          onRemove={() =>
            view === 'recent' ? setRecent(recent.filter((f) => f.id !== font.id)) : setSaved(saved.filter((f) => f.id !== font.id))
          }
        />
      ))}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { fontCss, lineHeightLabel, weightName } from '@/core/fonts';
import { t, tp } from '@/core/i18n';
import { saveFont, toggleFontFavorite, type FontEntry } from '@/core/storage';
import { copy, Empty, IconButton, Segmented, toast } from '@/ui/components';
import { useStored } from '@/ui/hooks';
import { SearchField } from '@/ui/search';

type View = 'recent' | 'saved';

function FontCard(props: {
  font: FontEntry;
  saved: boolean;
  onSave?: () => void;
  onFavorite?: () => void;
  onRemove: () => void;
}) {
  const { font } = props;
  return (
    <article className="card stack">
      <div className="row between">
        <div className="grow">
          <div className="row">
            <span className="font-name truncate">{font.family}</span>
            {!font.certain && (
              <span className="badge" title={t('fonts_likely_title')}>
                {t('fonts_likely_badge')}
              </span>
            )}
          </div>
          <div className="muted small truncate">
            {font.sourceLabel} · {font.origin}
          </div>
        </div>
        <span className="dot" style={{ background: font.color }} title={font.color} />
      </div>

      <div className="type-specimen" style={{ fontFamily: font.stack, fontWeight: font.weight }}>
        <span className="specimen-ag">Ag</span>
        <span className="specimen-line">{t('fonts_specimen_pangram')}</span>
      </div>

      <dl className="facts">
        <div>
          <dt>{t('fonts_fact_size')}</dt>
          <dd>{font.size}px</dd>
        </div>
        <div>
          <dt>{t('fonts_fact_weight')}</dt>
          <dd>
            {font.weight} {weightName(font.weight)}
          </dd>
        </div>
        <div>
          <dt>{t('fonts_fact_line_height')}</dt>
          <dd>{lineHeightLabel(font)}</dd>
        </div>
        <div>
          <dt>{t('fonts_fact_spacing')}</dt>
          <dd>{font.letterSpacing === 'normal' ? t('fonts_spacing_normal') : font.letterSpacing}</dd>
        </div>
      </dl>

      <div className="row">
        <button type="button" className="btn btn-small grow" onClick={() => void copy(fontCss(font), t('fonts_copied_css'))}>
          {t('fonts_copy_css')}
        </button>
        {font.link && (
          <a className="btn btn-small" href={font.link} target="_blank" rel="noreferrer">
            Google Fonts
          </a>
        )}
        {props.onSave && !props.saved && <IconButton icon="bookmark" label={t('fonts_save_font')} onClick={props.onSave} />}
        {props.onFavorite && (
          <IconButton
            icon="heart"
            active={Boolean(props.font.favorite)}
            label={props.font.favorite ? t('fonts_remove_favourite') : t('fonts_add_favourite')}
            onClick={props.onFavorite}
          />
        )}
        <IconButton icon="trash" label={t('fonts_remove')} onClick={props.onRemove} />
      </div>
    </article>
  );
}

export function Fonts() {
  const [recent, setRecent, loaded] = useStored('fonts');
  const [saved, setSaved] = useStored('savedFonts');
  const [view, setView] = useState<View>('recent');
  const [query, setQuery] = useState('');
  const source = view === 'recent' ? recent : saved;
  const list = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return source;
    return source.filter((font) =>
      [font.family, font.stack, font.sourceLabel, font.origin].some((value) => value?.toLowerCase().includes(term)),
    );
  }, [query, source]);
  const isSaved = (font: FontEntry) =>
    saved.some((s) => s.family === font.family && s.size === font.size && s.weight === font.weight && s.style === font.style);

  return (
    <div className="stack">
      <div className="section-head">
        <div>
          <div className="eyebrow">{t('fonts_eyebrow_library')}</div>
          <h3>{view === 'recent' ? t('fonts_heading_recent') : t('fonts_heading_saved')}</h3>
        </div>
      </div>
      <SearchField
        label={t('fonts_search_label')}
        placeholder={t('fonts_search_placeholder')}
        value={query}
        onChange={setQuery}
      />
      <Segmented<View>
        label={t('fonts_list_label')}
        value={view}
        options={[
          { value: 'recent', label: tp('fonts_tab_recent', recent.length) },
          { value: 'saved', label: tp('fonts_tab_saved', saved.length) },
        ]}
        onChange={setView}
      />

      {loaded && list.length === 0 && (
        <Empty
          icon="type"
          title={query ? t('fonts_empty_search_title') : view === 'recent' ? t('fonts_empty_recent_title') : t('fonts_empty_saved_title')}
        >
          {query
            ? t('fonts_empty_search_body')
            : view === 'recent'
              ? t('fonts_empty_recent_body')
              : t('fonts_empty_saved_body')}
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
                  toast(t('fonts_saved_toast'));
                }
              : undefined
          }
          onFavorite={
            view === 'recent'
              ? () => {
                  void toggleFontFavorite(font.id);
                }
              : undefined
          }
          onRemove={() =>
            view === 'recent'
              ? setRecent((list) => list.filter((f) => f.id !== font.id))
              : setSaved((list) => list.filter((f) => f.id !== font.id))
          }
        />
      ))}
    </div>
  );
}

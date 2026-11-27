import { useCallback, useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { hexToRgb, nearestColorName } from '@/core/color';
import { exportColors } from '@/core/export';
import { isEnabled } from '@/core/features';
import { t, tp } from '@/core/i18n';
import type { BackgroundRequest, FailureReason, ScanResponse } from '@/core/messages';
import { hasAllSites, requestAllSites, watchAllSites } from '@/core/permissions';
import type { ScanColor, ScanResult } from '@/core/scan';
import { newId, type Settings } from '@/core/storage';
import { downloadCanvas, renderStyleGuide } from '@/core/style-guide';
import { ColorBar, copy, Empty, inDefaultFormat, Segmented, Skeleton, toast } from '@/ui/components';
import { useStored } from '@/ui/hooks';
import { Icon } from '@/ui/icons';

type Role = 'all' | 'text' | 'background' | 'border';
type Status =
  | { kind: 'loading' }
  | { kind: 'done'; result: ScanResult }
  | { kind: 'failed'; reason: FailureReason };

const PALETTE_SIZE = 12;
/** Elements read before a scan stops; matches the limit in the page scanner. */
const SCAN_ELEMENT_LIMIT = 6000;

const usage = (color: ScanColor, role: Role) =>
  role === 'all' ? color.text + color.background + color.border : color[role];

export function Page({ settings }: { settings: Settings }) {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [role, setRole] = useState<Role>('all');
  const [, setPalettes] = useStored('palettes');
  const [allSites, setAllSites] = useState(false);

  useEffect(() => {
    void hasAllSites().then(setAllSites);
    return watchAllSites(setAllSites);
  }, []);

  // Scans can overlap (tab switches while a slow page is still being read). Only the
  // newest request may update the view, so a late reply cannot show another tab's data.
  const latest = useRef(0);
  const scan = useCallback(async () => {
    const request = ++latest.current;
    setStatus({ kind: 'loading' });
    let next: Status;
    try {
      const { id: windowId } = await browser.windows.getCurrent();
      if (windowId === undefined) throw new Error('no window');
      const message: BackgroundRequest = { t: 'scan', windowId };
      const response = (await browser.runtime.sendMessage(message)) as ScanResponse;
      next = response.ok ? { kind: 'done', result: response.result } : { kind: 'failed', reason: response.reason };
    } catch {
      next = { kind: 'failed', reason: 'unknown' };
    }
    if (request === latest.current) setStatus(next);
  }, []);

  // Rescan when the user switches tab or the page finishes loading, in this window only.
  useEffect(() => {
    let windowId: number | undefined;
    void browser.windows.getCurrent().then((w) => {
      windowId = w.id;
    });
    void scan();
    const onActivated = (info: { windowId: number }) => {
      if (windowId === undefined || info.windowId === windowId) void scan();
    };
    const onUpdated = (_id: number, change: { status?: string }, tab: { active?: boolean; windowId?: number }) => {
      if (change.status === 'complete' && tab.active && (windowId === undefined || tab.windowId === windowId)) void scan();
    };
    browser.tabs.onActivated.addListener(onActivated);
    browser.tabs.onUpdated.addListener(onUpdated);
    return () => {
      browser.tabs.onActivated.removeListener(onActivated);
      browser.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [scan]);

  if (!isEnabled('page-scan')) return null;

  if (status.kind === 'loading') {
    return (
      <div className="stack" aria-busy="true">
        <div className="section-head">
          <div>
            <div className="eyebrow">{t('page_loading_eyebrow')}</div>
            <h3>{t('page_loading_heading')}</h3>
          </div>
          <span className="badge badge-live">{t('page_loading_badge')}</span>
        </div>
        <div className="row" style={{ gap: 4 }} aria-hidden="true">
          {[4, 3, 6, 2, 5, 3, 4].map((weight, index) => (
            <div key={index} style={{ flexGrow: weight }}>
              <Skeleton height={44} radius={index === 0 || index === 6 ? 8 : 0} />
            </div>
          ))}
        </div>
        <div className="stack" style={{ gap: 8, marginTop: 4 }} aria-hidden="true">
          <Skeleton height={11} width="42%" />
          <Skeleton height={11} width="68%" />
          <Skeleton height={11} width="55%" />
          <Skeleton height={64} width="100%" radius={12} />
          <Skeleton height={64} width="100%" radius={12} />
        </div>
      </div>
    );
  }

  if (status.kind === 'failed') {
    if (status.reason === 'restricted') {
      return (
        <Empty icon="alert" title={t('page_restricted_title')}>
          {t('page_restricted_body')}
        </Empty>
      );
    }
    if (allSites) {
      return (
        <Empty
          icon="scan"
          title={t('page_unreadable_title')}
          action={
            <button type="button" className="btn btn-primary" onClick={() => void scan()} style={{ marginTop: 8 }}>
              {t('page_scan_again')}
            </button>
          }
        >
          {t('page_unreadable_body')}
        </Empty>
      );
    }
    return (
      <Empty
        icon="scan"
        title={t('page_not_invoked_title')}
        action={
          <div className="row" style={{ marginTop: 8, justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void requestAllSites().then((ok) => ok && void scan())}
            >
              {t('page_allow_all_sites')}
            </button>
            <button type="button" className="btn" onClick={() => void scan()}>
              {t('page_scan_again')}
            </button>
          </div>
        }
      >
        {t('page_not_invoked_body')}
      </Empty>
    );
  }

  const { result } = status;
  const colors = result.colors.filter((c) => usage(c, role) > 0).sort((a, b) => usage(b, role) - usage(a, role));
  const topHexes = colors.slice(0, PALETTE_SIZE).map((c) => c.hex);
  const ribbonColors = result.colors
    .slice(0, PALETTE_SIZE)
    .map((color) => ({ hex: color.hex, weight: color.text + color.background + color.border }));

  function saveAsPalette() {
    const id = newId();
    setPalettes((list) => [...list, { id, name: result.host || t('page_default_palette_name'), colors: topHexes, ts: Date.now() }]);
    toast(t('page_saved_as_palette'));
  }

  async function downloadGuide() {
    await downloadCanvas(renderStyleGuide(result), `${result.host || 'page'}-style-guide.png`);
    toast(t('page_style_guide_downloaded'));
  }

  return (
    <div className="stack">
      <div className="section-head">
        <div className="grow">
          <div className="eyebrow">{t('page_current_eyebrow')}</div>
          <h2 className="page-host truncate">{result.host || t('page_this_page')}</h2>
          <div className="muted small truncate page-title">{result.title}</div>
        </div>
        <button type="button" className="btn btn-small" onClick={() => void scan()}>
          <Icon name="scan" /> {t('page_rescan')}
        </button>
      </div>

      {ribbonColors.length > 0 && (
        <section className="stack" style={{ gap: 8 }}>
          <div className="mini-head">
            <h3>{t('page_fingerprint_heading')}</h3>
            <span className="faint small">{t('page_fingerprint_hint')}</span>
          </div>
          <ColorBar
            colors={ribbonColors}
            onSelect={(hex) => void copy(inDefaultFormat(hex, settings), t('page_copied_colour'))}
          />
        </section>
      )}

      {isEnabled('style-guide') && (
        <div className="row">
          <button type="button" className="btn btn-primary grow" onClick={() => void downloadGuide()}>
            <Icon name="download" /> {t('page_style_guide_button')}
          </button>
          <button
            type="button"
            className="btn grow"
            onClick={() => void copy(exportColors(result.host, topHexes, 'css'), t('page_copied_css_variables'))}
          >
            <Icon name="copy" /> {t('page_copy_tokens')}
          </button>
        </div>
      )}

      <section className="stack">
        <div className="section-head">
          <div>
            <div className="eyebrow">{t('page_palette_eyebrow')}</div>
            <h3>{tp('page_colours_heading', colors.length)}</h3>
          </div>
          <button type="button" className="btn btn-small btn-ghost" onClick={saveAsPalette} disabled={!topHexes.length}>
            <Icon name="bookmark" size={13} /> {t('page_save_as_palette')}
          </button>
        </div>
        <Segmented<Role>
          label={t('page_role_label')}
          value={role}
          options={[
            { value: 'all', label: t('page_role_all') },
            { value: 'text', label: t('page_role_text') },
            { value: 'background', label: t('page_role_background') },
            { value: 'border', label: t('page_role_border') },
          ]}
          onChange={setRole}
        />
        {colors.length === 0 && <p className="muted small">{t('page_no_colours_in_role')}</p>}
        <ul className="list">
          {colors.map((color) => {
            const rgb = hexToRgb(color.hex);
            const value = inDefaultFormat(color.hex, settings);
            return (
              <li key={color.hex}>
                <button type="button" className="list-row" onClick={() => void copy(value)} aria-label={t('page_copy_value', value)}>
                  <span className="list-swatch" style={{ background: color.hex }} />
                  <span className="grow">
                    <span className="mono">{value}</span>
                    <span className="muted small block">{rgb ? nearestColorName(rgb) : ''}</span>
                  </span>
                  <span className="muted small">{tp('page_uses_count', usage(color, role))}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="stack">
        <div className="section-head">
          <div>
            <div className="eyebrow">{t('page_type_eyebrow')}</div>
            <h3>{tp('page_typography_heading', result.fonts.length)}</h3>
          </div>
        </div>
        {result.fonts.map((font) => (
          <article key={font.family} className="card stack">
            <div className="row between">
              <div className="row grow">
                <span className="font-name truncate">{font.family}</span>
                {!font.certain && <span className="badge">{t('page_font_likely')}</span>}
              </div>
              <span className="muted small">{tp('page_uses_count', font.count)}</span>
            </div>
            <div className="muted small">
              {font.sourceLabel}
              {font.link && (
                <>
                  {' · '}
                  <a href={font.link} target="_blank" rel="noreferrer">
                    {t('page_view_on_google_fonts')}
                  </a>
                </>
              )}
            </div>
            <div className="chips">
              {font.weights.map((w) => (
                <span key={`w${w}`} className="chip">
                  {w}
                </span>
              ))}
              {font.sizes.slice(0, 10).map((s) => (
                <span key={`s${s}`} className="chip chip-quiet">
                  {s}px
                </span>
              ))}
              {font.sizes.length > 10 && <span className="chip chip-quiet">{tp('page_more_sizes', font.sizes.length - 10)}</span>}
            </div>
          </article>
        ))}
        {result.fonts.length === 0 && <p className="muted small">{t('page_no_text_found')}</p>}
      </section>

      {result.truncated && <p className="muted small">{tp('page_truncated_notice', SCAN_ELEMENT_LIMIT)}</p>}
    </div>
  );
}

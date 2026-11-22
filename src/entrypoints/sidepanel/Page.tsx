import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { hexToRgb, nearestColorName } from '@/core/color';
import { exportColors } from '@/core/export';
import { isEnabled } from '@/core/features';
import type { BackgroundRequest, FailureReason, ScanResponse } from '@/core/messages';
import type { ScanColor, ScanResult } from '@/core/scan';
import { newId, type Settings } from '@/core/storage';
import { downloadCanvas, renderStyleGuide } from '@/core/style-guide';
import { copy, Empty, inDefaultFormat, Segmented, toast } from '@/ui/components';
import { useStored } from '@/ui/hooks';
import { Icon } from '@/ui/icons';

type Role = 'all' | 'text' | 'background' | 'border';
type Status =
  | { kind: 'loading' }
  | { kind: 'done'; result: ScanResult }
  | { kind: 'failed'; reason: FailureReason };

const ALL_SITES = { origins: ['<all_urls>'] };
const PALETTE_SIZE = 12;

const usage = (color: ScanColor, role: Role) =>
  role === 'all' ? color.text + color.background + color.border : color[role];

export function Page({ settings }: { settings: Settings }) {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [role, setRole] = useState<Role>('all');
  const [palettes, setPalettes] = useStored('palettes');

  const scan = useCallback(async () => {
    setStatus({ kind: 'loading' });
    try {
      const { id: windowId } = await browser.windows.getCurrent();
      if (windowId === undefined) throw new Error('no window');
      const request: BackgroundRequest = { t: 'scan', windowId };
      const response = (await browser.runtime.sendMessage(request)) as ScanResponse;
      setStatus(response.ok ? { kind: 'done', result: response.result } : { kind: 'failed', reason: response.reason });
    } catch {
      setStatus({ kind: 'failed', reason: 'unknown' });
    }
  }, []);

  // Rescan when the user switches tab or the page finishes loading. Without all-sites
  // access this only succeeds on tabs where PickKit has been invoked; the failure
  // state below explains that.
  useEffect(() => {
    void scan();
    const onActivated = () => void scan();
    const onUpdated = (_id: number, change: { status?: string }, tab: { active?: boolean }) => {
      if (change.status === 'complete' && tab.active) void scan();
    };
    browser.tabs.onActivated.addListener(onActivated);
    browser.tabs.onUpdated.addListener(onUpdated);
    return () => {
      browser.tabs.onActivated.removeListener(onActivated);
      browser.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [scan]);

  async function allowAllSites() {
    if (await browser.permissions.request(ALL_SITES)) void scan();
  }

  if (!isEnabled('page-scan')) return null;

  if (status.kind === 'loading') {
    return (
      <Empty icon="scan" title="Reading the page…">
        Collecting colours and fonts.
      </Empty>
    );
  }

  if (status.kind === 'failed') {
    if (status.reason === 'restricted') {
      return (
        <Empty icon="alert" title="This page cannot be scanned">
          Chrome blocks extensions on browser pages and the Web Store. Switch to any website.
        </Empty>
      );
    }
    return (
      <Empty
        icon="scan"
        title="PickKit has not been invoked on this tab"
        action={
          <div className="row wrap center" style={{ marginTop: 8 }}>
            <button type="button" className="btn" onClick={() => void scan()}>
              Scan again
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void allowAllSites()}>
              Allow on all sites
            </button>
          </div>
        }
      >
        For your privacy, PickKit only reads a page after you click its toolbar icon or use a shortcut there. Do that and
        scan again, or allow automatic scanning.
      </Empty>
    );
  }

  const { result } = status;
  const colors = result.colors.filter((c) => usage(c, role) > 0).sort((a, b) => usage(b, role) - usage(a, role));
  const topHexes = colors.slice(0, PALETTE_SIZE).map((c) => c.hex);

  function saveAsPalette() {
    setPalettes([...palettes, { id: newId(), name: result.host || 'Page palette', colors: topHexes, ts: Date.now() }]);
    toast('Saved as a palette');
  }

  async function downloadGuide() {
    await downloadCanvas(renderStyleGuide(result), `${result.host || 'page'}-style-guide.png`);
    toast('Style guide downloaded');
  }

  return (
    <div className="stack">
      <div className="row between">
        <div className="grow">
          <div className="strong truncate">{result.host || 'This page'}</div>
          <div className="muted small truncate">{result.title}</div>
        </div>
        <button type="button" className="btn btn-small" onClick={() => void scan()}>
          <Icon name="scan" /> Rescan
        </button>
      </div>

      {isEnabled('style-guide') && (
        <div className="row">
          <button type="button" className="btn btn-primary grow" onClick={() => void downloadGuide()}>
            <Icon name="download" /> Style guide (PNG)
          </button>
          <button type="button" className="btn grow" onClick={() => void copy(exportColors(result.host, topHexes, 'css'), 'Copied CSS variables')}>
            <Icon name="copy" /> Copy tokens
          </button>
        </div>
      )}

      <section className="stack">
        <div className="row between">
          <h3>Colours · {colors.length}</h3>
          <button type="button" className="btn btn-small btn-ghost" onClick={saveAsPalette} disabled={!topHexes.length}>
            Save as palette
          </button>
        </div>
        <Segmented<Role>
          label="Colour role"
          value={role}
          options={[
            { value: 'all', label: 'All' },
            { value: 'text', label: 'Text' },
            { value: 'background', label: 'Background' },
            { value: 'border', label: 'Border' },
          ]}
          onChange={setRole}
        />
        {colors.length === 0 && <p className="muted small">No colours used in this role.</p>}
        <ul className="list">
          {colors.map((color) => {
            const rgb = hexToRgb(color.hex);
            const value = inDefaultFormat(color.hex, settings);
            return (
              <li key={color.hex}>
                <button type="button" className="list-row" onClick={() => void copy(value)} aria-label={`Copy ${value}`}>
                  <span className="list-swatch" style={{ background: color.hex }} />
                  <span className="grow">
                    <span className="mono">{value}</span>
                    <span className="muted small block">{rgb ? nearestColorName(rgb) : ''}</span>
                  </span>
                  <span className="muted small">{usage(color, role)}×</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="stack">
        <h3>Typography · {result.fonts.length}</h3>
        {result.fonts.map((font) => (
          <article key={font.family} className="card stack">
            <div className="row between">
              <div className="row grow">
                <span className="font-name truncate">{font.family}</span>
                {!font.certain && <span className="badge">Likely</span>}
              </div>
              <span className="muted small">{font.count}×</span>
            </div>
            <div className="muted small">
              {font.sourceLabel}
              {font.link && (
                <>
                  {' · '}
                  <a href={font.link} target="_blank" rel="noreferrer">
                    View on Google Fonts
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
              {font.sizes.length > 10 && <span className="chip chip-quiet">+{font.sizes.length - 10}</span>}
            </div>
          </article>
        ))}
      </section>

      {result.truncated && <p className="muted small">This is a large page, so only the first 6,000 elements were read.</p>}
    </div>
  );
}

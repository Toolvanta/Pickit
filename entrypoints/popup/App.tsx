import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { hexToRgb, nearestColorName } from '@/core/color';
import { isRestrictedUrl, RATING_PROMPT_AFTER_PICKS, SHORTCUTS, storeReviewUrl } from '@/core/config';
import { weightName } from '@/core/fonts';
import type { BackgroundRequest, FailureReason, PickMode, StartResponse } from '@/core/messages';
import { ColorFormats, copy, Empty, IconButton, inDefaultFormat, Toaster } from '@/ui/components';
import { useStored, useTheme } from '@/ui/hooks';
import { Icon, type IconName } from '@/ui/icons';

const RECENT_COUNT = 16;

const FAILURES: Record<FailureReason, { title: string; text: string }> = {
  restricted: {
    title: 'PickKit cannot run on this page',
    text: 'Chrome blocks extensions on browser pages and the Web Store. Open any website and try again.',
  },
  'no-access': {
    title: 'PickKit could not reach this page',
    text: 'Reload the page and try again. For local files, allow file access in the extension details.',
  },
  unknown: { title: 'Something went wrong', text: 'Reload the page and try again.' },
};

function Action(props: { icon: IconName; title: string; shortcut: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" className="action" onClick={props.onClick} disabled={props.disabled}>
      <span className="action-icon">
        <Icon name={props.icon} size={18} />
      </span>
      <span className="action-title">{props.title}</span>
      <kbd>{props.shortcut}</kbd>
    </button>
  );
}

export function App() {
  useTheme();
  const [settings] = useStored('settings');
  const [colors, , colorsLoaded] = useStored('colors');
  const [fonts] = useStored('fonts');
  const [stats, setStats] = useStored('stats');
  const [tab, setTab] = useState<{ id?: number; url?: string; windowId?: number } | null>(null);
  const [failure, setFailure] = useState<FailureReason | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    void browser.tabs.query({ active: true, currentWindow: true }).then(([active]) => {
      setTab(active ?? {});
      if (isRestrictedUrl(active?.url)) setFailure('restricted');
    });
  }, []);

  async function start(mode: PickMode) {
    if (tab?.id === undefined) return;
    const request: BackgroundRequest = { t: 'start', mode, tabId: tab.id };
    const response = (await browser.runtime.sendMessage(request)) as StartResponse;
    if (response.ok) window.close();
    else setFailure(response.reason);
  }

  function openPanel() {
    if (tab?.windowId === undefined) return;
    // Must be called synchronously inside the click for Chrome to accept it.
    void browser.sidePanel.open({ windowId: tab.windowId }).then(() => window.close());
  }

  const blocked = failure === 'restricted' || tab === null;
  const current = colors.find((c) => c.hex === selected) ?? colors[0];
  const currentRgb = current ? hexToRgb(current.hex) : null;
  const lastFont = fonts[0];
  const askForRating = stats.picks >= RATING_PROMPT_AFTER_PICKS && !stats.ratingDismissed;

  return (
    <main className="popup">
      <header className="row between">
        <div className="row">
          <img src="/icon/32.png" width="22" height="22" alt="" />
          <h2>PickKit</h2>
        </div>
        <div className="row" style={{ gap: 2 }}>
          <IconButton icon="panel" label="Open workspace panel" onClick={openPanel} />
          <IconButton icon="settings" label="Settings" onClick={() => void browser.runtime.openOptionsPage()} />
        </div>
      </header>

      <div className="actions">
        <Action icon="pipette" title="Pick colour" shortcut={SHORTCUTS.color} disabled={blocked} onClick={() => void start('color')} />
        <Action icon="type" title="Inspect font" shortcut={SHORTCUTS.font} disabled={blocked} onClick={() => void start('font')} />
      </div>

      {failure && (
        <div className="banner banner-warn" role="alert">
          <Icon name="alert" />
          <div>
            <strong>{FAILURES[failure].title}</strong>
            {FAILURES[failure].text}
          </div>
        </div>
      )}

      {colorsLoaded && !current && (
        <Empty icon="pipette" title="No colours yet">
          Pick a colour from any page and it will appear here, ready to copy in any format.
        </Empty>
      )}

      {current && currentRgb && (
        <section className="stack">
          <div className="current">
            <div className="current-swatch" style={{ background: current.hex }} />
            <div className="grow">
              <div className="current-name truncate">{nearestColorName(currentRgb)}</div>
              <div className="muted small truncate">
                {current.token ? <span className="mono">{current.token}</span> : current.origin === 'screen' ? 'Picked from screen' : current.origin}
              </div>
            </div>
          </div>
          <ColorFormats hex={current.hex} settings={settings} />
        </section>
      )}

      {colors.length > 1 && (
        <section className="stack">
          <h3>Recent</h3>
          <div className="swatch-grid">
            {colors.slice(0, RECENT_COUNT).map((color) => (
              <button
                key={color.id}
                type="button"
                className="swatch"
                style={{ background: color.hex }}
                aria-label={`Show ${color.hex}`}
                aria-pressed={color.hex === current?.hex}
                title={`${inDefaultFormat(color.hex, settings)} · double-click to copy`}
                onClick={() => setSelected(color.hex)}
                onDoubleClick={() => void copy(inDefaultFormat(color.hex, settings))}
              />
            ))}
          </div>
        </section>
      )}

      {lastFont && (
        <section className="stack">
          <h3>Last font</h3>
          <div className="card row between">
            <div className="grow">
              <div className="current-name truncate">{lastFont.family}</div>
              <div className="muted small truncate">
                {lastFont.size}px · {weightName(lastFont.weight)} · {lastFont.sourceLabel}
              </div>
            </div>
            <span className="dot" style={{ background: lastFont.color }} title={lastFont.color} />
          </div>
        </section>
      )}

      {askForRating && (
        <div className="banner">
          <Icon name="star" />
          <div className="grow">
            <strong>Finding PickKit useful?</strong>A rating helps other people find it.
            <div className="row" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-small btn-primary"
                onClick={() => {
                  setStats({ ...stats, ratingDismissed: true });
                  void browser.tabs.create({ url: storeReviewUrl() });
                }}
              >
                Rate PickKit
              </button>
              <button type="button" className="btn btn-small btn-ghost" onClick={() => setStats({ ...stats, ratingDismissed: true })}>
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      <Toaster />
    </main>
  );
}

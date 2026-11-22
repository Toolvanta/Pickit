import { useEffect, useState, type CSSProperties } from 'react';
import { browser } from 'wxt/browser';
import { contrastRatio, hexToRgb, nearestColorName, readableOn } from '@/core/color';
import { isRestrictedUrl, RATING_PROMPT_AFTER_PICKS, SHORTCUTS, storeReviewUrl } from '@/core/config';
import { weightName } from '@/core/fonts';
import type { BackgroundRequest, FailureReason, PickMode, StartResponse } from '@/core/messages';
import { ColorFormats, copy, Empty, IconButton, inDefaultFormat, Toaster } from '@/ui/components';
import { CommandMenu, type Command } from '@/ui/command-menu';
import { useLiveAccent, useStored, useTheme } from '@/ui/hooks';
import { Icon } from '@/ui/icons';

const RECENT_COUNT = 16;
const WHITE = { r: 255, g: 255, b: 255, a: 1 };
const BLACK = { r: 0, g: 0, b: 0, a: 1 };

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

export function App() {
  useTheme();
  const [settings, setSettings] = useStored('settings');
  const [colors, , colorsLoaded] = useStored('colors');
  const [fonts] = useStored('fonts');
  const [stats, setStats] = useStored('stats');
  const [tab, setTab] = useState<{ id?: number; url?: string; windowId?: number } | null>(null);
  const [failure, setFailure] = useState<FailureReason | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void browser.tabs.query({ active: true, currentWindow: true }).then(([active]) => {
      setTab(active ?? {});
      if (isRestrictedUrl(active?.url)) setFailure('restricted');
    });
  }, []);

  async function start(mode: PickMode) {
    if (tab?.id === undefined || busy) return;
    setBusy(true);
    try {
      const request: BackgroundRequest = { t: 'start', mode, tabId: tab.id };
      const response = (await browser.runtime.sendMessage(request)) as StartResponse;
      if (response.ok) window.close();
      else setFailure(response.reason);
    } finally {
      setBusy(false);
    }
  }

  function openPanel() {
    if (tab?.windowId === undefined) return;
    void browser.sidePanel.open({ windowId: tab.windowId }).then(() => window.close());
  }

  const blocked = failure === 'restricted' || tab === null;
  const current = colors.find((c) => c.hex === selected) ?? colors[0];
  const currentRgb = current ? hexToRgb(current.hex) : null;
  const lastFont = fonts[0];
  const askForRating = stats.picks >= RATING_PROMPT_AFTER_PICKS && !stats.ratingDismissed;

  useLiveAccent(current?.hex, settings.theme);

  const bestRatio = currentRgb
    ? Math.max(contrastRatio(currentRgb, WHITE), contrastRatio(currentRgb, BLACK))
    : 0;
  const heroInk = currentRgb ? readableOn(currentRgb) : '#fff';

  const commands: Command[] = [
    {
      id: 'pick-colour',
      label: 'Pick a colour',
      hint: SHORTCUTS.color,
      icon: 'pipette',
      run: () => void start('color'),
    },
    {
      id: 'inspect-font',
      label: 'Inspect a font',
      hint: SHORTCUTS.font,
      icon: 'type',
      run: () => void start('font'),
    },
    { id: 'workspace', label: 'Open workspace panel', icon: 'panel', run: openPanel },
    ...(current
      ? [
          {
            id: 'copy-colour',
            label: 'Copy selected colour',
            icon: 'copy' as const,
            run: () => void copy(inDefaultFormat(current.hex, settings), 'Copied colour'),
          },
        ]
      : []),
    {
      id: 'theme',
      label: settings.theme === 'dark' ? 'Use light theme' : 'Use dark theme',
      icon: settings.theme === 'dark' ? 'sun' : 'moon',
      run: () => setSettings({ ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' }),
    },
    {
      id: 'settings',
      label: 'Open settings',
      icon: 'settings',
      run: () => void browser.runtime.openOptionsPage(),
    },
  ];

  return (
    <main className="popup">
      <header className="popup-head">
        <div className="brand">
          <span className="brand-mark">
            <img src="/icon/32.png" width="22" height="22" alt="" />
          </span>
          <span className="brand-copy">
            <span className="brand-name">PickKit</span>
            <span className="brand-sub">Colour &amp; type inspector</span>
          </span>
        </div>
        <div className="row" style={{ gap: 4 }}>
          <CommandMenu commands={commands} compact />
          <IconButton icon="panel" label="Open workspace panel" onClick={openPanel} />
          <IconButton icon="settings" label="Settings" onClick={() => void browser.runtime.openOptionsPage()} />
        </div>
      </header>

      <section className="inspector-intro" aria-labelledby="inspector-title">
        <p className="eyebrow">Two tools</p>
        <h1 id="inspector-title">Pick a colour. Read a font.</h1>
        <p className="muted small">
          Choose a tool, then click the page. PickKit only looks when you invoke it.
        </p>
        <div className="inspector-action">
          <button
            type="button"
            className="btn btn-primary"
            title={`Shortcut ${SHORTCUTS.color}`}
            onClick={() => void start('color')}
            disabled={blocked || busy}
          >
            <Icon name="pipette" size={15} />
            Pick a colour
          </button>
          <button
            type="button"
            className="btn"
            title={`Shortcut ${SHORTCUTS.font}`}
            onClick={() => void start('font')}
            disabled={blocked || busy}
          >
            <Icon name="type" size={15} />
            Inspect a font
          </button>
        </div>
      </section>

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
        <Empty icon="sparkles" title="No colours yet">
          Pick a colour on any page to start a local history.
        </Empty>
      )}

      {current && currentRgb && (
        <section className="stack">
          <div className="section-head">
            <h2 className="section-label">Latest colour</h2>
            <span className="eyebrow">Best contrast {bestRatio.toFixed(1)}:1</span>
          </div>
          <div className="latest-colour">
            <div className="latest-swatch" style={{ background: current.hex, color: heroInk }}>
              <span className="mono">{inDefaultFormat(current.hex, settings)}</span>
            </div>
            <div className="grow">
              <div className="hero-name truncate">{nearestColorName(currentRgb)}</div>
              <div className="muted small truncate">
                {current.token ? <span className="mono">{current.token}</span> : current.origin === 'screen' ? 'Picked from screen' : current.origin}
              </div>
              <ColorFormats hex={current.hex} settings={settings} />
            </div>
          </div>
        </section>
      )}

      {colors.length > 1 && (
        <section className="stack">
          <div className="row between">
            <h2 className="section-label">Recent · {Math.min(colors.length, RECENT_COUNT)}</h2>
            <span className="eyebrow">Double-click to copy</span>
          </div>
          <div className="swatch-grid">
            {colors.slice(0, RECENT_COUNT).map((color, index) => (
              <button
                key={color.id}
                type="button"
                className="swatch"
                style={{ background: color.hex, '--pk-i': index } as CSSProperties}
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
          <h2 className="section-label">Latest font</h2>
          <div className="font-card">
            <span className="font-specimen" style={{ fontFamily: lastFont.stack, fontWeight: lastFont.weight, fontStyle: lastFont.style }} aria-hidden="true">
              Ag
            </span>
            <div className="grow">
              <div className="hero-name small truncate">{lastFont.family}</div>
              <div className="muted small truncate">
                {lastFont.size}px · {weightName(lastFont.weight)} · {lastFont.sourceLabel}
              </div>
            </div>
            <span className="dot" style={{ background: lastFont.color }} title={lastFont.color} />
          </div>
        </section>
      )}

      <button type="button" className="panel-link" onClick={openPanel}>
        <Icon name="layers" size={15} />
        Open full workspace
        <Icon name="chevron" size={14} />
      </button>

      {askForRating && (
        <div className="banner rating">
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

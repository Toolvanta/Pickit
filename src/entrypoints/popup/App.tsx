import { useEffect, useState, type CSSProperties } from 'react';
import { browser } from 'wxt/browser';
import { hexToRgb, nearestColorName, readableOn } from '@/core/color';
import { isRestrictedUrl, RATING_PROMPT_AFTER_PICKS, storeReviewUrl } from '@/core/config';
import { weightName } from '@/core/fonts';
import { t } from '@/core/i18n';
import type { BackgroundRequest, FailureReason, PickMode, StartResponse } from '@/core/messages';
import { copy, IconButton, inDefaultFormat, Toaster } from '@/ui/components';
import { CommandMenu, type Command } from '@/ui/command-menu';
import { shortcutTitle, useLiveAccent, useShortcuts, useStored, useTheme } from '@/ui/hooks';
import { Icon, type IconName } from '@/ui/icons';
import { CreatorIcons, SponsorLine } from '@/ui/sponsor';

const RECENT_COUNT = 9;

function failureMessage(reason: FailureReason): { title: string; text: string } {
  switch (reason) {
    case 'restricted':
      return { title: t('popup_failure_restricted_title'), text: t('popup_failure_restricted_text') };
    case 'no-access':
      return { title: t('popup_failure_no_access_title'), text: t('popup_failure_no_access_text') };
    default:
      return { title: t('popup_failure_unknown_title'), text: t('popup_failure_unknown_text') };
  }
}

function Keys({ value }: { value: string }) {
  if (!value) return null;
  return (
    <span className="keys" aria-hidden="true">
      {value.split('+').map((key, i) => (
        <kbd key={`${key}-${i}`}>{key}</kbd>
      ))}
    </span>
  );
}

function Tool(props: { icon: IconName; title: string; sub: string; shortcut: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" className="tool" title={shortcutTitle(props.shortcut)} disabled={props.disabled} onClick={props.onClick}>
      <span className="tool-icon">
        <Icon name={props.icon} size={18} />
      </span>
      <span className="tool-title">{props.title}</span>
      <span className="tool-sub">{props.sub}</span>
      <Keys value={props.shortcut} />
    </button>
  );
}

export function App() {
  useTheme();
  const shortcuts = useShortcuts();
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
      const response = (await browser.runtime.sendMessage(request)) as StartResponse | undefined;
      if (response?.ok) window.close();
      else setFailure(response?.reason ?? 'unknown');
    } catch {
      setFailure('unknown');
    } finally {
      setBusy(false);
    }
  }

  function openPanel() {
    if (tab?.windowId === undefined) return;
    browser.sidePanel
      .open({ windowId: tab.windowId })
      .then(() => window.close())
      .catch(() => setFailure('unknown'));
  }

  const blocked = failure === 'restricted' || tab === null;
  const current = colors.find((c) => c.id === selected) ?? colors[0];
  const currentRgb = current ? hexToRgb(current.hex) : null;
  const lastFont = fonts[0];
  const askForRating = stats.picks >= RATING_PROMPT_AFTER_PICKS && !stats.ratingDismissed;

  useLiveAccent(current?.hex, settings.theme);

  const commands: Command[] = [
    { id: 'pick-colour', label: t('popup_command_pick_colour'), hint: shortcuts.color || undefined, icon: 'pipette', run: () => void start('color') },
    { id: 'inspect-font', label: t('popup_command_inspect_font'), hint: shortcuts.font || undefined, icon: 'type', run: () => void start('font') },
    { id: 'workspace', label: t('popup_command_open_workspace'), icon: 'panel', run: openPanel },
    ...(current
      ? [
          {
            id: 'copy-colour',
            label: t('popup_command_copy_latest'),
            icon: 'copy' as const,
            run: () => void copy(inDefaultFormat(current.hex, settings), t('popup_toast_copied_colour')),
          },
        ]
      : []),
    {
      id: 'theme',
      label: settings.theme === 'dark' ? t('popup_command_light_theme') : t('popup_command_dark_theme'),
      icon: settings.theme === 'dark' ? 'sun' : 'moon',
      run: () => setSettings((s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' })),
    },
    { id: 'settings', label: t('popup_command_open_settings'), icon: 'settings', run: () => void browser.runtime.openOptionsPage() },
  ];

  return (
    <main className="popup">
      <header className="popup-head">
        <div className="brand">
          <img className="brand-mark" src="/icon/32.png" width="24" height="24" alt="" />
          <span className="brand-name">Pickit</span>
        </div>
        <div className="row" style={{ gap: 2 }}>
          <CommandMenu commands={commands} compact />
          <IconButton icon="panel" label={t('popup_open_workspace_label')} onClick={openPanel} />
          <IconButton icon="settings" label={t('popup_settings_label')} onClick={() => void browser.runtime.openOptionsPage()} />
        </div>
      </header>

      <section className="tools" aria-label={t('popup_tools_label')}>
        <Tool
          icon="pipette"
          title={t('popup_tool_pick_title')}
          sub={t('popup_tool_pick_sub')}
          shortcut={shortcuts.color}
          disabled={blocked || busy}
          onClick={() => void start('color')}
        />
        <Tool
          icon="type"
          title={t('popup_tool_font_title')}
          sub={t('popup_tool_font_sub')}
          shortcut={shortcuts.font}
          disabled={blocked || busy}
          onClick={() => void start('font')}
        />
      </section>

      {failure && (
        <div className="banner banner-warn" role="alert">
          <Icon name="alert" />
          <div>
            <strong>{failureMessage(failure).title}</strong>
            {failureMessage(failure).text}
          </div>
        </div>
      )}

      {colorsLoaded && !current && (
        <div className="popup-empty">
          <Icon name="sparkles" size={16} />
          <span>{t('popup_empty_colours')}</span>
        </div>
      )}

      {current && currentRgb && (
        <section className="latest" aria-label={t('popup_latest_colour_label')}>
          <button
            type="button"
            className="latest-card"
            style={{ '--latest': current.hex, color: readableOn(currentRgb) } as CSSProperties}
            title={t('popup_latest_copy_title')}
            onClick={() => void copy(inDefaultFormat(current.hex, settings), t('popup_toast_copied_colour'))}
          >
            <span className="latest-name">{nearestColorName(currentRgb)}</span>
            <span className="latest-value mono">
              {inDefaultFormat(current.hex, settings)}
              <Icon name="copy" size={13} />
            </span>
            <span className="latest-origin truncate">
              {current.token ?? (current.origin === 'screen' ? t('popup_origin_screen') : current.origin)}
            </span>
          </button>

          {colors.length > 1 && (
            <div className="recent" role="group" aria-label={t('popup_recent_colours_label')}>
              {colors.slice(0, RECENT_COUNT).map((color, index) => (
                <button
                  key={color.id}
                  type="button"
                  className="recent-swatch"
                  style={{ background: color.hex, '--pk-i': index } as CSSProperties}
                  aria-label={t('popup_recent_copy_label', inDefaultFormat(color.hex, settings))}
                  aria-pressed={color.id === current.id}
                  title={t('popup_recent_copy_title', inDefaultFormat(color.hex, settings))}
                  onClick={() => {
                    setSelected(color.id);
                    void copy(inDefaultFormat(color.hex, settings));
                  }}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {lastFont && (
        <section className="font-row" aria-label={t('popup_latest_font_label')}>
          <span
            className="font-specimen"
            style={{ fontFamily: lastFont.stack, fontWeight: lastFont.weight, fontStyle: lastFont.style }}
            aria-hidden="true"
          >
            Aa
          </span>
          <div className="grow">
            <div className="font-family truncate">{lastFont.family}</div>
            <div className="faint small truncate">
              {t('popup_font_details', lastFont.size, weightName(lastFont.weight), lastFont.sourceLabel)}
            </div>
          </div>
          <span className="dot" style={{ background: lastFont.color }} title={lastFont.color} />
        </section>
      )}

      <button type="button" className="panel-link" onClick={openPanel}>
        <Icon name="layers" size={15} />
        <span className="grow">{t('popup_workspace_link')}</span>
        <span className="faint small">{t('popup_workspace_link_sub')}</span>
        <Icon name="chevron" size={14} />
      </button>

      {askForRating && (
        <div className="banner rating">
          <Icon name="star" />
          <div className="grow">
            <strong>{t('popup_rating_title')}</strong>
            {t('popup_rating_text')}
            <div className="row" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-small btn-primary"
                onClick={() => {
                  setStats((s) => ({ ...s, ratingDismissed: true }));
                  void browser.tabs.create({ url: storeReviewUrl() });
                }}
              >
                {t('popup_rating_rate')}
              </button>
              <button type="button" className="btn btn-small btn-ghost" onClick={() => setStats((s) => ({ ...s, ratingDismissed: true }))}>
                {t('popup_rating_dismiss')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="footer-row">
        <SponsorLine />
        <CreatorIcons />
      </div>

      <Toaster />
    </main>
  );
}

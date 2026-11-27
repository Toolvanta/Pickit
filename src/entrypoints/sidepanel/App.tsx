import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { browser } from 'wxt/browser';
import { t } from '@/core/i18n';
import { hexToRgb, nearestColorName } from '@/core/color';
import type { BackgroundRequest, PickMode, StartResponse } from '@/core/messages';
import { copy, IconButton, inDefaultFormat, toast, Toaster } from '@/ui/components';
import { CommandMenu, type Command } from '@/ui/command-menu';
import { useLiveAccent, useShortcuts, useStored, useTheme } from '@/ui/hooks';
import { Icon, type IconName } from '@/ui/icons';
import { AccessBanner } from './Access';
import { Colors } from './Colors';
import { Contrast } from './Contrast';
import { Fonts } from './Fonts';
import { Page } from './Page';
import { Palettes } from './Palettes';
import { CreatorIcons, SponsorLine } from '@/ui/sponsor';

type Tab = 'colors' | 'fonts' | 'page' | 'contrast' | 'palettes';

// Labels are getters so the text is looked up in the browser's language when rendered.
const TABS: { id: Tab; readonly label: string; icon: IconName }[] = [
  {
    id: 'colors',
    get label() {
      return t('panel_tab_colors');
    },
    icon: 'pipette',
  },
  {
    id: 'fonts',
    get label() {
      return t('panel_tab_fonts');
    },
    icon: 'type',
  },
  {
    id: 'page',
    get label() {
      return t('panel_tab_page');
    },
    icon: 'page',
  },
  {
    id: 'contrast',
    get label() {
      return t('panel_tab_contrast');
    },
    icon: 'contrast',
  },
  {
    id: 'palettes',
    get label() {
      return t('panel_tab_palettes');
    },
    icon: 'palette',
  },
];

export interface ContrastPair {
  fg: string;
  bg: string;
}

export function App() {
  useTheme();
  const shortcuts = useShortcuts();
  const [settings, setSettings] = useStored('settings');
  const [colors] = useStored('colors');
  const [tab, setTab] = useState<Tab>('colors');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pair, setPair] = useState<ContrastPair>({ fg: '#17171F', bg: '#FFFFFF' });
  /** A picker that failed because the side panel had no access to the tab. */
  const [blockedMode, setBlockedMode] = useState<PickMode | null>(null);

  const current = colors.find((color) => color.id === selectedId) ?? colors[0];
  const currentRgb = current ? hexToRgb(current.hex) : null;
  // The whole panel borrows the colour being inspected.
  useLiveAccent(current?.hex, settings.theme);

  // A picker started from here leaves keyboard focus in the panel, so the page never
  // sees Esc. Forward it, so Esc cancels the picker as the on-page hint says.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      void browser.windows
        .getCurrent()
        .then(({ id }) => id !== undefined && browser.runtime.sendMessage({ t: 'stop', windowId: id } satisfies BackgroundRequest))
        .catch(() => {});
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Each tab starts at the top rather than inheriting the previous tab's scroll position.
  const body = useRef<HTMLElement>(null);
  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
  }, [tab]);

  const tabStyle = { '--pk-tab-index': Math.max(0, TABS.findIndex((item) => item.id === tab)) } as CSSProperties;

  async function startPicker(mode: PickMode) {
    const [active] = await browser.tabs.query({ active: true, currentWindow: true });
    if (active?.id === undefined) return;
    const request: BackgroundRequest = { t: 'start', mode, tabId: active.id };
    const response = (await browser.runtime.sendMessage(request)) as StartResponse;
    if (response?.ok) {
      setBlockedMode(null);
      return;
    }
    if (response?.reason === 'restricted') toast(t('panel_toast_restricted_page'));
    else setBlockedMode(mode);
  }

  const commands: Command[] = [
    {
      id: 'pick-colour',
      label: t('panel_cmd_pick_colour'),
      hint: shortcuts.color || undefined,
      icon: 'pipette',
      run: () => void startPicker('color'),
    },
    {
      id: 'inspect-font',
      label: t('panel_cmd_inspect_font'),
      hint: shortcuts.font || undefined,
      icon: 'type',
      run: () => void startPicker('font'),
    },
    { id: 'colors', label: t('panel_cmd_go_colors'), icon: 'pipette', run: () => setTab('colors') },
    { id: 'fonts', label: t('panel_cmd_go_fonts'), icon: 'type', run: () => setTab('fonts') },
    { id: 'page', label: t('panel_cmd_go_page'), icon: 'page', run: () => setTab('page') },
    { id: 'contrast', label: t('panel_cmd_go_contrast'), icon: 'contrast', run: () => setTab('contrast') },
    { id: 'palettes', label: t('panel_cmd_go_palettes'), icon: 'palette', run: () => setTab('palettes') },
    ...(current
      ? [
          {
            id: 'copy-colour',
            label: t('panel_cmd_copy_selected_colour'),
            icon: 'copy' as const,
            run: () => void copy(inDefaultFormat(current.hex, settings), t('panel_toast_copied_colour')),
          },
        ]
      : []),
    {
      id: 'theme',
      label: settings.theme === 'dark' ? t('panel_cmd_use_light_theme') : t('panel_cmd_use_dark_theme'),
      icon: settings.theme === 'dark' ? 'sun' : 'moon',
      run: () => setSettings((s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' })),
    },
    {
      id: 'settings',
      label: t('panel_cmd_open_settings'),
      icon: 'settings',
      run: () => void browser.runtime.openOptionsPage(),
    },
  ];

  return (
    <div className="panel">
      <header className="panel-head">
        <div className="row between brand-row">
          <div className="row">
            <span className="brand-mark">
              <img src="/icon/32.png" width="20" height="20" alt="" />
            </span>
            <h2 className="brand-name">Pickit</h2>
          </div>
          <div className="row">
            <CommandMenu commands={commands} />
            <IconButton icon="settings" label={t('panel_settings')} onClick={() => void browser.runtime.openOptionsPage()} />
          </div>
        </div>

        {/* The Colours tab shows the selected colour in full; elsewhere a slim bar keeps it in reach. */}
        {current && tab !== 'colors' && (
          <div key={current.id} className="context">
            <button
              type="button"
              className="context-main"
              title={t('panel_context_show_in_colors')}
              onClick={() => setTab('colors')}
            >
              <span className="context-swatch" style={{ backgroundColor: current.hex }} aria-hidden="true" />
              <span className="context-name truncate">{currentRgb ? nearestColorName(currentRgb) : current.hex}</span>
              <span className="context-token mono truncate">{current.token ?? inDefaultFormat(current.hex, settings)}</span>
            </button>
            <IconButton
              icon="copy"
              label={t('panel_context_copy_colour')}
              onClick={() => void copy(inDefaultFormat(current.hex, settings), t('panel_toast_copied_colour'))}
            />
            {tab !== 'contrast' && (
              <IconButton
                icon="contrast"
                label={t('panel_context_check_contrast')}
                onClick={() => {
                  setPair((value) => ({ ...value, fg: current.hex }));
                  setTab('contrast');
                }}
              />
            )}
          </div>
        )}

        <nav className="tabs" aria-label={t('panel_tabs_aria')} style={tabStyle}>
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="tab"
              aria-current={tab === item.id ? 'page' : undefined}
              onClick={() => setTab(item.id)}
            >
              <span className="tab-inner">
                <Icon name={item.icon} size={16} />
                <span>{item.label}</span>
              </span>
            </button>
          ))}
          <span className="tab-indicator" aria-hidden="true" />
        </nav>
      </header>

      <main className="panel-body" ref={body}>
        {blockedMode && (
          <AccessBanner
            onDismiss={() => setBlockedMode(null)}
            onGranted={() => {
              const mode = blockedMode;
              setBlockedMode(null);
              void startPicker(mode);
            }}
          />
        )}
        {tab === 'colors' && (
          <Colors
            settings={settings}
            onPickFromPage={() => void startPicker('color')}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onContrast={(role, hex) => {
              setPair((currentPair) => ({ ...currentPair, [role]: hex }));
              setTab('contrast');
            }}
          />
        )}
        {tab === 'fonts' && <Fonts />}
        {tab === 'page' && <Page settings={settings} />}
        {tab === 'contrast' && <Contrast pair={pair} onChange={setPair} />}
        {tab === 'palettes' && <Palettes settings={settings} />}
      </main>
      <footer className="panel-foot footer-row">
        <SponsorLine />
        <CreatorIcons />
      </footer>
      <Toaster />
    </div>
  );
}

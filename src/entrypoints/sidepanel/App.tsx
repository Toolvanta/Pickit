import { useState, type CSSProperties } from 'react';
import { browser } from 'wxt/browser';
import { hexToRgb, nearestColorName } from '@/core/color';
import { SHORTCUTS } from '@/core/config';
import { copy, IconButton, inDefaultFormat, Toaster } from '@/ui/components';
import { CommandMenu, type Command } from '@/ui/command-menu';
import { useLiveAccent, useStored, useTheme } from '@/ui/hooks';
import { Icon, type IconName } from '@/ui/icons';
import { Colors } from './Colors';
import { Contrast } from './Contrast';
import { Fonts } from './Fonts';
import { Page } from './Page';
import { Palettes } from './Palettes';

type Tab = 'colors' | 'fonts' | 'page' | 'contrast' | 'palettes';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'colors', label: 'Colours', icon: 'pipette' },
  { id: 'fonts', label: 'Fonts', icon: 'type' },
  { id: 'page', label: 'Page', icon: 'page' },
  { id: 'contrast', label: 'Contrast', icon: 'contrast' },
  { id: 'palettes', label: 'Palettes', icon: 'palette' },
];

export interface ContrastPair {
  fg: string;
  bg: string;
}

export function App() {
  useTheme();
  const [settings, setSettings] = useStored('settings');
  const [colors] = useStored('colors');
  const [tab, setTab] = useState<Tab>('colors');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pair, setPair] = useState<ContrastPair>({ fg: '#17171F', bg: '#FFFFFF' });

  const current = colors.find((color) => color.id === selectedId) ?? colors[0];
  const currentRgb = current ? hexToRgb(current.hex) : null;
  // The whole panel borrows the colour being inspected.
  useLiveAccent(current?.hex, settings.theme);

  const tabStyle = { '--pk-tab-index': Math.max(0, TABS.findIndex((item) => item.id === tab)) } as CSSProperties;

  async function startPicker(mode: 'color' | 'font') {
    const [active] = await browser.tabs.query({ active: true, currentWindow: true });
    if (active?.id === undefined) return;
    await browser.runtime.sendMessage({ t: 'start', mode, tabId: active.id });
  }

  const commands: Command[] = [
    {
      id: 'pick-colour',
      label: 'Pick a colour',
      hint: SHORTCUTS.color,
      icon: 'pipette',
      run: () => void startPicker('color'),
    },
    {
      id: 'inspect-font',
      label: 'Inspect a font',
      hint: SHORTCUTS.font,
      icon: 'type',
      run: () => void startPicker('font'),
    },
    { id: 'colors', label: 'Go to Colours', icon: 'pipette', run: () => setTab('colors') },
    { id: 'fonts', label: 'Go to Fonts', icon: 'type', run: () => setTab('fonts') },
    { id: 'page', label: 'Go to Page', icon: 'page', run: () => setTab('page') },
    { id: 'contrast', label: 'Go to Contrast', icon: 'contrast', run: () => setTab('contrast') },
    { id: 'palettes', label: 'Go to Palettes', icon: 'palette', run: () => setTab('palettes') },
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
    <div className="panel">
      <header className="panel-head">
        <div className="row between brand-row">
          <div className="row">
            <span className="brand-mark">
              <img src="/icon/32.png" width="20" height="20" alt="" />
            </span>
            <h2 className="brand-name">PickKit</h2>
          </div>
          <div className="row">
            <CommandMenu commands={commands} />
            <IconButton icon="settings" label="Settings" onClick={() => void browser.runtime.openOptionsPage()} />
          </div>
        </div>

        {current ? (
          <div key={current.id} className="context pop-in">
            <div className="context-swatch" style={{ backgroundColor: current.hex }} aria-hidden="true" />
            <div className="context-info grow">
              <div className="eyebrow">Now inspecting</div>
              <div className="context-name truncate">{currentRgb ? nearestColorName(currentRgb) : current.hex}</div>
              <div className="context-token mono truncate">{current.token ?? current.hex}</div>
            </div>
            <div className="context-actions">
              <button
                type="button"
                className="context-action"
                title="Check this colour in Contrast"
                aria-label="Check this colour in Contrast"
                onClick={() => {
                  setPair((value) => ({ ...value, fg: current.hex }));
                  setTab('contrast');
                }}
              >
                <Icon name="contrast" size={16} />
                <span>Contrast</span>
              </button>
              <button
                type="button"
                className="context-action"
                title="Build a palette with this colour"
                aria-label="Open Palettes"
                onClick={() => setTab('palettes')}
              >
                <Icon name="palette" size={16} />
                <span>Palettes</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="context context-empty">
            <span className="context-empty-icon">
              <Icon name="sparkles" size={16} />
            </span>
            <div className="grow">
              <div className="eyebrow">No colour selected</div>
              <div className="context-empty-text">Pick a colour to tint your workspace.</div>
            </div>
            <button type="button" className="btn btn-small btn-ghost" onClick={() => setTab('colors')}>
              Start <Icon name="chevron" size={13} />
            </button>
          </div>
        )}

        <nav className="tabs" aria-label="Workspace sections" style={tabStyle}>
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="tab"
              aria-current={tab === item.id ? 'page' : undefined}
              onClick={() => setTab(item.id)}
            >
              <span className="tab-inner">
                <Icon name={item.icon} size={17} />
                <span>{item.label}</span>
              </span>
            </button>
          ))}
          <span className="tab-indicator" aria-hidden="true" />
        </nav>
      </header>

      <main className="panel-body">
        {tab === 'colors' && (
          <Colors
            settings={settings}
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
      <Toaster />
    </div>
  );
}

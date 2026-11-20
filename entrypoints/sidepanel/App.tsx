import { useState } from 'react';
import { browser } from 'wxt/browser';
import { IconButton, Toaster } from '@/ui/components';
import { useStored, useTheme } from '@/ui/hooks';
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
  const [settings] = useStored('settings');
  const [tab, setTab] = useState<Tab>('colors');
  const [pair, setPair] = useState<ContrastPair>({ fg: '#17171F', bg: '#FFFFFF' });

  return (
    <div className="panel">
      <header className="panel-head">
        <div className="row between">
          <div className="row">
            <img src="/icon/32.png" width="20" height="20" alt="" />
            <h2>PickKit</h2>
          </div>
          <IconButton icon="settings" label="Settings" onClick={() => void browser.runtime.openOptionsPage()} />
        </div>
        <nav className="tabs" aria-label="Workspace sections">
          {TABS.map((item) => (
            <button key={item.id} type="button" className="tab" aria-current={tab === item.id ? 'page' : undefined} onClick={() => setTab(item.id)}>
              <Icon name={item.icon} />
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="panel-body">
        {tab === 'colors' && (
          <Colors
            settings={settings}
            onContrast={(role, hex) => {
              setPair((current) => ({ ...current, [role]: hex }));
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

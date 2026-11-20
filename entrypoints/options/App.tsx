import { useEffect, useState, type ReactNode } from 'react';
import { browser } from 'wxt/browser';
import { COLOR_FORMATS, type ColorFormat } from '@/core/color';
import { SHORTCUTS } from '@/core/config';
import { clearAllData, HISTORY_LIMITS, type ThemeSetting } from '@/core/storage';
import { Segmented, toast, Toaster } from '@/ui/components';
import { useStored, useTheme } from '@/ui/hooks';

const ALL_SITES = { origins: ['<all_urls>'] };

function Setting(props: { title: string; help: string; children: ReactNode }) {
  return (
    <div className="setting">
      <div className="grow">
        <div className="setting-title">{props.title}</div>
        <div className="muted small">{props.help}</div>
      </div>
      {props.children}
    </div>
  );
}

export function App() {
  useTheme();
  const [settings, setSettings] = useStored('settings');
  const [allSites, setAllSites] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [shortcuts, setShortcuts] = useState<Record<string, string>>({});

  useEffect(() => {
    void browser.permissions.contains(ALL_SITES).then(setAllSites);
    void browser.commands.getAll().then((commands) => {
      setShortcuts(Object.fromEntries(commands.map((c) => [c.name ?? '', c.shortcut ?? ''])));
    });
  }, []);

  async function toggleAllSites() {
    if (allSites) {
      await browser.permissions.remove(ALL_SITES);
      setAllSites(false);
    } else {
      setAllSites(await browser.permissions.request(ALL_SITES));
    }
  }

  return (
    <main className="options">
      <header className="row">
        <img src="/icon/48.png" width="32" height="32" alt="" />
        <div>
          <h1>PickKit settings</h1>
          <div className="muted small">Version {browser.runtime.getManifest().version}</div>
        </div>
      </header>

      <section>
        <h3>Colours</h3>
        <div className="group">
          <Setting title="Default format" help="Used when you pick a colour and for one-click copy.">
            <Segmented<ColorFormat>
              label="Default colour format"
              value={settings.format}
              options={COLOR_FORMATS.map((f) => ({ value: f, label: f.toUpperCase() }))}
              onChange={(format) => setSettings({ ...settings, format })}
            />
          </Setting>
          <Setting title="HEX letter case" help="How HEX values are written when copied.">
            <Segmented
              label="HEX letter case"
              value={settings.upperHex ? 'upper' : 'lower'}
              options={[
                { value: 'upper', label: '#AABBCC' },
                { value: 'lower', label: '#aabbcc' },
              ]}
              onChange={(value) => setSettings({ ...settings, upperHex: value === 'upper' })}
            />
          </Setting>
          <Setting title="History size" help="Older colours are removed once the limit is reached.">
            <select
              className="select"
              style={{ width: 110 }}
              aria-label="History size"
              value={settings.historyLimit}
              onChange={(e) => setSettings({ ...settings, historyLimit: Number(e.target.value) })}
            >
              {HISTORY_LIMITS.map((limit) => (
                <option key={limit} value={limit}>
                  {limit} colours
                </option>
              ))}
            </select>
          </Setting>
        </div>
      </section>

      <section>
        <h3>Appearance</h3>
        <div className="group">
          <Setting title="Theme" help="Applies to PickKit's own windows and the on-page overlay.">
            <Segmented<ThemeSetting>
              label="Theme"
              value={settings.theme}
              options={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
              onChange={(theme) => setSettings({ ...settings, theme })}
            />
          </Setting>
        </div>
      </section>

      <section>
        <h3>Keyboard shortcuts</h3>
        <div className="group">
          <Setting title="Pick colour" help="Starts the colour loupe on the current page.">
            <kbd>{shortcuts['pick-color'] || 'Not set'}</kbd>
          </Setting>
          <Setting title="Inspect font" help="Starts the font inspector on the current page.">
            <kbd>{shortcuts['inspect-font'] || 'Not set'}</kbd>
          </Setting>
          <Setting
            title="Change shortcuts"
            help={`Defaults are ${SHORTCUTS.color} and ${SHORTCUTS.font}. Chrome manages shortcuts for all extensions in one place.`}
          >
            <button type="button" className="btn" onClick={() => void browser.tabs.create({ url: 'chrome://extensions/shortcuts' })}>
              Open Chrome shortcuts
            </button>
          </Setting>
        </div>
      </section>

      <section>
        <h3>Privacy</h3>
        <div className="group">
          <Setting
            title="Scan pages automatically"
            help="Lets the workspace panel read the colours and fonts of each page as you browse. Off by default: without it, PickKit only reads a page when you invoke it there."
          >
            <button type="button" className={allSites ? 'btn' : 'btn btn-primary'} onClick={() => void toggleAllSites()}>
              {allSites ? 'Turn off' : 'Allow on all sites'}
            </button>
          </Setting>
          <Setting title="Clear data" help="Removes colour history, fonts and palettes from this device. Settings are kept.">
            {confirmClear ? (
              <div className="row">
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={async () => {
                    await clearAllData();
                    setConfirmClear(false);
                    toast('All data cleared');
                  }}
                >
                  Yes, clear everything
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmClear(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-danger" onClick={() => setConfirmClear(true)}>
                Clear data
              </button>
            )}
          </Setting>
        </div>
        <p className="muted small" style={{ marginTop: 10 }}>
          Everything PickKit saves stays in this browser. It has no account and sends nothing to a server.
        </p>
      </section>

      <Toaster />
    </main>
  );
}

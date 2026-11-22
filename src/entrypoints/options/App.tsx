import { useEffect, useState, type ReactNode } from 'react';
import { browser } from 'wxt/browser';
import { COLOR_FORMATS, type ColorFormat } from '@/core/color';
import { SHORTCUTS } from '@/core/config';
import { clearAllData, HISTORY_LIMITS, type ThemeSetting } from '@/core/storage';
import { Segmented, toast, Toaster } from '@/ui/components';
import { useStored, useTheme } from '@/ui/hooks';
import { Icon, type IconName } from '@/ui/icons';

const THEMES: { value: ThemeSetting; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

function Setting(props: { title: string; help: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={props.wide ? 'setting setting-wide' : 'setting'}>
      <div className="grow setting-copy">
        <div className="setting-title">{props.title}</div>
        <div className="muted small">{props.help}</div>
      </div>
      <div className="setting-control">{props.children}</div>
    </div>
  );
}

function Section(props: { icon: IconName; title: string; description: string; delay?: number; children: ReactNode }) {
  return (
    <section className="settings-section fade-up" style={{ animationDelay: `${props.delay ?? 0}ms` }}>
      <header className="section-head">
        <div className="grow">
          <h2 className="section-title">{props.title}</h2>
          <p className="muted small section-desc">{props.description}</p>
        </div>
        <span className="section-glyph">
          <Icon name={props.icon} size={17} />
        </span>
      </header>
      <div className="card settings-group">{props.children}</div>
    </section>
  );
}

function KeyChips({ value }: { value: string }) {
  if (!value) return <span className="muted small">Not set</span>;
  return (
    <span className="key-chips" role="group" aria-label={`Shortcut ${value}`}>
      {value.split('+').map((key, index) => (
        <span key={`${key}-${index}`} className="key-chip">
          {index > 0 && (
            <span className="key-plus" aria-hidden="true">
              +
            </span>
          )}
          <kbd>{key}</kbd>
        </span>
      ))}
    </span>
  );
}

export function App() {
  useTheme();
  const [settings, setSettings] = useStored('settings');
  const [confirmClear, setConfirmClear] = useState(false);
  const [shortcuts, setShortcuts] = useState<Record<string, string>>({});

  useEffect(() => {
    void browser.commands.getAll().then((commands) => {
      setShortcuts(Object.fromEntries(commands.map((c) => [c.name ?? '', c.shortcut ?? ''])));
    });
  }, []);

  return (
    <main className="options">
      <header className="options-hero fade-up">
        <div className="options-identity">
          <span className="options-mark">
            <img src="/icon/48.png" width="34" height="34" alt="" />
          </span>
          <div className="grow">
            <p className="eyebrow options-eyebrow">Preferences</p>
            <h1>PickKit settings</h1>
            <p className="muted small options-sub">Tune how colours are copied, how PickKit looks and what it remembers.</p>
          </div>
          <span className="badge version-badge">Version {browser.runtime.getManifest().version}</span>
        </div>
      </header>

      <Section
        icon="palette"
        title="Colours"
        description="The format and case used whenever you copy a colour."
        delay={80}
      >
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
            className="select history-select"
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
      </Section>

      <Section
        icon="contrast"
        title="Appearance"
        description="Choose the look of PickKit's windows and the on-page overlay."
        delay={140}
      >
        <Setting title="Theme" help="Applies to PickKit's own windows and the on-page overlay." wide>
          <div className="theme-preview" aria-hidden="true">
            {THEMES.map((theme) => (
              <div
                key={theme.value}
                className={`theme-tile${settings.theme === theme.value ? ' is-active' : ''}`}
                data-theme={theme.value}
              >
                <div className="theme-window">
                  <div className="theme-window-bar">
                    <span className="theme-dot" />
                    <span className="theme-dot" />
                    <span className="theme-dot" />
                  </div>
                  <span className="theme-line" />
                  <span className="theme-line short" />
                  <span className="theme-chip" />
                </div>
                <span className="theme-label">{theme.label}</span>
                {settings.theme === theme.value && (
                  <span className="theme-check">
                    <Icon name="check" size={10} />
                  </span>
                )}
              </div>
            ))}
          </div>
          <Segmented<ThemeSetting>
            label="Theme"
            value={settings.theme}
            options={THEMES}
            onChange={(theme) => setSettings({ ...settings, theme })}
          />
        </Setting>
      </Section>

      <Section
        icon="zap"
        title="Keyboard shortcuts"
        description="Start a picker without opening the popup."
        delay={200}
      >
        <Setting title="Pick a colour" help="Opens the colour picker on the current tab.">
          <KeyChips value={shortcuts['pick-color'] || SHORTCUTS.color} />
        </Setting>
        <Setting title="Inspect a font" help="Opens the font inspector on the current tab.">
          <KeyChips value={shortcuts['inspect-font'] || SHORTCUTS.font} />
        </Setting>
        <Setting
          title="Change shortcuts"
          help={`Defaults are ${SHORTCUTS.color} and ${SHORTCUTS.font}. Chrome manages shortcuts for all extensions in one place.`}
        >
          <button
            type="button"
            className="btn"
            onClick={() => void browser.tabs.create({ url: 'chrome://extensions/shortcuts' })}
          >
            <Icon name="external" size={14} />
            Open Chrome shortcuts
          </button>
        </Setting>
      </Section>

      <Section
        icon="eye"
        title="Privacy"
        description="Decide what PickKit can read and how long it keeps it."
        delay={260}
      >
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
              <Icon name="trash" size={14} />
              Clear data
            </button>
          )}
        </Setting>
        <div className="banner privacy-note">
          <Icon name="info" size={16} />
          <div>Everything PickKit saves stays in this browser. It has no account and sends nothing to a server.</div>
        </div>
      </Section>

      <Toaster />
    </main>
  );
}

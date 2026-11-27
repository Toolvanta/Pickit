import { useEffect, useState, type ReactNode } from 'react';
import { browser } from 'wxt/browser';
import { COLOR_FORMATS, type ColorFormat } from '@/core/color';
import { SHORTCUTS } from '@/core/config';
import { parseBackup, serializeBackup, type BackupResult } from '@/core/backup';
import { downloadText } from '@/core/download';
import { t, tp } from '@/core/i18n';
import {
  clearAllData,
  getAllState,
  HISTORY_LIMITS,
  replaceAllState,
  trimHistory,
  updateState,
  type ThemeSetting,
} from '@/core/storage';
import { SYNC_STATUS_KEY, type SyncStatus } from '@/core/sync-engine';
import { Segmented, Switch, toast, Toaster } from '@/ui/components';
import { useShortcuts, useStored, useTheme } from '@/ui/hooks';
import { Icon, type IconName } from '@/ui/icons';
import { CreatorCard, SponsorCard } from '@/ui/sponsor';

// Labels are computed at render time so t() runs in the current UI language.
const themes = (): { value: ThemeSetting; label: string }[] => [
  { value: 'light', label: t('settings_theme_light') },
  { value: 'dark', label: t('settings_theme_dark') },
  { value: 'system', label: t('settings_theme_system') },
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
  if (!value) return <span className="muted small">{t('settings_shortcut_not_set')}</span>;
  return (
    <span className="key-chips" role="group" aria-label={t('settings_shortcut_label', value)}>
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

/** "3 colours, 1 font, 2 palettes" parts, each counted in the UI language. */
const backupCounts = (counts: Record<'colors' | 'fonts' | 'palettes', number>) =>
  [
    tp('settings_count_colours', counts.colors),
    tp('settings_count_fonts', counts.fonts),
    tp('settings_count_palettes', counts.palettes),
  ] as const;

export function App() {
  useTheme();
  const [settings, setSettings] = useStored('settings');
  const [confirmClear, setConfirmClear] = useState(false);
  const shortcuts = useShortcuts();
  const [pendingRestore, setPendingRestore] = useState<Extract<BackupResult, { ok: true }> | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  // The background worker records the last sync result; show it while sync is on.
  useEffect(() => {
    void browser.storage.local.get(SYNC_STATUS_KEY).then((v) => setSyncStatus((v[SYNC_STATUS_KEY] as SyncStatus) ?? null));
    const onChange = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && SYNC_STATUS_KEY in changes) setSyncStatus((changes[SYNC_STATUS_KEY].newValue as SyncStatus) ?? null);
    };
    browser.storage.onChanged.addListener(onChange);
    return () => browser.storage.onChanged.removeListener(onChange);
  }, []);
  const THEMES = themes();

  function setHistoryLimit(historyLimit: number) {
    setSettings((current) => ({ ...current, historyLimit }));
    // Apply a lower limit now rather than waiting for the next pick. Favourites are kept.
    void updateState('colors', (colors) => trimHistory(colors, historyLimit));
  }

  return (
    <main className="options">
      <header className="options-hero fade-up">
        <div className="options-identity">
          <span className="options-mark">
            <img src="/icon/48.png" width="34" height="34" alt="" />
          </span>
          <div className="grow">
            <p className="eyebrow options-eyebrow">{t('settings_eyebrow')}</p>
            <h1>{t('settings_heading')}</h1>
            <p className="muted small options-sub">{t('settings_intro')}</p>
          </div>
          <span className="badge version-badge">{t('settings_version_badge', browser.runtime.getManifest().version)}</span>
        </div>
      </header>

      <Section
        icon="palette"
        title={t('settings_colours_title')}
        description={t('settings_colours_description')}
        delay={80}
      >
        <Setting title={t('settings_default_format_title')} help={t('settings_default_format_help')}>
          <Segmented<ColorFormat>
            label={t('settings_default_format_label')}
            value={settings.format}
            options={COLOR_FORMATS.map((f) => ({ value: f, label: f.toUpperCase() }))}
            onChange={(format) => setSettings((s) => ({ ...s, format }))}
          />
        </Setting>
        <Setting title={t('settings_hex_case_title')} help={t('settings_hex_case_help')}>
          <Segmented
            label={t('settings_hex_case_title')}
            value={settings.upperHex ? 'upper' : 'lower'}
            options={[
              { value: 'upper', label: '#AABBCC' },
              { value: 'lower', label: '#aabbcc' },
            ]}
            onChange={(value) => setSettings((s) => ({ ...s, upperHex: value === 'upper' }))}
          />
        </Setting>
        <Setting title={t('settings_history_size_title')} help={t('settings_history_size_help')}>
          <select
            className="select history-select"
            aria-label={t('settings_history_size_title')}
            value={settings.historyLimit}
            onChange={(e) => setHistoryLimit(Number(e.target.value))}
          >
            {HISTORY_LIMITS.map((limit) => (
              <option key={limit} value={limit}>
                {tp('settings_history_size_option', limit)}
              </option>
            ))}
          </select>
        </Setting>
      </Section>

      <Section
        icon="contrast"
        title={t('settings_appearance_title')}
        description={t('settings_appearance_description')}
        delay={140}
      >
        <Setting title={t('settings_theme_title')} help={t('settings_theme_help')} wide>
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
            label={t('settings_theme_title')}
            value={settings.theme}
            options={THEMES}
            onChange={(theme) => setSettings((s) => ({ ...s, theme }))}
          />
        </Setting>
      </Section>

      <Section
        icon="zap"
        title={t('settings_shortcuts_title')}
        description={t('settings_shortcuts_description')}
        delay={200}
      >
        <Setting title={t('settings_shortcut_pick_colour_title')} help={t('settings_shortcut_pick_colour_help')}>
          <KeyChips value={shortcuts.color} />
        </Setting>
        <Setting title={t('settings_shortcut_inspect_font_title')} help={t('settings_shortcut_inspect_font_help')}>
          <KeyChips value={shortcuts.font} />
        </Setting>
        <Setting
          title={t('settings_change_shortcuts_title')}
          help={t('settings_change_shortcuts_help', SHORTCUTS.color, SHORTCUTS.font)}
        >
          <button
            type="button"
            className="btn"
            onClick={() => void browser.tabs.create({ url: 'chrome://extensions/shortcuts' })}
          >
            <Icon name="external" size={14} />
            {t('settings_open_chrome_shortcuts')}
          </button>
        </Setting>
      </Section>

      <Section
        icon="download"
        title={t('settings_backup_title')}
        description={t('settings_backup_description')}
        delay={240}
      >
        <Setting title={t('settings_sync_title')} help={t('settings_sync_help')}>
          <Switch
            checked={settings.sync}
            label={t('settings_sync_title')}
            onChange={(sync) => setSettings((s) => ({ ...s, sync }))}
          />
        </Setting>
        {settings.sync && syncStatus && !syncStatus.ok && (
          <div className="banner banner-warn" role="status">
            <Icon name="alert" size={16} />
            <div>
              {syncStatus.error === 'quota'
                ? t('settings_sync_error_quota')
                : syncStatus.error === 'too-large'
                  ? t('settings_sync_error_too_large')
                  : t('settings_sync_error_unavailable')}
            </div>
          </div>
        )}
        <Setting title={t('settings_export_title')} help={t('settings_export_help')}>
          <button
            type="button"
            className="btn"
            onClick={async () => {
              const stamp = new Date().toISOString().slice(0, 10);
              downloadText(`pickit-backup-${stamp}`, serializeBackup(await getAllState()), '.json');
              toast(t('settings_toast_backup_downloaded'));
            }}
          >
            <Icon name="download" size={14} />
            {t('settings_export_button')}
          </button>
        </Setting>
        <Setting title={t('settings_restore_title')} help={t('settings_restore_help')}>
          {pendingRestore ? (
            <div className="row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  await replaceAllState(pendingRestore.state);
                  const counts = backupCounts(pendingRestore.counts);
                  setPendingRestore(null);
                  toast(t('settings_toast_restored', ...counts));
                }}
              >
                {t('settings_restore_confirm')}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setPendingRestore(null)}>
                {t('settings_cancel')}
              </button>
            </div>
          ) : (
            <label className="btn">
              <Icon name="plus" size={14} />
              {t('settings_restore_choose_file')}
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  if (file.size > 5_000_000) {
                    toast(t('settings_toast_file_too_large'));
                    return;
                  }
                  const result = parseBackup(await file.text());
                  if (!result.ok) {
                    toast(result.error);
                    return;
                  }
                  setPendingRestore(result);
                }}
              />
            </label>
          )}
        </Setting>
        {pendingRestore && (
          <div className="banner">
            <Icon name="info" size={16} />
            <div>{t('settings_restore_banner', ...backupCounts(pendingRestore.counts))}</div>
          </div>
        )}
      </Section>

      <Section
        icon="eye"
        title={t('settings_privacy_title')}
        description={t('settings_privacy_description')}
        delay={300}
      >
        <Setting title={t('settings_clear_data_title')} help={t('settings_clear_data_help')}>
          {confirmClear ? (
            <div className="row">
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  await clearAllData();
                  setConfirmClear(false);
                  toast(t('settings_toast_data_cleared'));
                }}
              >
                {t('settings_clear_data_confirm')}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmClear(false)}>
                {t('settings_cancel')}
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-danger" onClick={() => setConfirmClear(true)}>
              <Icon name="trash" size={14} />
              {t('settings_clear_data_button')}
            </button>
          )}
        </Setting>
        <div className="banner privacy-note">
          <Icon name="info" size={16} />
          <div>{t('settings_privacy_note')}</div>
        </div>
      </Section>

      <div className="about-cards">
        <CreatorCard />
        <SponsorCard />
      </div>

      <Toaster />
    </main>
  );
}

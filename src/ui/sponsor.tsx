// Sponsor credit and maker links. Shown only on Pickit's own pages (popup, side panel,
// settings, welcome), never injected into the websites people inspect: that would break
// the Chrome Web Store's ad policy and the promise that Pickit stays out of the page.

import { browser } from 'wxt/browser';
import { CREATOR, SPONSOR } from '@/core/config';
import { t } from '@/core/i18n';
import { Icon, type IconName } from './icons';

const openTab = (url: string) => void browser.tabs.create({ url });

/** One quiet line, for the popup and side panel footers. */
export function SponsorLine() {
  return (
    <button type="button" className="sponsor-line" onClick={() => openTab(SPONSOR.url)} title={t('sponsor_open', SPONSOR.name)}>
      <span className="sponsor-mark" aria-hidden="true">
        TE
      </span>
      <span className="sponsor-text">
        <span className="sponsor-kicker">{t('sponsor_label')}</span> <strong>{SPONSOR.name}</strong>
        <span className="sponsor-dot" aria-hidden="true">
          ·
        </span>
        <span className="sponsor-short">{t('sponsor_tagline_short')}</span>
      </span>
      <Icon name="external" size={12} />
    </button>
  );
}

/** A small card with a call to action, for the settings page. */
export function SponsorCard() {
  return (
    <aside className="sponsor-card" aria-label={t('sponsor_label')}>
      <span className="sponsor-mark sponsor-mark-lg" aria-hidden="true">
        TE
      </span>
      <div className="sponsor-body">
        <div className="sponsor-kicker">{t('sponsor_label')}</div>
        <div className="sponsor-name">{SPONSOR.name}</div>
        <p className="sponsor-desc">{t('sponsor_tagline')}</p>
      </div>
      <button type="button" className="btn btn-small" onClick={() => openTab(SPONSOR.url)} aria-label={t('sponsor_open', SPONSOR.name)}>
        {t('sponsor_cta')} <Icon name="external" size={12} />
      </button>
    </aside>
  );
}

/** The prominent version for the top of the welcome page, the first screen people see. */
export function SponsorBanner() {
  return (
    <aside className="sponsor-banner" aria-label={t('sponsor_label')}>
      <span className="sponsor-mark sponsor-mark-lg" aria-hidden="true">
        TE
      </span>
      <div className="sponsor-body">
        <div className="sponsor-kicker">{t('sponsor_label')}</div>
        <div className="sponsor-name">{SPONSOR.name}</div>
        <p className="sponsor-desc">{t('sponsor_tagline')}</p>
      </div>
      <button type="button" className="btn btn-primary" onClick={() => openTab(SPONSOR.url)} aria-label={t('sponsor_open', SPONSOR.name)}>
        {t('sponsor_cta')} <Icon name="external" size={14} />
      </button>
    </aside>
  );
}

const LINKS: { key: 'github' | 'linkedin' | 'portfolio'; icon: IconName; label: () => string }[] = [
  { key: 'github', icon: 'github', label: () => t('credits_github') },
  { key: 'linkedin', icon: 'linkedin', label: () => t('credits_linkedin') },
  { key: 'portfolio', icon: 'globe', label: () => t('credits_portfolio') },
];

/** Three icon buttons (GitHub, LinkedIn, portfolio) for tight footers. */
export function CreatorIcons() {
  return (
    <span className="creator-icons">
      {LINKS.map((link) => (
        <button
          key={link.key}
          type="button"
          className="creator-icon"
          title={link.label()}
          aria-label={link.label()}
          onClick={() => openTab(CREATOR[link.key])}
        >
          <Icon name={link.icon} size={14} />
        </button>
      ))}
    </span>
  );
}

/** "Made by …" with labelled links, for the welcome and settings pages. */
export function CreatorCard() {
  return (
    <section className="creator-card" aria-label={t('credits_title')}>
      <div className="creator-copy">
        <div className="sponsor-kicker">{t('credits_title')}</div>
        <div className="creator-name">{t('credits_made_by', CREATOR.name)}</div>
        <p className="sponsor-desc">{t('credits_open_source')}</p>
      </div>
      <div className="creator-links">
        {LINKS.map((link) => (
          <button key={link.key} type="button" className="btn btn-small" onClick={() => openTab(CREATOR[link.key])}>
            <Icon name={link.icon} size={14} />
            {link.label()}
          </button>
        ))}
      </div>
    </section>
  );
}

import { t } from '@/core/i18n';
import type { PickMode } from '@/core/messages';
import { useShortcuts, useTheme } from '@/ui/hooks';
import { Icon, type IconName } from '@/ui/icons';
import { CreatorCard, SponsorBanner } from '@/ui/sponsor';

const steps = (): { icon: IconName; title: string; text: string; shortcut?: PickMode }[] => [
  {
    icon: 'pipette',
    title: t('welcome_step_pick_title'),
    text: t('welcome_step_pick_text'),
    shortcut: 'color',
  },
  {
    icon: 'type',
    title: t('welcome_step_font_title'),
    text: t('welcome_step_font_text'),
    shortcut: 'font',
  },
  {
    icon: 'panel',
    title: t('welcome_step_workspace_title'),
    text: t('welcome_step_workspace_text'),
  },
];

function Shortcut({ value }: { value: string }) {
  return (
    <span className="shortcut" role="group" aria-label={t('welcome_shortcut_label', value)}>
      {value.split('+').map((key, index) => (
        <span key={`${key}-${index}`} className="shortcut-part">
          {index > 0 && (
            <span className="shortcut-plus" aria-hidden="true">
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
  const shortcuts = useShortcuts();

  return (
    <main className="welcome">
      <div className="welcome-inner">
        <div className="fade-up">
          <SponsorBanner />
        </div>

        <header className="welcome-hero">
          <span className="hero-glow" aria-hidden="true" />

          <div className="brand-lockup fade-up">
            <span className="brand-mark">
              <img src="/icon/128.png" width="64" height="64" alt="" />
            </span>
            <span className="brand-name">Pickit</span>
          </div>

          <p className="eyebrow welcome-kicker fade-up" style={{ animationDelay: '60ms' }}>
            {t('welcome_kicker')}
          </p>
          <h1 className="welcome-title fade-up" style={{ animationDelay: '120ms' }}>
            {t('welcome_title_lead')} <span className="title-accent">{t('welcome_title_accent')}</span>
          </h1>
          <p className="muted lead fade-up" style={{ animationDelay: '180ms' }}>
            {t('welcome_lead')}
          </p>
        </header>

        <ol className="steps">
          {steps().map((step, index) => (
            <li
              key={step.title}
              className="card step fade-up"
              style={{ animationDelay: `${260 + index * 90}ms` }}
            >
              <span className="step-number" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="step-icon">
                <Icon name={step.icon} size={21} />
              </span>
              <h2>{step.title}</h2>
              <p className="muted">{step.text}</p>
              {step.shortcut && shortcuts[step.shortcut] && <Shortcut value={shortcuts[step.shortcut]} />}
            </li>
          ))}
        </ol>

        <footer className="welcome-end fade-up" style={{ animationDelay: '560ms' }}>
          <p className="tip">
            <Icon name="info" size={14} />
            <span>{t('welcome_tip_pin')}</span>
          </p>
          <button type="button" className="btn btn-primary welcome-cta" onClick={() => window.close()}>
            {t('welcome_cta')}
            <Icon name="chevron" size={16} />
          </button>
        </footer>

        <div className="fade-up" style={{ animationDelay: '640ms', marginTop: 24 }}>
          <CreatorCard />
        </div>
      </div>
    </main>
  );
}

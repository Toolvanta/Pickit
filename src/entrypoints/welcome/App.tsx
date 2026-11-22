import { SHORTCUTS } from '@/core/config';
import { useTheme } from '@/ui/hooks';
import { Icon, type IconName } from '@/ui/icons';

const STEPS: { icon: IconName; title: string; text: string; shortcut?: string }[] = [
  {
    icon: 'pipette',
    title: 'Pick a colour',
    text: 'Open the popup or use the shortcut, then click a colour on the page. PickKit reads it without watching what you do.',
    shortcut: SHORTCUTS.color,
  },
  {
    icon: 'type',
    title: 'Inspect a font',
    text: 'Choose the font tool and click any text. You get its family, size, weight and colour in one small panel.',
    shortcut: SHORTCUTS.font,
  },
  {
    icon: 'panel',
    title: 'Keep it all in the workspace',
    text: 'The side panel holds your colour history, fonts, palettes, contrast checker and a one-click style guide of the page.',
  },
];

function Shortcut({ value }: { value: string }) {
  return (
    <span className="shortcut" role="group" aria-label={`Shortcut ${value}`}>
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

  return (
    <main className="welcome">
      <div className="welcome-inner">
        <header className="welcome-hero">
          <span className="hero-glow" aria-hidden="true" />

          <div className="brand-lockup fade-up">
            <span className="brand-mark">
              <img src="/icon/128.png" width="64" height="64" alt="" />
            </span>
            <span className="brand-name">PickKit</span>
          </div>

          <p className="eyebrow welcome-kicker fade-up" style={{ animationDelay: '60ms' }}>
            Welcome to PickKit
          </p>
          <h1 className="welcome-title fade-up" style={{ animationDelay: '120ms' }}>
            Any colour. Any font. <span className="title-accent">Right at your fingertips.</span>
          </h1>
          <p className="muted lead fade-up" style={{ animationDelay: '180ms' }}>
            Three things to know, then you are set.
          </p>
        </header>

        <ol className="steps">
          {STEPS.map((step, index) => (
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
              {step.shortcut && <Shortcut value={step.shortcut} />}
            </li>
          ))}
        </ol>

        <footer className="welcome-end fade-up" style={{ animationDelay: '560ms' }}>
          <p className="tip">
            <Icon name="info" size={14} />
            <span>Tip: click the puzzle icon in Chrome's toolbar and pin PickKit so it is always one click away.</span>
          </p>
          <button type="button" className="btn btn-primary welcome-cta" onClick={() => window.close()}>
            Start inspecting
            <Icon name="chevron" size={16} />
          </button>
        </footer>
      </div>
    </main>
  );
}

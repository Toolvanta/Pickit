import { SHORTCUTS } from '@/core/config';
import { useTheme } from '@/ui/hooks';
import { Icon, type IconName } from '@/ui/icons';

const STEPS: { icon: IconName; title: string; text: string; shortcut?: string }[] = [
  {
    icon: 'pipette',
    title: 'Pick any colour',
    text: 'A magnifier follows your cursor so you can hit the exact pixel. Click to copy; hold Shift to pick several in a row.',
    shortcut: SHORTCUTS.color,
  },
  {
    icon: 'type',
    title: 'Identify any font',
    text: 'Hover over text to see the font, size, weight and spacing. Click to pin the card and copy the CSS.',
    shortcut: SHORTCUTS.font,
  },
  {
    icon: 'panel',
    title: 'Keep it all in the workspace',
    text: 'The side panel holds your history, palettes, a contrast checker and a one-click style guide of the page you are on.',
  },
];

export function App() {
  useTheme();
  return (
    <main className="welcome">
      <img src="/icon/128.png" width="64" height="64" alt="" />
      <h1>PickKit is ready</h1>
      <p className="muted lead">Three things to know, then you are set.</p>

      <ol className="steps">
        {STEPS.map((step) => (
          <li key={step.title} className="card step">
            <span className="step-icon">
              <Icon name={step.icon} size={20} />
            </span>
            <h2>{step.title}</h2>
            <p className="muted">{step.text}</p>
            {step.shortcut && <kbd>{step.shortcut}</kbd>}
          </li>
        ))}
      </ol>

      <p className="muted small">
        Tip: click the puzzle icon in Chrome's toolbar and pin PickKit so it is always one click away.
      </p>
      <button type="button" className="btn btn-primary" onClick={() => window.close()}>
        Start picking
      </button>
    </main>
  );
}

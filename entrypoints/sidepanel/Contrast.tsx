import { useEffect, useState } from 'react';
import { contrastRatio, parseColor, rgbToHex, wcag } from '@/core/color';
import { IconButton } from '@/ui/components';
import { useStored } from '@/ui/hooks';
import type { ContrastPair } from './App';

const RECENT = 8;

function ColorField(props: { label: string; value: string; recent: string[]; onChange: (hex: string) => void }) {
  const [draft, setDraft] = useState(props.value);
  useEffect(() => setDraft(props.value), [props.value]);
  const valid = parseColor(draft) !== null;

  return (
    <div className="stack" style={{ gap: 6 }}>
      <label className="field-label" htmlFor={`contrast-${props.label}`}>
        {props.label}
      </label>
      <div className="row">
        <input
          type="color"
          className="color-input"
          aria-label={`${props.label} colour picker`}
          value={props.value.slice(0, 7).toLowerCase()}
          onChange={(e) => props.onChange(e.target.value.toUpperCase())}
        />
        <input
          id={`contrast-${props.label}`}
          className="input mono"
          value={draft}
          spellCheck={false}
          aria-invalid={!valid}
          onChange={(e) => {
            setDraft(e.target.value);
            const parsed = parseColor(e.target.value);
            if (parsed) props.onChange(rgbToHex({ ...parsed, a: 1 }));
          }}
          onBlur={() => setDraft(props.value)}
        />
      </div>
      {props.recent.length > 0 && (
        <div className="swatch-grid">
          {props.recent.map((hex) => (
            <button
              key={hex}
              type="button"
              className="swatch"
              style={{ background: hex }}
              title={hex}
              aria-label={`Use ${hex} as ${props.label.toLowerCase()}`}
              onClick={() => props.onChange(hex)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Result({ label, pass }: { label: string; pass: boolean }) {
  return (
    <div className="row between result">
      <span>{label}</span>
      <span className={pass ? 'badge badge-pass' : 'badge badge-fail'}>{pass ? 'Pass' : 'Fail'}</span>
    </div>
  );
}

export function Contrast({ pair, onChange }: { pair: ContrastPair; onChange: (pair: ContrastPair) => void }) {
  const [colors] = useStored('colors');
  const recent = colors.slice(0, RECENT).map((c) => c.hex.slice(0, 7));
  const fg = parseColor(pair.fg);
  const bg = parseColor(pair.bg);
  const ratio = fg && bg ? contrastRatio(fg, bg) : 1;
  const levels = wcag(ratio);

  return (
    <div className="stack">
      <div className="preview" style={{ background: pair.bg, color: pair.fg }}>
        <div className="preview-large">Large text 24px</div>
        <div>Body text at 16 pixels. The quick brown fox jumps over the lazy dog.</div>
      </div>

      <div className="row between">
        <div>
          <div className="ratio">{ratio.toFixed(2)}:1</div>
          <div className="muted small">Contrast ratio (WCAG 2)</div>
        </div>
        <IconButton icon="swap" label="Swap text and background" onClick={() => onChange({ fg: pair.bg, bg: pair.fg })} />
      </div>

      <div className="card results">
        <Result label="AA · body text (4.5:1)" pass={levels.aaNormal} />
        <Result label="AA · large text (3:1)" pass={levels.aaLarge} />
        <Result label="AAA · body text (7:1)" pass={levels.aaaNormal} />
        <Result label="AAA · large text (4.5:1)" pass={levels.aaaLarge} />
      </div>

      <ColorField label="Text" value={pair.fg} recent={recent} onChange={(fgHex) => onChange({ ...pair, fg: fgHex })} />
      <ColorField label="Background" value={pair.bg} recent={recent} onChange={(bgHex) => onChange({ ...pair, bg: bgHex })} />
    </div>
  );
}

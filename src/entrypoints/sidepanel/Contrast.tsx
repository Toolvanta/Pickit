import { useEffect, useState } from 'react';
import {
  apcaContrast,
  apcaUse,
  contrastRatio,
  parseColor,
  rgbToHex,
  simulateVision,
  suggestContrastFix,
  VISION_TYPES,
  wcag,
  type RGB,
  type VisionType,
} from '@/core/color';
import { t } from '@/core/i18n';
import { IconButton } from '@/ui/components';
import { useStored } from '@/ui/hooks';
import { Icon } from '@/ui/icons';
import type { ContrastPair } from './App';

const RECENT = 8;

/** Short labels for the vision picker buttons. */
function visionShortLabel(value: Vision): string {
  switch (value) {
    case 'normal':
      return t('contrast_vision_short_typical');
    case 'protanopia':
      return t('contrast_vision_short_protanopia');
    case 'deuteranopia':
      return t('contrast_vision_short_deuteranopia');
    case 'tritanopia':
      return t('contrast_vision_short_tritanopia');
    case 'achromatopsia':
      return t('contrast_vision_short_achromatopsia');
  }
}

function ColorField(props: { role: 'fg' | 'bg'; value: string; recent: string[]; onChange: (hex: string) => void }) {
  const [draft, setDraft] = useState(props.value);
  useEffect(() => setDraft(props.value), [props.value]);
  const valid = parseColor(draft) !== null;
  const isText = props.role === 'fg';
  const id = isText ? 'contrast-text' : 'contrast-background';

  return (
    <div className="color-field">
      <label className="field-label" htmlFor={id}>
        {isText ? t('contrast_field_text') : t('contrast_field_background')}
      </label>
      <div className="color-field-row">
        <input
          type="color"
          className="color-input"
          aria-label={isText ? t('contrast_text_picker_aria') : t('contrast_background_picker_aria')}
          value={props.value.slice(0, 7).toLowerCase()}
          onChange={(e) => props.onChange(e.target.value.toUpperCase())}
        />
        <input
          id={id}
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
        <div className="mini-swatches">
          {props.recent.map((hex) => (
            <button
              key={hex}
              type="button"
              className="mini-swatch"
              style={{ background: hex }}
              title={hex}
              aria-label={isText ? t('contrast_use_recent_as_text_aria', hex) : t('contrast_use_recent_as_background_aria', hex)}
              aria-pressed={hex === props.value}
              onClick={() => props.onChange(hex)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Check({ label, target, pass }: { label: string; target: string; pass: boolean }) {
  return (
    <div className={pass ? 'check is-pass' : 'check is-fail'}>
      <Icon name={pass ? 'check' : 'x'} size={13} />
      <span className="check-label">{label}</span>
      <span className="check-target">{target}</span>
    </div>
  );
}

type Vision = 'normal' | VisionType;

const truncate2 = (n: number) => (Math.floor(n * 100) / 100).toFixed(2);

export function Contrast({ pair, onChange }: { pair: ContrastPair; onChange: (pair: ContrastPair) => void }) {
  const [colors] = useStored('colors');
  const [vision, setVision] = useState<Vision>('normal');
  const recent = [...new Set(colors.slice(0, RECENT).map((c) => c.hex.slice(0, 7)))];
  const fg = parseColor(pair.fg);
  const bg = parseColor(pair.bg);
  const ratio = fg && bg ? contrastRatio(fg, bg) : 1;
  const lc = fg && bg ? apcaContrast(fg, bg) : 0;
  const levels = wcag(ratio);
  const grade = levels.aaaNormal ? 'AAA' : levels.aaNormal ? 'AA' : levels.aaLarge ? t('contrast_grade_aa_large') : t('contrast_grade_fails');

  // Aim for the next level up: AA if it fails AA, otherwise AAA.
  const target = levels.aaNormal ? 7 : 4.5;
  const targetName = levels.aaNormal ? 'AAA' : 'AA';
  const fixText = fg && bg && !levels.aaaNormal ? suggestContrastFix(fg, bg, target) : null;
  const fixBg = fg && bg && !levels.aaaNormal ? suggestContrastFix(bg, fg, target) : null;

  const shown = (c: RGB | null, fallback: string) =>
    c ? rgbToHex(vision === 'normal' ? c : simulateVision({ ...c, a: 1 }, vision)) : fallback;
  const visionInfo = VISION_TYPES.find((v) => v.value === vision);
  const visionNote = visionInfo?.note;

  return (
    <div className="stack contrast-tab">
      <section className="contrast-card">
        <div className="contrast-canvas" style={{ background: shown(bg, pair.bg), color: shown(fg, pair.fg) }}>
          <div className="row between">
            <span className={levels.aaNormal ? 'grade is-pass' : 'grade is-fail'}>{grade}</span>
            {vision !== 'normal' && <span className="vision-note">{t('contrast_simulating', visionInfo?.label ?? vision)}</span>}
          </div>
          <div className="contrast-ag">Aa</div>
          <div className="preview-large">{t('contrast_preview_large')}</div>
          <div className="contrast-copy">{t('contrast_preview_body')}</div>
        </div>
        <div className="contrast-readout">
          <div className="readout">
            <span className="readout-label">WCAG 2</span>
            <span className="ratio">
              {truncate2(ratio)}
              <span className="ratio-unit">:1</span>
            </span>
          </div>
          <div className="readout">
            <span className="readout-label" title={t('contrast_apca_title')}>
              APCA Lc
            </span>
            <span className="ratio">{Math.round(lc)}</span>
          </div>
          <IconButton icon="swap" label={t('contrast_swap')} onClick={() => onChange({ fg: pair.bg, bg: pair.fg })} />
        </div>
        <div className="apca-use">
          <Icon name="info" size={13} /> {t('contrast_apca_use', apcaUse(lc))}
        </div>
      </section>

      <div className="checks">
        <Check label={t('contrast_check_aa_body')} target="4.5" pass={levels.aaNormal} />
        <Check label={t('contrast_check_aa_large')} target="3" pass={levels.aaLarge} />
        <Check label={t('contrast_check_aaa_body')} target="7" pass={levels.aaaNormal} />
        <Check label={t('contrast_check_aaa_large')} target="4.5" pass={levels.aaaLarge} />
      </div>

      {(fixText || fixBg) && (
        <section className="fixes" aria-label={t('contrast_fixes_aria')}>
          <div className="fixes-title">
            <Icon name="wand" size={14} /> {t('contrast_fixes_title', targetName, target)}
          </div>
          <div className="fixes-row">
            {fixText && (
              <button type="button" className="fix" onClick={() => onChange({ ...pair, fg: rgbToHex(fixText) })}>
                <span className="fix-swatch" style={{ background: rgbToHex(fixText) }} />
                <span className="fix-copy">
                  <span className="fix-label">{t('contrast_fix_text')}</span>
                  <span className="mono">{rgbToHex(fixText)}</span>
                </span>
              </button>
            )}
            {fixBg && (
              <button type="button" className="fix" onClick={() => onChange({ ...pair, bg: rgbToHex(fixBg) })}>
                <span className="fix-swatch" style={{ background: rgbToHex(fixBg) }} />
                <span className="fix-copy">
                  <span className="fix-label">{t('contrast_fix_background')}</span>
                  <span className="mono">{rgbToHex(fixBg)}</span>
                </span>
              </button>
            )}
          </div>
        </section>
      )}

      <section className="section" aria-label={t('contrast_vision_title')}>
        <div className="section-title-row">
          <h3>{t('contrast_vision_title')}</h3>
          <span className="faint small">{visionNote ?? t('contrast_vision_typical_note')}</span>
        </div>
        <div className="vision-picker" role="group" aria-label={t('contrast_vision_picker_aria')}>
          {(['normal', ...VISION_TYPES.map((v) => v.value)] as Vision[]).map((value) => (
            <button key={value} type="button" aria-pressed={vision === value} onClick={() => setVision(value)}>
              {visionShortLabel(value)}
            </button>
          ))}
        </div>
      </section>

      <section className="section pair-fields" aria-label={t('contrast_pair_aria')}>
        <ColorField role="fg" value={pair.fg} recent={recent} onChange={(fgHex) => onChange({ ...pair, fg: fgHex })} />
        <ColorField role="bg" value={pair.bg} recent={recent} onChange={(bgHex) => onChange({ ...pair, bg: bgHex })} />
      </section>
    </div>
  );
}

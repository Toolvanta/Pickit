import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { COLOR_FORMATS, formatColor, hexToRgb, type ColorFormat } from '@/core/color';
import type { Settings } from '@/core/storage';
import { relativeTime, t } from '@/core/i18n';
import { Icon, type IconName } from './icons';

// ---------- Toasts ----------

type ToastListener = (message: string) => void;
const listeners = new Set<ToastListener>();

/** Shows a short confirmation. Usable from anywhere; rendered by <Toaster />. */
export function toast(message: string): void {
  listeners.forEach((listener) => listener(message));
}

/** Copies text and confirms with a toast. Resolves to whether the copy worked. */
export async function copy(text: string, label?: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast(label ?? t('ui_copied_value', text));
    return true;
  } catch {
    toast(t('ui_copy_failed'));
    return false;
  }
}

export function Toaster() {
  const [items, setItems] = useState<{ id: number; message: string }[]>([]);
  useEffect(() => {
    let nextId = 0;
    const listener: ToastListener = (message) => {
      const id = nextId++;
      setItems((current) => [...current.slice(-2), { id, message }]);
      setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 1800);
    };
    listeners.add(listener);
    return () => void listeners.delete(listener);
  }, []);
  return (
    <div className="toaster" role="status" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className="toast">
          {item.message}
        </div>
      ))}
    </div>
  );
}

// ---------- Small building blocks ----------

export function IconButton(props: {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  const className = props.active ? 'icon-btn is-active' : 'icon-btn';
  return (
    <button type="button" className={className} aria-label={props.label} aria-pressed={props.active} title={props.label} onClick={props.onClick} disabled={props.disabled}>
      <Icon name={props.icon} />
    </button>
  );
}

export function Segmented<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const index = Math.max(0, props.options.findIndex((option) => option.value === props.value));
  const style = {
    '--pk-seg-count': props.options.length,
    '--pk-seg-index': index,
  } as CSSProperties;

  return (
    <div className="segmented" style={style} role="group" aria-label={props.label}>
      {props.options.map((option) => (
        <button key={option.value} type="button" aria-pressed={option.value === props.value} onClick={() => props.onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** An accessible on/off control with a sliding knob. */
export function Switch(props: { checked: boolean; label: string; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="switch"
      role="switch"
      aria-checked={props.checked}
      aria-label={props.label}
      title={props.label}
      disabled={props.disabled}
      onClick={() => props.onChange(!props.checked)}
    />
  );
}

/** Shimmering placeholder for async views. */
export function Skeleton(props: { height?: number; width?: string; radius?: number }) {
  return <div className="skeleton" style={{ height: props.height ?? 14, width: props.width ?? '100%', borderRadius: props.radius }} aria-hidden="true" />;
}

/** A weighted colour ribbon: the wider the segment, the more the colour is used. */
export function ColorBar({ colors, onSelect }: { colors: { hex: string; weight: number }[]; onSelect?: (hex: string) => void }) {
  const total = colors.reduce((sum, color) => sum + color.weight, 0) || 1;
  return (
    <div className="color-bar" role="group" aria-label={t('ui_colorbar_label')}>
      {colors.map((color) => (
        <button
          key={color.hex}
          type="button"
          style={{ background: color.hex, flexGrow: Math.max(0.35, color.weight / total * 100) }}
          title={t('ui_colorbar_segment_title', color.hex, Math.round((color.weight / total) * 100))}
          aria-label={t('ui_colorbar_segment_aria', color.hex, Math.round((color.weight / total) * 100))}
          onClick={() => onSelect?.(color.hex)}
        />
      ))}
    </div>
  );
}

export function Empty(props: { icon: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={props.icon} size={18} />
      </div>
      <strong>{props.title}</strong>
      {props.children && <div>{props.children}</div>}
      {props.action}
    </div>
  );
}

/** A row that copies its value when clicked and briefly confirms with a tick. */
function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <button
      type="button"
      className="copy-row"
      data-copied={copied ? '' : undefined}
      onClick={async () => {
        if (await copy(value)) setCopied(true);
      }}
    >
      <span className="sr-only">{t('ui_copy_row_sr', label, value)}</span>
      <span className="copy-row-label" aria-hidden="true">{label}</span>{' '}
      <span className="copy-row-value" aria-hidden="true">{value}</span>
      <Icon name={copied ? 'check' : 'copy'} size={14} />
    </button>
  );
}

const FORMAT_LABELS: Record<ColorFormat, string> = { hex: 'HEX', rgb: 'RGB', hsl: 'HSL', oklch: 'OKLCH' };

/** All three formats of one colour, the user's default format first. */
export function ColorFormats({ hex, settings }: { hex: string; settings: Settings }) {
  const color = hexToRgb(hex);
  if (!color) return null;
  const order = [settings.format, ...COLOR_FORMATS.filter((f) => f !== settings.format)];
  return (
    <div className="copy-rows">
      {order.map((format) => (
        <CopyRow key={format} label={FORMAT_LABELS[format]} value={formatColor(color, format, { upperHex: settings.upperHex })} />
      ))}
    </div>
  );
}

/** A colour in the user's default format, e.g. for one-click copy from a swatch. */
export function inDefaultFormat(hex: string, settings: Settings): string {
  const color = hexToRgb(hex);
  return color ? formatColor(color, settings.format, { upperHex: settings.upperHex }) : hex;
}

/** "3 min ago", "yesterday", in the browser's language. */
export const timeAgo = relativeTime;

import { useEffect, useState, type ReactNode } from 'react';
import { COLOR_FORMATS, formatColor, hexToRgb, type ColorFormat } from '@/core/color';
import type { Settings } from '@/core/storage';
import { Icon, type IconName } from './icons';

// ---------- Toasts ----------

type ToastListener = (message: string) => void;
const listeners = new Set<ToastListener>();

/** Shows a short confirmation. Usable from anywhere; rendered by <Toaster />. */
export function toast(message: string): void {
  listeners.forEach((listener) => listener(message));
}

export async function copy(text: string, label?: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(label ?? `Copied ${text}`);
  } catch {
    toast('Could not copy');
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

export function IconButton(props: { icon: IconName; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="icon-btn" aria-label={props.label} title={props.label} onClick={props.onClick} disabled={props.disabled}>
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
  return (
    <div className="segmented" role="group" aria-label={props.label}>
      {props.options.map((option) => (
        <button key={option.value} type="button" aria-pressed={option.value === props.value} onClick={() => props.onChange(option.value)}>
          {option.label}
        </button>
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
export function CopyRow({ label, value }: { label: string; value: string }) {
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
      aria-label={`Copy ${label} ${value}`}
      onClick={async () => {
        await copy(value);
        setCopied(true);
      }}
    >
      <span className="copy-row-label">{label}</span>
      <span className="copy-row-value">{value}</span>
      <Icon name={copied ? 'check' : 'copy'} size={14} />
    </button>
  );
}

const FORMAT_LABELS: Record<ColorFormat, string> = { hex: 'HEX', rgb: 'RGB', hsl: 'HSL', oklch: 'OKLCH' };

/** All four formats of one colour, the user's default format first. */
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

export function timeAgo(ts: number): string {
  const minutes = Math.round((Date.now() - ts) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

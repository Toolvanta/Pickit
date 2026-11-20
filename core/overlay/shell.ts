// The overlay shell: one shadow-DOM host per page that every in-page tool mounts into.
// This is the shared core a future CSS inspector extension can reuse unchanged.
//
// Content-Security-Policy notes: styles are attached as constructed stylesheets and
// element styles are set through the CSSOM (never a `style` attribute), so the overlay
// still renders on pages with a strict `style-src`.

import tokensCss from '@/ui/tokens.css?inline';
import overlayCss from './overlay.css?inline';
import type { ThemeSetting } from '../storage';

type Child = Node | string | null | undefined | false;

/** Tiny element builder. Text is always inserted as text nodes, never parsed as HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | undefined> | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs ?? {})) {
    if (value !== undefined) el.setAttribute(name, value);
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child);
  }
  return el;
}

export function swatch(color: string): HTMLSpanElement {
  const el = h('span', { class: 'pk-swatch' });
  el.style.background = color;
  return el;
}

export function hintBar(items: [key: string, label: string][]): HTMLDivElement {
  return h('div', { class: 'pk-hint' }, ...items.map(([key, label]) => h('span', null, h('kbd', null, key), label)));
}

export interface ToastContent {
  title: string;
  sub?: string;
  color?: string;
}

export interface Shell {
  /** The element in the page. Used to tell overlay events apart from page events. */
  host: HTMLElement;
  /** Container tools append their UI to. */
  root: HTMLDivElement;
  toast(content: ToastContent): void;
  setTheme(theme: ThemeSetting): void;
  /** Hides or shows all overlay UI, e.g. while a screenshot is taken. */
  setVisible(visible: boolean): void;
  /** Tools call retain() when they start and release() when they finish. */
  retain(): void;
  release(): void;
}

const TOAST_MS = 2200;
let shell: Shell | null = null;

export function getShell(): Shell {
  if (shell) return shell;

  const host = document.createElement('pickkit-overlay');
  // Inline CSSOM styles beat the page's stylesheet and the UA popover defaults.
  Object.assign(host.style, {
    all: 'initial',
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    margin: '0',
    padding: '0',
    border: '0',
    background: 'transparent',
    overflow: 'visible',
    pointerEvents: 'none',
    zIndex: '2147483647',
  });

  const shadow = host.attachShadow({ mode: 'closed' });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`${tokensCss}\n${overlayCss}`);
  shadow.adoptedStyleSheets = [sheet];

  const root = h('div', { class: 'pk' });
  const toasts = h('div', { class: 'pk-toasts', role: 'status', 'aria-live': 'polite' });
  // Toasts live outside `root` so they stay visible while tool UI is hidden for capture.
  const toastLayer = h('div', { class: 'pk' }, toasts);
  shadow.append(root, toastLayer);

  document.documentElement.append(host);
  // The top layer keeps the overlay above modal dialogs and fullscreen elements.
  try {
    host.popover = 'manual';
    host.showPopover();
  } catch {
    // Older Chrome: the maximum z-index is the fallback.
  }

  let users = 0;
  const release = () => {
    users -= 1;
    if (users > 0) return;
    host.remove();
    shell = null;
  };

  shell = {
    host,
    root,
    retain: () => {
      users += 1;
    },
    release,
    setTheme(theme) {
      if (theme === 'system') host.removeAttribute('data-theme');
      else host.setAttribute('data-theme', theme);
    },
    setVisible(visible) {
      root.style.visibility = visible ? '' : 'hidden';
    },
    toast({ title, sub, color }) {
      users += 1; // A toast keeps the shell alive after its tool has finished.
      const el = h(
        'div',
        { class: color ? 'pk-toast' : 'pk-toast pk-toast-plain' },
        color ? swatch(color) : null,
        h('span', { class: 'pk-toast-title' }, title),
        sub ? h('span', { class: 'pk-toast-sub' }, sub) : null,
      );
      toasts.append(el);
      setTimeout(() => el.setAttribute('data-out', ''), TOAST_MS);
      setTimeout(() => {
        el.remove();
        release();
      }, TOAST_MS + 200);
    },
  };
  return shell;
}

/** Copies text, falling back to execCommand on pages without the async clipboard API (plain http). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    Object.assign(area.style, { position: 'fixed', top: '0', left: '0', opacity: '0' });
    document.documentElement.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

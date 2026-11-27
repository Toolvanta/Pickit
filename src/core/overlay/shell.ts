// The overlay shell: one shadow-DOM host per page that every in-page tool mounts into.
// This is the shared core a future CSS inspector extension can reuse unchanged.
//
// Content-Security-Policy notes: styles are attached as constructed stylesheets and
// element styles are set through the CSSOM (never a `style` attribute), so the overlay
// still renders on pages with a strict `style-src`.

import tokensCss from '@/ui/tokens.css?inline';
import overlayCss from './overlay.css?inline';
import { t, textDirection, uiLocale } from '../i18n';
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

/** Floating shortcut dock: a brand mark plus one separated group per hint. */
export function hintBar(items: [key: string, label: string][]): HTMLDivElement {
  const groups: Node[] = [];
  items.forEach(([key, label], index) => {
    if (index > 0) groups.push(h('span', { class: 'pk-dock-divider', 'aria-hidden': 'true' }));
    groups.push(h('span', { class: 'pk-hint-group' }, h('kbd', null, key), label));
  });
  return h(
    'div',
    { class: 'pk-hint pk-dock', role: 'toolbar', 'aria-label': t('overlay_hint_bar_label') },
    h('span', { class: 'pk-brand', 'aria-hidden': 'true' }, 'P'),
    h('span', { class: 'pk-dock-divider', 'aria-hidden': 'true' }),
    ...groups,
  );
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
  /** Hides or shows all overlay UI, toasts included, e.g. while a screenshot is taken. */
  setVisible(visible: boolean): void;
  /** Tools call retain() when they start and release() when they finish. */
  retain(): void;
  release(): void;
}

const TOAST_MS = 2200;
/** Most confirmations on screen at once; picking several colours quickly would otherwise stack them up the page. */
const MAX_TOASTS = 3;
let shell: Shell | null = null;

export function getShell(): Shell {
  if (shell) return shell;

  const host = document.createElement('pickit-overlay');
  // Inline CSSOM styles beat the page's stylesheet under strict CSP.
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

  // The page's own lang/dir do not reach into the shadow root; set Pickit's.
  const locale = { lang: uiLocale(), dir: textDirection() };
  const root = h('div', { class: 'pk', ...locale });
  const toasts = h('div', { class: 'pk-toasts', role: 'status', 'aria-live': 'polite' });
  // Toasts live outside `root` so they can outlive the tool that raised them.
  const toastLayer = h('div', { class: 'pk', ...locale }, toasts);
  shadow.append(root, toastLayer);

  // Appended last with the maximum z-index. The old popover() trick pushed the host
  // into the top layer, but it also triggered Chrome's deprecated anchor-positioning
  // CSS warning on modern versions; the flat stacking order is quieter and sufficient.
  document.documentElement.append(host);

  let users = 0;
  /** Dismiss functions of the toasts on screen, oldest first. */
  const live: (() => void)[] = [];
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
      // Toasts are hidden too: a toast left in a screenshot could be sampled as page colour.
      root.style.visibility = visible ? '' : 'hidden';
      toastLayer.style.visibility = visible ? '' : 'hidden';
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
      const fade = setTimeout(() => el.setAttribute('data-out', ''), TOAST_MS);
      const done = setTimeout(dismiss, TOAST_MS + 200);
      let gone = false;
      function dismiss() {
        if (gone) return; // runs once, whether it timed out or was pushed out
        gone = true;
        clearTimeout(fade);
        clearTimeout(done);
        live.splice(live.indexOf(dismiss), 1);
        el.remove();
        release();
      }
      live.push(dismiss);
      // Keep only the newest few; the oldest goes first.
      while (live.length > MAX_TOASTS) live[0]();
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

// Font inspector: hover any element to see the font rendering it; click to pin the
// card and copy values. Page clicks are swallowed while it is active so inspecting a
// link or button does not trigger it.

import { fontCss, inspectElement, lineHeightLabel, weightName, type FontInfo } from '../fonts';
import { addFont, saveFont } from '../storage';
import { copyText, h, hintBar, swatch, type Shell } from './shell';

const CARD_WIDTH = 300;
const GAP = 10;
const EDGE = 8;
const SCALE_MIN = 8;
const SCALE_MAX = 96;
const SCALE_TICKS = [8, 16, 24, 48, 96];
const BLOCKED_EVENTS = ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick', 'auxclick', 'contextmenu'];

/** Starts the font inspector. Returns a function that stops it. */
export function startFontInspector(shell: Shell, onDone: () => void): () => void {
  const box = h('div', { class: 'pk-box' });
  const card = h('div', { class: 'pk-card', role: 'dialog', 'aria-label': 'Font details' });
  const hint = hintBar([
    ['Hover', 'Inspect'],
    ['Click', 'Pin and copy'],
    ['Esc', 'Exit'],
  ]);
  const ui = h('div', null, box, card, hint);
  shell.root.append(ui);
  shell.retain();

  // A constructed stylesheet is not subject to the page's style-src policy.
  const cursorSheet = new CSSStyleSheet();
  cursorSheet.replaceSync('*, *::before, *::after { cursor: crosshair !important; }');
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, cursorSheet];

  let current: Element | null = null;
  let info: FontInfo | null = null;
  let pinned = false;
  let frame = 0;
  let stopped = false;

  const fromOverlay = (e: Event) => e.target === shell.host;

  function row(label: string, value: string, color?: string): HTMLButtonElement {
    const button = h(
      'button',
      { class: 'pk-row', type: 'button', tabindex: pinned ? '0' : '-1' },
      h('span', { class: 'pk-row-label' }, label),
      h('span', { class: 'pk-row-value' }, color ? swatch(color) : null, value),
    );
    button.addEventListener('click', async () => {
      if (!pinned) return;
      if (await copyText(value)) shell.toast({ title: `Copied ${value}`, sub: label, color });
    });
    return button;
  }

  function renderCard() {
    if (!info) return;
    const font = info;
    const preview = h('div', { class: 'pk-preview' }, 'Ag');
    preview.style.fontFamily = font.stack;
    preview.style.fontWeight = String(font.weight);
    preview.style.fontStyle = font.style;
    const specimen = h('div', { class: 'pk-specimen' }, preview);

    // A log scale keeps the small end legible without losing the display-size end.
    const size = Math.min(SCALE_MAX, Math.max(SCALE_MIN, font.size));
    const position = (Math.log(size / SCALE_MIN) / Math.log(SCALE_MAX / SCALE_MIN)) * 100;
    const marker = h('span', { class: 'pk-ruler-marker' });
    marker.style.left = `${position.toFixed(2)}%`;
    const ruler = h(
      'div',
      { class: 'pk-ruler', role: 'img', 'aria-label': `Type scale, ${font.size}px detected` },
      h('span', { class: 'pk-ruler-track' }),
      h(
        'div',
        { class: 'pk-ruler-ticks' },
        ...SCALE_TICKS.map((tick) => h('span', { class: 'pk-ruler-tick' }, String(tick))),
      ),
      marker,
    );

    const rows = h(
      'div',
      { class: 'pk-rows' },
      row('Size', `${font.size}px`),
      row('Weight', `${font.weight} · ${weightName(font.weight)}`),
      row('Line height', lineHeightLabel(font)),
      row('Letter spacing', font.letterSpacing === 'normal' ? 'Normal' : font.letterSpacing),
      font.style !== 'normal' ? row('Style', font.style) : null,
      row('Colour', font.color, font.color),
    );

    const children: (Node | null)[] = [
      h(
        'div',
        { class: 'pk-card-head' },
        specimen,
        h(
          'div',
          { class: 'pk-card-title' },
          h(
            'div',
            { class: 'pk-family' },
            h('span', { class: 'pk-family-name' }, font.family),
            font.certain ? null : h('span', { class: 'pk-badge', title: 'Best guess based on fonts installed on this device' }, 'Likely'),
          ),
          h('div', { class: 'pk-source' }, font.sourceLabel),
        ),
      ),
      ruler,
      rows,
      h('div', { class: 'pk-stack', title: font.stack }, font.stack),
    ];

    if (pinned) {
      children.unshift(h('div', { class: 'pk-accent-line', 'aria-hidden': 'true' }));
      const copyCss = h('button', { class: 'pk-btn pk-btn-primary', type: 'button' }, 'Copy CSS');
      copyCss.addEventListener('click', async () => {
        if (await copyText(fontCss(font))) shell.toast({ title: 'Copied font CSS', sub: font.family });
      });
      const save = h('button', { class: 'pk-btn', type: 'button' }, 'Save font');
      save.addEventListener('click', async () => {
        await saveFont(font);
        shell.toast({ title: 'Saved to your fonts', sub: font.family });
      });
      const actions = h('div', { class: 'pk-actions' }, copyCss, save);
      if (font.link) {
        const link = h('button', { class: 'pk-btn', type: 'button' }, 'Google Fonts ↗');
        link.addEventListener('click', () => window.open(font.link, '_blank', 'noopener'));
        actions.append(link);
      }
      children.push(actions);
    } else {
      children.push(h('div', { class: 'pk-card-foot' }, 'Click to pin, then copy any value'));
    }

    card.replaceChildren(...children.filter((c): c is Node => c !== null));
    card.toggleAttribute('data-pinned', pinned);
  }

  function place() {
    if (!current || !current.isConnected) {
      box.removeAttribute('data-on');
      card.removeAttribute('data-on');
      return;
    }
    const rect = current.getBoundingClientRect();
    box.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    box.setAttribute('data-on', '');

    const height = card.offsetHeight;
    let top = rect.bottom + GAP;
    if (top + height + EDGE > window.innerHeight) top = rect.top - GAP - height;
    top = Math.min(window.innerHeight - height - EDGE, Math.max(EDGE, top));
    const left = Math.min(window.innerWidth - CARD_WIDTH - EDGE, Math.max(EDGE, rect.left));
    card.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    card.setAttribute('data-on', '');
  }

  function inspect(el: Element) {
    current = el;
    info = inspectElement(el);
    renderCard();
    place();
  }

  function setPinned(next: boolean) {
    pinned = next;
    renderCard();
    place();
    if (pinned && info) void addFont(info);
  }

  const onMove = (e: MouseEvent) => {
    if (pinned || fromOverlay(e)) return;
    const target = e.composedPath()[0];
    if (!(target instanceof Element) || target === current) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => inspect(target));
  };

  const onClick = (e: MouseEvent) => {
    if (fromOverlay(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (pinned) {
      setPinned(false);
      return;
    }
    const target = e.composedPath()[0];
    if (target instanceof Element) inspect(target);
    if (info) setPinned(true);
  };

  const block = (e: Event) => {
    if (fromOverlay(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (pinned) setPinned(false);
    else stop();
  };

  const onViewportChange = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(place);
  };

  window.addEventListener('mousemove', onMove, true);
  window.addEventListener('click', onClick, true);
  for (const type of BLOCKED_EVENTS) window.addEventListener(type, block, true);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('scroll', onViewportChange, { capture: true, passive: true });
  window.addEventListener('resize', onViewportChange);

  function stop() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    window.removeEventListener('mousemove', onMove, true);
    window.removeEventListener('click', onClick, true);
    for (const type of BLOCKED_EVENTS) window.removeEventListener(type, block, true);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', onViewportChange, true);
    window.removeEventListener('resize', onViewportChange);
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((sheet) => sheet !== cursorSheet);
    ui.remove();
    shell.release();
    onDone();
  }

  return stop;
}

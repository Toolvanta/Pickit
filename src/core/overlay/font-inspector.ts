// Font inspector: hover any element to see the font rendering it; click to pin the
// card and copy values. Page clicks are swallowed while it is active so inspecting a
// link or button does not trigger it.

import { fontCss, inspectElement, lineHeightLabel, resetFontCaches, weightName, type FontInfo } from '../fonts';
import { t } from '../i18n';
import { COLOR_FORMATS, formatColor, nearestColorName, parseColor, rgbToHex, type ColorFormat } from '../color';
import { addFont, saveFont, type Settings } from '../storage';
import { copyText, h, hintBar, swatch, type Shell } from './shell';

const CARD_WIDTH = 280;
const GAP = 10;
const EDGE = 8;
const SVG = 'http://www.w3.org/2000/svg';

/** A small stroke icon. Built with DOM calls, never innerHTML, so page CSP cannot object. */
function icon(paths: string[]): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'pk-icon');
  for (const d of paths) {
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}
const ICON_CLOSE = ['M18 6L6 18', 'M6 6l12 12'];
const ICON_EXTERNAL = ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5'];
const ICON_BOOKMARK = ['M6 4h12v16l-6-4-6 4z'];
const BLOCKED_EVENTS = ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick', 'auxclick', 'contextmenu'];

/** Starts the font inspector. Returns a function that stops it. */
const FORMAT_LABELS: Record<ColorFormat, string> = { hex: 'HEX', rgb: 'RGB', hsl: 'HSL', oklch: 'OKLCH' };

export function startFontInspector(shell: Shell, settings: Settings, onDone: () => void): () => void {
  resetFontCaches();
  const box = h('div', { class: 'pk-box' });
  const card = h('div', { class: 'pk-card', role: 'dialog', 'aria-label': t('overlay_font_card_label') });
  const hint = hintBar([
    [t('overlay_font_key_hover'), t('overlay_font_hint_inspect')],
    [t('overlay_font_key_click'), t('overlay_font_hint_pin_copy')],
    ['Esc', t('overlay_font_hint_exit')],
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

  /** One value in the grid. Pinned, a click copies it. */
  function cell(label: string, value: string, color?: string): HTMLButtonElement {
    const button = h(
      'button',
      { class: 'pk-cell', type: 'button', tabindex: pinned ? '0' : '-1', title: pinned ? t('overlay_font_toast_copied', value) : undefined },
      h('span', { class: 'pk-cell-label' }, label),
      h('span', { class: 'pk-cell-value' }, color ? swatch(color) : null, value),
    );
    button.addEventListener('click', async () => {
      if (!pinned) return;
      if (await copyText(value)) shell.toast({ title: t('overlay_font_toast_copied', value), sub: label, color });
    });
    return button;
  }

  /** The text colour in every format, the user's default first. Each line copies when pinned. */
  function colourBlock(value: string): HTMLElement {
    const label = t('overlay_font_row_colour');
    const rgb = parseColor(value);
    if (!rgb) return h('div', { class: 'pk-grid pk-grid-single' }, cell(label, value, value));
    const hex = rgbToHex(rgb);
    const order = [settings.format, ...COLOR_FORMATS.filter((f) => f !== settings.format)];
    const line = (format: ColorFormat) => {
      const text = formatColor(rgb, format, { upperHex: settings.upperHex });
      const button = h(
        'button',
        { class: 'pk-format', type: 'button', tabindex: pinned ? '0' : '-1', title: pinned ? t('overlay_font_toast_copied', text) : undefined },
        h('span', { class: 'pk-format-label' }, FORMAT_LABELS[format]),
        h('span', { class: 'pk-format-value' }, text),
      );
      button.addEventListener('click', async () => {
        if (!pinned) return;
        if (await copyText(text)) shell.toast({ title: t('overlay_font_toast_copied', text), sub: label, color: hex });
      });
      return button;
    };
    return h(
      'div',
      { class: 'pk-colour' },
      h('div', { class: 'pk-colour-head' }, swatch(hex), h('span', { class: 'pk-cell-label' }, label), h('span', { class: 'pk-colour-name' }, nearestColorName(rgb))),
      h('div', { class: 'pk-formats' }, ...order.map(line)),
    );
  }

  function renderCard() {
    if (!info) return;
    const font = info;

    const sample = h('div', { class: 'pk-sample', 'aria-hidden': 'true' }, 'Ag');
    sample.style.fontFamily = font.stack;
    sample.style.fontWeight = String(font.weight);
    sample.style.fontStyle = font.style;

    const close = h('button', { class: 'pk-close', type: 'button', 'aria-label': t('overlay_font_close'), title: t('overlay_font_close') });
    close.append(icon(ICON_CLOSE));
    close.addEventListener('click', () => stop());

    const head = h(
      'div',
      { class: 'pk-card-head' },
      sample,
      h(
        'div',
        { class: 'pk-card-title' },
        h(
          'div',
          { class: 'pk-family' },
          h('span', { class: 'pk-family-name', title: font.family }, font.family),
          font.certain ? null : h('span', { class: 'pk-badge', title: t('overlay_font_likely_tooltip') }, t('overlay_font_likely')),
        ),
        h('div', { class: 'pk-source' }, font.sourceLabel),
      ),
      close,
    );

    const grid = h(
      'div',
      { class: 'pk-grid' },
      cell(t('overlay_font_row_size'), `${font.size}px`),
      cell(t('overlay_font_row_weight'), `${font.weight} · ${weightName(font.weight)}`),
      cell(t('overlay_font_row_line_height'), lineHeightLabel(font)),
      cell(t('overlay_font_row_letter_spacing'), font.letterSpacing === 'normal' ? t('font_letter_spacing_normal') : font.letterSpacing),
      font.style !== 'normal' ? cell(t('overlay_font_row_style'), font.style) : null,
    );

    const children: (Node | null)[] = [head, grid, colourBlock(font.color), h('div', { class: 'pk-stack', title: font.stack }, font.stack)];

    if (pinned) {
      const copyCss = h('button', { class: 'pk-btn pk-btn-primary', type: 'button' }, t('overlay_font_copy_css'));
      copyCss.addEventListener('click', async () => {
        if (await copyText(fontCss(font))) shell.toast({ title: t('overlay_font_toast_copied_css'), sub: font.family });
      });
      const saveButton = h('button', { class: 'pk-btn', type: 'button' }, icon(ICON_BOOKMARK), t('overlay_font_save'));
      saveButton.addEventListener('click', async () => {
        await saveFont(font);
        shell.toast({ title: t('overlay_font_toast_saved'), sub: font.family });
      });
      const actions = h('div', { class: 'pk-actions' }, copyCss, saveButton);
      if (font.link) {
        const link = h('button', {
          class: 'pk-btn pk-btn-icon',
          type: 'button',
          'aria-label': t('overlay_font_open_google_fonts'),
          title: t('overlay_font_open_google_fonts'),
        });
        link.append(icon(ICON_EXTERNAL));
        link.addEventListener('click', () => window.open(font.link, '_blank', 'noopener'));
        actions.append(link);
      }
      children.push(actions);
    } else {
      children.push(h('div', { class: 'pk-card-foot' }, t('overlay_font_footer')));
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

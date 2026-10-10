// The HUD panel of the settings window: a title, then one row for each HUD setting with a label, a slider
// in the game's slider style, and the value as a number, and a last row with the Sharp UI switch.
import tokensCss from '../tokens.css?inline';
import pageCss from '../page.css?inline';
import { frameWindow, hs, SETTINGS_PAGE } from './core';
import { applyHud } from './scale';
import type { SettingKey } from './types';

const SETTINGS: SettingKey[] = ['zoom', 'text'];
const STEP = 0.05;
const PREVIEW_DELAY_MS = 120;

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className?: string | null, text?: string | null): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

function buildPanel(doc: Document): HTMLElement {
  const panel = el(doc, 'div', 'settings-section');
  panel.id = 'hudscale-panel';
  panel.appendChild(el(doc, 'div', 'key-group-title hudscale-title'));
  for (const key of SETTINGS) {
    const row = el(doc, 'div', 'setting-row');
    row.setAttribute('data-hudscale', key);
    row.appendChild(el(doc, 'div', 'setting-label'));
    const wrapper = el(doc, 'div', 'slider-wrapper');
    const input = el(doc, 'input');
    input.type = 'range';
    input.step = String(STEP);
    wrapper.appendChild(input);
    wrapper.appendChild(el(doc, 'div', 'hudscale-mark'));
    row.appendChild(wrapper);
    const number = el(doc, 'span', 'hudscale-value');
    row.appendChild(number);
    panel.appendChild(row);
    wireRow(doc, key, input, number);
  }
  panel.appendChild(buildSharpRow(doc));
  return panel;
}

// The Sharp UI row: a label and the markup of the game's own switches, so the switch takes their style
// with no CSS of the mod. A turn sends the value to C#, which saves it and sends the install call back.
function buildSharpRow(doc: Document): HTMLElement {
  const row = el(doc, 'div', 'setting-row');
  row.setAttribute('data-hudscale', 'sharp');
  row.appendChild(el(doc, 'div', 'setting-label'));
  const toggle = el(doc, 'label', 'setting-toggle');
  const input = el(doc, 'input');
  input.type = 'checkbox';
  toggle.appendChild(input);
  toggle.appendChild(el(doc, 'span', 'track'));
  toggle.appendChild(el(doc, 'span', 'knob'));
  row.appendChild(toggle);
  input.addEventListener('change', () => {
    if (!isOpen(doc)) return;
    hs.state!.sharp = input.checked;
    send('HUDSCALE_SHARP', input.checked ? '1' : '0');
  });
  return row;
}

// A closed settings window is only transparent, so a drag can go on after Escape. The panel acts only
// while the window is open.
function isOpen(doc: Document): boolean {
  const modal = doc.getElementById('settingsModal');
  return !!modal && modal.classList.contains('active');
}

// While the player drags, the number follows at once and the HUD follows after a short stop. A release
// applies at once and saves. A click on the number goes back to the default.
function wireRow(doc: Document, key: SettingKey, input: HTMLInputElement, number: HTMLElement): void {
  const win = doc.defaultView as Window;
  // While the player holds a slider, an install from C# must not move it.
  input.addEventListener('pointerdown', () => { hs.dragging = true; });
  input.addEventListener('pointerup', () => { hs.dragging = false; });
  input.addEventListener('input', () => {
    if (!isOpen(doc)) return;
    const value = parseFloat(input.value);
    number.textContent = value.toFixed(2);
    if (typeof win.updateSlider === 'function') win.updateSlider(input);
    clearTimeout(hs.previewTimer);
    hs.pending = { key, value };
    hs.previewTimer = setTimeout(preview, PREVIEW_DELAY_MS);
  });
  input.addEventListener('change', () => {
    hs.dragging = false;
    if (!isOpen(doc)) return;
    commit(key, parseFloat(input.value));
  });
  number.addEventListener('click', () => {
    if (!isOpen(doc)) return;
    const s = hs.state![key];
    input.value = String(s.def);
    number.textContent = s.def.toFixed(2);
    if (typeof win.updateSlider === 'function') win.updateSlider(input);
    commit(key, s.def);
  });
}

// Shows the dragged value on the HUD without a save. It is then unsaved until a release or a close.
function preview(): void {
  clearTimeout(hs.previewTimer);
  if (!hs.pending) return;
  hs.state![hs.pending.key].value = hs.pending.value;
  hs.unsaved = hs.pending.key;
  hs.pending = null;
  applyHud();
}

// Applies a value at once and saves it.
function commit(key: SettingKey, value: number): void {
  hs.pending = null;
  hs.state![key].value = value;
  hs.unsaved = key;
  flush();
}

// Applies a dragged or previewed value that is not saved yet, and sends both values to C#, which saves
// them in the config file.
function flush(): void {
  preview();
  if (!hs.unsaved) return;
  hs.unsaved = null;
  applyHud();
  send('HUDSCALE_SET', hs.state!.zoom.value + ',' + hs.state!.text.value);
}

// Each way to open or close the settings window (a click, Escape, or C#) changes the class "active" of
// #settingsModal. An open asks C# to check the config file and send the current state. A close saves the
// value that the HUD shows. The mark sits on the document, so a new document of the page gets its own
// observer.
function watchModal(doc: Document, modal: HTMLElement): void {
  if (doc.__hudscaleModalObserver) return;
  const win = doc.defaultView as Window & typeof globalThis;
  doc.__hudscaleModalObserver = new win.MutationObserver((mutations) => {
    const wasOpen = /(^|\s)active(\s|$)/.test(mutations[0].oldValue || '');
    const open = modal.classList.contains('active');
    if (open === wasOpen) return;
    if (open) {
      send('HUDSCALE_SYNC', '');
    } else {
      hs.dragging = false;
      flush();
    }
  });
  doc.__hudscaleModalObserver.observe(modal, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
}

// A message to C# in the type-3 format of Root.html: four fields joined by U+001E.
function send(name: string, data: string): void {
  if (window.vuplex) window.vuplex.postMessage(['3', SETTINGS_PAGE, name, data].join('\u001E'));
}

// Writes the labels and the state of each setting into the panel. The number shows the stored value,
// which can be off the step grid (1.03), while the browser snaps the thumb to the grid.
function showState(win: Window, panel: HTMLElement): void {
  const state = hs.state!;
  const labels = state.labels || {};
  (panel.querySelector('.hudscale-title') as HTMLElement).textContent = labels.title || '';
  for (const key of SETTINGS) {
    const s = state[key];
    const row = panel.querySelector('[data-hudscale="' + key + '"]') as HTMLElement;
    (row.querySelector('.setting-label') as HTMLElement).textContent = labels[key] || '';
    if (hs.dragging) continue;
    const input = row.querySelector('input') as HTMLInputElement;
    input.min = String(s.min);
    input.max = String(s.max);
    input.value = String(s.value);
    (row.querySelector('.hudscale-value') as HTMLElement).textContent = s.value.toFixed(2);
    // The place of the default mark along the track, which the mark rule of page.css reads.
    (row.querySelector('.hudscale-mark') as HTMLElement).style.setProperty('--hs-mark', String((s.def - s.min) / (s.max - s.min)));
    if (typeof win.updateSlider === 'function') win.updateSlider(input);
  }
  const sharp = panel.querySelector('[data-hudscale="sharp"]') as HTMLElement;
  (sharp.querySelector('.setting-label') as HTMLElement).textContent = labels.sharp || '';
  (sharp.querySelector('input') as HTMLInputElement).checked = !!state.sharp;
}

// Adds the panel to the settings window, or updates it when it is there. The window has two tabs,
// General and Controls, each a .set-page that Vue shows and hides with v-show. The General tab holds the
// Sound, graphics, and Interface panels (.settings-section), and the game finds its sliders by id. The
// HUD panel is a panel of its own after the Interface panel, the panel of the Action Feedback setting
// (#actionEchoCheck), so it hides and shows with the General tab. Vue patches only the dynamic nodes of
// the tab, so a re-render of the window keeps the panel.
export function panel(): string {
  try {
    const win = frameWindow(SETTINGS_PAGE);
    if (!win) return 'no frame';
    if (!hs.state) return 'no state';
    const doc = win.document;
    const modal = doc.getElementById('settingsModal');
    if (!modal) return 'error: no #settingsModal';
    watchModal(doc, modal);
    let node = doc.getElementById('hudscale-panel');
    if (!node) {
      const anchor = modal.querySelector('#actionEchoCheck');
      if (!anchor) return 'error: no #actionEchoCheck in #settingsModal';
      const section = anchor.closest('.settings-section');
      if (!section) return 'error: no .settings-section around #actionEchoCheck';
      if (!doc.getElementById('hudscale-style')) {
        const style = el(doc, 'style', null, tokensCss + '\n' + pageCss);
        style.id = 'hudscale-style';
        doc.head.appendChild(style);
      }
      node = buildPanel(doc);
      section.after(node);
      hs.dragging = false;
    }
    showState(win, node);
    return 'applied';
  } catch (e) {
    return 'error: ' + (e && (e as Error).message);
  }
}

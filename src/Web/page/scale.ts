// The HUD scale and the text scale of a HUD page: the inline zoom of CoreUI1, and the font sizes of the
// style sheets of the page.
import { frameWindow, hs, HUD_PAGES } from './core';
import type { FrameWindow, Originals, SettingKey } from './types';

// The factor of a setting, or null when the setting has the game's value.
export function factor(key: SettingKey): number | null {
  const s = hs.state && hs.state[key];
  return !s || s.value === s.game ? null : s.value;
}

// The inline zoom overrides the page's own "body { zoom: 1.3 }". CoreUI1 watches the attributes of
// body and measures its click areas again, so the write happens only when the value differs.
function setZoom(win: FrameWindow, zoom: number | string): void {
  const style = win.document.body.style;
  if (String(style.zoom) !== String(zoom)) style.zoom = String(zoom);
}

// Multiplies each px font size of the page's style sheets by the text scale. The original size of each
// rule is kept on the page window, so a second run scales from the original again.
function scaleText(win: FrameWindow, textScale: number): void {
  const originals = win.__hudscaleOriginals || (win.__hudscaleOriginals = new WeakMap());
  const sheets = win.document.styleSheets;
  for (let i = 0; i < sheets.length; i++) scaleSheet(sheets[i], textScale, originals);
}

// A cross-origin sheet throws on cssRules. It has no HUD rule, so it is skipped.
function scaleSheet(sheet: CSSStyleSheet, textScale: number, originals: Originals): void {
  let rules: CSSRuleList;
  try { rules = sheet.cssRules; } catch { return; }
  scaleRules(rules, textScale, originals);
}

function scaleRules(rules: CSSRuleList, textScale: number, originals: Originals): void {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const nested = (rule as CSSGroupingRule).cssRules;
    if (nested) scaleRules(nested, textScale, originals);
    const style = (rule as CSSStyleRule).style;
    if (!style) continue;
    let original = originals.get(rule);
    if (original === undefined) {
      const found = readOriginals(style);
      if (!found) continue;
      original = found;
      originals.set(rule, original);
    }
    for (const property in original) {
      const text = original[property];
      const scaled = property === 'font-size'
        ? round2(parseFloat(text) * textScale) + 'px'
        : round4(parseFloat(text) / textScale) + 'em';
      style.setProperty(property, textScale === 1 ? text : scaled);
    }
  }
}

// An icon or a box sized in em gets its em from a font size that the text scale multiplies. These
// sizes are divided by the same factor, so the icons and the boxes keep their size.
const EM_SIZES = ['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height'];

// The properties of a rule that the text scale changes, as { property: text }, or null when the rule
// has none. Each original is kept as its text, so a factor of 1 writes back the exact text of the game
// style sheet (for example "28.0px", not "28px").
function readOriginals(style: CSSStyleDeclaration): Record<string, string> | null {
  let found: Record<string, string> | null = null;
  const fontSize = style.getPropertyValue('font-size');
  if (/^[\d.]+px$/.test(fontSize)) found = { 'font-size': fontSize };
  for (const property of EM_SIZES) {
    const size = style.getPropertyValue(property);
    if (/^[\d.]+em$/.test(size)) (found || (found = {}))[property] = size;
  }
  return found;
}

// Other mods add their <style> to the head after the page loads. One observer for each page scales each
// new sheet with the factor that is current then. The mark sits on the document, not the window: a
// frame's window can outlive its initial about:blank document.
function watchHead(win: FrameWindow): void {
  const doc = win.document;
  if (doc.__hudscaleObserver) return;
  doc.__hudscaleObserver = new win.MutationObserver((mutations) => {
    const textScale = factor('text');
    if (textScale == null) return;
    for (const mutation of mutations) {
      const added = mutation.addedNodes;
      for (let j = 0; j < added.length; j++) {
        const sheet = (added[j] as HTMLStyleElement).sheet;
        if (added[j].nodeName === 'STYLE' && sheet) scaleSheet(sheet, textScale, win.__hudscaleOriginals as Originals);
      }
    }
  });
  doc.__hudscaleObserver.observe(doc.head, { childList: true });
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

// Applies the factors to one HUD page. At the game's value, a page that the mod changed before goes back
// to the game's style: the inline zoom is removed, and each font size is scaled by 1, which writes back
// its original. A page that the mod never changed is left alone.
export function apply(pageId: string): string {
  try {
    const win = frameWindow(pageId);
    if (!win) return 'no frame';
    const zoom = factor('zoom');
    if (pageId === 'CoreUI1') {
      if (zoom != null) {
        setZoom(win, zoom);
        win.document.__hudscaleZoomed = true;
      } else if (win.document.__hudscaleZoomed) {
        setZoom(win, '');
        win.document.__hudscaleZoomed = false;
      }
    }
    let textScale = factor('text');
    if (textScale == null && win.__hudscaleOriginals) textScale = 1;
    if (textScale != null) {
      scaleText(win, textScale);
      watchHead(win);
      // A CSSOM change is not a DOM mutation, so CoreUI1 would keep its old click areas until the next
      // DOM change. A resize makes it measure them again.
      win.dispatchEvent(new win.Event('resize'));
    }
    return 'applied';
  } catch (e) {
    return 'error: ' + (e && (e as Error).message);
  }
}

export function applyHud(): void {
  for (const pageId of HUD_PAGES) apply(pageId);
}

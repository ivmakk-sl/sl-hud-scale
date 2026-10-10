// The install call of C#: it stores the state, applies it to each HUD page and to the settings panel
// that exist now, and wraps notifyPageReady of the root page for the pages that come later.
import { hs, HUD_PAGES, SETTINGS_PAGE } from './core';
import { panel } from './panel';
import { apply } from './scale';
import type { PageState } from './types';

// A page calls window.parent.notifyPageReady(pageId) when it is mounted, and the root function makes the
// frame visible. The wrapper applies the factors first, so a HUD page never shows at the vanilla size.
function wrapNotifyPageReady(): void {
  const original = window.notifyPageReady;
  if (hs.wrapped || typeof original !== 'function') return;
  window.notifyPageReady = function (this: unknown, ...args: [string]) {
    const pageId = args[0];
    if (HUD_PAGES.indexOf(pageId) >= 0) apply(pageId);
    else if (pageId === SETTINGS_PAGE) panel();
    return original.apply(this, args);
  };
  hs.wrapped = true;
}

// A page that does not exist yet is normal: the wrapper applies to it when it is ready. The first page
// error is the result.
export function install(state: PageState): string {
  try {
    // A value that the HUD shows but that is not saved yet stays, so a close saves what the player sees.
    if (hs.unsaved && hs.state) state[hs.unsaved].value = hs.state[hs.unsaved].value;
    hs.state = state;
    wrapNotifyPageReady();
    for (const pageId of HUD_PAGES.concat([SETTINGS_PAGE])) {
      const status = pageId === SETTINGS_PAGE ? panel() : apply(pageId);
      if (status.indexOf('error: ') === 0) return 'error: ' + pageId + ': ' + status.substring(7);
    }
    return 'installed';
  } catch (e) {
    return 'error: ' + (e && (e as Error).message);
  }
}

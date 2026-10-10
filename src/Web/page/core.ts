// The shared state of the page script, the page ids, and the frame lookup.
import type { FrameWindow, HudScaleData } from './types';

// main.ts makes this object window.__hudscale, so each module and a later call of C# reach the same state.
export const hs: HudScaleData = { state: null };

export const HUD_PAGES = ['CoreUI1', 'CoreUI0'];

// The pause window. Its settings window (#settingsModal) gets the HUD panel.
export const SETTINGS_PAGE = 'OutSetting';

// The window of the frame whose id is the page id, looked up fresh on each call, or null when the frame
// or its document is not there.
export function frameWindow(pageId: string): FrameWindow | null {
  const frame = document.getElementById(pageId) as HTMLIFrameElement | null;
  const win = frame && frame.contentWindow;
  return win && win.document ? (win as FrameWindow) : null;
}

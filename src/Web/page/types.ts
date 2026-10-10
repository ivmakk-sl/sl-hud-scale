// The data that the page script reads: the state that C# sends, and the marks that the script keeps on
// the windows and the documents of the game pages.

// One setting as C# sends it (HudScaleLogic.BuildCall): the current value, the limits and the default
// of the config entry, and the game's own value. A value equal to its game value means "leave the page
// as the game has it".
export interface SettingState {
  value: number;
  min: number;
  max: number;
  def: number;
  game: number;
}

export type SettingKey = 'zoom' | 'text';

// The panel labels in the display language.
export interface PanelLabels {
  title?: string;
  zoom?: string;
  text?: string;
  sharp?: string;
}

// The state of the install call.
export interface PageState {
  zoom: SettingState;
  text: SettingState;
  // The value of Sharp UI.
  sharp?: boolean;
  labels?: PanelLabels;
}

// The window of a game page frame, with the constructors of its own realm (MutationObserver, Event).
export type FrameWindow = Window & typeof globalThis;

// The original text of each property of a rule that the text scale changes.
export type Originals = WeakMap<CSSRule, Record<string, string>>;

// The state of the script: the state that C# sends, and the state of a drag on the HUD panel.
export interface HudScaleData {
  state: PageState | null;
  // True while the player holds a slider, so an install from C# does not move it.
  dragging?: boolean;
  // A dragged value that waits for the preview delay.
  pending?: { key: SettingKey; value: number } | null;
  // The setting whose value the HUD shows but the config file does not have yet.
  unsaved?: SettingKey | null;
  previewTimer?: ReturnType<typeof setTimeout>;
  // True when notifyPageReady of the root page is wrapped.
  wrapped?: boolean;
}

// The interface of the page script in the root page.
export interface HudScaleApi extends HudScaleData {
  install(state: PageState): string;
  apply(pageId: string): string;
  panel(): string;
}

declare global {
  interface Window {
    __hudscale?: HudScaleApi;
    // The original font sizes and em sizes of the rules of a HUD page.
    __hudscaleOriginals?: Originals;
    // The function of Root.html that a page calls when it is mounted.
    notifyPageReady?: (pageId: string) => unknown;
    vuplex?: { postMessage(message: string): void };
    // The function of OutSetting.html that paints the filled part of a slider track.
    updateSlider?: (input: HTMLInputElement) => void;
  }

  interface Document {
    // The observer of the head of a HUD page, which scales each new style sheet.
    __hudscaleObserver?: MutationObserver;
    // The observer of the settings window.
    __hudscaleModalObserver?: MutationObserver;
    // True while the mod set the inline zoom of CoreUI1.
    __hudscaleZoomed?: boolean;
  }
}

// The root page of the dev harness: defines notifyPageReady as Root.html does, loads the page script,
// and installs a fake state, as the plugin does at the root-ready message. When the settings window is
// ready, it opens the window, so the HUD panel shows.
import '../../src/Web/page/main';
import type { PageState } from '../../src/Web/page/types';

const state: PageState = {
  zoom: { value: 1.1, min: 0.5, max: 3, def: 1, game: 1.3 },
  text: { value: 0.9, min: 0.5, max: 2, def: 1, game: 1 },
  sharp: true,
  labels: { title: 'HUD', zoom: 'Scale', text: 'Text Scale', sharp: 'Sharp UI' },
};

window.notifyPageReady = (pageId) => {
  if (pageId !== 'OutSetting') return;
  const frame = document.getElementById('OutSetting') as HTMLIFrameElement;
  frame.contentDocument!.getElementById('settingsModal')!.classList.add('active');
};

// The messages that the panel sends to C#.
window.vuplex = { postMessage: (message) => console.log('to C#:', message.split('\u001E').join(' | ')) };

console.log('HUD Scale install:', window.__hudscale!.install(state));

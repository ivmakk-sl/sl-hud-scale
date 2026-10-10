// HUD Scale page script. It runs in the root page (Root.html) and reaches each HUD page and the settings
// window through the iframe whose id is the page id. C# calls window.__hudscale.install(state) with the
// state of both settings and the panel labels: at the root-ready message, at each ready message of a HUD
// page or of the settings window, at each settings window open, and after each change of a setting. C#
// sends the full script only when the root page does not have it, and a second full send keeps the first
// interface and its state.
import { hs } from './core';
import { install } from './install';
import { panel } from './panel';
import { apply } from './scale';

window.__hudscale = window.__hudscale || Object.assign(hs, { install, apply, panel });

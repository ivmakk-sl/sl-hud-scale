// Runs page.js against the game's own CoreUI1.html, CoreUI0.html, and OutSetting.html, so a game
// update that changes how the HUD sets its font sizes, or how the settings window is built, shows up
// here instead of only in the game.
//
// page.js runs in the root page (Root.html) and reaches each HUD page through the iframe whose id is
// the page id. This test loads each HUD page in its own jsdom window and gives a small root window a
// getElementById that returns { contentWindow } for those ids.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const GAME_DIR = process.env.SL_GAME_DIR ||
  'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Survival Log';
const UI_DIR = path.join(GAME_DIR, 'SurvivalLog_Data', 'StreamingAssets', 'WebUI', 'UI');
const PAGES = {
  CoreUI1: path.join(UI_DIR, 'CoreUI1', 'CoreUI1.html'),
  CoreUI0: path.join(UI_DIR, 'CoreUI0', 'CoreUI0.html')
};
const PAGE_JS_PATH = path.join(__dirname, '..', '..', 'src', 'page.js');

// The pause window with the settings window, which gets the HUD panel. It is not a HUD page.
const OUT_SETTING = path.join(UI_DIR, 'OutSetting', 'OutSetting.html');
const PAGE_FILES = { ...PAGES, OutSetting: OUT_SETTING };

// The tests skip only when the game is not installed. When the game is there but a page file is
// missing (for example after a game update), each test of that page fails.
const gameFilesExist = fs.existsSync(UI_DIR);

if (!gameFilesExist) {
  test('page.js against the HUD pages', { skip: `game files not found under SL_GAME_DIR (${GAME_DIR}); set SL_GAME_DIR to the game folder` }, () => {});
} else {
  const pageJs = fs.readFileSync(PAGE_JS_PATH, 'utf8');

  // The HUD pages start their own requestAnimationFrame loops, which keep a jsdom window alive.
  // t.after closes each window when its test is done.
  async function loadPage(t, pageId) {
    const file = PAGE_FILES[pageId];
    const dom = new JSDOM(fs.readFileSync(file, 'utf8'), {
      url: url.pathToFileURL(file).href,
      runScripts: 'dangerously',
      resources: 'usable',
      pretendToBeVisual: true
    });
    t.after(() => dom.window.close());
    await new Promise((resolve, reject) => {
      dom.window.addEventListener('load', resolve);
      setTimeout(() => reject(new Error(`${pageId}.html did not fire load within 5s`)), 5000);
    });
    return dom.window;
  }

  // A blank window that stands in for Root.html. frames maps a page id to the window of its iframe.
  function makeRoot(t, frames) {
    const root = new JSDOM('<!doctype html><html><body></body></html>', {
      url: 'file:///Root.html',
      pretendToBeVisual: true
    }).window;
    t.after(() => root.close());
    const originalGetById = root.document.getElementById.bind(root.document);
    root.document.getElementById = (id) =>
      frames[id] ? { id, contentWindow: frames[id] } : originalGetById(id);
    vm.createContext(root);
    return root;
  }

  // vm.runInContext (not root.eval) so the bare "window" of page.js is the root window, as in a browser.
  function run(root, expr) {
    return vm.runInContext(pageJs + ';' + expr, root, { filename: 'page.js' });
  }

  // The state object that C# sends in the install call (HudScaleLogic.BuildCall). A value of null
  // stands for the game's value of that setting, which means "leave the page as the game has it".
  function state(zoom, textScale) {
    const z = zoom == null ? 1.3 : zoom;
    const x = textScale == null ? 1 : textScale;
    return `{zoom:{value:${z},min:0.5,max:3,def:1,game:1.3},text:{value:${x},min:0.5,max:2,def:1,game:1},` +
      'labels:{title:"HUD",zoom:"Scale",text:"Text Scale"}}';
  }

  function installCall(zoom, textScale) {
    return `window.__hudscale.install(${state(zoom, textScale)})`;
  }

  // Sets the state that install() stores, for the tests of apply() alone.
  function setFactors(root, zoom, textScale) {
    run(root, `window.__hudscale.state = ${state(zoom, textScale)};`);
  }

  // Each style rule with a px font size, as [rule, value], in document order, nested rules included.
  function pxFontRules(win) {
    const out = [];
    const walk = (rules) => {
      for (const rule of rules) {
        if (rule.cssRules) walk(rule.cssRules);
        if (!rule.style) continue;
        const v = rule.style.getPropertyValue('font-size');
        if (/^[\d.]+px$/.test(v)) out.push([rule, v]);
      }
    };
    for (const sheet of win.document.styleSheets) walk(sheet.cssRules);
    return out;
  }

  test('CoreUI1: text scale 0.9 makes a 12px rule 10.8px', async (t) => {
    const win = await loadPage(t, 'CoreUI1');
    const [rule] = pxFontRules(win).find(([, v]) => v === '12px');
    const root = makeRoot(t, { CoreUI1: win });
    setFactors(root, null, 0.9);

    const result = run(root, "window.__hudscale.apply('CoreUI1')");

    assert.equal(result, 'applied');
    assert.equal(rule.style.getPropertyValue('font-size'), '10.8px');
  });

  test('CoreUI1: a second apply scales from the original size, not from the scaled size', async (t) => {
    const win = await loadPage(t, 'CoreUI1');
    const [rule] = pxFontRules(win).find(([, v]) => v === '12px');
    const root = makeRoot(t, { CoreUI1: win });
    setFactors(root, null, 0.9);
    run(root, "window.__hudscale.apply('CoreUI1')");

    run(root, "window.__hudscale.apply('CoreUI1')");
    assert.equal(rule.style.getPropertyValue('font-size'), '10.8px');

    setFactors(root, null, 0.8);
    run(root, "window.__hudscale.apply('CoreUI1')");
    assert.equal(rule.style.getPropertyValue('font-size'), '9.6px');
  });

  test('CoreUI1: a text scale of null changes no rule', async (t) => {
    const win = await loadPage(t, 'CoreUI1');
    const before = pxFontRules(win);
    const root = makeRoot(t, { CoreUI1: win });
    setFactors(root, null, null);

    assert.equal(run(root, "window.__hudscale.apply('CoreUI1')"), 'applied');

    for (const [rule, original] of before) assert.equal(rule.style.getPropertyValue('font-size'), original);
  });

  test('CoreUI1: a sheet that throws on cssRules is skipped, and the other sheets still scale', async (t) => {
    const win = await loadPage(t, 'CoreUI1');
    const [rule] = pxFontRules(win).find(([, v]) => v === '12px');
    // A cross-origin sheet throws a SecurityError on cssRules in a browser. Put one before the game sheet.
    const blocked = win.document.createElement('style');
    win.document.head.insertBefore(blocked, win.document.head.firstChild);
    Object.defineProperty(blocked.sheet, 'cssRules', { get() { throw new Error('SecurityError'); } });
    const root = makeRoot(t, { CoreUI1: win });
    setFactors(root, null, 0.9);

    assert.equal(run(root, "window.__hudscale.apply('CoreUI1')"), 'applied');
    assert.equal(rule.style.getPropertyValue('font-size'), '10.8px');
  });

  test('an unknown page id gives "no frame"', (t) => {
    const root = makeRoot(t, {});
    setFactors(root, null, 0.9);

    assert.equal(run(root, "window.__hudscale.apply('CoreUI1')"), 'no frame');
  });

  // jsdom has no zoom support, so the tests watch the writes to body.style.zoom with a setter spy.
  function spyZoom(win) {
    const writes = [];
    let value = '';
    Object.defineProperty(win.document.body.style, 'zoom', {
      configurable: true,
      get() { return value; },
      set(v) { value = String(v); writes.push(value); }
    });
    return writes;
  }

  test('CoreUI1: zoom 1.1 writes body.style.zoom one time', async (t) => {
    const win = await loadPage(t, 'CoreUI1');
    const writes = spyZoom(win);
    const root = makeRoot(t, { CoreUI1: win });
    setFactors(root, 1.1, null);

    run(root, "window.__hudscale.apply('CoreUI1')");
    run(root, "window.__hudscale.apply('CoreUI1')");

    assert.deepEqual(writes, ['1.1']);
  });

  test('CoreUI0: zoom 1.1 does not write body.style.zoom', async (t) => {
    const win = await loadPage(t, 'CoreUI0');
    const writes = spyZoom(win);
    const root = makeRoot(t, { CoreUI0: win });
    setFactors(root, 1.1, null);

    run(root, "window.__hudscale.apply('CoreUI0')");

    assert.deepEqual(writes, []);
  });

  // Adds a style the way the other mods do: text first, then appendChild on the head. The observer
  // runs as a microtask, so a short wait lets it finish.
  async function addModStyle(win, css) {
    const style = win.document.createElement('style');
    style.textContent = css;
    win.document.head.appendChild(style);
    await new Promise((resolve) => win.setTimeout(resolve, 0));
    return style.sheet.cssRules[0].style.getPropertyValue('font-size');
  }

  test('CoreUI1: a style that a mod adds after apply is scaled', async (t) => {
    const win = await loadPage(t, 'CoreUI1');
    const root = makeRoot(t, { CoreUI1: win });
    setFactors(root, null, 0.9);
    run(root, "window.__hudscale.apply('CoreUI1')");

    assert.equal(await addModStyle(win, '.mod-a { font-size: 10px; }'), '9px');
  });

  test('CoreUI1: a changed factor applies to later styles, with one observer', async (t) => {
    const win = await loadPage(t, 'CoreUI1');
    let observers = 0;
    const NativeObserver = win.MutationObserver;
    win.MutationObserver = class extends NativeObserver {
      constructor(cb) { super(cb); observers++; }
    };
    const root = makeRoot(t, { CoreUI1: win });
    setFactors(root, null, 0.9);
    run(root, "window.__hudscale.apply('CoreUI1')");
    setFactors(root, null, 0.8);
    run(root, "window.__hudscale.apply('CoreUI1')");

    assert.equal(await addModStyle(win, '.mod-b { font-size: 10px; }'), '8px');
    assert.equal(observers, 1);
  });

  function countResize(win) {
    const count = { n: 0 };
    win.addEventListener('resize', () => { count.n++; });
    return count;
  }

  test('CoreUI1: a text scale fires resize on the page, so its click areas are measured again', async (t) => {
    const win = await loadPage(t, 'CoreUI1');
    const resize = countResize(win);
    const root = makeRoot(t, { CoreUI1: win });
    setFactors(root, null, 0.9);

    run(root, "window.__hudscale.apply('CoreUI1')");

    assert.equal(resize.n, 1);
  });

  test('CoreUI1: no text scale fires no resize', async (t) => {
    const win = await loadPage(t, 'CoreUI1');
    const resize = countResize(win);
    const root = makeRoot(t, { CoreUI1: win });
    setFactors(root, 1.1, null);

    run(root, "window.__hudscale.apply('CoreUI1')");

    assert.equal(resize.n, 0);
  });

  function fontOf12pxRule(win) {
    return pxFontRules(win).find(([, v]) => v === '12px')[0];
  }

  test('install scales each HUD frame that exists and returns "installed"', async (t) => {
    const core1 = await loadPage(t, 'CoreUI1');
    const core0 = await loadPage(t, 'CoreUI0');
    const [rule0, original0] = pxFontRules(core0)[0];
    const rule1 = fontOf12pxRule(core1);
    const root = makeRoot(t, { CoreUI1: core1, CoreUI0: core0 });

    assert.equal(run(root, installCall(null, 0.9)), 'installed');

    assert.equal(rule1.style.getPropertyValue('font-size'), '10.8px');
    assert.equal(rule0.style.getPropertyValue('font-size'), Math.round(parseFloat(original0) * 90) / 100 + 'px');
  });

  // Stands in for the notifyPageReady of Root.html, which makes the frame visible. It records the
  // font size of the 12px rule of CoreUI1 at the moment it runs.
  function stubNotifyPageReady(root, frames) {
    const calls = [];
    root.notifyPageReady = (pageId) => {
      const win = frames.CoreUI1;
      calls.push({ pageId, size: win ? fontOf12pxRule0(win) : null });
    };
    return calls;
  }

  // The rule that was 12px when the page loaded, read before any scale, cached on the window.
  function fontOf12pxRule0(win) {
    if (!win.__testRule) win.__testRule = fontOf12pxRule(win);
    return win.__testRule.style.getPropertyValue('font-size');
  }

  test('after install, a new CoreUI1 frame is scaled before the root makes it visible', async (t) => {
    const frames = {};
    const root = makeRoot(t, frames);
    const calls = stubNotifyPageReady(root, frames);
    run(root, installCall(null, 0.9));

    frames.CoreUI1 = await loadPage(t, 'CoreUI1');
    fontOf12pxRule0(frames.CoreUI1);
    root.notifyPageReady('CoreUI1');

    assert.deepEqual(calls, [{ pageId: 'CoreUI1', size: '10.8px' }]);
  });

  test('after install, the ready call of another page runs the original and changes no style', async (t) => {
    const frames = { CoreUI1: await loadPage(t, 'CoreUI1') };
    const root = makeRoot(t, frames);
    const calls = stubNotifyPageReady(root, frames);
    fontOf12pxRule0(frames.CoreUI1);
    run(root, installCall(null, null));

    root.notifyPageReady('Cooking');

    assert.deepEqual(calls, [{ pageId: 'Cooking', size: '12px' }]);
  });

  test('a second install does not wrap notifyPageReady again, and uses the new factors', async (t) => {
    const frames = {};
    const root = makeRoot(t, frames);
    const calls = stubNotifyPageReady(root, frames);
    run(root, installCall(null, 0.9));
    run(root, installCall(null, 0.8));

    frames.CoreUI1 = await loadPage(t, 'CoreUI1');
    fontOf12pxRule0(frames.CoreUI1);
    root.notifyPageReady('CoreUI1');

    assert.deepEqual(calls, [{ pageId: 'CoreUI1', size: '9.6px' }]);
  });

  // The exact strings that the C# tests assert for HudScaleLogic.BuildCall, so the two sides cannot
  // drift apart.
  const CSHARP_DEFAULTS_CALL = 'window.__hudscale.install({zoom:{value:1,min:0.5,max:3,def:1,game:1.3},' +
    'text:{value:1,min:0.5,max:2,def:1,game:1},labels:{title:"HUD",zoom:"Scale",text:"Text Scale"}})';
  const CSHARP_GAME_VALUES_CALL = CSHARP_DEFAULTS_CALL.replace('{value:1,min:0.5,max:3', '{value:1.3,min:0.5,max:3');

  test('the C# call at the mod defaults zooms CoreUI1 to 1 and leaves the text', async (t) => {
    const win = await loadPage(t, 'CoreUI1');
    const writes = spyZoom(win);
    const before = pxFontRules(win);
    const root = makeRoot(t, { CoreUI1: win });

    assert.equal(run(root, CSHARP_DEFAULTS_CALL), 'installed');

    assert.deepEqual(writes, ['1']);
    for (const [rule, original] of before) assert.equal(rule.style.getPropertyValue('font-size'), original);
  });

  test('the C# call at the game values changes no style of a HUD page', async (t) => {
    const core1 = await loadPage(t, 'CoreUI1');
    const core0 = await loadPage(t, 'CoreUI0');
    const writes = spyZoom(core1);
    const resize = countResize(core1);
    const before1 = pxFontRules(core1);
    const before0 = pxFontRules(core0);
    const root = makeRoot(t, { CoreUI1: core1, CoreUI0: core0 });

    assert.equal(run(root, CSHARP_GAME_VALUES_CALL), 'installed');

    assert.deepEqual(writes, []);
    assert.equal(resize.n, 0);
    for (const [rule, original] of [...before1, ...before0]) assert.equal(rule.style.getPropertyValue('font-size'), original);
  });

  test('CoreUI1: zoom back to the game value removes the inline zoom', async (t) => {
    const win = await loadPage(t, 'CoreUI1');
    const writes = spyZoom(win);
    const root = makeRoot(t, { CoreUI1: win });
    run(root, installCall(1.1, null));

    run(root, installCall(1.3, null));

    assert.deepEqual(writes, ['1.1', '']);
  });

  test('CoreUI1: text back to the game value restores each original size, also of a later mod style', async (t) => {
    const win = await loadPage(t, 'CoreUI1');
    const before = pxFontRules(win);
    const root = makeRoot(t, { CoreUI1: win });
    run(root, installCall(null, 0.9));
    const modSize = await addModStyle(win, '.mod-c { font-size: 10px; }');
    const modRule = [...win.document.styleSheets].at(-1).cssRules[0];
    assert.equal(modSize, '9px');

    run(root, installCall(null, 1));

    for (const [rule, original] of before) assert.equal(rule.style.getPropertyValue('font-size'), original);
    assert.equal(modRule.style.getPropertyValue('font-size'), '10px');
  });

  test('CoreUI1: text 1, then 0.9, then 1 gives the original sizes', async (t) => {
    const win = await loadPage(t, 'CoreUI1');
    const before = pxFontRules(win);
    const root = makeRoot(t, { CoreUI1: win });

    run(root, installCall(null, 1));
    run(root, installCall(null, 0.9));
    run(root, installCall(null, 1));

    for (const [rule, original] of before) assert.equal(rule.style.getPropertyValue('font-size'), original);
  });

  test('install returns the error of a HUD page that fails', (t) => {
    const broken = { document: { get styleSheets() { throw new Error('boom'); } } };
    const root = makeRoot(t, { CoreUI1: broken });

    assert.equal(run(root, installCall(null, 0.9)), 'error: CoreUI1: boom');
  });

  test('CoreUI1: text scale scales a px font size inside @media', async (t) => {
    const win = await loadPage(t, 'CoreUI1');
    const style = win.document.createElement('style');
    style.textContent = '@media (min-width: 0px) { .hs-nested { font-size: 20px; } }';
    win.document.head.appendChild(style);
    const root = makeRoot(t, { CoreUI1: win });
    setFactors(root, null, 0.9);

    run(root, "window.__hudscale.apply('CoreUI1')");

    assert.equal(style.sheet.cssRules[0].cssRules[0].style.getPropertyValue('font-size'), '18px');
  });

  for (const pageId of Object.keys(PAGES)) {
    test(`${pageId}: text scale 0.9 scales each px font-size rule`, async (t) => {
      const win = await loadPage(t, pageId);
      const before = pxFontRules(win);
      // A guard against a game update that moves the HUD font sizes out of px.
      assert.ok(before.length > 0, `${pageId} has no px font-size rule`);
      const root = makeRoot(t, { [pageId]: win });
      setFactors(root, null, 0.9);

      run(root, `window.__hudscale.apply('${pageId}')`);

      for (const [rule, original] of before) {
        const expected = Math.round(parseFloat(original) * 0.9 * 100) / 100 + 'px';
        assert.equal(rule.style.getPropertyValue('font-size'), expected, `${rule.selectorText} (was ${original})`);
      }
    });
  }

  // Icons keep their size with the text scale. The game sizes some SVG icons in em, so each such size
  // is divided by the text scale that their font size gets.

  // The first style rule whose selector is exactly this text, nested rules included.
  function ruleOf(win, selector) {
    const find = (rules) => {
      for (const rule of rules) {
        if (rule.selectorText === selector) return rule;
        const nested = rule.cssRules && find(rule.cssRules);
        if (nested) return nested;
      }
      return null;
    };
    for (const sheet of win.document.styleSheets) {
      const rule = find(sheet.cssRules);
      if (rule) return rule;
    }
    throw new Error(`no rule "${selector}"`);
  }

  test('CoreUI1: text scale 0.85 divides the 1em size of .icon-svg', async (t) => {
    const win = await loadPage(t, 'CoreUI1');
    const icon = ruleOf(win, '.icon-svg');
    const root = makeRoot(t, { CoreUI1: win });
    setFactors(root, null, 0.85);

    run(root, "window.__hudscale.apply('CoreUI1')");

    assert.equal(icon.style.getPropertyValue('width'), '1.1765em');
    assert.equal(icon.style.getPropertyValue('height'), '1.1765em');
  });

  // jsdom does no layout, so the icon size on screen comes from the rules: the font size of the rule
  // that gives the icon its em, times the em size of the icon rule. The em size is rounded to four
  // decimals, so the size may differ by less than 0.01 px.
  const EM_ICONS = [
    { pageId: 'CoreUI1', name: 'phone', font: '.icon-sq', icon: '.icon-svg' },
    { pageId: 'CoreUI0', name: 'timer', font: '.timer-box .icon-svg', icon: '.icon-svg' },
    { pageId: 'CoreUI0', name: 'camera', font: '.map-trigger-btn', icon: '.icon-svg-stroke' },
    { pageId: 'CoreUI0', name: 'survival log', font: '.log-btn-right', icon: '.icon-svg' }
  ];

  function iconSize(win, c) {
    const font = parseFloat(ruleOf(win, c.font).style.getPropertyValue('font-size'));
    return font * parseFloat(ruleOf(win, c.icon).style.getPropertyValue('width'));
  }

  for (const c of EM_ICONS) {
    test(`${c.pageId}: the ${c.name} icon keeps its size at text scale 0.85 and 1.5`, async (t) => {
      const win = await loadPage(t, c.pageId);
      const original = iconSize(win, c);
      const root = makeRoot(t, { [c.pageId]: win });

      for (const textScale of [0.85, 1.5]) {
        setFactors(root, null, textScale);
        run(root, `window.__hudscale.apply('${c.pageId}')`);
        const scaled = iconSize(win, c);
        assert.ok(Math.abs(scaled - original) < 0.01, `${textScale}: ${scaled}px, not ${original}px`);
      }
    });
  }

  test('CoreUI1: a second apply divides the em size from the original, not two times', async (t) => {
    const win = await loadPage(t, 'CoreUI1');
    const icon = ruleOf(win, '.icon-svg');
    const root = makeRoot(t, { CoreUI1: win });
    setFactors(root, null, 0.85);

    run(root, "window.__hudscale.apply('CoreUI1')");
    run(root, "window.__hudscale.apply('CoreUI1')");

    assert.equal(icon.style.getPropertyValue('width'), '1.1765em');
  });

  test('CoreUI0: text 0.85, then 1 restores the original em sizes', async (t) => {
    const win = await loadPage(t, 'CoreUI0');
    const icon = ruleOf(win, '.icon-svg');
    const stroke = ruleOf(win, '.icon-svg-stroke');
    const root = makeRoot(t, { CoreUI0: win });

    run(root, installCall(null, 0.85));
    run(root, installCall(null, 1));

    assert.equal(icon.style.getPropertyValue('width'), '1em');
    assert.equal(stroke.style.getPropertyValue('height'), '1.07em');
  });

  test('CoreUI0: an install at the game values changes no em size', async (t) => {
    const win = await loadPage(t, 'CoreUI0');
    const stroke = ruleOf(win, '.icon-svg-stroke');
    let writes = 0;
    const setProperty = stroke.style.setProperty.bind(stroke.style);
    stroke.style.setProperty = (...args) => { writes++; return setProperty(...args); };
    const root = makeRoot(t, { CoreUI0: win });

    run(root, installCall(null, null));

    assert.equal(writes, 0);
    assert.equal(stroke.style.getPropertyValue('width'), '1.07em');
  });

  test('CoreUI1: a rem width and the em gap of .attr-name keep their text', async (t) => {
    const win = await loadPage(t, 'CoreUI1');
    const style = win.document.createElement('style');
    style.textContent = '.hs-rem { width: 2rem; }';
    win.document.head.appendChild(style);
    const gap = ruleOf(win, '.attr-name');
    const root = makeRoot(t, { CoreUI1: win });
    setFactors(root, null, 0.85);

    run(root, "window.__hudscale.apply('CoreUI1')");

    assert.equal(style.sheet.cssRules[0].style.getPropertyValue('width'), '2rem');
    assert.equal(gap.style.getPropertyValue('gap'), '0.25em');
  });

  test('CoreUI1: an icon in a style that a mod adds after apply keeps its size', async (t) => {
    const win = await loadPage(t, 'CoreUI1');
    const root = makeRoot(t, { CoreUI1: win });
    setFactors(root, null, 0.9);
    run(root, "window.__hudscale.apply('CoreUI1')");

    assert.equal(await addModStyle(win, '.mod-box { font-size: 10px; } .mod-box .mod-icon { width: 1em; }'), '9px');

    const rules = [...win.document.styleSheets].at(-1).cssRules;
    assert.equal(rules[1].style.getPropertyValue('width'), '1.1111em');
    assert.ok(Math.abs(9 * 1.1111 - 10) < 0.01);
  });

  test('CoreUI1: a mod rule with a font size and an em width restores both at text 1', async (t) => {
    const win = await loadPage(t, 'CoreUI1');
    const root = makeRoot(t, { CoreUI1: win });
    run(root, installCall(null, 0.9));
    await addModStyle(win, '.mod-both { font-size: 10px; width: 2em; }');
    const rule = [...win.document.styleSheets].at(-1).cssRules[0];
    assert.equal(rule.style.getPropertyValue('width'), '2.2222em');

    run(root, installCall(null, 1));

    assert.equal(rule.style.getPropertyValue('font-size'), '10px');
    assert.equal(rule.style.getPropertyValue('width'), '2em');
  });

  // A guard against a game update: an icon in em keeps its size only when its em comes from a px
  // font size of a stylesheet rule, which the text scale multiplies. An inline font size is not
  // scaled, so the division would make such an icon smaller. Only the elements that Vue renders in
  // jsdom are checked. The phone and bag buttons of CoreUI1 render only when the game turns them on.
  for (const pageId of Object.keys(PAGES)) {
    test(`${pageId}: each icon in em gets its font size from a px stylesheet rule`, async (t) => {
      const win = await loadPage(t, pageId);
      if (pageId === 'CoreUI1') {
        win.postMessage({ type: 'WebUI_CoreUI1_BtnActiveMsg', data: { phoneActive: true, bagActive: true } }, '*');
        await new Promise((resolve) => win.setTimeout(resolve, 50));
      }
      const rules = [];
      const walk = (list) => {
        for (const rule of list) {
          if (rule.cssRules) walk(rule.cssRules);
          if (rule.style) rules.push(rule);
        }
      };
      for (const sheet of win.document.styleSheets) walk(sheet.cssRules);
      const isEm = (v) => /^[\d.]+em$/.test(v);
      const emRules = rules.filter((r) =>
        ['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height'].some((p) => isEm(r.style.getPropertyValue(p))));
      const fontRules = rules.filter((r) => r.style.getPropertyValue('font-size'));

      let matched = 0;
      for (const emRule of emRules) {
        for (const el of win.document.querySelectorAll(emRule.selectorText)) {
          matched++;
          let source = null;
          for (let cur = el; cur && !source; cur = cur.parentElement) {
            if (cur.style && cur.style.fontSize) source = `inline ${cur.style.fontSize}`;
            else source = fontRules.find((r) => cur.matches(r.selectorText)) || null;
          }
          const label = `${emRule.selectorText} (${el.getAttribute('class')})`;
          assert.ok(source && typeof source !== 'string', `${label}: font size from ${source || 'no rule'}`);
          assert.match(source.style.getPropertyValue('font-size'), /^[\d.]+px$/, `${label}: font size from ${source.selectorText}`);
        }
      }
      assert.ok(matched > 0, `${pageId} renders no icon in em`);
    });
  }

  // The HUD panel of the settings window (OutSetting).

  function panelOf(win) {
    return win.document.getElementById('hudscale-panel');
  }

  test('OutSetting: install adds the HUD panel at the end of the first settings block, after the Action Feedback hint', async (t) => {
    const win = await loadPage(t, 'OutSetting');
    const root = makeRoot(t, { OutSetting: win });

    assert.equal(run(root, installCall(null, null)), 'installed');

    const section = win.document.querySelector('#settingsModal .settings-section');
    const panel = panelOf(win);
    assert.ok(panel, 'no panel');
    assert.equal(section.lastElementChild, panel);
    assert.ok(panel.previousElementSibling.classList.contains('setting-hint'));
  });

  function rowOf(win, key) {
    const row = panelOf(win).querySelector(`[data-hudscale="${key}"]`);
    return {
      input: row.querySelector('input'),
      label: row.querySelector('.setting-label').textContent,
      number: row.querySelector('.hudscale-value').textContent
    };
  }

  test('OutSetting: the volume sliders stay first, and the HUD sliders come after them', async (t) => {
    const win = await loadPage(t, 'OutSetting');
    const root = makeRoot(t, { OutSetting: win });
    const [music, effects] = win.document.querySelectorAll('input[type=range]');

    run(root, installCall(1.1, 0.9));

    const ranges = win.document.querySelectorAll('input[type=range]');
    assert.equal(ranges.length, 4);
    assert.equal(ranges[0], music);
    assert.equal(ranges[1], effects);
    assert.equal(ranges[2], rowOf(win, 'zoom').input);
    assert.equal(ranges[3], rowOf(win, 'text').input);
  });

  test('OutSetting: each HUD slider has the limits, the value, and the step, and its number has two decimals', async (t) => {
    const win = await loadPage(t, 'OutSetting');
    const root = makeRoot(t, { OutSetting: win });

    run(root, installCall(1.1, 0.9));

    const zoom = rowOf(win, 'zoom');
    const text = rowOf(win, 'text');
    assert.deepEqual([zoom.input.min, zoom.input.max, zoom.input.step, zoom.input.value], ['0.5', '3', '0.05', '1.1']);
    assert.deepEqual([text.input.min, text.input.max, text.input.step, text.input.value], ['0.5', '2', '0.05', '0.9']);
    assert.equal(zoom.number, '1.10');
    assert.equal(text.number, '0.90');
  });

  test('OutSetting: a value off the step grid shows its true value on the number', async (t) => {
    const win = await loadPage(t, 'OutSetting');
    const root = makeRoot(t, { OutSetting: win });

    // jsdom does not snap a range value to the step, so only the number is checked.
    run(root, installCall(1.03, null));

    assert.equal(rowOf(win, 'zoom').number, '1.03');
  });

  test('OutSetting: a second install changes the labels and the values and adds no second panel', async (t) => {
    const win = await loadPage(t, 'OutSetting');
    const root = makeRoot(t, { OutSetting: win });
    run(root, installCall(null, null));
    assert.deepEqual([panelOf(win).querySelector('.hudscale-title').textContent, rowOf(win, 'zoom').label, rowOf(win, 'text').label],
      ['HUD', 'Scale', 'Text Scale']);

    run(root, 'window.__hudscale.install(' + state(1.2, null).replace(
      'labels:{title:"HUD",zoom:"Scale",text:"Text Scale"}', 'labels:{title:"\u4E3B\u754C\u9762",zoom:"\u7F29\u653E",text:"\u6587\u5B57\u7F29\u653E"}') + ')');

    assert.equal(win.document.querySelectorAll('#hudscale-panel').length, 1);
    assert.equal(win.document.querySelectorAll('#hudscale-style').length, 1);
    assert.deepEqual([panelOf(win).querySelector('.hudscale-title').textContent, rowOf(win, 'zoom').label, rowOf(win, 'text').label],
      ['主界面', '缩放', '文字缩放']);
    assert.equal(rowOf(win, 'zoom').number, '1.20');
  });

  test('OutSetting: the panel stays after a re-render of the window', async (t) => {
    const win = await loadPage(t, 'OutSetting');
    const root = makeRoot(t, { OutSetting: win });
    run(root, installCall(1.1, null));

    // The localization message sets state.loc, and Vue renders the key groups again.
    win.postMessage({ type: 'WebUI_OutSetting_LocalizationMsg', data: { groupBasicText: 'RERENDER' } }, '*');
    await new Promise((resolve) => setTimeout(resolve, 50));

    const titles = [...win.document.querySelectorAll('.key-group-title')].map((e) => e.textContent);
    assert.ok(titles.includes('RERENDER'), 'the window did not render again');
    assert.ok(panelOf(win), 'the panel is gone');
    assert.equal(rowOf(win, 'zoom').number, '1.10');
  });

  test('OutSetting: after install, the ready call of a new OutSetting frame adds the panel', async (t) => {
    const frames = {};
    const root = makeRoot(t, frames);
    const calls = [];
    root.notifyPageReady = (pageId) => { calls.push(pageId); };
    run(root, installCall(null, 0.9));

    frames.OutSetting = await loadPage(t, 'OutSetting');
    root.notifyPageReady('OutSetting');

    assert.deepEqual(calls, ['OutSetting']);
    assert.equal(rowOf(frames.OutSetting, 'text').number, '0.90');
  });

  test('OutSetting: at the game values the panel shows 1.30 and 1.00', async (t) => {
    const win = await loadPage(t, 'OutSetting');
    const root = makeRoot(t, { OutSetting: win });

    run(root, CSHARP_GAME_VALUES_CALL);

    assert.equal(rowOf(win, 'zoom').number, '1.30');
    assert.equal(rowOf(win, 'text').number, '1.00');
  });

  test('OutSetting: install gives an error when the settings window is missing', async (t) => {
    const win = await loadPage(t, 'OutSetting');
    win.document.getElementById('settingsModal').remove();
    const root = makeRoot(t, { OutSetting: win });

    assert.equal(run(root, installCall(null, null)), 'error: OutSetting: no #settingsModal');
  });

  // Preview, save, and reset. The root gets a vuplex stub that records each message to C#.
  // t.mock.timers is enabled only after the pages load, because it replaces the setTimeout that the
  // load timeout and the page's own timers use.

  async function settingsSetup(t, zoom, textScale) {
    const frames = { CoreUI1: await loadPage(t, 'CoreUI1'), OutSetting: await loadPage(t, 'OutSetting') };
    const root = makeRoot(t, frames);
    const sent = [];
    root.vuplex = { postMessage: (m) => { sent.push(m); } };
    run(root, installCall(zoom, textScale));
    const zoomWrites = spyZoom(frames.CoreUI1);
    return { root, sent, zoomWrites, core1: frames.CoreUI1, out: frames.OutSetting };
  }

  function setMessage(zoom, textScale) {
    return `3\x1EOutSetting\x1EHUDSCALE_SET\x1E${zoom},${textScale}`;
  }

  async function openWindow(out, sent) {
    out.document.getElementById('settingsModal').classList.add('active');
    await Promise.resolve();
    sent.length = 0;
  }

  function slide(out, key, value, type) {
    const input = rowOf(out, key).input;
    input.value = String(value);
    input.dispatchEvent(new out.Event(type || 'input'));
  }

  test('settings: a drag shows the number at once and applies to the HUD after 120 ms', async (t) => {
    const s = await settingsSetup(t, 1, null);
    await openWindow(s.out, s.sent);
    t.mock.timers.enable({ apis: ['setTimeout'] });

    slide(s.out, 'zoom', 1.2);
    assert.equal(rowOf(s.out, 'zoom').number, '1.20');
    t.mock.timers.tick(119);
    assert.deepEqual(s.zoomWrites, []);
    t.mock.timers.tick(1);

    assert.deepEqual(s.zoomWrites, ['1.2']);
    assert.deepEqual(s.sent, []);
  });

  test('settings: a fast drag applies only the last value, one time', async (t) => {
    const s = await settingsSetup(t, 1, null);
    await openWindow(s.out, s.sent);
    t.mock.timers.enable({ apis: ['setTimeout'] });

    slide(s.out, 'zoom', 1.05);
    t.mock.timers.tick(60);
    slide(s.out, 'zoom', 1.1);
    t.mock.timers.tick(60);
    slide(s.out, 'zoom', 1.15);
    t.mock.timers.tick(120);

    assert.deepEqual(s.zoomWrites, ['1.15']);
  });

  test('settings: a release applies at once and sends the set message one time', async (t) => {
    const s = await settingsSetup(t, 1, null);
    const rule = fontOf12pxRule(s.core1);
    await openWindow(s.out, s.sent);
    t.mock.timers.enable({ apis: ['setTimeout'] });

    slide(s.out, 'text', 0.9);
    slide(s.out, 'text', 0.9, 'change');
    t.mock.timers.tick(500);

    assert.equal(rule.style.getPropertyValue('font-size'), '10.8px');
    assert.deepEqual(s.sent, [setMessage(1, 0.9)]);
  });

  test('settings: a click on the number sets the default, applies it, and sends it', async (t) => {
    const s = await settingsSetup(t, 1.2, null);
    await openWindow(s.out, s.sent);

    s.out.document.querySelector('[data-hudscale="zoom"] .hudscale-value').click();

    assert.equal(rowOf(s.out, 'zoom').number, '1.00');
    assert.equal(rowOf(s.out, 'zoom').input.value, '1');
    assert.deepEqual(s.zoomWrites, ['1']);
    assert.deepEqual(s.sent, [setMessage(1, 1)]);
  });

  test('settings: slider events while the window is closed change nothing', async (t) => {
    const s = await settingsSetup(t, 1, null);
    t.mock.timers.enable({ apis: ['setTimeout'] });

    slide(s.out, 'zoom', 1.2);
    slide(s.out, 'zoom', 1.2, 'change');
    t.mock.timers.tick(500);

    assert.equal(rowOf(s.out, 'zoom').number, '1.00');
    assert.deepEqual(s.zoomWrites, []);
    assert.deepEqual(s.sent, []);
  });

  // The window observer: an open asks C# for the current state, and a close saves an unsaved preview.

  const SYNC_MESSAGE = '3\x1EOutSetting\x1EHUDSCALE_SYNC\x1E';

  function modalOf(out) {
    return out.document.getElementById('settingsModal');
  }

  // A MutationObserver callback runs as a microtask.
  async function flushObservers() {
    await Promise.resolve();
    await Promise.resolve();
  }

  test('settings: opening the window sends one sync message', async (t) => {
    const s = await settingsSetup(t, 1, null);

    modalOf(s.out).classList.add('active');
    await flushObservers();

    assert.deepEqual(s.sent, [SYNC_MESSAGE]);
  });

  test('settings: adding active to a window that is open sends nothing', async (t) => {
    const s = await settingsSetup(t, 1, null);
    await openWindow(s.out, s.sent);

    modalOf(s.out).classList.add('active');
    await flushObservers();

    assert.deepEqual(s.sent, []);
  });

  test('settings: a close after a preview saves the previewed value', async (t) => {
    const s = await settingsSetup(t, 1, null);
    await openWindow(s.out, s.sent);
    t.mock.timers.enable({ apis: ['setTimeout'] });
    slide(s.out, 'zoom', 1.15);
    t.mock.timers.tick(120);

    modalOf(s.out).classList.remove('active');
    await flushObservers();

    assert.deepEqual(s.zoomWrites, ['1.15']);
    assert.deepEqual(s.sent, [setMessage(1.15, 1)]);
  });

  test('settings: a close during the preview delay applies and saves the dragged value', async (t) => {
    const s = await settingsSetup(t, 1, null);
    await openWindow(s.out, s.sent);
    t.mock.timers.enable({ apis: ['setTimeout'] });
    slide(s.out, 'zoom', 1.15);

    modalOf(s.out).classList.remove('active');
    await flushObservers();
    t.mock.timers.tick(500);

    assert.deepEqual(s.zoomWrites, ['1.15']);
    assert.deepEqual(s.sent, [setMessage(1.15, 1)]);
  });

  test('settings: a close with nothing unsaved sends nothing', async (t) => {
    const s = await settingsSetup(t, 1, null);
    await openWindow(s.out, s.sent);
    slide(s.out, 'zoom', 1.2);
    slide(s.out, 'zoom', 1.2, 'change');
    s.sent.length = 0;

    modalOf(s.out).classList.remove('active');
    await flushObservers();

    assert.deepEqual(s.sent, []);
  });

  test('settings: a second install adds no second window observer', async (t) => {
    const s = await settingsSetup(t, 1, null);
    run(s.root, installCall(1, null));

    modalOf(s.out).classList.add('active');
    await flushObservers();

    assert.deepEqual(s.sent, [SYNC_MESSAGE]);
  });

  test('settings: a new OutSetting document gets its own window observer', async (t) => {
    const frames = {};
    const root = makeRoot(t, frames);
    const sent = [];
    root.vuplex = { postMessage: (m) => { sent.push(m); } };
    root.notifyPageReady = () => {};
    run(root, installCall(1, null));
    frames.OutSetting = await loadPage(t, 'OutSetting');
    root.notifyPageReady('OutSetting');
    frames.OutSetting = await loadPage(t, 'OutSetting');
    root.notifyPageReady('OutSetting');

    modalOf(frames.OutSetting).classList.add('active');
    await flushObservers();

    assert.deepEqual(sent, [SYNC_MESSAGE]);
  });

  // An install from C# during a drag. jsdom has no PointerEvent, so a plain Event stands in.

  function pointer(out, key, type) {
    rowOf(out, key).input.dispatchEvent(new out.Event(type));
  }

  test('settings: an install during a drag does not move the slider, and one after the drag does', async (t) => {
    const s = await settingsSetup(t, 1, null);
    await openWindow(s.out, s.sent);
    pointer(s.out, 'zoom', 'pointerdown');

    run(s.root, installCall(1.25, null));
    assert.equal(rowOf(s.out, 'zoom').number, '1.00');
    assert.equal(rowOf(s.out, 'zoom').input.value, '1');

    pointer(s.out, 'zoom', 'pointerup');
    run(s.root, installCall(1.25, null));
    assert.equal(rowOf(s.out, 'zoom').number, '1.25');
    assert.equal(rowOf(s.out, 'zoom').input.value, '1.25');
  });

  test('settings: a close ends the drag, so the next install moves the slider', async (t) => {
    const s = await settingsSetup(t, 1, null);
    await openWindow(s.out, s.sent);
    pointer(s.out, 'zoom', 'pointerdown');

    modalOf(s.out).classList.remove('active');
    await flushObservers();
    run(s.root, installCall(1.25, null));

    assert.equal(rowOf(s.out, 'zoom').number, '1.25');
  });

  test('settings: an install keeps an unsaved preview, and the close saves the preview', async (t) => {
    const s = await settingsSetup(t, 1, null);
    await openWindow(s.out, s.sent);
    t.mock.timers.enable({ apis: ['setTimeout'] });
    pointer(s.out, 'zoom', 'pointerdown');
    slide(s.out, 'zoom', 1.15);
    t.mock.timers.tick(120);

    run(s.root, installCall(1, 0.9));
    modalOf(s.out).classList.remove('active');
    await flushObservers();

    assert.deepEqual(s.sent, [setMessage(1.15, 0.9)]);
  });
}

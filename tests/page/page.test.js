// Runs page.js against the game's own CoreUI1.html and CoreUI0.html, so a game update that changes
// how the HUD sets its font sizes shows up here instead of only in the game.
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

const gameFilesExist = Object.values(PAGES).every((p) => fs.existsSync(p));

if (!gameFilesExist) {
  test('page.js against the HUD pages', { skip: `game files not found under SL_GAME_DIR (${GAME_DIR}); set SL_GAME_DIR to the game folder` }, () => {});
} else {
  const pageJs = fs.readFileSync(PAGE_JS_PATH, 'utf8');

  // The HUD pages start their own requestAnimationFrame loops, which keep a jsdom window alive.
  // t.after closes each window when its test is done.
  async function loadPage(t, pageId) {
    const file = PAGES[pageId];
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

  // Sets the factors that install() stores, for the tests of apply() alone.
  function setFactors(root, zoom, textScale) {
    run(root, `window.__hudscale.zoom = ${zoom}; window.__hudscale.textScale = ${textScale};`);
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

    assert.equal(run(root, 'window.__hudscale.install(null,0.9)'), 'installed');

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
    run(root, 'window.__hudscale.install(null,0.9)');

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
    run(root, 'window.__hudscale.install(null,null)');

    root.notifyPageReady('Cooking');

    assert.deepEqual(calls, [{ pageId: 'Cooking', size: '12px' }]);
  });

  test('a second install does not wrap notifyPageReady again, and uses the new factors', async (t) => {
    const frames = {};
    const root = makeRoot(t, frames);
    const calls = stubNotifyPageReady(root, frames);
    run(root, 'window.__hudscale.install(null,0.9)');
    run(root, 'window.__hudscale.install(null,0.8)');

    frames.CoreUI1 = await loadPage(t, 'CoreUI1');
    fontOf12pxRule0(frames.CoreUI1);
    root.notifyPageReady('CoreUI1');

    assert.deepEqual(calls, [{ pageId: 'CoreUI1', size: '9.6px' }]);
  });

  test('install returns the error of a HUD page that fails', (t) => {
    const broken = { document: { get styleSheets() { throw new Error('boom'); } } };
    const root = makeRoot(t, { CoreUI1: broken });

    assert.equal(run(root, 'window.__hudscale.install(null,0.9)'), 'error: CoreUI1: boom');
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
}

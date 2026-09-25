// HUD Scale page script. It runs in the root page (Root.html) and reaches each HUD page through the
// iframe whose id is the page id. C# runs this file plus one call, so the file defines
// window.__hudscale only one time and each later run keeps the state of the first one.
(function () {
  if (window.__hudscale) return;

  var hs = window.__hudscale = {
    // The state that C# sends: for zoom and text, the value, min, max, def (the config default), and
    // game (the game's own value). A value equal to its game value means "leave the page as the game
    // has it".
    state: null
  };

  // The factor of a setting, or null when the setting has the game's value.
  function factor(key) {
    var s = hs.state && hs.state[key];
    return !s || s.value === s.game ? null : s.value;
  }

  // The inline zoom overrides the page's own "body { zoom: 1.3 }". CoreUI1 watches the attributes of
  // body and measures its click areas again, so the write happens only when the value differs.
  function setZoom(win, zoom) {
    var style = win.document.body.style;
    if (String(style.zoom) !== String(zoom)) style.zoom = String(zoom);
  }

  // Multiplies each px font size of the page's stylesheets by the text scale. The original size of
  // each rule is kept on the page window, so a second run scales from the original again.
  function scaleText(win, factor) {
    var originals = win.__hudscaleOriginals || (win.__hudscaleOriginals = new WeakMap());
    var sheets = win.document.styleSheets;
    for (var i = 0; i < sheets.length; i++) scaleSheet(sheets[i], factor, originals);
  }

  // A cross-origin sheet throws on cssRules. It has no HUD rule, so it is skipped.
  function scaleSheet(sheet, factor, originals) {
    var rules;
    try { rules = sheet.cssRules; } catch (e) { return; }
    scaleRules(rules, factor, originals);
  }

  function scaleRules(rules, factor, originals) {
    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      if (rule.cssRules) scaleRules(rule.cssRules, factor, originals);
      if (!rule.style) continue;
      // The original is kept as its text, so a factor of 1 writes back the exact text of the game
      // stylesheet (for example "28.0px", not "28px").
      var original = originals.get(rule);
      if (original === undefined) {
        original = rule.style.getPropertyValue('font-size');
        if (!/^[\d.]+px$/.test(original)) continue;
        originals.set(rule, original);
      }
      rule.style.setProperty('font-size', factor === 1 ? original : round2(parseFloat(original) * factor) + 'px');
    }
  }

  // Other mods add their <style> to the head after the page loads. One observer for each page scales
  // each new sheet with the factor that is current then. The mark sits on the document, not the
  // window: a frame's window can outlive its initial about:blank document.
  function watchHead(win) {
    var doc = win.document;
    if (doc.__hudscaleObserver) return;
    doc.__hudscaleObserver = new win.MutationObserver(function (mutations) {
      var textScale = factor('text');
      if (textScale == null) return;
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          if (added[j].nodeName === 'STYLE' && added[j].sheet) {
            scaleSheet(added[j].sheet, textScale, win.__hudscaleOriginals);
          }
        }
      }
    });
    doc.__hudscaleObserver.observe(doc.head, { childList: true });
  }

  function round2(v) {
    return Math.round(v * 100) / 100;
  }

  var HUD_PAGES = ['CoreUI1', 'CoreUI0'];

  // The pause window. Its settings window (#settingsModal) gets the HUD panel.
  var SETTINGS_PAGE = 'OutSetting';
  var SETTINGS = ['zoom', 'text'];
  var STEP = 0.05;
  var PREVIEW_DELAY_MS = 120;

  var PANEL_CSS =
    '#hudscale-panel { display: flex; flex-direction: column; gap: 10px; margin-top: 6px; }' +
    '#hudscale-panel .setting-label { flex-shrink: 0; }' +
    '.hudscale-mark { position: absolute; top: 50%; width: 2px; height: 16px; transform: translate(-50%, -50%);' +
    ' background: rgba(255, 255, 255, 0.45); pointer-events: none; }' +
    '.hudscale-value { flex-shrink: 0; min-width: 52px; margin-left: 16px; text-align: right; cursor: pointer;' +
    ' font-family: Consolas, monospace; font-size: 1.1rem; color: #EBA308; }' +
    '.hudscale-value:hover { color: #ffffff; }';

  function el(doc, tag, className, text) {
    var e = doc.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  // The panel: a title in the style of the key groups, then one row for each setting with a label,
  // a slider in the game's slider style, and the value as a number.
  function buildPanel(doc) {
    var panel = el(doc, 'div');
    panel.id = 'hudscale-panel';
    panel.appendChild(el(doc, 'div', 'key-group-title hudscale-title'));
    for (var i = 0; i < SETTINGS.length; i++) {
      var row = el(doc, 'div', 'setting-row');
      row.setAttribute('data-hudscale', SETTINGS[i]);
      row.appendChild(el(doc, 'div', 'setting-label'));
      var wrapper = el(doc, 'div', 'slider-wrapper');
      var input = el(doc, 'input');
      input.type = 'range';
      input.step = String(STEP);
      wrapper.appendChild(input);
      wrapper.appendChild(el(doc, 'div', 'hudscale-mark'));
      row.appendChild(wrapper);
      var number = el(doc, 'span', 'hudscale-value');
      row.appendChild(number);
      panel.appendChild(row);
      wireRow(doc, SETTINGS[i], input, number);
    }
    return panel;
  }

  // A closed settings window is only transparent, so a drag can go on after Escape. The panel acts
  // only while the window is open.
  function isOpen(doc) {
    var modal = doc.getElementById('settingsModal');
    return !!modal && modal.classList.contains('active');
  }

  // While the player drags, the number follows at once and the HUD follows after a short stop. A
  // release applies at once and saves. A click on the number goes back to the default.
  function wireRow(doc, key, input, number) {
    var win = doc.defaultView;
    // While the player holds a slider, an install from C# must not move it.
    input.addEventListener('pointerdown', function () { hs.dragging = true; });
    input.addEventListener('pointerup', function () { hs.dragging = false; });
    input.addEventListener('input', function () {
      if (!isOpen(doc)) return;
      var value = parseFloat(input.value);
      number.textContent = value.toFixed(2);
      if (typeof win.updateSlider === 'function') win.updateSlider(input);
      clearTimeout(hs.previewTimer);
      hs.pending = { key: key, value: value };
      hs.previewTimer = setTimeout(preview, PREVIEW_DELAY_MS);
    });
    input.addEventListener('change', function () {
      hs.dragging = false;
      if (!isOpen(doc)) return;
      commit(key, parseFloat(input.value));
    });
    number.addEventListener('click', function () {
      if (!isOpen(doc)) return;
      var s = hs.state[key];
      input.value = String(s.def);
      number.textContent = s.def.toFixed(2);
      if (typeof win.updateSlider === 'function') win.updateSlider(input);
      commit(key, s.def);
    });
  }

  function applyHud() {
    for (var i = 0; i < HUD_PAGES.length; i++) hs.apply(HUD_PAGES[i]);
  }

  // Shows the dragged value on the HUD without a save. It is then unsaved until a release or a close.
  function preview() {
    clearTimeout(hs.previewTimer);
    if (!hs.pending) return;
    hs.state[hs.pending.key].value = hs.pending.value;
    hs.unsaved = hs.pending.key;
    hs.pending = null;
    applyHud();
  }

  // Applies a value at once and saves it.
  function commit(key, value) {
    hs.pending = null;
    hs.state[key].value = value;
    hs.unsaved = key;
    flush();
  }

  // Applies a dragged or previewed value that is not saved yet, and sends both values to C#, which
  // saves them in the config file.
  function flush() {
    preview();
    if (!hs.unsaved) return;
    hs.unsaved = null;
    applyHud();
    send('HUDSCALE_SET', hs.state.zoom.value + ',' + hs.state.text.value);
  }

  // Each way to open or close the settings window (a click, Escape, or C#) changes the class
  // "active" of #settingsModal. An open asks C# to check the config file and send the current state.
  // A close saves the value that the HUD shows. The mark sits on the document, so a new document of
  // the page gets its own observer.
  function watchModal(doc, modal) {
    if (doc.__hudscaleModalObserver) return;
    doc.__hudscaleModalObserver = new doc.defaultView.MutationObserver(function (mutations) {
      var wasOpen = /(^|\s)active(\s|$)/.test(mutations[0].oldValue || '');
      var open = modal.classList.contains('active');
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
  function send(name, data) {
    if (window.vuplex) window.vuplex.postMessage(['3', SETTINGS_PAGE, name, data].join('\u001E'));
  }

  // Writes the labels and the state of each setting into the panel. The number shows the stored
  // value, which can be off the step grid (1.03), while the browser snaps the thumb to the grid.
  function showState(win, panel) {
    var labels = hs.state.labels || {};
    panel.querySelector('.hudscale-title').textContent = labels.title || '';
    for (var i = 0; i < SETTINGS.length; i++) {
      var key = SETTINGS[i];
      var s = hs.state[key];
      var row = panel.querySelector('[data-hudscale="' + key + '"]');
      row.querySelector('.setting-label').textContent = labels[key] || '';
      if (hs.dragging) continue;
      var input = row.querySelector('input');
      input.min = String(s.min);
      input.max = String(s.max);
      input.value = String(s.value);
      row.querySelector('.hudscale-value').textContent = s.value.toFixed(2);
      // The thumb is 22px wide, so its center runs from 11px to (width - 11px).
      var p = (s.def - s.min) / (s.max - s.min);
      row.querySelector('.hudscale-mark').style.left = 'calc(11px + (100% - 22px) * ' + p + ')';
      if (typeof win.updateSlider === 'function') win.updateSlider(input);
    }
  }

  // Adds the panel to the settings window, or updates it when it is there. The panel sits at the end
  // of the first settings block (Music, Effects, Action Feedback), which Vue renders one time as
  // static content, so a re-render of the window keeps it. Its sliders come after the two volume
  // sliders, which the page finds by index.
  hs.panel = function () {
    try {
      var frame = document.getElementById(SETTINGS_PAGE);
      var win = frame && frame.contentWindow;
      if (!win || !win.document) return 'no frame';
      if (!hs.state) return 'no state';
      var doc = win.document;
      var modal = doc.getElementById('settingsModal');
      if (!modal) return 'error: no #settingsModal';
      watchModal(doc, modal);
      var panel = doc.getElementById('hudscale-panel');
      if (!panel) {
        var section = modal.querySelector('.settings-section');
        if (!section) return 'error: no .settings-section in #settingsModal';
        if (!doc.getElementById('hudscale-style')) {
          var style = el(doc, 'style', null, PANEL_CSS);
          style.id = 'hudscale-style';
          doc.head.appendChild(style);
        }
        panel = buildPanel(doc);
        section.appendChild(panel);
        hs.dragging = false;
      }
      showState(win, panel);
      return 'applied';
    } catch (e) {
      return 'error: ' + (e && e.message);
    }
  };

  // A page calls window.parent.notifyPageReady(pageId) when it is mounted, and the root function
  // makes the frame visible. The wrapper applies the factors first, so a HUD page never shows at the
  // vanilla size.
  function wrapNotifyPageReady() {
    if (hs.wrapped || typeof window.notifyPageReady !== 'function') return;
    var original = window.notifyPageReady;
    window.notifyPageReady = function (pageId) {
      if (HUD_PAGES.indexOf(pageId) >= 0) hs.apply(pageId);
      else if (pageId === SETTINGS_PAGE) hs.panel();
      return original.apply(this, arguments);
    };
    hs.wrapped = true;
  }

  // Stores the state and applies it to each HUD page and to the settings panel that exist now. A
  // page that does not exist yet is normal: the wrapper applies to it when it is ready. The first
  // page error is the result.
  hs.install = function (state) {
    try {
      // A value that the HUD shows but that is not saved yet stays, so a close saves what the
      // player sees.
      if (hs.unsaved && hs.state) state[hs.unsaved].value = hs.state[hs.unsaved].value;
      hs.state = state;
      wrapNotifyPageReady();
      var pages = HUD_PAGES.concat([SETTINGS_PAGE]);
      for (var i = 0; i < pages.length; i++) {
        var status = pages[i] === SETTINGS_PAGE ? hs.panel() : hs.apply(pages[i]);
        if (status.indexOf('error: ') === 0) return 'error: ' + pages[i] + ': ' + status.substring(7);
      }
      return 'installed';
    } catch (e) {
      return 'error: ' + (e && e.message);
    }
  };

  hs.apply = function (pageId) {
    try {
      var frame = document.getElementById(pageId);
      var win = frame && frame.contentWindow;
      if (!win || !win.document) return 'no frame';
      var zoom = factor('zoom');
      // At the game's value, a page that the mod changed before goes back to the game's style: the
      // inline zoom is removed, and each font size is scaled by 1, which writes back its original.
      // A page that the mod never changed is left alone.
      if (pageId === 'CoreUI1') {
        if (zoom != null) {
          setZoom(win, zoom);
          win.document.__hudscaleZoomed = true;
        } else if (win.document.__hudscaleZoomed) {
          setZoom(win, '');
          win.document.__hudscaleZoomed = false;
        }
      }
      var textScale = factor('text');
      if (textScale == null && win.__hudscaleOriginals) textScale = 1;
      if (textScale != null) {
        scaleText(win, textScale);
        watchHead(win);
        // A CSSOM change is not a DOM mutation, so CoreUI1 would keep its old click areas until the
        // next DOM change. A resize makes it measure them again.
        win.dispatchEvent(new win.Event('resize'));
      }
      return 'applied';
    } catch (e) {
      return 'error: ' + (e && e.message);
    }
  };
})();

// HUD Scale page script. It runs in the root page (Root.html) and reaches each HUD page through the
// iframe whose id is the page id. C# runs this file plus one call, so the file defines
// window.__hudscale only one time and each later run keeps the state of the first one.
(function () {
  if (window.__hudscale) return;

  var hs = window.__hudscale = {
    // The stored factors. null means "leave this as the game has it".
    zoom: null,
    textScale: null
  };

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
      var original = originals.get(rule);
      if (original === undefined) {
        var m = /^([\d.]+)px$/.exec(rule.style.getPropertyValue('font-size'));
        if (!m) continue;
        original = parseFloat(m[1]);
        originals.set(rule, original);
      }
      rule.style.setProperty('font-size', round2(original * factor) + 'px');
    }
  }

  // Other mods add their <style> to the head after the page loads. One observer for each page scales
  // each new sheet with the factor that is current then. The mark sits on the document, not the
  // window: a frame's window can outlive its initial about:blank document.
  function watchHead(win) {
    var doc = win.document;
    if (doc.__hudscaleObserver) return;
    doc.__hudscaleObserver = new win.MutationObserver(function (mutations) {
      if (hs.textScale == null) return;
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          if (added[j].nodeName === 'STYLE' && added[j].sheet) {
            scaleSheet(added[j].sheet, hs.textScale, win.__hudscaleOriginals);
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

  // A page calls window.parent.notifyPageReady(pageId) when it is mounted, and the root function
  // makes the frame visible. The wrapper applies the factors first, so a HUD page never shows at the
  // vanilla size.
  function wrapNotifyPageReady() {
    if (hs.wrapped || typeof window.notifyPageReady !== 'function') return;
    var original = window.notifyPageReady;
    window.notifyPageReady = function (pageId) {
      if (HUD_PAGES.indexOf(pageId) >= 0) hs.apply(pageId);
      return original.apply(this, arguments);
    };
    hs.wrapped = true;
  }

  // Stores the factors and applies them to each HUD page that exists now. A page that does not exist
  // yet is normal: the wrapper applies to it when it is ready. The first page error is the result.
  hs.install = function (zoom, textScale) {
    try {
      hs.zoom = zoom;
      hs.textScale = textScale;
      wrapNotifyPageReady();
      for (var i = 0; i < HUD_PAGES.length; i++) {
        var status = hs.apply(HUD_PAGES[i]);
        if (status.indexOf('error: ') === 0) return 'error: ' + HUD_PAGES[i] + ': ' + status.substring(7);
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
      if (hs.zoom != null && pageId === 'CoreUI1') setZoom(win, hs.zoom);
      if (hs.textScale != null) {
        scaleText(win, hs.textScale);
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

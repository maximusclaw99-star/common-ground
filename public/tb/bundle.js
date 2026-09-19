/* Terminal Brutalist — runtime. Classic script, no dependencies, no network.
   Everything here reads its colour and type from the tokens at draw time, so
   both behaviours follow a theme switch without being told about it. */
(function (global) {
  'use strict';

  var doc = global.document;

  /* Coverage ramp, sparse to dense. Space is "nothing here". */
  var RAMP = ' .,:;irsXA253hMHGS#9B&@';

  function cssVar(el, name, fallback) {
    var v = global.getComputedStyle(el).getPropertyValue(name).trim();
    return v || fallback;
  }

  function clamp01(n) {
    return n < 0 ? 0 : n > 1 ? 1 : n;
  }

  /* ----------------------------------------------------------------------
     asciiRelief(host, { source, cell, ratio, alpha, ramp })

     Samples `source` down to one pixel per character cell, then paints a
     monospace glyph per cell whose density tracks that pixel's ink coverage.

     `source` is either a drawable (an <img> that has finished loading, a
     <canvas>, an ImageBitmap) or a function(ctx, cols, rows) that paints the
     field itself at grid resolution — which is how you avoid shipping an
     image at all.
     ---------------------------------------------------------------------- */
  function asciiRelief(host, opts) {
    if (!host) return null;
    opts = opts || {};

    var source = opts.source;
    if (!source) return null;

    var cell = opts.cell || 7;
    var ratio = opts.ratio || 1.6;
    var ramp = opts.ramp || RAMP;
    var alpha = opts.alpha == null ? 0.26 : opts.alpha;
    var gamma = opts.gamma || 1;

    var canvas = host.querySelector('canvas');
    if (!canvas) {
      canvas = doc.createElement('canvas');
      host.appendChild(canvas);
    }
    var ctx = canvas.getContext('2d');
    var buf = doc.createElement('canvas');
    var bctx = buf.getContext('2d', { willReadFrequently: true });
    var queued = 0;

    function draw() {
      queued = 0;
      var w = host.clientWidth;
      var h = host.clientHeight;
      if (!w || !h || !ctx || !bctx) return;

      var dpr = Math.min(global.devicePixelRatio || 1, 2);
      var cw = cell;
      var ch = Math.round(cell * ratio);
      var cols = Math.max(1, Math.floor(w / cw));
      var rows = Math.max(1, Math.floor(h / ch));

      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      buf.width = cols;
      buf.height = rows;

      bctx.clearRect(0, 0, cols, rows);
      if (typeof source === 'function') {
        source(bctx, cols, rows);
      } else {
        bctx.drawImage(source, 0, 0, cols, rows);
      }

      var data;
      try {
        data = bctx.getImageData(0, 0, cols, rows).data;
      } catch (e) {
        return; /* tainted canvas: a cross-origin image was handed in */
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = cssVar(host, '--ink', '#111111');
      ctx.globalAlpha = alpha;
      ctx.font = '400 ' + Math.round(cell * 1.55) + 'px ' + cssVar(host, '--font-mono', 'monospace');
      ctx.textBaseline = 'top';

      var last = ramp.length - 1;
      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          var i = (y * cols + x) * 4;
          var a = data[i + 3] / 255;
          if (a < 0.02) continue;
          /* Luminance says how dark the pixel is, alpha says how present it
             is. A black field painted at varying alpha and a flat grayscale
             photograph both land on the same 0..1 coverage. */
          var lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
          var density = clamp01(Math.pow(a * (1 - lum), gamma));
          var idx = Math.round(density * last);
          if (idx < 1) continue;
          ctx.fillText(ramp.charAt(idx), x * cw, y * ch);
        }
      }
    }

    function schedule() {
      if (queued) return;
      queued = global.requestAnimationFrame(draw);
    }

    var ro = null;
    if (global.ResizeObserver) {
      ro = new global.ResizeObserver(schedule);
      ro.observe(host);
    } else {
      global.addEventListener('resize', schedule);
    }

    /* Repaint on a theme switch so --ink is re-read. */
    var mo = null;
    if (global.MutationObserver) {
      mo = new global.MutationObserver(schedule);
      mo.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }

    if (source && source.tagName === 'IMG' && !source.complete) {
      source.addEventListener('load', schedule);
    }
    schedule();

    return {
      redraw: schedule,
      destroy: function () {
        if (ro) ro.disconnect();
        if (mo) mo.disconnect();
        global.removeEventListener('resize', schedule);
        if (queued) global.cancelAnimationFrame(queued);
      }
    };
  }

  /* ----------------------------------------------------------------------
     reliefSource({ seed })

     A procedural stand-in: two mineral masses reaching toward each other
     across a gap, banded like a contour map. Demo content, not brand
     content — swap it for your own artwork before shipping.
     ---------------------------------------------------------------------- */
  function reliefSource(opts) {
    opts = opts || {};
    var phase = opts.seed == null ? 0.6 : opts.seed;

    return function (ctx, cols, rows) {
      var img = ctx.createImageData(cols, rows);
      var d = img.data;
      var TAU = Math.PI * 2;

      for (var y = 0; y < rows; y++) {
        var v = y / rows;
        for (var x = 0; x < cols; x++) {
          var u = x / cols;

          /* Two masses, each a tight gaussian carrying its own contour
             banding, reaching toward a gap at the centre. */
          var lobeA = Math.exp(-(Math.pow(u - 0.25, 2) / 0.030 + Math.pow(v - 0.44, 2) / 0.055));
          var bandA = 0.42 + 0.58 * Math.sin((u * 4.6 + v * 1.4 + phase) * TAU + Math.sin(v * TAU * 2.4) * 1.6);

          var lobeB = Math.exp(-(Math.pow(u - 0.74, 2) / 0.026 + Math.pow(v - 0.70, 2) / 0.040));
          var bandB = 0.40 + 0.60 * Math.sin((u * 5.4 - v * 2.1 + phase) * TAU + Math.sin(u * TAU * 1.9) * 1.3);

          var n = Math.max(lobeA * bandA, lobeB * bandB);
          n *= 0.9 + 0.1 * Math.sin((u * 13 + v * 11) * TAU);

          /* Cut the floor so the page is empty away from the masses. Without
             this the whole canvas fills with faint grain and the composition
             disappears. */
          n = clamp01((n - 0.14) / 0.86);

          var i = (y * cols + x) * 4;
          d[i] = 0;
          d[i + 1] = 0;
          d[i + 2] = 0;
          d[i + 3] = Math.round(Math.pow(n, 1.15) * 255);
        }
      }
      ctx.putImageData(img, 0, 0);
    };
  }

  /* ----------------------------------------------------------------------
     crosshair(host)

     Full-bleed cursor crosshair with a live coordinate readout. Fine
     pointers only; it is decoration and never the way to reach anything.
     ---------------------------------------------------------------------- */
  function crosshair(host, opts) {
    if (!host) return null;
    opts = opts || {};
    if (global.matchMedia && global.matchMedia('(pointer: coarse)').matches) return null;

    var root = doc.createElement('div');
    root.className = 'tb-crosshair';
    root.setAttribute('aria-hidden', 'true');

    var vx = doc.createElement('div');
    vx.className = 'tb-crosshair__y';
    var hy = doc.createElement('div');
    hy.className = 'tb-crosshair__x';
    var dot = doc.createElement('div');
    dot.className = 'tb-crosshair__dot';
    var read = doc.createElement('div');
    read.className = 'tb-crosshair__read mono-micro';

    root.appendChild(vx);
    root.appendChild(hy);
    root.appendChild(dot);
    root.appendChild(read);
    host.appendChild(root);

    function move(ev) {
      var r = host.getBoundingClientRect();
      var x = Math.round(ev.clientX - r.left);
      var y = Math.round(ev.clientY - r.top);
      vx.style.left = x + 'px';
      hy.style.top = y + 'px';
      dot.style.left = x + 'px';
      dot.style.top = y + 'px';
      read.style.left = x + 'px';
      read.style.top = y + 'px';
      read.textContent = 'x: ' + x + '\ny: ' + y;
      root.setAttribute('data-on', '1');
    }

    function leave() {
      root.removeAttribute('data-on');
    }

    host.addEventListener('pointermove', move);
    host.addEventListener('pointerleave', leave);

    return {
      destroy: function () {
        host.removeEventListener('pointermove', move);
        host.removeEventListener('pointerleave', leave);
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  global.TB = {
    asciiRelief: asciiRelief,
    reliefSource: reliefSource,
    crosshair: crosshair,
    RAMP: RAMP
  };
})(window);

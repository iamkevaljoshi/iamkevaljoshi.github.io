/* Image optimiser: resize, compress and convert images entirely in the browser.
   The same file runs twice: on the page (UI) and as a Web Worker (decoding and
   encoding with OffscreenCanvas), so large images don't freeze the page. If a
   worker or OffscreenCanvas isn't available, the work runs on the page instead.
   Nothing is uploaded. */
(function () {
  'use strict';
  var IS_WORKER = typeof window === 'undefined';
  var MIME = { webp: 'image/webp', avif: 'image/avif', jpeg: 'image/jpeg', png: 'image/png' };
  var EXT = { webp: 'webp', avif: 'avif', jpeg: 'jpg', png: 'png' };
  var MAX_AREA = 16777216; // Safari's canvas limit (4096 × 4096); larger images are scaled to fit
  var RESPONSIVE = [480, 960, 1440, 1920];

  /* ---------------------------------------------------------------
     Encoding core (shared by the worker and the page fallback)
     --------------------------------------------------------------- */
  function makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    var c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  function toBlob(c, type, q) {
    if (c.convertToBlob) return c.convertToBlob({ type: type, quality: q });
    return new Promise(function (res, rej) {
      c.toBlob(function (b) { b ? res(b) : rej(new Error('encode')); }, type, q);
    });
  }
  var supportP = null;
  function detect() {
    if (supportP) return supportP;
    var fmts = ['webp', 'avif', 'jpeg', 'png'];
    supportP = Promise.all(fmts.map(function (f) {
      try {
        var c = makeCanvas(2, 2), x = c.getContext('2d');
        x.fillStyle = '#c33'; x.fillRect(0, 0, 2, 2);
        return toBlob(c, MIME[f], 0.8).then(function (b) { return !!b && b.type === MIME[f]; }, function () { return false; });
      } catch (e) { return false; }
    })).then(function (r) { var s = {}; fmts.forEach(function (f, i) { s[f] = r[i]; }); return s; });
    return supportP;
  }
  async function decode(blob) {
    if (typeof createImageBitmap !== 'undefined') {
      try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
      catch (e) { try { return await createImageBitmap(blob); } catch (e2) { /* fall through */ } }
    }
    if (IS_WORKER) throw new Error('decode');
    var url = URL.createObjectURL(blob);
    try { var img = new Image(); img.src = url; await img.decode(); return img; }
    catch (e) { throw new Error('decode'); }
    finally { URL.revokeObjectURL(url); }
  }
  function dims(src) { return { w: src.naturalWidth || src.width, h: src.naturalHeight || src.height }; }
  function ctx2d(c) { return c.getContext('2d', { willReadFrequently: false }); }

  /* High-quality downscale: halve repeatedly, then a final resize. */
  function draw(src, sw, sh, w, h, flatten) {
    var cur = src, cw = sw, ch = sh;
    while (cw / 2 >= w && ch / 2 >= h) {
      var nw = Math.round(cw / 2), nh = Math.round(ch / 2), t = makeCanvas(nw, nh), tc = ctx2d(t);
      tc.imageSmoothingEnabled = true; tc.imageSmoothingQuality = 'high';
      tc.drawImage(cur, 0, 0, cw, ch, 0, 0, nw, nh);
      cur = t; cw = nw; ch = nh;
    }
    var c = makeCanvas(w, h), x = ctx2d(c);
    if (flatten) { x.fillStyle = flatten; x.fillRect(0, 0, w, h); }
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(cur, 0, 0, cw, ch, 0, 0, w, h);
    return c;
  }
  function hasAlpha(src, sw, sh) {
    var s = Math.min(1, 128 / Math.max(sw, sh)), w = Math.max(1, Math.round(sw * s)), h = Math.max(1, Math.round(sh * s));
    var c = makeCanvas(w, h), x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(src, 0, 0, w, h);
    var d = x.getImageData(0, 0, w, h).data;
    for (var i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
    return false;
  }
  async function encode(src, sw, sh, w, h, fmt, q, bg) {
    var c = draw(src, sw, sh, w, h, fmt === 'jpeg' ? bg : null);
    var b = await toBlob(c, MIME[fmt], fmt === 'png' ? undefined : q);
    if (!b || b.type !== MIME[fmt]) throw new Error('unsupported:' + fmt);
    return b;
  }

  /* opts: { format, quality (0-1), maxWidth (0 = none), responsive, bg } */
  async function processFile(file, opts) {
    var src = await decode(file);
    var d = dims(src), sw = d.w, sh = d.h, notes = [];
    if (!sw || !sh) throw new Error('decode');
    var sup = await detect();
    var alpha = hasAlpha(src, sw, sh);

    // largest output width: original, capped by max width and the canvas area limit
    var top = opts.maxWidth ? Math.min(sw, opts.maxWidth) : sw;
    if (top * Math.round(sh * top / sw) > MAX_AREA) {
      top = Math.floor(Math.sqrt(MAX_AREA * sw / sh));
      notes.push('Very large image: scaled to ' + top + ' px wide to stay within browser limits.');
    }
    var widths = [top];
    if (opts.responsive) {
      widths = RESPONSIVE.filter(function (x) { return x < top; }).concat([top]);
      widths = widths.filter(function (x, i) { return widths.indexOf(x) === i; }).sort(function (a, b) { return a - b; });
    }
    var hOf = function (w) { return Math.max(1, Math.round(sh * w / sw)); };

    // choose the format at the largest size
    var fmt = opts.format, q = opts.quality;
    var big = { w: top, h: hOf(top) }, best = null;
    if (fmt === 'auto') {
      var cands = ['avif', 'webp', 'jpeg'].filter(function (f) { return sup[f] && !(f === 'jpeg' && alpha); });
      if (!cands.length) cands = ['png'];
      for (var i = 0; i < cands.length; i++) {
        try {
          var b = await encode(src, sw, sh, big.w, big.h, cands[i], q, opts.bg);
          if (!best || b.size < best.blob.size) best = { fmt: cands[i], blob: b };
        } catch (e) { /* this format failed here: skip it */ }
      }
      if (!best) throw new Error('encode');
      fmt = best.fmt;
    } else if (!sup[fmt]) {
      notes.push((fmt === 'avif' ? 'AVIF' : fmt.toUpperCase()) + " isn't supported by this browser: saved as WebP instead.");
      fmt = sup.webp ? 'webp' : 'jpeg';
    }
    if (fmt === 'jpeg' && alpha) notes.push('Transparent areas were filled with the background colour, because JPEG has no transparency.');

    var outs = [];
    for (var k = 0; k < widths.length; k++) {
      var w = widths[k], h = hOf(w);
      var blob = (best && w === big.w) ? best.blob : await encode(src, sw, sh, w, h, fmt, q, opts.bg);
      outs.push({ w: w, h: h, fmt: fmt, blob: blob });
    }
    // AVIF isn't displayed everywhere yet: add a WebP fallback set for the <picture> snippet
    var fallback = [];
    if (fmt === 'avif' && opts.responsive && sup.webp) {
      for (var m = 0; m < widths.length; m++) {
        fallback.push({ w: widths[m], h: hOf(widths[m]), fmt: 'webp', blob: await encode(src, sw, sh, widths[m], hOf(widths[m]), 'webp', q, opts.bg) });
      }
    }
    if (src.close) src.close();
    return { sw: sw, sh: sh, alpha: alpha, fmt: fmt, auto: opts.format === 'auto', outs: outs, fallback: fallback, notes: notes };
  }

  /* ---------------------------------------------------------------
     Worker side
     --------------------------------------------------------------- */
  if (IS_WORKER) {
    self.onmessage = function (e) {
      var m = e.data;
      if (m.type === 'detect') { detect().then(function (s) { self.postMessage({ type: 'detect', support: s }); }); return; }
      processFile(m.file, m.opts).then(
        function (r) { self.postMessage({ id: m.id, ok: true, result: r }); },
        function (err) { self.postMessage({ id: m.id, ok: false, error: String(err && err.message || err) }); }
      );
    };
    return;
  }

  /* ---------------------------------------------------------------
     Page side
     --------------------------------------------------------------- */
  var SRC = document.currentScript && document.currentScript.src;
  var $ = function (id) { return document.getElementById(id); };
  var drop = $('ioDrop'), input = $('ioFile'), form = $('ioSettings'), statusEl = $('ioStatus');
  var results = $('ioResults'), list = $('ioList'), summary = $('ioSummary');
  if (!drop || !form) return;

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      [].concat(c).forEach(function (x) { if (x != null && x !== false) el.append(x.nodeType ? x : document.createTextNode(String(x))); });
    }
    return el;
  }
  function kb(n) { return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB' : (n / 1048576).toFixed(2) + ' MB'; }
  function fmtName(f) { return { webp: 'WebP', avif: 'AVIF', jpeg: 'JPEG', png: 'PNG', gif: 'GIF', svg: 'SVG' }[f] || (f || '').toUpperCase(); }
  function srcFmt(file) { var t = (file.type || '').split('/')[1] || ''; return t === 'jpg' ? 'jpeg' : t.replace('svg+xml', 'svg'); }
  function baseName(n) { return (n.replace(/\.[^.]+$/, '') || 'image').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'image'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function say(t) { statusEl.textContent = t; }

  /* ---------- settings ---------- */
  var support = null;
  function opts() {
    var f = form.elements;
    return {
      format: f.format.value,
      quality: (+f.quality.value) / 100,
      maxWidth: +f.maxWidth.value,
      responsive: f.responsive.checked,
      bg: f.bg.value || '#ffffff'
    };
  }
  function pathPrefix() { var p = form.elements.path.value.trim(); return p && !/\/$/.test(p) ? p + '/' : p; }
  form.elements.quality.addEventListener('input', function () { form.elements.qOut.value = form.elements.quality.value; });
  function syncQuality() { var png = form.elements.format.value === 'png'; form.elements.quality.disabled = png; form.elements.quality.closest('label').classList.toggle('io-off', png); }

  /* ---------- worker with page fallback ---------- */
  var worker = null, pending = {}, seq = 0;
  try {
    if (SRC && typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined') {
      worker = new Worker(SRC);
      worker.onmessage = function (e) {
        var m = e.data;
        if (m.type === 'detect') return;
        var p = pending[m.id]; if (!p) return;
        delete pending[m.id];
        m.ok ? p.resolve(m.result) : p.reject(new Error(m.error));
      };
      worker.onerror = function () {
        worker = null;   // fall back to the page for anything waiting
        Object.keys(pending).forEach(function (id) { pending[id].reject(new Error('decode')); delete pending[id]; });
      };
    }
  } catch (e) { worker = null; }
  function run(file, o) {
    if (!worker) return processFile(file, o);
    return new Promise(function (resolve, reject) {
      var id = ++seq; pending[id] = { resolve: resolve, reject: reject };
      worker.postMessage({ id: id, file: file, opts: o });
    }).catch(function (err) {
      // e.g. a format the worker can't decode (HEIC in some browsers): retry on the page
      if (/decode|encode/.test(err.message)) return processFile(file, o);
      throw err;
    });
  }

  /* ---------- state ---------- */
  var items = [], gen = 0, busy = false;
  function addFiles(files) {
    var added = 0;
    Array.prototype.forEach.call(files, function (f) {
      if (!f || !/^image\//.test(f.type) && !/\.(heic|heif|avif|webp)$/i.test(f.name)) return;
      items.push({ id: items.length + '-' + Date.now(), file: f, name: f.name || 'pasted-image.png', state: 'queued', res: null, urls: [] });
      added++;
    });
    if (!added) { say('No images found. Choose JPEG, PNG, WebP, AVIF or GIF files.'); return; }
    results.hidden = false;
    render();
    queue();
  }
  function revoke(it) { it.urls.forEach(URL.revokeObjectURL); it.urls = []; }
  function url(it, blob) { var u = URL.createObjectURL(blob); it.urls.push(u); return u; }

  async function queue() {
    if (busy) return;
    busy = true;
    var g = gen;
    while (true) {
      var it = items.find(function (x) { return x.state === 'queued'; });
      if (!it) break;
      it.state = 'working'; renderItem(it);
      var done = items.filter(function (x) { return x.state === 'done' || x.state === 'error' || x.state === 'skipped'; }).length;
      say('Optimising ' + (done + 1) + ' of ' + items.length + '…');
      var sf = srcFmt(it.file);
      if (sf === 'svg') { it.state = 'skipped'; it.err = 'SVG is a vector format, so pixel compression would make it worse. Minify it with SVGO instead.'; renderItem(it); continue; }
      try {
        var r = await run(it.file, opts());
        if (g !== gen) { busy = false; return queue(); }   // settings changed mid-run
        it.res = r; it.state = 'done';
        if (sf === 'gif') r.notes.push('Only the first frame of an animated GIF is kept. For animation, use a looping MP4 or WebM video instead.');
      } catch (err) {
        if (g !== gen) { busy = false; return queue(); }
        it.state = 'error';
        it.err = /decode/.test(err.message)
          ? "This browser can't read this file" + (/heic|heif/i.test(it.name) ? ' (HEIC photos open only in Safari; export as JPEG first).' : '. Try exporting it as JPEG or PNG first.')
          : 'Something went wrong while encoding this image.';
      }
      renderItem(it); renderSummary();
    }
    busy = false;
    var ok = items.filter(function (x) { return x.state === 'done'; }).length;
    say(ok ? 'Done. ' + ok + ' image' + (ok === 1 ? '' : 's') + ' optimised.' : '');
  }
  function reprocess() {
    if (!items.length) return;
    gen++;
    items.forEach(function (it) { if (it.state !== 'skipped') it.state = 'queued'; });
    render();
    queue();
  }
  var t = null;
  form.addEventListener('change', function (e) {
    if (e.target.name === 'path') { render(); return; }
    syncQuality();
    clearTimeout(t); t = setTimeout(reprocess, 250);
  });
  form.elements.path.addEventListener('input', function () { clearTimeout(t); t = setTimeout(render, 300); });

  /* ---------- output helpers ---------- */
  function outName(it, o, multi) {
    var b = baseName(it.name), same = EXT[o.fmt] === (it.name.split('.').pop() || '').toLowerCase().replace('jpeg', 'jpg');
    return b + (multi ? '-' + o.w : '') + (same && !multi ? '-optimised' : '') + '.' + EXT[o.fmt];
  }
  function mainOut(it) { var r = it.res; return r.outs[r.outs.length - 1]; }
  function keepsOriginal(it) {
    var r = it.res, o = mainOut(it);
    return r.outs.length === 1 && o.w === r.sw && o.blob.size >= it.file.size && (r.auto || o.fmt === srcFmt(it.file));
  }
  function files(it) {
    var r = it.res, multi = r.outs.length > 1, arr = [];
    if (keepsOriginal(it)) return [{ name: it.name, blob: it.file }];
    r.outs.forEach(function (o) { arr.push({ name: outName(it, o, multi), blob: o.blob }); });
    r.fallback.forEach(function (o) { arr.push({ name: outName(it, o, true), blob: o.blob }); });
    return arr;
  }
  function snippet(it) {
    var r = it.res, p = pathPrefix(), o = mainOut(it), multi = r.outs.length > 1;
    var src = function (x) { return p + outName(it, x, multi); };
    var set = function (arr) { return arr.map(function (x) { return src(x) + ' ' + x.w + 'w'; }).join(',\n             '); };
    var sizes = '(max-width: ' + o.w + 'px) 100vw, ' + o.w + 'px';
    var img = function (arr) {
      var main = arr[arr.length - 1];
      return '<img src="' + src(main) + '"' +
        (multi ? '\n     srcset="' + set(arr) + '"\n     sizes="' + sizes + '"' : '') +
        '\n     width="' + main.w + '" height="' + main.h + '"\n     alt="Describe the image" loading="lazy" decoding="async">';
    };
    if (r.fallback.length) {
      return '<picture>\n  <source type="image/avif"\n          srcset="' + set(r.outs).replace(/\n {13}/g, '\n                  ') + '"\n          sizes="' + sizes + '">\n  ' +
        img(r.fallback).replace(/\n/g, '\n  ') + '\n</picture>';
    }
    return img(r.outs);
  }
  function download(name, blob) {
    var a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  /* ---------- rendering ---------- */
  function render() {
    list.textContent = '';
    items.forEach(function (it) { it.el = h('li', { class: 'io-item' }); list.append(it.el); renderItem(it); });
    renderSummary();
    results.hidden = !items.length;
  }
  function renderItem(it) {
    var el = it.el; if (!el) return;
    revoke(it);
    el.textContent = '';
    el.dataset.state = it.state;
    var sf = srcFmt(it.file);
    var head = h('div', { class: 'io-item-head' },
      h('p', { class: 'io-name', text: it.name }),
      h('p', { class: 'io-orig muted' }, (it.res ? it.res.sw + ' × ' + it.res.sh + ' · ' : '') + fmtName(sf) + ' · ' + kb(it.file.size)));
    if (it.state === 'queued' || it.state === 'working') {
      el.append(h('div', { class: 'io-thumb io-wait', 'aria-hidden': 'true' }), h('div', { class: 'io-body' }, head,
        h('p', { class: 'muted io-small' }, it.state === 'working' ? 'Optimising…' : 'Waiting…')));
      return;
    }
    if (it.state === 'error' || it.state === 'skipped') {
      el.append(h('div', { class: 'io-thumb io-wait', 'aria-hidden': 'true' }), h('div', { class: 'io-body' }, head,
        h('p', { class: 'io-err', text: it.err })));
      return;
    }
    var r = it.res, o = mainOut(it), keep = keepsOriginal(it);
    var saved = keep ? 0 : 1 - o.blob.size / it.file.size;
    var tone = keep ? 'mid' : saved >= 0.3 ? 'good' : saved > 0 ? 'mid' : 'bad';
    var thumbUrl = url(it, keep ? it.file : o.blob);
    var outLine = keep
      ? h('p', { class: 'io-out' }, h('strong', { text: 'Already optimised' }), ' · re-encoding made it bigger, so the original is kept')
      : h('p', { class: 'io-out' }, h('strong', { text: o.w + ' × ' + o.h + ' · ' + fmtName(o.fmt) + ' · ' + kb(o.blob.size) }),
          r.outs.length > 1 ? ' (largest of ' + r.outs.length + ' sizes)' : '');
    var badge = h('span', { class: 'io-badge io-' + tone, text: keep ? '0%' : (saved > 0 ? '−' + Math.min(99, Math.floor(saved * 100)) : '+' + Math.round(-saved * 100)) + '%' });
    var fl = files(it);
    var actions = h('div', { class: 'io-actions' },
      h('button', { class: 'btn solid pc-sm', type: 'button', 'data-track': 'io-download', onclick: function () {
        if (fl.length === 1) download(fl[0].name, fl[0].blob);
        else zip(fl).then(function (z) { download(baseName(it.name) + '-sizes.zip', z); });
      } }, fl.length === 1 ? 'Download' : 'Download ' + fl.length + ' files (ZIP)'),
      keep ? null : h('button', { class: 'btn ghost pc-sm', type: 'button', onclick: function () { compare(it); } }, 'Compare'));
    var extra = [];
    if (!keep && saved < 0) extra.push(h('p', { class: 'io-note', text: 'Bigger than the original. ' + (o.fmt === 'png' ? 'PNG is lossless, so photos grow a lot: choose Smallest, WebP or JPEG.' : 'Try Smallest, or a lower quality.') }));
    r.notes.forEach(function (n) { extra.push(h('p', { class: 'io-note', text: n })); });
    if (!keep) {
      if (r.outs.length > 1 || r.fallback.length) {
        extra.push(h('details', { class: 'io-more' }, h('summary', { text: 'All files' }),
          h('ul', { class: 'io-files' }, fl.map(function (f) {
            return h('li', null, h('a', { href: url(it, f.blob), download: f.name, text: f.name }), ' ', h('span', { class: 'muted', text: kb(f.blob.size) }));
          }))));
      }
      var code = snippet(it);
      extra.push(h('details', { class: 'io-more' }, h('summary', { text: 'HTML snippet' }),
        h('pre', { class: 'io-code', tabindex: '0' }, h('code', { text: code })),
        h('button', { class: 'pc-link', type: 'button', onclick: function (e) {
          var b = e.currentTarget;
          navigator.clipboard.writeText(code).then(function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy snippet'; }, 2000); });
        } }, 'Copy snippet')));
    }
    el.append(
      h('div', { class: 'io-thumb' }, h('img', { src: thumbUrl, alt: '', width: o.w, height: o.h, loading: 'lazy' })),
      h('div', { class: 'io-body' }, head, h('div', { class: 'io-res' }, badge, outLine), actions, extra));
  }
  function renderSummary() {
    var done = items.filter(function (x) { return x.state === 'done'; });
    summary.textContent = '';
    if (!items.length) return;
    var before = 0, after = 0;
    done.forEach(function (it) { before += it.file.size; after += keepsOriginal(it) ? it.file.size : mainOut(it).blob.size; });
    var ratio = before ? 1 - after / before : 0, pct = ratio > 0 ? Math.min(99, Math.floor(ratio * 100)) : Math.round(-ratio * 100);
    summary.append(
      h('p', { class: 'io-total' },
        h('strong', { text: done.length + ' of ' + items.length + ' image' + (items.length === 1 ? '' : 's') }),
        done.length ? ' · ' + kb(before) + ' → ' + kb(after) + ' · ' : '',
        done.length ? h('strong', { class: 'io-' + (ratio >= 0.3 ? 'good' : ratio > 0 ? 'mid' : 'bad') + '-t', text: ratio >= 0 ? pct + '% smaller' : pct + '% larger' }) : ''),
      h('div', { class: 'io-actions' },
        done.length > 1 ? h('button', { class: 'btn solid pc-sm', type: 'button', 'data-track': 'io-zip', onclick: function (e) {
          var b = e.currentTarget, all = [], seen = {};
          done.forEach(function (it) { files(it).forEach(function (f) {
            var n = f.name, i = 2; while (seen[n]) n = f.name.replace(/(\.[^.]+)$/, '-' + i++ + '$1');
            seen[n] = 1; all.push({ name: n, blob: f.blob });
          }); });
          b.disabled = true; b.textContent = 'Preparing ZIP…';
          zip(all).then(function (z) { download('optimised-images.zip', z); b.disabled = false; b.textContent = 'Download all (ZIP)'; });
        } }, 'Download all (ZIP)') : null,
        h('button', { class: 'btn ghost pc-sm', type: 'button', onclick: function () {
          items.forEach(revoke); items = []; gen++; render(); say(''); input.value = '';
        } }, 'Clear')));
  }

  /* ---------- compare dialog ---------- */
  var dlg = $('ioCmp'), range = $('ioCmpRange'), topEl = $('ioCmpTop'), zoomBtn = $('ioCmpZoom'), view = $('ioCmpView');
  function setClip() { topEl.style.clipPath = 'inset(0 ' + (100 - range.value) + '% 0 0)'; $('ioCmpStage').style.setProperty('--pos', range.value + '%'); }
  range.addEventListener('input', setClip);
  $('ioCmpClose').addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  zoomBtn.addEventListener('click', function () {
    var on = zoomBtn.getAttribute('aria-pressed') !== 'true';
    zoomBtn.setAttribute('aria-pressed', on); view.classList.toggle('io-actual', on);
    zoomBtn.textContent = on ? 'Fit to screen' : 'Actual size';
  });
  function compare(it) {
    var o = mainOut(it), r = it.res;
    var a = $('ioCmpA'), b = $('ioCmpB');
    a.src = url(it, it.file); b.src = url(it, o.blob);
    a.width = b.width = o.w; a.height = b.height = o.h;
    $('ioCmpTitle').textContent = it.name;
    $('ioCmpLa').textContent = 'Original · ' + kb(it.file.size);
    $('ioCmpLb').textContent = fmtName(o.fmt) + ' · ' + kb(o.blob.size);
    range.value = 50; setClip();
    dlg.showModal();
  }

  /* ---------- ZIP (store only: images are already compressed) ---------- */
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  async function zip(entries) {
    var enc = new TextEncoder(), parts = [], central = [], offset = 0, now = new Date();
    var time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    var date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    for (var i = 0; i < entries.length; i++) {
      var data = new Uint8Array(await entries[i].blob.arrayBuffer()), name = enc.encode(entries[i].name), crc = crc32(data);
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(lh.buffer, name, data);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
      central.push(ch.buffer, name);
      offset += 30 + name.length + data.length;
    }
    var size = central.reduce(function (s, p) { return s + p.byteLength; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(4, 0, true); end.setUint16(6, 0, true);
    end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
    end.setUint32(12, size, true); end.setUint32(16, offset, true); end.setUint16(20, 0, true);
    return new Blob(parts.concat(central, [end.buffer]), { type: 'application/zip' });
  }

  /* ---------- input: picker, drag and drop, paste ---------- */
  input.addEventListener('change', function () { addFiles(input.files); });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('io-over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('io-over'); }); });
  drop.addEventListener('drop', function (e) { if (e.dataTransfer) addFiles(e.dataTransfer.files); });
  document.addEventListener('paste', function (e) {
    if (/INPUT|TEXTAREA/.test((document.activeElement || {}).tagName) && document.activeElement.type !== 'file') return;
    var fs = [];
    Array.prototype.forEach.call((e.clipboardData && e.clipboardData.items) || [], function (x) { if (x.kind === 'file') { var f = x.getAsFile(); if (f) fs.push(f); } });
    if (fs.length) { e.preventDefault(); addFiles(fs); }
  });

  /* ---------- capabilities: hide what this browser can't create ---------- */
  detect().then(function (s) {
    support = s;
    var sel = form.elements.format;
    Array.prototype.forEach.call(sel.options, function (op) {
      if (op.value !== 'auto' && !s[op.value]) { op.disabled = true; op.textContent += ' (not supported in this browser)'; }
    });
  });
  syncQuality();
})();

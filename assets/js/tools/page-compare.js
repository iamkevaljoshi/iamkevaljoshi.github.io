/* Web page comparison: UI and content parity, entirely in the browser.
   Pages are fetched and screenshotted through Jina Reader (r.jina.ai), with Microlink as a
   screenshot fallback. Nothing is stored on a server; fetched HTML is parsed with DOMParser
   (scripts never run) and only ever rendered as text. */
(function () {
  'use strict';

  var JINA = 'https://r.jina.ai/';
  var MICROLINK = 'https://api.microlink.io/';
  var KEY_STORE = 'kj-pc-jina-key';
  var PREF_STORE = 'kj-pc-prefs';
  var CMP_MAX_W = 1000;     // screenshots are compared at this width at most
  var CMP_MAX_H = 12000;    // and this height (in comparison pixels)
  var BAND = 40;            // row band height for changed-region detection
  var SIG_COLS = 12;        // column blocks in a row signature (used to align the screenshots)
  var ALIGN_TRIES = [[1, 2500], [8, 3000]]; // [rows per unit, max edit length] from fine to coarse
  var VIEWPORTS = {
    desktop: { w: 1440, h: 900, label: 'Desktop 1440' },
    laptop: { w: 1280, h: 800, label: 'Laptop 1280' },
    tablet: { w: 768, h: 1024, label: 'Tablet 768' },
    mobile: { w: 390, h: 844, label: 'Mobile 390' }
  };
  var SENSITIVITY = { strict: 0.05, normal: 0.1, relaxed: 0.2 };
  var STRUCTURE = [
    ['Headings', 'h1,h2,h3,h4,h5,h6'],
    ['Paragraphs', 'p'],
    ['Lists', 'ul,ol'],
    ['Images', 'img'],
    ['Links', 'a[href]'],
    ['Buttons', 'button,[role="button"],input[type="submit"],input[type="button"]'],
    ['Forms', 'form'],
    ['Form fields', 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]),select,textarea'],
    ['Tables', 'table'],
    ['Embeds and video', 'iframe,video,audio,embed,object'],
    ['Header landmark', 'header,[role="banner"]'],
    ['Navigation landmark', 'nav,[role="navigation"]'],
    ['Main landmark', 'main,[role="main"]'],
    ['Footer landmark', 'footer,[role="contentinfo"]']
  ];
  var BLOCK_TAGS = /^(P|H[1-6]|LI|TD|TH|DT|DD|BLOCKQUOTE|FIGCAPTION|CAPTION|SUMMARY|LABEL|BUTTON|PRE|ADDRESS|DIV|SECTION|ARTICLE|HEADER|FOOTER|NAV|ASIDE|MAIN|FORM|FIELDSET|LEGEND|TABLE|TR|UL|OL|DL|FIGURE|DETAILS|BODY)$/;
  var STRIP = 'script,style,noscript,template,svg,canvas,[hidden],[aria-hidden="true"]';

  var $ = function (id) { return document.getElementById(id); };
  var form = $('pcForm');
  if (!form) return;

  /* ---------- tiny DOM helper: everything from fetched pages goes in as text ---------- */
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
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { add(el, x); });
    else el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }

  var norm = function (s) { return (s || '').replace(/\s+/g, ' ').trim(); };
  var pct = function (v) { return v == null ? '–' : Math.round(v * 100) + '%'; };
  var words = function (s) { return (s || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []; };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { if (v == null || v === '') localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  };

  function dice(a, b) {
    if (!a.length && !b.length) return 1;
    var m = new Map(), common = 0;
    a.forEach(function (w) { m.set(w, (m.get(w) || 0) + 1); });
    b.forEach(function (w) { var n = m.get(w); if (n) { common++; m.set(w, n - 1); } });
    return (2 * common) / (a.length + b.length);
  }
  function ratio(a, b) { return a === b ? 1 : Math.min(a, b) / Math.max(a, b); }
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return ''; } }

  /* ---------- network ---------- */
  function fetchT(url, opts, ms) {
    var ctl = new AbortController();
    var t = setTimeout(function () { ctl.abort(); }, ms);
    return fetch(url, Object.assign({}, opts, { signal: ctl.signal })).finally(function () { clearTimeout(t); });
  }
  function httpError(res, who) {
    if (res.status === 429) return new Error(who + ' rate limit reached. Wait a minute, or add a free Jina API key under Advanced options.');
    if (res.status === 401 || res.status === 403) return new Error(who + ' refused the request (' + res.status + '). It may be blocking anonymous requests to this domain: add a free Jina API key under Advanced options, or check the key you entered.');
    return new Error(who + ' returned HTTP ' + res.status + '.');
  }
  function jinaHeaders(o, format) {
    var hd = { 'Content-Type': 'application/json', 'X-Return-Format': format, 'X-Timeout': '40' };
    if (o.noCache) hd['X-No-Cache'] = 'true';
    if (o.remove) hd['X-Remove-Selector'] = o.remove;
    if (o.key) hd.Authorization = 'Bearer ' + o.key;
    return hd;
  }
  async function fetchHtml(url, o) {
    var hd = jinaHeaders(o, 'html');
    hd.Accept = 'application/json';
    if (o.key && !o.noRender) hd['X-Engine'] = 'browser'; // JavaScript rendering needs an API key
    var res = await fetchT(JINA, { method: 'POST', headers: hd, body: JSON.stringify({ url: url }) }, 90000);
    if (o.key && !o.noRender && (res.status === 401 || res.status === 402)) return fetchHtml(url, Object.assign({}, o, { noRender: true }));
    if (!res.ok) throw httpError(res, 'Jina Reader');
    var j = await res.json();
    var d = j.data || {};
    if (!d.html) throw new Error('No HTML came back' + (d.warning ? ': ' + d.warning : '.'));
    return { html: d.html, finalUrl: d.finalUrl || d.url || url, status: d.httpStatus || null, warning: d.warning || '' };
  }
  async function shotJina(url, vp, full, o) {
    var res = await fetchT(JINA, {
      method: 'POST', headers: jinaHeaders(o, full ? 'pageshot' : 'screenshot'),
      body: JSON.stringify({ url: url, viewport: { width: vp.w, height: vp.h } })
    }, 120000);
    if (!res.ok) throw httpError(res, 'Jina Reader');
    if ((res.headers.get('content-type') || '').indexOf('image/') === 0) return res.blob();
    var link = (await res.text()).trim();
    if (!/^https:\/\//.test(link)) throw new Error('Unexpected screenshot response.');
    var img = await fetchT(link, {}, 60000);
    if (!img.ok) throw new Error('Screenshot download failed (' + img.status + ').');
    return img.blob();
  }
  async function shotMicrolink(url, vp, full) {
    var q = new URLSearchParams({ url: url, screenshot: 'true', meta: 'false', 'viewport.width': vp.w, 'viewport.height': vp.h, 'viewport.deviceScaleFactor': '1' });
    if (vp.w < 800) { q.set('viewport.isMobile', 'true'); q.set('viewport.hasTouch', 'true'); }
    if (full) q.set('fullPage', 'true');
    var res = await fetchT(MICROLINK + '?' + q, {}, 90000);
    var j = await res.json().catch(function () { return {}; });
    if (!res.ok || j.status !== 'success') throw new Error('Microlink: ' + (j.message || 'HTTP ' + res.status));
    var img = await fetchT(j.data.screenshot.url, {}, 60000);
    if (!img.ok) throw new Error('Screenshot download failed (' + img.status + ').');
    return img.blob();
  }
  async function screenshot(url, vp, full, o) {
    try { return { blob: await shotJina(url, vp, full, o), via: 'Jina Reader' }; }
    catch (e1) {
      try { return { blob: await shotMicrolink(url, vp, full), via: 'Microlink' }; }
      catch (e2) { throw new Error(e1.message + ' Fallback failed too: ' + e2.message); }
    }
  }
  function loadImage(blob) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob), img = new Image();
      img.onload = function () { resolve({ img: img, url: url }); };
      img.onerror = function () { reject(new Error('The screenshot could not be decoded.')); };
      img.src = url;
    });
  }

  /* ---------- content analysis ---------- */
  function linkInfo(href, base, ctx) {
    var u;
    try { u = new URL(href, base); } catch (e) { return null; }
    if (u.protocol === 'mailto:' || u.protocol === 'tel:') return { key: u.href.toLowerCase(), internal: false };
    if (!/^https?:$/.test(u.protocol)) return null;
    var host = u.hostname.replace(/^www\./, '').toLowerCase();
    var internal = ctx.hosts.indexOf(host) !== -1;
    var path = u.pathname;
    try { path = decodeURI(path); } catch (e) { /* keep encoded */ }
    path = path.replace(/\/index\.html?$/i, '/').replace(/\.html?$/i, '').replace(/\/+$/, '') || '/';
    if (internal) ctx.prefixes.forEach(function (p) { if (p && path.indexOf(p) === 0) path = path.slice(p.length) || '/'; });
    return { key: (internal ? path : host + path).toLowerCase(), internal: internal };
  }
  function imageKey(src, base) {
    var u;
    try { u = new URL(src, base); } catch (e) { return ''; }
    if (u.protocol === 'data:') return '';
    var p = u.pathname.split(/\/(?:_jcr_content|jcr:content)\//)[0];
    var name = p.split('/').filter(Boolean).pop() || '';
    try { name = decodeURIComponent(name); } catch (e) { /* keep as is */ }
    return name.toLowerCase()
      .replace(/\.(coreimg|img)(\.[\w-]+)*$/, '')
      .replace(/\.(jpe?g|png|gif|webp|avif|svg|tiff?)$/, '')
      .replace(/(@\dx|-\d+x\d+)$/, '');
  }
  function jsonLdTypes(doc) {
    var types = new Set();
    var walk = function (n) {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(walk); return; }
      var t = n['@type'];
      if (t) [].concat(t).forEach(function (x) { types.add(String(x)); });
      if (n['@graph']) walk(n['@graph']);
    };
    doc.querySelectorAll('script[type="application/ld+json"]').forEach(function (s) {
      try { walk(JSON.parse(s.textContent)); } catch (e) { types.add('(invalid JSON-LD)'); }
    });
    return Array.from(types).sort();
  }
  function blocksOf(scope) {
    var map = new Map();
    var walker = scope.ownerDocument.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    var n;
    while ((n = walker.nextNode())) {
      if (!n.nodeValue.trim()) continue;
      var el = n.parentElement;
      while (el && el !== scope && !BLOCK_TAGS.test(el.tagName)) el = el.parentElement;
      el = el || scope;
      map.set(el, (map.get(el) || '') + ' ' + n.nodeValue);
    }
    var out = [];
    map.forEach(function (t) { t = norm(t); if (t) out.push(t); });
    return out;
  }

  function analyse(html, base, opts, ctx) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var q = function (sel, attr) { var el = doc.querySelector(sel); return el ? norm(el.getAttribute(attr)) : ''; };
    var meta = {
      title: norm(doc.title),
      description: q('meta[name="description" i]', 'content'),
      canonical: q('link[rel="canonical" i]', 'href'),
      robots: q('meta[name="robots" i]', 'content'),
      lang: norm(doc.documentElement.getAttribute('lang')),
      viewport: q('meta[name="viewport" i]', 'content'),
      ogTitle: q('meta[property="og:title" i]', 'content'),
      ogDescription: q('meta[property="og:description" i]', 'content'),
      ogImage: q('meta[property="og:image" i]', 'content'),
      twitterCard: q('meta[name="twitter:card" i]', 'content'),
      hreflang: Array.from(doc.querySelectorAll('link[rel="alternate" i][hreflang]')).map(function (l) { return l.getAttribute('hreflang').toLowerCase(); }).sort(),
      jsonLd: jsonLdTypes(doc)
    };
    doc.querySelectorAll(STRIP).forEach(function (el) { el.remove(); });
    if (opts.ignore) {
      try { doc.querySelectorAll(opts.ignore).forEach(function (el) { el.remove(); }); }
      catch (e) { throw new Error('Ignore selectors are not valid CSS: ' + opts.ignore); }
    }
    var body = doc.body || doc.documentElement;
    var structure = STRUCTURE.map(function (s) { return body.querySelectorAll(s[1]).length; });

    var scope = null, scopeLabel;
    if (opts.scope) {
      try { scope = doc.querySelector(opts.scope); } catch (e) { throw new Error('Content scope is not a valid CSS selector: ' + opts.scope); }
      if (!scope) throw new Error('Content scope "' + opts.scope + '" matched nothing on ' + base);
      scopeLabel = opts.scope;
    } else {
      scope = doc.querySelector('main') || doc.querySelector('[role="main"]');
      scopeLabel = scope ? (scope.tagName === 'MAIN' ? 'main' : '[role="main"]') : 'body';
      scope = scope || body;
    }

    var headings = Array.from(scope.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(function (el) {
      return { level: +el.tagName[1], text: norm(el.textContent) };
    }).filter(function (x) { return x.text; });
    var h1s = Array.from(doc.querySelectorAll('h1')).map(function (el) { return norm(el.textContent); }).filter(Boolean);

    var links = [];
    scope.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#') return;
      var info = linkInfo(href, base, ctx);
      if (info) links.push({ key: info.key, internal: info.internal, text: norm(a.textContent) || norm(a.getAttribute('aria-label')) || '(no text)' });
    });

    var images = Array.from(scope.querySelectorAll('img')).map(function (img) {
      var src = img.getAttribute('src') || img.getAttribute('data-src') || (img.getAttribute('srcset') || '').split(/[\s,]+/)[0] || '';
      var alt = img.getAttribute('alt');
      return { src: src, key: imageKey(src, base), alt: alt == null ? null : norm(alt) };
    }).filter(function (i) { return i.src; });

    var blocks = blocksOf(scope);
    var text = blocks.join(' ');
    return { meta: meta, h1s: h1s, structure: structure, scope: scopeLabel, headings: headings, links: links, images: images, blocks: blocks, words: words(text) };
  }

  /* ---------- comparisons ---------- */
  function cmpMeta(A, B, ctx) {
    var rows = [], a = A.meta, b = B.meta;
    var row = function (label, va, vb, status, note) { rows.push({ label: label, a: va, b: vb, status: status, note: note || '' }); };
    var textRow = function (label, va, vb, optional) {
      if (!va && !vb) { if (!optional) row(label, '', '', 'missing', 'Missing on both'); return; }
      if (!vb) return row(label, va, vb, 'missing', 'Missing on destination');
      if (!va) return row(label, va, vb, 'info', 'Only on destination');
      if (va === vb) return row(label, va, vb, 'same');
      var s = dice(words(va), words(vb));
      row(label, va, vb, s >= 0.85 ? 'similar' : 'diff', s >= 0.85 ? 'Near match (' + pct(s) + ')' : 'Differs (' + pct(s) + ' word overlap)');
    };
    textRow('Title', a.title, b.title);
    textRow('Meta description', a.description, b.description);
    textRow('H1', A.h1s.join(' | '), B.h1s.join(' | '));
    var ca = a.canonical && linkInfo(a.canonical, ctx.baseA, ctx), cb = b.canonical && linkInfo(b.canonical, ctx.baseB, ctx);
    if (!a.canonical && !b.canonical) row('Canonical', '', '', 'missing', 'Missing on both');
    else if (!b.canonical) row('Canonical', a.canonical, '', 'missing', 'Missing on destination');
    else if (!a.canonical) row('Canonical', '', b.canonical, 'info', 'Only on destination');
    else row('Canonical', a.canonical, b.canonical, ca && cb && ca.key === cb.key ? 'same' : 'diff', ca && cb && ca.key === cb.key ? 'Same path' : 'Points to a different path');
    var na = /noindex/i.test(a.robots), nb = /noindex/i.test(b.robots);
    row('Robots', a.robots || '(none: indexable)', b.robots || '(none: indexable)', na === nb ? 'same' : (nb ? 'diff' : 'similar'), nb && !na ? 'Destination is noindex' : '');
    textRow('Language', a.lang, b.lang);
    row('Viewport meta', a.viewport ? 'present' : 'missing', b.viewport ? 'present' : 'missing', !!a.viewport === !!b.viewport ? 'same' : (b.viewport ? 'similar' : 'missing'));
    textRow('og:title', a.ogTitle, b.ogTitle, true);
    textRow('og:description', a.ogDescription, b.ogDescription, true);
    row('og:image', a.ogImage ? 'present' : 'missing', b.ogImage ? 'present' : 'missing', !!a.ogImage === !!b.ogImage ? 'same' : (b.ogImage ? 'info' : 'missing'));
    var ha = a.hreflang.join(', '), hb = b.hreflang.join(', ');
    row('hreflang', ha || '(none)', hb || '(none)', ha === hb ? 'same' : (!hb ? 'missing' : 'diff'));
    var ja = a.jsonLd.join(', '), jb = b.jsonLd.join(', ');
    row('Structured data', ja || '(none)', jb || '(none)', ja === jb ? 'same' : (!jb ? 'missing' : 'diff'), ja !== jb && jb ? 'Different schema types' : '');
    var scored = rows.filter(function (r) { return r.status !== 'info'; });
    var score = scored.length ? scored.reduce(function (s, r) { return s + ({ same: 1, similar: 0.75 }[r.status] || 0); }, 0) / scored.length : 1;
    return { rows: rows, score: score };
  }

  function cmpHeadings(A, B) {
    var fmt = function (x) { return 'H' + x.level + ' ' + x.text.toLowerCase(); };
    var a = A.headings.map(fmt), b = B.headings.map(fmt);
    var parts = Diff.diffArrays(a, b);
    var common = 0;
    parts.forEach(function (p) { if (!p.added && !p.removed) common += p.count; });
    var ia = 0, ib = 0, list = [];
    parts.forEach(function (p) {
      for (var i = 0; i < p.count; i++) {
        if (p.added) list.push({ t: 'add', h: B.headings[ib++] });
        else if (p.removed) list.push({ t: 'del', h: A.headings[ia++] });
        else { list.push({ t: 'eq', h: A.headings[ia++] }); ib++; }
      }
    });
    var score = (!a.length && !b.length) ? 1 : (2 * common) / (a.length + b.length);
    return { list: list, score: score, a: a.length, b: b.length };
  }

  function cmpBlocks(A, B) {
    var key = function (s) { return s.toLowerCase(); };
    var parts = Diff.diffArrays(A.blocks.map(key), B.blocks.map(key));
    var ia = 0, ib = 0, out = [];
    for (var k = 0; k < parts.length; k++) {
      var p = parts[k], next = parts[k + 1];
      if (p.removed && next && next.added) {
        var n = Math.min(p.count, next.count);
        for (var i = 0; i < n; i++) {
          var x = A.blocks[ia++], y = B.blocks[ib++];
          if (dice(words(x), words(y)) >= 0.5) out.push({ t: 'chg', a: x, b: y });
          else { out.push({ t: 'del', a: x }); out.push({ t: 'add', b: y }); }
        }
        for (i = n; i < p.count; i++) out.push({ t: 'del', a: A.blocks[ia++] });
        for (i = n; i < next.count; i++) out.push({ t: 'add', b: B.blocks[ib++] });
        k++;
      } else if (p.removed) { for (i = 0; i < p.count; i++) out.push({ t: 'del', a: A.blocks[ia++] }); }
      else if (p.added) { for (i = 0; i < p.count; i++) out.push({ t: 'add', b: B.blocks[ib++] }); }
      else { for (i = 0; i < p.count; i++) { out.push({ t: 'eq', a: A.blocks[ia++] }); ib++; } }
    }
    return { list: out, score: dice(A.words, B.words), wordsA: A.words.length, wordsB: B.words.length };
  }

  function cmpLinks(A, B) {
    var setA = new Map(), setB = new Map();
    A.links.forEach(function (l) { if (!setA.has(l.key)) setA.set(l.key, l); });
    B.links.forEach(function (l) { if (!setB.has(l.key)) setB.set(l.key, l); });
    var missing = [], added = [], common = 0;
    setA.forEach(function (l, k) { if (setB.has(k)) common++; else missing.push(l); });
    setB.forEach(function (l, k) { if (!setA.has(k)) added.push(l); });
    var score = (!setA.size && !setB.size) ? 1 : (2 * common) / (setA.size + setB.size);
    return { score: score, missing: missing, added: added, a: setA.size, b: setB.size, common: common };
  }

  function cmpImages(A, B) {
    var byKey = new Map(), byAlt = new Map(), used = new Set();
    A.images.forEach(function (img, i) {
      if (img.key) byKey.set(img.key, (byKey.get(img.key) || []).concat(i));
      if (img.alt) byAlt.set(img.alt.toLowerCase(), (byAlt.get(img.alt.toLowerCase()) || []).concat(i));
    });
    var take = function (map, k) {
      var list = k && map.get(k);
      if (!list) return -1;
      for (var j = 0; j < list.length; j++) if (!used.has(list[j])) { used.add(list[j]); return list[j]; }
      return -1;
    };
    var added = [];
    B.images.forEach(function (img) {
      if (take(byKey, img.key) === -1 && take(byAlt, img.alt && img.alt.toLowerCase()) === -1) added.push(img);
    });
    var missing = A.images.filter(function (_, i) { return !used.has(i); });
    var noAlt = function (list) { return list.filter(function (i) { return i.alt == null; }).length; };
    var na = A.images.length, nb = B.images.length;
    return { score: (!na && !nb) ? 1 : (2 * used.size) / (na + nb), matched: used.size, missing: missing, added: added, a: na, b: nb, noAltA: noAlt(A.images), noAltB: noAlt(B.images) };
  }

  function cmpStructure(A, B) {
    var rows = STRUCTURE.map(function (s, i) { return { label: s[0], a: A.structure[i], b: B.structure[i], r: ratio(A.structure[i], B.structure[i]) }; });
    return { rows: rows, score: rows.reduce(function (s, r) { return s + r.r; }, 0) / rows.length };
  }

  /* ---------- visual comparison ---------- */
  function drawTo(img, W) {
    var s = W / img.naturalWidth, H = Math.round(img.naturalHeight * s);
    return { s: s, h: H };
  }
  function palette(data, w, h) {
    var hist = new Float64Array(4096), n = 0;
    for (var i = 0; i < w * h; i += 7) {
      var o = i * 4;
      hist[((data[o] >> 4) << 8) | ((data[o + 1] >> 4) << 4) | (data[o + 2] >> 4)]++;
      n++;
    }
    for (i = 0; i < 4096; i++) hist[i] /= n || 1;
    return hist;
  }
  function topColours(hist) {
    var idx = Array.from(hist.keys()).sort(function (x, y) { return hist[y] - hist[x]; }).slice(0, 6);
    return idx.filter(function (i) { return hist[i] >= 0.01; }).map(function (i) {
      var c = function (v) { return ((v << 4) + 8).toString(16).padStart(2, '0'); };
      return { hex: '#' + c(i >> 8) + c((i >> 4) & 15) + c(i & 15), share: hist[i] };
    });
  }

  /* Rows are aligned before comparing, so a section that is taller or shorter (a lazy-loaded
     block, a rotating banner of a different height) doesn't mark everything below it as changed. */
  function rowSigs(data, W, H, R) {
    var C = SIG_COLS, cw = W / C, pre = new Float32Array((H + 1) * C);
    for (var y = 0; y < H; y++) {
      for (var c = 0; c < C; c++) {
        var x0 = Math.floor(c * cw), x1 = Math.floor((c + 1) * cw), sum = 0, cnt = 0;
        for (var x = x0; x < x1; x += 2) {
          var i = (y * W + x) * 4;
          sum += data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
          cnt++;
        }
        pre[(y + 1) * C + c] = pre[y * C + c] + sum / (cnt || 1);
      }
    }
    // single rows are blurred over 3 rows so a sub-pixel shift between the captures still matches
    var pad = R === 1 ? 1 : 0, n = H / R, out = new Array(n);
    for (var u = 0; u < n; u++) {
      var y0 = Math.max(0, u * R - pad), y1 = Math.min(H, (u + 1) * R + pad), sig = '';
      for (c = 0; c < C; c++) {
        var mean = (pre[y1 * C + c] - pre[y0 * C + c]) / (y1 - y0);
        sig += String.fromCharCode(48 + Math.min(3, Math.floor(mean / 64)));
      }
      out[u] = sig;
    }
    return out;
  }
  function planFrom(parts) {
    var ia = 0, ib = 0, plan = [];
    for (var k = 0; k < parts.length; k++) {
      var p = parts[k], next = parts[k + 1], i;
      if (p.removed && next && next.added) {
        var n = Math.min(p.count, next.count);
        for (i = 0; i < n; i++) plan.push({ a: ia++, b: ib++ });
        for (i = n; i < p.count; i++) plan.push({ a: ia++, b: -1 });
        for (i = n; i < next.count; i++) plan.push({ a: -1, b: ib++ });
        k++;
      } else if (p.removed) { for (i = 0; i < p.count; i++) plan.push({ a: ia++, b: -1 }); }
      else if (p.added) { for (i = 0; i < p.count; i++) plan.push({ a: -1, b: ib++ }); }
      else { for (i = 0; i < p.count; i++) plan.push({ a: ia++, b: ib++ }); }
    }
    return plan;
  }
  function alignRows(pa, pb, W, HA, HB) {
    for (var t = 0; t < ALIGN_TRIES.length; t++) {
      var R = ALIGN_TRIES[t][0];
      var parts = Diff.diffArrays(rowSigs(pa, W, HA, R), rowSigs(pb, W, HB, R), { maxEditLength: ALIGN_TRIES[t][1] });
      if (parts) return { R: R, plan: planFrom(parts), aligned: true };
    }
    // pages too different to align: compare position by position
    var na = HA / 8, nb = HB / 8, plan = [];
    for (var i = 0; i < Math.max(na, nb); i++) plan.push({ a: i < na ? i : -1, b: i < nb ? i : -1 });
    return { R: 8, plan: plan, aligned: false };
  }

  function compareVisual(A, B, vp, threshold) {
    var W = Math.min(A.img.naturalWidth, B.img.naturalWidth, CMP_MAX_W);
    var da = drawTo(A.img, W), db = drawTo(B.img, W);
    var pad = function (h) { return Math.ceil(Math.min(h, CMP_MAX_H) / 8) * 8; };
    var HA = pad(da.h), HB = pad(db.h);
    var draw = function (img, h, drawH) {
      var c = document.createElement('canvas');
      c.width = W; c.height = h;
      var x = c.getContext('2d', { willReadFrequently: true });
      x.fillStyle = '#fff'; x.fillRect(0, 0, W, h);
      x.drawImage(img, 0, 0, W, drawH);
      return x.getImageData(0, 0, W, h).data;
    };
    var pa = draw(A.img, HA, da.h), pb = draw(B.img, HB, db.h);
    var al = alignRows(pa, pb, W, HA, HB), plan = al.plan, R = al.R;
    var Hm = plan.length * R;

    var cd = document.createElement('canvas');
    cd.width = W; cd.height = Hm;
    var xd = cd.getContext('2d'), out = xd.createImageData(W, Hm), po = out.data;
    var maxDelta = 35215 * threshold * threshold, rows = new Uint32Array(Hm), diff = 0;
    var paintRow = function (y, r, g, bl) {
      for (var x = 0, o = y * W * 4; x < W; x++, o += 4) { po[o] = r; po[o + 1] = g; po[o + 2] = bl; po[o + 3] = 255; }
    };
    // YIQ colour distance between a source pixel and a destination pixel
    var delta = function (oa, ob) {
      var dr = pa[oa] - pb[ob], dg = pa[oa + 1] - pb[ob + 1], dbl = pa[oa + 2] - pb[ob + 2];
      var Y = dr * 0.29889531 + dg * 0.58662247 + dbl * 0.11448223;
      var I = dr * 0.59597799 - dg * 0.2741761 - dbl * 0.32180189;
      var Q = dr * 0.21147017 - dg * 0.52261711 + dbl * 0.31114694;
      return 0.5053 * Y * Y + 0.299 * I * I + 0.1957 * Q * Q;
    };
    // a pixel that only differs from its neighbours by anti-aliasing or a sub-pixel shift is not a real difference
    var nearMatch = function (oa, x, rb) {
      for (var dy = -1; dy <= 1; dy++) {
        var yy2 = rb + dy;
        if (yy2 < 0 || yy2 >= HB) continue;
        for (var dx = -1; dx <= 1; dx++) {
          var xx = x + dx;
          if ((dx === 0 && dy === 0) || xx < 0 || xx >= W) continue;
          if (delta(oa, (yy2 * W + xx) * 4) <= maxDelta) return true;
        }
      }
      return false;
    };
    for (var m = 0; m < plan.length; m++) {
      var e = plan[m];
      for (var r = 0; r < R; r++) {
        var y = m * R + r;
        if (e.a < 0 || e.b < 0) { paintRow(y, 230, 40, 60); rows[y] = W; diff += W; continue; }
        var rb = e.b * R + r, oa = ((e.a * R + r) * W) * 4, ob = (rb * W) * 4, oo = y * W * 4;
        for (var x = 0; x < W; x++, oa += 4, ob += 4, oo += 4) {
          if (delta(oa, ob) > maxDelta && !nearMatch(oa, x, rb)) {
            po[oo] = 230; po[oo + 1] = 40; po[oo + 2] = 60; po[oo + 3] = 255;
            rows[y]++; diff++;
          } else {
            var g = 255 - (255 - (pa[oa] * 0.3 + pa[oa + 1] * 0.59 + pa[oa + 2] * 0.11)) * 0.18;
            po[oo] = po[oo + 1] = po[oo + 2] = g; po[oo + 3] = 255;
          }
        }
      }
    }
    xd.putImageData(out, 0, 0);

    var foldH = Math.min(Hm, Math.round(vp.h * (W / vp.w)));
    var foldDiff = 0;
    for (var yy = 0; yy < foldH; yy++) foldDiff += rows[yy];

    var dstScale = 1 / db.s, regions = [], cur = null;
    for (var b0 = 0; b0 < Hm; b0 += BAND) {
      var b1 = Math.min(Hm, b0 + BAND), sum = 0;
      for (yy = b0; yy < b1; yy++) sum += rows[yy];
      if (sum / (W * (b1 - b0)) > 0.05) {
        if (cur && cur.y1 === b0) { cur.y1 = b1; cur.sum += sum; }
        else { cur = { y0: b0, y1: b1, sum: sum }; regions.push(cur); }
      }
    }
    regions = regions.map(function (g) {
      var onlyA = 0, onlyB = 0, firstB = -1, lastB = -1, n = 0;
      for (var q = Math.floor(g.y0 / R); q < Math.ceil(g.y1 / R) && q < plan.length; q++) {
        n++;
        if (plan[q].b < 0) onlyA++; else { onlyB += plan[q].a < 0 ? 1 : 0; if (firstB < 0) firstB = plan[q].b; lastB = plan[q].b; }
      }
      if (firstB < 0) { for (var z = Math.floor(g.y0 / R); z >= 0; z--) if (plan[z].b >= 0) { firstB = lastB = plan[z].b; break; } }
      var kind = onlyA / n > 0.5 ? 'only in source' : onlyB / n > 0.5 ? 'only in destination' : 'changed';
      return {
        y0: Math.round(Math.max(0, firstB) * R * dstScale), y1: Math.round((Math.max(0, lastB) + 1) * R * dstScale),
        cy0: g.y0, cy1: g.y1, share: g.sum / (W * (g.y1 - g.y0)), kind: kind
      };
    });

    var hA = palette(pa, W, HA), hB = palette(pb, W, HB), inter = 0;
    for (var k = 0; k < 4096; k++) inter += Math.min(hA[k], hB[k]);

    return {
      width: W, height: Hm, diffCanvas: cd,
      similarity: 1 - diff / (W * Hm),
      fold: foldH ? 1 - foldDiff / (W * foldH) : null,
      palette: inter, coloursA: topColours(hA), coloursB: topColours(hB),
      heightA: A.img.naturalHeight, heightB: B.img.naturalHeight,
      truncated: Math.max(da.h, db.h) > CMP_MAX_H, aligned: al.aligned,
      regions: regions
    };
  }

  /* ---------- findings ---------- */
  function findings(r) {
    var f = [], c = r.content, v = r.visual;
    var push = function (level, text) { f.push({ level: level, text: text }); };
    var trim = function (u) { return u.replace(/\/+$/, ''); };
    if (r.finalA && trim(r.finalA) === trim(r.finalB)) push('info', 'Both sides use the same URL, so any difference comes from the page changing between the two captures (rotating banners, lazy-loaded sections, chat widgets or cookie pop-ups). Use Ignore elements to hide them.');
    if (r.status.b && r.status.b >= 400) push('critical', 'The destination returned HTTP ' + r.status.b + '.');
    if (r.status.a && r.status.a >= 400) push('warn', 'The source returned HTTP ' + r.status.a + '. Check the source URL.');
    var robots = c.meta.rows.find(function (x) { return x.label === 'Robots'; });
    if (robots && robots.note === 'Destination is noindex') push('critical', 'The destination is set to noindex, so search engines will drop it.');
    var canon = c.meta.rows.find(function (x) { return x.label === 'Canonical'; });
    if (canon && canon.b && r.hostA !== r.hostB && hostOf(canon.b) === r.hostA) push('critical', 'The destination canonical points to the source domain (' + r.hostA + ').');
    else if (canon && canon.status === 'missing' && canon.a) push('warn', 'The destination has no canonical link.');
    if (!r.analysisB.h1s.length && r.analysisA.h1s.length) push('warn', 'The destination has no H1.');
    if (r.analysisB.h1s.length > 1) push('info', 'The destination has ' + r.analysisB.h1s.length + ' H1 headings.');
    ['Title', 'Meta description'].forEach(function (k) {
      var row = c.meta.rows.find(function (x) { return x.label === k; });
      if (row && row.status === 'missing' && row.a) push('warn', k + ' is missing on the destination.');
      else if (row && row.status === 'diff') push('warn', k + ' differs between pages.');
    });
    var wa = c.text.wordsA, wb = c.text.wordsB;
    if (wa && wb < wa * 0.9) push(wb < wa * 0.7 ? 'critical' : 'warn', 'The destination has ' + Math.round((1 - wb / wa) * 100) + '% fewer words (' + wb + ' vs ' + wa + ').');
    if (c.links.missing.length) push(c.links.missing.length > 5 ? 'warn' : 'info', c.links.missing.length + ' link target' + (c.links.missing.length > 1 ? 's are' : ' is') + ' missing on the destination.');
    if (c.images.missing.length) push('info', c.images.missing.length + ' source image' + (c.images.missing.length > 1 ? 's have' : ' has') + ' no match on the destination (by file name or alt text).');
    if (c.images.noAltB > c.images.noAltA) push('warn', c.images.noAltB + ' destination image' + (c.images.noAltB > 1 ? 's have' : ' has') + ' no alt attribute (source: ' + c.images.noAltA + ').');
    var hl = c.meta.rows.find(function (x) { return x.label === 'hreflang'; });
    if (hl && hl.status === 'missing' && hl.a !== '(none)') push('warn', 'hreflang annotations are missing on the destination.');
    if (v) {
      var hd = Math.abs(v.heightA - v.heightB) / Math.max(v.heightA, v.heightB);
      if (hd > 0.15) push('warn', 'Page height differs by ' + Math.round(hd * 100) + '% (' + v.heightA + 'px vs ' + v.heightB + 'px). Sections may be missing or added.');
      if (v.fold != null && v.fold < 0.8) push('warn', 'The first screen differs noticeably (' + pct(v.fold) + ' match).');
    }
    if (!f.some(function (x) { return x.level !== 'info'; })) push('ok', 'No major parity issues found.');
    return f;
  }
  function verdict(s) {
    if (s == null) return 'Not available';
    if (s >= 0.95) return 'Near-identical';
    if (s >= 0.85) return 'Minor differences';
    if (s >= 0.65) return 'Noticeable differences';
    return 'Major differences';
  }

  /* ---------- progress UI ---------- */
  var steps = $('pcSteps');
  function step(id, label) {
    var li = h('li', { 'data-state': 'wait', id: 'pcs-' + id }, h('span', { class: 'pc-dot', 'aria-hidden': 'true' }), h('span', { class: 'pc-step-l', text: label }), h('span', { class: 'pc-step-d' }));
    steps.appendChild(li);
    return {
      set: function (state, detail) {
        li.setAttribute('data-state', state);
        li.querySelector('.pc-step-d').textContent = detail || '';
      }
    };
  }

  /* ---------- report rendering ---------- */
  function ring(label, value, sub) {
    var c = 2 * Math.PI * 52, v = value == null ? 0 : value;
    var tone = value == null ? 'na' : v >= 0.85 ? 'good' : v >= 0.65 ? 'mid' : 'bad';
    var svg = '<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="pc-ring-bg"/>' +
      '<circle cx="60" cy="60" r="52" class="pc-ring-fg" stroke-dasharray="' + (c * v).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 60 60)"/></svg>';
    var wrap = h('div', { class: 'pc-score pc-' + tone });
    var g = h('div', { class: 'pc-ring' });
    g.innerHTML = svg;
    g.appendChild(h('strong', { text: value == null ? '–' : Math.round(v * 100) + '%' }));
    add(wrap, [g, h('div', null, h('h3', { text: label }), h('p', { class: 'pc-verdict', text: verdict(value) }), h('p', { class: 'muted', text: sub }))]);
    return wrap;
  }
  function meter(label, value, note) {
    return h('div', { class: 'pc-meter' },
      h('div', { class: 'pc-meter-h' }, h('span', { text: label }), h('strong', { text: pct(value) })),
      h('div', { class: 'pc-bar' }, h('span', { style: 'width:' + Math.round((value || 0) * 100) + '%' })),
      note ? h('p', { class: 'muted', text: note }) : null);
  }
  function card(title, intro) {
    var d = h('details', { class: 'pc-card', open: true }, h('summary', null, h('h3', { text: title })));
    if (intro) d.appendChild(h('p', { class: 'muted pc-intro', text: intro }));
    return d;
  }
  function table(head, rows) {
    return h('div', { class: 'pc-table-wrap' }, h('table', { class: 'pc-table' },
      h('thead', null, h('tr', null, head.map(function (x) { return h('th', { scope: 'col', text: x }); }))),
      h('tbody', null, rows)));
  }
  var STATUS = { same: 'Match', similar: 'Close', diff: 'Differs', missing: 'Missing', info: 'Info' };

  function renderVisual(r, out) {
    var c = card('Visual comparison', 'Screenshots taken at ' + r.vp.label + ' (' + (r.full ? 'full page' : 'first screen') + '). Rows are aligned first, so a taller or shorter section does not mark everything below it as changed. Red pixels differ, and full red bands exist in only one page.');
    if (!r.visual) {
      c.appendChild(h('p', { class: 'pc-empty', text: r.visualError || 'Screenshots were not available, so UI parity is based on page structure only. Upload screenshots under Advanced options to compare visually.' }));
      out.appendChild(c);
      return;
    }
    var v = r.visual;
    c.appendChild(h('div', { class: 'pc-meters' },
      meter('Pixel match (aligned)', v.similarity, v.truncated ? 'Compared the first ' + Math.round(CMP_MAX_H / (v.width / r.shotA.img.naturalWidth)) + 'px.' : null),
      meter('First screen', v.fold),
      meter('Colour palette', v.palette),
      h('div', { class: 'pc-meter' }, h('div', { class: 'pc-meter-h' }, h('span', { text: 'Page height' }), h('strong', { text: v.heightA + ' → ' + v.heightB + 'px' })))));

    var modes = [['side', 'Side by side'], ['swipe', 'Swipe'], ['diff', 'Difference']];
    var viewer = h('div', { class: 'pc-viewer', 'data-mode': 'side', tabindex: '0', 'aria-label': 'Screenshot comparison' });
    var tabs = h('div', { class: 'pc-modes', role: 'group', 'aria-label': 'View' }, modes.map(function (m, i) {
      return h('button', { type: 'button', class: 'chip', 'aria-pressed': i === 0 ? 'true' : 'false', text: m[1], onclick: function (e) {
        viewer.setAttribute('data-mode', m[0]);
        tabs.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b === e.currentTarget)); });
      } });
    }));
    var range = h('input', { type: 'range', min: '0', max: '100', value: '50', class: 'pc-swipe-range', 'aria-label': 'Swipe position' });
    var imgA = h('img', { src: r.shotA.url, alt: 'Source screenshot' }), imgB = h('img', { src: r.shotB.url, alt: 'Destination screenshot' });
    var diffImg = h('img', { src: v.diffCanvas.toDataURL('image/png'), alt: 'Difference map: red pixels differ' });
    var swipeTop = h('div', { class: 'pc-swipe-top' }, h('img', { src: r.shotA.url, alt: '' }));
    range.addEventListener('input', function () { swipeTop.style.clipPath = 'inset(0 ' + (100 - range.value) + '% 0 0)'; });
    swipeTop.style.clipPath = 'inset(0 50% 0 0)';
    add(viewer, [
      h('div', { class: 'pc-v-side' }, h('figure', null, h('figcaption', { text: 'Source' }), imgA), h('figure', null, h('figcaption', { text: 'Destination' }), imgB)),
      h('div', { class: 'pc-v-swipe' }, h('div', { class: 'pc-swipe-stage' }, h('img', { src: r.shotB.url, alt: 'Destination screenshot' }), swipeTop), h('p', { class: 'muted', text: 'Left of the line: source. Right: destination.' })),
      h('div', { class: 'pc-v-diff' }, diffImg)
    ]);
    c.appendChild(tabs);
    c.appendChild(h('div', { class: 'pc-swipe-ctl' }, range));
    c.appendChild(viewer);
    c.appendChild(h('div', { class: 'pc-palette' }, [['Source colours', v.coloursA], ['Destination colours', v.coloursB]].map(function (p) {
      return h('div', null, h('span', { class: 'muted', text: p[0] }), h('span', { class: 'pc-swatches' }, p[1].map(function (col) {
        return h('span', { class: 'pc-sw', title: col.hex + ' · ' + pct(col.share), style: 'background:' + col.hex });
      })));
    })));
    if (v.regions.length) {
      var regs = v.regions.slice().sort(function (x, y) { return (y.share * (y.y1 - y.y0)) - (x.share * (x.y1 - x.y0)); }).slice(0, 8)
        .sort(function (x, y) { return x.y0 - y.y0; });
      c.appendChild(h('h4', { text: 'Changed regions (destination pixel position)' }));
      c.appendChild(h('ul', { class: 'pc-regions' }, regs.map(function (g) {
        return h('li', null, h('button', { type: 'button', class: 'pc-link', text: g.y0 + '–' + g.y1 + 'px', onclick: function () {
          viewer.setAttribute('data-mode', 'diff');
          tabs.querySelectorAll('button').forEach(function (b, i) { b.setAttribute('aria-pressed', String(i === 2)); });
          var scale = diffImg.clientWidth / v.width;
          viewer.scrollTo({ top: g.cy0 * scale - 20, behavior: 'smooth' });
          viewer.focus({ preventScroll: true });
        } }), ' ', h('span', { class: 'muted', text: g.kind + ' · ' + pct(g.share) + ' of pixels' }));
      })));
    }
    var dl = h('button', { type: 'button', class: 'btn ghost pc-sm', text: 'Download difference image', onclick: function () {
      v.diffCanvas.toBlob(function (b) { save(b, 'page-diff.png'); });
    } });
    c.appendChild(dl);
    out.appendChild(c);
  }

  function renderStructure(r, out) {
    var c = card('Page structure', 'Element counts across the whole page (after ignore selectors). Large gaps usually mean a component or section is missing.');
    c.appendChild(table(['Element', 'Source', 'Destination', 'Match'], r.structure.rows.map(function (x) {
      return h('tr', { class: x.r < 0.7 ? 'pc-bad' : x.r < 1 ? 'pc-mid' : '' }, h('th', { scope: 'row', text: x.label }), h('td', { text: x.a }), h('td', { text: x.b }), h('td', { text: pct(x.r) }));
    })));
    out.appendChild(c);
  }

  function renderMeta(r, out) {
    var c = card('SEO and metadata', 'Compared in the <head> of each page. Canonicals are compared by path, so a domain change alone is not a difference.');
    c.appendChild(table(['Field', 'Source', 'Destination', 'Status'], r.content.meta.rows.map(function (x) {
      return h('tr', { class: 'pc-st-' + x.status }, h('th', { scope: 'row', text: x.label }), h('td', { text: x.a || '–' }), h('td', { text: x.b || '–' }),
        h('td', null, h('span', { class: 'pc-pill pc-' + x.status, text: STATUS[x.status] }), x.note ? h('small', { text: x.note }) : null));
    })));
    out.appendChild(c);
  }

  function renderText(r, out) {
    var t = r.content.text;
    var c = card('Text content', 'Scope: source "' + r.analysisA.scope + '", destination "' + r.analysisB.scope + '". Text is compared block by block; changed blocks show the exact words.');
    c.appendChild(h('div', { class: 'pc-meters' }, meter('Word overlap', t.score), h('div', { class: 'pc-meter' }, h('div', { class: 'pc-meter-h' }, h('span', { text: 'Words' }), h('strong', { text: t.wordsA + ' → ' + t.wordsB })))));
    var counts = { eq: 0, chg: 0, del: 0, add: 0 };
    t.list.forEach(function (x) { counts[x.t]++; });
    c.appendChild(h('p', { class: 'pc-legend' },
      h('span', { class: 'pc-pill pc-same', text: counts.eq + ' unchanged' }), ' ',
      h('span', { class: 'pc-pill pc-similar', text: counts.chg + ' changed' }), ' ',
      h('span', { class: 'pc-pill pc-missing', text: counts.del + ' only in source' }), ' ',
      h('span', { class: 'pc-pill pc-info', text: counts.add + ' only in destination' })));
    var only = h('input', { type: 'checkbox', checked: true });
    var list = h('ol', { class: 'pc-blocks pc-hide-eq' });
    only.addEventListener('change', function () { list.classList.toggle('pc-hide-eq', only.checked); });
    c.appendChild(h('label', { class: 'pc-check' }, only, ' Show differences only'));
    t.list.forEach(function (x) {
      if (x.t === 'chg') {
        var p = h('p');
        Diff.diffWords(x.a, x.b).forEach(function (d) { p.appendChild(d.added ? h('ins', { text: d.value }) : d.removed ? h('del', { text: d.value }) : document.createTextNode(d.value)); });
        list.appendChild(h('li', { class: 'pc-b-chg' }, p));
      } else {
        list.appendChild(h('li', { class: 'pc-b-' + x.t }, h('p', { text: x.t === 'add' ? x.b : x.a })));
      }
    });
    if (!counts.chg && !counts.del && !counts.add) list.appendChild(h('li', { class: 'pc-b-none' }, h('p', { text: 'No text differences.' })));
    c.appendChild(list);
    out.appendChild(c);
  }

  function renderHeadings(r, out) {
    var hd = r.content.headings;
    var c = card('Heading outline', hd.a + ' headings in the source, ' + hd.b + ' in the destination. The outline is what screen readers and search engines use to understand the page.');
    c.appendChild(h('ol', { class: 'pc-outline' }, hd.list.map(function (x) {
      return h('li', { class: 'pc-o-' + x.t, style: '--lvl:' + (x.h.level - 1) }, h('span', { class: 'pc-hl', text: 'H' + x.h.level }), h('span', { text: x.h.text }),
        x.t === 'add' ? h('span', { class: 'pc-pill pc-info', text: 'only in destination' }) : x.t === 'del' ? h('span', { class: 'pc-pill pc-missing', text: 'only in source' }) : null);
    })));
    if (!hd.list.length) c.appendChild(h('p', { class: 'pc-empty', text: 'Neither page has headings in the compared scope.' }));
    out.appendChild(c);
  }

  function renderLinks(r, out) {
    var l = r.content.links, im = r.content.images;
    var c = card('Links and images', 'Internal links are matched by path on either domain, ignoring .html, trailing slashes and any path prefix you set. Images are matched by file name, then by alt text.');
    c.appendChild(h('div', { class: 'pc-meters' }, meter('Link match', l.score, l.common + ' of ' + l.a + ' source links found'), meter('Image match', im.score, im.matched + ' of ' + im.a + ' source images matched')));
    var list = function (title, items, fmt) {
      if (!items.length) return null;
      var d = h('details', { class: 'pc-sub' }, h('summary', { text: title + ' (' + items.length + ')' }));
      d.appendChild(h('ul', { class: 'pc-list' }, items.slice(0, 200).map(fmt)));
      return d;
    };
    var linkFmt = function (x) { return h('li', null, h('code', { text: x.key }), ' ', h('span', { class: 'muted', text: x.text })); };
    var imgFmt = function (x) { return h('li', null, h('code', { text: x.src.length > 90 ? '…' + x.src.slice(-90) : x.src }), ' ', h('span', { class: 'muted', text: x.alt == null ? 'no alt attribute' : (x.alt ? 'alt: ' + x.alt : 'empty alt (decorative)') })); };
    add(c, [
      list('Links missing on destination', l.missing, linkFmt),
      list('Links only on destination', l.added, linkFmt),
      list('Source images without a match', im.missing, imgFmt),
      list('Destination images without a match', im.added, imgFmt)
    ]);
    c.appendChild(h('p', { class: 'muted', text: 'Images without an alt attribute: source ' + im.noAltA + ', destination ' + im.noAltB + '.' }));
    out.appendChild(c);
  }

  function renderReport(r) {
    var out = $('pcReport');
    out.textContent = '';
    out.hidden = false;
    add(out, h('div', { class: 'pc-head' },
      h('div', null, h('p', { class: 'eyebrow', text: 'Parity report' }), h('h2', { text: 'Results' }),
        h('p', { class: 'muted pc-urls-line' }, h('span', { text: 'Source: ' }), h('a', { href: r.finalA, target: '_blank', rel: 'noopener noreferrer', text: r.finalA }), h('br'),
          h('span', { text: 'Destination: ' }), h('a', { href: r.finalB, target: '_blank', rel: 'noopener noreferrer', text: r.finalB }))),
      h('div', { class: 'pc-actions' },
        h('button', { type: 'button', class: 'btn ghost pc-sm', text: 'Download JSON', onclick: function () { save(new Blob([JSON.stringify(exportable(r), null, 2)], { type: 'application/json' }), 'page-parity-report.json'); } }),
        h('button', { type: 'button', class: 'btn ghost pc-sm', text: 'Print or save PDF', onclick: function () { out.querySelectorAll('details').forEach(function (d) { d.open = true; }); window.print(); } }))));
    add(out, h('div', { class: 'pc-scores' },
      ring('UI parity', r.ui, r.visual ? 'Screenshots, layout structure and colours' : 'Page structure only (no screenshots)'),
      ring('Content parity', r.contentScore, 'Text, headings, links, images and SEO metadata')));
    var f = findings(r);
    add(out, h('div', { class: 'pc-card pc-findings' }, h('h3', { text: 'Key findings' }), h('ul', null, f.map(function (x) {
      return h('li', { class: 'pc-f-' + x.level }, h('span', { class: 'pc-pill pc-f', text: { critical: 'Critical', warn: 'Check', info: 'Note', ok: 'Good' }[x.level] }), ' ', x.text);
    }))));
    var breakdown = h('div', { class: 'pc-meters pc-breakdown' },
      meter('Text', r.content.text.score), meter('Headings', r.content.headings.score), meter('Links', r.content.links.score),
      meter('Images', r.content.images.score), meter('SEO metadata', r.content.meta.score), meter('Structure', r.structure.score));
    add(out, h('div', { class: 'pc-card' }, h('h3', { text: 'Score breakdown' }), breakdown));
    renderVisual(r, out);
    renderStructure(r, out);
    renderMeta(r, out);
    renderText(r, out);
    renderHeadings(r, out);
    renderLinks(r, out);
    r.findings = f;
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function exportable(r) {
    var v = r.visual;
    return {
      generatedAt: new Date().toISOString(), tool: location.href.split('?')[0],
      source: r.finalA, destination: r.finalB, viewport: r.vp, fullPage: r.full,
      scores: { uiParity: r.ui, contentParity: r.contentScore, text: r.content.text.score, headings: r.content.headings.score, links: r.content.links.score, images: r.content.images.score, seoMetadata: r.content.meta.score, structure: r.structure.score, pixel: v && v.similarity, firstScreen: v && v.fold, palette: v && v.palette },
      findings: r.findings,
      httpStatus: r.status,
      metadata: r.content.meta.rows,
      structure: r.structure.rows,
      visual: v ? { heightSource: v.heightA, heightDestination: v.heightB, changedRegions: v.regions.map(function (g) { return { fromPx: g.y0, toPx: g.y1, changed: g.share }; }) } : null,
      words: { source: r.content.text.wordsA, destination: r.content.text.wordsB },
      textDifferences: r.content.text.list.filter(function (x) { return x.t !== 'eq'; }),
      headings: r.content.headings.list.map(function (x) { return { change: x.t, level: x.h.level, text: x.h.text }; }),
      linksMissingOnDestination: r.content.links.missing, linksOnlyOnDestination: r.content.links.added,
      imagesWithoutMatchInSource: r.content.images.missing, imagesWithoutMatchInDestination: r.content.images.added
    };
  }
  function save(blob, name) {
    var a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  /* ---------- form wiring ---------- */
  var fields = ['pcViewport', 'pcCapture', 'pcSensitivity', 'pcScopeA', 'pcScopeB', 'pcIgnore', 'pcPrefix', 'pcHosts', 'pcNoCache'];
  function restore() {
    var prefs = {};
    try { prefs = JSON.parse(store.get(PREF_STORE) || '{}'); } catch (e) { /* ignore */ }
    fields.forEach(function (id) {
      var el = form.elements[id]; if (!el || !(id in prefs)) return;
      if (el.type === 'checkbox') el.checked = !!prefs[id]; else el.value = prefs[id];
    });
    var key = store.get(KEY_STORE);
    if (key) { form.elements.pcKey.value = key; form.elements.pcRemember.checked = true; }
    var qs = new URLSearchParams(location.search);
    if (qs.get('src')) form.elements.pcSrc.value = qs.get('src');
    if (qs.get('dst')) form.elements.pcDst.value = qs.get('dst');
  }
  function persist() {
    var prefs = {};
    fields.forEach(function (id) { var el = form.elements[id]; if (el) prefs[id] = el.type === 'checkbox' ? el.checked : el.value; });
    store.set(PREF_STORE, JSON.stringify(prefs));
    store.set(KEY_STORE, form.elements.pcRemember.checked ? form.elements.pcKey.value.trim() : '');
  }
  restore();

  $('pcSwap').addEventListener('click', function () {
    var a = form.elements.pcSrc, b = form.elements.pcDst, t = a.value;
    a.value = b.value; b.value = t;
  });
  $('pcExample').addEventListener('click', function () {
    form.elements.pcSrc.value = 'https://www.aem.live/';
    form.elements.pcDst.value = 'https://main--helix-website--adobe.aem.live/';
    form.elements.pcSrc.focus();
  });

  var running = false;
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (running) return;
    var el = form.elements;
    var src = el.pcSrc.value.trim(), dst = el.pcDst.value.trim();
    var pasteA = el.pcHtmlA.value.trim(), pasteB = el.pcHtmlB.value.trim();
    var fileA = el.pcShotA.files[0], fileB = el.pcShotB.files[0];
    var err = $('pcError');
    err.textContent = '';
    var badUrl = function (u) { try { return !/^https?:$/.test(new URL(u).protocol); } catch (x) { return true; } };
    if ((!src && !pasteA) || (!dst && !pasteB)) { err.textContent = 'Enter both URLs, or paste HTML for any page that can\'t be fetched.'; return; }
    if ((src && badUrl(src)) || (dst && badUrl(dst))) { err.textContent = 'URLs must start with http:// or https://.'; return; }
    if (!/^[\x20-\x7e]*$/.test(el.pcIgnore.value)) { err.textContent = 'Ignore elements can only contain plain ASCII characters.'; return; }
    if (typeof Diff === 'undefined') { err.textContent = 'The diff library failed to load. Check your connection and reload the page.'; return; }
    persist();
    if (src && dst) history.replaceState(null, '', '?src=' + encodeURIComponent(src) + '&dst=' + encodeURIComponent(dst));

    running = true;
    var btn = $('pcGo');
    btn.disabled = true; btn.textContent = 'Comparing…';
    steps.textContent = ''; steps.hidden = false;
    $('pcReport').hidden = true;
    var vp = VIEWPORTS[el.pcViewport.value] || VIEWPORTS.desktop;
    var full = el.pcCapture.value === 'full';
    var o = { key: el.pcKey.value.trim(), noCache: el.pcNoCache.checked, remove: el.pcIgnore.value.trim() };
    var sA = step('ha', 'Fetch source page'), sB = step('hb', 'Fetch destination page');
    var vA = step('va', 'Screenshot source'), vB = step('vb', 'Screenshot destination');
    var sC = step('cmp', 'Compare');

    var getHtml = function (url, paste, s) {
      if (paste) { s.set('ok', 'Using pasted HTML'); return Promise.resolve({ html: paste, finalUrl: url || 'https://pasted.invalid/', status: null }); }
      s.set('run', 'Rendering through Jina Reader…');
      return fetchHtml(url, o).then(function (x) { s.set('ok', (x.status ? 'HTTP ' + x.status : 'Fetched') + (x.finalUrl !== url ? ' · redirected to ' + x.finalUrl : '')); return x; },
        function (x) { s.set('err', x.name === 'AbortError' ? 'Timed out' : x.message); throw x; });
    };
    var getShot = function (url, file, s) {
      if (file) { s.set('ok', 'Using uploaded image'); return loadImage(file); }
      if (!url) { s.set('skip', 'No URL'); return Promise.resolve(null); }
      s.set('run', 'Capturing at ' + vp.w + 'px…');
      return screenshot(url, vp, full, o).then(function (x) { return loadImage(x.blob).then(function (img) { s.set('ok', 'Captured via ' + x.via + ' · ' + img.img.naturalWidth + '×' + img.img.naturalHeight); return img; }); },
        function (x) { s.set('err', x.name === 'AbortError' ? 'Timed out' : x.message); return null; });
    };

    try {
      var res = await Promise.all([getHtml(src, pasteA, sA), getHtml(dst, pasteB, sB), getShot(src, fileA, vA), getShot(dst, fileB, vB)]);
      sC.set('run', 'Analysing…');
      await new Promise(function (r) { setTimeout(r, 30); });
      var A = res[0], B = res[1];
      var hostA = hostOf(A.finalUrl), hostB = hostOf(B.finalUrl);
      var hosts = [hostA, hostB].concat(el.pcHosts.value.split(/[\s,]+/).map(function (x) { return x.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').toLowerCase(); })).filter(Boolean);
      var ctx = { hosts: hosts, prefixes: el.pcPrefix.value.split(/[\s,]+/).map(function (p) { return p.replace(/\/+$/, '').toLowerCase(); }).filter(Boolean), baseA: A.finalUrl, baseB: B.finalUrl };
      var ignore = el.pcIgnore.value.trim();
      var anA = analyse(A.html, A.finalUrl, { scope: el.pcScopeA.value.trim(), ignore: ignore }, ctx);
      var anB = analyse(B.html, B.finalUrl, { scope: el.pcScopeB.value.trim(), ignore: ignore }, ctx);
      var content = { meta: cmpMeta(anA, anB, ctx), headings: cmpHeadings(anA, anB), text: cmpBlocks(anA, anB), links: cmpLinks(anA, anB), images: cmpImages(anA, anB) };
      var structure = cmpStructure(anA, anB);
      var visual = null, visualError = '';
      if (res[2] && res[3]) {
        try { visual = compareVisual(res[2], res[3], vp, SENSITIVITY[el.pcSensitivity.value] || 0.1); }
        catch (x) { visualError = 'Visual comparison failed: ' + x.message; }
      } else visualError = 'One or both screenshots could not be captured, so UI parity is based on page structure only. You can upload screenshots under Advanced options.';
      var contentScore = 0.45 * content.text.score + 0.2 * content.headings.score + 0.15 * content.links.score + 0.1 * content.images.score + 0.1 * content.meta.score;
      var ui = visual
        ? 0.4 * visual.similarity + 0.25 * (visual.fold == null ? visual.similarity : visual.fold) + 0.2 * structure.score + 0.15 * visual.palette
        : structure.score;
      sC.set('ok', 'Done');
      renderReport({
        vp: vp, full: full, finalA: A.finalUrl, finalB: B.finalUrl, hostA: hostA, hostB: hostB, status: { a: A.status, b: B.status },
        analysisA: anA, analysisB: anB, content: content, structure: structure, visual: visual, visualError: visualError,
        shotA: res[2], shotB: res[3], contentScore: contentScore, ui: ui
      });
    } catch (x) {
      sC.set('err', 'Stopped');
      err.textContent = (x.name === 'AbortError' ? 'A request timed out. ' : '') + (x.message || 'Something went wrong.') +
        ' If a page is private or blocks bots, paste its HTML under Advanced options instead.';
    } finally {
      running = false;
      btn.disabled = false; btn.textContent = 'Compare pages';
    }
  });
})();

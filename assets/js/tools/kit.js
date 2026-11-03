/* Shared helpers for the browser-only audit tools (SEO audit, GEO audit).
   Pages are fetched through Jina Reader (r.jina.ai); fetched HTML is parsed with DOMParser,
   so scripts never run, and anything from a fetched page is rendered as text only. */
(function () {
  'use strict';

  var JINA = 'https://r.jina.ai/';
  var KEY_STORE = 'kj-pc-jina-key'; // shared with the page comparison tool

  /* ---------- DOM ---------- */
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
  var words = function (s) { return (s || '').match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []; };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { if (v == null || v === '') localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  };

  /* ---------- fetching ---------- */
  function fetchT(url, opts, ms) {
    var ctl = new AbortController();
    var t = setTimeout(function () { ctl.abort(); }, ms);
    return fetch(url, Object.assign({}, opts, { signal: ctl.signal })).finally(function () { clearTimeout(t); });
  }
  /* format: 'html' (rendered page), 'raw' (HTML as served, no JavaScript) or 'text' (a plain file such as robots.txt) */
  async function jina(url, format, o) {
    o = o || {};
    var hd = { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Return-Format': format === 'text' ? 'text' : 'html', 'X-Timeout': '40' };
    if (format === 'raw') hd['X-Engine'] = 'direct';
    if (o.noCache !== false) hd['X-No-Cache'] = 'true';
    if (o.key) hd.Authorization = 'Bearer ' + o.key;
    var res;
    try { res = await fetchT(JINA, { method: 'POST', headers: hd, body: JSON.stringify({ url: url }) }, 90000); }
    catch (e) { throw new Error(e.name === 'AbortError' ? 'Timed out fetching ' + url : 'Network error fetching ' + url); }
    var j = await res.json().catch(function () { return {}; });
    if (res.status === 429) throw new Error('Jina Reader rate limit reached. Wait a minute, or add a free Jina API key under Settings.');
    if (res.status === 401 || res.status === 403) {
      if (j.name === 'AbuseAlleviationError') throw new Error('Jina Reader is temporarily blocking anonymous requests to this domain. Add a free Jina API key under Settings, or try again later.');
      throw new Error('Jina Reader refused the request' + (o.key ? '. Check your API key.' : ': ' + String(j.readableMessage || j.message || res.status).slice(0, 160)));
    }
    var d = j.data;
    if (!res.ok || !d) {
      var msg = (j && (j.readableMessage || j.message)) || ('HTTP ' + res.status);
      return { ok: false, status: null, finalUrl: url, body: '', error: String(msg).slice(0, 200) };
    }
    var body = format === 'text' ? (d.text != null ? d.text : d.content || '') : (d.html || '');
    var status = d.httpStatus || null;
    // a plain-text file comes back without a title; a title means the server answered with an HTML page (often a soft 404)
    return { ok: !status || status < 400, status: status, finalUrl: d.finalUrl || d.url || url, body: body, title: d.title || '', servedHtml: format === 'text' && !!norm(d.title) };
  }

  /* ---------- robots.txt (RFC 9309) ---------- */
  var KNOWN = { 'user-agent': 1, allow: 1, disallow: 1, sitemap: 1, 'crawl-delay': 1, host: 1, 'clean-param': 1, 'request-rate': 1, 'visit-time': 1 };
  function parseRobots(text) {
    var r = { groups: [], sitemaps: [], unknown: [], invalid: [], orphanRules: 0, crawlDelay: false, looksLikeHtml: /^\s*<(!doctype|html|head|body)/i.test(text || '') };
    var cur = null, lastWasAgent = false;
    (text || '').split(/\r\n|\r|\n/).forEach(function (raw, i) {
      var line = raw.replace(/#.*$/, '').trim();
      if (!line) return;
      var m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
      if (!m) { r.invalid.push({ line: i + 1, text: raw.trim().slice(0, 80) }); return; }
      var key = m[1].toLowerCase(), val = m[2].trim();
      if (!KNOWN[key]) { r.unknown.push({ line: i + 1, text: raw.trim().slice(0, 80) }); return; }
      if (key === 'user-agent') {
        if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; r.groups.push(cur); }
        cur.agents.push(val.toLowerCase());
        lastWasAgent = true;
        return;
      }
      lastWasAgent = false;
      if (key === 'sitemap') { if (val) r.sitemaps.push(val); return; }
      if (key === 'crawl-delay') { r.crawlDelay = true; return; }
      if (key === 'allow' || key === 'disallow') {
        if (!cur) { r.orphanRules++; return; }
        if (val) cur.rules.push({ allow: key === 'allow', path: val });
      }
    });
    return r;
  }
  /* The group that applies to a crawler: an exact product-token match, then the closest
     shorter token (googlebot for googlebot-news), then '*'. Matching groups are merged. */
  function rulesFor(robots, agent) {
    agent = agent.toLowerCase();
    var pick = function (test) {
      var rules = [], found = false;
      robots.groups.forEach(function (g) { if (g.agents.some(test)) { found = true; rules = rules.concat(g.rules); } });
      return found ? rules : null;
    };
    return pick(function (a) { return a === agent; }) ||
      pick(function (a) { return a !== '*' && agent.indexOf(a) === 0; }) ||
      pick(function (a) { return a === '*'; }) || [];
  }
  function patternMatches(pattern, path) {
    var anchored = pattern.slice(-1) === '$';
    var body = anchored ? pattern.slice(0, -1) : pattern;
    var re = '^' + body.split('*').map(function (s) { return s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'); }).join('.*') + (anchored ? '$' : '');
    try { return new RegExp(re).test(path); } catch (e) { return false; }
  }
  /* Longest matching rule wins; on a tie, allow wins. No matching rule means allowed. */
  function isAllowed(robots, agent, path) {
    if (!robots || path === '/robots.txt') return { allowed: true, rule: null };
    var best = null;
    rulesFor(robots, agent).forEach(function (rule) {
      if (!patternMatches(rule.path, path)) return;
      var len = rule.path.length;
      if (!best || len > best.path.length || (len === best.path.length && rule.allow && !best.allow)) best = rule;
    });
    return { allowed: !best || best.allow, rule: best };
  }

  /* ---------- page parsing ---------- */
  function parse(html) { return new DOMParser().parseFromString(html || '', 'text/html'); }
  function jsonLd(doc) {
    var items = [], invalid = 0;
    var walk = function (n) {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(walk); return; }
      if (n['@type']) items.push(n);
      if (n['@graph']) walk(n['@graph']);
      Object.keys(n).forEach(function (k) { if (k !== '@graph' && n[k] && typeof n[k] === 'object') walk(n[k]); });
    };
    doc.querySelectorAll('script[type="application/ld+json"]').forEach(function (s) {
      try { walk(JSON.parse(s.textContent)); } catch (e) { invalid++; }
    });
    var types = function (n) { return [].concat(n['@type'] || []).map(String); };
    return {
      items: items, invalid: invalid, blocks: doc.querySelectorAll('script[type="application/ld+json"]').length,
      types: Array.from(new Set([].concat.apply([], items.map(types)))).sort(),
      ofType: function (t) { return items.filter(function (n) { return types(n).some(function (x) { return x.toLowerCase() === t.toLowerCase(); }); }); }
    };
  }
  /* Visible text of a document, without scripts, styles and hidden templates. */
  function visibleText(doc) {
    var body = doc.body;
    if (!body) return '';
    var clone = body.cloneNode(true);
    clone.querySelectorAll('script,style,noscript,template,svg,[hidden]').forEach(function (el) { el.remove(); });
    return norm(clone.textContent);
  }
  function meta(doc, sel, attr) { var el = doc.querySelector(sel); return el ? norm(el.getAttribute(attr || 'content')) : ''; }
  function sameSite(a, b) {
    try { return new URL(a).hostname.replace(/^www\./, '') === new URL(b).hostname.replace(/^www\./, ''); } catch (e) { return false; }
  }

  /* ---------- scoring and report ---------- */
  var VALUE = { pass: 1, warn: 0.5, fail: 0 };
  function score(checks) {
    var w = 0, s = 0;
    checks.forEach(function (c) { if (c.status in VALUE) { w += c.weight || 1; s += (c.weight || 1) * VALUE[c.status]; } });
    return w ? s / w : null;
  }
  function tone(v) { return v == null ? 'na' : v >= 0.85 ? 'good' : v >= 0.6 ? 'mid' : 'bad'; }
  function ring(label, value, sub, big) {
    var c = 2 * Math.PI * 52, v = value == null ? 0 : value;
    var wrap = h('div', { class: 'pc-score pc-' + tone(value) + (big ? ' au-main' : '') });
    var g = h('div', { class: 'pc-ring' });
    g.innerHTML = '<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="pc-ring-bg"/>' +
      '<circle cx="60" cy="60" r="52" class="pc-ring-fg" stroke-dasharray="' + (c * v).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 60 60)"/></svg>';
    g.appendChild(h('strong', { text: value == null ? '–' : Math.round(v * 100) }));
    add(wrap, [g, h('div', null, h('h3', { text: label }), sub ? h('p', { class: 'muted', text: sub }) : null)]);
    return wrap;
  }
  var LABEL = { pass: 'Pass', warn: 'Improve', fail: 'Fix', info: 'Info' };
  function checkItem(c) {
    var li = h('li', { class: 'au-check au-' + c.status },
      h('span', { class: 'au-badge', text: LABEL[c.status] }),
      h('div', { class: 'au-body' },
        h('p', { class: 'au-title', text: c.title }),
        c.detail ? h('p', { class: 'au-detail', text: c.detail }) : null,
        c.fix && c.status !== 'pass' ? h('p', { class: 'au-fix' }, h('strong', { text: 'How to fix: ' }), c.fix) : null,
        c.list && c.list.length ? h('details', { class: 'au-more' }, h('summary', { text: 'Show ' + c.list.length + ' item' + (c.list.length > 1 ? 's' : '') }),
          h('ul', null, c.list.slice(0, 100).map(function (x) { return h('li', null, h('code', { text: x })); }))) : null));
    return li;
  }
  function categoryCard(cat, checks) {
    var s = score(checks);
    var counts = { fail: 0, warn: 0, pass: 0 };
    checks.forEach(function (c) { if (c.status in counts) counts[c.status]++; });
    var order = { fail: 0, warn: 1, info: 2, pass: 3 };
    var sorted = checks.slice().sort(function (a, b) { return order[a.status] - order[b.status] || (b.weight || 1) - (a.weight || 1); });
    var d = h('details', { class: 'pc-card au-cat', open: true, id: 'au-' + cat.id },
      h('summary', null, h('div', { class: 'au-cat-head' }, h('h3', { text: cat.title }),
        h('span', { class: 'au-cat-meta' },
          h('strong', { class: 'au-cat-score pc-' + tone(s), text: s == null ? '–' : Math.round(s * 100) + '/100' }),
          h('span', { class: 'muted', text: counts.fail + ' to fix · ' + counts.warn + ' to improve · ' + counts.pass + ' passed' })))));
    if (cat.intro) d.appendChild(h('p', { class: 'muted pc-intro', text: cat.intro }));
    d.appendChild(h('ul', { class: 'au-checks' }, sorted.map(checkItem)));
    return d;
  }
  function save(blob, name) {
    var a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  /* Renders the whole report: overall ring, category bars, top fixes and one card per category. */
  function renderAudit(out, opts) {
    var cats = opts.categories, checks = opts.checks;
    var byCat = {};
    cats.forEach(function (c) { byCat[c.id] = checks.filter(function (x) { return x.cat === c.id; }); });
    var catScores = cats.map(function (c) { return { cat: c, s: score(byCat[c.id]) }; });
    var tw = 0, ts = 0;
    catScores.forEach(function (x) { if (x.s != null) { tw += x.cat.weight; ts += x.cat.weight * x.s; } });
    var overall = tw ? ts / tw : null;
    out.textContent = '';
    out.hidden = false;
    add(out, h('div', { class: 'pc-head' },
      h('div', null, h('p', { class: 'eyebrow', text: opts.eyebrow }), h('h2', { text: 'Results' }),
        h('p', { class: 'muted pc-urls-line' }, h('span', { text: 'Page: ' }), h('a', { href: opts.url, target: '_blank', rel: 'noopener noreferrer', text: opts.url }),
          h('br'), h('span', { text: 'Checked ' + new Date().toLocaleString() }))),
      h('div', { class: 'pc-actions' },
        h('button', { type: 'button', class: 'btn ghost pc-sm', text: 'Download JSON', onclick: function () {
          save(new Blob([JSON.stringify({ tool: opts.eyebrow, url: opts.url, checkedAt: new Date().toISOString(), score: overall, categories: catScores.map(function (x) { return { id: x.cat.id, title: x.cat.title, score: x.s }; }), checks: checks, extra: opts.extra || null }, null, 2)], { type: 'application/json' }), opts.file);
        } }),
        h('button', { type: 'button', class: 'btn ghost pc-sm', text: 'Print or save PDF', onclick: function () { out.querySelectorAll('details').forEach(function (d) { d.open = true; }); window.print(); } }))));
    var bars = h('div', { class: 'au-bars' }, catScores.map(function (x) {
      return h('a', { class: 'au-bar', href: '#au-' + x.cat.id },
        h('span', { class: 'au-bar-l', text: x.cat.title }),
        h('span', { class: 'pc-bar' }, h('span', { style: 'width:' + Math.round((x.s || 0) * 100) + '%' })),
        h('strong', { text: x.s == null ? 'n/a' : Math.round(x.s * 100) }));
    }));
    add(out, h('div', { class: 'au-top' }, ring(opts.scoreLabel, overall, opts.scoreSub, true), h('div', { class: 'pc-card au-bars-card' }, h('h3', { text: 'By category' }), bars)));
    if (opts.before) add(out, opts.before);
    var weightOf = function (c) { var cat = cats.find(function (x) { return x.id === c.cat; }); return (c.weight || 1) * (cat ? cat.weight : 1); };
    var top = checks.filter(function (c) { return c.status === 'fail' || c.status === 'warn'; })
      .sort(function (a, b) { return (a.status === 'fail' ? 0 : 1) - (b.status === 'fail' ? 0 : 1) || weightOf(b) - weightOf(a); }).slice(0, 8);
    add(out, h('div', { class: 'pc-card au-priorities' }, h('h3', { text: top.length ? 'Fix these first' : 'Nothing urgent' }),
      top.length ? h('ol', null, top.map(function (c) {
        return h('li', { class: 'au-' + c.status }, h('span', { class: 'au-badge', text: LABEL[c.status] }), ' ', h('strong', { text: c.title }), c.fix ? h('span', { class: 'muted', text: ' ' + c.fix }) : null);
      })) : h('p', { class: 'muted', text: 'Every scored check passed. Review the Info items for further ideas.' })));
    cats.forEach(function (c) { add(out, categoryCard(c, byCat[c.id])); });
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return overall;
  }

  /* ---------- progress steps ---------- */
  function steps(list) {
    list.textContent = '';
    list.hidden = false;
    return function (label) {
      var li = h('li', { 'data-state': 'run' }, h('span', { class: 'pc-dot', 'aria-hidden': 'true' }), h('span', { class: 'pc-step-l', text: label }), h('span', { class: 'pc-step-d', text: 'Working…' }));
      list.appendChild(li);
      return function (state, detail) { li.setAttribute('data-state', state); li.querySelector('.pc-step-d').textContent = detail || ''; };
    };
  }

  /* ---------- shared form bits ---------- */
  function setupKey(form) {
    var k = store.get(KEY_STORE);
    if (k && form.elements.auKey) { form.elements.auKey.value = k; form.elements.auRemember.checked = true; }
  }
  function persistKey(form) {
    if (form.elements.auKey) store.set(KEY_STORE, form.elements.auRemember.checked ? form.elements.auKey.value.trim() : '');
  }
  function normaliseUrl(v) {
    v = (v || '').trim();
    if (!v) return '';
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
    try { var u = new URL(v); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch (e) { return ''; }
  }

  window.KJTools = {
    h: h, add: add, norm: norm, words: words, store: store, fetchT: fetchT, jina: jina,
    parseRobots: parseRobots, isAllowed: isAllowed, rulesFor: rulesFor,
    parse: parse, jsonLd: jsonLd, visibleText: visibleText, meta: meta, sameSite: sameSite,
    score: score, ring: ring, renderAudit: renderAudit, steps: steps, setupKey: setupKey, persistKey: persistKey, normaliseUrl: normaliseUrl
  };
})();

/* hreflang checker and generator for multilingual AEM sites. Paste an XML sitemap with
   xhtml:link alternates, or <link rel="alternate" hreflang> tags grouped per page. Runs in the browser. */
(function (root) {
  'use strict';

  var CODE = /^(x-default|[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|[0-9]{3}))?)$/;
  var FIXES = { 'en-uk': 'en-GB', 'en-gb': 'en-GB', jp: 'ja', 'ja-jp': 'ja-JP', 'zh-cn': 'zh-CN', 'zh-tw': 'zh-TW', iw: 'he', 'en_us': 'en-US', kr: 'ko', cz: 'cs', se: 'sv', dk: 'da', gr: 'el', ua: 'uk' };
  var attr = function (tag, name) { var m = tag.match(new RegExp('\\b' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')', 'i')); return m ? (m[1] != null ? m[1] : m[2]) : null; };
  var norm = function (u) { return String(u || '').trim().replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase(); };

  /* -> { pages: [{url, alts:[{lang, href}]}], errors } */
  function parse(text) {
    var pages = [], t = String(text || '');
    if (/<urlset|<url[\s>]/i.test(t)) {
      (t.match(/<url[\s>][\s\S]*?<\/url>/gi) || []).forEach(function (blk) {
        var loc = (blk.match(/<loc>\s*([^<]+?)\s*<\/loc>/i) || [])[1];
        if (!loc) return;
        var alts = (blk.match(/<xhtml:link\b[^>]*>/gi) || []).filter(function (l) { return /rel\s*=\s*["']alternate["']/i.test(l); })
          .map(function (l) { return { lang: attr(l, 'hreflang'), href: attr(l, 'href') }; });
        pages.push({ url: loc.trim(), alts: alts });
      });
    } else {
      var cur = null;
      t.split(/\r\n|\r|\n/).forEach(function (line) {
        var head = line.match(/^\s*(?:#|---|===)\s*(\S+)\s*$/);
        if (head) { cur = { url: head[1], alts: [] }; pages.push(cur); return; }
        (line.match(/<link\b[^>]*>/gi) || []).forEach(function (l) {
          if (!/rel\s*=\s*["']alternate["']/i.test(l) || attr(l, 'hreflang') == null) return;
          if (!cur) { cur = { url: '(unnamed page)', alts: [] }; pages.push(cur); }
          cur.alts.push({ lang: attr(l, 'hreflang'), href: attr(l, 'href') });
        });
      });
    }
    return pages.filter(function (p) { return p.alts.length; });
  }

  function check(pages) {
    var out = [], byUrl = {};
    pages.forEach(function (p) { byUrl[norm(p.url)] = p; });
    pages.forEach(function (p) {
      var me = p.url, langs = {}, self = false, xdef = false, schemes = {};
      p.alts.forEach(function (a) {
        var lang = a.lang || '', href = a.href || '';
        if (!CODE.test(lang)) {
          var sug = FIXES[lang.toLowerCase()] || (lang.indexOf('_') > -1 ? lang.replace('_', '-') : null) || (/^[a-z]{2}-[a-z]{2}$/.test(lang) ? lang.slice(0, 3) + lang.slice(3).toUpperCase() : null);
          out.push({ level: 'error', text: me + ': invalid hreflang "' + lang + '"', detail: 'Use a language code (ISO 639-1) with an optional region (ISO 3166-1), like en-GB.' + (sug ? ' Did you mean "' + sug + '"?' : '') });
        } else if (/^[a-z]{2,3}-[a-z]{2}$/.test(lang)) out.push({ level: 'error', text: me + ': "' + lang + '" should have an uppercase region', detail: 'Write ' + lang.slice(0, 3) + lang.slice(3).toUpperCase() + '.' });
        else if (FIXES[lang.toLowerCase()] && FIXES[lang.toLowerCase()] !== lang) out.push({ level: 'error', text: me + ': "' + lang + '" is not a valid code', detail: 'Use "' + FIXES[lang.toLowerCase()] + '".' });
        if (langs[lang.toLowerCase()]) out.push({ level: 'error', text: me + ': hreflang "' + lang + '" appears more than once.' });
        langs[lang.toLowerCase()] = 1;
        if (!/^https?:\/\//i.test(href)) out.push({ level: 'error', text: me + ': the URL for "' + lang + '" isn\'t absolute', detail: href || '(empty)' });
        else schemes[href.split(':')[0].toLowerCase()] = 1;
        if (lang === 'x-default') xdef = true;
        if (norm(href) === norm(me)) self = true;
      });
      if (!self) out.push({ level: 'error', text: me + ' doesn\'t list itself.', detail: 'Each page must include an hreflang entry that points to its own URL.' });
      if (!xdef) out.push({ level: 'warn', text: me + ' has no x-default.', detail: 'Add x-default for visitors whose language you don\'t cover, usually your language selector or main site.' });
      if (schemes.http && schemes.https) out.push({ level: 'warn', text: me + ' mixes http and https URLs.' });
      p.alts.forEach(function (a) {
        var other = byUrl[norm(a.href)];
        if (!other || norm(a.href) === norm(me)) return;
        var back = other.alts.some(function (b) { return norm(b.href) === norm(me); });
        if (!back) out.push({ level: 'error', text: 'Missing return link: ' + a.href + ' doesn\'t point back to ' + me, detail: 'hreflang must be reciprocal. Google ignores annotations that aren\'t confirmed by the other page.' });
      });
    });
    var missing = {};
    pages.forEach(function (p) { p.alts.forEach(function (a) { if (a.href && !byUrl[norm(a.href)]) missing[a.href] = 1; }); });
    var mk = Object.keys(missing);
    if (mk.length) out.push({ level: 'info', text: mk.length + ' alternate URL' + (mk.length > 1 ? 's' : '') + ' weren\'t in your paste, so return links to them weren\'t checked.', detail: mk.slice(0, 5).join(', ') + (mk.length > 5 ? ', …' : '') });
    if (!out.some(function (f) { return f.level === 'error' || f.level === 'warn'; })) out.unshift({ level: 'ok', text: 'No problems found in ' + pages.length + ' page' + (pages.length > 1 ? 's' : '') + '.' });
    return out;
  }

  /* rows: [{lang, url}], xdefault: url or '' */
  function generate(rows, xdefault) {
    var all = rows.slice(); if (xdefault) all.push({ lang: 'x-default', url: xdefault });
    var tags = all.map(function (r) { return '<link rel="alternate" hreflang="' + KJA.esc(r.lang) + '" href="' + KJA.esc(r.url) + '" />'; }).join('\n');
    var links = all.map(function (r) { return '    <xhtml:link rel="alternate" hreflang="' + KJA.esc(r.lang) + '" href="' + KJA.esc(r.url) + '" />'; }).join('\n');
    var xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
      rows.map(function (r) { return '  <url>\n    <loc>' + KJA.esc(r.url) + '</loc>\n' + links + '\n  </url>'; }).join('\n') + '\n</urlset>';
    return { tags: tags, xml: xml };
  }
  function parseRows(text) {
    var rows = [], bad = [];
    String(text || '').split(/\r\n|\r|\n/).forEach(function (l, i) {
      l = l.trim(); if (!l) return;
      var m = l.split(/[\s,\t]+/);
      if (m.length < 2 || !/^https?:\/\//i.test(m[1])) { bad.push('Line ' + (i + 1) + ': ' + l.slice(0, 60)); return; }
      rows.push({ lang: m[0], url: m[1] });
    });
    return { rows: rows, bad: bad };
  }

  var api = { parse: parse, check: check, generate: generate, parseRows: parseRows };
  root.KJHreflang = api;
  if (typeof module !== 'undefined') { global.KJA = global.KJA || require('./aem-kit.js'); module.exports = api; }
  if (typeof document === 'undefined') return;

  function init() {
    var form = document.getElementById('hlForm'); if (!form) return;
    var h = root.KJTools.h, out = document.getElementById('hlOut'), mode = 'check';
    var tabs = form.querySelectorAll('[data-mode]');
    function setMode(m) {
      mode = m;
      tabs.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === m)); });
      form.querySelectorAll('[data-pane]').forEach(function (p) { p.hidden = p.dataset.pane !== m; });
      out.hidden = true;
    }
    tabs.forEach(function (b) { b.addEventListener('click', function () { setMode(b.dataset.mode); }); });
    document.getElementById('hlSample').addEventListener('click', function () {
      if (mode === 'check') form.elements.hlText.value = '# https://example.com/en/\n<link rel="alternate" hreflang="en" href="https://example.com/en/" />\n<link rel="alternate" hreflang="fr_FR" href="https://example.com/fr/" />\n<link rel="alternate" hreflang="de-de" href="https://example.com/de/" />\n\n# https://example.com/fr/\n<link rel="alternate" hreflang="fr" href="https://example.com/fr/" />\n<link rel="alternate" hreflang="en" href="https://example.com/en/" />\n\n# https://example.com/de/\n<link rel="alternate" hreflang="de" href="https://example.com/de/" />';
      else { form.elements.hlRows.value = 'en https://example.com/en/about/\nfr-FR https://example.com/fr/a-propos/\nde https://example.com/de/ueber-uns/'; form.elements.hlDefault.value = 'https://example.com/en/about/'; }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault(); out.hidden = false; out.textContent = '';
      if (mode === 'check') {
        var pages = parse(form.elements.hlText.value);
        if (!pages.length) { out.appendChild(h('p', { class: 'pc-error', role: 'alert', text: 'No hreflang annotations found. Paste a sitemap, or <link rel="alternate" hreflang> tags under a "# page URL" line.' })); return; }
        out.appendChild(h('h3', { text: 'Result for ' + pages.length + ' page' + (pages.length > 1 ? 's' : '') }));
        out.appendChild(KJA.findings(check(pages)));
      } else {
        var r = parseRows(form.elements.hlRows.value);
        if (r.bad.length) out.appendChild(KJA.findings(r.bad.map(function (b) { return { level: 'error', text: 'Can\'t read ' + b, detail: 'Use "language-code absolute-URL", one per line.' }; })));
        if (!r.rows.length) { if (!r.bad.length) out.appendChild(h('p', { class: 'pc-error', role: 'alert', text: 'Add at least one "language URL" line.' })); return; }
        var g = generate(r.rows, form.elements.hlDefault.value.trim());
        out.appendChild(KJA.findings(check(parse(g.xml))));
        out.appendChild(KJA.codeBlock('HTML tags for the <head> of every page in the set', g.tags, 'hreflang-tags.html', 'Put the same block in each language version of this page, including itself.'));
        out.appendChild(KJA.codeBlock('Sitemap with hreflang', g.xml, 'sitemap-hreflang.xml', 'An alternative to HTML tags. Use one method, not both.'));
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);

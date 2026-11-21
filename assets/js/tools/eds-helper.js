/* Edge Delivery Services helper: helix-query.yaml, helix-sitemap.yaml, redirects and bulk metadata sheets.
   Runs in the browser. Needs redirect-map.js for the redirects tab. */
(function (root) {
  'use strict';

  var PROPS = {
    title: ['head > meta[property="og:title"]', 'attribute(el, "content")'],
    description: ['head > meta[name="description"]', 'attribute(el, "content")'],
    image: ['head > meta[property="og:image"]', 'match(attribute(el, "content"), "https:\\/\\/[^/]+(/.*)")'],
    lastModified: ['none', 'parseTimestamp(headers["last-modified"], "ddd, DD MMM YYYY hh:mm:ss GMT")'],
    robots: ['head > meta[name="robots"]', 'attribute(el, "content")'],
    author: ['head > meta[name="author"]', 'attribute(el, "content")'],
    template: ['head > meta[name="template"]', 'attribute(el, "content")'],
    category: ['head > meta[name="category"]', 'attribute(el, "content")']
  };
  var lines = function (s) { return String(s || '').split(/[\r\n,]+/).map(function (x) { return x.trim(); }).filter(Boolean); };
  var q = function (s) { return "'" + s.replace(/'/g, "''") + "'"; };

  function queryYaml(o) {
    var y = ['version: 1', 'indices:', '  ' + o.name + ':', '    include:'];
    (o.include.length ? o.include : ['/**']).forEach(function (p) { y.push('      - ' + q(p)); });
    if (o.exclude.length) { y.push('    exclude:'); o.exclude.forEach(function (p) { y.push('      - ' + q(p)); }); }
    y.push('    target: ' + o.target, '    properties:');
    o.props.forEach(function (k) { y.push('      ' + k + ':', '        select: ' + PROPS[k][0], '        value: ' + PROPS[k][1]); });
    return y.join('\n') + '\n';
  }
  function sitemapYaml(o) {
    return ['sitemaps:', '  default:', '    origin: ' + o.origin, '    source: ' + o.target, '    destination: /sitemap.xml', '    lastmod: YYYY-MM-DD'].join('\n') + '\n';
  }
  function queryChecks(o) {
    var f = [];
    if (!/^\/.+\.json$/.test(o.target)) f.push({ level: 'error', text: 'The target should be a path ending in .json, like /query-index.json.' });
    if (!o.props.length) f.push({ level: 'error', text: 'Pick at least one property.' });
    if (o.props.indexOf('lastModified') < 0) f.push({ level: 'info', text: 'Without lastModified the generated sitemap can\'t carry <lastmod> dates.' });
    if (o.props.indexOf('robots') < 0) f.push({ level: 'info', text: 'Add robots if authors use noindex, so your sitemap can skip those pages.' });
    f.push({ level: 'info', text: 'Commit helix-query.yaml to the root of your repository. Indexing starts when pages are published.' });
    return f;
  }
  /* "/blog/** | template=blog; robots=noindex" per line -> TSV */
  function metadata(text) {
    var rows = [], keys = [], errors = [];
    String(text || '').split(/\r\n|\r|\n/).forEach(function (l, i) {
      l = l.trim(); if (!l || l.charAt(0) === '#') return;
      var bar = l.indexOf('|');
      if (bar < 0) { errors.push('Line ' + (i + 1) + ': use "/path/** | key=value; key=value"'); return; }
      var url = l.slice(0, bar).trim(), kv = {};
      l.slice(bar + 1).split(';').forEach(function (p) {
        var e = p.indexOf('='); if (e < 1) return;
        var k = p.slice(0, e).trim(), v = p.slice(e + 1).trim();
        kv[k] = v; if (keys.indexOf(k) < 0) keys.push(k);
      });
      if (url.charAt(0) !== '/' && !/^https?:\/\//.test(url)) { errors.push('Line ' + (i + 1) + ': the URL pattern should start with /'); return; }
      if (!Object.keys(kv).length) { errors.push('Line ' + (i + 1) + ': no key=value pairs.'); return; }
      rows.push({ url: url, kv: kv });
    });
    var tsv = ['URL'].concat(keys).join('\t') + '\n' + rows.map(function (r) { return [r.url].concat(keys.map(function (k) { return (r.kv[k] || '').replace(/[\t\r\n]+/g, ' '); })).join('\t'); }).join('\n');
    return { tsv: tsv, rows: rows, errors: errors };
  }

  var api = { queryYaml: queryYaml, sitemapYaml: sitemapYaml, queryChecks: queryChecks, metadata: metadata, PROPS: PROPS };
  root.KJEds = api;
  if (typeof module !== 'undefined') { global.KJA = global.KJA || require('./aem-kit.js'); module.exports = api; }
  if (typeof document === 'undefined') return;

  function init() {
    var form = document.getElementById('edForm'); if (!form) return;
    var h = root.KJTools.h, out = document.getElementById('edOut'), mode = 'index';
    var tabs = form.querySelectorAll('[data-mode]');
    function setMode(m) {
      mode = m; out.hidden = true;
      tabs.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === m)); });
      form.querySelectorAll('[data-pane]').forEach(function (p) { p.hidden = p.dataset.pane !== m; });
    }
    tabs.forEach(function (b) { b.addEventListener('click', function () { setMode(b.dataset.mode); }); });
    document.getElementById('edSample').addEventListener('click', function () {
      if (mode === 'index') { form.elements.edInclude.value = '/blog/**'; form.elements.edExclude.value = '/drafts/**\n/**.json'; form.elements.edOrigin.value = 'https://www.example.com'; }
      else if (mode === 'redirects') form.elements.edRedirects.value = '/old-about,/about\n/about,/company\n/news/2019/launch,https://www.example.com/blog/launch';
      else form.elements.edMeta.value = '/blog/** | template=blog; robots=index\n/drafts/** | robots=noindex\n/ | title=Home; description=Welcome';
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault(); out.hidden = false; out.textContent = '';
      if (mode === 'index') {
        var props = Array.prototype.slice.call(form.querySelectorAll('input[name="edProp"]:checked')).map(function (i) { return i.value; });
        var o = { name: form.elements.edName.value.trim().replace(/[^A-Za-z0-9_-]/g, '') || 'default', include: lines(form.elements.edInclude.value), exclude: lines(form.elements.edExclude.value), target: form.elements.edTarget.value.trim() || '/query-index.json', props: props, origin: form.elements.edOrigin.value.trim().replace(/\/+$/, '') || 'https://www.example.com' };
        out.appendChild(KJA.findings(queryChecks(o)));
        if (!props.length) return;
        out.appendChild(KJA.codeBlock('helix-query.yaml', queryYaml(o), 'helix-query.yaml', 'Place in the root of your code repository.'));
        out.appendChild(KJA.codeBlock('helix-sitemap.yaml (optional)', sitemapYaml(o), 'helix-sitemap.yaml', 'Builds /sitemap.xml from the index above. Edit the origin to your live domain.'));
      } else if (mode === 'redirects') {
        if (!root.KJRedirects) return;
        var r = root.KJRedirects.build(form.elements.edRedirects.value, { flatten: true, status: 301 });
        if (!r.total) { out.appendChild(h('p', { class: 'pc-error', role: 'alert', text: 'Paste at least one "old, new" pair.' })); return; }
        out.appendChild(KJA.findings(r.issues.length ? r.issues : [{ level: 'ok', text: 'No duplicates, loops or chains.' }]));
        if (r.rows.length) out.appendChild(KJA.codeBlock('redirects sheet', r.eds, 'redirects.tsv', 'Paste into a spreadsheet named "redirects" (columns Source and Destination), preview and publish it. Chains are flattened.'));
      } else {
        var m = metadata(form.elements.edMeta.value);
        if (m.errors.length) out.appendChild(KJA.findings(m.errors.map(function (t) { return { level: 'error', text: t }; })));
        if (!m.rows.length) { if (!m.errors.length) out.appendChild(h('p', { class: 'pc-error', role: 'alert', text: 'Add at least one "pattern | key=value" line.' })); return; }
        out.appendChild(KJA.codeBlock('metadata sheet', m.tsv, 'metadata.tsv', 'Paste into a sheet named "metadata" at the root of your content. URL patterns support * and ** wildcards.'));
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);

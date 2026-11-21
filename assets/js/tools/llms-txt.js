/* llms.txt generator and validator (llmstxt.org format). Runs in the browser. */
(function (root) {
  'use strict';

  var titleFromUrl = function (u) {
    var seg = u.replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop() || u.replace(/^https?:\/\//, '');
    return seg.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); });
  };
  /* "## Section" lines start a section. Page lines: "Title | URL | note", "URL | note" or a bare URL. */
  function parsePages(text) {
    var sections = [], cur = null, errors = [];
    String(text || '').split(/\r\n|\r|\n/).forEach(function (raw, i) {
      var line = raw.trim(); if (!line) return;
      var hm = line.match(/^##\s+(.+)$/);
      if (hm) { cur = { name: hm[1].trim(), items: [] }; sections.push(cur); return; }
      var parts = line.split('|').map(function (s) { return s.trim(); }), title, url, note = '';
      var ui = parts.findIndex(function (p) { return /^https?:\/\/\S+$/i.test(p); });
      if (ui < 0) { errors.push('Line ' + (i + 1) + ' has no absolute URL: ' + line.slice(0, 60)); return; }
      url = parts[ui]; title = ui > 0 ? parts[0] : titleFromUrl(url); note = parts[ui + 1] || '';
      if (!cur) { cur = { name: 'Pages', items: [] }; sections.push(cur); }
      cur.items.push({ title: title, url: url, note: note });
    });
    return { sections: sections, errors: errors };
  }
  function generate(o) {
    var out = ['# ' + (o.name || 'Site name').trim(), ''];
    if (o.summary) out.push('> ' + o.summary.trim().replace(/\s*\n\s*/g, ' '), '');
    if (o.details) out.push(o.details.trim(), '');
    o.sections.forEach(function (s) {
      if (!s.items.length) return;
      out.push('## ' + s.name, '');
      s.items.forEach(function (it) { out.push('- [' + it.title + '](' + it.url + ')' + (it.note ? ': ' + it.note : '')); });
      out.push('');
    });
    return out.join('\n').replace(/\n+$/, '\n');
  }
  function validate(text) {
    var f = [], lines = String(text || '').split(/\r\n|\r|\n/), body = lines.filter(function (l) { return l.trim(); });
    if (!body.length) return [{ level: 'error', text: 'Nothing to check.' }];
    var h1 = body.filter(function (l) { return /^#\s+\S/.test(l); });
    if (!/^#\s+\S/.test(body[0])) f.push({ level: 'error', text: 'The file must start with a single H1 (# Site name).', detail: 'The first non-empty line is "' + body[0].slice(0, 60) + '".' });
    else if (h1.length > 1) f.push({ level: 'error', text: 'There is more than one H1.', detail: 'Only the title uses a single #. Use ## for sections.' });
    else f.push({ level: 'ok', text: 'Starts with an H1: ' + body[0].replace(/^#\s+/, '') });
    if (!/^>\s+\S/.test(body[1] || '')) f.push({ level: 'warn', text: 'No blockquote summary right after the title.', detail: 'A one-or-two sentence summary starting with "> " is what AI tools quote.' });
    else f.push({ level: 'ok', text: 'Has a summary blockquote.' });
    var links = 0, bad = [], seen = {}, dup = [], inSection = false, sections = 0, empty = [], lastSec = null, secCount = 0;
    lines.forEach(function (l, i) {
      if (/^##\s+\S/.test(l)) { if (lastSec && !secCount) empty.push(lastSec); lastSec = l.replace(/^##\s+/, ''); secCount = 0; inSection = true; sections++; return; }
      if (/^#{3,}\s/.test(l)) f.push({ level: 'warn', text: 'Line ' + (i + 1) + ' uses a deeper heading.', detail: 'The format uses H2 sections containing link lists.' });
      if (/^\s*[-*]\s/.test(l)) {
        var m = l.match(/^\s*[-*]\s+\[([^\]]+)\]\(([^)\s]+)\)(?::\s*\S.*)?\s*$/);
        if (!m) bad.push('Line ' + (i + 1) + ': ' + l.trim().slice(0, 70));
        else { links++; secCount++; if (!/^https?:\/\//i.test(m[2])) bad.push('Line ' + (i + 1) + ': link isn\'t absolute (' + m[2] + ')'); if (seen[m[2]]) dup.push(m[2]); seen[m[2]] = 1; }
      }
    });
    if (lastSec && !secCount) empty.push(lastSec);
    if (bad.length) f.push({ level: 'error', text: bad.length + ' list item' + (bad.length > 1 ? 's' : '') + ' aren\'t in the "- [Title](https://url): note" format.', detail: bad.slice(0, 4).join(' · ') });
    if (dup.length) f.push({ level: 'warn', text: 'Duplicate links: ' + dup.slice(0, 3).join(', ') });
    if (!sections) f.push({ level: 'warn', text: 'No ## sections.', detail: 'Group links under headings such as ## Docs or ## Blog.' });
    if (empty.length) f.push({ level: 'warn', text: 'Empty section: ' + empty.join(', ') });
    if (links > 50) f.push({ level: 'info', text: links + ' links. Keep the file short and put secondary material under "## Optional".' });
    if (links && !bad.length) f.push({ level: 'ok', text: links + ' links in the right format.' });
    if (!links) f.push({ level: 'error', text: 'No links found.' });
    return f;
  }

  var api = { parsePages: parsePages, generate: generate, validate: validate };
  root.KJLlms = api;
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document === 'undefined') return;

  function init() {
    var form = document.getElementById('llForm'); if (!form) return;
    var h = root.KJTools.h, out = document.getElementById('llOut'), mode = 'make';
    var tabs = form.querySelectorAll('[data-mode]');
    function setMode(m) {
      mode = m; out.hidden = true;
      tabs.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === m)); });
      form.querySelectorAll('[data-pane]').forEach(function (p) { p.hidden = p.dataset.pane !== m; });
    }
    tabs.forEach(function (b) { b.addEventListener('click', function () { setMode(b.dataset.mode); }); });
    document.getElementById('llSample').addEventListener('click', function () {
      if (mode === 'make') { form.elements.llName.value = 'Example Co'; form.elements.llSummary.value = 'Example Co builds accessible web platforms for retail brands.'; form.elements.llPages.value = '## Services\nAEM development | https://example.com/services/aem/ | Enterprise AEM builds and migrations\nhttps://example.com/services/seo/\n\n## Articles\nMigrating to AEMaaCS | https://example.com/blog/aemaacs-migration/ | A practical checklist'; }
      else form.elements.llCheck.value = '# Example Co\n> Example Co builds web platforms.\n\n## Services\n- [AEM](https://example.com/services/aem/): Enterprise AEM\n- [SEO](/services/seo/)\n\n### Details\n* plain text item';
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault(); out.hidden = false; out.textContent = '';
      if (mode === 'make') {
        var p = parsePages(form.elements.llPages.value);
        if (p.errors.length) out.appendChild(KJA.findings(p.errors.map(function (t) { return { level: 'error', text: t }; })));
        if (!p.sections.length) { out.appendChild(h('p', { class: 'pc-error', role: 'alert', text: 'Add at least one page URL.' })); return; }
        var txt = generate({ name: form.elements.llName.value, summary: form.elements.llSummary.value, details: form.elements.llDetails.value, sections: p.sections });
        out.appendChild(KJA.findings(validate(txt)));
        out.appendChild(KJA.codeBlock('llms.txt', txt, 'llms.txt', 'Publish at the root of your domain: https://your-domain/llms.txt'));
      } else out.appendChild(KJA.findings(validate(form.elements.llCheck.value)));
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);

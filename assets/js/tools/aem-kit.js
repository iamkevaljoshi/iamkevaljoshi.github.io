/* Small shared helpers for the paste-in AEM tools (redirects, Dispatcher, hreflang, Oak, llms.txt, EDS).
   Everything runs in the browser. Nothing is uploaded. Needs kit.js (KJTools.h) loaded first. */
(function (root) {
  'use strict';
  var h = function () { return root.KJTools.h.apply(null, arguments); };

  function copy(text, btn) {
    var done = function () { var t = btn.textContent; btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = t; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    else fallback();
    function fallback() {
      var ta = h('textarea', { 'aria-hidden': 'true', style: 'position:fixed;opacity:0' }); ta.value = text;
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { /* copy unavailable */ }
      ta.remove();
    }
  }
  function download(text, name, type) {
    var a = h('a', { href: URL.createObjectURL(new Blob([text], { type: type || 'text/plain' })), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  /* A titled, copyable code block. `name` is the download file name. */
  function codeBlock(title, text, name, hint) {
    var cb = h('button', { type: 'button', class: 'btn ghost pc-sm', text: 'Copy' });
    cb.addEventListener('click', function () { copy(text, cb); });
    var db = h('button', { type: 'button', class: 'btn ghost pc-sm', text: 'Download' });
    db.addEventListener('click', function () { download(text, name); });
    return h('div', { class: 'kt-block' },
      h('div', { class: 'kt-block-head' }, h('h3', { text: title }), h('span', { class: 'kt-actions' }, cb, db)),
      hint ? h('p', { class: 'muted kt-hint', text: hint }) : null,
      h('pre', { class: 'io-code', tabindex: '0' }, h('code', { text: text })));
  }
  /* findings: [{level:'error'|'warn'|'ok'|'info', text, detail}] */
  function findings(list) {
    var cls = { error: 'pc-f-critical', warn: 'pc-f-warn', ok: 'pc-f-ok', info: '' };
    var lbl = { error: 'Fix', warn: 'Check', ok: 'OK', info: 'Note' };
    return h('ul', { class: 'kt-findings' }, list.map(function (f) {
      return h('li', { class: cls[f.level] || '' }, h('span', { class: 'pc-pill' + (f.level === 'info' ? ' pc-info' : ''), text: lbl[f.level] || 'Note' }), ' ', f.text,
        f.detail ? h('small', { text: f.detail }) : null);
    }));
  }
  function stat(label, value, tone) {
    return h('div', { class: 'me-tile' + (tone ? ' me-' + tone : '') }, h('strong', { text: String(value) }), h('span', { text: label }));
  }
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* A textarea with a line-number gutter. Tab inserts two spaces until Escape is pressed, so keyboard
     users can still tab out. Returns { refresh, goLine(n) }. Markup: .kt-editor > pre.kt-gutter + textarea */
  function editor(ta, gut) {
    function refresh() {
      var n = ta.value.split('\n').length, s = '';
      for (var i = 1; i <= n; i++) s += i + '\n';
      gut.textContent = s; gut.scrollTop = ta.scrollTop;
    }
    ta.addEventListener('input', refresh);
    ta.addEventListener('scroll', function () { gut.scrollTop = ta.scrollTop; });
    ta.addEventListener('focus', function () { ta.dataset.tabs = 'on'; });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { ta.dataset.tabs = 'off'; return; }
      if (e.key === 'Tab' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && ta.dataset.tabs === 'on') { e.preventDefault(); ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end'); refresh(); }
    });
    function goLine(n) {
      var lines = ta.value.split('\n'), start = 0;
      for (var i = 0; i < n - 1 && i < lines.length; i++) start += lines[i].length + 1;
      ta.focus(); ta.setSelectionRange(start, start + (lines[n - 1] || '').length);
      var lh = parseFloat(getComputedStyle(ta).lineHeight) || 20;
      ta.scrollTop = Math.max(0, (n - 4) * lh); gut.scrollTop = ta.scrollTop;
      ta.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    refresh();
    return { refresh: refresh, goLine: goLine };
  }
  /* Findings with an optional clickable "Line n" button. f: {level:'error'|'warn'|'info'|'ok', line, text, detail, where} */
  function lineFindings(list, goLine) {
    var cls = { error: 'pc-f-critical', warn: 'pc-f-warn', info: '', ok: 'pc-f-ok' }, lbl = { error: 'Error', warn: 'Warning', info: 'Note', ok: 'OK' };
    return h('ul', { class: 'kt-findings cd-findings' }, list.map(function (f) {
      var ln = f.line && goLine ? h('button', { type: 'button', class: 'cd-line', text: 'Line ' + f.line, 'aria-label': 'Go to line ' + f.line }) : null;
      if (ln) ln.addEventListener('click', function () { goLine(f.line); });
      return h('li', { class: cls[f.level] || '' },
        h('span', { class: 'pc-pill' + (f.level === 'info' ? ' pc-info' : ''), text: lbl[f.level] || 'Note' }), ' ', ln, ln ? ' ' : null, f.text,
        f.detail ? h('small', { text: f.detail }) : null, f.where ? h('small', { class: 'cd-where', text: f.where }) : null);
    }));
  }
  /* Read a dropped or chosen file as text; .gz files are decompressed when the browser supports it. */
  function readFile(file) {
    if (/\.gz$/i.test(file.name) && typeof DecompressionStream !== 'undefined') return new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).text();
    return file.text();
  }
  var api = { copy: copy, download: download, codeBlock: codeBlock, findings: findings, stat: stat, esc: esc, editor: editor, lineFindings: lineFindings, readFile: readFile };
  root.KJA = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

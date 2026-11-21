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
  var api = { copy: copy, download: download, codeBlock: codeBlock, findings: findings, stat: stat, esc: esc };
  root.KJA = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

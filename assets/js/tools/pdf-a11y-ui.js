/* PDF accessibility checker: interface. Everything runs in the browser; the PDF is never uploaded.
   pdf.js and pdf-lib are loaded from this site (assets/libs), not from a third party. */
(function () {
  'use strict';
  var A = window.KJPdfA11y;
  var root = document.getElementById('paTool');
  if (!root || !A) return;
  var LIBS = root.dataset.libs || '/assets/libs/';
  var PILL = { fail: ['pc-diff', 'Fix'], warn: ['pc-similar', 'Check'], pass: ['pc-same', 'OK'], na: ['pc-info', 'Not checked'], info: ['pc-info', 'Note'] };
  var CATS = ['Document', 'Security', 'Structure', 'Links and navigation', 'Forms', 'Information'];

  function el(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k]; if (v == null || v === false) return;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i]; if (c == null || c === false) continue;
      (Array.isArray(c) ? c : [c]).forEach(function (x) { if (x != null && x !== false) e.appendChild(typeof x === 'object' ? x : document.createTextNode(String(x))); });
    }
    return e;
  }
  var $ = function (s) { return root.querySelector(s); };
  var fmtSize = function (b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; };

  var pdfjsP = null, pdfLibP = null;
  function loadPdfjs() {
    if (!pdfjsP) pdfjsP = import(LIBS + 'pdfjs/pdf.min.mjs').then(function (m) { m.GlobalWorkerOptions.workerSrc = LIBS + 'pdfjs/pdf.worker.min.mjs'; return m; });
    return pdfjsP;
  }
  function loadPdfLib() {
    if (window.PDFLib) return Promise.resolve(window.PDFLib);
    if (!pdfLibP) pdfLibP = new Promise(function (res) {
      var s = document.createElement('script'); s.src = LIBS + 'pdf-lib/pdf-lib.min.js';
      s.onload = function () { res(window.PDFLib || null); }; s.onerror = function () { res(null); };
      document.head.appendChild(s);
    });
    return pdfLibP;
  }
  async function sha256(buf) {
    try { var h = await crypto.subtle.digest('SHA-256', buf); return Array.prototype.map.call(new Uint8Array(h), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
    catch (e) { return 'unavailable in this browser'; }
  }

  var state = { data: null, name: '', size: 0, hash: '', report: null, pdfjs: null, manual: {}, reviewer: '', notes: '' };

  /* ---------- upload ---------- */
  var drop = $('#paDrop'), input = $('#paFile'), errEl = $('#paErr'), progEl = $('#paProg'), pwWrap = $('#paPwWrap'), pwInput = $('#paPw'), out = $('#paOut');
  function showErr(msg) { errEl.textContent = msg || ''; errEl.hidden = !msg; }
  function progress(t) { progEl.textContent = t || ''; progEl.hidden = !t; }
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('is-over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('is-over'); }); });
  drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]); });
  input.addEventListener('change', function () { if (input.files[0]) handle(input.files[0]); });
  $('#paPwGo').addEventListener('click', function () { analyseData(pwInput.value); });
  pwInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); analyseData(pwInput.value); } });

  async function handle(file) {
    showErr(''); out.hidden = true; out.textContent = ''; pwWrap.hidden = true; pwInput.value = '';
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') return showErr('That does not look like a PDF. Choose a file ending in .pdf.');
    if (file.size > 150 * 1048576) return showErr('That file is ' + fmtSize(file.size) + '. Files over 150 MB are too large to check in the browser.');
    progress('Reading ' + file.name + '…');
    var buf = await file.arrayBuffer();
    state.data = new Uint8Array(buf); state.name = file.name; state.size = file.size; state.manual = {}; state.notes = ''; state.reviewer = '';
    state.hash = await sha256(buf);
    analyseData('');
  }

  async function analyseData(password) {
    showErr(''); pwWrap.hidden = true;
    try {
      progress('Loading the PDF reader…');
      var lib = await loadPdfjs(); state.pdfjs = lib;
      var doc;
      try { doc = await lib.getDocument({ data: state.data.slice(), password: password || undefined }).promise; }
      catch (e) {
        if (e && e.name === 'PasswordException') {
          progress(''); pwWrap.hidden = false; pwInput.focus();
          showErr(e.code === 2 ? 'That password is not correct. Try again.' : 'This PDF is password protected. Enter the password to check it. It is used only in your browser and is never sent anywhere.');
          return;
        }
        throw e;
      }
      var pdfLib = await loadPdfLib();
      var report = await A.analyse(doc, { pdfLib: pdfLib, data: state.data, onProgress: function (n, t) { progress('Checking page ' + n + ' of ' + t + '…'); } });
      state.report = report; progress(''); render(report);
    } catch (e) {
      progress('');
      var m = e && e.name;
      showErr(m === 'InvalidPDFException' ? 'This file is not a valid PDF, or it is damaged.' : m === 'MissingPDFException' ? 'The file could not be read.' : 'Something went wrong while checking the PDF: ' + String((e && e.message) || e).slice(0, 160) + '. Try a different file, or reload the page.');
    }
  }

  /* ---------- report ---------- */
  function refs(c) {
    var r = c.refs || {}, bits = [];
    if (r.wcag && r.wcag.length) bits.push('WCAG 2.1 SC ' + r.wcag.join(', '));
    if (r.en && r.en.length) bits.push('EN 301 549 ' + r.en.join(', '));
    if (r.matterhorn && r.matterhorn.length) bits.push('Matterhorn ' + r.matterhorn.join(', '));
    return bits;
  }
  function render(R) {
    var F = R.facts, S = R.summary;
    out.hidden = false; out.textContent = '';
    var head = el('h2', { id: 'paResultH', tabindex: '-1', text: 'Result for ' + state.name });
    out.appendChild(head);
    out.appendChild(el('p', { class: 'pa-caution', role: 'note' }, el('strong', { text: 'A pre-check, not a certificate. ' }),
      'Passing every automatic check does not make a PDF accessible or compliant. Reading order, alternative text quality, colour contrast and real screen-reader use need a person. Use this to find and fix problems early and to keep evidence for your accessibility audit.'));
    out.appendChild(el('div', { class: 'me-tiles kt-tiles pa-tiles' },
      tile('Needs fixing', S.fail, S.fail ? 'bad' : ''), tile('Check', S.warn, S.warn ? 'mid' : ''), tile('Passed', S.pass, ''), tile('Not checked', S.na, '')));
    if (F.truncated) out.appendChild(el('p', { class: 'pc-error', role: 'alert', text: 'Only the first ' + F.checkedPages + ' of ' + F.pageCount + ' pages were checked.' }));

    // file facts
    var dl = el('dl', { class: 'pa-facts' });
    [['File', state.name + ' (' + fmtSize(state.size) + ')'], ['SHA-256', state.hash], ['Pages', F.pageCount + (F.truncated ? ' (checked ' + F.checkedPages + ')' : '')],
      ['PDF version', F.info.version || 'unknown'], ['Created with', [F.info.creator, F.info.producer].filter(Boolean).join(' / ') || 'unknown'], ['Protected', F.info.encrypted ? 'Yes' : 'No'],
      ['Checked', new Date().toLocaleString()], ['Tool', 'KJ PDF accessibility checker v' + A.TOOL_VERSION + ', pdf.js ' + (state.pdfjs && state.pdfjs.version || '')]]
      .forEach(function (kv) { dl.appendChild(el('div', null, el('dt', { text: kv[0] }), el('dd', { text: kv[1] }))); });
    out.appendChild(el('details', { class: 'pa-filebox' }, el('summary', { text: 'File details and evidence hash' }), dl));

    // filter
    var only = el('input', { type: 'checkbox', id: 'paOnly' });
    out.appendChild(el('label', { class: 'pc-check pa-filter' }, only, ' Show only problems and items to check'));
    var results = el('div', { class: 'pa-results' }); out.appendChild(results);
    function draw() {
      results.textContent = '';
      CATS.forEach(function (cat) {
        var rank = { fail: 0, warn: 1, na: 2, info: 3, pass: 4 };
        var items = R.checks.filter(function (c) { return c.cat === cat && (!only.checked || c.status === 'fail' || c.status === 'warn'); })
          .map(function (c, i) { return { c: c, i: i }; }).sort(function (a, b) { return (rank[a.c.status] - rank[b.c.status]) || (a.i - b.i); }).map(function (x) { return x.c; });
        if (!items.length) return;
        results.appendChild(el('h3', { text: cat }));
        results.appendChild(el('ul', { class: 'kt-findings pa-list' }, items.map(item)));
      });
      if (!results.firstChild) results.appendChild(el('p', { class: 'muted', text: 'No problems or items to check. Work through the manual checklist below.' }));
    }
    only.addEventListener('change', draw); draw();

    // manual checklist
    var man = el('section', { class: 'pa-manual', 'aria-labelledby': 'paManH' }, el('h3', { id: 'paManH', text: 'Manual checks a person must do' }),
      el('p', { class: 'muted', text: 'These cannot be automated. Tick each one as you complete it. Your ticks, name and notes are included in the exports.' }));
    var ul = el('ul', { class: 'pa-steps' });
    A.MANUAL.forEach(function (m) {
      var cb = el('input', { type: 'checkbox', 'data-id': m.id }); cb.checked = !!state.manual[m.id];
      cb.addEventListener('change', function () { state.manual[m.id] = cb.checked; });
      ul.appendChild(el('li', null, el('label', null, cb, el('span', null, m.text + ' ', el('em', { class: 'muted', text: '(' + m.ref + ')' })))));
    });
    man.appendChild(ul);
    var rev = el('input', { type: 'text', id: 'paRev', autocomplete: 'name', placeholder: 'Your name or team' }); rev.addEventListener('input', function () { state.reviewer = rev.value; });
    var nts = el('textarea', { id: 'paNotes', rows: 3, placeholder: 'Findings, exceptions, who will fix what, by when' }); nts.addEventListener('input', function () { state.notes = nts.value; });
    man.appendChild(el('div', { class: 'kt-grid pa-review' }, el('label', { class: 'pc-field' }, el('span', { text: 'Reviewed by' }), rev), el('label', { class: 'pc-field' }, el('span', { text: 'Notes' }), nts)));
    out.appendChild(man);

    // tag viewer
    out.appendChild(tagViewer(F));

    // export
    out.appendChild(el('div', { class: 'kt-row pa-export' },
      el('button', { type: 'button', class: 'btn solid', text: 'Download evidence (JSON)', onclick: function () { download(JSON.stringify(evidence(R), null, 2), baseName() + '-accessibility-evidence.json', 'application/json'); } }),
      el('button', { type: 'button', class: 'btn ghost', text: 'Download results (CSV)', onclick: function () { download(csv(R), baseName() + '-accessibility-results.csv', 'text/csv'); } }),
      el('button', { type: 'button', class: 'btn ghost', text: 'Print or save as PDF', onclick: function () { out.querySelectorAll('details').forEach(function (d) { d.open = true; }); window.print(); } })));
    out.appendChild(el('p', { class: 'muted pa-foot', text: 'Reports map each check to WCAG 2.1, EN 301 549 clause 10 and Matterhorn Protocol failure conditions. IS 17802 is reported to align with EN 301 549, so confirm clause numbering against your copy of the standard. Nothing here replaces an audit by an accredited professional.' }));
    head.focus();
  }
  function tile(label, n, tone) { return el('div', { class: 'me-tile' + (tone ? ' me-' + tone : '') }, el('strong', { text: String(n) }), el('span', { text: label })); }
  function item(c) {
    var p = PILL[c.status] || PILL.info, bits = refs(c);
    var li = el('li', { class: c.status === 'fail' ? 'pc-f-critical' : c.status === 'warn' ? 'pc-f-warn' : '' },
      el('span', { class: 'pc-pill ' + p[0], text: p[1] }), ' ', el('strong', { text: c.title + '. ' }), c.summary);
    if (c.detail || c.fix || bits.length) {
      var body = el('div', { class: 'pa-more' });
      if (c.detail) body.appendChild(el('pre', { class: 'pa-detail', text: c.detail }));
      if (c.fix) body.appendChild(el('p', null, el('strong', { text: 'How to fix: ' }), c.fix));
      if (bits.length) body.appendChild(el('p', { class: 'pa-refs muted', text: bits.join('  ·  ') }));
      li.appendChild(el('details', null, el('summary', { text: 'Details' + (c.fix ? ' and fix' : '') }), body));
    }
    return li;
  }

  /* ---------- tag viewer ---------- */
  function tagViewer(F) {
    var sec = el('section', { class: 'pa-tags', 'aria-labelledby': 'paTagH' }, el('h3', { id: 'paTagH', text: 'Tag and reading-order viewer' }));
    if (!F.trees.length) { sec.appendChild(el('p', { class: 'muted', text: 'There is no structure tree to show, because the PDF is not tagged.' })); return sec; }
    sec.appendChild(el('p', { class: 'muted', text: 'This is the order a screen reader follows, with the text under each tag. Compare it with the page by eye. Reading order is the most common failure that no tool can judge for you.' }));
    var sel = el('select', { id: 'paTagPage', 'aria-label': 'Page' }, F.trees.map(function (t) { return el('option', { value: t.page, text: 'Page ' + t.page }); }));
    var box = el('div', { class: 'pa-tree', tabindex: '0', role: 'region', 'aria-label': 'Tag tree' });
    sec.appendChild(el('label', { class: 'pc-field pc-inline' }, el('span', { text: 'Page' }), sel));
    sec.appendChild(box);
    function show() {
      var t = F.trees.filter(function (x) { return String(x.page) === sel.value; })[0], count = { n: 0 };
      box.textContent = ''; box.appendChild(list(t.nodes, 0, count));
      if (count.n >= 2500) box.appendChild(el('p', { class: 'muted', text: 'Showing the first 2,500 nodes of this page.' }));
      if (F.pageCount > F.trees.length) sec.dataset.cap = '1';
    }
    sel.addEventListener('change', show); show();
    if (F.pageCount > F.trees.length) sec.appendChild(el('p', { class: 'muted', text: 'The viewer shows the first ' + F.trees.length + ' pages. The checks above cover all checked pages.' }));
    return sec;
  }
  var HIDE = { NonStruct: 1, Span: 1, Part: 1, Div: 1, Sect: 1, Art: 1 };
  function list(nodes, depth, count) {
    var ul = el('ul', { class: 'pa-ul' });
    nodes.forEach(function (n) { appendNode(ul, n, depth, count); });
    return ul;
  }
  function appendNode(ul, n, depth, count) {
    if (count.n >= 2500) return;
    if (n.r === '#object') return;
    if (n.r === '#text') { if (n.t) { count.n++; ul.appendChild(el('li', { class: 'pa-text', text: n.t.length > 160 ? n.t.slice(0, 160) + '…' : n.t })); } return; }
    if (HIDE[n.r] && !n.a && !n.l) { (n.c || []).forEach(function (k) { appendNode(ul, k, depth, count); }); return; }
    count.n++;
    var label = el('span', { class: 'pa-role pa-role-' + n.r.replace(/[^A-Za-z0-9]/g, ''), text: n.r });
    var extra = [];
    if (n.r === 'Figure') extra.push(n.a ? el('span', { class: 'pa-alt', text: 'alt: "' + n.a.slice(0, 120) + '"' }) : el('span', { class: 'pa-alt pa-missing', text: 'no alternative text' }));
    else if (n.a) extra.push(el('span', { class: 'pa-alt', text: 'alt: "' + n.a.slice(0, 120) + '"' }));
    if (n.l) extra.push(el('span', { class: 'pa-lang', text: 'lang ' + n.l }));
    var li = el('li', null, label, ' ', extra);
    if (n.c && n.c.length) li.appendChild(list(n.c, depth + 1, count));
    ul.appendChild(li);
  }

  /* ---------- export ---------- */
  var baseName = function () { return state.name.replace(/\.pdf$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 60) || 'document'; };
  function download(text, name, type) {
    var a = el('a', { href: URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' })), download: name });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function evidence(R) {
    var F = R.facts;
    return {
      tool: 'KJ PDF accessibility checker', toolVersion: A.TOOL_VERSION, pdfjsVersion: state.pdfjs && state.pdfjs.version, generatedAt: new Date().toISOString(),
      disclaimer: 'Automated pre-check. Not a certification and not a substitute for an audit by an accredited professional, usability testing with people with disabilities, or independent PDF/UA validation.',
      file: { name: state.name, sizeBytes: state.size, sha256: state.hash, pages: F.pageCount, pagesChecked: F.checkedPages, pdfVersion: F.info.version, creator: F.info.creator, producer: F.info.producer, encrypted: F.info.encrypted },
      reviewer: state.reviewer, notes: state.notes, summary: R.summary,
      checks: R.checks.map(function (c) { return { id: c.id, category: c.cat, title: c.title, status: c.status, summary: c.summary, detail: c.detail || '', fix: c.fix || '', wcag21: (c.refs && c.refs.wcag) || [], en301549: (c.refs && c.refs.en) || [], matterhorn: (c.refs && c.refs.matterhorn) || [] }; }),
      manualChecks: A.MANUAL.map(function (m) { return { id: m.id, text: m.text, reference: m.ref, completed: !!state.manual[m.id] }; })
    };
  }
  function csv(R) {
    var q = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var rows = [['File', 'SHA-256', 'Category', 'Check', 'Status', 'Summary', 'How to fix', 'WCAG 2.1 SC', 'EN 301 549', 'Matterhorn']];
    R.checks.forEach(function (c) { rows.push([state.name, state.hash, c.cat, c.title, c.status, c.summary, c.fix || '', ((c.refs && c.refs.wcag) || []).join(' '), ((c.refs && c.refs.en) || []).join(' '), ((c.refs && c.refs.matterhorn) || []).join(' ')]); });
    A.MANUAL.forEach(function (m) { rows.push([state.name, state.hash, 'Manual', m.text, state.manual[m.id] ? 'done' : 'not done', '', '', m.ref, '', '']); });
    return '﻿' + rows.map(function (r) { return r.map(q).join(','); }).join('\r\n');
  }
})();

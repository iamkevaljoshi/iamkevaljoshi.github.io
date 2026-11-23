/* PDF accessibility pre-check. Reads a PDF in the browser with pdf.js (and pdf-lib for page keys),
   runs automated checks mapped to WCAG 2.1, EN 301 549 clause 10 and the Matterhorn Protocol (PDF/UA-1),
   and produces an evidence report. The file never leaves the device. It is a pre-audit aid, not a certification. */
(function (root) {
  'use strict';

  var TOOL_VERSION = '1.0';
  var MAX_PAGES = 500, VIEW_PAGES = 40;
  var GENERIC_LINK = /^(click( here)?|here|tap here|read more|more|learn more|know more|see more|view more|view|details|link|this link|download|go|continue)$/;
  var LANG_RE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
  var PASS_THROUGH = { NonStruct: 1, Span: 1, Part: 1, Sect: 1, Div: 1, Art: 1, Document: 1, Root: 1 };

  var norm = function (s) { return String(s || '').replace(/\s+/g, ' ').trim(); };
  var tick = function () { return new Promise(function (r) { setTimeout(r, 0); }); };

  /* ---------- 1. collect facts from a loaded pdf.js document ---------- */
  async function collect(doc, opts) {
    opts = opts || {};
    var F = {
      pageCount: doc.numPages, checkedPages: Math.min(doc.numPages, MAX_PAGES), truncated: doc.numPages > MAX_PAGES,
      info: {}, xmp: { title: null, pdfuaPart: null, has: false }, marked: null, hasStruct: false,
      viewer: {}, permissions: null, outlineCount: 0, jsDoc: false, tabs: { checked: false, missing: [], notS: [] },
      pages: [], roles: {}, headings: [], figures: [], tables: [], lists: [], links: [], widgets: [], taggedIds: {},
      docLang: null, trees: []
    };
    var meta = await doc.getMetadata().catch(function () { return { info: {}, metadata: null }; });
    var info = meta.info || {};
    F.info = { title: norm(info.Title), language: norm(info.Language), producer: norm(info.Producer), creator: norm(info.Creator), version: info.PDFFormatVersion || '',
      xfa: !!info.IsXFAPresent, acroform: !!info.IsAcroFormPresent, signed: !!info.IsSignaturesPresent, encrypted: !!info.EncryptFilterName };
    if (meta.metadata) {
      F.xmp.has = true;
      try { F.xmp.title = norm(meta.metadata.get('dc:title')) || null; } catch (e) { /* no dc:title */ }
      try { F.xmp.pdfuaPart = norm(meta.metadata.get('pdfuaid:part')) || null; } catch (e) { /* no PDF/UA id */ }
    }
    var mi = await doc.getMarkInfo().catch(function () { return null; });
    F.marked = mi ? !!mi.Marked : null;
    F.viewer = (await doc.getViewerPreferences().catch(function () { return null; })) || {};
    F.permissions = await doc.getPermissions().catch(function () { return null; });
    if (F.permissions) F.info.encrypted = true;
    var outline = await doc.getOutline().catch(function () { return null; });
    F.outlineCount = outline ? outline.length : 0;
    var js = await doc.getJSActions().catch(function () { return null; });
    F.jsDoc = !!(js && Object.keys(js).length);

    var annotPages = [];
    for (var n = 1; n <= F.checkedPages; n++) {
      if (opts.onProgress) opts.onProgress(n, F.checkedPages);
      if (n % 4 === 0) await tick();
      var page = await doc.getPage(n);
      var tree = await page.getStructTree().catch(function () { return null; });
      var tc = await page.getTextContent({ includeMarkedContent: true }).catch(function () { return { items: [] }; });
      var annots = await page.getAnnotations().catch(function () { return []; });

      var mc = {}, stack = [], chars = 0, repl = 0;
      tc.items.forEach(function (it) {
        if (it.type === 'beginMarkedContentProps') stack.push(it.id || null);
        else if (it.type === 'beginMarkedContent') stack.push(null);
        else if (it.type === 'endMarkedContent') stack.pop();
        else if (typeof it.str === 'string') {
          var s = it.str.replace(/\s/g, '');
          chars += s.length;
          repl += (it.str.match(/[�-]/g) || []).length;
          for (var k = stack.length - 1; k >= 0; k--) if (stack[k]) { mc[stack[k]] = (mc[stack[k]] || '') + it.str; break; }
        }
      });
      var pg = { n: n, chars: chars, repl: repl, tagged: !!tree, links: 0, widgets: 0, tabular: tabularRows(tc.items) };
      annots.forEach(function (a) {
        if (a.subtype === 'Link') { pg.links++; F.links.push({ page: n, id: a.id, url: a.url || (a.dest ? 'internal destination' : ''), contents: norm(a.contentsObj && a.contentsObj.str), text: null, tagged: false }); }
        else if (a.subtype === 'Widget') { pg.widgets++; F.widgets.push({ page: n, id: a.id, name: a.fieldName || '', type: a.fieldType || '', alt: norm(a.alternativeText), hidden: !!a.hidden, readOnly: !!a.readOnly }); }
      });
      if (pg.links || pg.widgets) annotPages.push(n);
      F.pages.push(pg);

      if (tree) {
        F.hasStruct = true;
        var keep = n <= VIEW_PAGES;
        var compact = walk(tree, n, mc, F, keep);
        if (keep) F.trees.push({ page: n, nodes: compact.c || [] });
      }
    }
    // tie link annotations to their Link tags
    F.links.forEach(function (l) { if (F.taggedIds[l.id]) { l.tagged = true; l.text = F.taggedIds[l.id].text; } });
    F.widgets.forEach(function (w) { w.tagged = !!F.taggedIds[w.id]; });

    if (opts.pdfLib && opts.data && annotPages.length && opts.data.length < 60 * 1024 * 1024) {
      try {
        var d = await opts.pdfLib.PDFDocument.load(opts.data, { ignoreEncryption: true, updateMetadata: false });
        var pages = d.getPages();
        annotPages.forEach(function (pn) {
          var t = pages[pn - 1] && pages[pn - 1].node.lookup(opts.pdfLib.PDFName.of('Tabs'));
          if (!t) F.tabs.missing.push(pn); else if (String(t) !== '/S') F.tabs.notS.push(pn);
        });
        F.tabs.checked = true;
      } catch (e) { F.tabs.checked = false; }
    }
    return F;
  }

  /* Does the page hold text laid out like a table? Group text into rows by baseline, then look for consecutive
     rows whose text starts at the same horizontal positions in at least two columns. Returns the length of the
     longest such run of rows. A heuristic, used only to warn when table-like text exists but no table tags do. */
  function tabularRows(items) {
    var rows = [];
    items.forEach(function (it) {
      if (typeof it.str !== 'string' || !it.str.trim() || !it.transform) return;
      var y = it.transform[5], r = null;
      for (var i = 0; i < rows.length; i++) if (Math.abs(rows[i].y - y) < 2.5) { r = rows[i]; break; }
      if (!r) { r = { y: y, xs: {} }; rows.push(r); }
      r.xs[Math.round(it.transform[4] / 2)] = 1;
    });
    rows.sort(function (a, b) { return b.y - a.y; });
    var best = 0, run = 0;
    for (var j = 1; j < rows.length; j++) {
      var common = 0;
      Object.keys(rows[j].xs).forEach(function (x) { if (rows[j - 1].xs[x] || rows[j - 1].xs[+x - 1] || rows[j - 1].xs[+x + 1]) common++; });
      run = common >= 2 ? run + 1 : 0;
      if (run + 1 > best && run >= 1) best = run + 1;
    }
    return best;
  }

  function textOf(node, mc) {
    var out = '';
    (function t(n) {
      if (!n) return;
      if (n.type === 'content') out += (mc[n.id] || '');
      (n.children || []).forEach(t);
    })(node);
    return norm(out);
  }

  /* Walk one page's structure tree, recording what the checks need and returning a compact copy for the viewer. */
  function walk(node, page, mc, F, keep) {
    var role = node.role || (node.type === 'content' ? '#content' : '#' + (node.type || 'node'));
    if (node.type === 'content') return keep ? { r: '#text', t: norm(mc[node.id] || '') } : null;
    if (node.type === 'object' || node.type === 'annotation') return keep ? { r: '#' + node.type, t: String(node.id || '') } : null;
    F.roles[role] = (F.roles[role] || 0) + 1;
    if (node.lang && !F.docLang) F.docLang = node.lang;
    var hm = /^H([1-6])?$/.exec(role);
    var text = (hm || role === 'Link' || role === 'Figure' || role === 'LI' || role === 'TH') ? textOf(node, mc) : '';
    if (hm) F.headings.push({ page: page, level: hm[1] ? +hm[1] : 0, text: text });
    if (role === 'Figure') F.figures.push({ page: page, alt: norm(node.alt), text: text });
    if (role === 'Link') {
      (node.children || []).forEach(function (c) { if (c.type === 'object' && c.id) F.taggedIds[c.id] = { text: text }; });
      F.links_tagged_text = true;
    }
    if (role === 'Form') (node.children || []).forEach(function (c) { if (c.type === 'object' && c.id) F.taggedIds[c.id] = F.taggedIds[c.id] || { text: '' }; });
    if (role === 'Table') {
      var cnt = { th: 0, td: 0, tr: 0 };
      (function c(n) { if (!n) return; if (n.role === 'TH') cnt.th++; else if (n.role === 'TD') cnt.td++; else if (n.role === 'TR') cnt.tr++; (n.children || []).forEach(c); })(node);
      F.tables.push({ page: page, th: cnt.th, td: cnt.td, tr: cnt.tr });
    }
    if (role === 'L') {
      var bad = [];
      (node.children || []).forEach(function (c) { if (c.role && c.role !== 'LI' && c.role !== 'Caption') bad.push(c.role); });
      F.lists.push({ page: page, bad: bad });
    }
    var kids = [];
    (node.children || []).forEach(function (c) { var k = walk(c, page, mc, F, keep); if (keep && k) kids.push(k); });
    if (!keep) return null;
    return { r: role, a: node.alt || '', l: node.lang || '', t: (hm || role === 'Figure' || role === 'Link') ? text : '', c: kids };
  }

  /* ---------- 2. turn facts into checks ---------- */
  var ref = function (wcag, mh, extra) { return { wcag: wcag, matterhorn: mh || [], en: wcag.map(function (w) { return '10.' + w; }), extra: extra || '' }; };
  var s_ = function (n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); };
  var list = function (arr, max) { max = max || 8; return arr.slice(0, max).join(', ') + (arr.length > max ? ' and ' + (arr.length - max) + ' more' : ''); };

  function buildChecks(F) {
    var C = [], tagged = F.marked === true && F.hasStruct;
    function add(c) { C.push(c); }
    var needTags = 'This check needs a tagged PDF. Fix the "tagged PDF" result first.';

    // --- Document ---
    add(F.hasStruct && F.marked === true ? { id: 'tagged', cat: 'Document', title: 'Tagged PDF', status: 'pass', summary: 'The PDF is marked as tagged and has a structure tree.', refs: ref(['1.3.1'], ['01-005']) }
      : F.hasStruct ? { id: 'tagged', cat: 'Document', title: 'Tagged PDF', status: 'warn', summary: 'A structure tree exists but the document is not marked as tagged (MarkInfo).', fix: 'Set the "Tagged PDF" flag in the document properties, or re-export with tagging on.', refs: ref(['1.3.1'], ['01-005']) }
      : { id: 'tagged', cat: 'Document', title: 'Tagged PDF', status: 'fail', summary: 'No structure tree was found. Screen readers get no headings, tables, lists or reading order.', fix: 'Re-export from the source (Word, InDesign or your statement generator) with "Create tagged PDF" or "PDF/UA" on, or remediate the file in Acrobat or PAC-assisted tooling. For generated statements, fix the template once.', refs: ref(['1.3.1', '4.1.2'], ['01-005']) });

    var empty = F.pages.filter(function (p) { return p.chars === 0; }).map(function (p) { return p.n; });
    add(empty.length === F.pages.length ? { id: 'text', cat: 'Document', title: 'Real text, not a scanned image', status: 'fail', summary: 'No page has extractable text. This looks like a scanned or image-only PDF.', fix: 'Run OCR and then tag the result, or better, export from the original source. A scan with an invisible text layer still needs tags and a reading order.', refs: ref(['1.4.5', '1.1.1'], []) }
      : empty.length ? { id: 'text', cat: 'Document', title: 'Real text, not a scanned image', status: 'warn', summary: 'Pages with no extractable text: ' + list(empty) + '.', detail: 'These may be scanned pages, full-page images or intentionally blank pages.', fix: 'Check each one. If it holds information, it needs real text or a text alternative.', refs: ref(['1.4.5', '1.1.1'], []) }
      : { id: 'text', cat: 'Document', title: 'Real text, not a scanned image', status: 'pass', summary: 'Every page has extractable text.', refs: ref(['1.4.5'], []) });

    var repl = F.pages.filter(function (p) { return p.repl > 0; }).map(function (p) { return p.n; });
    add(repl.length ? { id: 'unicode', cat: 'Document', title: 'Text maps to readable characters', status: 'warn', summary: 'Replacement or private-use characters were found on pages ' + list(repl) + '.', detail: 'Screen readers and copy-paste may read these as gaps or symbols. This often means fonts without a proper Unicode mapping.', fix: 'Embed fonts that include a ToUnicode map, or re-export using standard fonts.', refs: ref(['1.3.1'], ['10-001']) }
      : { id: 'unicode', cat: 'Document', title: 'Text maps to readable characters', status: 'pass', summary: 'No replacement or private-use characters were found in the extracted text.', refs: ref(['1.3.1'], []) });

    var title = F.info.title || F.xmp.title;
    var badTitle = title && (/\.(pdf|docx?|xlsx?|pptx?|html?|indd|rtf|txt|tmp)$/i.test(title) || /^(untitled|microsoft (word|excel) - |document\d*$|new document)/i.test(title));
    add(badTitle ? { id: 'title', cat: 'Document', title: 'Document title', status: 'warn', summary: 'The title "' + title + '" looks like a file name or a default, not a meaningful title.', fix: 'Set a title that describes the document, for example "Savings account statement, November 2026".', refs: ref(['2.4.2'], ['06-003', '06-004']) }
      : !title ? { id: 'title', cat: 'Document', title: 'Document title', status: 'fail', summary: 'No title in the document properties.', fix: 'Set a meaningful title (for example "Savings account statement, November 2026"), not the file name.', refs: ref(['2.4.2'], ['06-003']) }
      : !F.xmp.title ? { id: 'title', cat: 'Document', title: 'Document title', status: 'warn', summary: 'Title found: "' + title + '". It is in the Info dictionary but not in XMP metadata.', detail: 'WCAG is satisfied. PDF/UA-1 also expects dc:title in the XMP stream (Matterhorn 06-003).', fix: 'Re-save with XMP metadata, or set the title in the PDF properties of your authoring tool.', refs: ref(['2.4.2'], ['06-003']) }
      : { id: 'title', cat: 'Document', title: 'Document title', status: 'pass', summary: 'Title: "' + title + '".', refs: ref(['2.4.2'], ['06-003']) });

    add(F.viewer.DisplayDocTitle === true ? { id: 'display', cat: 'Document', title: 'Window shows the title', status: 'pass', summary: 'The viewer is set to show the document title in the title bar.', refs: ref(['2.4.2'], ['07-001', '07-002']) }
      : { id: 'display', cat: 'Document', title: 'Window shows the title', status: 'fail', summary: 'The viewer is not set to show the document title, so the file name appears instead.', fix: 'Turn on "Show: Document Title" under Initial View in the document properties.', refs: ref(['2.4.2'], ['07-001', '07-002']) });

    var lang = F.info.language || F.docLang;
    add(!lang ? { id: 'lang', cat: 'Document', title: 'Document language', status: 'fail', summary: 'No document language is set. Screen readers will guess and may read English text in the wrong voice.', fix: 'Set the language in the document properties (for example en-IN or hi-IN). Mark passages in another language separately.', refs: ref(['3.1.1'], ['11-001']) }
      : !LANG_RE.test(lang) ? { id: 'lang', cat: 'Document', title: 'Document language', status: 'warn', summary: 'The language value "' + lang + '" does not look like a valid language tag.', fix: 'Use a language tag such as en, en-IN or hi-IN.', refs: ref(['3.1.1'], ['11-001']) }
      : { id: 'lang', cat: 'Document', title: 'Document language', status: 'pass', summary: 'Language: ' + lang + '.', detail: 'Language-of-parts (3.1.2) still needs a human check where the text switches language.', refs: ref(['3.1.1'], ['11-001']) });

    // --- Security ---
    if (F.permissions || F.info.encrypted) {
      var ok = !F.permissions || F.permissions.indexOf(512) > -1;
      add(ok ? { id: 'security', cat: 'Security', title: 'Encryption allows assistive technology', status: 'pass', summary: 'The document is protected, and "copy for accessibility" is allowed.', detail: 'Remember that screen-reader users must be able to open it: share the password in an accessible way too.', refs: ref(['4.1.2'], ['26-001', '26-002']) }
        : { id: 'security', cat: 'Security', title: 'Encryption allows assistive technology', status: 'fail', summary: 'The document\'s permissions block "copy for accessibility", which can stop screen readers from reading it.', fix: 'Regenerate the protected file with accessibility extraction allowed (the "Enable text access for screen reader devices" option in Acrobat; the equivalent permission in your PDF library).', refs: ref(['4.1.2'], ['26-001', '26-002']) });
    } else add({ id: 'security', cat: 'Security', title: 'Encryption allows assistive technology', status: 'pass', summary: 'The document is not encrypted.', refs: ref(['4.1.2'], ['26-002']) });

    // --- Structure ---
    var T = function (s) { return tagged ? s : { status: 'na', summary: needTags }; };
    var hs = F.headings, issues = [], warns = [];
    if (tagged) {
      var prev = null, firstNum = null, hasGeneric = false, hasNum = false;
      hs.forEach(function (h) {
        if (h.level === 0) hasGeneric = true; else { hasNum = true; if (firstNum === null) firstNum = h.level; }
        if (h.level > 0 && prev !== null && h.level > prev + 1) issues.push('H' + prev + ' is followed by H' + h.level + ' on page ' + h.page + (h.text ? ' ("' + h.text.slice(0, 40) + '")' : '') + ' (14-003)');
        if (h.level > 0) prev = h.level;
        if (!h.text) warns.push('An empty heading on page ' + h.page);
      });
      if (hasGeneric && hasNum) issues.push('The document mixes plain H tags with H1 to H6 (14-007)');
      if (firstNum !== null && firstNum !== 1) warns.push('The first numbered heading is H' + firstNum + ', not H1 (14-002)');
      if (!hs.length && (F.checkedPages > 1)) warns.push('No headings at all in a ' + F.checkedPages + '-page document. Screen-reader users cannot jump between sections.');
    }
    var outlineText = hs.slice(0, 40).map(function (h) { return '  '.repeat(Math.max(0, (h.level || 1) - 1)) + (h.level ? 'H' + h.level : 'H') + ' ' + (h.text || '(empty)') + ' [p.' + h.page + ']'; }).join('\n');
    add(!tagged ? Object.assign({ id: 'headings', cat: 'Structure', title: 'Heading structure', refs: ref(['1.3.1', '2.4.6'], ['14-002', '14-003']) }, T())
      : issues.length ? { id: 'headings', cat: 'Structure', title: 'Heading structure', status: 'fail', summary: issues.slice(0, 3).join('. ') + '.', detail: (warns.length ? warns.join('. ') + '.\n' : '') + 'Outline found:\n' + outlineText, fix: 'Nest headings one level at a time (H1, then H2, then H3) and use only numbered or only generic heading tags.', refs: ref(['1.3.1', '2.4.6'], ['14-002', '14-003', '14-007']) }
      : warns.length ? { id: 'headings', cat: 'Structure', title: 'Heading structure', status: 'warn', summary: warns.slice(0, 3).join('. ') + '.', detail: outlineText ? 'Outline found:\n' + outlineText : '', fix: 'Start with H1 for the document title and add headings for each section.', refs: ref(['1.3.1', '2.4.6'], ['14-002']) }
      : { id: 'headings', cat: 'Structure', title: 'Heading structure', status: 'pass', summary: hs.length + ' heading' + (hs.length === 1 ? '' : 's') + ', correctly nested.', detail: 'Outline found:\n' + outlineText, refs: ref(['1.3.1', '2.4.6'], ['14-002', '14-003']) });

    var noAlt = F.figures.filter(function (f) { return !f.alt; });
    var figRef = ref(['1.1.1'], ['13-004']);
    add(!tagged ? Object.assign({ id: 'figures', cat: 'Structure', title: 'Images have alternative text', refs: figRef }, T())
      : !F.figures.length ? { id: 'figures', cat: 'Structure', title: 'Images have alternative text', status: 'pass', summary: 'No tagged figures were found.', detail: 'Images that are not tagged as figures are either decorative artifacts or untagged. A person must confirm that none carries information.', refs: figRef }
      : noAlt.length ? { id: 'figures', cat: 'Structure', title: 'Images have alternative text', status: 'fail', summary: noAlt.length + ' of ' + s_(F.figures.length, 'figure') + ' ' + (noAlt.length === 1 ? 'has' : 'have') + ' no alternative text (page' + (noAlt.length === 1 ? ' ' : 's ') + list(noAlt.map(function (f) { return f.page; })) + ').', detail: 'This checker reads the Alt entry. A figure that uses only ActualText would be reported here too, so confirm in Acrobat before you change it.', fix: 'Add alternative text that conveys the meaning (for a logo: the organisation name), or mark purely decorative images as artifacts.', refs: figRef }
      : { id: 'figures', cat: 'Structure', title: 'Images have alternative text', status: 'pass', summary: 'All ' + s_(F.figures.length, 'figure') + ' ' + (F.figures.length === 1 ? 'has' : 'have') + ' alternative text.', detail: F.figures.slice(0, 10).map(function (f) { return 'p.' + f.page + ': "' + f.alt.slice(0, 80) + '"'; }).join('\n') + '\nWhether the text is accurate and useful needs a human check.', refs: figRef });

    var noTh = F.tables.filter(function (t) { return t.td > 0 && t.th === 0; });
    var tabularPages = F.pages.filter(function (p) { return p.tabular >= 3; }).map(function (p) { return p.n; });
    var tblRef = ref(['1.3.1'], ['15-001', '15-002', '15-003']);
    add(!tagged ? Object.assign({ id: 'tables', cat: 'Structure', title: 'Tables have header cells', refs: tblRef }, T())
      : noTh.length ? { id: 'tables', cat: 'Structure', title: 'Tables have header cells', status: 'fail', summary: noTh.length + ' of ' + s_(F.tables.length, 'table') + ' ' + (noTh.length === 1 ? 'has' : 'have') + ' no header cells (page' + (noTh.length === 1 ? ' ' : 's ') + list(noTh.map(function (t) { return t.page; })) + ').', fix: 'Tag the first row (and header column, if any) as TH cells with the right scope. For generated statements, fix the table template.', refs: tblRef }
      : (!F.tables.length && tabularPages.length) ? { id: 'tables', cat: 'Structure', title: 'Tables have header cells', status: 'warn', summary: 'Text on page' + (tabularPages.length === 1 ? ' ' : 's ') + list(tabularPages) + ' is laid out like a table, but the document has no table tags.', detail: 'A screen reader will read the cells as running text with no row or column context. This is a heuristic: confirm by eye, then check the tag viewer.', fix: 'Tag the data as a Table with TR, TH and TD elements. For generated statements, fix the template once so every statement inherits it.', refs: tblRef }
      : !F.tables.length ? { id: 'tables', cat: 'Structure', title: 'Tables have header cells', status: 'pass', summary: 'No tagged tables, and no table-like text was detected.', detail: 'The detector looks for three or more aligned rows. Tabular data laid out another way can be missed, so check the page by eye.', refs: tblRef }
      : { id: 'tables', cat: 'Structure', title: 'Tables have header cells', status: 'pass', summary: s_(F.tables.length, 'table') + ' ' + (F.tables.length === 1 ? 'has' : 'have') + ' header cells.', detail: 'Whether the header cells point to the right data (scope, merged cells) needs a human check.', refs: tblRef });

    var badLists = F.lists.filter(function (l) { return l.bad.length; });
    var lstRef = ref(['1.3.1'], ['09-005']);
    add(!tagged ? Object.assign({ id: 'lists', cat: 'Structure', title: 'Lists are tagged correctly', refs: lstRef }, T())
      : !F.lists.length ? { id: 'lists', cat: 'Structure', title: 'Lists are tagged correctly', status: 'pass', summary: 'No tagged lists were found.', detail: 'Bulleted or numbered text that is not tagged as a list is not detected here.', refs: lstRef }
      : badLists.length ? { id: 'lists', cat: 'Structure', title: 'Lists are tagged correctly', status: 'warn', summary: s_(badLists.length, 'list') + ' contain' + (badLists.length === 1 ? 's' : '') + ' items that are not list items (page' + (badLists.length === 1 ? ' ' : 's ') + list(badLists.map(function (l) { return l.page; })) + ').', fix: 'A list (L) should contain only list items (LI), each with a label and a body.', refs: lstRef }
      : { id: 'lists', cat: 'Structure', title: 'Lists are tagged correctly', status: 'pass', summary: s_(F.lists.length, 'list') + ' ' + (F.lists.length === 1 ? 'is' : 'are') + ' tagged as list items.', refs: lstRef });

    // --- Links and navigation ---
    var untagged = F.links.filter(function (l) { return !l.tagged; });
    add(!F.links.length ? { id: 'linktags', cat: 'Links and navigation', title: 'Links are tagged', status: 'pass', summary: 'No link annotations were found.', refs: ref(['2.4.4', '1.3.1'], ['28-011']) }
      : !tagged ? Object.assign({ id: 'linktags', cat: 'Links and navigation', title: 'Links are tagged', refs: ref(['2.4.4', '1.3.1'], ['28-011']) }, T())
      : untagged.length ? { id: 'linktags', cat: 'Links and navigation', title: 'Links are tagged', status: 'fail', summary: untagged.length + ' of ' + s_(F.links.length, 'link') + ' ' + (untagged.length === 1 ? 'is' : 'are') + ' not inside a Link tag (page' + (untagged.length === 1 ? ' ' : 's ') + list(untagged.map(function (l) { return l.page; })) + ').', detail: 'Untagged links cannot be reached or announced properly by assistive technology.', fix: 'Tag each link annotation inside a Link element together with its visible text.', refs: ref(['2.4.4', '1.3.1'], ['28-011']) }
      : { id: 'linktags', cat: 'Links and navigation', title: 'Links are tagged', status: 'pass', summary: 'All ' + s_(F.links.length, 'link') + ' ' + (F.links.length === 1 ? 'is' : 'are') + ' tagged.', refs: ref(['2.4.4', '1.3.1'], ['28-011']) });

    var generic = [], rawUrl = [];
    F.links.forEach(function (l) {
      var t = (l.text || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      if (l.text && GENERIC_LINK.test(t)) generic.push('"' + l.text + '" (p.' + l.page + ')');
      else if (l.text && /^(https?:\/\/|www\.)/i.test(l.text)) rawUrl.push('"' + l.text.slice(0, 50) + '" (p.' + l.page + ')');
    });
    add(!F.links.length || !tagged ? { id: 'linktext', cat: 'Links and navigation', title: 'Link text makes sense', status: F.links.length ? 'na' : 'pass', summary: F.links.length ? needTags : 'No links found.', refs: ref(['2.4.4'], []) }
      : generic.length ? { id: 'linktext', cat: 'Links and navigation', title: 'Link text makes sense', status: 'fail', summary: generic.length + ' link' + (generic.length === 1 ? '' : 's') + ' use text that makes no sense out of context: ' + list(generic, 4) + '.', fix: 'Write link text that says where it goes ("Download the fee schedule (PDF)"), not "click here" or "read more".', refs: ref(['2.4.4'], []) }
      : rawUrl.length ? { id: 'linktext', cat: 'Links and navigation', title: 'Link text makes sense', status: 'warn', summary: rawUrl.length + ' link' + (rawUrl.length === 1 ? ' shows' : 's show') + ' a raw web address as text: ' + list(rawUrl, 3) + '.', detail: 'A screen reader reads the address character by character. Acceptable for short, speakable URLs.', fix: 'Replace long addresses with descriptive text.', refs: ref(['2.4.4'], []) }
      : { id: 'linktext', cat: 'Links and navigation', title: 'Link text makes sense', status: 'pass', summary: 'No generic or raw-URL link text was found.', detail: 'Whether each link text is genuinely descriptive still needs a human check.', refs: ref(['2.4.4'], []) });

    var noContents = F.links.filter(function (l) { return !l.contents; });
    if (F.links.length) add(noContents.length ? { id: 'linkcontents', cat: 'Links and navigation', title: 'Links have a description (PDF/UA)', status: 'warn', summary: noContents.length + ' of ' + s_(F.links.length, 'link') + ' ' + (noContents.length === 1 ? 'has' : 'have') + ' no description in the annotation Contents entry.', detail: 'WCAG is met when the visible link text is tagged. PDF/UA-1 additionally expects a Contents description (Matterhorn 28-012).', fix: 'Set the link description in the Tags or Links panel of your remediation tool, or have the generator write the /Contents entry.', refs: ref(['2.4.4'], ['28-012']) }
      : { id: 'linkcontents', cat: 'Links and navigation', title: 'Links have a description (PDF/UA)', status: 'pass', summary: 'All links have a Contents description.', refs: ref(['2.4.4'], ['28-012']) });

    var annotPages = F.pages.filter(function (p) { return p.links || p.widgets; });
    if (annotPages.length) add(!F.tabs.checked ? { id: 'tabs', cat: 'Links and navigation', title: 'Tab order follows the structure', status: 'warn', summary: 'The tab-order setting could not be read automatically.', detail: 'The check needs the page /Tabs key, which could not be read (some encrypted or compressed files hide it).', fix: 'In Acrobat, open the page thumbnails, choose Page Properties and set Tab Order to "Use Document Structure" for every page with links or fields.', refs: ref(['2.4.3'], ['28-008', '28-009']) }
      : (F.tabs.missing.length || F.tabs.notS.length) ? { id: 'tabs', cat: 'Links and navigation', title: 'Tab order follows the structure', status: 'fail', summary: 'Tab order is not set to follow the structure on pages ' + list(F.tabs.missing.concat(F.tabs.notS)) + '.', fix: 'Set Tab Order to "Use Document Structure" on every page that has links or form fields.', refs: ref(['2.4.3'], ['28-008', '28-009']) }
      : { id: 'tabs', cat: 'Links and navigation', title: 'Tab order follows the structure', status: 'pass', summary: 'Every page with links or fields uses structure order for tabbing.', refs: ref(['2.4.3'], ['28-008', '28-009']) });

    add(F.pageCount >= 21 && !F.outlineCount ? { id: 'bookmarks', cat: 'Links and navigation', title: 'Bookmarks for long documents', status: 'warn', summary: 'A ' + F.pageCount + '-page document has no bookmarks.', detail: 'Bookmarks are the main way keyboard and screen-reader users move around a long PDF. They are good practice rather than a strict pass or fail rule.', fix: 'Create bookmarks from the headings when you export.', refs: ref(['2.4.5'], []) }
      : { id: 'bookmarks', cat: 'Links and navigation', title: 'Bookmarks for long documents', status: 'pass', summary: F.outlineCount ? F.outlineCount + ' top-level bookmark' + (F.outlineCount === 1 ? '' : 's') + '.' : 'Not needed for a document of ' + F.pageCount + ' page' + (F.pageCount === 1 ? '' : 's') + '.', refs: ref(['2.4.5'], []) });

    // --- Forms ---
    var fields = F.widgets.filter(function (w) { return !w.hidden; });
    var noTip = fields.filter(function (w) { return !w.alt; });
    add(!fields.length ? { id: 'forms', cat: 'Forms', title: 'Form fields have labels', status: 'pass', summary: 'No interactive form fields were found.', refs: ref(['4.1.2', '3.3.2'], ['28-005']) }
      : noTip.length ? { id: 'forms', cat: 'Forms', title: 'Form fields have labels', status: 'fail', summary: noTip.length + ' of ' + fields.length + ' form fields have no tooltip or description (' + list(noTip.map(function (w) { return w.name || 'unnamed'; }), 5) + ').', fix: 'Give every field a tooltip (TU) that states its purpose, such as "Date of birth (DD/MM/YYYY)", and tag it in a Form element.', refs: ref(['4.1.2', '3.3.2'], ['28-005']) }
      : { id: 'forms', cat: 'Forms', title: 'Form fields have labels', status: 'pass', summary: 'All ' + fields.length + ' form fields have a description.', detail: 'Keyboard operability, required-field cues and error messages need a human check.', refs: ref(['4.1.2', '3.3.2'], ['28-005']) });

    if (F.info.xfa) add({ id: 'xfa', cat: 'Forms', title: 'No dynamic XFA form', status: 'warn', summary: 'The file contains XFA form data.', detail: 'Dynamic XFA forms are not accessible and are not supported by most viewers.', fix: 'Rebuild the form as an AcroForm or move it to an accessible web form.', refs: ref(['4.1.2'], ['25-001']) });
    if (F.jsDoc) add({ id: 'js', cat: 'Forms', title: 'Embedded JavaScript', status: 'warn', summary: 'The document contains JavaScript actions.', detail: 'Scripts can trap focus, change content or require timing. They need a manual keyboard test.', refs: ref(['2.1.1', '2.2.1'], ['29-001']) });

    // --- Informational ---
    add({ id: 'pdfua', cat: 'Information', title: 'PDF/UA identifier', status: 'info', summary: F.xmp.pdfuaPart ? 'The file declares PDF/UA part ' + F.xmp.pdfuaPart + '.' : 'The file does not declare PDF/UA conformance.', detail: 'A declaration is a claim, not proof. WCAG conformance does not require it, but many procurement and audit checklists do. Use a full validator such as veraPDF or PAC to verify PDF/UA.', refs: ref([], []) });
    if (F.info.signed) add({ id: 'signed', cat: 'Information', title: 'Digital signature', status: 'info', summary: 'The document contains a digital signature.', detail: 'Changing a signed file to fix accessibility invalidates the signature. Remediate first, then sign.', refs: ref([], []) });
    return C;
  }

  var MANUAL = [
    { id: 'm-order', text: 'The reading order is logical. Use the tag viewer and listen with a screen reader: headings, columns, tables, headers and footers read in the right sequence.', ref: 'WCAG 1.3.2' },
    { id: 'm-alt', text: 'Alternative text is accurate and useful for every informative image, chart and logo, and decorative images are marked as artifacts.', ref: 'WCAG 1.1.1' },
    { id: 'm-contrast', text: 'Text and meaningful graphics meet colour-contrast ratios (4.5:1 for normal text, 3:1 for large text and graphics), and colour is not the only way to convey meaning.', ref: 'WCAG 1.4.3, 1.4.11, 1.4.1' },
    { id: 'm-links', text: 'Every link text is descriptive on its own, and links that open files state the format and size.', ref: 'WCAG 2.4.4' },
    { id: 'm-tables', text: 'Table header cells point to the right data (scope, merged cells and multi-level headers are correct), and tables are used for data, not layout.', ref: 'WCAG 1.3.1' },
    { id: 'm-artifacts', text: 'Repeated headers, footers, page numbers, watermarks and decorative lines are marked as artifacts so they are not read on every page.', ref: 'PDF/UA-1 7.1' },
    { id: 'm-lang', text: 'Passages in another language are marked with their own language.', ref: 'WCAG 3.1.2' },
    { id: 'm-forms', text: 'Form fields can be completed with the keyboard alone, with clear labels, required-field cues and helpful error messages.', ref: 'WCAG 3.3.1, 3.3.2' },
    { id: 'm-reflow', text: 'Content reflows or zooms usably when viewed with assistive tools, and text is real text, not an image.', ref: 'WCAG 1.4.4, 1.4.10' },
    { id: 'm-sr', text: 'Tested with at least NVDA or JAWS on Windows plus VoiceOver or TalkBack, using the same viewer your customers use.', ref: 'Audit practice' },
    { id: 'm-users', text: 'Reviewed by people with disabilities who use assistive technology (required in a SEBI-style audit and good practice for any regulated entity).', ref: 'Audit practice' },
    { id: 'm-valid', text: 'Validated with an independent PDF/UA checker (for example veraPDF or PAC) and the result kept as evidence.', ref: 'PDF/UA-1 / Matterhorn' }
  ];

  function summarise(checks) {
    var s = { fail: 0, warn: 0, pass: 0, na: 0, info: 0 };
    checks.forEach(function (c) { s[c.status] = (s[c.status] || 0) + 1; });
    return s;
  }

  async function analyse(doc, opts) {
    var facts = await collect(doc, opts);
    var checks = buildChecks(facts);
    return { facts: facts, checks: checks, summary: summarise(checks), manual: MANUAL };
  }

  var api = { collect: collect, buildChecks: buildChecks, analyse: analyse, summarise: summarise, MANUAL: MANUAL, TOOL_VERSION: TOOL_VERSION, MAX_PAGES: MAX_PAGES };
  root.KJPdfA11y = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

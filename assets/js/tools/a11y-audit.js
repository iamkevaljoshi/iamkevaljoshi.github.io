/* Accessibility checker: runs axe-core against a fetched page, plus expert review aids and a
   manual WCAG 2.2 checklist. The page is rendered in a sandboxed iframe with an opaque origin
   (allow-scripts only), with its own scripts stripped, so it can never touch this site. */
(function () {
  'use strict';
  var K = window.KJTools;
  var form = document.getElementById('axForm');
  if (!K || !form) return;
  var h = K.h, add = K.add, norm = K.norm;

  var AXE = { src: 'https://cdn.jsdelivr.net/npm/axe-core@4.14.0/axe.min.js', integrity: 'sha384-lFUXB8tI4BaTE1bqxH9eeAXON2NH1qsdAhs7S5L++nUNP5QOy+hwr0C3TYEJUEl0' };
  var VIEWPORTS = { desktop: { w: 1280, h: 800, label: 'Desktop 1280px' }, mobile: { w: 390, h: 844, label: 'Mobile 390px' } };
  var STANDARDS = {
    wcag22aa: { label: 'WCAG 2.2 AA', tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    wcag21aa: { label: 'WCAG 2.1 AA', tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    wcag22aaa: { label: 'WCAG 2.2 AAA', tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'wcag2aaa'] }
  };
  var IMPACT = ['critical', 'serious', 'moderate', 'minor'];
  var WEIGHT = { critical: 10, serious: 7, moderate: 3, minor: 1 };
  var PRINCIPLE = { 1: 'Perceivable', 2: 'Operable', 3: 'Understandable', 4: 'Robust' };
  var SC = {
    '1.1.1': 'Non-text Content', '1.2.1': 'Audio-only and Video-only', '1.2.2': 'Captions (Prerecorded)', '1.3.1': 'Info and Relationships',
    '1.3.4': 'Orientation', '1.3.5': 'Identify Input Purpose', '1.4.1': 'Use of Color', '1.4.2': 'Audio Control', '1.4.3': 'Contrast (Minimum)',
    '1.4.4': 'Resize Text', '1.4.6': 'Contrast (Enhanced)', '1.4.12': 'Text Spacing', '2.1.1': 'Keyboard', '2.1.3': 'Keyboard (No Exception)',
    '2.2.1': 'Timing Adjustable', '2.2.2': 'Pause, Stop, Hide', '2.2.4': 'Interruptions', '2.4.1': 'Bypass Blocks', '2.4.2': 'Page Titled',
    '2.4.4': 'Link Purpose (In Context)', '2.4.9': 'Link Purpose (Link Only)', '2.5.3': 'Label in Name', '2.5.8': 'Target Size (Minimum)',
    '3.1.1': 'Language of Page', '3.1.2': 'Language of Parts', '3.2.5': 'Change on Request', '3.3.2': 'Labels or Instructions',
    '4.1.1': 'Parsing (obsolete)', '4.1.2': 'Name, Role, Value'
  };
  var MANUAL = [
    ['Keyboard', '2.1.1 / 2.1.2', 'Tab through the whole page. Every link, button, menu, carousel and form control is reachable and works with Enter, Space and arrow keys, and focus never gets trapped.'],
    ['Keyboard', '2.4.7 / 2.4.11', 'Focus is always clearly visible, and never hidden behind sticky headers, cookie banners or chat widgets (Focus Not Obscured, new in 2.2).'],
    ['Keyboard', '2.4.3 / 2.4.1', 'Focus order follows the visual order, and a "Skip to content" link appears on first Tab and works.'],
    ['Screen reader', '1.3.1 / 4.1.2 / 4.1.3', 'With NVDA, JAWS or VoiceOver: headings and landmarks make sense, controls announce name, role and state (expanded, selected), and status messages (cart updated, form errors) are announced.'],
    ['Visual', '1.4.4 / 1.4.10', 'At 200% zoom, and at 320 CSS pixels wide (400% zoom), nothing is cut off and there is no horizontal scrolling (Reflow).'],
    ['Visual', '1.4.12 / 1.4.13', 'Increased text spacing does not break the layout, and content shown on hover or focus can be dismissed with Esc and hovered over.'],
    ['Visual', '1.4.1 / 1.4.11', 'Colour is never the only way information is shown (errors, required fields, links in text), and UI components and focus indicators have 3:1 contrast.'],
    ['Media and motion', '1.2.2 / 1.2.5 / 1.4.2', 'Videos have accurate captions and audio description or a transcript; nothing plays sound automatically for more than 3 seconds.'],
    ['Media and motion', '2.2.2 / 2.3.1', 'Carousels and animations can be paused; nothing flashes more than 3 times a second; prefers-reduced-motion is respected.'],
    ['Forms', '3.3.1 / 3.3.3', 'Errors are identified in text, next to the field, with a suggestion for fixing them, and are announced to screen readers.'],
    ['Forms', '3.3.7 / 3.3.8', 'Users are not asked to re-enter information they already gave (Redundant Entry), and login does not rely on memory or puzzles; paste and password managers work (Accessible Authentication). Both are new in 2.2.'],
    ['Pointer', '2.5.7 / 2.5.8', 'Anything done by dragging (sliders, sortable lists, maps) also works with single clicks, and targets are at least 24×24 px or well spaced. Both are new in 2.2.'],
    ['Consistency', '3.2.3 / 3.2.6', 'Navigation and help mechanisms (contact, chat) appear in the same place on every page. Consistent Help is new in 2.2.'],
    ['Timing', '2.2.1', 'Session time-outs warn users and let them extend the time.']
  ];

  /* ---------- sanitising the fetched page ---------- */
  function buildSrcdoc(html, base, nonce, tags) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, base, meta[http-equiv], object, embed, portal, link[rel~="modulepreload" i], link[as="script" i]').forEach(function (el) { el.remove(); });
    doc.querySelectorAll('iframe, frame').forEach(function (f) { f.removeAttribute('srcdoc'); f.setAttribute('src', 'about:blank'); });
    doc.querySelectorAll('*').forEach(function (el) {
      Array.from(el.attributes).forEach(function (a) {
        if (/^on/i.test(a.name)) el.removeAttribute(a.name);
        else if (/^(href|src|action|formaction|xlink:href)$/i.test(a.name) && /^\s*javascript:/i.test(a.value)) el.setAttribute(a.name, '#');
      });
    });
    var head = doc.head || doc.documentElement.insertBefore(doc.createElement('head'), doc.body);
    var b = doc.createElement('base');
    b.setAttribute('href', base);
    head.insertBefore(b, head.firstChild);
    var axe = doc.createElement('script');
    axe.setAttribute('src', AXE.src);
    axe.setAttribute('integrity', AXE.integrity);
    axe.setAttribute('crossorigin', 'anonymous');
    head.appendChild(axe);
    var run = doc.createElement('script');
    run.textContent = '(' + frameRunner.toString() + ')(' + JSON.stringify(nonce) + ',' + JSON.stringify(tags) + ');';
    (doc.body || doc.documentElement).appendChild(run);
    return '<!doctype html>' + doc.documentElement.outerHTML;
  }

  /* Runs inside the sandboxed frame. It only talks to the parent through postMessage. */
  function frameRunner(nonce, tags) {
    var parentWin = window.parent, sent = false, box = null;
    function send(m) { m.nonce = nonce; parentWin.postMessage(m, '*'); }
    function height() { var d = document.documentElement, b = document.body; return Math.max(d.scrollHeight, b ? b.scrollHeight : 0, d.offsetHeight); }
    function ready() { if (sent) return; sent = true; send({ type: 'ready', height: height(), axe: !!window.axe }); }
    if (document.readyState === 'complete') setTimeout(ready, 400);
    else window.addEventListener('load', function () { setTimeout(ready, 400); });
    setTimeout(ready, 10000);
    var text = function (el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); };
    function visible(el) { var r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; }
    function nameOf(el) {
      var lb = el.getAttribute('aria-labelledby');
      if (lb) return lb.split(/\s+/).map(function (id) { var x = document.getElementById(id); return x ? text(x) : ''; }).join(' ').trim();
      return (el.getAttribute('aria-label') || '').trim();
    }
    function structure() {
      var headings = Array.prototype.map.call(document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]'), function (el) {
        var lvl = /^H\d$/.test(el.tagName) ? +el.tagName[1] : +(el.getAttribute('aria-level') || 2);
        return { level: lvl, text: (nameOf(el) || text(el)).slice(0, 160), hidden: !visible(el) };
      });
      var roles = { HEADER: 'banner', NAV: 'navigation', MAIN: 'main', ASIDE: 'complementary', FOOTER: 'contentinfo', SECTION: 'region', FORM: 'form', SEARCH: 'search' };
      var landmarks = [];
      document.querySelectorAll('header,nav,main,aside,footer,section,form,search,[role]').forEach(function (el) {
        var role = el.getAttribute('role') || roles[el.tagName];
        if (!role || !/^(banner|navigation|main|complementary|contentinfo|region|form|search)$/.test(role)) return;
        var label = nameOf(el);
        if ((role === 'region' || role === 'form') && !label && !el.getAttribute('role')) return;
        if ((el.tagName === 'HEADER' || el.tagName === 'FOOTER') && !el.getAttribute('role') && el.parentElement && el.parentElement.closest('article,aside,main,nav,section')) return;
        landmarks.push({ role: role, label: label });
      });
      var images = Array.prototype.map.call(document.querySelectorAll('img, [role="img"], input[type="image"]'), function (el) {
        var alt = el.hasAttribute('alt') ? el.getAttribute('alt') : null;
        var src = el.getAttribute('src') || '';
        return { src: src.length > 100 ? '…' + src.slice(-100) : src, alt: alt, label: nameOf(el), hidden: el.getAttribute('aria-hidden') === 'true' || /^(presentation|none)$/.test(el.getAttribute('role') || '') };
      });
      var links = Array.prototype.map.call(document.querySelectorAll('a[href]'), function (a) {
        var imgAlt = Array.prototype.map.call(a.querySelectorAll('img[alt]'), function (i) { return i.getAttribute('alt'); }).join(' ');
        return { name: (nameOf(a) || text(a) || imgAlt || a.getAttribute('title') || '').slice(0, 120), href: a.getAttribute('href'), blank: a.getAttribute('target') === '_blank' };
      });
      var first = document.querySelector('a[href^="#"]');
      return { headings: headings, landmarks: landmarks, images: images, links: links, title: document.title, lang: document.documentElement.getAttribute('lang') || '',
        skipLink: !!(first && /skip|jump|main content|content/i.test(text(first) + ' ' + (first.getAttribute('aria-label') || ''))) };
    }
    function slim(list, nodes) {
      return list.map(function (r) {
        return { id: r.id, impact: r.impact, tags: r.tags, help: r.help, description: r.description, helpUrl: r.helpUrl, count: r.nodes.length,
          nodes: nodes ? r.nodes.slice(0, 60).map(function (n) { return { target: n.target, html: (n.html || '').slice(0, 500), impact: n.impact, summary: (n.failureSummary || '').slice(0, 900) }; }) : [] };
      });
    }
    function run() {
      if (!window.axe) { send({ type: 'error', message: 'axe-core could not load (blocked network or CDN).' }); return; }
      window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations', 'incomplete', 'passes'], iframes: false, elementRef: false, ancestry: false, xpath: false })
        .then(function (r) {
          send({ type: 'results', results: { violations: slim(r.violations, true), incomplete: slim(r.incomplete, true), passes: slim(r.passes, false), inapplicable: r.inapplicable.length, engine: r.testEngine.version }, structure: structure() });
        })
        .catch(function (e) { send({ type: 'error', message: String((e && e.message) || e) }); });
    }
    function highlight(sel) {
      var el = null;
      try { el = document.querySelector(sel); } catch (e) { el = null; }
      if (!el) { send({ type: 'highlighted', found: false }); return; }
      if (!box) {
        box = document.createElement('div');
        box.style.cssText = 'position:absolute;z-index:2147483647;pointer-events:none;outline:4px solid #e11d48;outline-offset:3px;border-radius:4px;box-shadow:0 0 0 9999px rgba(15,23,42,.35);transition:all .2s';
        document.body.appendChild(box);
      }
      var r = el.getBoundingClientRect();
      box.style.left = (r.left + window.scrollX) + 'px'; box.style.top = (r.top + window.scrollY) + 'px';
      box.style.width = Math.max(r.width, 4) + 'px'; box.style.height = Math.max(r.height, 4) + 'px';
      send({ type: 'highlighted', found: true, top: r.top + window.scrollY, visible: r.width > 0 && r.height > 0 });
    }
    window.addEventListener('message', function (e) {
      if (e.source !== parentWin || !e.data || e.data.nonce !== nonce) return;
      if (e.data.type === 'run') run();
      else if (e.data.type === 'highlight') highlight(e.data.target);
    });
  }

  /* ---------- running the frame ---------- */
  var frame = null, frameNonce = '', scale = 1, onHighlight = null;
  var stage = document.getElementById('axStage'), scaler = document.getElementById('axScaler'), viewport = document.getElementById('axViewport');
  function fitPreview(vp, height) {
    scale = Math.min(1, (viewport.clientWidth - 2) / vp.w);
    frame.style.width = vp.w + 'px';
    frame.style.height = height + 'px';
    frame.style.transform = 'scale(' + scale + ')';
    scaler.style.width = Math.round(vp.w * scale) + 'px';
    scaler.style.height = Math.round(height * scale) + 'px';
  }
  function analyse(html, base, vp, tags) {
    return new Promise(function (resolve, reject) {
      frameNonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
      if (frame) frame.remove();
      frame = h('iframe', { title: 'Page being tested (scripts removed)', sandbox: 'allow-scripts', referrerpolicy: 'no-referrer', class: 'ax-frame' });
      scaler.textContent = '';
      scaler.appendChild(frame);
      stage.hidden = false;
      fitPreview(vp, vp.h);
      var timer = setTimeout(function () { cleanup(); reject(new Error('The page took too long to render in the test frame.')); }, 90000);
      function cleanup() { clearTimeout(timer); window.removeEventListener('message', onMsg); }
      function onMsg(e) {
        if (!frame || e.source !== frame.contentWindow || !e.data || e.data.nonce !== frameNonce) return;
        var d = e.data;
        if (d.type === 'ready') {
          if (!d.axe) { cleanup(); reject(new Error('axe-core could not load in the test frame.')); return; }
          fitPreview(vp, Math.max(vp.h, Math.min(d.height || vp.h, 16000)));
          setTimeout(function () { frame.contentWindow.postMessage({ type: 'run', nonce: frameNonce }, '*'); }, 500);
        } else if (d.type === 'results') { cleanup(); window.addEventListener('message', listenHighlight); resolve(d); }
        else if (d.type === 'error') { cleanup(); reject(new Error(d.message)); }
      }
      window.addEventListener('message', onMsg);
      frame.srcdoc = buildSrcdoc(html, base, frameNonce, tags);
    });
  }
  function listenHighlight(e) {
    if (!frame || e.source !== frame.contentWindow || !e.data || e.data.nonce !== frameNonce || e.data.type !== 'highlighted') return;
    if (onHighlight) onHighlight(e.data);
  }
  function showOnPage(target, btn) {
    if (!frame) return;
    onHighlight = function (d) {
      if (!d.found || !d.visible) { btn.textContent = d.found ? 'Not visible on screen' : 'Not found'; return; }
      stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
      viewport.scrollTo({ top: Math.max(0, d.top * scale - 60), behavior: 'smooth' });
    };
    frame.contentWindow.postMessage({ type: 'highlight', target: target, nonce: frameNonce }, '*');
  }

  /* ---------- helpers ---------- */
  function scOf(tags) {
    var list = [];
    tags.forEach(function (t) { var m = t.match(/^wcag(\d)(\d)(\d+)$/); if (m) list.push(m[1] + '.' + m[2] + '.' + m[3]); });
    return list;
  }
  function levelOf(tags) {
    if (tags.indexOf('best-practice') !== -1 && !scOf(tags).length) return 'Best practice';
    if (tags.some(function (t) { return /^wcag2aaa$/.test(t); })) return 'AAA';
    if (tags.some(function (t) { return /^wcag2(1|2)?aa$/.test(t); })) return 'AA';
    if (tags.some(function (t) { return /^wcag2(1|2)?a$/.test(t); })) return 'A';
    return 'Best practice';
  }
  function versionOf(tags) {
    if (tags.indexOf('wcag22aa') !== -1) return 'WCAG 2.2';
    if (tags.indexOf('wcag21a') !== -1 || tags.indexOf('wcag21aa') !== -1) return 'WCAG 2.1';
    return scOf(tags).length ? 'WCAG 2.0' : '';
  }
  var plural = function (n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); };
  var selector = function (t) { return [].concat(t).map(function (x) { return [].concat(x).join(' >>> '); }).join(' → '); };

  /* ---------- expert review aids (not scored) ---------- */
  var BAD_ALT = /^(image|img|photo|picture|pic|graphic|logo|icon|banner|spacer|untitled|placeholder|default|thumbnail|null|undefined|\s*)$/i;
  var FILE_ALT = /(\.(jpe?g|png|gif|webp|avif|svg|tiff?)$)|^(img|dsc|image|screenshot|photo)[-_ ]?\d+/i;
  var GENERIC = /^(click here|here|read more|more|learn more|this|link|continue|details|go|view more|find out more|more info|see more|explore|know more)$/i;
  function review(s) {
    var out = [];
    var altIssues = [];
    s.images.forEach(function (i) {
      if (i.hidden || i.alt === '' || i.alt == null) return;
      var a = norm(i.alt);
      if (BAD_ALT.test(a)) altIssues.push('"' + a + '" is not descriptive · ' + i.src);
      else if (FILE_ALT.test(a)) altIssues.push('"' + a + '" looks like a file name · ' + i.src);
      else if (/^(image|picture|photo|graphic) of\b/i.test(a)) altIssues.push('"' + a + '" starts with "image of" (screen readers already say "image") · ' + i.src);
      else if (a.length > 150) altIssues.push('Alt text is ' + a.length + ' characters; consider a caption or long description · ' + i.src);
    });
    var decorative = s.images.filter(function (i) { return i.alt === '' && !i.hidden; }).length;
    out.push({ title: 'Alt text quality', status: altIssues.length ? 'warn' : 'pass', sc: '1.1.1',
      detail: altIssues.length ? plural(altIssues.length, 'image') + ' with alt text that is probably not useful. axe only checks that alt text exists.' : 'No obviously unhelpful alt text. ' + decorative + ' image(s) are marked decorative (alt=""); confirm they really carry no information.', list: altIssues });
    var generic = [], byName = {};
    s.links.forEach(function (l) {
      if (!l.name) return;
      var n = l.name.toLowerCase();
      if (GENERIC.test(n)) generic.push('"' + l.name + '" → ' + l.href);
      (byName[n] = byName[n] || new Set()).add((l.href || '').replace(/[#?].*$/, ''));
    });
    var ambiguous = Object.keys(byName).filter(function (n) { return byName[n].size > 1 && n.length < 40; }).map(function (n) { return '"' + n + '" goes to ' + byName[n].size + ' different pages'; });
    out.push({ title: 'Link purpose', status: generic.length || ambiguous.length ? 'warn' : 'pass', sc: '2.4.4',
      detail: generic.length || ambiguous.length ? 'Screen reader users often browse a list of links out of context. Generic or repeated text with different destinations is ambiguous.' : 'Link text looks specific.', list: generic.concat(ambiguous) });
    var blank = s.links.filter(function (l) { return l.blank && !/new (tab|window)|opens/i.test(l.name); }).length;
    if (blank) out.push({ title: plural(blank, 'link') + ' open a new tab without saying so', status: 'info', sc: '3.2.5', detail: 'Warn users, for example "(opens in a new tab)" in the link text or an icon with a text alternative.' });
    var h1 = s.headings.filter(function (x) { return x.level === 1 && !x.hidden; }).length;
    out.push({ title: 'Headings', status: h1 === 1 ? 'pass' : 'warn', sc: '1.3.1 / 2.4.6',
      detail: h1 === 1 ? s.headings.length + ' headings, one H1. Check that they describe their sections (outline below).' : (h1 ? h1 + ' visible H1 headings.' : 'No visible H1.') + ' One H1 naming the page helps screen reader users orient themselves.' });
    out.push({ title: 'Skip link', status: s.skipLink ? 'pass' : 'warn', sc: '2.4.1', detail: s.skipLink ? 'A skip link was found as the first in-page link. Check it is the first focusable element and becomes visible on focus.' : 'No "Skip to content" link found as the first in-page link. Landmarks partly cover this, but keyboard users benefit from a skip link.' });
    var mains = s.landmarks.filter(function (l) { return l.role === 'main'; }).length;
    var navs = s.landmarks.filter(function (l) { return l.role === 'navigation'; });
    var unlabelledNav = navs.length > 1 && navs.some(function (n) { return !n.label; });
    out.push({ title: 'Landmarks', status: mains === 1 && !unlabelledNav ? 'pass' : 'warn', sc: '1.3.1 / 2.4.1',
      detail: (mains === 1 ? 'One main landmark. ' : mains + ' main landmarks (there should be exactly one). ') + (unlabelledNav ? 'Several navigation landmarks without labels; add aria-label ("Main", "Footer") to tell them apart.' : 'Landmarks are listed below.') });
    return out;
  }

  /* ---------- rendering ---------- */
  var BADGE = { critical: 'Critical', serious: 'Serious', moderate: 'Moderate', minor: 'Minor' };
  function ruleCard(r, kind) {
    var sc = scOf(r.tags), level = levelOf(r.tags);
    var d = h('details', { class: 'pc-card ax-rule ax-' + (r.impact || 'minor') },
      h('summary', null, h('div', { class: 'ax-rule-head' },
        h('span', { class: 'ax-impact', text: kind === 'review' ? 'Review' : BADGE[r.impact] || 'Minor' }),
        h('span', { class: 'ax-rule-title', text: r.help }),
        h('span', { class: 'ax-count', text: plural(r.count, 'element') }))));
    d.appendChild(h('p', { class: 'ax-meta' },
      sc.map(function (x) { return h('span', { class: 'ax-sc', title: SC[x] || '' , text: x + (SC[x] ? ' ' + SC[x] : '') }); }),
      h('span', { class: 'ax-sc ax-level', text: level === 'Best practice' ? 'Best practice' : 'Level ' + level + (versionOf(r.tags) ? ' · ' + versionOf(r.tags) : '') }),
      r.tags.indexOf('EN-301-549') !== -1 ? h('span', { class: 'ax-sc', text: 'EN 301 549' }) : null));
    d.appendChild(h('p', { class: 'muted', text: r.description + '.' }));
    d.appendChild(h('p', null, h('a', { href: r.helpUrl, target: '_blank', rel: 'noopener', class: 'ax-learn', text: 'How to fix: ' + r.id + ' (Deque University) ↗' })));
    var list = h('ol', { class: 'ax-nodes' });
    r.nodes.forEach(function (n) {
      var sel = selector(n.target);
      var btn = h('button', { type: 'button', class: 'pc-link ax-show', text: 'Show on page' });
      btn.addEventListener('click', function () { showOnPage(n.target[n.target.length - 1], btn); });
      list.appendChild(h('li', null,
        h('div', { class: 'ax-node-head' }, h('code', { class: 'ax-sel', text: sel }), [].concat(n.target).length === 1 && typeof n.target[0] === 'string' ? btn : null),
        h('pre', { class: 'ax-html' }, h('code', { text: n.html })),
        n.summary ? h('p', { class: 'ax-summary', text: n.summary }) : null));
    });
    d.appendChild(list);
    if (r.count > r.nodes.length) d.appendChild(h('p', { class: 'muted au-small', text: 'Showing ' + r.nodes.length + ' of ' + r.count + ' elements.' }));
    return d;
  }

  function render(res, meta) {
    var R = res.results, S = res.structure;
    var fidelity = meta.mode === 'served'
      ? h('div', { class: 'pc-card ax-fidelity' }, h('h3', { text: 'Tested without JavaScript' }),
          h('p', null, 'Without a Jina API key the page is fetched as the server sends it, before JavaScript runs. Sites that build content or load styles with JavaScript (Edge Delivery Services, React, Angular, many CMS front ends) will show missing or extra issues, especially colour contrast, landmarks and target sizes. For accurate results, add a free Jina API key under Settings, or paste the rendered HTML from DevTools.'))
      : null;
    var sortRules = function (a, b) { return IMPACT.indexOf(a.impact) - IMPACT.indexOf(b.impact) || b.count - a.count; };
    R.violations.sort(sortRules);
    R.incomplete.sort(sortRules);
    var elements = R.violations.reduce(function (s, r) { return s + r.count; }, 0);
    var counts = {};
    IMPACT.forEach(function (i) { counts[i] = R.violations.filter(function (r) { return r.impact === i; }).reduce(function (s, r) { return s + r.count; }, 0); });
    var lost = R.violations.reduce(function (s, r) { return s + (WEIGHT[r.impact] || 1); }, 0);
    var score = (R.passes.length * 3 + lost) ? (R.passes.length * 3) / (R.passes.length * 3 + lost) : null;
    var wcagFails = R.violations.filter(function (r) { return levelOf(r.tags) !== 'Best practice'; });
    var reviewItems = review(S);

    var top = document.getElementById('axReport'), issues = document.getElementById('axIssues');
    top.textContent = ''; issues.textContent = '';
    top.hidden = false; issues.hidden = false;
    if (fidelity) add(top, fidelity);
    add(top, h('div', { class: 'pc-head' },
      h('div', null, h('p', { class: 'eyebrow', text: 'Accessibility check' }), h('h2', { text: 'Results' }),
        h('p', { class: 'muted pc-urls-line' }, h('span', { text: 'Page: ' }), h('a', { href: meta.url, target: '_blank', rel: 'noopener noreferrer', text: meta.url }), h('br'),
          h('span', { text: meta.standard.label + (meta.bestPractice ? ' + best practices' : '') + ' · ' + meta.vp.label + ' · axe-core ' + R.engine + ' · ' + new Date().toLocaleString() }))),
      h('div', { class: 'pc-actions' },
        h('button', { type: 'button', class: 'btn ghost pc-sm', text: 'Download CSV', onclick: function () { save(csv(R), 'accessibility-issues.csv'); } }),
        h('button', { type: 'button', class: 'btn ghost pc-sm', text: 'Download JSON', onclick: function () {
          save(new Blob([JSON.stringify({ url: meta.url, checkedAt: new Date().toISOString(), standard: meta.standard.label, viewport: meta.vp.label, axe: R.engine, score: score, violations: R.violations, needsReview: R.incomplete, passed: R.passes.map(function (p) { return p.id; }), expertReview: reviewItems, structure: S }, null, 2)], { type: 'application/json' }), 'accessibility-report.json');
        } }),
        h('button', { type: 'button', class: 'btn ghost pc-sm', text: 'Print or save PDF', onclick: function () { document.querySelectorAll('#axIssues details').forEach(function (d) { d.open = true; }); window.print(); } }))));

    var verdict = wcagFails.length
      ? h('p', { class: 'ax-verdict ax-v-fail' }, h('strong', { text: 'Does not meet ' + meta.standard.label + '. ' }), plural(wcagFails.length, 'success-criterion failure') + ' found by automated checks.')
      : h('p', { class: 'ax-verdict ax-v-pass' }, h('strong', { text: 'No automated ' + meta.standard.label + ' failures. ' }), 'Automated tools find roughly half of real issues; complete the manual checks below before claiming conformance.');
    add(top, h('div', { class: 'au-top' },
      K.ring('Accessibility score', score, plural(elements, 'element') + ' with issues · ' + plural(R.passes.length, 'rule') + ' passed', true),
      h('div', { class: 'pc-card au-bars-card' }, h('h3', { text: 'Summary' }), verdict,
        h('div', { class: 'ax-impacts' }, IMPACT.map(function (i) {
          return h('a', { href: '#axViolations', class: 'ax-impact-tile ax-' + i }, h('strong', { text: counts[i] }), h('span', { text: BADGE[i] }));
        })),
        h('p', { class: 'muted au-small', text: plural(R.violations.length, 'rule') + ' failed · ' + plural(R.incomplete.length, 'rule') + ' need manual review · ' + R.inapplicable + ' not applicable' }))));

    var byP = { 1: 0, 2: 0, 3: 0, 4: 0, bp: 0 };
    R.violations.forEach(function (r) { var sc = scOf(r.tags); if (sc.length) byP[sc[0][0]] += r.count; else byP.bp += r.count; });
    var maxP = Math.max(1, byP[1], byP[2], byP[3], byP[4], byP.bp);
    add(top, h('div', { class: 'pc-card' }, h('h3', { text: 'Issues by WCAG principle' }),
      h('div', { class: 'au-bars' }, [1, 2, 3, 4, 'bp'].map(function (k) {
        return h('div', { class: 'au-bar ax-pbar' }, h('span', { class: 'au-bar-l', text: k === 'bp' ? 'Best practices' : k + '. ' + PRINCIPLE[k] }),
          h('span', { class: 'pc-bar' }, h('span', { style: 'width:' + Math.round(byP[k] / maxP * 100) + '%' })), h('strong', { text: byP[k] }));
      }))));

    add(issues, h('h3', { class: 'ax-h', id: 'axViolations', text: R.violations.length ? 'Issues to fix (' + R.violations.length + ')' : 'No automated failures' }));
    if (R.violations.length) {
      var filter = h('div', { class: 'pc-modes ax-filter', role: 'group', 'aria-label': 'Filter by impact' }, ['all'].concat(IMPACT).map(function (i, idx) {
        return h('button', { type: 'button', class: 'chip', 'aria-pressed': idx === 0 ? 'true' : 'false', text: i === 'all' ? 'All' : BADGE[i], onclick: function (e) {
          filter.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b === e.currentTarget)); });
          issues.querySelectorAll('.ax-violation').forEach(function (c) { c.hidden = i !== 'all' && !c.classList.contains('ax-' + i); });
        } });
      }));
      add(issues, filter);
      R.violations.forEach(function (r, i) { var c = ruleCard(r, 'fail'); c.classList.add('ax-violation'); c.open = i < 3; add(issues, c); });
    }
    if (R.incomplete.length) {
      add(issues, h('h3', { class: 'ax-h', text: 'Needs manual review (' + R.incomplete.length + ')' }),
        h('p', { class: 'muted', text: 'axe could not decide these automatically, often contrast over images or gradients, or elements it could not see. Check each one by eye.' }));
      R.incomplete.forEach(function (r) { add(issues, ruleCard(r, 'review')); });
    }
    var rv = h('div', { class: 'pc-card' }, h('h3', { text: 'Expert review' }), h('p', { class: 'muted pc-intro', text: 'Checks that automated rules miss, flagged for a human decision. Not included in the score.' }));
    rv.appendChild(h('ul', { class: 'au-checks' }, reviewItems.map(function (c) {
      return h('li', { class: 'au-check au-' + c.status }, h('span', { class: 'au-badge', text: { pass: 'Looks good', warn: 'Review', info: 'Info' }[c.status] }),
        h('div', { class: 'au-body' }, h('p', { class: 'au-title', text: c.title + ' · WCAG ' + c.sc }), h('p', { class: 'au-detail', text: c.detail }),
          c.list && c.list.length ? h('details', { class: 'au-more' }, h('summary', { text: 'Show ' + c.list.length }), h('ul', null, c.list.slice(0, 80).map(function (x) { return h('li', null, h('code', { text: x })); }))) : null));
    })));
    var outline = h('details', { class: 'au-more' }, h('summary', { text: 'Heading outline (' + S.headings.length + ')' }),
      h('ol', { class: 'pc-outline' }, S.headings.map(function (x) { return h('li', { style: '--lvl:' + (x.level - 1) }, h('span', { class: 'pc-hl', text: 'H' + x.level }), h('span', { text: x.text || '(empty heading)' }), x.hidden ? h('span', { class: 'pc-pill', text: 'hidden' }) : null); })));
    var lms = h('details', { class: 'au-more' }, h('summary', { text: 'Landmarks (' + S.landmarks.length + ')' }),
      h('ul', null, S.landmarks.map(function (l) { return h('li', null, h('code', { text: l.role }), l.label ? ' "' + l.label + '"' : ''); })));
    add(rv, [outline, lms]);
    add(issues, rv);

    var key = 'kj-a11y-manual:' + meta.url, saved = {};
    try { saved = JSON.parse(K.store.get(key) || '{}'); } catch (e) { saved = {}; }
    var done = 0;
    var manual = h('div', { class: 'pc-card ax-manual' }, h('h3', { text: 'Manual WCAG 2.2 checks' }),
      h('p', { class: 'muted pc-intro', text: 'Automated testing cannot judge these. Work through them with a keyboard and a screen reader; ticks are saved in this browser for this URL.' }));
    var prog = h('p', { class: 'au-small muted' });
    var ul = h('ul', { class: 'ax-checklist' }, MANUAL.map(function (m, i) {
      var cb = h('input', { type: 'checkbox', checked: !!saved[i] });
      if (saved[i]) done++;
      cb.addEventListener('change', function () {
        saved[i] = cb.checked; K.store.set(key, JSON.stringify(saved));
        done += cb.checked ? 1 : -1; prog.textContent = done + ' of ' + MANUAL.length + ' checked';
      });
      return h('li', null, h('label', null, cb, h('span', null, h('strong', { text: m[0] + ' · ' + m[1] }), h('br'), m[2])));
    }));
    prog.textContent = done + ' of ' + MANUAL.length + ' checked';
    add(manual, [prog, ul]);
    add(issues, manual);

    var passed = h('details', { class: 'pc-card' }, h('summary', null, h('h3', { text: 'Passed rules (' + R.passes.length + ')' })),
      h('ul', { class: 'ax-passed' }, R.passes.map(function (p) { return h('li', null, h('span', { text: p.help }), ' ', h('span', { class: 'muted', text: '(' + plural(p.count, 'element') + ')' })); })));
    add(issues, passed);
    top.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function csv(R) {
    var rows = [['Status', 'Impact', 'Rule', 'Issue', 'WCAG', 'Level', 'Selector', 'HTML', 'How to fix', 'Reference']];
    var push = function (r, status) {
      r.nodes.forEach(function (n) {
        rows.push([status, r.impact || '', r.id, r.help, scOf(r.tags).join(' '), levelOf(r.tags), selector(n.target), n.html, n.summary, r.helpUrl]);
      });
    };
    R.violations.forEach(function (r) { push(r, 'Fail'); });
    R.incomplete.forEach(function (r) { push(r, 'Needs review'); });
    var esc = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return new Blob(['﻿' + rows.map(function (r) { return r.map(esc).join(','); }).join('\r\n')], { type: 'text/csv' });
  }
  function save(blob, name) {
    var a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  /* ---------- form ---------- */
  K.setupKey(form);
  var qs = new URLSearchParams(location.search);
  if (qs.get('url')) form.elements.axUrl.value = qs.get('url');
  window.addEventListener('resize', function () { if (frame && !stage.hidden && frame._vp) fitPreview(frame._vp, parseInt(frame.style.height, 10)); });

  var running = false;
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (running) return;
    var err = document.getElementById('axError');
    err.textContent = '';
    var el = form.elements, paste = el.axHtml.value.trim();
    var url = K.normaliseUrl(el.axUrl.value);
    if (!url && !paste) { err.textContent = 'Enter a page URL, or paste HTML under Settings.'; return; }
    if (url) el.axUrl.value = url;
    K.persistKey(form);
    if (url && !paste) history.replaceState(null, '', '?url=' + encodeURIComponent(url));
    var vp = VIEWPORTS[el.axViewport.value] || VIEWPORTS.desktop;
    var std = STANDARDS[el.axStandard.value] || STANDARDS.wcag22aa;
    var tags = std.tags.concat(el.axBest.checked ? ['best-practice'] : []);
    running = true;
    var btn = document.getElementById('axGo');
    btn.disabled = true; btn.textContent = 'Checking…';
    document.getElementById('axReport').hidden = true;
    document.getElementById('axIssues').hidden = true;
    var step = K.steps(document.getElementById('axSteps'));
    try {
      var s1 = step(paste ? 'Use pasted HTML' : 'Fetch and render the page');
      var page;
      if (paste) { page = { body: paste, finalUrl: url || 'https://example.invalid/', rendered: true }; s1('ok', 'Done'); }
      else {
        page = await K.jina(url, 'html', { key: el.auKey.value.trim() });
        if (!page.body) { s1('err', page.error || 'Failed'); throw new Error('The page could not be fetched' + (page.error ? ': ' + page.error : '.')); }
        s1(page.status && page.status >= 400 ? 'err' : 'ok', 'HTTP ' + (page.status || 200) + (page.rendered ? ' · rendered with JavaScript' : ' · as served, without JavaScript (add a Jina key to render)'));
      }
      var s2 = step('Render at ' + vp.label + ' and run ' + std.label + ' rules (axe-core)');
      var res = await analyse(page.body, page.finalUrl, vp, tags);
      frame._vp = vp;
      s2('ok', plural(res.results.violations.length, 'rule') + ' failed, ' + res.results.passes.length + ' passed');
      render(res, { url: page.finalUrl, vp: vp, standard: std, bestPractice: el.axBest.checked, mode: page.rendered ? 'rendered' : 'served' });
    } catch (x) {
      err.textContent = x.message + ' For private or blocked pages, paste the HTML under Settings.';
    } finally {
      running = false;
      btn.disabled = false; btn.textContent = 'Check accessibility';
    }
  });
})();

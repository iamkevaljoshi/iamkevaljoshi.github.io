(function () {
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var root = document.documentElement;

  /* theme toggle */
  var spin = 0;
  $('#themeBtn').addEventListener('click', function () {
    var dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('kj-theme', root.dataset.theme); } catch (e) {}
    spin += 180; this.style.transform = 'rotate(' + spin + 'deg)';
    document.dispatchEvent(new Event('themechange'));
  });

  /* mobile menu */
  var menuBtn = $('#menuBtn'), links = $('#navLinks');
  menuBtn.addEventListener('click', function () {
    var open = links.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open);
  });
  links.addEventListener('click', function (e) { if (e.target.closest('a')) { links.classList.remove('open'); menuBtn.setAttribute('aria-expanded', false); } });

  /* heading word reveal */
  $$('[data-split]').forEach(function (h) {
    h.innerHTML = h.textContent.trim().split(/\s+/).map(function (w, i) {
      var s = document.createElement('span'); s.textContent = w;
      return '<span class="w"><span style="transition-delay:' + i * 70 + 'ms">' + s.innerHTML + '</span></span>';
    }).join(' ');
  });
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.4 });
  $$('[data-split]').forEach(function (h) { io.observe(h); });

  /* scroll: progress bar, nav border, timeline fill */
  var jobs = $$('.job'), timeline = $('#timeline'), fill = $('#fill');
  function onScroll() {
    var max = root.scrollHeight - innerHeight;
    $('#progress').style.transform = 'scaleX(' + (max > 0 ? scrollY / max : 0) + ')';
    $('#nav').classList.toggle('scrolled', scrollY > 10);
    if (timeline && fill) {
      var tl = timeline.getBoundingClientRect();
      fill.style.transform = 'scaleY(' + Math.min(1, Math.max(0, (innerHeight * 0.65 - tl.top) / tl.height)) + ')';
      jobs.forEach(function (j) { j.classList.toggle('lit', j.getBoundingClientRect().top < innerHeight * 0.65); });
    }
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* project accordion + skill filter */
  $$('.p-row').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.parentElement, open = !item.classList.contains('open');
      item.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open);
    });
  });
  var filters = $('#filters');
  if (filters) filters.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip'); if (!chip) return;
    $$('.chip').forEach(function (c) { c.setAttribute('aria-pressed', c === chip); });
    var s = chip.dataset.skill;
    $$('.project').forEach(function (p) {
      p.classList.toggle('dim', s !== 'All' && p.dataset.tags.split('|').indexOf(s) < 0);
    });
  });

  /* copy buttons */
  $$('[data-copy]').forEach(function (b) {
    var label = b.textContent;
    b.addEventListener('click', function () {
      navigator.clipboard.writeText(b.dataset.copy).then(function () { b.textContent = 'Copied'; },
        function () { b.textContent = 'Couldn’t copy, select the address above'; });
      setTimeout(function () { b.textContent = label; }, 2200);
    });
  });
})();

/* scroll reveal, card spotlight, count-up */
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  if (!reduce && 'IntersectionObserver' in window) {
    var items = $$('.card, .cert, .case-card, .cred-row li, .job, .post-item, .proof li, .faq details, .skill-grp, .list li, .about-grid > *, .lede, .facts');
    items.forEach(function (el) {
      var sibs = Array.prototype.indexOf.call(el.parentNode.children, el);
      el.classList.add('rv');
      el.style.transitionDelay = (Math.min(sibs, 6) * 70) + 'ms';
    });
    var ro = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (el) { ro.observe(el); });
    // once revealed, hand the element back to its own hover transitions
    document.addEventListener('transitionend', function (e) {
      var el = e.target;
      if (el.classList && el.classList.contains('in') && e.propertyName === 'opacity') {
        el.classList.remove('rv', 'in'); el.style.transitionDelay = '';
      }
    });
  }

  $$('.card, .cert, .case-card, .cred-row li').forEach(function (el) {
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  $$('.proof strong').forEach(function (el) {
    var m = el.textContent.match(/^(\d+)(.*)$/);
    if (!m || reduce) return;
    var target = +m[1], rest = m[2];
    el.textContent = '0' + rest;
    new IntersectionObserver(function (es, o) {
      if (!es[0].isIntersecting) return;
      o.disconnect();
      var t0 = performance.now();
      (function tick(t) {
        var k = Math.min(1, (t - t0) / 1400), v = Math.round(target * (1 - Math.pow(1 - k, 3)));
        el.textContent = v + rest;
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    }).observe(el);
  });
})();

/* open blog diagrams full size */
document.querySelectorAll('.prose img[src$=".svg"]').forEach(function (img) {
  img.addEventListener('click', function () { window.open(img.src, '_blank', 'noopener'); });
});

/* global search: index built by Jekyll at /search.json, loaded on first open */
(function () {
  var dlg = document.getElementById('searchDlg'), btn = document.getElementById('searchBtn');
  if (!dlg || !btn) return;
  var input = document.getElementById('searchInput'), list = document.getElementById('searchResults');
  var indexUrl = (document.querySelector('link[rel="stylesheet"][href*="site.css"]').getAttribute('href') || '').replace(/assets\/css\/site\.css.*$/, '') + 'search.json';
  var data = null, loading = null, active = -1, results = [];
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  document.getElementById('searchKbd').textContent = isMac ? '⌘K' : 'Ctrl K';

  function load() {
    if (!loading) loading = fetch(indexUrl).then(function (r) { return r.json(); }).then(function (d) {
      data = d.map(function (r) {
        r.lt = r.t.toLowerCase(); r.ls = (r.s + ' ' + (r.g || '')).toLowerCase(); r.lx = (r.x || '').toLowerCase();
        return r;
      });
    }).catch(function () { data = []; });
    return loading;
  }
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mark(s, terms) {
    var out = esc(s);
    terms.forEach(function (t) { out = out.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); });
    return out;
  }
  function snippet(x, terms) {
    var lx = x.toLowerCase(), i = -1;
    terms.some(function (t) { i = lx.indexOf(t); return i >= 0; });
    if (i < 0) return x.length > 150 ? x.slice(0, 150) + '…' : x;
    var start = Math.max(0, i - 60), end = Math.min(x.length, i + 110);
    return (start ? '…' : '') + x.slice(start, end) + (end < x.length ? '…' : '');
  }
  function search(q) {
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return data.map(function (r) {
      var score = 0;
      for (var k = 0; k < terms.length; k++) {
        var t = terms[k], s = 0;
        if (r.lt.indexOf(t) >= 0) s += r.lt.indexOf(t) === 0 || r.lt.indexOf(' ' + t) >= 0 ? 12 : 8;
        if (r.ls.indexOf(t) >= 0) s += 4;
        var n = r.lx.split(t).length - 1;
        if (n) s += Math.min(n, 4);
        if (!s) return null;            // every term must match somewhere
        score += s;
      }
      if (r.s === 'Page') score += 1;
      return { r: r, score: score };
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score; }).slice(0, 12).map(function (o) { return o.r; });
  }
  function render() {
    var q = input.value.trim(), terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!data) { list.innerHTML = '<li class="search-empty">Loading…</li>'; return; }
    results = q ? search(q) : data.filter(function (r) { return r.s === 'Page' || r.s === 'Blog post'; });
    active = results.length ? 0 : -1;
    if (!results.length) {
      list.innerHTML = '<li class="search-empty">No results for “' + esc(q) + '”. Try “AEM”, “Edge Delivery”, “migration” or “certification”.</li>';
      return;
    }
    list.innerHTML = (q ? '' : '<li class="search-label" role="presentation">Jump to</li>') + results.map(function (r, i) {
      return '<li role="option" id="sr' + i + '" aria-selected="' + (i === active) + '"><a href="' + esc(r.u) + '">' +
        '<span class="sr-type">' + esc(r.s) + '</span>' +
        '<span class="sr-title">' + mark(r.t, terms) + '</span>' +
        (q && r.x ? '<span class="sr-text">' + mark(snippet(r.x, terms), terms) + '</span>' : '') + '</a></li>';
    }).join('');
    input.setAttribute('aria-activedescendant', 'sr0');
  }
  function move(d) {
    if (!results.length) return;
    var items = list.querySelectorAll('[role="option"]');
    items[active].setAttribute('aria-selected', 'false');
    active = (active + d + results.length) % results.length;
    items[active].setAttribute('aria-selected', 'true');
    items[active].scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', 'sr' + active);
  }
  function open() {
    if (dlg.open) return;
    dlg.showModal(); input.value = ''; render(); input.focus();
    load().then(render);
  }
  function close() { if (dlg.open) dlg.close(); }

  btn.addEventListener('click', open);
  document.getElementById('searchClose').addEventListener('click', close);
  dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });   // backdrop click
  list.addEventListener('click', function (e) { if (e.target.closest('a')) close(); });
  input.addEventListener('input', render);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); close(); location.href = results[active].u; }
  });
  document.addEventListener('keydown', function (e) {
    var typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); dlg.open ? close() : open(); }
    else if (e.key === '/' && !typing && !dlg.open) { e.preventDefault(); open(); }
  });
  btn.addEventListener('pointerenter', load, { once: true });   // warm the index on hover

  // ?q=term opens search pre-filled (shareable searches, SearchAction target)
  var qp = new URLSearchParams(location.search).get('q');
  if (qp) { open(); input.value = qp; load().then(render); }
})();

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

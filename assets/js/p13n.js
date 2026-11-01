/* First-party, on-device personalisation. Nothing leaves the browser except an
   optional GA4 event naming which variant was shown (no page history, no IDs).
   Stored under one localStorage key; visitors can reset it from the welcome toast. */
(function () {
  var KEY = 'kj-p13n', SESSION_GAP = 30 * 60 * 1000, MIN_INTEREST = 20, HOLDOUT = 0.1;
  var optOut = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  var ls; try { ls = window.localStorage; ls.setItem(KEY + '-t', '1'); ls.removeItem(KEY + '-t'); } catch (e) { return; }
  if (optOut) { try { ls.removeItem(KEY); } catch (e) {} return; }

  function load() { try { return JSON.parse(ls.getItem(KEY)) || null; } catch (e) { return null; } }
  function save(s) { try { ls.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function track(name, params) { if (typeof window.gtag === 'function') window.gtag('event', name, params); }

  var now = Date.now();
  var s = load() || { v: 1, sessions: 0, first: now, last: 0, prev: 0, pages: {}, tags: {}, posts: {}, holdout: Math.random() < HOLDOUT };
  if (!s.last || now - s.last > SESSION_GAP) { s.prev = s.last || 0; s.sessions += 1; }
  s.last = now;

  /* ---------- what page is this? ---------- */
  var path = location.pathname.replace(/index\.html$/, '');
  var article = document.querySelector('article.post[data-title]');
  var cat = article ? 'post' : ({ '/': 'home', '/about/': 'about', '/experience/': 'experience', '/certifications/': 'certifications',
    '/work/': 'work', '/blog/': 'blog', '/contact/': 'contact' })[path] || (path.indexOf('/work/') === 0 ? 'work' : 'other');
  var page = s.pages[cat] || (s.pages[cat] = { t: 0, n: 0 });
  page.n += 1;
  var post = null;
  if (article) {
    post = s.posts[path] || (s.posts[path] = { title: article.dataset.title, t: 0, depth: 0, seen: 0 });
    post.title = article.dataset.title; post.seen = now;
  }
  save(s);

  /* ---------- engaged time (visible tab only) and scroll depth ---------- */
  var activeSince = document.visibilityState === 'visible' ? Date.now() : 0, pending = 0;
  function flush() {
    if (activeSince) { pending += (Date.now() - activeSince) / 1000; activeSince = document.visibilityState === 'visible' ? Date.now() : 0; }
    if (pending < 1) return;
    var cur = load() || s;
    var pg = cur.pages[cat] || (cur.pages[cat] = { t: 0, n: 1 });
    pg.t = Math.round(pg.t + pending);
    if (post) {
      var ps = cur.posts[path] || (cur.posts[path] = post);
      ps.t = Math.round((ps.t || 0) + pending);
      ps.depth = Math.max(ps.depth || 0, post.depth);
      (article.dataset.tags || '').split('|').filter(Boolean).forEach(function (t) { cur.tags[t] = Math.round((cur.tags[t] || 0) + pending); });
    }
    cur.last = Date.now();
    pending = 0; s = cur; save(cur);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') activeSince = Date.now(); else flush();
  });
  addEventListener('pagehide', flush);
  setInterval(flush, 15000);
  if (post) {
    var onScroll = function () {
      var r = article.getBoundingClientRect(), total = r.height - innerHeight;
      var d = total > 0 ? Math.min(100, Math.max(0, Math.round((-r.top / total) * 100))) : 100;
      if (d > post.depth) post.depth = d;
    };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  /* ---------- reset (works from any page) ---------- */
  function reset() { try { ls.removeItem(KEY); } catch (e) {} track('personalization_reset', {}); location.reload(); }
  document.addEventListener('click', function (e) { if (e.target.closest('[data-p13n-reset]')) { e.preventDefault(); reset(); } });

  /* ---------- home page: adapt for returning visitors ---------- */
  if (cat !== 'home' || s.sessions < 2) return;

  var label = { experience: 'experience', certifications: 'certifications', blog: 'writing', work: 'work' };
  var interest = { experience: s.pages.experience ? s.pages.experience.t : 0, certifications: s.pages.certifications ? s.pages.certifications.t : 0,
    work: s.pages.work ? s.pages.work.t : 0, blog: (s.pages.blog ? s.pages.blog.t : 0) + (s.pages.post ? s.pages.post.t : 0) };
  var top = Object.keys(interest).sort(function (a, b) { return interest[b] - interest[a]; })[0];
  if (interest[top] < MIN_INTEREST) top = null;
  var topTag = Object.keys(s.tags).sort(function (a, b) { return s.tags[b] - s.tags[a]; })[0] || null;

  // choose one message, most specific first
  var variant = null, msg = '', cta = null;
  var unfinished = Object.keys(s.posts).map(function (u) { return { u: u, p: s.posts[u] }; })
    .filter(function (x) { return x.p.depth >= 20 && x.p.depth < 85 && x.p.t >= 15 && now - x.p.seen < 30 * 864e5; })
    .sort(function (a, b) { return b.p.seen - a.p.seen; })[0];
  var newPosts = Array.prototype.slice.call(document.querySelectorAll('[data-section="writing"] .post-item')).filter(function (el) {
    var d = Date.parse(el.querySelector('time').getAttribute('datetime')), a = el.querySelector('h3 a');
    return s.prev && d > s.prev && !s.posts[new URL(a.href).pathname];
  });
  var intentSecs = (s.pages.work ? s.pages.work.t : 0) + (s.pages.experience ? s.pages.experience.t : 0) + (s.pages.contact ? s.pages.contact.t : 0);

  if (unfinished) {
    variant = 'continue_reading';
    msg = 'Welcome back. You were ' + unfinished.p.depth + '% through “' + unfinished.p.title + '”.';
    cta = { text: 'Continue reading', href: unfinished.u };
  } else if (newPosts.length) {
    var a0 = newPosts[0].querySelector('h3 a');
    variant = 'new_posts';
    msg = 'Welcome back. ' + (newPosts.length === 1 ? 'New since your last visit: “' + a0.textContent.trim() + '”.' : newPosts.length + ' new posts since your last visit.');
    cta = { text: newPosts.length === 1 ? 'Read it' : 'See what’s new', href: newPosts.length === 1 ? a0.getAttribute('href') : '/blog/' };
  } else if (s.sessions >= 2 && intentSecs >= 90) {
    variant = 'contact_intent';
    msg = 'Welcome back. Exploring an AEM or Edge Delivery project? I’m happy to talk it through.';
    cta = { text: 'Start a conversation', href: '/contact/' };
  } else if (top) {
    variant = 'interest_' + top;
    msg = 'Welcome back. Last time you spent most of your visit on my ' + label[top] + ', so it’s first below.';
  } else {
    variant = 'welcome_back';
    msg = 'Welcome back. Good to see you again.';
  }

  track('personalization', { variant: variant, holdout: s.holdout ? 1 : 0, visit_number: s.sessions });
  if (s.holdout) return;   // control group: measure, don't change anything

  // 1. stat cards: top interest first
  var cards = document.querySelector('.stats');
  if (cards && top) {
    var card = cards.querySelector('[data-track="' + top + '"]');
    if (card) {
      card.classList.add('is-picked'); card.style.order = '-1';
      card.querySelector('.shead').insertAdjacentHTML('beforeend', '<span class="picked">Picked for you</span>');
    }
  }

  // 2. writing first for readers
  var writing = document.querySelector('[data-section="writing"]'), caps = document.querySelector('[data-section="capabilities"]');
  if (writing && caps && (top === 'blog' || topTag)) caps.parentNode.insertBefore(writing, caps);

  // 3. posts list: mark progress, put unread posts on the visitor's topic first
  if (writing) {
    var list = writing.querySelector('.posts');
    var items = Array.prototype.slice.call(list.querySelectorAll('.post-item'));
    items.forEach(function (el) {
      var href = new URL(el.querySelector('h3 a').href).pathname, st = s.posts[href], tags = (el.dataset.tags || '').split('|');
      el.dataset.score = (st && st.depth >= 85 ? -10 : 0) + (st && st.depth >= 20 && st.depth < 85 ? 5 : 0) + (topTag && tags.indexOf(topTag) >= 0 && !st ? 3 : 0);
      if (st && st.depth >= 85) el.querySelector('h3').insertAdjacentHTML('beforebegin', '<span class="pstate done">Read</span>');
      else if (st && st.depth >= 20) el.querySelector('h3').insertAdjacentHTML('beforebegin', '<span class="pstate">Continue · ' + st.depth + '%</span>');
      else if (topTag && tags.indexOf(topTag) >= 0) el.querySelector('h3').insertAdjacentHTML('beforebegin', '<span class="pstate rec">For you</span>');
    });
    items.sort(function (a, b) { return b.dataset.score - a.dataset.score; }).forEach(function (el) { list.appendChild(el); });
  }

  // 4. welcome toast (fixed position, so nothing on the page shifts)
  try { if (+sessionStorage.getItem(KEY + '-dismissed') === s.sessions) return; } catch (e) {}
  var t = document.createElement('aside');
  t.className = 'p13n-toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite');
  t.innerHTML = '<p class="p13n-msg"></p>' +
    (cta ? '<a class="btn solid p13n-cta" data-track="p13n-' + variant + '"></a>' : '') +
    '<details class="p13n-why"><summary>Why am I seeing this?</summary><p>It’s based on pages you viewed on this device. Nothing is sent anywhere. <a href="#" data-p13n-reset>Reset</a></p></details>' +
    '<button class="p13n-close" type="button" aria-label="Dismiss">×</button>';
  t.querySelector('.p13n-msg').textContent = msg;
  if (cta) { var c = t.querySelector('.p13n-cta'); c.textContent = cta.text; c.href = cta.href; }
  t.querySelector('.p13n-close').addEventListener('click', function () {
    t.classList.remove('in');
    try { sessionStorage.setItem(KEY + '-dismissed', s.sessions); } catch (e) {}
    track('personalization_dismiss', { variant: variant });
    setTimeout(function () { t.remove(); }, 400);
  });
  document.body.appendChild(t);
  setTimeout(function () { t.classList.add('in'); }, 900);
})();

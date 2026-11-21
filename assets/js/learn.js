/* Learn section: progress, try-it checklists and quizzes. Everything is stored in this browser only. */
(function () {
  'use strict';
  var KEY = 'kj-learn-v1';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function load() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { s = {}; }
    s.done = s.done || {}; s.quiz = s.quiz || {}; s.steps = s.steps || {};
    return s;
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable: progress lasts for this visit only */ } }
  var state = load();

  /* "text with `code`" -> nodes, never innerHTML */
  function rich(text, el) {
    String(text).split('`').forEach(function (part, i) {
      if (!part) return;
      if (i % 2) { var c = document.createElement('code'); c.textContent = part; el.appendChild(c); }
      else el.appendChild(document.createTextNode(part));
    });
    return el;
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function setBar(bar, done, total) {
    if (!bar) return;
    var fill = bar.querySelector('span');
    if (fill) fill.style.width = (total ? Math.round(done / total * 100) : 0) + '%';
    bar.setAttribute('aria-valuenow', String(done));
  }
  function countTrack(track) {
    return Object.keys(state.done).filter(function (k) { return k.indexOf(track + '/') === 0 && state.done[k]; }).length;
  }

  /* ---------------- Course page ---------------- */
  function course(root) {
    var track = root.dataset.track, total = +root.dataset.total, first = null;
    var items = $$('.ln-item[data-slug]', root);
    items.forEach(function (li) {
      var slug = li.dataset.slug, q = state.quiz[slug];
      li.classList.toggle('is-done', !!state.done[slug]);
      var sc = $('[data-score]', li);
      if (sc) sc.textContent = q ? ' · Quiz ' + q.score + '/' + q.total : '';
      if (!state.done[slug] && !first) first = li;
    });
    var done = items.filter(function (li) { return state.done[li.dataset.slug]; }).length;
    setBar($('#lnBar', root), done, total);
    var note = $('#lnBarNote', root);
    if (note) note.textContent = done ? done + ' of ' + total + ' lessons complete (' + Math.round(done / total * 100) + '%)' : 'Not started';
    $$('.ln-lv-count', root).forEach(function (c) {
      var lv = items.filter(function (li) { return li.dataset.level === c.dataset.level; });
      var d = lv.filter(function (li) { return state.done[li.dataset.slug]; }).length;
      c.textContent = lv.length ? '· ' + d + '/' + lv.length : '';
    });
    var start = $('#lnStart', root);
    if (start && items.length) {
      if (done >= items.length) { start.textContent = 'Course complete. Review lesson 1'; }
      else if (first) {
        var a = $('a', first); start.href = a.href;
        start.textContent = done ? 'Continue: ' + a.textContent.replace(/^\s*\d+\s*/, '') : 'Start lesson 1';
      }
    }
    var reset = $('#lnReset', root);
    if (reset && !reset.dataset.bound) {
      reset.dataset.bound = '1';
      reset.addEventListener('click', function () {
        if (!confirm('Reset your progress for this course in this browser?')) return;
        Object.keys(state.done).concat(Object.keys(state.quiz), Object.keys(state.steps)).forEach(function (k) {
          if (k.indexOf(track + '/') === 0) { delete state.done[k]; delete state.quiz[k]; delete state.steps[k]; }
        });
        save(state); course(root);
      });
    }
  }

  /* ---------------- Landing page ---------------- */
  function index(root) {
    $$('.ln-course', root).forEach(function (c) {
      var lis = $$('.ln-slugs li', c), done = lis.filter(function (li) { return state.done[li.dataset.slug]; }).length;
      setBar($('.ln-bar', c), done, lis.length);
      var n = $('[data-note]', c);
      if (n) n.textContent = done ? done + ' of ' + lis.length + ' lessons complete' : 'Not started';
    });
    if (state.last) {
      var li = $('.ln-slugs li[data-slug="' + state.last + '"]', root);
      var box = $('#lnResume', root), link = $('#lnResumeLink', root);
      if (li && box && link) { link.href = li.dataset.url; link.textContent = 'Continue: ' + li.dataset.title; box.hidden = false; }
    }
  }

  /* ---------------- Lesson page ---------------- */
  function lesson(root) {
    var slug = root.dataset.slug, track = root.dataset.track, total = +root.dataset.total;
    state.last = slug; save(state);

    var btn = $('#lnComplete'), flag = $('#lnDoneFlag'), bar = $('#lnBar'), note = $('#lnBarNote');
    function paint() {
      var d = !!state.done[slug], n = countTrack(track);
      if (btn) { btn.setAttribute('aria-pressed', String(d)); btn.textContent = d ? 'Completed. Click to undo' : 'Mark lesson as complete'; btn.classList.toggle('is-on', d); }
      if (flag) flag.hidden = !d;
      setBar(bar, n, total);
      if (note) note.textContent = n + ' of ' + total + ' lessons complete. Your progress is saved in this browser.';
      var nx = $('#lnNext'); if (nx) nx.classList.toggle('is-ready', d);
    }
    function setDone(v) { if (v) state.done[slug] = 1; else delete state.done[slug]; save(state); paint(); }
    if (btn) btn.addEventListener('click', function () { setDone(!state.done[slug]); });
    paint();

    // Try it checklist
    var boxes = $$('.ln-steps input[type=checkbox]');
    var saved = state.steps[slug] || [];
    boxes.forEach(function (b, i) {
      b.checked = !!saved[i];
      b.addEventListener('change', function () {
        state.steps[slug] = boxes.map(function (x) { return x.checked ? 1 : 0; }); save(state);
      });
    });

    // Copy buttons on code blocks
    $$('.ln-body pre').forEach(function (pre) {
      var b = el('button', 'ln-copy', 'Copy'); b.type = 'button';
      b.addEventListener('click', function () {
        var t = pre.textContent.replace(/\n$/, '');
        var ok = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1500); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () { /* blocked */ });
      });
      pre.classList.add('ln-pre'); pre.appendChild(b);
    });

    quiz(slug, setDone);
  }

  function quiz(slug, setDone) {
    var body = $('#lnQuizBody'), dataEl = $('#lnQuizData');
    if (!body || !dataEl) return;
    var qs; try { qs = JSON.parse(dataEl.textContent); } catch (e) { return; }
    var needed = +body.dataset.needed || Math.ceil(qs.length * 0.75), answers = [];
    var prev = state.quiz[slug];

    function render() {
      body.textContent = ''; answers = new Array(qs.length);
      qs.forEach(function (q, i) {
        var fs = el('fieldset', 'ln-q'), lg = el('legend'); lg.appendChild(el('span', 'ln-qn', 'Question ' + (i + 1) + ' of ' + qs.length)); lg.appendChild(rich(q.q, el('span', 'ln-qt')));
        fs.appendChild(lg);
        var opts = el('div', 'ln-opts');
        q.options.forEach(function (o, j) {
          var id = 'q' + i + 'o' + j, lab = el('label', 'ln-opt'); lab.htmlFor = id;
          var inp = el('input'); inp.type = 'radio'; inp.name = 'q' + i; inp.id = id; inp.value = j;
          lab.appendChild(inp); lab.appendChild(rich(o, el('span')));
          opts.appendChild(lab);
        });
        fs.appendChild(opts);
        var chk = el('button', 'btn ghost ln-check-btn', 'Check answer'); chk.type = 'button'; chk.disabled = true;
        var fb = el('div', 'ln-fb'); fb.setAttribute('aria-live', 'polite');
        opts.addEventListener('change', function () { chk.disabled = false; });
        chk.addEventListener('click', function () {
          var sel = fs.querySelector('input:checked'); if (!sel) return;
          var pick = +sel.value, ok = pick === q.answer; answers[i] = ok;
          $$('input', fs).forEach(function (x) { x.disabled = true; });
          $$('.ln-opt', fs).forEach(function (l, j) { if (j === q.answer) l.classList.add('is-right'); else if (j === pick) l.classList.add('is-wrong'); });
          chk.hidden = true; fb.textContent = '';
          fb.className = 'ln-fb ' + (ok ? 'is-right' : 'is-wrong');
          fb.appendChild(el('strong', null, ok ? 'Correct. ' : 'Not quite. '));
          rich(q.why || '', fb);
          finish();
        });
        fs.appendChild(chk); fs.appendChild(fb); body.appendChild(fs);
      });
      var sum = el('div', 'ln-sum'); sum.id = 'lnSum'; sum.setAttribute('aria-live', 'polite'); sum.hidden = true; body.appendChild(sum);
      if (prev) { var hint = el('p', 'muted ln-prev-score', 'Your best result so far: ' + prev.score + ' of ' + prev.total + '.'); body.insertBefore(hint, body.firstChild); }
    }
    function finish() {
      var answered = answers.filter(function (a) { return a !== undefined; }).length;
      if (answered < qs.length) return;
      var score = answers.filter(Boolean).length, pass = score >= needed, sum = $('#lnSum');
      if (!prev || score > prev.score) { prev = { score: score, total: qs.length }; state.quiz[slug] = prev; save(state); }
      sum.hidden = false; sum.textContent = ''; sum.className = 'ln-sum ' + (pass ? 'is-right' : 'is-wrong');
      sum.appendChild(el('strong', null, 'You scored ' + score + ' of ' + qs.length + '. '));
      sum.appendChild(document.createTextNode(pass ? 'Well done. This lesson is marked complete, so carry on to the next one.' : 'You need ' + needed + ' to complete the lesson. Re-read the explanations above, then try again.'));
      if (pass) setDone(true);
      var again = el('button', 'btn ghost', 'Retry the quiz'); again.type = 'button';
      again.addEventListener('click', function () { render(); if (body.scrollIntoView) body.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      sum.appendChild(el('div', 'ln-sum-actions')).appendChild(again);
    }
    render();
  }

  function init() {
    $$('[data-learn]').forEach(function (r) {
      var k = r.dataset.learn;
      if (k === 'course') course(r); else if (k === 'index') index(r); else if (k === 'lesson') lesson(r);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

/* AI summary panel on blog posts.
   Pre-written summary for everyone; on-device re-summarising with the browser's
   built-in Summarizer API (Chrome/Edge 138+) where available. Long posts are
   summarised per section (map), then the partial summaries are summarised (reduce). */
(function () {
  'use strict';
  var root = document.querySelector('[data-ai-summary]');
  if (!root) return;
  var $ = function (s) { return root.querySelector(s); };
  var out = $('[data-ai-out]'), src = $('[data-ai-src]'), live = $('[data-ai-live]');
  var status = $('[data-ai-status]'), reset = $('[data-ai-reset]'), aud = $('[data-ai-aud]');
  var chips = root.querySelectorAll('.ai-chip');
  var original = out.innerHTML, originalSrc = src.textContent;

  /* Collapsed by default (CSS, so no layout shift): posts open with their own TL;DR. */
  var toggle = $('[data-ai-toggle]');
  if (toggle) toggle.addEventListener('click', function () {
    var open = !root.classList.contains('is-open');
    root.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open);
    toggle.textContent = open ? 'Show less' : 'Show full summary and AI options';
  });

  if (!('Summarizer' in self)) { $('[data-ai-unsupported]').hidden = false; return; }

  var LANG = { expectedInputLanguages: ['en'], outputLanguage: 'en' };
  var title = (document.querySelector('.post h1') || {}).textContent || document.title;
  var summarizers = new Map(), partials = new Map(), results = new Map();
  var busy = false;

  Summarizer.availability(Object.assign({ type: 'key-points', format: 'markdown', length: 'medium' }, LANG))
    .then(function (a) {
      if (a === 'unavailable') { $('[data-ai-unsupported]').hidden = false; return; }
      live.hidden = false;
      if (a !== 'available') say('The first summary downloads the on-device model once, which can take a few minutes.');
    })
    .catch(function () { $('[data-ai-unsupported]').hidden = false; });

  function say(t) { status.textContent = t; }

  /* Article text, split by h2, without contents, code, figures and references. */
  function sections() {
    var prose = document.querySelector('.post .prose');
    if (!prose) return [];
    var clone = prose.cloneNode(true);
    clone.querySelectorAll('nav.toc, pre, figure, img, script, style').forEach(function (n) { n.remove(); });
    var refs = Array.prototype.find.call(clone.querySelectorAll('h2, h3'), function (h) { return /^references$/i.test(h.textContent.trim()); });
    if (refs) { while (refs.nextSibling) refs.nextSibling.remove(); refs.remove(); }
    var list = [], cur = { title: 'Introduction', text: '' };
    Array.prototype.forEach.call(clone.children, function (el) {
      if (el.tagName === 'H2') {
        if (cur.text.trim()) list.push(cur);
        cur = { title: el.textContent.trim(), text: '' };
      } else {
        cur.text += el.textContent.replace(/\s+/g, ' ').trim() + '\n';
      }
    });
    if (cur.text.trim()) list.push(cur);
    return list;
  }

  function context(audience) {
    return 'A blog post titled "' + title.trim() + '" by Keval Joshi, an Adobe Experience Manager solutions architect. ' +
      'Use British English and keep product names exact.' + (audience ? ' Write for ' + audience + '.' : '');
  }

  function getSummarizer(opts, onProgress) {
    var key = JSON.stringify(opts);
    if (summarizers.has(key)) return summarizers.get(key);
    var p = Summarizer.create(Object.assign({}, opts, LANG, {
      monitor: function (m) {
        m.addEventListener('downloadprogress', function (e) {
          var pct = e.total ? e.loaded / e.total : e.loaded;
          onProgress('Downloading the on-device model: ' + Math.round(pct * 100) + '%');
        });
      }
    }));
    summarizers.set(key, p);
    p.catch(function () { summarizers.delete(key); });
    return p;
  }

  async function fits(s, text) {
    if (typeof s.measureInputUsage !== 'function' || !s.inputQuota) return text.length / 4 < 3000;
    return (await s.measureInputUsage(text)) <= s.inputQuota * 0.85;
  }

  /* Group sections into chunks that fit the model's input quota. */
  async function chunk(s, secs) {
    var chunks = [], cur = '';
    for (var i = 0; i < secs.length; i++) {
      var piece = secs[i].title + '\n' + secs[i].text;
      var next = cur ? cur + '\n' + piece : piece;
      if (cur && !(await fits(s, next))) { chunks.push(cur); cur = piece; } else { cur = next; }
    }
    if (cur) chunks.push(cur);
    for (var j = 0; j < chunks.length; j++) {
      while (!(await fits(s, chunks[j])) && chunks[j].length > 2000) chunks[j] = chunks[j].slice(0, Math.floor(chunks[j].length * 0.8));
    }
    return chunks;
  }

  async function run(type, length) {
    var audience = aud.value;
    var key = type + '|' + length + '|' + audience;
    if (results.has(key)) { render(results.get(key), type); done(); return; }
    var finalOpts = { type: type, length: length, format: type === 'key-points' ? 'markdown' : 'plain-text', sharedContext: context(audience) };
    var final = await getSummarizer(finalOpts, say);
    say('Reading the article…');
    var secs = sections(), whole = secs.map(function (x) { return x.title + '\n' + x.text; }).join('\n');
    var input = whole;

    if (!(await fits(final, whole))) {
      input = partials.get(audience);
      if (!input) {
        var mapper = await getSummarizer({ type: 'tldr', length: 'long', format: 'plain-text', sharedContext: context(audience) }, say);
        var chunks = await chunk(mapper, secs), parts = [];
        for (var i = 0; i < chunks.length; i++) {
          say('Summarising part ' + (i + 1) + ' of ' + chunks.length + '…');
          parts.push(await mapper.summarize(chunks[i], { context: 'This is part ' + (i + 1) + ' of ' + chunks.length + ' of the article.' }));
        }
        input = parts.join('\n\n');
        while (!(await fits(final, input)) && input.length > 2000) input = input.slice(0, Math.floor(input.length * 0.85));
        partials.set(audience, input);
      }
      say('Combining the parts…');
    } else {
      say('Summarising…');
    }

    var text = '';
    if (typeof final.summarizeStreaming === 'function') {
      var stream = final.summarizeStreaming(input, { context: 'Summarise the whole article.' });
      for await (var c of stream) {
        text = c.startsWith(text) ? c : text + c; /* handles cumulative and delta chunks */
        render(text, type);
      }
    } else {
      text = await final.summarize(input, { context: 'Summarise the whole article.' });
    }
    results.set(key, text);
    render(text, type);
    done();
  }

  function done() {
    say('');
    src.textContent = 'Generated on your device by your browser\'s built-in AI. It can make mistakes; the article is the source of truth.';
    reset.hidden = false;
  }

  /* Render model output as text nodes only: bullets become a list, the rest paragraphs. */
  function render(text, type) {
    var lines = text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var frag = document.createDocumentFragment(), ul = null;
    lines.forEach(function (l) {
      var bullet = /^([*\-•]|\d+\.)\s+/.test(l);
      var clean = l.replace(/^([*\-•]|\d+\.)\s+/, '').replace(/\*\*|__/g, '').replace(/^#+\s*/, '');
      if (bullet || type === 'key-points') {
        if (!ul) { ul = document.createElement('ul'); frag.appendChild(ul); }
        var li = document.createElement('li'); li.textContent = clean; ul.appendChild(li);
      } else {
        ul = null;
        var p = document.createElement('p'); p.textContent = clean; frag.appendChild(p);
      }
    });
    out.replaceChildren(frag);
  }

  function setBusy(b, chip) {
    busy = b;
    root.classList.toggle('is-busy', b);
    chips.forEach(function (c) { c.disabled = b; if (chip) c.setAttribute('aria-pressed', String(c === chip)); });
    aud.disabled = b;
  }

  chips.forEach(function (chip) {
    chip.setAttribute('aria-pressed', 'false');
    chip.setAttribute('data-track', 'ai-sum-' + chip.dataset.type + '-' + chip.dataset.length);
    chip.addEventListener('click', function () {
      if (busy) return;
      setBusy(true, chip);
      run(chip.dataset.type, chip.dataset.length)
        .catch(function (e) {
          var msg = e && e.name === 'NotAllowedError' ? 'Your browser didn\'t allow on-device AI here.' :
            e && e.name === 'QuotaExceededError' ? 'This article is too long for the on-device model.' :
            'Couldn\'t summarise on this device' + (e && e.message ? ': ' + e.message : '.');
          say(msg);
        })
        .finally(function () { setBusy(false); });
    });
  });

  reset.addEventListener('click', function () {
    out.innerHTML = original;
    src.textContent = originalSrc;
    reset.hidden = true;
    chips.forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
  });
})();

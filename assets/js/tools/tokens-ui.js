/* Token counter: the page. Needs kit.js (KJTools.h), aem-kit.js (KJA) and tokens.js (KJTok).
   Local counts use self-hosted OpenAI tokenizers in the browser. Claude and Gemini counts call the
   provider only when the visitor clicks Count, with their own key. */
(function () {
  'use strict';
  var h = KJTools.h, T = KJTok, A = KJA;
  var rootEl = document.getElementById('tkTool');
  if (!rootEl) return;
  var LIBS = rootEl.getAttribute('data-libs') || '/assets/libs/gpt-tokenizer/';
  var BIG = 300000;

  var LOCAL = [
    { key: 'o200k', kind: 'local', enc: 'o200k_base', name: 'OpenAI o200k_base', note: 'GPT-4o, GPT-4.1 and the o-series' },
    { key: 'cl100k', kind: 'local', enc: 'cl100k_base', name: 'OpenAI cl100k_base', note: 'GPT-4 and GPT-3.5' }
  ];
  var S = {
    text: '', en: '', custom: [], prices: {}, results: {}, local: {}, localEn: {}, keys: { claude: '', gemini: '' }, remember: false,
    include: {}, viewer: 'o200k', busy: false, big: false
  };
  var mods = {}, timer = null, cells = {};
  var PREF = 'kj-tok-v1', KEYS = 'kj-tok-keys-v1';

  /* ---------- storage ---------- */
  var get = function (k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  var put = function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } };
  function loadPrefs() {
    var p = get(PREF); if (p) { S.custom = p.custom || []; S.prices = p.prices || {}; S.viewer = p.viewer || 'o200k'; }
    var k = get(KEYS); if (k) { S.keys = { claude: k.claude || '', gemini: k.gemini || '' }; S.remember = true; }
  }
  function savePrefs() { put(PREF, { custom: S.custom, prices: S.prices, viewer: S.viewer }); }
  function saveKeys() { put(KEYS, S.remember ? S.keys : null); }

  /* ---------- rows ---------- */
  function rows() {
    var out = LOCAL.slice();
    T.CLAUDE_MODELS.forEach(function (m) { out.push({ key: 'c:' + m.id, kind: 'claude', id: m.id, name: m.name, price: m.price, ctx: m.ctx }); });
    T.GEMINI_MODELS.forEach(function (m) { out.push({ key: 'g:' + m.id, kind: 'gemini', id: m.id, name: m.name, price: m.price, ctx: m.ctx }); });
    S.custom.forEach(function (c) { out.push({ key: (c.provider === 'claude' ? 'c:' : 'g:') + c.id, kind: c.provider, id: c.id, name: c.id, custom: true }); });
    var seen = {}; return out.filter(function (r) { if (seen[r.key]) return false; seen[r.key] = 1; return true; });
  }
  var priceOf = function (r) { var v = S.prices[r.key]; return v != null && v !== '' ? v : (r.price != null ? r.price : ''); };

  /* ---------- tokenizers ---------- */
  function loadEnc(name) {
    if (!mods[name]) mods[name] = import(LIBS + 'esm/encoding/' + name + '.js');
    return mods[name];
  }
  var OPTS = { disallowedSpecial: new Set() };
  function countLocalAll() {
    S.local = {}; S.localEn = {};
    if (S.big) return Promise.resolve();
    return Promise.all(LOCAL.map(function (r) {
      return loadEnc(r.enc).then(function (m) {
        S.local[r.key] = S.text ? m.countTokens(S.text, OPTS) : 0;
        S.localEn[r.key] = S.en ? m.countTokens(S.en, OPTS) : null;
      });
    }));
  }

  /* ---------- refresh ---------- */
  function schedule() { clearTimeout(timer); timer = setTimeout(refresh, 200); }
  var stats = null;
  function refresh() {
    S.big = S.text.length > BIG;
    stats = T.analyse(S.text);
    renderStats();
    countLocalAll().then(function () { renderTable(); renderViewer(); }).catch(function (e) { setMsg('Could not load the tokenizer: ' + e.message, true); });
    renderTable();
  }
  function setMsg(t, bad) { els.msg.textContent = t || ''; els.msg.className = 'pc-note' + (bad ? ' pc-error' : ''); }

  /* ---------- stats ---------- */
  var els = {};
  function renderStats() {
    var b = els.stats; b.textContent = '';
    if (!S.text) { b.appendChild(h('p', { class: 'muted', text: 'Type or paste some text, or load a sample, to see counts.' })); return; }
    b.appendChild(h('div', { class: 'me-tiles' },
      A.stat('Letters and symbols', stats.graphemes.toLocaleString()), A.stat('Words', stats.words.toLocaleString()),
      A.stat('UTF-8 bytes', stats.bytes.toLocaleString()), A.stat('Code points', stats.chars.toLocaleString()), A.stat('Lines', stats.lines.toLocaleString())));
    b.appendChild(h('p', { class: 'muted kt-hint', text: '"Letters and symbols" counts what a reader sees as one character, so a Hindi conjunct such as क्ष is one, even though it is several Unicode code points.' }));
    if (stats.scripts.length) {
      var bar = h('div', { class: 'tk-bar', role: 'img', 'aria-label': 'Share of each script' });
      var legend = h('ul', { class: 'tk-legend' });
      stats.scripts.slice(0, 8).forEach(function (s, i) {
        bar.appendChild(h('span', { class: 'tk-seg tk-s' + (i % 8), style: 'flex:' + Math.max(s.pct, 0.5) + ' 1 0', title: s.name + ' ' + s.pct.toFixed(1) + '%' }));
        legend.appendChild(h('li', null, h('i', { class: 'tk-dot tk-s' + (i % 8) }), s.name + ' ' + s.pct.toFixed(s.pct < 10 ? 1 : 0) + '%'));
      });
      b.appendChild(bar); b.appendChild(legend);
    }
    if (stats.hint) b.appendChild(h('p', { class: 'muted kt-hint', text: stats.hint }));
    var hy = stats.hygiene.slice();
    if (S.big) hy.unshift({ level: 'warn', text: 'This text is very large (' + S.text.length.toLocaleString() + ' characters).', detail: 'To keep the page responsive it is not counted automatically. Click "Count now".' });
    if (hy.length) {
      b.appendChild(A.findings(hy));
      if (hy.some(function (x) { return x.id === 'nfc'; })) b.appendChild(h('div', { class: 'kt-row' }, h('button', { type: 'button', class: 'btn ghost pc-sm', text: 'Convert to NFC', onclick: function () { els.text.value = S.text = S.text.normalize('NFC'); refresh(); } })));
    }
    if (S.big) b.appendChild(h('div', { class: 'kt-row' }, h('button', { type: 'button', class: 'btn solid pc-sm', text: 'Count now', onclick: function () { S.big = false; countLocalAll().then(function () { renderTable(); renderViewer(); }); } })));
  }

  /* ---------- table ---------- */
  var fmt = function (n) { return n == null ? '' : n.toLocaleString(); };
  function buildTable() {
    var body = els.tbody; body.textContent = ''; cells = {};
    rows().forEach(function (r) {
      var c = cells[r.key] = {};
      var tr = h('tr');
      var nameCell = h('th', { scope: 'row' }, h('span', { text: r.name }));
      if (r.kind === 'local') nameCell.appendChild(h('small', { text: r.note }));
      else {
        nameCell.appendChild(h('small', { text: r.kind === 'claude' ? 'Anthropic API' : 'Google API' }));
        if (r.custom) nameCell.appendChild(h('button', { type: 'button', class: 'pc-link tk-rm', text: 'Remove', 'aria-label': 'Remove ' + r.name, onclick: function () { S.custom = S.custom.filter(function (x) { return (x.provider === 'claude' ? 'c:' : 'g:') + x.id !== r.key; }); savePrefs(); buildTable(); renderTable(); } }));
      }
      tr.appendChild(nameCell);
      c.tokens = h('td', { class: 'tk-num' }); tr.appendChild(c.tokens);
      c.how = h('td', { class: 'tk-how' }); tr.appendChild(c.how);
      c.share = h('td', { class: 'tk-num' }); tr.appendChild(c.share);
      var pin = h('input', { type: 'number', min: '0', step: 'any', value: priceOf(r), placeholder: 'price', 'aria-label': 'Price per million input tokens for ' + r.name });
      pin.addEventListener('input', function () { S.prices[r.key] = pin.value; savePrefs(); renderTable(); });
      tr.appendChild(h('td', { class: 'tk-price' }, pin));
      c.cost = h('td', { class: 'tk-num' }); tr.appendChild(c.cost);
      c.vs = h('td', { class: 'tk-num' }); tr.appendChild(c.vs);
      c.act = h('td', { class: 'tk-act' });
      if (r.kind !== 'local') {
        var inc = h('input', { type: 'checkbox', 'aria-label': 'Include ' + r.name + ' in Count all' }); inc.checked = S.include[r.key] !== false;
        inc.addEventListener('change', function () { S.include[r.key] = inc.checked; });
        c.btn = h('button', { type: 'button', class: 'btn ghost pc-sm', text: 'Count', onclick: function () { countOne(r); } });
        c.act.appendChild(inc); c.act.appendChild(c.btn);
      }
      tr.appendChild(c.act);
      body.appendChild(tr);
    });
  }
  function renderTable() {
    if (!els.tbody) return;
    var showVs = !!S.en.trim();
    els.vsHead.hidden = !showVs;
    rows().forEach(function (r) {
      var c = cells[r.key]; if (!c) return;
      var tokens = null, en = null, how = '', stale = false, err = null;
      if (r.kind === 'local') { tokens = S.text ? S.local[r.key] : null; en = S.localEn[r.key]; how = S.big && tokens == null ? 'Click Count now.' : 'Exact. Counted in your browser.'; if (!S.text) how = 'Waiting for text.'; }
      else {
        var res = S.results[r.key];
        if (res && res.err) { err = res.err; how = res.err; }
        else if (res) { tokens = res.tokens; en = res.en; stale = res.text !== S.text || (res.enText || '') !== S.en; how = stale ? 'Out of date. Count again.' : (r.kind === 'claude' ? 'Exact, from Anthropic. Includes a few tokens of message framing.' : 'Exact, from Google.'); }
        else how = (r.kind === 'claude' ? S.keys.claude : S.keys.gemini) ? 'Click Count to ask the API.' : 'Add your API key below, then click Count.';
      }
      c.tokens.textContent = '';
      if (tokens != null) {
        c.tokens.appendChild(h('strong', { text: fmt(tokens) }));
        var rt = stats ? T.ratios(tokens, stats) : null;
        if (rt && rt.perWord != null) c.tokens.appendChild(h('small', { text: rt.perWord.toFixed(2) + ' per word' }));
        c.tokens.classList.toggle('tk-stale', stale);
      } else c.tokens.textContent = '—';
      c.how.textContent = how; c.how.className = 'tk-how' + (err ? ' pc-error' : '');
      c.share.textContent = tokens != null && r.ctx ? (tokens / r.ctx * 100).toFixed(tokens / r.ctx < 0.001 ? 4 : 2) + '%' : '—';
      var cost = tokens != null ? T.cost(tokens, priceOf(r)) : null;
      c.cost.textContent = '';
      if (cost != null) { c.cost.appendChild(h('strong', { text: T.money(cost) })); c.cost.appendChild(h('small', { text: T.money(cost * 1000) + ' per 1,000' })); } else c.cost.textContent = priceOf(r) === '' ? 'Enter a price' : '—';
      c.vs.hidden = !showVs;
      c.vs.textContent = showVs && tokens != null && en ? (tokens / en).toFixed(2) + '×' : (showVs ? '—' : '');
      if (c.btn) c.btn.disabled = S.busy || !S.text.trim();
    });
    els.countAll.disabled = S.busy || !S.text.trim();
  }

  /* ---------- API counting ---------- */
  function countOne(r) {
    var key = r.kind === 'claude' ? S.keys.claude : S.keys.gemini, fn = r.kind === 'claude' ? T.countClaude : T.countGemini;
    var text = S.text, en = S.en;
    if (!key) { S.results[r.key] = { err: 'Add your ' + (r.kind === 'claude' ? 'Anthropic' : 'Gemini') + ' API key first.' }; renderTable(); return Promise.resolve(); }
    S.busy = true; setMsg('Asking ' + (r.kind === 'claude' ? 'Anthropic' : 'Google') + ' to count ' + r.name + '…'); renderTable();
    var p = fn(key, r.id, text).then(function (n) {
      var out = { tokens: n, text: text, en: null, enText: en };
      if (en.trim()) return fn(key, r.id, en).then(function (m) { out.en = m; return out; }, function () { return out; });
      return out;
    });
    return p.then(function (out) { S.results[r.key] = out; }, function (e) { S.results[r.key] = { err: e.message }; })
      .then(function () { S.busy = false; setMsg(''); renderTable(); });
  }
  function countAll() {
    var list = rows().filter(function (r) { return r.kind !== 'local' && S.include[r.key] !== false && (r.kind === 'claude' ? S.keys.claude : S.keys.gemini); });
    if (!list.length) { setMsg('Add an API key and tick at least one Claude or Gemini model.', true); return; }
    list.reduce(function (p, r) { return p.then(function () { return countOne(r); }); }, Promise.resolve());
  }

  /* ---------- viewer ---------- */
  function renderViewer() {
    var box = els.viewBox; box.textContent = '';
    if (!S.text || S.big) { box.appendChild(h('p', { class: 'muted', text: 'The token view appears here.' })); return; }
    var enc = LOCAL.filter(function (r) { return r.key === S.viewer; })[0] || LOCAL[0];
    loadEnc(enc.enc).then(function (m) {
      var ids = m.encode(S.text, OPTS);
      var res = T.chunks(ids, function (id) { return m.decode([id]); }, 4000);
      box.textContent = '';
      var wrap = h('div', { class: 'tk-tokens', tabindex: '0', 'aria-label': 'Text split into tokens' });
      res.chunks.forEach(function (c, i) {
        var t = c.text.replace(/\n/g, '↵\n');
        wrap.appendChild(h('span', { class: 'tk-t tk-t' + (i % 4) + (c.ids.length > 1 ? ' tk-multi' : ''), 'data-n': c.ids.length > 1 ? String(c.ids.length) : null, title: 'token id' + (c.ids.length > 1 ? 's' : '') + ': ' + c.ids.join(', ') + (c.partial ? ' (part of a character)' : '') }, c.partial ? '�' : t));
      });
      box.appendChild(wrap);
      box.appendChild(h('p', { class: 'muted kt-hint', text: res.total.toLocaleString() + ' tokens' + (res.shown < res.total ? ', showing the first ' + res.shown.toLocaleString() : '') + '. A small number on a block means that one character or word needed several tokens. Hover a block for the token ids.' }));
    });
  }

  /* ---------- compare languages ---------- */
  function renderCompare() {
    var box = els.cmpBox; box.textContent = '';
    Promise.all(LOCAL.map(function (r) { return loadEnc(r.enc); })).then(function (ms) {
      var data = T.SAMPLES.map(function (s) {
        var st = T.analyse(s.text), main = st.scripts[0] ? st.scripts[0].name : '';
        return { s: s, script: main, graphemes: st.graphemes, o: ms[0].countTokens(s.text, OPTS), c: ms[1].countTokens(s.text, OPTS) };
      });
      var en = data[0], max = Math.max.apply(null, data.map(function (d) { return d.o; }));
      var tb = h('tbody');
      data.slice().sort(function (a, b) { return a.o - b.o; }).forEach(function (d) {
        tb.appendChild(h('tr', null,
          h('th', { scope: 'row' }, d.s.name), h('td', { text: d.script }), h('td', { class: 'tk-num', text: String(d.graphemes) }),
          h('td', { class: 'tk-num' }, h('strong', { text: String(d.o) }), h('span', { class: 'tk-minibar', style: 'width:' + (d.o / max * 100).toFixed(0) + '%' })),
          h('td', { class: 'tk-num', text: (d.o / en.o).toFixed(1) + '×' }),
          h('td', { class: 'tk-num', text: String(d.c) }), h('td', { class: 'tk-num', text: (d.c / en.c).toFixed(1) + '×' }),
          h('td', null, h('button', { type: 'button', class: 'pc-link', text: 'Use', onclick: function () { loadSample(d.s.id); window.scrollTo({ top: rootEl.offsetTop, behavior: 'smooth' }); } }))));
      });
      box.appendChild(h('div', { class: 'tk-scroll' }, h('table', { class: 'tk-tbl' },
        h('thead', null, h('tr', null, ['Language', 'Script', 'Letters', 'o200k tokens', 'vs English', 'cl100k tokens', 'vs English', ''].map(function (t) { return h('th', { scope: 'col', text: t }); }))), tb)));
      box.appendChild(h('p', { class: 'muted kt-hint', text: 'The same sentence in each language, counted in your browser. These samples were written for comparing token counts, not as reference translations, so have a native speaker review them before using them for anything else. The English-to-language ratio is what changes your cost and how much fits in the context window.' }));
    }).catch(function (e) { box.appendChild(h('p', { class: 'pc-error', text: 'Could not load the tokenizer: ' + e.message })); });
  }

  function loadSample(id) {
    var s = T.SAMPLES.filter(function (x) { return x.id === id; })[0]; if (!s) return;
    els.text.value = S.text = s.text;
    els.en.value = S.en = id === 'en' ? '' : T.SAMPLES[0].text;
    if (S.en) els.enBox.open = true;
    S.results = {}; refresh();
  }

  /* ---------- build the page ---------- */
  function build() {
    els.msg = h('p', { class: 'pc-note', 'aria-live': 'polite' });
    els.text = h('textarea', { rows: 8, spellcheck: 'false', placeholder: 'Paste or type your prompt or text here, in any language.', 'aria-label': 'Text to count' });
    els.text.addEventListener('input', function () { S.text = els.text.value; schedule(); });
    els.en = h('textarea', { rows: 3, spellcheck: 'false', placeholder: 'Optional. The same text in English, to see how much more the original costs.', 'aria-label': 'English version for comparison' });
    els.en.addEventListener('input', function () { S.en = els.en.value; schedule(); });
    els.enBox = h('details', { class: 'pc-adv' }, h('summary', { text: 'Compare with an English version' }), els.en);
    var sample = h('select', { 'aria-label': 'Load a sample' }, h('option', { value: '', text: 'Load a sample…' }), T.SAMPLES.map(function (s) { return h('option', { value: s.id, text: s.name }); }));
    sample.addEventListener('change', function () { if (sample.value) loadSample(sample.value); sample.value = ''; });
    var clear = h('button', { type: 'button', class: 'btn ghost pc-sm', text: 'Clear', onclick: function () { els.text.value = els.en.value = S.text = S.en = ''; S.results = {}; refresh(); } });
    var input = h('div', { class: 'pc-form' }, h('label', { class: 'pc-field' }, h('span', null, 'Your text', h('small', { text: 'Counting happens in your browser. Nothing is sent anywhere unless you click Count on a Claude or Gemini row.' })), els.text),
      h('div', { class: 'kt-row' }, sample, clear), els.enBox);

    els.stats = h('div', { class: 'tk-stats' });

    els.vsHead = h('th', { scope: 'col', text: 'vs English', hidden: true });
    els.countAll = h('button', { type: 'button', class: 'btn solid pc-sm', text: 'Count all selected API models', onclick: countAll });
    els.tbody = h('tbody');
    var table = h('div', { class: 'tk-scroll' }, h('table', { class: 'tk-tbl' },
      h('thead', null, h('tr', null, h('th', { scope: 'col', text: 'Model' }), h('th', { scope: 'col', text: 'Tokens' }), h('th', { scope: 'col', text: 'How it was counted' }), h('th', { scope: 'col', text: 'Of context' }),
        h('th', { scope: 'col', text: '$ per 1M input' }), h('th', { scope: 'col', text: 'Cost of this text' }), els.vsHead, h('th', { scope: 'col', text: 'API' }))), els.tbody));

    /* add a model */
    var addId = h('input', { type: 'text', spellcheck: 'false', placeholder: 'Model ID, for example claude-opus-5-5', 'aria-label': 'Model ID to add' });
    var addKind = h('select', { 'aria-label': 'Provider' }, h('option', { value: 'claude', text: 'Claude' }), h('option', { value: 'gemini', text: 'Gemini' }));
    var addBtn = h('button', { type: 'button', class: 'btn ghost pc-sm', text: 'Add model', onclick: function () {
      var id = addId.value.trim(); if (!id) return;
      S.custom.push({ provider: addKind.value, id: id }); savePrefs(); addId.value = ''; buildTable(); renderTable();
    } });

    /* keys */
    var ck = h('input', { type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'sk-ant-…', value: S.keys.claude, 'aria-label': 'Anthropic API key' });
    var gk = h('input', { type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'AIza…', value: S.keys.gemini, 'aria-label': 'Gemini API key' });
    var rem = h('input', { type: 'checkbox' }); rem.checked = S.remember;
    var onKey = function () { S.keys.claude = ck.value.trim(); S.keys.gemini = gk.value.trim(); S.remember = rem.checked; saveKeys(); renderTable(); };
    ck.addEventListener('input', onKey); gk.addEventListener('input', onKey); rem.addEventListener('change', onKey);
    var keys = h('details', { class: 'pc-adv tk-keys' }, h('summary', { text: 'API keys for exact Claude and Gemini counts' }),
      h('p', { class: 'muted', text: 'Anthropic and Google do not publish their current tokenizers, so the only exact count is theirs. Add your own key and click Count. The text is sent straight from your browser to Anthropic or Google, never through this site. Use a key that is limited in scope and spend, because a key typed into any web page is only as safe as that page and your browser.' }),
      h('div', { class: 'kt-grid' }, h('label', { class: 'pc-field' }, h('span', { text: 'Anthropic API key' }), ck), h('label', { class: 'pc-field' }, h('span', { text: 'Gemini API key' }), gk)),
      h('label', { class: 'pc-check', style: 'margin-top:.75rem' }, rem, 'Remember on this device (stored unencrypted in this browser)'));

    /* viewer */
    var vsel = h('select', { 'aria-label': 'Tokenizer for the token view' }, LOCAL.map(function (r) { return h('option', { value: r.key, text: r.name, selected: r.key === S.viewer }); }));
    vsel.addEventListener('change', function () { S.viewer = vsel.value; savePrefs(); renderViewer(); });
    els.viewBox = h('div');
    els.cmpBox = h('div');
    var cmpBtn = h('button', { type: 'button', class: 'btn solid pc-sm', text: 'Compare languages', onclick: function () { cmpBtn.hidden = true; renderCompare(); } });

    var prices = h('p', { class: 'muted kt-hint' }, 'Claude prices are per million input tokens as of ' + T.PRICES_AS_OF + ' (Haiku 5.5 is for prompts up to 100K tokens), from ', h('a', { href: 'https://platform.claude.com/docs/en/about-claude/pricing', rel: 'noopener', text: 'Anthropic' }), '. Prices change and are editable here. For OpenAI and Gemini, enter the current price from ', h('a', { href: 'https://openai.com/api/pricing/', rel: 'noopener', text: 'OpenAI' }), ' and ', h('a', { href: 'https://ai.google.dev/gemini-api/docs/pricing', rel: 'noopener', text: 'Google' }), '.');

    rootEl.textContent = '';
    rootEl.appendChild(input);
    rootEl.appendChild(els.msg);
    rootEl.appendChild(h('section', { class: 'tk-sec' }, h('h2', { text: 'Your text' }), els.stats));
    rootEl.appendChild(h('section', { class: 'tk-sec' }, h('h2', { text: 'Tokens by model' }), table, h('div', { class: 'kt-row' }, els.countAll), prices,
      h('div', { class: 'tk-add' }, addKind, addId, addBtn), keys));
    rootEl.appendChild(h('section', { class: 'tk-sec' }, h('h2', { text: 'See the tokens' }), h('label', { class: 'pc-field tk-vsel' }, h('span', { text: 'Tokenizer' }), vsel), els.viewBox));
    rootEl.appendChild(h('section', { class: 'tk-sec' }, h('h2', { text: 'The same sentence in 13 languages' }), h('p', { class: 'muted', text: 'Indian-language text usually needs more tokens than English for the same meaning. See how much more, with the exact OpenAI tokenizers.' }), cmpBtn, els.cmpBox));
  }

  loadPrefs();
  build(); buildTable(); refresh();
})();

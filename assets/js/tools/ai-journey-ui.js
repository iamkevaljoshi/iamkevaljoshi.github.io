/* How an AI model answers: the page. Ten stages from request to answer, each tied to the visitor's own prompt.
   Needs kit.js (KJTools.h), aem-kit.js (KJA), tokens.js (KJTok), ai-journey.js (KJAI) and ai-live.js (KJLive). */
(function () {
  'use strict';
  var h = KJTools.h, K = KJAI, T = KJTok, A = KJA, L = KJLive;
  var rootEl = document.getElementById('ajTool');
  if (!rootEl) return;
  var P = {
    data: rootEl.getAttribute('data-data') || '/assets/data/ai-journey/',
    gt: rootEl.getAttribute('data-gt') || '/assets/libs/gpt-tokenizer/',
    tjs: rootEl.getAttribute('data-tjs') || '/assets/libs/transformers/transformers.min.js'
  };
  var OPTS = { disallowedSpecial: new Set() };
  var SAMPLE_DOC = 'Refund policy: Customers can request a refund within 30 days of purchase. Refunds are paid to the original payment method within 5 to 7 working days.';
  var S = {
    profile: 'smollm2', system: 'You are a helpful assistant for a bank\'s customer support team.', prompt: 'What is the capital of France?',
    history: false, tool: false, doc: false, docText: SAMPLE_DOC,
    source: 'example', example: 'capital', settings: { temperature: 1, topK: 0, topP: 1, minP: 0, seed: 7 },
    live: { state: 'idle', quality: 'accurate', device: 'wasm', info: null, progress: null, run: null, error: '' },
    gen: { running: false, stop: false, steps: [], ids: [], prefillMs: 0, decodeMs: [] }, max: 40, rng: null, hw: 'laptop', bits: 16
  };
  var data = null, logitsCache = {}, gtMod = null, els = {}, timer = null, calc = null;

  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var profile = function () { return K.profile(S.profile); };
  var fmt = function (n) { return n.toLocaleString(); };
  var pct = function (p) { return (p * 100 >= 10 ? (p * 100).toFixed(0) : p * 100 >= 1 ? (p * 100).toFixed(1) : (p * 100).toFixed(2)) + '%'; };
  var showTok = function (t) { return t === '' ? '∅' : t.replace(/\n/g, '↵').replace(/ /g, '·').replace(/\t/g, '⇥'); };

  /* ---------- messages and tools ---------- */
  function messages() {
    var m = [];
    if (S.system.trim()) m.push({ role: 'system', content: S.system.trim() });
    if (S.history) m.push({ role: 'user', content: 'Hi, can you help me with a question?' }, { role: 'assistant', content: 'Of course. What would you like to know?' });
    m.push({ role: 'user', content: (S.doc && S.docText.trim() ? 'Use this document to answer.\n\n' + S.docText.trim() + '\n\n' : '') + S.prompt });
    return m;
  }
  var tools = function () { return S.tool ? [K.EXAMPLE_TOOL] : null; };
  var renderText = function (p, msgs, extra) { try { return { text: K.renderChat(p, msgs, Object.assign({ tools: tools() }, extra || {})) }; } catch (e) { return { text: '', error: e.message }; } };

  /* ---------- tokens: exact when the live tokenizer is loaded for SmolLM2, otherwise a stand-in ---------- */
  function loadGT() { if (!gtMod) gtMod = import(P.gt + 'esm/encoding/o200k_base.js'); return gtMod; }
  function exactNow() { return L.ready() && S.profile === 'smollm2'; }
  function tokenise(text, specials) {
    if (exactNow()) {
      var ids = L.encode(text), res = T.chunks(ids, function (id) { return L.decode([id]); }, 3000);
      return { chunks: res.chunks.map(function (c) { return { text: c.text, n: c.ids.length, special: specials.indexOf(c.text) >= 0, ids: c.ids }; }), total: ids.length, exact: true, shown: res.shown };
    }
    return loadGT().then(function (m) {
      var out = [], total = 0;
      K.splitSpecials(text, specials).forEach(function (seg) {
        if (seg.special) { out.push({ text: seg.text, n: 1, special: true }); total += 1; return; }
        var ids = m.encode(seg.text, OPTS), res = T.chunks(ids, function (id) { return m.decode([id]); }, 3000);
        res.chunks.forEach(function (c) { out.push({ text: c.text, n: c.ids.length, special: false, ids: c.ids }); });
        total += ids.length;
      });
      return { chunks: out, total: total, exact: false, shown: out.length };
    });
  }
  function countOnly(text, specials) {
    if (!text) return Promise.resolve(0);
    if (exactNow()) return Promise.resolve(L.encode(text).length);
    return loadGT().then(function (m) { var n = 0; K.splitSpecials(text, specials).forEach(function (s) { n += s.special ? 1 : m.countTokens(s.text, OPTS); }); return n; });
  }

  /* ---------- small UI helpers ---------- */
  function bars(items, opts) {
    opts = opts || {};
    var max = Math.max.apply(null, items.map(function (i) { return Math.max(i.p, i.ghost || 0); })) || 1;
    return h('div', { class: 'aj-bars' }, items.map(function (it) {
      return h('div', { class: 'aj-bar' + (it.on ? ' aj-on' : '') },
        h('span', { class: 'aj-bl', title: it.label, text: showTok(it.label) }),
        h('span', { class: 'aj-bt' }, it.ghost != null ? h('i', { class: 'aj-ghost', style: 'width:' + (it.ghost / max * 100) + '%' }) : null, h('i', { class: 'aj-fill', style: 'width:' + (it.p / max * 100) + '%' })),
        h('span', { class: 'aj-bv', text: pct(it.p) }));
    }));
  }
  function chunkView(res, cap) {
    var wrap = h('div', { class: 'tk-tokens aj-tokens', tabindex: '0', 'aria-label': 'Text split into tokens' });
    res.chunks.slice(0, cap || 600).forEach(function (c, i) {
      wrap.appendChild(h('span', { class: 'tk-t tk-t' + (i % 4) + (c.n > 1 ? ' tk-multi' : '') + (c.special ? ' aj-spec' : ''), 'data-n': c.n > 1 ? String(c.n) : null, title: c.ids ? 'token id' + (c.ids.length > 1 ? 's' : '') + ': ' + c.ids.join(', ') : 'special marker: one token' }, c.text.replace(/\n/g, '↵\n')));
    });
    return wrap;
  }
  function marked(text, specials) {
    var pre = h('pre', { class: 'aj-template', tabindex: '0' });
    K.splitSpecials(text, specials).forEach(function (s) { pre.appendChild(s.special ? h('mark', { class: 'aj-sp', text: s.text }) : document.createTextNode(s.text)); });
    return pre;
  }
  function stat(label, value) { return A.stat(label, value); }
  function slider(label, key, min, max, step, hint, off) {
    var out = h('output', { text: fmtSetting(key) }), input = h('input', { type: 'range', min: min, max: max, step: step, value: S.settings[key], 'aria-label': label });
    input.addEventListener('input', function () { S.settings[key] = Number(input.value); out.textContent = fmtSetting(key); renderSampling(); });
    return h('label', { class: 'pc-field aj-slider' }, h('span', null, label, ' ', out, h('small', { text: hint })), input);
  }
  function fmtSetting(key) {
    var v = S.settings[key];
    if (key === 'topK') return v === 0 ? 'off' : String(v);
    if (key === 'topP') return v >= 1 ? 'off' : v.toFixed(2);
    if (key === 'minP') return v === 0 ? 'off' : v.toFixed(2);
    return String(v);
  }

  /* ---------- current distribution (example or live) ---------- */
  var cur = null; // {logits, order, source, label, vocabText(id), eos}
  function currentSource() {
    if (S.source === 'live' && S.live.run) {
      var r = S.live.run;
      return { logits: r.logits, order: r.order || (r.order = K.sortedOrder(r.logits)), label: 'SmolLM2 135M, running in your browser on your prompt', text: function (id) { return L.decode([id]); }, vocab: 49152, eos: S.live.info && S.live.info.eos, live: true };
    }
    var ex = data && data.prompts.filter(function (x) { return x.id === S.example; })[0], lg = logitsCache[S.example];
    if (!ex || !lg) return null;
    return { logits: lg.logits, order: lg.order, label: 'GPT-2 small, pre-computed on the prompt "' + ex.text.replace(/\n/g, '↵') + '"', text: function (id) { return data.vocabText[id]; }, vocab: data.vocab, eos: data.eos, ex: ex };
  }
  function loadExample(id) {
    if (logitsCache[id]) return Promise.resolve();
    var ex = data.prompts.filter(function (x) { return x.id === id; })[0];
    return fetch(P.data + ex.file).then(function (r) { if (!r.ok) throw new Error('Could not load the example data.'); return r.arrayBuffer(); }).then(function (b) {
      var lg = K.decodeF16(b); logitsCache[id] = { logits: lg, order: K.sortedOrder(lg) };
    });
  }
  function loadData() {
    if (data) return Promise.resolve();
    return Promise.all([fetch(P.data + 'gpt2-playground.json').then(function (r) { return r.json(); }), fetch(P.data + 'gpt2-vocab.json').then(function (r) { return r.json(); })]).then(function (x) { data = x[0]; data.vocabText = x[1]; });
  }

  /* ---------- stages ---------- */
  var STAGES = [
    ['request', 'The app builds the real request', 'Before the model sees anything, the app around it assembles a request. It adds its own instructions (the system prompt), earlier messages, any documents it retrieved and descriptions of the tools the model may use. Your question is only one part.',
      'The model only sees what I typed.', 'It sees everything the app puts in the request. In many apps most of it is not yours.'],
    ['template', 'A chat template turns messages into one stream of text', 'The model reads one long stream of text, not separate boxes. A chat template joins the messages into that text, using special marker words to show where each role starts and stops. Every model family has its own template, so the same conversation looks different for different models.',
      'System and user messages travel through different channels.', 'To the model they are just text with markers. Training teaches it to give the system text priority, but nothing in the architecture enforces it. That is why prompt injection exists.'],
    ['tokens', 'The tokenizer turns text into numbers', 'The tokenizer cuts the text into pieces called tokens and replaces each piece with a whole number, its ID. The model works only with these numbers. A special marker such as <|im_start|> is a single token.',
      'A token is a word.', 'Common English words are one token. Rarer words, names, numbers, code and most non-English text are split into several. Hindi often needs several times as many tokens as the same sentence in English.'],
    ['embed', 'Each token becomes a list of numbers', 'Every token ID is looked up in a table and becomes a list of numbers called an embedding. The length of the list is the width of the model. The model also needs the order of the tokens, which comes from position information.',
      'Each token has a fixed meaning stored as numbers.', 'Embeddings are learned starting points. The layers that follow refine them using the surrounding words, so meaning is built in context, not looked up.'],
    ['layers', 'Layers let tokens look back, then think', 'The lists of numbers pass through a stack of layers. Each layer has two parts: attention, where every token gathers information from the tokens before it, and a feed-forward network that transforms each token\'s list on its own. A token can look only backwards, never ahead.',
      'Attention is where all the work happens.', null],
    ['scores', 'The model scores every possible next token', 'After the last layer, the list for the final token is multiplied by a table the size of the vocabulary. The result is one score for every token the model knows. A softmax turns the scores into probabilities that add up to 1. This is the only thing the model produces.',
      'The model knows the answer and just says it.', 'It produces a spread of probabilities over its whole vocabulary. Even for a fact, the top choice is often well below 100%.'],
    ['sampling', 'Sampling picks one token', 'The app then chooses one token from those probabilities. Temperature sharpens or flattens them. Top-k, top-p and min-p remove unlikely tokens before the draw. Greedy decoding (temperature 0) always takes the most likely token.',
      'Temperature 0 always gives the same answer.', 'With the same model and settings it picks the same token at each step, but many hosted services do not guarantee identical output even at temperature 0.'],
    ['loop', 'The loop: one token at a time', 'The chosen token is added to the text and the model runs again for the next one. The first pass (prefill) reads the whole prompt at once. After that, each new token needs one small pass, and the model reuses what it already worked out for earlier tokens (the KV cache) instead of reading them again.',
      'The model re-reads the whole conversation for every word.', 'It keeps a cache of earlier work. That cache is why memory use grows with the length of the conversation.'],
    ['stop', 'When does it stop?', 'Generation stops when the model produces its end-of-turn token, when a stop sequence appears, when the maximum length is reached, or when the context window is full. The end token is just another token with its own probability at every step.',
      'The model decides to finish like a person does.', 'It gives the end token a probability at every step. The app stops when that token is chosen.'],
    ['around', 'What happens around the model', 'The model only predicts tokens. Everything else is the app: it runs tools the model asks for, adds the results to the text and calls the model again, remembers the conversation by sending it again each time, and bills for the tokens in and out.',
      'The model remembers me between messages.', 'It remembers nothing. The app sends the whole conversation again with every request, and the model reads it from the start each time.']
  ];

  function stageShell(i) {
    var s = STAGES[i], body = h('div', { class: 'aj-body' });
    var sec = h('section', { class: 'aj-stage', id: 'aj-' + s[0], 'aria-labelledby': 'aj-h-' + s[0] },
      h('header', { class: 'aj-sh' }, h('span', { class: 'aj-n', text: String(i + 1) }), h('h2', { id: 'aj-h-' + s[0], text: s[1] })),
      h('p', { class: 'aj-what', text: s[2] }), body);
    var why = document.createTextNode(s[4] || '');
    var myth = h('aside', { class: 'aj-myth' }, h('strong', { text: 'Common misconception: ' }), s[3] + ' ', why);
    sec.appendChild(myth);
    els[s[0]] = { sec: sec, body: body, myth: myth, why: why };
    return sec;
  }

  /* 1 request */
  function renderRequest(c) {
    var b = els.request.body; b.textContent = '';
    var p = profile();
    var parts = c.parts, total = c.total;
    b.appendChild(h('p', { class: 'muted kt-hint', text: 'Sizes are ' + (c.exact ? 'exact for this model' : 'approximate (a stand-in tokenizer is used; load the live model for exact counts)') + '.' }));
    var bar = h('div', { class: 'aj-stack', role: 'img', 'aria-label': 'Share of the request taken by each part' });
    var legend = h('ul', { class: 'aj-legend' });
    parts.forEach(function (x, i) {
      if (!x.n) return;
      bar.appendChild(h('span', { class: 'aj-seg aj-c' + (i % 6), style: 'flex:' + Math.max(x.n, total * 0.01) + ' 1 0', title: x.name + ': ' + x.n + ' tokens' }));
      legend.appendChild(h('li', null, h('i', { class: 'tk-dot aj-c' + (i % 6) }), x.name + ': ', h('strong', { text: fmt(x.n) }), ' tokens (' + (total ? Math.round(x.n / total * 100) : 0) + '%)'));
    });
    b.appendChild(bar); b.appendChild(legend);
    var yours = parts.filter(function (x) { return x.you; }).reduce(function (a, x) { return a + x.n; }, 0);
    b.appendChild(h('p', { class: 'aj-callout' }, 'The part you typed is ', h('strong', { text: fmt(yours) }), ' of ', h('strong', { text: fmt(total) }), ' tokens, or ', h('strong', { text: (total ? Math.round(yours / total * 100) : 0) + '%' }), ' of what the model reads.'));
    b.appendChild(h('p', { class: 'muted', text: 'Hosted assistants such as Claude, ChatGPT and Gemini work the same way in outline, but their exact system prompts, tool descriptions and templates are not published, so only open models can be shown in detail.' }));
  }

  /* 2 template */
  function renderTemplate(c) {
    var b = els.template.body; b.textContent = ''; var p = profile();
    if (!p.chat) { b.appendChild(h('p', { class: 'muted', text: p.name + ' is a base model: it has no chat format. It simply continues whatever text it is given, so your prompt goes in as it is.' })); b.appendChild(h('pre', { class: 'aj-template', text: c.text })); return; }
    if (c.error) { b.appendChild(h('p', { class: 'pc-error', text: c.error })); return; }
    b.appendChild(h('p', { class: 'muted kt-hint', text: 'This is the exact text ' + p.name + ' receives, produced by its published chat template (checked against the official one). The highlighted markers are special tokens.' }));
    b.appendChild(marked(c.text, p.specials));
    if (S.tool && !K.hasToolSection(p)) b.appendChild(h('p', { class: 'pc-note', text: 'This model\'s template has no section for tools, so an app has to describe the tool in ordinary text, as shown in the system message above.' }));
    if (S.tool && K.hasToolSection(p)) b.appendChild(h('p', { class: 'pc-note', text: 'This model\'s template has a tools section, so the tool definition is written into the prompt as text. The model "calls" it by writing text in a set format.' }));
  }

  /* 3 tokens */
  function renderTokens(c) {
    var b = els.tokens.body; b.textContent = ''; var p = profile(), r = c.viewer;
    b.appendChild(h('div', { class: 'me-tiles' }, stat('Tokens in the request', fmt(r.total)), stat('Context window', fmt(p.ctx)), stat('Window used', (r.total / p.ctx * 100 < 0.1 ? '< 0.1' : (r.total / p.ctx * 100).toFixed(1)) + '%'), stat('Left for the answer', fmt(Math.max(0, p.ctx - r.total)))));
    b.appendChild(h('div', { class: 'aj-ctx', role: 'img', 'aria-label': 'Context window used' }, h('span', { style: 'width:' + Math.max(0.5, Math.min(100, r.total / p.ctx * 100)) + '%' })));
    b.appendChild(h('p', { class: 'muted kt-hint', text: (r.exact ? 'Exact tokens from this model\'s own tokenizer.' : 'Approximate: tokens are split with OpenAI\'s o200k tokenizer as a stand-in, and special markers count as one token each. ' + p.name + ' has its own tokenizer, so its real counts differ.') + ' A small number on a block means one word or character needed several tokens. Hover for token IDs.' }));
    b.appendChild(chunkView(r));
    if (r.chunks.length > 600) b.appendChild(h('p', { class: 'muted kt-hint', text: 'Showing the first 600 blocks.' }));
    b.appendChild(h('p', { class: 'muted' }, 'To count tokens for GPT, Claude and Gemini, and to compare 13 languages, use the ', h('a', { href: '/tools/token-counter/', text: 'token counter' }), '.'));
  }

  /* 4 embeddings */
  function renderEmbed(c) {
    var b = els.embed.body; b.textContent = ''; var p = profile(), n = c.viewer.total, table = p.vocab * p.hidden, total = K.params(p);
    b.appendChild(h('div', { class: 'me-tiles' }, stat('Your tokens', fmt(n)), stat('Numbers per token', fmt(p.hidden)), stat('Numbers fed in', fmt(n * p.hidden)), stat('Lookup table', fmt(p.vocab) + ' × ' + fmt(p.hidden))));
    var grid = h('div', { class: 'aj-emb', role: 'img', 'aria-label': 'A grid with one row per token and ' + p.hidden + ' numbers in each row' });
    var rows = Math.min(n, 8);
    for (var i = 0; i < rows; i++) { var row = h('div', { class: 'aj-er' }); for (var j = 0; j < 28; j++) row.appendChild(h('i')); row.appendChild(h('span', { class: 'aj-dots', text: '… ' + p.hidden })); grid.appendChild(row); }
    b.appendChild(grid);
    b.appendChild(h('p', { class: 'muted kt-hint', text: 'Shape only. The grid shows how many numbers each token becomes, not their values.' }));
    b.appendChild(h('p', null, 'The lookup table alone holds ', h('strong', { text: fmt(table) }), ' numbers, ', h('strong', { text: Math.round(table / total * 100) + '%' }), ' of all ', K.fmtCount(total), ' parameters in ' + p.name + '.' + (p.tied ? ' The same table is reused at the very end to produce the scores.' : '')));
    b.appendChild(h('p', { class: 'muted', text: p.arch === 'gpt2' ? 'Order is added as a learned position list: GPT-2 has ' + fmt(p.positions) + ' positions, which is why its context is limited to ' + fmt(p.positions) + ' tokens.' : 'Order is added inside attention using rotary position embeddings, which rotate the numbers according to each token\'s position.' }));
  }

  /* 5 layers */
  function renderLayers(c) {
    var b = els.layers.body; b.textContent = ''; var p = profile(), lp = K.layerParams(p), per = lp.attn + lp.mlp + lp.other;
    var n = Math.min(c.viewer.chunks.length, 12);
    b.appendChild(h('div', { class: 'me-tiles' }, stat('Layers', fmt(p.layers)), stat('Attention heads', fmt(p.heads) + (p.kvHeads !== p.heads ? ' (' + p.kvHeads + ' key/value sets)' : '')), stat('Width', fmt(p.hidden)), stat('Parameters', K.fmtCount(K.params(p)))));
    b.appendChild(h('p', { class: 'muted kt-hint', text: 'Who each token can look at. A filled square means the token on the row can use the token on the column. Rows can only look backwards.' }));
    var tbl = h('table', { class: 'aj-mask' }), head = h('tr', null, h('td'));
    c.viewer.chunks.slice(0, n).forEach(function (ch) { head.appendChild(h('th', { scope: 'col', title: ch.text, text: showTok(ch.text).slice(0, 5) })); });
    tbl.appendChild(head);
    c.viewer.chunks.slice(0, n).forEach(function (ch, r) {
      var tr = h('tr', null, h('th', { scope: 'row', title: ch.text, text: showTok(ch.text).slice(0, 5) }));
      for (var j = 0; j < n; j++) tr.appendChild(h('td', { class: j <= r ? 'aj-yes' : 'aj-no', 'aria-label': j <= r ? 'can look' : 'cannot look' }));
      tbl.appendChild(tr);
    });
    b.appendChild(h('div', { class: 'tk-scroll aj-maskwrap' }, tbl));
    if (p.kvHeads !== p.heads) b.appendChild(h('p', { class: 'muted', text: 'To save memory, the ' + p.heads + ' attention heads share ' + p.kvHeads + ' sets of keys and values (grouped-query attention).' }));
    var ap = Math.round(lp.attn / per * 100), mp = Math.round(lp.mlp / per * 100);
    b.appendChild(h('div', { class: 'aj-split', role: 'img', 'aria-label': 'Attention ' + ap + ' percent, feed-forward ' + mp + ' percent' }, h('span', { class: 'aj-c0', style: 'flex:' + lp.attn }), h('span', { class: 'aj-c1', style: 'flex:' + lp.mlp })));
    b.appendChild(h('p', null, 'In each ' + p.name + ' layer, ', h('strong', { text: ap + '%' }), ' of the parameters are in attention and ', h('strong', { text: mp + '%' }), ' are in the feed-forward network. After the last layer, only the final token\'s list is used to score the next token.'));
    els.layers.why.textContent = 'Attention moves information between tokens, but in ' + p.name + ' most of each layer\'s parameters (' + mp + '%) are in the feed-forward part.';
  }

  /* 6 scores */
  function renderScores() {
    var b = els.scores.body; b.textContent = '';
    b.appendChild(sourcePanel());
    var src = cur;
    if (!src) { b.appendChild(h('p', { class: 'muted', text: 'Loading the example data…' })); return; }
    var d = K.distribution(src.logits, { temperature: 1 }, src.order), top = src.order.slice(0, 12);
    var mass5 = 0, mass40 = 0; src.order.slice(0, 40).forEach(function (id, i) { mass40 += d.probs[id]; if (i < 5) mass5 += d.probs[id]; });
    b.appendChild(h('p', { class: 'muted kt-hint', text: 'Source: ' + src.label + '.' }));
    b.appendChild(h('div', { class: 'me-tiles' }, stat('Tokens scored', fmt(src.vocab)), stat('Top choice', pct(d.probs[top[0]])), stat('Top 5 together', pct(mass5)), stat('Top 40 together', pct(mass40)), stat('Effective choices', Math.exp(K.entropy(d)).toFixed(1))));
    b.appendChild(h('p', { class: 'muted kt-hint', text: '"Effective choices" is how many equally likely tokens would give the same uncertainty. A low number means the model is nearly sure.' }));
    b.appendChild(bars(top.map(function (id) { return { label: src.text(id), p: d.probs[id] }; })));
    if (src.ex) b.appendChild(h('p', { class: 'muted', text: src.ex.blurb + '.' }));
  }
  function sourcePanel() {
    var wrap = h('div', { class: 'aj-source' });
    var tabs = h('div', { class: 'kt-tabs', role: 'group', 'aria-label': 'Where the numbers come from' });
    [['example', 'Examples (no download)'], ['live', 'My prompt, live']].forEach(function (t) {
      tabs.appendChild(h('button', { type: 'button', class: 'btn ghost pc-sm', 'aria-pressed': S.source === t[0] ? 'true' : 'false', text: t[1], onclick: function () { S.source = t[0]; refreshDist(); } }));
    });
    wrap.appendChild(tabs);
    if (S.source === 'example') {
      var row = h('div', { class: 'aj-chips', role: 'group', 'aria-label': 'Example prompts' });
      (data ? data.prompts : []).forEach(function (ex) {
        row.appendChild(h('button', { type: 'button', class: 'bb-chip', 'aria-pressed': S.example === ex.id ? 'true' : 'false', onclick: function () { S.example = ex.id; loadExample(ex.id).then(refreshDist); } },
          h('strong', { text: ex.text.replace(/\n/g, '↵').slice(0, 34) }), h('small', { text: ex.tokens.length + ' tokens' })));
      });
      wrap.appendChild(row);
    } else wrap.appendChild(livePanel());
    return wrap;
  }

  /* live model panel */
  function livePanel() {
    var lv = S.live, box = h('div', { class: 'aj-live' });
    if (lv.state === 'idle' || lv.state === 'error') {
      var q = h('div', { class: 'aj-q', role: 'radiogroup', 'aria-label': 'Model quality' });
      Object.keys(L.QUALITY).forEach(function (k) {
        var x = L.QUALITY[k], size = k === 'small' && lv.device === 'webgpu' ? x.gpuSize : x.size;
        var r = h('input', { type: 'radio', name: 'ajq' }); r.checked = lv.quality === k; r.addEventListener('change', function () { lv.quality = k; renderScores(); });
        q.appendChild(h('label', { class: 'pc-check' }, r, h('span', null, h('strong', { text: x.label + ', ' + size }), x.approx ? ' Probabilities differ noticeably from the full model.' : ' Matches the full-precision model almost exactly.')));
      });
      box.appendChild(h('p', null, 'This runs ', h('strong', { text: 'SmolLM2 135M Instruct' }), ' (Apache-2.0) on your own device. Your prompt is never sent anywhere: only the model files (from Hugging Face) and the runtime (from jsDelivr) are downloaded, once, and your browser keeps them.'));
      box.appendChild(q);
      box.appendChild(h('p', { class: 'muted kt-hint', text: lv.device === 'webgpu' ? 'Your browser supports WebGPU, so the model runs on your graphics chip and falls back to the processor if needed.' : 'Your browser will run the model on the processor. It works everywhere but is slower, especially on phones, so a desktop is recommended.' }));
      if (lv.error) box.appendChild(h('p', { class: 'pc-error', text: lv.error }));
      box.appendChild(h('button', { type: 'button', class: 'btn solid', text: 'Download the model and run', onclick: startLive }));
    } else if (lv.state === 'loading') {
      var pr = lv.progress || { loaded: 0, total: 0 };
      var frac = pr.total ? Math.min(1, pr.loaded / pr.total) : 0;
      box.appendChild(h('p', { role: 'status', text: 'Downloading the model… ' + (pr.total ? (pr.loaded / 1e6).toFixed(0) + ' of ' + (pr.total / 1e6).toFixed(0) + ' MB' : 'starting') }));
      box.appendChild(h('div', { class: 'aj-ctx' }, h('span', { style: 'width:' + (frac * 100).toFixed(1) + '%' })));
    } else {
      var info = lv.info;
      box.appendChild(h('p', null, 'Model ready (' + (info.device === 'webgpu' ? 'graphics chip' : 'processor') + ', ' + info.dtype + '). ' + (info.approx ? 'This smaller version changes the probabilities noticeably. ' : '')));
      box.appendChild(h('div', { class: 'kt-row' }, h('button', { type: 'button', class: 'btn solid', text: 'Run my prompt', onclick: runLive }), lv.run ? h('span', { class: 'muted', text: 'Read ' + fmt(lv.run.ids.length) + ' tokens in ' + Math.round(lv.run.ms) + ' ms.' }) : null));
      if (lv.error) box.appendChild(h('p', { class: 'pc-error', text: lv.error }));
    }
    return box;
  }
  function startLive() {
    var lv = S.live; lv.state = 'loading'; lv.error = ''; lv.progress = { loaded: 0, total: 0 }; renderScores();
    var last = 0;
    L.load(P.tjs, { device: lv.device, quality: lv.quality }, function (e) { lv.progress = e; var now = Date.now(); if (now - last > 250) { last = now; renderScores(); } })
      .then(function (info) { lv.info = info; lv.state = 'ready'; return runLive(); })
      .catch(function (e) { lv.state = 'error'; lv.error = 'The model could not be loaded: ' + (e && e.message ? e.message : e) + ' If you are offline or the download is blocked, the examples above still work.'; renderScores(); });
  }
  function runLive() {
    var lv = S.live; lv.error = '';
    var p = K.profile('smollm2'), msgs = messages(), r = renderText(p, msgs);
    if (r.error) { lv.error = r.error; renderScores(); return Promise.resolve(); }
    var ids = L.encode(r.text);
    if (ids.length > 3000) { lv.error = 'This request is ' + fmt(ids.length) + ' tokens. The live demo is limited to 3,000, so shorten it.'; renderScores(); return Promise.resolve(); }
    return L.prefill(ids).then(function (st) {
      lv.run = { ids: ids, text: r.text, logits: st.logits, past: st.past, ms: st.ms, st: st };
      S.source = 'live'; S.gen = { running: false, stop: false, steps: [], ids: [], prefillMs: st.ms, decodeMs: [] };
      refreshAll();
    }).catch(function (e) { lv.error = 'Running the model failed: ' + (e && e.message ? e.message : e); renderScores(); });
  }

  /* 7 sampling */
  function renderSampling() {
    var b = els.sampling.body; if (!b.firstChild) buildSampling(b);
    var src = cur, out = els.sOut; out.textContent = '';
    if (!src) { out.appendChild(h('p', { class: 'muted', text: 'Waiting for data…' })); return; }
    var raw = K.distribution(src.logits, { temperature: 1 }, src.order), d = K.distribution(src.logits, S.settings, src.order);
    var top = src.order.slice(0, 12);
    out.appendChild(h('div', { class: 'me-tiles' }, stat('Tokens still possible', fmt(d.kept)), stat('Top choice', pct(d.probs[top[0]])), stat('Effective choices', Math.exp(K.entropy(d)).toFixed(1))));
    out.appendChild(h('p', { class: 'muted kt-hint', text: 'Faint bar: probability before your settings. Solid bar: after temperature, top-k, top-p and min-p (applied in that order).' }));
    out.appendChild(bars(top.map(function (id) { return { label: src.text(id), p: d.probs[id], ghost: raw.probs[id] }; })));
    var mass = 0; top.forEach(function (id) { mass += d.probs[id]; });
    if (mass < 0.995) out.appendChild(h('p', { class: 'muted kt-hint', text: 'These 12 tokens hold ' + pct(mass) + ' of the probability; the rest is spread over ' + fmt(Math.max(0, d.kept - 12)) + ' other tokens.' }));
    if (els.sDraw) els.sDraw.textContent = '';
  }
  function buildSampling(b) {
    els.sOut = h('div'); els.sDraw = h('div', { class: 'aj-draws' });
    var seed = h('input', { type: 'number', min: '0', step: '1', value: S.settings.seed, 'aria-label': 'Random seed' });
    seed.addEventListener('input', function () { S.settings.seed = Number(seed.value) || 0; S.rng = null; });
    var one = h('button', { type: 'button', class: 'btn solid pc-sm', text: 'Draw one token', onclick: function () { drawMany(1); } });
    var many = h('button', { type: 'button', class: 'btn ghost pc-sm', text: 'Draw 1,000 times', onclick: function () { drawMany(1000); } });
    b.appendChild(h('div', { class: 'aj-sliders' },
      slider('Temperature', 'temperature', 0, 2, 0.05, '0 always takes the top token. Higher values flatten the choice.'),
      slider('Top-k', 'topK', 0, 200, 1, 'Keep only the k most likely tokens. 0 turns it off.'),
      slider('Top-p', 'topP', 0.05, 1, 0.05, 'Keep the smallest set of tokens whose probabilities add up to p. 1 turns it off.'),
      slider('Min-p', 'minP', 0, 0.5, 0.01, 'Drop tokens less than this fraction as likely as the top token. 0 turns it off.')));
    b.appendChild(els.sOut);
    b.appendChild(h('div', { class: 'kt-row' }, one, many, h('label', { class: 'pc-field aj-seed' }, h('span', { text: 'Seed' }), seed)));
    b.appendChild(els.sDraw);
  }
  function drawMany(n) {
    var src = cur; if (!src) return;
    var d = K.distribution(src.logits, S.settings, src.order);
    if (!S.rng) S.rng = K.mulberry32(S.settings.seed);
    var counts = {}, i;
    for (i = 0; i < n; i++) { var id = K.draw(d, S.rng); counts[id] = (counts[id] || 0) + 1; }
    var box = els.sDraw; box.textContent = '';
    var ids = Object.keys(counts).map(Number).sort(function (a, b) { return counts[b] - counts[a]; });
    if (n === 1) { box.appendChild(h('p', { class: 'aj-callout' }, 'Drew ', h('strong', { text: '"' + showTok(src.text(ids[0])) + '"' }), ' (probability ' + pct(d.probs[ids[0]]) + '). Draw again: the same settings can give a different token.')); return; }
    box.appendChild(h('p', { class: 'muted kt-hint', text: n.toLocaleString() + ' draws. Solid bar: how often each token was drawn. Faint bar: its probability.' }));
    box.appendChild(bars(ids.slice(0, 10).map(function (id) { return { label: src.text(id), p: counts[id] / n, ghost: d.probs[id] }; })));
    if (ids.length > 10) box.appendChild(h('p', { class: 'muted kt-hint', text: 'Another ' + (ids.length - 10) + ' tokens were drawn at least once.' }));
  }

  /* 8 loop */
  function renderLoop(c) {
    var b = els.loop.body; b.textContent = ''; var p = profile(), n = c.viewer.total;
    var hw = K.HARDWARE.filter(function (x) { return x.id === S.hw; })[0], bytesW = K.weightBytes(p, S.bits);
    var sel = h('select', { 'aria-label': 'Memory speed example' }, K.HARDWARE.map(function (x) { return h('option', { value: x.id, selected: x.id === S.hw, text: x.name + ' (about ' + x.gbps + ' GB/s)' }); }));
    sel.addEventListener('change', function () { S.hw = sel.value; renderLoop(calc); });
    var bits = h('select', { 'aria-label': 'Precision' }, [[16, '16-bit'], [8, '8-bit'], [4, '4-bit']].map(function (x) { return h('option', { value: x[0], selected: x[0] === S.bits, text: x[1] }); }));
    bits.addEventListener('change', function () { S.bits = Number(bits.value); renderLoop(calc); });
    b.appendChild(h('div', { class: 'me-tiles' },
      stat('Reading your prompt (once)', K.fmtFlops(K.flops(p, n))), stat('Weights read per new token', K.fmtBytes(bytesW)),
      stat('Memory kept per token', K.fmtBytes(K.kvBytesPerToken(p, 2))), stat('Cache for your prompt', K.fmtBytes(K.kvBytesPerToken(p, 2) * n)),
      stat('Speed limit', Math.round(K.maxTokensPerSecond(p, S.bits, n, hw.gbps)).toLocaleString() + ' tokens/s')));
    b.appendChild(h('div', { class: 'kt-row aj-hw' }, h('label', { class: 'pc-field' }, h('span', { text: 'Weights stored as' }), bits), h('label', { class: 'pc-field' }, h('span', { text: 'Device memory speed' }), sel)));
    b.appendChild(h('p', { class: 'muted kt-hint', text: 'Prefill is about 2 operations per parameter per token, done for all prompt tokens at once, so it is limited by arithmetic. Each new token has to read every weight from memory once, so generation is limited by memory speed: tokens per second cannot exceed memory bandwidth divided by the bytes read. The speed figures are rough ceilings for illustration, not benchmarks, and ignore the extra cost of attention on long prompts.' }));
    if (p.note) b.appendChild(h('p', { class: 'muted kt-hint', text: p.note }));
    b.appendChild(S.source === 'live' && S.live.run ? liveGen() : exampleSteps());
  }
  function exampleSteps() {
    var box = h('div', { class: 'aj-steps' }), ex = data && data.prompts.filter(function (x) { return x.id === S.example; })[0];
    if (!ex) return box;
    box.appendChild(h('h3', { text: 'GPT-2 generating, one token at a time (greedy)' }));
    box.appendChild(h('p', { class: 'muted kt-hint', text: 'Pre-computed with GPT-2 on the prompt "' + ex.text.replace(/\n/g, '↵') + '". At each step the model picked its most likely token, added it to the text and ran again.' }));
    var text = ex.text;
    ex.steps.forEach(function (st, i) {
      var tok = data.vocabText[st.chosen];
      var items = st.top.map(function (t) { return { label: data.vocabText[t.id], p: t.p, on: t.id === st.chosen }; });
      box.appendChild(h('details', { class: 'aj-step', open: i < 3 }, h('summary', null, h('span', { class: 'aj-sn', text: 'Step ' + (i + 1) }), ' ', h('span', { class: 'aj-st' }, h('span', { class: 'muted', text: text.slice(-28).replace(/\n/g, '↵') }), h('mark', { class: 'aj-new', text: showTok(tok) })), h('span', { class: 'aj-sp2', text: pct(st.top[0].p) })), bars(items)));
      text += tok;
    });
    return box;
  }
  function liveGen() {
    var box = h('div', { class: 'aj-steps' }), g = S.gen, run = S.live.run, p = K.profile('smollm2');
    box.appendChild(h('h3', { text: 'SmolLM2 generating, live, with your settings from stage 7' }));
    var maxIn = h('input', { type: 'number', min: '1', max: '128', value: S.max, 'aria-label': 'Maximum new tokens' });
    maxIn.addEventListener('input', function () { S.max = Math.max(1, Math.min(128, Number(maxIn.value) || 40)); });
    var go = h('button', { type: 'button', class: 'btn solid', text: g.running ? 'Generating…' : (g.steps.length ? 'Generate again' : 'Generate'), disabled: g.running, onclick: generate });
    var stop = h('button', { type: 'button', class: 'btn ghost pc-sm', text: 'Stop', disabled: !g.running, onclick: function () { S.gen.stop = true; } });
    box.appendChild(h('div', { class: 'kt-row' }, go, stop, h('label', { class: 'pc-field aj-seed' }, h('span', { text: 'Max new tokens' }), maxIn)));
    if (g.steps.length) {
      var total = run.ids.length + g.steps.length, avg = g.decodeMs.length ? g.decodeMs.reduce(function (a, x) { return a + x; }, 0) / g.decodeMs.length : 0;
      box.appendChild(h('div', { class: 'aj-out', 'aria-live': 'polite' }, h('span', { class: 'muted', text: 'Answer: ' }), L.decode(g.ids.filter(function (i) { return i !== (S.live.info && S.live.info.eos); }))));
      box.appendChild(h('div', { class: 'me-tiles' }, stat('Prefill', Math.round(g.prefillMs) + ' ms'), stat('Per new token', avg ? Math.round(avg) + ' ms' : '—'), stat('Speed', avg ? (1000 / avg).toFixed(1) + ' tokens/s' : '—'), stat('Cache size now', K.fmtBytes(K.kvBytesPerToken(p, 2) * total)), stat('Tokens so far', fmt(total))));
      var list = h('div', { class: 'aj-steplist' });
      g.steps.forEach(function (st, i) {
        list.appendChild(h('div', { class: 'aj-row' }, h('span', { class: 'aj-sn', text: String(i + 1) }), h('mark', { class: 'aj-new', text: showTok(st.text) }), h('span', { class: 'muted', text: pct(st.p) + ' chosen · others: ' + st.alts.map(function (a) { return showTok(a.text) + ' ' + pct(a.p); }).join(', ') })));
      });
      box.appendChild(list);
    } else box.appendChild(h('p', { class: 'muted', text: 'Press Generate to watch the loop run on your device. Each row shows the token that was chosen, its probability and the next most likely tokens.' }));
    return box;
  }
  function generate() {
    var run = S.live.run, g = S.gen = { running: true, stop: false, steps: [], ids: [], prefillMs: run.ms, decodeMs: [] };
    S.rng = K.mulberry32(S.settings.seed);
    var eos = S.live.info.eos, st = { past: run.past, logits: run.logits }, total = run.ids.length;
    renderLoop(calc);
    function one(i) {
      if (g.stop || i >= S.max) { g.running = false; renderLoop(calc); renderStop(); return; }
      var order = K.sortedOrder(st.logits), raw = K.distribution(st.logits, { temperature: 1 }, order), d = K.distribution(st.logits, S.settings, order);
      var id = S.settings.temperature <= 0 ? order[0] : K.draw(d, S.rng);
      g.steps.push({ id: id, text: L.decode([id]), p: d.probs[id], pEos: raw.probs[eos] || 0, alts: order.slice(0, 4).filter(function (x) { return x !== id; }).slice(0, 3).map(function (x) { return { text: L.decode([x]), p: raw.probs[x] }; }) });
      g.ids.push(id);
      if (id === eos) { g.running = false; renderLoop(calc); renderStop(); return; }
      total += 1;
      L.step(st, id, total).then(function (nx) { st = nx; g.decodeMs.push(nx.ms); renderLoop(calc); setTimeout(function () { one(i + 1); }, 0); })
        .catch(function (e) { g.running = false; S.live.error = 'Generation stopped: ' + e.message; renderLoop(calc); });
    }
    one(0);
  }

  /* 9 stop */
  function renderStop() {
    var b = els.stop.body; b.textContent = ''; var p = profile();
    var series = null, label = '';
    if (S.source === 'live' && S.gen.steps.length) { series = S.gen.steps.map(function (s) { return s.pEos; }); label = 'SmolLM2, your prompt'; }
    else if (data) { var ex = data.prompts.filter(function (x) { return x.id === S.example; })[0]; if (ex) { series = ex.steps.map(function (s) { return s.pEos; }); label = 'GPT-2, example prompt'; } }
    if (series) {
      b.appendChild(h('p', { class: 'muted kt-hint', text: 'Probability of the end-of-text token at each step (' + label + '). It is usually tiny until the answer is complete.' }));
      b.appendChild(bars(series.map(function (v, i) { return { label: 'step ' + (i + 1), p: v }; })));
    }
    b.appendChild(h('ul', { class: 'aj-list' },
      h('li', null, h('strong', { text: 'End token: ' }), 'the model produces its end-of-turn marker (' + (p.chat === 'llama' ? '<|eot_id|>' : p.chat === 'gemma' ? '<end_of_turn>' : p.chat ? '<|im_end|>' : '<|endoftext|>') + ').'),
      h('li', null, h('strong', { text: 'Stop sequence: ' }), 'the app watches the output for a string you set and cuts the answer there.'),
      h('li', null, h('strong', { text: 'Maximum length: ' }), 'the app asked for at most N new tokens. If it is reached first, the answer is cut off mid-sentence.'),
      h('li', null, h('strong', { text: 'Context full: ' }), 'prompt plus answer cannot exceed ' + fmt(p.ctx) + ' tokens for ' + p.name + '.')));
  }

  /* 10 around */
  var aroundGen = 0;
  function renderAround(c) {
    var b = els.around.body; b.textContent = ''; var p = profile(), gen = ++aroundGen;
    b.appendChild(h('h3', { text: 'A tool call, written out' }));
    b.appendChild(h('p', { class: 'muted kt-hint', text: 'An example conversation about the weather, to show what the second request looks like after the model asks for a tool. It is separate from your prompt above.' }));
    var msgs = [{ role: 'system', content: 'You are a helpful assistant.' }, { role: 'user', content: 'What is the weather in Pune?' },
      { role: 'assistant', content: '', tool_calls: [{ function: { name: 'get_weather', arguments: { city: 'Pune' } } }] }, { role: 'tool', content: '{"temp_c": 29, "sky": "clear"}' }];
    if (!K.hasToolSection(p)) {
      b.appendChild(h('p', { class: 'pc-note', text: p.chat ? p.name + '\'s template has no tool section, so an app would describe the tool and the result in plain text. Switch to Qwen2.5 or Llama 3.1 above to see a template with tool support.' : 'GPT-2 is a base model without tools or a chat format.' }));
    } else {
      var r = renderText(p, msgs, { tools: [K.EXAMPLE_TOOL], addGen: true });
      b.appendChild(marked(r.text, p.specials.concat(['<tool_call>', '</tool_call>'])));
      b.appendChild(h('ol', { class: 'aj-list' },
        h('li', null, 'Request 1 contains the tool definition and the question. The model writes a tool call as text, then stops.'),
        h('li', null, 'The app spots the call, runs the real function, and adds the result to the conversation.'),
        h('li', null, 'Request 2 (above) contains everything again plus the call and the result. The model reads it all from the start and writes the final answer.')));
      countOnly(r.text, p.specials).then(function (n2) {
        if (gen !== aroundGen) return;
        b.appendChild(h('p', { class: 'aj-callout' }, 'Request 2 alone is about ', h('strong', { text: fmt(n2) }), ' tokens, and request 1 is nearly all of it again. Both are billed as input on hosted services, which is why tools make requests cost more.'));
      });
    }
    b.appendChild(h('h3', { text: 'The rest of the system' }));
    b.appendChild(h('ul', { class: 'aj-list' },
      h('li', null, h('strong', { text: 'Memory: ' }), 'none inside the model. Apps resend the conversation each time, or summarise it to save tokens.'),
      h('li', null, h('strong', { text: 'Retrieval: ' }), 'an app can search your documents first and paste the best passages into the prompt, as in stage 1.'),
      h('li', null, h('strong', { text: 'Prompt caching: ' }), 'some services reuse their work on a repeated start of the prompt, so keep the stable part first.'),
      h('li', null, h('strong', { text: 'Safety and limits: ' }), 'checks on the input and the output usually run outside the model, and the app enforces limits and billing.'),
      h('li', null, h('strong', { text: 'Billing: ' }), 'by tokens in and tokens out, with different prices for each. Use the ', h('a', { href: '/tools/token-counter/', text: 'token counter' }), ' to estimate cost.')));
  }

  /* ---------- request panel ---------- */
  function buildRequest() {
    var prof = h('select', { 'aria-label': 'Model' }, K.PROFILES.map(function (p) { return h('option', { value: p.id, text: p.name + ' (' + K.fmtCount(K.params(p)) + ' parameters)', selected: p.id === S.profile }); }));
    prof.addEventListener('change', function () { S.profile = prof.value; refreshAll(); });
    var sys = h('textarea', { rows: 2, spellcheck: 'false', 'aria-label': 'System prompt' }); sys.value = S.system;
    sys.addEventListener('input', function () { S.system = sys.value; schedule(); });
    var pr = h('textarea', { rows: 3, spellcheck: 'false', 'aria-label': 'Your prompt' }); pr.value = S.prompt;
    pr.addEventListener('input', function () { S.prompt = pr.value; schedule(); });
    var docT = h('textarea', { rows: 3, spellcheck: 'false', 'aria-label': 'Retrieved document' }); docT.value = S.docText;
    docT.addEventListener('input', function () { S.docText = docT.value; schedule(); });
    var tog = function (key, label) { var c = h('input', { type: 'checkbox' }); c.checked = S[key]; c.addEventListener('change', function () { S[key] = c.checked; refreshAll(); }); return h('label', { class: 'pc-check' }, c, label); };
    var samples = h('select', { 'aria-label': 'Load a sample prompt' }, h('option', { value: '', text: 'Load a sample prompt…' }),
      [['What is the capital of France?', 'English: capital of France'], ['भारत की राजधानी क्या है?', 'Hindi: capital of India'], ['Write a Python function that adds two numbers.', 'Code request'], ['Explain how a bank loan EMI is calculated.', 'Longer question']].map(function (x) { return h('option', { value: x[0], text: x[1] }); }));
    samples.addEventListener('change', function () { if (samples.value) { S.prompt = pr.value = samples.value; schedule(); } samples.value = ''; });
    return h('div', { class: 'pc-form aj-req' },
      h('div', { class: 'kt-grid' }, h('label', { class: 'pc-field' }, h('span', { text: 'Model to explain' }), prof), h('div', { class: 'pc-field' }, h('span', { text: 'Add to the request' }), tog('history', 'An earlier exchange'), tog('doc', 'A retrieved document'), tog('tool', 'A tool the model can call'))),
      h('label', { class: 'pc-field', style: 'margin-top:1rem' }, h('span', null, 'System prompt', h('small', { text: 'Instructions the app adds. Leave empty to use the model\'s default.' })), sys),
      h('label', { class: 'pc-field', style: 'margin-top:1rem' }, h('span', { text: 'Your prompt' }), pr), h('div', { class: 'kt-row' }, samples),
      h('label', { class: 'pc-field', style: 'margin-top:1rem' }, h('span', null, 'Retrieved document', h('small', { text: 'Used only when "A retrieved document" is ticked.' })), docT));
  }

  /* ---------- orchestration ---------- */
  function schedule() { clearTimeout(timer); timer = setTimeout(refreshAll, 250); }
  function refreshDist() { cur = currentSource(); renderScores(); renderSampling(); renderStop(); }
  function refreshAll() {
    var p = profile(), msgs = messages(), r = renderText(p, msgs);
    var specials = p.specials, text = r.text;
    var partTexts = [
      { name: 'System prompt', text: S.system.trim() || (p.chat === 'smollm' ? 'You are a helpful AI assistant named SmolLM, trained by Hugging Face' : p.chat === 'qwen' ? 'You are Qwen, created by Alibaba Cloud. You are a helpful assistant.' : ''), you: false },
      { name: 'Earlier conversation', text: S.history ? 'Hi, can you help me with a question? Of course. What would you like to know?' : '', you: false },
      { name: 'Retrieved document', text: S.doc ? 'Use this document to answer. ' + S.docText.trim() : '', you: false },
      { name: 'Tool definition', text: S.tool ? K.pyJson(K.EXAMPLE_TOOL) : '', you: false },
      { name: 'Your prompt', text: S.prompt, you: true }
    ];
    var job = Promise.resolve(tokenise(text, specials)).then(function (viewer) {
      return Promise.all(partTexts.map(function (x) { return countOnly(x.text, []); })).then(function (counts) {
        var sum = 0; partTexts.forEach(function (x, i) { x.n = counts[i]; sum += counts[i]; });
        var parts = partTexts.concat([{ name: 'Template markers', n: Math.max(0, viewer.total - sum), you: false }]);
        calc = { text: text, error: r.error, viewer: viewer, parts: parts, total: viewer.total, exact: viewer.exact };
      });
    });
    return Promise.all([job, loadData()]).then(function () {
      if (!logitsCache[S.example]) return loadExample(S.example);
    }).then(function () {
      renderRequest(calc); renderTemplate(calc); renderTokens(calc); renderEmbed(calc); renderLayers(calc); renderLoop(calc); renderAround(calc);
      refreshDist();
    }).catch(function (e) { rootEl.appendChild(h('p', { class: 'pc-error', text: 'Something went wrong: ' + e.message })); });
  }

  function build() {
    var short = ['Request', 'Template', 'Tokens', 'Embeddings', 'Layers', 'Scores', 'Sampling', 'Loop', 'Stopping', 'Around the model'];
    var nav = h('nav', { class: 'aj-nav', 'aria-label': 'Stages' }, STAGES.map(function (s, i) { return h('a', { href: '#aj-' + s[0], text: (i + 1) + '. ' + short[i] }); }));
    rootEl.textContent = '';
    rootEl.appendChild(buildRequest());
    rootEl.appendChild(nav);
    STAGES.forEach(function (s, i) { rootEl.appendChild(stageShell(i)); });
    rootEl.appendChild(h('p', { class: 'muted aj-foot' }, 'Numbers come from published model files and from real runs: GPT-2 small (MIT licence) and SmolLM2 135M Instruct (Apache-2.0). Hosted models such as Claude, GPT and Gemini are not shown because their internals are not published.'));
  }

  build();
  L.detect().then(function (d) { S.live.device = d; if (S.source === 'live') renderScores(); });
  refreshAll();
})();

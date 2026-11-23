/* How an AI model answers: core logic. Published model sizes and the maths that follows from them,
   exact chat templates for open models, token sampling (temperature, top-k, top-p, min-p) and a decoder
   for the pre-computed GPT-2 data. No DOM. Runs in the browser and in Node (for tests). */
(function (root) {
  'use strict';

  /* ---------- model profiles: numbers are the published configs of each open model ---------- */
  var PROFILES = [
    { id: 'smollm2', name: 'SmolLM2 135M Instruct', maker: 'Hugging Face', license: 'Apache-2.0', arch: 'llama', hf: 'HuggingFaceTB/SmolLM2-135M-Instruct',
      layers: 30, hidden: 576, heads: 9, kvHeads: 3, headDim: 64, ffn: 1536, vocab: 49152, ctx: 8192, tied: true, chat: 'smollm', live: true,
      specials: ['<|im_start|>', '<|im_end|>'] },
    { id: 'gpt2', name: 'GPT-2 small', maker: 'OpenAI', license: 'MIT', arch: 'gpt2', hf: 'openai-community/gpt2',
      layers: 12, hidden: 768, heads: 12, kvHeads: 12, headDim: 64, ffn: 3072, vocab: 50257, ctx: 1024, tied: true, chat: null, positions: 1024,
      specials: ['<|endoftext|>'] },
    { id: 'qwen', name: 'Qwen2.5 0.5B Instruct', maker: 'Alibaba Cloud', license: 'Apache-2.0', arch: 'llama', hf: 'Qwen/Qwen2.5-0.5B-Instruct',
      layers: 24, hidden: 896, heads: 14, kvHeads: 2, headDim: 64, ffn: 4864, vocab: 151936, ctx: 32768, tied: true, qkvBias: true, chat: 'qwen',
      specials: ['<|im_start|>', '<|im_end|>', '<tool_call>', '</tool_call>', '<tool_response>', '</tool_response>'] },
    { id: 'gemma', name: 'Gemma 3 270M Instruct', maker: 'Google', license: 'Gemma terms', hf: 'google/gemma-3-270m-it',
      arch: 'llama', layers: 18, hidden: 640, heads: 4, kvHeads: 1, headDim: 256, ffn: 2048, vocab: 262144, ctx: 32768, tied: true, qkNorm: true, extraNorms: 2, chat: 'gemma',
      specials: ['<bos>', '<start_of_turn>', '<end_of_turn>'], note: 'Most layers of Gemma 3 only look at a recent window of text, so its real memory use for a long prompt is lower than the figure shown.' },
    { id: 'llama', name: 'Llama 3.1 8B Instruct', maker: 'Meta', license: 'Llama 3.1 community licence', hf: 'meta-llama/Llama-3.1-8B-Instruct',
      arch: 'llama', layers: 32, hidden: 4096, heads: 32, kvHeads: 8, headDim: 128, ffn: 14336, vocab: 128256, ctx: 131072, tied: false, chat: 'llama',
      specials: ['<|begin_of_text|>', '<|start_header_id|>', '<|end_header_id|>', '<|eot_id|>'] }
  ];
  var byId = function (id) { return PROFILES.filter(function (p) { return p.id === id; })[0]; };

  /* ---------- size maths ---------- */
  /* Parameters in one layer, split into attention, feed-forward and the small rest (normalisation). */
  function layerParams(p) {
    var H = p.hidden, I = p.ffn;
    if (p.arch === 'gpt2') return { attn: H * 3 * H + 3 * H + H * H + H, mlp: H * 4 * H + 4 * H + 4 * H * H + H, other: 4 * H };
    var q = p.heads * p.headDim, kv = p.kvHeads * p.headDim;
    return { attn: H * q + 2 * H * kv + q * H + (p.qkvBias ? q + 2 * kv : 0), mlp: 3 * H * I, other: (2 + (p.extraNorms || 0)) * H + (p.qkNorm ? 2 * p.headDim : 0) };
  }
  function params(p) {
    var H = p.hidden, L = p.layers, V = p.vocab, lp = layerParams(p), per = lp.attn + lp.mlp + lp.other;
    if (p.arch === 'gpt2') return V * H + p.positions * H + L * per + 2 * H;
    var total = V * H + L * per + H;
    if (!p.tied) total += V * H;
    return total;
  }
  var weightBytes = function (p, bitsPerParam) { return params(p) * bitsPerParam / 8; };
  /* Memory the model keeps for each token it has already read: a key and a value per layer per head. */
  var kvBytesPerToken = function (p, bytesPerValue) { return 2 * p.layers * p.kvHeads * p.headDim * (bytesPerValue || 2); };
  /* Rule of thumb: about two arithmetic operations per parameter per token. Ignores attention's extra cost on long prompts. */
  var flops = function (p, tokens) { return 2 * params(p) * tokens; };
  var HARDWARE = [
    { id: 'phone', name: 'Phone', gbps: 50 },
    { id: 'laptop', name: 'Laptop', gbps: 100 },
    { id: 'gpu', name: 'Data-center GPU', gbps: 3000 }
  ];
  /* Generating a token reads every weight once, so memory speed caps the speed: tokens per second <= bandwidth / bytes read. */
  function maxTokensPerSecond(p, bits, kvTokens, gbps) {
    var bytes = weightBytes(p, bits) + kvBytesPerToken(p, 2) * (kvTokens || 0);
    return gbps * 1e9 / bytes;
  }

  /* ---------- formatting ---------- */
  function fmtBytes(n) {
    var u = ['B', 'KB', 'MB', 'GB', 'TB'], i = 0;
    while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
    return (n >= 100 || i === 0 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)) + ' ' + u[i];
  }
  function fmtCount(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 1 : 2) + ' billion';
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e8 ? 0 : 1) + ' million';
    return Math.round(n).toLocaleString();
  }
  function fmtFlops(n) {
    var u = ['', 'K', 'M', 'G', 'T', 'P'], i = 0;
    while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
    return (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)) + ' ' + u[i] + 'FLOPs';
  }

  /* ---------- Python-style JSON (the formatting chat templates use for tool definitions) ---------- */
  function pyJson(v, indent, level) {
    level = level || 0;
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string') return JSON.stringify(v);
    var pad = indent ? '\n' + new Array((level + 1) * indent + 1).join(' ') : '', end = indent ? '\n' + new Array(level * indent + 1).join(' ') : '';
    var sep = indent ? ',' + pad : ', ';
    if (Array.isArray(v)) return v.length ? '[' + pad + v.map(function (x) { return pyJson(x, indent, level + 1); }).join(sep) + end + ']' : '[]';
    var keys = Object.keys(v);
    return keys.length ? '{' + pad + keys.map(function (k) { return JSON.stringify(k) + ': ' + pyJson(v[k], indent, level + 1); }).join(sep) + end + '}' : '{}';
  }
  var trim = function (s) { return String(s).replace(/^\s+|\s+$/g, ''); };

  /* ---------- chat templates ----------
     messages: [{role:'system'|'user'|'assistant'|'tool', content, tool_calls?:[{function:{name,arguments}}]}]
     Each renderer reproduces the model's published chat template exactly. */
  function renderSmollm(msgs, o) {
    var s = '';
    msgs.forEach(function (m, i) {
      if (i === 0 && m.role !== 'system') s += '<|im_start|>system\nYou are a helpful AI assistant named SmolLM, trained by Hugging Face<|im_end|>\n';
      s += '<|im_start|>' + m.role + '\n' + m.content + '<|im_end|>\n';
    });
    return s + (o.addGen ? '<|im_start|>assistant\n' : '');
  }
  function renderQwen(msgs, o) {
    var s = '', tools = o.tools && o.tools.length ? o.tools : null, first = msgs[0] && msgs[0].role === 'system';
    var sys = first ? msgs[0].content : 'You are Qwen, created by Alibaba Cloud. You are a helpful assistant.';
    if (tools) {
      s += '<|im_start|>system\n' + sys + '\n\n# Tools\n\nYou may call one or more functions to assist with the user query.\n\nYou are provided with function signatures within <tools></tools> XML tags:\n<tools>';
      tools.forEach(function (t) { s += '\n' + pyJson(t); });
      s += '\n</tools>\n\nFor each function call, return a json object with function name and arguments within <tool_call></tool_call> XML tags:\n<tool_call>\n{"name": <function-name>, "arguments": <args-json-object>}\n</tool_call><|im_end|>\n';
    } else s += '<|im_start|>system\n' + sys + '<|im_end|>\n';
    msgs.forEach(function (m, i) {
      var calls = m.tool_calls && m.tool_calls.length;
      if (m.role === 'user' || (m.role === 'system' && i > 0) || (m.role === 'assistant' && !calls)) s += '<|im_start|>' + m.role + '\n' + m.content + '<|im_end|>\n';
      else if (m.role === 'assistant') {
        s += '<|im_start|>assistant';
        if (m.content) s += '\n' + m.content;
        m.tool_calls.forEach(function (tc) { var f = tc.function || tc; s += '\n<tool_call>\n{"name": "' + f.name + '", "arguments": ' + pyJson(f.arguments) + '}\n</tool_call>'; });
        s += '<|im_end|>\n';
      } else if (m.role === 'tool') {
        if (i === 0 || msgs[i - 1].role !== 'tool') s += '<|im_start|>user';
        s += '\n<tool_response>\n' + m.content + '\n</tool_response>';
        if (i === msgs.length - 1 || msgs[i + 1].role !== 'tool') s += '<|im_end|>\n';
      }
    });
    return s + (o.addGen ? '<|im_start|>assistant\n' : '');
  }
  function renderGemma(msgs, o) {
    var s = '<bos>', prefix = '', rest = msgs;
    if (msgs[0] && msgs[0].role === 'system') { prefix = msgs[0].content + '\n\n'; rest = msgs.slice(1); }
    rest.forEach(function (m, i) {
      if ((m.role === 'user') !== (i % 2 === 0)) throw new Error('Gemma needs the conversation to alternate user, assistant, user, assistant.');
      s += '<start_of_turn>' + (m.role === 'assistant' ? 'model' : m.role) + '\n' + (i === 0 ? prefix : '') + trim(m.content) + '<end_of_turn>\n';
    });
    return s + (o.addGen ? '<start_of_turn>model\n' : '');
  }
  function renderLlama(msgs, o) {
    var tools = o.tools && o.tools.length ? o.tools : null, date = o.date || '26 Jul 2024', s = '<|begin_of_text|>', rest = msgs, sys = '';
    if (msgs[0] && msgs[0].role === 'system') { sys = trim(msgs[0].content); rest = msgs.slice(1); }
    s += '<|start_header_id|>system<|end_header_id|>\n\n';
    if (tools) s += 'Environment: ipython\n';
    s += 'Cutting Knowledge Date: December 2023\nToday Date: ' + date + '\n\n' + sys + '<|eot_id|>';
    if (tools) {
      if (!rest.length) throw new Error('Llama puts tool definitions in the first user message, so add a user message.');
      var first = trim(rest[0].content); rest = rest.slice(1);
      s += '<|start_header_id|>user<|end_header_id|>\n\nGiven the following functions, please respond with a JSON for a function call with its proper arguments that best answers the given prompt.\n\nRespond in the format {"name": function name, "parameters": dictionary of argument name and its value}.Do not use variables.\n\n';
      tools.forEach(function (t) { s += pyJson(t, 4) + '\n\n'; });
      s += first + '<|eot_id|>';
    }
    rest.forEach(function (m) {
      if (m.tool_calls && m.tool_calls.length) {
        var f = m.tool_calls[0].function || m.tool_calls[0];
        s += '<|start_header_id|>assistant<|end_header_id|>\n\n{"name": "' + f.name + '", "parameters": ' + pyJson(f.arguments) + '}<|eot_id|>';
      } else if (m.role === 'tool' || m.role === 'ipython') s += '<|start_header_id|>ipython<|end_header_id|>\n\n' + pyJson(m.content) + '<|eot_id|>';
      else s += '<|start_header_id|>' + m.role + '<|end_header_id|>\n\n' + trim(m.content) + '<|eot_id|>';
    });
    return s + (o.addGen ? '<|start_header_id|>assistant<|end_header_id|>\n\n' : '');
  }
  /* For models whose template has no tool section, an app has to describe tools in ordinary text. */
  function toolsAsText(tools) {
    return 'You can call these tools. To call one, reply with JSON like {"name": ..., "arguments": {...}}.\n' + tools.map(function (t) { return pyJson(t); }).join('\n');
  }
  function renderChat(p, msgs, o) {
    o = Object.assign({ addGen: true }, o || {});
    if (!p.chat) return msgs.filter(function (m) { return m.role === 'user'; }).map(function (m) { return m.content; }).join('\n');
    var ms = msgs.slice();
    if ((p.chat === 'smollm' || p.chat === 'gemma') && o.tools && o.tools.length) {
      var t = toolsAsText(o.tools);
      if (ms[0] && ms[0].role === 'system') ms[0] = { role: 'system', content: ms[0].content + '\n\n' + t };
      else ms.unshift({ role: 'system', content: t });
      o = Object.assign({}, o, { tools: null });
    }
    return ({ smollm: renderSmollm, qwen: renderQwen, gemma: renderGemma, llama: renderLlama })[p.chat](ms, o);
  }
  var hasToolSection = function (p) { return p.chat === 'qwen' || p.chat === 'llama'; };

  /* Splits rendered text into runs of special markers and ordinary text. */
  function splitSpecials(text, specials) {
    if (!specials || !specials.length) return [{ text: text, special: false }];
    var re = new RegExp('(' + specials.slice().sort(function (a, b) { return b.length - a.length; }).map(function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'g');
    return text.split(re).filter(function (x) { return x !== ''; }).map(function (x) { return { text: x, special: specials.indexOf(x) >= 0 }; });
  }

  /* ---------- sampling ---------- */
  function sortedOrder(logits) {
    var idx = new Uint32Array(logits.length); for (var i = 0; i < idx.length; i++) idx[i] = i;
    return Array.prototype.slice.call(idx).sort(function (a, b) { return logits[b] - logits[a] || a - b; });
  }
  /* The order models apply: temperature, then top-k, then top-p, then min-p. Returns probabilities over the whole vocabulary. */
  function distribution(logits, o, order) {
    o = o || {}; var n = logits.length, T = o.temperature == null ? 1 : o.temperature;
    order = order || sortedOrder(logits);
    var probs = new Float64Array(n);
    if (T <= 0) { probs[order[0]] = 1; return { probs: probs, kept: 1, order: order }; }
    var keep = o.topK > 0 ? Math.min(o.topK, n) : n;
    var scaled = function (i) { return logits[i] / T; };
    var max = scaled(order[0]), sum = 0, j;
    for (j = 0; j < keep; j++) { var e = Math.exp(scaled(order[j]) - max); probs[order[j]] = e; sum += e; }
    for (j = 0; j < keep; j++) probs[order[j]] /= sum;
    if (o.topP > 0 && o.topP < 1) {
      var cum = 0, cut = keep;
      for (j = 0; j < keep; j++) { if (cum >= o.topP) { cut = j; break; } cum += probs[order[j]]; }
      for (j = cut; j < keep; j++) probs[order[j]] = 0;
      keep = Math.max(1, cut);
      sum = 0; for (j = 0; j < keep; j++) sum += probs[order[j]];
      for (j = 0; j < keep; j++) probs[order[j]] /= sum;
    }
    if (o.minP > 0) {
      var thr = o.minP * probs[order[0]], k2 = keep;
      for (j = 0; j < keep; j++) if (probs[order[j]] < thr) { k2 = j; break; }
      for (j = k2; j < keep; j++) probs[order[j]] = 0;
      keep = Math.max(1, k2);
      sum = 0; for (j = 0; j < keep; j++) sum += probs[order[j]];
      for (j = 0; j < keep; j++) probs[order[j]] /= sum;
    }
    return { probs: probs, kept: keep, order: order };
  }
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  /* Draws one token id from a distribution made by distribution(). */
  function draw(dist, rng) {
    var r = rng(), cum = 0, order = dist.order, last = order[0];
    for (var j = 0; j < dist.kept; j++) { var id = order[j]; cum += dist.probs[id]; last = id; if (r < cum) return id; }
    return last;
  }
  function entropy(dist) {
    var h = 0; for (var j = 0; j < dist.kept; j++) { var p = dist.probs[dist.order[j]]; if (p > 0) h -= p * Math.log(p); }
    return h;
  }

  /* ---------- pre-computed data ---------- */
  function f16ToF32(h) {
    var s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1f, f = h & 0x3ff;
    if (e === 0) return s * Math.pow(2, -14) * (f / 1024);
    if (e === 31) return f ? NaN : s * Infinity;
    return s * Math.pow(2, e - 15) * (1 + f / 1024);
  }
  function decodeF16(buffer) {
    var u = new Uint16Array(buffer), out = new Float32Array(u.length);
    for (var i = 0; i < u.length; i++) out[i] = f16ToF32(u[i]);
    return out;
  }

  /* ---------- example tool used by the page ---------- */
  var EXAMPLE_TOOL = { type: 'function', function: { name: 'get_weather', description: 'Get the current weather for a city.', parameters: { type: 'object', properties: { city: { type: 'string', description: 'City name' } }, required: ['city'] } } };

  var api = {
    PROFILES: PROFILES, HARDWARE: HARDWARE, EXAMPLE_TOOL: EXAMPLE_TOOL, profile: byId,
    params: params, layerParams: layerParams, weightBytes: weightBytes, kvBytesPerToken: kvBytesPerToken, flops: flops, maxTokensPerSecond: maxTokensPerSecond,
    fmtBytes: fmtBytes, fmtCount: fmtCount, fmtFlops: fmtFlops,
    pyJson: pyJson, renderChat: renderChat, hasToolSection: hasToolSection, splitSpecials: splitSpecials,
    sortedOrder: sortedOrder, distribution: distribution, mulberry32: mulberry32, draw: draw, entropy: entropy,
    decodeF16: decodeF16, f16ToF32: f16ToF32
  };
  root.KJAI = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

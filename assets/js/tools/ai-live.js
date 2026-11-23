/* How an AI model answers: the live model (level C). Loads SmolLM2-135M-Instruct in the browser with
   transformers.js and exposes a forward loop that returns the real scores for the next token.
   Loaded on demand. The prompt never leaves the browser; only model files and the runtime are downloaded. */
(function (root) {
  'use strict';

  var MODEL = 'HuggingFaceTB/SmolLM2-135M-Instruct';
  /* Sizes are the sizes of the ONNX files on the model page. The 16-bit model matches the full-precision
     reference almost exactly. The smaller 8-bit and 4-bit models change the probabilities noticeably. */
  var QUALITY = {
    accurate: { dtype: 'fp16', size: '270 MB', label: 'Accurate (16-bit)', approx: false },
    small: { dtype: 'q8', gpuDtype: 'q4f16', size: '137 MB', gpuSize: '118 MB', label: 'Smaller (8-bit), less accurate', approx: true }
  };
  var lib = null, tokenizer = null, model = null, current = null;

  function detect() {
    if (root.navigator && navigator.gpu && navigator.gpu.requestAdapter) {
      return navigator.gpu.requestAdapter().then(function (a) { return a ? 'webgpu' : 'wasm'; }, function () { return 'wasm'; });
    }
    return Promise.resolve('wasm');
  }

  function pick(device, quality) {
    var q = QUALITY[quality] || QUALITY.accurate;
    return { device: device === 'webgpu' ? 'webgpu' : 'wasm', dtype: device === 'webgpu' && q.gpuDtype ? q.gpuDtype : q.dtype, approx: q.approx };
  }
  /* Loads the library, tokenizer and model. onProgress({loaded,total,file}) reports bytes downloaded.
     If the graphics chip cannot run the model, it falls back to the CPU. */
  function load(libUrl, opts, onProgress) {
    var files = {};
    var report = function (e) {
      if (!e || !e.file) return;
      if (e.status === 'progress' || e.status === 'download' || e.status === 'initiate') {
        var f = files[e.file] || (files[e.file] = { loaded: 0, total: 0 });
        if (typeof e.loaded === 'number') f.loaded = e.loaded;
        if (typeof e.total === 'number') f.total = e.total;
      } else if (e.status === 'done' && files[e.file]) files[e.file].loaded = files[e.file].total;
      var loaded = 0, total = 0; Object.keys(files).forEach(function (k) { loaded += files[k].loaded; total += files[k].total; });
      if (onProgress) onProgress({ loaded: loaded, total: total, file: e.file, status: e.status });
    };
    var choice = pick(opts && opts.device, opts && opts.quality);
    var fromPretrained = function (c) { return lib.AutoModelForCausalLM.from_pretrained(MODEL, { dtype: c.dtype, device: c.device, progress_callback: report }); };
    return import(libUrl).then(function (m) {
      lib = m; lib.env.allowLocalModels = false;
      return lib.AutoTokenizer.from_pretrained(MODEL, { progress_callback: report });
    }).then(function (t) {
      tokenizer = t;
      return fromPretrained(choice).catch(function (err) {
        if (choice.device !== 'webgpu') throw err;
        choice = pick('wasm', opts && opts.quality);
        return fromPretrained(choice);
      });
    }).then(function (m) {
      model = m; current = choice;
      var eos = tokenizer.encode('<|im_end|>', { add_special_tokens: false });
      return { device: choice.device, dtype: choice.dtype, approx: choice.approx, eos: Array.isArray(eos) ? eos[0] : Number(eos.data ? eos.data[0] : eos) };
    });
  }

  var ready = function () { return !!(model && tokenizer); };
  function encode(text) {
    var ids = tokenizer.encode(text, { add_special_tokens: false });
    return Array.from(ids, Number);
  }
  var decode = function (ids) { return tokenizer.decode(ids, { skip_special_tokens: false }); };

  var tensor = function (arr) { return new lib.Tensor('int64', BigInt64Array.from(arr.map(BigInt)), [1, arr.length]); };
  /* last row of the scores tensor as a plain Float32Array */
  function lastRow(t) {
    var read = function (d) { var v = t.dims[2], n = t.dims[1]; return Float32Array.from(d.subarray((n - 1) * v, n * v)); };
    var cpu = (t.location === undefined || t.location === 'cpu');
    return (cpu ? Promise.resolve(t.data) : t.getData()).then(function (d) { var r = read(d); if (t.dispose) { try { t.dispose(); } catch (e) { /* already released */ } } return r; });
  }
  /* forward() returns the new cache as raw "present.*" tensors; they become the "past_key_values.*" inputs of the next call */
  function toPast(out) {
    var past = Object.create(null);
    Object.keys(out).forEach(function (n) { if (n.indexOf('present') === 0) past[n.replace('present', 'past_key_values')] = out[n]; });
    return past;
  }
  function release(past) {
    if (!past) return;
    Object.keys(past).forEach(function (k) { var t = past[k]; if (t && t.dispose) { try { t.dispose(); } catch (e) { /* already released */ } } });
  }
  function run(ids, past, total) {
    var t0 = performance.now();
    return model({ input_ids: tensor(ids), attention_mask: tensor(new Array(total).fill(1)), past_key_values: past }).then(function (out) {
      return lastRow(out.logits).then(function (logits) {
        if (past) release(past);
        return { past: toPast(out), logits: logits, ms: performance.now() - t0 };
      });
    });
  }
  /* reads the whole prompt in one pass (prefill) */
  var prefill = function (ids) { return run(ids, null, ids.length); };
  /* feeds one new token and returns the scores for the one after it (decode) */
  var step = function (state, id, totalLength) { return run([id], state.past, totalLength); };

  root.KJLive = { MODEL: MODEL, QUALITY: QUALITY, detect: detect, load: load, ready: ready, encode: encode, decode: decode, prefill: prefill, step: step, info: function () { return current; } };
})(typeof window !== 'undefined' ? window : globalThis);

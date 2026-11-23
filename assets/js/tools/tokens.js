/* Token counter: core logic. Text statistics that work for Indian scripts, script detection,
   text hygiene checks, cost maths, and the two provider "count tokens" API calls.
   No DOM. Runs in the browser and in Node (for tests). Nothing is sent anywhere unless a count
   is explicitly requested with the visitor's own API key. */
(function (root) {
  'use strict';

  /* ---------- scripts ---------- */
  var SCRIPTS = [
    ['Latin', 'Latin', 'English, Hinglish and other romanised text'],
    ['Devanagari', 'Devanagari', 'Hindi, Marathi, Nepali, Sanskrit, Konkani'],
    ['Bengali', 'Bengali', 'Bengali, Assamese'],
    ['Gurmukhi', 'Gurmukhi', 'Punjabi'],
    ['Gujarati', 'Gujarati', 'Gujarati'],
    ['Oriya', 'Odia', 'Odia'],
    ['Tamil', 'Tamil', 'Tamil'],
    ['Telugu', 'Telugu', 'Telugu'],
    ['Kannada', 'Kannada', 'Kannada'],
    ['Malayalam', 'Malayalam', 'Malayalam'],
    ['Sinhala', 'Sinhala', 'Sinhala'],
    ['Arabic', 'Arabic', 'Urdu, Arabic, Persian, Sindhi, Kashmiri'],
    ['Han', 'Chinese (Han)', 'Chinese, Japanese kanji'],
    ['Hiragana', 'Hiragana', 'Japanese'],
    ['Katakana', 'Katakana', 'Japanese'],
    ['Hangul', 'Hangul', 'Korean'],
    ['Cyrillic', 'Cyrillic', 'Russian, Ukrainian and others'],
    ['Greek', 'Greek', 'Greek'],
    ['Hebrew', 'Hebrew', 'Hebrew'],
    ['Thai', 'Thai', 'Thai']
  ];
  var SCRIPT_RE = SCRIPTS.map(function (s) { return [new RegExp('[\\p{L}\\p{M}]', 'u'), new RegExp('\\p{Script=' + s[0] + '}', 'u'), s[1], s[2]]; });
  var DIGIT = /\p{Nd}/u, INVISIBLE = /\p{Cf}/u, SPACE = /\s/u, LETTER_OR_MARK = /[\p{L}\p{M}]/u;

  function scriptOf(ch) {
    if (SPACE.test(ch)) return null;
    if (LETTER_OR_MARK.test(ch)) {
      for (var i = 0; i < SCRIPT_RE.length; i++) if (SCRIPT_RE[i][1].test(ch)) return SCRIPT_RE[i][2];
      return 'Other letters';
    }
    if (DIGIT.test(ch)) return 'Digits';
    if (INVISIBLE.test(ch)) return 'Invisible characters';
    return 'Punctuation and symbols';
  }

  function segments(text, granularity) {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) return Array.from(new Intl.Segmenter(undefined, { granularity: granularity }).segment(text));
    return null;
  }

  /* ---------- statistics ---------- */
  function analyse(text) {
    text = String(text || '');
    var cps = Array.from(text);
    var g = segments(text, 'grapheme'), w = segments(text, 'word');
    var graphemes = g ? g.filter(function (s) { return !/^\s+$/u.test(s.segment); }).length : cps.filter(function (c) { return !SPACE.test(c); }).length;
    var words = w ? w.filter(function (s) { return s.isWordLike; }).length : (text.match(/\S+/g) || []).length;
    var bytes = (typeof TextEncoder !== 'undefined') ? new TextEncoder().encode(text).length : unescape(encodeURIComponent(text)).length;
    var counts = {}, total = 0;
    cps.forEach(function (c) { var s = scriptOf(c); if (!s) return; counts[s] = (counts[s] || 0) + 1; total++; });
    var scripts = Object.keys(counts).map(function (k) { return { name: k, count: counts[k], pct: total ? counts[k] * 100 / total : 0 }; })
      .sort(function (a, b) { return b.count - a.count; });
    var lines = text ? text.split(/\r\n|\r|\n/).length : 0;
    return { chars: cps.length, graphemes: graphemes, words: words, bytes: bytes, lines: lines, scripts: scripts, nonSpace: total, hygiene: hygiene(text, cps), hint: hint(scripts) };
  }

  function hint(scripts) {
    var main = scripts.filter(function (s) { return ['Digits', 'Punctuation and symbols', 'Invisible characters', 'Other letters'].indexOf(s.name) < 0; })[0];
    if (!main) return null;
    var row = SCRIPTS.filter(function (s) { return s[1] === main.name; })[0];
    if (!row) return null;
    if (main.name === 'Latin') return 'Mostly Latin letters. Romanised Hindi, Tamil and similar ("Hinglish") look like English here. Compare it with the native-script version, because the token counts can differ a lot.';
    return 'Mostly ' + main.name + ' script (' + row[2] + ').';
  }

  /* ---------- hygiene ---------- */
  function hygiene(text, cps) {
    var out = [];
    if (!text) return out;
    var nfc = text.normalize('NFC');
    if (nfc !== text) out.push({ level: 'warn', id: 'nfc', text: 'This text is not in the standard Unicode form (NFC).', detail: 'The same letters can be stored in more than one way, and the form changes the token count. Converting to NFC makes counts consistent. Characters before: ' + cps.length + ', after: ' + Array.from(nfc).length + '.' });
    var bad = { '​': 'zero-width space', '﻿': 'byte order mark', '⁠': 'word joiner', '­': 'soft hyphen' }, found = {};
    cps.forEach(function (c) { if (bad[c]) found[bad[c]] = (found[bad[c]] || 0) + 1; else if (/[‪-‮⁦-⁩]/.test(c)) found['text-direction control'] = (found['text-direction control'] || 0) + 1; });
    Object.keys(found).forEach(function (k) { out.push({ level: 'warn', id: 'invisible', text: found[k] + ' invisible ' + k + ' character' + (found[k] > 1 ? 's' : '') + ' found.', detail: 'Invisible characters usually come from copy and paste. They add tokens and can change meaning. Remove them unless you need them.' }); });
    var zwj = cps.filter(function (c) { return c === '‍' || c === '‌'; }).length;
    if (zwj) out.push({ level: 'info', id: 'zwj', text: zwj + ' zero-width joiner or non-joiner character' + (zwj > 1 ? 's' : '') + '.', detail: 'These are normal in Indian-language text (they control how letters join), so they are counted, not flagged as a problem.' });
    var mixed = (text.match(/[\p{L}\p{M}]+/gu) || []).filter(function (wd) { return /\p{Script=Latin}/u.test(wd) && /[\p{Script=Cyrillic}\p{Script=Greek}]/u.test(wd); });
    if (mixed.length) out.push({ level: 'warn', id: 'lookalike', text: mixed.length + ' word' + (mixed.length > 1 ? 's mix' : ' mixes') + ' Latin letters with Cyrillic or Greek look-alikes.', detail: 'For example "' + mixed[0] + '". Look-alike letters tokenize very differently and often come from copy and paste.' });
    if (/^\s|\s$/.test(text)) out.push({ level: 'info', id: 'edge-space', text: 'The text starts or ends with whitespace.', detail: 'It is counted. Trim it if it is not needed.' });
    return out;
  }

  /* ---------- tokens per unit, cost ---------- */
  function ratios(tokens, stats) {
    return {
      perWord: stats.words ? tokens / stats.words : null,
      perChar: stats.graphemes ? tokens / stats.graphemes : null,
      perByte: stats.bytes ? tokens / stats.bytes : null
    };
  }
  function cost(tokens, pricePerMillion) {
    var p = Number(pricePerMillion);
    if (!isFinite(p) || p <= 0 || tokens == null) return null;
    return tokens / 1e6 * p;
  }
  function money(v) {
    if (v == null) return '';
    if (v === 0) return '$0';
    if (v < 0.0001) return '< $0.0001';
    return '$' + (v < 0.01 ? v.toFixed(5) : v < 1 ? v.toFixed(4) : v.toFixed(2));
  }

  /* ---------- viewer chunks ---------- */
  /* Groups token ids into readable chunks. A token can end in the middle of a character, so tokens
     are joined until the text decodes cleanly. decodeOne(id) returns the text of one token. */
  function chunks(ids, decodeOne, max) {
    var out = [], i = 0, n = Math.min(ids.length, max || 4000);
    while (i < n) {
      var group = [ids[i]], text = decodeOne(ids[i]);
      i++;
      while (text.indexOf('�') >= 0 && i < n && group.length < 8) { group.push(ids[i]); text += decodeOne(ids[i]); i++; }
      out.push({ ids: group, text: text, partial: text.indexOf('�') >= 0 });
    }
    return { chunks: out, shown: n, total: ids.length };
  }

  /* ---------- provider count APIs (called only when asked, with the visitor's key) ---------- */
  var ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages/count_tokens';
  function apiError(res, body, who) {
    var m = body && body.error && (body.error.message || body.error.status);
    return new Error(who + ' said: ' + (m || ('HTTP ' + res.status)));
  }
  function countClaude(key, model, text, f) {
    f = f || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);
    if (!key) return Promise.reject(new Error('Add an Anthropic API key first.'));
    if (!text || !text.trim()) return Promise.reject(new Error('Claude cannot count empty text.'));
    return f(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: model, messages: [{ role: 'user', content: text }] })
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (b) {
        if (!res.ok) throw apiError(res, b, 'Anthropic');
        if (!b || typeof b.input_tokens !== 'number') throw new Error('Anthropic returned an unexpected response.');
        return b.input_tokens;
      });
    });
  }
  function countGemini(key, model, text, f) {
    f = f || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);
    if (!key) return Promise.reject(new Error('Add a Gemini API key first.'));
    if (!text || !text.trim()) return Promise.reject(new Error('Gemini cannot count empty text.'));
    var id = String(model).replace(/^models\//, '');
    return f('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(id) + ':countTokens', {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: text }] }] })
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (b) {
        if (!res.ok) throw apiError(res, b, 'Google');
        if (!b || typeof b.totalTokens !== 'number') throw new Error('Google returned an unexpected response.');
        return b.totalTokens;
      });
    });
  }

  /* ---------- samples: the same sentence in many languages (written for token comparison, not as reference translations) ---------- */
  var SAMPLES = [
    { id: 'en', name: 'English', text: 'Please summarise this document in three short points for a customer.' },
    { id: 'hi', name: 'Hindi', text: 'कृपया इस दस्तावेज़ को ग्राहक के लिए तीन छोटे बिंदुओं में सारांशित करें।' },
    { id: 'mr', name: 'Marathi', text: 'कृपया हा दस्तऐवज ग्राहकासाठी तीन छोट्या मुद्द्यांमध्ये थोडक्यात सांगा.' },
    { id: 'gu', name: 'Gujarati', text: 'કૃપા કરીને આ દસ્તાવેજનો ગ્રાહક માટે ત્રણ ટૂંકા મુદ્દાઓમાં સારાંશ આપો.' },
    { id: 'bn', name: 'Bengali', text: 'অনুগ্রহ করে এই নথিটি একজন গ্রাহকের জন্য তিনটি ছোট পয়েন্টে সংক্ষেপে লিখুন।' },
    { id: 'ta', name: 'Tamil', text: 'தயவுசெய்து இந்த ஆவணத்தை வாடிக்கையாளருக்காக மூன்று சிறிய குறிப்புகளில் சுருக்கமாகக் கூறுங்கள்.' },
    { id: 'te', name: 'Telugu', text: 'దయచేసి ఈ పత్రాన్ని కస్టమర్ కోసం మూడు చిన్న అంశాలలో సంక్షిప్తంగా చెప్పండి.' },
    { id: 'kn', name: 'Kannada', text: 'ದಯವಿಟ್ಟು ಈ ದಾಖಲೆಯನ್ನು ಗ್ರಾಹಕರಿಗಾಗಿ ಮೂರು ಸಣ್ಣ ಅಂಶಗಳಲ್ಲಿ ಸಂಕ್ಷಿಪ್ತವಾಗಿ ತಿಳಿಸಿ.' },
    { id: 'ml', name: 'Malayalam', text: 'ദയവായി ഈ രേഖ ഒരു ഉപഭോക്താവിന് വേണ്ടി മൂന്ന് ചെറിയ പോയിന്റുകളിൽ ചുരുക്കി പറയുക.' },
    { id: 'pa', name: 'Punjabi', text: 'ਕਿਰਪਾ ਕਰਕੇ ਇਸ ਦਸਤਾਵੇਜ਼ ਦਾ ਗਾਹਕ ਲਈ ਤਿੰਨ ਛੋਟੇ ਨੁਕਤਿਆਂ ਵਿੱਚ ਸਾਰ ਦਿਓ।' },
    { id: 'or', name: 'Odia', text: 'ଦୟାକରି ଏହି ଦଲିଲକୁ ଗ୍ରାହକଙ୍କ ପାଇଁ ତିନୋଟି ଛୋଟ ବିନ୍ଦୁରେ ସଂକ୍ଷେପରେ କୁହନ୍ତୁ।' },
    { id: 'ur', name: 'Urdu', text: 'براہِ کرم اس دستاویز کا خلاصہ ایک گاہک کے لیے تین مختصر نکات میں بیان کریں۔' },
    { id: 'hing', name: 'Hinglish (romanised Hindi)', text: 'Please is document ko customer ke liye teen chhote points mein summarise karein.' }
  ];

  /* ---------- models and prices (editable in the page) ---------- */
  var CLAUDE_MODELS = [
    { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', price: 4, ctx: 1000000 },
    { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', price: 2, ctx: 1000000 },
    { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', price: 0.1, ctx: 1000000 },
    { id: 'claude-fable-5-2', name: 'Claude Fable 5.2', price: 8, ctx: 1000000 }
  ];
  var GEMINI_MODELS = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', price: null, ctx: null },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', price: null, ctx: null }
  ];
  var PRICES_AS_OF = '2026-11-03';

  var api = {
    SCRIPTS: SCRIPTS, SAMPLES: SAMPLES, CLAUDE_MODELS: CLAUDE_MODELS, GEMINI_MODELS: GEMINI_MODELS, PRICES_AS_OF: PRICES_AS_OF,
    analyse: analyse, scriptOf: scriptOf, ratios: ratios, cost: cost, money: money, chunks: chunks,
    countClaude: countClaude, countGemini: countGemini
  };
  root.KJTok = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

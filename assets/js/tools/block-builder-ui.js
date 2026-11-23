/* EDS block builder: the page. Builds the form, a live dialog preview and the generated files.
   Needs kit.js (KJTools.h), aem-kit.js (KJA), block-builder.js and block-builder-presets.js. Runs in the browser. */
(function () {
  'use strict';
  var h = KJTools.h, B = KJBB, KJP = KJBBPresets, A = KJA;
  var root = document.getElementById('bbTool');
  if (!root) return;

  var STORE = 'kj-bb-v1';
  var spec, tab = 'dialog', pv = {}, timer = null;
  var els = {};

  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var load = function () {
    var m = /[#&]d=([^&]+)/.exec(location.hash), raw = null;
    try { if (m) raw = decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')))); } catch (e) { raw = null; }
    if (!raw) { try { raw = localStorage.getItem(STORE); } catch (e) { raw = null; } }
    if (raw) { try { var s = JSON.parse(raw); if (s && s.name !== undefined) return s; } catch (e) { /* ignore a bad save */ } }
    return clone(KJP.get('teaser').spec);
  };
  var save = function () { try { localStorage.setItem(STORE, JSON.stringify(spec)); } catch (e) { /* storage unavailable */ } };
  var shareUrl = function () {
    var b = btoa(unescape(encodeURIComponent(JSON.stringify(spec)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return location.origin + location.pathname + '#d=' + b;
  };

  function normalise(s) {
    s.shape = s.shape || 'simple'; s.variants = s.variants || []; s.fields = s.fields || []; s.itemFields = s.itemFields || [];
    s.pattern = s.pattern || (s.shape === 'container' ? 'list' : 'plain');
    return s;
  }

  /* ---------- small form helpers ---------- */
  function input(f, key, o) {
    o = o || {};
    var el = h('input', { type: o.type || 'text', spellcheck: 'false', placeholder: o.placeholder || '', value: f[key] == null ? '' : f[key], 'aria-label': o.label });
    el.addEventListener('input', function () { f[key] = el.value; changed(); });
    return el;
  }
  function field(label, control, hint) {
    return h('label', { class: 'pc-field' }, h('span', null, label, hint ? h('small', { text: hint }) : null), control);
  }
  function check(f, key, label) {
    var el = h('input', { type: 'checkbox' }); el.checked = !!f[key];
    el.addEventListener('change', function () { f[key] = el.checked; changed(); });
    return h('label', { class: 'pc-check' }, el, label);
  }
  function select(opts, cur, cb, label) {
    var el = h('select', { 'aria-label': label }, opts.map(function (o) { return h('option', { value: o[0], text: o[1], selected: o[0] === cur }); }));
    el.addEventListener('change', function () { cb(el.value); });
    return el;
  }
  function btn(text, cb, cls, label) {
    return h('button', { type: 'button', class: cls || 'btn ghost pc-sm', text: text, 'aria-label': label || null, onclick: cb });
  }

  /* ---------- design panel ---------- */
  function renderDesign() {
    var box = els.design; box.textContent = '';
    var shape = spec.shape;
    var name = h('input', { type: 'text', value: spec.name, spellcheck: 'false', 'aria-label': 'Block name' });
    name.addEventListener('input', function () { spec.name = name.value; changed(); });
    var shapeSel = select([['simple', 'Simple (one row per field)'], ['container', 'Container (repeating items)'], ['keyvalue', 'Key-value (name and value rows)'], ['columns', 'Columns (no model)']], shape, function (v) {
      spec.shape = v; if (v === 'container' && spec.pattern === 'plain') spec.pattern = 'list'; if (v !== 'container') spec.pattern = 'plain'; renderDesign(); changed();
    }, 'Block shape');
    var top = h('div', { class: 'kt-grid' },
      field('Block name', name, 'Becomes the CSS class and folder name.'),
      field('Shape', shapeSel));
    box.appendChild(top);
    if (shape === 'container') {
      var iname = h('input', { type: 'text', value: spec.itemName || '', spellcheck: 'false', placeholder: (spec.name || 'Block') + ' Item', 'aria-label': 'Item name' });
      iname.addEventListener('input', function () { spec.itemName = iname.value; spec.itemId = ''; changed(); });
      var pat = select(B.PATTERNS.filter(function (p) { return p !== 'plain'; }).map(function (p) { return [p, { list: 'List of items', accordion: 'Accordion', faq: 'FAQ (accordion + schema)', tabs: 'Tabs', carousel: 'Carousel' }[p]]; }), spec.pattern, function (v) { spec.pattern = v; changed(); }, 'Behaviour');
      box.appendChild(h('div', { class: 'kt-grid', style: 'margin-top:1rem' }, field('Item name', iname), field('Behaviour in the JavaScript', pat, B.PATTERN_NOTE[spec.pattern])));
    }
    if (shape === 'columns') {
      box.appendChild(h('p', { class: 'muted', text: 'The Columns block has no fields. Authors choose the number of rows and columns, and fill the cells with text, titles, images and buttons.' }));
      return;
    }
    var vt = h('textarea', { rows: 3, spellcheck: 'false', placeholder: 'Dark = dark\nWide = wide', 'aria-label': 'Style options' });
    vt.value = B.optionsToText(spec.variants);
    vt.addEventListener('input', function () { spec.variants = B.textToOptions(vt.value); changed(); });
    box.appendChild(h('div', { style: 'margin-top:1rem' }, field('Style options', vt, 'Optional. One per line as Label = css-class. Authors tick these and they become extra classes on the block.')));
    if (shape === 'container') {
      box.appendChild(fieldList('Block settings', 'fields', 'Fields that apply to the whole block. Often none.'));
      box.appendChild(fieldList('Item fields', 'itemFields', 'Fields each repeating item has.'));
    } else {
      box.appendChild(fieldList('Fields', 'fields', shape === 'keyvalue' ? 'Each field becomes a name and value row.' : 'Each field, or group of fields, becomes one row of the block.'));
    }
  }

  function fieldList(title, key, hint) {
    var list = spec[key], count = list.filter(function (f) { return f.type !== 'tab'; }).length;
    var wrap = h('section', { class: 'bb-list' });
    wrap.appendChild(h('h3', { text: title + ' (' + count + ')' }));
    if (hint) wrap.appendChild(h('p', { class: 'muted kt-hint', text: hint }));
    var kinds = Object.keys(B.TYPES).map(function (k) { return [k, B.TYPES[k].label]; });
    var which = select(kinds, 'text', function () { /* read on click */ }, 'Field type to add');
    var add = function (fields) { fields.forEach(function (f) { list.push(f); }); renderDesign(); changed(); };
    wrap.appendChild(h('div', { class: 'bb-add' },
      which, btn('Add field', function () { add([{ type: which.value, label: '', name: '' }]); }, 'btn solid pc-sm'),
      btn('+ Image and alt', function () { add(B.shortcuts.image('Image', uniqueBase(key, 'image'))); }),
      btn('+ Link, text and style', function () { add(B.shortcuts.link('Button', uniqueBase(key, 'link'))); }),
      btn('+ Heading and level', function () { add(B.shortcuts.heading('Title', uniqueBase(key, 'title'), 'h2')); })));
    list.forEach(function (f, i) { wrap.appendChild(fieldCard(list, i, key)); });
    if (!list.length) wrap.appendChild(h('p', { class: 'muted', text: 'No fields yet.' }));
    return wrap;
  }
  function uniqueBase(key, base) {
    var names = spec[key].map(B.fieldName), n = base, i = 2;
    while (names.indexOf(n) >= 0) n = base + i++;
    return n;
  }
  function move(list, i, d) { var j = i + d; if (j < 0 || j >= list.length) return; var t = list[i]; list[i] = list[j]; list[j] = t; renderDesign(); changed(); }

  function fieldCard(list, i, key) {
    var f = list[i], T = B.TYPES[f.type] || {}, isRaw = f.type === 'raw';
    var card = h('div', { class: 'bb-f' + (T.tab ? ' bb-tab' : '') });
    if (isRaw) {
      card.appendChild(h('div', { class: 'bb-fh' }, h('strong', { text: (f.label || f.name) + ' ' }), h('span', { class: 'muted', text: 'Kept exactly as imported (' + (f.raw && f.raw.component) + ').' }),
        btn('Remove', function () { list.splice(i, 1); renderDesign(); changed(); }, 'btn ghost pc-sm')));
      return card;
    }
    var kinds = Object.keys(B.TYPES).map(function (k) { return [k, B.TYPES[k].label]; });
    var type = select(kinds, f.type, function (v) { f.type = v; renderDesign(); changed(); }, 'Field type');
    var head = h('div', { class: 'bb-fh' }, type,
      h('span', { class: 'bb-fb' },
        btn('↑', function () { move(list, i, -1); }, 'btn ghost pc-sm', 'Move up'), btn('↓', function () { move(list, i, 1); }, 'btn ghost pc-sm', 'Move down'),
        btn('✕', function () { list.splice(i, 1); renderDesign(); changed(); }, 'btn ghost pc-sm', 'Remove field')),
      input(f, 'label', { placeholder: 'Label', label: 'Label' }),
      input(f, 'name', { placeholder: B.fieldName(f) || 'name (from label)', label: 'Field name' }));
    card.appendChild(head);
    if (T.tab) return card;
    var d = h('details', { class: 'bb-more' }, h('summary', { text: 'More options' }));
    var g = h('div', { class: 'kt-grid' });
    g.appendChild(field('Default value', input(f, 'value')));
    g.appendChild(field('Help text', input(f, 'description'), 'Shown to authors under the field.'));
    d.appendChild(g);
    var flags = h('div', { class: 'kt-row' }, check(f, 'required', 'Required'));
    if (f.type !== 'boolean' && f.type !== 'tab' && f.type !== 'richtext') flags.appendChild(check(f, 'multi', f.type === 'reference' ? 'Allow several' : 'Several values'));
    flags.appendChild(check(f, 'readOnly', 'Read only'));
    flags.appendChild(check(f, 'hidden', 'Hidden'));
    d.appendChild(flags);
    if (T.opts) {
      var ot = h('textarea', { rows: 4, spellcheck: 'false', 'aria-label': 'Options' }); ot.value = B.optionsToText(f.options);
      ot.addEventListener('input', function () { f.options = B.textToOptions(ot.value); changed(); });
      d.appendChild(h('div', { style: 'margin-top:.75rem' }, field('Options', ot, T.groups ? 'One per line as Label = value. A line ending in a colon starts a group, with indented lines under it.' : 'One per line as Label = value.')));
    }
    var v = h('div', { class: 'kt-grid', style: 'margin-top:.75rem' });
    if (T.root) v.appendChild(field('Limit to path', input(f, 'rootPath', { placeholder: '/content/my-site' }), 'Optional. Restricts what the picker offers.'));
    if (f.type === 'aem-content-fragment' || f.type === 'aem-experience-fragment') v.appendChild(field('Variation name', input(f, 'variationName')));
    if (f.type === 'text' || f.type === 'textarea') {
      v.appendChild(field('Minimum length', input(f, 'minLength', { type: 'number' })));
      v.appendChild(field('Maximum length', input(f, 'maxLength', { type: 'number' })));
    }
    if (f.type === 'text') {
      v.appendChild(field('Text format', select([['', 'Plain text'], ['string-multiline', 'Multi-line'], ['email', 'Email'], ['url', 'URL'], ['regexp', 'Regular expression']], f.valueFormat || '', function (x) { f.valueFormat = x; changed(); }, 'Text format')));
      v.appendChild(field('Regular expression', input(f, 'regExp', { placeholder: '^[A-Z]{3}$' }), 'Used when the format is Regular expression.'));
    }
    if (f.type === 'number') {
      v.appendChild(field('Minimum', input(f, 'numberMin', { type: 'number' })));
      v.appendChild(field('Maximum', input(f, 'numberMax', { type: 'number' })));
      v.appendChild(field('Number format', select([['', 'Whole number (default)'], ['double', 'Decimal']], f.valueFormat || '', function (x) { f.valueFormat = x; changed(); }, 'Number format')));
    }
    if (f.type === 'date-time') {
      v.appendChild(field('Display format', input(f, 'displayFormat', { placeholder: 'YYYY-MM-DD' })));
      v.appendChild(field('Stored format', input(f, 'valueFormat', { placeholder: 'YYYY-MM-DD' })));
    }
    if (['text', 'number', 'boolean', 'date-time'].indexOf(f.type) >= 0) v.appendChild(field('Custom error message', input(f, 'customErrorMsg')));
    if (v.childNodes.length) d.appendChild(v);
    var others = list.filter(function (x) { return x !== f && !(B.TYPES[x.type] || {}).tab && x.type !== 'raw'; }).map(B.fieldName).filter(Boolean);
    f.condition = f.condition || null;
    var cond = f.condition || { field: '', op: '===', value: '' };
    var cf = select([['', 'Always show']].concat(others.map(function (n) { return [n, 'Only when "' + n + '"']; })), cond.field, function (x) { f.condition = x ? { field: x, op: cond.op, value: cond.value } : null; cond.field = x; changed(); }, 'Show when');
    var cop = select([['===', 'equals'], ['!==', 'does not equal']], cond.op, function (x) { cond.op = x; if (f.condition) f.condition.op = x; changed(); }, 'Operator');
    var cval = h('input', { type: 'text', value: cond.value, placeholder: 'true', spellcheck: 'false', 'aria-label': 'Condition value' });
    cval.addEventListener('input', function () { cond.value = cval.value; if (f.condition) f.condition.value = cval.value; changed(); });
    d.appendChild(h('div', { class: 'bb-cond' }, h('span', { text: 'Visibility' }), cf, cop, cval));
    card.appendChild(d);
    return card;
  }

  /* ---------- dialog preview (mock Universal Editor properties panel) ---------- */
  function evalCond(c, values) {
    if (!c || !c.field) return true;
    var cur = values[c.field], want = c.value;
    var eq = String(cur === undefined ? '' : cur) === String(want);
    return c.op === '!==' ? !eq : eq;
  }
  function control(f) {
    var n = B.fieldName(f), T = B.TYPES[f.type] || {}, val = pv[n];
    var set = function (v) { pv[n] = v; renderDialog(); };
    switch (f.type) {
      case 'textarea': { var ta = h('textarea', { rows: 3 }); ta.value = val == null ? '' : val; ta.addEventListener('input', function () { pv[n] = ta.value; }); return ta; }
      case 'richtext': return h('div', { class: 'bb-rte' }, h('div', { class: 'bb-rte-bar', 'aria-hidden': 'true' }, h('b', { text: 'B' }), h('i', { text: 'I' }), h('span', { text: '¶ ▾' }), h('span', { text: '🔗' })), h('div', { class: 'bb-rte-body', contenteditable: 'true', role: 'textbox', 'aria-label': f.label || n, text: f.value || '' }));
      case 'reference': return h('div', { class: 'bb-drop' }, h('span', { text: f.multi ? 'Select images or assets' : 'Select an image or asset' }), h('em', { text: 'Browse' }));
      case 'aem-content': case 'aem-content-fragment': case 'aem-experience-fragment': return h('div', { class: 'bb-pick' }, h('input', { type: 'text', placeholder: f.rootPath || '/content/…', 'aria-label': f.label || n }), h('em', { text: 'Browse' }));
      case 'aem-tag': return h('div', { class: 'bb-pick' }, h('input', { type: 'text', placeholder: 'Select tags', 'aria-label': f.label || n }), h('em', { text: 'Browse' }));
      case 'number': { var ni = h('input', { type: 'number', value: val == null ? (f.value || '') : val, min: f.numberMin || null, max: f.numberMax || null }); ni.addEventListener('input', function () { pv[n] = ni.value; }); return ni; }
      case 'boolean': { var cb = h('input', { type: 'checkbox', role: 'switch' }); cb.checked = val == null ? (f.value === 'true' || f.value === true) : !!val; cb.addEventListener('change', function () { set(cb.checked); }); return h('label', { class: 'bb-switch' }, cb, h('span', { class: 'bb-knob' })); }
      case 'select': {
        var cur = val == null ? (f.value || '') : val;
        var flat = flatOptions(f.options);
        var sel = h('select', { 'aria-label': f.label || n }, flat.map(function (o) { return h('option', { value: o.value, text: o.name, selected: String(o.value) === String(cur) }); }));
        sel.addEventListener('change', function () { set(sel.value); });
        return sel;
      }
      case 'radio-group': return h('div', { class: 'bb-opts' }, flatOptions(f.options).map(function (o, k) {
        var r = h('input', { type: 'radio', name: 'bb-' + n }); r.checked = String(val == null ? (f.value || (k === 0 ? o.value : '')) : val) === String(o.value);
        r.addEventListener('change', function () { set(o.value); }); return h('label', { class: 'pc-check' }, r, o.name);
      }));
      case 'multiselect': case 'checkbox-group': return h('div', { class: 'bb-opts' }, flatOptions(f.options).map(function (o) {
        var c = h('input', { type: 'checkbox' }); var arr = Array.isArray(val) ? val : []; c.checked = arr.indexOf(o.value) >= 0;
        c.addEventListener('change', function () { var a = (Array.isArray(pv[n]) ? pv[n] : []).filter(function (x) { return x !== o.value; }); if (c.checked) a.push(o.value); pv[n] = a; renderDialog(); }); return h('label', { class: 'pc-check' }, c, o.name);
      }));
      case 'date-time': return h('input', { type: 'datetime-local', 'aria-label': f.label || n });
      default: { var ti = h('input', { type: f.valueFormat === 'email' ? 'email' : f.valueFormat === 'url' ? 'url' : 'text', value: val == null ? (f.value || '') : val, maxlength: f.maxLength || null, 'aria-label': f.label || n }); ti.addEventListener('input', function () { pv[n] = ti.value; }); void T; return ti; }
    }
  }
  function flatOptions(opts) {
    var out = [];
    (opts || []).forEach(function (o) { if (o.children) o.children.forEach(function (c) { out.push(c); }); else out.push(o); });
    return out;
  }
  function panel(title, fields, classesList) {
    var wrap = h('div', { class: 'bb-ue' }, h('div', { class: 'bb-ue-head', text: title }));
    var body = h('div', { class: 'bb-ue-body' });
    var tabs = [], current = { name: null, label: null, nodes: [] }, groups = [current];
    var all = (classesList && classesList.length ? [{ type: 'multiselect', label: spec.variantsLabel || 'Style', name: 'classes', options: classesList }] : []).concat(fields);
    all.forEach(function (f) {
      if ((B.TYPES[f.type] || {}).tab) { current = { name: B.fieldName(f), label: f.label || B.fieldName(f), nodes: [] }; groups.push(current); tabs.push(current); return; }
      if (f.type === 'raw' || f.hidden) return;
      if (!evalCond(f.condition, pv)) return;
      var n = B.fieldName(f);
      current.nodes.push(h('div', { class: 'bb-ue-f' },
        h('label', null, f.label || n, f.required ? h('span', { class: 'bb-req', text: ' *' }) : null), control(f),
        f.description ? h('small', { class: 'muted', text: f.description }) : null));
    });
    var active = tabs.length ? (pv.__tab && tabs.some(function (t) { return t.name === pv.__tab; }) ? pv.__tab : tabs[0].name) : null;
    groups[0].nodes.forEach(function (x) { body.appendChild(x); });
    if (tabs.length) {
      var bar = h('div', { class: 'bb-ue-tabs', role: 'tablist' }, tabs.map(function (t) {
        return h('button', { type: 'button', role: 'tab', 'aria-selected': t.name === active ? 'true' : 'false', text: t.label, onclick: function () { pv.__tab = t.name; renderDialog(); } });
      }));
      body.appendChild(bar);
      tabs.forEach(function (t) { if (t.name === active) t.nodes.forEach(function (x) { body.appendChild(x); }); });
    }
    if (!body.childNodes.length) body.appendChild(h('p', { class: 'muted', text: 'Nothing to edit.' }));
    wrap.appendChild(body);
    return wrap;
  }
  function renderDialog() {
    var box = els.dialogBox; if (!box) return;
    box.textContent = '';
    if (spec.shape === 'columns') { box.appendChild(h('p', { class: 'muted', text: 'The Columns block has no properties panel of its own.' })); return; }
    if (spec.shape === 'container') {
      box.appendChild(panel((spec.name || 'Block') + ' properties', spec.fields, spec.variants));
      box.appendChild(panel((B.itemName(spec)) + ' properties', spec.itemFields, null));
    } else {
      box.appendChild(panel((spec.name || 'Block') + ' properties', spec.fields, spec.variants));
    }
  }

  /* ---------- outputs ---------- */
  var TABS = [['dialog', 'Dialog'], ['json', 'Block JSON'], ['html', 'Delivered HTML'], ['js', 'JavaScript'], ['css', 'CSS'], ['setup', 'Setup']];
  function renderTabs() {
    els.tabs.textContent = '';
    TABS.forEach(function (t) {
      els.tabs.appendChild(h('button', { type: 'button', role: 'tab', id: 'bbt-' + t[0], 'aria-selected': tab === t[0] ? 'true' : 'false', 'aria-controls': 'bbPanel', text: t[1], onclick: function () { tab = t[0]; renderTabs(); renderOut(); } }));
    });
  }
  function renderChecks(list) {
    els.checks.textContent = '';
    var errs = list.filter(function (c) { return c.level === 'error'; }).length, warns = list.filter(function (c) { return c.level === 'warn'; }).length;
    els.checks.appendChild(h('div', { class: 'bb-sum', role: 'status' }, h('strong', { text: errs ? errs + ' to fix' : warns ? warns + ' to check' : 'Model looks good' }), h('span', { class: 'muted', text: errs || warns ? ' Fix these before you copy the files.' : ' Passes the official xwalk lint rules.' })));
    if (errs || warns || list.some(function (c) { return c.level === 'info'; })) els.checks.appendChild(A.findings(list.filter(function (c) { return c.level !== 'ok'; })));
  }
  var last = null;
  function renderOut() {
    var out = last, id = out.id, p = els.panel; p.textContent = '';
    p.setAttribute('aria-labelledby', 'bbt-' + tab);
    if (tab === 'dialog') {
      p.appendChild(h('p', { class: 'muted kt-hint', text: 'This is how authors will see the properties panel in the Universal Editor. Try the fields: toggles and drop-downs that other fields depend on show and hide them, just as the real panel does.' }));
      els.dialogBox = h('div', { class: 'bb-dialogs' }); p.appendChild(els.dialogBox); renderDialog();
    } else if (tab === 'json') {
      p.appendChild(A.codeBlock('blocks/' + id + '/_' + id + '.json', out.json, '_' + id + '.json', 'One file with the definition, the model and any filter. Your project merges it with npm run build:json.'));
      p.appendChild(h('div', { class: 'kt-block' }, h('h3', { text: 'Make the block available to authors' }),
        h('p', { class: 'muted kt-hint', text: 'Add this to the components list of the section filter in models/_section.json. Without it, the block does not appear in the Universal Editor.' }),
        h('pre', { class: 'io-code', tabindex: '0' }, h('code', { text: '"filters": [ { "id": "section", "components": [ …, ' + out.sectionFilter + ' ] } ]' }))));
    } else if (tab === 'html') {
      p.appendChild(A.codeBlock('What Edge Delivery Services delivers', out.html, id + '.plain.html', 'Built from your fields with sample content. Your decorate() function receives these rows and cells. To see the real thing for a page, add .plain.html to its URL.'));
      p.appendChild(h('p', { class: 'muted kt-hint', text: 'This is derived from the documented rules for field collapse, grouping and block layout. Always compare it with the real .plain.html output of a page you author.' }));
    } else if (tab === 'js') {
      p.appendChild(A.codeBlock('blocks/' + id + '/' + id + '.js', out.js, id + '.js', 'A starting point that reads the cells in field order. Elements may be empty when authors skip a field, so keep the optional chaining.'));
    } else if (tab === 'css') {
      p.appendChild(A.codeBlock('blocks/' + id + '/' + id + '.css', out.css, id + '.css', 'Mobile first, uses the boilerplate colour variables. Change it to match your design.'));
    } else {
      renderSetup(p, out);
    }
  }
  function renderSetup(p, out) {
    var id = out.id, ex = (KJP.get(selectedPreset) || {}).existing;
    var steps = h('ol', { class: 'bb-steps' },
      h('li', null, 'Add the three files to your repo under ', h('code', { text: 'blocks/' + id + '/' }), '.'),
      h('li', null, 'Add ', h('code', { text: out.sectionFilter }), ' to the section filter in ', h('code', { text: 'models/_section.json' }), '.'),
      h('li', null, 'Run ', h('code', { text: 'npm run build:json' }), ' and commit the merged component-*.json files.'),
      h('li', null, 'Run ', h('code', { text: 'npm run lint' }), ', push, then add the block to a page in the Universal Editor.'));
    p.appendChild(steps);
    if (ex) p.appendChild(h('p', { class: 'pc-note', text: 'This block already exists in the AEM boilerplate. Use it to see how it is built, and do not overwrite your existing files with it.' }));
    if (out.usesMulti) p.appendChild(h('p', { class: 'pc-note', text: 'This block uses multi-value fields. Set public.xwalk.multi-field.enabled to true in xwalk.json: { "public": { "xwalk": { "multi-field": { "enabled": true } } } }.' }));
    var dl = btn('Download ZIP', function () {
      var files = {}; files['blocks/' + id + '/_' + id + '.json'] = out.json; files['blocks/' + id + '/' + id + '.js'] = out.js; files['blocks/' + id + '/' + id + '.css'] = out.css;
      var blob = new Blob([B.zip(files)], { type: 'application/zip' });
      var a = h('a', { href: URL.createObjectURL(blob), download: id + '-block.zip' }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    }, 'btn solid');
    p.appendChild(h('div', { class: 'kt-row' }, dl));
    var legacy = h('details', { class: 'pc-adv' }, h('summary', { text: 'Older project layout: three merged files' }));
    legacy.appendChild(h('p', { class: 'muted kt-hint', text: 'If your project keeps one component-definition.json, component-models.json and component-filters.json instead of per-block files, merge these in.' }));
    Object.keys(out.legacy).forEach(function (k) { legacy.appendChild(A.codeBlock(k, out.legacy[k], k)); });
    p.appendChild(legacy);
  }

  /* ---------- refresh ---------- */
  var selectedPreset = '';
  function changed() {
    clearTimeout(timer);
    timer = setTimeout(refresh, 120);
  }
  function refresh() {
    normalise(spec);
    last = B.build(spec);
    renderChecks(B.check(spec));
    renderOut();
    save();
  }

  /* ---------- toolbar: presets, import, share, reset ---------- */
  function renderStart() {
    var box = els.start; box.textContent = '';
    var groups = {}, order = [];
    KJP.list.forEach(function (p) { if (!groups[p.group]) { groups[p.group] = []; order.push(p.group); } groups[p.group].push(p); });
    order.forEach(function (gname) {
      var row = h('div', { class: 'bb-chips', role: 'group', 'aria-label': gname });
      groups[gname].forEach(function (p) {
        var b = h('button', { type: 'button', class: 'bb-chip', 'aria-pressed': selectedPreset === p.id ? 'true' : 'false', title: p.blurb, onclick: function () { pick(p.id); } }, h('strong', { text: p.title }), h('small', { text: p.blurb }));
        row.appendChild(b);
      });
      box.appendChild(h('div', { class: 'bb-group' }, h('h3', { text: gname }), row));
    });
  }
  function pick(id) {
    selectedPreset = id; spec = clone(KJP.get(id).spec); pv = {};
    els.startWrap.open = false; els.startSum.textContent = 'Starting from: ' + KJP.get(id).title + ' (change)';
    renderStart(); renderDesign(); refresh();
  }
  function status(msg, bad) { els.msg.textContent = msg; els.msg.className = 'pc-note' + (bad ? ' pc-error' : ''); }

  function build() {
    els.startSum = h('summary', { text: 'Start from a ready-made block' });
    var wrapStart = els.startWrap = h('details', { class: 'bb-start', open: true }, els.startSum);
    els.start = h('div'); wrapStart.appendChild(els.start);
    var blank = btn('Start blank', function () { selectedPreset = ''; spec = clone(KJP.blank); pv = {}; renderStart(); renderDesign(); refresh(); });
    var imp = h('textarea', { rows: 6, spellcheck: 'false', placeholder: 'Paste the contents of a block file such as _hero.json', 'aria-label': 'Block JSON to import' });
    var impBtn = btn('Import', function () {
      try { spec = normalise(B.importBundle(imp.value)); selectedPreset = ''; pv = {}; renderStart(); renderDesign(); refresh(); status('Imported "' + spec.name + '".'); }
      catch (e) { status('Could not import: ' + e.message, true); }
    }, 'btn solid pc-sm');
    var impBox = h('details', { class: 'bb-imp' }, h('summary', { text: 'Import an existing block file' }), imp, h('div', { class: 'kt-row' }, impBtn));
    var share = btn('Copy share link', function () { var u = shareUrl(); A.copy(u, share); try { history.replaceState(null, '', u); } catch (e) { /* ignore */ } });
    var reset = btn('Reset', function () { try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ } history.replaceState(null, '', location.pathname); pick('teaser'); });
    els.msg = h('p', { class: 'pc-note', 'aria-live': 'polite' });
    els.design = h('div', { class: 'bb-design' });
    els.checks = h('div', { class: 'bb-checks' });
    els.tabs = h('div', { class: 'bb-tabs', role: 'tablist', 'aria-label': 'Generated output' });
    els.panel = h('div', { class: 'bb-panel', id: 'bbPanel', role: 'tabpanel', tabindex: '0' });
    var left = h('div', { class: 'bb-col' }, h('div', { class: 'bb-tools' }, blank, share, reset), els.msg, impBox, els.design);
    var right = h('div', { class: 'bb-col' }, els.checks, els.tabs, els.panel);
    root.textContent = '';
    root.appendChild(wrapStart);
    root.appendChild(h('div', { class: 'bb-main' }, left, right));
  }

  spec = normalise(load());
  build();
  renderStart(); renderDesign(); renderTabs(); refresh();
})();

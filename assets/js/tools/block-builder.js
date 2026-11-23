/* EDS block builder: core engine. Turns a block "spec" into the Universal Editor (xwalk) model files,
   the HTML Edge Delivery Services will deliver for it, and starter JavaScript and CSS.
   Pure functions, no DOM. Runs in the browser and in Node (for tests). Nothing is uploaded. */
(function (root) {
  'use strict';

  /* ---------- field types ---------- */
  var TYPES = {
    'text': { label: 'Text (one line)', vt: 'string' },
    'textarea': { label: 'Text area', vt: 'string' },
    'richtext': { label: 'Rich text', vt: 'string' },
    'reference': { label: 'Image or asset', vt: 'string', ref: true },
    'aem-content': { label: 'Link or page', vt: 'string', root: true },
    'aem-content-fragment': { label: 'Content Fragment', vt: 'string', root: true },
    'aem-experience-fragment': { label: 'Experience Fragment', vt: 'string', root: true },
    'aem-tag': { label: 'Tag picker', vt: 'string' },
    'number': { label: 'Number', vt: 'number' },
    'boolean': { label: 'Toggle (true/false)', vt: 'boolean' },
    'select': { label: 'Drop-down (one)', vt: 'string', opts: true },
    'radio-group': { label: 'Radio buttons', vt: 'string', opts: true },
    'multiselect': { label: 'Multi-select', vt: null, opts: true, groups: true },
    'checkbox-group': { label: 'Checkboxes', vt: 'string[]', opts: true },
    'date-time': { label: 'Date and time', vt: 'date' },
    'tab': { label: 'Tab separator', tab: true }
  };
  var SUFFIXES = ['Text', 'Title', 'Type', 'Alt', 'MimeType']; // order matches the official lint rule
  var VALIDATION_KEYS = ['rootPath', 'minLength', 'maxLength', 'regExp', 'numberMin', 'numberMax', 'customErrorMsg'];
  var LINK_TYPE_OPTIONS = [{ name: 'default', value: '' }, { name: 'primary', value: 'primary' }, { name: 'secondary', value: 'secondary' }];
  var HEADINGS = [1, 2, 3, 4, 5, 6].map(function (n) { return { name: 'h' + n, value: 'h' + n }; });

  var slug = function (s) { return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); };
  var camel = function (s) {
    var w = String(s || '').replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    return w.map(function (x, i) { return i ? x.charAt(0).toUpperCase() + x.slice(1) : x.charAt(0).toLowerCase() + x.slice(1); }).join('');
  };
  var isSet = function (v) { return v !== undefined && v !== null && String(v) !== ''; };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var typeOf = function (f) { return TYPES[f.type] || {}; };

  function fieldName(f) { return (f.name && String(f.name).trim()) || camel(f.label) || ''; }
  function blockId(spec) { return slug(spec.name) || 'my-block'; }
  function itemName(spec) { return (spec.itemName && spec.itemName.trim()) || ((spec.name || 'My block').trim() + ' Item'); }
  function itemId(spec) { return slug(spec.itemId || itemName(spec)) || blockId(spec) + '-item'; }

  /* ---------- option text <-> array ("Label = value", "Group:" then indented children) ---------- */
  function textToOptions(text) {
    var out = [], group = null;
    String(text || '').split(/\r\n|\r|\n/).forEach(function (raw) {
      if (!raw.trim()) return;
      var child = /^\s{2,}|^\t/.test(raw), line = raw.trim();
      if (!child && /:\s*$/.test(line)) { group = { name: line.replace(/:\s*$/, ''), children: [] }; out.push(group); return; }
      var i = line.indexOf('='), name = (i < 0 ? line : line.slice(0, i)).trim(), val = i < 0 ? slug(name) : line.slice(i + 1).trim();
      var o = { name: name || 'Option', value: val };
      if (group && child) group.children.push(o); else { out.push(o); group = null; }
    });
    return out;
  }
  function optionsToText(opts) {
    var lines = [];
    (opts || []).forEach(function (o) {
      if (o.children) { lines.push(o.name + ':'); o.children.forEach(function (c) { lines.push('  ' + c.name + ' = ' + c.value); }); }
      else lines.push(o.name + ' = ' + o.value);
    });
    return lines.join('\n');
  }
  function firstOptionValue(opts) {
    if (!opts || !opts.length) return '';
    var o = opts[0];
    if (o.children) return o.children.length ? o.children[0].value : '';
    return o.value;
  }

  /* ---------- shortcuts: fields that belong together (field collapse) ---------- */
  var shortcuts = {
    image: function (label, base) {
      base = base || 'image'; label = label || 'Image';
      return [{ type: 'reference', label: label, name: base }, { type: 'text', label: label + ' alt text', name: base + 'Alt' }];
    },
    link: function (label, base) {
      base = base || 'link'; label = label || 'Link';
      return [{ type: 'aem-content', label: label, name: base }, { type: 'text', label: label + ' text', name: base + 'Text' },
        { type: 'select', label: label + ' style', name: base + 'Type', options: clone(LINK_TYPE_OPTIONS) }];
    },
    heading: function (label, base, level) {
      base = base || 'title'; label = label || 'Title';
      return [{ type: 'text', label: label, name: base }, { type: 'select', label: label + ' level', name: base + 'Type', value: level || 'h2', options: clone(HEADINGS) }];
    }
  };

  /* ---------- spec -> model field objects ---------- */
  function conditionObj(c) {
    if (!c || !c.field) return null;
    var v = c.value;
    if (v === 'true') v = true; else if (v === 'false') v = false; else if (isSet(v) && !isNaN(Number(v))) v = Number(v);
    var o = {}; o[c.op === '!==' ? '!==' : '==='] = [{ 'var': c.field }, v];
    return o;
  }
  function fieldObj(f) {
    var T = typeOf(f), name = fieldName(f), label = (f.label && f.label.trim()) || name;
    if (f.type === 'raw') return clone(f.raw);
    if (T.tab) return { component: 'tab', name: name || 'tab', label: label };
    var o = { component: f.type, name: name, label: label };
    if (T.vt) o.valueType = T.vt;
    if (isSet(f.description)) o.description = f.description;
    if (isSet(f.value)) o.value = f.type === 'number' ? (isNaN(Number(f.value)) ? f.value : Number(f.value)) : f.type === 'boolean' ? (f.value === true || f.value === 'true') : f.value;
    if (f.type === 'reference') o.multi = !!f.multi;
    else if (f.multi) o.multi = true;
    if (f.required) o.required = true;
    if (f.readOnly) o.readOnly = true;
    if (f.hidden) o.hidden = true;
    if (T.opts) o.options = clone(f.options && f.options.length ? f.options : []);
    ['valueFormat', 'displayFormat', 'variationName'].forEach(function (k) { if (isSet(f[k])) o[k] = f[k]; });
    var val = {};
    VALIDATION_KEYS.forEach(function (k) { if (isSet(f[k])) val[k] = (k === 'minLength' || k === 'maxLength' || k === 'numberMin' || k === 'numberMax') && !isNaN(Number(f[k])) ? Number(f[k]) : f[k]; });
    if (Object.keys(val).length) o.validation = val;
    var cond = conditionObj(f.condition); if (cond) o.condition = cond;
    if (f._extra) Object.keys(f._extra).forEach(function (k) { if (!(k in o)) o[k] = clone(f._extra[k]); });
    return o;
  }
  function classesObj(spec) {
    return { component: 'multiselect', name: 'classes', label: (spec.variantsLabel && spec.variantsLabel.trim()) || 'Style', options: clone(spec.variants) };
  }
  function modelFields(fields, withClasses, spec) {
    var out = withClasses && spec.variants && spec.variants.length ? [classesObj(spec)] : [];
    (fields || []).forEach(function (f) { out.push(fieldObj(f)); });
    return out;
  }

  var RT = 'core/franklin/components/block/v1/block';

  /* ---------- build the xwalk bundle ---------- */
  function build(spec) {
    var id = blockId(spec), title = (spec.name || '').trim() || 'My block', shape = spec.shape || 'simple';
    var defs = [], models = [], filters = [], kv = shape === 'keyvalue' ? { 'key-value': true } : {};
    var hasVariants = !!(spec.variants && spec.variants.length);
    if (shape === 'columns') {
      defs.push({ title: title, id: id, plugins: { xwalk: { page: { resourceType: 'core/franklin/components/columns/v1/columns', template: { columns: '2', rows: '1' } } } } });
      models.push({ id: id, fields: [
        { component: 'text', valueType: 'number', name: 'columns', value: '', label: 'Columns' },
        { component: 'text', valueType: 'number', name: 'rows', value: '', label: 'Rows' }] });
      filters.push({ id: id, components: ['column'] });
      filters.push({ id: 'column', components: ['text', 'image', 'button', 'title'] });
    } else if (shape === 'container') {
      var iid = itemId(spec), iname = itemName(spec);
      var parentFields = modelFields(spec.fields, true, spec);
      var tpl = { name: title }; if (parentFields.length) tpl.model = id; tpl.filter = id;
      defs.push({ title: title, id: id, plugins: { xwalk: { page: { resourceType: RT, template: tpl } } } });
      defs.push({ title: iname, id: iid, plugins: { xwalk: { page: { resourceType: RT + '/item', template: { name: iname, model: iid } } } } });
      if (parentFields.length) models.push({ id: id, fields: parentFields });
      models.push({ id: iid, fields: modelFields(spec.itemFields, false, spec) });
      filters.push({ id: id, components: [iid] });
    } else {
      var fs = modelFields(spec.fields, true, spec), t = { name: title };
      if (fs.length) t.model = id;
      Object.keys(kv).forEach(function (k) { t[k] = kv[k]; });
      defs.push({ title: title, id: id, plugins: { xwalk: { page: { resourceType: RT, template: t } } } });
      if (fs.length) models.push({ id: id, fields: fs });
    }
    var bundle = { definitions: defs, models: models, filters: filters };
    var out = {
      id: id, title: title, shape: shape, bundle: bundle,
      json: JSON.stringify(bundle, null, 2) + '\n',
      legacy: {
        'component-definition.json': JSON.stringify({ groups: [{ title: 'Blocks', id: 'blocks', components: defs }] }, null, 2) + '\n',
        'component-models.json': JSON.stringify(models, null, 2) + '\n',
        'component-filters.json': JSON.stringify(filters, null, 2) + '\n'
      },
      sectionFilter: '"' + id + '"',
      usesMulti: allFields(spec).some(function (f) { return f.multi && f.type !== 'reference'; }) || allFields(spec).some(function (f) { return f.type === 'reference' && f.multi; })
    };
    out.layout = layout(spec);
    out.html = deliveredHtml(spec, out.layout);
    out.js = buildJs(spec, out.layout);
    out.css = buildCss(spec, out.layout);
    return out;
  }
  function allFields(spec) { return (spec.fields || []).concat(spec.shape === 'container' ? spec.itemFields || [] : []); }

  /* ---------- cells: field collapse + element grouping (mirrors the official lint rule) ---------- */
  function cellsOf(fields) {
    var items = (fields || []).filter(function (f) {
      var n = fieldName(f);
      return !typeOf(f).tab && f.type !== 'raw' && n !== 'classes' && n.indexOf('classes_') !== 0 && !f.hidden;
    });
    var names = items.map(fieldName), byName = {};
    items.forEach(function (f) { byName[fieldName(f)] = f; });
    var groups = [], map = {};
    items.forEach(function (f) {
      var n = fieldName(f), suffix = null;
      SUFFIXES.forEach(function (s) { if (n.length > s.length && n.slice(-s.length) === s) suffix = s; });
      var base = suffix ? n.slice(0, n.length - suffix.length) : null;
      if (base && byName[base]) { (byName[base]._collapsed = byName[base]._collapsed || []).push({ f: f, suffix: suffix }); return; }
      var key = n.split('_')[0];
      if (!map[key]) { map[key] = { key: key, items: [] }; groups.push(map[key]); }
      map[key].items.push(f);
    });
    // collapsed lists are rebuilt per call so repeated builds stay clean
    var result = groups.map(function (g) {
      return { key: g.key, items: g.items.map(function (f) { var c = f._collapsed || []; delete f._collapsed; return { f: f, collapsed: c }; }) };
    });
    return result;
  }
  function layout(spec) {
    var shape = spec.shape || 'simple';
    if (shape === 'columns') return { shape: shape, parent: [], item: [] };
    if (shape === 'container') return { shape: shape, parent: cellsOf(spec.fields), item: cellsOf(spec.itemFields) };
    return { shape: shape, parent: cellsOf(spec.fields), item: [] };
  }

  /* ---------- sample content + delivered HTML ---------- */
  function sampleFor(f, collapsedSuffix) {
    var label = (f.label || fieldName(f) || 'value').replace(/\s*(alt text|text|title|level|style)$/i, '') || 'value';
    if (isSet(f.value)) return String(f.value);
    switch (f.type) {
      case 'reference': return '/media_sample.png';
      case 'aem-content': return 'https://example.com/' + slug(label);
      case 'aem-content-fragment': return '/content/dam/site/fragments/sample';
      case 'aem-experience-fragment': return '/content/experience-fragments/site/sample';
      case 'richtext': return 'Sample ' + label.toLowerCase() + ' copy.';
      case 'number': return '42';
      case 'boolean': return 'true';
      case 'date-time': return '2026-01-31';
      case 'aem-tag': return 'site:topic/sample';
      case 'select': case 'radio-group': case 'multiselect': case 'checkbox-group': return firstOptionValue(f.options);
      default:
        if (collapsedSuffix === 'Alt') return 'Describe the image';
        if (collapsedSuffix === 'Text') return 'Learn more';
        if (collapsedSuffix === 'Title') return 'Link title';
        return 'Sample ' + label.toLowerCase();
    }
  }
  function renderItem(it) {
    var f = it.f, col = {}, i;
    for (i = 0; i < it.collapsed.length; i++) col[it.collapsed[i].suffix] = it.collapsed[i].f;
    var val = sampleFor(f), cv = function (s) { return col[s] ? sampleFor(col[s], s) : ''; };
    var html;
    if (f.type === 'reference' && !col.Text) {
      html = '<picture><img src="' + esc(val) + '" alt="' + esc(cv('Alt')) + '"></picture>';
    } else if (f.type === 'aem-content' || f.type === 'reference' || f.type === 'aem-content-fragment' || f.type === 'aem-experience-fragment') {
      var a = '<a href="' + esc(val) + '"' + (col.Title ? ' title="' + esc(cv('Title')) + '"' : '') + '>' + esc(col.Text ? cv('Text') : val) + '</a>';
      var lt = cv('Type');
      html = lt === 'primary' ? '<strong>' + a + '</strong>' : lt === 'secondary' ? '<em>' + a + '</em>' : a;
    } else if (f.type === 'text' && /^h[1-6]$/.test(cv('Type'))) {
      html = '<' + cv('Type') + '>' + esc(val) + '</' + cv('Type') + '>';
    } else if (f.type === 'richtext') {
      html = '<p>' + esc(val) + '</p>';
    } else if (f.type === 'multiselect' || f.type === 'checkbox-group') {
      html = esc(flatValues(f.options).join(', '));
    } else {
      html = esc(val);
    }
    if (f.multi && f.type !== 'richtext') html = '<ul><li>' + html + '</li><li>' + html + '</li></ul>';
    return html;
  }
  function flatValues(opts) {
    var v = [];
    (opts || []).forEach(function (o) { if (o.children) o.children.forEach(function (c) { v.push(c.value); }); else v.push(o.value); });
    return v.slice(0, 2);
  }
  function renderCell(group) { return group.items.map(renderItem).join(''); }

  function blockClasses(spec) {
    var cls = [blockId(spec)];
    allFields(spec).forEach(function (f) {
      var n = fieldName(f);
      if (n.indexOf('classes_') === 0 && (f.value === true || f.value === 'true')) cls.push(n.slice(8));
    });
    return cls;
  }
  function deliveredHtml(spec, lay) {
    var id = blockId(spec), shape = lay.shape, lines = [], pad = '  ';
    var cls = blockClasses(spec).join(' ');
    if (shape === 'columns') {
      return '<div class="' + id + '">\n  <div>\n    <div><p>Column one</p></div>\n    <div><p>Column two</p></div>\n  </div>\n</div>\n';
    }
    lines.push('<div class="' + cls + '">');
    if (shape === 'keyvalue') {
      lay.parent.forEach(function (g) {
        lines.push(pad + '<div>', pad + pad + '<div>' + esc(g.key) + '</div>', pad + pad + '<div>' + renderCell(g) + '</div>', pad + '</div>');
      });
    } else {
      lay.parent.forEach(function (g) { lines.push(pad + '<div>', pad + pad + '<div>' + renderCell(g) + '</div>', pad + '</div>'); });
    }
    if (shape === 'container' && lay.item.length) {
      [1, 2].forEach(function () {
        lines.push(pad + '<div>');
        lay.item.forEach(function (g) { lines.push(pad + pad + '<div>' + renderCell(g) + '</div>'); });
        lines.push(pad + '</div>');
      });
    }
    lines.push('</div>');
    return lines.join('\n') + '\n';
  }

  /* ---------- JavaScript scaffold ---------- */
  function varName(key, used) {
    var base = camel(key) || 'cell', v = base + 'Cell', n = 2;
    while (used[v]) v = base + 'Cell' + n++;
    used[v] = 1; return v;
  }
  function hasType(lay, t) {
    return lay.parent.concat(lay.item).some(function (g) { return g.items.some(function (it) { return it.f.type === t; }); });
  }
  var PATTERN_NOTE = {
    plain: 'Each cell gets a class so you can style it.',
    list: 'Each item becomes a list item.',
    accordion: 'Each item becomes a <details> element: first cell is the label, second is the body.',
    faq: 'Each item becomes a <details> element and a FAQPage JSON-LD block is added.',
    tabs: 'Each item becomes a tab: first cell is the tab label, second is the panel.',
    carousel: 'Each item becomes a scrollable slide with previous and next buttons.'
  };
  function patternOf(spec) {
    var p = spec.pattern || (spec.shape === 'container' ? 'list' : 'plain');
    if (spec.shape !== 'container' && p !== 'plain') return 'plain';
    return p;
  }
  function buildJs(spec, lay) {
    var id = blockId(spec), pattern = patternOf(spec), shape = lay.shape, L = [];
    if (shape === 'columns') {
      return [
        'export default function decorate(block) {',
        '  const cols = [...block.firstElementChild.children];',
        '  block.classList.add(`' + id + '-${cols.length}-cols`);',
        '',
        '  // mark columns that only contain a picture',
        '  [...block.children].forEach((row) => {',
        '    [...row.children].forEach((col) => {',
        "      const pic = col.querySelector('picture');",
        '      if (pic && pic.closest(\'div\') === col && col.children.length === 1) {',
        "        col.classList.add('" + id + "-img-col');",
        '      }',
        '    });',
        '  });',
        '}',
        ''
      ].join('\n');
    }
    var needsInstr = shape === 'container';
    var needsPic = hasType(lay, 'reference');
    var imports = [];
    if (needsPic) imports.push("import { createOptimizedPicture } from '../../scripts/aem.js';");
    if (needsInstr) imports.push("import { moveInstrumentation } from '../../scripts/scripts.js';");
    if (imports.length) { L = L.concat(imports, ['']); }
    L.push('/**', ' * ' + (spec.name || 'Block') + ' block.', ' * Cells per row: ' + (shape === 'container' ? lay.item : lay.parent).map(function (g) { return g.key; }).join(', ') + '.', ' * ' + PATTERN_NOTE[pattern], ' */');
    L.push('export default function decorate(block) {');
    var used = {}, i;
    if (shape === 'container') {
      var pc = lay.parent.length;
      if (pc) {
        var pv = lay.parent.map(function (g) { return varName(g.key, used); });
        L.push('  const rows = [...block.children];');
        L.push('  const [' + pv.join(', ') + '] = rows;');
        L.push('  const itemRows = rows.slice(' + pc + ');');
        pv.forEach(function (v, k) { L.push("  " + v + ".classList.add('" + id + "-" + slug(lay.parent[k].key) + "');"); });
      } else {
        L.push('  const itemRows = [...block.children];');
      }
      L = L.concat(containerBody(spec, lay, id, pattern, needsPic));
    } else {
      var cv = lay.parent.map(function (g) { return varName(g.key, used); });
      if (cv.length) {
        L.push('  const [' + cv.join(', ') + '] = block.children;');
        cv.forEach(function (v, k) {
          L.push('  ' + v + "?.classList.add('" + id + '-' + slug(lay.parent[k].key) + "');");
        });
      } else {
        L.push('  // This block has no fields. Add your own decoration here.');
        L.push("  block.classList.add('" + id + "-ready');");
      }
      if (needsPic) L = L.concat(pictureOptimise('block', false));
    }
    L.push('}', '');
    return L.join('\n');
  }
  function pictureOptimise(scope, forItems) {
    return [
      '',
      "  " + scope + ".querySelectorAll('picture > img').forEach((img) => {",
      '    const optimised = createOptimizedPicture(img.src, img.alt, false, [{ width: \'750\' }]);',
      forItems ? "    moveInstrumentation(img, optimised.querySelector('img'));" : null,
      "    img.closest('picture').replaceWith(optimised);",
      '  });'
    ].filter(function (x) { return x !== null; });
  }
  function containerBody(spec, lay, id, pattern, needsPic) {
    var L = [];
    if (pattern === 'accordion' || pattern === 'faq') {
      L.push('  itemRows.forEach((row) => {');
      L.push('    const [label, body] = row.children;');
      L.push("    const summary = document.createElement('summary');");
      L.push("    summary.className = '" + id + "-label';");
      L.push('    summary.append(...label.childNodes);');
      L.push("    body.className = '" + id + "-body';");
      L.push("    const details = document.createElement('details');");
      L.push('    moveInstrumentation(row, details);');
      L.push("    details.className = '" + id + "-item';");
      L.push('    details.append(summary, body);');
      L.push('    row.replaceWith(details);');
      L.push('  });');
      if (pattern === 'faq') {
        L.push('');
        L.push('  // FAQPage structured data. Search engines read it from the rendered page.');
        L.push("  const entities = [...block.querySelectorAll('." + id + "-item')].map((item) => ({");
        L.push("    '@type': 'Question',");
        L.push("    name: item.querySelector('summary').textContent.trim(),");
        L.push("    acceptedAnswer: { '@type': 'Answer', text: item.querySelector('." + id + "-body').innerHTML.trim() },");
        L.push('  }));');
        L.push('  if (entities.length) {');
        L.push("    const ld = document.createElement('script');");
        L.push("    ld.type = 'application/ld+json';");
        L.push("    ld.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: entities });");
        L.push('    block.append(ld);');
        L.push('  }');
      }
      return L;
    }
    if (pattern === 'tabs') {
      L.push("  const list = document.createElement('div');");
      L.push("  list.className = '" + id + "-list';");
      L.push("  list.setAttribute('role', 'tablist');");
      L.push('');
      L.push('  itemRows.forEach((row, i) => {');
      L.push('    const [label, panel] = row.children;');
      L.push("    panel.className = '" + id + "-panel';");
      L.push("    panel.id = `" + id + "-panel-${i}`;");
      L.push("    panel.setAttribute('role', 'tabpanel');");
      L.push("    panel.setAttribute('aria-labelledby', `" + id + "-tab-${i}`);");
      L.push("    panel.setAttribute('aria-hidden', i === 0 ? 'false' : 'true');");
      L.push('');
      L.push("    const button = document.createElement('button');");
      L.push("    button.className = '" + id + "-tab';");
      L.push('    button.id = `' + id + '-tab-${i}`;');
      L.push("    button.type = 'button';");
      L.push("    button.setAttribute('role', 'tab');");
      L.push("    button.setAttribute('aria-controls', panel.id);");
      L.push("    button.setAttribute('aria-selected', i === 0 ? 'true' : 'false');");
      L.push('    button.append(...label.childNodes);');
      L.push("    button.addEventListener('click', () => {");
      L.push('      block.querySelectorAll(\'[role="tabpanel"]\').forEach((p) => p.setAttribute(\'aria-hidden\', \'true\'));');
      L.push('      list.querySelectorAll(\'button\').forEach((b) => b.setAttribute(\'aria-selected\', \'false\'));');
      L.push("      panel.setAttribute('aria-hidden', 'false');");
      L.push("      button.setAttribute('aria-selected', 'true');");
      L.push('    });');
      L.push('    moveInstrumentation(row, panel);');
      L.push('    list.append(button);');
      L.push('    row.replaceWith(panel);');
      L.push('    label.remove();');
      L.push('  });');
      L.push('  block.prepend(list);');
      return L;
    }
    if (pattern === 'carousel') {
      L.push("  const track = document.createElement('ul');");
      L.push("  track.className = '" + id + "-track';");
      L.push('  itemRows.forEach((row) => {');
      L.push("    const slide = document.createElement('li');");
      L.push('    moveInstrumentation(row, slide);');
      L.push('    while (row.firstElementChild) slide.append(row.firstElementChild);');
      L.push("    slide.className = '" + id + "-slide';");
      L.push('    row.remove();');
      L.push('    track.append(slide);');
      L.push('  });');
      if (needsPic) L = L.concat(pictureOptimise('track', true));
      L.push('');
      L.push('  const scroll = (dir) => track.scrollBy({ left: dir * track.clientWidth, behavior: \'smooth\' });');
      L.push("  const nav = document.createElement('div');");
      L.push("  nav.className = '" + id + "-nav';");
      L.push('  [[-1, \'Previous slide\'], [1, \'Next slide\']].forEach(([dir, text]) => {');
      L.push("    const button = document.createElement('button');");
      L.push("    button.type = 'button';");
      L.push("    button.setAttribute('aria-label', text);");
      L.push("    button.className = `" + id + "-${dir < 0 ? 'prev' : 'next'}`;");
      L.push("    button.addEventListener('click', () => scroll(dir));");
      L.push('    nav.append(button);');
      L.push('  });');
      L.push('  block.append(track, nav);');
      return L;
    }
    // list (default)
    L.push("  const ul = document.createElement('ul');");
    L.push('  itemRows.forEach((row) => {');
    L.push("    const li = document.createElement('li');");
    L.push('    moveInstrumentation(row, li);');
    L.push('    while (row.firstElementChild) li.append(row.firstElementChild);');
    var used = {}, cv = lay.item.map(function (g) { return varName(g.key, used); });
    if (cv.length) {
      L.push('    const [' + cv.join(', ') + '] = li.children;');
      cv.forEach(function (v, k) { L.push('    ' + v + "?.classList.add('" + id + '-' + slug(lay.item[k].key) + "');"); });
    }
    L.push('    row.remove();');
    L.push('    ul.append(li);');
    L.push('  });');
    if (needsPic) L = L.concat(pictureOptimise('ul', true));
    L.push('');
    L.push('  block.append(ul);');
    return L;
  }

  /* ---------- CSS scaffold (stylelint-config-standard friendly, mobile first) ---------- */
  function buildCss(spec, lay) {
    var id = blockId(spec), pattern = patternOf(spec), shape = lay.shape, c = [];
    var rule = function (sel, body) { c.push(sel + ' {\n' + body.map(function (l) { return '  ' + l; }).join('\n') + '\n}\n'); };
    if (shape === 'columns') {
      rule('.' + id + ' > div', ['display: flex', 'flex-direction: column'].map(function (x) { return x + ';'; }));
      rule('.' + id + ' > div > div', ['flex: 1', 'padding: 8px 0'].map(function (x) { return x + ';'; }));
      rule('.' + id + ' img', ['width: 100%', 'height: auto'].map(function (x) { return x + ';'; }));
      c.push('@media (width >= 900px) {\n  .' + id + ' > div {\n    flex-direction: row;\n    gap: 32px;\n    align-items: center;\n  }\n}\n');
      return c.join('\n');
    }
    rule('.' + id, ['margin: 0 auto', 'max-width: 1200px'].map(function (x) { return x + ';'; }));
    if (shape === 'container' && pattern === 'list') {
      rule('.' + id + ' > ul', ['display: grid', 'grid-template-columns: repeat(auto-fill, minmax(257px, 1fr))', 'gap: 24px', 'margin: 0', 'padding: 0', 'list-style: none'].map(function (x) { return x + ';'; }));
      rule('.' + id + ' > ul > li', ['overflow: hidden', 'border: 1px solid var(--dark-color)', 'border-radius: 8px', 'background-color: var(--background-color)'].map(function (x) { return x + ';'; }));
      rule('.' + id + ' img', ['display: block', 'width: 100%', 'aspect-ratio: 4 / 3', 'object-fit: cover'].map(function (x) { return x + ';'; }));
      lay.item.forEach(function (g) {
        if (g.items.some(function (it) { return it.f.type !== 'reference'; })) rule('.' + id + '-' + slug(g.key), ['padding: 16px'].map(function (x) { return x + ';'; }));
      });
    } else if (pattern === 'accordion' || pattern === 'faq') {
      rule('.' + id + '-item', ['border-bottom: 1px solid var(--dark-color)'].map(function (x) { return x + ';'; }));
      rule('.' + id + '-label', ['padding: 16px 40px 16px 0', 'font-weight: 700', 'cursor: pointer', 'list-style: none'].map(function (x) { return x + ';'; }));
      rule('.' + id + '-label::-webkit-details-marker', ['display: none;']);
      rule('.' + id + '-label::after', ["content: '+';", 'float: right;', 'margin-right: -32px;', 'font-size: 1.5rem;']);
      rule('.' + id + '-item[open] .' + id + '-label::after', ["content: '−';"]);
      rule('.' + id + '-body', ['padding: 0 0 16px'].map(function (x) { return x + ';'; }));
    } else if (pattern === 'tabs') {
      rule('.' + id + '-list', ['display: flex', 'gap: 8px', 'overflow-x: auto', 'border-bottom: 1px solid var(--dark-color)'].map(function (x) { return x + ';'; }));
      rule('.' + id + '-tab', ['padding: 12px 16px', 'border: 0', 'border-bottom: 3px solid transparent', 'background: none', 'color: inherit', 'font: inherit', 'cursor: pointer', 'white-space: nowrap'].map(function (x) { return x + ';'; }));
      rule('.' + id + '-tab[aria-selected="true"]', ['border-bottom-color: var(--link-color)', 'font-weight: 700'].map(function (x) { return x + ';'; }));
      rule('.' + id + '-panel', ['padding: 24px 0;']);
      rule('.' + id + '-panel[aria-hidden="true"]', ['display: none;']);
    } else if (pattern === 'carousel') {
      rule('.' + id + '-track', ['display: flex', 'margin: 0', 'padding: 0', 'overflow-x: auto', 'list-style: none', 'scroll-snap-type: x mandatory', 'scrollbar-width: none'].map(function (x) { return x + ';'; }));
      rule('.' + id + '-slide', ['flex: 0 0 100%', 'scroll-snap-align: start'].map(function (x) { return x + ';'; }));
      rule('.' + id + ' img', ['display: block', 'width: 100%', 'height: auto'].map(function (x) { return x + ';'; }));
      rule('.' + id + '-nav', ['display: flex', 'justify-content: center', 'gap: 12px', 'padding-top: 12px'].map(function (x) { return x + ';'; }));
      rule('.' + id + '-prev, .' + id + '-next', ['width: 44px', 'height: 44px', 'border: 1px solid var(--dark-color)', 'border-radius: 50%', 'background: var(--background-color)', 'color: var(--text-color)', 'cursor: pointer'].map(function (x) { return x + ';'; }));
      rule('.' + id + '-prev::before', ["content: '‹';"]);
      rule('.' + id + '-next::before', ["content: '›';"]);
    } else {
      lay.parent.forEach(function (g) {
        var hasPic = g.items.some(function (it) { return it.f.type === 'reference'; });
        rule('.' + id + '-' + slug(g.key), hasPic ? ['margin-bottom: 16px;'] : ['margin-bottom: 8px;']);
      });
      if (hasType(lay, 'reference')) rule('.' + id + ' img', ['display: block', 'max-width: 100%', 'height: auto'].map(function (x) { return x + ';'; }));
    }
    var vs = (spec.variants || []).reduce(function (a, o) { return a.concat(o.children ? o.children : [o]); }, []);
    vs.forEach(function (o) {
      var v = slug(o.value || o.name);
      if (v) rule('.' + id + '.' + v, ['/* ' + o.name + ' variant */', 'background-color: var(--light-color);']);
    });
    return c.join('\n');
  }

  /* ---------- checks (mirrors eslint-plugin-xwalk rules, plus authoring sense) ---------- */
  function checkNames(fields, where, out) {
    var seen = {}, names = [];
    (fields || []).forEach(function (f) {
      var n = fieldName(f);
      if (!n) { out.push({ level: 'error', text: where + ': a field has no name or label.', detail: 'Give every field a label so a name can be made from it.' }); return; }
      names.push(n);
      if (!/^[A-Za-z]/.test(n) || /[^A-Za-z0-9_:-]/.test(n) || /_.*_/.test(n) || /:.*:/.test(n)) {
        out.push({ level: 'error', text: where + ': "' + n + '" is not a valid field name.', detail: 'Start with a letter. Use letters, numbers, hyphen, one underscore (for grouping) and at most one colon. No spaces.' });
      }
      if (seen[n]) out.push({ level: 'error', text: where + ': the name "' + n + '" is used twice.', detail: 'Field names must be unique across fields and tabs.' });
      seen[n] = 1;
    });
    names.forEach(function (n) {
      var suffix = null;
      SUFFIXES.forEach(function (s) { if (n.length > s.length && n.slice(-s.length) === s) suffix = s; });
      if (suffix && names.indexOf(n.slice(0, n.length - suffix.length)) < 0) {
        out.push({ level: 'error', text: where + ': "' + n + '" ends in "' + suffix + '" but there is no "' + n.slice(0, n.length - suffix.length) + '" field.', detail: 'The suffixes Text, Title, Type, Alt and MimeType attach to another field. Add the base field, or rename this one.' });
      }
    });
  }
  function check(spec) {
    var out = [], shape = spec.shape || 'simple', title = (spec.name || '').trim();
    if (!title) out.push({ level: 'error', text: 'The block needs a name.', detail: 'The name becomes the block\'s CSS class and its folder name.' });
    if (shape === 'columns') {
      out.push({ level: 'info', text: 'The Columns block has no content model.', detail: 'It only has rows and columns, and its cells take default content (text, titles, images, buttons).' });
      return out;
    }
    var lay = layout(spec), where = shape === 'container' ? 'Block settings' : 'Block';
    checkNames(spec.fields, where, out);
    if (shape === 'container') checkNames(spec.itemFields, 'Item', out);
    var fieldsOf = function (arr, w) {
      (arr || []).forEach(function (f) {
        var T = typeOf(f), n = fieldName(f);
        if (T.opts && (!f.options || !f.options.length)) out.push({ level: 'error', text: w + ': "' + n + '" has no options.', detail: 'Add at least one option, one per line.' });
        if (f.regExp && f.valueFormat !== 'regexp') out.push({ level: 'warn', text: w + ': "' + n + '" has a regular expression but its format is not "regexp".', detail: 'The regExp is only applied when the text format is set to regexp.' });
        if (f.type === 'date-time' && (!f.displayFormat || !f.valueFormat)) out.push({ level: 'warn', text: w + ': "' + n + '" needs both a display format and a value format.', detail: 'Both are required for a date and time field.' });
        if (f.condition && f.condition.field) {
          var known = (arr || []).some(function (g) { return fieldName(g) === f.condition.field; });
          if (!known) out.push({ level: 'warn', text: w + ': "' + n + '" depends on "' + f.condition.field + '", which is not in the same list.', detail: 'A condition can only look at fields of the same dialog.' });
        }
        if (f.multi && f.type !== 'reference') out.push({ level: 'info', text: w + ': "' + n + '" is a multi-value field.', detail: 'Multi-fields need "public.xwalk.multi-field.enabled" set to true in xwalk.json (or the Admin Configuration API).' });
      });
    };
    fieldsOf(spec.fields, where); if (shape === 'container') fieldsOf(spec.itemFields, 'Item');
    var hasClasses = function (arr, withVariants) {
      return !!(withVariants && (spec.variants || []).length) || (arr || []).some(function (f) { var n = fieldName(f); return n === 'classes' || n.indexOf('classes_') === 0; });
    };
    var limit = function (groups, w, extra) {
      var count = groups.length + (extra ? 1 : 0);
      if (shape !== 'keyvalue' && count > 4) out.push({ level: 'warn', text: w + ' would deliver ' + count + ' cells' + (extra ? ' (the style options count as one)' : '') + '; the recommended maximum is 4.', detail: 'Merge related fields with field collapse (Alt, Text, Type suffixes) or element grouping (a shared prefix before an underscore, such as content_title).' });
    };
    limit(lay.parent, where, hasClasses(spec.fields, true)); limit(lay.item, 'Item', false);
    var hasAny = (spec.fields || []).length || (spec.variants || []).length;
    if (shape === 'container') {
      if (!(spec.itemFields || []).length) out.push({ level: 'warn', text: 'The item has no fields yet.', detail: 'Add the fields each item should have.' });
    } else if (!hasAny && !spec.noFields) {
      out.push({ level: 'warn', text: 'This block has no fields and no style options.', detail: 'Authors would get an empty properties panel.' });
    }
    if (!out.some(function (f) { return f.level === 'error' || f.level === 'warn'; })) out.unshift({ level: 'ok', text: 'No problems found in the model.', detail: 'Names, suffixes, cell count and options all pass the same rules as the official linter.' });
    return out;
  }

  /* ---------- import an existing block JSON ---------- */
  function importBundle(input) {
    var data = typeof input === 'string' ? JSON.parse(input) : input;
    if (Array.isArray(data)) throw new Error('Paste one block file with "definitions", "models" and "filters".');
    var defs = data.definitions || [], models = data.models || [], filters = data.filters || [];
    if (!defs.length) throw new Error('No "definitions" found.');
    var tpl = function (d) { return (((d.plugins || {}).xwalk || {}).page || {}).template || {}; };
    var rt = function (d) { return (((d.plugins || {}).xwalk || {}).page || {}).resourceType || ''; };
    var parent = defs.filter(function (d) { return !/\/item$/.test(rt(d)); })[0] || defs[0];
    var pt = tpl(parent), model = function (id) { return models.filter(function (m) { return m.id === id; })[0]; };
    var spec = { v: 1, name: pt.name || parent.title || parent.id, shape: 'simple', pattern: 'plain', variants: [], fields: [], itemFields: [] };
    if (/\/columns\/v1\/columns$/.test(rt(parent))) { spec.shape = 'columns'; return spec; }
    var pf = (pt.filter && filters.filter(function (f) { return f.id === pt.filter; })[0]) || null;
    var itemDef = null;
    if (pf && pf.components) itemDef = defs.filter(function (d) { return d.id === pf.components[0] && /\/item$/.test(rt(d)); })[0] || null;
    if (!itemDef) itemDef = defs.filter(function (d) { return d !== parent && /\/item$/.test(rt(d)); })[0] || null;
    var take = function (m) {
      var fields = [];
      ((m && m.fields) || []).forEach(function (f) {
        if (f.name === 'classes' && f.component === 'multiselect') { spec.variants = clone(f.options || []); if (f.label) spec.variantsLabel = f.label; return; }
        fields.push(importField(f));
      });
      return fields;
    };
    if (itemDef) {
      spec.shape = 'container'; spec.pattern = 'list';
      spec.itemName = tpl(itemDef).name || itemDef.title; spec.itemId = itemDef.id;
      spec.fields = take(pt.model ? model(pt.model) : null);
      spec.itemFields = take(model(tpl(itemDef).model));
    } else {
      spec.shape = pt['key-value'] ? 'keyvalue' : 'simple';
      spec.fields = take(pt.model ? model(pt.model) : null);
    }
    return spec;
  }
  var KNOWN_KEYS = ['component', 'name', 'label', 'valueType', 'description', 'value', 'multi', 'required', 'readOnly', 'hidden', 'options', 'validation', 'condition', 'valueFormat', 'displayFormat', 'variationName'];
  function importField(o) {
    if (!TYPES[o.component]) return { type: 'raw', name: o.name || '', label: o.label || o.name || '', raw: clone(o) };
    var f = { type: o.component, label: o.label || '', name: o.name || '' };
    ['description', 'value', 'valueFormat', 'displayFormat', 'variationName'].forEach(function (k) { if (isSet(o[k])) f[k] = o[k]; });
    if (o.multi) f.multi = true; if (o.required) f.required = true; if (o.readOnly) f.readOnly = true; if (o.hidden) f.hidden = true;
    if (o.options) f.options = clone(o.options);
    if (o.validation) VALIDATION_KEYS.forEach(function (k) { if (isSet(o.validation[k])) f[k] = o.validation[k]; });
    if (o.condition) {
      var op = o.condition['==='] ? '===' : o.condition['!=='] ? '!==' : null, a = op && o.condition[op];
      if (a && a[0] && a[0]['var'] !== undefined) f.condition = { field: a[0]['var'], op: op, value: String(a[1]) };
      else f._extra = Object.assign(f._extra || {}, { condition: o.condition });
    }
    var extra = {}; Object.keys(o).forEach(function (k) { if (KNOWN_KEYS.indexOf(k) < 0) extra[k] = o[k]; });
    if (Object.keys(extra).length) f._extra = Object.assign(f._extra || {}, extra);
    return f;
  }

  /* ---------- minimal ZIP writer (stored, no compression) ---------- */
  var CRC = null;
  function crc32(b) {
    if (!CRC) { CRC = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < b.length; i++) crc = CRC[(crc ^ b[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function zip(files) {
    var enc = new TextEncoder(), now = new Date();
    var time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    var date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    var chunks = [], central = [], offset = 0;
    var u16 = function (v) { return [v & 255, (v >>> 8) & 255]; }, u32 = function (v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; };
    Object.keys(files).forEach(function (path) {
      var name = enc.encode(path), data = enc.encode(files[path]), crc = crc32(data);
      var head = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(time), u16(date), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      chunks.push(new Uint8Array(head), name, data);
      central.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(time), u16(date), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset))), name);
      offset += head.length + name.length + data.length;
    });
    var cdSize = central.reduce(function (a, c) { return a + c.length; }, 0), count = Object.keys(files).length;
    var end = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(count), u16(count), u32(cdSize), u32(offset), u16(0)));
    var all = chunks.concat(central, [end]), total = all.reduce(function (a, c) { return a + c.length; }, 0), out = new Uint8Array(total), pos = 0;
    all.forEach(function (c) { out.set(c, pos); pos += c.length; });
    return out;
  }

  var api = {
    zip: zip, TYPES: TYPES, SUFFIXES: SUFFIXES, HEADINGS: HEADINGS, LINK_TYPE_OPTIONS: LINK_TYPE_OPTIONS, PATTERNS: Object.keys(PATTERN_NOTE), PATTERN_NOTE: PATTERN_NOTE,
    slug: slug, camel: camel, fieldName: fieldName, blockId: blockId, itemName: itemName, itemId: itemId,
    textToOptions: textToOptions, optionsToText: optionsToText, shortcuts: shortcuts,
    build: build, check: check, importBundle: importBundle, cellsOf: cellsOf, fieldObj: fieldObj
  };
  root.KJBB = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

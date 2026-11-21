/* Oak Lucene index definition generator for AEM. Describe the query, get the index as
   .content.xml (for ui.apps) and JSON, plus a matching JCR-SQL2 query. Runs in the browser. */
(function (root) {
  'use strict';

  var TYPES = { string: 'String', long: 'Long', date: 'Date', boolean: 'Boolean', double: 'Double', decimal: 'Decimal', binary: 'Binary', name: 'Name', path: 'Path' };
  var FLAGS = { eq: ['propertyIndex', 'Boolean'], ordered: ['ordered', 'Boolean'], analyzed: ['analyzed', 'Boolean'], fulltext: ['nodeScopeIndex', 'Boolean'], facet: ['facets', 'Boolean'], excerpt: ['useInExcerpt', 'Boolean'] };
  var xesc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var nodeName = function (s) { return s.replace(/[^A-Za-z0-9_:-]/g, '_').replace(/^(\d)/, '_$1') || 'prop'; };

  /* "jcr:content/cq:lastModified date ordered eq" per line -> [{name,type,flags}] and errors */
  function parseProps(text) {
    var props = [], errors = [];
    String(text || '').split(/\r\n|\r|\n/).forEach(function (line, i) {
      line = line.trim(); if (!line || line.charAt(0) === '#') return;
      var p = line.split(/[\s,]+/), type = 'String', flags = [];
      p.slice(1).forEach(function (t) {
        var k = t.toLowerCase();
        if (TYPES[k]) type = TYPES[k]; else if (FLAGS[k]) flags.push(k); else errors.push('Line ' + (i + 1) + ': unknown option "' + t + '". Use a type (' + Object.keys(TYPES).slice(0, 5).join(', ') + '…) or a flag (' + Object.keys(FLAGS).join(', ') + ').');
      });
      if (!flags.length) flags.push('eq');
      props.push({ name: p[0], type: type, flags: flags });
    });
    return { props: props, errors: errors };
  }

  function definition(o) {
    var name = o.name + (o.custom ? '-custom-' + o.version : '');
    var attrs = [['jcr:primaryType', 'oak:QueryIndexDefinition'], ['async', '[async,nrt]'], ['compatVersion', '{Long}2'], ['type', 'lucene'], ['evaluatePathRestrictions', '{Boolean}true']];
    if (o.async === 'async') attrs[1][1] = '[async]';
    if (o.includedPaths.length) attrs.push(['includedPaths', '[' + o.includedPaths.join(',') + ']']);
    if (o.queryPaths.length) attrs.push(['queryPaths', '[' + o.queryPaths.join(',') + ']']);
    if (o.tag) { attrs.push(['selectionPolicy', 'tag']); attrs.push(['tags', '[' + o.tag + ']']); }
    var used = {}, props = o.props.map(function (p) {
      var n = nodeName(p.name.split('/').pop()); while (used[n]) n += '_'; used[n] = 1;
      var a = [['jcr:primaryType', 'nt:unstructured'], ['name', p.name]];
      if (p.type !== 'String') a.push(['type', p.type]);
      p.flags.forEach(function (f) { a.push([FLAGS[f][0], '{Boolean}true']); });
      return { node: n, attrs: a };
    });
    return { name: name, attrs: attrs, nodeType: o.nodeType, props: props };
  }
  function toXml(d) {
    var at = function (list, pad) { return list.map(function (a) { return pad + a[0] + '="' + xesc(a[1]) + '"'; }).join('\n'); };
    var pr = d.props.map(function (p) { return '                <' + p.node + '\n' + at(p.attrs, '                    ') + '/>'; }).join('\n');
    return '<?xml version="1.0" encoding="UTF-8"?>\n<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0" xmlns:nt="http://www.jcp.org/jcr/nt/1.0" xmlns:oak="http://jackrabbit.apache.org/oak/ns/1.0"\n    xmlns:cq="http://www.day.com/jcr/cq/1.0" xmlns:dam="http://www.day.com/dam/1.0" xmlns:sling="http://sling.apache.org/jcr/sling/1.0"\n    jcr:primaryType="nt:unstructured">\n' +
      '    <' + d.name + '\n' + at(d.attrs, '        ') + '>\n        <indexRules jcr:primaryType="nt:unstructured">\n            <' + d.nodeType + ' jcr:primaryType="nt:unstructured">\n                <properties jcr:primaryType="nt:unstructured">\n' +
      pr.replace(/^ {16}/gm, '                    ').replace(/^ {20}(<)/gm, '                    $1') + '\n                </properties>\n            </' + d.nodeType + '>\n        </indexRules>\n    </' + d.name + '>\n</jcr:root>\n';
  }
  function toJson(d) {
    var val = function (v) { var m = String(v).match(/^\{(\w+)\}(.*)$/); if (m) return m[1] === 'Long' ? Number(m[2]) : m[2] === 'true'; if (/^\[.*\]$/.test(v)) return v.slice(1, -1).split(','); return v; };
    var obj = {}; d.attrs.forEach(function (a) { obj[a[0]] = val(a[1]); });
    var props = {}; d.props.forEach(function (p) { var o = {}; p.attrs.forEach(function (a) { o[a[0]] = val(a[1]); }); props[p.node] = o; });
    obj.indexRules = { 'jcr:primaryType': 'nt:unstructured' }; obj.indexRules[d.nodeType] = { 'jcr:primaryType': 'nt:unstructured', properties: Object.assign({ 'jcr:primaryType': 'nt:unstructured' }, props) };
    var top = {}; top[d.name] = obj; return JSON.stringify(top, null, 2);
  }
  function query(o) {
    var p = o.props[0] || { name: 'jcr:content/title', flags: ['eq'] };
    var q = 'SELECT * FROM [' + o.nodeType + '] AS s WHERE ' + (o.queryPaths[0] || o.includedPaths[0] ? "ISDESCENDANTNODE(s, '" + (o.queryPaths[0] || o.includedPaths[0]) + "') AND " : '') +
      (p.flags.indexOf('fulltext') > -1 && p.flags.length === 1 ? "CONTAINS(s.*, 'term')" : 's.[' + p.name + "] = 'value'");
    var ord = o.props.filter(function (x) { return x.flags.indexOf('ordered') > -1; })[0];
    if (ord) q += ' ORDER BY s.[' + ord.name + ']';
    if (o.tag) q += " OPTION(INDEX TAG " + o.tag + ')';
    return q;
  }
  function advice(o) {
    var out = [];
    if (!o.props.length) out.push({ level: 'error', text: 'Add at least one property.' });
    var px = o.nodeType.split(':')[0];
    if (o.nodeType.indexOf(':') > -1 && ['cq', 'dam', 'nt', 'sling', 'jcr', 'mix'].indexOf(px) < 0) out.push({ level: 'warn', text: 'Add the "' + px + '" namespace to the <jcr:root> tag.', detail: 'The generated XML declares jcr, nt, oak, cq, dam and sling only.' });
    if (!o.includedPaths.length) out.push({ level: 'warn', text: 'No includedPaths set.', detail: 'Without it the index covers the whole repository. Limit it to the subtree you query, for example /content/my-site.' });
    if (o.props.some(function (p) { return p.flags.indexOf('analyzed') > -1 && p.type !== 'String'; })) out.push({ level: 'warn', text: 'analyzed only applies to String properties.' });
    if (o.props.some(function (p) { return p.flags.indexOf('ordered') > -1; }) && o.props.some(function (p) { return p.flags.indexOf('ordered') > -1 && p.type === 'String'; })) out.push({ level: 'info', text: 'Ordered String properties sort alphabetically. Use Long or Date for numbers and dates.' });
    if (o.custom) out.push({ level: 'info', text: 'AEM as a Cloud Service: save this under ui.apps/…/jcr_root/_oak_index/' + o.name + '-custom-' + o.version + '/.content.xml, deploy through Cloud Manager and add the index path to the filter.xml.', detail: 'Cloud Service builds new indexes during deployment. To change this index later, raise the number (custom-' + (Number(o.version) + 1) + ').' });
    out.push({ level: 'info', text: 'Check how the query is planned with the Query Performance tool (Tools > Operations > Diagnosis) or by adding "explain" to the query.' });
    return out;
  }

  var api = { parseProps: parseProps, definition: definition, toXml: toXml, toJson: toJson, query: query, advice: advice };
  root.KJOak = api;
  if (typeof module !== 'undefined') { global.KJA = global.KJA || require('./aem-kit.js'); module.exports = api; }
  if (typeof document === 'undefined') return;

  function init() {
    var form = document.getElementById('okForm'); if (!form) return;
    var h = root.KJTools.h, out = document.getElementById('okOut');
    var list = function (s) { return String(s || '').split(/[\s,]+/).filter(Boolean); };
    document.getElementById('okSample').addEventListener('click', function () {
      form.elements.okName.value = 'articleDate'; form.elements.okNodeType.value = 'cq:Page'; form.elements.okPaths.value = '/content/my-site'; form.elements.okTag.value = 'articles';
      form.elements.okProps.value = 'jcr:content/articleDate date ordered\njcr:content/category string eq\njcr:content/jcr:title string fulltext analyzed';
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault(); out.hidden = false; out.textContent = '';
      var pp = parseProps(form.elements.okProps.value);
      var o = { name: form.elements.okName.value.trim().replace(/[^A-Za-z0-9_-]/g, ''), nodeType: form.elements.okNodeType.value.trim() || 'nt:unstructured', includedPaths: list(form.elements.okPaths.value), queryPaths: list(form.elements.okPaths.value),
        tag: form.elements.okTag.value.trim().replace(/[^A-Za-z0-9_-]/g, ''), async: form.elements.okAsync.value, custom: form.elements.okCloud.checked, version: Math.max(1, parseInt(form.elements.okVer.value, 10) || 1), props: pp.props };
      if (!o.name) { out.appendChild(h('p', { class: 'pc-error', role: 'alert', text: 'Give the index a name (letters, numbers, - and _).' })); return; }
      var issues = pp.errors.map(function (t) { return { level: 'error', text: t }; }).concat(advice(o));
      out.appendChild(KJA.findings(issues));
      if (!o.props.length) return;
      var d = definition(o);
      out.appendChild(KJA.codeBlock('.content.xml', toXml(d), '.content.xml', 'Place under ui.apps/src/main/content/jcr_root/_oak_index/' + d.name + '/.content.xml'));
      out.appendChild(KJA.codeBlock('JSON (same definition)', toJson(d), d.name + '.json'));
      out.appendChild(KJA.codeBlock('A query this index can serve', query(o), 'query.sql', 'Run it in the Query Performance tool or CRXDE Lite (JCR-SQL2) to confirm the index is chosen.'));
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);

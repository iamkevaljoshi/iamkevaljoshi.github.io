/* AEM Dispatcher filter tester: paste /filter rules, test URLs, and run a security probe.
   Mirrors the documented behaviour: every element in a rule must match, the last matching
   rule wins, and a request that matches no rule is allowed. Runs in the browser. */
(function (root) {
  'use strict';

  function stripComments(t) { return String(t || '').split(/\r\n|\r|\n/).map(function (l) { return /^\s*#/.test(l) ? '' : l; }).join('\n'); }

  /* Walk the text, matching braces. A block that contains /type is a rule; any other block is searched inside. */
  function parseRules(text) {
    var src = stripComments(text), rules = [], re = /\/([A-Za-z0-9_-]+)\s*\{/g, m;
    function walk(from, to) {
      var r = new RegExp(re.source, 'g'); r.lastIndex = from;
      var mm;
      while ((mm = r.exec(src)) && mm.index < to) {
        var open = mm.index + mm[0].length - 1, depth = 0, i = open;
        for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (!depth) break; } }
        var body = src.slice(open + 1, i);
        if (body.indexOf('{') < 0 && /\/type\s+["']/.test(body)) rules.push(readRule(mm[1], body)); else walk(open + 1, i);
        r.lastIndex = i + 1;
      }
    }
    walk(0, src.length);
    return rules;
  }
  function readRule(name, body) {
    var rule = { name: name, fields: {} }, kv = /\/([A-Za-z]+)\s+(?:"([^"]*)"|'([^']*)')/g, m;
    while ((m = kv.exec(body))) {
      var k = m[1].toLowerCase(), v = m[2] != null ? m[2] : m[3];
      if (k === 'type') rule.type = v.toLowerCase(); else rule.fields[k] = v;
    }
    return rule;
  }

  function globToRe(g) {
    var out = '', i = 0;
    while (i < g.length) {
      var c = g[i];
      if (c === '*') out += '.*';
      else if (c === '?') out += '.';
      else if (c === '[') { var j = g.indexOf(']', i + 1); if (j > -1) { out += '[' + g.slice(i + 1, j).replace(/\\/g, '\\\\') + ']'; i = j; } else out += '\\['; }
      else out += c.replace(/[.+^${}()|\\\]]/g, '\\$&');
      i++;
    }
    return new RegExp('^' + out + '$');
  }
  /* Dispatcher 4.2+ reads most values as POSIX regular expressions, while the long-standing defaults
     also use globs such as "/content/*". A value with regex-only characters is matched as a regex. */
  function matcher(pattern) {
    if (/[()|\\^$+]/.test(pattern)) { try { return new RegExp('^(?:' + pattern + ')$'); } catch (e) { /* fall back to glob */ } }
    return globToRe(pattern);
  }
  var glob = function (pattern, value) { return matcher(pattern).test(value); };

  /* Split "/content/site/en.model.json/suffix?a=b" into the pieces Dispatcher filters on. */
  function parseRequest(line) {
    var m = String(line).trim().match(/^(?:([A-Za-z]+)\s+)?(\S+)$/);
    if (!m) return null;
    var method = (m[1] || 'GET').toUpperCase(), full = m[2];
    if (/^https?:\/\//i.test(full)) { try { var u = new URL(full); full = u.pathname + u.search; } catch (e) { return null; } }
    var qi = full.indexOf('?'), url = qi > -1 ? full.slice(0, qi) : full, query = qi > -1 ? full.slice(qi + 1) : '';
    var path = url, selectors = '', ext = '', suffix = '', core = url;
    var sm = url.match(/^(.*?\.(?:html?|json|xml))(\/.+)$/i);   // a suffix follows the extension
    if (sm) { core = sm[1]; suffix = sm[2]; }
    var ls = core.lastIndexOf('/'), seg = core.slice(ls + 1), dot = seg.indexOf('.');
    if (dot > -1) {
      path = core.slice(0, ls + 1) + seg.slice(0, dot);
      var parts = seg.slice(dot + 1).split('.'); ext = parts.pop(); selectors = parts.join('.');
    } else path = core;
    return { method: method, url: url, query: query, path: path, selectors: selectors, extension: ext, suffix: suffix, line: method + ' ' + full + ' HTTP/1.1' };
  }

  /* Returns { allowed, rule, trace }. `trace` lists every rule with whether it matched. */
  function evaluate(rules, req) {
    var winner = null, trace = rules.map(function (r) {
      var why = null;
      Object.keys(r.fields).some(function (k) {
        if (k === 'glob') { if (!globToRe(r.fields.glob).test(req.line)) { why = 'glob'; return true; } return false; }
        if (!(k in req)) return false;   // fields such as /protocol aren't tested here
        if (!glob(r.fields[k], req[k])) { why = k; return true; }
        return false;
      });
      return { rule: r, matched: !why, failedOn: why };
    });
    trace.forEach(function (t) { if (t.matched) winner = t.rule; });
    return { allowed: !winner || winner.type === 'allow', rule: winner, trace: trace };
  }

  var PROBES = [
    ['/system/console', 'OSGi web console'], ['/crx/de/index.jsp', 'CRXDE Lite'], ['/crx/explorer/index.jsp', 'CRX Explorer'],
    ['/bin/querybuilder.json?path=/content&p.limit=-1', 'QueryBuilder JSON'], ['/bin/wcm/search/gql.json?query=x', 'GQL search servlet'],
    ['/content.infinity.json', 'Infinity JSON dump'], ['/content.-1.json', 'Depth -1 JSON dump'], ['/content/dam.tidy.-1.json', 'Tidy depth -1 dump'],
    ['/etc.json', '/etc JSON listing'], ['/home/users.json', 'User listing'], ['/libs/granite/core/content/login.html', '/libs login page'],
    ['/system/sling/loginstatus.json', 'Sling login status'], ['/content/site/en.html', 'A normal page (should be allowed)']
  ];
  function probe(rules) {
    return PROBES.map(function (p) {
      var req = parseRequest('GET ' + p[0]), ev = evaluate(rules, req), expectAllowed = /should be allowed/.test(p[1]);
      return { url: p[0], label: p[1], allowed: ev.allowed, rule: ev.rule, ok: ev.allowed === expectAllowed };
    });
  }
  function lint(rules) {
    var out = [];
    if (!rules.length) return [{ level: 'error', text: 'No filter rules found.', detail: 'Paste the contents of your /filter section, for example /0001 { /type "deny" /url "*" }.' }];
    var base = rules.some(function (r) { return r.type === 'deny' && (r.fields.url === '*' || r.fields.url === '/*' || r.fields.glob === '*') && Object.keys(r.fields).length === 1; });
    out.push(base ? { level: 'ok', text: 'A deny-everything baseline rule is present.' } : { level: 'error', text: 'No deny-everything baseline rule.', detail: 'A request that matches no rule is allowed. Start the filter with /0001 { /type "deny" /url "*" }.' });
    if (rules.some(function (r) { return 'glob' in r.fields; })) out.push({ level: 'warn', text: 'Some rules use /glob.', detail: 'Matching the whole request line is easy to get wrong. Prefer /url, /method, /extension, /path, /selectors and /suffix.' });
    return out;
  }

  var api = { parseRules: parseRules, parseRequest: parseRequest, evaluate: evaluate, probe: probe, lint: lint, glob: glob };
  root.KJDispatcher = api;
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document === 'undefined') return;

  function init() {
    var form = document.getElementById('dtForm'); if (!form) return;
    var out = document.getElementById('dtOut'), h = root.KJTools.h;
    var sampleRules = '/filter {\n  /0001 { /type "deny"  /url "*" }\n  /0002 { /type "allow" /url "/content/*" /method "GET" }\n  /0003 { /type "allow" /extension "(css|js|png|jpg|svg|woff2)" /path "/etc.clientlibs/*" }\n  /0004 { /type "deny"  /selectors "(feed|rss|pages|languages|blueprint|infinity|tidy)" /extension "(json|xml|html)" }\n  /0005 { /type "deny"  /url "/content/*.infinity.json" }\n}';
    var sampleUrls = 'GET /content/site/en.html\nGET /content/site/en.model.json\nGET /content/site/en.infinity.json\nPOST /content/site/en.html\nGET /etc.clientlibs/site/clientlibs/main.css\nGET /system/console';
    document.getElementById('dtSample').addEventListener('click', function () { form.elements.dtRules.value = sampleRules; form.elements.dtUrls.value = sampleUrls; run(); });
    form.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    function run() {
      out.hidden = false; out.textContent = '';
      var rules = parseRules(form.elements.dtRules.value);
      out.appendChild(h('h3', { text: 'Rule set' }));
      out.appendChild(KJA.findings(lint(rules).concat(rules.length ? [{ level: 'info', text: rules.length + ' rules read. The last matching rule wins; no match means allow.' }] : [])));
      if (!rules.length) return;

      var urls = form.elements.dtUrls.value.split(/\r\n|\r|\n/).map(function (s) { return s.trim(); }).filter(Boolean);
      if (urls.length) {
        out.appendChild(h('h3', { text: 'Your URLs' }));
        urls.forEach(function (u) {
          var req = parseRequest(u);
          if (!req) { out.appendChild(h('p', { class: 'pc-error', text: 'Can\'t read: ' + u })); return; }
          var ev = evaluate(rules, req);
          var det = ev.rule ? 'Decided by rule /' + ev.rule.name + ' (' + ev.rule.type + ').' : 'No rule matched, so Dispatcher allows it.';
          var trace = h('details', null, h('summary', { text: 'Show how each rule matched' }),
            h('div', { class: 'kt-table-wrap' }, h('table', { class: 'pc-table' },
              h('thead', null, h('tr', null, h('th', { text: 'Rule' }), h('th', { text: 'Type' }), h('th', { text: 'Matched' }))),
              h('tbody', null, ev.trace.map(function (t) {
                return h('tr', null, h('th', { text: '/' + t.rule.name }), h('td', { text: t.rule.type }), h('td', { text: t.matched ? 'Yes' : 'No (' + t.failedOn + ')' }));
              })))),
            h('p', { class: 'muted', text: 'Read as: method ' + req.method + ', path ' + req.path + ', selectors "' + req.selectors + '", extension "' + req.extension + '", suffix "' + req.suffix + '", query "' + req.query + '".' }));
          out.appendChild(h('div', { class: 'kt-verdict ' + (ev.allowed ? 'kt-allow' : 'kt-deny') }, (ev.allowed ? 'Allowed: ' : 'Denied: ') + req.method + ' ' + req.url + (req.query ? '?' + req.query : ''), h('small', { text: det }), trace));
        });
      }
      var pr = probe(rules), bad = pr.filter(function (p) { return !p.ok; });
      out.appendChild(h('h3', { text: 'Security probe' }));
      out.appendChild(h('p', { class: 'muted', text: 'These common paths should be blocked on a publish tier. ' + (bad.length ? bad.length + ' of them are not.' : 'All are blocked.') }));
      out.appendChild(KJA.findings(pr.map(function (p) {
        var expect = /should be allowed/.test(p.label);
        return p.ok ? { level: 'ok', text: p.label + ': ' + (p.allowed ? 'allowed' : 'blocked') + ' (' + p.url + ')' }
          : { level: 'error', text: p.label + (p.allowed ? ' is reachable' : ' is blocked, but it should be allowed') + ': ' + p.url, detail: p.rule ? 'Allowed by rule /' + p.rule.name : 'No rule blocks it.' };
      })));
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);

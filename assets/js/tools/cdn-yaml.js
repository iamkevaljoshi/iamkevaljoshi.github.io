/* AEM as a Cloud Service CDN configuration (cdn.yaml) validator.
   Parses with the `yaml` library (window.YAML) so every finding has a line number, then checks the file
   against Adobe's documented schema for kind "CDN": traffic filters and WAF, request and response
   transformations, origin selectors, redirects, authentication and error pages.
   Runs in the browser. Nothing is uploaded. */
(function (root) {
  'use strict';
  var Y = root.YAML || (typeof require === 'function' ? require('yaml') : null);

  /* ---------- the documented schema ---------- */
  var KINDS = ['CDN', 'LogForwarding', 'MaintenanceTasks', 'Otel', 'API', 'EdgeFunctions'];
  var ENV_TYPES = ['dev', 'stage', 'prod', 'rde'];
  var SECTIONS = ['requestTransformations', 'trafficFilters', 'redirects', 'originSelectors', 'responseTransformations', 'authentication', 'errorPages'];
  var GETTERS = ['reqProperty', 'reqHeader', 'queryParam', 'reqCookie', 'postParam', 'var'];
  var RESP_GETTERS = ['respHeader', 'respProperty', 'respCookie'];
  var REQ_PROPS = ['path', 'pathRaw', 'originalPath', 'url', 'urlRaw', 'originalUrl', 'queryString', 'method', 'tier', 'domain', 'clientIp',
    'forwardedDomain', 'forwardedIp', 'clientRegion', 'clientCountry', 'clientContinent', 'clientAsNumber', 'clientAsName'];
  var PREDICATES = ['equals', 'doesNotEqual', 'like', 'notLike', 'matches', 'doesNotMatch', 'in', 'notIn', 'exists'];
  var IP_PREDICATES = ['equals', 'doesNotEqual', 'in', 'notIn'];
  var TIERS = ['author', 'preview', 'publish'];
  var METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'PURGE', 'TRACE', 'CONNECT'];
  var CONTINENTS = ['AF', 'AN', 'AS', 'EU', 'NA', 'OC', 'SA'];
  var WAF_FLAGS = ['ATTACK', 'ATTACK-FROM-BAD-IP', 'SQLI', 'BACKDOOR', 'CMDEXE', 'CMDEXE-NO-BIN', 'XSS', 'TRAVERSAL', 'USERAGENT', 'LOG4J-JNDI', 'CVE',
    'ABNORMALPATH', 'BAD-IP', 'BHH', 'CODEINJECTION', 'COMPRESSED', 'RESPONSESPLIT', 'NOTUTF8', 'MALFORMED-DATA', 'SANS', 'NO-CONTENT-TYPE', 'NOUA',
    'NULLBYTE', 'OOB-DOMAIN', 'PRIVATEFILE', 'SCANNER', 'DATACENTER', 'DOUBLEENCODING', 'JSON-ERROR', 'TORNODE', 'XML-ERROR'];
  var REDIRECT_CODES = [301, 302, 303, 307, 308];
  var MAX_BYTES = 100 * 1024;
  var SECRET_RE = /^\$\{\{\s*[A-Za-z_][A-Za-z0-9_.]*\s*\}\}$/;

  var REQ_TARGETS = { set: ['reqProperty', 'reqHeader', 'queryParam', 'reqCookie', 'logProperty', 'var'],
    unset: ['reqProperty', 'reqHeader', 'queryParam', 'reqCookie', 'logProperty', 'var', 'queryParamMatch', 'queryParamDoesNotMatch'],
    transform: ['reqProperty', 'reqHeader', 'queryParam', 'reqCookie', 'var'] };
  var RESP_TARGETS = { set: ['respProperty', 'respHeader', 'respCookie', 'logProperty', 'var'], unset: ['respHeader', 'respCookie', 'logProperty', 'var'] };
  var COOKIE_ATTRS = ['expires', 'domain', 'path', 'secure', 'httpOnly', 'extension'];
  var ORIGIN_KEYS = ['name', 'domain', 'ip', 'forwardHost', 'forwardCookie', 'forwardAuthorization', 'timeout'];

  /* ---------- small helpers ---------- */
  function lev(a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 1; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function closest(word, list) {
    var best = null, bd = 99;
    list.forEach(function (w) { var dd = lev(String(word), w); if (dd < bd) { bd = dd; best = w; } });
    return bd <= Math.max(2, Math.floor(String(word).length / 4)) ? best : null;
  }
  var q = function (s) { return '"' + s + '"'; };
  var isIp = function (s) {
    s = String(s);
    var m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\/(\d{1,2}))?$/);
    if (m) return m.slice(1, 5).every(function (x) { return +x <= 255; }) && (m[5] == null || +m[5] <= 32);
    var v6 = s.split('/');
    if (v6.length > 2 || (v6[1] != null && !(/^\d{1,3}$/.test(v6[1]) && +v6[1] <= 128))) return false;
    return /^[0-9a-f:.]+$/i.test(v6[0]) && v6[0].indexOf(':') >= 0 && (v6[0].match(/::/g) || []).length <= 1;
  };
  /* Fastly evaluates regexes with PCRE. JavaScript is close enough to catch real mistakes; a few
     PCRE-only constructs are reported as "check in Fastly Fiddle" instead of as errors. */
  function regexProblem(src) {
    var s = String(src).replace(/^\(\?[imsx]+\)/, '');   // a leading inline flag is fine in PCRE
    try { new RegExp(s); return null; } catch (e) {
      if (/\(\?[imsx]+\)|\(\?>|[*+?}]\+|\\[AzZGK]|\(\?P<\w+>|\\[pP]\{\w+\}/.test(s)) return { pcre: true, msg: e.message };
      return { pcre: false, msg: e.message.replace(/^Invalid regular expression: /, '') };
    }
  }

  /* ---------- the checker ---------- */
  function validate(text, opts) {
    opts = opts || {};
    var out = { findings: [], stats: { bytes: 0, rules: 0, sections: [] }, order: [], ok: false, kind: null };
    var F = out.findings;
    var add = function (level, line, text, detail, where) { F.push({ level: level, line: line || null, text: text, detail: detail || '', where: where || '' }); };
    text = String(text == null ? '' : text);
    out.stats.bytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(text).length : Buffer.byteLength(text);
    if (!text.trim()) { add('error', null, 'Nothing to check. Paste the contents of your cdn.yaml.'); return out; }
    if (!Y) { add('error', null, 'The YAML parser did not load. Reload the page and try again.'); return out; }

    var lc = new Y.LineCounter();
    var docs;
    try { docs = Y.parseAllDocuments(text, { lineCounter: lc, prettyErrors: false, uniqueKeys: true, strict: true }); }
    catch (e) { add('error', null, 'The file could not be parsed: ' + e.message); return out; }
    if (!Array.isArray(docs)) docs = [docs];
    var lineOf = function (n) { var r = n && (n.range || (n.key && n.key.range)); return r ? lc.linePos(r[0]).line : null; };

    /* 1. YAML syntax */
    var syntaxErrors = 0;
    var errLine = function (e) { return e.linePos ? e.linePos[0].line : (e.pos ? lc.linePos(e.pos[0]).line : null); };
    docs.forEach(function (doc) {
      doc.errors.forEach(function (e) { syntaxErrors++; add('error', errLine(e), yamlMessage(e, text, errLine(e)), yamlHint(e, text), 'YAML syntax'); });
      doc.warnings.forEach(function (e) { add('warn', errLine(e), yamlMessage(e, text, errLine(e)), yamlHint(e, text), 'YAML syntax'); });
    });
    text.split(/\r\n|\r|\n/).forEach(function (l, i) {
      if (/^\t+/.test(l) && !syntaxErrors) add('error', i + 1, 'Tab used for indentation.', 'YAML only allows spaces for indentation.', 'YAML syntax');
    });
    if (out.stats.bytes > MAX_BYTES) add('error', null, 'The file is ' + (out.stats.bytes / 1024).toFixed(1) + ' KB. Adobe caps the CDN configuration at 100 KB.', 'Move large redirect maps to Dispatcher (RewriteMap) and split rules by concern.', 'Limits');
    if (docs.length > 1) add('warn', lineOf(docs[1].contents), 'The file contains ' + docs.length + ' YAML documents (separated by ---).', 'Use one configuration per file. Only the first document is checked here.', 'Structure');
    if (syntaxErrors) { out.stats.syntaxErrors = syntaxErrors; finish(); return out; }

    var doc = docs[0], top = doc.contents;
    if (!Y.isMap(top)) { add('error', lineOf(top), 'The file must be a YAML mapping with kind, version and data at the top level.'); finish(); return out; }

    /* map helpers bound to the line counter */
    function pairs(map) { return Y.isMap(map) ? map.items : []; }
    function keyOf(p) { return p.key && Y.isScalar(p.key) ? String(p.key.value) : String(p.key); }
    function get(map, key) { var p = pairs(map).find(function (x) { return keyOf(x) === key; }); return p ? p.value : undefined; }
    function has(map, key) { return pairs(map).some(function (x) { return keyOf(x) === key; }); }
    function sv(n) { return Y.isScalar(n) ? n.value : undefined; }
    function lineOfKey(map, key) { var p = pairs(map).find(function (x) { return keyOf(x) === key; }); return p ? lineOf(p.key) : lineOf(map); }
    function unknownKeys(map, allowed, where, label) {
      pairs(map).forEach(function (p) {
        var k = keyOf(p);
        if (allowed.indexOf(k) >= 0) return;
        var near = closest(k, allowed);
        if (near) add('error', lineOf(p.key), q(k) + ' is not a valid ' + label + ' property. Did you mean ' + q(near) + '?', 'Allowed: ' + allowed.join(', ') + '.', where);
        else add('warn', lineOf(p.key), q(k) + ' is not a documented ' + label + ' property.', 'Allowed: ' + allowed.join(', ') + '. The config pipeline validates against Adobe\'s schema, so an unknown property usually fails the deployment.', where);
      });
    }
    function bool(map, key, where) {
      var n = get(map, key);
      if (n === undefined) return undefined;
      if (typeof sv(n) !== 'boolean') { add('error', lineOf(n), q(key) + ' must be true or false.', 'Found ' + JSON.stringify(sv(n)) + '. Don\'t quote booleans.', where); return undefined; }
      return sv(n);
    }

    /* 2. top level */
    unknownKeys(top, ['kind', 'version', 'metadata', 'data'], 'Structure', 'top-level');
    var kind = sv(get(top, 'kind'));
    out.kind = kind;
    if (kind === undefined) add('error', lineOf(top), 'Missing kind. A CDN configuration starts with kind: "CDN".', '', 'Structure');
    else if (KINDS.indexOf(kind) < 0) {
      var nk = KINDS.find(function (k) { return k.toLowerCase() === String(kind).toLowerCase(); }) || closest(kind, KINDS);
      add('error', lineOfKey(top, 'kind'), 'kind ' + q(kind) + ' is not a valid configuration kind' + (nk ? '. Use ' + q(nk) + ' (it\'s case-sensitive).' : '.'), 'Valid kinds: ' + KINDS.join(', ') + '.', 'Structure');
    } else if (kind !== 'CDN') add('info', lineOfKey(top, 'kind'), 'kind ' + q(kind) + ' is valid, but this tool checks kind "CDN" in depth. Only YAML syntax and the common structure were checked.', '', 'Structure');

    var verNode = get(top, 'version');
    if (verNode === undefined) add('error', lineOf(top), 'Missing version. Add version: "1".', '', 'Structure');
    else if (sv(verNode) === 1) add('warn', lineOf(verNode), 'version is the number 1. Adobe\'s documentation uses the string "1".', 'Write version: "1" with quotes.', 'Structure');
    else if (String(sv(verNode)) !== '1') add('error', lineOf(verNode), 'version ' + q(sv(verNode)) + ' is not supported. The CDN configuration uses version: "1".', '', 'Structure');

    var meta = get(top, 'metadata');
    if (meta !== undefined) {
      if (!Y.isMap(meta)) add('error', lineOf(meta), 'metadata must be a mapping, for example metadata: { envTypes: ["dev"] }.', '', 'Structure');
      else {
        unknownKeys(meta, ['envTypes'], 'Structure', 'metadata');
        var et = get(meta, 'envTypes');
        if (et !== undefined) {
          if (!Y.isSeq(et)) add('error', lineOf(et), 'envTypes must be a list, for example envTypes: ["dev", "stage"].', 'A single value also has to be in a list.', 'Structure');
          else {
            if (!et.items.length) add('error', lineOf(et), 'envTypes is empty, so the file applies to no environment.', 'Remove envTypes to apply to all environment types.', 'Structure');
            et.items.forEach(function (n) {
              var v = sv(n);
              if (ENV_TYPES.indexOf(v) < 0) add('error', lineOf(n), 'envTypes value ' + q(v) + ' is not valid.', 'Use dev, stage, prod, or rde (for a Rapid Development Environment).', 'Structure');
            });
            if (opts.eds && et.items.some(function (n) { return sv(n) !== 'prod'; })) add('warn', lineOf(et), 'Edge Delivery Services config pipelines only accept envTypes: ["prod"].', '', 'Structure');
          }
        }
      }
    }
    var data = get(top, 'data');
    if (data === undefined) { add('error', lineOf(top), 'Missing data. The rules go under a top-level data: key.', '', 'Structure'); finish(); return out; }
    if (!Y.isMap(data)) { add('error', lineOf(data), 'data must be a mapping of sections such as trafficFilters or redirects.', '', 'Structure'); finish(); return out; }
    if (kind && kind !== 'CDN' && KINDS.indexOf(kind) >= 0) { finish(); return out; }
    if (!data.items.length) add('warn', lineOf(data), 'data is empty, so the file changes nothing.', '', 'Structure');
    unknownKeys(data, SECTIONS, 'Structure', 'data section');

    /* collected for cross-checks */
    var pathRewritten = [], pathUsers = [], allNames = {};

    /* ---------- conditions ---------- */
    function checkGetter(map, where, allowResp, gk) {
      var v = sv(get(map, gk));
      var ln = lineOfKey(map, gk);
      if (gk === 'reqProperty') {
        if (REQ_PROPS.indexOf(v) < 0) {
          var n2 = closest(v, REQ_PROPS);
          if (n2) add('error', ln, 'reqProperty ' + q(v) + ' doesn\'t exist. Did you mean ' + q(n2) + '?', 'Request properties are case-sensitive. Available: ' + REQ_PROPS.join(', ') + '.', where);
          else add('warn', ln, 'reqProperty ' + q(v) + ' isn\'t in Adobe\'s documented list.', 'If Adobe added it recently, ignore this. Otherwise the deployment fails. Documented: ' + REQ_PROPS.join(', ') + '.', where);
        }
        return v;
      }
      if (gk === 'respProperty' && v !== 'status') add('error', ln, 'respProperty ' + q(v) + ' doesn\'t exist. The only response property is "status".', '', where);
      if (gk !== 'respProperty' && (v === undefined || v === null || v === '')) add('error', ln, gk + ' needs a name, for example ' + gk + ': user-agent.', '', where);
      return v;
    }
    function checkWhen(node, where, ctx) {
      if (node === undefined) return;
      if (Y.isScalar(node)) {
        if (node.value !== '*') add('error', lineOf(node), 'when: ' + JSON.stringify(node.value) + ' is not a condition.', 'Use when: "*" to match every request, or a condition such as when: { reqProperty: path, like: "/api/*" }.', where);
        return;
      }
      if (Y.isSeq(node)) { add('error', lineOf(node), 'A condition can\'t be a bare list. Wrap the list in allOf: (all must match) or anyOf: (any can match).', '', where); return; }
      if (!Y.isMap(node)) { add('error', lineOf(node), 'Invalid condition.', '', where); return; }
      var keys = pairs(node).map(keyOf);
      var group = keys.filter(function (k) { return k === 'allOf' || k === 'anyOf'; });
      if (group.length) {
        if (keys.length > 1) add('error', lineOf(node), 'A condition with ' + group[0] + ' can\'t have other keys next to it (' + keys.filter(function (k) { return k !== group[0]; }).join(', ') + ').', 'Put each condition inside the ' + group[0] + ' list.', where);
        group.forEach(function (g) {
          var list = get(node, g);
          if (!Y.isSeq(list)) { add('error', lineOf(list) || lineOf(node), g + ' must be a list of conditions.', '', where); return; }
          if (!list.items.length) add('error', lineOf(list), g + ' is empty.', '', where);
          if (list.items.length === 1) add('info', lineOf(list), g + ' has a single condition, so it isn\'t needed.', '', where);
          list.items.forEach(function (c) { checkWhen(c, where, ctx); });
        });
        return;
      }
      var getters = GETTERS.concat(ctx && ctx.resp ? RESP_GETTERS : []);
      var g = keys.filter(function (k) { return getters.indexOf(k) >= 0; });
      var p = keys.filter(function (k) { return PREDICATES.indexOf(k) >= 0; });
      keys.forEach(function (k) {
        if (getters.indexOf(k) >= 0 || PREDICATES.indexOf(k) >= 0) return;
        var near = closest(k, getters.concat(PREDICATES, ['allOf', 'anyOf']));
        if (RESP_GETTERS.indexOf(k) >= 0) add('error', lineOfKey(node, k), k + ' can only be used in responseTransformations conditions.', '', where);
        else add('error', lineOfKey(node, k), q(k) + ' isn\'t a valid condition key.' + (near ? ' Did you mean ' + q(near) + '?' : ''), 'A condition is one getter (' + GETTERS.join(', ') + ') and one predicate (' + PREDICATES.join(', ') + '), or allOf / anyOf.', where);
      });
      if (g.length !== 1) { if (!keys.some(function (k) { return getters.indexOf(k) < 0 && PREDICATES.indexOf(k) < 0; })) add('error', lineOf(node), g.length ? 'A condition can only have one getter; found ' + g.join(' and ') + '.' : 'The condition has no getter such as reqProperty, reqHeader or queryParam.', 'Combine several checks with allOf or anyOf.', where); return; }
      if (p.length !== 1) { add('error', lineOf(node), p.length ? 'A condition can only have one predicate; found ' + p.join(' and ') + '.' : 'The condition has no predicate such as equals, like, matches or in.', 'Combine several checks with allOf or anyOf.', where); return; }
      var gk = g[0], pk = p[0], pv = get(node, pk), pln = lineOfKey(node, pk);
      var prop = checkGetter(node, where, ctx && ctx.resp, gk);
      if (gk === 'reqProperty' && prop === 'path' && ctx && ctx.section !== 'requestTransformations') pathUsers.push({ line: lineOfKey(node, gk), where: where });

      // value shapes
      if (pk === 'in' || pk === 'notIn') {
        if (!Y.isSeq(pv)) { add('error', pln, pk + ' needs a list, for example ' + pk + ': ["a", "b"].', '', where); return; }
        if (!pv.items.length) add('error', pln, pk + ' has an empty list.', '', where);
      } else if (pk === 'exists') {
        if (typeof sv(pv) !== 'boolean') add('error', pln, 'exists must be true or false.', '', where);
        return;
      } else if (!Y.isScalar(pv) || pv.value === null) { add('error', pln, pk + ' needs a single value.', pk === 'equals' ? 'To compare against several values, use in: [ ... ].' : '', where); return; }
      var values = Y.isSeq(pv) ? pv.items.map(function (n) { return { v: sv(n), line: lineOf(n) }; }) : [{ v: sv(pv), line: pln }];

      if (pk === 'matches' || pk === 'doesNotMatch') {
        var rp = regexProblem(values[0].v);
        if (rp && !rp.pcre) add('error', pln, 'Invalid regular expression: ' + rp.msg + '.', 'Pattern: ' + values[0].v, where);
        else if (rp) add('info', pln, 'This regex uses PCRE-only syntax, which Fastly supports but this checker can\'t run. Test it in Fastly Fiddle.', 'Pattern: ' + values[0].v, where);
        if (/^\/[\w\-/.]*\*$/.test(values[0].v) && !/\.\*$/.test(values[0].v)) add('warn', pln, pk + ' takes a regular expression, but ' + q(values[0].v) + ' looks like a glob.', 'In a regex, "/*" means "zero or more slashes". Use like: "' + values[0].v + '" for a glob, or matches: "^' + values[0].v.replace(/\*$/, '.*') + '".', where);
      }
      if ((pk === 'like' || pk === 'notLike') && /\.\*|\^|\$|\\[dws.]|\[[^\]]+\]|\(.*\|.*\)/.test(String(values[0].v))) add('warn', pln, pk + ' is a glob (only * and ? are special), but ' + q(values[0].v) + ' looks like a regex.', 'Use matches: for regular expressions.', where);

      if (gk === 'reqProperty') {
        if (prop === 'clientIp') {
          if (IP_PREDICATES.indexOf(pk) < 0) add('error', pln, 'clientIp only supports equals, doesNotEqual, in and notIn, not ' + pk + '.', 'Use in: [ "192.0.2.0/24" ] for ranges.', where);
          values.forEach(function (x) { if (!isIp(x.v)) add('error', x.line, q(x.v) + ' is not a valid IP address or CIDR range.', '', where); else if (/\//.test(String(x.v)) && (pk === 'equals' || pk === 'doesNotEqual')) add('error', x.line, 'CIDR ranges only work with in and notIn, not ' + pk + '.', '', where); });
        }
        if (prop === 'tier' && ['equals', 'doesNotEqual', 'in', 'notIn'].indexOf(pk) >= 0) values.forEach(function (x) { if (TIERS.indexOf(x.v) < 0) add('error', x.line, 'tier ' + q(x.v) + ' never matches. Tiers are author, preview and publish.', '', where); });
        if (prop === 'domain' || prop === 'forwardedDomain') values.forEach(function (x) {
          var s = String(x.v);
          if (/^[a-z]+:\/\//i.test(s) || /\//.test(s.replace(/^[a-z]+:\/\//i, '')) && pk !== 'matches' && pk !== 'doesNotMatch') add('error', x.line, prop + ' is the host name only, without https:// or a path: ' + q(s) + '.', '', where);
          else if (/[A-Z]/.test(s) && pk !== 'matches' && pk !== 'doesNotMatch') add('error', x.line, prop + ' is lower-cased by the CDN, so ' + q(s) + ' never matches.', 'Write it in lower case.', where);
          if (/:\d+$/.test(s)) add('warn', x.line, 'The domain ' + q(s) + ' includes a port. The CDN domain is the host name only.', '', where);
        });
        if (prop === 'method') values.forEach(function (x) { if (METHODS.indexOf(x.v) < 0 && pk !== 'matches' && pk !== 'doesNotMatch' && pk !== 'like') add(String(x.v).toUpperCase() !== x.v ? 'error' : 'warn', x.line, 'method ' + q(x.v) + (String(x.v).toUpperCase() !== x.v ? ' is lower case. HTTP methods are upper case, so it never matches.' : ' isn\'t a standard HTTP method.'), '', where); });
        if (prop === 'clientCountry') values.forEach(function (x) { if (!/^[A-Z]{2}$/.test(String(x.v)) && ['equals', 'doesNotEqual', 'in', 'notIn'].indexOf(pk) >= 0) add('error', x.line, 'clientCountry uses two-letter upper-case ISO codes such as "IN" or "GB"; ' + q(x.v) + ' never matches.', '', where); });
        if (prop === 'clientContinent') values.forEach(function (x) { if (CONTINENTS.indexOf(x.v) < 0 && ['equals', 'doesNotEqual', 'in', 'notIn'].indexOf(pk) >= 0) add('error', x.line, 'clientContinent ' + q(x.v) + ' never matches. Use ' + CONTINENTS.join(', ') + '.', '', where); });
        if (['path', 'originalPath', 'url', 'originalUrl', 'pathRaw', 'urlRaw'].indexOf(prop) >= 0 && ['equals', 'doesNotEqual', 'like', 'notLike', 'in', 'notIn'].indexOf(pk) >= 0) values.forEach(function (x) {
          var s = String(x.v);
          if (/^https?:\/\//i.test(s)) add('error', x.line, prop + ' is the path, not a full URL: ' + q(s) + '.', 'Use the domain getter for the host and ' + prop + ' for the path.', where);
          else if (s && s[0] !== '/' && s[0] !== '*') add('warn', x.line, prop + ' values start with "/"; ' + q(s) + ' never matches as written.', '', where);
          if ((prop === 'path' || prop === 'originalPath') && /\?/.test(s) && pk.indexOf('ike') < 0) add('warn', x.line, prop + ' doesn\'t include the query string, so ' + q(s) + ' never matches.', 'Use url or originalUrl, or queryParam.', where);
        });
      }
    }

    /* value used by set actions, origin headers and redirect locations: a literal or a getter object */
    function checkValueNode(n, where, label) {
      if (n === undefined) return;
      if (Y.isMap(n) && has(n, 'join')) {
        var j = get(n, 'join');
        if (!Y.isMap(j)) { add('error', lineOf(j), 'join must be a mapping with format and args.', '', where); return; }
        unknownKeys(j, ['format', 'args'], where, 'join');
        var fmt = sv(get(j, 'format')), args = get(j, 'args');
        if (typeof fmt !== 'string') add('error', lineOf(j), 'join needs a format string such as \'https://www.%s%s\'.', '', where);
        if (!Y.isSeq(args)) add('error', lineOf(args || j), 'join needs an args list of getters.', '', where);
        else {
          args.items.forEach(function (a) { checkValueNode(a, where, 'join argument'); });
          var slots = typeof fmt === 'string' ? (fmt.match(/%s/g) || []).length : args.items.length;
          if (slots !== args.items.length) add('error', lineOf(j), 'format has ' + slots + ' %s placeholder' + (slots === 1 ? '' : 's') + ' but args has ' + args.items.length + ' value' + (args.items.length === 1 ? '' : 's') + '.', '', where);
        }
        pairs(n).forEach(function (p) { if (keyOf(p) !== 'join') add('error', lineOf(p.key), q(keyOf(p)) + ' can\'t be used next to join.', '', where); });
        return;
      }
      if (Y.isMap(n)) {
        var ks = pairs(n).map(keyOf);
        var getters = GETTERS.concat(RESP_GETTERS);
        var g = ks.filter(function (k) { return getters.indexOf(k) >= 0; });
        if (g.length !== 1) add('error', lineOf(n), label + ' must be a literal value or a single getter such as { reqHeader: x-forwarded-host }.', '', where);
        else checkGetter(n, where, true, g[0]);
        ks.forEach(function (k) { if (getters.indexOf(k) < 0 && k !== 'transform') add('error', lineOfKey(n, k), q(k) + ' isn\'t valid inside ' + label + '.', '', where); });
      } else if (Y.isSeq(n)) add('error', lineOf(n), label + ' can\'t be a list.', '', where);
    }

    /* ---------- rules ---------- */
    function rulesOf(sec, where, section, ruleKeys, fn) {
      var rules = get(sec, 'rules');
      if (rules === undefined) { if (section !== 'originSelectors' && section !== 'authentication') add('warn', lineOf(sec), where + ' has no rules list.', 'Rules go under ' + section + ': rules: [ ... ].', where); return []; }
      if (!Y.isSeq(rules)) { add('error', lineOf(rules), 'rules must be a list. Start each rule with "- name: ...".', '', where); return []; }
      if (!rules.items.length) add('warn', lineOf(rules), where + ' has an empty rules list.', '', where);
      var seen = {};
      rules.items.forEach(function (r, i) {
        if (!Y.isMap(r)) { add('error', lineOf(r), 'Rule ' + (i + 1) + ' must be a mapping with name, when and action.', 'Check the indentation under "- ".', where); return; }
        out.stats.rules++;
        var nameN = get(r, 'name'), name = sv(nameN), w = where + (name ? ' › ' + name : ' › rule ' + (i + 1));
        if (name === undefined || name === null || name === '') add('error', lineOf(r), 'Rule ' + (i + 1) + ' has no name.', 'Every rule needs a unique name. It appears in the CDN logs.', where);
        else {
          if (typeof name !== 'string') add('warn', lineOf(nameN), 'Rule name ' + q(name) + ' is not a string. Quote it.', '', w);
          if (seen[name]) add('error', lineOf(nameN), 'Duplicate rule name ' + q(name) + ' (also on line ' + seen[name] + ').', 'Rule names must be unique within a section.', w);
          seen[name] = lineOf(nameN);
          if (section === 'trafficFilters') {
            if (String(name).length > 64) add('error', lineOf(nameN), 'Traffic filter rule names can be at most 64 characters (' + String(name).length + ' here).', '', w);
            if (!/^[A-Za-z0-9-]+$/.test(String(name))) add('error', lineOf(nameN), 'Traffic filter rule name ' + q(name) + ' may only contain letters, digits and hyphens.', '', w);
          } else if (!/^[A-Za-z0-9_-]+$/.test(String(name))) add('info', lineOf(nameN), 'Rule name ' + q(name) + ' contains spaces or symbols. Letters, digits and hyphens are safest.', '', w);
          if (allNames[name] && allNames[name] !== section) add('info', lineOf(nameN), 'Rule name ' + q(name) + ' is also used in ' + allNames[name] + '. Unique names make the CDN logs easier to read.', '', w);
          allNames[name] = section;
        }
        unknownKeys(r, ruleKeys, w, 'rule');
        if (!has(r, 'when')) add('error', lineOf(r), 'Rule ' + q(name || i + 1) + ' has no when condition.', 'Use when: "*" to apply it to every request.', w);
        else checkWhen(get(r, 'when'), w, { section: section, resp: section === 'responseTransformations' });
        out.order.push({ section: section, name: name || ('rule ' + (i + 1)), line: lineOf(r) });
        fn(r, w, name);
      });
      return rules.items;
    }

    function checkActions(r, w, targets, isReq) {
      if (has(r, 'action') && !has(r, 'actions')) { add('error', lineOfKey(r, 'action'), 'Transformation rules use actions: (plural, a list), not action:.', '', w); return; }
      var acts = get(r, 'actions');
      if (acts === undefined) { add('error', lineOf(r), 'Missing actions list.', '', w); return; }
      if (!Y.isSeq(acts)) { add('error', lineOf(acts), 'actions must be a list. Start each action with "- type: ...".', '', w); return; }
      acts.items.forEach(function (a) {
        if (!Y.isMap(a)) { add('error', lineOf(a), 'Each action must be a mapping with a type.', '', w); return; }
        var type = sv(get(a, 'type'));
        if (type === 'respond' && isReq) {
          // documented in Adobe's CDN snippets: answer at the edge without reaching the origin
          pairs(a).forEach(function (p) { var k = keyOf(p); if (['type', 'status', 'reason', 'headers'].indexOf(k) < 0) add('warn', lineOf(p.key), q(k) + ' isn\'t a documented property of a respond action.', 'Documented: status, reason, headers.', w); });
          var rs = sv(get(a, 'status'));
          if (rs === undefined) add('error', lineOf(a), 'respond needs a status, for example status: 200.', '', w);
          else if (!(Number.isInteger(rs) && rs >= 100 && rs <= 599)) add('error', lineOfKey(a, 'status'), 'status must be an HTTP status code (100–599).', '', w);
          var rh = get(a, 'headers');
          if (rh !== undefined) { if (!Y.isMap(rh)) add('error', lineOf(rh), 'headers must be a mapping of header name to value.', '', w); else pairs(rh).forEach(function (p) { checkValueNode(p.value, w, 'header ' + keyOf(p)); }); }
          return;
        }
        if (!targets[type]) { var nt = closest(type || '', Object.keys(targets)); add('error', lineOf(a), type ? 'Action type ' + q(type) + ' is not valid here.' + (nt ? ' Did you mean ' + q(nt) + '?' : '') : 'Action has no type.', 'Allowed: ' + Object.keys(targets).join(', ') + '.', w); return; }
        var allowed = targets[type];
        var ks = pairs(a).map(keyOf);
        var tk = ks.filter(function (k) { return allowed.indexOf(k) >= 0; });
        var extra = { set: ['value', 'attributes'], unset: [], transform: ['op', 'match', 'replacement'] }[type];
        ks.forEach(function (k) {
          if (k === 'type' || tk.indexOf(k) >= 0 || extra.indexOf(k) >= 0) return;
          var all = [].concat(targets.set || [], targets.unset || [], targets.transform || []);
          if (all.indexOf(k) >= 0) add('error', lineOfKey(a, k), q(k) + ' can\'t be used with type ' + type + '.', 'With ' + type + ', use one of: ' + allowed.join(', ') + '.', w);
          else if (k === 'value' || k === 'op' || k === 'match' || k === 'replacement') add('error', lineOfKey(a, k), q(k) + ' isn\'t used by type ' + type + '.', '', w);
          else { var nk = closest(k, allowed.concat(extra)); add('error', lineOfKey(a, k), q(k) + ' isn\'t a valid action property.' + (nk ? ' Did you mean ' + q(nk) + '?' : ''), '', w); }
        });
        if (tk.length !== 1) { add('error', lineOf(a), tk.length ? 'An action targets one thing; found ' + tk.join(' and ') + '.' : type + ' action has no target such as ' + allowed.slice(0, 3).join(', ') + '.', '', w); return; }
        var t = tk[0], tv = sv(get(a, t));
        if (t === 'reqProperty' && tv !== 'path') add('error', lineOfKey(a, t), 'Only reqProperty: path can be changed by a request transformation, not ' + q(tv) + '.', '', w);
        if (t === 'respProperty' && tv !== 'status') add('error', lineOfKey(a, t), 'Only respProperty: status can be set.', '', w);
        if (t === 'reqProperty' && tv === 'path' && (type === 'set' || type === 'transform')) pathRewritten.push(lineOf(a));
        if ((t === 'queryParamMatch' || t === 'queryParamDoesNotMatch')) { var rp = regexProblem(tv); if (rp && !rp.pcre) add('error', lineOfKey(a, t), 'Invalid regular expression in ' + t + ': ' + rp.msg + '.', '', w); }
        if (type === 'set') {
          if (!has(a, 'value')) add('error', lineOf(a), 'set needs a value.', 'For example value: "nosniff", or value: { reqProperty: clientCountry }.', w);
          else checkValueNode(get(a, 'value'), w, 'value');
          if (t === 'respProperty' && has(a, 'value')) { var st = sv(get(a, 'value')); if (!(Number.isInteger(st) && st >= 100 && st <= 599)) add('error', lineOfKey(a, 'value'), 'respProperty status must be an HTTP status code between 100 and 599.', '', w); }
          if (has(a, 'attributes')) {
            if (t !== 'respCookie') add('error', lineOfKey(a, 'attributes'), 'attributes only apply to respCookie.', '', w);
            else unknownKeys(get(a, 'attributes'), COOKIE_ATTRS, w, 'cookie attribute');
          }
          if (t === 'respHeader' && /^(cache-control|surrogate-control|expires)$/i.test(String(tv))) add('info', lineOfKey(a, t), 'Setting ' + tv + ' here changes what browsers see, not how long the Adobe CDN caches.', 'Response transformations run after the cache. Set CDN TTLs at the origin (Dispatcher).', w);
          if (t === 'respHeader' && /^set-cookie$/i.test(String(tv))) add('warn', lineOfKey(a, t), 'Use respCookie to set cookies instead of a raw Set-Cookie header.', '', w);
          if (isReq && t === 'reqHeader' && /^(host|x-forwarded-host)$/i.test(String(tv))) add('warn', lineOfKey(a, t), 'Overwriting ' + tv + ' changes how AEM builds absolute links and which site it serves.', 'Check Sling mappings and Dispatcher virtual hosts on dev first.', w);
        }
        if (type === 'unset' && has(a, 'value') && t !== 'respCookie') add('error', lineOfKey(a, 'value'), 'unset doesn\'t take a value.', '', w);
        if (type === 'transform') {
          var op = sv(get(a, 'op'));
          if (op === undefined) add('error', lineOf(a), 'transform needs an op: replace or tolower.', '', w);
          else if (op !== 'replace' && op !== 'tolower') add('error', lineOfKey(a, 'op'), 'op ' + q(op) + ' isn\'t supported. Use replace or tolower.', op === 'toupper' ? 'There is no toupper.' : '', w);
          if (op === 'replace') checkReplace(a, w);
          if (op === 'tolower' && (has(a, 'match') || has(a, 'replacement'))) add('warn', lineOf(a), 'tolower ignores match and replacement.', '', w);
        }
      });
    }
    function checkReplace(a, w) {
      if (!has(a, 'match')) add('error', lineOf(a), 'op: replace needs a match regex.', '', w);
      else { var m = sv(get(a, 'match')), rp = regexProblem(m); if (rp && !rp.pcre) add('error', lineOfKey(a, 'match'), 'Invalid regular expression in match: ' + rp.msg + '.', 'Pattern: ' + m, w); }
      if (!has(a, 'replacement')) add('error', lineOf(a), 'op: replace needs a replacement (use "" to delete the match).', '', w);
      else {
        var rep = String(sv(get(a, 'replacement')));
        if (/\$\d/.test(rep)) add('error', lineOfKey(a, 'replacement'), 'Use \\1, \\2 for capture groups, not $1.', 'The CDN uses backslash references: replacement: \'/products/\\1\'. In double quotes, write "\\\\1".', w);
        var groups = 0; try { groups = (new RegExp(String(sv(get(a, 'match'))) + '|').exec('') || []).length - 1; } catch (e) { groups = 9; }
        (rep.match(/\\(\d)/g) || []).forEach(function (b) { if (+b[1] > groups) add('error', lineOfKey(a, 'replacement'), 'replacement uses ' + b + ' but match has only ' + groups + ' capture group' + (groups === 1 ? '' : 's') + '.', '', w); });
      }
    }

    /* ---------- sections ---------- */
    var sec;
    if ((sec = get(data, 'requestTransformations')) !== undefined) {
      var W = 'Request transformations';
      if (!Y.isMap(sec)) add('error', lineOf(sec), 'requestTransformations must be a mapping with a rules list.', '', W);
      else {
        unknownKeys(sec, ['rules', 'removeMarketingParams'], W, 'requestTransformations');
        bool(sec, 'removeMarketingParams', W);
        rulesOf(sec, W, 'requestTransformations', ['name', 'when', 'actions'], function (r, w) { checkActions(r, w, REQ_TARGETS, true); });
      }
    }
    if ((sec = get(data, 'trafficFilters')) !== undefined) {
      W = 'Traffic filters';
      if (!Y.isMap(sec)) add('error', lineOf(sec), 'trafficFilters must be a mapping with a rules list.', '', W);
      else {
        unknownKeys(sec, ['rules', 'defaultTrafficAlerts'], W, 'trafficFilters');
        bool(sec, 'defaultTrafficAlerts', W);
        var usesWaf = false, hasBlockAll = false;
        rulesOf(sec, W, 'trafficFilters', ['name', 'when', 'action', 'rateLimit'], function (r, w) {
          if (has(r, 'actions') && !has(r, 'action')) { add('error', lineOfKey(r, 'actions'), 'Traffic filter rules use action: (singular), not actions:.', '', w); return; }
          var a = get(r, 'action'), type, flags = null;
          if (a === undefined) { add('error', lineOf(r), 'Missing action. Use allow, block or log.', '', w); return; }
          if (Y.isScalar(a)) type = a.value;
          else if (Y.isMap(a)) {
            unknownKeys(a, ['type', 'wafFlags', 'alert', 'status'], w, 'traffic filter action');
            type = sv(get(a, 'type'));
            bool(a, 'alert', w);
            var wf = get(a, 'wafFlags');
            if (wf !== undefined) {
              usesWaf = true;
              if (!Y.isSeq(wf)) add('error', lineOf(wf), 'wafFlags must be a list, for example wafFlags: [SQLI, XSS].', '', w);
              else { flags = wf.items.map(sv); wf.items.forEach(function (n) { var f = sv(n); if (WAF_FLAGS.indexOf(f) < 0 && !/^CVE-\d{4}-\d{4,}$/.test(String(f))) { var nf = closest(String(f), WAF_FLAGS); add('error', lineOf(n), 'Unknown WAF flag ' + q(f) + '.' + (nf ? ' Did you mean ' + q(nf) + '?' : ''), 'Flags are upper case, for example SQLI, XSS, ATTACK, ATTACK-FROM-BAD-IP, SCANNER.', w); } }); }
            }
            var st = get(a, 'status');
            if (st !== undefined) {
              if (type !== 'block') add('error', lineOf(st), 'status only applies to block actions.', '', w);
              var sn = sv(st); if (!(Number.isInteger(sn) && sn >= 400 && sn <= 599)) add('error', lineOf(st), 'status must be an HTTP error code (400–599). Blocked requests get 406 by default.', '', w);
              if (wf !== undefined) add('warn', lineOf(st), 'Adobe documents status and wafFlags as mutually exclusive on a block action.', '', w);
            }
          } else { add('error', lineOf(a), 'action must be allow, block or log, or a mapping with type.', '', w); return; }
          if (['allow', 'block', 'log'].indexOf(type) < 0) { var nt = closest(String(type), ['allow', 'block', 'log']); add('error', lineOf(a), 'Action type ' + q(type) + ' is not valid.' + (nt ? ' Did you mean ' + q(nt) + '?' : ''), 'Use allow, block or log.', w); }
          var rl = get(r, 'rateLimit');
          if (rl !== undefined) checkRateLimit(rl, w, flags, type, a);
          var whenAll = Y.isScalar(get(r, 'when')) && sv(get(r, 'when')) === '*';
          if (whenAll && type === 'allow' && !flags) add('warn', lineOf(r), 'This rule allows every request. Allow rules win over block rules, so it disables every block rule in the file.', '', w);
          if (whenAll && type === 'block' && !flags && rl === undefined) { hasBlockAll = true; add('error', lineOf(r), 'This rule blocks every request to the site.', 'Add a condition, a rateLimit or wafFlags.', w); }
          if (type === 'block' && flags && flags.some(function (f) { return f !== 'ATTACK-FROM-BAD-IP'; }) && !opts.quiet) add('info', lineOf(a), 'Blocking on WAF flags straight away can block real users. Adobe recommends starting with type: log and alert: true, reviewing the CDN logs, then switching to block.', '', w);
        });
        if (usesWaf) add('info', lineOfKey(data, 'trafficFilters'), 'WAF flags need the Extended Security (WAF-DDoS) licence and WAF-DDoS protection enabled on the Cloud Manager Security tab. Without both, wafFlags rules do nothing.', '', W);
        void hasBlockAll;
      }
    }
    function checkRateLimit(rl, w, flags, type, a) {
      if (!Y.isMap(rl)) { add('error', lineOf(rl), 'rateLimit must be a mapping with limit, window and penalty.', '', w); return; }
      unknownKeys(rl, ['limit', 'window', 'penalty', 'count', 'groupBy'], w, 'rateLimit');
      if (flags) add('error', lineOf(rl), 'A rate limit rule can\'t use wafFlags.', 'Split it into two rules.', w);
      var lim = sv(get(rl, 'limit'));
      if (lim === undefined) add('error', lineOf(rl), 'rateLimit needs a limit (requests per second, per CDN POP, 10–10000).', '', w);
      else if (!Number.isInteger(lim) || lim < 10 || lim > 10000) add('error', lineOfKey(rl, 'limit'), 'limit must be a whole number from 10 to 10000 (found ' + lim + ').', 'It is requests per second, counted per CDN POP.', w);
      var win = sv(get(rl, 'window'));
      if (win !== undefined && [1, 10, 60].indexOf(win) < 0) add('error', lineOfKey(rl, 'window'), 'window must be 1, 10 or 60 seconds (found ' + win + ').', '', w);
      var pen = sv(get(rl, 'penalty'));
      if (pen !== undefined && (!Number.isInteger(pen) || pen < 60 || pen > 3600)) add('error', lineOfKey(rl, 'penalty'), 'penalty must be 60–3600 seconds (found ' + pen + ').', '', w);
      var cnt = sv(get(rl, 'count'));
      if (cnt !== undefined && ['all', 'fetches', 'errors'].indexOf(cnt) < 0) add('error', lineOfKey(rl, 'count'), 'count must be all, fetches or errors.', '', w);
      var gb = get(rl, 'groupBy');
      if (gb !== undefined) {
        if (!Y.isSeq(gb)) add('error', lineOf(gb), 'groupBy must be a list of getters, for example groupBy: [ { reqProperty: clientIp } ].', '', w);
        else gb.items.forEach(function (n) { if (!Y.isMap(n)) add('error', lineOf(n), 'Each groupBy entry is a getter such as { reqProperty: clientIp }.', '', w); else checkValueNode(n, w, 'groupBy entry'); });
      }
      if (type === 'block' && !(Y.isMap(a) && sv(get(a, 'alert')) === true)) add('info', lineOf(rl), 'Consider alert: true on rate-limit rules so the team hears when it triggers.', '', w);
    }

    if ((sec = get(data, 'redirects')) !== undefined) {
      W = 'Redirects';
      if (!Y.isMap(sec)) add('error', lineOf(sec), 'redirects must be a mapping with a rules list.', '', W);
      else {
        unknownKeys(sec, ['rules'], W, 'redirects');
        rulesOf(sec, W, 'redirects', ['name', 'when', 'action'], function (r, w) {
          var a = get(r, 'action');
          if (a === undefined) { add('error', lineOf(r), 'Missing action. Use action: { type: redirect, status: 301, location: /new-path }.', '', w); return; }
          if (!Y.isMap(a)) { add('error', lineOf(a), 'action must be a mapping with type: redirect and a location.', '', w); return; }
          unknownKeys(a, ['type', 'status', 'location'], w, 'redirect action');
          if (sv(get(a, 'type')) !== 'redirect') add('error', lineOf(a), 'Redirect actions need type: redirect.', '', w);
          var st = get(a, 'status');
          if (st === undefined) add('info', lineOf(a), 'No status, so this is a permanent 301 redirect.', 'Browsers cache 301s. Set status: 302 for anything temporary, such as a campaign.', w);
          else if (REDIRECT_CODES.indexOf(sv(st)) < 0) add('error', lineOf(st), 'Redirect status ' + q(sv(st)) + ' is not supported. Use 301, 302, 303, 307 or 308.', '', w);
          var loc = get(a, 'location');
          if (loc === undefined) { add('error', lineOf(a), 'Missing location.', '', w); return; }
          if (Y.isScalar(loc)) {
            var s = String(loc.value);
            if (!s) add('error', lineOf(loc), 'location is empty.', '', w);
            if (/\\\d/.test(s)) add('error', lineOf(loc), 'A literal location can\'t use capture groups such as \\1.', 'Use location: { reqProperty: path, transform: [ { op: replace, match: ..., replacement: ... } ] }.', w);
            if (/^http:\/\//i.test(s)) add('warn', lineOf(loc), 'The redirect target uses http://. Redirect to https:// to avoid a second hop.', '', w);
            if (s && !/^(https?:\/\/|\/)/i.test(s)) add('warn', lineOf(loc), 'location ' + q(s) + ' is neither a path starting with / nor an absolute URL.', '', w);
            // a redirect to the exact path it matches is a loop
            var wn = get(r, 'when');
            if (Y.isMap(wn) && ['path', 'originalPath', 'url', 'originalUrl'].indexOf(sv(get(wn, 'reqProperty'))) >= 0 && sv(get(wn, 'equals')) === s) add('error', lineOf(loc), 'This redirect points to the same path it matches, so it loops.', '', w);
          } else if (Y.isMap(loc)) {
            unknownKeys(loc, ['reqProperty', 'reqHeader', 'queryParam', 'reqCookie', 'var', 'transform', 'join'], w, 'location');
            checkValueNode(loc, w, 'location');
            var tr = get(loc, 'transform');
            if (tr !== undefined) {
              if (!Y.isSeq(tr)) add('error', lineOf(tr), 'transform must be a list, for example transform: [ { op: replace, match: ..., replacement: ... } ].', '', w);
              else tr.items.forEach(function (t) {
                if (!Y.isMap(t)) { add('error', lineOf(t), 'Each transform is a mapping with an op.', '', w); return; }
                unknownKeys(t, ['op', 'match', 'replacement'], w, 'transform');
                var op = sv(get(t, 'op'));
                if (op !== 'replace' && op !== 'tolower') add('error', lineOf(t), 'transform op ' + q(op) + ' isn\'t supported. Use replace or tolower.', '', w);
                if (op === 'replace') checkReplace(t, w);
              });
            }
          } else add('error', lineOf(loc), 'location must be a string or a getter with transforms.', '', w);
        });
      }
    }

    var origins = {}, usedOrigins = {}, cookieOrigins = {};
    if ((sec = get(data, 'originSelectors')) !== undefined) {
      W = 'Origin selectors';
      if (!Y.isMap(sec)) add('error', lineOf(sec), 'originSelectors must be a mapping with rules and origins.', '', W);
      else {
        unknownKeys(sec, ['rules', 'origins'], W, 'originSelectors');
        var ol = get(sec, 'origins');
        if (ol !== undefined && !Y.isSeq(ol)) add('error', lineOf(ol), 'origins must be a list. Start each origin with "- name: ...".', '', W);
        else if (ol) ol.items.forEach(function (o, i) {
          if (!Y.isMap(o)) { add('error', lineOf(o), 'Each origin must be a mapping with name and domain.', '', W); return; }
          var on = sv(get(o, 'name')), w = W + ' › origin ' + (on || i + 1);
          unknownKeys(o, ORIGIN_KEYS, w, 'origin');
          if (!on) add('error', lineOf(o), 'Origin ' + (i + 1) + ' has no name.', '', w);
          else if (origins[on]) add('error', lineOfKey(o, 'name'), 'Duplicate origin name ' + q(on) + '.', '', w);
          else origins[on] = lineOfKey(o, 'name');
          var dn = get(o, 'domain'), d = sv(dn);
          if (d === undefined) add('error', lineOf(o), 'Origin ' + q(on) + ' has no domain.', '', w);
          else {
            d = String(d);
            if (/^[a-z]+:\/\//i.test(d)) add('error', lineOf(dn), 'domain is the host name only, without ' + d.split('//')[0] + '//.', 'Origins are always reached over HTTPS on port 443.', w);
            else if (/[/?#]/.test(d)) add('error', lineOf(dn), 'domain can\'t contain a path. Rewrite the path with a request transformation instead.', '', w);
            else if (/:\d+$/.test(d)) add('error', lineOf(dn), 'domain can\'t include a port. Origins are reached over HTTPS on port 443 only.', '', w);
            if (/\.adobeaemcloud\.(com|net)$/i.test(d)) add('error', lineOf(dn), 'An *.adobeaemcloud.com domain can\'t be an origin.', 'Adobe rejects it to prevent request loops. Install a custom domain on the target environment and use that.', w);
            if (/\.hlx\.(live|page)$/i.test(d)) add('warn', lineOf(dn), 'hlx.live / hlx.page are the old Edge Delivery hosts. Use main--repo--owner.aem.live.', '', w);
            if (/\.aem\.(live|page)$/i.test(d)) add('info', lineOf(dn), 'Edge Delivery Services origin: configure push invalidation in managed mode, or published EDS content won\'t purge the Adobe CDN.', '', w);
            if (/\.aem\.page$/i.test(d)) add('warn', lineOf(dn), 'aem.page is the preview host. Production traffic should go to aem.live.', '', w);
            if (/^(localhost|127\.|10\.|192\.168\.)/.test(d)) add('error', lineOf(dn), 'The origin must be reachable from the internet; ' + q(d) + ' is a local or private address.', '', w);
          }
          var ip = get(o, 'ip'); if (ip !== undefined && !isIp(sv(ip))) add('error', lineOf(ip), q(sv(ip)) + ' is not a valid IPv4 or IPv6 address.', '', w);
          ['forwardHost', 'forwardCookie', 'forwardAuthorization'].forEach(function (k) { bool(o, k, w); });
          if (sv(get(o, 'forwardCookie')) === true && on) cookieOrigins[on] = lineOfKey(o, 'forwardCookie');
          var to = get(o, 'timeout');
          if (to !== undefined) { var tv = sv(to); if (!Number.isInteger(tv) || tv < 1) add('error', lineOf(to), 'timeout must be a whole number of seconds.', '', w); else if (tv > 60) add('info', lineOf(to), 'timeout is ' + tv + ' s. The default is 60 s; long timeouts tie up connections when the origin is slow.', '', w); }
        });
        rulesOf(sec, W, 'originSelectors', ['name', 'when', 'action'], function (r, w) {
          var a = get(r, 'action');
          if (a === undefined) { add('error', lineOf(r), 'Missing action. Use action: { type: selectOrigin, originName: my-origin }.', '', w); return; }
          if (!Y.isMap(a)) { add('error', lineOf(a), 'action must be a mapping with type and originName.', '', w); return; }
          unknownKeys(a, ['type', 'originName', 'skipCache', 'headers'], w, 'origin selector action');
          var type = sv(get(a, 'type')), on = sv(get(a, 'originName'));
          if (type !== 'selectOrigin' && type !== 'selectAemOrigin') { var nt = closest(String(type), ['selectOrigin', 'selectAemOrigin']); add('error', lineOf(a), 'Action type ' + q(type) + ' is not valid.' + (nt ? ' Did you mean ' + q(nt) + '?' : ''), 'Use selectOrigin, or selectAemOrigin for the AEM static tier.', w); }
          if (on === undefined) add('error', lineOf(a), 'Missing originName.', '', w);
          else if (type === 'selectAemOrigin') { if (on !== 'static') add('error', lineOfKey(a, 'originName'), 'selectAemOrigin only supports originName: static.', '', w); }
          else if (type === 'selectOrigin') {
            usedOrigins[on] = true;
            if (!origins[on]) { var no = closest(String(on), Object.keys(origins)); add('error', lineOfKey(a, 'originName'), 'originName ' + q(on) + ' doesn\'t match any origin under originSelectors.origins.' + (no ? ' Did you mean ' + q(no) + '?' : ''), Object.keys(origins).length ? 'Defined origins: ' + Object.keys(origins).join(', ') + '.' : 'Add it to the origins list.', w); }
            else if (cookieOrigins[on] && sv(get(a, 'skipCache')) !== true) add('warn', lineOf(a), 'Origin ' + q(on) + ' receives cookies (forwardCookie: true), but responses are still cached.', 'If the backend personalises by cookie, one user\'s page can be served to others. Add skipCache: true unless its cache headers are trustworthy.', w);
          }
          bool(a, 'skipCache', w);
          var hd = get(a, 'headers');
          if (hd !== undefined) {
            if (!Y.isMap(hd)) add('error', lineOf(hd), 'headers must be a mapping of header name to value.', '', w);
            else pairs(hd).forEach(function (p) { if (!Y.isScalar(p.value)) add('error', lineOf(p.value), 'Header ' + q(keyOf(p)) + ' must have a string value.', '', w); });
          }
        });
        Object.keys(origins).forEach(function (n) { if (!usedOrigins[n]) add('warn', origins[n], 'Origin ' + q(n) + ' is defined but no rule selects it.', '', W); });
      }
    }

    if ((sec = get(data, 'responseTransformations')) !== undefined) {
      W = 'Response transformations';
      if (!Y.isMap(sec)) add('error', lineOf(sec), 'responseTransformations must be a mapping with a rules list.', '', W);
      else {
        unknownKeys(sec, ['rules'], W, 'responseTransformations');
        rulesOf(sec, W, 'responseTransformations', ['name', 'when', 'actions'], function (r, w) { checkActions(r, w, RESP_TARGETS, false); });
      }
    }

    if ((sec = get(data, 'authentication')) !== undefined) {
      W = 'Authentication';
      if (!Y.isMap(sec)) add('error', lineOf(sec), 'authentication must be a mapping with authenticators and rules.', '', W);
      else {
        unknownKeys(sec, ['authenticators', 'rules'], W, 'authentication');
        var auths = {}, usedAuth = {};
        var al = get(sec, 'authenticators');
        if (al === undefined) add('error', lineOf(sec), 'authentication needs an authenticators list.', '', W);
        else if (!Y.isSeq(al)) add('error', lineOf(al), 'authenticators must be a list.', '', W);
        else al.items.forEach(function (o, i) {
          if (!Y.isMap(o)) { add('error', lineOf(o), 'Each authenticator must be a mapping with name and type.', '', W); return; }
          var an = sv(get(o, 'name')), at = sv(get(o, 'type')), w = W + ' › ' + (an || 'authenticator ' + (i + 1));
          if (!an) add('error', lineOf(o), 'Authenticator ' + (i + 1) + ' has no name.', '', w);
          else if (auths[an]) add('error', lineOfKey(o, 'name'), 'Duplicate authenticator name ' + q(an) + '.', '', w);
          else auths[an] = { line: lineOfKey(o, 'name'), type: at };
          var keysFor = { edge: ['edgeKey1', 'edgeKey2'], purge: ['purgeKey1', 'purgeKey2'], basic: ['credentials'] };
          if (!keysFor[at]) { add('error', lineOf(o), 'Authenticator type ' + q(at) + ' is not valid. Use edge, purge or basic.', '', w); return; }
          unknownKeys(o, ['name', 'type'].concat(keysFor[at]), w, at + ' authenticator');
          if (at === 'edge' || at === 'purge') {
            var present = keysFor[at].filter(function (k) { return has(o, k); });
            if (!present.length) add('error', lineOf(o), 'A ' + at + ' authenticator needs ' + keysFor[at].join(' or ') + '.', '', w);
            present.forEach(function (k) { secretOnly(get(o, k), w, k); });
          } else {
            var cr = get(o, 'credentials');
            if (cr === undefined || !Y.isSeq(cr) || !cr.items.length) add('error', lineOf(cr || o), 'A basic authenticator needs a credentials list with user and password.', '', w);
            else {
              if (cr.items.length > 10) add('error', lineOf(cr), 'Basic auth allows at most 10 credentials (' + cr.items.length + ' here).', '', w);
              var users = {};
              cr.items.forEach(function (c) {
                if (!Y.isMap(c)) { add('error', lineOf(c), 'Each credential is a mapping with user and password.', '', w); return; }
                unknownKeys(c, ['user', 'password'], w, 'credential');
                var u = sv(get(c, 'user'));
                if (!u) add('error', lineOf(c), 'Credential has no user.', '', w); else if (users[u]) add('error', lineOfKey(c, 'user'), 'Duplicate user ' + q(u) + '.', '', w); else users[u] = 1;
                if (!has(c, 'password')) add('error', lineOf(c), 'Credential ' + q(u) + ' has no password.', '', w); else secretOnly(get(c, 'password'), w, 'password');
              });
            }
          }
        });
        rulesOf(sec, W, 'authentication', ['name', 'when', 'action'], function (r, w) {
          var a = get(r, 'action');
          if (!Y.isMap(a)) { add('error', lineOf(a || r), 'action must be { type: authenticate, authenticator: <name> }.', '', w); return; }
          unknownKeys(a, ['type', 'authenticator'], w, 'authentication action');
          if (sv(get(a, 'type')) !== 'authenticate') add('error', lineOf(a), 'Authentication rules need type: authenticate.', '', w);
          var an = sv(get(a, 'authenticator'));
          if (!an) add('error', lineOf(a), 'Missing authenticator name.', '', w);
          else if (!auths[an]) add('error', lineOfKey(a, 'authenticator'), 'authenticator ' + q(an) + ' isn\'t defined.', Object.keys(auths).length ? 'Defined: ' + Object.keys(auths).join(', ') + '.' : '', w);
          else {
            usedAuth[an] = true;
            var wn = get(r, 'when');
            if (auths[an].type === 'purge' && !(Y.isMap(wn) && sv(get(wn, 'reqProperty')) === 'tier')) add('info', lineOf(r), 'Adobe scopes purge rules to a tier, for example when: { reqProperty: tier, equals: publish }.', '', w);
            if (auths[an].type === 'basic' && Y.isScalar(wn) && sv(wn) === '*') add('warn', lineOf(r), 'Basic auth on every request also protects publish in production if this file deploys there.', 'Limit it with metadata.envTypes or a tier/domain condition.', w);
          }
        });
        Object.keys(auths).forEach(function (n) { if (!usedAuth[n]) add('warn', auths[n].line, 'Authenticator ' + q(n) + ' is defined but no rule uses it, so it has no effect.', '', W); });
      }
    }
    function secretOnly(n, w, label) {
      var v = sv(n);
      if (v === undefined || v === null || v === '') { add('error', lineOf(n), label + ' is empty.', '', w); return; }
      if (!SECRET_RE.test(String(v))) add('error', lineOf(n), label + ' must reference a Cloud Manager secret such as ${{EDGE_KEY}}, not a literal value.', 'Literal keys and passwords end up in Git. Store them as secret pipeline or environment variables.', w);
    }

    if ((sec = get(data, 'errorPages')) !== undefined) {
      W = 'Error pages';
      if (!Y.isMap(sec)) add('error', lineOf(sec), 'errorPages must be a mapping with an spa entry.', '', W);
      else {
        unknownKeys(sec, ['spa'], W, 'errorPages');
        var spa = get(sec, 'spa');
        if (!Y.isMap(spa)) add('error', lineOf(spa || sec), 'errorPages needs spa: with title, icoUrl, cssUrl and jsUrl.', '', W);
        else {
          unknownKeys(spa, ['title', 'icoUrl', 'cssUrl', 'jsUrl'], W, 'spa error page');
          ['title', 'icoUrl', 'cssUrl', 'jsUrl'].forEach(function (k) { if (!has(spa, k)) add('warn', lineOf(spa), 'spa has no ' + k + '. Adobe\'s example sets all four.', '', W); });
          ['icoUrl', 'cssUrl', 'jsUrl'].forEach(function (k) {
            var n = get(spa, k), v = sv(n); if (v === undefined) return;
            if (!/^https:\/\//i.test(String(v))) add('error', lineOf(n), k + ' must be an absolute https:// URL.', '', W);
            if (/adobeaemcloud\.com/i.test(String(v))) add('error', lineOf(n), k + ' is hosted on AEM, which is what is down when the error page shows.', 'Host the files on S3, Azure Blob Storage or another service outside AEM.', W);
          });
        }
      }
    }

    /* ---------- whole-file checks ---------- */
    Y.visit(doc, {
      Scalar: function (k, n) {
        if (typeof n.value !== 'string') return;
        var s = n.value;
        if (s.indexOf('${{') >= 0 && !SECRET_RE.test(s)) add('error', lineOf(n), 'Secret references aren\'t interpolated inside text: ' + q(s.length > 60 ? s.slice(0, 60) + '…' : s) + '.', 'The whole value must be the reference, for example ${{API_TOKEN}}. Store "Bearer xyz" as the secret instead.', 'Secrets');
        else if (/^\$\{[A-Za-z_][\w.]*\}$/.test(s)) add('error', lineOf(n), q(s) + ' uses single braces. Secret references use double braces: $' + '{{NAME}}.', '', 'Secrets');
      }
    });
    if (pathRewritten.length && pathUsers.length) pathUsers.forEach(function (u) {
      add('warn', u.line, 'This condition uses reqProperty: path, which a request transformation rewrites (line ' + pathRewritten[0] + ').', 'Rules after request transformations see the rewritten path. Use originalPath to match what the visitor requested.', u.where);
    });
    finish();
    return out;

    function finish() {
      var rank = { error: 0, warn: 1, info: 2, ok: 3 };
      F.sort(function (a, b) { return rank[a.level] - rank[b.level] || (a.line || 0) - (b.line || 0); });
      out.errors = F.filter(function (f) { return f.level === 'error'; }).length;
      out.warnings = F.filter(function (f) { return f.level === 'warn'; }).length;
      out.ok = !out.errors;
      var orderIdx = { requestTransformations: 0, trafficFilters: 1, redirects: 2, originSelectors: 3, responseTransformations: 4, authentication: 1.5 };
      out.order.sort(function (a, b) { return orderIdx[a.section] - orderIdx[b.section] || (a.line || 0) - (b.line || 0); });
      out.stats.sections = SECTIONS.filter(function (s) { return Y && Y.isMap(top) && Y.isMap(get(top, 'data')) && has(get(top, 'data'), s); });
    }
  }

  var YAML_HINTS = {
    DUPLICATE_KEY: 'The same key appears twice in one mapping. YAML keeps only one, so part of your config would be lost.',
    TAB_AS_INDENT: 'YAML only allows spaces for indentation. Replace the tab with spaces.',
    BAD_INDENT: 'The indentation doesn\'t line up with the lines above. Keys at the same level must start in the same column.',
    MISSING_CHAR: 'A closing bracket, brace or quote is missing.',
    BLOCK_AS_IMPLICIT_KEY: 'A key is missing its colon, or the previous line is indented wrongly.',
    MULTILINE_IMPLICIT_KEY: 'A key runs over several lines. Usually a missing colon or a missing "- " before a list item.',
    UNEXPECTED_TOKEN: 'Something here doesn\'t belong. Look for a stray character, a missing "- " or wrong indentation.',
    BAD_SCALAR_START: 'A value starts with a character YAML reserves (such as @, ` or %). Put the value in quotes.',
    BAD_DQ_ESCAPE: 'An invalid escape inside double quotes. Regexes are easier in single quotes: \'\\.html$\'.',
    MISSING_ANCHOR: 'An alias (*name) refers to an anchor that doesn\'t exist.',
    BAD_ALIAS: 'Invalid alias.',
    UNEXPECTED_SCALAR: 'A value appears where a key or list item was expected. Check the indentation.',
    TAG_RESOLVE_FAILED: 'A YAML tag couldn\'t be resolved.',
    KEY_OVER_1024_CHARS: 'A key is longer than 1024 characters.'
  };
  function yamlMessage(e, text, line) {
    var m = String(e.message).split('\n')[0].replace(/ at line \d+, column \d+:?$/, '');
    if (e.code === 'DUPLICATE_KEY') { var k = line ? (text.split(/\r\n|\r|\n/)[line - 1] || '').match(/^\s*-?\s*([^:#]+?)\s*:/) : null; return 'Duplicate key' + (k ? ' "' + k[1] + '"' : '') + ' in the same mapping.'; }
    if (e.code === 'TAB_AS_INDENT') return 'Tab used for indentation.';
    return m.replace(/^./, function (c) { return c.toUpperCase(); }) + (/\.$/.test(m) ? '' : '.');
  }
  function yamlHint(e, text) {
    var h = YAML_HINTS[e.code] || '';
    if (e.linePos && /\\/.test(text.split(/\r\n|\r|\n/)[e.linePos[0].line - 1] || '') && e.code === 'BAD_DQ_ESCAPE') h = YAML_HINTS.BAD_DQ_ESCAPE;
    return h;
  }

  var SAMPLE = [
    'kind: "CDN"',
    'version: "1"',
    'metadata:',
    '  envTypes: ["dev", "stage", "prod"]',
    'data:',
    '  requestTransformations:',
    '    removeMarketingParams: true',
    '    rules:',
    '      - name: drop-spoofable-header',
    '        when: "*"',
    '        actions:',
    '          - type: unset',
    '            reqHeader: x-internal-user',
    '  trafficFilters:',
    '    rules:',
    '      - name: rate-limit-per-ip',
    '        when: { reqProperty: tier, equals: publish }',
    '        rateLimit: { limit: 100, window: 10, penalty: 300, groupBy: [ { reqProperty: clientIp } ] }',
    '        action: { type: log, alert: true }',
    '      - name: block-bad-ips',
    '        when: { reqProperty: tier, equals: publish }',
    '        action:',
    '          type: block',
    '          wafFlags: [ ATTACK-FROM-BAD-IP ]',
    '  redirects:',
    '    rules:',
    '      - name: summer-sale',
    '        when: { reqProperty: originalPath, equals: /summer-sale }',
    '        action: { type: redirect, status: 302, location: /offers }',
    '  originSelectors:',
    '    rules:',
    '      - name: blog-to-wordpress',
    '        when: { reqProperty: originalPath, like: "/blog*" }',
    '        action: { type: selectOrigin, originName: wordpress, skipCache: true }',
    '    origins:',
    '      - name: wordpress',
    '        domain: blog-origin.example.com',
    '  responseTransformations:',
    '    rules:',
    '      - name: security-headers',
    '        when: { reqProperty: tier, equals: publish }',
    '        actions:',
    '          - type: set',
    '            respHeader: x-content-type-options',
    '            value: nosniff',
    ''
  ].join('\n');
  var BROKEN = [
    'kind: "cdn"',
    'version: 1',
    'metadata:',
    '  envTypes: dev',
    'data:',
    '  trafficFilters:',
    '    rules:',
    '      - name: block bad bots',
    '        when: { reqHeader: user-agent, matches: "(?i)(scrapy|curl" }',
    '        action: deny',
    '      - name: rate-limit',
    '        when: { reqProperty: clientIp, like: "10.0.0.*" }',
    '        rateLimit: { limit: 5, window: 30 }',
    '        action: block',
    '  redirects:',
    '    rules:',
    '      - name: old-products',
    '        when: { reqProperty: path, matches: "/products-old/*" }',
    '        action:',
    '          type: redirect',
    '          status: 310',
    '          location: /products/\\1',
    '  originSelectors:',
    '    rules:',
    '      - name: graphql',
    '        when: { reqProperty: domain, equals: WWW.Example.com }',
    '        action: { type: selectOrigin, originName: headless }',
    '    origins:',
    '      - name: headles',
    '        domain: https://publish-p1-e2.adobeaemcloud.com',
    '  authentication:',
    '    authenticators:',
    '      - name: byo-cdn',
    '        type: edge',
    '        edgeKey1: 4f8a0c2e9b',
    '    rules:',
    '      - name: edge',
    '        when: { reqProperty: tier, equals: publish }',
    '        action: { type: authenticate, authenticator: byo-cdn }',
    '  requestTransformations:',
    '    rules:',
    '      - name: html-ext',
    '        when: { reqProperty: path, like: "/content/*" }',
    '        actions:',
    '          - type: transform',
    '            reqProperty: path',
    '            op: replace',
    '            match: (.*)\\.html$',
    '            replacement: $1',
    '          - type: set',
    '            reqHeader: authorization',
    '            value: "Bearer ${{API_TOKEN}}"',
    ''
  ].join('\n');

  var api = { validate: validate, SAMPLE: SAMPLE, BROKEN: BROKEN, regexProblem: regexProblem };
  root.KJCdn = api;
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document === 'undefined') return;

  /* ---------- UI ---------- */
  function init() {
    var form = document.getElementById('cdForm'); if (!form) return;
    var h = root.KJTools.h, out = document.getElementById('cdOut'), ta = form.elements.cdYaml;
    var ed = KJA.editor(ta, document.getElementById('cdGutter')), gutter = ed.refresh, goLine = ed.goLine;
    document.getElementById('cdSample').addEventListener('click', function () { ta.value = SAMPLE; gutter(); run(); });
    document.getElementById('cdBroken').addEventListener('click', function () { ta.value = BROKEN; gutter(); run(); });
    document.getElementById('cdFile').addEventListener('change', function (e) {
      var f = e.target.files[0]; if (!f) return;
      KJA.readFile(f).then(function (t) { ta.value = t; gutter(); run(); });
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    function run() {
      var r = validate(ta.value, { eds: form.elements.cdEds && form.elements.cdEds.checked });
      out.hidden = false; out.textContent = '';
      var verdict = r.errors ? 'kt-deny' : 'kt-allow';
      out.appendChild(h('div', { class: 'kt-verdict ' + verdict, role: 'status' },
        r.errors ? r.errors + ' error' + (r.errors > 1 ? 's' : '') + ' to fix before deploying' : (r.warnings ? 'No errors. ' + r.warnings + ' warning' + (r.warnings > 1 ? 's' : '') + ' to review.' : 'No problems found.'),
        h('small', { text: r.errors ? 'The config pipeline would fail, or a rule wouldn\'t do what you expect.' : 'Still test on a dev environment before production. This checks syntax and Adobe\'s documented schema, not your live environment.' })));
      out.appendChild(h('div', { class: 'me-tiles cd-tiles' },
        KJA.stat('Errors', r.errors, r.errors ? 'bad' : 'good'), KJA.stat('Warnings', r.warnings, r.warnings ? 'mid' : 'good'),
        KJA.stat('Rules', r.stats.rules), KJA.stat('Size', (r.stats.bytes / 1024).toFixed(1) + ' of 100 KB', r.stats.bytes > 102400 ? 'bad' : '')));
      if (r.findings.length) {
        out.appendChild(h('h3', { class: 'cd-h', text: 'Findings' }));
        out.appendChild(KJA.lineFindings(r.findings, goLine));
      }
      if (r.order.length) {
        var names = { requestTransformations: 'Request transformations', trafficFilters: 'Traffic filters', authentication: 'Authentication', redirects: 'Redirects', originSelectors: 'Origin selectors (then cache, then origin)', responseTransformations: 'Response transformations (every response, including cache hits)' };
        var groups = []; r.order.forEach(function (o) { var g = groups[groups.length - 1]; if (!g || g.section !== o.section) groups.push(g = { section: o.section, items: [] }); g.items.push(o); });
        out.appendChild(h('h3', { class: 'cd-h', text: 'Order the CDN runs your rules' }));
        out.appendChild(h('p', { class: 'muted kt-hint', text: 'Each request passes through the sections in this order. Later sections see changes made by earlier ones.' }));
        out.appendChild(h('ol', { class: 'cd-order' }, groups.map(function (g) {
          return h('li', null, h('strong', { text: names[g.section] || g.section }), h('span', { class: 'cd-rules' }, g.items.map(function (o) {
            var b = h('button', { type: 'button', class: 'cd-rule', text: o.name }); b.addEventListener('click', function () { if (o.line) goLine(o.line); }); return b;
          })));
        })));
      }
      out.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);

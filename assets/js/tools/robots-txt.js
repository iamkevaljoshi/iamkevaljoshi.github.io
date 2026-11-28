/* robots.txt validator and tester (RFC 9309, plus how Google, Bing and AI crawlers read it).
   Finds syntax mistakes with line numbers, explains which group each crawler obeys, and tests URLs.
   Runs in the browser. Nothing is uploaded. */
(function (root) {
  'use strict';

  var DIRECTIVES = ['user-agent', 'allow', 'disallow', 'sitemap', 'crawl-delay', 'host', 'clean-param', 'request-rate', 'visit-time', 'noindex', 'nofollow', 'content-signal'];
  var TYPOS = { 'useragent': 'user-agent', 'user agent': 'user-agent', 'user_agent': 'user-agent', 'user-agents': 'user-agent', 'dissallow': 'disallow', 'disalow': 'disallow', 'dissalow': 'disallow', 'disallowed': 'disallow',
    'disalllow': 'disallow', 'allowed': 'allow', 'alow': 'allow', 'site-map': 'sitemap', 'site map': 'sitemap', 'sitemaps': 'sitemap', 'crawldelay': 'crawl-delay', 'crawl delay': 'crawl-delay' };
  var CRAWLERS = [
    { id: 'Googlebot', vendor: 'Google', kind: 'Search' },
    { id: 'Bingbot', vendor: 'Microsoft', kind: 'Search (also Copilot)' },
    { id: 'Applebot', vendor: 'Apple', kind: 'Search (Siri, Spotlight)' },
    { id: 'DuckDuckBot', vendor: 'DuckDuckGo', kind: 'Search' },
    { id: 'OAI-SearchBot', vendor: 'OpenAI', kind: 'AI search' },
    { id: 'Claude-SearchBot', vendor: 'Anthropic', kind: 'AI search' },
    { id: 'PerplexityBot', vendor: 'Perplexity', kind: 'AI search' },
    { id: 'ChatGPT-User', vendor: 'OpenAI', kind: 'User-triggered' },
    { id: 'Claude-User', vendor: 'Anthropic', kind: 'User-triggered' },
    { id: 'GPTBot', vendor: 'OpenAI', kind: 'AI training' },
    { id: 'ClaudeBot', vendor: 'Anthropic', kind: 'AI training' },
    { id: 'Google-Extended', vendor: 'Google', kind: 'AI training token' },
    { id: 'Applebot-Extended', vendor: 'Apple', kind: 'AI training token' },
    { id: 'Meta-ExternalAgent', vendor: 'Meta', kind: 'AI training' },
    { id: 'Amazonbot', vendor: 'Amazon', kind: 'AI training' },
    { id: 'CCBot', vendor: 'Common Crawl', kind: 'AI training dataset' },
    { id: 'Bytespider', vendor: 'ByteDance', kind: 'AI training' },
    { id: 'facebookexternalhit', vendor: 'Meta', kind: 'Link previews' },
    { id: 'LinkedInBot', vendor: 'LinkedIn', kind: 'Link previews' },
    { id: 'Twitterbot', vendor: 'X', kind: 'Link previews' }
  ];
  /* resources Google must fetch to render pages: AEM Sites, Edge Delivery Services and common front ends */
  var RESOURCES = [
    ['/etc.clientlibs/site/clientlibs/clientlib-site.lc-1a2b3c-lc.min.css', 'AEM client library CSS (/etc.clientlibs/)'],
    ['/etc.clientlibs/site/clientlibs/clientlib-site.lc-1a2b3c-lc.min.js', 'AEM client library JavaScript (/etc.clientlibs/)'],
    ['/scripts/aem.js', 'Edge Delivery Services scripts (/scripts/)'],
    ['/styles/styles.css', 'Edge Delivery Services styles (/styles/)'],
    ['/blocks/hero/hero.js', 'Edge Delivery Services blocks (/blocks/)'],
    ['/content/dam/site/images/hero.jpg', 'AEM Assets images (/content/dam/)'],
    ['/assets/app.css', 'CSS files'],
    ['/assets/app.js', 'JavaScript files'],
    ['/_next/static/chunks/main.js', 'Next.js bundles (/_next/)'],
    ['/wp-content/themes/site/style.css', 'WordPress theme files (/wp-content/)']
  ];

  var enc = function (s) { return String(s).replace(/%[0-9a-f]{2}/gi, function (m) { return m.toUpperCase(); }).replace(/[^\x00-\x7F]/g, function (c) { return encodeURIComponent(c); }); };
  function toPath(u) {
    u = String(u || '').trim();
    if (!u) return '/';
    var m = u.match(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*([^#]*)/i);
    var p = m ? m[1] : u.replace(/#.*$/, '');
    if (!p || p[0] === '?') p = '/' + p;
    if (p[0] !== '/') p = '/' + p;
    return enc(p);
  }
  function patternRe(pattern) {
    var anchored = /\$$/.test(pattern), body = enc(anchored ? pattern.slice(0, -1) : pattern);
    return new RegExp('^' + body.split('*').map(function (s) { return s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'); }).join('.*') + (anchored ? '$' : ''));
  }

  function parse(text) {
    text = String(text == null ? '' : text);
    var r = { groups: [], sitemaps: [], lines: [], other: [], text: text };
    var cur = null, lastWasAgent = false;
    text.replace(/^﻿/, '').split(/\r\n|\r|\n/).forEach(function (raw, i) {
      var ln = i + 1, line = raw.replace(/#.*$/, '').trim();
      var rec = { line: ln, raw: raw };
      r.lines.push(rec);
      if (!line) return;
      var m = line.match(/^([^:]+?)\s*:\s*(.*)$/);
      if (!m) { rec.bad = 'nocolon'; return; }
      var key = m[1].trim().toLowerCase(), val = m[2].trim();
      rec.key = key; rec.val = val;
      if (TYPOS[key]) { rec.typo = TYPOS[key]; key = null; }
      if (key === 'user-agent') {
        if (!cur || !lastWasAgent) { cur = { agents: [], rules: [], line: ln }; r.groups.push(cur); }
        cur.agents.push({ name: val, lc: val.toLowerCase(), line: ln });
        lastWasAgent = true;
        return;
      }
      if (key === 'allow' || key === 'disallow') {
        lastWasAgent = false;
        if (!cur) { rec.orphan = true; return; }
        cur.rules.push({ allow: key === 'allow', path: val, line: ln });
        return;
      }
      if (key === 'sitemap') { r.sitemaps.push({ url: val, line: ln }); return; }   // sitemap lines don't end a group
      if (key && DIRECTIVES.indexOf(key) >= 0) { lastWasAgent = false; r.other.push({ key: key, val: val, line: ln, group: cur }); return; }
      if (key) rec.unknown = true;
    });
    return r;
  }

  /* The group a crawler obeys: exact token, then the longest group token that prefixes the crawler's
     (Googlebot-Image falls back to Googlebot), then *. All groups naming the chosen token are merged. */
  function groupFor(p, agent) {
    var a = String(agent).toLowerCase(), best = null;
    p.groups.forEach(function (g) {
      g.agents.forEach(function (x) {
        if (!x.lc || x.lc === '*') return;
        if (x.lc === a || (a.indexOf(x.lc) === 0 && /[-_ ]/.test(a.charAt(x.lc.length)))) {
          if (!best || x.lc.length > best.length) best = x.lc;
        }
      });
    });
    var token = best || '*';
    var groups = p.groups.filter(function (g) { return g.agents.some(function (x) { return x.lc === token; }); });
    return { token: token, groups: groups, rules: [].concat.apply([], groups.map(function (g) { return g.rules; })), fallback: !best };
  }
  /* Longest matching pattern wins; on a tie, allow wins. An empty Disallow matches nothing. */
  function test(p, agent, url) {
    var path = toPath(url), g = groupFor(p, agent), best = null;
    if (path === '/robots.txt') return { allowed: true, rule: null, group: g, path: path };
    g.rules.forEach(function (rule) {
      if (!rule.path) return;
      var re; try { re = patternRe(rule.path); } catch (e) { return; }
      if (!re.test(path)) return;
      var len = enc(rule.path).length;
      if (!best || len > best.len || (len === best.len && rule.allow && !best.rule.allow)) best = { len: len, rule: rule };
    });
    return { allowed: !best || best.rule.allow, rule: best && best.rule, group: g, path: path };
  }

  function validate(text, opts) {
    opts = opts || {};
    text = String(text == null ? '' : text);
    var F = [], add = function (level, line, t, d) { F.push({ level: level, line: line || null, text: t, detail: d || '' }); };
    var bytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(text).length : Buffer.byteLength(text);
    var p = parse(text);
    var res = { findings: F, parsed: p, bytes: bytes };
    if (!text.trim()) { add('info', null, 'The file is empty. Crawlers treat an empty or missing robots.txt as "everything allowed".', 'That is safe, but add at least a Sitemap line.'); return finish(); }
    if (/^\s*<(!doctype|html|head|body|\?xml)/i.test(text)) { add('error', 1, 'This is an HTML or XML document, not robots.txt.', 'If /robots.txt returns a web page (a soft 404 or app shell), crawlers find no rules. Serve plain text.'); return finish(); }
    if (bytes > 500 * 1024) add('error', null, 'The file is ' + Math.round(bytes / 1024) + ' KiB. Google reads only the first 500 KiB and ignores the rest.', 'Consolidate rules with * wildcards.');
    if (/^﻿/.test(text)) add('info', 1, 'The file starts with a UTF-8 byte-order mark. Google ignores it, but some crawlers don\'t. Saving without a BOM is safer.');

    p.lines.forEach(function (l) {
      if (l.bad === 'nocolon') add('error', l.line, 'Not a valid line: "' + l.raw.trim().slice(0, 60) + '".', 'Every line is "Directive: value" or a # comment. Crawlers ignore this line.');
      if (l.typo) add('error', l.line, '"' + l.key + '" is a typo for "' + l.typo.replace(/^./, function (c) { return c.toUpperCase(); }) + '". Crawlers ignore this line.', '');
      if (l.unknown) add('warn', l.line, 'Unknown directive "' + l.key + '". Crawlers ignore it.', 'Standard: User-agent, Allow, Disallow, Sitemap.');
      if (l.orphan) add('error', l.line, (l.key === 'allow' ? 'Allow' : 'Disallow') + ' before any User-agent line. Crawlers ignore it.', 'Rules must follow a User-agent line, for example "User-agent: *".');
      if (l.key && /^\s+/.test(l.raw) && !l.bad) add('info', l.line, 'Line is indented. Crawlers accept it, but robots.txt is usually written without indentation.');
    });

    var agentsSeen = {};
    p.groups.forEach(function (g) {
      g.agents.forEach(function (a) {
        if (!a.name) add('error', a.line, 'User-agent has no value.', 'Use * for all crawlers, or a product token such as Googlebot.');
        else if (/\//.test(a.name) || /\s/.test(a.name)) add('warn', a.line, 'User-agent "' + a.name + '" looks like a full user-agent string. Use the product token only, such as "' + a.name.split(/[\/\s;(]/)[0] + '".', 'Crawlers match the token, not version numbers or browser strings.');
        else if (/\*/.test(a.name) && a.name !== '*') add('warn', a.line, 'User-agent "' + a.name + '" contains *. Wildcards only work as a bare "*".', 'List each crawler on its own User-agent line.');
        if (a.lc && agentsSeen[a.lc] && agentsSeen[a.lc] !== g) add('info', a.line, 'User-agent "' + a.name + '" also has a group on line ' + agentsSeen[a.lc].line + '. Crawlers merge both groups.', 'One group per crawler is easier to maintain.');
        if (a.lc) agentsSeen[a.lc] = g;
      });
      if (!g.rules.length && !p.other.some(function (o) { return o.group === g; })) add('warn', g.line, 'The group for ' + g.agents.map(function (a) { return a.name || '(empty)'; }).join(', ') + ' has no Allow or Disallow rules.', 'An empty group allows everything for that crawler, and it stops the crawler from using your "User-agent: *" rules.');
      var seen = {};
      g.rules.forEach(function (r) {
        var v = r.path, label = (r.allow ? 'Allow' : 'Disallow') + ': ' + v;
        if (!v) { if (r.allow) add('warn', r.line, 'Empty Allow does nothing.'); return; }
        if (/^https?:\/\//i.test(v)) add('error', r.line, label + ' uses a full URL. Rules are paths, such as "/private/".', 'Crawlers never match a rule that starts with http.');
        else if (v[0] !== '/' && v[0] !== '*') add('error', r.line, label + ' doesn\'t start with "/" or "*".', 'Google ignores rules that don\'t start with / or *. Write "/' + v + '".');
        if (/\$./.test(v)) add('warn', r.line, label + ' has $ in the middle. $ only means "end of URL" as the last character.');
        if (/\s/.test(v)) add('error', r.line, label + ' contains a space. Paths can\'t contain spaces; use %20.');
        if (/\*\*/.test(v)) add('info', r.line, label + ' has a double **. One * already matches any characters.');
        if (/\/[A-Z]/.test(v)) add('info', r.line, label + ' has capital letters. Paths are case-sensitive, so it doesn\'t cover the lower-case version.');
        var key = (r.allow ? 'A' : 'D') + v;
        if (seen[key]) add('warn', r.line, label + ' is repeated (also line ' + seen[key] + ').');
        seen[key] = r.line;
        var opp = (r.allow ? 'D' : 'A') + v;
        if (seen[opp] && seen[opp] !== r.line) add('info', r.line, 'Allow and Disallow for the same path "' + v + '". Allow wins on a tie.', '');
      });
    });

    p.sitemaps.forEach(function (s) {
      if (!s.url) add('error', s.line, 'Sitemap has no URL.');
      else if (!/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(s.url)) add('error', s.line, 'Sitemap "' + s.url + '" is not an absolute URL.', 'Use the full address, for example Sitemap: https://www.example.com/sitemap.xml');
      else if (/\s/.test(s.url)) add('error', s.line, 'Sitemap URL contains a space.');
      if (/^http:\/\//i.test(s.url)) add('warn', s.line, 'Sitemap uses http://. If the site is on HTTPS, use the https:// address.');
      if (/(localhost|127\.0\.0\.1|\.adobeaemcloud\.com|author-p\d+)/i.test(s.url)) add('error', s.line, 'Sitemap points at ' + s.url.replace(/^https?:\/\//, '').split('/')[0] + ', which isn\'t your public domain.', 'Use the live domain. AEM Externalizer settings often cause this.');
    });
    var dupSm = {}; p.sitemaps.forEach(function (s) { if (dupSm[s.url]) add('warn', s.line, 'Sitemap listed twice (line ' + dupSm[s.url] + ').'); dupSm[s.url] = s.line; });
    if (!p.sitemaps.length) add('warn', null, 'No Sitemap line.', 'Declaring sitemaps here lets every crawler find them, not only those you submit to.');

    p.other.forEach(function (o) {
      if (o.key === 'crawl-delay') { if (!/^\d+(\.\d+)?$/.test(o.val)) add('error', o.line, 'Crawl-delay must be a number of seconds.'); else add('info', o.line, 'Crawl-delay: ' + o.val + '. Google ignores it; Bing, Yandex and Anthropic\'s crawlers respect it.', +o.val > 10 ? 'A long delay can stop Bing crawling large sites fully.' : ''); }
      if (o.key === 'noindex' || o.key === 'nofollow') add('error', o.line, o.key.replace(/^./, function (c) { return c.toUpperCase(); }) + ' isn\'t supported in robots.txt. Google stopped honouring it in 2019.', 'Use a robots meta tag or an X-Robots-Tag header, and let the page be crawled so the tag is seen.');
      if (o.key === 'host' || o.key === 'clean-param') add('info', o.line, o.key.replace(/^./, function (c) { return c.toUpperCase(); }) + ' is only read by Yandex. Other crawlers ignore it.');
      if (o.key === 'request-rate' || o.key === 'visit-time') add('info', o.line, o.key + ' is non-standard and ignored by major crawlers.');
      if (o.key === 'content-signal') add('info', o.line, 'Content-Signal is a proposed AI-usage signal. Crawlers that don\'t support it ignore it.');
    });

    /* behaviour checks */
    var star = groupFor(p, 'zzz-unknown-bot');
    var gb = test(p, 'Googlebot', '/');
    if (!star.fallback || star.groups.length) {
      var rootStar = test(p, 'zzz-unknown-bot', '/');
      if (!rootStar.allowed) {
        var allowed = [];
        p.groups.forEach(function (g) { g.agents.forEach(function (a) { if (a.lc && a.lc !== '*' && test(p, a.name, '/').allowed) allowed.push(a.name); }); });
        if (opts.staging) add('info', rootStar.rule.line, '"Disallow: /" blocks the whole site for every crawler without its own group. Expected on a staging or preview host.');
        else if (allowed.length) add('warn', rootStar.rule.line, 'Allowlist: every crawler is blocked except ' + allowed.join(', ') + '.', 'Deliberate allowlists are valid, but any search engine or AI crawler not named here can\'t crawl the site. Check the table below.');
        else add('error', rootStar.rule.line, '"Disallow: /" blocks the whole site for every crawler.', 'Right for staging hosts, wrong in production. Search engines will drop the site.');
      }
    }
    if (!gb.allowed && (gb.group.token !== '*')) add('error', gb.rule.line, 'Googlebot is blocked from the whole site.', 'The site will drop out of Google Search.');
    // a blanket "Disallow: /" under * is an allowlist pattern; groups that allow everything are deliberate exceptions
    var starRules = star.token === '*' ? star.rules.filter(function (r) { return !r.allow && r.path && r.path !== '/' && r.path !== '/*'; }) : [];
    if (starRules.length) p.groups.forEach(function (g) {
      if (g.agents.some(function (a) { return a.lc === '*'; }) || !g.rules.length) return;
      // a * rule is "missing" only if this group's crawler can actually fetch that path
      var token = (g.agents.find(function (a) { return a.lc && a.lc !== '*'; }) || {}).name;
      if (!token) return;
      var missing = starRules.filter(function (sr) { return test(p, token, sr.path.replace(/\$$/, '').replace(/\*/g, 'x')).allowed; });
      if (missing.length) add('warn', g.line, 'The group for ' + g.agents.map(function (a) { return a.name; }).join(', ') + ' doesn\'t include your "User-agent: *" rules.', 'A crawler that finds its own group ignores * completely. Missing here: ' + missing.slice(0, 4).map(function (r) { return 'Disallow: ' + r.path; }).join(', ') + (missing.length > 4 ? ' and ' + (missing.length - 4) + ' more' : '') + '.');
    });
    var blockedRes = RESOURCES.filter(function (r) { var t = test(p, 'Googlebot', r[0]); return !t.allowed && test(p, 'Googlebot', '/').allowed; })
      .map(function (r) { return { label: r[1], rule: test(p, 'Googlebot', r[0]).rule }; });
    if (blockedRes.length) add('warn', blockedRes[0].rule.line, 'Googlebot can\'t fetch files it needs to render your pages: ' + blockedRes.map(function (b) { return b.label; }).join('; ') + '.', 'Google renders pages like a browser. Blocked CSS, JavaScript or images can make pages look broken or empty to it. Allow them.');
    var aemBlocks = p.groups.some(function (g) { return g.rules.some(function (r) { return !r.allow && /^\/(content|libs|apps|etc|conf|crx|bin|system)\/?$/.test(r.path); }); });
    if (aemBlocks) add('info', null, 'You disallow AEM repository paths such as /content/ or /libs/. Fine if your public URLs are mapped to shorter paths, but check none of your live URLs start with them.');

    function finish() {
      var rank = { error: 0, warn: 1, info: 2, ok: 3 };
      F.sort(function (a, b) { return rank[a.level] - rank[b.level] || (a.line || 0) - (b.line || 0); });
      res.errors = F.filter(function (f) { return f.level === 'error'; }).length;
      res.warnings = F.filter(function (f) { return f.level === 'warn'; }).length;
      res.crawlers = CRAWLERS.map(function (c) {
        var t = test(p, c.id, '/'), shown = t.group.token;
        p.groups.forEach(function (g) { g.agents.forEach(function (a) { if (a.lc === t.group.token) shown = a.name; }); });
        return { id: c.id, vendor: c.vendor, kind: c.kind, token: shown, allowed: t.allowed, rule: t.rule };
      });
      return res;
    }
    return finish();
  }

  var SAMPLE = ['# robots.txt for www.example.com', 'User-agent: *', 'Disallow: /search', 'Disallow: /*?sort=', 'Allow: /search/help$', '',
    'User-agent: GPTBot', 'User-agent: CCBot', 'Disallow: /', '', 'Sitemap: https://www.example.com/sitemap.xml', ''].join('\n');
  var BROKEN = ['Disallow: /tmp/', 'User-agent: *', 'Dissallow: /private/', 'Disallow: https://www.example.com/admin/', 'Disallow: checkout', 'Disallow: /etc.clientlibs/', 'Noindex: /drafts/',
    'Crawl-delay: fast', '', 'User-agent: Googlebot/2.1', 'Allow: /', '', 'User-agent: Bingbot', 'Disallow: /search', '', 'Sitemap: /sitemap.xml', ''].join('\n');

  var api = { parse: parse, test: test, groupFor: groupFor, validate: validate, toPath: toPath, CRAWLERS: CRAWLERS, SAMPLE: SAMPLE, BROKEN: BROKEN };
  root.KJRobotsCheck = api;
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document === 'undefined') return;

  /* ---------- UI ---------- */
  function init() {
    var form = document.getElementById('rbForm'); if (!form) return;
    var h = root.KJTools.h, K = root.KJTools, out = document.getElementById('rbOut'), ta = form.elements.rbText;
    var ed = KJA.editor(ta, document.getElementById('rbGutter'));
    var last = null;
    document.getElementById('rbSample').addEventListener('click', function () { ta.value = SAMPLE; ed.refresh(); run(); });
    document.getElementById('rbBroken').addEventListener('click', function () { ta.value = BROKEN; ed.refresh(); run(); });
    document.getElementById('rbFile').addEventListener('change', function (e) { var f = e.target.files[0]; if (f) KJA.readFile(f).then(function (t) { ta.value = t; ed.refresh(); run(); }); });
    var fetchBtn = document.getElementById('rbFetch'), status = document.getElementById('rbStatus');
    fetchBtn.addEventListener('click', function () {
      var site = form.elements.rbSite.value.trim();
      if (!site) { status.textContent = 'Enter a site address first.'; return; }
      if (!/^https?:\/\//i.test(site)) site = 'https://' + site;
      var u; try { u = new URL(site); } catch (e) { status.textContent = 'That isn\'t a valid address.'; return; }
      var target = u.origin + '/robots.txt';
      status.textContent = 'Fetching ' + target + '…'; fetchBtn.disabled = true;
      K.jina(target, 'text', { key: K.store && K.store.get('kj-pc-jina-key') }).then(function (r) {
        fetchBtn.disabled = false;
        if (!r.ok) { status.textContent = 'Could not fetch ' + target + (r.status ? ' (HTTP ' + r.status + ')' : '') + '. ' + (r.status === 404 ? 'No robots.txt: crawlers treat that as "allow everything".' : (r.error || 'Paste the file instead.')); return; }
        if (r.servedHtml && /^\s*</.test(r.body || '')) { status.textContent = target + ' returned an HTML page, not a robots.txt file.'; }
        else status.textContent = 'Loaded ' + target + '.';
        ta.value = r.body; ed.refresh(); run();
      }, function (e) { fetchBtn.disabled = false; status.textContent = e.message + ' Paste the file instead.'; });
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    document.getElementById('rbTestBtn').addEventListener('click', function () { if (!last) run(); renderTests(); });

    function run() {
      last = validate(ta.value, { staging: form.elements.rbStaging.checked });
      var r = last, p = r.parsed;
      out.hidden = false; out.textContent = '';
      out.appendChild(h('div', { class: 'kt-verdict ' + (r.errors ? 'kt-deny' : 'kt-allow'), role: 'status' },
        r.errors ? r.errors + ' error' + (r.errors > 1 ? 's' : '') + ' to fix' : (r.warnings ? 'Valid. ' + r.warnings + ' warning' + (r.warnings > 1 ? 's' : '') + ' to review.' : 'Valid, and no problems found.'),
        h('small', { text: 'Checked against RFC 9309 and how Google, Bing and the main AI crawlers read robots.txt.' })));
      out.appendChild(h('div', { class: 'me-tiles cd-tiles' }, KJA.stat('Errors', r.errors, r.errors ? 'bad' : 'good'), KJA.stat('Warnings', r.warnings, r.warnings ? 'mid' : 'good'),
        KJA.stat('Groups', p.groups.length), KJA.stat('Rules', p.groups.reduce(function (n, g) { return n + g.rules.length; }, 0)), KJA.stat('Sitemaps', p.sitemaps.length), KJA.stat('Size', r.bytes < 1024 ? r.bytes + ' B' : (r.bytes / 1024).toFixed(1) + ' KiB', r.bytes > 512000 ? 'bad' : '')));
      if (r.findings.length) { out.appendChild(h('h3', { class: 'cd-h', text: 'Findings' })); out.appendChild(KJA.lineFindings(r.findings, ed.goLine)); }
      out.appendChild(h('h3', { class: 'cd-h', text: 'What each crawler may fetch' }));
      out.appendChild(h('p', { class: 'muted kt-hint', text: 'Whether each crawler may fetch your home page, and which group it obeys. A crawler with its own group ignores the * group completely.' }));
      out.appendChild(h('div', { class: 'kt-table-wrap' }, h('table', { class: 'pc-table rb-table' },
        h('thead', null, h('tr', null, ['Crawler', 'Used for', 'Obeys group', 'Home page'].map(function (t) { return h('th', { scope: 'col', text: t }); }))),
        h('tbody', null, r.crawlers.map(function (c) {
          return h('tr', null, h('th', { scope: 'row' }, h('strong', { text: c.id }), h('small', { text: c.vendor })), h('td', { text: c.kind }),
            h('td', { text: c.token === '*' ? (p.groups.some(function (g) { return g.agents.some(function (a) { return a.lc === '*'; }); }) ? '* (default)' : 'none') : c.token }),
            h('td', null, h('span', { class: 'rb-badge ' + (c.allowed ? 'rb-ok' : 'rb-no'), text: c.allowed ? 'Allowed' : 'Blocked' }), c.rule ? h('small', { text: (c.rule.allow ? 'Allow: ' : 'Disallow: ') + c.rule.path + ' (line ' + c.rule.line + ')' }) : null));
        })))));
      renderTests();
    }
    function renderTests() {
      var box = document.getElementById('rbTests'); box.textContent = '';
      var urls = form.elements.rbUrls.value.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
      if (!urls.length || !last) return;
      var agent = (form.elements.rbAgent.value === 'custom' ? form.elements.rbCustom.value.trim() : form.elements.rbAgent.value) || '*';
      box.appendChild(h('div', { class: 'kt-table-wrap' }, h('table', { class: 'pc-table rb-table' },
        h('caption', { class: 'muted', text: 'Results for ' + agent }),
        h('thead', null, h('tr', null, ['URL', 'Result', 'Decided by'].map(function (t) { return h('th', { scope: 'col', text: t }); }))),
        h('tbody', null, urls.slice(0, 200).map(function (u) {
          var t = test(last.parsed, agent, u);
          var by = t.rule ? h('button', { type: 'button', class: 'cd-line', text: 'Line ' + t.rule.line + ': ' + (t.rule.allow ? 'Allow: ' : 'Disallow: ') + t.rule.path }) : h('span', { class: 'muted', text: t.path === '/robots.txt' ? 'robots.txt is always allowed' : 'No rule matches (allowed)' });
          if (t.rule) by.addEventListener('click', function () { ed.goLine(t.rule.line); });
          return h('tr', null, h('td', { class: 'rb-url', text: u }), h('td', null, h('span', { class: 'rb-badge ' + (t.allowed ? 'rb-ok' : 'rb-no'), text: t.allowed ? 'Allowed' : 'Blocked' })), h('td', null, by, h('small', { text: 'Group: ' + (t.group.token === '*' ? '*' : t.group.token) })));
        })))));
    }
    form.elements.rbAgent.addEventListener('change', function () { form.elements.rbCustom.closest('label').hidden = form.elements.rbAgent.value !== 'custom'; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);

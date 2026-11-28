/* XML sitemap, sitemap index and sitemap.txt validator (sitemaps.org protocol plus Google's rules for
   images, video, news and hreflang). Every finding has a line number. Runs in the browser. */
(function (root) {
  'use strict';
  var NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';
  var EXT = { 'http://www.google.com/schemas/sitemap-image/1.1': 'image', 'http://www.google.com/schemas/sitemap-video/1.1': 'video',
    'http://www.google.com/schemas/sitemap-news/0.9': 'news', 'http://www.w3.org/1999/xhtml': 'xhtml' };
  var FREQ = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];
  var MAX_URLS = 50000, MAX_BYTES = 50 * 1024 * 1024;
  var W3C = /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?)?)?$/;

  function lineAt(text, idx) { var n = 1; for (var i = 0; i < idx && i < text.length; i++) if (text.charCodeAt(i) === 10) n++; return n; }
  function lineIndex(text) { var starts = [0]; for (var i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1); return function (idx) { var lo = 0, hi = starts.length - 1; while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (starts[mid] <= idx) lo = mid; else hi = mid - 1; } return lo + 1; }; }
  function checkDate(s) {
    var m = String(s).trim().match(W3C);
    if (!m) return 'not a W3C date';
    if (m[2] && (+m[2] < 1 || +m[2] > 12)) return 'month out of range';
    if (m[3]) { var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); if (d.getUTCDate() !== +m[3]) return 'not a real date'; }
    if (m[4] && !m[7]) return 'has a time but no time zone (add Z or +05:30)';
    if (m[4] && (+m[4] > 23 || +m[5] > 59 || (m[6] && +m[6] > 59))) return 'time out of range';
    return null;
  }
  function hreflangProblem(c) {
    if (/^x-default$/i.test(c)) return null;
    if (/_/.test(c)) return 'uses an underscore; use a hyphen, for example ' + c.replace(/_/g, '-');
    if (!/^[a-z]{2,3}(-[a-z]{4})?(-([a-z]{2}|\d{3}))?$/i.test(c)) return 'isn\'t a valid language code (ISO 639-1, optionally with an ISO 3166-1 region such as en-GB)';
    if (/-uk$/i.test(c)) return 'uses UK; the ISO region code for the United Kingdom is GB (en-GB)';
    return null;
  }
  function normUrl(u) { return String(u).replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase(); }

  function validate(text, opts) {
    opts = opts || {};
    text = String(text == null ? '' : text);
    var F = [], add = function (level, line, t, d, ex) { F.push({ level: level, line: line || null, text: t, detail: d || '', examples: ex || null }); };
    var bytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(text).length : text.length;
    var res = { findings: F, bytes: bytes, type: null, urls: [], hosts: {} };
    if (!text.trim()) { add('error', null, 'Nothing to check. Paste a sitemap, or load one from a URL.'); return finish(); }
    if (bytes > MAX_BYTES) add('error', null, 'The file is ' + (bytes / 1048576).toFixed(1) + ' MB uncompressed. The limit is 50 MB.', 'Split it and list the parts in a sitemap index.');
    var site = null;
    if (opts.site) { try { site = new URL(/^https?:\/\//i.test(opts.site) ? opts.site : 'https://' + opts.site); } catch (e) { site = null; } }

    var body = text.replace(/^﻿/, '');
    if (!/^\s*</.test(body)) return textSitemap(body);
    res.type = 'xml';
    if (/^\s+<\?xml/.test(body)) add('error', 1, 'There is whitespace before the <?xml declaration.', 'The XML declaration must be the very first thing in the file, or the sitemap fails to parse.');
    var decl = body.match(/^<\?xml[^>]*\?>/);
    if (decl && /encoding\s*=\s*["'](?!utf-8)[^"']+["']/i.test(decl[0])) add('warn', 1, 'The declared encoding isn\'t UTF-8.', 'Sitemaps must be UTF-8 encoded.');
    var li = lineIndex(text);
    // unescaped ampersands give a cryptic parser error; find them first
    var amp = /&(?!(amp|lt|gt|quot|apos);|#\d+;|#x[0-9a-f]+;)/gi, am, amps = [];
    while ((am = amp.exec(text)) && amps.length < 20) { if (!/<!\[CDATA\[[^\]]*$/.test(text.slice(Math.max(0, am.index - 200), am.index))) amps.push(li(am.index)); }
    if (amps.length) add('error', amps[0], 'Unescaped "&" in a URL' + (amps.length > 1 ? ' (' + amps.length + (amps.length === 20 ? '+' : '') + ' places)' : '') + '.', 'Write & as &amp; inside XML, for example ?a=1&amp;b=2. Lines: ' + amps.slice(0, 10).join(', ') + '.');

    if (typeof DOMParser === 'undefined') { add('error', null, 'XML parsing needs a browser.'); return finish(); }
    var doc = new DOMParser().parseFromString(body, 'application/xml');
    var pe = doc.getElementsByTagName('parsererror')[0];
    if (pe) {
      var msg = (pe.textContent || '').replace(/\s+/g, ' ').trim();
      var lm = msg.match(/line (?:number )?(\d+)/i);
      if (!amps.length) add('error', lm ? +lm[1] : null, 'The XML isn\'t well-formed, so search engines can\'t read any of it.', msg.replace(/^This page contains the following errors:\s*/i, '').replace(/Below is a rendering.*$/i, '').slice(0, 220));
      return finish();
    }
    var rootEl = doc.documentElement, rn = rootEl.localName;
    if (rn !== 'urlset' && rn !== 'sitemapindex') { add('error', 1, 'The root element is <' + rootEl.nodeName + '>. A sitemap starts with <urlset> or <sitemapindex>.', ''); return finish(); }
    res.type = rn;
    if (rootEl.namespaceURI !== NS) {
      add('error', lineAt(text, text.indexOf('<' + rootEl.nodeName)), rootEl.namespaceURI ? 'Wrong sitemap namespace: ' + rootEl.namespaceURI : 'The <' + rn + '> element has no namespace.', 'Use exactly xmlns="' + NS + '" (http, not https, no trailing slash).');
      return finish();
    }
    var entryName = rn === 'urlset' ? 'url' : 'sitemap';
    var entries = [], els = rootEl.children;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.namespaceURI === NS && el.localName === entryName) entries.push(el);
      else if (el.namespaceURI === NS) add('error', null, '<' + el.localName + '> isn\'t allowed directly inside <' + rn + '>.', rn === 'sitemapindex' && el.localName === 'url' ? 'A sitemap index lists <sitemap> entries, not <url> pages. Use a separate urlset file for pages.' : '');
    }
    // line of each entry, in document order
    var re = new RegExp('<(?:[\\w.-]+:)?' + entryName + '[\\s>]', 'g'), mm, lines = [];
    while ((mm = re.exec(text))) lines.push(li(mm.index));
    res.count = entries.length;
    if (!entries.length) add('error', null, 'The sitemap has no <' + entryName + '> entries.');
    if (entries.length > MAX_URLS) add('error', lines[MAX_URLS] || null, entries.length.toLocaleString() + ' entries. A sitemap can list at most 50,000.', 'Split it and list the parts in a sitemap index.');

    var seen = {}, seenNorm = {}, dups = [], nearDups = [], lastmods = {}, nLastmod = 0, future = [], badDates = [], badLoc = [], aemPaths = [], frags = [], http = [], https = 0, params = 0;
    var freqBad = [], prioBad = [], hasFreq = false, hasPrio = false, unknownNs = {}, alts = {}, hreflangBad = [], hrefNotAbs = [], noSelf = [], dupLang = [], imgNoLoc = [], tooManyImg = [], videoBad = [], newsBad = [], newsCount = 0;
    var now = Date.now() + 864e5, offHost = [], offPath = [];
    entries.forEach(function (e, idx) {
      var ln = lines[idx] || null;
      var kids = Array.prototype.slice.call(e.children);
      var locEls = kids.filter(function (k) { return k.namespaceURI === NS && k.localName === 'loc'; });
      if (!locEls.length) { add('error', ln, '<' + entryName + '> without a <loc>.', 'Every entry needs exactly one <loc>.'); return; }
      if (locEls.length > 1) add('error', ln, '<' + entryName + '> has ' + locEls.length + ' <loc> elements; only one is allowed.');
      var raw = locEls[0].textContent, loc = raw.trim();
      if (raw !== loc) badLoc.push({ line: ln, why: 'has spaces or line breaks around the URL' });
      var u = null;
      try { u = new URL(loc); } catch (er) { u = null; }
      if (!u || !/^https?:$/.test(u.protocol) || !/^https?:\/\//i.test(loc)) { badLoc.push({ line: ln, why: '"' + loc.slice(0, 80) + '" is not an absolute http(s) URL' }); return; }
      if (loc.length > 2048) badLoc.push({ line: ln, why: 'is longer than 2,048 characters' });
      if (/\s/.test(loc)) badLoc.push({ line: ln, why: 'contains a space (encode it as %20)' });
      res.urls.push({ loc: loc, line: ln });
      res.hosts[u.host] = (res.hosts[u.host] || 0) + 1;
      if (u.protocol === 'http:') http.push(ln); else https++;
      if (u.hash) frags.push(ln);
      if (u.search) params++;
      if (/(^|\.)adobeaemcloud\.com$|^localhost$|^127\.|^author[.-]|\.local$/i.test(u.hostname) || /:4502|:4503/.test(u.host)) badLoc.push({ line: ln, why: 'uses the internal host ' + u.host + ', not your public domain (check the AEM Externalizer)' });
      if (/^\/content\/[^/]+\//.test(u.pathname) && !/^\/content\/dam\//.test(u.pathname)) aemPaths.push(ln);
      if (site) {
        if (u.host !== site.host) offHost.push(ln);
        else { var base = site.pathname.replace(/[^/]*$/, ''); if (base !== '/' && u.pathname.indexOf(base) !== 0) offPath.push(ln); }
      }
      if (seen[loc]) dups.push(ln); else seen[loc] = ln;
      var nu = normUrl(loc);
      if (seenNorm[nu] && seenNorm[nu] !== loc) nearDups.push({ line: ln, a: seenNorm[nu], b: loc }); else seenNorm[nu] = loc;

      kids.forEach(function (k) {
        var ns = k.namespaceURI, name = k.localName;
        if (ns === NS) {
          if (name === 'loc') return;
          if (name === 'lastmod') {
            nLastmod++;
            var v = k.textContent.trim(), why = checkDate(v);
            if (why) badDates.push({ line: ln, v: v, why: why });
            else { lastmods[v] = (lastmods[v] || 0) + 1; var t = Date.parse(v.length === 4 ? v + '-01-01' : v.length === 7 ? v + '-01' : v); if (t > now) future.push(ln); }
            return;
          }
          if (name === 'changefreq' && entryName === 'url') { hasFreq = true; if (FREQ.indexOf(k.textContent.trim()) < 0) freqBad.push({ line: ln, v: k.textContent.trim() }); return; }
          if (name === 'priority' && entryName === 'url') { hasPrio = true; var pv = k.textContent.trim(); if (!/^(0(\.\d+)?|1(\.0+)?)$/.test(pv)) prioBad.push({ line: ln, v: pv }); return; }
          add('error', ln, '<' + name + '> isn\'t a valid element inside <' + entryName + '>.', entryName === 'sitemap' ? 'A <sitemap> entry only takes <loc> and <lastmod>.' : 'Allowed: loc, lastmod, changefreq, priority, plus image, video, news and xhtml:link extensions.');
          return;
        }
        var ext = EXT[ns];
        if (!ext) { unknownNs[ns || '(none)'] = ln; return; }
        if (ext === 'xhtml' && name === 'link') {
          var hl = k.getAttribute('hreflang'), href = k.getAttribute('href'), rel = k.getAttribute('rel');
          if (rel !== 'alternate') hreflangBad.push({ line: ln, why: 'xhtml:link needs rel="alternate"' });
          if (!hl) hreflangBad.push({ line: ln, why: 'xhtml:link has no hreflang' });
          else { var hp = hreflangProblem(hl); if (hp) hreflangBad.push({ line: ln, why: '"' + hl + '" ' + hp }); }
          if (!href || !/^https?:\/\//i.test(href)) hrefNotAbs.push(ln);
          (alts[loc] = alts[loc] || { line: ln, langs: {}, hrefs: {} });
          if (hl) { var key = hl.toLowerCase(); if (alts[loc].langs[key] && alts[loc].langs[key] !== href) dupLang.push({ line: ln, lang: hl }); alts[loc].langs[key] = href; }
          if (href) alts[loc].hrefs[href] = hl;
        }
        if (ext === 'image' && name === 'image') { if (!k.getElementsByTagNameNS(ns, 'loc').length) imgNoLoc.push(ln); }
        if (ext === 'video' && name === 'video') {
          var need = ['thumbnail_loc', 'title', 'description'].filter(function (n) { return !k.getElementsByTagNameNS(ns, n).length; });
          if (!k.getElementsByTagNameNS(ns, 'content_loc').length && !k.getElementsByTagNameNS(ns, 'player_loc').length) need.push('content_loc or player_loc');
          if (need.length) videoBad.push({ line: ln, need: need });
        }
        if (ext === 'news' && name === 'news') {
          newsCount++;
          var nneed = ['publication', 'publication_date', 'title'].filter(function (n) { return !k.getElementsByTagNameNS(ns, n).length; });
          if (nneed.length) newsBad.push({ line: ln, need: nneed });
        }
      });
      var imgs = e.getElementsByTagNameNS('http://www.google.com/schemas/sitemap-image/1.1', 'image').length;
      if (imgs > 1000) tooManyImg.push(ln);
      if (alts[loc] && !alts[loc].hrefs[loc]) noSelf.push(ln);
    });

    var ex = function (arr, f) { return arr.slice(0, 5).map(f || function (x) { return 'line ' + (x.line || x); }); };
    if (badLoc.length) add('error', badLoc[0].line, badLoc.length + ' <loc> value' + (badLoc.length > 1 ? 's are' : ' is') + ' invalid.', 'Search engines skip these URLs.', ex(badLoc, function (x) { return 'Line ' + x.line + ': ' + x.why; }));
    if (dups.length) add('warn', dups[0], dups.length + ' duplicate URL' + (dups.length > 1 ? 's' : '') + '.', 'List each URL once.', ex(dups));
    if (nearDups.length) add('warn', nearDups[0].line, nearDups.length + ' URL' + (nearDups.length > 1 ? 's differ' : ' differs') + ' from another only by http/https, case or a trailing slash.', 'List only the canonical version of each page.', ex(nearDups, function (x) { return x.a + ' vs ' + x.b; }));
    var hostList = Object.keys(res.hosts);
    if (hostList.length > 1) add('warn', null, 'URLs on ' + hostList.length + ' different hosts: ' + hostList.slice(0, 4).join(', ') + (hostList.length > 4 ? '…' : '') + '.', 'A sitemap should only list URLs on the host it is served from, unless every host is verified in the same Search Console account.');
    if (http.length && https) add('warn', http[0], http.length + ' URL' + (http.length > 1 ? 's use' : ' uses') + ' http:// while the rest use https://.', 'List the https:// version that you redirect to.', ex(http));
    if (offHost.length) add('error', offHost[0], offHost.length + ' URL' + (offHost.length > 1 ? 's are' : ' is') + ' on a different host from ' + site.host + '.', 'Google ignores URLs on another host unless both are verified in one Search Console property.', ex(offHost));
    if (offPath.length) add('warn', offPath[0], offPath.length + ' URL' + (offPath.length > 1 ? 's are' : ' is') + ' outside the folder the sitemap lives in.', 'Under the sitemaps.org rules, a sitemap at /folder/sitemap.xml can only list URLs under /folder/. Move it to the root.', ex(offPath));
    if (frags.length) add('warn', frags[0], frags.length + ' URL' + (frags.length > 1 ? 's contain' : ' contains') + ' a # fragment.', 'Fragments aren\'t separate pages. Remove them.', ex(frags));
    if (aemPaths.length) add('warn', aemPaths[0], aemPaths.length + ' URL' + (aemPaths.length > 1 ? 's look' : ' looks') + ' like unmapped AEM repository paths (/content/<site>/…).', 'If your public URLs are shortened by Sling mappings or Dispatcher rewrites, the sitemap should list the short URLs. Check the AEM sitemap generator\'s externalizer and mapping settings.', ex(aemPaths));
    if (params && res.urls.length && params / res.urls.length > 0.2) add('info', null, params + ' URLs have query strings.', 'Usually only canonical URLs without tracking or sort parameters belong in a sitemap.');
    if (badDates.length) add('error', badDates[0].line, badDates.length + ' <lastmod> value' + (badDates.length > 1 ? 's are' : ' is') + ' not in W3C date format.', 'Use 2026-11-28 or 2026-11-28T10:30:00+05:30. Google ignores invalid dates.', ex(badDates, function (x) { return 'Line ' + x.line + ': "' + x.v + '" ' + x.why; }));
    if (future.length) add('warn', future[0], future.length + ' <lastmod> date' + (future.length > 1 ? 's are' : ' is') + ' in the future.', 'Google may stop trusting lastmod for the whole site.', ex(future));
    var distinct = Object.keys(lastmods);
    if (nLastmod >= 10 && distinct.length === 1) add('warn', null, 'Every <lastmod> is the same (' + distinct[0] + ').', 'That usually means the build or publish time, not when each page changed. Google ignores lastmod it can\'t trust. Use each page\'s real modification date.');
    if (entries.length && !nLastmod && entryName === 'url') add('info', null, 'No <lastmod> dates.', 'Google uses accurate lastmod values to decide what to recrawl. Add them if you can make them accurate.');
    if (freqBad.length) add('error', freqBad[0].line, 'Invalid <changefreq> "' + freqBad[0].v + '"' + (freqBad.length > 1 ? ' and ' + (freqBad.length - 1) + ' more' : '') + '.', 'Allowed: ' + FREQ.join(', ') + '.');
    if (prioBad.length) add('error', prioBad[0].line, 'Invalid <priority> "' + prioBad[0].v + '"' + (prioBad.length > 1 ? ' and ' + (prioBad.length - 1) + ' more' : '') + '.', 'Use a number from 0.0 to 1.0.');
    if (hasFreq || hasPrio) add('info', null, 'Google ignores <changefreq> and <priority>.', 'They are valid, but removing them makes the file smaller. Bing also gives them little weight.');
    Object.keys(unknownNs).forEach(function (ns) { add('info', unknownNs[ns], 'Elements in the namespace ' + ns + ' aren\'t a sitemap extension search engines read.', ''); });

    if (hreflangBad.length) add('error', hreflangBad[0].line, hreflangBad.length + ' hreflang problem' + (hreflangBad.length > 1 ? 's' : '') + '.', '', ex(hreflangBad, function (x) { return 'Line ' + x.line + ': ' + x.why; }));
    if (hrefNotAbs.length) add('error', hrefNotAbs[0], hrefNotAbs.length + ' xhtml:link href value' + (hrefNotAbs.length > 1 ? 's are' : ' is') + ' missing or not absolute.', '', ex(hrefNotAbs));
    if (dupLang.length) add('error', dupLang[0].line, 'The same hreflang points to different URLs on one entry (' + dupLang[0].lang + ').', '');
    if (noSelf.length) add('warn', noSelf[0], noSelf.length + ' URL' + (noSelf.length > 1 ? 's with' : ' with') + ' hreflang alternates don\'t list themselves.', 'Each language version must include an xhtml:link to itself as well as to the others.', ex(noSelf));
    var noReturn = [];
    Object.keys(alts).forEach(function (a) {
      Object.keys(alts[a].hrefs).forEach(function (b) {
        if (b === a || !seen[b]) return;   // only pages listed in this file can be checked
        if (!alts[b] || !alts[b].hrefs[a]) noReturn.push({ line: alts[a].line, a: a, b: b });
      });
    });
    if (noReturn.length) add('error', noReturn[0].line, noReturn.length + ' hreflang link' + (noReturn.length > 1 ? 's have' : ' has') + ' no return link.', 'If A lists B as an alternate, B must list A. Google ignores one-way hreflang.', ex(noReturn, function (x) { return x.a + ' → ' + x.b; }));
    var langsUsed = {}; Object.keys(alts).forEach(function (a) { Object.keys(alts[a].langs).forEach(function (l) { langsUsed[l] = 1; }); });
    if (Object.keys(alts).length && !langsUsed['x-default']) add('info', null, 'No x-default alternate.', 'x-default tells search engines which page to show users whose language you don\'t target. It is optional but recommended.');
    if (imgNoLoc.length) add('error', imgNoLoc[0], imgNoLoc.length + ' <image:image> element' + (imgNoLoc.length > 1 ? 's have' : ' has') + ' no <image:loc>.', '', ex(imgNoLoc));
    if (tooManyImg.length) add('error', tooManyImg[0], 'More than 1,000 images on one URL.', 'Google reads at most 1,000 images per page entry.');
    if (videoBad.length) add('error', videoBad[0].line, videoBad.length + ' video entr' + (videoBad.length > 1 ? 'ies are' : 'y is') + ' missing required tags.', '', ex(videoBad, function (x) { return 'Line ' + x.line + ': missing ' + x.need.join(', '); }));
    if (newsBad.length) add('error', newsBad[0].line, newsBad.length + ' news entr' + (newsBad.length > 1 ? 'ies are' : 'y is') + ' missing required tags.', '', ex(newsBad, function (x) { return 'Line ' + x.line + ': missing ' + x.need.join(', '); }));
    if (newsCount > 1000) add('error', null, newsCount + ' news URLs. A Google News sitemap can list at most 1,000.', 'Keep only articles from the last two days.');
    res.hreflang = Object.keys(alts).length; res.withLastmod = nLastmod;

    robotsCross();
    return finish();

    function textSitemap(t) {
      res.type = 'text';
      var seenT = {};
      t.split(/\r\n|\r|\n/).forEach(function (l, i) {
        var s = l.trim(); if (!s) return;
        var ln = i + 1;
        if (/^#/.test(s)) { add('error', ln, 'Comments aren\'t allowed in a text sitemap.', 'Each line must be a URL and nothing else.'); return; }
        var u; try { u = new URL(s); } catch (e) { u = null; }
        if (!u || !/^https?:\/\//i.test(s)) { add('error', ln, '"' + s.slice(0, 80) + '" is not an absolute URL.', 'A text sitemap has one full URL per line.'); return; }
        if (/\s/.test(s)) { add('error', ln, 'The URL contains a space. Encode it as %20.'); return; }
        if (l !== s) add('info', ln, 'Leading or trailing whitespace on the line.');
        res.urls.push({ loc: s, line: ln });
        res.hosts[u.host] = (res.hosts[u.host] || 0) + 1;
        if (seenT[s]) add('warn', ln, 'Duplicate URL (also line ' + seenT[s] + ').'); else seenT[s] = ln;
        if (site && u.host !== site.host) add('error', ln, 'URL is on ' + u.host + ', not ' + site.host + '.');
        if (/(^|\.)adobeaemcloud\.com$|^localhost$/i.test(u.hostname)) add('error', ln, 'URL uses the internal host ' + u.host + '.');
      });
      res.count = res.urls.length;
      if (!res.urls.length) add('error', null, 'No URLs found. If this is meant to be XML, it must start with <?xml or <urlset.');
      if (res.urls.length > MAX_URLS) add('error', null, res.urls.length.toLocaleString() + ' URLs. A sitemap can list at most 50,000.');
      if (Object.keys(res.hosts).length > 1) add('warn', null, 'URLs on ' + Object.keys(res.hosts).length + ' different hosts.', 'List only URLs on the host the sitemap is served from.');
      robotsCross();
      return finish();
    }
    function robotsCross() {
      var R = root.KJRobotsCheck;
      if (!opts.robots || !R || !res.urls.length || res.type === 'sitemapindex') return;
      var p = R.parse(opts.robots), blocked = res.urls.filter(function (u) { return !R.test(p, 'Googlebot', u.loc).allowed; });
      if (blocked.length) add('error', blocked[0].line, blocked.length + ' URL' + (blocked.length > 1 ? 's in the sitemap are' : ' in the sitemap is') + ' blocked for Googlebot by your robots.txt.', 'A sitemap should only list pages you want crawled. Remove them or change robots.txt.', blocked.slice(0, 5).map(function (u) { var t = R.test(p, 'Googlebot', u.loc); return u.loc + ' (Disallow: ' + t.rule.path + ')'; }));
      else add('ok', null, 'None of the ' + res.urls.length.toLocaleString() + ' URLs is blocked for Googlebot by the robots.txt you provided.');
    }
    function finish() {
      var rank = { error: 0, warn: 1, info: 2, ok: 3 };
      F.sort(function (a, b) { return rank[a.level] - rank[b.level] || (a.line || 0) - (b.line || 0); });
      res.errors = F.filter(function (f) { return f.level === 'error'; }).length;
      res.warnings = F.filter(function (f) { return f.level === 'warn'; }).length;
      return res;
    }
  }

  var SAMPLE = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    '  <url>',
    '    <loc>https://www.example.com/en/</loc>',
    '    <lastmod>2026-11-20</lastmod>',
    '    <xhtml:link rel="alternate" hreflang="en" href="https://www.example.com/en/"/>',
    '    <xhtml:link rel="alternate" hreflang="hi" href="https://www.example.com/hi/"/>',
    '    <xhtml:link rel="alternate" hreflang="x-default" href="https://www.example.com/en/"/>',
    '  </url>',
    '  <url>',
    '    <loc>https://www.example.com/hi/</loc>',
    '    <lastmod>2026-11-18</lastmod>',
    '    <xhtml:link rel="alternate" hreflang="en" href="https://www.example.com/en/"/>',
    '    <xhtml:link rel="alternate" hreflang="hi" href="https://www.example.com/hi/"/>',
    '    <xhtml:link rel="alternate" hreflang="x-default" href="https://www.example.com/en/"/>',
    '  </url>',
    '  <url>',
    '    <loc>https://www.example.com/en/products/</loc>',
    '    <lastmod>2026-11-02T09:30:00+05:30</lastmod>',
    '  </url>',
    '</urlset>', ''].join('\n');
  var BROKEN = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    '  <url>',
    '    <loc>https://www.example.com/en/</loc>',
    '    <lastmod>2026-13-01</lastmod>',
    '    <changefreq>sometimes</changefreq>',
    '    <xhtml:link rel="alternate" hreflang="en_GB" href="https://www.example.com/en/"/>',
    '    <xhtml:link rel="alternate" hreflang="hi" href="https://www.example.com/hi/"/>',
    '  </url>',
    '  <url>',
    '    <loc>https://www.example.com/hi/</loc>',
    '    <priority>1.5</priority>',
    '  </url>',
    '  <url>',
    '    <loc>/en/about/</loc>',
    '  </url>',
    '  <url>',
    '    <loc>https://publish-p12345-e67890.adobeaemcloud.com/content/site/en/contact.html</loc>',
    '    <lastmod>2026-11-28T10:30:00</lastmod>',
    '  </url>',
    '  <url>',
    '    <loc>http://www.example.com/en</loc>',
    '  </url>',
    '  <url>',
    '    <loc>https://www.example.com/en/</loc>',
    '  </url>',
    '</urlset>', ''].join('\n');

  var api = { validate: validate, checkDate: checkDate, hreflangProblem: hreflangProblem, SAMPLE: SAMPLE, BROKEN: BROKEN };
  root.KJSitemap = api;
  if (typeof module !== 'undefined') module.exports = api;
  if (typeof document === 'undefined') return;

  /* ---------- UI ---------- */
  function init() {
    var form = document.getElementById('smForm'); if (!form) return;
    var h = root.KJTools.h, K = root.KJTools, out = document.getElementById('smOut'), ta = form.elements.smText;
    var ed = KJA.editor(ta, document.getElementById('smGutter')), status = document.getElementById('smStatus');
    var big = null;   // very large files are checked without putting them in the textarea
    function setText(t) {
      if (t.length > 2e6) { big = t; ta.value = t.slice(0, 200000) + '\n\n… (showing the first 200 KB of ' + (t.length / 1048576).toFixed(1) + ' MB; the whole file is checked)'; }
      else { big = null; ta.value = t; }
      ed.refresh();
    }
    ta.addEventListener('input', function () { big = null; });
    document.getElementById('smSample').addEventListener('click', function () { setText(SAMPLE); run(); });
    document.getElementById('smBroken').addEventListener('click', function () { setText(BROKEN); run(); });
    document.getElementById('smFile').addEventListener('change', function (e) {
      var f = e.target.files[0]; if (!f) return;
      KJA.readFile(f).then(function (t) { setText(t); status.textContent = 'Loaded ' + f.name + '.'; run(); }, function () { status.textContent = 'Could not read ' + f.name + '.'; });
    });
    var fetchBtn = document.getElementById('smFetch');
    fetchBtn.addEventListener('click', function () {
      var v = form.elements.smUrl.value.trim();
      if (!v) { status.textContent = 'Enter the sitemap URL first.'; return; }
      if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
      status.textContent = 'Fetching ' + v + '…'; fetchBtn.disabled = true;
      K.jina(v, 'text', { key: K.store && K.store.get('kj-pc-jina-key') }).then(function (r) {
        fetchBtn.disabled = false;
        if (!r.ok) { status.textContent = 'Could not fetch ' + v + (r.status ? ' (HTTP ' + r.status + ')' : '') + '. ' + (r.error || 'Download the file and upload it instead.'); return; }
        if (r.servedHtml && !/^\s*(<\?xml|<urlset|<sitemapindex|https?:\/\/)/i.test(r.body || '')) status.textContent = v + ' returned an HTML page, not a sitemap. Check the URL.';
        else status.textContent = 'Loaded ' + v + '. Fetched through Jina Reader, which returns the file as text.';
        setText(r.body);
        if (!form.elements.smSite.value) form.elements.smSite.value = v;
        run();
      }, function (e) { fetchBtn.disabled = false; status.textContent = e.message + ' Download the file and upload it instead.'; });
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); run(); });

    function run() {
      var r = validate(big || ta.value, { site: form.elements.smSite.value.trim(), robots: form.elements.smRobots.value });
      out.hidden = false; out.textContent = '';
      var typeName = { urlset: 'XML sitemap', sitemapindex: 'Sitemap index', text: 'Text sitemap', xml: 'XML' }[r.type] || 'Unknown';
      out.appendChild(h('div', { class: 'kt-verdict ' + (r.errors ? 'kt-deny' : 'kt-allow'), role: 'status' },
        r.errors ? r.errors + ' error' + (r.errors > 1 ? 's' : '') + ' to fix' : (r.warnings ? 'Valid. ' + r.warnings + ' warning' + (r.warnings > 1 ? 's' : '') + ' to review.' : 'Valid, and no problems found.'),
        h('small', { text: 'Checked against the sitemaps.org protocol and Google\'s sitemap rules. Errors mean search engines skip the file or some of its URLs.' })));
      var hosts = Object.keys(r.hosts);
      out.appendChild(h('div', { class: 'me-tiles cd-tiles' }, KJA.stat('Type', typeName), KJA.stat(r.type === 'sitemapindex' ? 'Sitemaps listed' : 'URLs', (r.count || 0).toLocaleString(), r.count > 50000 ? 'bad' : ''),
        KJA.stat('Errors', r.errors, r.errors ? 'bad' : 'good'), KJA.stat('Warnings', r.warnings, r.warnings ? 'mid' : 'good'),
        KJA.stat('Size', r.bytes < 1048576 ? (r.bytes / 1024).toFixed(1) + ' KB' : (r.bytes / 1048576).toFixed(1) + ' MB', r.bytes > 52428800 ? 'bad' : ''),
        KJA.stat('Hosts', hosts.length || 0, hosts.length > 1 ? 'mid' : ''),
        r.type === 'urlset' ? KJA.stat('With lastmod', r.count ? Math.round(100 * (r.withLastmod || 0) / r.count) + '%' : '0%') : null,
        r.hreflang ? KJA.stat('With hreflang', r.hreflang.toLocaleString()) : null));
      if (r.findings.length) {
        out.appendChild(h('h3', { class: 'cd-h', text: 'Findings' }));
        var list = KJA.lineFindings(r.findings, big ? null : ed.goLine);
        r.findings.forEach(function (f, i) { if (f.examples) list.children[i].appendChild(h('small', { class: 'sm-ex', text: 'Examples: ' + f.examples.join(' · ') })); });
        out.appendChild(list);
      }
      if (r.urls.length) {
        var csv = 'url,line\n' + r.urls.map(function (u) { return '"' + u.loc.replace(/"/g, '""') + '",' + u.line; }).join('\n');
        var b = h('button', { type: 'button', class: 'btn ghost pc-sm', text: 'Download the URL list (CSV)' });
        b.addEventListener('click', function () { KJA.download(csv, 'sitemap-urls.csv', 'text/csv'); });
        out.appendChild(h('div', { class: 'kt-row' }, b));
      }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);

/* SEO audit: crawlability, robots.txt, XML sitemaps, on-page, technical, structured data and,
   with a Google API key, Core Web Vitals from PageSpeed Insights. Runs entirely in the browser. */
(function () {
  'use strict';
  var K = window.KJTools;
  var form = document.getElementById('auForm');
  if (!K || !form) return;
  var h = K.h, norm = K.norm;
  var PSI_STORE = 'kj-seo-psi-key';

  var CATS = [
    { id: 'crawl', title: 'Crawling and indexing', weight: 25, intro: 'Can search engines reach this URL, and are they allowed to index it?' },
    { id: 'robots', title: 'robots.txt and XML sitemaps', weight: 15, intro: 'The site-level files that tell crawlers what to fetch and which URLs matter.' },
    { id: 'onpage', title: 'On-page content', weight: 25, intro: 'Titles, descriptions, headings, content depth, images and links: what decides how this page ranks and how its search result looks.' },
    { id: 'tech', title: 'Technical and mobile', weight: 15, intro: 'Mobile readiness, language and international targeting, security and URL hygiene.' },
    { id: 'schema', title: 'Structured data and social', weight: 10, intro: 'Schema.org markup for rich results, and Open Graph tags for link previews.' },
    { id: 'perf', title: 'Performance and Core Web Vitals', weight: 10, intro: 'Real-user Core Web Vitals (CrUX) and a Lighthouse lab run from Google PageSpeed Insights.' }
  ];
  var REQUIRED = {
    article: ['headline', 'image', 'datePublished', 'author'], blogposting: ['headline', 'image', 'datePublished', 'author'], newsarticle: ['headline', 'image', 'datePublished', 'author'],
    product: ['name', ['offers', 'review', 'aggregateRating']], organization: ['name', 'url', 'logo'], localbusiness: ['name', 'address'],
    breadcrumblist: ['itemListElement'], faqpage: ['mainEntity'], website: ['name', 'url'], event: ['name', 'startDate', 'location'],
    recipe: ['name', 'image'], videoobject: ['name', 'thumbnailUrl', 'uploadDate'], jobposting: ['title', 'datePosted', 'description', 'hiringOrganization'],
    person: ['name'], softwareapplication: ['name', ['offers', 'aggregateRating', 'review']]
  };
  var GENERIC_ANCHORS = /^(click here|here|read more|more|learn more|this|link|continue|details|go|view more|find out more)$/i;
  var W3C_DATE = /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?)?)?$/;

  var checks;
  function C(cat, status, title, detail, fix, weight, list) {
    checks.push({ cat: cat, status: status, title: title, detail: detail || '', fix: fix || '', weight: weight || 1, list: list || null });
  }
  var strip = function (u) { try { var x = new URL(u); x.hash = ''; return x.href; } catch (e) { return u || ''; } };
  var loose = function (u) { return strip(u).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '').toLowerCase(); };
  var plural = function (n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); };

  /* ---------- robots.txt and sitemaps ---------- */
  function checkRobots(res, finalUrl) {
    var u = new URL(finalUrl);
    if (!res) { C('robots', 'info', 'robots.txt could not be checked', 'The request for robots.txt failed.', '', 1); return null; }
    if (res.status === 404 || res.status === 410) {
      C('robots', 'warn', 'No robots.txt file', u.origin + '/robots.txt returns ' + res.status + '. Crawlers treat a missing file as "allow everything", which is safe, but you lose the place to declare sitemaps and block low-value paths.', 'Add a robots.txt with at least a Sitemap line.', 1);
      return null;
    }
    if (res.status >= 500) { C('robots', 'fail', 'robots.txt returns a server error (' + res.status + ')', 'Google treats a 5xx robots.txt as "disallow everything" for a while, then may fall back to a cached copy. Crawling can stop.', 'Make /robots.txt return 200 (or 404 if you have none).', 4); return null; }
    if (!res.ok) { C('robots', 'info', 'robots.txt could not be checked', res.error || 'Unexpected response.', '', 1); return null; }
    var robots = K.parseRobots(res.body);
    if (res.servedHtml || robots.looksLikeHtml) { C('robots', 'fail', 'robots.txt returns an HTML page', '/robots.txt answers with a web page (often an app or CMS fallback for unknown URLs), so crawlers find no rules and no sitemaps.', 'Serve a plain-text robots.txt at the root of the host.', 3); return null; }
    C('robots', 'pass', 'robots.txt found', u.origin + '/robots.txt · ' + plural(robots.groups.length, 'user-agent group') + ', ' + plural(robots.sitemaps.length, 'sitemap') + ' declared.', '', 1);
    var size = new Blob([res.body]).size;
    if (size > 500 * 1024) C('robots', 'fail', 'robots.txt is larger than 500 KiB', 'Google ignores everything after the first 500 KiB (' + Math.round(size / 1024) + ' KiB here).', 'Consolidate rules with wildcards.', 2);
    var problems = robots.invalid.map(function (x) { return 'Line ' + x.line + ': ' + x.text; })
      .concat(robots.unknown.map(function (x) { return 'Line ' + x.line + ' (unknown directive): ' + x.text; }));
    if (robots.orphanRules) problems.push(robots.orphanRules + ' Allow/Disallow line(s) before any User-agent line (ignored)');
    if (problems.length) C('robots', 'warn', 'robots.txt has lines crawlers will ignore', plural(problems.length, 'problem') + ' found.', 'Use only User-agent, Allow, Disallow and Sitemap lines, each group starting with User-agent.', 1, problems);
    else C('robots', 'pass', 'robots.txt syntax is valid', '', '', 1);
    if (robots.crawlDelay) C('robots', 'info', 'Crawl-delay is set', 'Google ignores Crawl-delay; Bing and some others respect it.', '', 1);

    var root = K.isAllowed(robots, 'googlebot', '/');
    var page = K.isAllowed(robots, 'googlebot', u.pathname + u.search);
    if (!root.allowed && !page.allowed) C('crawl', 'fail', 'robots.txt blocks the whole site for Googlebot', 'Rule: Disallow: ' + root.rule.path, 'Remove the Disallow: / rule for Googlebot or *.', 5);
    else if (!page.allowed) C('crawl', 'fail', 'robots.txt blocks this page for Googlebot', 'Matched rule: ' + (page.rule.allow ? 'Allow' : 'Disallow') + ': ' + page.rule.path + '. Blocked pages can still be indexed from links, without a snippet.', 'Remove or narrow the rule. To keep a page out of results, use noindex instead, and let it be crawled.', 5);
    else C('crawl', 'pass', 'Googlebot may crawl this page', page.rule ? 'Matched rule: Allow: ' + page.rule.path : 'No rule blocks this URL.', '', 3);
    var bing = K.isAllowed(robots, 'bingbot', u.pathname + u.search);
    if (!bing.allowed) C('crawl', 'warn', 'robots.txt blocks this page for Bingbot', 'Bing powers Copilot, DuckDuckGo results and parts of ChatGPT search. Matched rule: Disallow: ' + bing.rule.path, 'Allow Bingbot unless you mean to block it.', 2);
    if (robots.sitemaps.length) C('robots', 'pass', 'Sitemap declared in robots.txt', '', '', 1, robots.sitemaps);
    else C('robots', 'warn', 'No Sitemap line in robots.txt', 'Declaring sitemaps in robots.txt lets every crawler find them, not only those you submit to.', 'Add "Sitemap: ' + u.origin + '/sitemap.xml" (absolute URL).', 1);
    var relative = robots.sitemaps.filter(function (s) { return !/^https?:\/\//i.test(s); });
    if (relative.length) C('robots', 'warn', 'Sitemap URLs in robots.txt are not absolute', '', 'Use full URLs, including https://.', 1, relative);
    return robots;
  }

  function parseSitemap(text) {
    var doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) return { error: 'Not valid XML' };
    var root = doc.documentElement, kind = root.localName;
    if (kind !== 'urlset' && kind !== 'sitemapindex') return { error: 'Root element is <' + kind + '>, not <urlset> or <sitemapindex>' };
    var ns = root.namespaceURI;
    var entries = Array.from(root.children).filter(function (n) { return n.localName === (kind === 'urlset' ? 'url' : 'sitemap'); }).map(function (n) {
      var get = function (t) { var c = Array.from(n.children).find(function (x) { return x.localName === t; }); return c ? norm(c.textContent) : ''; };
      return { loc: get('loc'), lastmod: get('lastmod') };
    });
    return { kind: kind, ns: ns, entries: entries };
  }

  async function checkSitemaps(robots, finalUrl, o, setStep) {
    var u = new URL(finalUrl);
    var declared = robots ? robots.sitemaps.filter(function (s) { return /^https?:\/\//i.test(s); }) : [];
    var candidates = declared.length ? declared.slice(0, 2) : [u.origin + '/sitemap.xml'];
    var loaded = [], urlsets = [];
    for (var i = 0; i < candidates.length; i++) {
      var sm = candidates[i];
      if (/\.gz($|\?)/i.test(sm)) { C('robots', 'info', 'Compressed sitemap not checked', sm + ' is gzipped, which this browser tool can\'t read.', '', 1); continue; }
      setStep('run', 'Reading ' + sm);
      var res = await K.jina(sm, 'text', o).catch(function (e) { return { ok: false, error: e.message }; });
      if (!res.ok || !res.status || res.status >= 400) {
        if (declared.length) C('robots', 'fail', 'Declared sitemap is not reachable', sm + ' returns ' + (res.status || res.error || 'an error') + '.', 'Fix the URL in robots.txt or publish the sitemap.', 3);
        else C('robots', 'warn', 'No XML sitemap found', 'None declared in robots.txt, and ' + sm + ' returns ' + (res.status || 'an error') + '.', 'Publish an XML sitemap of your canonical, indexable URLs and declare it in robots.txt.', 2);
        continue;
      }
      var p = parseSitemap(res.body);
      if (p.error) { C('robots', 'fail', 'Sitemap is not valid', sm + ': ' + p.error + '.', 'Generate the sitemap with your CMS or a validated library.', 3); continue; }
      loaded.push(sm);
      if (p.ns !== 'http://www.sitemaps.org/schemas/sitemap/0.9') C('robots', 'warn', 'Sitemap namespace is missing or wrong', sm + ' uses "' + (p.ns || 'no namespace') + '".', 'Use xmlns="http://www.sitemaps.org/schemas/sitemap/0.9".', 1);
      if (p.kind === 'sitemapindex') {
        C('robots', 'pass', 'Sitemap index found', sm + ' lists ' + plural(p.entries.length, 'sitemap') + '.', '', 2);
        var child = p.entries.find(function (e) { return e.loc && !/\.gz($|\?)/i.test(e.loc); });
        if (child) {
          setStep('run', 'Reading ' + child.loc);
          var cr = await K.jina(child.loc, 'text', o).catch(function () { return { ok: false }; });
          var cp = cr.ok ? parseSitemap(cr.body) : { error: 'not reachable (' + (cr.status || 'error') + ')' };
          if (cp.error) C('robots', 'fail', 'Child sitemap is not valid', child.loc + ': ' + cp.error + '.', 'Fix the child sitemap.', 2);
          else if (cp.kind === 'urlset') { urlsets.push({ url: child.loc, p: cp, size: new Blob([cr.body]).size }); loaded.push(child.loc); }
        }
      } else urlsets.push({ url: sm, p: p, size: new Blob([res.body]).size });
    }
    if (!urlsets.length) return;
    var total = 0, bad = [], offHost = [], lastmods = 0, badDates = [];
    urlsets.forEach(function (s) {
      total += s.p.entries.length;
      if (s.p.entries.length > 50000) bad.push(s.url + ': ' + s.p.entries.length + ' URLs (limit 50,000)');
      if (s.size > 50 * 1024 * 1024) bad.push(s.url + ': larger than 50 MB uncompressed');
      s.p.entries.forEach(function (e) {
        if (!/^https?:\/\//i.test(e.loc) || !K.sameSite(e.loc, finalUrl) || (u.protocol === 'https:' && /^http:/i.test(e.loc))) offHost.push(e.loc);
        if (e.lastmod) { lastmods++; if (!W3C_DATE.test(e.lastmod)) badDates.push(e.loc + ' → ' + e.lastmod); }
      });
    });
    C('robots', 'pass', 'Sitemap is valid XML', plural(total, 'URL') + ' in ' + urlsets.map(function (s) { return s.url; }).join(', ') + '.', '', 2);
    if (bad.length) C('robots', 'fail', 'Sitemap exceeds protocol limits', '', 'Split it into several sitemaps under a sitemap index.', 2, bad);
    if (offHost.length) C('robots', 'warn', 'Sitemap lists URLs on another host or protocol', plural(offHost.length, 'URL') + ' don\'t match ' + u.protocol + '//' + u.hostname + '.', 'List only canonical URLs on the same protocol and host.', 2, offHost);
    if (badDates.length) C('robots', 'warn', 'Sitemap has invalid lastmod dates', '', 'Use W3C datetime, such as 2026-11-03 or 2026-11-03T10:00:00+05:30.', 1, badDates);
    else if (total && !lastmods) C('robots', 'info', 'Sitemap has no lastmod dates', 'Google uses lastmod when it is consistently accurate, to recrawl changed pages sooner.', '', 1);
    else if (total) C('robots', 'pass', 'Sitemap lastmod dates are valid', Math.round(lastmods / total * 100) + '% of URLs have one.', '', 1);
    var target = loose(finalUrl);
    var found = urlsets.some(function (s) { return s.p.entries.some(function (e) { return loose(e.loc) === target; }); });
    if (found) C('crawl', 'pass', 'Page is listed in the sitemap', '', '', 1);
    else C('crawl', 'warn', 'Page not found in the sitemap', 'Checked ' + urlsets.map(function (s) { return s.url; }).join(', ') + (loaded.length < (robots ? robots.sitemaps.length : 1) ? ' (not every sitemap was read).' : '.'), 'Include every canonical, indexable page in an XML sitemap.', 1);
  }

  /* ---------- page checks ---------- */
  function checkCrawl(page, raw, http, alt, input) {
    var fin = page.finalUrl, u = new URL(fin);
    if (page.status && page.status >= 400) C('crawl', 'fail', 'Page returns HTTP ' + page.status, 'Error pages are dropped from the index.', 'Return 200 for live pages; 301 moved ones.', 5);
    else C('crawl', 'pass', 'Page returns HTTP ' + (page.status || 200), '', '', 3);
    if (strip(fin) !== strip(input)) C('crawl', 'warn', 'The URL redirects', input + ' → ' + fin, 'Use the final URL in internal links, canonicals and sitemaps so crawlers skip the hop.', 1);
    if (u.protocol === 'https:') C('crawl', 'pass', 'Served over HTTPS', '', '', 3);
    else C('crawl', 'fail', 'Not served over HTTPS', 'HTTPS is a ranking signal and browsers mark HTTP pages as not secure.', 'Install a certificate and 301 HTTP to HTTPS.', 3);
    if (http) {
      if (!http.ok && !http.status) C('crawl', 'info', 'HTTP version could not be checked', '', '', 1);
      else if (/^https:/i.test(http.finalUrl)) C('crawl', 'pass', 'HTTP redirects to HTTPS', 'http://' + u.host + u.pathname + ' → ' + http.finalUrl, '', 2);
      else C('crawl', 'fail', 'HTTP does not redirect to HTTPS', 'http://' + u.host + u.pathname + ' serves content without redirecting, creating duplicate URLs.', 'Add a site-wide 301 from HTTP to HTTPS (and HSTS).', 2);
    }
    if (alt) {
      var altHost = (u.hostname.indexOf('www.') === 0 ? u.hostname.slice(4) : 'www.' + u.hostname);
      if (!alt.ok && !alt.status) C('crawl', 'info', altHost + ' does not respond', 'Fine if nobody links to it.', '', 1);
      else if (new URL(alt.finalUrl).hostname === u.hostname) C('crawl', 'pass', 'www and non-www resolve to one host', altHost + ' → ' + alt.finalUrl, '', 2);
      else C('crawl', 'warn', 'Both www and non-www serve the site', altHost + ' does not redirect to ' + u.hostname + '.', 'Pick one host and 301 the other to it.', 2);
    }
    // robots meta
    var robotsMeta = function (doc) {
      return Array.from(doc.querySelectorAll('meta[name="robots" i], meta[name="googlebot" i]')).map(function (m) { return (m.getAttribute('content') || '').toLowerCase(); }).join(',');
    };
    var r = robotsMeta(page.doc), rr = raw ? robotsMeta(raw.doc) : r;
    if (/noindex|(^|,)\s*none/.test(r)) C('crawl', 'fail', 'Page is set to noindex', 'meta robots: "' + r + '"', 'Remove noindex if this page should appear in search.', 5);
    else if (/noindex/.test(rr)) C('crawl', 'fail', 'noindex in the HTML as served, removed by JavaScript', 'Google may not render a page that starts as noindex, so it stays out of the index.', 'Remove noindex from the server-side HTML.', 4);
    else C('crawl', 'pass', 'Page is indexable (no noindex)', r ? 'meta robots: "' + r + '"' : 'No robots meta tag (defaults to index, follow).', '', 4);
    if (/nofollow/.test(r)) C('crawl', 'warn', 'Page links are set to nofollow', 'meta robots: "' + r + '". Crawlers won\'t follow any link on the page.', 'Remove nofollow unless intended.', 2);
    if (/nosnippet|max-snippet\s*:\s*0/.test(r)) C('crawl', 'warn', 'Snippets are disabled', 'meta robots: "' + r + '". Google shows no description, and the page can\'t be used in AI Overviews.', 'Remove nosnippet, or use data-nosnippet on specific elements instead.', 2);
    // canonical
    var canon = Array.from(page.doc.querySelectorAll('link[rel~="canonical" i]'));
    if (!canon.length) C('crawl', 'warn', 'No canonical link', 'Without one, Google picks the canonical itself among duplicates (parameters, trailing slashes, http/https).', 'Add <link rel="canonical" href="' + strip(fin) + '">.', 2);
    else if (canon.length > 1) C('crawl', 'fail', 'Multiple canonical links', 'Google ignores all of them when they conflict.', 'Keep exactly one canonical.', 3, canon.map(function (l) { return l.getAttribute('href'); }));
    else {
      var href = canon[0].getAttribute('href') || '';
      var abs = /^https?:\/\//i.test(href), resolved = '';
      try { resolved = new URL(href, fin).href; } catch (e) { resolved = href; }
      if (!abs) C('crawl', 'warn', 'Canonical is a relative URL', href, 'Use an absolute URL, including https:// and the host.', 1);
      if (strip(resolved) === strip(fin)) C('crawl', 'pass', 'Canonical points to this page', resolved, '', 2);
      else if (loose(resolved) === loose(fin)) C('crawl', 'warn', 'Canonical differs in protocol, host or trailing slash', 'Page: ' + strip(fin) + '\nCanonical: ' + resolved, 'Make the canonical exactly match the final URL.', 2);
      else C('crawl', 'warn', 'Canonical points to a different URL', resolved + '. Google will usually index that URL instead of this one.', 'Fine for duplicates; otherwise make the canonical self-referencing.', 2);
      if (raw) {
        var rc = raw.doc.querySelector('link[rel~="canonical" i]');
        var rch = rc ? rc.getAttribute('href') : '';
        if (rch !== href) C('crawl', 'warn', 'JavaScript changes the canonical', 'Served HTML: ' + (rch || 'none') + ' · after rendering: ' + href, 'Output the final canonical in the server-side HTML.', 2);
      }
    }
  }

  function checkOnPage(page, raw) {
    var doc = page.doc, fin = page.finalUrl;
    var titles = doc.querySelectorAll('head title'), title = norm(doc.title);
    if (!title) C('onpage', 'fail', 'Missing title', 'The title is the clickable headline in search results and a strong relevance signal.', 'Add a unique, descriptive <title> of 30–60 characters.', 4);
    else {
      if (title.length < 30) C('onpage', 'warn', 'Title is short (' + title.length + ' characters)', '"' + title + '"', 'Aim for 30–60 characters that describe the page and include its main topic.', 2);
      else if (title.length > 60) C('onpage', 'warn', 'Title may be truncated (' + title.length + ' characters)', '"' + title + '". Google shows roughly 600px, about 55–60 characters.', 'Put the important words first and keep it to about 60 characters.', 2);
      else C('onpage', 'pass', 'Title length is good (' + title.length + ' characters)', '"' + title + '"', '', 2);
      if (/^(home|homepage|untitled|index|welcome|new page|page|document)$/i.test(title)) C('onpage', 'warn', 'Title is generic', '"' + title + '"', 'Describe what the page offers, plus your brand.', 2);
      if (titles.length > 1) C('onpage', 'warn', 'More than one <title> element', '', 'Keep a single title in <head>.', 1);
    }
    var descs = doc.querySelectorAll('meta[name="description" i]'), desc = K.meta(doc, 'meta[name="description" i]');
    if (!desc) C('onpage', 'warn', 'Missing meta description', 'Not a ranking factor, but Google often uses it as the snippet, which drives click-through.', 'Write a unique summary of 70–160 characters.', 2);
    else {
      if (desc.length < 70) C('onpage', 'warn', 'Meta description is short (' + desc.length + ' characters)', desc, 'Aim for 70–160 characters with a clear reason to click.', 1);
      else if (desc.length > 160) C('onpage', 'warn', 'Meta description may be truncated (' + desc.length + ' characters)', desc, 'Keep it to about 160 characters.', 1);
      else C('onpage', 'pass', 'Meta description length is good (' + desc.length + ' characters)', desc, '', 1);
      if (descs.length > 1) C('onpage', 'warn', 'More than one meta description', '', 'Keep one.', 1);
      if (desc.toLowerCase() === title.toLowerCase()) C('onpage', 'warn', 'Meta description repeats the title', '', 'Use the description to add detail the title can\'t.', 1);
    }
    var h1s = Array.from(doc.querySelectorAll('h1')), h1text = h1s.map(function (x) { return norm(x.textContent); }).filter(Boolean);
    if (!h1text.length) C('onpage', 'warn', 'No H1 heading', 'The H1 tells users and search engines what the page is about.', 'Add one visible H1 that matches the page\'s main topic.', 3);
    else if (h1text.length > 1) C('onpage', 'info', plural(h1text.length, 'H1 heading'), 'Google handles several H1s fine; one clear H1 is still the clearest structure.', '', 1, h1text);
    else C('onpage', 'pass', 'One H1 heading', '"' + h1text[0] + '"', '', 3);
    if (h1s.length > h1text.length) C('onpage', 'warn', 'Empty H1 element', '', 'Remove empty headings or give them text.', 1);
    var skipped = [], prev = 0;
    doc.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(function (el) {
      var lvl = +el.tagName[1];
      if (prev && lvl > prev + 1) skipped.push('H' + prev + ' → H' + lvl + ': ' + norm(el.textContent).slice(0, 70));
      prev = lvl;
    });
    if (skipped.length) C('onpage', 'warn', 'Heading levels are skipped', plural(skipped.length, 'jump') + ' in the outline.', 'Nest headings in order (H2 under H1, H3 under H2) so the structure is clear to crawlers and screen readers.', 1, skipped);
    else C('onpage', 'pass', 'Heading levels are in order', '', '', 1);
    if (title && h1text.length) {
      var sig = function (s) { return K.words(s.toLowerCase()).filter(function (w) { return w.length > 3; }); };
      var tw = sig(title), hw = sig(h1text[0]);
      if (tw.length && hw.length && !tw.some(function (w) { return hw.indexOf(w) !== -1; })) C('onpage', 'warn', 'Title and H1 share no words', 'Title: "' + title + '" · H1: "' + h1text[0] + '"', 'Make both describe the same main topic.', 1);
    }
    var text = K.visibleText(doc), wc = K.words(text).length;
    if (wc < 300) C('onpage', 'warn', 'Thin content (' + wc + ' words)', 'Fine for some page types, such as contact or category pages; content pages usually need more depth to rank.', 'Add substantive content that answers the searcher\'s question.', 2);
    else C('onpage', 'pass', 'Content depth: ' + wc + ' words', '', '', 2);
    if (raw) {
      var rwc = K.words(K.visibleText(raw.doc)).length;
      var share = wc ? rwc / wc : 1;
      if (wc < 50) C('onpage', 'info', 'Too little text to compare served and rendered HTML', '', '', 1);
      else if (share < 0.5) C('onpage', 'warn', 'Most content needs JavaScript (' + Math.round(share * 100) + '% in the served HTML)', rwc + ' words in the HTML as served vs ' + wc + ' after rendering. Google renders JavaScript but later; other crawlers and AI bots may see little.', 'Server-render or pre-render the main content.', 2);
      else C('onpage', 'pass', 'Content is in the served HTML (' + Math.round(Math.min(1, share) * 100) + '%)', '', '', 2);
      if (!norm(raw.doc.title) && title) C('onpage', 'warn', 'Title is set by JavaScript', 'The served HTML has no <title>.', 'Output the title server-side.', 2);
    }
    var imgs = Array.from(doc.querySelectorAll('img'));
    var src = function (i) { return i.getAttribute('src') || i.getAttribute('data-src') || (i.getAttribute('srcset') || '').split(/[\s,]+/)[0] || '(no src)'; };
    if (imgs.length) {
      var noAlt = imgs.filter(function (i) { return !i.hasAttribute('alt'); });
      if (noAlt.length) C('onpage', 'warn', plural(noAlt.length, 'image') + ' without an alt attribute', 'Alt text helps image search and accessibility. Use alt="" for purely decorative images.', 'Add descriptive alt text to meaningful images.', 2, noAlt.map(src));
      else C('onpage', 'pass', 'All ' + plural(imgs.length, 'image') + ' have an alt attribute', '', '', 2);
      var noDims = imgs.filter(function (i) { return !(i.getAttribute('width') && i.getAttribute('height')); });
      if (noDims.length) C('onpage', 'warn', plural(noDims.length, 'image') + ' without width and height', 'Missing dimensions cause layout shift (CLS) while images load.', 'Set width and height attributes (or CSS aspect-ratio).', 1, noDims.map(src));
      if (imgs[0].getAttribute('loading') === 'lazy') C('onpage', 'warn', 'The first image is lazy-loaded', src(imgs[0]) + '. If it is the hero, lazy loading delays Largest Contentful Paint.', 'Load above-the-fold images eagerly, with fetchpriority="high" on the LCP image.', 1);
    }
    var links = Array.from(doc.querySelectorAll('a[href]')), internal = 0, external = 0, empty = [], generic = [], nofollowInt = [], jsLinks = [];
    links.forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (/^javascript:/i.test(href)) { jsLinks.push(href.slice(0, 60)); return; }
      if (/^(#|mailto:|tel:)/i.test(href)) return;
      var abs;
      try { abs = new URL(href, fin).href; } catch (e) { return; }
      var isInt = K.sameSite(abs, fin);
      if (isInt) internal++; else external++;
      var label = norm(a.textContent) || norm(a.getAttribute('aria-label')) || norm(a.getAttribute('title')) || Array.from(a.querySelectorAll('img[alt]')).map(function (i) { return norm(i.getAttribute('alt')); }).join(' ');
      if (!label) empty.push(href);
      else if (GENERIC_ANCHORS.test(label)) generic.push('"' + label + '" → ' + href);
      if (isInt && /nofollow/i.test(a.getAttribute('rel') || '')) nofollowInt.push(href);
    });
    if (internal < 3) C('onpage', 'warn', 'Few internal links (' + internal + ')', 'Internal links help crawlers discover pages and pass relevance.', 'Link to related pages with descriptive anchor text.', 1);
    else C('onpage', 'pass', internal + ' internal and ' + external + ' external links', '', '', 1);
    if (empty.length) C('onpage', 'warn', plural(empty.length, 'link') + ' without anchor text', 'Crawlers and screen readers get no description of the target.', 'Add text, an aria-label, or alt text on linked images.', 1, empty);
    if (generic.length) C('onpage', 'warn', plural(generic.length, 'link') + ' with generic anchor text', '', 'Describe the destination ("AEM migration guide", not "read more").', 1, generic);
    if (nofollowInt.length) C('onpage', 'warn', plural(nofollowInt.length, 'internal link') + ' marked nofollow', '', 'Remove nofollow from internal links.', 1, nofollowInt);
    if (jsLinks.length) C('onpage', 'warn', plural(jsLinks.length, 'javascript: link'), 'Crawlers can\'t follow these.', 'Use real <a href> URLs.', 1, jsLinks);
    return { title: title, desc: desc, words: wc, internal: internal, external: external, images: imgs.length, h1: h1text[0] || '' };
  }

  function checkTech(page, raw) {
    var doc = page.doc, fin = page.finalUrl, u = new URL(fin);
    var vp = K.meta(doc, 'meta[name="viewport" i]');
    if (!vp) C('tech', 'fail', 'No viewport meta tag', 'Google indexes the mobile version of pages; without a viewport the page renders as desktop on phones.', 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.', 3);
    else if (!/width\s*=\s*device-width/i.test(vp)) C('tech', 'warn', 'Viewport does not use device-width', vp, 'Use width=device-width, initial-scale=1.', 2);
    else C('tech', 'pass', 'Mobile viewport is set', vp, '', 3);
    if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(vp || '')) C('tech', 'warn', 'Zooming is disabled', vp, 'Allow pinch-zoom (an accessibility requirement).', 1);
    var lang = norm(doc.documentElement.getAttribute('lang'));
    var rawLang = raw ? norm(raw.doc.documentElement.getAttribute('lang')) : lang;
    if (!lang && !rawLang) C('tech', 'warn', 'No lang attribute on <html>', '', 'Add lang, such as <html lang="en-IN">.', 2);
    else if (!rawLang) C('tech', 'warn', 'lang is only set by JavaScript', 'The served HTML has <html> without lang; crawlers that don\'t run JavaScript can\'t see it.', 'Output <html lang="' + lang + '"> server-side.', 1);
    else if (!/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(lang)) C('tech', 'warn', 'lang attribute is not a valid language code', lang, 'Use a BCP 47 code such as en, en-GB or hi-IN.', 1);
    else C('tech', 'pass', 'Language declared: ' + lang, '', '', 2);
    if (doc.querySelector('meta[charset], meta[http-equiv="content-type" i]')) C('tech', 'pass', 'Character encoding declared', '', '', 1);
    else C('tech', 'info', 'No charset meta tag', 'Fine if the server sends Content-Type: text/html; charset=utf-8 (response headers can\'t be checked from the browser). A <meta charset="utf-8"> is a safe backup.', '', 1);
    var alts = Array.from(doc.querySelectorAll('link[rel="alternate" i][hreflang]'));
    if (!alts.length) C('tech', 'info', 'No hreflang annotations', 'Only needed when the page has language or regional versions.', '', 1);
    else {
      var bad = [], rel = [], codes = {}, self = false, xdef = false;
      alts.forEach(function (l) {
        var code = (l.getAttribute('hreflang') || '').trim(), href = l.getAttribute('href') || '';
        if (code.toLowerCase() === 'x-default') xdef = true;
        else if (!/^[a-z]{2,3}(-[a-z]{4})?(-([a-z]{2}|\d{3}))?$/i.test(code) || /^en-uk$/i.test(code)) bad.push(code + ' → ' + href);
        if (!/^https?:\/\//i.test(href)) rel.push(code + ' → ' + href);
        codes[code.toLowerCase()] = (codes[code.toLowerCase()] || 0) + 1;
        try { if (strip(new URL(href, fin).href) === strip(fin)) self = true; } catch (e) { /* skip */ }
      });
      var dup = Object.keys(codes).filter(function (k) { return codes[k] > 1; });
      if (bad.length) C('tech', 'fail', 'Invalid hreflang codes', 'Use ISO 639-1 language with optional ISO 3166-1 region (en-GB, not en-UK).', 'Fix the codes; invalid ones are ignored.', 2, bad);
      if (rel.length) C('tech', 'warn', 'hreflang URLs are not absolute', '', 'Use absolute URLs.', 1, rel);
      if (dup.length) C('tech', 'warn', 'Duplicate hreflang codes', '', 'Each language-region should point to one URL.', 1, dup);
      if (!self) C('tech', 'warn', 'hreflang set has no self-reference', 'Each page should list itself among its alternates.', 'Add an hreflang entry for this URL.', 1);
      if (!bad.length && !rel.length && self) C('tech', 'pass', 'hreflang annotations look valid (' + alts.length + ')', 'Return links on the other pages are not checked.', '', 2);
      if (!xdef) C('tech', 'info', 'No x-default hreflang', 'Recommended as the fallback for users whose language isn\'t listed.', '', 1);
    }
    if (u.protocol === 'https:') {
      var mixed = [];
      doc.querySelectorAll('img[src],script[src],iframe[src],source[src],video[src],audio[src],link[rel~="stylesheet" i][href]').forEach(function (el) {
        var v = el.getAttribute('src') || el.getAttribute('href') || '';
        if (/^http:\/\//i.test(v)) mixed.push(v);
      });
      if (mixed.length) C('tech', 'fail', plural(mixed.length, 'insecure resource') + ' on an HTTPS page', 'Browsers block or warn on mixed content.', 'Load every resource over https://.', 2, mixed);
      else C('tech', 'pass', 'No mixed content', '', '', 2);
    }
    if (doc.querySelector('link[rel~="icon" i]')) C('tech', 'pass', 'Favicon declared', '', '', 1);
    else C('tech', 'warn', 'No favicon declared', 'Google shows the favicon next to your result on mobile.', 'Add <link rel="icon" href="/favicon.svg"> (at least 48×48).', 1);
    var path = decodeURIComponent(u.pathname), issues = [];
    if (fin.length > 115) issues.push('Long URL (' + fin.length + ' characters)');
    if (/[A-Z]/.test(path)) issues.push('Upper-case letters in the path');
    if (/_/.test(path)) issues.push('Underscores (hyphens are preferred as word separators)');
    if (u.searchParams && Array.from(u.searchParams.keys()).length > 2) issues.push('Several query parameters');
    if (/\/\//.test(u.pathname)) issues.push('Double slash in the path');
    if (issues.length) C('tech', 'warn', 'URL could be cleaner', fin, 'Use short, lower-case, hyphenated, descriptive paths.', 1, issues);
    else C('tech', 'pass', 'URL is clean and readable', fin, '', 1);
    if (doc.querySelector('meta[name="keywords" i]')) C('tech', 'info', 'meta keywords tag present', 'Google ignores it, and it can reveal your keyword strategy to competitors.', '', 1);
    var served = raw && raw.html ? raw.html : (page.rendered ? '' : page.body);
    if (served) {
      var kb = Math.round(new Blob([served]).size / 1024);
      if (kb > 2048) C('tech', 'warn', 'Large HTML document (' + kb + ' KB)', 'Google stops at 15 MB, but heavy HTML slows parsing and rendering.', 'Reduce inline data, SVG and duplicated markup.', 1);
      else C('tech', 'pass', 'HTML size is reasonable (' + kb + ' KB)', '', '', 1);
    }
  }

  function checkSchema(page, raw) {
    var doc = page.doc, ld = K.jsonLd(doc);
    if (ld.invalid) C('schema', 'fail', plural(ld.invalid, 'JSON-LD block') + ' cannot be parsed', 'Invalid JSON means the whole block is ignored.', 'Validate with the Schema Markup Validator or Rich Results Test.', 3);
    if (!ld.blocks && !doc.querySelector('[itemscope],[typeof]')) C('schema', 'warn', 'No structured data', 'Structured data makes pages eligible for rich results and helps search engines understand entities.', 'Add JSON-LD for the page type (Organization, Article, Product, BreadcrumbList…).', 3);
    else if (ld.types.length) C('schema', 'pass', 'Structured data found', ld.types.join(', '), '', 3);
    if (doc.querySelector('[itemscope]')) C('schema', 'info', 'Microdata found', 'Supported, but JSON-LD is Google\'s recommended format.', '', 1);
    var missing = [];
    ld.items.forEach(function (n) {
      [].concat(n['@type']).forEach(function (t) {
        var req = REQUIRED[String(t).toLowerCase()];
        if (!req) return;
        req.forEach(function (p) {
          var ok = Array.isArray(p) ? p.some(function (q) { return n[q] != null && n[q] !== ''; }) : (n[p] != null && n[p] !== '');
          if (!ok) missing.push(t + ': missing ' + (Array.isArray(p) ? 'one of ' + p.join(' / ') : p));
        });
      });
    });
    if (missing.length) C('schema', 'warn', 'Structured data is missing key properties', 'Missing required or recommended properties can make a page ineligible for rich results.', 'Add the listed properties.', 2, missing);
    else if (ld.items.length) C('schema', 'pass', 'Key schema properties are present', '', '', 2);
    if (ld.ofType('FAQPage').length) C('schema', 'info', 'FAQPage markup', 'Google now shows FAQ rich results only for well-known government and health sites, but the markup still helps machines read Q&A.', '', 1);
    if (ld.ofType('HowTo').length) C('schema', 'info', 'HowTo markup', 'Google no longer shows HowTo rich results.', '', 1);
    if (raw && ld.blocks && !K.jsonLd(raw.doc).blocks) C('schema', 'warn', 'Structured data is added by JavaScript', 'Google can read it after rendering; many other consumers can\'t.', 'Output JSON-LD in the server-side HTML.', 1);
    var og = ['og:title', 'og:description', 'og:image', 'og:url'].filter(function (p) { return !K.meta(doc, 'meta[property="' + p + '" i]'); });
    if (og.length) C('schema', 'warn', 'Open Graph tags missing', 'Used for link previews on LinkedIn, Facebook, WhatsApp, Slack and Teams.', 'Add the missing tags.', 2, og);
    else C('schema', 'pass', 'Open Graph tags complete', K.meta(doc, 'meta[property="og:image" i]'), '', 2);
    if (!K.meta(doc, 'meta[name="twitter:card" i]')) C('schema', 'info', 'No twitter:card tag', 'X falls back to Open Graph, but summary_large_image gives a bigger preview.', '', 1);
  }

  async function checkPerf(url, key, strategy, setStep) {
    if (!key) {
      C('perf', 'info', 'Core Web Vitals not checked', 'Google\'s anonymous PageSpeed quota is shared and usually exhausted. Add a free API key under Settings to include real-user Core Web Vitals and Lighthouse scores, or run the URL on pagespeed.web.dev.', '', 1);
      setStep('skip', 'No Google API key (optional)');
      return null;
    }
    var q = new URLSearchParams({ url: url, strategy: strategy, key: key });
    q.append('category', 'PERFORMANCE'); q.append('category', 'SEO');
    var res, j;
    try {
      res = await K.fetchT('https://www.googleapis.com/pagespeedonline/v5/runPagespeed?' + q, {}, 120000);
      j = await res.json();
    } catch (e) { C('perf', 'info', 'PageSpeed Insights did not respond', e.name === 'AbortError' ? 'Timed out after 2 minutes.' : e.message, '', 1); setStep('err', 'Failed'); return null; }
    if (!res.ok) { C('perf', 'info', 'PageSpeed Insights returned an error', (j.error && j.error.message || 'HTTP ' + res.status).slice(0, 220), '', 1); setStep('err', 'HTTP ' + res.status); return null; }
    var le = j.loadingExperience && j.loadingExperience.metrics && Object.keys(j.loadingExperience.metrics).length ? j.loadingExperience : j.originLoadingExperience;
    var scope = le === j.loadingExperience ? 'this URL' : 'the whole origin';
    var M = [['LARGEST_CONTENTFUL_PAINT_MS', 'Largest Contentful Paint', function (v) { return (v / 1000).toFixed(1) + ' s'; }, '≤ 2.5 s'],
      ['INTERACTION_TO_NEXT_PAINT', 'Interaction to Next Paint', function (v) { return v + ' ms'; }, '≤ 200 ms'],
      ['CUMULATIVE_LAYOUT_SHIFT_SCORE', 'Cumulative Layout Shift', function (v) { return (v / 100).toFixed(2); }, '≤ 0.1']];
    if (le && le.metrics) {
      M.forEach(function (m) {
        var d = le.metrics[m[0]];
        if (!d) return;
        var st = d.category === 'FAST' ? 'pass' : d.category === 'AVERAGE' ? 'warn' : 'fail';
        C('perf', st, m[1] + ': ' + m[2](d.percentile) + ' (' + strategy + ')', 'Real users, 75th percentile, ' + scope + '. Good is ' + m[3] + '.', 'See the Lighthouse opportunities on pagespeed.web.dev.', 3);
      });
    } else C('perf', 'info', 'Not enough real-user data', 'Chrome UX Report has no field data for this URL or origin, usually because traffic is low.', '', 1);
    var cats = (j.lighthouseResult || {}).categories || {};
    var lab = function (c, label, w) {
      if (!c || c.score == null) return;
      var s = c.score;
      C('perf', s >= 0.9 ? 'pass' : s >= 0.5 ? 'warn' : 'fail', 'Lighthouse ' + label + ': ' + Math.round(s * 100) + '/100 (' + strategy + ', lab)', '', 'Work through the Lighthouse opportunities.', w);
    };
    lab(cats.performance, 'performance', 2);
    lab(cats.seo, 'SEO', 1);
    var audits = (j.lighthouseResult || {}).audits || {};
    var failing = ((cats.seo || {}).auditRefs || []).map(function (r) { return audits[r.id]; }).filter(function (a) { return a && a.score !== null && a.score < 1 && a.scoreDisplayMode === 'binary'; }).map(function (a) { return a.title; });
    if (failing.length) C('perf', 'info', 'Lighthouse SEO audits that failed', '', '', 1, failing);
    setStep('ok', 'Done');
    return { lab: cats.performance && cats.performance.score, seo: cats.seo && cats.seo.score };
  }

  /* ---------- SERP preview ---------- */
  function serp(fin, info) {
    var u = new URL(fin);
    var crumbs = u.hostname.replace(/^www\./, '') + u.pathname.split('/').filter(Boolean).map(function (p) { return ' › ' + decodeURIComponent(p); }).join('');
    var t = info.title || '(no title)', d = info.desc || '(no meta description; Google will pick text from the page)';
    return h('div', { class: 'pc-card au-serp' }, h('h3', { text: 'Search result preview' }),
      h('div', { class: 'au-serp-box' },
        h('p', { class: 'au-serp-url', text: crumbs.length > 70 ? crumbs.slice(0, 68) + '…' : crumbs }),
        h('p', { class: 'au-serp-title', text: t.length > 60 ? t.slice(0, 58).replace(/\s+\S*$/, '') + ' …' : t }),
        h('p', { class: 'au-serp-desc', text: d.length > 160 ? d.slice(0, 157).replace(/\s+\S*$/, '') + ' …' : d })),
      h('p', { class: 'muted au-small', text: 'An approximation: Google may rewrite titles and descriptions. ' + info.words + ' words · ' + info.internal + ' internal links · ' + info.images + ' images.' }));
  }

  /* ---------- run ---------- */
  var psiKey = K.store.get(PSI_STORE);
  if (psiKey) { form.elements.auPsi.value = psiKey; form.elements.auRemember.checked = true; }
  K.setupKey(form);
  var qs = new URLSearchParams(location.search);
  if (qs.get('url')) form.elements.auUrl.value = qs.get('url');

  var running = false;
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (running) return;
    var err = document.getElementById('auError');
    err.textContent = '';
    var url = K.normaliseUrl(form.elements.auUrl.value);
    if (!url) { err.textContent = 'Enter a valid web address, such as https://www.example.com/.'; return; }
    form.elements.auUrl.value = url;
    K.persistKey(form);
    K.store.set(PSI_STORE, form.elements.auRemember.checked ? form.elements.auPsi.value.trim() : '');
    history.replaceState(null, '', '?url=' + encodeURIComponent(url));
    running = true;
    var btn = document.getElementById('auGo');
    btn.disabled = true; btn.textContent = 'Auditing…';
    document.getElementById('auReport').hidden = true;
    var step = K.steps(document.getElementById('auSteps'));
    var o = { key: form.elements.auKey.value.trim() };
    checks = [];
    try {
      var u = new URL(url);
      var sPage = step('Fetch and render the page'), sRaw = step('Fetch the HTML as served'), sRob = step('Read robots.txt'), sVar = step('Check HTTP and www redirects');
      var alt = u.protocol + '//' + (u.hostname.indexOf('www.') === 0 ? u.hostname.slice(4) : 'www.' + u.hostname) + u.pathname;
      var settle = function (p, s, label) {
        return p.then(function (r) { s(r.ok ? 'ok' : 'err', r.status ? 'HTTP ' + r.status : (r.error || 'Done')); return r; },
          function (x) { s('err', x.message); return null; });
      };
      var res = await Promise.all([
        settle(K.jina(url, 'html', o), sPage), settle(K.jina(url, 'raw', o), sRaw),
        settle(K.jina(u.origin + '/robots.txt', 'text', o), sRob),
        u.protocol === 'https:' ? K.jina('http://' + u.host + u.pathname, 'text', o).catch(function () { return null; }) : Promise.resolve(null),
        K.jina(alt, 'text', o).catch(function () { return null; })
      ]);
      sVar('ok', 'Done');
      var page = res[0];
      if (!page || !page.body) throw new Error('The page could not be fetched' + (page && page.error ? ': ' + page.error : '.'));
      page.doc = K.parse(page.body);
      // without a rendered page there is nothing to compare the served HTML with
      var raw = page.rendered && res[1] && res[1].body ? { doc: K.parse(res[1].body), html: res[1].body } : null;
      if (!page.rendered) C('onpage', 'info', 'JavaScript rendering not checked', 'Without a Jina API key the page is fetched as served, so the audit can\'t see what JavaScript changes (content, title, canonical, noindex, structured data). Google renders JavaScript; add a free key under Settings to compare.', '', 1);
      var fin = page.finalUrl;
      var sMap = step('Read XML sitemaps');
      var robots = checkRobots(res[2], fin);
      await checkSitemaps(robots, fin, o, sMap);
      sMap('ok', 'Done');
      checkCrawl(page, raw, res[3], res[4], url);
      var info = checkOnPage(page, raw);
      checkTech(page, raw);
      checkSchema(page, raw);
      var sPerf = step('Core Web Vitals (PageSpeed Insights)');
      await checkPerf(fin, form.elements.auPsi.value.trim(), form.elements.auStrategy.value, sPerf);
      K.renderAudit(document.getElementById('auReport'), {
        eyebrow: 'SEO audit', url: fin, categories: CATS, checks: checks, file: 'seo-audit.json',
        scoreLabel: 'SEO score', scoreSub: checks.filter(function (c) { return c.status === 'fail'; }).length + ' to fix · ' + checks.filter(function (c) { return c.status === 'warn'; }).length + ' to improve · ' + checks.filter(function (c) { return c.status === 'pass'; }).length + ' passed',
        before: serp(fin, info)
      });
    } catch (x) {
      err.textContent = x.message + ' If the site blocks automated requests, try again later or check another page.';
    } finally {
      running = false;
      btn.disabled = false; btn.textContent = 'Run SEO audit';
    }
  });
})();

/* GEO audit: how ready a page is to be found, read and cited by AI search and assistants
   (ChatGPT, Claude, Perplexity, Google AI Overviews and AI Mode, Microsoft Copilot). */
(function () {
  'use strict';
  var K = window.KJTools;
  var form = document.getElementById('auForm');
  if (!K || !form) return;
  var h = K.h, norm = K.norm;

  var CATS = [
    { id: 'access', title: 'AI crawler access', weight: 25, intro: 'Whether AI search and answer engines are allowed to fetch, index and quote this page.' },
    { id: 'render', title: 'Readable without JavaScript', weight: 20, intro: 'Most AI crawlers (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot) read the HTML as served and don\'t run JavaScript.' },
    { id: 'structure', title: 'Answer-ready structure', weight: 20, intro: 'AI engines retrieve passages, not pages. Clear sections, direct answers, lists and tables are easier to lift and cite.' },
    { id: 'trust', title: 'Evidence and authority', weight: 20, intro: 'Signals that make content worth citing: named authors, dates, statistics, sources and a clearly identified organisation.' },
    { id: 'machine', title: 'Machine-readable signals', weight: 15, intro: 'Structured data, llms.txt and metadata that help machines understand what the page is and who is behind it.' }
  ];
  /* kind: search = builds an index used for answers; user = fetches a page when a user asks; training = model training */
  var BOTS = [
    { ua: 'OAI-SearchBot', vendor: 'OpenAI', use: 'ChatGPT search results', kind: 'search' },
    { ua: 'ChatGPT-User', vendor: 'OpenAI', use: 'Pages ChatGPT opens for a user', kind: 'user' },
    { ua: 'GPTBot', vendor: 'OpenAI', use: 'Model training', kind: 'training' },
    { ua: 'Claude-SearchBot', vendor: 'Anthropic', use: 'Claude search results', kind: 'search' },
    { ua: 'Claude-User', vendor: 'Anthropic', use: 'Pages Claude opens for a user', kind: 'user' },
    { ua: 'ClaudeBot', vendor: 'Anthropic', use: 'Model training', kind: 'training' },
    { ua: 'PerplexityBot', vendor: 'Perplexity', use: 'Perplexity search index', kind: 'search' },
    { ua: 'Perplexity-User', vendor: 'Perplexity', use: 'Pages Perplexity opens for a user', kind: 'user' },
    { ua: 'Googlebot', vendor: 'Google', use: 'Google Search, AI Overviews and AI Mode', kind: 'search' },
    { ua: 'Google-Extended', vendor: 'Google', use: 'Gemini training and grounding (not Search or AI Overviews)', kind: 'training' },
    { ua: 'Bingbot', vendor: 'Microsoft', use: 'Bing and Microsoft Copilot', kind: 'search' },
    { ua: 'Applebot', vendor: 'Apple', use: 'Siri and Spotlight', kind: 'search' },
    { ua: 'Applebot-Extended', vendor: 'Apple', use: 'Apple Intelligence training', kind: 'training' },
    { ua: 'DuckAssistBot', vendor: 'DuckDuckGo', use: 'DuckAssist answers', kind: 'search' },
    { ua: 'MistralAI-User', vendor: 'Mistral', use: 'Pages Le Chat opens for a user', kind: 'user' },
    { ua: 'Meta-ExternalAgent', vendor: 'Meta', use: 'Model training', kind: 'training' },
    { ua: 'Amazonbot', vendor: 'Amazon', use: 'Alexa answers and model training', kind: 'training' },
    { ua: 'CCBot', vendor: 'Common Crawl', use: 'Open web dataset used to train many models', kind: 'training' },
    { ua: 'Bytespider', vendor: 'ByteDance', use: 'Model training', kind: 'training' }
  ];
  var CONTENT_TYPES = /^(article|blogposting|newsarticle|techarticle|report|product|faqpage|qapage|howto|recipe|event|course|softwareapplication|service|localbusiness|dataset|scholarlyarticle|medicalwebpage|financialproduct|loanorcredit|review|videoobject|jobposting)$/i;
  var QUESTION = /\?\s*$|^(how|what|why|when|where|which|who|whom|whose|can|could|should|is|are|does|do|did|will|was|were)\b/i;
  var STAT = /(?:[$€£₹]\s?\d[\d,.]*\+?\s?(?:k|m|bn|million|billion|crore|lakh)?)|(?:\b\d[\d,.]*\+?\s?(?:%|percent|per cent|x\b|×|million|billion|crore|lakh|users|customers|clients|people|countries|markets|years|months|weeks|days|hours|minutes|seconds|ms|times|branches|employees|sites|pages|downloads)\b)/gi;
  var AUTHORITY = /(\.gov|\.edu|\.ac\.[a-z]{2}|\.gov\.[a-z]{2}|\.nic\.in|wikipedia\.org|who\.int|europa\.eu|un\.org|oecd\.org|worldbank\.org|imf\.org|rbi\.org\.in|sebi\.gov\.in|nih\.gov|nature\.com|sciencedirect\.com|arxiv\.org|ieee\.org|acm\.org|w3\.org|ietf\.org|developers\.google\.com|experienceleague\.adobe\.com)$/i;

  var checks;
  function C(cat, status, title, detail, fix, weight, list) {
    checks.push({ cat: cat, status: status, title: title, detail: detail || '', fix: fix || '', weight: weight || 1, list: list || null });
  }
  var plural = function (n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); };
  var strip = function (u) { try { var x = new URL(u); x.hash = ''; return x.href; } catch (e) { return u || ''; } };

  function scopeOf(doc) { return doc.querySelector('main') || doc.querySelector('article') || doc.querySelector('[role="main"]') || doc.body; }
  function robotsTokens(doc) {
    return Array.from(doc.querySelectorAll('meta[name="robots" i], meta[name="googlebot" i], meta[name="bingbot" i]')).map(function (m) { return (m.getAttribute('content') || '').toLowerCase(); }).join(',');
  }

  /* ---------- AI crawler access ---------- */
  function checkAccess(page, robotsRes) {
    var u = new URL(page.finalUrl), path = u.pathname + u.search, robots = null;
    if (page.status && page.status >= 400) C('access', 'fail', 'Page returns HTTP ' + page.status, 'Error pages are not indexed or cited.', 'Return 200 for this page.', 5);
    if (!robotsRes) C('access', 'info', 'robots.txt could not be checked', '', '', 1);
    else if (robotsRes.status === 404 || robotsRes.status === 410) C('access', 'pass', 'No robots.txt: every crawler is allowed', 'Consider adding one to state your AI crawler policy explicitly.', '', 1);
    else if (robotsRes.status >= 500) C('access', 'fail', 'robots.txt returns a server error (' + robotsRes.status + ')', 'Many crawlers treat this as "disallow everything".', 'Make /robots.txt return 200 or 404.', 4);
    else if (robotsRes.servedHtml) C('access', 'warn', 'robots.txt returns an HTML page', 'Crawlers find no rules, so every bot is allowed by default, but you can\'t state an AI crawler policy.', 'Serve a plain-text /robots.txt.', 1);
    else if (robotsRes.ok) robots = K.parseRobots(robotsRes.body);

    var rows = BOTS.map(function (b) {
      var r = robots ? K.isAllowed(robots, b.ua, path) : { allowed: true, rule: null };
      var explicit = robots && robots.groups.some(function (g) { return g.agents.indexOf(b.ua.toLowerCase()) !== -1; });
      return { bot: b, allowed: r.allowed, rule: r.rule, explicit: explicit };
    });
    var blockedAnswer = rows.filter(function (r) { return r.bot.kind !== 'training' && !r.allowed; });
    if (blockedAnswer.length) C('access', 'fail', plural(blockedAnswer.length, 'AI search or answer crawler') + ' blocked', 'These bots fetch pages to answer questions and cite sources. Blocking them removes this page from those answers.', 'Allow them in robots.txt, for example "User-agent: OAI-SearchBot" followed by "Allow: /".', 5,
      blockedAnswer.map(function (r) { return r.bot.ua + ' (' + r.bot.vendor + ', ' + r.bot.use + ') · rule: Disallow: ' + r.rule.path; }));
    else C('access', 'pass', 'AI search and answer crawlers are allowed', BOTS.filter(function (b) { return b.kind !== 'training'; }).map(function (b) { return b.ua; }).join(', '), '', 5);
    var training = rows.filter(function (r) { return r.bot.kind === 'training'; });
    var blockedTrain = training.filter(function (r) { return !r.allowed; });
    C('access', 'info', 'Training crawlers: ' + (training.length - blockedTrain.length) + ' allowed, ' + blockedTrain.length + ' blocked',
      'A business decision. Blocking training crawlers keeps content out of future models but does not remove you from AI search answers. Google-Extended does not affect Google Search or AI Overviews.', '', 1,
      training.map(function (r) { return (r.allowed ? 'Allowed · ' : 'Blocked · ') + r.bot.ua + ' (' + r.bot.vendor + ')'; }));
    var mentioned = rows.filter(function (r) { return r.explicit; }).length;
    if (robots && !mentioned) C('access', 'info', 'robots.txt has no AI-specific rules', 'All AI crawlers follow your "User-agent: *" rules.', '', 1);

    var tokens = robotsTokens(page.doc);
    if (/noindex|(^|,)\s*none/.test(tokens)) C('access', 'fail', 'Page is set to noindex', 'Google AI Overviews and AI Mode, and Microsoft Copilot, draw on their search indexes, so noindex pages are not used there; other engines may skip them too.', 'Remove noindex if the page should be found.', 4);
    else C('access', 'pass', 'Page is indexable', '', '', 4);
    var snip = tokens.match(/max-snippet\s*:\s*(-?\d+)/);
    if (/nosnippet/.test(tokens) || (snip && +snip[1] === 0)) C('access', 'fail', 'Snippets are disabled (nosnippet)', 'Google says nosnippet stops content being used in AI Overviews and AI Mode; Bing applies it to Copilot answers.', 'Remove nosnippet; use data-nosnippet on specific elements if needed.', 4);
    else if (snip && +snip[1] > 0 && +snip[1] < 100) C('access', 'warn', 'Snippets are limited to ' + snip[1] + ' characters', 'Short snippet limits restrict how much AI answers can quote.', 'Raise or remove max-snippet.', 2);
    else C('access', 'pass', 'Snippets are allowed', '', '', 3);
    var dns = page.doc.querySelectorAll('[data-nosnippet]').length;
    if (dns) C('access', 'info', plural(dns, 'element') + ' marked data-nosnippet', 'Those parts are excluded from snippets and AI Overviews.', '', 1);
    var canon = page.doc.querySelector('link[rel~="canonical" i]');
    if (canon) {
      var c = ''; try { c = new URL(canon.getAttribute('href'), page.finalUrl).href; } catch (e) { c = ''; }
      if (c && strip(c).replace(/\/$/, '') !== strip(page.finalUrl).replace(/\/$/, '')) C('access', 'warn', 'Canonical points to another URL', c + '. Engines will usually cite that URL instead.', 'Make the canonical self-referencing if this page should be cited.', 2);
    }
    C('access', 'info', 'Firewalls can block AI crawlers that robots.txt allows', 'Bot protection in Cloudflare, Akamai or other CDNs often challenges AI crawlers. This tool can\'t see that; check your CDN bot settings and server logs for 403s to these user agents.', '', 1);
    return rows;
  }

  /* ---------- readable without JavaScript ---------- */
  function checkRender(page, raw) {
    var renderedWords = K.words(K.visibleText(page.doc)).length;
    if (!raw) { C('render', 'info', 'The HTML as served could not be fetched', 'Comparison with the rendered page was skipped.', '', 1); return { ratio: null, rawWords: null, renderedWords: renderedWords }; }
    var rawWords = K.words(K.visibleText(raw.doc)).length;
    if (renderedWords < 50) { C('render', 'info', 'Too little text to compare (' + renderedWords + ' words after rendering)', 'This looks like an app or a mostly visual page.', '', 1); return { ratio: null, rawWords: rawWords, renderedWords: renderedWords }; }
    var ratio = renderedWords ? Math.min(1, rawWords / renderedWords) : 1;
    var detail = rawWords + ' words in the HTML as served, ' + renderedWords + ' after JavaScript runs.';
    if (ratio >= 0.8) C('render', 'pass', Math.round(ratio * 100) + '% of the content is in the served HTML', detail, '', 5);
    else if (ratio >= 0.5) C('render', 'warn', 'Only ' + Math.round(ratio * 100) + '% of the content is in the served HTML', detail + ' AI crawlers that don\'t run JavaScript miss the rest.', 'Server-render or pre-render the main content.', 5);
    else C('render', 'fail', 'Most content needs JavaScript (' + Math.round(ratio * 100) + '% in the served HTML)', detail + ' GPTBot, ClaudeBot and PerplexityBot would see little of this page.', 'Use server-side rendering, static generation or pre-rendering for content pages.', 5);
    var missing = [];
    if (norm(page.doc.title) && !norm(raw.doc.title)) missing.push('<title>');
    if (page.doc.querySelector('h1') && !raw.doc.querySelector('h1')) missing.push('<h1>');
    if (K.meta(page.doc, 'meta[name="description" i]') && !K.meta(raw.doc, 'meta[name="description" i]')) missing.push('meta description');
    if (K.jsonLd(page.doc).blocks && !K.jsonLd(raw.doc).blocks) missing.push('JSON-LD structured data');
    if (missing.length) C('render', 'fail', 'Key elements are only added by JavaScript', 'Not in the served HTML: ' + missing.join(', ') + '.', 'Output them server-side.', 3, missing);
    else C('render', 'pass', 'Title, headings, description and structured data are in the served HTML', '', '', 3);
    if (page.doc.querySelector('main, article, [role="main"]')) C('render', 'pass', 'Main content is marked up (<main> or <article>)', 'Helps extractors separate content from navigation and footers.', '', 2);
    else C('render', 'warn', 'No <main> or <article> element', 'Extractors have to guess which part of the page is the content.', 'Wrap the primary content in <main> (and articles in <article>).', 2);
    return { ratio: ratio, rawWords: rawWords, renderedWords: renderedWords };
  }

  /* ---------- answer-ready structure ---------- */
  function checkStructure(page, ld) {
    var scope = scopeOf(page.doc), text = K.visibleText({ body: scope }), wc = K.words(text).length;
    var heads = Array.from(scope.querySelectorAll('h2,h3,h4')).map(function (x) { return norm(x.textContent); }).filter(Boolean);
    if (wc < 300) C('structure', 'warn', 'Little content to cite (' + wc + ' words)', 'Short pages rarely contain a quotable, self-contained answer.', 'Cover the topic in enough depth to answer the main questions.', 2);
    else C('structure', 'pass', wc + ' words of main content', '', '', 1);
    if (wc > 400 && heads.length < 3) C('structure', 'warn', 'Few subheadings (' + heads.length + ')', 'AI engines retrieve passages; long text without sections is hard to segment and cite.', 'Split the content into sections with descriptive H2 and H3 headings.', 3);
    else if (heads.length) C('structure', 'pass', plural(heads.length, 'subheading') + ' structure the content', '', '', 3);
    var qs = heads.filter(function (t) { return QUESTION.test(t); });
    if (qs.length) C('structure', 'pass', plural(qs.length, 'question-style heading'), 'Headings that match how people phrase prompts map directly to answers.', '', 2, qs);
    else if (heads.length) C('structure', 'warn', 'No question-style headings', 'People ask AI assistants questions. Headings phrased as those questions, followed by a direct answer, are easy to match and quote.', 'Rephrase some subheadings as real questions (What is…? How do I…?) and answer in the first sentence.', 2);
    var paras = Array.from(scope.querySelectorAll('p')).map(function (p) { return K.words(p.textContent).length; }).filter(function (n) { return n >= 12; });
    if (!paras.length) C('structure', 'warn', 'No paragraph text found', 'Content in <div>s or images is harder to extract.', 'Use real <p> paragraphs for body text.', 2);
    else {
      var first = paras[0];
      if (first <= 80) C('structure', 'pass', 'Opens with a concise paragraph (' + first + ' words)', 'Leading with the answer helps engines quote it.', '', 2);
      else C('structure', 'warn', 'Opening paragraph is long (' + first + ' words)', 'AI answers favour a short, direct statement near the top.', 'Start with a 1–3 sentence answer or summary (under ~60 words), then expand.', 2);
      var long = paras.filter(function (n) { return n > 120; }).length;
      if (long / paras.length > 0.25) C('structure', 'warn', plural(long, 'long paragraph') + ' (over 120 words)', 'Long paragraphs mix several ideas, so passages are less self-contained.', 'Keep paragraphs to one idea, about 40–100 words.', 1);
    }
    var sections = [], cur = 0;
    Array.from(scope.querySelectorAll('h2,h3,h4,p,li,td')).forEach(function (el) {
      if (/^H[2-4]$/.test(el.tagName)) { if (cur) sections.push(cur); cur = 0; }
      else if (el.tagName === 'P') cur += K.words(el.textContent).length;
    });
    if (cur) sections.push(cur);
    var big = sections.filter(function (n) { return n > 500; });
    if (big.length) C('structure', 'warn', plural(big.length, 'section') + ' longer than 500 words', 'Very long sections dilute the passage an engine retrieves.', 'Add subheadings so each section answers one question.', 1, big.map(function (n) { return n + ' words'; }));
    var lists = scope.querySelectorAll('ul,ol').length, tables = scope.querySelectorAll('table').length;
    if (lists + tables) C('structure', 'pass', plural(lists, 'list') + ' and ' + plural(tables, 'table'), 'Steps, comparisons and specs in lists and tables are extracted cleanly.', '', 1);
    else if (wc > 400) C('structure', 'warn', 'No lists or tables', 'Structured formats are easier to quote than prose.', 'Use lists for steps and options, and tables for comparisons and specs.', 1);
    var all = Array.from(scope.querySelectorAll('h1,h2,h3,h4,strong,b,summary,dt')).map(function (x) { return norm(x.textContent); });
    if (all.some(function (t) { return /\b(tl;?dr|summary|key takeaways?|in short|at a glance|in brief|quick answer|overview)\b/i.test(t); })) C('structure', 'pass', 'Has a summary or key takeaways', '', '', 1);
    else C('structure', 'info', 'No summary or key-takeaways block', 'A short TL;DR at the top gives engines a ready-made answer.', '', 1);
    var faq = ld.ofType('FAQPage').length || all.some(function (t) { return /\b(faq|frequently asked|questions)\b/i.test(t); }) || scope.querySelector('details summary');
    if (faq) C('structure', 'pass', 'Has an FAQ or Q&A section', '', '', 1);
    else C('structure', 'info', 'No FAQ section', 'Question-and-answer pairs map directly to prompts.', '', 1);
    return { words: wc, headings: heads.length, questions: qs.length };
  }

  /* ---------- evidence and authority ---------- */
  function checkTrust(page, ld, homeLd, isHome) {
    var soft = isHome ? 'info' : 'warn';
    var doc = page.doc, scope = scopeOf(doc), text = K.visibleText({ body: scope }), wc = K.words(text).length || 1, fin = page.finalUrl;
    var schemaAuthor = ld.items.some(function (n) { return n.author; });
    var author = schemaAuthor || K.meta(doc, 'meta[name="author" i]') || doc.querySelector('[rel~="author"], [itemprop="author"], .author, .byline, [class*="author" i]');
    if (author) C('trust', 'pass', 'Author is identified', schemaAuthor ? 'In structured data.' : 'On the page.', '', 2);
    else C('trust', soft, 'No author identified', 'Named, credible authors are a core E-E-A-T signal for search and AI citation' + (isHome ? ' (mainly on articles and guides, less so on a home page).' : '.'), 'Add a visible byline linked to an author page, and "author" in Article schema.', 2);
    var dates = [];
    ld.items.forEach(function (n) { ['dateModified', 'datePublished'].forEach(function (k) { if (typeof n[k] === 'string') dates.push(n[k]); }); });
    ['article:modified_time', 'article:published_time', 'og:updated_time'].forEach(function (p) { var v = K.meta(doc, 'meta[property="' + p + '" i]'); if (v) dates.push(v); });
    doc.querySelectorAll('time[datetime]').forEach(function (t) { dates.push(t.getAttribute('datetime')); });
    var parsed = dates.map(function (d) { return Date.parse(d); }).filter(function (n) { return !isNaN(n) && n < Date.now() + 864e5; });
    if (!parsed.length) C('trust', soft, 'No publish or update date', 'Engines prefer fresh, dated content, especially for time-sensitive topics' + (isHome ? ' (mainly on articles and guides).' : '.'), 'Show a visible "Updated" date and add datePublished/dateModified to schema.', 2);
    else {
      var latest = new Date(Math.max.apply(null, parsed)), age = Math.round((Date.now() - latest) / 864e5);
      if (age > 365) C('trust', 'warn', 'Last updated ' + latest.toISOString().slice(0, 10) + ' (' + Math.round(age / 30) + ' months ago)', 'Older content is less likely to be chosen for current questions.', 'Review and update the content, then update dateModified.', 1);
      else C('trust', 'pass', 'Dated content, latest ' + latest.toISOString().slice(0, 10), '', '', 2);
    }
    var stats = (text.match(STAT) || []);
    var per1k = stats.length / wc * 1000;
    if (stats.length >= 5 || per1k >= 2) C('trust', 'pass', stats.length + (stats.length === 1 ? ' statistic' : ' statistics') + ' and figures', 'Specific numbers make content more quotable. The GEO study (KDD 2024) found adding statistics, quotations and sources lifted visibility in generative answers by up to 40%.', '', 2, stats.slice(0, 20));
    else C('trust', 'warn', stats.length ? 'Few statistics (' + stats.length + ')' : 'No statistics or data points', 'The GEO study (KDD 2024) found adding statistics was among the most effective ways to be cited in generative answers.', 'Add specific, sourced numbers: percentages, counts, prices, timeframes.', 2, stats.slice(0, 20));
    var ext = [], auth = [];
    scope.querySelectorAll('a[href]').forEach(function (a) {
      var href;
      try { href = new URL(a.getAttribute('href'), fin); } catch (e) { return; }
      if (!/^https?:$/.test(href.protocol) || K.sameSite(href.href, fin)) return;
      ext.push(href.hostname + href.pathname);
      if (AUTHORITY.test(href.hostname)) auth.push(href.hostname);
    });
    var uniq = Array.from(new Set(ext));
    if (uniq.length >= 2) C('trust', 'pass', plural(uniq.length, 'outbound source') + ' cited', auth.length ? plural(new Set(auth).size, 'authoritative domain') + ' among them.' : 'None from government, academic or standards bodies.', '', 2, uniq.slice(0, 30));
    else C('trust', 'warn', uniq.length ? 'Only one outbound source' : 'No outbound sources cited', 'Citing primary sources was the top-performing tactic in the GEO study, and supports claims engines may repeat.', 'Link claims and statistics to primary, authoritative sources.', 2, uniq);
    var quotes = scope.querySelectorAll('blockquote, q').length;
    if (quotes) C('trust', 'pass', plural(quotes, 'quotation'), 'Attributed quotes from experts add quotable, credible material.', '', 1);
    else C('trust', 'info', 'No quotations', 'An attributed expert quote is easy for engines to lift with credit.', '', 1);
    var entity = ld.ofType('Organization').concat(ld.ofType('Person'), ld.ofType('LocalBusiness'), ld.ofType('Corporation'))
      .concat(homeLd ? homeLd.ofType('Organization').concat(homeLd.ofType('Person'), homeLd.ofType('LocalBusiness'), homeLd.ofType('Corporation')) : []);
    var sameAs = entity.filter(function (n) { return n.sameAs && [].concat(n.sameAs).length; });
    if (sameAs.length) C('trust', 'pass', 'Organisation or person is identified with sameAs links', 'Linking your entity to profiles such as Wikipedia, Wikidata, LinkedIn or Crunchbase helps engines connect it to what they already know.', '', 2, [].concat.apply([], sameAs.map(function (n) { return [].concat(n.sameAs); })).slice(0, 15));
    else if (entity.length) C('trust', 'warn', 'Organisation schema has no sameAs links', '', 'Add sameAs URLs for your official profiles (Wikipedia, Wikidata, LinkedIn, X, YouTube).', 2);
    else C('trust', 'warn', 'No Organization or Person schema (page or home page)', 'Engines need to know who is behind the content to judge authority.', 'Add Organization (or Person) JSON-LD with name, url, logo and sameAs on the home page.', 2);
    var trustLinks = Array.from(doc.querySelectorAll('a[href]')).filter(function (a) { return /about|contact|team|who-we-are|company/i.test((a.getAttribute('href') || '') + ' ' + a.textContent); });
    if (trustLinks.length) C('trust', 'pass', 'Links to About or Contact pages', '', '', 1);
    else C('trust', 'warn', 'No About or Contact links', 'Transparency about who runs the site is a trust signal.', 'Link to About and Contact pages from every page (usually the footer).', 1);
  }

  /* ---------- machine-readable signals ---------- */
  function checkLlms(res, full, origin) {
    if (res && res.servedHtml) {
      C('machine', 'info', 'No llms.txt (the URL returns an HTML page)', origin + '/llms.txt answers with a web page, probably a fallback for unknown URLs, not a real llms.txt.', '', 1);
      return false;
    }
    if (!res || !res.status || res.status >= 400) {
      C('machine', 'info', 'No llms.txt', 'llms.txt is an emerging proposal (llmstxt.org): a Markdown summary of your site with links to key pages. No major AI search engine has confirmed using it yet, but AI agents and developer tools do, and it takes minutes to add.', '', 1);
      return false;
    }
    var t = (res.body || '').replace(/^﻿/, '');
    var lines = t.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var issues = [];
    if (/^\s*<(!doctype|html)/i.test(t)) issues.push('Returns HTML instead of Markdown (probably a fallback page)');
    if (!lines.length || !/^# \S/.test(lines[0])) issues.push('Should start with a single "# Site name" heading');
    if (!lines.some(function (l) { return /^> \S/.test(l); })) issues.push('No "> summary" blockquote');
    if (!lines.some(function (l) { return /^## \S/.test(l); })) issues.push('No "## Section" headings');
    var links = (t.match(/\[[^\]]+\]\([^)]+\)/g) || []).length;
    if (!links) issues.push('No Markdown links to key pages');
    if (issues.length > 2) C('machine', 'warn', '/llms.txt exists but doesn\'t follow the format', origin + '/llms.txt', 'Follow llmstxt.org: an H1 name, a > summary, then ## sections listing [Page](url): description.', 1, issues);
    else C('machine', 'pass', 'llms.txt found', origin + '/llms.txt · ' + plural(links, 'link') + (issues.length ? '. Minor: ' + issues.join('; ') : ''), '', 1);
    if (full && full.status && full.status < 400 && !full.servedHtml) C('machine', 'info', 'llms-full.txt found', 'A full-content version for agents that want everything in one file.', '', 1);
    return true;
  }
  function checkMachine(page, raw, ld, isHome) {
    var doc = page.doc;
    if (ld.invalid) C('machine', 'fail', plural(ld.invalid, 'JSON-LD block') + ' cannot be parsed', 'Invalid JSON is ignored entirely.', 'Validate with validator.schema.org.', 3);
    if (!ld.blocks) C('machine', 'warn', 'No structured data', 'Schema.org JSON-LD states facts (what this is, who made it, when) unambiguously.', 'Add JSON-LD for the page type plus Organization and BreadcrumbList.', 3);
    var content = ld.types.filter(function (t) { return CONTENT_TYPES.test(t) || (isHome && /^(organization|corporation|person|website|localbusiness|financialservice|bankorcreditunion)$/i.test(t)); });
    if (content.length) C('machine', 'pass', 'Schema describes the ' + (isHome ? 'site and organisation' : 'content') + ': ' + content.join(', '), '', '', 2);
    else if (ld.blocks) C('machine', 'warn', 'Schema doesn\'t describe the page content', 'Found ' + (ld.types.join(', ') || 'no types') + '. Generic types say little about what the page is.', 'Add a specific type: Article, Product, Service, FAQPage, HowTo, Event, LocalBusiness…', 2);
    if (K.meta(doc, 'meta[name="description" i]')) C('machine', 'pass', 'Meta description present', 'Often used as the summary in AI citations and link cards.', '', 1);
    else C('machine', 'warn', 'No meta description', 'Engines and chat apps fall back to arbitrary page text for the summary.', 'Add a clear 1–2 sentence description.', 1);
    var og = ['og:title', 'og:description', 'og:image'].filter(function (p) { return !K.meta(doc, 'meta[property="' + p + '" i]'); });
    if (og.length) C('machine', 'warn', 'Open Graph tags missing', 'ChatGPT, Claude, Slack, Teams and WhatsApp use them for link cards.', 'Add the missing tags.', 1, og);
    else C('machine', 'pass', 'Open Graph tags present', '', '', 1);
    var imgs = Array.from(doc.querySelectorAll('img')), withAlt = imgs.filter(function (i) { return i.hasAttribute('alt'); }).length;
    if (imgs.length) {
      var share = withAlt / imgs.length;
      if (share >= 0.9) C('machine', 'pass', Math.round(share * 100) + '% of images have alt text', 'Multimodal engines and image answers rely on it.', '', 1);
      else C('machine', 'warn', 'Only ' + Math.round(share * 100) + '% of images have alt text', '', 'Describe meaningful images, including charts and diagrams.', 1);
    }
    var lang = norm(doc.documentElement.getAttribute('lang')), rawLang = raw ? norm(raw.doc.documentElement.getAttribute('lang')) : lang;
    if (rawLang) C('machine', 'pass', 'Language declared (' + rawLang + ')', '', '', 1);
    else if (lang) C('machine', 'warn', 'lang is only set by JavaScript', 'AI crawlers read the served HTML, where <html> has no lang.', 'Output <html lang="' + lang + '"> server-side.', 1);
    else C('machine', 'warn', 'No lang attribute', 'Helps engines answer in the right language and market.', 'Add <html lang="…">.', 1);
  }

  /* ---------- engine readiness ---------- */
  function engines(rows, render, tokens) {
    var ok = function (ua) { var r = rows.find(function (x) { return x.bot.ua === ua; }); return !r || r.allowed; };
    var indexable = !/noindex|(^|,)\s*none/.test(tokens), snippets = !/nosnippet|max-snippet\s*:\s*0\b/.test(tokens);
    var readable = render.ratio == null || render.ratio >= 0.5;
    var E = [
      { name: 'ChatGPT', bots: ['OAI-SearchBot', 'ChatGPT-User'], needsRaw: true },
      { name: 'Claude', bots: ['Claude-SearchBot', 'Claude-User'], needsRaw: true },
      { name: 'Perplexity', bots: ['PerplexityBot', 'Perplexity-User'], needsRaw: true },
      { name: 'Google AI Overviews and AI Mode', bots: ['Googlebot'], needsIndex: true },
      { name: 'Microsoft Copilot', bots: ['Bingbot'], needsIndex: true }
    ];
    return h('div', { class: 'pc-card au-engines' }, h('h3', { text: 'AI engine readiness' }),
      h('p', { class: 'muted pc-intro', text: 'Whether each engine can reach, read and quote this page. It does not predict whether they will cite it.' }),
      h('div', { class: 'au-engine-grid' }, E.map(function (e) {
        var blocked = e.bots.filter(function (b) { return !ok(b); }), why = [], state = 'ready';
        if (blocked.length) { state = 'blocked'; why.push('robots.txt blocks ' + blocked.join(', ')); }
        if (e.needsIndex && !indexable) { state = 'blocked'; why.push('page is noindex'); }
        if (e.needsIndex && !snippets) { state = 'blocked'; why.push('nosnippet'); }
        if (e.needsRaw && !readable && state === 'ready') { state = 'limited'; why.push('most content needs JavaScript'); }
        if (!why.length) why.push('Crawlers allowed' + (e.needsRaw ? ', content readable without JavaScript' : ', indexable, snippets allowed'));
        return h('div', { class: 'au-engine au-e-' + state }, h('span', { class: 'au-badge', text: { ready: 'Ready', limited: 'Limited', blocked: 'Blocked' }[state] }),
          h('strong', { text: e.name }), h('p', { class: 'muted', text: why.join('; ') + '.' }));
      })),
      render.rawWords != null ? h('p', { class: 'muted au-small', text: 'Without JavaScript, crawlers see ' + render.rawWords + ' of ' + render.renderedWords + ' words.' }) : null);
  }

  /* ---------- run ---------- */
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
    history.replaceState(null, '', '?url=' + encodeURIComponent(url));
    running = true;
    var btn = document.getElementById('auGo');
    btn.disabled = true; btn.textContent = 'Auditing…';
    document.getElementById('auReport').hidden = true;
    var step = K.steps(document.getElementById('auSteps'));
    var o = { key: form.elements.auKey.value.trim() };
    checks = [];
    try {
      var u = new URL(url), isHome = u.pathname === '/' || u.pathname === '';
      var settle = function (p, s) {
        return p.then(function (r) { if (s) s(r.ok ? 'ok' : (r.status === 404 ? 'skip' : 'err'), r.status ? 'HTTP ' + r.status : (r.error || 'Done')); return r; },
          function (x) { if (s) s('err', x.message); return null; });
      };
      var res = await Promise.all([
        settle(K.jina(url, 'html', o), step('Render the page like a browser')),
        settle(K.jina(url, 'raw', o), step('Fetch the HTML an AI crawler sees')),
        settle(K.jina(u.origin + '/robots.txt', 'text', o), step('Read robots.txt')),
        settle(K.jina(u.origin + '/llms.txt', 'text', o), step('Look for llms.txt')),
        settle(K.jina(u.origin + '/llms-full.txt', 'text', o), null),
        isHome ? Promise.resolve(null) : settle(K.jina(u.origin + '/', 'raw', o), step('Read the home page for organisation details'))
      ]);
      var page = res[0];
      if (!page || !page.body) throw new Error('The page could not be fetched' + (page && page.error ? ': ' + page.error : '.'));
      page.doc = K.parse(page.body);
      var raw = res[1] && res[1].body ? { doc: K.parse(res[1].body) } : null;
      var ld = K.jsonLd(page.doc);
      var homeLd = res[5] && res[5].body ? K.jsonLd(K.parse(res[5].body)) : null;
      var rows = checkAccess(page, res[2]);
      var render = checkRender(page, raw);
      checkStructure(page, ld);
      checkTrust(page, ld, homeLd, isHome);
      checkMachine(page, raw, ld, isHome);
      checkLlms(res[3], res[4], u.origin);
      K.renderAudit(document.getElementById('auReport'), {
        eyebrow: 'GEO audit', url: page.finalUrl, categories: CATS, checks: checks, file: 'geo-audit.json',
        scoreLabel: 'AI visibility readiness', scoreSub: 'How well AI search and assistants can reach, read, trust and cite this page',
        before: engines(rows, render, robotsTokens(page.doc)),
        extra: { crawlers: rows.map(function (r) { return { userAgent: r.bot.ua, vendor: r.bot.vendor, purpose: r.bot.use, type: r.bot.kind, allowed: r.allowed, rule: r.rule }; }), wordsServed: render.rawWords, wordsRendered: render.renderedWords }
      });
    } catch (x) {
      err.textContent = x.message + ' If the site blocks automated requests, try again later or check another page.';
    } finally {
      running = false;
      btn.disabled = false; btn.textContent = 'Run GEO audit';
    }
  });
})();

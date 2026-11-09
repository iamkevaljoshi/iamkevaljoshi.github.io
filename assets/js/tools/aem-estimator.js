/* AEM as a Cloud Service migration estimator.
   1. Parses a Best Practices Analyzer (BPA) CSV in the browser and groups findings into refactoring buckets.
   2. Reads robots.txt and XML sitemaps, samples pages through Jina Reader and finds templates, components,
      forms and integrations.
   3. Combines both with editable assumptions into development, QA and total effort plus a timeline.
   The BPA file never leaves the browser. Effort rates are the author's defaults, not an Adobe model. */
(function () {
  'use strict';
  var K = window.KJTools;
  if (!K) return;
  var h = K.h;
  var $ = function (id) { return document.getElementById(id); };
  var RATES_KEY = 'kj-me-rates-v1';

  /* ---------------------------------------------------------------
     BPA buckets. match: [code, subtype or '*']. Rates in person-days.
     per = per unique finding up to cap; bulk = per finding beyond cap; flat = once if any finding.
     --------------------------------------------------------------- */
  var BUCKETS = [
    { id: 'statictpl', name: 'Static templates → editable templates', match: [['CTEM', 'custom.static.template'], ['LUI', 'legacy.static.template']], per: 3, cap: 30, bulk: 1.5, flat: 0,
      why: 'Rebuild as editable templates with policies, and restructure pages that use them.' },
    { id: 'classicui', name: 'Classic UI dialogs, widgets and legacy components', match: [['LUI', 'legacy.dialog.classic'], ['LUI', 'legacy.custom.component'], ['CDW', '*']], per: 1.5, cap: 60, bulk: 0.75, flat: 0,
      why: 'Convert to Touch UI (Granite/Coral) dialogs and re-test authoring.' },
    { id: 'overlays', name: 'Overlays of /libs and core', match: [['CCOM', 'custom.overlay.foundation'], ['LOCP', '*']], per: 1, cap: 40, bulk: 0.5, flat: 0,
      why: '/libs is immutable on AEMaaCS: move to supported extension points.' },
    { id: 'components', name: 'Custom components: review and regression fixes', match: [['CCOM', '*']], per: 0.25, cap: 200, bulk: 0.1, flat: 0,
      why: 'Every custom component is checked against Cloud Service APIs and the new repository structure.' },
    { id: 'templates', name: 'Other custom templates', match: [['CTEM', '*']], per: 0.25, cap: 60, bulk: 0.1, flat: 0, why: 'Review policies, structure and allowed components.' },
    { id: 'clientlibs', name: 'Client libraries', match: [['CCL', '*']], per: 0.1, cap: 80, bulk: 0.03, flat: 0, why: 'Serve through /etc.clientlibs (allowProxy) and the front-end build.' },
    { id: 'repo', name: 'Repository structure and content areas', match: [['URS', '*'], ['CAV', '*'], ['ECU', '*']], per: 0.15, cap: 100, bulk: 0.03, flat: 1,
      why: 'Split mutable and immutable content (/apps vs /conf, /var, /content); usually solved with scripts.' },
    { id: 'indexes', name: 'Oak index definitions', match: [['OID', '*'], ['DOPI', '*']], per: 1, cap: 30, bulk: 0.5, flat: 0, why: 'Convert to compatible, versioned custom indexes deployed as code.' },
    { id: 'reverse', name: 'Reverse replication', match: [['REP', 'reverse.replication']], per: 5, cap: 5, bulk: 2, flat: 0, why: 'Not supported on AEMaaCS: redesign (for example user-generated content via an external store).' },
    { id: 'replication', name: 'Replication agents', match: [['REP', '*']], per: 1, cap: 15, bulk: 0.5, flat: 0, why: 'Custom agents and modified defaults are replaced by Sling Content Distribution.' },
    { id: 'workflows', name: 'Asset workflows and processing', match: [['WRK', '*']], per: 2, cap: 20, bulk: 1, flat: 0, why: 'Move to asset microservices, processing profiles and post-processing workflows.' },
    { id: 'apis', name: 'Incompatible APIs and changed code', match: [['OU', '*'], ['OCU', '*'], ['NCC', '*'], ['NBCC', '*'], ['IOI', '*']], per: 0.75, cap: 60, bulk: 0.3, flat: 0, why: 'Replace removed or internal APIs and re-test.' },
    { id: 'guidelines', name: 'Developer guideline fixes', match: [['DG', '*']], per: 0.5, cap: 60, bulk: 0.2, flat: 0, why: 'Schedulers, resource resolvers, long-running jobs and similar patterns.' },
    { id: 'osgi', name: 'OSGi configuration and run modes', match: [['URC', '*'], ['MI', '*'], ['UMI', '*']], per: 0.2, cap: 80, bulk: 0.05, flat: 1, why: 'Supported run modes only; secrets and environment values move to Cloud Manager variables.' },
    { id: 'packages', name: 'Installed packages and bundles', match: [['INST', '*']], per: 0.25, cap: 80, bulk: 0.1, flat: 0, why: 'Check third-party and custom packages for Cloud Service compatibility.' },
    { id: 'forms', name: 'AEM Forms', match: [['FORM', '*'], ['FORMS', '*']], per: 2, cap: 30, bulk: 1, flat: 5, why: 'Unsupported or modified Forms features need rework.' },
    { id: 'cif', name: 'Commerce Integration Framework (classic)', match: [['CIF', '*']], per: 0.5, cap: 40, bulk: 0.2, flat: 15, why: 'Classic CIF is incompatible: move to CIF add-on or another commerce approach.' },
    { id: 'social', name: 'Communities (Social)', match: [['SIF', '*']], per: 0, cap: 0, bulk: 0, flat: 20, why: 'Not available on AEMaaCS: replace with a third-party solution.' },
    { id: 'screens', name: 'Screens', match: [['SCR', '*']], per: 0, cap: 0, bulk: 0, flat: 10, why: 'Assess the Screens setup separately.' },
    { id: 'searchpromote', name: 'Search & Promote', match: [['SPI', '*']], per: 0, cap: 0, bulk: 0, flat: 8, why: 'Retired product: replace search.' },
    { id: 'weretail', name: 'We.Retail sample content', match: [['WRF', '*']], per: 0, cap: 0, bulk: 0, flat: 1, why: 'Remove sample content and dependencies.' },
    { id: 'assetsbundles', name: 'Assets bundle and overlay usage', match: [['AC', '*']], per: 0.5, cap: 20, bulk: 0.2, flat: 0, why: 'Replace incompatible Assets customisations.' },
    { id: 'acv', name: 'Asset content issues', match: [['ACV', '*']], per: 0.01, cap: 1000, bulk: 0.002, flat: 1, why: 'Missing renditions and invalid names, fixed with scripts before transfer.' },
    { id: 'users', name: 'Users, namespaces and OAuth', match: [['OAUI', '*'], ['INS', '*']], per: 0.25, cap: 20, bulk: 0.1, flat: 0, why: 'Users move to Adobe IMS; OAuth users and invalid namespaces need clean-up.' },
    { id: 'dm', name: 'Dynamic Media', match: [['DM', '*']], per: 0, cap: 0, bulk: 0, flat: 5, why: 'Re-configure Dynamic Media and verify presets and delivery.' },
    { id: 'msm', name: 'Multi Site Manager', match: [['MSM', '*']], per: 0.2, cap: 20, bulk: 0.05, flat: 2, why: 'Review rollout configurations and live copy relationships.' },
    { id: 'pcx', name: 'Complex pages', match: [['PCX', '*']], per: 0.05, cap: 200, bulk: 0.01, flat: 0, why: 'Pages with very large node counts: check authoring performance and migration.' }
  ];
  var IGNORE = { ASO: 1, NONE: 1, SBCE: 1 };   // system overview and deprecated codes: no direct effort

  function defaultRates() { var r = {}; BUCKETS.forEach(function (b) { r[b.id] = { per: b.per, cap: b.cap, bulk: b.bulk, flat: b.flat }; }); return r; }
  var rates = (function () {
    var d = defaultRates();
    try { var s = JSON.parse(K.store.get(RATES_KEY) || 'null'); if (s) Object.keys(d).forEach(function (k) { if (s[k]) d[k] = Object.assign(d[k], s[k]); }); } catch (e) { /* ignore */ }
    return d;
  })();

  /* ---------------------------------------------------------------
     CSV parsing
     --------------------------------------------------------------- */
  function parseCSV(text) {
    var rows = [], row = [], f = '', q = false, i = 0, n = text.length;
    if (text.charCodeAt(0) === 0xFEFF) i = 1;
    for (; i < n; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
      else if (c !== '\r') f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows;
  }
  var nn = function (v) { v = (v || '').trim(); return v === '\\N' ? '' : v; };

  function analyseBpa(text) {
    var rows = parseCSV(text);
    if (rows.length < 2) throw new Error('The file is empty.');
    var head = rows[0].map(function (x) { return x.trim().toLowerCase(); });
    var col = function (name) { return head.indexOf(name); };
    var ci = { code: col('code'), type: col('type'), sub: col('subtype'), imp: col('importance'), id: col('identifier'), other: col('other'), msg: col('message'), ctx: col('context') };
    if (ci.code < 0 || (ci.sub < 0 && ci.type < 0)) throw new Error("This doesn't look like a BPA CSV export: expected columns such as code, type, subtype and importance.");
    var get = function (r, k) { return ci[k] >= 0 ? nn(r[ci[k]]) : ''; };

    var byBucket = {}, codes = {}, imp = { CRITICAL: 0, MAJOR: 0, ADVISORY: 0, INFO: 0 }, total = 0, unmatched = {};
    var sys = { notes: [] };
    BUCKETS.forEach(function (b) { byBucket[b.id] = { ids: new Set(), findings: 0, imp: { CRITICAL: 0, MAJOR: 0, ADVISORY: 0, INFO: 0 } }; });

    for (var r = 1; r < rows.length; r++) {
      var row = rows[r]; if (!row.length || (row.length === 1 && !row[0])) continue;
      var code = get(row, 'code').toUpperCase(), sub = get(row, 'sub') || get(row, 'type'), im = get(row, 'imp').toUpperCase();
      if (!code) continue;
      total++;
      codes[code] = (codes[code] || 0) + 1;
      if (imp[im] != null) imp[im]++;
      if (code === 'ASO') { readSystem(sys, sub, [get(row, 'id'), get(row, 'other'), get(row, 'msg'), get(row, 'ctx')].join(' | ')); continue; }
      if (IGNORE[code]) continue;
      var b = BUCKETS.find(function (x) { return x.match.some(function (m) { return m[0] === code && (m[1] === '*' || m[1] === sub); }); });
      if (!b) { unmatched[code] = (unmatched[code] || 0) + 1; continue; }
      var key = get(row, 'id') || (get(row, 'msg') + '|' + get(row, 'ctx')).slice(0, 300);
      var bb = byBucket[b.id];
      bb.ids.add(key); bb.findings++;
      if (bb.imp[im] != null) bb.imp[im]++;
    }
    return { total: total, codes: codes, imp: imp, byBucket: byBucket, sys: sys, unmatched: unmatched };
  }

  /* ASO system overview: the exact message format varies by BPA version, so read numbers defensively. */
  function bigNum(s) {
    var m = (s || '').replace(/(\d),(\d{3})/g, '$1$2').match(/\d+(\.\d+)?/g);
    return m ? Math.max.apply(null, m.map(Number)) : null;
  }
  function readSystem(sys, sub, text) {
    var t = text.toLowerCase();
    if (sub === 'aem.version') { var v = text.match(/6\.\d(\.\d+)*(\.\d+)?/); if (v) sys.version = v[0]; }
    else if (sub === 'node.count') {
      var n = bigNum(text); if (n == null) return;
      if (/dam:asset|\basset/.test(t)) sys.assets = Math.max(sys.assets || 0, n);
      else if (/cq:page|\bpage/.test(t)) sys.pages = Math.max(sys.pages || 0, n);
      else if (/total|all nodes/.test(t)) sys.nodes = Math.max(sys.nodes || 0, n);
    } else if (sub === 'node.store' || sub === 'data.store') {
      var m = text.match(/(\d[\d.,]*)\s*(tb|gb|mb|kb|bytes|b)\b/i);
      if (m) {
        var val = parseFloat(m[1].replace(/,/g, '')), u = m[2].toLowerCase();
        var gb = u === 'tb' ? val * 1024 : u === 'gb' ? val : u === 'mb' ? val / 1024 : u === 'kb' ? val / 1048576 : val / 1073741824;
        sys.repoGB = Math.round(((sys.repoGB || 0) + gb) * 10) / 10;
      }
    } else if (sub === 'vanity.url.count') sys.vanity = bigNum(text);
    else if (sub === 'aem.product') { var p = text.split('|')[0].trim(); if (p) sys.notes.push('Uses ' + p); }
  }

  /* ---------------------------------------------------------------
     Website analysis
     --------------------------------------------------------------- */
  var LOCALE = /^[a-z]{2}([-_][a-z]{2})?$/i;
  function parseSitemap(text) {
    var doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) return null;
    var root = doc.documentElement, kind = root.localName;
    if (kind !== 'urlset' && kind !== 'sitemapindex') return null;
    var locs = Array.from(root.getElementsByTagNameNS('*', 'loc')).map(function (n) { return n.textContent.trim(); }).filter(Boolean);
    return { kind: kind, locs: locs };
  }
  function clusterKey(u) {
    var segs = u.pathname.replace(/\.html?$/, '').split('/').filter(Boolean);
    var locale = '';
    while (segs.length && LOCALE.test(segs[0]) && segs[0].length <= 5) locale += '/' + segs.shift();
    segs = segs.map(function (s) { return /\d{3,}|^[0-9a-f-]{16,}$/i.test(s) ? ':id' : s; });
    var key = segs.length <= 1 ? '/' + (segs[0] ? '(top level)' : '') : '/' + segs.slice(0, Math.min(2, segs.length - 1)).join('/') + '/*';
    return { key: key, locale: locale };
  }
  var INTEGRATIONS = [
    ['Google Tag Manager / GA4', /googletagmanager\.com|google-analytics\.com|gtag\(/i],
    ['Adobe tags (Launch)', /assets\.adobedtm\.com/i], ['Adobe Web SDK / Target', /alloy|\bat\.js|mbox|tt\.omtrdc/i],
    ['Adobe Analytics', /omtrdc\.net|2o7\.net|appmeasurement/i], ['OneTrust', /cookielaw\.org|onetrust/i], ['Cookiebot', /cookiebot/i],
    ['Hotjar', /hotjar/i], ['Microsoft Clarity', /clarity\.ms/i], ['Marketo', /marketo|munchkin|mktoForms/i], ['HubSpot', /hubspot|hs-scripts/i],
    ['Salesforce / Pardot', /pardot|salesforce|force\.com/i], ['reCAPTCHA', /recaptcha/i], ['YouTube', /youtube\.com\/embed|youtube-nocookie/i],
    ['Vimeo', /player\.vimeo/i], ['Google Maps', /maps\.googleapis|google\.com\/maps/i], ['Dynamic Media (Scene7)', /scene7\.com|\/is\/image\//i],
    ['Live chat', /intercom|drift\.com|zdassets|livechatinc|tawk\.to/i], ['Site search (Algolia / Coveo)', /algolia|coveo/i],
    ['Reviews (Bazaarvoice / Trustpilot)', /bazaarvoice|trustpilot/i], ['Qualtrics', /qualtrics/i], ['Optimizely', /optimizely/i],
    ['New Relic', /newrelic|nr-data\.net/i], ['Dynatrace', /dynatrace|ruxit/i]
  ];
  function analysePage(html) {
    var doc = K.parse(html), s = html.slice(0, 600000);
    var aem = /\/etc\.clientlibs\/|\/content\/dam\/|aem-Grid|\bcq:/.test(s) || !!doc.querySelector('meta[name="template"]');
    var tplMeta = doc.querySelector('meta[name="template"]');
    var tpl = tplMeta ? (tplMeta.getAttribute('content') || '').trim() : '';
    if (!tpl) { var bc = doc.body ? doc.body.className : ''; var m = bc.match(/\b([a-z][a-z0-9-]*(?:page|template))\b/i); if (m) tpl = m[1]; }
    var comps = new Set();
    // not component names: layout helpers, BEM elements (__) and Style System variants (--)
    var SKIP = /^(parbase|section|clearfix|row|col(-.*)?|container-fluid|wrapper|aem-.*|cq-.*|cmp-.*|new|newpar|iparsys|parsys|responsivegrid|[a-z]{1,2}-\d+)$|__|--/i;
    var firstReal = function (el) { return Array.from(el.classList).find(function (x) { return !SKIP.test(x); }); };
    doc.querySelectorAll('[class*="aem-GridColumn"]').forEach(function (el) { var c = firstReal(el); if (c) comps.add(c); });
    // classic AEM paragraph systems mark each component wrapper with "parbase" (for example "text parbase section")
    doc.querySelectorAll('.parbase').forEach(function (el) { var c = firstReal(el); if (c) comps.add(c); });
    doc.querySelectorAll('[class*="cmp-"]').forEach(function (el) {
      el.classList.forEach(function (x) { if (/^cmp-[a-z0-9-]+$/.test(x) && !/__|--/.test(x)) comps.add(x.replace(/^cmp-/, '')); });
    });
    var forms = Array.from(doc.querySelectorAll('form')).filter(function (f) {
      return !f.querySelector('input[type="search"]') && f.getAttribute('role') !== 'search' && !/search/i.test(f.getAttribute('action') || '') && f.querySelectorAll('input:not([type=hidden]),select,textarea').length >= 2;
    }).map(function (f) { return (f.getAttribute('action') || f.id || f.className || 'form').slice(0, 80); });
    var integ = INTEGRATIONS.filter(function (x) { return x[1].test(s); }).map(function (x) { return x[0]; });
    return { aem: aem, tpl: tpl, comps: Array.from(comps), forms: forms, integ: integ };
  }

  async function analyseSite(url, sampleN, o, step) {
    var u = new URL(url), origin = u.origin;
    o = Object.assign({ timeout: 25000 }, o);   // fail fast: a slow page shouldn't stall the whole analysis
    var sRob = step('Read robots.txt');
    var robots = null;
    try { var rr = await K.jina(origin + '/robots.txt', 'text', o); if (rr.ok && rr.body && !rr.servedHtml) { robots = K.parseRobots(rr.body); sRob('ok', robots.sitemaps.length + ' sitemap(s) declared'); } else sRob('err', 'Not found; trying /sitemap.xml'); }
    catch (e) { sRob('err', e.message); }
    var sMap = step('Read XML sitemaps');
    var queue = robots && robots.sitemaps.length ? robots.sitemaps.filter(function (x) { return /^https?:/i.test(x); }).slice(0, 5)
      : ['/sitemap.xml', '/sitemap_index.xml', '/sitemaps.xml', '/sitemap-index.xml'].map(function (x) { return origin + x; });   // common names when robots.txt has none
    var urls = new Set(), read = 0, skipped = 0, lastErr = null, childTotal = 0, childRead = 0, stop = false;
    var MAXMAPS = o.key ? 30 : 16, MAXURLS = 200000, t0 = Date.now(), BUDGET = 60000;
    var host = u.hostname.replace(/^www\./, '');
    async function readMap(sm, isChild) {
      if (/\.gz($|\?)/i.test(sm)) { skipped++; return; }
      var res = null;
      try { res = await K.jina(sm, 'text', o); }
      catch (e) { skipped++; lastErr = e; if (/rate limit|blocking/i.test(e.message)) stop = true; return; }
      read++;
      var p = res && res.ok ? parseSitemap(res.body) : null;
      if (!p) { skipped++; return; }
      if (p.kind === 'sitemapindex') { childTotal += p.locs.length; queue.push.apply(queue, p.locs); return; }
      if (isChild) childRead++;
      p.locs.forEach(function (l) { try { var x = new URL(l); if (x.hostname.replace(/^www\./, '') === host) urls.add(x.origin + x.pathname); } catch (e) { /* skip */ } });
      sMap('run', read + ' read · ' + urls.size.toLocaleString() + ' URLs');
    }
    // top-level sitemaps first, then children four at a time, within a time and count budget
    var roots = queue.splice(0, queue.length);
    await Promise.all(roots.map(function (r) { return readMap(r, false); }));
    while (queue.length && !stop && read < MAXMAPS && urls.size < MAXURLS && Date.now() - t0 < BUDGET) {
      await Promise.all(queue.splice(0, Math.min(4, MAXMAPS - read)).map(function (c) { return readMap(c, true); }));
    }
    var unread = queue.length;
    var estimated = false, total = urls.size;
    if (unread && childRead) { total = Math.round(urls.size + unread * (urls.size / childRead)); estimated = true; }
    var partial = unread > 0 || urls.size >= MAXURLS;
    if (!urls.size) {
      sMap('err', lastErr ? lastErr.message : 'No sitemap URLs found');
      throw new Error(lastErr ? lastErr.message + ' You can also enter the page count manually below.' : 'No URLs found in the XML sitemaps. Check that the site publishes a sitemap, or enter the page count manually below.');
    }
    sMap('ok', urls.size.toLocaleString() + ' URLs from ' + read + ' sitemap(s)' + (estimated ? ' · about ' + total.toLocaleString() + ' in total (' + unread + ' sitemaps not read)' : '') + (skipped ? ' · ' + skipped + ' skipped' : ''));

    // clusters and locales
    var clusters = {}, locales = {};
    urls.forEach(function (x) {
      var c = clusterKey(new URL(x));
      (clusters[c.key] = clusters[c.key] || []).push(x);
      locales[c.locale || '(default)'] = (locales[c.locale || '(default)'] || 0) + 1;
    });
    var ckeys = Object.keys(clusters).sort(function (a, b) { return clusters[b].length - clusters[a].length; });

    // sample across clusters: round robin, biggest first
    var sample = [], idx = {};
    for (var round = 0; sample.length < sampleN && round < 50; round++) {
      var added = false;
      for (var i = 0; i < ckeys.length && sample.length < sampleN; i++) {
        var list = clusters[ckeys[i]], j = idx[ckeys[i]] || 0;
        if (j < list.length) { sample.push(list[Math.floor(j * list.length / Math.max(1, Math.min(list.length, 5))) % list.length]); idx[ckeys[i]] = j + 1; added = true; }
      }
      if (!added) break;
    }
    sample = Array.from(new Set(sample));
    var sPages = step('Analyse sample pages');
    var results = [], done = 0, failed = 0, tPages = Date.now();
    async function worker() {
      while (sample.length && Date.now() - tPages < 90000) {
        var pu = sample.shift();
        try { var pr = await K.jina(pu, 'raw', o); if (pr.ok && pr.body) results.push(Object.assign({ url: pu }, analysePage(pr.body))); else failed++; }
        catch (e) { failed++; if (/rate limit/i.test(e.message)) { sample.length = 0; } }
        done++; sPages('run', done + ' analysed' + (failed ? ' · ' + failed + ' failed' : ''));
      }
    }
    await Promise.all([worker(), worker(), worker()]);
    if (!results.length) sPages('err', 'No pages could be read'); else sPages('ok', results.length + ' pages analysed' + (failed ? ' · ' + failed + ' failed' : ''));

    var tpls = {}, comps = {}, forms = new Set(), integ = {}, aemPages = 0;
    results.forEach(function (r) {
      if (r.aem) aemPages++;
      if (r.tpl) tpls[r.tpl] = (tpls[r.tpl] || 0) + 1;
      r.comps.forEach(function (c) { comps[c] = (comps[c] || 0) + 1; });
      r.forms.forEach(function (f) { forms.add(f); });
      r.integ.forEach(function (x) { integ[x] = (integ[x] || 0) + 1; });
    });
    var locList = Object.keys(locales).filter(function (k) { return k !== '(default)'; });
    return {
      origin: origin, total: total, read: urls.size, estimated: estimated, partial: partial, clusters: ckeys.map(function (k) { return { key: k, n: clusters[k].length }; }),
      locales: locList.length ? locList.map(function (k) { return { key: k, n: locales[k] }; }).sort(function (a, b) { return b.n - a.n; }) : [],
      sampled: results.length, aemPages: aemPages, tpls: tpls, comps: comps, forms: Array.from(forms), integ: integ
    };
  }

  /* ---------------------------------------------------------------
     Effort model
     --------------------------------------------------------------- */
  function bucketEffort(b, count) {
    if (!count) return 0;
    var r = rates[b.id];
    return (r.flat || 0) + r.per * Math.min(count, r.cap) + r.bulk * Math.max(0, count - r.cap);
  }
  var round1 = function (x) { return Math.round(x * 10) / 10; };
  var r5 = function (x) { return Math.max(0, Math.round(x)); };

  function estimate(v, bpa) {
    var lines = [], dev = [], qa = [];
    var add = function (arr, group, name, pd, driver) { if (pd > 0) arr.push({ group: group, name: name, pd: round1(pd), driver: driver }); };

    // platform and setup
    add(dev, 'Discovery and planning', 'Assessment, migration plan and backlog', 5 + Math.min(10, v.templates * 0.25 + v.integrations * 0.5), 'Templates and integrations to analyse');
    add(dev, 'Platform setup', 'Cloud Manager, environments, pipelines and repository restructure', 10, 'Fixed: project modernisation to the AEM archetype structure');
    add(dev, 'Platform setup', 'Dispatcher conversion (flexible mode) and CDN rules', 3 + 1.5 * v.sites, v.sites + ' site(s) / domain(s)');

    // code refactoring
    var bpaRows = [];
    if (bpa) {
      BUCKETS.forEach(function (b) {
        var bb = bpa.byBucket[b.id], n = bb.ids.size;
        if (!n) return;
        var pd = bucketEffort(b, n);
        bpaRows.push({ b: b, n: n, findings: bb.findings, imp: bb.imp, pd: round1(pd) });
        add(dev, 'Code refactoring (BPA)', b.name, pd, n + ' unique finding' + (n === 1 ? '' : 's'));
      });
    } else {
      add(dev, 'Code refactoring (estimated)', 'Refactoring without a BPA report', v.components * 0.6 + v.templates * 1.5, 'No BPA report: ' + v.components + ' components × 0.6 + ' + v.templates + ' templates × 1.5');
    }
    add(dev, 'Integrations', 'Re-point and secure integrations', v.integrations * 3, v.integrations + ' integration(s) × 3: egress IPs, secrets, OAuth');

    // content migration
    var ctt = 4 + v.rehearsals * (1.5 + v.repoGB / 200) + Math.min(10, v.assets / 20000);
    add(dev, 'Content migration', 'Content Transfer Tool rehearsals and final top-up', ctt, v.rehearsals + ' rehearsal(s), ' + v.repoGB + ' GB, ' + v.assets.toLocaleString() + ' assets');
    add(dev, 'Content migration', 'Users, groups and permissions (IMS)', 2 + Math.min(5, v.sites * 0.5), 'Users move to Adobe IMS');
    add(dev, 'Go-live', 'Cutover, DNS and go-live support', 4 + v.sites, v.sites + ' site(s)');
    add(dev, 'Go-live', 'Hypercare (development share)', v.hypercare * 2.5, v.hypercare + ' week(s)');

    // QA
    var loc = Math.max(1, v.locales), locF = 1 + Math.log2(loc) * 0.5;   // more locales add effort, but sub-linearly
    add(qa, 'Test planning', 'Test strategy and plan', 3 + Math.min(4, loc * 0.5), loc + ' locale(s)');
    add(qa, 'Test design', 'Test cases for templates and components', v.templates * 0.75 + v.components * 0.25, v.templates + ' templates × 0.75 + ' + v.components + ' components × 0.25');
    add(qa, 'Functional testing', 'SIT and regression execution', v.cycles * (v.templates * 0.3 + v.components * 0.15) * locF, v.cycles + ' cycle(s) × locale factor ' + round1(locF));
    var sample = Math.min(v.pages, Math.round(30 + 8 * Math.sqrt(v.pages)));
    add(qa, 'Migration validation', 'Page-by-page content and visual comparison', sample * 0.03, sample.toLocaleString() + ' of ' + v.pages.toLocaleString() + ' pages sampled, about 15 min each');
    add(qa, 'Functional testing', 'Forms', v.forms * 0.75, v.forms + ' form(s)');
    add(qa, 'Functional testing', 'Integrations', v.integrations * 1.5, v.integrations + ' integration(s)');
    add(qa, 'Functional testing', 'Authoring and publishing workflows', 2 + v.sites, 'Author experience, workflows, MSM');
    if (v.perf) add(qa, 'Non-functional testing', 'Performance and load testing', 5 + v.sites, 'Stage environment, CDN and Dispatcher');
    if (v.sec) add(qa, 'Non-functional testing', 'Security testing', 3, 'Headers, access, penetration test support');
    if (v.a11y) add(qa, 'Non-functional testing', 'Accessibility testing (WCAG 2.2 AA)', 2 + v.templates * 0.25, v.templates + ' templates');
    if (v.auto) add(qa, 'Automation', 'Regression test automation', 5 + v.templates * 0.75, v.templates + ' templates × 0.75');
    add(qa, 'UAT and go-live', 'UAT support', 4 + Math.min(6, loc * 0.5), 'Business acceptance');
    add(qa, 'UAT and go-live', 'Hypercare (QA share)', v.hypercare * 1.5, v.hypercare + ' week(s)');
    var qaBase = qa.reduce(function (s, x) { return s + x.pd; }, 0);
    add(qa, 'Defects', 'Defect retesting buffer (15%)', qaBase * 0.15, '15% of QA effort');

    var devPD = dev.reduce(function (s, x) { return s + x.pd; }, 0), qaPD = qa.reduce(function (s, x) { return s + x.pd; }, 0);
    var base = devPD + qaPD;
    var pm = base * v.pm / 100, arch = base * v.arch / 100, sub = base + pm + arch, cont = sub * v.cont / 100, total = sub + cont;

    // timeline (weeks)
    var f = v.focus / 100;
    var wk = function (pd, people) { return pd / (Math.max(1, people) * 5 * f); };
    var g = function (grp) { return dev.filter(function (x) { return x.group === grp; }).reduce(function (s, x) { return s + x.pd; }, 0); };
    var phases = [];
    var t = 0, push = function (name, start, len, kind) { len = Math.max(len, 0.5); phases.push({ name: name, start: start, len: len, kind: kind }); return start + len; };
    var disc = Math.max(1, wk(g('Discovery and planning'), Math.min(2, v.devs)));
    t = push('Discovery and planning', 0, disc, 'plan');
    var setup = Math.max(1, wk(g('Platform setup'), Math.min(2, v.devs)));
    var setupEnd = push('Platform setup', t, setup, 'dev');
    var buildPD = g('Code refactoring (BPA)') + g('Code refactoring (estimated)') + g('Integrations');
    var buildStart = t + setup * 0.5, build = Math.max(1, wk(buildPD, v.devs));
    var buildEnd = push('Code refactoring and integrations', buildStart, build, 'dev');
    push('Content migration rehearsals', buildStart + build * 0.3, Math.max(1, build * 0.7), 'content');
    var qaExec = qaPD - (qa.filter(function (x) { return /UAT|Hypercare/.test(x.name); }).reduce(function (s, x) { return s + x.pd; }, 0));
    var sitStart = buildStart + build * 0.4, sit = Math.max(2, wk(qaExec, v.qas));
    var sitEnd = push('QA: test design, SIT and regression', sitStart, Math.max(sit, buildEnd - sitStart + 1), 'qa');
    var uatEnd = push('UAT', sitEnd - 0.5, 2, 'qa');
    var golive = push('Cutover and go-live', uatEnd, 1, 'live');
    var end = push('Hypercare', golive, Math.max(0.5, v.hypercare), 'live');
    var pmPhase = { name: 'Project management and architecture', start: 0, len: end, kind: 'plan' };
    phases.unshift(pmPhase);

    return { dev: dev, qa: qa, devPD: devPD, qaPD: qaPD, pm: pm, arch: arch, cont: cont, total: total, phases: phases, weeks: end, goLiveWeek: golive, bpaRows: bpaRows };
  }

  /* ---------------------------------------------------------------
     UI
     --------------------------------------------------------------- */
  var inForm = $('meInputs'), siteForm = $('meSite'), out = $('meResultOut');
  var state = { bpa: null, site: null };
  var NUMS = ['pages', 'locales', 'sites', 'templates', 'components', 'forms', 'integrations', 'assets', 'repoGB', 'devs', 'qas', 'focus', 'cycles', 'rehearsals', 'hypercare', 'pm', 'arch', 'cont'];
  function values() {
    var e = inForm.elements, v = {};
    NUMS.forEach(function (k) { var x = parseFloat(e[k].value); v[k] = isFinite(x) && x >= 0 ? x : 0; });
    ['locales', 'sites', 'templates', 'components', 'devs', 'qas', 'cycles', 'rehearsals'].forEach(function (k) { v[k] = Math.max(1, v[k]); });
    v.focus = Math.min(100, Math.max(40, v.focus || 80));
    ['perf', 'sec', 'a11y', 'auto'].forEach(function (k) { v[k] = e[k].checked; });
    return v;
  }
  var DEFAULTS = {}, filledBy = {};
  NUMS.forEach(function (k) { DEFAULTS[k] = inForm.elements[k].value; });
  function setVal(name, val, src) {
    if (val == null || !isFinite(val)) return;
    var el = inForm.elements[name]; el.value = Math.round(val);
    el.closest('label').classList.add('me-filled'); el.closest('label').title = 'Filled in from ' + src;
    filledBy[name] = src;
  }
  function clearFilled(fromBpa) {   // undo values a previous report (or site analysis) filled in
    Object.keys(filledBy).forEach(function (k) {
      if ((filledBy[k].indexOf('the BPA report') === 0) !== fromBpa) return;
      var el = inForm.elements[k]; el.value = DEFAULTS[k];
      el.closest('label').classList.remove('me-filled'); el.closest('label').removeAttribute('title');
      delete filledBy[k];
    });
  }
  var pd = function (x) { return (Math.round(x * 10) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 }); };

  /* rates table */
  function renderRates() {
    var t = $('meRates'); t.textContent = '';
    t.append(h('thead', null, h('tr', null, h('th', { scope: 'col', text: 'Bucket' }), h('th', { scope: 'col', text: 'Per finding' }), h('th', { scope: 'col', text: 'Threshold' }), h('th', { scope: 'col', text: 'Bulk rate' }), h('th', { scope: 'col', text: 'Fixed' }))));
    var tb = h('tbody');
    BUCKETS.forEach(function (b) {
      var r = rates[b.id];
      var inp = function (k, step) {
        return h('input', { type: 'number', min: '0', step: step, value: r[k], 'aria-label': b.name + ': ' + k, oninput: function (e) {
          var x = parseFloat(e.target.value); r[k] = isFinite(x) && x >= 0 ? x : 0;
          K.store.set(RATES_KEY, JSON.stringify(rates)); update();
        } });
      };
      tb.append(h('tr', null, h('th', { scope: 'row' }, b.name, h('small', { text: b.why })), h('td', null, inp('per', '0.05')), h('td', null, inp('cap', '1')), h('td', null, inp('bulk', '0.01')), h('td', null, inp('flat', '0.5'))));
    });
    t.append(tb);
  }
  $('meRatesReset').addEventListener('click', function () { rates = defaultRates(); K.store.set(RATES_KEY, ''); renderRates(); update(); });

  /* BPA input */
  function loadBpa(text, name) {
    $('meBpaError').textContent = '';
    try {
      var a = analyseBpa(text);
      clearFilled(true);
      state.bpa = a; state.bpaName = name;
      if (a.sys.pages) setVal('pages', a.sys.pages, 'the BPA report');
      if (a.sys.assets) setVal('assets', a.sys.assets, 'the BPA report');
      if (a.sys.repoGB) setVal('repoGB', Math.max(1, a.sys.repoGB), 'the BPA report');
      var tplN = a.byBucket.statictpl.ids.size + a.byBucket.templates.ids.size;
      if (tplN && !state.site) setVal('templates', tplN, 'the BPA report (custom templates)');
      var compN = a.byBucket.components.ids.size;
      if (compN && !state.site) setVal('components', compN, 'the BPA report (custom components)');
      if (a.byBucket.msm.ids.size && !state.site && +inForm.elements.locales.value < 2) setVal('locales', 2, 'the BPA report (MSM in use)');
      renderBpa();
      update();
    } catch (e) { $('meBpaError').textContent = e.message; state.bpa = null; $('meBpaOut').hidden = true; update(); }
  }
  function renderBpa() {
    var a = state.bpa, box = $('meBpaOut'); box.textContent = ''; box.hidden = false;
    var s = a.sys;
    var tiles = h('div', { class: 'me-tiles' },
      tile(a.total.toLocaleString(), 'findings'),
      tile(a.imp.CRITICAL.toLocaleString(), 'critical', 'bad'), tile(a.imp.MAJOR.toLocaleString(), 'major', 'mid'),
      tile(Object.keys(a.codes).length, 'categories'),
      s.version ? tile(s.version, 'AEM version') : null,
      s.pages ? tile(s.pages.toLocaleString(), 'pages (BPA)') : null,
      s.assets ? tile(s.assets.toLocaleString(), 'assets (BPA)') : null,
      s.repoGB ? tile(s.repoGB + ' GB', 'repository') : null);
    box.append(h('p', { class: 'me-file' }, h('strong', { text: state.bpaName }), ' read in your browser'), tiles);
    var um = Object.keys(a.unmatched);
    if (um.length) box.append(h('p', { class: 'muted me-small', text: 'Not estimated (no effort bucket): ' + um.map(function (c) { return c + ' × ' + a.unmatched[c]; }).join(', ') + '.' }));
    if (s.notes.length) box.append(h('p', { class: 'muted me-small', text: s.notes.slice(0, 6).join(' · ') }));
  }
  function tile(v, l, tone) { return h('div', { class: 'me-tile' + (tone ? ' me-' + tone : '') }, h('strong', { text: String(v) }), h('span', { text: l })); }

  function readFile(file) {
    if (!file) return;
    if (file.size > 300 * 1048576) { $('meBpaError').textContent = 'That file is over 300 MB. Filter the BPA report (for example, hide ACS Commons findings) and export again.'; return; }
    var r = new FileReader();
    r.onload = function () { loadBpa(String(r.result), file.name); };
    r.onerror = function () { $('meBpaError').textContent = "Couldn't read that file."; };
    r.readAsText(file);
  }
  var drop = $('meBpaDrop'), fileIn = $('meBpaFile');
  fileIn.addEventListener('change', function () { readFile(fileIn.files[0]); });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('io-over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('io-over'); }); });
  drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); });
  $('meSample').addEventListener('click', function () { loadBpa(sampleCsv(), 'Sample BPA report (illustrative)'); $('meResult').scrollIntoView({ behavior: 'smooth', block: 'start' }); });

  /* site input */
  K.setupKey(siteForm);
  var running = false;
  siteForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (running) return;
    var url = K.normaliseUrl(siteForm.elements.meUrl.value), err = $('meSiteError');
    err.textContent = '';
    if (!url) { err.textContent = 'Enter the website address, for example https://www.example.com/'; return; }
    K.persistKey(siteForm);
    running = true; var btn = $('meGo'); btn.disabled = true; btn.textContent = 'Analysing…';
    var step = K.steps($('meSteps'));
    try {
      var r = await analyseSite(url, +siteForm.elements.meSampleN.value, { key: siteForm.elements.auKey.value.trim() }, step);
      clearFilled(false); state.site = null;
      state.site = r;
      setVal('pages', r.total, r.estimated ? 'the sitemaps (estimated from those read)' : 'the sitemap');
      if (r.locales.length) setVal('locales', r.locales.length, 'sitemap paths');
      var tplN = Object.keys(r.tpls).length;
      // a sample rarely sees every template: add 20% for the unseen ones
      if (tplN) setVal('templates', tplN + Math.ceil(tplN * 0.2), 'templates found on sampled pages (+20% unseen)');
      else setVal('templates', Math.min(20, Math.max(3, Math.round(Math.sqrt(r.clusters.length) * 1.5))), 'page groups in the sitemap (no template tag found: check this)');
      // the BPA custom component count is more reliable than markup; use the site only without it, and only if detection clearly worked
      var compN = Object.keys(r.comps).length;
      var bpaComps = state.bpa ? state.bpa.byBucket.components.ids.size : 0;
      if (!bpaComps && compN >= 5) setVal('components', Math.round(compN * 1.25), 'components found on sampled pages (+25% unseen)');
      setVal('forms', r.forms.length, 'forms on sampled pages');
      var integN = Object.keys(r.integ).length;
      setVal('integrations', Math.max(+inForm.elements.integrations.value || 0, integN + 2), integN + ' detected on pages + 2 back-end (assumed)');
      renderSite();
      update();
    } catch (x) {
      err.textContent = x.message;
    } finally { running = false; btn.disabled = false; btn.textContent = 'Analyse site'; }
  });
  function renderSite() {
    var r = state.site, box = $('meSiteOut'); box.textContent = ''; box.hidden = false;
    box.append(h('div', { class: 'me-tiles' },
      tile((r.estimated ? '≈' : '') + r.total.toLocaleString() + (r.partial && !r.estimated ? '+' : ''), r.estimated ? 'URLs (estimated from ' + r.read.toLocaleString() + ' read)' : 'URLs in sitemaps'), tile(r.locales.length || 1, 'locales'),
      tile(r.clusters.length, 'page groups'), tile(r.sampled, 'pages sampled'),
      tile(Object.keys(r.tpls).length, 'templates seen'), tile(Object.keys(r.comps).length, 'components seen'),
      tile(r.forms.length, 'forms'), tile(Object.keys(r.integ).length, 'integrations')));
    if (r.sampled && !r.aemPages) box.append(h('p', { class: 'io-note', text: "None of the sampled pages look like AEM (no /etc.clientlibs, /content/dam or AEM grid markup). Check you're analysing the right site." }));
    else if (r.sampled && Object.keys(r.comps).length < 5) box.append(h('p', { class: 'io-note', text: "Few components could be identified: this site uses custom markup rather than Core Components or the AEM grid. Use the custom component count from the BPA report (CCOM) instead." }));
    var lists = h('div', { class: 'me-lists' });
    var li = function (title, obj, fmt) {
      var keys = Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; });
      if (!keys.length) return null;
      return h('details', { class: 'io-more' }, h('summary', { text: title + ' (' + keys.length + ')' }),
        h('ul', { class: 'me-ul' }, keys.slice(0, 60).map(function (k) { return h('li', null, h('code', { text: k }), ' ', h('span', { class: 'muted', text: fmt ? fmt(obj[k]) : '' })); })));
    };
    var clusters = {}; r.clusters.forEach(function (c) { clusters[c.key] = c.n; });
    var locs = {}; r.locales.forEach(function (c) { locs[c.key] = c.n; });
    var forms = {}; r.forms.forEach(function (f) { forms[f] = 1; });
    lists.append.apply(lists, [li('Page groups', clusters, function (n) { return n.toLocaleString() + ' pages'; }), li('Locales', locs, function (n) { return n.toLocaleString() + ' pages'; }),
      li('Templates', r.tpls, function (n) { return 'on ' + n + ' sampled page' + (n === 1 ? '' : 's'); }), li('Components', r.comps, function (n) { return n + '×'; }),
      li('Forms', forms), li('Integrations', r.integ, function (n) { return 'on ' + n + ' page' + (n === 1 ? '' : 's'); })].filter(Boolean));
    box.append(lists);
  }

  /* results */
  function update() {
    var v = values(), e = estimate(v, state.bpa);
    out.textContent = '';
    var months = e.total / 20, team = v.devs + v.qas;
    out.append(h('div', { class: 'me-tiles me-big' },
      tile(pd(e.total) + ' PD', 'total effort (person-days)'),
      tile(pd(e.total * 0.85) + '–' + pd(e.total * 1.3), 'likely range (PD)'),
      tile(Math.ceil(e.weeks) + ' weeks', 'to end of hypercare'),
      tile('Week ' + Math.ceil(e.goLiveWeek), 'go-live'),
      tile(pd(months) + ' PM', 'person-months'),
      tile(team + ' + leads', v.devs + ' dev · ' + v.qas + ' QA')));
    if (!state.bpa) out.append(h('p', { class: 'io-note', text: 'No BPA report loaded, so code refactoring is a rough estimate from components and templates. Load a report for a real one.' }));
    if (!state.site) out.append(h('p', { class: 'muted me-small', text: 'Tip: analyse the website in step 2 to base QA on real pages, templates and integrations.' }));

    // summary table
    var sumRows = [
      ['Development, platform and content', e.devPD], ['QA and testing', e.qaPD],
      ['Project management (' + v.pm + '%)', e.pm], ['Architecture and tech lead (' + v.arch + '%)', e.arch], ['Contingency (' + v.cont + '%)', e.cont]
    ];
    out.append(h('div', { class: 'pc-card' }, h('h3', { text: 'Summary' }),
      h('div', { class: 'pc-table-wrap' }, h('table', { class: 'pc-table me-sum' },
        h('thead', null, h('tr', null, h('th', { scope: 'col', text: 'Area' }), h('th', { scope: 'col', class: 'me-num', text: 'Person-days' }), h('th', { scope: 'col', class: 'me-num', text: 'Share' }))),
        h('tbody', null, sumRows.map(function (r) { return h('tr', null, h('th', { scope: 'row', text: r[0] }), h('td', { class: 'me-num', text: pd(r[1]) }), h('td', { class: 'me-num', text: Math.round(r[1] / e.total * 100) + '%' })); })),
        h('tfoot', null, h('tr', null, h('th', { scope: 'row', text: 'Total' }), h('td', { class: 'me-num', text: pd(e.total) }), h('td', { class: 'me-num', text: '100%' })))))));

    out.append(timeline(e));
    out.append(detail('Development, platform and content', e.dev, e.devPD));
    out.append(detail('QA and testing', e.qa, e.qaPD));
    if (e.bpaRows.length) out.append(bpaTable(e.bpaRows));
    out.append(assumptions(v));
    out.append(h('div', { class: 'io-actions me-export' },
      h('button', { class: 'btn solid pc-sm', type: 'button', 'data-track': 'me-csv', onclick: function () { exportCsv(v, e); } }, 'Export CSV'),
      h('button', { class: 'btn ghost pc-sm', type: 'button', onclick: function () { window.print(); } }, 'Print or save as PDF')));
  }
  function detail(title, rows, sum) {
    var groups = {};
    rows.forEach(function (r) { (groups[r.group] = groups[r.group] || []).push(r); });
    var tb = h('tbody');
    Object.keys(groups).forEach(function (g) {
      var gs = groups[g].reduce(function (s, r) { return s + r.pd; }, 0);
      tb.append(h('tr', { class: 'me-grp' }, h('th', { scope: 'rowgroup', colspan: '2', text: g }), h('td', { class: 'me-num', text: pd(gs) })));
      groups[g].forEach(function (r) { tb.append(h('tr', null, h('td', { text: r.name }), h('td', { class: 'muted', text: r.driver }), h('td', { class: 'me-num', text: pd(r.pd) }))); });
    });
    return h('details', { class: 'pc-card', open: true }, h('summary', null, h('h3', { text: title + ' · ' + pd(sum) + ' PD' })),
      h('div', { class: 'pc-table-wrap' }, h('table', { class: 'pc-table' },
        h('thead', null, h('tr', null, h('th', { scope: 'col', text: 'Work item' }), h('th', { scope: 'col', text: 'Driver' }), h('th', { scope: 'col', class: 'me-num', text: 'PD' }))), tb)));
  }
  function bpaTable(rows) {
    rows = rows.slice().sort(function (a, b) { return b.pd - a.pd; });
    return h('details', { class: 'pc-card' }, h('summary', null, h('h3', { text: 'BPA findings behind the refactoring estimate' })),
      h('div', { class: 'pc-table-wrap' }, h('table', { class: 'pc-table' },
        h('thead', null, h('tr', null, h('th', { scope: 'col', text: 'Bucket' }), h('th', { scope: 'col', class: 'me-num', text: 'Unique' }), h('th', { scope: 'col', class: 'me-num', text: 'Findings' }), h('th', { scope: 'col', text: 'Critical / major' }), h('th', { scope: 'col', class: 'me-num', text: 'PD' }))),
        h('tbody', null, rows.map(function (r) {
          return h('tr', null, h('th', { scope: 'row' }, r.b.name, h('small', { text: r.b.why })), h('td', { class: 'me-num', text: r.n.toLocaleString() }), h('td', { class: 'me-num', text: r.findings.toLocaleString() }),
            h('td', { text: r.imp.CRITICAL + ' / ' + r.imp.MAJOR }), h('td', { class: 'me-num', text: pd(r.pd) }));
        })))));
  }
  function timeline(e) {
    var W = Math.ceil(e.weeks), wrap = h('div', { class: 'pc-card me-gantt-card' }, h('h3', { text: 'Timeline · ' + W + ' weeks' }));
    var g = h('div', { class: 'me-gantt', role: 'table', 'aria-label': 'Timeline by phase in weeks' });
    var ticks = h('div', { class: 'me-g-axis', 'aria-hidden': 'true' });
    var step = W > 40 ? 8 : W > 20 ? 4 : 2;
    for (var w = 0; w <= W; w += step) ticks.append(h('span', { style: 'left:' + (w / W * 100) + '%', text: 'W' + w }));
    g.append(h('div', { class: 'me-g-row me-g-head', role: 'row' }, h('span', { class: 'me-g-label', role: 'columnheader', text: 'Phase' }), h('div', { class: 'me-g-track', role: 'columnheader' }, ticks), h('span', { class: 'me-g-label', role: 'columnheader', text: 'Weeks' })));
    e.phases.forEach(function (p) {
      var label = 'Weeks ' + (Math.floor(p.start) + 1) + '–' + Math.ceil(p.start + p.len);
      g.append(h('div', { class: 'me-g-row', role: 'row' }, h('span', { class: 'me-g-label', role: 'rowheader', text: p.name }),
        h('div', { class: 'me-g-track', role: 'cell' }, h('span', { class: 'me-g-bar me-k-' + p.kind, style: 'left:' + (p.start / W * 100) + '%;width:' + Math.max(1.5, p.len / W * 100) + '%', title: label })),
        h('span', { class: 'me-g-when', role: 'cell', text: label })));
    });
    wrap.append(g, h('p', { class: 'muted me-small', text: 'Development and QA overlap: SIT starts once the first features are refactored, and content rehearsals run alongside development. Durations use your team size and focus factor; contingency is effort, not extra calendar time.' }));
    return wrap;
  }
  function assumptions(v) {
    var items = [
      'Effort is in person-days (PD); 20 PD = 1 person-month. Rates are the author\'s defaults from AEM migrations, not an Adobe model. Adjust them under step 3.',
      'Scope is a lift-and-shift to AEM as a Cloud Service: no redesign, no new features and no move to Edge Delivery Services.',
      'The team knows AEM and AEM as a Cloud Service. Add ramp-up time for a team new to the platform.',
      'Content is migrated with the Content Transfer Tool; ' + v.rehearsals + ' rehearsal(s) before the final top-up.',
      'Integrations are re-pointed, not rebuilt. Count back-end integrations the website analysis cannot see.',
      'QA covers ' + v.cycles + ' test cycle(s), migration validation on a sample of pages, and UAT support' + (v.perf || v.sec || v.a11y ? ', plus ' + [v.perf && 'performance', v.sec && 'security', v.a11y && 'accessibility'].filter(Boolean).join(', ') + ' testing' : '') + '.',
      'The likely range is −15% to +30% of the total, because migrations more often run over than under.'
    ];
    return h('details', { class: 'pc-card' }, h('summary', null, h('h3', { text: 'Assumptions' })), h('ul', { class: 'me-ul' }, items.map(function (t) { return h('li', { text: t }); })));
  }
  function exportCsv(v, e) {
    var q = function (s) { s = String(s == null ? '' : s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    var rows = [['Section', 'Group', 'Item', 'Driver', 'Person-days']];
    e.dev.forEach(function (r) { rows.push(['Development', r.group, r.name, r.driver, r.pd]); });
    e.qa.forEach(function (r) { rows.push(['QA', r.group, r.name, r.driver, r.pd]); });
    rows.push(['Overheads', '', 'Project management', v.pm + '%', round1(e.pm)], ['Overheads', '', 'Architecture and tech lead', v.arch + '%', round1(e.arch)], ['Overheads', '', 'Contingency', v.cont + '%', round1(e.cont)]);
    rows.push(['Total', '', '', '', round1(e.total)], [], ['Timeline', 'Phase', 'Start week', 'Length (weeks)', '']);
    e.phases.forEach(function (p) { rows.push(['Timeline', p.name, round1(p.start), round1(p.len), '']); });
    rows.push([], ['Inputs', '', '', '', '']);
    Object.keys(v).forEach(function (k) { rows.push(['Inputs', k, String(v[k]), '', '']); });
    var blob = new Blob([rows.map(function (r) { return r.map(q).join(','); }).join('\n')], { type: 'text/csv' });
    var a = h('a', { href: URL.createObjectURL(blob), download: 'aemaacs-migration-estimate.csv' });
    document.body.append(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  /* illustrative sample report so visitors can try the tool */
  function sampleCsv() {
    var rows = [['code', 'type', 'subtype', 'importance', 'identifier', 'other', 'message', 'moreInfo', 'context']];
    var add = function (code, sub, imp, n, prefix, msg) { for (var i = 1; i <= n; i++) rows.push([code, code, sub, imp, prefix + i, '\\N', msg || '\\N', '\\N', '\\N']); };
    rows.push(['ASO', 'AEM System Overview', 'aem.version', 'INFO', '6.5.21.0', '\\N', 'AEM version 6.5.21.0', '\\N', '\\N']);
    rows.push(['ASO', 'AEM System Overview', 'node.count', 'INFO', 'cq:Page', '\\N', 'Approximate number of cq:Page nodes: 4820', '\\N', '\\N']);
    rows.push(['ASO', 'AEM System Overview', 'node.count', 'INFO', 'dam:Asset', '\\N', 'Approximate number of dam:Asset nodes: 38500', '\\N', '\\N']);
    rows.push(['ASO', 'AEM System Overview', 'node.store', 'INFO', 'SegmentNodeStore', '\\N', 'Node store size: 180 GB', '\\N', '\\N']);
    add('CCOM', 'custom.core', 'INFO', 46, '/apps/acme/components/content/c');
    add('CCOM', 'custom.overlay.foundation', 'MAJOR', 4, '/apps/foundation/components/o');
    add('CTEM', 'custom.static.template', 'MAJOR', 3, '/apps/acme/templates/static-');
    add('CTEM', 'custom.editable.template', 'INFO', 9, '/conf/acme/settings/wcm/templates/t');
    add('LUI', 'legacy.dialog.classic', 'MAJOR', 14, '/apps/acme/components/content/c', 'Classic UI dialog');
    add('CCL', 'custom.client.library', 'INFO', 22, '/apps/acme/clientlibs/cl');
    add('URS', 'node.location', 'MAJOR', 120, '/etc/acme/config/n');
    add('OID', 'index.rule.violation', 'MAJOR', 5, '/oak:index/acmeIndex');
    add('REP', 'custom.replication.agent.detection', 'MAJOR', 2, '/etc/replication/agents.author/custom');
    add('WRK', 'custom.asset.workflow', 'MAJOR', 3, '/var/workflow/models/acme-asset-');
    add('DG', 'java.api', 'ADVISORY', 11, 'com.acme.core.Service');
    add('URC', 'runmode', 'MAJOR', 6, '/apps/acme/config.preprod/c');
    add('OU', 'outdated.usage', 'MAJOR', 4, 'com.day.cq.wcm.foundation.Old');
    add('INST', 'custom.package', 'INFO', 18, 'acme-package-');
    add('MSM', 'cq.livesyncconfig.found', 'INFO', 12, '/content/acme/live-copy-');
    add('ACV', 'missing.original.rendition', 'MAJOR', 340, '/content/dam/acme/asset-');
    add('PCX', 'page.complexity.medium', 'ADVISORY', 25, '/content/acme/en/page-');
    return rows.map(function (r) { return r.map(function (x) { return /[",]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }).join(','); }).join('\n');
  }

  /* wire up */
  renderRates();
  inForm.addEventListener('input', function (e) { if (e.target.closest('.me-rates')) return; var lb = e.target.closest('label'); if (lb) { lb.classList.remove('me-filled'); delete filledBy[e.target.name]; } update(); });
  inForm.addEventListener('change', update);
  update();
})();

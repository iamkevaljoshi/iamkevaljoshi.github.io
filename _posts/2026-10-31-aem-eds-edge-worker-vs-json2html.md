---
layout: post
title: "AEM Edge Delivery Services: edge worker vs JSON2HTML for dynamic pages"
seo_title: "EDS Edge Worker vs JSON2HTML: Dynamic Pages in AEM"
description: "When to use the JSON2HTML overlay or a CDN edge worker for data-driven pages on AEM Edge Delivery Services: architecture, trade-offs and a decision guide."
date: 2026-10-31 12:00:00 +0530
tags: [AEM, Edge Delivery Services, Architecture]
---

Edge Delivery Services (EDS) is brilliant at one thing: taking authored content and serving it as fast, clean, static HTML. Sooner or later, though, every enterprise project hits the same question. *What about the pages whose content doesn't live in a document?* Product detail pages from a PIM. Event pages from a booking system. Articles stored as AEM Content Fragments. A legacy headless CMS you are not allowed to migrate yet.

There are two patterns teams usually reach for: Adobe's **JSON2HTML** service, or an **edge worker** running on the CDN. They are often presented as alternatives, but they solve the problem at completely different points in the page lifecycle. Pick the wrong one and you either fight stale content or pay a latency tax on every request.

This post covers how each one works, where it fits architecturally, the pros and cons I've seen in practice, and a simple decision guide.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **JSON2HTML** turns JSON into EDS-friendly HTML **at preview/publish time**. The output becomes a real page in the Content Bus: cached, indexed, in your sitemap, and served with zero runtime cost. Data is only as fresh as the last publish.
- **An edge worker** runs **at request time** on your CDN (Cloudflare, Fastly, Akamai, CloudFront, or AEM Edge Functions on the Adobe-managed CDN). It can authenticate, personalise and fetch live data, but every request it handles pays for that logic.
- Rule of thumb: **same page for everyone and indexable → JSON2HTML. Different per visitor, needs secrets, or must be real-time → edge worker** (or a plain client-side fetch from a block, which covers most integrations).

## The core idea: *when* does your logic run?

![Where the dynamic logic runs: json2html at publish time versus edge worker at request time]({{ '/assets/img/blog/eds-edge-worker-vs-json2html/01-where-logic-runs.svg' | relative_url }}){: width="1200" height="530" loading="lazy" decoding="async"}

Here's the detail that clears up most of the confusion: **JSON2HTML is itself an edge worker.** Adobe hosts it as a Cloudflare worker. So the real comparison isn't "worker vs no worker". It's this:

- **Publish-time rendering.** A worker produces HTML once, when an author or automation previews the page. EDS ingests and stores it like any authored page.
- **Request-time rendering.** A worker sits in front of `aem.live` and changes the response for every visitor it intercepts.

Everything else (performance, SEO, freshness, cost, ops) follows from that one choice.

## Option 1: JSON2HTML (publish-time, BYOM overlay)

### How it works

JSON2HTML is built on **BYOM (Bring Your Own Markup)**, the EDS contract that lets any service act as a content source as long as it returns HTML that follows EDS semantics: sections, blocks and default content.

Instead of replacing your primary content source, you add the JSON2HTML worker as a **content overlay**. When a page is previewed, the Admin API asks the overlay first. If the overlay doesn't have the path, it falls back to your primary source (Document Authoring, Universal Editor, SharePoint and so on). Authored pages and data-driven pages can live side by side under one site.

![JSON2HTML architecture: dynamic pages rendered at preview and publish time]({{ '/assets/img/blog/eds-edge-worker-vs-json2html/02-json2html-architecture.svg' | relative_url }}){: width="1200" height="590" loading="lazy" decoding="async"}

The flow:

1. Something triggers a **preview** of `/events/42`: an author, a webhook or a bulk script.
2. The Admin API calls the **overlay** (JSON2HTML) for that path.
3. JSON2HTML matches the path against its config, extracts an ID with a regex and **calls your JSON endpoint**.
4. Your backend returns **JSON**.
5. The worker renders it through a **Mustache template** stored in your site's code repo.
6. It returns **semantic HTML** to the Admin API.
7. EDS **ingests** it like any other page, and images are pulled into the Media Bus.
8. On **publish**, the page goes live on `aem.live`, and the sitemap and query-index update.
9. Visitors get a normal, cached EDS page. No API call happens at request time.

### Setup in practice

First, point the overlay at the JSON2HTML worker in your site configuration (overlays need the configuration service; they are not supported with `fstab.yaml`):

```json
"content": {
  "source": { "url": "https://content.da.live/acme/website/" },
  "overlay": {
    "url": "https://json2html.adobeaem.workers.dev/acme/website/main",
    "type": "markup"
  }
}
```

Then register the mapping rules for that branch with a `POST` to the worker's config endpoint:

{% raw %}
```bash
curl -X POST https://json2html.adobeaem.workers.dev/config/acme/website/main \
  -H "Authorization: token <admin-token>" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "path": "/events/",
      "endpoint": "https://api.acme.com/events/{{id}}.json",
      "regex": "/[^/]+$/",
      "template": "/templates/event.html",
      "headers": { "X-API-Key": "<read-only-key>" },
      "relativeURLPrefix": "https://cdn.acme.com"
    },
    {
      "path": "/stores/",
      "endpoint": "https://www.acme.com/stores.json",
      "arrayKey": "data",
      "pathKey": "URL",
      "template": "/templates/store.html"
    }
  ]'
```
{% endraw %}

The first rule pulls one JSON document per page using an ID taken from the URL. The second shows a neat trick: point the endpoint at a large JSON array (an EDS spreadsheet works well), and `arrayKey` plus `pathKey` select the one row that matches the requested path. Other useful options include `forwardHeaders` (pass auth through from the preview request), `useAEMMapping` (rewrite links using your site's path mapping) and `templateApiKey` (fetch templates from a site protected by site authentication).

The template is plain Mustache producing BYOM markup. Blocks are just `div`s with a class, rows and cells are nested `div`s:

{% raw %}
```html
<!DOCTYPE html>
<html>
<head>
  <title>{{name}} | Acme Events</title>
  <meta name="description" content="{{summary}}">
</head>
<body>
  <header></header>
  <main>
    <div>
      <h1>{{name}}</h1>
      <p>{{date}} · {{venue.city}}</p>
      {{#image}}<p><picture><img src="{{image}}" alt=""></picture></p>{{/image}}
      {{{descriptionHtml}}}
    </div>
    <div>
      <div class="speakers">
        {{#speakers}}
        <div><div>{{name}}</div><div>{{role}}</div></div>
        {{/speakers}}
      </div>
    </div>
  </main>
  <footer></footer>
</body>
</html>
```
{% endraw %}

From there, your normal block JS and CSS decorate the page exactly as they would an authored one. The config is **branch-aware**, so you can test a new mapping on a feature branch without touching `main`.

### Pros

- **Zero runtime cost.** Visitors get static, cached HTML. Core Web Vitals look the same as on authored pages.
- **Real pages.** They show up in the sitemap and query-index, return proper 404s, and are fully readable by crawlers and LLMs.
- **Resilient.** If your backend goes down, live pages keep serving. Only the next preview fails.
- **Configuration, not code.** One JSON config and a template. No service to deploy, patch or monitor.
- **Same blocks as authored content.** Data-driven and authored pages share one design system.
- **Good fit for AEM Content Fragments.** Adobe documents this exact pattern for publishing Content Fragments to EDS as self-contained semantic HTML.

### Cons

- **Freshness depends on re-publishing.** If the backend changes, nothing happens until the page is previewed and published again. You must build that trigger (webhook, scheduled bulk job, App Builder action).
- **Same HTML for everyone.** No personalisation, no per-user or per-session data.
- **Mustache is logic-less on purpose.** If your JSON needs real transformation (joins, computed fields, complex conditions), you either reshape the JSON upstream or put a small worker in front of the endpoint.
- **Shared, Adobe-hosted service.** Check the support model and SLA for your contract, and treat the API keys in the config as something a third party holds: read-only and narrowly scoped.
- **Scale of publishing.** Tens of thousands of SKUs means bulk preview/publish jobs and a plan for rate limits and partial failures.

## Option 2: Edge worker (request-time, on the CDN)

### How it works

An edge worker is your own JavaScript running on the CDN in front of EDS. Adobe's integration guidance positions it as the recommended runtime for live-traffic needs: authentication, middleware for protected APIs, dynamic generation and stitching content from several sources. You can run it on your own CDN (Cloudflare Workers, Fastly Compute, Akamai EdgeWorkers, CloudFront) or, if you are on the Adobe-managed CDN, via **AEM Edge Functions**. At the time of writing, Edge Functions are still in beta and limited to three per EDS program (one each for the production, staging and development sites).

![Edge worker architecture: dynamic logic on every request at the CDN]({{ '/assets/img/blog/eds-edge-worker-vs-json2html/03-edge-worker-architecture.svg' | relative_url }}){: width="1200" height="545" loading="lazy" decoding="async"}

Typical responsibilities:

1. Make a per-request decision: auth, geo, device, experiment bucket.
2. Look up the cache with a cache key you design.
3. Fetch the page shell from `aem.live`.
4. Call backend APIs with secrets that never reach the browser.
5. Rewrite or compose HTML as it streams through (e.g. Cloudflare's `HTMLRewriter`).
6. Set the right cache headers and respond.

A minimal Cloudflare example that injects live pricing into an authored product page:

```js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const page = await fetch(new URL(url.pathname + url.search, env.EDS_ORIGIN), request);

    if (!url.pathname.startsWith('/products/') || !page.ok) return page;

    const sku = url.pathname.split('/').pop();
    const res = await fetch(`${env.PRICE_API}/prices/${sku}`, {
      headers: { 'x-api-key': env.PRICE_API_KEY }, // secret stays at the edge
    });
    const price = res.ok ? await res.json() : null;

    return new HTMLRewriter()
      .on('div.price', {
        element(el) {
          if (price) el.setInnerContent(`${price.currency} ${price.amount}`);
        },
      })
      .transform(page);
  },
};
```

Note the graceful fallback: if the price API fails, the page still renders without the price. Every edge worker needs that discipline, because it is now on the critical path. If you put your own CDN in front of EDS, follow the aem.live BYO CDN setup for your vendor so forwarded host headers and push invalidation work correctly.

### Pros

- **Real-time data.** Prices, stock and availability are as fresh as the API.
- **Personalisation and auth.** Gated content, logged-in states, geo or segment variants, IdP flows and JWT validation.
- **Secrets stay server-side.** The worker acts as an API gateway, so keys never ship to the browser.
- **Full programming model.** Any transformation logic you need, not limited to Mustache.
- **Works on any page,** authored or BYOM, without changing the content pipeline.

### Cons

- **You pay on every request.** Each API call on a cache miss adds latency to the HTML response, which shows up directly in TTFB and LCP.
- **Backend outages become page outages,** unless you design timeouts and fallbacks carefully.
- **Not a real page.** The composed HTML lives only in CDN cache: not in the Content Bus, sitemap or query-index. Injected content isn't visible to EDS search or indexing.
- **Caching gets hard.** Personalised responses can't be shared-cached naively. Cache keys, `Vary` and purge strategy become your problem.
- **You own the code.** Deployments, observability, secrets rotation and on-call. It's also tied to your CDN vendor's runtime.
- **Cost scales with traffic,** not with the number of pages.

## Side-by-side

| | JSON2HTML (BYOM overlay) | Edge worker |
|---|---|---|
| **Runs** | At preview/publish | On every request it intercepts |
| **Output** | Real page in the Content Bus | Response composed in flight |
| **SEO, sitemap, query-index** | Automatic | Manual, or not at all |
| **Runtime latency** | None, served from cache | API latency on cache miss |
| **Data freshness** | As of last publish | Real-time |
| **Personalisation** | No | Yes |
| **Secrets / auth** | Static headers in config | Full control at the edge |
| **What you maintain** | Config and Mustache templates | Code, CI/CD, monitoring |
| **Backend down** | Live pages unaffected | Pages degrade or fail |
| **Cost driver** | Number of publishes | Traffic volume |
| **Typical use** | PDPs, events, store locator, CF articles | Pricing, stock, gated content, A/B tests |

## Which one should I use?

![Decision tree: json2html, custom renderer, hybrid, client-side block or edge worker]({{ '/assets/img/blog/eds-edge-worker-vs-json2html/04-decision-tree.svg' | relative_url }}){: width="1200" height="630" loading="lazy" decoding="async"}

The questions I ask on projects, in order:

1. **Is the page the same for every visitor, and should it be indexable?** If yes, you want a real page, which means publish time.
2. **Can you re-publish when the data changes?** Hourly or daily changes are fine with an automated trigger. Data that changes by the second (price, stock) shouldn't drive full page re-publishes.
3. **Can Mustache express the mapping?** If yes, use **JSON2HTML**. If not, write your **own BYOM renderer** (a worker or App Builder action) and plug it in as the overlay instead. Same architecture, more control.
4. **If it's per-visitor, can the browser call the API directly?** If CORS allows it and no secrets are involved, a **client-side fetch in a block** is the simplest answer. Adobe's own guidance puts the large majority of integrations here. Only if it needs secrets, server-side auth or response shaping do you need an **edge worker**.

## The pattern I recommend most: hybrid

For commerce and catalogue-style sites, the best answer is usually *both*:

- **JSON2HTML renders the stable part** of the page (name, description, specs, imagery, SEO metadata) as a real, indexable, cached page.
- **A block or edge worker fills in the volatile part** (price, stock, delivery estimate, logged-in state) at request time.

You get the SEO and performance of static pages, live data where it matters, and the request-time logic stays small. You can also chain them: put a small worker in front of a messy backend to reshape the JSON, and point JSON2HTML at that worker as its endpoint.

## Gotchas from the field

- **Jekyll, Hugo and other Liquid/Go templating eat Mustache braces.** Wrap template snippets in your docs in raw blocks, as in this post.
- **The overlay treats 401 and 403 like 404.** If your endpoint rejects the call, preview silently falls back to the primary source and you get a confusing 404. Check credentials first when a dynamic page "doesn't exist".
- **The JSON2HTML config endpoint has its own auth.** If you get a 401 when posting config, check that you're using the right token type. Adobe has a support article for exactly this.
- **Images must be reachable at preview time.** EDS downloads and re-hosts them in the Media Bus. Use `relativeURLPrefix` for relative paths, and remember protected image hosts need explicit permission to receive auth headers.
- **BYOM strips extras.** `span`s, inline styles and data attributes are removed on ingest, and block class names must be simple: letters, digits and single dashes, and they can't start with a digit. Design your blocks around clean markup.
- **Plan the publish trigger on day one.** A JSON2HTML setup without automated re-publishing is a stale-content incident waiting to happen.
- **Measure edge workers with RUM.** Compare TTFB and LCP on worker-handled routes against plain EDS routes. If you see a gap, cache more aggressively or move logic to publish time.

## Closing thought

The question isn't really "edge worker or JSON2HTML". It's **"does this data belong to the page, or to the visitor?"** Data that belongs to the page should be rendered once, at publish time, and served as static HTML. That is exactly what EDS is optimised for. Data that belongs to the visitor needs request-time logic, and you should keep that logic as small as you can.

If you're designing data-driven pages on Edge Delivery Services and want to talk through the trade-offs for your platform, [get in touch](/contact/).

### References

- [JSON2HTML for Edge Delivery Services](https://www.aem.live/developer/json2html) (aem.live)
- [Bring Your Own Markup](https://www.aem.live/developer/byom) (aem.live)
- [Building integrations with Edge Delivery Services](https://www.aem.live/developer/integrations) (aem.live)
- [Publishing AEM Content Fragments to Edge Delivery Services](https://www.aem.live/developer/content-fragment-overlay) (aem.live)
- [AEM Edge Functions](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/edge-functions) (Experience League)

---
title: "Edge workers and JSON2HTML"
description: "Learn the one question that separates JSON2HTML from an edge worker on Edge Delivery Services: does your logic run at publish time or at request time?"
track: eds
level: 5
order: 29
minutes: 10
outcome: "By the end you can decide whether data-driven pages should use JSON2HTML, an edge worker or a client-side fetch, and justify the choice in terms of freshness, speed and SEO."
prereq: "Lessons 2 (how a page gets to the browser) and 27 (forms and dynamic data)."
terms:
  - { t: "BYOM (Bring Your Own Markup)", d: "The EDS contract that lets any service be a content source if it returns HTML in the EDS structure of sections and blocks." }
  - { t: "JSON2HTML", d: "An Adobe-hosted service that turns JSON from your API into page HTML when a page is previewed or published." }
  - { t: "Overlay", d: "A content source asked first for a path, falling back to your main source if it has nothing for it." }
  - { t: "Edge worker", d: "Your own code running on a CDN in front of the site, executed on requests that reach it." }
  - { t: "Publish time and request time", d: "Publish time is when an author or script publishes a page. Request time is when a visitor asks for it." }
mistake: "Using an edge worker for pages that are the same for everyone. You then pay latency on every request, and the pages are missing from the sitemap and index, for no benefit."
try_it:
  - "List three data-driven pages you might need, for example products, events and a logged-in dashboard."
  - "For each, answer: is it the same for everyone, must it be indexed, and how stale can it be?"
  - "Sketch the JSON for one event and a small HTML template for it, using blocks as nested divs."
  - "Write down what would trigger a republish when the data changes."
  - "For the dashboard, list what your worker would need to do on each request, and what it should do if the API fails."
quiz:
  - q: "What is the key difference between JSON2HTML and an edge worker in front of the site?"
    options:
      - "JSON2HTML is faster because it uses a different CDN"
      - "An edge worker cannot call APIs"
      - "JSON2HTML cannot render images"
      - "JSON2HTML renders HTML at publish time, the worker changes responses at request time"
    answer: 3
    why: "Both are workers. What differs is when they run. Publish-time output becomes a real cached page, request-time output is produced for each request."
  - q: "Your product API changes prices every hour. You use JSON2HTML and do nothing else. What happens?"
    options:
      - "Prices stay stale until the next publish, so a republish trigger is needed"
      - "Pages update automatically at request time"
      - "The CDN refreshes the data every hour"
      - "Pages return 404 when the data changes"
    answer: 0
    why: "The data is baked in at publish time. If freshness matters, build a webhook or scheduled bulk job, or use a worker or client-side fetch for just the price."
  - q: "A page must show different content to each logged-in user and use an API secret. Which fits?"
    options:
      - "JSON2HTML, with the secret in the template"
      - "A client-side fetch with the key in block code"
      - "An edge worker, which can authenticate and keep secrets at the edge"
      - "A longer cache time on the page"
    answer: 2
    why: "Per-user content cannot be a shared static page, and secrets must not reach the browser. The worker is the right place, as long as it has timeouts and fallbacks."
  - q: "Which is NOT true of pages rendered by JSON2HTML?"
    options:
      - "They can appear in the sitemap and query index"
      - "They keep serving if your backend goes down"
      - "They are cached like authored pages"
      - "They can be different for every visitor"
    answer: 3
    why: "Publish-time output is one HTML page for everyone. Per-visitor variation needs request-time logic."
go_deeper:
  - { title: "Edge worker vs JSON2HTML on EDS", url: "/blog/2026/10/aem-eds-edge-worker-vs-json2html/", why: "setup, pros and cons and a decision guide" }
  - { title: "EDS performance: keep Lighthouse at 100", url: "/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/", why: "why request-time logic costs speed" }
  - { title: "Personalisation that works", url: "/blog/2026/11/personalisation-why-it-matters-and-how-to-do-it-well/", why: "where personalisation should run" }
  - { title: "Next lesson: Capstone", url: "/learn/eds/capstone-build-launch-monitor/" }
---
## One question decides almost everything

You need a page for every event in a booking system. The data is not in a document, it is in an API. Do you build the pages once, or build them each time someone visits?

That timing question, **when does your logic run**, decides performance, SEO, freshness, cost and how much you operate. EDS gives you two main tools, and they sit at opposite ends.

## Publish time: JSON2HTML

JSON2HTML is built on **BYOM**. You register it as an **overlay** content source. When a path is previewed, the Admin API asks the overlay first, and falls back to your main source if it has nothing.

The flow when someone previews `/events/42`:

1. The overlay matches the path to a rule and extracts the id.
2. It calls your JSON endpoint.
3. It renders the JSON through a Mustache template stored in your repository.
4. EDS ingests the HTML like any authored page.
5. On publish, the page goes live. Visitors get a normal cached page with no API call.

A tiny template, where blocks are just divs:

{% raw %}
```html
<main>
  <div>
    <h1>{{name}}</h1>
    <p>{{date}} in {{venue.city}}</p>
  </div>
  <div>
    <div class="speakers">
      {{#speakers}}
      <div><div>{{name}}</div><div>{{role}}</div></div>
      {{/speakers}}
    </div>
  </div>
</main>
```
{% endraw %}

You get real pages: fast, in the sitemap and the index, and resilient if your backend is down. You give up two things. The page is only as fresh as the last publish, so you must trigger republishing when data changes. And everyone gets the same HTML. Mustache is deliberately logic-light, so complex reshaping belongs upstream. It is also a shared Adobe-hosted service, so keep keys in its config read-only and narrow, and note that overlays need the configuration service rather than `fstab.yaml`.

## Request time: an edge worker

An edge worker is your own JavaScript on the CDN in front of EDS. Either you use your own CDN (for example Cloudflare, Fastly, Akamai or CloudFront) or, on the Adobe-managed CDN, AEM Edge Functions (in beta when the blog post was written, so check status). It can authenticate, personalise, call APIs with secrets and rewrite HTML in flight.

The cost is that it sits on the critical path of each request it handles. Latency rises on cache misses, a backend outage can become a page outage, and the composed HTML exists only in the CDN cache, not in the sitemap or index. Every worker needs timeouts and a fallback so the page still renders without the dynamic part.

## Choosing

| If the page is... | Use |
|---|---|
| The same for everyone, must be indexed | JSON2HTML |
| Different per visitor, needs secrets, or real-time | Edge worker |
| A small widget, not critical, not for SEO | Client-side fetch from a block |

Most integrations are the last row, which needs no new infrastructure. Reach for the worker only when you need what only it can do. The [full comparison post](/blog/2026/10/aem-eds-edge-worker-vs-json2html/) includes the setup details.

<details markdown="1">
<summary>Stretch question: can you combine them?</summary>

Yes. Render the stable product page at publish time with JSON2HTML so it is indexed and fast, then use a small worker or client-side fetch only for the live price. You keep the SEO and speed of the static page and pay request-time cost for one small piece.

</details>

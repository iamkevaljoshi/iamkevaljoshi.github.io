---
title: "Dispatcher filters, caching and invalidation"
description: "How Dispatcher filter rules decide what reaches publish, what gets cached, how publishing invalidates the cache on Cloud Service, and the mistakes to avoid."
track: aem
level: 4
order: 23
minutes: 10
outcome: "By the end you can write a deny-by-default filter, say why a URL is or is not cached, and explain how a publish makes cached pages stale."
prereq: "Dispatcher: the mental model (lesson 22)."
terms:
  - { t: "Filter rule", d: "An allow or deny rule that matches parts of a request such as method, path, selectors and extension." }
  - { t: "Last match wins", d: "When several filter rules match a request, the final one in the list decides." }
  - { t: "TTL (time to live)", d: "How long a cache may reuse a response, normally set by headers such as `Cache-Control`." }
  - { t: "`.stat` file", d: "A marker file Dispatcher touches on invalidation; cached files older than it are treated as stale." }
  - { t: "`statfileslevel`", d: "A farm setting for how deep in the content tree `.stat` files are used, which controls how much one publish invalidates." }
mistake: "Allowing a broad pattern such as everything under /content to be fetched, because it 'just works'. It also allows renderings you never meant to expose, such as JSON dumps, and the cache can then store them."
try_it:
  - "Open the Dispatcher filter tester at /tools/aem-dispatcher-filter-tester/ and click the sample rules button."
  - "Test `GET /content/site/en.html` and then `GET /content/site/en.infinity.json`. Note which rule decided each answer."
  - "Reorder two rules in the box so a broad allow comes after a narrow deny. Retest and watch the result flip."
  - "List five URLs on a site you know and decide for each whether it should be cached: a home page, a logo, a search with `?q=`, an account page, a versioned JavaScript file."
  - "For each of those five, write the header you would send (`public`, `private`, a long or short `max-age`)."
quiz:
  - q: "Two filter rules match a request: an allow first, then a deny. What happens?"
    options:
      - "The request is allowed because the first match wins"
      - "The request is denied because the last matching rule wins"
      - "The request is allowed because allow always beats deny"
      - "Dispatcher reports a configuration error and refuses to start"
    answer: 1
    why: "Dispatcher evaluates the whole list and the last matching rule decides. That is why a good filter starts with a deny-everything rule and adds narrow allows, and why order matters."
  - q: "A page is requested as `/content/site/en.html?utm_source=mail`. By default, what does Dispatcher do about caching?"
    options:
      - "It caches the page and ignores the parameter automatically"
      - "It does not cache it unless that parameter is listed in ignoreUrlParams"
      - "It strips the query string and then caches the result"
      - "It caches it but only for authenticated visitors"
    answer: 1
    why: "Dispatcher normally does not cache requests that have a query string. Listing parameters that do not change the response in `ignoreUrlParams` makes those requests cacheable, which is why unused parameters can quietly cause misses."
  - q: "An author publishes one page. What is the most accurate description of what happens on Cloud Service?"
    options:
      - "Dispatcher is left alone and every cached page waits for its own TTL to expire"
      - "Dispatcher, the CDN and every visitor's browser are all purged straight away"
      - "Only that single page file is deleted and no other cached page is ever affected"
      - "Each publish flushes its Dispatcher, scoped by `.stat` level, and the CDN keeps its copy until TTL"
    answer: 3
    why: "The platform flushes Dispatcher for you, and `statfileslevel` controls the reach, so more than one file can go stale. The CDN and browsers are not purged, so freshness there depends on TTL."
  - q: "Which is a sound caching decision?"
    options:
      - "Long immutable caching for versioned JavaScript, `private` for account pages"
      - "Long caching for all HTML, since publish clears it anyway"
      - "Cache account pages at the CDN so they load faster"
      - "Never cache anything that has a file extension"
    answer: 0
    why: "Versioned files never change at the same URL, so long caching is safe. Personalised pages must be private. Long HTML caching ignores that publish does not clear the CDN, and caching account pages risks showing one person's page to another."
go_deeper:
  - { title: "Dispatcher on AEM as a Cloud Service: caching rules, invalidation and the mistakes that cost you", url: "/blog/2026/11/dispatcher-on-aem-as-a-cloud-service-caching-and-invalidation/", why: "TTL recipes, statfileslevel and explicit invalidation in depth" }
  - { title: "AEM Dispatcher filter tester", url: "/tools/aem-dispatcher-filter-tester/", why: "check filter rules and run a security probe" }
  - { title: "The CDN and cdn.yaml", url: "/learn/aem/cdn-and-cdn-yaml/", why: "the layer in front that obeys your headers" }
---
## Two questions, asked in order

Every request that reaches Dispatcher faces two questions. First: **may this request pass at all?** That is the filter. Second: **can I answer it from a file I already have?** That is the cache. Getting the first wrong is a security problem. Getting the second wrong is a freshness or performance problem.

## Filters: deny first, allow narrowly

Think of a nightclub door list. The safest rule is "nobody gets in unless they are on the list", not "everyone gets in unless they are banned". Dispatcher filters work the same way.

A filter rule can match the method, URL path, selectors, extension and more. Rules are read in order and **the last matching rule wins**. So a sound filter starts by denying everything, then adds small, specific allows:

```text
/filter {
  /0001 { /type "deny"  /url "*" }
  /0010 { /type "allow" /method "GET" /extension '(html|css|js|png|jpg|webp|svg|woff2)' /path "/content/mysite/*" }
  /0011 { /type "allow" /method "GET" /path "/etc.clientlibs/mysite/*" }
}
```

Notice that rule 0010 names the extension, not just the path. A broad `/url "/content/*"` would also allow `/content/mysite/en.infinity.json`, which dumps the content tree, and selector tricks such as `page.html/foo.css`. In the SDK you include Adobe's default filters first and add your own after them. The [filter tester](/tools/aem-dispatcher-filter-tester/) lets you paste rules like these, test URLs and see which rule decided.

## What gets cached

Dispatcher stores a response only when all of these hold:

- It is a **GET** request.
- The URL has a **file extension**.
- There is **no query string**, unless the parameters are listed in `ignoreUrlParams`.
- The request is **not authenticated**, unless you explicitly allow it.
- The path is **allowed by the cache rules** (`rules.any`).

So `/products.html` can be cached, but `/products.html?q=shoes` normally is not. This surprises teams who add a `?v=123` cache buster or a marketing parameter and see their hit rate collapse. Unused parameters should be ignored, or the page is rendered again each time.

## How a publish makes things stale

You may expect Dispatcher to delete cached files on publish. It does something cleverer and cheaper. When publish receives new content on Cloud Service, it flushes its own Dispatcher, and Dispatcher touches `.stat` files in the cache. A cached file matching the farm's invalidation globs, older than the `.stat` file above it, is treated as stale and rebuilt on the next request.

`statfileslevel` controls how high up that touch goes. With a low value, publishing one page can make every language of a site stale. With a value that matches your tree, such as `/content/<site>/<language>`, only that language is affected.

Two limits to remember. HTML is invalidated this way, but other files such as JSON, images and PDFs are removed when their own path is published, or expire by TTL, unless added to the invalidation rules. And **the CDN and browsers are not purged by a publish**. They keep a copy until their TTL ends. So freshness is a design choice about headers:

```apache
Header always set Cache-Control "max-age=300,stale-while-revalidate=3600" "expr=%{REQUEST_STATUS} < 400"
Header always set Surrogate-Control "max-age=300,stale-while-revalidate=43200" "expr=%{REQUEST_STATUS} < 400"
```

`Surrogate-Control` is read by the Adobe CDN and ignored by browsers, which lets you tune the two separately. Versioned client libraries get long, immutable caching by default on Cloud Service.

## Common mistakes

- **Caching private content.** Anything personalised must send `private` and must not be stored by Dispatcher.
- **Broad allow rules** instead of path plus extension plus selector.
- **Editing the immutable default files.** Your change is ignored in the cloud.
- **Expecting a publish to refresh the CDN.** It will not.
- **Forgetting JSON or fragments.** A JSON feed that combines several pages may need to be added to the invalidation rules or given a short TTL.

<details markdown="1">
<summary>Stretch question: why would a rule allow only html but a developer then see a JSON model fail?</summary>

Because the allow list names extensions. A component model fetched as `.model.json` is a different extension and selector, so it is denied until you add a narrow rule for exactly that selector and extension on the paths that need it. That is the filter doing its job, not a fault.

</details>

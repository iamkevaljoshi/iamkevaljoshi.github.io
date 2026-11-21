---
title: "The CDN and cdn.yaml"
description: "What the Adobe-managed CDN on AEM as a Cloud Service does, how cdn.yaml configures it, the order rules run in, and how to set headers, redirects and filters."
track: aem
level: 4
order: 24
minutes: 9
outcome: "By the end you can explain what the CDN caches and who controls it, and write a small cdn.yaml that sets a header and blocks a path."
prereq: "Dispatcher filters, caching and invalidation (lesson 23)."
terms:
  - { t: "CDN", d: "A network of servers around the world that keeps copies of responses close to visitors, so most requests never travel to AEM." }
  - { t: "cdn.yaml", d: "A YAML file, with `kind: \"CDN\"`, that configures the Adobe-managed CDN and is deployed through a Cloud Manager config pipeline." }
  - { t: "Config pipeline", d: "A Cloud Manager pipeline that deploys configuration such as cdn.yaml on its own, without a full code build." }
  - { t: "Traffic filter rule", d: "A CDN rule that blocks, logs or allows requests by properties such as path, header or client IP." }
  - { t: "Surrogate-Control", d: "A response header read by the CDN and ignored by browsers, so the CDN can keep a response longer than a browser does." }
mistake: "Assuming a response header set in cdn.yaml changes how long the CDN caches. It does not. CDN cache lifetime still comes from the origin's headers, usually set in Dispatcher, so the rule you wrote may have no effect on caching."
try_it:
  - "Draw the stack: browser, CDN, Dispatcher, publish. Mark which of the three can be configured with cdn.yaml, which with Dispatcher files, and which with Java code and content."
  - "Write down one decision for each layer that needs only the request, such as redirecting an old domain, and one that needs a cache rule, such as a TTL for images."
  - "Create a file `config/cdn.yaml` in a scratch project with `kind`, `version` and a `metadata` block, then add one traffic filter rule that blocks `/private-test`."
  - "Add a response transformation that sets `x-content-type-options: nosniff` on publish."
  - "Read both rules aloud in the order the CDN evaluates them and say where the redirect would run if you added one."
quiz:
  - q: "A request arrives at the CDN and a redirect rule matches. What happens next?"
    options:
      - "The request continues to Dispatcher, which performs the redirect"
      - "The CDN answers with the redirect and the request never reaches the origin"
      - "The CDN caches the redirect for the full cache TTL of the page"
      - "The redirect is ignored if the target page is already cached"
    answer: 1
    why: "Redirects run at the edge and end the request there, apart from response transformations. They run before the cache lookup, so cached targets do not stop them."
  - q: "You set `cache-control: max-age=3600` as a response header in cdn.yaml, hoping the CDN will now keep the page for an hour. What is true?"
    options:
      - "The CDN now keeps the page for an hour in all cases"
      - "The CDN uses it only for pages under /content"
      - "Browsers see the header, but the CDN's own caching still follows the origin headers"
      - "The header is rejected and the config pipeline fails"
    answer: 2
    why: "Response transformations run after the cache, so they shape what the browser receives but not what the CDN stores or for how long. CDN lifetime comes from the origin response, normally set in Dispatcher."
  - q: "Which job fits cdn.yaml better than Dispatcher configuration?"
    options:
      - "Deciding which paths get a cache rule on disk"
      - "Blocking a path or adding a security header using only the request"
      - "Running business logic that needs repository content"
      - "Choosing how deep `.stat` files go"
    answer: 1
    why: "If the decision needs only the request, the edge is the cheapest place for it. Cache rules and `.stat` depth belong to Dispatcher, and anything needing content belongs in AEM."
  - q: "Which statement about cdn.yaml is NOT true?"
    options:
      - "It can be deployed in minutes through a config pipeline"
      - "Secrets must not be written into it as plain text"
      - "Rules run in a fixed order, so a rewritten path is seen by later rules"
      - "It replaces Dispatcher, so you can delete your cache rules"
    answer: 3
    why: "The CDN and Dispatcher cooperate. Dispatcher still stores files and, with its headers, tells the CDN how long to cache. Removing Dispatcher rules would break caching and filtering."
go_deeper:
  - { title: "Getting more from the AEM as a Cloud Service CDN: headers, proxying, redirects and more with cdn.yaml", url: "/blog/2026/11/aem-cloud-service-cdn-yaml-headers-proxy-redirects/", why: "every rule type, patterns and caching traps" }
  - { title: "Dispatcher on AEM as a Cloud Service: caching rules, invalidation and the mistakes that cost you", url: "/blog/2026/11/dispatcher-on-aem-as-a-cloud-service-caching-and-invalidation/", why: "the origin headers the CDN obeys" }
  - { title: "AEM redirect map builder", url: "/tools/aem-redirect-map-builder/", why: "for large redirect lists that belong in Dispatcher, not the CDN" }
---
## The layer you used to need a ticket for

Before the edge was configurable, "set a security header" meant editing Apache and deploying the whole web tier, and "redirect this campaign URL" meant a rewrite rule. The CDN sits in front of all of that and answers most traffic before it reaches Dispatcher, so it is the cheapest place to make simple decisions.

On AEM as a Cloud Service, that CDN is managed by Adobe. It is not a service you buy separately and wire up. You tell it what to do with a configuration file.

## What the CDN does and does not control

The CDN keeps copies of cacheable responses at points of presence near visitors. **What** it caches and **for how long** comes from the response headers sent by the origin, which on AEM is normally Dispatcher: `Surrogate-Control` first, otherwise `Cache-Control` or `Expires`. It will not cache responses marked `private`, `no-cache` or `no-store`, or ones that set a cookie.

That split is the key idea:

- **Dispatcher config** decides cache lifetime, because it sets origin headers.
- **cdn.yaml** decides what happens to the request and response at the edge: transformations, redirects, filters, routing.

## cdn.yaml in one picture

The file is deployed through a **config pipeline** in Cloud Manager, so a change goes live in minutes. Rules are evaluated in a fixed order:

```text
request transformations -> traffic filters -> redirects
   -> origin selectors -> cache lookup -> origin
   -> response transformations (on every response)
```

Two consequences matter. A request rewritten early is seen in its new form by every later rule. And response transformations run after the cache, so they change what the browser receives but not what the CDN stored. A redirect ends the request before the cache or origin are touched.

A small file, saved as `config/cdn.yaml`:

```yaml
kind: "CDN"
version: "1"
metadata:
  envTypes: ["dev", "stage", "prod"]
data:
  trafficFilters:
    rules:
      - name: block-internal-path
        when: { reqProperty: path, like: "/private-test*" }
        action: block
  responseTransformations:
    rules:
      - name: security-headers
        when: { reqProperty: tier, equals: publish }
        actions:
          - type: set
            respHeader: x-content-type-options
            value: nosniff
```

Each rule has a `name`, a `when` condition and an action. Conditions read request properties such as `path`, `domain` or `tier`, and can be combined with `allOf` and `anyOf`. Other sections cover `redirects`, `originSelectors` (proxying a path to another backend) and `requestTransformations`. Rate limits and WAF rules also live under traffic filters, with WAF needing the relevant licence.

## Purging and cache headers

Publishing does not purge the CDN. To clear it deliberately you can configure a **purge key** in the same file and send a purge request, either by URL, by surrogate key or for everything. Prefer a soft purge, which marks content stale and revalidates it, to a full purge that sends all traffic to Dispatcher at once. Day to day, rely on sensible TTLs instead.

Never put secrets in the YAML. Reference them as Cloud Manager secret variables. The blog post below shows the exact syntax.

## Which layer for which job

| Job | Where |
|---|---|
| Add a security header to every response | CDN |
| Redirect an old domain or a few campaign URLs | CDN |
| Set a cache lifetime for images or HTML | Dispatcher (origin headers) |
| Thousands of one-to-one redirects | Dispatcher rewrite map |
| Anything that needs repository content | AEM |

<details markdown="1">
<summary>Why does this work? Why do response headers set at the CDN not change the cache?</summary>

Because they run after the cache lookup, on the way out. The CDN has already decided what to store using the origin's headers. This is useful: you can set a different CORS header per caller without splitting the cache. It is also the trap, because a header you meant as a cache instruction does nothing.

</details>

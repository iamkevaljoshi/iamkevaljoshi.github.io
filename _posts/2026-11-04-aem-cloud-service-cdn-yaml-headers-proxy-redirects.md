---
layout: post
title: "Getting more from the AEM as a Cloud Service CDN: headers, proxying, redirects and more with cdn.yaml"
seo_title: "AEMaaCS cdn.yaml: Headers, Proxy Pass, Redirects and More"
description: "A senior architect's guide to the AEM as a Cloud Service CDN configuration: set headers, proxy to other origins, redirect at the edge, protect environments and avoid the caching traps."
ai_summary: "AEM as a Cloud Service lets you configure its Adobe-managed Fastly CDN with a cdn.yaml file deployed through the Cloud Manager config pipeline. Rules run in a fixed order: request transformations, traffic filters, redirects, origin selectors, cache lookup, then response transformations on every response, including cache hits. That order explains most behaviour: response headers set at the CDN don't change what the CDN caches; request headers added for the origin don't change the cache key; origin selectors proxy paths to Edge Delivery Services, other AEM environments or any HTTPS backend. The post gives tested patterns for security and CORS headers, proxy pass, edge redirects, basic auth, edge and purge keys and error pages, plus what belongs in Dispatcher instead."
date: 2026-11-04 18:00:00 +0530
category: aem-cloud-service
tags: [AEM as a Cloud Service, CDN, Fastly, Cloud Manager, Edge Delivery Services, Security]
---

For years, the honest answer to "can we change that at the CDN?" on AEM as a Cloud Service (AEMaaCS) was "raise a ticket". The Adobe-managed CDN is Fastly underneath, but customers couldn't touch it, so everything happened in Dispatcher. That meant a full web tier deployment for a security header, Apache rewrite rules for every redirect, and a separate CDN in front of AEM whenever someone needed to send `/blog` to WordPress.

That's no longer true. A single YAML file, usually called `cdn.yaml` and deployed through the Cloud Manager **config pipeline** in a few minutes, lets you:

- add and remove headers
- rewrite URLs
- proxy paths to other backends
- redirect at the edge
- filter and rate-limit traffic
- put basic auth on an environment
- configure purge and edge keys
- customise the error page

It's the most underused lever in AEMaaCS, and it's also easy to misuse if you don't understand the order in which it runs.

This post is the architect's view: **what `cdn.yaml` can do, the evaluation order that explains every surprise, the patterns I use on projects, and what still belongs in Dispatcher.** For the config pipeline itself and the full list of config kinds, see my post on [Cloud Manager pipelines and the config pipeline]({{ '/blog/2026/11/aem-cloud-manager-pipelines-quality-gates-rde-config-pipeline/' | relative_url }}).

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **`cdn.yaml` is a `kind: "CDN"` config file** deployed through a Cloud Manager config pipeline. It works on publish and preview, and Edge Delivery Services has its own config pipeline for the supported features.
- **Rules run in a fixed order:** request transformations, traffic filters, redirects, origin selectors, cache lookup, origin, and finally response transformations on **every** response, including cache hits and redirects.
- **Response headers set at the CDN don't change what the CDN caches.** CDN TTLs still come from `Cache-Control`, `Surrogate-Control` or `Expires` at the origin, usually Dispatcher.
- **Request headers you add for the origin aren't in the cache key.** The cache key is the full URL, so if the origin varies its response by a header you set, you must also vary the URL or skip the cache.
- **Origin selectors are your proxy pass.** Route a path or domain to Edge Delivery Services, another AEM environment (through a custom domain), the static tier, or any HTTPS backend. You can choose whether cookies, `Authorization` and `Host` are forwarded.
- **Edge redirects are fast and cheap,** but the file is capped at 100 KB. Large redirect maps still belong in Dispatcher.
- **Secrets never go in YAML.** Reference them as {% raw %}`${{SECRET_NAME}}`{% endraw %} and store them as Cloud Manager secret variables.

## Where cdn.yaml fits

A request to an AEMaaCS publish site passes through three layers you can configure:

| Layer | Configured with | Deploys through | Good at |
|---|---|---|---|
| **Adobe-managed CDN (Fastly)** | `cdn.yaml` | Config pipeline, in minutes | Headers, redirects, proxying, filtering, auth, at every POP before the request reaches AEM |
| **Apache and Dispatcher** | `dispatcher/src` | Web tier pipeline | Cache rules and TTLs, large rewrite maps, filters on AEM paths, vanity URLs |
| **AEM publish** | Java, Sling, content | Full-stack pipeline | Anything that needs content, sessions or business logic |

My rule of thumb: **if the decision only needs the request, make it at the CDN. If it needs a cache rule, make it in Dispatcher. If it needs content, make it in AEM.** Moving request-only logic out of Dispatcher shortens web tier deployments, takes load off the origin, and applies rules to cache hits that Dispatcher never sees.

A minimal file looks like this. Put it anywhere under a top-level `config` folder:

```yaml
# config/cdn.yaml
kind: "CDN"
version: "1"
metadata:
  envTypes: ["dev", "stage", "prod"]   # optional; add "rde" to test on an RDE
data:
  requestTransformations: { ... }
  trafficFilters: { ... }
  redirects: { ... }
  originSelectors: { ... }
  responseTransformations: { ... }
  authentication: { ... }
  errorPages: { ... }
```

## The order of evaluation explains everything

Nearly every "why didn't my rule work?" conversation ends with this diagram. It's redrawn from [Adobe's documentation](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/content-delivery/cdn-configuring-traffic), with the notes I add for teams.

![Order of evaluation in the AEM as a Cloud Service CDN: request transformations, traffic filters, redirects, origin selectors, cache lookup and origin fetch, then response transformations on every response including cache hits and redirects]({{ '/assets/img/blog/aem-cdn-yaml/01-order-of-evaluation.svg' | relative_url }}){: width="1200" height="640" loading="lazy" decoding="async"}

Five consequences I make sure every developer on the team understands:

1. **Request transformations run first, so later rules see the rewritten request.** If you rewrite `/Products/X.html` to `/products/x`, traffic filters, redirects and origin selectors all see the new path through `reqProperty: path`. When you need what the client actually sent, use `originalPath` or `originalUrl`. I default to `originalPath` in redirects and origin selectors so a later change to a rewrite doesn't silently change routing.
2. **Traffic filters run before redirects and routing.** A blocked request never reaches a redirect rule or a backend. This also means your rate limits count requests that would otherwise have been redirected.
3. **A redirect ends the request at the CDN.** It skips origin selection and the cache, and goes straight to response transformations.
4. **The cache sits between origin selection and the origin.** The cache key is the full URL, including query parameters. Request headers, cookies and variables are not part of it.
5. **Response transformations run on every response,** including cache hits and redirects, and **after** the cache. Headers you set here reach the browser consistently. They don't change what's stored in the CDN cache, or for how long.

The last two points cause most of the production incidents I've seen with CDN rules, so I'll come back to them in [caching traps](#caching-traps-to-avoid).

## Conditions: the `when` clause

Every rule type uses the same condition syntax: a getter and a predicate, combined with `allOf` and `anyOf`.

```yaml
when:
  allOf:
    - { reqProperty: tier, equals: publish }
    - { reqProperty: domain, in: ["www.example.com", "example.com"] }
    - anyOf:
        - { reqProperty: originalPath, like: "/api/*" }
        - { reqHeader: x-debug, exists: true }
```

The getters worth knowing:

| Getter | Examples | Notes |
|---|---|---|
| `reqProperty` | `path`, `originalPath`, `url`, `originalUrl`, `queryString`, `method`, `tier`, `domain` | `tier` is `author`, `preview` or `publish`; `domain` is lower-cased |
| `reqProperty` (client) | `clientIp`, `clientCountry`, `clientRegion`, `clientContinent`, `clientAsNumber`, `clientAsName` | `clientIp` supports only `equals`, `doesNotEqual`, `in` and `notIn`, with CIDR ranges in lists |
| `reqProperty` (forwarded) | `forwardedDomain`, `forwardedIp` | First value of `X-Forwarded-Host` or `X-Forwarded-For`; useful behind your own CDN |
| `reqHeader`, `reqCookie`, `queryParam` | `reqHeader: user-agent` | Any named header, cookie or parameter |
| `postParam` | `postParam: action` | Only for `application/x-www-form-urlencoded` bodies |
| `var` | `var: country-code` | A variable set earlier by a request transformation |

Predicates are `equals`, `doesNotEqual`, `like` and `notLike` (glob), `matches` and `doesNotMatch` (regex), `in` and `notIn` (lists), and `exists`. Adobe recommends testing regex in regex101 and Fastly Fiddle. I add one rule: **if a glob will do, don't write a regex.** Six months later, someone has to read it.

## Setting and removing headers

### Security headers on every response

Response transformations are the cleanest place for security headers. They run on cache hits too, so every response carries them, however it was served.

```yaml
data:
  responseTransformations:
    rules:
      - name: security-headers
        when: { reqProperty: tier, equals: publish }
        actions:
          - type: set
            respHeader: strict-transport-security
            value: "max-age=31536000; includeSubDomains"
          - type: set
            respHeader: x-content-type-options
            value: nosniff
          - type: set
            respHeader: referrer-policy
            value: strict-origin-when-cross-origin
          - type: set
            respHeader: permissions-policy
            value: "camera=(), microphone=(), geolocation=()"
          - type: set
            respHeader: x-frame-options
            value: SAMEORIGIN
      - name: hide-internal-headers
        when: "*"
        actions:
          # Remove whatever your origin leaks; check a real response first
          - type: unset
            respHeader: x-vhost
          - type: unset
            respHeader: x-powered-by
```

On Content Security Policy, I usually keep the CSP in Dispatcher when it varies by site or template, and use the CDN for headers that are the same everywhere. A strict CSP is also where tag managers and personalisation scripts break, so roll it out with `content-security-policy-report-only` first.

### CORS for headless APIs

Headless sites often need CORS on GraphQL or Content Fragment endpoints for a small list of front-end origins. Because response transformations run *after* the cache, you can set a different `Access-Control-Allow-Origin` per caller without fragmenting the cache. I write one rule per allowed origin with a literal value. It's explicit and easy to review:

```yaml
data:
  responseTransformations:
    rules:
      - name: cors-www
        when:
          allOf:
            - { reqProperty: originalPath, like: "/graphql/execute.json/*" }
            - { reqHeader: origin, equals: "https://www.example.com" }
        actions:
          - type: set
            respHeader: access-control-allow-origin
            value: "https://www.example.com"
          - type: set
            respHeader: vary
            value: Origin
      - name: cors-app
        when:
          allOf:
            - { reqProperty: originalPath, like: "/graphql/execute.json/*" }
            - { reqHeader: origin, equals: "https://app.example.com" }
        actions:
          - type: set
            respHeader: access-control-allow-origin
            value: "https://app.example.com"
          - type: set
            respHeader: vary
            value: Origin
```

An origin that isn't on the list simply gets no CORS header, so the browser blocks it. That's the behaviour you want. Preflight `OPTIONS` handling and AEM's own CORS OSGi configuration still need to agree with this rule, so test both.

### Request headers for the origin

Request transformations can add, remove or rewrite headers on the way in:

```yaml
data:
  requestTransformations:
    rules:
      - name: tag-country-for-origin
        when: { reqProperty: tier, equals: publish }
        actions:
          - type: set
            reqHeader: x-client-country
            value: { reqProperty: clientCountry }
      - name: drop-spoofable-header
        when: "*"
        actions:
          - type: unset
            reqHeader: x-internal-user
```

**Read the caching section before you use the first rule.** Sending the visitor's country to the origin is harmless for logging. If AEM uses it to change the page, the first visitor's country will be cached for everyone.

The second rule is one I add on every project. Any header your origin trusts for decisions (`x-internal-user`, `x-forwarded-user`, feature flags) should be removed at the edge so a client can't send it.

## Rewriting URLs and query strings

### Path rewrites

```yaml
data:
  requestTransformations:
    rules:
      - name: legacy-html-extension
        when: { reqProperty: path, like: "/products/*" }
        actions:
          - type: transform
            reqProperty: path
            op: replace
            match: \.html$
            replacement: ""
          - type: transform
            reqProperty: path
            op: tolower
```

The visitor's URL doesn't change. AEM receives the rewritten path. That's a rewrite, not a redirect, so use it for internal mapping, not for SEO consolidation. Search engines still see the original URL as a separate page.

### Query parameters and the cache

The cache key includes the full query string, so every distinct parameter value is a separate cache object and, on a miss, a separate origin request. Two features help.

**Marketing parameters are already removed.** For environments created in October 2023 or later, the CDN strips parameters matching `^(utm_.*|gclid|gdftrk|_ga|mc_.*|trk_.*|dm_i|_ke|sc_.*|fbclid|msclkid|ttclid)$` before the cache lookup. Analytics still works, because tags read the URL in the browser, which hasn't changed. You can switch it off with `removeMarketingParams: false`. Older environments should check whether they have it, and Adobe recommends a matching `ignoreUrlParams` in Dispatcher either way.

**Strip everything you don't use.** On content pages, I keep an allowlist:

```yaml
data:
  requestTransformations:
    rules:
      - name: keep-only-known-params
        when: { reqProperty: path, like: "/content/*" }
        actions:
          - type: unset
            queryParamDoesNotMatch: ^(page|q|sort)$
```

This turns cache-busting parameters (`?v=123`, `?nocache`) from origin requests into cache hits. It's one of the cheapest origin-load reductions available. Make sure no component relies on a parameter you're removing.

### Variables

Variables pass a value from a request rule to a later rule without exposing it to the origin. Adobe's example extracts a country code from the path:

```yaml
data:
  requestTransformations:
    rules:
      - name: extract-country-code
        when: { reqProperty: path, matches: "^/([a-zA-Z]{2})(/.*|$)" }
        actions:
          - type: set
            var: country-code
            value: { reqProperty: path }
          - type: transform
            var: country-code
            op: replace
            match: "^/([a-zA-Z]{2})(/.*|$)"
            replacement: \1
  responseTransformations:
    rules:
      - name: expose-market
        when: { var: country-code, exists: true }
        actions:
          - type: set
            respHeader: x-market
            value: { var: country-code }
```

### Custom log properties

The same actions can write to CDN logs, which is the best debugging tool you have for CDN rules:

```yaml
requestTransformations:
  rules:
    - name: log-forwarded-host
      when: "*"
      actions:
        - type: set
          logProperty: forwarded_host
          value: { reqHeader: x-forwarded-host }
```

With [log forwarding]({{ '/blog/2026/11/aem-cloud-manager-pipelines-quality-gates-rde-config-pipeline/' | relative_url }}) to Splunk, Datadog or similar, a `logProperty` on your rules lets you see which rule fired for which request, without guessing.

## Proxy pass with origin selectors

Origin selectors are the CDN's reverse proxy. A rule matches a request and sends it to a named origin instead of AEM publish. This is the feature that most often removes a customer-managed CDN from an architecture.

![One domain, many origins: the Adobe-managed CDN routes www.example.com paths to AEM publish by default, to Edge Delivery Services for migrated sections, to the AEM static tier, to another AEM environment through a custom domain, and to an external HTTPS application]({{ '/assets/img/blog/aem-cdn-yaml/02-origin-selectors.svg' | relative_url }}){: width="1200" height="620" loading="lazy" decoding="async"}

### The basic shape

```yaml
data:
  originSelectors:
    rules:
      - name: blog-to-wordpress
        when:
          allOf:
            - { reqProperty: domain, equals: www.example.com }
            - { reqProperty: originalPath, like: "/blog*" }
        action:
          type: selectOrigin
          originName: wordpress
          # skipCache: true
          # headers:
          #   x-proxy-secret: ${{WP_PROXY_SECRET}}
    origins:
      - name: wordpress
        domain: blog-origin.example.com
        # forwardHost: true
        # forwardCookie: true
        # forwardAuthorization: true
        # timeout: 20
```

The origin settings have defaults that are secure, but you need to know them:

| Property | Default | What I check |
|---|---|---|
| `domain` | required | Also used for TLS SNI and certificate validation. HTTPS on port 443 only |
| `ip` | none | Connect to an IP but still validate the certificate against `domain` |
| `forwardHost` | `false` | Backend receives `Host: <domain>`. Set `true` only if the backend serves several sites by host |
| `forwardCookie` | `false` | **Cookies are removed.** Logged-in or session-based backends need `true` |
| `forwardAuthorization` | `false` | `Authorization` is removed. APIs using bearer tokens from the browser need `true` |
| `timeout` | 60 s | Time to first byte, and between bytes. I set it lower for APIs so failures are fast |
| `skipCache` (rule) | `false` | Responses are cached according to the backend's cache headers. Set `true` for anything personalised |
| `headers` (rule) | none | Extra headers to the backend, such as a shared secret to prove the request came through your CDN |

### Pattern 1: incremental migration to Edge Delivery Services

This is the pattern I use most in 2026. The domain stays on AEMaaCS, and sections move to Edge Delivery Services one at a time. Adobe documents the EDS origin:

```yaml
data:
  originSelectors:
    rules:
      - name: eds-assets-and-sections
        when:
          allOf:
            - { reqProperty: tier, equals: publish }
            - { reqProperty: domain, equals: www.example.com }
            - reqProperty: path
              matches: "^(/scripts/.*|/styles/.*|/fonts/.*|/blocks/.*|/icons/.*|.*/media_.*|/favicon.ico|/campaigns/.*)"
        action:
          type: selectOrigin
          originName: aem-live
    origins:
      - name: aem-live
        domain: main--repo--owner.aem.live
```

Two things make or break it. First, **configure EDS push invalidation in managed mode,** because content published in EDS must purge the Adobe-managed CDN. Without it, authors publish and nothing changes. Second, **be careful with shared paths.** EDS needs `/scripts/`, `/styles/` and `/blocks/`, and so might your AEM site. Keep the AEM clientlibs under `/etc.clientlibs/` and the routing stays clean. My [EDS vs traditional AEMaaCS]({{ '/blog/2026/11/aem-edge-delivery-services-vs-traditional-aemaacs/' | relative_url }}) post covers when this hybrid is worth it.

### Pattern 2: another AEM environment

You **can't** use an `*.adobeaemcloud.com` domain as an origin. Adobe rejects it to prevent request loops. To route `/graphql` from one environment to another, or from an EDS site to AEM publish, install a custom domain on the target environment and use that:

```yaml
data:
  originSelectors:
    rules:
      - name: graphql-to-headless-publish
        when:
          allOf:
            - { reqProperty: domain, equals: www.example.com }
            - { reqProperty: originalPath, like: "/graphql*" }
        action:
          type: selectOrigin
          originName: headless-publish
    origins:
      - name: headless-publish
        domain: aem-publish-origin.example.com
```

### Pattern 3: the AEM static tier

Front-end pipeline output can be served from the same domain or from a dedicated one:

```yaml
data:
  originSelectors:
    rules:
      - name: static-domain
        when: { reqProperty: domain, equals: static.example.com }
        action:
          type: selectAemOrigin
          originName: static
```

### Pattern 4: external apps and SaaS behind your domain

Search, store locators, careers portals and legacy apps all fit here. When the backend needs an API key you don't want in the browser, inject it at the edge from a secret:

```yaml
data:
  originSelectors:
    rules:
      - name: search-api
        when: { reqProperty: originalPath, like: "/api/search*" }
        action:
          type: selectOrigin
          originName: search-saas
          skipCache: true
          headers:
            x-api-key: ${{SEARCH_API_KEY}}
    origins:
      - name: search-saas
        domain: api.search-vendor.example
        timeout: 10
```

### Rewriting the path before proxying

Origin selectors don't rewrite paths themselves, but request transformations run first. To serve `www.example.com/careers/*` from an app that expects `/jobs/*`, rewrite the path and match the selector on `originalPath`:

```yaml
data:
  requestTransformations:
    rules:
      - name: careers-path-for-ats
        when: { reqProperty: originalPath, like: "/careers*" }
        actions:
          - type: transform
            reqProperty: path
            op: replace
            match: ^/careers
            replacement: /jobs
  originSelectors:
    rules:
      - name: careers-to-ats
        when: { reqProperty: originalPath, like: "/careers*" }
        action: { type: selectOrigin, originName: ats }
    origins:
      - name: ats
        domain: careers.ats-vendor.example
```

Check the forwarded path in the backend's access log on a dev environment before you rely on it. And remember that the backend's own links and redirects will still say `/jobs`, so the app usually needs to know its public base path.

### Proxy caveats

- **IP allowlisting at the backend is hard.** CDN egress IPs are shared and can change. Adobe documents the limits. A shared-secret header from `headers` is usually more practical.
- **Caching follows the backend's headers.** A third-party app that sends `Cache-Control: public, max-age=3600` on personalised pages will be cached at the CDN. Use `skipCache: true` unless you trust its headers.
- **Cookies don't cross by default.** That's safe, and it's also the most common reason a proxied login "doesn't work".
- **Each origin is now part of your availability.** Set timeouts, monitor it, and use [custom error pages](#custom-error-pages) for the failure case.

## Redirects at the edge

Server-side redirects at the CDN respond from the nearest POP without touching AEM. They also run **before** the cache lookup, so they work even for URLs that are cached.

```yaml
data:
  redirects:
    rules:
      - name: apex-to-www
        when: { reqProperty: domain, equals: example.com }
        action:
          type: redirect
          status: 301
          location:
            reqProperty: url
            transform:
              - op: replace
                match: '^/(.*)$'
                replacement: 'https://www.example.com/\1'
      - name: retired-campaign
        when: { reqProperty: originalPath, equals: /summer-sale }
        action:
          type: redirect
          status: 302
          location: /offers
      - name: legacy-products-section
        when: { reqProperty: originalPath, matches: "^/en/products-old/(.*)$" }
        action:
          type: redirect
          status: 301
          location:
            reqProperty: originalPath
            transform:
              - op: replace
                match: "^/en/products-old/(.*)$"
                replacement: '/en/products/\1'
```

Supported status codes are 301, 302, 303, 307 and 308. The default is **301**, so set `status: 302` explicitly for anything temporary. A browser caches a 301 aggressively, and a campaign redirect that should have been temporary is very hard to undo.

**Geo-redirects are possible** (Adobe's example builds the target from `clientCountry`), but I rarely recommend them on the home page. Search engine crawlers mostly come from one country and would never see the other markets. A country selector or a suggestion banner is better for SEO and for travellers.

**Where redirects belong:**

| Redirect type | Where I put it |
|---|---|
| Domain consolidation (apex to www, old brand domains) | CDN |
| A few dozen campaign or vanity URLs | CDN |
| Pattern-based section moves | CDN, with one regex rule each |
| Thousands of one-to-one URLs from a migration | Dispatcher `RewriteMap`; the CDN file is capped at 100 KB |
| Author-managed redirects | AEM (a redirect manager component or content-driven map) |

## Protecting environments

### Basic auth for stakeholder review

Putting basic auth on stage, or on a pre-launch campaign path, used to need Dispatcher changes. Now it's configuration:

```yaml
data:
  authentication:
    authenticators:
      - name: reviewers
        type: basic
        credentials:
          - user: agency
            password: ${{REVIEW_PASSWORD_AGENCY}}
          - user: legal
            password: ${{REVIEW_PASSWORD_LEGAL}}
    rules:
      - name: protect-prelaunch
        when: { reqProperty: originalPath, like: "/content/acme/en/launch-2027*" }
        action:
          type: authenticate
          authenticator: reviewers
```

Up to 10 credentials are allowed, each password referencing a secret. Adobe describes this as for light use cases, and I agree: it's for reviews, not for member areas.

### Traffic filters and WAF

Traffic filter rules (including WAF) run straight after request transformations. My [Cloud Manager pipelines post]({{ '/blog/2026/11/aem-cloud-manager-pipelines-quality-gates-rde-config-pipeline/' | relative_url }}#a-sample-cdnyaml) has a starter set. The essentials:

- **Rate limits are per POP,** between 10 and 10,000 requests per second, over a 1, 10 or 60 second window. Start in `log` mode with `alert: true`, review CDN logs, then switch to `block`.
- **WAF flags need the Extended Security licence** *and* WAF enabled on the Cloud Manager Security tab. `ATTACK-FROM-BAD-IP` can go straight to block; `ATTACK` should start in log mode.
- **Allow rules take precedence over conflicting block rules,** and the Cloud Manager IP allowlist overrides traffic filters.
- **Match security rules on `originalPath`** where it matters, so a request transformation can't accidentally move a request out of a protected pattern.

## Keys and pages for the rest of the estate

### Your own CDN in front: the edge key

If a customer-managed CDN (Akamai, Cloudflare, CloudFront) sits in front of AEMaaCS, configure an **edge key** so publish only accepts traffic that came through it. The outer CDN sends `X-AEM-Edge-Key` and `X-Forwarded-Host`:

```yaml
data:
  authentication:
    authenticators:
      - name: byo-cdn
        type: edge
        edgeKey1: ${{EDGE_KEY_2026_11}}
        # edgeKey2: ${{EDGE_KEY_2027_05}}   # add during rotation
    rules:
      - name: require-edge-key
        when: { reqProperty: tier, equals: publish }
        action:
          type: authenticate
          authenticator: byo-cdn
```

Generate keys with `openssl rand -hex 32`, put the date in the secret name, and rotate with the two-slot pattern: add the new key as `edgeKey2`, move the outer CDN to it, then remove `edgeKey1`. When migrating from an Adobe-generated key, keep both configured during the switch, or you risk downtime.

### Purge key

The same pattern configures a purge key, so your release tooling can purge the CDN cache by URL, by surrogate key, or entirely:

```bash
curl -X PURGE "https://publish-p1234-e5678.adobeaemcloud.com/content/acme/en/pricing.html" \
  -H "X-AEM-Purge-Key: $PURGE_KEY" \
  -H "X-AEM-Purge: soft"
```

I prefer **soft purges** (content marked stale and revalidated) to `X-AEM-Purge: all`. A full purge sends every request in the next few minutes to Dispatcher, and the busiest moment of a release is the worst time to do that.

### Custom error pages

When the CDN can't reach the origin, visitors see Adobe's default error page unless you configure your own:

```yaml
data:
  errorPages:
    spa:
      title: "We'll be right back"
      icoUrl: https://assets.example.com/error/favicon.ico
      cssUrl: https://assets.example.com/error/error.css
      jsUrl: https://assets.example.com/error/error.js
```

The assets must be hosted **outside** AEM (S3, Azure Blob or similar), because AEM is the thing that's down. Test it with `https://publish-pXXXX-eYYYY.adobeaemcloud.com/cdnstatus?code=503`.

## Caching traps to avoid

These are the mistakes I see most often in reviews. Every one of them follows from the evaluation order.

| Trap | What happens | Fix |
|---|---|---|
| Setting `cache-control` in a response transformation to change CDN caching | The browser sees the new header; the CDN keeps caching by the origin's header | Set `Cache-Control` or `Surrogate-Control` in Dispatcher. Use the CDN only to change what browsers see |
| Adding `x-client-country` (or a device or segment header) and varying the page on it in AEM | First visitor's version is cached for everyone, because headers aren't in the cache key | Vary the URL (path or a query parameter the CDN sets), or `skipCache` the route, or personalise client-side |
| Proxying a third-party app without checking its cache headers | Logged-in pages cached and served to other users | `skipCache: true`, `forwardCookie` only where needed, and test with two accounts |
| Removing a query parameter a component needs | Pagination or search silently stops working | Keep an explicit allowlist, and review it when components change |
| A redirect rule matching on `path` after a rewrite | Redirect stops firing when someone changes the rewrite | Match redirects and routes on `originalPath` |
| Defaulting to 301 for temporary redirects | Browsers cache the redirect long after the campaign ends | Set `status: 302` explicitly |

## How I run cdn.yaml on projects

**Structure.** One file per concern is easier to review than one huge file: `config/cdn.yaml` for traffic rules and `config/cdn-auth.yaml` for authentication, both `kind: "CDN"`. Rule names describe intent (`apex-to-www`, not `rule-7`), and comments explain *why*, because the YAML only says *what*. Keep an eye on the 100 KB limit across the whole configuration.

**Environments.** Use `metadata.envTypes` to scope files, for example basic auth on `dev` and `stage` only. Each environment has its own config pipeline. Test on an RDE first by adding `"rde"` to `envTypes` and running `aio aem:rde:install -t env-config`.

**Testing.** Before a rule ships to production, I check four things on dev or stage:

```bash
# Did the redirect fire, with the right status?
curl -sI https://dev.example.com/summer-sale | grep -iE "^(HTTP|location)"

# Are the security headers on a cache hit as well as a miss?
curl -sI https://dev.example.com/ | grep -iE "strict-transport|x-content-type|x-cache"

# Is the proxied path served by the right backend?
curl -sI https://dev.example.com/blog/ | grep -iE "^(server|x-powered-by|via)"

# Does an unlisted CORS origin get no header?
curl -sI -H "Origin: https://evil.example" https://dev.example.com/graphql/execute.json/site/q
```

Then I check the CDN logs (up to five minutes behind) for the `rules` field and any `logProperty` values.

**Change and rollback.** CDN config deploys in minutes and there's no rollback button. A rollback is a revert commit and another config pipeline run. That's fast, but someone has to be ready to do it. Treat production CDN changes like code: a pull request, a reviewer, and a deployment window for anything that touches routing or authentication.

**Secrets.** Use pipeline secret variables where you can. Never edit a secret's value in place. Create a new secret with a new name, reference it, deploy, then remove the old one. Secrets aren't interpolated inside strings, so `"Bearer ${{TOKEN}}"` won't work. Store the whole header value as the secret.

## Decision guide

| You want to… | Use | Notes |
|---|---|---|
| Add security headers everywhere | Response transformations | Applies to cache hits too |
| Set CDN cache TTLs | Dispatcher headers | `Cache-Control` / `Surrogate-Control` at the origin |
| Redirect a domain or a few dozen URLs | `redirects` | Explicit 302 for temporary |
| Redirect thousands of migrated URLs | Dispatcher `RewriteMap` | 100 KB limit on CDN config |
| Serve `/blog` from WordPress on the same domain | `originSelectors` | Check cookies, cache headers, timeouts |
| Migrate sections to EDS one at a time | `originSelectors` to `aem.live` | Push invalidation in managed mode |
| Hide an API key from the browser | Origin selector `headers` with a secret | Also `skipCache` for per-user responses |
| Protect stage from the public | `authentication` basic, or an IP allowlist | Basic auth is for reviews, not members |
| Run your own CDN in front | Edge key | Rotate with two key slots |
| Purge from CI/CD | Purge key | Prefer soft purges |
| Block abusive traffic | Traffic filters, rate limits, WAF | Log first, then block |
| Logic that needs content or sessions | AEM, or Edge Functions where available | `cdn.yaml` is declarative by design |

## FAQ

**Is cdn.yaml available on every AEMaaCS environment?**
The CDN config kind is supported on AEMaaCS publish delivery, and most features also work through the Edge Delivery config pipeline. Custom error pages, purge keys and customer-managed CDN keys apply to publish delivery only. Check the [config pipeline documentation](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/operations/config-pipeline) for the current matrix.

**Does it replace Dispatcher?**
No. It replaces the *request-only* parts of Dispatcher: headers, simple rewrites and redirects, and access rules. Caching rules, TTLs, large rewrite maps and filters on AEM paths stay in Dispatcher.

**Can I write VCL or custom code?**
Not in `cdn.yaml`; it's declarative. For logic it can't express, Adobe has introduced Edge Functions as a separate config kind. Check its availability for your program, and treat it as a last resort, because declarative rules are easier to review and harder to break.

**How fast do changes go live?**
A config pipeline run usually takes a few minutes. That speed is the benefit and the risk: review rules before they ship.

**Do request transformations change what's in the browser's address bar?**
No. They change what the CDN and origin see. Use `redirects` when the visitor should see a new URL.

**What happens if two rules match?**
Don't design for it. Adobe's documentation covers precedence for traffic filters (allow beats block), but for transformations, redirects and origin selectors I make conditions mutually exclusive and test the overlaps on dev. A config that depends on rule order is a config the next developer will break.

## Closing thought

The AEMaaCS CDN was a black box for years. With `cdn.yaml` it's a programmable layer you can version, review and deploy in minutes. Used well, it simplifies architecture: no extra CDN for a proxied blog, no web tier deployment for a header, no origin load from cache-busting parameters, and a clean path to move sections to Edge Delivery Services.

The rules for using it well fit in one sentence. **Know the evaluation order, keep caching decisions at the origin, match on `originalPath`, never put secrets in YAML, and test every change on dev before it reaches production.**

If you're planning a hybrid AEM and EDS rollout, removing a customer-managed CDN, or tidying up a Dispatcher full of rules that belong at the edge, [get in touch](/contact/).

### References

- [Configuring traffic at the CDN](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/content-delivery/cdn-configuring-traffic) (Adobe Experience League)
- [Traffic filter rules including WAF rules](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/security/traffic-filter-rules-including-waf) (Adobe Experience League)
- [Configuring CDN credentials and authentication](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/content-delivery/cdn-credentials-authentication) (Adobe Experience League)
- [Configuring CDN error pages](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/content-delivery/cdn-error-pages) (Adobe Experience League)
- [Caching in AEM as a Cloud Service](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/content-delivery/caching) (Adobe Experience League)
- [Purging the CDN cache](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/content-delivery/cdn-cache-purge) (Adobe Experience League)
- [Config pipeline](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/operations/config-pipeline) (Adobe Experience League)
- [Fastly Fiddle](https://fiddle.fastly.dev/) (Fastly)

---
layout: post
title: "Dispatcher on AEM as a Cloud Service: caching rules, invalidation and the mistakes that cost you"
seo_title: "AEMaaCS Dispatcher: Caching, TTLs, Invalidation and Mistakes"
description: "A senior architect's guide to Dispatcher on AEM as a Cloud Service: cache rules, CDN and browser TTLs, statfileslevel and invalidation, query parameters, filters, redirects and testing."
ai_summary: "On AEM as a Cloud Service, Dispatcher sits between the Adobe-managed CDN and AEM publish. It caches files on disk and sets the Cache-Control and Surrogate-Control headers that decide how long the CDN and browsers keep content. Publishing flushes Dispatcher, scoped by statfileslevel, but does not purge the CDN, so freshness is a TTL design problem: short HTML TTLs with stale-while-revalidate, long immutable caching for versioned clientlibs and images, and private for personalised content. The post covers flexible mode and immutable files, cache rules, ignoreUrlParams, filters, managed rewrite maps for redirects, explicit invalidation with Sling Content Distribution, local testing with the Dispatcher SDK, the web tier pipeline, and the common mistakes."
date: 2026-11-08 10:00:00 +0530
category: aem-cloud-service
tags: [AEM as a Cloud Service, Dispatcher, Caching, CDN, Performance, Cloud Manager]
---

"We published the change an hour ago and the site still shows the old page." Every AEM team has had that conversation. On AEM as a Cloud Service the answer is almost never "Dispatcher is broken". It's usually one of three things:
- a cache layer nobody thought about, typically the CDN
- a TTL nobody chose deliberately
- an invalidation rule that does exactly what it says

Dispatcher on AEM as a Cloud Service (AEMaaCS) looks like the Dispatcher you knew on AEM 6.5 or Managed Services, but the rules around it are different:
- Part of the configuration is **immutable**.
- There's a **CDN you don't configure in Apache**.
- Invalidation happens **per publish instance**.
- Deployments go through Cloud Manager, ideally the **web tier pipeline**.

This post is the architect's guide to getting it right: where Dispatcher sits, how caching and invalidation really work, and the configuration I use on projects. It ends with the mistakes I see most often in reviews.

It's a companion to my post on [configuring the AEMaaCS CDN with cdn.yaml]({{ '/blog/2026/11/aem-cloud-service-cdn-yaml-headers-proxy-redirects/' | relative_url }}). That post covers what happens at the edge; this one covers the layer that tells the edge what to do.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **Three caches sit in front of AEM publish:** the browser, the Adobe-managed CDN and Dispatcher. **Publishing clears Dispatcher only.** The CDN and the browser keep their copy until their TTL ends.
- **Dispatcher sets the headers the CDN obeys.** `Surrogate-Control` controls the Adobe CDN, `Cache-Control` the browser (and the CDN, if there's no surrogate header). HTML defaults to five minutes.
- **Use flexible mode** (`opt-in/USE_SOURCES_DIRECTLY`). Edit `rules.any`, `filters.any`, `virtualhosts.any`, your own vhost and farm files. Never edit the immutable `default_*` files, because Cloud Manager ignores your changes to them.
- **`statfileslevel` decides how much HTML one publish makes stale.** The archetype default of `2` invalidates a whole site's HTML when any page in it is published. For `/content/<site>/<language>` structures, `3` is usually better.
- **Explicit invalidation is rarely needed.** When it is (Experience Fragments or Content Fragments referenced across pages), Adobe recommends the Sling Content Distribution (SCD) `INVALIDATE` action from author.
- **Ignore query parameters you don't use** with `ignoreUrlParams`, or every `?v=123` becomes a cache miss.
- **Thousands of redirects** belong in a managed rewrite map (pipeline-free redirects), not in `cdn.yaml` or hand-written `RewriteRule`s.
- **Test locally** with the Dispatcher SDK (`validate.sh`, `docker_run_hot_reload.sh`), and deploy with a **web tier config pipeline**, which deploys in minutes.

## Where Dispatcher sits

![Three caches in front of AEM publish: browser, Adobe CDN and Dispatcher, and what happens to each when an author publishes]({{ '/assets/img/blog/aem-dispatcher/01-cache-layers.svg' | relative_url }}){: width="1200" height="640" loading="lazy" decoding="async"}

A request to an AEMaaCS publish site goes **browser → Adobe CDN (Fastly) → Apache with the Dispatcher module → AEM publish**. Each layer can answer from its own cache:

| Layer | What it caches | What controls how long |
|---|---|---|
| **Browser** | Responses for one visitor | `Cache-Control` (and `Expires`) |
| **Adobe CDN** | Responses for everyone at that point of presence | `Surrogate-Control`, else `Cache-Control` or `Expires`, from the origin |
| **Dispatcher** | Files on disk on each publish instance | Cache rules, `.stat` invalidation and, with `enableTTL`, the response's own expiry headers |

Adobe's [caching documentation](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/content-delivery/caching) makes two points that shape everything else:

1. **CDN caching is controlled by the origin's response headers,** "typically set in AEM Dispatcher vhost configurations using mod_headers". So Dispatcher configuration is CDN configuration.
2. **The CDN won't cache responses that are `private`, `no-cache` or `no-store`, or that set a cookie** (`Set-Cookie`). A component that sets a cookie on every page quietly turns the CDN off for that page.

On AEMaaCS, each publish instance has its own Dispatcher, and when a publish instance receives new content it flushes its own Dispatcher. Nothing flushes the CDN when you publish. If HTML is cached at the CDN for an hour, an author can wait up to an hour to see a change. **Freshness is a TTL design decision, not an invalidation feature.**

## The configuration model: flexible mode and immutable files

### Flexible mode

AEMaaCS Dispatcher configuration comes in two layouts:
- **Legacy mode**, with a single `rewrite.rules` file and other structural limits.
- **Flexible mode**, which Adobe calls "the recommended mode". It's the default for AEM archetype 28 and later.

You opt in with an empty marker file at `opt-in/USE_SOURCES_DIRECTLY`. If you're still on legacy mode, migrate. The web tier config pipeline requires flexible mode, and so do features like managed rewrite maps.

### What you can and can't change

The Dispatcher SDK ships some files you edit and some that are **immutable**. Adobe's [validation guide](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/content-delivery/validation-debug) is blunt about the immutable ones: changing them locally "has no impact on your deployment, because they do not get transferred to your Cloud instance". The latest versions are always used in the cloud.

| You edit | Immutable (reference, don't change) |
|---|---|
| `conf.d/available_vhosts/<your>.vhost` (enabled through a symlink in `enabled_vhosts`) | `conf.d/available_vhosts/default.vhost` |
| `conf.d/rewrites/rewrite.rules` and any extra rewrite files | `conf.d/rewrites/default_rewrite.rules` |
| `conf.d/variables/custom.vars`, `global.vars` | |
| `conf.dispatcher.d/available_farms/<your>.farm` | `conf.dispatcher.d/available_farms/default.farm` |
| `conf.dispatcher.d/cache/rules.any` | `conf.dispatcher.d/cache/default_rules.any`, `default_invalidate.any` |
| `conf.dispatcher.d/filters/filters.any` | `conf.dispatcher.d/filters/default_filters.any` |
| `conf.dispatcher.d/virtualhosts/virtualhosts.any` | `conf.dispatcher.d/virtualhosts/default_virtualhosts.any` |
| `conf.dispatcher.d/clientheaders/clientheaders.any` | `conf.dispatcher.d/clientheaders/default_clientheaders.any` |

The pattern is the same everywhere: **include the default file, then add your own rules after it.** The archetype's `filters.any` is a good example:

```text
# conf.dispatcher.d/filters/filters.any
$include "./default_filters.any"

# Allow the components JSON model for SPA and headless consumers
/0101 { /type "allow" /extension "json" /selectors "model" /path "/content/*" }
```

To change farm settings such as `statfileslevel` or `ignoreUrlParams`, copy `default.farm` to your own farm file, edit the copy, and point the symlink in `enabled_farms` at it. The default farm's own comments say exactly that.

### One configuration, every environment

The same Dispatcher configuration is deployed to development, stage and production. Where they must differ, for example host names, use the `ENVIRONMENT_TYPE` variable, or the `ENVIRONMENT_DEV`, `ENVIRONMENT_STAGE` and `ENVIRONMENT_PROD` defines that the runtime provides:

```apache
<IfDefine ENVIRONMENT_PROD>
  Define SITE_HOST www.example.com
</IfDefine>
<IfDefine ENVIRONMENT_STAGE>
  Define SITE_HOST stage.example.com
</IfDefine>
```

Cloud Manager environment variables can also be read in Apache configuration. That's the right place for anything that differs per environment and isn't a secret.

## Cache rules: what Dispatcher stores

Dispatcher only caches a response when all of these are true. They're listed in the default farm's own comments:

- It's a **GET** request.
- The URL has an **extension** (`/page.html`, not `/page`).
- There's **no query string**, unless every parameter is ignored through `ignoreUrlParams` (see [query parameters](#query-parameters-and-ignoreurlparams)).
- The request is **unauthenticated**, unless `allowAuthorized` is enabled.
- The path is **allowed by `/rules`**.

The archetype's default rules allow everything (`/glob "*"`), then deny a few paths that must never be cached, such as the CSRF token. Add your own denials in `rules.any`, after the include:

```text
# conf.dispatcher.d/cache/rules.any
$include "./default_rules.any"

# Personalised or per-user endpoints must never be cached
/0100 { /glob "/content/*/account/*" /type "deny" }
/0101 { /glob "*.user.json" /type "deny" }
```

The farm's `/headers` section lists the response headers Dispatcher stores next to a cached file and replays on later hits. The archetype stores `Cache-Control`, `Content-Disposition`, `Content-Type`, `Expires`, `Last-Modified` and `X-Content-Type-Options`. If a component relies on another header surviving a cache hit, `Content-Security-Policy` for example, add it here. Otherwise it disappears from the second request onwards.

## TTLs and headers: telling the CDN and browser what to do

### The defaults

Adobe's caching documentation sets out what you get without changing anything:

| Content | Default behaviour |
|---|---|
| **HTML and text** | Cached by the browser for **five minutes**, from a `Cache-Control` header set at the Apache layer. The CDN respects the same value. Change it for all HTML with `EXPIRATION_TIME` in `global.vars`, or switch it off with `Define DISABLE_DEFAULT_CACHING`. |
| **Client libraries** | Versioned URLs, cached as `immutable` (or 30 days for browsers that ignore `immutable`). |
| **Blob content** (larger files from the DAM, typically over 16 KB, served by redirect from blob storage) | For programs created after mid-May 2022 (program ID above 65000): `public, max-age=600, immutable` for anonymous requests, `private` for authenticated ones. Older programs don't cache blobs by default; `AEM_BLOB_ENABLE_CACHING_HEADERS` switches behaviour. |
| **Other files in the node store** | No default caching. Set it yourself. |

### Separate the CDN from the browser

The most useful header on AEMaaCS is `Surrogate-Control`. The Adobe CDN obeys it, browsers ignore it. That lets you keep HTML short in the browser, so a returning visitor sees updates, and longer at the CDN, where serving stale content in the background is cheap.

Adobe's own recommendations lean on `stale-while-revalidate`: the CDN serves the cached copy instantly while fetching a fresh one in the background. A starting point I use, adapted from Adobe's examples:

```apache
# conf.d/available_vhosts/mysite.vhost (inside <VirtualHost>)
<IfModule mod_headers.c>
  # HTML: 5 minutes in the browser, refresh in the background for an hour
  <LocationMatch "^/content/mysite/.*\.html$">
    Header unset Cache-Control
    Header unset Expires
    Header always set Cache-Control "max-age=300,stale-while-revalidate=3600" "expr=%{REQUEST_STATUS} < 400"
    Header always set Surrogate-Control "max-age=300,stale-while-revalidate=43200" "expr=%{REQUEST_STATUS} < 400"
    Header set Age 0
  </LocationMatch>

  # Versioned clientlibs and Core Components image URLs: long and immutable
  <LocationMatch "^/etc\.clientlibs/.*\.(?:js|css|woff2?)$">
    Header set Cache-Control "max-age=2592000,stale-while-revalidate=43200,stale-if-error=43200,public,immutable" "expr=%{REQUEST_STATUS} < 400"
  </LocationMatch>

  # Mutable DAM images: one day, refresh in the background
  <LocationMatch "^/content/dam/.*\.(?:jpe?g|png|gif|webp|avif|svg)$">
    Header set Cache-Control "max-age=86400,stale-while-revalidate=43200,stale-if-error=43200" "expr=%{REQUEST_STATUS} < 400"
  </LocationMatch>
</IfModule>
```

Some notes on this configuration:

- **`Header always set` matters.** Adobe notes that AEMaaCS removes cache headers it applies to responses it considers uncacheable by Dispatcher. Use `always` when you need the header to stick, and only on paths you know are public.
- **`expr=%{REQUEST_STATUS} < 400`** stops you caching errors for an hour. A 404 cached for 12 hours after a page is created is a support ticket you don't want.
- **Scope the regex tightly.** A broad `LocationMatch` that adds `public` caching to everything under `/content` will eventually match a page that should have been private. That is the most dangerous caching mistake on AEM.
- **The values are a starting point,** not a rule. News sites shorten HTML TTLs; brochure sites can lengthen them.

### Keep private content private

For anything personalised or behind login, send `private` and make sure Dispatcher doesn't cache it either:

```apache
<LocationMatch "^/content/mysite/.*/account/.*\.html$">
  Header unset Cache-Control
  Header unset Expires
  Header always set Cache-Control "private"
</LocationMatch>
```

`private` stops the CDN caching it, but Dispatcher has its own rules. Adobe's documentation reminds you to also deny it in `/rules`, or use permission-sensitive caching, if it truly must never be shared.

### Remove `Vary: User-Agent`

Older Dispatcher setups (before archetype 28) appended `Vary: User-Agent`, which fragments the CDN cache into one copy per browser version. Adobe recommends removing it from your vhost files.

## Invalidation: how publishing clears the cache

### What happens on publish

When a publish instance receives a new version of a page or asset, it flushes its own Dispatcher. Adobe's documentation explains that "the updated path is removed from the Dispatcher cache, together with its parents, up to a level" set by `statfileslevel`. You don't configure a flush agent from author to Dispatcher as you did on AEM 6.5. The platform wires it up.

There's one requirement that catches teams out. Invalidation requests arrive from `localhost`, `127.0.0.1`, `*.local`, `*.adobeaemcloud.com` and `*.adobeaemcloud.net`. **A vhost must match those host names.** If you replace the catch-all `ServerAlias "*"` with only your public domains, invalidation silently stops working. Keep a catch-all vhost, as the archetype does.

### statfileslevel

![How statfileslevel scopes invalidation: level 2 makes every language stale, level 3 only the published language]({{ '/assets/img/blog/aem-dispatcher/02-statfileslevel.svg' | relative_url }}){: width="1200" height="560" loading="lazy" decoding="async"}

Dispatcher doesn't delete every related file when content changes. It writes `.stat` files down the directory tree, as deep as `statfileslevel`, and touches the nearest one above the published path. Any cached file matching `/invalidate` that is older than the `.stat` file in its branch is treated as stale and re-fetched on the next request.

The archetype farm sets `/statfileslevel "2"`, which means `.stat` files at the docroot, `/content` and `/content/<site>`. Publishing `/content/site/en/products/page` touches `/content/site/.stat`. **Every HTML file in every language of that site** goes stale.

That's safe, because navigation, footers and related-content lists that appear on other pages are refreshed too. On a site with 20 languages and thousands of pages, though, every publish triggers a burst of re-rendering. My rule of thumb:

| Content structure | `statfileslevel` |
|---|---|
| `/content/<site>/…`, a single language | `2` |
| `/content/<site>/<language>/…` | `3` |
| `/content/<site>/<country>/<language>/…` | `4` |

Raise it only as far as the boundary where content is truly independent. If the English home page shows the latest German articles, they aren't independent.

### `/invalidate` and `gracePeriod`

Only files matching the farm's `/invalidate` globs are made stale by `.stat` files. The archetype allows `*.html` and excludes AEM Forms HTML. JSON, images and other files are removed only when their own path is published, or expire by TTL. If you serve a `model.json` that aggregates content from several pages, add it to `/invalidate`, or give it a short TTL.

The archetype also sets `/gracePeriod "2"`, a two-second window so a burst of publishes doesn't cause repeated re-rendering, and `/serveStaleOnError "1"`, so visitors get the last good copy if publish is unavailable.

### Explicit invalidation

Adobe's position is that you rarely need to invalidate by hand: "rely on the Dispatcher refreshing its cache when content is being republished and the CDN respecting cache expiration headers". The exception is content that is referenced, not rendered in place: Experience Fragments, Content Fragments or shared data used on many pages.

Adobe documents two approaches:

| Approach | Runs on | Guarantee | Use it when |
|---|---|---|---|
| **Sling Content Distribution `INVALIDATE`** (recommended) | Author | At least once; you can listen for completion | After publishing a fragment, invalidate the pages that reference it |
| **Replication API** (flush agent) | Publish | Best effort | The trigger comes from the publish tier |

```java
// Author: invalidate pages that reference a just-published Experience Fragment
DistributionRequest request = new SimpleDistributionRequest(
    DistributionRequestType.INVALIDATE, false, "/content/mysite/en/home");
distributor.distribute("publish", resolver, request);
```

Remember the CDN. Invalidating Dispatcher doesn't purge the CDN. For emergencies, such as a legal takedown or a wrong price, use the CDN purge API with a purge key. I cover that in the [cdn.yaml post]({{ '/blog/2026/11/aem-cloud-service-cdn-yaml-headers-proxy-redirects/' | relative_url }}#purge-key). For day-to-day publishing, a five-minute HTML TTL is simpler and more reliable than any purge workflow.

## Query parameters and ignoreUrlParams

By default, a request with any query string isn't cached. That's correct for search results and dangerous for everything else. `?utm_source=newsletter` or a cache-busting `?v=1234` sends every request through to publish.

The farm's `ignoreUrlParams` section lists parameters that don't change the response, so Dispatcher can cache and serve the page as if they weren't there. The archetype's own comment recommends the allowlist approach, which is to ignore everything and name the parameters that matter:

```text
# In your farm's /cache section
/ignoreUrlParams {
  /0001 { /glob "*" /type "allow" }     # ignore all parameters…
  /0002 { /glob "page" /type "deny" }   # …except these, which change the response
  /0003 { /glob "q" /type "deny" }
}
```

The confusing part is that `allow` means "allowed to be ignored". The alternative is to deny everything and allow only the marketing parameters, using the archetype's `marketing_query_parameters.any` (UTM, `gclid`, `fbclid` and others). That's safer if you don't know which parameters your components read.

At the CDN, environments created from October 2023 strip common marketing parameters before the cache lookup (`removeMarketingParams`). Adobe still recommends configuring `ignoreUrlParams` in Dispatcher too, in case that's switched off or your parameters aren't on its list.

## Filters and security

The farm's `/filter` section decides which requests reach publish at all. The defaults deny everything, then allow what a standard site needs. In your `filters.any`, include the defaults and add narrowly scoped allows: extension, selectors and path together, never a broad `/url "/content/*"`.

The requests I always check are blocked in review:

- **Query Builder, `/bin/` servlets and `/system/`**, unless a specific, authenticated use case needs them.
- **JSON renderings of content** (`.infinity.json`, `.tidy.json`, `.-1.json`), which expose the content tree.
- **Selector games** such as `page.html/foo.css` or `page.json.html`, which can poison the cache or leak data. Allow by explicit selector and extension.
- **`/libs/` and `/apps/`**, except the specific client-side paths your site uses.

Run a negative test list after every filter change. The SDK makes that easy (see [testing locally](#testing-locally-with-the-dispatcher-sdk)).

## Redirects and vanity URLs

There are now three places to put a redirect on AEMaaCS, and choosing the right one saves pain:

| Redirects | Put them in | Why |
|---|---|---|
| Domain consolidation, a few dozen campaign URLs | **CDN** (`cdn.yaml`) | Answered at the edge, deployed in minutes |
| Pattern rules (`/old-section/(.*)` → `/new-section/$1`) | **Dispatcher rewrite rules** | Regex power, versioned with code |
| Hundreds to tens of thousands of one-to-one redirects, maintained by business users | **Managed rewrite map** (pipeline-free redirects) | No deployment per change |

[Pipeline-free URL redirects](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/content-delivery/pipeline-free-url-redirects) let Apache load a rewrite map file published from AEM, for example a text file in the DAM or one managed with ACS Commons Redirect Map Manager. Apache reloads it every 300 seconds by default. You declare it once in `opt-in/managed-rewrite-maps.yaml`:

```yaml
maps:
- name: redirects.map
  path: /content/dam/mysite/redirects/redirectmap.txt
```

…and reference it in your rewrite rules:

```apache
RewriteMap redirects dbm=sdbm:/tmp/rewrites/redirects.map
RewriteCond ${redirects:$1} !=""
RewriteRule ^(.*)$ ${redirects:$1|/} [L,R=301]
```

Three details from the documentation are worth knowing:
- It needs AEM release 18311 or later.
- Single entries are limited to 1,024 characters.
- By default Apache starts without waiting for the full map to load. Add `wait: true` if a few seconds of missing redirects after a restart would matter.

**Vanity URLs** set by authors in page properties still work through Sling. If you want Dispatcher to let them through its filters automatically, the default farm includes a commented `/vanity_urls` block for that. Check it on a development environment before relying on it, because vanity URLs are a common source of filter surprises.

## Client libraries and version consistency

AEMaaCS enables **strict clientlib versioning** by default. Clientlib URLs carry a long-term hash selector (`lc-<hash>-lc`), so they can be cached as `immutable` and a deployment simply produces new URLs.

There's an edge case after a deployment: cached HTML at the CDN or in a browser can still reference long-cache URLs that no longer exist. AEMaaCS handles this by redirecting to a short-cache URL (`sc-` selector) that resolves to the current version. Adobe is explicit that those short-cache responses use `max-age=60`. **Don't add rules that cache them for longer or treat them as immutable**, or you can strand visitors on old JavaScript.

## Testing locally with the Dispatcher SDK

The Dispatcher tools in the AEMaaCS SDK are the single best way to avoid failed pipelines. Use them on every change:

```bash
# Validate: syntax, allowed directives, immutable files unchanged
./bin/validate.sh src/dispatcher

# Run Dispatcher in Docker against a local publish on port 4503
./bin/docker_run.sh src/dispatcher host.docker.internal:4503 8080

# Better: watch for changes, revalidate and reload automatically
./bin/docker_run_hot_reload.sh src/dispatcher host.docker.internal:4503 8080

# Debug logging for a session
DISP_LOG_LEVEL=Debug ./bin/docker_run.sh src/dispatcher host.docker.internal:4503 8080
```

`validate.sh` runs three phases. First the Cloud Manager validator checks that you only use allowed directives and the required includes. Then `httpd -t` checks the Apache syntax. Last, a check confirms you haven't modified any immutable files. If phase 3 fails after an SDK upgrade, run `bin/update_maven.sh src/dispatcher` to bring your copies up to date.

Then test behaviour, not just syntax:

```bash
# Is the page cached by Dispatcher, and with which headers?
curl -sI http://localhost:8080/content/mysite/en.html | grep -iE "cache-control|surrogate|age|x-vhost"

# Do blocked paths stay blocked?
for p in /bin/querybuilder.json "/content/mysite.infinity.json" /system/console; do
  printf "%s %s\n" "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:8080$p")" "$p"
done
```

On a cloud environment, check what the CDN actually does. The `x-cache` header shows HIT or MISS, and CDN logs (forwarded to your log tool, or downloaded from Cloud Manager) show cache status per request.

## Deploying: the web tier config pipeline

Dispatcher changes shouldn't wait for a full Java build. A **web tier config pipeline** deploys only the HTTPD and Dispatcher configuration, "in minutes", in Adobe's words. Once one exists for an environment, the full-stack pipeline ignores the Dispatcher folder, so the two never fight. It requires flexible mode, and there's one per environment.

I set one up on every project from the first sprint. It turns "can we change a cache header?" from a half-day deployment into a ten-minute task. That's the difference between tuning caching properly and leaving the defaults forever. My [Cloud Manager pipelines post]({{ '/blog/2026/11/aem-cloud-manager-pipelines-quality-gates-rde-config-pipeline/' | relative_url }}) covers how it fits with the other pipelines.

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| Expecting publish to clear the CDN | Authors see old pages for as long as the CDN TTL | Short HTML TTL with `stale-while-revalidate`; purge only for emergencies |
| Editing `default_*` or `default.vhost` files | Works locally, does nothing in the cloud | Change `rules.any`, `filters.any` and your own vhost and farm copies |
| Replacing `ServerAlias "*"` with public domains only | Invalidation requests match no vhost; cache never clears | Keep a catch-all vhost for `localhost` and `*.adobeaemcloud.*` |
| Broad `LocationMatch` with public caching | A personalised or logged-in page is cached and shown to others | Tight regexes; `private` and a `/rules` deny for per-user paths |
| A component sets a cookie on every page | CDN never caches HTML; origin load climbs | Set cookies client-side or only where needed |
| Caching error responses | A 404 stays cached after the page is created | `expr=%{REQUEST_STATUS} < 400` on every cache header |
| No `ignoreUrlParams` | Every tracking or cache-busting parameter is a miss | Allowlist the parameters that matter, ignore the rest |
| `statfileslevel` too low on a big multi-language site | Each publish re-renders every language | Match it to `/content/<site>/<language>` |
| Shared JSON or fragments not invalidated | Pages show old fragment content | Add to `/invalidate`, short TTL, or SCD `INVALIDATE` |
| `Vary: User-Agent` left in | CDN cache split per browser; low hit ratio | Remove it from your vhost files |
| Thousands of redirects in `cdn.yaml` or rewrite rules | 100 KB limit, slow deployments, business can't maintain them | Managed rewrite map |
| No local validation | Failed pipelines and slow feedback | `validate.sh` and hot reload before every commit |

## Checklist

- Flexible mode enabled (`opt-in/USE_SOURCES_DIRECTLY`)
- Own vhost and farm files; no edits to immutable `default_*` files
- Catch-all vhost still matches `localhost` and `*.adobeaemcloud.*` for invalidation
- HTML TTLs chosen deliberately: browser `Cache-Control`, CDN `Surrogate-Control`, `stale-while-revalidate`
- Clientlibs and versioned image URLs cached long and `immutable`; short-cache clientlibs left alone
- Personalised and logged-in paths are `private` and denied in `/rules`
- No cookies set on cacheable public pages
- Errors not cached (`REQUEST_STATUS < 400`)
- `statfileslevel` matches the content structure
- Shared JSON and fragments covered by `/invalidate`, TTL or SCD invalidation
- `ignoreUrlParams` configured; marketing parameters ignored
- Filters reviewed against a negative test list
- Redirects in the right layer; large maps in a managed rewrite map
- `Vary: User-Agent` removed
- Web tier config pipeline set up; `validate.sh` in the developer workflow
{: .checklist}

## FAQ

**Can I use the same Dispatcher configuration as on AEM 6.5 or Managed Services?**
Not as is. AEMaaCS has immutable files, a restricted set of Apache modules and directives, and a fixed folder structure. Adobe provides a migration guide from AMS, and the SDK validator tells you exactly what isn't allowed.

**How do I make published changes appear faster?**
Lower the HTML TTL at the CDN and in the browser, and use `stale-while-revalidate` so visitors still get fast responses. Don't build a purge-on-publish workflow unless you have a real requirement for immediate consistency.

**Should I disable Dispatcher caching for HTML and rely on the CDN?**
No. Dispatcher protects publish when the CDN misses, which happens at every point of presence and after every TTL expiry. Keep both.

**Do I need flush agents?**
Not for normal publishing. Each publish instance invalidates its own Dispatcher. Use the Sling Content Distribution `INVALIDATE` action from author for referenced content that needs explicit invalidation.

**Can I have different Dispatcher configuration per environment?**
One configuration is deployed everywhere. Branch inside it with `ENVIRONMENT_TYPE` or the `ENVIRONMENT_*` defines, and Cloud Manager environment variables.

**Where should I set security headers?**
Headers that are the same on every response are simplest at the CDN with `cdn.yaml` response transformations. Headers that vary by site, path or template, such as a Content Security Policy, are often easier in the vhost. Either way, make sure they survive cache hits: add them to the farm's `/headers` list if Dispatcher should store them.

## Closing thought

Most Dispatcher problems on AEM as a Cloud Service aren't Dispatcher problems. They're decisions nobody made: how long HTML should live at the edge, what's private, what a publish should invalidate. Make those decisions explicitly, write them into a vhost and farm you own, test them locally and ship them through a web tier pipeline. The cache stops being a mystery and becomes the cheapest performance and resilience you have.

If you're tuning caching on AEMaaCS, migrating Dispatcher configuration from Managed Services, or chasing "old content" tickets, [get in touch](/contact/).

### References

- [Caching in AEM as a Cloud Service](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/content-delivery/caching) (Adobe Experience League)
- [Dispatcher in the Cloud](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/content-delivery/disp-overview) (Adobe Experience League)
- [Validating and debugging using the Dispatcher tools](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/content-delivery/validation-debug) (Adobe Experience League)
- [Pipeline-free URL redirects](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/content-delivery/pipeline-free-url-redirects) (Adobe Experience League)
- [CI/CD pipelines in Cloud Manager](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/using-cloud-manager/cicd-pipelines/introduction-ci-cd-pipelines) (Adobe Experience League)
- [AEM Project Archetype: Dispatcher configuration](https://github.com/adobe/aem-project-archetype/tree/develop/src/main/archetype/dispatcher.cloud) (Adobe, GitHub)
- [Configuring Dispatcher](https://experienceleague.adobe.com/en/docs/experience-manager-dispatcher/using/configuring/dispatcher-configuration) (Adobe Experience League)

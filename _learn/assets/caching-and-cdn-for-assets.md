---
title: "Caching and the CDN for assets"
description: "How Cache-Control, the CDN and Dispatcher cache images, why replacing a file under the same path can serve a stale image, and how versioned URLs avoid it."
track: assets
level: 4
order: 23
minutes: 9
outcome: "By the end you can explain why a replaced image still shows the old one, and choose a safe approach: versioned URLs, a short TTL or a purge."
prereq: "Dispatcher filters, caching and invalidation (aem lesson 23) and The CDN and cdn.yaml (aem lesson 24)."
terms:
  - { t: "`Cache-Control`", d: "A response header that tells browsers and caches whether and for how long they may reuse a file." }
  - { t: "TTL (time to live)", d: "The time a cached copy is considered fresh before it must be checked or fetched again." }
  - { t: "Versioned URL", d: "A URL that changes when the file changes, for example by including a content hash, so an old cached copy is never reused by mistake." }
  - { t: "Immutable", d: "A cache hint meaning the file at this URL will never change, so it can be cached for a very long time." }
  - { t: "Purge", d: "Asking a cache to throw away or revalidate its copy of a URL before its TTL ends." }
mistake: "Replacing an image under the same path and expecting the site to update at once. Browsers, the CDN and Dispatcher may all hold the old copy until its lifetime ends or you clear it."
try_it:
  - "Open your browser's network panel on any site, click an image and read its `Cache-Control` and `Age` response headers."
  - "Decide for three images (a logo with a fixed name, a campaign banner, a product photo with a hash in its name) which should have a long TTL and which a short one."
  - "Write what you would do if a legal team demands that one image be replaced within five minutes."
  - "List the three caches between the author's upload and a visitor's eyes: Dispatcher, the CDN, the browser."
quiz:
  - q: "Which URL is safest to cache for a very long time?"
    options:
      - "/content/dam/brand/logo.png"
      - "/content/dam/brand/logo.png?cachebust"
      - "/media/logo_8f3a2c.png, named with a content hash"
      - "A URL that is sometimes redirected"
    answer: 2
    why: "When the name changes with the content, an old cached copy can never be mistaken for the new file. A fixed path may be replaced later, so a long lifetime on it risks stale images."
  - q: "A brand team replaced a hero image in the DAM and re-published it, yet visitors still see the old one an hour later. What is the most likely cause?"
    options:
      - "The upload failed silently in the DAM tier"
      - "The browser or CDN is still within its TTL for that URL"
      - "Dispatcher refuses to serve images at all"
      - "AEM only refreshes images overnight"
    answer: 1
    why: "Publishing invalidates Dispatcher, but it does not purge the CDN, and browsers keep their own copies. A fixed path plus a long TTL means one of those holds the old image until it expires."
  - q: "You want faster delivery of a photo that never changes. Which header choice fits?"
    options:
      - "`no-store`, so it is always fresh"
      - "`private`, so each visitor gets their own copy"
      - "A very short `max-age` of a few seconds"
      - "A long `max-age` on a versioned URL, so it is cached by the CDN and browsers"
    answer: 3
    why: "A long lifetime on a URL that changes with the content is both fast and safe. `no-store` and `private` stop the CDN from helping, and a few seconds throws away most of the benefit."
  - q: "Which statement is NOT true?"
    options:
      - "A purge asks a cache to drop or revalidate a URL early"
      - "Dispatcher sets origin headers that the CDN then obeys"
      - "A shorter TTL makes changes appear sooner but sends more requests to the origin"
      - "A long TTL is always safe on any image URL"
    answer: 3
    why: "A long TTL is only safe when the URL changes with the file. On a fixed path it is the cause of stale images. The other three describe real behaviour."
go_deeper:
  - { title: "Getting more from the AEM as a Cloud Service CDN: headers, proxying, redirects and more with cdn.yaml", url: "/blog/2026/11/aem-cloud-service-cdn-yaml-headers-proxy-redirects/", why: "purge keys and caching traps" }
  - { title: "Dispatcher on AEM as a Cloud Service: caching rules, invalidation and the mistakes that cost you", url: "/blog/2026/11/dispatcher-on-aem-as-a-cloud-service-caching-and-invalidation/", why: "origin headers and invalidation" }
  - { title: "Image optimisation on AEM: Dynamic Media, web-optimised delivery and Edge Delivery Services", url: "/blog/2026/11/image-optimisation-on-aem-dynamic-media-and-edge-delivery-services/", why: "TTLs for Dynamic Media and OpenAPI delivery" }
  - { title: "Caching in front of databases: Redis and CDN", url: "/blog/2026/11/caching-in-front-of-databases-redis-cdn/", why: "the general caching ideas" }
---
## The problem: the old logo that will not go away

A brand team swaps the logo. They upload the new file over the old one in the DAM and publish. A colleague refreshes: new logo. A customer abroad still sees the old one a day later. Nothing is broken. Three caches are doing exactly what they were told.

## Where images get cached

An image on its way to a visitor can be kept in three places:

```text
visitor's browser  <-  CDN  <-  Dispatcher  <-  AEM publish
```

Each holds a copy for as long as the response headers allow. As in the CDN lesson, the origin headers decide the lifetime. A key header is `Cache-Control`, for example `max-age=86400` for one day, and the CDN may also read `Surrogate-Control`. Responses marked `private`, `no-cache` or `no-store`, or ones that set a cookie, are not cached by the CDN.

Dispatcher is invalidated when you publish, on Cloud Service. The CDN, by default, is not purged by publishing. The browser is not told anything at all. So a replaced file can be stale in the two layers you cannot reach quickly.

## Two honest strategies

**Strategy one: a short TTL.** Set a modest `max-age` on images that change, such as minutes. Changes show up soon. The price is more traffic reaching the origin. Dynamic Media with OpenAPI uses this idea: Adobe quotes a ten-minute CDN lifetime, so updates appear within that window.

**Strategy two: change the URL when the file changes.** This is the stronger idea. If the name includes a hash or version, the new file has a new URL, so no cache can hold the wrong copy. The old URL can then have a very long lifetime, even `immutable`.

You see this in two places. Versioned client libraries on Cloud Service are cached long because their URLs change. Edge Delivery Services stores media under content-hashed names like `media_<hash>.jpg`, so a new upload is a different URL. In the plain DAM, the path is usually the same when you replace a file, which is why this lesson's mistake is so common.

## What to do when you must replace under the same path

In a plain DAM setup the practical options are:

1. Accept the TTL and pick a short one for images that change often.
2. Reference the asset by a changing URL, such as one with a version or modifier, where your delivery option supports it.
3. Purge the CDN by URL or surrogate key if you have configured purging, preferring a soft purge that marks content stale. See the CDN lesson.
4. For Dynamic Media with Smart Imaging, Adobe documents a way to refresh an outdated cached URL. Check the Smart Imaging FAQ for the exact parameter.

Browsers are the hard part, because you cannot purge them. This is another reason to prefer changed URLs for anything that must update at a precise time.

## How this fits the delivery options

Web-optimised delivery serves images from `/adobe` paths. Adobe warns Dispatcher rules can block those paths, so check your filters and cache rules. Adobe also recommends a TTL of at least 24 hours for Dynamic Media with Smart Imaging, and notes that enabling or changing Smart Imaging clears its CDN cache, which can take a day or two to rebuild, so avoid doing it right before a launch.

<details markdown="1">
<summary>Stretch question: why not just set a very short TTL on everything?</summary>

Because the cache is what makes delivery cheap and fast. A TTL of seconds sends most requests to Dispatcher and AEM, which defeats the point, and your pages slow down under load. Use long lifetimes with versioned URLs for images that never change, and short ones only where freshness really matters.

</details>

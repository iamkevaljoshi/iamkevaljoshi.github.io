---
title: "Dispatcher: the mental model"
description: "What Dispatcher is, the three jobs it does between the CDN and AEM publish, how a request flows, and how the Dispatcher SDK configuration is laid out."
track: aem
level: 4
order: 22
minutes: 9
outcome: "By the end you can trace a request from browser to publish, say whether Dispatcher will answer it from cache, and name the three jobs Dispatcher does."
prereq: "Author, publish and preview (lesson 2). You should know that visitors are served from the publish tier."
terms:
  - { t: "Dispatcher", d: "An Apache HTTP Server module that sits in front of AEM publish and acts as a caching reverse proxy and request filter." }
  - { t: "Docroot", d: "The folder on disk where Dispatcher stores cached responses as ordinary files, laid out like the URL path." }
  - { t: "Cache hit and miss", d: "A hit is served from a file already on disk; a miss is passed on to publish, and the answer is usually stored for next time." }
  - { t: "Farm", d: "A Dispatcher configuration block that says which hosts it serves, which publish instance it talks to, and its filter and cache rules." }
  - { t: "Filter", d: "A rule that allows or denies a request before it ever reaches AEM publish." }
mistake: "Thinking Dispatcher is only a cache. It is also your first security gate. Teams that tune caching and never review filters can leave internal paths such as JSON dumps or the OSGi console reachable from the internet."
try_it:
  - "Open any AEM-powered site in your browser, open the developer tools Network tab and reload a page. Look at the response headers for cache related ones such as `cache-control`, `age` and anything mentioning a CDN."
  - "Reload and compare. Did the `age` value change, or did a header tell you the response was served from a cache?"
  - "On paper, draw four boxes: browser, CDN, Dispatcher, publish. Write one sentence under each saying what it could answer without asking the next box."
  - "If you have the Dispatcher SDK downloaded, unzip it and list the `src` folder. Find `conf.d` and `conf.dispatcher.d` and open one `.farm` file just to see its shape."
quiz:
  - q: "What is Dispatcher?"
    options:
      - "A Java service inside AEM that schedules publishing jobs"
      - "A separate database that stores a copy of the repository"
      - "An Apache module that caches, filters and proxies requests to publish"
      - "A Cloud Manager pipeline step that deploys code to publish"
    answer: 2
    why: "Dispatcher is an Apache module in front of publish. It is not part of the AEM Java process, it does not store repository data, and it is not a pipeline step, although you deploy its configuration through one."
  - q: "A visitor requests a page that Dispatcher has already cached and that has not been invalidated. What happens?"
    options:
      - "Dispatcher serves the file from disk and publish is not contacted"
      - "Dispatcher asks publish whether the page changed, then serves it"
      - "Dispatcher serves the file but still renders the page in publish"
      - "Dispatcher passes the request on because pages are never cached"
    answer: 0
    why: "A hit means the file is already on disk and is returned directly. That is the whole point: publish does no work. Asking publish every time would remove the benefit of caching."
  - q: "Your team caches pages perfectly but never edits the filter rules. What is the most realistic risk?"
    options:
      - "Pages will load slower because filters add a second cache"
      - "Authors will be unable to publish new pages"
      - "The CDN will stop honouring cache headers"
      - "Paths meant to stay internal could be reachable from the public site"
    answer: 3
    why: "Filters decide what may reach publish at all. Caching speed is a separate job. Weak or overly broad filters expose internal renderings, and that has nothing to do with publishing or CDN headers."
  - q: "Which statement about the Dispatcher cache is NOT true?"
    options:
      - "It stores responses as files under a docroot on the Dispatcher machine"
      - "It decides what to cache using rules that you can configure"
      - "It is shared by author and publish because they use one repository"
      - "Each publish instance has its own Dispatcher and its own cache"
    answer: 2
    why: "Author and publish are separate tiers with separate content. On Cloud Service each publish instance flushes and fills its own Dispatcher cache, so a single shared cache is the false statement."
go_deeper:
  - { title: "Dispatcher on AEM as a Cloud Service: caching rules, invalidation and the mistakes that cost you", url: "/blog/2026/11/dispatcher-on-aem-as-a-cloud-service-caching-and-invalidation/", why: "the full architect's guide to everything this lesson introduces" }
  - { title: "AEM Dispatcher filter tester", url: "/tools/aem-dispatcher-filter-tester/", why: "paste filter rules and see what they allow" }
  - { title: "Next lesson: Dispatcher filters, caching and invalidation", url: "/learn/aem/dispatcher-filters-caching-invalidation/" }
---
## The problem: publish is precious

Imagine a shop with one very skilled assistant who can build any product on demand, but each one takes a minute. If every customer asks for the same best seller, you do not want the assistant rebuilding it hundreds of times. You put finished copies on a shelf by the door, and a receptionist who decides what may be handed out.

In AEM, the skilled assistant is the **publish** tier, which assembles a page from content, templates and components. The shelf is the **Dispatcher cache**. The receptionist is the **Dispatcher filter**. Both live in one place: Dispatcher.

## What Dispatcher is

Dispatcher is a module that runs inside Apache HTTP Server. Apache receives the request, Dispatcher decides what to do with it, and publish is only asked when it has to be. On AEM as a Cloud Service, Adobe runs this web tier for you and you supply its configuration.

It has three jobs:

1. **Cache.** Store finished responses as files and serve them again.
2. **Filter.** Allow only the requests you intend and deny everything else, before AEM sees them.
3. **Rewrite and shape.** Rewrite URLs (for example, hide `/content/mysite/en` from visitors), and add or adjust response headers, including the ones that tell the CDN and browsers how long to keep a response.

## The request flow

On Cloud Service a public request passes through several layers:

```text
Browser -> Adobe-managed CDN -> Apache + Dispatcher -> AEM publish
              (hit? stop)         (filter, then hit? stop)    (render)
```

The CDN may answer first. If it cannot, the request reaches Dispatcher. Dispatcher applies its **filters** first. If the request is allowed, it checks the **cache**. A **hit** returns a file from disk. A **miss** goes to publish, which renders the response, and Dispatcher stores it if the rules say it may.

Because the cache is plain files, you can picture it. A request for `/content/mysite/en/products.html` becomes a file like this under the docroot:

```text
docroot/
  content/
    mysite/
      en/
        products.html
        .stat
```

When content is republished, Dispatcher does not hunt through everything. It uses small marker files called `.stat` files to mark older cached files as stale. The next lesson covers how that works.

## How the configuration is laid out

The Dispatcher SDK gives you a folder with two main halves, which map to the two layers of the web tier:

| Folder | Layer | What lives there |
|---|---|---|
| `conf.d` | Apache | Virtual hosts, rewrite rules, variables, headers |
| `conf.dispatcher.d` | Dispatcher module | Farms, filters, cache rules, client headers |

A **farm** ties it together: which host names it serves, which publish instance it renders from, and which filter and cache rules apply. Some files in the SDK are immutable and managed by Adobe. You add your own files and include the defaults, rather than editing them. The blog post linked below lists exactly which is which.

## Where this goes next

You now have the shape. The next lesson looks at the two sets of rules that matter most: **filters** (what may pass) and **caching** (what is stored, and when it is thrown away). The [Dispatcher filter tester](/tools/aem-dispatcher-filter-tester/) on this site lets you try filter rules in your browser as you read it.

<details markdown="1">
<summary>Predict first, then reveal: a visitor sees stale text after you publish. Which layer is the likeliest suspect?</summary>

Often not Dispatcher. On Cloud Service, publishing flushes the Dispatcher cache on each publish instance, but it does not purge the CDN or a visitor's browser. If either of those still holds a copy within its time to live, the old text appears. Start by looking at the response headers to see which layer answered.

</details>

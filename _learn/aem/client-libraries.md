---
title: "Client libraries: delivering CSS and JavaScript"
description: "How AEM bundles CSS and JavaScript into client libraries, why they are served through /etc.clientlibs, and how the archetype's ui.frontend feeds them."
track: aem
level: 2
order: 11
minutes: 8
outcome: "By the end you can create a client library, load it on a page by category, and explain why it is served through a proxy path rather than straight from /apps."
prereq: "Lesson 10 (components) and lesson 5 (project structure)."
terms:
  - { t: "Client library", d: "A folder of type `cq:ClientLibraryFolder` that AEM combines into one CSS file and one JavaScript file for the browser." }
  - { t: "Category", d: "A name on a client library. Pages and components ask for libraries by category, not by path." }
  - { t: "allowProxy", d: "A property that lets a client library under `/apps` be served through `/etc.clientlibs`." }
  - { t: "embed", d: "Copies another library's code into this one's output, reducing the number of requests." }
  - { t: "ui.frontend", d: "The archetype module that builds your CSS and JavaScript with webpack and generates a client library from the result." }
mistake: "Linking to `/apps/...` paths in markup. Publish does not serve `/apps` to visitors, so the files work on your laptop and 404 in production."
try_it:
  - "In your archetype project, find `clientlibs` folders under `ui.apps` and open one `.content.xml`."
  - "Note its `categories` value and whether `allowProxy` is set to true."
  - "Open a page in the author instance, view source and search for `etc.clientlibs`."
  - "Add `?debugClientLibs=true` to the page URL and compare what the browser loads."
  - "Open `ui.frontend` and find the webpack configuration that writes into the clientlib folder."
quiz:
  - q: "Why is `allowProxy=true` set on a client library under `/apps`?"
    options:
      - "It allows the files to be fetched through `/etc.clientlibs`"
      - "It makes the library load faster"
      - "It marks the library as safe to minify"
      - "It lets authors edit the CSS in the page editor"
    answer: 0
    why: "Client libraries live under `/apps`, which is not exposed directly. The proxy path is the supported public door, and `allowProxy` opens it for that folder."
  - q: "A page needs the site CSS and a carousel's JavaScript, but only some pages have a carousel. What is the sensible design?"
    options:
      - "Put everything in one category loaded on every page"
      - "Give the carousel its own category and include it from the component or the pages that need it"
      - "Inline the carousel JavaScript into every page template"
      - "Load the carousel only from a third-party CDN"
    answer: 1
    why: "Categories let you split code by need. Loading everything everywhere is simple but ships unused code to every visitor."
  - q: "Your component works on author but its CSS is missing on publish. Which cause is most likely?"
    options:
      - "The HTL file is cached"
      - "The Sling Model was not deployed"
      - "The page template is locked"
      - "The page links directly to a path under `/apps`"
    answer: 3
    why: "Direct `/apps` links work for logged-in users and fail for anonymous visitors. Asking for the category lets AEM generate the proxy URL."
  - q: "Which is NOT a reason to use `ui.frontend` in the archetype?"
    options:
      - "You can use modern tooling such as webpack and Sass"
      - "Output is turned into a client library for AEM"
      - "You can develop and test CSS and JavaScript outside AEM"
      - "AEM no longer needs a client library to serve the result"
    answer: 3
    why: "`ui.frontend` produces the files, but AEM still serves them through a client library on the proxy path. It changes how you build, not how it is delivered."
go_deeper:
  - { title: "Dispatcher on AEM as a Cloud Service: caching and invalidation", url: "/blog/2026/11/dispatcher-on-aem-as-a-cloud-service-caching-and-invalidation/", why: "how these static files are cached once served" }
  - { title: "Edge Delivery Services performance: keep Lighthouse 100", url: "/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/", why: "how the Edge Delivery Services approach compares to bundled clientlibs" }
  - { title: "Next lesson: Editable templates and content policies", url: "/learn/aem/templates-and-policies/" }
---
## The problem: files that must reach the browser

Your component needs CSS and JavaScript. You could write `<link href="/apps/mysite/clientlibs/site.css">` and move on. It would work on your machine and fail in production, because `/apps` holds code and is not served to the public. You also would not want fifty small files, one per component, each costing a request.

**Client libraries** solve both. AEM collects your files, combines and minifies them, and serves them through a safe public path.

## What a client library is

It is a folder with a `.content.xml` of type `cq:ClientLibraryFolder`, plus source lists:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<jcr:root xmlns:cq="http://www.day.com/jcr/cq/1.0"
          xmlns:jcr="http://www.jcp.org/jcr/1.0"
    jcr:primaryType="cq:ClientLibraryFolder"
    allowProxy="{Boolean}true"
    categories="[mysite.base]"
    dependencies="[mysite.vendor]"/>
```

```text
clientlibs/clientlib-base/
  .content.xml
  css.txt        # lists CSS files, one per line
  js.txt         # lists JavaScript files, one per line
  css/ js/       # the actual files
```

The `categories` value is a name. `dependencies` names other categories that must be loaded too. `embed` goes further: it copies another library's code into this one's output, which saves requests.

## Why the proxy path exists

`allowProxy` makes the library available at `/etc.clientlibs/mysite/clientlibs/clientlib-base.js`, a path built from the `/apps` location. Visitors get a stable public URL while the source stays protected. Static files such as fonts or images that CSS refers to need a `resources` folder beside the library so they can be served the same way.

## Loading by category

You do not write those URLs. The page component asks for a category with a Core Components helper, such as `clientlib.css` or `clientlib.js`, and AEM writes the tags:

```html
<sly data-sly-use.clientlib="core/wcm/components/commons/v1/templates/clientlib.html"/>
<sly data-sly-call="${clientlib.css @ categories='mysite.base'}"/>
<sly data-sly-call="${clientlib.js @ categories='mysite.base', async=true}"/>
```

Putting CSS in the head and JavaScript at the end of the body, or marked `async`, keeps rendering fast.

## ui.frontend and the build

The archetype's `ui.frontend` module is a separate front-end project. You write Sass or modern JavaScript, run webpack, and the build writes the result into a client library folder in `ui.apps`. Maven then packages it. That gives front-end developers their usual tooling and a fast local feedback loop.

## Minification and caching

AEM minifies library output, and the minifier is set per library, not globally. On Cloud Service the generated URLs typically contain a content hash so that browsers and the CDN can cache them for a long time and still pick up changes when the content changes. Check the current documentation for the exact behaviour in your environment, and do not rely on query strings to bust caches.

<details markdown="1">
<summary>Stretch question: when would you embed instead of declare a dependency?</summary>

Embed when you want one combined file and fewer requests. Use dependencies when libraries should stay separate, for example so a shared vendor file can be cached across pages. Embedding too much creates a large file that changes whenever any part changes.

</details>

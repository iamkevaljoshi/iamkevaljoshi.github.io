---
title: "What Edge Delivery Services is, and how it differs from AEM as a Cloud Service"
description: "What AEM Edge Delivery Services is, the problem it solves, how it differs from AEM as a Cloud Service, and when to choose it, with an honest take on Lighthouse 100."
track: eds
level: 1
order: 1
minutes: 8
outcome: "By the end you can explain in two minutes what Edge Delivery Services is, how it differs from AEM as a Cloud Service, and when it is the right choice."
prereq: "Nothing. A rough idea of what a CMS does helps, but you do not need to know AEM."
terms:
  - { t: "Edge Delivery Services (EDS)", d: "Adobe's way of building and delivering websites where content comes from a document-style source and pages are served from a CDN with minimal JavaScript." }
  - { t: "aem.page and aem.live", d: "The two domains your site is served from: `.aem.page` shows previewed content, `.aem.live` shows published content." }
  - { t: "Block", d: "A reusable piece of a page, authored as a table in a document and turned into markup by a little JavaScript and CSS." }
  - { t: "Content source", d: "Where authors write content, for example Google Drive, SharePoint, Document Authoring or AEM authoring." }
  - { t: "Sidekick", d: "A browser extension authors use to preview and publish pages." }
mistake: "Believing a perfect Lighthouse score is guaranteed. EDS makes 100 achievable by default, but heavy third-party scripts, large images or sloppy block code can still pull it down."
try_it:
  - "Open the example site at `https://www.aem.live/` and run Lighthouse in Chrome DevTools in an incognito window."
  - "View the page source and note how little JavaScript is in the HTML compared with a typical corporate site."
  - "Write down who edits content on a site you know, and in which tool. Ask whether they could do it in a document."
  - "List two projects you know: one that suits EDS, one that does not, and why."
quiz:
  - q: "What problem does Edge Delivery Services mainly set out to solve?"
    options:
      - "Fast sites by default, a simple developer model and familiar authoring tools"
      - "Replacing every use of a CDN with a single Adobe server"
      - "Storing all content inside a Java content repository"
      - "Removing the need for developers on a website project"
    answer: 0
    why: "The aim is speed by default, a small and simple codebase, and authors working in tools they know. It still needs developers for blocks, and it is delivered through a CDN."
  - q: "A team asks whether EDS delivery uses a Dispatcher and the JCR. What is the best answer?"
    options:
      - "Yes, both are used behind the scenes, but Adobe hides them from you"
      - "No. Delivery uses content and code stores and a CDN instead"
      - "Only the Dispatcher, which caches the pages before the CDN"
      - "Only the JCR, which stores the authored documents for delivery"
    answer: 1
    why: "On EDS, delivery does not run through an AEM publish tier. Content and code live in dedicated stores and are served via a CDN. If you author in AEM, the JCR is only the authoring source, not what serves visitors."
  - q: "Your marketing team needs deep personalisation, complex workflows and heavy reuse across 40 sites in one authoring system. What is the sensible stance?"
    options:
      - "Choose EDS anyway, because it always scores 100"
      - "Rule EDS out, because it cannot be used with AEM"
      - "Compare it with traditional AEM first, as these needs may favour that or a hybrid"
      - "Pick whichever is cheaper without further analysis"
    answer: 2
    why: "EDS suits fast, content-led sites, and it can use AEM as a content source. Requirements like heavy governance and complex workflows deserve a proper comparison rather than a default choice."
  - q: "Which statement about Lighthouse 100 is NOT true?"
    options:
      - "EDS ships very little JavaScript before the first render"
      - "Real sites with tag managers and large hero images can still lose points"
      - "A good score is a realistic target when you follow the loading model"
      - "The platform guarantees 100 whatever code you add"
    answer: 3
    why: "The platform makes a high score easy to reach and keep, but it cannot protect you from code and third-party scripts you add. Treat 100 as a goal you defend."
go_deeper:
  - { title: "AEM Edge Delivery Services vs traditional AEM as a Cloud Service", url: "/blog/2026/11/aem-edge-delivery-services-vs-traditional-aemaacs/", why: "a full comparison of the two delivery models" }
  - { title: "Edge Delivery Services performance: keep Lighthouse at 100", url: "/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/", why: "how to defend the score" }
  - { title: "Universal Editor vs document-based authoring", url: "/blog/2026/11/universal-editor-vs-document-based-authoring/", why: "the two ways to author on EDS" }
  - { title: "Next lesson: How a page gets from a document to the browser", url: "/learn/eds/document-to-browser/" }
---
## The problem: sites that start fast and get slow

Most websites launch with a good score and then decay. Every campaign adds a script, every component adds a library, and every template adds a framework layer. Developers then spend months on performance work, and authors wait for releases to change simple things.

**Edge Delivery Services** (EDS) starts from the opposite end. It aims for three things:

- **Speed by default:** pages are served from a CDN with very little JavaScript, so a high Lighthouse score is the normal state, not a project.
- **A simple developer model:** plain HTML, CSS and vanilla JavaScript, a Git repository, and no build step in the standard setup.
- **Content in familiar tools:** authors write in documents and spreadsheets, or in AEM authoring, instead of learning a new editor.

Think of a restaurant that only serves a short menu cooked fresh. It is quick because the kitchen is small and every dish is designed for speed.

## How it differs from AEM as a Cloud Service

Traditional AEM as a Cloud Service has an author tier, a publish tier, the JCR repository, Sling, the Dispatcher and a CDN. A page is assembled by server-side components on request, then cached.

On EDS, there is no AEM publish tier in the delivery path. Content is pulled from a **content source**, stored in a content store, and turned into semantic HTML. Code comes from your GitHub repository. Both are served through a CDN.

| Aspect | AEM as a Cloud Service | Edge Delivery Services |
|---|---|---|
| Delivery | Publish tier, Dispatcher, CDN | Adobe delivery infrastructure, CDN |
| Where content lives for delivery | JCR | Content store populated from the source |
| Authoring | AEM editors | Documents, spreadsheets, Document Authoring, or AEM authoring |
| Page assembly | Server-side components (HTL, Sling Models) | Generated markup plus block JavaScript in the browser |
| Deployment | Cloud Manager pipeline | `git push`, picked up by the AEM Code Sync app |

The two are not rivals in every project. EDS can use AEM authoring as a content source, so you can keep an author experience and still deliver through EDS. The blog post on [EDS versus traditional AEMaaCS](/blog/2026/11/aem-edge-delivery-services-vs-traditional-aemaacs/) goes deeper.

## What "100 Lighthouse" really means

The promise is that the platform gets out of your way. The page's critical path is small, and the standard loading approach keeps heavy code away from the first render. That makes 100 reachable on real pages.

It is not a guarantee. A tag manager loaded early, an uncompressed 4 MB hero image or a block that fetches data before rendering will cost you points. You keep the score by discipline, which Level 3 of this course covers. See also [keeping Lighthouse at 100](/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/).

## When to choose it

EDS is a strong fit for marketing sites, documentation, blogs and content-led pages where speed, search visibility and fast author turnaround matter. Check carefully when you need heavy governance, complex multi-site reuse, or deep server-side logic in one system. In those cases a hybrid, or traditional AEM, may fit better.

<details markdown="1">
<summary>Stretch question: if there is no publish tier, where does personalisation happen?</summary>

Mostly at the edge or in the browser, through experimentation features, edge workers or third-party tools. That is a real trade-off: you gain speed, but logic you used to put in a server-side component must move somewhere else. Level 5 covers the options.

</details>

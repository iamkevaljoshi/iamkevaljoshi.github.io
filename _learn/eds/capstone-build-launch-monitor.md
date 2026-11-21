---
title: "Capstone: build, launch and monitor a small site"
description: "A hands-on project: plan, build, index, test, launch and monitor a small Edge Delivery Services site, with a clear definition of done to self-assess against."
track: eds
level: 5
order: 30
minutes: 30
kind: project
outcome: "By the end you can take a small site from plan to launch on Edge Delivery Services and show evidence that it is indexed, accessible, fast and monitored."
prereq: "The earlier EDS lessons, especially lessons 6, 14, 19 and 25. You need a GitHub account and the aem-boilerplate."
terms:
  - { t: "Go-live", d: "The moment the production domain starts serving the site from Edge Delivery Services." }
  - { t: "Push invalidation", d: "A CDN setup that lets EDS tell the CDN to purge changed pages, so publishes show up on the production domain." }
  - { t: "BYO CDN", d: "Using your own CDN in front of the aem.live origin, as opposed to the Adobe-managed CDN included in your licence." }
  - { t: "Operational Telemetry", d: "EDS's cookieless real user monitoring, which samples page views and records Core Web Vitals and other checkpoints." }
  - { t: "Hypercare", d: "The period straight after launch when you check errors, redirects, performance and indexing daily." }
mistake: "Treating launch day as the finish line. Without telemetry and a post-launch routine, regressions from a new tag or block go unnoticed until rankings or conversions drop."
try_it:
  - "Plan: choose a small site (about five pages, such as home, about, a blog index and two posts). List the blocks you need, reusing the Block Collection where you can, and write the metadata each page needs."
  - "Build: create a repository from `aem-boilerplate`, install the AEM Code Sync GitHub app, author the pages, and build or adapt only the blocks you listed. Preview each on `aem.page`."
  - "Structure: add a `helix-query.yaml` or index configuration for your posts, check `/sitemap.xml`, and add at least two entries to the redirects sheet."
  - "Quality: run the accessibility checks (keyboard, headings, alt text, contrast) and Lighthouse on mobile and desktop for the home page and one post. Fix what you find."
  - "Launch: publish on `aem.live`, then walk through the go-live checklist below. If you own a domain, point it through your CDN to the `main` branch origin and test a small publish."
  - "Monitor: open the Operational Telemetry Explorer for your site and note your Core Web Vitals baseline, then repeat after a few days."
  - "Reflect: write your post-launch checklist and one thing you would change."
quiz:
  - q: "Which branch should a production CDN point at?"
    options:
      - "A long-lived staging branch, to avoid mistakes"
      - "The branch with the most recent commit"
      - "Whichever branch the author last published from"
      - "The main branch, as Adobe's checklist directs for production sites"
    answer: 3
    why: "Adobe states to always use main for production. Pointing at another branch lets production depend on a branch that may be changed or deleted."
  - q: "You publish a small change, but it does not appear on your production domain, though it shows on aem.live. What do you check first?"
    options:
      - "Push invalidation on your CDN, as the CDN may still be serving the old cached page"
      - "Whether the block JavaScript has a syntax error"
      - "Whether the sitemap has been regenerated"
      - "Whether Lighthouse is at 100"
    answer: 0
    why: "A change visible on aem.live but not the production domain points to the CDN layer. Adobe's checklist says to test push invalidation by publishing a small change. The other options affect other symptoms."
  - q: "The launch is next Tuesday. Which plan is wisest?"
    options:
      - "Ship the new carousel on launch day to impress stakeholders"
      - "Freeze code and content, rehearse on a production-like host, launch with nothing new"
      - "Skip telemetry setup until traffic arrives"
      - "Delete the old redirects to keep the sheet tidy"
    answer: 1
    why: "Adobe advises cutover without new deployments or content updates. New features add risk, telemetry before launch gives a baseline, and the redirects protect old URLs."
  - q: "Which is NOT a sign the project is done well?"
    options:
      - "The sitemap lists the expected pages and robots.txt is correct on the production host"
      - "A Lighthouse score of 100 on the home page proves real users have good Core Web Vitals"
      - "Operational Telemetry is running and a baseline is recorded"
      - "Retired URLs redirect to relevant new pages"
    answer: 1
    why: "Lighthouse is a single simulated lab run. Real users are measured by field data such as Operational Telemetry and CrUX, so a lab 100 does not prove the field result."
go_deeper:
  - { title: "The AEM go-live checklist", url: "/blog/2026/11/aem-go-live-checklist/", why: "the full list, plus cutover, rollback and hypercare" }
  - { title: "EDS performance: keep Lighthouse at 100 after go-live", url: "/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/", why: "monitoring and governance after launch" }
  - { title: "Image optimisation on AEM and Edge Delivery Services", url: "/blog/2026/11/image-optimisation-on-aem-dynamic-media-and-edge-delivery-services/", why: "images are the usual LCP problem" }
  - { title: "EDS helper tool", url: "/tools/edge-delivery-services-helper/", why: "quick checks while you build" }
---
## The goal

You have learned the parts. Now you assemble them into something real, and prove it works. This project is about *evidence*: at the end you should be able to point at a sitemap, a Lighthouse report, an accessibility check and a telemetry chart, not just say "it is done".

Pick a small site you genuinely care about, such as a portfolio, a club site or a small product page set. Five pages is plenty.

## Phase 1: plan

Before touching code, write one page of notes:

- **Pages and content:** the list of pages and who will author them.
- **Blocks:** the smallest set of blocks that covers the design. Reuse the Block Collection (lesson 11) and build only what is missing.
- **Authoring model:** documents, Experience Workspace or Universal Editor (lesson 26). Choose now.
- **Data and metadata:** page titles and descriptions, and anything that needs an index, such as blog posts.

A small plan prevents the common failure of building blocks nobody needs.

## Phase 2: build and structure

Create your repository from the `aem-boilerplate`, install the AEM Code Sync GitHub app and connect your content source (lessons 3 and 6). Author the pages and preview them on `aem.page`. Build your custom blocks with decoration, variants and responsive CSS (lessons 7 to 12).

Then add the structure from level 4:

```yaml
indices:
  blog:
    include:
      - /blog/**
    target: /query-index.json
    properties:
      title:
        select: head > meta[property="og:title"]
        value: attribute(el, "content")
```

Check that `/sitemap.xml` lists the pages you expect, that the production `robots.txt` is right, and add redirects for any URL you are retiring.

## Phase 3: quality

Run these on the home page and one content page:

1. **Accessibility:** keyboard-only navigation, one H1, sensible heading order, alt text, visible focus, sufficient contrast.
2. **Lighthouse:** mobile and desktop. Aim for the high scores the architecture allows (lessons 15 and 16), and fix regressions at their source, usually images, fonts or an early script.
3. **Content checks:** titles, descriptions, canonical URLs and no accidental `noindex`.

## Phase 4: launch

The documented go-live steps are short but unforgiving. In your plan, cover:

- **Production CDN:** use either your own CDN or the Adobe-managed CDN included in your licence. Point production at the **`main`** branch, redirect HTTP to HTTPS permanently, and test both apex and `www`.
- **Push invalidation:** configure it for your CDN, publish a small change and confirm it appears on the production domain. For a learning project without a custom domain, you can rehearse this on `aem.live` and note which steps you could not do.
- **Redirects and robots:** the redirects sheet filled in, robots.txt checked on the production host.
- **Telemetry:** Operational Telemetry active **before** launch, so you can compare.
- **Notify Adobe:** the checklist asks you to email the go-live address given there with your URLs, domain, date and time. Use the address on the current page, not a remembered one.
- **Freeze:** no new code or content at cutover.

The [go-live checklist post](/blog/2026/11/aem-go-live-checklist/) expands every item.

## Phase 5: monitor

Open the Operational Telemetry Explorer for your site (you need the domain key). Record LCP, INP and CLS by device. Check weekly, and after every release compare with the week before. Add a post-launch checklist: 404s, redirect behaviour, indexing in Search Console, Core Web Vitals and any new third-party tag, which must go in the delayed phase behind consent.

## What a good result contains

Tick each item honestly:

- A written plan with page list, block list and authoring model.
- All pages previewed and published, using at most a few custom blocks.
- Sitemap generated, robots.txt correct, redirects sheet used.
- Accessibility pass recorded, with issues found and fixed.
- Lighthouse results for two pages on mobile and desktop.
- Production setup documented: CDN choice, `main` branch, push invalidation tested (or honestly marked as rehearsed).
- Telemetry baseline recorded, and a post-launch checklist you will follow.

<details markdown="1">
<summary>Stretch question: when would you choose the Adobe-managed CDN over your own?</summary>

If you have no existing CDN contract, no need for custom edge logic and want the least setup, the managed CDN included in your licence is simpler. Choose your own CDN when your organisation already standardises on one, needs its security tooling, or plans edge workers. The cost is that you must configure push invalidation and forwarded headers correctly.

</details>

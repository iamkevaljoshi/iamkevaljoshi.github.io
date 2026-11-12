---
layout: post
title: "How I build browser-based tools for AEM teams, with AI as a pair programmer"
seo_title: "Building Browser Tools for AEM Teams with AI: What Worked"
description: "How I build free, privacy-first browser tools for AEM teams with an AI coding assistant: the architecture, how I research and test, and the bugs AI's first drafts missed."
ai_summary: "The six tools on this site, from page comparison and SEO, GEO and accessibility audits to an image optimiser and an AEM as a Cloud Service migration estimator, are static pages on GitHub Pages that do all their work in the browser. Files are never uploaded; public pages are fetched through Jina Reader. An AI coding assistant drafted much of the code and research, but testing against real sites, real files, mobile, dark mode and accessibility scans found problems the first drafts missed: a sitemap read that took over five minutes, unreliable component detection, stale auto-filled values, a mobile layout overflow and two Jekyll publishing bugs. The lesson: AI speeds up drafting, but verification, scope and decisions stay with a person."
date: 2026-11-12 13:00:00 +0530
category: architecture
tags: [AI, Tools, AEM, Testing, Privacy]
---

Over the last few weeks I've added six free tools to this site for AEM and web teams. Two of them, the image optimiser and the AEM as a Cloud Service migration estimator, I built with an AI coding assistant as a pair programmer, from research through to testing on live sites.

This post is about how that actually went. Not "AI wrote my app in an afternoon", and not "AI is useless". Something more useful: what I let AI do, what I kept for myself, and the specific bugs that only came out when I tested against real sites, real files and a phone-sized screen.

If you lead AEM teams, I think the same split applies to your projects. AI is very good at producing a plausible first draft. It is much less good at knowing whether the draft survives contact with production.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **Six tools, one architecture:** static pages on GitHub Pages, plain JavaScript, and all the work in the visitor's browser. There's no application server, no database and no uploads.
- **Privacy is a design choice, not a policy page.** The image optimiser and the migration estimator read your files in the browser and never send them anywhere. Public pages are fetched through Jina Reader.
- **AI was fastest at research and first drafts:** pulling Adobe's Best Practices Analyzer (BPA) format and finding codes from Adobe's own documentation source, drafting parsers and UI, and writing test harnesses.
- **Testing found what the drafts missed:**
  - a sitemap read that took over five minutes on a large site
  - component detection that mistook CSS class names for components
  - stale values when loading a second report
  - a mobile layout 112 pixels too wide
  - two Jekyll publishing bugs that GitHub reported as successful builds
- **People keep the decisions.** The migration estimator's effort rates are my defaults, labelled as such and editable, because Adobe publishes no effort model and an estimate is a judgement, not a calculation.

## The tools, and why they're browser-only

| Tool | What it does | Where the work happens |
|---|---|---|
| [Web page comparison]({{ '/tools/web-page-comparison/' | relative_url }}) | UI and content parity between two URLs, for migration QA | Pages fetched and screenshotted through Jina Reader, compared in the browser |
| [SEO audit]({{ '/tools/seo-audit/' | relative_url }}) | robots.txt, sitemaps, indexability, canonicals, structured data and more | Fetched HTML parsed in the browser |
| [GEO audit]({{ '/tools/geo-audit/' | relative_url }}) | Whether AI assistants can crawl, read and cite a page | Same as the SEO audit |
| [Accessibility checker]({{ '/tools/accessibility-checker/' | relative_url }}) | WCAG 2.2 AA checks with axe-core, plus expert and manual checks | axe-core runs in an isolated frame in the browser |
| [Image optimiser]({{ '/tools/image-optimiser/' | relative_url }}) | Compress, resize and convert to WebP, AVIF or JPEG, with `srcset` snippets | Browser's built-in encoders, in a Web Worker |
| [AEMaaCS migration estimator]({{ '/tools/aem-migration-estimator/' | relative_url }}) | Effort and timeline from a BPA report plus a site analysis | BPA CSV parsed in the browser; site read through Jina Reader |

They all follow the same shape:

![How the tools on this site are built: GitHub Pages serves static files; the tool page, a Web Worker and the visitor's files all live in the browser; Jina Reader fetches public pages; libraries load from a CDN; there is no server]({{ '/assets/img/blog/building-tools-with-ai/01-tool-architecture.svg' | relative_url }}){: width="1200" height="600" loading="lazy" decoding="async"}

I chose this architecture deliberately, and I'd make the same choice again:

- **No server means nothing to run, patch or scale.** The site is Jekyll on GitHub Pages. Each tool is one page in `_tools/` and one script in `assets/js/tools/`, with shared helpers in `kit.js`. There's no build step and no framework.
- **No uploads means people can use the tools on confidential material.** A BPA report describes a client's codebase. Images can be unreleased campaign assets. If they never leave the browser, there's no data-handling question to answer.
- **Fetched pages are treated as untrusted.** HTML from other sites is parsed with `DOMParser`, so its scripts never run, and anything from a fetched page is rendered as text.
- **Third-party code is pinned.** axe-core loads at a fixed version with an integrity hash; the text-diff library loads at a fixed version too.

The one thing a browser can't do on its own is read other websites, because of cross-origin rules. That's what Jina Reader is for. The tools ask it for a page, robots.txt or a sitemap, and it returns the content. A free Jina API key raises the rate limits and lets it render JavaScript-built pages.

## How I work with AI on a tool

For the image optimiser and the migration estimator, the work fell into four stages. AI's share was different in each.

### 1. Research: AI reads the documentation, I check the sources

Before writing any code for the migration estimator, I needed to know exactly what's in a BPA report. AI was excellent at this, with one important habit: going to primary sources.

- **The CSV format** came from Adobe's Best Practices Analyzer documentation. The columns are `code`, `type`, `subtype`, `importance`, `identifier`, `other`, `message`, `moreInfo` and `context`, and `\N` means empty.
- **The finding codes** were harder. Adobe's pattern detection pages are rendered by JavaScript, so a simple fetch returned an empty shell. Adobe publishes its documentation source on GitHub, so we cloned the pattern detection repository and extracted every category and subtype from the Markdown: about 40 codes, from `CCOM` (custom components) and `CTEM` (custom templates) to `URS` (unsupported repository structure) and `REP` (replication agents).
- **What Adobe doesn't publish** mattered as much. There is no official effort formula, and Adobe's own Cloud Acceleration Manager walkthrough warns that complexity isn't the same as effort. So the estimator's rates had to be mine, and the tool had to say so.

That last point is where I think AI-assisted work most often goes wrong. A model asked to "estimate effort from BPA findings" will happily produce numbers. Whether those numbers mean anything depends on someone knowing that no authoritative model exists and labelling the defaults honestly.

### 2. Design: I decide scope, AI proposes structure

For the image optimiser, the first question I asked was whether we could build it with what the site already had, with no extra libraries. The answer shaped the tool:

- **Version 1 uses only browser-native encoders** (canvas `toBlob` and `OffscreenCanvas.convertToBlob`). That covers resizing, WebP, JPEG and AVIF where the browser can create it, metadata stripping, a before-and-after comparison and ZIP download.
- **Version 2 would need WebAssembly encoders** for better JPEG compression, real PNG optimisation and AVIF in every browser. I deliberately left that for later.

For the estimator, I set the shape: BPA findings grouped into refactoring buckets, a website analysis for QA scope, editable inputs, and every assumption visible. AI proposed the bucket structure and the diminishing-returns model: a full rate per finding up to a threshold, then a lower bulk rate, because 500 similar findings are fixed with a script rather than one by one. I reviewed every default rate and changed them to match my experience.

### 3. Drafting: AI writes, I read every line

AI drafted most of the code: the CSV parser, the sitemap reader, the effort model, the timeline chart, and the image optimiser's worker. Some choices I'd point to as genuinely good:

- **One file that runs twice.** The image optimiser's script is the page code and also the Web Worker, so decoding and encoding happen off the main thread without a second file to maintain. If a browser lacks `OffscreenCanvas`, the same code runs on the page instead.
- **A tiny ZIP writer instead of a library.** Images are already compressed, so a "store only" ZIP with a CRC-32 table is about 60 lines and no dependency.
- **Defensive parsing.** The BPA system overview messages aren't formally documented, so the estimator reads numbers defensively and shows what it found, and every auto-filled field is marked "auto" with its source.

Reading every line still mattered. My review caught logic that would have surprised users, before any test ran. For example, the image optimiser first kept the original file whenever re-encoding made it bigger, even when someone had explicitly asked for JPEG. That's right for "Smallest", wrong for an explicit choice.

### 4. Testing: real files, real sites, real screens

This is where most of the value was. Every tool was tested with Playwright, driving headless Chrome:

- **Locally**, against a harness that served the real page markup, styles and script, with generated test images and hand-made edge-case CSV files.
- **Live**, after publishing, on desktop, a 390-pixel-wide mobile viewport and dark mode, with an axe-core accessibility scan on each page.

The next section is the honest list of what that testing found.

## What testing found that the first drafts missed

None of these were exotic. They're the kind of thing that turns a demo into a tool people trust, and none would have shown up in a quick read of the code.

### A sitemap read that took over five minutes

The migration estimator's first draft read a site's sitemaps one at a time, up to 40 of them. On philips.co.uk, which has a large sitemap index, the test timed out after five minutes.

The fix had four parts:

- **Read child sitemaps four at a time,** within a 60-second budget and a cap of 16 sitemaps (more with an API key).
- **Give each request its own timeout.** The shared fetch helper waited up to 90 seconds per request. I added an optional per-call timeout to `kit.js`, kept the old default for the other tools, and used 25 seconds in the estimator.
- **Extrapolate, and say so.** If not every sitemap was read, the tool estimates the total from the average URLs per sitemap and marks the number as estimated.
- **Bound the page sampling** to 90 seconds as well.

In my testing, the same analysis then finished in 68 seconds: 4,944 URLs from 16 sitemaps, about 36,000 estimated in total across the 85.

### Error messages that hid the real problem

Two separate issues looked the same to a user:

- **On adobe.com,** Jina Reader blocked anonymous requests, but the tool reported "No URLs found in the XML sitemaps". That's misleading. Now it shows the real error and suggests a free API key.
- **On hsbc.co.uk,** a transient failure meant robots.txt wasn't read, and the fallback only tried `/sitemap.xml`. HSBC uses `/sitemaps.xml`. The tool now tries the common names when robots.txt doesn't declare one. In my testing it then found 1,362 URLs and 72 page groups in 11 seconds.

### Component detection that guessed

For QA scope, the estimator counts components on sampled pages. The first version looked for AEM's responsive grid and for direct children of any paragraph-system container. On HSBC's custom markup that picked up layout classes and BEM element names, and would have reported five components, understating the scope badly.

On Adobe's own Core Components library page, it also counted Style System variants (`--hero`, `--heading2`) as separate components.

The fix was to trust only reliable markers: Core Components' `cmp-` classes, the responsive grid, and classic `parbase` wrappers, with BEM elements and variants filtered out. In my testing that gave 15 real components on the Core Components page. And when a BPA report is loaded, the tool now prefers its custom component count over anything it sees in markup. When detection finds fewer than five components, it says so rather than guessing.

A similar heuristic, turning "page groups" into a template count, was also too aggressive: 61 URL sections on volkswagen.co.uk became 25 templates. Page groups are not templates. It now uses a gentler rule and labels the number "check this".

### Stale values after a second report

Load the sample BPA report, then your own, and some fields kept values from the sample, still marked as auto-filled. A user would have trusted 38,500 assets that came from the wrong file. The fix tracks where each auto-filled value came from and resets it when a new report or site is loaded.

### Small things users notice first

- **"−100%".** A 5.9 MB photo reduced to 2.5 KB rounded to −100%, which looks like an error. It now rounds down and never shows 100%.
- **"−221% smaller".** Choosing PNG for a photo made files three times bigger, and the summary said so in nonsense. It now says "larger" and suggests a better format.
- **A comparison slider with no dividing line,** so you couldn't tell which side was which.
- **The word "null"** in empty lists.

### Mobile layouts that only broke on a phone

- **The estimator page was 502 pixels wide on a 390-pixel screen.** It's a classic CSS grid problem: a grid column grows to fit its widest child unless you tell it not to (`minmax(0, 1fr)`).
- **The summary table cut off its numbers** on mobile, because a shared table style stopped row headings wrapping.
- **On a blog post, one long inline code example** made the whole page scroll sideways on phones.

All three looked fine on a laptop.

### Two publishing bugs GitHub called successful

These weren't in the tools, but they came from the same workflow, and they're the ones I'd warn every Jekyll user about.

- **Template syntax inside code samples.** My post on AEM CDN configuration includes secret placeholders such as {% raw %}`${{EDGE_KEY}}`{% endraw %}. Jekyll's Liquid templating treats {% raw %}`{{ … }}`{% endraw %} as a variable and quietly replaced each one with nothing, so seven code samples showed a bare `$`. The fix is wrapping those blocks in Liquid's `raw` tags.
- **An unquoted colon in front matter.** A new page description containing "Mumbai: AEM as a Cloud Service…" made the YAML invalid. Jekyll didn't fail. It published the page without its layout: no styles, no navigation, no head. GitHub Pages reported the build as successful.

In both cases the only reliable check was looking at the live page. I couldn't run Jekyll locally (the Ruby dependencies wouldn't install on the version I had), so I added two checks before every push: parse all front matter as YAML, and search posts for {% raw %}`{{`{% endraw %} outside template links. Then I test the live page after every build.

## What I've learned about AI as a pair programmer

### It's a fast drafter and a thorough researcher

The research for the BPA buckets would have taken me much longer alone, particularly finding the documentation source on GitHub when the published pages wouldn't render. Drafting a CSV parser that handles quoted fields, line breaks inside values and a byte-order mark is tedious work AI does well.

### It doesn't know what it doesn't know about your users

Every bug above came from the gap between "works on the example" and "works for a real person on a real site". A five-minute wait, a misleading error, a stale number or a page that scrolls sideways on a phone. AI can fix all of these quickly once someone finds them. Finding them took real sites, real files and real screen sizes.

### Verification is the job now

My testing routine for every tool and post is now:

1. Local tests with realistic inputs and deliberately awkward ones (a non-BPA file, a CSV with quotes and line breaks, an SVG passed to an image optimiser).
2. Real public sites with different markup: Core Components, classic AEM and fully custom.
3. Live checks after publishing: desktop, mobile and dark mode, an accessibility scan, broken links, and template syntax leaking onto the page.
4. A regression check of the other tools whenever shared code like `kit.js` changes.

It's the same discipline I ask of AEM teams before go-live. My [go-live checklist]({{ '/blog/2026/11/aem-go-live-checklist/' | relative_url }}) and the [accessibility post]({{ '/blog/2026/11/accessibility-on-aem-fix-the-component-not-the-page/' | relative_url }}) apply to tools just as much as to sites.

### People keep the decisions

The migration estimator could have presented a single confident number. Instead, it shows a range (−15% to +30%), every driver behind every line, the assumptions, and editable rates labelled as my defaults. That's not a weakness of the tool; it's the point. An estimate is a judgement. The tool makes the judgement visible and quick to adjust, which is what I describe in [how to estimate an AEM project]({{ '/blog/2026/11/how-to-estimate-an-aem-project/' | relative_url }}).

The same principle runs through my post on [AI in AEM]({{ '/blog/2026/11/ai-in-aem-what-is-real-what-is-useful/' | relative_url }}): automate the drafting, keep a human accountable for what ships.

### Small, honest scope beats feature lists

Both tools shipped as a "version 1" with clear limits, stated on the page:

- The image optimiser uses the browser's encoders, so AVIF appears only where the browser can create it, and PNG optimisation is limited. I explain that in the FAQ and in my [image optimisation post]({{ '/blog/2026/11/image-optimisation-on-aem-dynamic-media-and-edge-delivery-services/' | relative_url }}).
- The estimator hasn't yet been run against a real client BPA report. It's built and tested on Adobe's documented format, a sample and edge cases, and it reads the system overview values defensively because their wording isn't documented. That's written down, not hidden.

## FAQ

**Which AI assistant did you use?**
An AI coding assistant (Claude Code) working in my site's repository. It researched, drafted code and tests, and ran the test suites. I set the scope, reviewed the code and decided what to ship.

**Why not use a framework or a backend?**
Because neither was needed. Each tool is one page and one script. A backend would add hosting, security and data-handling questions for no benefit to users, and would undermine the "never uploaded" promise.

**How do the tools read other websites?**
Through Jina Reader, which fetches public pages, robots.txt and sitemaps on the browser's behalf. The tools can't read pages behind a login. Where that matters, some tools let you paste the page's HTML instead.

**Are my files really not uploaded?**
For the image optimiser and the migration estimator, yes. Files are read with the browser's File API and processed in memory, and downloads are created in the browser. You can confirm it in your browser's network panel: the file never appears in a request.

**Would you build client tools the same way?**
For internal utilities like audits, calculators and converters, often yes. It's cheap to run and easy to trust. For anything that needs authentication, shared data or integrations, you need a backend, and the same testing discipline applies.

**Can AI build these tools without a developer?**
It can produce something that looks finished. Every issue in this post was found by testing against real sites and devices, and some (like the misleading error messages) were judgement calls about what users need. Someone has to own that.

## Closing thought

AI changed how fast I can go from idea to a working tool. It didn't change what makes a tool worth using: it has to be honest about what it knows, it has to work on the sites and screens people actually have, and it mustn't take risks with their data.

If you're building internal tools for an AEM programme, or want to talk through using AI in your delivery team without lowering the bar, [get in touch](/contact/).

### References

- [Using Best Practices Analyzer](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/cloud-migration/best-practices-analyzer/using-best-practices-analyzer) (Adobe Experience League)
- [Pattern detection documentation source](https://github.com/AdobeDocs/experience-manager-pattern-detection.en) (Adobe, GitHub)
- [Readiness phase in Cloud Acceleration Manager](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/cloud-acceleration-manager/using-cam/cam-readiness-phase) (Adobe Experience League)
- [Jina Reader](https://jina.ai/reader/) (Jina AI)
- [axe-core](https://github.com/dequelabs/axe-core) (Deque)
- [OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas) (MDN)
- [Playwright](https://playwright.dev/) (Microsoft)
- [Liquid raw tag](https://shopify.github.io/liquid/tags/template/#raw) (Shopify)

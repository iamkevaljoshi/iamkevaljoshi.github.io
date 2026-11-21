---
title: "Project: deliver optimised images"
description: "Take a page with a 4.2 MB hero and a 12-image gallery, choose a delivery option, make the images responsive and lazy, and measure the change with Lighthouse."
track: assets
level: 4
order: 25
minutes: 20
kind: project
outcome: "By the end you can fix a heavy image page by choosing a delivery option, writing responsive markup, and showing before and after numbers."
prereq: "All lessons in this level (19 to 24)."
terms:
  - { t: "Image budget", d: "A target for how many kilobytes of images a page may load, for example above the fold on mobile." }
  - { t: "Lighthouse", d: "A tool in Chrome DevTools and PageSpeed Insights that audits a page in a lab test and reports metrics such as LCP and CLS." }
  - { t: "Lab data and field data", d: "Lab data comes from one controlled test; field data comes from real visitors over time." }
  - { t: "Above the fold", d: "The part of the page visible without scrolling." }
mistake: "Declaring victory because one Lighthouse run on a fast laptop looks green. Lab runs vary, and visitors on mid-range phones and slow networks are the ones who decide whether you actually improved."
try_it:
  - "Record the baseline: run Lighthouse in mobile mode three times on the page and note LCP, total page weight and the transfer size of the hero. Keep the median."
  - "Write down the image inventory: the hero's pixel width and file size, and the 12 gallery images' sizes. Mark which is the LCP image and which are below the fold."
  - "Choose a delivery option from lesson 19 and write two sentences of justification. Name one option you rejected and why."
  - "Implement the hero: an eager image with `srcset`, a correct `sizes`, `width` and `height`, and `fetchpriority=\"high\"` where your platform guidance allows."
  - "Implement the gallery: `loading=\"lazy\"`, `width` and `height`, and a `sizes` value that matches the real grid, such as about a third of the width on desktop."
  - "Re-run Lighthouse three times and record the same metrics. Open the network panel and confirm the hero's format and natural width."
  - "Check you did not hurt anything: confirm no layout shift, alt text present, and the hero still sharp on a wide screen."
  - "Write the 'done' note: what you improved, the numbers, and what you would watch in field data after release."
quiz:
  - q: "Why measure before changing anything?"
    options:
      - "Lighthouse refuses to run on a page you have edited"
      - "Without a baseline you cannot show the change, or notice a regression"
      - "The baseline is needed to buy a Dynamic Media licence"
      - "Search engines require a saved baseline report"
    answer: 1
    why: "A baseline is the only proof of improvement and the only way to see if a fix backfired. Tools, vendors and search engines do not require it, it is just good practice."
  - q: "The gallery images are at the bottom of the page. Which setting is right for them?"
    options:
      - "Eager loading with high priority, like the hero"
      - "A CSS background, so the browser ignores them until needed"
      - "Lazy loading, with `width` and `height` set to avoid layout shift"
      - "Remove `width` and `height` so the browser can choose"
    answer: 2
    why: "Below-the-fold images can wait, and dimensions keep the layout stable as they arrive. Giving them hero priority competes with the real LCP image, and CSS backgrounds are found late."
  - q: "After optimising, the hero is 160 KB on mobile but LCP is still 3.4 s in the lab. What is the sensible next step?"
    options:
      - "Declare it a failure and revert every change you made"
      - "Assume the Lighthouse tool is broken and ignore it"
      - "Convert all the images to a much lower quality"
      - "Check the other LCP parts, such as server time, blocking CSS and late discovery"
    answer: 3
    why: "LCP has several parts, and image weight is only one. A small file can still be late if it is discovered late or blocked by other resources. Cutting quality further is a blunt tool and may not help."
  - q: "Which statement is NOT a good definition of done?"
    options:
      - "Hero loads eagerly and below-fold images lazily"
      - "Mobile LCP target of 2.5 s or better in repeated lab runs"
      - "LCP is guaranteed to be good for every visitor on every device"
      - "Image weight above the fold is within an agreed budget"
    answer: 2
    why: "Goals can be set and checked, but no one can guarantee results for every visitor, because networks, devices and caches vary. Done means meeting targets you measured, plus a plan to watch field data."
go_deeper:
  - { title: "Image optimisation on AEM: Dynamic Media, web-optimised delivery and Edge Delivery Services", url: "/blog/2026/11/image-optimisation-on-aem-dynamic-media-and-edge-delivery-services/", why: "the full playbook and how to measure" }
  - { title: "Image optimiser", url: "/tools/image-optimiser/", why: "resize, convert and get a srcset snippet" }
  - { title: "Web-optimised images and Core Web Vitals", url: "/learn/assets/web-optimised-images-and-core-web-vitals/", why: "the markup rules used here" }
  - { title: "Keep Lighthouse at 100 on Edge Delivery Services", url: "/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/", why: "if your project is on EDS" }
---
## The brief

A travel brand has a landing page with a **4.2 MB hero image**, uploaded straight from a photo shoot at 6000 pixels wide, and a **gallery of 12 images**, each about 800 KB. The page weighs nearly 14 MB of images. On a mid-range phone the hero appears after several seconds, and the gallery jumps as it loads.

Your job is to choose a delivery option, make the images responsive, correctly sized and sensibly loaded, and show before and after numbers.

**Environment is optional.** You can do this three ways:

- **With an AEM as a Cloud Service environment:** put the images in the DAM and use the Core Image component with web-optimised delivery enabled, or Dynamic Media if your licence has it.
- **With a plain HTML page on your machine:** use the [image optimiser](/tools/image-optimiser/) to create sizes and WebP files, and write the markup by hand. This is enough to learn the whole lesson.
- **On paper or in a spreadsheet:** fill in the table below with estimates and write the markup without running it.

## Pick the option

Use lesson 19's table. For this brief, with no stated Dynamic Media licence and one site, a good answer is: **web-optimised delivery with responsive widths** on AEM, or the **image optimiser plus `srcset`** on a plain page. Dynamic Media with smart crop is a fair choice if the brand wants a different mobile crop of the hero, and your licence allows it. Write down why.

## Build

Work through the steps in the **Try it** panel above. The hero needs these properties:

```html
<img src="hero-1200.webp"
     srcset="hero-480.webp 480w, hero-960.webp 960w, hero-1440.webp 1440w, hero-1920.webp 1920w"
     sizes="100vw"
     width="1920" height="1080"
     alt="Travellers on a mountain ridge at sunrise"
     fetchpriority="high">
```

Notice there is no `loading="lazy"`. The gallery images are the opposite:

```html
<img src="gallery-03-600.webp"
     srcset="gallery-03-400.webp 400w, gallery-03-800.webp 800w"
     sizes="(min-width: 1024px) 33vw, 100vw"
     width="800" height="600"
     alt="A market stall with spices"
     loading="lazy">
```

On AEM, the component produces most of this for you, but you still decide the policy: turn lazy loading off for the hero, and set widths that match your layout.

## Measure

Fill in a table like this, using the median of three Lighthouse mobile runs each time:

| Metric | Before | After | Goal |
|---|---|---|---|
| Hero transfer size | 4.2 MB | | under about 200 KB on mobile |
| Images loaded on first view | about 14 MB | | under about 500 KB above the fold |
| LCP (lab, mobile) | | | 2.5 s or better |
| Layout shift | | | close to 0 |

The goals are targets, not promises. Your numbers will depend on your network, device and page, so record what you saw.

## What good looks like

Score yourself honestly:

- The hero is eager, in the HTML, with dimensions and a correct `sizes`.
- Gallery images are lazy, with dimensions and a `sizes` that matches the grid.
- The hero is served as WebP, or AVIF if your tier allows it, and the downloaded width is close to the displayed width.
- You have before and after numbers, and a note on what to watch in field data after release.
- You noted at least one risk, such as the master being too small for large screens.

<details markdown="1">
<summary>Stretch question: what would you check next if LCP is still slow?</summary>

Look at the four parts of LCP. Server response time, a late-discovered hero, render-blocking CSS or scripts, and a long render delay can each hold the image back even when the file is small. Also check caching: a long TTL on a versioned URL means returning visitors skip the download altogether.

</details>

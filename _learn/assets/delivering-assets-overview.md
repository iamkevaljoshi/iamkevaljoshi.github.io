---
title: "Delivering assets: the options at a glance"
description: "Author versus delivery in AEM Assets, and the five ways to serve images and video to visitors: publish, web-optimised delivery, Dynamic Media, OpenAPI and EDS."
track: assets
level: 4
order: 19
minutes: 9
outcome: "By the end you can name the main ways to deliver an asset on AEM as a Cloud Service and pick one for a given need such as size, format, video, scale or licence."
prereq: "Renditions and processing profiles (lesson 13)."
terms:
  - { t: "Delivery", d: "Getting an asset from the DAM to a visitor's browser or app, fast and in a suitable size and format." }
  - { t: "Web-optimised image delivery", d: "A Cloud Service feature, used by the Core Image component, that serves DAM images as WebP from delivery paths under `/adobe`." }
  - { t: "Dynamic Media", d: "Adobe's on-demand image and video service, with Scene7 roots, that creates sizes, crops and formats from one master through URL parameters." }
  - { t: "Dynamic Media with OpenAPI", d: "A newer delivery model that serves approved assets by delivery URL, with search and delivery APIs for any front end." }
  - { t: "Master", d: "The original, high-quality file in the DAM from which every other size is made." }
mistake: "Assuming the DAM URL is the delivery URL. Linking a page to the author-tier original means visitors download a multi-megabyte master, and a rendition made for editors, not for the web."
try_it:
  - "Pick one hero image from a site you know and write down its displayed width on a phone and on a desktop."
  - "Open it in your browser's network panel and note the downloaded size, the format and the natural width."
  - "Using the decision table in this lesson, write which delivery option you would choose for it and why."
  - "List one need that would push you to a different option, such as video streaming or one asset library shared by three channels."
quiz:
  - q: "Which statement best describes the difference between author and delivery for assets?"
    options:
      - "Author is where people manage assets; delivery is how visitors get a suitable copy quickly"
      - "Author stores originals and delivery stores a second copy of the same bytes"
      - "Author is for images and delivery is only for video"
      - "Author and delivery are the same tier with different URLs"
    answer: 0
    why: "Author is the managing side, with masters, metadata and renditions. Delivery is about what the visitor receives. They are separate concerns, and the delivery path usually transforms the master rather than copying it."
  - q: "A team has Core Components and no Dynamic Media licence. They want smaller images quickly. What is the most sensible first step?"
    options:
      - "Buy Dynamic Media before touching anything else"
      - "Rebuild the site on Edge Delivery Services"
      - "Enable web-optimised images on the Image component and use responsive widths"
      - "Ask authors to shrink every image before upload"
    answer: 2
    why: "Web-optimised delivery needs no extra licence and gives WebP with responsive sizes for most Sites pages. Pre-shrinking masters causes blurry large images later, and a re-platform is far more than the problem needs."
  - q: "A retailer shares one governed asset library with an AEM site, an app and a commerce front end. Which option fits best?"
    options:
      - "Copy renditions into each channel's own repository"
      - "Dynamic Media with OpenAPI, so each channel references approved assets by delivery URL"
      - "Web-optimised delivery, because it is built into every front end"
      - "Embed images as base64 inside each page"
    answer: 1
    why: "Delivery URLs for approved assets let many channels use one governed source. Web-optimised delivery lives inside Core Components, so it does not serve an app or a commerce front end."
  - q: "Which statement is NOT true?"
    options:
      - "Dynamic Media can generate several crops from one master"
      - "A processing-profile rendition is a real file created once at upload"
      - "Edge Delivery Services can resize images authored in documents"
      - "Switching on one delivery option fixes image priority in your markup"
    answer: 3
    why: "Delivery options handle size, format and compression. Whether the hero is discovered early and loaded eagerly is decided by your component markup, which a delivery service cannot change."
go_deeper:
  - { title: "Image optimisation on AEM: Dynamic Media, web-optimised delivery and Edge Delivery Services", url: "/blog/2026/11/image-optimisation-on-aem-dynamic-media-and-edge-delivery-services/", why: "the full comparison this lesson summarises" }
  - { title: "Image optimiser", url: "/tools/image-optimiser/", why: "resize and convert images in your browser" }
  - { title: "Next lesson: Dynamic Media basics", url: "/learn/assets/dynamic-media-basics/" }
---
## One file, many visitors

A photographer hands over a 4000-pixel JPEG of a product. In the DAM it is a **master**: big, sharp, and kept safe. A visitor on a phone with a 390-pixel screen needs something very different, perhaps 800 pixels wide, in a modern format, in a few dozen kilobytes.

That gap is what this level is about. **Author** is where your team stores and governs the master. **Delivery** is what a visitor's browser actually receives. If you confuse them, you ship the master to every phone.

Think of a bakery. The author side is the kitchen where the big cake is made. Delivery is the box, size and ribbon the customer takes home. You do not hand over the whole cake each time.

## The options

AEM as a Cloud Service gives you several delivery paths. Adobe's names overlap, so this lesson keeps them apart.

1. **Serve from publish through Dispatcher and the CDN.** The plain path: a DAM image, or one of its stored renditions, is served from the publish tier and cached. You choose which rendition the page uses.
2. **Web-optimised image delivery.** In the Core Image component, a design-dialog setting serves DAM images as WebP through a delivery service. No extra licence. It only uses renditions up to 2048 pixels and does not upscale.
3. **Dynamic Media.** The long-standing service with Scene7 roots. It makes sizes, crops and quality on request from one master, and also handles video and viewers. It needs a licence.
4. **Dynamic Media with OpenAPI.** The newer model. Approved assets get delivery URLs that any front end can use. It also needs a licence, and enablement is a support request.
5. **Edge Delivery Services (EDS) image handling.** On EDS, images in documents are stored in a media pipeline and resized and converted to WebP for you, from the same origin as the page.

Two more things sit beside these. **Renditions from processing profiles** are real files created once at upload, useful when a print vendor or partner needs actual files. **Images in code**, such as CSS backgrounds, are touched by none of the above.

## A decision table

| Need | Good first choice |
|---|---|
| Smaller Sites images, no new licence | Web-optimised delivery plus responsive widths |
| Smart crop, presets, AVIF, many transformations | Dynamic Media (check your tier) |
| One governed library feeding many channels | Dynamic Media with OpenAPI |
| EDS site with ordinary authored images | EDS built-in image handling |
| Adaptive video streaming and viewers | Dynamic Media or the video features of the OpenAPI model |
| Fixed files for partners or print | Processing-profile renditions |
| Scale and low cost | Whatever the CDN can cache longest |

Licensing matters here. Dynamic Media, Dynamic Media with OpenAPI and parts of the web-optimised path depend on what your contract includes, and Adobe packages these as tiers called Prime and Ultimate. Names and tiers are still moving, so check Experience League and your Adobe contact before you design around a feature.

## Where the work really is

Whichever option you pick, three jobs remain: the right **size**, a modern **format** and sensible **compression**. Most options do those for you. A fourth job, the **priority** of the main image in the page, is always yours. The next lessons cover each option, then the markup, the caching and a project where you fix a heavy page.

<details markdown="1">
<summary>Stretch question: why not always pick the most capable option?</summary>

More capable usually means more cost, more setup and another origin or URL scheme to learn. A small brand site on Core Components gets most of the win from one checkbox. Choose the lightest option that meets the need, and revisit it when the need grows.

</details>

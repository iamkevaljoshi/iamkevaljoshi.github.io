---
layout: post
title: "Image optimisation on AEM: Dynamic Media, web-optimised delivery and Edge Delivery Services"
seo_title: "AEM Image Optimisation: Dynamic Media, WebP, AVIF and EDS"
description: "How to optimise images on AEM as a Cloud Service and Edge Delivery Services: Dynamic Media, Smart Imaging, web-optimised delivery, srcset, LCP and governance."
ai_summary: "Images are usually the Largest Contentful Paint element, so they decide Core Web Vitals on most AEM sites. AEM as a Cloud Service offers several layers: asset microservices renditions, web-optimised image delivery in Core Components (WebP, about 25% smaller), Dynamic Media with Smart Imaging (automatic AVIF or WebP, device pixel ratio and bandwidth optimisation, smart crop), and Dynamic Media with OpenAPI capabilities for approved-asset delivery URLs. Edge Delivery Services resizes and converts document images automatically. The post compares the options, explains srcset, sizes, lazy loading and fetchpriority for the LCP image, covers images in code and CSS, upload governance, and how to measure results with CrUX and Operational Telemetry."
date: 2026-11-08 09:00:00 +0530
category: aem-cloud-service
tags: [AEM as a Cloud Service, Dynamic Media, Edge Delivery Services, Core Web Vitals, Performance, Images]
---

On almost every AEM performance review I run, the slowest thing on the page is a picture. It's rarely the JavaScript or the server. It's a 3 MB hero image, uploaded straight from a photographer's shoot, delivered at 4000 pixels wide to a phone with a 390-pixel screen.

The frustrating part is that AEM as a Cloud Service already has most of what you need to fix it. The trouble is that it has *several* things, with overlapping names: renditions, web-optimised image delivery, Dynamic Media, Smart Imaging, Dynamic Media with OpenAPI capabilities, and Edge Delivery Services' own image handling. Teams switch on one, assume it covers everything, and wonder why the LCP image is still 900 KB.

This post is the map I wish every AEM team had. It explains **what each option does, when to use it, how to get the markup right for Largest Contentful Paint, what to do with images that live in code, and how to prove it worked.** If you just need to shrink a few files right now, my free [image optimiser]({{ '/tools/image-optimiser/' | relative_url }}) does it in your browser, without uploading anything.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **The image is usually your LCP element.** Google's "good" threshold is 2.5 seconds at the 75th percentile, and on content-led AEM sites the hero image decides whether you hit it.
- **There are four levers:** the right *size*, a modern *format*, sensible *compression*, and the right *priority* in the page. Most AEM features handle the first three; the fourth is your markup.
- **Web-optimised image delivery** in Core Components is the cheapest win on AEM Sites: one design-dialog checkbox, WebP delivery, about 25% smaller on average according to Adobe. No AVIF, and it only uses renditions up to 2048 px.
- **Dynamic Media with Smart Imaging** is the most complete option: automatic AVIF or WebP, device pixel ratio and bandwidth optimisation, presets and AI smart crop. It needs a Dynamic Media licence.
- **Dynamic Media with OpenAPI capabilities** delivers *approved* assets by URL to any front end, including Edge Delivery Services. Check your tier: Adobe's documentation says Smart Imaging doesn't support AVIF for Dynamic Media Prime customers.
- **Edge Delivery Services** already resizes document images and serves WebP through `createOptimizedPicture`. Use Dynamic Media only when you need smart crop or central asset governance.
- **Never lazy-load the LCP image,** always set `width` and `height`, and keep big images out of CSS backgrounds.
- **Measure with field data:** the LCP element in CrUX or Operational Telemetry, not just a Lighthouse run on your laptop.

## Why images decide your Core Web Vitals

Largest Contentful Paint measures when the biggest visible element finishes rendering. On a typical marketing or product page that's the hero image, and on article pages it's often the lead image. Google treats 2.5 seconds or less as good, measured at the 75th percentile of real visits.

[web.dev splits LCP into four parts](https://web.dev/articles/optimize-lcp), and images touch three of them:

![The four parts of Largest Contentful Paint for an image: time to first byte, resource load delay, resource load duration and element render delay, with the image fixes that apply to each]({{ '/assets/img/blog/aem-image-optimisation/02-lcp-image-anatomy.svg' | relative_url }}){: width="1200" height="520" loading="lazy" decoding="async"}

- **Resource load delay** is how long before the browser even *starts* fetching the image. Lazy-loading the hero, building it in JavaScript or putting it in a CSS background all add delay here.
- **Resource load duration** is the download itself. This is where size, format and compression matter.
- **Element render delay** is the gap between the download finishing and the image appearing. Render-blocking CSS, hidden containers and heavy scripts live here.

Images also cause **Cumulative Layout Shift** when they arrive without reserved space and push the content down. That one is pure markup: give every image `width` and `height` attributes, or an `aspect-ratio` in CSS.

So "optimise images" really means four separate jobs:

| Lever | Question | Typical owner on AEM |
|---|---|---|
| **Size** | Is the image delivered at roughly the size it's displayed, for each screen? | Renditions, `srcset`, Dynamic Media, EDS |
| **Format** | Is it AVIF or WebP where the browser supports it? | Web-optimised delivery, Smart Imaging, EDS |
| **Compression** | Is the quality setting sensible for the content? | Presets, processing profiles, EDS `optimize` |
| **Priority** | Is the LCP image discovered early and fetched first, and everything else deferred? | Your component or block markup |

## The options on AEM as a Cloud Service

![Where images are optimised in an AEM estate: assets in the DAM or documents, then one of asset microservices renditions, web-optimised image delivery, Dynamic Media with Smart Imaging, Dynamic Media with OpenAPI or the Edge Delivery Services media pipeline, then the CDN and the browser]({{ '/assets/img/blog/aem-image-optimisation/01-image-options-landscape.svg' | relative_url }}){: width="1200" height="660" loading="lazy" decoding="async"}

### 1. Asset microservices renditions

Every asset uploaded to AEM Assets is processed by **asset microservices**. The default processing creates thumbnails at 48, 140 and 319 pixels and a 1280-pixel web preview, according to [Adobe's documentation](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/manage/asset-microservices-configure-and-use). You can add **processing profiles** that create extra renditions in JPEG, PNG, GIF or **WebP**, with a quality value from 1 to 100 and maximum width and height.

Renditions are static files, created once at upload. They're useful when a fixed set of sizes is enough, or when a downstream system needs actual files. They're not a delivery strategy on their own: you still need markup that picks the right rendition per screen, and changing your breakpoints means reprocessing assets. Adobe recommends staying under 40 renditions per asset.

### 2. Web-optimised image delivery (Core Components)

For AEM Sites with the Core Components Image component, this is the quickest win available. Turn on **"Enable Web Optimized Images"** in the Image component's design dialog (v1, v2 and v3 support it), and AEM serves DAM images as **WebP** through a delivery service under `/adobe/...` paths. [Adobe's documentation](https://experienceleague.adobe.com/en/docs/experience-manager-core-components/using/developing/web-optimized-image-delivery) quotes an average size reduction of about 25%.

What I tell teams about it:

- **It's content negotiation, not new markup.** Browsers that accept WebP get WebP; others get the original JPEG or PNG. URLs keep their original extension, which confuses people checking in DevTools. Look at the `Content-Type` response header instead.
- **It only uses renditions up to 2048 px** and never upscales. Assets without a large enough rendition are served smaller than you expect, so make sure assets have a 2048-pixel rendition and reprocess older ones.
- **Source limits are 50 MB and 12,000 × 12,000 pixels.**
- **Only images under `/content/dam`** use it. Images stored under a page fall back to the Adaptive Image Servlet.
- **Check your Dispatcher filters.** Adobe notes that Dispatcher rules can block the `/adobe` delivery paths. It's the first thing I check when the checkbox "doesn't work".
- **It's WebP only** in the documentation I could find, with no AVIF and no smart crop. It's also Cloud Service only: AEM 6.5 and the local SDK fall back to the Adaptive Image Servlet.
- **Custom components** can use the same service through `AssetDelivery.getDeliveryURL()`.

Pair it with the Image v3 **Widths** setting, which generates a `srcset` so the browser picks a sensible size, and you've covered size and format for most AEM Sites pages with no extra licence.

### 3. Dynamic Media with Smart Imaging

Dynamic Media (the Scene7 heritage image server) generates any size, crop and quality on request from a single master, through URL modifiers and **image presets**. Its **Smart Imaging** feature is the most complete optimisation on the platform. According to Adobe's [Smart Imaging FAQ](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/dynamicmedia/imaging-faq):

- **Automatic format conversion.** JPEG and PNG sources are served as AVIF where the browser supports it, then WebP, with older fallbacks. It never serves a file bigger than the source. Adobe reports AVIF up to 41% smaller than JPEG on average in its tests, and WebP 27% smaller.
- **Device pixel ratio optimisation.** Sharp images on high-density screens, adjustable with `dpr=on,<value>` or turned off with `dpr=off`.
- **Network bandwidth optimisation.** Quality adapts to the connection, turned off with `network=off`.
- **Format choice is account-level.** You can't request WebP or AVIF in a modifier, and Smart Imaging ignores the `fmt` and `qlt` commands. Turning AVIF off or changing defaults is a support case.
- **Caching:** Adobe recommends a TTL of at least 24 hours. Enabling or changing Smart Imaging clears the CDN cache, and Adobe says it usually takes one to two days to rebuild, so don't switch it on the week of a launch.

Dynamic Media's other strength is **smart crop**. An [image profile](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/dynamicmedia/image-profiles) applied to a DAM folder uses Adobe's AI to find each image's focal point and creates crops per breakpoint (Large, Medium and Small by default). Adobe recommends up to five smart crops per image, with a hard limit of 100. In the Image v3 component, enable "Enable DM features" in the design dialog and pick **Smart Crop** as the preset type.

This is art direction at scale: a landscape hero on desktop and a tighter, face-centred crop on mobile, without designers cropping every image by hand.

### 4. Dynamic Media with OpenAPI capabilities

The newer model, [Dynamic Media with OpenAPI capabilities](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/dynamicmedia/dynamic-media-open-apis/dynamic-media-open-apis-overview), exposes **approved, latest-version** assets from AEM Assets through search and delivery APIs. Each approved asset gets a delivery URL that accepts image modifiers such as width, height, rotate, flip, quality, crop, format and smart crop. Front ends reference assets by URL rather than copying binaries.

Things to know before you design around it:

- **Licensing:** Adobe lists AEM Assets as a Cloud Service and AEM Dynamic Media as prerequisites, and enablement is a support ticket. Adobe's 2025 packaging describes **Dynamic Media Prime** (including the OpenAPI capabilities) and **Dynamic Media Ultimate** (more delivery and transformation features). Prime customers get a basic modifier set, and the overview states that Smart Imaging doesn't support AVIF for Prime. Confirm what your contract includes.
- **Approval is the gate.** Only assets marked approved are delivered. That's a governance feature: brand teams control what front ends can use.
- **Caching:** Adobe quotes a 10-minute CDN TTL, so changes to approved assets appear in under 10 minutes.
- **Production is enabled per environment,** according to an Adobe knowledge base article, so plan the support ticket for production separately from dev and stage.

This is the right choice when several channels (an AEM site, an EDS site, an app, a commerce front end) should all use the same governed assets.

### 5. Edge Delivery Services

Edge Delivery Services handles images on its own. Images added to documents or through Universal Editor are stored in the media pipeline with content-hashed names such as `media_<hash>.jpg`, and served from the same origin as the page. The boilerplate's [`createOptimizedPicture`](https://github.com/adobe/aem-boilerplate/blob/main/scripts/aem.js) builds a `<picture>` element with:

- a WebP source for each breakpoint, requested as `?width=…&format=webply&optimize=medium`;
- a fallback in the original format;
- default breakpoints of 2000 px for screens 600 px and wider, and 750 px below that;
- `loading="lazy"` unless the image is marked eager.

The boilerplate also loads the first section eagerly and treats its first image as the LCP candidate. Because the media comes from the same origin, there's no extra connection before LCP. That's a large part of why EDS pages can reach a Lighthouse score of 100, as I cover in [keeping Lighthouse at 100 on EDS]({{ '/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/' | relative_url }}).

Two adjustments I make on most EDS projects:

- **Tune the breakpoints per block.** A 2000-pixel image in a three-column card grid is wasted bytes. Pass smaller breakpoints from the block's code.
- **Use Dynamic Media only when you need it.** Adobe's own [EDS integration guidance](https://experienceleague.adobe.com/en/docs/experience-manager-learn/sites/document-authoring/how-to/using-dynamic-media) positions Dynamic Media with OpenAPI for needs such as smart crop and brand-approved assets. Delivering from a second origin before LCP adds a connection, so measure the hero carefully if you switch it to Dynamic Media.

## Which option should you use?

| Situation | My default | Why |
|---|---|---|
| AEM Sites with Core Components, no Dynamic Media licence | **Web-optimised image delivery** plus Image v3 Widths | WebP and responsive sizes from a checkbox |
| AEM Sites with Dynamic Media | **Dynamic Media with Smart Imaging**, smart crop for heroes | AVIF, DPR and bandwidth optimisation, art direction |
| Edge Delivery Services site, authored images | **EDS built-in** (`createOptimizedPicture`) with tuned breakpoints | Same origin, no licence, already WebP |
| EDS site needing smart crop or governed brand assets | **Dynamic Media with OpenAPI** for those images | Approved assets, crops; keep the hero same-origin if LCP suffers |
| Several channels sharing one asset library | **Dynamic Media with OpenAPI** | One governed source, delivery URLs for every front end |
| Files needed by downstream systems (print, partners, email) | **Processing profile renditions** | Real files, created once |
| Images in code, CSS or email | **Optimise before commit** (the [image optimiser]({{ '/tools/image-optimiser/' | relative_url }}) or your build) | Nothing on the platform touches them |

If you're still deciding between EDS and traditional AEM as a Cloud Service, image handling is one of the trade-offs I cover in [EDS vs traditional AEMaaCS]({{ '/blog/2026/11/aem-edge-delivery-services-vs-traditional-aemaacs/' | relative_url }}).

## Getting the markup right

The best image pipeline in the world can't fix bad markup. These are the rules I put in component and block definitions of done.

### Responsive sizes: `srcset` and `sizes`

`srcset` lists the available widths; `sizes` tells the browser how wide the image will be displayed, so it can choose before layout is known. Getting `sizes` wrong is the most common reason a phone downloads the desktop image.

```html
<img src="/content/dam/acme/hero.jpg"
     srcset="/content/dam/acme/hero.jpg?w=480 480w,
             /content/dam/acme/hero.jpg?w=960 960w,
             /content/dam/acme/hero.jpg?w=1440 1440w,
             /content/dam/acme/hero.jpg?w=1920 1920w"
     sizes="(min-width: 1200px) 1200px, 100vw"
     width="1920" height="1080"
     alt="Engineers reviewing a site plan on a tablet">
```

The URL pattern depends on your delivery option; the structure doesn't. For a card in a three-column grid, `sizes` should say something like `(min-width: 1024px) 33vw, 100vw`, not `100vw`.

### The LCP image: eager, discoverable, prioritised

- **Never lazy-load it.** web.dev is blunt: lazy-loading the LCP image "will always lead to unnecessary resource load delay". In the Image v3 component, lazy loading is on by default, so hero components need **"Disable lazy loading"** in their policy, or a dedicated hero component.
- **Put it in the HTML.** An `<img>` in the server-rendered markup is discovered immediately. One built by JavaScript or referenced from CSS is discovered late.
- **Use `fetchpriority="high"` on one image, carefully.** web.dev recommends it for the expected LCP image on traditional pages. aem.live's guidance for EDS is different: because the boilerplate already loads the first section's image first, it notes that `preload` and `fetchpriority` don't improve LCP in PageSpeed Insights and can hurt. Use it on AEM Sites heroes; on EDS, trust the eager phase and measure before adding it.
- **One hero, not two.** Separate desktop and mobile hero images in the same markup can make the browser download the wrong one first. Use `<picture>` with `media` (or Dynamic Media smart crop) instead of hiding one with CSS.

### Layout stability

Always output `width` and `height` (or `aspect-ratio`). Core Components and `createOptimizedPicture` handle this for authored images; custom components and blocks are where it gets forgotten.

### Alt text

Performance work is a good moment to fix accessibility too. Image v3 can take alt text from the DAM description, and decorative images should have an empty `alt=""`. My [accessibility post]({{ '/blog/2026/11/accessibility-on-aem-fix-the-component-not-the-page/' | relative_url }}) explains why fixing it in the component scales.

## Images in code and CSS

None of the AEM pipelines touch images committed to your code repository: background images in CSS, icons, logos, decorative shapes in client libraries or EDS block folders. I regularly find 400 KB PNG backgrounds in `clientlib-site` or a block's directory.

- **Icons and logos:** use SVG, minified with SVGO. EDS projects already keep icons in `/icons` as SVG.
- **Photos in CSS backgrounds:** convert to WebP or AVIF, size them for the largest display, and use `image-set()` to offer formats:

```css
.promo-banner {
  background-image: image-set(
    url("banner-1440.avif") type("image/avif"),
    url("banner-1440.webp") type("image/webp"),
    url("banner-1440.jpg") type("image/jpeg"));
}
```

- **Don't put the LCP image in CSS.** It's discovered late. If a design insists, preload it.
- **Optimise before you commit.** My [image optimiser]({{ '/tools/image-optimiser/' | relative_url }}) converts and resizes in the browser and gives you the `srcset` snippet. A build step (for example, sharp in a front-end pipeline) does the same for larger teams.
- **Check in code review.** A simple CI rule that fails any committed image over, say, 200 KB catches most regressions.

## Governance: stop the problem at upload

Delivery optimisation fixes the bytes on the wire. Governance stops authors creating new problems.

| Rule | Why |
|---|---|
| **Upload high-quality masters to the DAM**, not pre-shrunk copies | Dynamic Media and renditions create every size from the master. A 900-pixel upload can't produce a sharp 1920-pixel hero |
| **Make sure a 2048-pixel rendition exists** if you use web-optimised delivery | The service won't upscale and only uses renditions up to 2048 px |
| **Name and describe assets properly** | Description metadata can become alt text; good names help search and SEO |
| **Approve assets deliberately** with Dynamic Media with OpenAPI | Only approved assets are delivered |
| **Define hero and card aspect ratios in the design system** | Smart crop and `sizes` both depend on knowing the shapes in advance |
| **For EDS documents, avoid huge screenshots and pasted print files** | The pipeline resizes them, but authors still upload, preview and copy multi-megabyte files |
| **Publish an author guide:** formats, minimum sizes, alt text, no text baked into images | Most image problems start with a well-meaning author |

## How to measure success

Lab tests on a fast laptop flatter everyone. Measure what real visitors experience.

1. **Identify the LCP element.** PageSpeed Insights shows it for the lab run and reports field LCP from the Chrome UX Report (CrUX). On EDS, [Operational Telemetry](https://www.aem.live/docs/rum) records LCP per page view, and the OpTel Explorer lets you filter by page and device.
2. **Check what's actually delivered.** In DevTools, look at the hero's `Content-Type` (`image/avif` or `image/webp`), its transfer size, and its natural width compared with its displayed width. A 1920-pixel image in a 390-pixel slot is a `sizes` problem.
3. **Check the headers.** Dynamic Media sends an `X-Adobe-Smart-Imaging` header; Adobe's FAQ explains how to read it and how to refresh an outdated cached URL with `cache=update`.
4. **Track the 75th percentile LCP over 28 days,** split by mobile and desktop. That's what Google uses, and what you report to the business.
5. **Watch total image weight per template.** A simple budget, such as "under 500 KB of images above the fold on mobile", is easy to explain and to test in CI.

For the CDN side, caching headers and what belongs at the edge, see my post on [the AEMaaCS CDN and cdn.yaml]({{ '/blog/2026/11/aem-cloud-service-cdn-yaml-headers-proxy-redirects/' | relative_url }}).

## Common mistakes I see

- **Turning on web-optimised delivery and assuming it covers everything.** It doesn't touch images in code, images under pages, or the LCP priority.
- **Lazy-loading the hero** because the Image component does it by default.
- **`sizes="100vw"` everywhere,** so card images download at full-screen width.
- **Two hero images,** one hidden on mobile.
- **Enabling Smart Imaging the week of go-live,** then wondering why the origin is busy while the cache rebuilds.
- **Uploading pre-shrunk images** to save DAM space, then getting blurry heroes on large screens.
- **Big PNG photos in client libraries** that no pipeline ever optimises.

## FAQ

**Do I need Dynamic Media to get WebP on AEM as a Cloud Service?**
No. Web-optimised image delivery in Core Components serves WebP without a Dynamic Media licence. You need Dynamic Media for AVIF through Smart Imaging, smart crop and on-the-fly transformations.

**Is AVIF worth it over WebP?**
Often, for photos. Adobe's Smart Imaging tests show AVIF about 20% smaller than WebP on average. Browser support is broad but not universal, which is why automatic negotiation (Smart Imaging, or `<picture>` with a WebP fallback) is the safe way to use it. Check whether your Dynamic Media tier includes AVIF.

**Does Edge Delivery Services need Dynamic Media?**
Not for most images. EDS already resizes document images and serves WebP from the same origin. Dynamic Media with OpenAPI makes sense for smart crop, approved brand assets and assets shared across channels.

**Should I compress images before uploading them to the DAM?**
No, upload good masters and let delivery do the work. The exception is images that bypass the DAM: files in code, CSS and email.

**Why does my "WebP" image still have a .jpg URL?**
Web-optimised delivery and Smart Imaging use content negotiation, so the URL keeps the original extension. Check the `Content-Type` response header.

**What quality setting should I use?**
For photos, 75–82 is usually indistinguishable from the original at a fraction of the size. Use a side-by-side comparison, such as the one in my [image optimiser]({{ '/tools/image-optimiser/' | relative_url }}), to check your own content.

## Closing thought

Image optimisation on AEM isn't one feature. It's four jobs (size, format, compression and priority) spread across the DAM, the delivery service, your components and your authors. AEM as a Cloud Service and Edge Delivery Services handle the first three very well once they're switched on and configured. The fourth, getting the LCP image discovered and fetched first, is still down to your markup.

My standard order on projects: **enable the delivery option you're licensed for, fix the hero's markup, tune `sizes` per component, clean up images in code, then put upload guidance in front of authors.** That sequence usually moves LCP more than any other single piece of performance work.

If your AEM pages are heavier than they should be, or you're choosing between Dynamic Media and the built-in options, [get in touch](/contact/).

### References

- [Web-optimized image delivery](https://experienceleague.adobe.com/en/docs/experience-manager-core-components/using/developing/web-optimized-image-delivery) (Adobe Experience League)
- [Image component (v3)](https://experienceleague.adobe.com/en/docs/experience-manager-core-components/using/wcm-components/image) (Adobe Experience League)
- [Smart Imaging FAQ](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/dynamicmedia/imaging-faq) (Adobe Experience League)
- [Image profiles and smart crop](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/dynamicmedia/image-profiles) (Adobe Experience League)
- [Dynamic Media with OpenAPI capabilities](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/dynamicmedia/dynamic-media-open-apis/dynamic-media-open-apis-overview) (Adobe Experience League)
- [Release notes 2025.2.0: Dynamic Media Prime and Ultimate](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/release-notes/release-notes/2025/release-notes-2025-2-0) (Adobe Experience League)
- [Asset microservices and processing profiles](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/manage/asset-microservices-configure-and-use) (Adobe Experience League)
- [Using Dynamic Media in Edge Delivery Services](https://experienceleague.adobe.com/en/docs/experience-manager-learn/sites/document-authoring/how-to/using-dynamic-media) (Adobe Experience League)
- [Keeping it 100: web performance](https://www.aem.live/developer/keeping-it-100) (aem.live)
- [AEM boilerplate `aem.js`](https://github.com/adobe/aem-boilerplate/blob/main/scripts/aem.js) (Adobe, GitHub)
- [Optimize Largest Contentful Paint](https://web.dev/articles/optimize-lcp) (web.dev)

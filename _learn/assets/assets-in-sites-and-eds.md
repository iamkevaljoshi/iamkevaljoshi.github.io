---
title: "Using assets in Sites and Edge Delivery Services"
description: "How DAM assets reach pages: the Core Image component, adaptive images, fragments, and images on Edge Delivery Services, with AEM Assets as a possible source."
track: assets
level: 4
order: 24
minutes: 9
outcome: "By the end you can say how an asset is referenced in a Sites page, a Content Fragment and an EDS page, and which option to trust for each."
prereq: "Delivering assets: the options at a glance (lesson 19)."
terms:
  - { t: "Core Image component", d: "The standard Core Component for images; it references a DAM asset and can produce responsive, optimised output." }
  - { t: "Adaptive image", d: "A size-appropriate version of an image produced for the page, rather than the original file." }
  - { t: "Content Fragment", d: "Structured content, which can hold an image reference, used by many channels." }
  - { t: "`createOptimizedPicture`", d: "An Edge Delivery Services boilerplate function that builds a `<picture>` element with resized, WebP sources." }
  - { t: "Media bus", d: "Edge Delivery Services' store for images and other media, which serves them under content-hashed names." }
mistake: "Pasting an image URL into a rich text field instead of referencing the asset. The page then points at a fixed copy, loses the DAM's usage tracking and renditions, and breaks when the asset moves."
try_it:
  - "List the places the same hero image could appear: a Sites page, a Content Fragment, an Experience Fragment, an EDS page."
  - "For each, write whether it stores a reference to the asset or a copy of the file."
  - "Look at the Image component's design dialog in your project (or its Core Components documentation) and note which options affect delivery, such as widths or web-optimised images."
  - "Open any EDS page's DevTools, find the hero's `src` and note whether the name contains a hash and which width parameter it requests."
quiz:
  - q: "Why reference a DAM asset in the Image component instead of pasting its URL?"
    options:
      - "A pasted URL cannot be displayed"
      - "The component only accepts JPEG files"
      - "A reference keeps usage tracking and lets the platform produce suitable sizes"
      - "References are the only way to set alt text"
    answer: 2
    why: "A reference ties the page to the asset, so renditions, delivery options and usage reports work. A pasted URL may display, but it bypasses all of that. Alt text can be set either way."
  - q: "On an EDS page, how do images in a document usually end up fast and small?"
    options:
      - "Authors resize each image by hand before inserting it"
      - "The media pipeline stores them under hashed names and the block requests resized WebP"
      - "A CSS rule shrinks the file on the visitor's device"
      - "EDS refuses any image over 100 KB"
    answer: 1
    why: "EDS serves images from the same origin under content-hashed names, and helpers such as `createOptimizedPicture` ask for resized WebP. CSS only changes display size, not the download."
  - q: "A brand wants one governed asset library to feed its EDS site. What should you say?"
    options:
      - "It is impossible, since EDS only uses its own media"
      - "It works automatically with no setup needed"
      - "Authors must email assets to developers"
      - "Integration options exist, but verify the current approach"
    answer: 3
    why: "Adobe documents ways to use AEM Assets with EDS, for example choosing approved assets through the assets selector, but the details and tiers are still changing. Saying it is impossible or automatic are both wrong."
  - q: "Which statement is NOT true?"
    options:
      - "A Content Fragment can reference an image and share it with several channels"
      - "An Experience Fragment can contain a component that references an asset"
      - "A hero image on a page should normally be lazy loaded"
      - "Moving an asset can break a copied URL but not a managed reference"
    answer: 2
    why: "The hero is usually the LCP image and should load eagerly. The other statements are true: fragments carry references, and references can be tracked while copied URLs cannot."
go_deeper:
  - { title: "Fonts, icons and images (Edge Delivery Services)", url: "/learn/eds/fonts-icons-images/", why: "how EDS handles images in blocks" }
  - { title: "Core Components: use, proxy and extend", url: "/learn/aem/core-components/", why: "the Image component's place in a project" }
  - { title: "Image optimisation on AEM: Dynamic Media, web-optimised delivery and Edge Delivery Services", url: "/blog/2026/11/image-optimisation-on-aem-dynamic-media-and-edge-delivery-services/", why: "EDS breakpoints and Dynamic Media with OpenAPI" }
  - { title: "Experience Fragments", url: "/learn/aem/experience-fragments/", why: "reusable page sections that carry assets" }
---
## The problem: the asset is in the DAM, the visitor is on a page

An asset is only useful once it appears somewhere. The question is how the page and the asset are tied together, because that decides whether sizes, formats and updates are handled for you.

## In AEM Sites

In a Sites page, an author usually drops an **Image component** and picks an asset from the DAM. The component stores a **reference** to the asset path, not a copy.

That reference lets the component do work. The Core Image component (version 3 supports it, per the Core Components documentation) can produce an **adaptive image**: a srcset with sizes suited to the page, using the **Widths** setting. With web-optimised images enabled in its design dialog, it serves WebP from the delivery service. With Dynamic Media enabled, it can use presets and smart crop. The component pulls alt text from the asset's description if the author lets it, which is why good metadata matters for accessibility too.

Because the page holds a reference, the DAM can also tell you where an asset is used, which is useful when you need to retire it.

## In Content Fragments and Experience Fragments

A **Content Fragment** holds structured content, and a field can reference an image. A website and an app can then read the same fragment and each request a size suited to its channel. In headless delivery, the front end builds the image URL, so it must choose the delivery option itself, for example a delivery URL for the approved asset with width and quality modifiers.

An **Experience Fragment** is a reusable section, such as a promo, made of components. If one of those is an Image component, the fragment carries the reference, and every page using the fragment gets the same asset. Update the asset, and the fragment's image changes with it, subject to caching.

## On Edge Delivery Services

EDS works differently, because authors write documents. An image inserted into a document goes to the **media bus**, which stores media under content-hashed names such as `media_<hash>.jpg`, served from the same origin as the page. The boilerplate's `createOptimizedPicture` function then builds a `<picture>` with sources at set breakpoints, WebP where supported, and lazy loading unless the image is marked eager.

```js
import { createOptimizedPicture } from '../../scripts/aem.js';

const pic = createOptimizedPicture(img.src, img.alt, false, [
  { media: '(min-width: 600px)', width: '1200' },
  { width: '600' },
]);
img.closest('picture').replaceWith(pic);
```

Passing smaller widths from a block, such as a card block, avoids sending a 2000-pixel image to a small slot. The [Fonts, icons and images lesson](/learn/eds/fonts-icons-images/) covers this in the EDS course.

## When AEM Assets should be the source

For many EDS sites the built-in media handling is enough. Reasons to bring in AEM Assets include shared brand assets across channels, approval control and smart crop.

Adobe documents integration through the assets selector, which lets authors browse and pick approved assets from AEM Assets and use their delivery URLs, with Dynamic Media with OpenAPI providing the delivery. Adobe's own guidance positions it for needs such as smart crop and brand-approved assets. Because delivery then comes from a second origin, measure the hero image carefully, since an extra connection before the largest paint can cost time.

I could not confirm every current detail of this integration, such as exact setup steps and which tiers include each feature. These details have changed recently, so check the aem.live documentation and Experience League before you plan work around them.

<details markdown="1">
<summary>Stretch question: which should the hero on an EDS site use, hashed same-origin media or a delivery URL from Assets?</summary>

Start with the same-origin media, because it avoids a connection to a second host before the page's largest paint. Move to a delivery URL only if you need smart crop or central governance, and then measure LCP before and after. Smaller images lower in the page are lower risk to move first.

</details>

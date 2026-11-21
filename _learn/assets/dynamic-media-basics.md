---
title: "Dynamic Media basics"
description: "What Dynamic Media is, how image presets, smart crop and URL parameters work, how video is delivered, what it costs you in licence terms, and when it is overkill."
track: assets
level: 4
order: 20
minutes: 10
outcome: "By the end you can explain how Dynamic Media turns one master into many renditions through a URL, and decide whether a project needs it."
prereq: "Delivering assets: the options at a glance (lesson 19)."
terms:
  - { t: "Dynamic Media", d: "Adobe's service that creates image and video output on request from one master, delivered through a CDN-backed URL." }
  - { t: "Scene7", d: "The product Dynamic Media grew out of; its URL style, with parameters such as `wid` and `hei`, is still visible today." }
  - { t: "Image preset", d: "A named set of size, format and quality settings, applied by name instead of repeating many parameters." }
  - { t: "Smart crop", d: "AI-based cropping that finds an image's focal point and makes crops for different screen sizes." }
  - { t: "Viewer", d: "A ready-made player for video, image zoom or spin sets that you embed in a page." }
mistake: "Switching Dynamic Media on and assuming every image on the site now uses it. Only assets published to Dynamic Media, and components set up to use it, get the benefit."
try_it:
  - "Write the URL for a 600 pixel wide copy of an image using `?wid=600` on a made-up Dynamic Media path, then change it to 300."
  - "List three sizes your site needs for a product image and give each a preset name such as `card`, `hero` and `thumb`."
  - "Sketch the mobile and desktop crop of one portrait-subject photo and mark where the face sits in each."
  - "Decide: would a 20-page brand site with ten images need Dynamic Media? Write two reasons for your answer."
quiz:
  - q: "What is the core idea of Dynamic Media?"
    options:
      - "Authors manually save every size of every image in advance"
      - "A video player that has no image features"
      - "One master asset, with sizes, crops and formats created on request"
      - "A cache for Dispatcher rules"
    answer: 2
    why: "Dynamic Media makes outputs on demand from a single master, driven by URL parameters or presets. Pre-saving every size is the renditions approach, and it is not specific to Dynamic Media."
  - q: "Your marketing team changes the mobile hero from 750 to 640 pixels wide. With an image preset used everywhere, what is the least work?"
    options:
      - "Edit the preset once and every image using it follows"
      - "Reprocess every asset in the DAM"
      - "Edit every page that shows a hero"
      - "Upload new masters for each image"
    answer: 0
    why: "A preset is a named bundle, so changing it changes every use. Static renditions would need reprocessing, which is exactly the cost presets avoid."
  - q: "A brand site has ten images, one author and no video. What is the most reasonable view of Dynamic Media?"
    options:
      - "It is required for any site on AEM as a Cloud Service"
      - "It is probably overkill, since cheaper options meet the need"
      - "It is the only way to get responsive images"
      - "It must be used so that Lighthouse can pass"
    answer: 1
    why: "Dynamic Media earns its cost at scale, with smart crop, video or many transformations. Responsive images and WebP are also available without it, so for ten images it is usually more than the site needs."
  - q: "Which statement about licensing is accurate?"
    options:
      - "Dynamic Media features are included in every AEM Assets deployment"
      - "Licence only matters for video, never for images"
      - "Dynamic Media needs no setup beyond uploading assets"
      - "Dynamic Media depends on your Adobe licence, so confirm entitlement before designing around it"
    answer: 3
    why: "Dynamic Media is a licensed capability, and tiers differ in what they include. Designing a project around smart crop or AVIF without checking entitlement is a common and costly surprise."
go_deeper:
  - { title: "Image optimisation on AEM: Dynamic Media, web-optimised delivery and Edge Delivery Services", url: "/blog/2026/11/image-optimisation-on-aem-dynamic-media-and-edge-delivery-services/", why: "Smart Imaging, smart crop and caching details" }
  - { title: "Next lesson: Dynamic Media with OpenAPI", url: "/learn/assets/dynamic-media-with-openapi/" }
  - { title: "Image optimiser", url: "/tools/image-optimiser/", why: "see what size and format do to file weight" }
---
## The problem: sizes you cannot predict

A retailer has 200,000 product images. The site shows each at three sizes today, but a redesign will add a fourth, and a new app needs a fifth. Saving every size in advance means reprocessing 200,000 assets each time the design changes.

Dynamic Media takes a different approach. You keep **one master**, and the service creates the size you ask for **when someone asks for it**, then a CDN caches the result.

## How it works

Dynamic Media grew out of **Scene7**, a long-standing image server. That heritage shows in the URLs. A request looks something like this, with a made-up host and company name:

```text
https://example.scene7.com/is/image/acmeco/boots-red?wid=600&hei=400
https://example.scene7.com/is/image/acmeco/boots-red:Small
https://example.scene7.com/is/image/acmeco/boots-red?$card$
```

The first asks for a 600 by 400 version. The second asks for a named **smart crop**. The third applies an **image preset** named `card`. Exact syntax and available parameters depend on your setup, so treat these as the shape of the idea and read your own account's documentation.

The flow is: an author uploads a master to AEM Assets, the asset is **published to Dynamic Media**, and the Dynamic Media servers deliver it from a URL. That publishing step is separate from publishing to the AEM publish tier. This is the source of the mistake above: an asset that was never published to Dynamic Media has no Dynamic Media URL.

## The four features that matter

- **Image presets.** A named bundle such as `card` or `hero`. You change the preset once and all uses follow.
- **Smart crop.** An image profile applied to a DAM folder uses AI to find the focal point and make crops for breakpoints, such as Large, Medium and Small. This is art direction at scale: a wide desktop hero and a tighter, face-centred mobile crop, without a designer cropping every file.
- **Dynamic URL parameters.** Width, height, crop, quality and many more, set in the URL. Some formats are chosen automatically. With Smart Imaging, Adobe documents automatic AVIF or WebP choice by browser support, and says a requested `fmt` is ignored, so do not rely on forcing a format.
- **Video and viewers.** Dynamic Media can deliver adaptive-bitrate video and provides ready-made viewers for video, zoom and spin sets. Adaptive streaming adjusts quality to the visitor's connection, which is hard to build well yourself.

In an AEM Sites page, the Core Image component can use these when "Enable DM features" is turned on in its design dialog and you pick a preset type such as Smart Crop. Check the Core Components documentation for the current options.

## Licence and when it is overkill

Dynamic Media is a licensed capability. Adobe now packages the area as tiers (Prime and Ultimate), and the advanced features, including smart crop, Smart Imaging and image presets, are listed with the higher tier at the time of writing. The names and boundaries have changed more than once, so confirm what your contract includes on Experience League and with your Adobe team before you promise a feature.

It is worth it when you have large catalogues, many channels, video at scale, or a design that changes sizes often. It is overkill for a small brand site with a handful of images, where web-optimised delivery and sensible responsive markup get most of the benefit at no extra licence.

<details markdown="1">
<summary>Predict first, then reveal: what happens if you replace the master?</summary>

Think about the CDN. Dynamic Media derives every output from the master, so a new master can produce new outputs. But outputs already cached by the CDN keep being served until they expire or are refreshed. Adobe's Smart Imaging documentation describes a way to refresh an outdated cached URL. The caching lesson later in this level goes into why replaced images can look stale.

</details>

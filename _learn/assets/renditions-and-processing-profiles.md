---
title: "Renditions and processing profiles"
description: "What renditions are, which ones AEM Assets as a Cloud Service creates by default, and how processing profiles add custom sizes and formats to a folder."
track: assets
level: 3
order: 13
minutes: 10
outcome: "By the end you can explain which renditions every upload gets, and decide when a folder needs a processing profile and what it should contain."
prereq: "Uploading and ingesting assets (lesson 4)."
terms:
  - { t: "Original", d: "The file exactly as it was uploaded. AEM keeps it untouched." }
  - { t: "Rendition", d: "A generated copy of an asset in a different size, format or quality, stored next to the original." }
  - { t: "Processing profile", d: "A saved set of rendition instructions that you apply to a folder." }
  - { t: "Default processing", d: "The built-in processing that runs for every asset and cannot be edited." }
  - { t: "Reprocess", d: "Running processing again on existing assets, for example after you change a profile." }
mistake: "Adding every size anyone might ever want to a profile. Each rendition costs processing time and storage for every asset in the folder, and the profile only helps if those renditions are actually used."
try_it:
  - "Upload one large JPEG to a test folder and open its Renditions view in the asset preview."
  - "List the renditions you see and their pixel sizes. Note which one is the largest after the original."
  - "In Tools, Assets, Processing Profiles, open the profile creation screen (you need an administrator role) and read the fields without saving."
  - "On paper, decide the three renditions your website really needs: a width, a format and a quality for each."
quiz:
  - q: "A brand manager uploads a 6000 px PNG. What does AEM do with the original?"
    options:
      - "Replaces it with the largest rendition to save storage"
      - "Keeps it unchanged and generates renditions beside it"
      - "Deletes it once the web rendition has been created"
      - "Converts it to JPEG so every asset has the same format"
    answer: 1
    why: "The original is preserved. Renditions are extra files generated from it, which is why you can always go back and regenerate them at another size."
  - q: "Your team adds a processing profile to the Campaigns folder. Which statement is true?"
    options:
      - "The default renditions stop being generated in that folder"
      - "It also rewrites the renditions of assets uploaded last year"
      - "It runs in addition to default processing, for new or updated assets in that folder and its subfolders"
      - "It applies to the whole DAM as soon as it is saved"
    answer: 2
    why: "Custom profiles add to the default processing, they do not replace it, and they follow the folder tree. Old assets are only affected if you reprocess them."
  - q: "A retailer with 200,000 product images wants 12 sizes in 3 formats just in case. What is the best advice?"
    options:
      - "Generate all 36, because storage is cheap and flexibility is valuable"
      - "Generate only the renditions actually used, and resize on demand for the rest"
      - "Generate none and ask designers to export manually"
      - "Put all 36 in one profile and apply it to the root folder"
    answer: 1
    why: "36 renditions across 200,000 images is millions of files to create and store, and most will never be requested. Generate what is needed and use on-demand delivery for the long tail (Level 4)."
  - q: "Which is NOT true of how a profile sets rendition size?"
    options:
      - "Width and height act as maximum bounds"
      - "The aspect ratio of the original is preserved"
      - "Each rendition needs a name and a supported file extension"
      - "The image is stretched to exactly the width and height you enter"
    answer: 3
    why: "Width and height are limits, not a target to stretch to. The largest version that fits inside them is produced and the aspect ratio is kept."
go_deeper:
  - { title: "Image optimisation on AEM: Dynamic Media and Edge Delivery Services", url: "/blog/2026/11/image-optimisation-on-aem-dynamic-media-and-edge-delivery-services/", why: "when to pre-generate renditions and when to resize on demand" }
  - { title: "Image optimiser tool", url: "/tools/image-optimiser/", why: "try sizes and formats in the browser before you commit them to a profile" }
  - { title: "Next lesson: Asset compute microservices", url: "/learn/assets/asset-compute-microservices/" }
---
## One upload, many files

A designer uploads a 40 MB photograph. The website needs a 400 px card image. The newsletter needs a 600 px one. The DAM grid needs a tiny thumbnail. Nobody wants to ship the 40 MB original to a phone.

A **rendition** solves this. It is a generated copy of the asset at a different size, format or quality, stored with the original. The original stays untouched, so you can always make more.

## What you get without doing anything

Every asset on AEM Assets as a Cloud Service goes through **default processing**. It is built in and you cannot edit it. According to Adobe's documentation it produces:

- thumbnails at 48, 140 and 319 pixels
- a 1280 pixel web rendition
- metadata and text extraction

That is why a new upload shows a preview within moments. Open an asset and look at the Renditions view in the left rail to see them.

In the repository, renditions live under the asset, in a `renditions` folder, as separate files with names such as `cq5dam.web.1280.1280.jpeg`. You rarely type those paths. You pick a rendition in the UI or request it through an API.

## Processing profiles: adding your own

Default renditions suit the DAM itself. Your website probably needs others. A **processing profile** lets an administrator define extra renditions once and apply them to a folder.

A profile rendition has:

| Setting | Meaning |
|---|---|
| Name | Identifies the output, so you can find it later |
| Format | PNG, JPEG, GIF or WebP |
| Width and height | Maximum bounds, aspect ratio preserved |
| Quality | Compression level, mainly for lossy formats |
| Include or exclude | Which file types the rule applies to |

Profiles are created under Tools, Assets, Processing Profiles. You apply one from the profile page, or from the folder's Properties, Asset Processing tab. Each folder holds one profile, and it covers subfolders unless a subfolder has its own. To add renditions, you edit that profile, then reprocess existing assets if you want the change applied to them.

## Choosing renditions with care

Think of renditions as a warehouse. Each one you stock takes space and time to produce, for every asset in scope. Adobe also advises keeping renditions per asset under 40, and says renditions cannot be bulk deleted, so a bad profile is awkward to undo.

A sensible approach is to ask three questions for each candidate. Which channel uses it? Is it used often enough to pre-generate? Could on-demand delivery serve it instead? Lesson 19 onwards covers that last option.

<details markdown="1">
<summary>Predict first, then reveal</summary>

You change a profile on a folder of 50,000 assets, saving a new 800 px WebP rendition. Next morning, do all 50,000 have it?

No. The profile applies to assets that are new or updated after the change. Existing assets need to be reprocessed. Reprocessing 50,000 assets is real work, so do it deliberately, ideally on a test folder first.

</details>

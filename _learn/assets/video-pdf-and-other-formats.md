---
title: "Video, PDF and other formats"
description: "How AEM Assets as a Cloud Service handles video, PDF, Office files and design files such as PSD and InDesign, and what to check before relying on a format."
track: assets
level: 3
order: 16
minutes: 9
outcome: "By the end you can predict what preview and renditions a given file type will get, and know where to check support before promising it to a team."
prereq: "Renditions and processing profiles (lesson 13)."
terms:
  - { t: "MIME type", d: "A standard label for a file type, such as image/jpeg or application/pdf, used to decide how to process it." }
  - { t: "Transcoding", d: "Converting a video from one format or encoding to another." }
  - { t: "Embedded preview", d: "A preview image saved inside a design file such as an InDesign document, which AEM may use to build renditions." }
  - { t: "Dynamic Media", d: "Adobe's media delivery and video service, covered in Level 4." }
  - { t: "Supported format", d: "A file type for which AEM can generate renditions, extract metadata or both, with capability varying by type." }
mistake: "Assuming that because a file uploads, it will get a good preview and renditions. Upload accepts almost anything, but processing capability varies by file type, and an unprocessed asset looks broken in search results."
try_it:
  - "Collect five real files your team uses: a video, a PDF, a Word file, a PSD and an InDesign document."
  - "Upload them to a test folder and compare the thumbnails and Renditions views."
  - "Check each file type against Adobe's file format support page on Experience League and note anything partial."
  - "For any weak result, write down the fix: re-export, a better embedded preview, or a custom worker."
quiz:
  - q: "A retailer uploads a PDF catalogue. What should they expect?"
    options:
      - "No preview, because only images are processed"
      - "A thumbnail, and text extraction for PDF, as listed by Adobe's support table"
      - "Automatic conversion into a web page"
      - "Every page generated as a separate asset"
    answer: 1
    why: "PDFs are supported for thumbnails and text extraction. AEM does not split pages into assets or convert them to pages by default."
  - q: "An InDesign file shows a small, blurry thumbnail. What is the most likely cause and fix?"
    options:
      - "The DAM is broken and needs a support ticket"
      - "The processing profile is missing, so create one for INDD"
      - "The file is too new, so wait for AEM to update"
      - "The rendition is built from the embedded preview, so save a larger preview in InDesign"
    answer: 3
    why: "Adobe notes that INDD rendition size comes from the preview embedded in the file. A larger saved preview gives larger renditions, and a profile cannot create detail that is not there."
  - q: "A 20 GB camera file fails with a rendition error. Which response is sensible?"
    options:
      - "Treat it as normal: very large files can fail, so trim or transcode before upload"
      - "Re-upload it repeatedly until it works"
      - "Rename the file with a .mp4 extension"
      - "Remove the processing profile from the folder"
    answer: 0
    why: "Very large files can exceed what processing handles, and Adobe support has documented such failures for huge video files. Renaming does not change the encoding, and the profile is not the cause."
  - q: "Which statement about video in AEM Assets is NOT safe?"
    options:
      - "Support varies by container and codec"
      - "Video thumbnails and metadata extraction exist for many formats"
      - "Adaptive streaming and transcoding are always included for every licence"
      - "Dynamic Media is the usual route for rich video delivery"
    answer: 2
    why: "Rich video delivery depends on Dynamic Media and on what your licence includes, so never promise it without checking. The other statements describe normal, general behaviour."
go_deeper:
  - { title: "Image optimisation on AEM: Dynamic Media and Edge Delivery Services", url: "/blog/2026/11/image-optimisation-on-aem-dynamic-media-and-edge-delivery-services/", why: "where Dynamic Media fits for delivery" }
  - { title: "Dynamic Media basics", url: "/learn/assets/dynamic-media-basics/", why: "Level 4, video and rich media delivery" }
  - { title: "Next lesson: Smart tags and AI enrichment", url: "/learn/assets/smart-tags-and-ai-enrichment/" }
---
## Not all files are images

A marketing team's library holds more than photos: product videos, PDF brochures, Word briefs, Photoshop masters and InDesign layouts. People expect each to show a sensible preview and be searchable. Whether that happens depends on how well AEM understands the file type.

## How AEM decides

Processing is driven by **MIME type**. Adobe publishes a file format support page that lists, per type, what can be done: thumbnails, metadata extraction, text extraction and so on. Capability varies by type. That table is the source of truth, and it changes, so check it rather than relying on memory or on this lesson.

```text
Upload
  -> identify type (MIME)
  -> supported? generate what that type allows
  -> not supported? asset is stored, but with limited or no preview
```

An unsupported type is still stored and still a valid asset. You just will not get useful renditions, so it may show a generic icon.

## Common cases

**PDF and Office documents.** PDFs get thumbnails and text extraction, which feeds search. Office files are generally handled as documents, but check the support table for the exact type before relying on previews.

**PSD, AI and INDD.** Adobe notes that PSD and PSB thumbnails are now generated natively. InDesign renditions take their size from the preview embedded in the file, so an author who saves a small preview gets a small result. Ask designers to save a larger preview.

**Video.** Many containers such as MP4 and MOV are accepted, and thumbnails and metadata work for many. Support varies by format. For rich delivery, such as adaptive streaming, you usually involve Dynamic Media (Level 4). That depends on your licence and configuration, so confirm what your organisation has before promising it. Be careful too with very large video files: Adobe support has documented rendition failures for huge .mov files, with trimming or transcoding as the advice.

## Large files

Uploading goes straight to cloud storage, so big files upload fine (lesson 4). Processing is the harder part. Adobe notes that metadata extraction can fail for files above roughly 15 GB. Agree a sensible limit with creative teams and provide a path for oversized masters, such as keeping a compressed delivery version in the DAM.

## What to do when a format is weak

Options, in order: re-export in a better-supported format, improve what is embedded in the file, request a custom rendition through a worker (lesson 14), or accept a generic icon and rely on metadata for findability.

<details markdown="1">
<summary>Stretch question</summary>

A DAM team wants every uploaded file to show a thumbnail. Is that a realistic promise?

Not for every type. It is realistic for formats listed as supported. For others, set expectations and use good metadata so the asset can still be found.

</details>

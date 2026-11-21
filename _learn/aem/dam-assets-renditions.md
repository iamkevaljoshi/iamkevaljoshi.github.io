---
title: "The DAM: assets, metadata and renditions"
description: "How AEM Assets stores files, metadata and renditions on Cloud Service, with processing profiles, Asset Compute, folders and permissions explained."
track: aem
level: 3
order: 19
minutes: 9
outcome: "By the end you can explain how an uploaded image becomes renditions and metadata, and where to configure that behaviour."
prereq: "Lesson 16, and lesson 2 on author and publish."
terms:
  - { t: "Asset", d: "A file in the DAM, such as an image, video or PDF, stored with its metadata." }
  - { t: "Metadata schema", d: "The definition of which metadata fields an asset's properties form shows and how they behave." }
  - { t: "Rendition", d: "A generated version of an asset, such as a thumbnail or web-sized image." }
  - { t: "Processing profile", d: "A folder-level setting that tells Cloud Service which renditions and processing to apply to uploads." }
  - { t: "Asset Compute", d: "The cloud microservices that process assets, such as generating renditions, outside the AEM JVM." }
mistake: "Using the original 20 MB upload directly in pages. The original is a master file, and delivering it makes pages slow, so pages should use renditions or an image delivery service."
try_it:
  - "Upload an image to a folder in the Assets UI on your local SDK."
  - "Open its properties and read the metadata, then open the Renditions view."
  - "Edit one metadata value, such as the title, and save."
  - "Create a folder structure for your project, such as /content/dam/<project>/images."
  - "Write down who should upload, who should only view, and who should publish."
quiz:
  - q: "What is a rendition?"
    options:
      - "A permission that lets a user view an asset"
      - "A copy of a page in another language"
      - "A generated version of an asset, such as a smaller image"
      - "A tag applied to an asset"
    answer: 2
    why: "Renditions are derived files produced from the original, such as thumbnails and web sizes. Tags and permissions are separate concepts, and page copies belong to multi-site."
  - q: "On AEM as a Cloud Service, where does the heavy asset processing run?"
    options:
      - "Inside the author JVM, using scheduled jobs"
      - "On the Dispatcher during each request"
      - "In the browser of the author who uploaded the file"
      - "In Asset Compute microservices, outside the AEM instance"
    answer: 3
    why: "Cloud Service sends processing to microservices that read the binary from cloud storage and write renditions back. Older versions processed inside AEM, which is the wrong picture for Cloud Service."
  - q: "A marketing team wants all images in /content/dam/brand-a/campaigns to get an extra square rendition. Where do you configure this?"
    options:
      - "A processing profile applied to that folder"
      - "A client library in ui.apps"
      - "A Dispatcher rule"
      - "The page template policy"
    answer: 0
    why: "Processing profiles are applied to folders and control which renditions are generated for assets in them. Client libraries, Dispatcher and template policies do not generate renditions."
  - q: "Which is the weakest design for a large site's DAM?"
    options:
      - "Folders grouped by brand and purpose"
      - "Permissions assigned to groups of users"
      - "Everything uploaded into one flat folder with names like final_v2.jpg"
      - "Metadata used to describe and find assets"
    answer: 2
    why: "A flat folder makes permissions, processing profiles and search hard to manage. The other three are the habits that keep a DAM usable at scale."
go_deeper:
  - { title: "Image optimisation on AEM: Dynamic Media and Edge Delivery Services", url: "/blog/2026/11/image-optimisation-on-aem-dynamic-media-and-edge-delivery-services/", why: "choosing how images are delivered" }
  - { title: "Image optimiser tool", url: "/tools/image-optimiser/", why: "try size and format trade-offs on your own images" }
  - { title: "Performance and Core Web Vitals on AEM", url: "/learn/aem/performance-core-web-vitals/", why: "why image delivery affects the score" }
---
## The problem: one image, many needs

A photographer uploads a 6000 by 4000 pixel image. The homepage needs 800 pixels wide, the app needs a square thumbnail, and legal needs to know who owns it. The **DAM** (Digital Asset Management, the Assets part of AEM) stores the original, its metadata and the versions derived from it.

## Assets, metadata and folders

An asset lives under `/content/dam`. Its descriptive data, such as title, description, copyright and tags, is **metadata**, stored with it. **Metadata schemas** control which fields appear in an asset's properties and how they behave, so different folders or asset types can ask authors for different information.

Folders are your main organising tool. They are also where **permissions** and **processing profiles** attach, so a structure like this pays off:

```text
/content/dam/brand-a/images/campaigns/
/content/dam/brand-a/images/products/
/content/dam/brand-a/documents/
```

Group permissions by role and folder, not by person, and keep names meaningful.

## Renditions and the upload flow

On Cloud Service the flow is:

1. A browser or tool uploads the file **directly** to cloud binary storage (direct binary upload), not through the AEM JVM.
2. AEM is told the upload finished and requests processing.
3. **Asset Compute** microservices read the original, create renditions and extract metadata, and write the results back.
4. AEM shows the asset with its renditions.

Which renditions get generated is controlled by **processing profiles** that you apply to folders. Adobe also lets you extend processing with custom Asset Compute workers, which is a developer topic you can meet later.

## Delivering assets to visitors

The original is a master file. Pages should use a rendition, or better, an image delivery service that returns the right size and format on request. Options include Dynamic Media and, on Edge Delivery Services, built-in optimised image delivery. Adobe's offering names in this area have changed over time, so confirm current names and licensing on Experience League. The linked blog post compares them in practice.

## What to remember

Assets are uploaded once, enriched with metadata, processed into renditions in microservices, and delivered in the size the channel needs. Folder design and permissions are decisions you make early, because they are hard to change later.

<details markdown="1">
<summary>Stretch question: why is direct binary upload good for Cloud Service?</summary>

Large files would otherwise stream through the AEM instances, using memory and bandwidth that should serve authors. Sending the binary straight to cloud storage keeps AEM light, and works with the elastic processing microservices.

</details>

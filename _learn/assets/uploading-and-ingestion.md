---
title: "Uploading and ingesting assets"
description: "The ways to get assets into AEM Assets as a Cloud Service: browser upload, desktop app, upload libraries and bulk import, and what happens after the file arrives."
track: assets
level: 1
order: 4
minutes: 9
outcome: "By the end you can pick the right upload method for a given volume, handle name clashes safely, and check that processing has finished."
prereq: "Lessons 2 and 3 of this track."
terms:
  - { t: "Ingestion", d: "Getting assets into the DAM and letting it process them, from first byte to usable asset." }
  - { t: "Upload API", d: "The direct binary upload protocol, with an open-source SDK, for building your own upload tools." }
  - { t: "AEM desktop app", d: "A client for moving files and folder hierarchies between a local file system and the DAM, intended for low volume." }
  - { t: "Bulk import tool", d: "An administrator tool that pulls assets in bulk from Azure Blob Storage or Amazon S3 into the DAM." }
mistake: "Using the browser for a migration. Browser upload suits occasional uploads and flat lists of files, so a thousand-folder archive dragged into it fails, stalls or arrives flattened, and teams lose days re-doing it."
try_it:
  - "Pick three scenarios from your world: 5 files today, a 300-file photoshoot, an archive of 80,000 assets in cloud storage. Match each to a method from this lesson."
  - "Check your sample names against the disallowed characters listed on Experience League for asset names."
  - "If you have an environment: upload two files with the same name into one folder and read the options the duplicate dialog gives you."
  - "Open the folder afterwards and note when thumbnails and metadata appear compared with when the upload finished."
quiz:
  - q: "A designer has one folder hierarchy of 400 files on a laptop and wants to keep the structure in the DAM. Which method fits best?"
    options:
      - "Drag the parent folder into the browser Assets console"
      - "The AEM desktop app, which handles nested folder hierarchies"
      - "Email the files to an asset manager"
      - "The bulk import tool pointed at the laptop"
    answer: 1
    why: "Browser upload handles flat lists of files rather than nested folders, and bulk import reads from cloud storage, not a laptop. The desktop app is designed for hierarchies at modest volume."
  - q: "An agency delivers 80,000 images in an Amazon S3 bucket for a migration. What is the sensible approach?"
    options:
      - "Download them and upload through the browser in batches"
      - "Ask each author to add their own files"
      - "Use the bulk import tool, or a script using the upload libraries, in controlled batches"
      - "Rename them first, then upload in one go"
    answer: 2
    why: "Bulk import exists for large cloud-storage sources, and the upload libraries suit scripted programmatic loads. Browser batches are slow and error-prone, and renaming is a separate step, not a method."
  - q: "You upload a file with the same name and location as an existing asset and choose Replace. What is the risk?"
    options:
      - "Nothing, replace is always safe"
      - "The new file is renamed with a number"
      - "A second copy appears in the same folder"
      - "The old asset's metadata and edits can be lost for good"
    answer: 3
    why: "Replace overwrites the existing asset, including its metadata and edits. Creating another version or keeping both preserves more, so choose deliberately."
  - q: "Which statement about processing is NOT true?"
    options:
      - "Upload finishing and processing finishing are separate moments"
      - "Renditions and extracted metadata can appear shortly after the asset"
      - "Upload is complete only after every rendition exists"
      - "The folder's processing profile influences what is generated"
    answer: 2
    why: "The bytes land in storage first and the microservices work afterwards, so the asset can exist before its renditions do. That gap is normal, and only a long delay needs investigating."
go_deeper:
  - { title: "AEM as a Cloud Service migration playbook", url: "/blog/2026/11/aem-on-premise-and-managed-services-to-aem-as-a-cloud-service-migration/", why: "where asset migration fits in a bigger move" }
  - { title: "AI-assisted AEM Cloud Service migration", url: "/blog/2026/11/ai-assisted-aem-cloud-service-migration/", why: "using scripts and agents safely on migration tasks" }
  - { title: "Image optimiser tool", url: "/tools/image-optimiser/", why: "resize or convert images in the browser before upload" }
  - { title: "Next lesson: Browsing, searching and filtering", url: "/learn/assets/finding-and-browsing/" }
---
## Getting files in is a design decision

Uploading sounds trivial until you have to load 80,000 product images, keep a photographer's folder structure, and avoid overwriting last year's logo. AEM Assets gives you several ways in, and the right one depends on volume, structure and who is doing it.

## The main methods

| Method | Best for | Watch out for |
|---|---|---|
| Browser: Create, then Files, or drag and drop | Occasional uploads | Flat lists of files, not nested folders |
| AEM desktop app | Low-volume work, nested folder hierarchies | Not intended for migration |
| Adobe Asset Link | Designers in Photoshop, Illustrator, InDesign | Works from the open document |
| Upload API and SDK libraries | Custom tools and scripted loads | You own error handling and batching |
| Bulk import tool | Large migrations from Azure Blob Storage or Amazon S3 | Administrators only |

The upload SDK is open source: the Node.js library is `@adobe/aem-upload` and Adobe's GitHub organisation lists the other language options (check the READMEs for what is current). Experience League also has guidance for programmatic loads of around 50,000 assets, recommending modest batches and a tuned concurrency, because throughput is mostly limited by processing after upload.

## What the upload protocol does

All the programmatic tools use the **direct binary upload** idea from lesson 2: ask AEM to start, send file parts to cloud storage, tell AEM you are done. You rarely write this yourself, but it explains behaviour. Large files are split into parts for you, and AEM is not a bottleneck for bytes.

## Names, clashes and file types

Uploads with disallowed characters in asset names are blocked until fixed in the browser, while some methods silently replace characters. The bulk import tool rewrites names rather than blocking, for example by escaping `%` or turning spaces in folder names into hyphens. You do not want your names rewritten for you, so apply the convention from lesson 3 before upload.

When a name and location already exist, the browser asks you to **replace**, **create another version** or **keep both**. Replace discards the old asset's metadata and edits. Bulk import has **skip**, **replace** and **create version** modes, with skip as the default.

The documentation does not give one simple maximum file size for browser upload, so check Experience League for your file formats and any limits that apply to your environment.

## After the upload

When the last part lands, the asset exists, but it is not finished. Microservices then create renditions, extract metadata and text, and apply any default metadata. The browser shows counts of uploaded and failed files, and bulk import has a job status and job history. Give processing a short while, then check the thumbnail, the renditions and the metadata. A long delay or missing renditions is a signal to look at the processing profile and the logs (level 3 covers this).

```bash
# Conceptual flow for a scripted loader (not a real command)
# 1. initiate upload for /content/dam/acme/emea/spring-2026
# 2. send parts to the storage URLs returned
# 3. complete upload, then poll the asset for renditions
```

<details markdown="1">
<summary>Predict first, then reveal: why batch a large upload?</summary>

Uploads are not the slow part. Processing is. Sending everything at once just builds a long queue of work and makes failures hard to trace. Smaller batches let you spot problems, such as a bad filename pattern, after 50 files rather than after 50,000.

</details>

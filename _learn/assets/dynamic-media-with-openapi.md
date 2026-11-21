---
title: "Dynamic Media with OpenAPI"
description: "What Dynamic Media with OpenAPI capabilities is, how it differs from classic Dynamic Media, how approved assets get delivery URLs, and the caveats to check first."
track: assets
level: 4
order: 21
minutes: 10
outcome: "By the end you can explain how approved assets are delivered by URL, how this differs from classic Dynamic Media, and what to verify before relying on it."
prereq: "Dynamic Media basics (lesson 20)."
terms:
  - { t: "Dynamic Media with OpenAPI", d: "Adobe's newer delivery model for AEM Assets as a Cloud Service, with search and delivery APIs that serve approved assets by URL." }
  - { t: "Approved asset", d: "An asset marked approved in AEM Assets; only approved assets, in their latest approved version, are exposed for delivery." }
  - { t: "Delivery URL", d: "The public URL of an approved asset, which a front end uses instead of copying the file." }
  - { t: "Image modifiers", d: "URL parameters such as width, height, crop, quality and format that change the image delivered." }
  - { t: "Prime and Ultimate", d: "Adobe's licence tiers for this area; they differ in which modifiers and features you get." }
mistake: "Treating it as a drop-in replacement for classic Dynamic Media. The URL structures differ, and Adobe advises leaving existing Dynamic Media integrations alone unless you need what only one side offers."
try_it:
  - "Write down three assets in a library you know and mark which would be approved for public delivery and which should stay internal."
  - "Draft the sentence you would send to Adobe Support to request enablement: environment, use case, downstream apps and domains."
  - "List every channel that would call delivery URLs (site, app, partner portal) and note each domain you would need to allow-list."
  - "Compare two features you need, such as smart crop and AVIF, with the Prime and Ultimate descriptions on Experience League and record what you could not confirm."
quiz:
  - q: "Which assets does Dynamic Media with OpenAPI deliver?"
    options:
      - "Every asset in the repository, by default"
      - "Only assets that have been tagged by smart tags"
      - "Only video assets"
      - "Only approved assets, using the latest approved version"
    answer: 3
    why: "Approval is the gate. That is a governance feature: brand teams control what front ends can use. Tagging and file type are unrelated to what is delivered."
  - q: "A team already uses classic Dynamic Media widely and a new app needs assets. What does Adobe's guidance suggest?"
    options:
      - "Migrate everything to OpenAPI at once because classic is gone"
      - "Use OpenAPI for the new integration and leave existing ones unchanged unless you need to move"
      - "Avoid OpenAPI because the two cannot exist together"
      - "Rewrite all existing URLs this month"
    answer: 1
    why: "The FAQ says both can co-exist and recommends the OpenAPI stack for net-new integrations, while URL structures differ. Claiming classic is gone, or that they cannot coexist, goes beyond what the documentation says."
  - q: "An editor updates the metadata on an approved asset. Roughly how fast should the delivery URL reflect it?"
    options:
      - "Within about ten minutes, because of a short CDN lifetime"
      - "Never, because delivery URLs are frozen forever"
      - "Only after a full nightly re-index"
      - "Only after a code deployment through Cloud Manager"
    answer: 0
    why: "Adobe quotes a CDN time to live of 10 minutes for this model, so changes show up in under that. A deployment is not needed, because assets are content, not code."
  - q: "Which is the safest way to plan around feature parity?"
    options:
      - "Assume it has everything classic Dynamic Media has"
      - "Assume it has nothing beyond resizing"
      - "Check the documented modifiers and your tier for each feature you need, then test"
      - "Ask authors which features they have heard about"
    answer: 2
    why: "Adobe's FAQ lists differences, such as video smart crop being unavailable in the OpenAPI stack, and tiers change what you can use. Assuming parity or its absence both lead to surprises."
go_deeper:
  - { title: "Image optimisation on AEM: Dynamic Media, web-optimised delivery and Edge Delivery Services", url: "/blog/2026/11/image-optimisation-on-aem-dynamic-media-and-edge-delivery-services/", why: "licensing, caching and EDS caveats in one place" }
  - { title: "Previous lesson: Dynamic Media basics", url: "/learn/assets/dynamic-media-basics/" }
  - { title: "Next lesson: Web-optimised images and Core Web Vitals", url: "/learn/assets/web-optimised-images-and-core-web-vitals/" }
---
## The problem: many front ends, one library

A retailer runs an AEM site, an app and a commerce front end. All need the same product photos. Copying files into each system means three copies to keep right. Dynamic Media with OpenAPI capabilities, from here on **OpenAPI delivery**, answers that with a simple idea: **reference the asset by URL, and let the DAM stay the source of truth.**

A word of honesty first. Adobe's naming and packaging here is in transition, and some pages in the documentation describe features as coming soon. Treat this lesson as the model, and confirm details on Experience League for your tier and date.

## How it differs from classic Dynamic Media

Classic Dynamic Media is the Scene7-based service from the last lesson. OpenAPI delivery is a newer stack for AEM Assets as a Cloud Service. From Adobe's FAQ, the differences that matter:

| Topic | Classic Dynamic Media | Dynamic Media with OpenAPI |
|---|---|---|
| Availability | Also on other AEM deployments, with extra setup | AEM Assets as a Cloud Service only |
| Image modifiers | A rich set | A smaller set: width, height, rotate, flip, quality, format |
| Access | Assets are available to all users | Restricted delivery by user, role, date and time is possible |
| Expiry | No inherent expiry | Expired assets stop being delivered |
| Video encodes | Standard three encodes | Dynamic encodes chosen to suit the input |
| Video smart crop | Supported | Not supported, per the FAQ |

Adobe says the two can **co-exist**, recommends OpenAPI delivery for net-new integrations, and advises leaving existing integrations unchanged because URL structures differ.

## The delivery model

The flow has three steps. An author **approves** an asset in AEM Assets. The asset then has a **delivery URL**. A front end uses that URL, usually with modifiers added.

Only the **latest approved version** is exposed, and changes to it, including a new version or edited metadata, flow to the delivery URL. Adobe quotes a CDN lifetime of ten minutes, so edits show in under that time.

Adobe documents the shape of the URL as a delivery host under your environment, a path starting `/adobe/assets/`, the asset ID, then `/as/` and an SEO-friendly name with an extension. Older material shows a different path, so do not build URLs by hand. Copy the delivery URL from AEM and add modifiers:

```text
<copied delivery URL>?width=800&quality=80
```

Modifier names are those listed in Adobe's API reference. Which ones you can use depends on your tier: the basic (Prime) set covers rotate, crop, flip, height, width and quality, and Adobe says Smart Imaging does not support AVIF for Prime. Some modifiers also need explicit enablement through Adobe Support.

## Relationship to the APIs

Delivery is one half. Adobe also offers **search APIs** for finding approved assets, and a Content Advisor selector interface that lets people pick assets from inside other applications. Managing the assets themselves, such as creating and editing them, belongs to the AEM Assets APIs, covered in lesson 32. Think of it as: Author APIs manage, delivery URLs serve.

## Check before you commit

- **Licence and enablement.** You need AEM Assets and Dynamic Media licences, and Adobe enables the feature through a support request listing environment, use case and the domains of downstream apps. Enablement is per environment.
- **Feature parity.** Compare the modifiers and video features you need against the FAQ, and test.
- **Do not deploy the config by accident.** Adobe notes you should exclude the assets delivery configuration path from content packages, or the feature may be deactivated.
- **Usage reports.** Adobe's pages say these are not yet available.

<details markdown="1">
<summary>Stretch question: why is "approved" a better gate than "published"?</summary>

Published means a file is live somewhere. Approved is a business decision: brand and legal have said this asset may be used by outside channels. Making approval the gate means a front end cannot accidentally show a draft, and an expired or withdrawn asset stops being delivered.

</details>

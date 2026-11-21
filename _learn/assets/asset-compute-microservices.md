---
title: "Asset compute microservices"
description: "How AEM Assets as a Cloud Service processes uploads with cloud microservices, and when a custom Asset Compute worker built on App Builder is justified."
track: assets
level: 3
order: 14
minutes: 10
outcome: "By the end you can describe what happens after an upload, and judge whether a processing need calls for a custom worker or just a profile."
prereq: "Renditions and processing profiles (lesson 13) and How AEM Assets as a Cloud Service is built (lesson 2)."
terms:
  - { t: "Asset microservices", d: "Cloud services that do the heavy processing of assets outside the AEM author server." }
  - { t: "Asset Compute Service", d: "The Adobe service that runs processing jobs, including your own custom ones." }
  - { t: "Worker", d: "A small piece of code that receives a source file and produces one or more renditions." }
  - { t: "App Builder", d: "Adobe's framework for building and running custom cloud apps, including Asset Compute workers." }
  - { t: "Custom profile", d: "A processing profile that sends assets to your own App Builder worker instead of using standard rendition settings." }
mistake: "Writing a custom worker for something a standard processing profile already does. You then own code, deployment and monitoring forever, to get a result a few settings could have given you."
try_it:
  - "Upload a small image and a PDF to a test folder and compare their Renditions views."
  - "Write down three processing needs your team has, for example a cut-out background or a call to a product system."
  - "For each one, mark it: standard profile, custom worker, or not a processing job at all."
  - "Find the Asset Compute documentation on developer.adobe.com and read the introduction page, without building anything."
quiz:
  - q: "Where does the heavy processing of an uploaded asset happen on Cloud Service?"
    options:
      - "On the author server's own CPU, in the same process as the editor"
      - "In the browser of the person who uploaded it"
      - "On the publish tier, when the first visitor requests the asset"
      - "In cloud microservices, outside the author server"
    answer: 3
    why: "Processing is offloaded to asset microservices, which is why author performance does not collapse during large uploads. Doing it on the author JVM is the 6.5 pattern."
  - q: "A team needs 3 web sizes in WebP for a folder. What should they use?"
    options:
      - "A custom App Builder worker, since WebP is not a standard format"
      - "A standard processing profile with three renditions"
      - "A post-processing workflow with a custom Java step"
      - "Manual export from Photoshop before upload"
    answer: 1
    why: "Standard profiles support WebP, sizes and quality. A custom worker would be unnecessary code to maintain. Reserve workers for things profiles cannot express."
  - q: "A custom worker receives every file in the folder, including PDFs it cannot handle. What is the right design response?"
    options:
      - "Ask authors to keep PDFs out of that folder"
      - "Assume the platform filters file types for you"
      - "Make the worker check the input and skip what it does not support"
      - "Switch the folder back to the default profile permanently"
    answer: 2
    why: "Adobe's documentation notes that a custom app receives all files sent to it, so filtering is the worker's job. Relying on the platform or on author discipline both fail quietly."
  - q: "Which is NOT a good reason to build a custom worker?"
    options:
      - "You must call a third-party service to generate a rendition"
      - "You want a smaller JPEG than the 1280 pixel default"
      - "You need Photoshop-based processing such as background removal"
      - "You need a rendition format or logic that profiles cannot produce"
    answer: 1
    why: "Size is a standard profile setting. Workers are for external calls and processing logic beyond what rendition settings can express."
go_deeper:
  - { title: "AEM in the cloud: migration playbook", url: "/blog/2026/11/aem-on-premise-and-managed-services-to-aem-as-a-cloud-service-migration/", why: "how the move to microservices changes asset processing during migration" }
  - { title: "Next lesson: Workflows and post-processing", url: "/learn/assets/workflows-and-post-processing/" }
---
## What happens after you click upload

On older, self-hosted AEM, the author server did everything. When someone uploaded a 2 GB video, the same machine that authors were using also had to make its renditions. A few big uploads could slow editing for everyone.

AEM as a Cloud Service splits this. The file goes straight to cloud storage (see lesson 4). AEM then asks **asset microservices** to process it. They run outside the author server and scale with demand, so a bulk upload no longer competes with authors for the same CPU.

The sequence, simplified:

```text
Upload finishes
   -> AEM tells the processing service about the new file
   -> default processing runs (thumbnails, web rendition, metadata)
   -> your folder's processing profile runs, if there is one
   -> optional post-processing workflow runs (lesson 15)
   -> asset shows as processed
```

## Standard processing versus a custom worker

Most teams never leave the first two steps. A standard profile (lesson 13) covers sizes, formats and quality.

Sometimes you need more. Adobe's documentation gives examples such as removing a background with Photoshop services, calling a product information system, or producing renditions from a Photoshop template. For these, you write a **worker**.

A custom worker is a small headless app built with **App Builder** and run through the **Asset Compute Service**. In a custom processing profile you point AEM at that app. Adobe notes that the app and the AEM account must belong to the same organisation, and that the app receives every file sent to it, so it must filter inputs itself.

Conceptually a worker does one job: take the source file and parameters, write the rendition files out. Because you build it, you also deploy it, secure it and monitor it. That is the real cost.

## Deciding if you need one

Ask in order:

1. Can a standard profile do it? Use that.
2. Is it really processing, or is it a metadata or business rule? That may be a post-processing workflow or an integration instead.
3. If it is processing that needs external logic, a worker is justified.

## When it goes wrong

Be general and methodical. Check the asset after upload: does it show as processed, and do the expected renditions appear in the Renditions view? If a custom rendition is missing, confirm the folder has the profile you expect, that the file type is included, and that the worker handles it. For worker internals, the Asset Compute tooling and App Builder logs are where you look. Adobe's documentation does not describe a single processing dashboard in the UI, so check Experience League for the current monitoring options in your environment.

<details markdown="1">
<summary>Why does this work?</summary>

Why is moving processing off the author server such a big deal for a bulk migration?

Because processing is the slow, CPU-heavy part. If it ran on the author server, loading 100,000 assets would degrade the authoring experience for days. With microservices, the work is spread out and the author tier stays responsive.

</details>

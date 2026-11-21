---
title: "Migrating assets to Cloud Service"
description: "Plan an assets migration to AEM as a Cloud Service: clean first, map metadata, pick Content Transfer Tool or bulk import, rehearse, validate and cut over."
track: assets
level: 6
order: 35
minutes: 10
outcome: "By the end you can draft a phased assets migration plan with the right tool for each source, a validation checklist and a cutover approach."
prereq: "Uploading and ingestion (lesson 4), bulk metadata import (lesson 11) and versions and duplicate detection (lesson 29)."
terms:
  - { t: "Content Transfer Tool (CTT)", d: "Adobe's tool for moving content, including assets, from an existing AEM 6.x instance into Cloud Service through Cloud Acceleration Manager." }
  - { t: "Bulk import", d: "An AEM Assets tool that pulls files from cloud storage, such as Amazon S3 or Azure Blob Storage, into the DAM." }
  - { t: "Metadata mapping", d: "The agreed table that says which source field becomes which AEM metadata property, with any value changes." }
  - { t: "Top-up (delta)", d: "A later pass that moves only what changed since the previous transfer, shortening the final freeze." }
  - { t: "Cutover", d: "The moment users and systems switch from the old DAM to the new one." }
mistake: "Lifting and shifting everything, duplicates and junk included. You pay for storage and processing on assets nobody uses, and the new DAM starts with the same mess as the old one."
try_it:
  - "Take a sample of 200 assets from a real or imagined source and tick how many are duplicates, outdated or unused."
  - "Draw a metadata mapping table with at least eight source fields and say what you would drop, rename or transform."
  - "Decide for each source (AEM 6.5, file server, third-party DAM) which tool you would use and why."
  - "Open /tools/aem-migration-estimator/ and enter rough volumes to see how a size and timeline estimate is shaped."
  - "Write five validation checks you would run after the first rehearsal, with the expected result for each."
quiz:
  - q: "A company has 300,000 assets on an AEM 6.5 author instance and wants them on Cloud Service. Which tool is the natural fit?"
    options:
      - "The Assets Author API in a loop"
      - "Content Transfer Tool, with Cloud Acceleration Manager"
      - "Email the assets to authors in batches"
      - "Bulk import, because it always replaces CTT"
    answer: 1
    why: "CTT is designed for moving content from an AEM source into Cloud Service. Bulk import suits files in cloud storage, and it does not replace CTT, since they start from different places."
  - q: "An agency holds 80,000 files in an S3 bucket plus a spreadsheet of metadata. Which plan fits best?"
    options:
      - "Use bulk import for the binaries and a separate metadata import from the mapped spreadsheet"
      - "Upload all files by drag and drop and type the metadata afterwards"
      - "Convert everything to PDF first so that import is simpler"
      - "Run CTT against the bucket"
    answer: 0
    why: "Bulk import reads from supported cloud storage, and metadata is usually handled as a mapped import. CTT migrates from AEM, not from a bucket, and hand typing 80,000 records will not finish."
  - q: "Your first rehearsal shows counts match, but 3% of assets have no renditions. What should you conclude?"
    options:
      - "Counts matched, so the migration is complete and can be signed off"
      - "Renditions are optional extras, so the gap can safely be ignored"
      - "Processing is part of migration, so check backlog and failures first"
      - "The source files are corrupt, so they should be deleted at source"
    answer: 2
    why: "Counts prove arrival, not usability. Missing renditions usually point to processing that has not finished or has failed, which you must investigate. Deleting sources is jumping to a conclusion."
  - q: "Which is NOT a good reason to clean up before migrating?"
    options:
      - "It lowers the storage and processing you pay for"
      - "It makes validation counts easier to reason about"
      - "It avoids carrying duplicates into the new folder model"
      - "It guarantees the migration can be done without rehearsals"
    answer: 3
    why: "Cleaning helps cost, clarity and quality, but it never replaces rehearsals, which find surprises that only appear when you run the real process."
go_deeper:
  - { title: "Migrating AEM on-premise and Managed Services to AEM as a Cloud Service: an architect's playbook", url: "/blog/2026/11/aem-on-premise-and-managed-services-to-aem-as-a-cloud-service-migration/", why: "tools, phases and go-live precautions" }
  - { title: "AI-assisted AEM Cloud Service migration", url: "/blog/2026/11/ai-assisted-aem-cloud-service-migration/", why: "where automation helps" }
  - { title: "AEM migration estimator", url: "/tools/aem-migration-estimator/", why: "rough sizing for effort and duration" }
  - { title: "Next lesson: Performance, scale and bulk operations", url: "/learn/assets/performance-scale-and-bulk-operations/" }
---
## The problem: moving house with the rubbish

A migration looks like a copy job. It is really a chance to decide what deserves a place in the new house. Teams that copy everything move 600,000 files and discover later that a third were duplicates, a fifth were unused, and half had metadata that nobody can interpret.

The plan below is the order that works.

## 1. Inventory, clean, then design

Before choosing a tool, count and classify: volume in gigabytes and in files, types, ages, owners, and how much is actually referenced. Then:

- **Deduplicate** (lesson 29 explains how AEM detects duplicates after the fact). It is cheaper to remove them before they arrive.
- **Retire** what is expired or unreferenced, with owners' agreement (lesson 30).
- **Redesign folders** (lesson 3) and **map metadata** (lessons 7 and 12). Keep the legacy ID and original path as properties, as a safety net for validation and for redirecting old links.

A mapping table is the single most useful artefact:

| Source field | AEM property | Transform |
|---|---|---|
| `ProductCode` | `product-sku` | Trim, upper case |
| `Usage` | `rights-usage` | Map "Web only" to the controlled list value |
| `Photographer` | `dc:creator` | None |
| `Folder` | folder path | New taxonomy, see folder plan |

## 2. Choose the tool for each source

| Source | Typical tool | Note |
|---|---|---|
| AEM 6.x author | **Content Transfer Tool** via **Cloud Acceleration Manager** | Moves content and assets; supports top-ups |
| Files in S3 or Azure Blob | **Bulk import** | Imports binaries; metadata usually a separate mapped import |
| Third-party DAM or file server | Export to cloud storage, then bulk import, or **aem-upload** (lesson 32) | Scripts need throttling |
| Small, curated sets | Upload in the UI (lesson 4) | Fine below a few thousand files |

Check current limits, supported sources and settings in Experience League before you commit, as throughput figures quoted in older Adobe sessions are not a promise. Measure in your own rehearsal instead. Egress costs from the source's storage can apply, so ask who pays.

## 3. Rehearse, top up and validate

Run a rehearsal on a non-production environment with a slice, then with the full set. Time it. That timing, scaled up, is your real estimate, and the [AEM migration estimator](/tools/aem-migration-estimator/) can give you a first approximation to challenge.

After each run, validate:

- **Counts** by folder, compared with the source.
- **Checksums** on a sample, to prove binaries are intact.
- **Metadata** spot checks on every mapped field, plus empty or malformed values.
- **Renditions and processing:** are processing profiles (lesson 13) complete, and is the backlog clear?
- **Search:** can you find a known asset by a custom field (lesson 34)?
- **Permissions:** do folder groups match the governance design (lesson 26)?

For AEM sources, CTT supports repeated extraction, so you can do a large first transfer, then **top-ups** that carry only changes. For storage-based sources, plan the equivalent: freeze new uploads in the old system at a set time, or import in dated batches.

## 4. Cutover

Agree a freeze window, run the final top-up, validate, switch integrations (lesson 32), then redirect or retire the old DAM. Keep the old system read-only for a defined period. As the playbook post explains, shortening the freeze is mostly a matter of frequent top-ups and rehearsals. If you also migrate Sites, coordinate so that references point to the right place on day one.

<details markdown="1">
<summary>Predict first, then reveal: what slows a bulk import more, file size or file count?</summary>

Both matter, but many small files add per-file overhead and processing work, while huge files add transfer time. Neither is predictable from the totals alone, which is why the rehearsal timing on a representative slice beats any formula. Processing after ingestion often takes longer than the transfer itself.

</details>

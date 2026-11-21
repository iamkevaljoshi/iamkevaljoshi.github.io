---
title: "Versions and duplicate detection"
description: "How asset versions work in AEM Assets as a Cloud Service, when to version rather than upload a copy, and how duplicate detection helps keep the library lean."
track: assets
level: 5
order: 29
minutes: 8
outcome: "By the end you can choose between a new version and a new asset, restore an earlier version, and explain what duplicate detection does and does not catch."
prereq: "Lesson 4 (uploading and ingestion)."
terms:
  - { t: "Version", d: "A saved earlier state of an asset, including its file, renditions and metadata, that you can compare or restore." }
  - { t: "Revert", d: "Making an earlier version the current state of the asset." }
  - { t: "Checksum", d: "A short fingerprint calculated from a file's bytes; identical files give the same value whatever their names." }
  - { t: "Duplicate detection", d: "An optional AEM feature that notices when an uploaded file already exists in the repository." }
mistake: "Uploading 'logo-final-v2.png' next to 'logo-final.png' instead of creating a version. Pages keep pointing at the old file, and the library fills with near-copies nobody can tell apart."
try_it:
  - "Upload an image to a test folder, then upload a changed file with the same name and choose to create a version when asked."
  - "Open the asset's timeline or versions view and list what you see for each version."
  - "Revert to the first version and check the file, then the metadata."
  - "Find where duplicate detection is configured in your environment, and note whether it is enabled."
  - "Write a one-line rule for your team: when do we version, and when do we create a new asset?"
quiz:
  - q: "A product photo is retouched but remains the same product shot. What is the best way to load it?"
    options:
      - "Upload it as a new asset named with 'v2' in the filename"
      - "Create a version of the existing asset so references stay valid"
      - "Delete the old one first, then upload the new one"
      - "Email it to the page owner so they can swap it"
    answer: 1
    why: "A version keeps the same asset path, so every page and collection that uses it picks up the change. A renamed copy leaves the old one in use, and deleting first breaks references."
  - q: "Duplicate detection is configured to compare the SHA-1 checksum. Two identical photos have different filenames. What happens on upload?"
    options:
      - "They are detected, because the checksum depends on the content"
      - "They are missed, because the filenames differ"
      - "The second upload is blocked automatically"
      - "The second one is renamed by AEM to match the first"
    answer: 0
    why: "A checksum is derived from the bytes, so identical files match whatever they are called. Notifications are sent to the user rather than blocking the upload."
  - q: "A designer saves a file with one tiny pixel change and uploads it. Will checksum-based detection flag it as a duplicate of the original?"
    options:
      - "Yes, because it looks the same to the eye"
      - "Yes, because the filename is the same"
      - "No, because any change to the bytes gives a different checksum"
      - "Only if the metadata is the same"
    answer: 2
    why: "Checksums compare exact bytes, so near-duplicates are not caught. This is why a naming and versioning habit matters as much as the tool."
  - q: "Which statement about duplicates and versions is NOT true?"
    options:
      - "Duplicates cost storage, processing and search clutter"
      - "Reverting restores an earlier file and its metadata state"
      - "Duplicate detection is a safety net, not a replacement for good habits"
      - "Duplicate detection runs by default on every environment with no cost"
    answer: 3
    why: "Experience League describes detection as disabled by default because it can affect performance on large repositories. It is a feature you choose to enable and then tune."
go_deeper:
  - { title: "Uploading and ingesting assets", url: "/learn/assets/uploading-and-ingestion/", why: "how name conflicts appear at upload" }
  - { title: "Folder structure and naming conventions", url: "/learn/assets/folders-structure-and-naming/", why: "naming habits that prevent copies" }
  - { title: "Usage, references and cleanup", url: "/learn/assets/usage-references-and-cleanup/", why: "removing the duplicates you do find" }
  - { title: "The real cost of AEM: licences, hosting, build and run", url: "/blog/2026/11/real-cost-of-aem-licences-hosting-build-and-run/", why: "where storage and processing costs come from" }
---
## The problem: five logos, which one is live?

A brand team has `logo.png`, `logo-new.png`, `logo-final.png` and `logo-final-FINAL.png`. Two of them are byte for byte the same. Every copy was processed into renditions, indexed, and now appears in search. Someone picked the wrong one for a flyer.

Duplicates are not just untidy. Each copy consumes storage, is run through processing, shows up in search, and splits usage so you cannot tell what is really in use. Versions and duplicate detection are the two tools against that.

## Versions: one asset, many states

A **version** is a saved earlier state of an asset. Per Experience League, a version can include the original file, its renditions and its metadata, so reverting reinstates all of that as the current state.

You typically get a new version in one of three ways:

- **Upload with the same name.** When a file with the same name already exists in the folder, the upload dialog asks what to do. One choice is to create a version of the existing asset.
- **Create one manually** from the asset's versions or timeline view, and upload a new file as the next version.
- **Edit the asset** in ways your configuration versions automatically. Check your own environment for what triggers this.

From the versions view you can **compare** versions (compare is available for images, with a slider between a selected version and the latest) and **revert**. Revert does not erase later history; it makes the chosen state current.

### Version, or a new asset?

| Situation | Choose |
|---|---|
| Same picture, retouched or recoloured | New version |
| Same logo, updated for a rebrand | New version |
| A different crop or a different shot | New asset |
| A localised variant with different text | New asset, linked by metadata |

The test: **should every place using the old one show the new one?** If yes, version it.

## Retention: versions are not free

Every version holds a file and renditions. Cloud Service runs a version purge maintenance task, with rules you can set in configuration, for example by age or by minimum and maximum number of versions. Adobe controls when it runs, and some knowledge base articles describe purges leaving more versions than configured. So treat purge as a background tidy-up and check its behaviour in your environment, rather than a precise guarantee. If a version must be kept for legal reasons, record that in your process; do not assume it will survive.

## Duplicate detection

AEM Assets can notice when someone uploads a file that already exists. On Cloud Service you enable it in the Assets configuration tools (Asset Duplication Detector), and it is **off by default** because it can affect performance on large repositories.

```text
Tools > Assets > Assets Configurations > Asset Duplication Detector
  Enabled:        yes
  Detect metadata: dam:sha1
```

Setting the detect field to `dam:sha1`, the checksum, finds true duplicates even when filenames differ. Behaviour to know:

- It notifies the uploader in the Inbox, in an aggregated message, and the user chooses which to remove. It does not stop the upload.
- Notifications cover only the first 100 duplicates found.
- It compares exact bytes, so a retouched copy is **not** a duplicate. Near-duplicates need human judgement.
- Custom upload tools that bypass the standard upload UI may not trigger the same prompts. Test your own ingestion route.

## How duplicates arise

Bulk imports from several drives, agencies that send "their own version", renamed files, and migrations that load the same share twice. The cure is partly a tool, partly a rule: version in place, name things consistently, and clean after migrations.

<details markdown="1">
<summary>Stretch question: 12,000 duplicates of 400 KB images is only about 5 GB. Why bother?</summary>

Storage is the smallest cost. Each copy is processed, indexed and offered in search, and each one is a chance to publish the wrong file. The real cost is confusion and the time people spend choosing between look-alikes.

</details>

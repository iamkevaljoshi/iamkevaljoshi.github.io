---
title: "Folder structure and naming conventions"
description: "How to design a folder hierarchy under /content/dam and a naming convention that lasts, with the trade-offs between brand, region, campaign and type."
track: assets
level: 1
order: 3
minutes: 8
outcome: "By the end you can choose a folder hierarchy for a DAM, justify it, and write a short naming rule that people can follow."
prereq: "Lessons 1 and 2 of this track."
terms:
  - { t: "/content/dam", d: "The repository path under which all assets and their folders live in AEM." }
  - { t: "Folder hierarchy", d: "The tree of folders that groups assets. In AEM it also carries permissions, processing profiles and some settings." }
  - { t: "Naming convention", d: "A written rule for how files and folders are named, so names are predictable and safe." }
  - { t: "Stable name", d: "A file name that will not need to change, because links and references may depend on it." }
mistake: "Using folders as the only way to organise. Folders force every asset into exactly one place, so teams build deep trees and personal folders, and then nobody can find anything. Folders should hold the few stable facts; metadata should hold the rest."
try_it:
  - "List the first-level folders you would create for a company with two brands and three regions."
  - "Decide which one question your top folder level answers (who owns it, where it is used, or what it is) and write it in one sentence."
  - "Rewrite these into your convention: `Hero Image (final) v2.JPG`, `Summer Sale 50% off!!.png`."
  - "Check the result: no spaces, no special characters, no version number, readable by a stranger."
quiz:
  - q: "Why should a file be named hero-woman-running.jpg rather than Hero Image FINAL v3.jpg?"
    options:
      - "Lower case names make files load faster"
      - "AEM only accepts names that contain hyphens"
      - "Version numbers are not allowed in the DAM"
      - "It is stable and safe in URLs, and history belongs in versions"
    answer: 3
    why: "Asset names appear in paths and URLs, so spaces and special characters cause trouble, and version numbers in names duplicate what AEM versioning does. AEM does not require hyphens, and nothing forbids a number, it is just the wrong place for it."
  - q: "A team wants top-level folders per person, such as /content/dam/acme/priya and /content/dam/acme/tom. What is the main problem?"
    options:
      - "Assets tie to individuals, so staff changes leave orphaned copies"
      - "Folders cannot be given people's names at all"
      - "The DAM limits how many top-level folders exist"
      - "Permissions cannot be set on such personal folders"
    answer: 1
    why: "Ownership by person is fragile: people move on and others cannot tell what is approved. Permissions could technically be set, but the structure does not reflect how assets are reused."
  - q: "A global brand has 12 regions that each need different permissions and processing for their local campaign assets, and share one logo set. Which structure fits best?"
    options:
      - "One flat folder with region in every file name"
      - "A shared brand folder for common assets, and a folder per region for local ones"
      - "One folder per file type across all regions"
      - "A folder per campaign per region per year per person"
    answer: 1
    why: "Folder-level permissions and profiles follow folder boundaries, so regional boundaries should be folders where access differs. A flat folder cannot carry permissions, and a deep per-person tree is unmaintainable."
  - q: "Which is NOT a good reason to change your folder structure design?"
    options:
      - "Different groups need different access"
      - "Different groups need different processing"
      - "Teams want to see their assets without searching, even though metadata could answer it"
      - "The structure has grown past what people can navigate"
    answer: 2
    why: "Filters and metadata can serve many views of the same asset, so a folder per view multiplies copies and confusion. Access, processing and navigability are real folder concerns."
go_deeper:
  - { title: "Content modelling: JCR vs relational vs document database", url: "/blog/2026/11/content-modelling-jcr-vs-relational-vs-document-database/", why: "why hierarchy is good for some questions and poor for others" }
  - { title: "AEM multi-site and language copies on Cloud Service", url: "/blog/2026/11/aem-msm-language-copies-cloud-service/", why: "regional structure thinking for sites that also applies to assets" }
  - { title: "Next lesson: Uploading and ingesting assets", url: "/learn/assets/uploading-and-ingestion/" }
---
## Why structure matters

A warehouse with no aisles still holds stock. You just cannot find any of it. The same is true of a DAM. Your folder tree is the first thing every user sees, and it quietly decides how easy browsing, permissions and processing will be.

In AEM, every asset lives under `/content/dam`. What goes beneath it is your design.

## What folders do in AEM

Folders are not just labels. Many settings work at folder level, and settings apply to everything beneath:

- **Permissions:** who can read, edit or delete.
- **Processing profiles:** which renditions get created (lesson 2).
- **Some folder properties,** such as metadata profiles, which you will meet in level 2.

So a folder boundary should exist wherever **access or processing really differs**. That is the most useful rule of thumb in this lesson.

## Choosing the top levels

There is no single right hierarchy. Each choice answers one question first:

| Top level by | Good when | Trade-off |
|---|---|---|
| Brand | Brands have separate teams and rules | Shared assets, such as legal text, need a home |
| Region | Local teams own local content | Global assets get duplicated across regions |
| Campaign | Work is project-driven | Campaigns end; reuse after the campaign is hard |
| Asset type | Creatives think in photos, video, logos | Cuts across ownership and permissions |

A common, sturdy pattern is to choose **one** primary axis (usually brand or owner), keep a **shared** area for global assets, and keep depth to three or four levels.

```text
/content/dam/acme/
  shared/
    logos/
    legal/
  emea/
    spring-2026/
    product-photography/
  apac/
    spring-2026/
```

## Why deep trees and personal folders hurt

Every extra level is another click and another place to misfile. Past about four levels, people stop browsing and start duplicating. Personal folders are worse: the owner leaves, the files stay, and nobody knows whether they are approved or still in use. Keep drafts in a clearly marked area with an owner and a clean-up rule instead.

## Naming conventions

Names show up in paths, URLs and downloads, so keep them boring and safe:

- Lower case, words joined by hyphens: `hero-woman-running.jpg`.
- No spaces or special characters. AEM blocks or rewrites several characters (for example `#`, `%`, `?`, `&` and `:`), and behaviour differs by upload method, so avoid them entirely.
- Describe the content, not the status: no `final`, `new`, or `v2`. Use AEM versions for history.
- Be stable: if a page or a link refers to the path, renaming breaks it.
- Optional prefixes, such as product code first, if the business searches that way.

Write the rule in one page and put it where uploaders will see it. A convention nobody can find is not a convention.

<details markdown="1">
<summary>Stretch question: should region be a folder or metadata?</summary>

Both can be right. If regions need different permissions or processing, make it a folder. If region only describes where an asset is used and anyone can see everything, metadata gives you flexible filtering without moving files. Ask what actually differs between regions before you decide.

</details>

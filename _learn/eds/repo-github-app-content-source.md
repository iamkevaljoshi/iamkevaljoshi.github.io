---
title: "The code repository, the GitHub app and the content source"
description: "How an Edge Delivery Services project connects a GitHub repository, the AEM Code Sync app and a content source, and how branches map to URLs."
track: eds
level: 1
order: 3
minutes: 9
outcome: "By the end you can explain the three moving parts of an EDS project, build the preview and live URLs for any branch, and say what configures the content source."
prereq: "Lessons 1 and 2."
terms:
  - { t: "aem-boilerplate", d: "Adobe's starter repository on GitHub that you copy as a template to begin a new project." }
  - { t: "AEM Code Sync", d: "A GitHub app that sends code pushed to your repository to the code bus." }
  - { t: "Content source", d: "The place authors write content, such as Google Drive, SharePoint, Document Authoring or AEM authoring." }
  - { t: "Configuration service", d: "The current way to set a site's content source, managed through the Admin API rather than a file in the repository." }
  - { t: "fstab.yaml", d: "The older repository file that mounted a content source. It is still supported for existing projects." }
mistake: "Putting content in the repository, or code in the content source. They are separate on purpose: Git holds code, the content source holds content, and mixing them breaks the independent workflows."
try_it:
  - "Open `https://github.com/adobe/aem-boilerplate` and list the top-level folders. Which one holds blocks?"
  - "Pick a fictional org `acme` and repo `website`. Write the preview and live URLs for the `main` branch."
  - "Write the preview URL for a branch called `new-hero`."
  - "Read the AEM Code Sync section of the aem.live developer tutorial and note which permission setting the installation needs."
quiz:
  - q: "What is the job of the AEM Code Sync app?"
    options:
      - "It converts documents into HTML pages"
      - "It copies code you push to GitHub onto the code bus so it can be served"
      - "It publishes pages when authors save a document"
      - "It stores your content in the repository"
    answer: 1
    why: "Code Sync handles code only. Content is pulled from the content source when someone previews it, so the app does not convert documents or publish content."
  - q: "Your repo is `shop` in org `acme`. What is the preview URL for branch `main`?"
    options:
      - "`https://main--shop--acme.aem.page/`"
      - "`https://acme--shop--main.aem.page/`"
      - "`https://main--shop--acme.aem.live/`"
      - "`https://shop.acme.aem.page/main`"
    answer: 0
    why: "The pattern is branch, then repo, then org, joined by double hyphens, on `.aem.page` for preview. The `.aem.live` version is the published one, not preview."
  - q: "You inherit an older project that has an `fstab.yaml`, and a new project that does not. What is the likely explanation?"
    options:
      - "The new project has no content source at all"
      - "The new project stores content in GitHub instead"
      - "The older file is now required in every project"
      - "The new project sets its content source in the configuration service instead"
    answer: 3
    why: "The configuration service is the current way to set the content source, and the boilerplate no longer ships an `fstab.yaml`. The file still works for existing projects, so do not delete it blindly."
  - q: "Which is NOT true about branches?"
    options:
      - "Each branch gets its own preview and live URLs"
      - "You can test a feature branch against real content"
      - "Merging into `main` updates the main site"
      - "A branch needs its own copy of the content documents"
    answer: 3
    why: "Content is shared. Only code is per branch, so one set of documents can be viewed with different branches' code. A separate copy of content would defeat that benefit."
go_deeper:
  - { title: "Repoless: one codebase, many sites", url: "/learn/eds/repoless/", why: "what changes when many sites share one repository" }
  - { title: "Universal Editor vs document-based authoring", url: "/blog/2026/11/universal-editor-vs-document-based-authoring/", why: "how the choice of content source shapes authoring" }
  - { title: "Edge Delivery Services helper tool", url: "/tools/edge-delivery-services-helper/", why: "build URLs and check setup details" }
  - { title: "Previous lesson: How a page gets from a document to the browser", url: "/learn/eds/document-to-browser/" }
---
## Three pieces, one project

When you start an EDS project you connect three things. Imagine a magazine: the **repository** is the design studio (layouts and fonts), the **content source** is the newsroom (articles), and the **GitHub app** is the courier that takes new layouts from the studio to the printing press.

1. **A GitHub repository** holding your code.
2. **The AEM Code Sync app**, installed on that repository.
3. **A content source** where authors write.

## The repository

You do not start from an empty folder. You create a repository from the boilerplate: open `https://github.com/adobe/aem-boilerplate`, choose **Use this template**, then **Create a new repository** under your org or user. A typical result looks like this:

```text
my-repo/
  blocks/       one folder per block (JS + CSS)
  scripts/      aem.js, scripts.js and friends
  styles/       styles.css, lazy-styles.css
  fonts/  icons/
  head.html     markup injected into <head>
  404.html
  package.json  lint tooling
```

It is only code. There is no content in the repository, and no build step.

## The AEM Code Sync app

You install the **AEM Code Sync** GitHub app on your new repository. In the installation, you choose **Only select repositories** and pick the repo. From then on, every push to any branch is sent to the code bus. Merging into `main` updates the main site.

That is the entire deployment story for code: `git push`. There is no Cloud Manager pipeline.

## The content source

Authors need somewhere to write. Current options include Google Drive, Microsoft SharePoint, Document Authoring (da.live) and AEM authoring with the Universal Editor. The tutorial on aem.live uses Document Authoring; check the docs for what your organisation has enabled.

How is the source connected? The current way is the **configuration service**, set through the Admin API. For example, a site's content source is a `url` plus a `type`, such as `https://content.da.live/acme/website/` with type `markup`. Older projects used an `fstab.yaml` file in the repository to mount a source, and that file is still supported for existing projects. Once the configuration service is in use, its settings take priority over `fstab.yaml`.

## URLs, and branches as environments

Every branch is an environment, and the URL tells you which:

```text
https://<branch>--<repo>--<org>.aem.page/    preview
https://<branch>--<repo>--<org>.aem.live/    live

https://main--website--acme.aem.page/
https://new-hero--website--acme.aem.page/
```

Content is shared across branches. Only the code differs, so you can test a branch's code on real, current content before merging.

<details markdown="1">
<summary>Stretch question: why is the content source not just a folder in the repository?</summary>

Because authors are not developers. Putting content in Git would force every edit through commits and reviews, and would tie content changes to code deployments. Keeping them apart means authors publish in minutes without touching the code, and developers deploy without touching the content.

</details>

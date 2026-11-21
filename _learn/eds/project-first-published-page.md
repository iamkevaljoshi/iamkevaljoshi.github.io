---
title: "Project: a published page from a document"
description: "Create an Edge Delivery Services site from the boilerplate, connect a content source, write a document, then preview and publish it with the Sidekick."
track: eds
level: 1
order: 6
minutes: 15
kind: project
outcome: "By the end you can take a new site from an empty GitHub template to a page live on .aem.live that you wrote in a document."
prereq: "Lessons 1 to 5. You need a GitHub account, Chrome, Node.js, and access to a content source (Google Drive, SharePoint, or Document Authoring at da.live)."
terms:
  - { t: "Use this template", d: "The GitHub button that copies the aem-boilerplate repository into a new repository you own." }
  - { t: "AEM Code Sync", d: "The GitHub app you install on your repository so pushed code reaches the code bus." }
  - { t: "Site setup", d: "Connecting the repository and content source so preview and live URLs work." }
  - { t: "Definition of done", d: "The agreed, observable result that tells you the project is finished." }
mistake: "Skipping the code sync installation or the content source step and then wondering why the preview URL returns a 404. Both must be in place before the first preview works."
try_it:
  - "Open `https://github.com/adobe/aem-boilerplate`, choose Use this template, then Create a new repository under your user or org. Public is recommended by the tutorial."
  - "Install the AEM Code Sync GitHub app on that repo. Choose Only select repositories, pick your new repo and save."
  - "Finish the site setup and connect a content source, following the current steps on `https://www.aem.live/developer/tutorial`."
  - "Install the AEM Sidekick extension in Chrome and pin it."
  - "In your content source, create a document called `index` with a Heading 1, a paragraph and a Metadata table, then Preview it with the Sidekick."
  - "Open the `.aem.page` URL, check it, then click Publish and open the `.aem.live` URL."
  - "Optional: clone the repo, run `aem up`, and change a colour in `styles/styles.css`."
quiz:
  - q: "Your first preview returns a 404. Which is the most likely cause?"
    options:
      - "The new repository needs a day before it can serve any pages"
      - "The page is missing a Heading 1, which every page requires"
      - "The CDN has not warmed up for this brand new site yet"
      - "No content source is connected, or the document is not in it"
    answer: 3
    why: "A 404 on preview usually means the platform cannot find the document in the configured source. A missing heading or a CDN delay would not produce a 404 for an existing document."
  - q: "You published the page, then edited the document and saved. What do visitors on `.aem.live` see?"
    options:
      - "The new text, straight away, since saving updates the live site"
      - "A mix of old and new text while the cache slowly refreshes"
      - "The old version, until you preview and publish again"
      - "An error page until the CDN cache has been cleared"
    answer: 2
    why: "Publishing takes a snapshot of the previewed content. Saving the source changes neither preview nor live, so you have to preview and then publish."
  - q: "Which URL is correct for org `acme`, repo `website`, branch `main`, published?"
    options:
      - "`https://website--main--acme.aem.live/`"
      - "`https://main--website--acme.aem.live/`"
      - "`https://main--website--acme.aem.page/`"
      - "`https://acme--website--main.aem.live/`"
    answer: 1
    why: "The pattern is branch, repo, org, on `.aem.live` for published content. The `.aem.page` version is preview, and the other orders are wrong."
  - q: "Which is NOT part of the definition of done for this project?"
    options:
      - "The repo exists and Code Sync is installed"
      - "A real build pipeline compiles the site"
      - "The page is reachable on `.aem.page` and `.aem.live`"
      - "The document has a title and description in its Metadata"
    answer: 1
    why: "There is no build pipeline in a standard EDS project. Code Sync delivers pushed code directly, so done means a working connection and a published page."
go_deeper:
  - { title: "AEM Edge Delivery Services vs traditional AEM as a Cloud Service", url: "/blog/2026/11/aem-edge-delivery-services-vs-traditional-aemaacs/", why: "reflect on what you just skipped compared with AEMaaCS" }
  - { title: "Universal Editor vs document-based authoring", url: "/blog/2026/11/universal-editor-vs-document-based-authoring/", why: "the other way you could have authored this page" }
  - { title: "Edge Delivery Services performance: keep Lighthouse at 100", url: "/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/", why: "test your new page" }
  - { title: "Next level: The anatomy of a block", url: "/learn/eds/anatomy-of-a-block/" }
---
## The goal

You will build a tiny but real site: a GitHub repository, the Code Sync app, a connected content source and one published page. Everything in the first five lessons comes together here. It takes about 15 minutes if your accounts are ready.

Setup screens change, so use `https://www.aem.live/developer/tutorial` as the source of truth for exact wording. This page gives the shape of the journey and what to check at each step.

## Step by step

**1. Create the repository.** From `https://github.com/adobe/aem-boilerplate`, choose **Use this template**, then **Create a new repository**. Pick your account or org and a short repo name, for example `my-eds-site`. The tutorial recommends a public repository.

**2. Install AEM Code Sync.** Install the app on the new repository only. Under Repository access, choose **Only select repositories**, select your repo and save. If your GitHub Enterprise uses IP filtering, the tutorial lists an IP to allow.

**3. Connect a content source.** Follow the tutorial's setup to choose where authors write. The tutorial uses Document Authoring (da.live). Google Drive, SharePoint and AEM authoring are also supported. The source is set in the configuration service rather than in a file in the repository, though older projects use `fstab.yaml`. Finish the setup when asked.

**4. Install the Sidekick.** Add the AEM Sidekick from the Chrome Web Store and pin it.

**5. Write the page.** In your content source, create a document named `index` in the site's root. Keep it simple:

```text
Heading 1: Hello, Edge Delivery Services
Paragraph: This page was written in a document.

---

Heading 2: Why this is nice
Paragraph: Authors write. Developers decorate. Visitors get speed.

+-------------+--------------------------+
| Metadata                               |
+-------------+--------------------------+
| Title       | My first EDS page        |
| Description | Written in a document    |
+-------------+--------------------------+
```

Create the Metadata as a real table, not text. The `---` becomes a horizontal rule.

**6. Preview and publish.** With the document open, click Sidekick, then **Preview**. Open the URL, which looks like `https://main--my-eds-site--yourorg.aem.page/`. Check it, then click **Publish** and open the `.aem.live` URL. Try the other URL with `.aem.page` swapped for `.aem.live` to see both states.

**7. Optional: change code.** Clone the repo, run `npm install -g @adobe/aem-cli`, then `aem up`. Edit a colour in `styles/styles.css`, commit, and push. Code Sync delivers it, and the change appears on your site once it is on `main`.

## What "done" looks like

You are finished when all of these are true:

- Your repository exists with Code Sync installed.
- The content source is connected and the `index` document lives in it.
- The page loads on `https://main--<repo>--<org>.aem.page/` and on the `.aem.live` equivalent.
- The page has a title and description from its Metadata block.
- You can say which URL is preview, which is live, and which step moves a page between them.

## If it does not work

Check in this order: is Code Sync installed on this exact repo, is the content source connected, is the document in the connected root folder, and did you click Preview before expecting a URL to work. Most first-run problems are one of those four.

<details markdown="1">
<summary>Stretch question: what stayed out of the loop that a traditional AEM project would need?</summary>

There was no local author instance, no Maven build, no Cloud Manager pipeline, no Dispatcher configuration and no deployment of content packages. Writing the page needed no code, and releasing code needed only `git push`. That small footprint is the point of EDS, and the trade-offs are covered in later levels.

</details>

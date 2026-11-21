---
title: "What AEM is, and what problem it solves"
description: "A plain-English introduction to Adobe Experience Manager: what it manages, why enterprises use it, and what 'as a Cloud Service' changes. Start here."
track: aem
level: 1
order: 1
minutes: 8
outcome: "Explain in two minutes what Adobe Experience Manager is, what its main parts do, and what 'as a Cloud Service' means for the people who build on it."
prereq: "Nothing. If you have ever edited a web page, you have enough background."
terms:
  - { t: "Experience Manager (AEM)", d: "Adobe's platform for creating, managing and delivering digital content across websites, apps and other channels." }
  - { t: "Sites", d: "The part of AEM that manages web pages: templates, components, authoring and publishing." }
  - { t: "Assets (DAM)", d: "The part of AEM that stores and processes images, videos and documents, with metadata and renditions." }
  - { t: "AEM as a Cloud Service (AEMaaCS)", d: "The cloud-native version of AEM, run and updated by Adobe, and deployed through Cloud Manager." }
  - { t: "Author and publish", d: "Two separate tiers: authors work on the author tier, and visitors are served from the publish tier." }
mistake: "Treating AEM as 'a website'. It is a content platform. A single AEM instance can feed several websites, apps and campaigns, and teams that miss this end up copying content instead of reusing it."
try_it:
  - "Open any large company website you use and find three things that are probably reused across pages, such as the header, footer and a promo banner."
  - "Write one sentence on who would update each of those three things, and how often."
  - "Ask yourself: if the footer changes, how many pages would need editing without a CMS? That number is the problem AEM solves."
quiz:
  - q: "Which statement best describes what AEM is?"
    options:
      - "A content platform for creating, managing and delivering digital experiences"
      - "A web hosting company that runs your servers"
      - "A JavaScript framework for building single-page applications"
      - "A database that stores customer records"
    answer: 0
    why: "AEM is a content platform. It manages content and assets and delivers them to many channels. It is not a hosting provider, a front-end framework or a customer database."
  - q: "On AEM as a Cloud Service, who is responsible for applying product updates?"
    options:
      - "Your team, once a year, during a planned upgrade project"
      - "Each content author, from the editing screen"
      - "Adobe, continuously, so you always run the latest version"
      - "Nobody, because the version never changes"
    answer: 2
    why: "Cloud Service is updated continuously by Adobe, which removes big-bang upgrade projects. The trade-off is that your custom code must keep working as the product changes."
  - q: "A marketing team wants the same product description on the website, the mobile app and a kiosk. Which AEM idea fits best?"
    options:
      - "Copy the text into each channel by hand"
      - "Build three separate AEM instances"
      - "Store the text in an image so it looks the same everywhere"
      - "Keep the text once as structured content and deliver it to every channel"
    answer: 3
    why: "Structured, reusable content is one of AEM's strengths. You author once and deliver many times, which avoids copies drifting out of sync."
  - q: "Which pair is matched correctly?"
    options:
      - "Sites manages images and videos; Assets manages web pages"
      - "Sites manages web pages; Assets manages images, videos and documents"
      - "Sites and Assets are the same thing with two names"
      - "Sites is for authors; Assets is for developers"
    answer: 1
    why: "Sites is about pages and the experience built from them. Assets, often called the DAM, is about files such as images and videos, plus their metadata and renditions."
go_deeper:
  - { title: "AEM Edge Delivery Services vs traditional AEM as a Cloud Service", url: "/blog/2026/11/aem-edge-delivery-services-vs-traditional-aemaacs/", why: "how the two delivery models compare" }
  - { title: "Composable, headless or traditional AEM: a decision framework", url: "/blog/2026/11/composable-headless-or-traditional-aem-decision-framework/", why: "where AEM fits in a wider architecture" }
  - { title: "Next lesson: Author, publish and preview", url: "/learn/aem/author-publish-preview/" }
---
## The problem AEM solves

Imagine a company with a website of 5,000 pages. The footer needs a new legal line. Without a content platform, someone edits 5,000 files. With one, someone edits the footer **once**, and every page shows it.

That is the heart of it. Large organisations do not just have *a website*. They have many sites, many languages, many teams, a legal department, a brand team and a constant stream of changes. They need:

- **Reuse:** change something once, see it everywhere it is used.
- **Control:** authors can edit content, but cannot break the design or publish without approval.
- **Scale:** thousands of pages and assets, served quickly to millions of visitors.
- **Consistency:** the same components, styles and rules across every site.

Adobe Experience Manager is built for exactly this.

## What is inside AEM

AEM is a family of capabilities. The ones you will meet first are:

| Part | What it manages | Example |
|---|---|---|
| **Sites** | Web pages and the experience built from them | A product page assembled from components |
| **Assets (DAM)** | Images, videos and documents, with metadata | A hero image with several sizes generated for you |
| **Content Fragments** | Structured content with no layout attached | A product description reused by a website and an app |
| **Forms** | Digital forms and their processing | A mortgage application |

You do not need all of them for every project. Many teams start with Sites and Assets.

## Authors and developers work differently

Two groups use AEM, and the platform is designed around keeping them from getting in each other's way.

**Authors** work in a visual editor. They drag components onto a page, type text and choose images. They never touch code.

**Developers** build the components, templates and integrations that authors then use. A good developer makes the author's job safe: they can only do what the design allows.

This split is why AEM projects have a *build* phase and a *run* phase, and why your first mental model should be: *developers build the box of Lego, authors build with it.*

## What "as a Cloud Service" changes

AEM used to be installed on servers that a company or a hosting partner ran. **AEM as a Cloud Service** (AEMaaCS) is the cloud-native version. Adobe runs it for you, and three things follow:

1. **It is always current.** Adobe updates the product continuously, so there are no multi-month upgrade projects.
2. **It scales by itself.** Capacity adjusts to traffic instead of being sized in advance.
3. **You deploy through a pipeline.** Code goes in through Cloud Manager, Adobe's CI/CD tool, rather than being copied onto servers.

The trade-off is discipline. Because the platform keeps moving, your code has to follow the supported patterns, and you cannot change a server by hand.

## Where this course goes next

The next lessons open the box. You will see the **author, publish and preview** tiers, how content is stored in the **JCR**, and how **Sling** turns a URL into a page. By lesson 7 you will have deployed a component on your own machine.

<details markdown="1">
<summary>Stretch question: when would you not use AEM?</summary>

For a small site with one author and little change, a simpler tool is usually cheaper and faster. AEM pays off when scale, governance, reuse and many contributors make the effort worthwhile. Knowing when **not** to use it is part of being good with it.

</details>

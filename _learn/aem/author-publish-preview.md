---
title: "Author, publish and preview: the three tiers"
description: "Why AEM as a Cloud Service splits work into author, publish and preview tiers, how content moves between them, and what sits in front of publish."
track: aem
level: 1
order: 2
minutes: 8
outcome: "By the end you can explain what the author, publish and preview tiers are for, how an approved page reaches visitors, and why authors cannot edit on publish."
prereq: "Lesson 1, What AEM is, and what problem it solves."
terms:
  - { t: "Author tier", d: "The environment where authors create, edit, review and approve content. It is for your team, not for the public." }
  - { t: "Publish tier", d: "The environment that serves approved content to visitors. It is read-only for authors and built to scale with traffic." }
  - { t: "Preview tier", d: "A publish-like environment where authors can check how activated content will look, before it goes live to everyone." }
  - { t: "Dispatcher", d: "A caching and filtering layer (an Apache HTTP Server module) that sits in front of publish and in front of author." }
  - { t: "CDN", d: "A content delivery network. On Cloud Service Adobe provides one in front of Dispatcher, so most requests never reach AEM." }
mistake: "Pointing public traffic at the author tier, or expecting an edit made on publish to be kept. Author is slow to scale, not hardened for the public and holds unapproved drafts. Publish is where visitors belong, and its content only comes from author."
try_it:
  - "Open any AEM-powered public site and view its page source. Note that you are reading publish output, with no editing controls in it."
  - "Draw three boxes labelled author, preview and publish. Add an arrow from author to each of the other two and label it 'approved content'."
  - "Add a CDN and a Dispatcher box in front of publish. Draw where a visitor's request enters and where it can be answered early."
  - "Write down two reasons why a draft page must not be reachable on the public tier."
quiz:
  - q: "What is the main job of the publish tier?"
    options:
      - "Letting authors edit pages safely before approval"
      - "Serving approved content to visitors at scale"
      - "Storing the source code of your project"
      - "Running Cloud Manager pipelines for the team"
    answer: 1
    why: "Publish exists to serve approved content to the public. Editing happens on author, and code is built and deployed by Cloud Manager, not stored or run on publish."
  - q: "An author fixes a typo on the author tier and does nothing else. A visitor reloads the live page. What do they see?"
    options:
      - "The fixed text, because author and publish share one repository"
      - "The fixed text, after a short cache delay only"
      - "The old text, until the page is published again"
      - "A server error, because the page is mid-edit"
    answer: 2
    why: "Author and publish are separate tiers. A change is only visible to visitors after the page is activated (published). Saving on author does not touch publish."
  - q: "Your team wants to review a campaign page exactly as visitors will see it, without exposing it to the public. Which tier fits?"
    options:
      - "Publish, with the page hidden in the navigation"
      - "Author, by sharing the editor link with reviewers"
      - "A second author instance for each reviewer"
      - "Preview, which behaves like publish but with restricted access"
    answer: 3
    why: "Preview renders content the way publish does, so you review real output, and access is restricted. Author shows the editing view and may hold unapproved drafts, and hiding a page on publish still leaves it public."
  - q: "Which statement about the tiers is NOT true on AEM as a Cloud Service?"
    options:
      - "Authors can edit content directly on publish if they are logged in as admin"
      - "Dispatcher and a CDN sit in front of publish"
      - "Content reaches publish only from author, by activation"
      - "Publish can scale out to handle traffic peaks"
    answer: 0
    why: "Publish is read-only for authoring, and there is no supported way to edit there. Content flows one way, author to publish, and the platform scales publish with traffic."
go_deeper:
  - { title: "Dispatcher on AEM as a Cloud Service: caching and invalidation", url: "/blog/2026/11/dispatcher-on-aem-as-a-cloud-service-caching-and-invalidation/", why: "what happens in front of publish" }
  - { title: "The CDN and cdn.yaml (lesson 24)", url: "/learn/aem/cdn-and-cdn-yaml/", why: "the layer that answers most requests" }
  - { title: "Oak storage on AEM as a Cloud Service", url: "/blog/2026/11/oak-storage-tarmk-mongomk-aem-cloud-service/", why: "how content is stored under the tiers" }
  - { title: "Next lesson: The JCR", url: "/learn/aem/jcr-nodes-properties-paths/" }
---
## Why one environment is not enough

Picture a restaurant. The kitchen is where chefs try dishes, make mistakes and plate things up. The dining room is where guests eat. You would not let guests walk into the kitchen, and you would not serve a dish before the chef approves it.

AEM follows the same split. Content is **created** in one place and **served** from another, so drafts never leak and a traffic spike never slows down editing.

## The three tiers

| Tier | Who uses it | What it is for |
|---|---|---|
| **Author** | Authors, reviewers, developers | Create, edit, review and approve content. Draft content lives here. |
| **Publish** | Visitors | Serve approved content. Built to scale up and down with traffic. |
| **Preview** | Authors and reviewers | See how content will look when published, with restricted access. |

The author tier is not designed for public traffic. It holds unapproved work, it carries the editing tools, and it does not need to scale to a million visitors. Keep it behind a login.

The publish tier is the opposite. It is **read-only** from an author's point of view. Nobody edits there, so every publish instance can hold the same approved copy, and Adobe can add or remove instances as traffic changes.

## How content gets from author to publish

On AEM as a Cloud Service, an author **publishes** (activates) a page. AEM hands the change to a managed distribution pipeline run by Adobe, and the publish tier picks it up and applies it. You do not configure queues or agents for this.

You may read about *replication agents* in older material. That is the **AEM 6.5** mechanism, where an author instance pushed content to named publish instances. On Cloud Service, that wiring is part of the platform. Your code mostly just asks for content to be published, and the platform does the rest.

The preview tier is fed in the same way. Authors can push content to preview first, check it, and only then publish it. Because preview renders through the same kind of service as publish, what you see there is what visitors will get. Access to it is restricted rather than public.

## What sits in front of publish

Visitors do not talk to publish directly. A typical request looks like this:

```text
Visitor -> CDN -> Dispatcher -> Publish (AEM)
              |        |
         cached?   cached?
```

The **CDN** answers if it already has the page. If not, **Dispatcher** answers from its cache or filters out requests that should never reach AEM. Only a miss reaches publish. This is why a well-tuned site can serve huge traffic from a small number of publish instances. Level 4 covers both layers in depth.

One consequence is worth remembering: after you publish a change, a visitor may still see the old page until the cached copy is invalidated or expires. Publishing and visibility are related, but not the same moment.

<details markdown="1">
<summary>Predict first, then reveal: a visitor submits a comment through a form on a published page</summary>

Where should that data be stored? Not in publish's repository as if it were content. Publish is not a place to write content that authors will later manage, and nothing written there flows back to author. Visitor-submitted data normally goes to an external system built to receive it, which your page calls through an API.

</details>

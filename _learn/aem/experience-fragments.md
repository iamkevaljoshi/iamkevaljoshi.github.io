---
title: "Experience Fragments"
description: "Experience Fragments are reusable groups of components and layout, such as headers and banners. Learn variations, how pages reference them and when to choose them."
track: aem
level: 3
order: 17
minutes: 8
outcome: "By the end you can explain what an Experience Fragment is, how a page uses one, and when to choose it instead of a Content Fragment."
prereq: "Lesson 16: Content Fragments and models, and lesson 12 on editable templates."
terms:
  - { t: "Experience Fragment", d: "A reusable group of components and their layout, authored once and placed on many pages." }
  - { t: "Variation", d: "A version of an Experience Fragment made for a specific purpose or channel, such as web or social." }
  - { t: "Master variation", d: "The main version of an Experience Fragment, from which other variations are usually created." }
  - { t: "Experience Fragment component", d: "The Core Component that an author places on a page to show a chosen Experience Fragment." }
mistake: "Using an Experience Fragment when you only need data, or a Content Fragment when you need layout. You end up with markup trapped in an API, or a rigid layout you cannot reuse."
try_it:
  - "Open a site you know and find a promo banner that appears on several pages."
  - "Write down what is inside it: image, heading, text, button, and how they are arranged."
  - "Decide whether another channel, like an app, would want the arrangement or only the text and image."
  - "If the arrangement matters, that is an Experience Fragment. If only the fields matter, that is a Content Fragment."
quiz:
  - q: "What does an Experience Fragment contain?"
    options:
      - "A group of components arranged in a layout"
      - "Only fields of text with no presentation"
      - "A single image and its renditions"
      - "A copy of a whole website"
    answer: 0
    why: "An Experience Fragment is built from components and layout, so presentation is included. Fields with no presentation describe a Content Fragment instead."
  - q: "The legal team updates the cookie banner in the master Experience Fragment placed on 800 pages. What should happen once it is published?"
    options:
      - "Each of the 800 pages must be edited and published again"
      - "Nothing changes until someone creates 800 new fragments"
      - "Only pages created afterwards show the change"
      - "Pages that reference it show the new version, with no page edits"
    answer: 3
    why: "Pages reference the fragment instead of copying it, which is the whole value. Remember the changed fragment must be published, and cached pages follow your normal cache rules."
  - q: "An app team needs only the headline and image of a promotion, styled in native code. Which is the better fit?"
    options:
      - "An Experience Fragment, because it is more flexible"
      - "A Content Fragment, because it delivers fields without HTML"
      - "A copy of the web banner HTML inside the app"
      - "A page template with a policy"
    answer: 1
    why: "The app wants data and will do its own presentation. An Experience Fragment brings markup the app would have to strip out, which is the tempting but wrong choice."
  - q: "Which statement about variations is NOT true?"
    options:
      - "An Experience Fragment can have several variations"
      - "A variation can be made for a channel such as web or social media"
      - "Variations are typically created from the master variation"
      - "Every variation must contain exactly the same components"
    answer: 3
    why: "Variations exist so the same idea can be shaped for different purposes, so their contents can differ. The other three statements describe how they are normally used."
go_deeper:
  - { title: "Personalisation: why it matters and how to do it well", url: "/blog/2026/11/personalisation-why-it-matters-and-how-to-do-it-well/", why: "fragments are a common building block for targeted content" }
  - { title: "Accessibility on AEM: fix the component, not the page", url: "/blog/2026/11/accessibility-on-aem-fix-the-component-not-the-page/", why: "one reusable fragment means one place to fix" }
  - { title: "Previous lesson: Content Fragments and models", url: "/learn/aem/content-fragments-and-models/" }
  - { title: "Next lesson: GraphQL and persisted queries", url: "/learn/aem/graphql-persisted-queries/" }
---
## The problem: the same block on hundreds of pages

Headers, footers, cookie banners and campaign promos appear on many pages. You could rebuild them on every page, but one change then means hundreds of edits. Content Fragments solve this for data. For a **group of components with layout**, AEM offers **Experience Fragments**.

An Experience Fragment is a piece of page: components, arranged, authored once, in the Experience Fragments console. Authors create it in a folder, edit it in the same page editor they already know, and publish it.

## How pages use them

On a page, the author places the **Experience Fragment component** (one of the Core Components) and picks a fragment. The page stores a *reference*, not a copy. The fragment's content is then rendered in place.

```text
/content/experience-fragments/mysite/us/en/site/header/master
/content/experience-fragments/mysite/us/en/site/header/master/jcr:content/root
```

Editing the fragment changes every page that references it. Many projects also place the header and footer fragments in the editable template so every page gets them automatically (see lesson 12).

## Variations: one idea, several shapes

Each Experience Fragment has a **master** variation and can have more. Variations are created for a purpose: Adobe's docs describe web and social-media oriented ones, and variations can be created as a live copy of another so they follow it. A variation carries its own components, so a mobile promo can be shorter than the desktop one. Check the current Experience League page for which social channels are still supported before relying on that feature in a project.

## Experience Fragment or Content Fragment?

The decision is whether presentation belongs in the thing you reuse.

| Question | Experience Fragment | Content Fragment |
|---|---|---|
| Includes layout and components? | Yes | No |
| Consumed by | Pages (and some exports) | Pages, apps and APIs |
| Authored in | Page editor | Fragment editor with a model |
| Choose when | You reuse a designed block | You reuse data across channels |

They also combine well: an Experience Fragment can contain a component that renders a Content Fragment. The reverse does not apply.

## A note on caching

Because a page and its fragments are separate resources, publishing a fragment change means cached pages must pick it up. How that works is a Dispatcher and CDN topic (lessons 22 to 24).

<details markdown="1">
<summary>Stretch question: why not use Experience Fragments for everything?</summary>

They carry markup, so they suit web-style delivery. They have no model to enforce a shape, and an API consumer gets presentation it does not want. Use them for designed blocks, and use Content Fragments when the structure of the data is the product.

</details>

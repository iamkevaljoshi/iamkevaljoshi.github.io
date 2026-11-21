---
title: "Project: build three custom blocks"
description: "Build a Hero with variants, a Cards block from a list and an Accordion from details, test them with aem up, and finish with a Lighthouse check."
track: eds
level: 2
order: 14
minutes: 25
kind: project
outcome: "By the end you have three working blocks in your own repository, with authoring tables, variants and a Lighthouse run that shows no regressions."
prereq: "Lessons 7 to 13, and the project from lesson 6 (a repository connected to a content source, with the AEM CLI installed)."
terms:
  - { t: "Authoring table", d: "The table shape authors fill in a document for a block. Design it before the code." }
  - { t: "aem up", d: "The AEM CLI command that serves your local code and proxies content, usually at `http://localhost:3000`." }
  - { t: "Preview URL", d: "The `.aem.page` address for your branch, where unpublished content and code can be checked." }
  - { t: "Definition of done", d: "The checklist that decides when the work is finished, agreed before you begin." }
mistake: "Building the code first and then discovering the authoring table is awkward. If authors cannot fill the table without a manual, no amount of clever JavaScript will save the block."
try_it:
  - "Create a feature branch in your repository and run `aem up` from the project root."
  - "Create a test document with the three authoring tables below and preview it."
  - "Build the Hero block with its `dark` and `centered` variants."
  - "Build the Cards block that turns a list of rows into a `ul`, with optimised images."
  - "Build the Accordion block using `details` and `summary`, and check it with only the keyboard."
  - "Run Lighthouse on the local page and on the `.aem.page` preview, and fix anything below your targets."
  - "Push the branch, open a pull request and confirm the checks pass before you merge."
quiz:
  - q: "Why design the authoring table before writing the block's JavaScript?"
    options:
      - "Because the CLI requires a table definition file"
      - "Because the table is the interface authors use, so it should be easy to understand and stable"
      - "Because tables load faster than other markup"
      - "Because JavaScript cannot read content that was not planned"
    answer: 1
    why: "The table is the contract with authors. Changing it later forces content rework. The CLI needs no table definition, and nothing about the table affects load speed."
  - q: "Your Hero looks fine in Chrome at 1440px. What is the most important check next?"
    options:
      - "Check a phone-width view for readable text and no sideways scroll"
      - "Add several more breakpoints"
      - "Increase the heading size"
      - "Add an animation so it feels more finished"
    answer: 0
    why: "Mobile-first means the small view is the baseline, so it comes first in testing. More breakpoints and animations add risk without checking the baseline."
  - q: "Lighthouse reports a lower performance score after you add the Hero. The hero image is the largest element. What do you try first?"
    options:
      - "Load the image lazily so it is not blocking"
      - "Remove the image"
      - "Make sure the first, visible image loads eagerly at a suitable width"
      - "Use a larger image so it looks sharper"
    answer: 2
    why: "Lazy loading the element that determines Largest Contentful Paint delays it. Removing it dodges the problem, and a bigger file makes things slower."
  - q: "Which is NOT part of a sensible definition of done for this project?"
    options:
      - "Each block is usable with the keyboard"
      - "Each block is scoped under its own class name in CSS"
      - "Each block has a documented authoring table"
      - "Each block loads a UI library so future blocks can reuse it"
    answer: 3
    why: "Blocks should have no dependencies and stay small. The other three are the goals of lessons 8 to 13, and a library works against the performance goal."
go_deeper:
  - { title: "Edge Delivery Services performance: keep Lighthouse 100", url: "/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/", why: "how to read and keep your Lighthouse result" }
  - { title: "Universal Editor vs document-based authoring", url: "/blog/2026/11/universal-editor-vs-document-based-authoring/", why: "authoring tables in context" }
  - { title: "Accessibility on AEM: fix the component, not the page", url: "/blog/2026/11/accessibility-on-aem-fix-the-component-not-the-page/", why: "checks to apply to each block" }
  - { title: "Next lesson: The three-phase loading model", url: "/learn/eds/three-phase-loading/" }
---
## The brief

You will build three small blocks in your own repository. Together they cover the skills from this level: restructuring rows, variants, optimised images, native semantics and a performance check. Work in a feature branch, so that your preview URL does not touch production.

Start `aem up` from the project root, and keep it running. It serves your local `blocks/` folder and proxies content from your content source, normally at `http://localhost:3000`.

## Block 1: Hero with variants

**Authoring table.**

| Hero (dark, centered) | |
|---|---|
| ![Mountain at dawn](hero.jpg) | |
| # Walk more | |
| Short trails near you. | |

The variants are optional. `Hero`, `Hero (dark)` and `Hero (centered)` must all work.

**Decoration.** The block arrives as rows of divs. Keep the markup and add a wrapper class so CSS can lay out the text over the picture. Replace the image with an optimised picture and pass `true` for `eager`, because this is the likely largest element on the page.

**Spec.**

- Mobile: image on top, text below, no horizontal scroll.
- From 900px: text overlaps the image.
- `dark` sets a dark background and light text with enough contrast.
- `centered` centres the text.
- The heading stays an `h1` from the authored text.

## Block 2: Cards from a list

**Authoring table.** One row per card. First cell an image, second cell a bold title and a sentence.

| Cards | |
|---|---|
| ![Mountain](m.jpg) | **Trails** Short walks near you. |
| ![Lake](l.jpg) | **Water** Swim spots, mapped. |

**Decoration.** Use the pattern from lesson 8: create a `ul`, move each row into an `li`, label the image and body cells, replace each picture with `createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }])` and use `block.replaceChildren(ul)`.

**Spec.** One column on mobile, `repeat(auto-fit, minmax(240px, 1fr))` from 900px, `aspect-ratio` on the images to avoid layout shift, every rule prefixed with `.cards`. If you work in the boilerplate repository, `cards` already exists. Name yours `tiles` instead, or rewrite the boilerplate version to match this spec.

## Block 3: Accordion with details

**Authoring table.** Each row has the question first, then the answer.

| Accordion | |
|---|---|
| What is a block? | A table in a document that becomes a styled component. |
| Why use variants? | One block, several looks, no copies. |

**Decoration.** Use the `details` and `summary` code from lesson 13. Add an `open` variant so authors can choose `Accordion (open)` to start every item expanded:

```js
if (block.classList.contains('open')) {
  block.querySelectorAll('details').forEach((d) => d.setAttribute('open', ''));
}
```

**Spec.** Operable with Tab and Space or Enter, a visible `:focus-visible` outline, a reduced-motion rule if you animate anything, and no hard-coded text.

## Test locally

1. Run `aem up` and open your test document's path on `localhost:3000`.
2. Resize to a phone width and to 1440px.
3. Tab through the page with no mouse.
4. View the page source to confirm the rows are plain divs before decoration.
5. Open DevTools, run Lighthouse in a mobile, navigation, incognito window on the local page, then push the branch and run it again on the `.aem.page` preview, which is closer to real delivery.

## What done looks like

- All three blocks render from the tables above, in the preview and locally.
- Variants work: `Hero (dark)`, `Hero (centered)`, `Hero (dark, centered)` and `Accordion (open)`.
- No horizontal scroll at 320px, and the layout changes at 900px.
- Everything works with the keyboard and the focus is visible.
- Every image has the author's alt text carried through, and only the first image is eager.
- Lighthouse on the preview URL shows Accessibility, Best Practices and SEO at or near 100, and Performance in the high 90s or better. If Performance dropped, find the image, font or script responsible before moving on.
- CSS is scoped, no libraries are added, and the branch passes the repository's checks.

Treat the Lighthouse run as a regression test. The lessons in level 3 explain why the number is so reachable on this platform. The post on [keeping Lighthouse 100](/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/) shows how teams hold it.

<details markdown="1">
<summary>Stretch question: what would you change if authors used Universal Editor instead of documents?</summary>

The rendered block would still be rows and cells, so your `decorate` code would stay almost the same. What changes is how the table is defined: a component model describes the fields so the editor can show a form. Read [Universal Editor versus document-based authoring](/blog/2026/11/universal-editor-vs-document-based-authoring/) and revisit it in level 5.

</details>

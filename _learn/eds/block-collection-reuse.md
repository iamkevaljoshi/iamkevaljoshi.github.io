---
title: "The Block Collection and reuse"
description: "Learn what the Block Collection is, how it differs from the boilerplate, and how to copy a block into your project, adapt it and avoid building from scratch."
track: eds
level: 2
order: 11
minutes: 8
outcome: "By the end you can find a block in the Block Collection, copy it into your project, and decide what to change and what to keep."
prereq: "Lessons 7 to 10."
terms:
  - { t: "Boilerplate", d: "The starter repository (`aem-boilerplate`) with the blocks nearly every project needs, such as Hero, Columns, Cards, Header and Footer." }
  - { t: "Block Collection", d: "A set of well-built blocks for common needs, such as Accordion, Tabs, Carousel and Video, offered as blueprints to copy." }
  - { t: "Sidekick Library", d: "A tool inside the AEM Sidekick for browsing block examples and copying their content structure into a document." }
  - { t: "Widget", d: "Larger functionality, such as a calculator or a search results application. Widgets are not blocks." }
mistake: "Treating the Block Collection as a package you install and update. Its blocks are starting points, not versioned dependencies. Teams that expect upgrades find that nothing arrives and the copied code is theirs to maintain."
try_it:
  - "Open the Block Collection page at aem.live/developer/block-collection and list three blocks you would otherwise build yourself."
  - "In the `aem-block-collection` repository, open the `accordion` folder and read its JS and CSS."
  - "Copy the folder into your project's `blocks/` directory."
  - "Open the Sidekick Library or the collection's documentation, copy the content structure and paste it into a test document."
  - "Preview the page, then change one colour in the CSS to match your project and note how little code you touched."
quiz:
  - q: "What is the difference between the boilerplate and the Block Collection?"
    options:
      - "The boilerplate holds blocks almost every project needs, and the collection holds common ones that fewer projects use"
      - "The boilerplate is paid and the collection is free"
      - "The boilerplate is for Universal Editor only, and the collection for documents"
      - "They are the same repository under two names"
    answer: 0
    why: "The docs describe the boilerplate as the blocks used by the vast majority of projects and the collection as commonly used but not universal ones. Neither is paid or editor specific."
  - q: "The client wants a mortgage calculator. Is it a good fit for the Block Collection?"
    options:
      - "Yes, collection blocks cover calculators"
      - "Yes, as long as it is authored as a table"
      - "No, forms and dashboards are always built outside the platform"
      - "No, a calculator is a widget, which is outside what blocks are meant for"
    answer: 3
    why: "The documentation separates blocks from widgets such as calculators and search applications. Calling it a block does not make it one, and you can still build it as custom code."
  - q: "You copied the Tabs block and a new version appears upstream. What should you expect?"
    options:
      - "Your project updates automatically"
      - "Nothing, the copy is yours and is not built to upgrade"
      - "Your pipeline fails until you update"
      - "Authors must republish all their pages"
    answer: 1
    why: "Blocks in the collection are blueprints, not backward-compatible packages. You merge changes by hand if you want them."
  - q: "Which is the best way to use a collection block on a real project?"
    options:
      - "Copy it unchanged so you never have to read the code"
      - "Rewrite the structure so it differs from the original table for brand reasons"
      - "Keep its authoring structure, restyle the CSS, and adjust the JavaScript to your needs"
      - "Wrap it in an iframe"
    answer: 2
    why: "The primary value is the content structure, which is well designed for authors. Styling and behaviour are expected to change, and rewriting the structure throws away the best part."
go_deeper:
  - { title: "Universal Editor vs document-based authoring", url: "/blog/2026/11/universal-editor-vs-document-based-authoring/", why: "how reused block structures reach authors in each editor" }
  - { title: "AEM Edge Delivery Services vs traditional AEM as a Cloud Service", url: "/blog/2026/11/aem-edge-delivery-services-vs-traditional-aemaacs/", why: "why reuse here means copying, not inheriting" }
  - { title: "Next lesson: Responsive design in blocks", url: "/learn/eds/responsive-blocks/" }
---
## The problem: every project needs an accordion

Almost every site needs tabs, an accordion, a carousel and a video embed. If every team builds them from scratch, each one gets accessibility, performance and authoring wrong in its own way. The **Block Collection** exists so you start from something good.

## Boilerplate versus collection

Two sources of blocks are easy to mix up:

| Source | What it holds | Rule of thumb |
|---|---|---|
| **Boilerplate** (`aem-boilerplate`) | Hero, Columns, Cards, Header, Footer, Metadata, Section Metadata | In nearly every project |
| **Block Collection** (`aem-block-collection`) | Accordion, Carousel, Tabs, Quote, Video, Embed, Fragment, Table, Search and more | Commonly used, but not in every project |

The documentation sets the bar for the collection at blocks used by more than half of projects. A boilerplate block that falls out of favour can move across. Headings, text, buttons and similar are *default content*, not blocks, and need no code beyond styles.

## Copy, then own

Reuse here means **copying**. The collection's blocks are blueprints. They are not an npm package, not versioned for upgrade and not guaranteed backward compatible. The documentation says as much: you will probably change most of the CSS and JavaScript.

So what is worth taking? The **content structure**. A collection block has a table shape that authors have already found intuitive, and that someone has tested with real content. You keep that and change the rest to suit your brand.

A typical workflow is:

```bash
cp -r ../aem-block-collection/blocks/accordion blocks/accordion
aem up
```

Then open the Sidekick Library (or the block's documentation), copy the content structure and paste it into a test document. Restyle `accordion.css` with your colours and spacing, run it, and commit. From that moment, the code is yours.

## What good collection blocks share

The project lists qualities every collection block should have, and they are a fair checklist for your own blocks:

- Intuitive to author.
- No dependencies beyond the platform.
- Responsive.
- Inherits styles from its context, rather than hard-coding them.
- Localisable, with no hard-coded text.
- Fast, and friendly to SEO and accessibility.

"No hard-coded content" matters more than it looks. If your block's JavaScript inserts the word "Close", you have made a French page awkward. Prefer text the author supplied.

## When to build instead of copy

Build a custom block when your content model is genuinely different, or when what you need is a widget. Even then, read the nearest collection block first. You will usually find a pattern worth borrowing. For the wider picture of how blocks relate to the authoring tool, read [Universal Editor versus document-based authoring](/blog/2026/11/universal-editor-vs-document-based-authoring/).

<details markdown="1">
<summary>Stretch question: is copying code a problem, given that nothing upgrades?</summary>

It is the trade-off for speed and independence. You get no surprise changes in production and a block shaped to your design. The cost is that fixes upstream will not reach you unless you look. Keep the copied blocks small and review the collection occasionally, as you would any dependency you chose to fork.

</details>

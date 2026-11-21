---
title: "The anatomy of a block"
description: "What a block is in Edge Delivery Services: a table in a document, a div tree in the page, and a folder with a JS and CSS file. Learn how the three connect."
track: eds
level: 2
order: 7
minutes: 9
outcome: "By the end you can map a table in a document to the block's HTML, and name the files and the one function a block needs."
prereq: "Lessons 1 to 6, especially how a document becomes a page and how to run `aem up`."
terms:
  - { t: "Block", d: "A reusable piece of a page, authored as a table in a document and styled and enhanced by its own CSS and JavaScript." }
  - { t: "Decoration", d: "Changing the block's initial HTML in the browser, using JavaScript, so it ends up as the markup you want." }
  - { t: "Section", d: "A group of content on a page, separated from the next by a horizontal rule (---) in the document." }
  - { t: "Default content", d: "Headings, paragraphs, lists, images and links that are not inside a block." }
  - { t: "Block name", d: "The text in the first cell of a table. It decides which folder under `blocks/` supplies the code." }
mistake: "Assuming the block's HTML is what you wrote in the editor. The service delivers plain rows and cells of divs, and your JavaScript has to build anything more. Developers who skip inspecting that raw HTML write selectors that match nothing."
try_it:
  - "In a document, add a table with `Cards` in the first row and two more rows, each with an image cell and a text cell."
  - "Preview the page and open the browser's developer tools. Find `div.cards` and look at its children before any JavaScript changes it, by viewing the page source."
  - "Open `blocks/cards/cards.js` and `blocks/cards/cards.css` in the boilerplate and find the exported function."
  - "In the Elements panel, find the attributes `data-block-name` and `data-block-status` on your block and note their values."
  - "Rename the table's first cell to `Cards (dark)` and look at the block's `class` attribute again."
quiz:
  - q: "A document has a table whose first cell says `Quote`. Which files does Edge Delivery Services look for?"
    options:
      - "`blocks/quote/quote.js` and `blocks/quote/quote.css`"
      - "`components/quote/quote.html` only"
      - "`scripts/quote.js` and `styles/quote.css`"
      - "A Quote entry in a content-type registry"
    answer: 0
    why: "The block name maps to a folder and file names under `blocks/`. There is no registry or component HTML template, and the shared `scripts` and `styles` folders are for site-wide code."
  - q: "What does the browser receive for a block that is a table with two rows and two columns?"
    options:
      - "A `table` element with `tr` and `td` cells"
      - "A `div` for the block, a `div` per row and a `div` per cell"
      - "A custom element with one attribute per cell"
      - "A JSON object that the block renders itself"
    answer: 1
    why: "Blocks are delivered as nested divs: block, rows, cells. A table element would carry styles and semantics the design probably does not want, which is why the service converts it."
  - q: "Your block needs a heading above a list of links, but the author only typed a list. What is the right place to add the heading markup?"
    options:
      - "In the document, by asking authors to add it each time"
      - "In the global stylesheet using a `::before` rule"
      - "In the block's `decorate` function, if the design needs it"
      - "In a second block that authors must always place before it"
    answer: 2
    why: "Decoration is where you shape markup. Forcing authors to repeat structure is fragile, and CSS-generated content is not accessible content."
  - q: "Which statement about blocks is NOT true?"
    options:
      - "A block's JavaScript exports a default function that receives the block element"
      - "A block's CSS is loaded when the block is on the page"
      - "A block can be reused on many pages from the same code"
      - "A block must have a JavaScript file or it will not render"
    answer: 3
    why: "The content still renders without a JavaScript file, though the block then shows its raw rows. The tempting claim confuses 'needs to decorate' with 'needs to exist'."
go_deeper:
  - { title: "Universal Editor vs document-based authoring", url: "/blog/2026/11/universal-editor-vs-document-based-authoring/", why: "how the same block is authored in two ways" }
  - { title: "Edge Delivery Services performance: keep Lighthouse 100", url: "/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/", why: "why blocks load their own code only when needed" }
  - { title: "Next lesson: Decoration", url: "/learn/eds/decoration-js-css/" }
---
## A block has three faces

Suppose an author wants a row of three promo cards. In most CMS products you would build a component, a dialog and a template. In Edge Delivery Services you build a **block**, and a block shows up in three places.

1. **In the document**, it is a table. The first cell holds the name, such as `Cards`. Each further row is a row of content.
2. **In the page**, it is a tree of `div` elements.
3. **In the repository**, it is a folder with a CSS file and a JavaScript file.

Keeping those three faces straight is most of the skill.

## From table to divs

Take this authored table:

| Cards | |
|---|---|
| ![Mountain](mountain.jpg) | **Trails** Short walks near you. |
| ![Lake](lake.jpg) | **Water** Swim spots, mapped. |

The service turns it into plain HTML. Each table row becomes a `div`, and each cell becomes a `div` inside it:

```html
<div class="cards">
  <div>
    <div><picture>...</picture></div>
    <div><p><strong>Trails</strong></p><p>Short walks near you.</p></div>
  </div>
  <div>
    <div><picture>...</picture></div>
    <div><p><strong>Water</strong></p><p>Swim spots, mapped.</p></div>
  </div>
</div>
```

Why divs and not a `table`? Because the table was only an authoring convenience. The design is yours, and you should not inherit table semantics you did not choose. Open the page source (not the Elements panel) and you will see exactly this.

Before your code runs, the boilerplate script `scripts/aem.js` marks the block. It adds the class `block`, sets `data-block-name="cards"` and `data-block-status="initialized"`, wraps it in a `cards-wrapper` div and adds a `cards-container` class to the section. Those hooks are handy in CSS and in the debugger.

## The folder

The block name decides which code loads:

```text
blocks/
  cards/
    cards.css
    cards.js
```

The convention is `blocks/<name>/<name>.js` and `blocks/<name>/<name>.css`. When a page contains a `cards` block, `loadBlock` fetches the CSS and imports the JS in parallel, then calls the default export:

```js
export default function decorate(block) {
  // block is the div.cards element
}
```

That one function is the whole contract. If the block's markup is already what you want, `decorate` can be empty or the file can be skipped. Most blocks use it to restructure rows into the right elements.

## Why the code only loads when needed

A page with no `cards` block never downloads `cards.css` or `cards.js`. That is a big part of how the platform stays fast, and the reason blocks must carry their own styles instead of piling them into one global file. We return to loading in level 3.

## Rows and cells are your data model

Treat the rows and columns as an interface to authors. A block whose first row is a heading and whose other rows are items is easy to explain. A block that needs a particular cell in a particular spot is harder. Design the table first, then write the code that reads it. The blog post on [Universal Editor versus document-based authoring](/blog/2026/11/universal-editor-vs-document-based-authoring/) covers how this table shape affects the authoring experience.

<details markdown="1">
<summary>Predict first, then reveal: what is on screen if `cards.js` is missing?</summary>

The block's CSS can still load, and the rows and cells appear as nested divs, so authors see their content stacked in order. That is why a missing or failing script is usually an ugly page, not a blank one, and why content-first markup is forgiving.

</details>

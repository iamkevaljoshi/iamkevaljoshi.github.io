---
title: "Decoration: block JavaScript and CSS"
description: "How a block's decorate function reshapes its rows into real markup, and how to scope CSS so one block never leaks into another. With a worked cards example."
track: eds
level: 2
order: 8
minutes: 10
outcome: "By the end you can write a `decorate` function that restructures a block's rows, and a CSS file scoped to that block."
prereq: "Lesson 7, the anatomy of a block."
terms:
  - { t: "decorate", d: "The default-exported function in a block's JavaScript file. It receives the block's element and edits it in place." }
  - { t: "loadBlock", d: "The `aem.js` function that loads a block's CSS and JavaScript in parallel and then calls `decorate`." }
  - { t: "Scoped CSS", d: "Rules that all start with the block's class, so they only affect that block." }
  - { t: "createOptimizedPicture", d: "An `aem.js` helper that builds a `picture` element with responsive, WebP and fallback sources." }
mistake: "Writing block CSS with bare selectors such as `ul` or `img`. They apply to every block and the default content on the page, so one block's styling breaks another's, often only on pages where both appear."
try_it:
  - "Create `blocks/tiles/tiles.js` and `blocks/tiles/tiles.css` in your local boilerplate checkout."
  - "Paste in the decorate function from this lesson and run `aem up`."
  - "In your document, add a `Tiles` table with three rows of image and text, then preview it."
  - "In the Elements panel, confirm the block now contains a `ul` with three `li` children."
  - "Remove the `.tiles` prefix from one CSS rule, reload a page with the cards block too, and see the leak."
quiz:
  - q: "When does a block's `decorate` function run?"
    options:
      - "When the author saves the document"
      - "At build time on the server, before the page is published"
      - "On every keystroke in the editor"
      - "In the browser, after `loadBlock` has loaded the block's code"
    answer: 3
    why: "Decoration happens client side, when the page loads the block. Nothing is compiled on the server, which is why the first HTML stays plain and fast to deliver."
  - q: "You write `img { border-radius: 8px; }` in `tiles.css`. What happens on a page that also contains a Hero block?"
    options:
      - "Only images inside Tiles are rounded"
      - "Every `img` on the page is rounded, including the Hero's"
      - "The browser ignores it because it is not scoped"
      - "Only the first image on the page is rounded"
    answer: 1
    why: "CSS is global once loaded. Without the `.tiles` prefix the rule matches every image, so scoping is your job. Browsers do not isolate block CSS for you."
  - q: "You want each row of a block turned into a list item. What is the cleanest approach?"
    options:
      - "Build a `ul`, move each row's children into an `li`, and replace the block's children"
      - "Use `innerHTML` with a template string containing the author's text"
      - "Ask authors to type a bulleted list inside the block"
      - "Hide the rows with CSS and render a new list from a fetch call"
    answer: 0
    why: "Moving existing nodes keeps the author's content, images and links intact. Rebuilding from strings loses nodes and risks injecting unescaped text."
  - q: "Which is a good reason to call `createOptimizedPicture` in a block?"
    options:
      - "It adds alt text automatically if the author forgot it"
      - "It uploads the image to the media bus again"
      - "It gives you a `picture` with sizes suited to the layout, such as a narrow width for cards"
      - "It makes the image lazy loaded, which stops it ever affecting the score"
    answer: 2
    why: "The helper builds sources at widths you choose. It does not invent alt text and does not guarantee a score, only a sensible size and format."
go_deeper:
  - { title: "Edge Delivery Services performance: keep Lighthouse 100", url: "/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/", why: "why small, scoped block code protects the score" }
  - { title: "Image optimisation on AEM: Dynamic Media and Edge Delivery Services", url: "/blog/2026/11/image-optimisation-on-aem-dynamic-media-and-edge-delivery-services/", why: "what happens to images behind the picture helper" }
  - { title: "Previous lesson: The anatomy of a block", url: "/learn/eds/anatomy-of-a-block/" }
---
## The problem: rows of divs are not a design

Lesson 7 ended with a block that looks like nested divs. That is correct markup to *deliver*, but it is rarely the markup you want to *show*. A row of cards is semantically a list, so you want a `ul` with `li` items, not rows of divs. Decoration is the step that closes the gap.

## What runs, and when

The boilerplate's `aem.js` does the plumbing. For each block on the page, `loadBlock(block)` checks that the block is not already loading, sets `data-block-status="loading"`, then fetches `blocks/<name>/<name>.css` and imports `blocks/<name>/<name>.js` at the same time. When the module arrives, it calls the default export with the block's element. Errors are logged, and the status becomes `loaded` either way.

You never call `loadBlock` yourself in a normal block. You only write the function it will call. The function may be `async` if it needs to fetch something.

## A small, real example

This is the same idea as the boilerplate's Cards block, kept short:

```js
import { createOptimizedPicture } from '../../scripts/aem.js';

export default function decorate(block) {
  const ul = document.createElement('ul');

  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    while (row.firstElementChild) li.append(row.firstElementChild);

    [...li.children].forEach((cell) => {
      cell.className = cell.querySelector('picture') && cell.children.length === 1
        ? 'tiles-image'
        : 'tiles-body';
    });
    ul.append(li);
  });

  ul.querySelectorAll('picture > img').forEach((img) => {
    img.closest('picture').replaceWith(
      createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]),
    );
  });

  block.replaceChildren(ul);
}
```

Read it as three steps: **move** each row's cells into a list item, **label** the cells so CSS can target them, **swap** each image for an optimised one at 750 pixels wide (a cards-sized image, not a full-width hero).

Why move nodes rather than write `innerHTML`? The nodes already carry the author's links, emphasis and alt text. Rebuilding from strings drops them and invites escaping mistakes.

## Scoped CSS

Every rule in `tiles.css` starts with the block's class:

```css
.tiles > ul {
  display: grid;
  gap: 24px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tiles .tiles-image img {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
}

.tiles .tiles-body {
  padding: 16px;
}
```

The `.tiles` prefix is the whole defence against leakage. CSS is global once it loads, so `img { ... }` would restyle every image on the page. Prefixing keeps each block self-contained, which is also what lets authors place any blocks together on one page.

Note `aspect-ratio` on the image. It reserves space before the picture arrives, which prevents layout shift. Lesson 12 and level 3 build on that.

## Keep decoration boring

Decoration should reshape, not invent. Do not fetch content you could have authored, do not add libraries, and do not insert things the author cannot see in the document. The performance post, [keep Lighthouse 100](/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/), explains why: every kilobyte in a block lands on the pages that use it.

<details markdown="1">
<summary>Why does this work without a build step?</summary>

Block files are native ES modules and plain CSS, served as they are. The browser imports `tiles.js` directly and runs it, so `aem up` only needs to serve your files and proxy content. There is no bundler to configure, which is also why you must keep your imports as relative paths with the `.js` extension.

</details>

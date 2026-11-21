---
title: "Fonts, icons and images"
description: "How Edge Delivery Services handles web fonts, SVG icons written as :name:, and responsive images, and what each costs the page in speed and layout shift."
track: eds
level: 2
order: 10
minutes: 9
outcome: "By the end you can add a web font without hurting load speed, use an icon from authored `:name:` text, and resize images in a block."
prereq: "Lessons 7 to 9."
terms:
  - { t: "fonts.css", d: "The stylesheet with the project's `@font-face` rules, loaded after the first content is on screen rather than with the critical styles." }
  - { t: "Fallback font", d: "A local font adjusted with `size-adjust` so text takes up almost the same space before and after the web font arrives." }
  - { t: "Icon", d: "An SVG file in `/icons/`, authored as `:name:` and turned into an image by `decorateIcons`." }
  - { t: "Optimised picture", d: "A `picture` element with WebP and fallback sources at several widths, produced for authored images." }
mistake: "Loading fonts or images eagerly 'to be safe'. A render-blocking font stylesheet or an oversized hero image costs the Largest Contentful Paint, and the score drops on every page."
try_it:
  - "Open `styles/fonts.css` in the boilerplate and note the `font-display` value and the `.woff2` paths."
  - "Open `styles/styles.css` and find the fallback font rules that use `size-adjust` and `src: local('Arial')`."
  - "Save an SVG as `icons/arrow-right.svg`, then type `:arrow-right:` in a paragraph in a document and preview it."
  - "Inspect the resulting `span.icon.icon-arrow-right` and the `img` inside it."
  - "Throttle the network to Slow 4G in developer tools and watch how the page text behaves while the font loads."
quiz:
  - q: "Why does the boilerplate define a fallback font with `size-adjust`?"
    options:
      - "To make the web font file download faster"
      - "To keep text a similar size, so the swap shifts little"
      - "To avoid paying for a web font licence"
      - "To force older browsers to use Arial"
    answer: 1
    why: "The fallback is tuned to match the web font's metrics, so lines wrap in nearly the same places before and after the swap. It does not speed up the font."
  - q: "An author types `:phone:` in a paragraph. What must exist for it to show an icon?"
    options:
      - "A registered icon entry in a site configuration spreadsheet"
      - "A font file containing a phone glyph"
      - "A `phone` block with its own JavaScript"
      - "An SVG at `icons/phone.svg` in the code repository"
    answer: 3
    why: "The authored text becomes a span with the class `icon-phone`, and `decorateIcons` loads `/icons/phone.svg`. There is no registry or icon font."
  - q: "You change a block's images from 2000 pixels wide to 750. What is the main benefit?"
    options:
      - "Smaller downloads on a card layout that never shows them at full width"
      - "The images become accessible"
      - "The page no longer needs `alt` text"
      - "Authors can upload larger originals without penalty"
    answer: 0
    why: "Matching the requested width to the layout saves bytes, which helps loading. It has nothing to do with accessibility, and alt text is still needed."
  - q: "Which choice is a mistake?"
    options:
      - "Using `font-display: swap` in `@font-face`"
      - "Keeping icons as SVG files with an empty `alt` when they only decorate text"
      - "Adding the font stylesheet to the page head as a blocking link for consistency"
      - "Using `createOptimizedPicture` with the eager flag only for the first, visible image"
    answer: 2
    why: "A blocking font stylesheet delays the first paint. The other three are sound: swap shows text early, decorative icons need no description, and only the visible hero image should load eagerly."
go_deeper:
  - { title: "Image optimisation on AEM: Dynamic Media and Edge Delivery Services", url: "/blog/2026/11/image-optimisation-on-aem-dynamic-media-and-edge-delivery-services/", why: "how delivered images are resized and formatted" }
  - { title: "Edge Delivery Services performance: keep Lighthouse 100", url: "/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/", why: "fonts and images are the usual causes of a lost point" }
  - { title: "Next lesson: The Block Collection and reuse", url: "/learn/eds/block-collection-reuse/" }
---
## The problem: three things that quietly slow a page

Fonts, icons and images are where good-looking pages become slow pages. A heavy font can delay text. An icon font drags in hundreds of glyphs for three arrows. A 2000-pixel image fills a 300-pixel card. The boilerplate has a default answer to each.

## Fonts: late, but without a jolt

The boilerplate keeps `@font-face` rules in `styles/fonts.css`, separate from `styles/styles.css`. The file declares each weight with `font-display: swap` and points at `.woff2` files in a `fonts/` folder:

```css
@font-face {
  font-family: roboto;
  font-weight: 400;
  font-style: normal;
  font-display: swap;
  src: url('../fonts/roboto-regular.woff2') format('woff2');
}
```

`scripts.js` loads this stylesheet with `loadCSS` after the first section is displayed, so the first paint does not wait for it. Meanwhile text shows in a fallback. The trick is the fallback itself. In `styles.css`, a local Arial is declared as a font called `roboto-fallback` with `size-adjust`, and the font stack lists it:

```css
:root {
  --body-font-family: roboto, roboto-fallback, sans-serif;
}
```

Arial scaled by `size-adjust` takes nearly the same width as Roboto, so lines wrap in the same places, and the swap causes little or no layout shift. When you change fonts, you must tune a new fallback, otherwise you trade a fast first paint for a jumpy one.

## Icons: SVG files and a colon syntax

Authors write an icon as text between colons: `:arrow-right:`. The service turns it into `<span class="icon icon-arrow-right"></span>`. The boilerplate's `decorateIcons(element)` finds each such span, reads the name from the class, and inserts:

```html
<span class="icon icon-arrow-right">
  <img data-icon-name="arrow-right" src="/icons/arrow-right.svg" alt="" loading="lazy" width="16" height="16">
</span>
```

So an icon is just an SVG in `icons/` named after the colon text. No icon font, no registry. The `alt` is empty by default because most icons decorate adjacent text. If an icon alone carries meaning, give the link or button an accessible name instead (lesson 13).

If your block builds new icon spans in JavaScript, call `decorateIcons(block)` yourself after inserting them:

```js
import { decorateIcons } from '../../scripts/aem.js';

export default function decorate(block) {
  block.querySelectorAll('li').forEach((li) => {
    const span = document.createElement('span');
    span.className = 'icon icon-check';
    li.prepend(span);
  });
  decorateIcons(block);
}
```

## Images: authored once, sized by you

Authors upload one image. The platform delivers it as a `picture` with WebP and fallback sources. Blocks refine this with `createOptimizedPicture(src, alt, eager, breakpoints)`. The defaults are a 2000-pixel source for viewports from 600 pixels and 750 pixels below that. For a card, pass your own:

```js
const pic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
img.closest('picture').replaceWith(pic);
```

The third argument is `eager`. Only pass `true` for the image that is visible on first load (usually the first block's image); everything else stays lazy. Always carry the author's `alt` across, as the example does. The image blog post, [Dynamic Media and Edge Delivery Services](/blog/2026/11/image-optimisation-on-aem-dynamic-media-and-edge-delivery-services/), explains the pipeline behind it.

<details markdown="1">
<summary>Stretch question: why not load fonts first so there is no swap at all?</summary>

Because text visible in a fallback is still readable. A render-blocking font request makes visitors stare at nothing until the file arrives, which hurts perceived speed and the Largest Contentful Paint. A well-matched fallback gives you speed without much visual cost.

</details>

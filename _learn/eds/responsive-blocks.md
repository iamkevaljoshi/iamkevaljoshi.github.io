---
title: "Responsive design in blocks"
description: "Write mobile-first block CSS for Edge Delivery Services: the boilerplate's 900px breakpoint, clamp() for fluid sizes, and grids that adapt without media queries."
track: eds
level: 2
order: 12
minutes: 8
outcome: "By the end you can write block CSS that works on a phone first, scales fluidly and adds a layout change at the boilerplate's breakpoint."
prereq: "Lessons 7 to 11."
terms:
  - { t: "Mobile-first", d: "Writing the small-screen styles as the default, then adding rules for wider screens with `min-width` queries." }
  - { t: "Breakpoint", d: "A viewport width at which the layout changes. The boilerplate's `styles.css` uses `900px`." }
  - { t: "clamp()", d: "A CSS function with a minimum, a preferred value and a maximum, so a size grows with the viewport but stays within limits." }
  - { t: "Intrinsic layout", d: "Layout that adapts to the space available, for example a grid using `auto-fit` and `minmax()`, rather than fixed breakpoints." }
mistake: "Designing for desktop and patching the phone with `max-width` queries. The result is more CSS, more overrides and a mobile layout that is an afterthought, on the devices most visitors use."
try_it:
  - "Open `styles/styles.css` in the boilerplate and find the `@media (width >= 900px)` rules. Note which variables change."
  - "In your Tiles block, replace a fixed grid of three columns with `repeat(auto-fit, minmax(240px, 1fr))`."
  - "Resize the browser from 320px to 1400px and watch the number of columns change without any media query."
  - "Change a heading size to `clamp(1.5rem, 1rem + 2vw, 2.5rem)` and watch it scale."
  - "Emulate a phone in developer tools and check there is no horizontal scrolling."
quiz:
  - q: "What does 'mobile-first' mean in CSS?"
    options:
      - "Testing only on phones"
      - "Hiding desktop content from mobile users"
      - "Using `max-width` queries to remove desktop features"
      - "Writing the base styles for small screens and adding `min-width` queries for larger ones"
    answer: 3
    why: "Mobile-first is about the direction of the cascade. Phones get the simplest rules with no overrides, and wider screens add layout. Using `max-width` to undo desktop styles is the opposite approach."
  - q: "A card grid should show as many 240px-minimum columns as will fit. Which CSS achieves that without a media query?"
    options:
      - "`grid-template-columns: repeat(3, 1fr)`"
      - "`grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))`"
      - "`display: flex; width: 240px`"
      - "`columns: 3`"
    answer: 1
    why: "`auto-fit` with `minmax` lets the browser decide the column count from the available width. A fixed `repeat(3, 1fr)` always makes three columns, which squeeze on a phone."
  - q: "A block sets `font-size: 48px` on its heading. What is the best fix for a small phone?"
    options:
      - "Use `clamp()` so the size scales between a sensible minimum and maximum"
      - "Switch to 12px"
      - "Hide the heading below 600px"
      - "Add `overflow: hidden` so it cannot wrap"
    answer: 0
    why: "`clamp()` keeps the size readable at both ends. Hiding the heading removes content, and `overflow: hidden` clips words instead of fixing the size."
  - q: "Which is NOT a reason to use the page's existing design tokens, such as `--body-font-size-m`, in block CSS?"
    options:
      - "Sizes already adjust at the breakpoint, so the block inherits that change"
      - "Brand changes happen in one place"
      - "It makes the block run faster in the browser than literal values"
      - "Blocks stay consistent with default content"
    answer: 2
    why: "Custom properties give consistency and central control, not extra speed. The other three are the real benefits, including the 900px resizing the boilerplate applies to its tokens."
go_deeper:
  - { title: "Edge Delivery Services performance: keep Lighthouse 100", url: "/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/", why: "layout shift and small CSS keep the score high" }
  - { title: "Image optimisation on AEM: Dynamic Media and Edge Delivery Services", url: "/blog/2026/11/image-optimisation-on-aem-dynamic-media-and-edge-delivery-services/", why: "serving the right image width per screen" }
  - { title: "Next lesson: Accessibility in blocks", url: "/learn/eds/accessible-blocks/" }
---
## The problem: your block is seen on a 360px phone first

Most visits to most sites are on phones. If you build a block at 1440px and squeeze it down later, you will write more CSS to undo things than to do them. Mobile-first reverses that. You write the simplest layout as the default, and add to it as space grows.

## What the boilerplate already does

The boilerplate's `styles.css` is a good model, and it is small. It defines sizes as custom properties on `:root`, such as `--body-font-size-m: 22px`, then, inside one `@media (width >= 900px)` rule, it lowers the body and heading sizes for larger screens. A second rule at the same width increases the side padding of section content from 24px to 32px. The section content is capped with `max-width: 1200px`.

So there is one breakpoint, **900px**, and a *container* (a centred column with padding) that your blocks sit inside. Your block does not need to know the page width. It only needs to behave well in whatever space its section gives it.

Many blocks use the same breakpoint for consistency. You are free to add others when a layout truly breaks, but start with 900px.

## A mobile-first block

Here is a card list that is one column on a phone and as many columns as fit on a larger screen:

```css
.tiles > ul {
  display: grid;
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
  grid-template-columns: 1fr;
}

.tiles h3 {
  font-size: clamp(1.125rem, 1rem + 1vw, 1.5rem);
  margin: 0 0 8px;
}

@media (width >= 900px) {
  .tiles > ul {
    gap: 24px;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }
}
```

Notice what is absent: no rule for the phone, because the base styles *are* the phone layout. The media query only adds. The `@media (width >= 900px)` range syntax is the same form the boilerplate uses; `min-width: 900px` means the same thing.

## Fluid sizing with clamp()

`clamp(min, preferred, max)` picks the preferred value but never goes below the minimum or above the maximum. In the heading above, the size is at least `1.125rem`, grows with the viewport using `1vw` and stops at `1.5rem`. You get smooth scaling without a breakpoint, and the minimum stops text becoming unreadable. Using `rem` also respects visitors who have raised their browser's default text size.

## Let the layout decide

You can often skip media queries altogether. `repeat(auto-fit, minmax(240px, 1fr))` asks the browser to fit as many columns of at least 240px as it can. This is container-friendly: the same block in a narrow column of a Columns block and in a full-width section will pick the right number of columns for each, which a viewport-based breakpoint cannot do.

## Images and layout shift

Reserve space for images with `aspect-ratio` and `width: 100%`, as in lesson 8, so content below does not jump when images load. Pair that with the right image width from `createOptimizedPicture`. Layout shift is part of the score you will protect in level 3, and the [performance post](/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/) shows what it costs.

<details markdown="1">
<summary>Predict first, then reveal: does the same block look the same in two different sections?</summary>

Not necessarily, and that is the point. A block inside a narrow column gets less width than one in a full-width section. With `auto-fit`, the first shows fewer columns and the second more, using identical code. A fixed breakpoint would have chosen based on the screen, not on the space the block actually has.

</details>

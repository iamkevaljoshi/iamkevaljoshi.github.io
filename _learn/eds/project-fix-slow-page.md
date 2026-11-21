---
title: "Project: audit a slow page and fix it"
description: "A hands-on project: diagnose a deliberately slow Edge Delivery Services page with PageSpeed Insights, fix four problems in boilerplate-style code, and re-measure."
track: eds
level: 3
order: 19
minutes: 20
kind: project
outcome: "By the end you can audit a slow EDS page, trace each problem to its cause, fix it in code, and show a before and after measurement."
prereq: "Lessons 15 to 18, and a working local boilerplate project (lesson 5)."
terms:
  - { t: "Baseline", d: "The measurements you take before changing anything, so you can prove an improvement." }
  - { t: "LCP element", d: "The specific element Lighthouse reports as the largest visible content; fix this first." }
  - { t: "Layout shift", d: "Visible content moving after it has been painted, usually because space was not reserved." }
  - { t: "Blocking time (TBT)", d: "Lab measure of how long the main thread is blocked by scripts, a proxy for poor responsiveness." }
  - { t: "Facade", d: "A light stand-in that loads the heavy real thing only on interaction." }
mistake: "Changing several things at once and re-measuring only at the end. When the score moves, or does not, you cannot tell which fix did it. Fix one problem, measure, then move on."
try_it:
  - "Baseline: run PageSpeed Insights (mobile) on the slow page. Record score, LCP, CLS, TBT and the LCP element. Screenshot it."
  - "Fix 1: remove `loading=\"lazy\"` from the hero image and resize and compress it so the image fetched on mobile is small. Re-measure."
  - "Fix 2: move the third-party script out of `head.html` and into `scripts/consented.js`. Re-measure."
  - "Fix 3: add a fallback font with `size-adjust` and give the hero image `width` and `height`. Re-measure CLS."
  - "Fix 4: make the carousel render one eager slide and load the rest after interaction or when near the viewport. Re-measure."
  - "Compare against the baseline in a small table and note which fix gave the biggest gain."
  - "Run the site's [SEO audit tool](/tools/seo-audit/) on the page as a second opinion."
quiz:
  - q: "In this project, which problem should you look at first when LCP is poor?"
    options:
      - "The LCP element Lighthouse reports, here the hero image"
      - "The footer links, because they are the last thing loaded"
      - "The font files, because fonts are always the largest asset"
      - "The robots.txt file"
    answer: 0
    why: "Lighthouse names the element it counted as LCP, and that is the thing to fix. The footer and other lazy content are not on the LCP path at all."
  - q: "After removing the third-party script from head.html you re-measure and the score barely changes, but blocking time falls. What does this tell you?"
    options:
      - "The fix failed, so it should be reverted at once"
      - "The script cost main-thread time, but other problems still limit it"
      - "The script was never really a third-party one"
      - "Lighthouse does not measure any scripts at all"
    answer: 1
    why: "Each problem affects different metrics. A fix can help blocking time without moving the headline score if LCP or CLS problems remain. That is why you fix one at a time and watch the specific metric."
  - q: "Which change best reduces the layout shift caused by a late-loading web font?"
    options:
      - "Preload every font file in head.html"
      - "Hide the text until the font loads"
      - "Define a fallback face with size-adjust so the swap barely moves"
      - "Use more font weights"
    answer: 2
    why: "A tuned fallback makes the fallback and web font occupy nearly the same space, so the swap hardly moves anything. Preloading competes with LCP, and hiding the text delays it."
  - q: "Which statement about the 'done' targets is correct?"
    options:
      - "Reaching them guarantees top search rankings"
      - "They are goals, and lab scores vary between runs and pages"
      - "They are fixed rules set by Adobe"
      - "They only apply to desktop"
    answer: 1
    why: "Lab scores vary from run to run and depend on the page. Treat the targets as goals to aim at and verify with several runs, not as promises."
go_deeper:
  - { title: "Edge Delivery Services performance: how to keep a 100 Lighthouse score after go-live", url: "/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/", why: "the month-two audit checklist for the same problems" }
  - { title: "Image optimisation on AEM: Dynamic Media and Edge Delivery Services", url: "/blog/2026/11/image-optimisation-on-aem-dynamic-media-and-edge-delivery-services/", why: "choosing how to deliver the hero" }
  - { title: "Image optimiser tool", url: "/tools/image-optimiser/", why: "compress and resize the hero before you upload it" }
  - { title: "Next level: fstab, paths.json and content mappings", url: "/learn/eds/paths-fstab-mappings/" }
---
## The scenario

A colleague hands you a landing page and says: "It looks great but it feels slow, and PageSpeed shows 54 on mobile." You are going to find out why, fix it, and prove it. You will use a copy of the boilerplate project from lesson 5, so the files below are the ones you already know.

The page has four deliberate problems:

1. The **hero image** is a 3 MB JPEG straight from a camera, and it is marked `loading="lazy"`.
2. A **blocking third-party script** (a tag manager) sits in `head.html`.
3. A **web font** swaps in late and the headline visibly jumps.
4. A **heavy carousel block** loads several large slides and a library in the first section.

Create the problems yourself if you do not have such a page: add the lazy attribute to the hero, paste a vendor script tag into `head.html`, add a custom font with no fallback tuning, and build a block that imports a library and renders four large images.

## Step 0: take a baseline

Run PageSpeed Insights on the mobile tab, three times, because lab scores wobble. Write down the median score, LCP, CLS, total blocking time and the **LCP element** it reports. Save a screenshot. Without this you cannot prove anything later.

## Step 1: fix the hero image

Two faults here. The image is huge, and lazy loading delays it. First, resize it to about the largest size you need and compress it; the [image optimiser tool](/tools/image-optimiser/) on this site does this in the browser. Then make sure the first image is eager. In authored content there is nothing to change; the boilerplate's `waitForFirstImage` already marks the first image of the first section as eager, so the fault is wherever your code overrode it:

```js
// blocks/hero/hero.js (before)
block.querySelectorAll('img').forEach((img) => img.setAttribute('loading', 'lazy'));

// after: remove that line. Leave the first image alone.
```

Also keep to one image, from the same origin, with `createOptimizedPicture()` producing the responsive sources. Re-measure. LCP should move the most here.

## Step 2: get the third party out of the head

Delete the vendor snippet from `head.html`. Then load it after consent in the delayed path, as in lesson 17:

```js
// scripts/consented.js
import { loadScript } from './aem.js';

await loadScript('https://www.googletagmanager.com/gtm.js?id=GTM-XXXXXXX', { async: '' });
```

Test with `?consent=accept` on the URL to confirm it loads, and without it to confirm it does not. If you want a minimum wait, add it in `loadDelayed()` yourself. Watch blocking time in the re-measure.

## Step 3: remove the layout shift

Give the hero image dimensions and add a fallback font tuned to the web font. Compute the `size-adjust` value for your own font (Adobe documents a font fallback tool for this); the number below is only an example:

```css
@font-face {
  font-family: brand-sans-fallback;
  size-adjust: 99.5%;
  src: local('Arial');
}

:root {
  --body-font-family: brand-sans, brand-sans-fallback, sans-serif;
}
```

```html
<img src="./media_hero.jpeg?width=750&format=jpeg&optimize=medium" alt="Mountain road at dawn" width="1200" height="600">
```

Re-measure CLS, and watch the page loading on a throttled connection to see whether anything still jumps.

## Step 4: tame the carousel

The first slide is the hero in disguise, so render it as a normal image and load the rest later:

```js
export default function decorate(block) {
  const slides = [...block.children];
  slides.slice(1).forEach((slide) => { slide.hidden = true; });

  const loadRest = async () => {
    const { initCarousel } = await import('./carousel-lib.js');
    initCarousel(block);
  };

  block.addEventListener('pointerenter', loadRest, { once: true });
  block.addEventListener('focusin', loadRest, { once: true });
}
```

Give the block a fixed `aspect-ratio` so nothing shifts when the library arrives. If the carousel is not in the first section, simply do not load the library until the block is near the viewport. Better still, ask whether the page needs a carousel at all.

## What done looks like

Compare your final run with the baseline. As goals, not guarantees:

| Metric | Baseline | Goal |
|---|---|---|
| Mobile PageSpeed score | about 54 | 90 or above, ideally 100 |
| LCP | about 4 s or more | 2.5 s or less |
| CLS | about 0.2 or more | 0.1 or less |
| Third-party requests before LCP | 1 or more | 0 |

Lab scores vary between runs and with the page, so take the median of three. If you fall short, use the PageSpeed diagnostics to find what is left rather than guessing.

<details markdown="1">
<summary>Stretch question: the score is 100, but real users are still slow. Where do you look?</summary>

At field data from lesson 18. A lab run does not click anything, so INP problems, late shifts and slow phones appear only in Operational Telemetry. Look at mobile first, find the date it changed and match it to a release.

</details>

Finish by writing a three-line note for your team: what was wrong, what you changed, and the before and after numbers. That note is half the value of the exercise.

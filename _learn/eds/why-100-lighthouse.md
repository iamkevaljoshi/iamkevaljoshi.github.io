---
title: "Why a 100 Lighthouse score is achievable"
description: "Why Edge Delivery Services sites can reach a 100 Lighthouse score, what LCP, CLS and INP measure, and the habits that decide whether you keep it."
track: eds
level: 3
order: 16
minutes: 9
outcome: "By the end you can explain why the LCP image must load eagerly, how to prevent layout shift, and how a 100 lab score differs from good field data."
prereq: "Lesson 15, The three-phase loading model."
terms:
  - { t: "Lighthouse", d: "A tool that loads a page once in a simulated device and network and gives it a score out of 100." }
  - { t: "CLS (Cumulative Layout Shift)", d: "A measure of how much visible content jumps around while the page loads." }
  - { t: "INP (Interaction to Next Paint)", d: "How quickly the page responds visually after clicks, taps and key presses during a visit." }
  - { t: "Field data", d: "Measurements from real visitors' browsers, as opposed to a single lab run." }
  - { t: "Aspect ratio", d: "The width to height proportion of an element, which lets the browser reserve space before an image arrives." }
mistake: "Treating the Lighthouse 100 as the finish line. It is one lab run. Real visitors, other templates and late-loading scripts can still produce poor field data."
try_it:
  - "Run PageSpeed Insights on a page of your boilerplate site, mobile tab, and write down the score and the LCP element it reports."
  - "Open the LCP image in DevTools and check it does not have `loading=\"lazy\"`."
  - "Check the same `img` has `width` and `height` attributes."
  - "Throttle the network to Slow 4G and reload while watching for content jumping."
  - "Scroll to the field data section at the top of the PageSpeed result, if present, and compare it with the lab score."
  - "Run the site's [SEO audit tool](/tools/seo-audit/) on the same URL and compare what it reports."
quiz:
  - q: "Why should the LCP image not be lazy loaded?"
    options:
      - "Lazy loading is not supported for images in blocks"
      - "The browser delays fetching it, so the main content appears later"
      - "It makes the image lower quality"
      - "It causes the image to load twice"
    answer: 1
    why: "Lazy loading tells the browser to wait. For something below the fold that saves bandwidth, but for the hero it delays the very thing LCP measures."
  - q: "An image has no width or height attributes and its container has no aspect ratio. What is the likely effect?"
    options:
      - "The image loads slower but nothing else changes"
      - "The browser guesses the size correctly from the file name"
      - "Lighthouse ignores the image completely"
      - "Content below the image jumps down when it loads, hurting CLS"
    answer: 3
    why: "Without dimensions the browser reserves no space, so everything shifts when the image arrives. Dimensions or an aspect ratio let it hold the space in advance."
  - q: "A site scores 100 in Lighthouse but its real-user data shows poor INP. What is the best explanation?"
    options:
      - "Lighthouse was run on the wrong URL"
      - "A later script, such as a chat widget, blocks the main thread on real taps"
      - "Field data is always worse than lab data by design"
      - "INP only applies to desktop visitors"
    answer: 1
    why: "A lab run is one short load and does not click anything. Scripts that become heavy later, or handlers that do too much work, show up only in real interactions."
  - q: "Which is NOT a reason EDS sites can reach 100 so readily?"
    options:
      - "Plain, small pages with no framework required for first paint"
      - "Phased loading that keeps the pre-LCP payload small"
      - "A guarantee that scores can never drop after changes"
      - "Images served and optimised from the same origin"
    answer: 2
    why: "EDS makes 100 easy to reach, not impossible to lose. Scores drop whenever heavy scripts, images or blocks are added to the wrong phase."
go_deeper:
  - { title: "Edge Delivery Services performance: how to keep a 100 Lighthouse score after go-live", url: "/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/", why: "what breaks the score over time and how to govern it" }
  - { title: "Image optimisation on AEM: Dynamic Media and Edge Delivery Services", url: "/blog/2026/11/image-optimisation-on-aem-dynamic-media-and-edge-delivery-services/", why: "image delivery choices and their cost to LCP" }
  - { title: "What actually matters in SEO", url: "/blog/2026/11/what-actually-matters-in-seo/", why: "where Core Web Vitals sit among ranking factors" }
---
## Why 100 is realistic here

On many platforms, a 100 means fighting the framework: hydration, large bundles, render-blocking styles. EDS starts from a different place. Pages are mostly plain HTML from the edge, blocks are small, and the three-phase model from lesson 15 keeps the first paint light. The boilerplate scores 100 on day one, and the AEM GitHub bot checks pull requests against PageSpeed Insights, so you find out about regressions early.

So the question is less "can we get there?" and more "what will push us off?" Three things matter most: LCP, layout shift and what runs after load.

## Rule one: the LCP image loads eagerly

LCP is usually the hero image. If it is marked `loading="lazy"`, the browser deliberately postpones it until layout tells it the image is near the viewport. You have added a delay to the single most important request.

In EDS you rarely need to do anything: the boilerplate's `waitForFirstImage` handling makes the first image in the first section eager, and `createOptimizedPicture()` builds a responsive `<picture>` from same-origin media. What you must avoid is overriding that, for example by setting lazy loading on every image in your own block, or by replacing the hero with an image from another origin, which costs an extra connection before LCP.

Keep it to one hero image. A carousel in the first section means several large images and script competing before LCP. If the business insists, render the first slide as an ordinary eager image and load the rest later.

## Rule two: reserve space so nothing jumps

Layout shift happens when the browser did not know how much room something would need. The cure is to tell it early.

```html
<picture>
  <source type="image/webp" srcset="./media_hero.webp?width=2000&format=webply&optimize=medium" media="(min-width: 600px)">
  <img src="./media_hero.jpeg?width=750&format=jpeg&optimize=medium"
       alt="Mountain road at dawn" width="1200" height="600">
</picture>
```

```css
.hero .hero-image img {
  width: 100%;
  height: auto;
  aspect-ratio: 2 / 1;
}
```

With `width` and `height`, modern browsers work out the aspect ratio before the file arrives and hold the space. The same logic applies to embeds, maps and any block that fills in later: give it a fixed `aspect-ratio` or a minimum height. Late-injected banners, such as a cookie notice that pushes the page down, count against CLS too, so make them overlays.

Fonts can shift layout as well, when a web font replaces a fallback with different letter widths. The next project and lesson 10 show how a fallback font with `size-adjust` softens that.

## Rule three: lab 100 is not the whole story

Lighthouse runs one simulated load. Google's ranking signals use field data from real Chrome users. The usual thresholds at the 75th percentile are LCP at 2.5 seconds or less, INP at 200 milliseconds or less, and CLS at 0.1 or less. INP measures interactions across a whole visit, which a plain page load cannot capture, so a heavy chat widget or an overworked menu handler can fail INP while Lighthouse stays green. Lesson 18 shows how to see this data. For the wider SEO picture, see [what actually matters in SEO](/blog/2026/11/what-actually-matters-in-seo/).

<details markdown="1">
<summary>Stretch question: why do big images hurt even when they are lazy loaded?</summary>

They may not hurt LCP, because they are below the fold. But if they lack dimensions they cause layout shift when they load, and if they are very large they use bandwidth that later interactions needed. Lazy is not a licence to ignore size. Run an image through the site's [image optimiser](/tools/image-optimiser/) to see how much weight is usually avoidable.

</details>

## What to take away

A 100 is the entry ticket. Protect it with three habits: one eager, optimised hero; reserved space for everything; and nothing heavy in the path before LCP. The next lesson looks at the thing most likely to break all three: third-party scripts.

---
title: "Performance and Core Web Vitals on AEM"
description: "What LCP, INP and CLS mean in plain words, what typically moves each on AEM sites, and how to measure with field and lab data."
track: aem
level: 4
order: 25
minutes: 9
outcome: "By the end you can explain LCP, INP and CLS, name the usual AEM causes of a bad score for each, and choose between lab and field data."
prereq: "Dispatcher filters, caching and invalidation (lesson 23)."
terms:
  - { t: "LCP (Largest Contentful Paint)", d: "How long until the biggest visible element, often a hero image or heading, is rendered." }
  - { t: "INP (Interaction to Next Paint)", d: "How quickly the page visibly responds after clicks, taps and key presses, across the visit." }
  - { t: "CLS (Cumulative Layout Shift)", d: "How much visible content jumps around unexpectedly while the page loads." }
  - { t: "Field data", d: "Measurements from real visitors on real devices, for example from the Chrome UX Report." }
  - { t: "Lab data", d: "A single controlled test run, for example by Lighthouse, useful for debugging but not a measure of real users." }
mistake: "Optimising for a perfect Lighthouse score on your laptop and ignoring field data. Real visitors have slower devices and networks and third-party scripts, so the lab can say green while the field says red."
try_it:
  - "Run a public page of your site through PageSpeed Insights. Note whether it shows field data (a real-user section) and lab data (the Lighthouse run), and compare LCP in both."
  - "In the Lighthouse report, find the LCP element. Is it an image, and is it loaded lazily?"
  - "In the browser Network tab, sort by size. Identify the three largest requests and decide which are images, fonts or scripts."
  - "Look at the page source for `<script>` tags in the head without `async` or `defer`. List them."
  - "Write down one change per vital that you would try first, and how you would know it worked."
quiz:
  - q: "A page jumps down when a late-loading banner appears, and the visitor clicks the wrong link. Which vital captures that?"
    options:
      - "LCP, because the banner arrives late"
      - "INP, because the click was missed"
      - "CLS, because content moved without warning"
      - "TTFB, because the server was slow to respond"
    answer: 2
    why: "CLS measures unexpected movement of visible content. LCP is about when the main content appears and INP about how fast the page responds to input; a banner pushing content down is a layout shift."
  - q: "Lighthouse on your machine scores 98, yet Search Console shows poor LCP for real visitors. What is the best explanation?"
    options:
      - "Lighthouse is wrong and should be ignored"
      - "Field data is always lower than lab data by design"
      - "The CDN is serving different pages to Google"
      - "Real devices, networks and third-party scripts differ from your controlled lab run"
    answer: 3
    why: "Lab data is one controlled run, while field data aggregates real visits. Both are useful. The lab helps you find causes, and the field tells you what users actually experience."
  - q: "Your LCP element is a large hero image. Which change is MOST likely to improve LCP?"
    options:
      - "Lazy-load the hero image so it loads later"
      - "Serve it at the right size and in a modern format, and do not delay its loading"
      - "Move all page JavaScript to the bottom of the footer"
      - "Add more web fonts so the page looks finished sooner"
    answer: 1
    why: "The LCP image should load early and be sized sensibly. Lazy-loading it delays the very element being measured. Moving scripts may help in other ways, and extra fonts usually add work."
  - q: "Which is NOT a typical reason an AEM page has a slow LCP or INP?"
    options:
      - "Large blocking JavaScript and CSS in the head"
      - "Unoptimised images with no responsive sizes"
      - "Heavy third-party tags loaded up front"
      - "Dispatcher serving the page from its cache"
    answer: 3
    why: "A cache hit is what makes a page fast. The others are real causes: blocking resources, oversized images and early third-party scripts all push LCP or INP in the wrong direction."
go_deeper:
  - { title: "Edge Delivery Services performance: keep Lighthouse 100", url: "/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/", why: "lab versus field, the loading model and per-block budgets" }
  - { title: "Dispatcher on AEM as a Cloud Service: caching rules, invalidation and the mistakes that cost you", url: "/blog/2026/11/dispatcher-on-aem-as-a-cloud-service-caching-and-invalidation/", why: "caching is the biggest single lever" }
  - { title: "Image optimiser", url: "/tools/image-optimiser/", why: "try resizing and compressing an image before upload" }
  - { title: "Web page comparison", url: "/tools/web-page-comparison/", why: "compare two pages side by side" }
---
## A slow page is three different problems

"The site is slow" hides three separate complaints. Visitors wait for the main content. They click and nothing happens. Or they start reading and the text jumps. Google's Core Web Vitals give each a name and a measurable number, and they are worth learning because they match what people actually feel.

## The three vitals in plain words

- **LCP, Largest Contentful Paint:** how long until the biggest thing in view, usually a hero image or main heading, is drawn. It answers "when did the page look loaded?"
- **INP, Interaction to Next Paint:** how fast the page visibly reacts when someone clicks, taps or types, taking the worst moments across the visit. It answers "does it feel responsive?"
- **CLS, Cumulative Layout Shift:** how much visible content moves unexpectedly. It answers "does it stay put while I read?"

You do not need to memorise thresholds. Learn the idea, and use the current "good" ranges shown in the tool you measure with.

## What usually moves each one on AEM

| Vital | Typical causes on AEM | Typical fixes |
|---|---|---|
| **LCP** | Oversized hero image, image loaded late or lazily, slow response, blocking CSS and JS | Right-sized responsive images in a modern format, load the LCP image early, cache HTML and assets well |
| **INP** | Heavy JavaScript on the main thread, long event handlers, third-party tags | Ship less script, split it, defer non-essential tags |
| **CLS** | Images and embeds without dimensions, late banners and consent bars, web fonts swapping | Reserve space with width and height, load fonts sensibly, avoid inserting content above what is visible |

Three AEM-specific levers recur. **Image delivery:** the DAM can generate renditions, and components can serve responsive sizes, but only if authors and developers use them. **Clientlib loading:** a large combined clientlib in the head blocks rendering, so load only what the page needs and defer the rest. **Caching:** a page answered from the CDN or Dispatcher skips rendering work entirely, so the previous lessons are performance lessons too.

Third parties deserve a special mention. Tag managers, chat widgets and personalisation scripts are the most common reason a fast build turns slow after launch, because they are added by people outside the development team.

## Lab versus field

There are two kinds of measurement and you need both.

**Lab data** is a controlled test, such as Lighthouse in your browser or PageSpeed Insights' lab section. It is repeatable and shows you the cause, with a list of what was slow. It is one device on one network.

**Field data** comes from real visitors, for example the **Chrome UX Report** (CrUX), which is what PageSpeed Insights shows in its real-user section and what feeds search. It tells you the truth about your audience but not the reason. For continuous tracking, **real user monitoring (RUM)** collects the same vitals from your own pages.

A good routine: watch the field data to know whether there is a problem, then use the lab to find and fix the cause, then wait for the field to confirm.

```html
<!-- Reserve space and prioritise the main image -->
<img src="/content/dam/mysite/hero.webp" width="1200" height="600"
     alt="Customers using the new app" fetchpriority="high">
```

The attributes `width`, `height` and `fetchpriority` are standard HTML. Together they prevent layout shift and ask the browser to treat the image as important, which helps LCP and CLS at once.

<details markdown="1">
<summary>Stretch question: why can a page have a perfect lab score and still fail INP in the field?</summary>

INP is measured across a whole visit, including clicks that happen after load, on slower phones and while third-party scripts compete for the main thread. A lab run that only loads the page never presses anything. That is why interaction responsiveness needs field data or a scripted interaction test.

</details>

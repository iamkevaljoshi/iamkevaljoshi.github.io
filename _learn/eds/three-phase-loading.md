---
title: "The three-phase loading model"
description: "How an Edge Delivery Services page loads in three phases, eager, lazy and delayed, and how to decide which phase each piece of your page belongs to."
track: eds
level: 3
order: 15
minutes: 9
outcome: "By the end you can place any script, style, image or block into the eager, lazy or delayed phase, and point to the function in scripts.js that handles it."
prereq: "Lessons 7 and 8 on blocks and decoration, and a rough idea of what the browser does when it opens a page."
terms:
  - { t: "Eager phase", d: "Everything needed to paint the largest visible content, loaded first and kept as small as possible." }
  - { t: "Lazy phase", d: "The rest of the page (header, footer, other sections, fonts) loaded after the first paint." }
  - { t: "Delayed phase", d: "Third-party and non-essential code, loaded well after the page is usable." }
  - { t: "LCP (Largest Contentful Paint)", d: "The time at which the largest piece of visible content, often the hero image, finishes rendering." }
  - { t: "`decorateMain`", d: "The function in `scripts.js` that turns the authored document structure into sections and blocks." }
mistake: "Putting something in the eager path because it feels important to the business, such as a tag manager or a chat widget. Every byte before LCP delays the first thing the visitor sees."
try_it:
  - "Open `scripts/scripts.js` in your boilerplate project and find `loadEager`, `loadLazy` and `loadDelayed`."
  - "Write one line next to each function: what does it load?"
  - "Open a page, then open DevTools, Network tab, and reload with throttling on Fast 4G."
  - "Find the first image request and the first request for `fonts.css`. Which came first?"
  - "Find where `loadFonts` is called and note the two places it appears."
  - "Pick one thing you might add to a page (a cookie banner, a hero video, an analytics tag) and decide its phase."
quiz:
  - q: "Which phase is meant to contain only what is needed to reach LCP?"
    options:
      - "Lazy, because it loads the remaining content"
      - "Eager, because it covers the first section and its priority image"
      - "Delayed, because it runs after the page is interactive"
      - "All three, because LCP depends on the whole page"
    answer: 1
    why: "Eager is the budget for the first paint. Lazy and delayed run after it. The tempting answer, all three, is wrong because the model exists to keep LCP independent of the rest of the page."
  - q: "A marketing team asks for an analytics tag to be added to head.html so it 'loads first and misses nothing'. What happens to performance?"
    options:
      - "Nothing, because analytics scripts are tiny and cached"
      - "Only the Lighthouse lab score changes, not real users"
      - "The tag competes with the LCP content, so LCP and blocking time usually get worse"
      - "The delayed phase picks the tag up automatically"
    answer: 2
    why: "Anything in the head sits in the critical path. The delayed phase only holds what you deliberately put there; it does not rescue scripts loaded elsewhere."
  - q: "In the boilerplate, why are fonts loaded early only on screens 900px wide or more, or when a session flag is set?"
    options:
      - "Wide screens cannot render fallback fonts"
      - "Fonts are always blocked on mobile devices"
      - "Wide screens usually mean faster connections, so fonts cost less"
      - "Narrow screens use different font files"
    answer: 2
    why: "Fonts are heavy and compete with LCP, so the boilerplate only brings them forward when the visitor probably has bandwidth or has already cached them. Everyone else gets them in the lazy phase."
  - q: "Which statement about the phases is NOT true?"
    options:
      - "Below-the-fold images should be lazy loaded"
      - "The header and footer load in the lazy phase"
      - "Delayed content should start well after LCP"
      - "The LCP image should be lazy loaded to save bandwidth"
    answer: 3
    why: "Lazy loading the LCP image tells the browser to wait before fetching the very thing the visitor is waiting for. Lazy loading is for images the visitor cannot see yet."
go_deeper:
  - { title: "Edge Delivery Services performance: how to keep a 100 Lighthouse score after go-live", url: "/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/", why: "the full E-L-D model and what erodes it" }
  - { title: "Next lesson: Why a 100 Lighthouse score is achievable", url: "/learn/eds/why-100-lighthouse/" }
  - { title: "Fonts, icons and images", url: "/learn/eds/fonts-icons-images/", why: "the asset side of the same story" }
---
## The problem: everything wants to load first

Picture a restaurant opening at noon. The doors open, guests sit, and the first thing they want is a menu and a glass of water. The staff could also be polishing cutlery, printing receipts and training the new waiter, but if they all do that before the guests get water, the restaurant feels slow even though everything is "ready" on time.

A web page is the same. The visitor wants the main content now. Everything else can wait, but only if you decide what "else" means. Edge Delivery Services (EDS) gives you a loading model that makes that decision explicit: **eager, lazy, delayed**.

## The three phases

| Phase | Job | Typical content |
|---|---|---|
| **Eager** | Reach LCP | First section, its blocks, the LCP image, early styles |
| **Lazy** | Finish the page | Header, footer, other sections and blocks, `lazy-styles.css`, fonts |
| **Delayed** | Everything non-essential | Analytics, consent, tag managers, chat |

Adobe's guidance ("Keeping it 100") suggests keeping the total payload before LCP around 100 KB, and avoiding a second origin before LCP. Treat these as targets that tell you when you are drifting, not as a law.

## Where it lives in code

Open `scripts/scripts.js` in the boilerplate. The structure is deliberately small:

```js
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }
  // fonts.css early only on wide screens or when a session flag is set
}

async function loadLazy(doc) {
  loadHeader(doc.querySelector('body > header'));
  await loadSections(doc.querySelector('main'));
  loadFooter(doc.querySelector('body > footer'));
  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}
```

Read that slowly. `decorateMain` turns the document structure into sections and blocks. The body starts hidden and gets the `appear` class once the first section is ready, so visitors never see half-built content. `loadSection` is given `waitForFirstImage`, so the first section waits for its first image, which the boilerplate marks as eager rather than lazy. Everything else, including the header, footer and the remaining sections, waits for `loadLazy`.

The third function, `loadDelayed`, is where non-essential code belongs. In older projects it imported `delayed.js` after a hard-coded timer of about three seconds. In the current boilerplate it imports `consent-check.js`, which declines consent by default and only loads `consented.js` when consent is granted. The current version does not enforce the three-second wait, so if you want a minimum delay you add it yourself. Check which version your own project forked from before relying on either behaviour.

## How to decide a phase

Ask three questions in order:

1. **Does the visitor need it to see the main content?** Eager. Be strict: usually that is one section and one image.
2. **Does the visitor need it to use the page?** Lazy. Navigation, the rest of the content, fonts.
3. **Does the visitor never notice if it arrives late?** Delayed. Analytics, marketing, chat.

Most performance problems are items stuck in the wrong answer, and the cost is almost always paid in eager.

<details markdown="1">
<summary>Predict first, then reveal: where does a cookie banner go?</summary>

Legally it must appear before tracking runs, so it feels like it belongs early. But it is not needed for the content, so it belongs in the delayed path, behind your consent check, and it should be a fixed overlay so it never pushes content down. Being important to the business is not the same as being needed for LCP.

</details>

## Why this beats clever tricks

Other platforms use preloading, early hints and priority hints to win speed back. EDS takes the opposite view: send less before LCP, and those tricks become unnecessary. Adobe's guidance specifically discourages them in the eager phase because they compete for the same bandwidth. The next lesson shows why this makes a 100 realistic, and the one after covers the third parties that most often break it. You can see the model working on your own pages with the [SEO audit tool](/tools/seo-audit/).

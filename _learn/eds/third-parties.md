---
title: "Third-party scripts without breaking performance"
description: "Why analytics, consent, chat and tag managers hurt Edge Delivery Services pages, and how delayed loading, consent gating and facades keep them off the critical path."
track: eds
level: 3
order: 17
minutes: 9
outcome: "By the end you can move a third-party script out of head.html and load it after consent in the delayed phase, or behind a click, without hurting LCP."
prereq: "Lessons 15 and 16."
terms:
  - { t: "Third-party script", d: "Code served from another company's domain, such as analytics, chat, ads or a tag manager." }
  - { t: "Tag manager", d: "A tool that loads and controls many marketing and analytics tags from one container script." }
  - { t: "Consent management platform (CMP)", d: "The system that records whether a visitor accepts tracking and tells your scripts what they may do." }
  - { t: "Facade", d: "A lightweight stand-in, such as a button or poster image, that loads the heavy real widget only when the visitor interacts." }
  - { t: "`consented.js`", d: "The boilerplate file where scripts that need consent are loaded, after `consent-check.js` reports consent." }
mistake: "Pasting the vendor snippet into head.html because the vendor says it must go there. It puts someone else's code, on someone else's server, ahead of your own content."
try_it:
  - "Open your site in DevTools, Network tab, and filter by a domain other than your own."
  - "List every third-party request you see and when it started relative to the first image."
  - "Open `head.html` and check whether any vendor script is present. If so, note which."
  - "Open `scripts/consented.js` and add a single analytics `loadScript` call behind your consent check, following the example below."
  - "Reload with `?consent=accept` and confirm the script loads. Reload without it and confirm it does not."
  - "Re-run PageSpeed Insights and compare the score and TBT with before."
quiz:
  - q: "Where should a tag manager be loaded on an EDS site?"
    options:
      - "In head.html, so it is first to run"
      - "In the first section's block, next to the hero"
      - "In the delayed phase, after consent, for example from consented.js"
      - "In a lazy-styles.css import"
    answer: 2
    why: "Tag managers are third-party and non-essential for first paint. The delayed phase, behind consent, keeps them off the critical path. Head.html is exactly the place that delays LCP."
  - q: "A vendor insists their chat widget must load on every page load to work. What is the best response?"
    options:
      - "Agree, since vendors know their products"
      - "Load it on a chat button click via a facade, and test nothing breaks"
      - "Load it twice, once eagerly and once delayed"
      - "Remove the widget and stop supporting chat"
    answer: 1
    why: "Most widgets work fine when loaded on demand, and a facade gives the same visible result with no cost until needed. The vendor's instruction describes their default, not a technical requirement."
  - q: "Why is a cookie banner often a layout-shift problem?"
    options:
      - "It loads fonts from another origin"
      - "It always blocks the main thread"
      - "It is rendered in the lazy phase"
      - "It pushes content down when it appears, so the page moves"
    answer: 3
    why: "A banner inserted into the flow shifts everything below it. A fixed overlay sits on top without moving content."
  - q: "Which approach does NOT help keep third parties from hurting performance?"
    options:
      - "Declining consent by default so tracking scripts load only when allowed"
      - "Giving each tag an owner and a reason, and reviewing them regularly"
      - "Adding `preload` hints for every vendor script so they arrive sooner"
      - "Letting one tag manager own other tags, fed from a data layer"
    answer: 2
    why: "Preloading vendor scripts makes them compete with LCP content for bandwidth. It does the opposite of what you want for non-essential code."
go_deeper:
  - { title: "Edge Delivery Services performance: how to keep a 100 Lighthouse score after go-live", url: "/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/", why: "the martech and consent patterns in more depth" }
  - { title: "Adobe Target vs Edge Delivery Services experimentation", url: "/blog/2026/11/adobe-target-vs-edge-delivery-services-experimentation/", why: "when you think you need a client-side testing script" }
  - { title: "Next lesson: Measuring real users with RUM", url: "/learn/eds/rum-measuring/" }
---
## The problem: a page you do not fully control

You wrote a clean, fast page. Then marketing adds a tag manager. Legal adds a consent banner. Support adds chat. None of that code is yours, none of it is small, and all of it is served from servers you cannot tune. A year later the same page scores 70 and nobody can say which request did it.

The most common cause of lost performance on EDS sites is not your blocks. It is third parties arriving through the front door.

## Why they hurt

A third-party script costs you in three ways:

- **A new connection.** Another domain means DNS, TCP and TLS before a single byte, which is why a second origin before LCP is discouraged.
- **Main-thread time.** Parsing and running JavaScript blocks the page from reacting. This hurts total blocking time in the lab and INP in the field.
- **Surprises.** Tags load other tags, banners push content, pre-hiding snippets blank the page until a decision arrives.

The fix is a rule, not a technique: **nothing third-party before LCP.** Everything goes in the delayed phase, or behind an interaction.

## The pattern: consent, then delayed

The current boilerplate already has the shape. `loadDelayed()` imports `consent-check.js`. That file stands in for a real consent platform: it declines by default, and imports `consented.js` only when consent is granted (it accepts `?consent=accept` as a test switch). You replace the placeholder with your own CMP and put the tags in `consented.js`.

```js
// scripts/consented.js
import { loadScript } from './aem.js';

// One tag manager, loaded once, after consent.
await loadScript('https://www.googletagmanager.com/gtm.js?id=GTM-XXXXXXX', { async: '' });
```

If you want a minimum wait after LCP, which Adobe's guidance recommends, add it explicitly, because the current boilerplate does not enforce it:

```js
function loadDelayed() {
  window.setTimeout(() => import('./consent-check.js'), 3000);
}
```

Older projects used `delayed.js` with a hard-coded delay of about three seconds. Same idea, different file. Check which your project has.

## The pattern: facades for heavy widgets

A chat widget does not need to exist until someone wants to chat. Show a plain button, and load the real widget on the first click.

```js
document.querySelectorAll('a[href="#chat"]').forEach((link) => {
  link.addEventListener('click', async (e) => {
    e.preventDefault();
    await import('./chat-loader.js');
  }, { once: true });
});
```

The same idea works for videos (a poster image and a play button) and maps (a static image or a "Show map" button). Give the facade a fixed aspect ratio so swapping it for the real thing does not shift the page.

## Rules that keep it fixed

- **Nothing third-party in `head.html`.** If a vendor says it must be there, ask what breaks if it is not. Usually nothing.
- **One tag manager owns the other tags.** Pixels pasted into blocks multiply.
- **Every tag has an owner and a reason.** Review them regularly and remove the ones nobody can justify.
- **Banners are overlays.** A cookie notice should never move content.
- **No pre-hiding snippets.** Client-side A/B tools that hide the body until a decision arrives put a delay on the whole page. EDS has its own experimentation framework for most cases.

<details markdown="1">
<summary>Stretch question: what if personalisation really must happen above the fold?</summary>

Then it is a deliberate exception, not a default. Scope it to one block with a short timeout, and measure the cost on real users. Adobe publishes a martech plugin that splits work across eager, lazy and delayed hooks for this case, and the cost is not zero, so treat it as a trade you chose, not a free feature.

</details>

## Seeing the damage

Use the [SEO audit tool](/tools/seo-audit/) or PageSpeed Insights before and after you move a tag. The difference in blocking time is usually the clearest evidence you can show a stakeholder.

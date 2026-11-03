---
layout: post
title: "Edge Delivery Services performance: how to keep a 100 Lighthouse score after go-live"
seo_title: "Edge Delivery Services Performance: Keep Lighthouse 100"
description: "Why AEM Edge Delivery Services sites lose their Lighthouse 100 after launch, and the loading rules, budgets, PR gates and RUM checks that keep them fast."
date: 2026-11-03 17:20:00 +0530
category: edge-delivery-services
tags: [AEM, Edge Delivery Services, Performance, Core Web Vitals]
---

Almost every Edge Delivery Services (EDS) site I've worked on went live with a green 100 in PageSpeed Insights. The boilerplate starts there, the AEM GitHub bot holds every pull request to it, and the launch screenshot goes into the steering committee deck.

Then real life arrives. Marketing needs the tag manager. Legal needs the consent banner. The service team wants a chat widget. A campaign brings a hero video, a regional team adds a carousel, the DAM migration brings images without dimensions, and someone builds a "smart" block that fetches product data before it renders. Six months later the mobile score is in the 70s, the field data in Search Console has turned amber, and nobody can say which change did it.

None of this is a platform problem. EDS gives you a loading model that makes 100 easy to reach. It doesn't stop you from breaking that model one reasonable request at a time. This post is how I keep sites fast after go-live: what breaks them, where martech belongs, which budgets to set, and how to govern it so the score doesn't erode while you're not looking.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **Lab 100 is the entry ticket, not the goal.** Lighthouse runs one simulated load. Google ranks on field data: LCP ≤ 2.5 s, INP ≤ 200 ms and CLS ≤ 0.1 at the 75th percentile of real visits. INP isn't measured in a Lighthouse page load at all.
- **The E-L-D contract is the whole game.** Eager covers only what's needed for LCP (about 100 KB, one origin). Lazy covers the rest of the page. Delayed holds third-party and martech, at least three seconds after LCP and only after consent.
- **What breaks it is predictable:** tag managers loaded early, Target-style flicker handling, chat widgets, hero carousels and video, external images without width and height, extra font files, heavy block JS, client-side data fetches that gate content, and slow event handlers.
- **Martech goes in the delayed phase, behind consent.** The current boilerplate already ships a `consent-check.js` and `consented.js` pair for this. Personalisation that must be above the fold needs a deliberate exception, not a default.
- **Budgets need owners.** Set a per-block JS/CSS budget, keep the pre-LCP budget at about 100 KB, and treat the PageSpeed check on pull requests as a gate, not a suggestion.
- **Monitor the field, not just the lab.** Operational Telemetry (formerly RUM) is collected by default. Look at it every week, by template and device, and alert on regressions.

## Lab 100 is not the same as good Core Web Vitals

The 100 everyone celebrates is a Lighthouse score: one simulated page load in a lab. It's a useful, repeatable signal, but it isn't what Google uses for ranking. Core Web Vitals are measured from real Chrome users via the Chrome UX Report (CrUX), and a page passes when the 75th percentile of visits meets all three thresholds:

| Metric | What it measures | Good | Needs improvement | Poor |
|---|---|---|---|---|
| **LCP** (Largest Contentful Paint) | Loading: when the main content appears | ≤ 2.5 s | 2.5–4.0 s | > 4.0 s |
| **INP** (Interaction to Next Paint) | Responsiveness to clicks, taps and keys across the whole visit | ≤ 200 ms | 200–500 ms | > 500 ms |
| **CLS** (Cumulative Layout Shift) | Visual stability | ≤ 0.1 | 0.1–0.25 | > 0.25 |

Three gaps catch teams out:

1. **INP has no lab equivalent in a page load.** Lighthouse reports Total Blocking Time as a proxy. A chat widget loaded late doesn't hurt the score, but if it hogs the main thread when someone taps the menu, it hurts INP.
2. **Late layout shifts still count.** A consent banner that pushes content down, or a promo bar injected by a tag, shows up in field CLS.
3. **Real traffic isn't your test URL.** Field data covers every template, every campaign page with a 4 MB hero, and every visitor on a slow phone.

So the target is both: keep the lab score at 100 to protect the loading model, and keep the field metrics green to protect users and rankings. If you want the wider SEO view of where Core Web Vitals sit among ranking factors, I cover that in [what actually matters in SEO](/blog/2026/11/what-actually-matters-in-seo/).

## The E-L-D loading model, and why it erodes

Adobe's ["Keeping it 100" guide](https://www.aem.live/developer/keeping-it-100) splits everything on a page into three phases. Every performance decision on an EDS project comes back to which phase something belongs in.

![The three loading phases of an Edge Delivery Services page: eager until LCP, lazy after LCP, delayed at least three seconds after LCP and behind consent, with what belongs in each]({{ '/assets/img/blog/eds-performance/01-eld-timeline.svg' | relative_url }}){: width="1200" height="640" loading="lazy" decoding="async"}

### Phase E: Eager

Everything needed to reach LCP, and nothing else. The body starts hidden so images don't download before decoration. `loadEager()` decorates the DOM, then loads the first section with priority on the LCP candidate, typically the hero image.

The guidance is specific: keep the aggregate payload before LCP **below 100 KB**, which Adobe says usually gives an LCP under 1,560 ms and a 100 in PSI. It strongly discourages a second origin before LCP, and also the tricks people bring from other platforms: `preload`, `preconnect`, `fetchpriority="high"` and early hints all compete for the bandwidth the LCP needs.

### Phase L: Lazy

`loadLazy()` loads the header and footer, the remaining sections and their blocks, `lazy-styles.css` and the web fonts. Images below the fold get `loading="lazy"`. The guide asks that most of this payload comes from the same origin. Lazy content shouldn't create long tasks or layout shifts, because the user is already looking at the page.

### Phase D: Delayed

Third-party and "non-material" assets: analytics, marketing tags, consent, chat. Adobe's rule is that this phase should start **at least three seconds after LCP**.

There's a detail here worth knowing if you maintain older projects. The boilerplate used to enforce the delay with a hard-coded timer that imported `delayed.js` after 3,000 ms. The current boilerplate's `loadDelayed()` instead imports `consent-check.js`, which declines consent by default and only imports `consented.js` when consent is granted. The guide notes that `loadDelayed()` no longer enforces the three-second minimum, so if you need it, you add it explicitly. Check which version your project forked from.

Erosion almost never comes from one big decision. It comes from twenty small ones, each made by someone who wasn't in the room when the loading model was explained.

## What typically breaks the score

These are the regressions I see most often on live EDS sites, roughly in order of how much damage they do.

| Culprit | What it hurts | Typical cause | Fix |
|---|---|---|---|
| **Tag manager in `head.html`** | LCP, TBT, INP | Copy-paste of the vendor snippet "because that's where it goes" | Load from `consented.js` in the delayed phase |
| **Consent manager loaded eagerly** | LCP, CLS | CMP script in the head, banner pushing content | Load in delayed; overlay banner, don't push layout |
| **Adobe Launch / Web SDK with everything in it** | TBT, INP | Launch container with dozens of rules and extensions | Delayed phase; prune rules; or the AEM martech plugin |
| **Target-style flicker handling** | LCP | Pre-hiding snippet that hides the body until a decision arrives | Avoid, or scope personalisation to blocks with a short timeout |
| **Third-party chat** | INP, TBT | Widget loads on page load, attaches global listeners | Delayed, or load on first click of a chat button |
| **Client-side A/B tools** | LCP, CLS | Body hidden while variants are applied | Use EDS experimentation, or server-side decisions |
| **Hero carousel or autoplay video** | LCP | Several large slides, video from another origin | Single static hero image; video lazy with a poster |
| **External DAM images without dimensions** | LCP, CLS | Images from another host, no width/height | Same-origin optimised images, or width and height on `<img>` |
| **Extra web font weights** | CLS, LCP | Brand kit loads eight faces | Two or three faces, fallback fonts with `size-adjust` |
| **Heavy block JS and CSS** | TBT, LCP | Framework or library imported in a block | Per-block budget, dynamic import on interaction |
| **Client-side data fetches** | LCP, CLS | Block fetches JSON before rendering the hero | Pre-render content, or reserve space and fetch lazily |
| **Heavy event handlers** | INP | Menu, filters or search do all their work synchronously | Yield to the main thread, defer non-visual work |

Two deserve more detail.

**External images.** The boilerplate's `createOptimizedPicture()` builds a `<picture>` with WebP and fallback sources from same-origin media, with default breakpoints of 2,000 px at `(min-width: 600px)` and 750 px otherwise. Images from an external DAM bypass that. Adobe's Dynamic Media guidance for EDS states the trade-off: EDS already optimises size, quality and format, and a separate Dynamic Media domain adds a TLS handshake that can hurt LCP. Smart crops are the main reason to use Dynamic Media. If you use Dynamic Media with OpenAPI, deliver through your CDN domain where you can, always set `width` and `height`, and keep the hero on the same origin. Dynamic Media with OpenAPI is also enabled per environment, so production may need its own enablement even when dev works.

**Client-side data fetches.** Below the fold, fine. In the first section, a block that calls an API before rendering puts a round trip, often to another origin, in front of LCP. If the content is known at publish time, put it in the document or a spreadsheet. If not, reserve the space so nothing shifts.

## Integrating martech in the delayed phase

This is where most of the erosion happens, so it's worth getting the pattern right on day one.

### The default: consent first, then delayed

The current boilerplate already has the right shape. `loadDelayed()` imports `consent-check.js`. That file is a placeholder: it declines consent by default, dispatches a `consent.update` event, and imports `consented.js` only when consent is granted. You replace the placeholder with your consent management platform (CMP) and put martech in `consented.js`.

Here's how I wire it, including the three-second minimum the guide recommends:

```javascript
// scripts/scripts.js (excerpt)
function loadDelayed() {
  // Delayed phase: start well after LCP. The current boilerplate
  // no longer enforces this, so add the minimum delay yourself.
  window.setTimeout(() => import('./consent-check.js'), 3000);
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
```

```javascript
// scripts/consented.js
// Only imported after the CMP reports consent.
import { loadScript } from './aem.js';

// One tag manager, loaded once, after consent.
await loadScript('https://www.googletagmanager.com/gtm.js?id=GTM-XXXXXXX', { async: '' });
// or Adobe Experience Platform Tags (Launch):
// await loadScript('https://assets.adobedtm.com/<company>/<property>/launch-<env>.min.js', { async: '' });

// Only load the chat widget when someone asks for it.
document.querySelectorAll('a[href="#chat"]').forEach((link) => {
  link.addEventListener('click', async (e) => {
    e.preventDefault();
    await import('./chat-loader.js');
  }, { once: true });
});
```

Two rules I enforce in code review: **nothing third-party in `head.html`** (if a vendor says their script "must be in the head", ask what breaks if it isn't; usually nothing), and **one tag manager owns all other tags**, fed by a data layer rather than pixels inside blocks.

### When something genuinely can't wait

Some requirements are legitimately above the fold: a personalised hero, or an experiment on the primary call to action. For those, don't fall back to a page-wide pre-hiding snippet.

- **EDS experimentation** runs A/B tests and audience targeting without cookies and without a performance hit, because variants are just alternative documents. For most content experiments it's my default. I compare it with Target in [Adobe Target vs Edge Delivery Services experimentation](/blog/2026/11/adobe-target-vs-edge-delivery-services-experimentation/).
- **The AEM martech plugin** (`adobe-rnd/aem-martech`) integrates Web SDK, Target or Journey Optimizer, Analytics and the Adobe Client Data Layer, split into `martechEager`, `martechLazy` and `martechDelayed`. Decisions are applied as each block renders, while Launch rules load late. Adobe's test figures show a small cost for pages without modifications but about +1.2 s of mobile LCP with them. Caveats: its README says it's available through co-innovation projects with AEM Engineering, and you must not also add the Web SDK, Analytics or Target extensions in Launch.

If personalisation is a bigger part of your roadmap, my [personalisation post](/blog/2026/11/personalisation-why-it-matters-and-how-to-do-it-well/) covers when it's worth that cost.

### Consent without layout shift

In my experience the consent banner is often the biggest field CLS contributor on otherwise clean sites. Render it as a fixed overlay so it never pushes content, and keep the default "declined" until the user chooses: usually the legally safer default, and always the faster one.

## Images, fonts and the LCP block

### The LCP block

Most EDS LCPs are the hero image in the first section. Protect it:

- **One image, same origin, optimised.** Let `createOptimizedPicture()` produce the `<picture>`; the boilerplate's `waitForFirstImage()` sets the first image in the first section to `loading="eager"`.
- **Separate mobile and desktop heroes:** remove the unused one from the DOM, or the browser may fetch the wrong LCP candidate.
- **Hero from a fragment or lookup:** loading must wait until the first block has updated the DOM, so keep that block small and free of network calls.
- **Carousels:** I push back every time. If the business insists, render the first slide as a normal eager image and load the rest after LCP.

### Fonts

The guide says it's largely impossible to load fonts before LCP, and preloading them is explicitly discouraged. The boilerplate's `loadEager()` only loads `fonts.css` early on screens ≥ 900 px wide (a proxy for a fast connection) or when a session flag says fonts are cached; everyone else gets them in `loadLazy()`. To avoid a shift when the web font swaps in, define a local fallback face with `size-adjust`:

```css
/* styles/styles.css */
@font-face {
  font-family: brand-sans-fallback;
  size-adjust: 99.5%; /* compute this for your font, don't copy it */
  src: local('Arial');
}

:root {
  --body-font-family: brand-sans, brand-sans-fallback, sans-serif;
}
```

Adobe's Helix Font Fallback Chrome extension calculates the value per face; run it on several pages and average. And tell the brand team that two or three faces is plenty.

## Blocks: a lazy pattern and a per-block budget

Blocks are where developer habits from other stacks creep in. A block's JS and CSS load when its section loads. If the block is in the first section, its cost is in the eager budget.

### Load heavy dependencies only when needed

For anything that needs a third-party library (maps, video players, 3D viewers, charts), render a lightweight placeholder and load the dependency only when the block approaches the viewport or the user interacts:

```javascript
// blocks/map/map.js
function loadWhenNear(block, callback) {
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      observer.disconnect();
      callback();
    }
  }, { rootMargin: '200px' });
  observer.observe(block);
}

export default function decorate(block) {
  const link = block.querySelector('a');
  const placeholder = document.createElement('button');
  placeholder.className = 'map-placeholder';
  placeholder.textContent = 'Show map';
  block.replaceChildren(placeholder);

  const load = async () => {
    const { renderMap } = await import('./map-renderer.js'); // heavy code split out
    await renderMap(block, link?.href);
  };

  placeholder.addEventListener('click', load, { once: true });
  loadWhenNear(block, load);
}
```

Give the block a fixed `aspect-ratio` in its CSS so the swap from placeholder to map doesn't shift anything.

### Keep event handlers short for INP

INP problems on EDS sites usually come from a few handlers that do everything at once: rebuilding a product grid on a filter click, or running analytics calls synchronously inside the click. Do the visual update first, then yield:

```javascript
// Yield to the main thread so the browser can paint between steps.
const yieldToMain = () => (globalThis.scheduler?.yield
  ? globalThis.scheduler.yield()
  : new Promise((resolve) => { setTimeout(resolve, 0); }));

filterButton.addEventListener('click', async () => {
  filterButton.setAttribute('aria-pressed', 'true'); // immediate feedback
  await yieldToMain();
  renderFilteredResults(); // the expensive part
  await yieldToMain();
  window.adobeDataLayer?.push({ event: 'filter-applied' }); // non-visual work last
});
```

### Per-block budgets

I give every block a budget and record it in the block's README or the project's block catalogue:

| Block type | JS (compressed) | CSS (compressed) | Allowed in first section? | Third-party allowed? |
|---|---|---|---|---|
| Hero, banner, text, columns | ≤ 5 KB | ≤ 3 KB | Yes | No |
| Cards, tabs, accordion | ≤ 8 KB | ≤ 4 KB | Only if no fetch | No |
| Forms, search, filters | ≤ 15 KB | ≤ 5 KB | Avoid | No |
| Maps, video, embeds | Placeholder ≤ 3 KB | ≤ 3 KB | No | Yes, on interaction or intersection |

These are my working defaults, not an Adobe standard. What matters is that a number exists; a block that needs more makes its case in the pull request.

## Governance: making 100 everyone's job

Technical patterns don't survive without process. These are the controls I put in place before go-live.

### The pull request gate

The AEM GitHub bot runs PageSpeed Insights against the test URLs listed in the pull request description and fails the check if the mobile score is below 100, with a small buffer for volatility. Three habits make this gate useful:

- **Make the check required** in branch protection. A failing PSI check shouldn't be mergeable "because it's flaky".
- **Test the right URLs.** Every PR should include the pages that use the changed block, plus the heaviest template. A PR that only tests the home page tells you very little.
- **Never fix a failing check by changing the test URL.** I've seen that more than once.

### Ownership and change control

- **Name a performance owner,** usually the lead front-end developer, who approves anything touching `head.html`, `scripts.js`, `consented.js` or the eager path.
- **Route tag requests through a ticket** with purpose, consent category, size and an expiry date. Tags without an owner go at the quarterly review.

### Field monitoring and alerting

EDS collects Operational Telemetry (OpTel, the successor to RUM) by default. Adobe's documentation says it samples one in a hundred page views, uses no cookies or client-side identifiers, doesn't fingerprint visitors, and records Core Web Vitals (LCP, INP and CLS) plus TTFB. The [Operational Telemetry Explorer](https://www.aem.live/tools/oversight/explorer.html) shows them over time, filterable by device type, URL and checkpoint. You need a domain key for your site. Two caveats from the docs: iOS traffic doesn't report these metrics, and narrow filters widen the margin of error.

My routine:

- **Weekly:** LCP, INP and CLS by device in the explorer. As the docs say, yellow is not an acceptable middle ground.
- **Per release:** compare the week after with the week before. Most regressions line up with a deploy or a new tag.
- **Monthly:** Search Console's Core Web Vitals report and CrUX, because that's what Google sees. CrUX uses a 28-day window, so it lags your fixes.
- **Alerting:** a scheduled CI job that runs PSI against key templates and posts to the team channel when a score drops.

For quick checks outside the pipeline, the [SEO audit tool](/tools/seo-audit/) on this site runs Core Web Vitals through PageSpeed Insights when you add a PSI key, and the [web page comparison tool](/tools/web-page-comparison/) is handy for comparing a live page with its preview or the pre-regression version.

## The month-two audit checklist

I run this about eight weeks after go-live, once the first wave of "small" additions has landed. Then I repeat it every quarter.

**Loading model**
- [ ] `head.html` contains only boilerplate scripts and styles, with no vendor snippets
- [ ] `loadDelayed()` waits at least three seconds after LCP and goes through consent
- [ ] Everything third-party is in `consented.js` (or `delayed.js` on older projects)
- [ ] No `preload`, `preconnect` or `fetchpriority` hints added "for performance"

**LCP**
- [ ] Pre-LCP payload under about 100 KB on the main templates (check the waterfall)
- [ ] The LCP image is same-origin, optimised and loaded eagerly
- [ ] No carousel, video or data fetch gates the hero
- [ ] No second origin contacted before LCP

**CLS**
- [ ] Every image has width and height, including external and DAM images
- [ ] Fallback fonts with `size-adjust` defined for every web font face in use
- [ ] Consent banner is an overlay, not a layout push
- [ ] Embeds and lazy blocks reserve their space

**INP**
- [ ] Field INP green on mobile for the top templates
- [ ] Chat and similar widgets load on interaction, not on page load
- [ ] Menu, search and filter handlers yield after visual feedback
- [ ] Tag manager rules audited: unused tags removed, owners named

**Governance**
- [ ] PSI pull request check is required and test URLs cover changed blocks
- [ ] Block budgets recorded and respected
- [ ] OpTel explorer reviewed weekly; regressions tracked to a release or tag
- [ ] Search Console Core Web Vitals report has no "poor" URL groups

If you run several sites from one codebase, run the audit per site. A tag that's harmless on one brand can be the regression on another. I cover the multi-site set-up in [repoless EDS: one codebase, many sites](/blog/2026/10/aem-eds-repoless-one-codebase-many-sites/).

## FAQ

**Does a Lighthouse score of 100 mean my Core Web Vitals pass?**
No. Lighthouse is a single lab run on a simulated device. Core Web Vitals come from real Chrome users at the 75th percentile, and INP isn't measured in a Lighthouse page load at all. A site can score 100 and still fail INP or CLS in the field, usually because of scripts that run after the lab test ends.

**Where should Google Tag Manager or Adobe Launch go on an EDS site?**
In the delayed phase, after consent: in the current boilerplate that means `consented.js`, imported from `consent-check.js`. On older projects it's `delayed.js`. Never in `head.html`. If you use the AEM martech plugin, follow its eager, lazy and delayed split instead.

**Is the three-second delay still enforced by the boilerplate?**
Not any more. Adobe's guidance still says the delayed phase should start at least three seconds after LCP, but the current `loadDelayed()` no longer has a hard-coded timer. Add the delay yourself, in `loadDelayed()`, `consent-check.js` or `consented.js`.

**Can I use Dynamic Media or an external DAM for the hero image?**
You can, but it costs LCP: a second origin before LCP means another connection and TLS handshake, which Adobe's guidance discourages. Keep the hero on the same origin where possible, use EDS image optimisation, and reserve Dynamic Media for cases that genuinely need smart crops or advanced transforms. Always set width and height.

**Is Operational Telemetry GDPR-friendly?**
Adobe's documentation says it uses no cookies, local or session storage for metrics, doesn't fingerprint visitors, strips URL parameters and doesn't allow personal data. Whether you need to declare it is still a question for your privacy team.

## Closing thought

EDS makes a fast site the default, but defaults don't survive contact with a busy marketing calendar. The sites that stay at 100 aren't the ones with the cleverest code. They're the ones where the team understands the E-L-D contract, every tag has an owner and a phase, and someone looks at field data every week.

Treat performance like accessibility or security: a non-functional requirement with budgets, gates and a named owner, checked continuously rather than celebrated once at launch. If you're deciding whether EDS is the right delivery tier in the first place, start with [EDS vs traditional AEM as a Cloud Service](/blog/2026/11/aem-edge-delivery-services-vs-traditional-aemaacs/).

Has your EDS site drifted from 100, or do you want a performance governance model in place before go-live? [Get in touch](/contact/).

### References

- [Keeping it 100: Web Performance](https://www.aem.live/developer/keeping-it-100) (Adobe, aem.live)
- [AEM boilerplate: scripts.js and consent-check.js](https://github.com/adobe/aem-boilerplate/tree/main/scripts) (Adobe, GitHub)
- [Font fallback](https://www.aem.live/developer/font-fallback) (Adobe, aem.live)
- [Operational Telemetry](https://www.aem.live/docs/operational-telemetry) (Adobe, aem.live)
- [Operational Telemetry Explorer](https://www.aem.live/docs/optel-explorer) (Adobe, aem.live)
- [Martech integration](https://www.aem.live/developer/martech-integration) (Adobe, aem.live)
- [AEM martech plugin](https://github.com/adobe-rnd/aem-martech) (Adobe, GitHub)
- [Using Dynamic Media in Edge Delivery Services](https://experienceleague.adobe.com/en/docs/experience-manager-learn/sites/document-authoring/how-to/using-dynamic-media) (Experience League)
- [Imported images render as static instead of responsive assets in AEM Edge Delivery Services](https://experienceleague.adobe.com/en/docs/experience-cloud-kcs/kbarticles/ka-41503) (Adobe KB)
- [Web Vitals](https://web.dev/articles/vitals) (Google, web.dev)
- [Interaction to Next Paint (INP)](https://web.dev/articles/inp) (Google, web.dev)
- [Optimize long tasks](https://web.dev/articles/optimize-long-tasks) (Google, web.dev)
- [Chrome UX Report overview](https://developer.chrome.com/docs/crux) (Google, Chrome for Developers)

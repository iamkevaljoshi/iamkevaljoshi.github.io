---
layout: post
title: "Experimentation on AEM Edge Delivery Services: how it works, when to use it and how to measure success"
seo_title: "AEM EDS Experimentation: How It Works and How to Measure It"
description: "A practitioner's guide to A/B testing on AEM as a Cloud Service with Edge Delivery Services: how the experimentation plugin works, when to use it, its advantages, and how to measure success properly."
ai_summary: "Edge Delivery Services experimentation is an open-source plugin that reads experiment metadata from the page, assigns each visitor a variant with a weighted random draw kept in sessionStorage, swaps the variant document into the page in the eager phase, and reports to sampled, cookieless Operational Telemetry. It suits content, layout and block tests that authors own, with no extra licence and almost no performance cost. To measure success, write a hypothesis with one primary metric and guardrails, size the test before launch, check for sample ratio mismatch, read the confidence interval rather than just the winner, and send assignments to unsampled analytics for anything below very high traffic or any conversion that happens on another page."
date: 2026-11-04 10:00:00 +0530
category: edge-delivery-services
tags: [Experimentation, Edge Delivery Services, AEM as a Cloud Service, Universal Editor, Analytics]
---

Most teams I work with switch on experimentation in Edge Delivery Services (EDS) within a week of go-live. Few of them are still running good experiments three months later. The plugin is rarely the problem. It's easy to install, authors understand it in minutes, and it doesn't hurt performance. What goes wrong is everything around it: tests with no hypothesis, conversions the telemetry can't see, results read from a few dozen sampled page views, and a folder full of challenger pages nobody remembers creating.

This post covers what I wish every EDS team knew before running their first test. It explains **how experimentation works on AEM as a Cloud Service with EDS**, step by step, from metadata to telemetry beacon. It covers **when to use it** and when not to, **the advantages** that are real and the limits that aren't advertised, and the part most guides skip: **how to measure whether an experiment succeeded**.

If you're deciding between EDS experimentation and Adobe Target, read my [Target vs EDS experimentation comparison]({{ '/blog/2026/11/adobe-target-vs-edge-delivery-services-experimentation/' | relative_url }}) first. This post assumes you've chosen EDS experimentation, or at least want to understand it well.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **It's a plugin in your code, not a product.** [adobe/aem-experimentation](https://github.com/adobe/aem-experimentation) runs in the browser during the eager phase. It's driven by page, section or fragment metadata, needs no extra licence, and adds no third-party call.
- **Assignment is a weighted random draw kept in `sessionStorage`.** That makes it sticky for a browser session, not for a person. Plan your metrics around that.
- **Reporting is per page view, through sampled Operational Telemetry.** By default, one page view in 100 is sampled, and a conversion only counts if it happens on the page where the experiment fired.
- **Use it** for content, layout, block and code tests on pages with real traffic, where authors should own the work. **Don't use it** for audience-platform personalisation, very low-traffic pages, or conversions that happen several pages later, unless you also forward data to analytics.
- **Success is decided before launch:** a hypothesis, one primary metric, guardrail metrics, a minimum detectable effect, and a sample size. After launch, check for sample ratio mismatch, wait for the planned sample, then read the confidence interval.
- **On AEM as a Cloud Service with Universal Editor,** an experimentation panel creates challengers, sets the split, and activates and promotes them without editing metadata by hand. The data model underneath is the same.

## How EDS experimentation works

Most debugging conversations get shorter once people understand the mechanics, so I'll start there.

![How an EDS experiment is resolved, from the cached control page at the CDN through metadata, assignment, variant fetch and swap in the eager phase, to the Operational Telemetry beacon and the analytics event]({{ '/assets/img/blog/eds-experimentation/01-how-it-works.svg' | relative_url }}){: width="1200" height="660" loading="lazy" decoding="async"}

### 1. The control page is served from the CDN as normal

Nothing happens at the edge. Every visitor gets the same cached HTML for the control URL. This is why experimentation doesn't hurt cache hit rates or time to first byte, and why there's no personalised HTML for the CDN to vary on.

### 2. Metadata tells the plugin there's an experiment

Authors add rows such as `Experiment`, `Experiment Variants` and `Experiment Split` to the page's metadata block, or set them through Universal Editor page properties. EDS renders them as `<meta>` tags in the head. A small loader in `scripts/experiment-loader.js` checks for those tags (and for experiment keys in section metadata). **If there's no experiment, the plugin isn't even downloaded.** Pages without tests pay nothing.

The integration is short. This is the current shape from the plugin README:

```javascript
// scripts/scripts.js
import { runExperimentation, runExperimentationLazy } from './experiment-loader.js';

const experimentationConfig = {
  prodHost: 'www.example.com',
  audiences: {
    mobile: () => window.innerWidth < 600,
    desktop: () => window.innerWidth >= 600,
  },
};

async function loadEager(doc) {
  // ...
  await runExperimentation(doc, experimentationConfig); // before the first section renders
  // ...
}

async function loadLazy(doc) {
  // ...
  await runExperimentationLazy(doc, experimentationConfig); // simulation panel, preview only
}
```

Add `<link rel="modulepreload" href="/scripts/experiment-loader.js" />` to `head.html` so the loader doesn't add a waterfall step.

### 3. The visitor is assigned a variant

The plugin turns the metadata into a decision policy and evaluates it in the browser. I read the source for this post. Assignment is a weighted random draw (`Math.random()` against the allocation percentages), and the result is written to **`sessionStorage`** by default. In practice:

- **The same visitor sees the same variant for the rest of that browser session.** Reloads and in-session navigation are consistent.
- **A new session can mean a new draw.** A visitor who returns tomorrow, or opens the site in a fresh tab, may land in a different arm. That's acceptable for page-level conversion tests and a problem for anything that depends on repeated exposure. The `storage` option accepts `localStorage` if you need stickier assignment, but check that against your consent model first.
- **Splits are per challenger, and the control gets the remainder.** `Experiment Split: 10, 20, 30` gives the control 40%. A split totalling 100 removes the control entirely, which is almost never what you want.

Optional gates are checked before the draw. If `Experiment Status` is inactive, or today is outside the start and end dates, the experiment doesn't run. The same happens if the visitor matches none of the `Experiment Audience` functions, or if `Experiment Requires Consent` is true and consent hasn't been given. In each case the visitor gets the control.

### 4. The variant content replaces the control

If the visitor is assigned a challenger, the plugin fetches that document from the same origin (for example `/experiments/exp0042/challenger-1`) and swaps its content into `main`, the section, or the fragment selector. Then normal block decoration runs. The URL in the address bar doesn't change. With `Experiment Resolution: redirect`, the visitor is sent to the variant URL instead. That costs a full navigation, so I use it only when the challenger is a different template.

The plugin also adds classes to `<body>`, such as `experiment-hero-test variant-challenger-1`. **Code-only experiments** use these classes: set `Experiment Variants` to a number such as `2` instead of URLs, and your CSS or JavaScript reads the class. This is how you test a new block implementation without duplicating content.

### 5. Telemetry and events record the exposure

Once the page is active, the plugin calls `sampleRUM('experiment', { source: experimentId, target: variant })`. That's a checkpoint in [Operational Telemetry](https://www.aem.live/docs/rum), AEM's cookieless real user monitoring. If the page view is in the sample, the checkpoint is sent with the page's clicks, form submissions, Core Web Vitals and errors. Those are the raw material for your results.

The plugin also dispatches an `aem:experimentation` DOM event with the experiment, variant and modified element. That event is your bridge to Adobe Analytics, Customer Journey Analytics or GA4, and **for most sites it's how the experiment should really be measured.** More on that below.

### Scopes: page, section, fragment and multi-page

| Scope | How it's authored | Limit | Good for |
|---|---|---|---|
| **Page** | Page metadata | One per page | Full redesigns, template changes, long-form copy |
| **Section** | Section Metadata with the same keys | One per section; runs after the page experiment resolves | Testing one band of a page while the rest stays fixed |
| **Fragment** | `Experiment Manifest` pointing to a sheet with Page, Experiment, Variant, Selector and Url columns | Many; one sheet can serve many pages | Shared components such as a header promo or a pricing table |
| **Code-only** | `Experiment Variants: 2` (a number) | Same as page or section | New block logic, interaction patterns, performance changes |
| **Multi-page** | Same experiment ID on several pages, with challenger URLs in matching order | Order must match on every page | A consistent journey change, such as a new product-page template across a range |

Fragment experiments are powerful and easy to overuse. Because the manifest lives in a sheet rather than on the page, they're the ones most likely to be forgotten. I give them a named owner and an end date, always.

## Running an experiment on AEM as a Cloud Service

On AEM as a Cloud Service, EDS sites are authored in one of two ways, and experiments follow the authoring model. (I compare the two in [Universal Editor vs document-based authoring]({{ '/blog/2026/11/universal-editor-vs-document-based-authoring/' | relative_url }}).)

### Document-based authoring

This is the [workflow on aem.live](https://www.aem.live/docs/experimentation):

1. Pick an experiment ID, ideally your ticket number: `EXP-0042`.
2. Copy the control document into `/experiments/exp0042/` and edit the copy. Preview and publish it.
3. Add the experiment rows to the control's metadata block.
4. Preview the control. Open the experimentation panel from AEM Sidekick (in v2 it's a Sidekick extension, not an in-page overlay) and switch between variants. `?experiment=exp-0042/challenger-1` forces a variant and makes a handy link for reviewers.
5. Publish the control. The experiment is live.

Add a bulk metadata row for `/experiments/**` with `robots: noindex,nofollow` once, and challengers stay out of search results.

### Universal Editor (crosswalk)

Adobe's [contextual experimentation guide](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/sites/contextual-experimentation) and the [crosswalk experimentation extension](https://developer.adobe.com/uix/docs/extension-manager/extension-developed-by-adobe/universal-editor-crosswalk-experimentation/) describe a guided flow inside Universal Editor:

1. Enable the experimentation extension in Extension Manager. An A/B icon appears in the right rail.
2. On the control page, choose **Create New**. The experiment ID is generated for you.
3. **Add a challenger.** It starts as a copy of the control in AEM, and you edit it in context like any other page. There's also a **Generate Variation** option for AI-assisted copy.
4. Set the split (the panel requires splits to total 100 and resets to an even split when you add a challenger), optional dates and optional audiences. Audiences must already exist in code.
5. **Save** stores a draft. **Activate** publishes control and challenger. **Promote** makes the winner the new control when you're done.

Under the hood, the panel writes the same experiment properties into page metadata and creates the challenger pages. Both authoring models feed the same plugin.

Adobe's documentation lists the current limits of this guided flow: **A/B tests only, conversion as the only goal, page-level experiments, one per page, and conversions measured on clickable elements.** Section, fragment and code-only experiments still need metadata or code. That's a reasonable trade for authors, and worth knowing before you promise a feature to marketing.

### The one-off developer setup

| Task | Why it matters |
|---|---|
| Install the plugin with `git subtree` into `plugins/experimentation` | Keeps it updatable with `git subtree pull` |
| Add `experiment-loader.js`, the `modulepreload`, and the calls in `loadEager` and `loadLazy` | Plugin only loads when needed; decision happens before the first section renders |
| Set `prodHost` (or `isProd`) | Keeps the simulation UI off production |
| Register the Sidekick button in `tools/sidekick/config.json` (or via the admin API on newer config setups) | Authors can preview and switch variants |
| Add [aem-rum-conversion](https://github.com/adobe/aem-rum-conversion) | Named conversions instead of "any click" |
| Raise the sampling rate on pages with experiments | Default sampling is too sparse for most tests |
| Forward `aem:experimentation` to your analytics data layer | Unsampled, cross-page measurement |
| Wire consent to `updateUserConsent()` if any test requires consent | Declined visitors get the control and send no experiment events |
| Write audience functions you'll reuse (device, geography, returning visitor) | Authors can target without a developer each time |

If you run several sites from one codebase, all of this lives in the shared code and each site only authors metadata. See [repoless EDS]({{ '/blog/2026/10/aem-eds-repoless-one-codebase-many-sites/' | relative_url }}).

## When to use EDS experimentation

I use a simple rule. **EDS experimentation is the default for changes to what everyone sees on a page, when the outcome happens on that page or close to it.**

| Situation | Use EDS experimentation? | Notes |
|---|---|---|
| Hero, headline, CTA wording or placement on a busy landing page | **Yes, the sweet spot** | Content test, on-page conversion, author-owned |
| New layout or template for a page type | **Yes**, page or multi-page | Use the same ID across pages for consistency |
| New block implementation, such as a carousel versus a static grid | **Yes**, code-only | Body classes switch the behaviour; no content copies |
| Shared promo or banner across many pages | **Yes**, fragment experiment | Give it an owner and an end date |
| Campaign-specific landing content by `utm` or email source | **Yes**, campaigns | Not an A/B test; it's targeting. Measure separately |
| Content for Real-Time CDP or known-customer segments | **No**, use Target or Journey Optimizer | Plugin audiences are browser functions, not a profile store |
| Maximising revenue during a two-week sale | **No**, use a bandit (for example Target Auto-Allocate) | Fixed splits optimise learning, not earning |
| Page with a few thousand visits a month | **Usually no** | You can't detect realistic effects. Ship the best judgement, or test somewhere busier |
| Change whose conversion happens three pages later, at checkout | **Only with analytics forwarding** | Telemetry can't connect page views |
| Legal, pricing or compliance content | **No** | Don't randomise what people are entitled to see consistently |

## Advantages, and the limits that come with them

**The advantages are real:**

- **No performance tax.** There's no third-party round trip. The plugin only loads on pages with tests, and the challenger is one extra same-origin fetch of a small document. On a site that scores 100 in Lighthouse, that matters. Adobe's own figure for Target on EDS is about 1.3 seconds added to mobile LCP on the first call. (My notes on [keeping Lighthouse at 100]({{ '/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/' | relative_url }}) explain the budget.)
- **Authors own it.** A challenger is a copy of a page, edited in Word, Google Docs or Universal Editor. There's no separate tool, login or ticket for every headline test. That is what raises experiment velocity, which is the metric that really predicts programme value.
- **No extra licence.** The plugin is open source and Operational Telemetry is included with AEM.
- **Privacy by default.** Telemetry uses no cookies and collects no personal data, so Adobe states no opt-in is needed for the default configuration. Assignment uses session storage, and you can still require consent per experiment.
- **Resilient to change.** Variants are whole documents, not CSS selectors recorded in a visual editor, so a developer refactoring a block doesn't silently break a running test.
- **Flicker-free when set up properly.** The decision happens before the first section is painted.
- **Everything is reviewable.** Experiment configuration is metadata and code, so it's visible in Git and in the content tree.

**The limits, stated plainly:**

- **No built-in significance engine.** You get sampled counts and conversion rates. Statistical rigour is your job.
- **Sampled, page-view-level data.** At the default rate, 1% of page views are reported, and conversions on later pages aren't attributed.
- **Assignment is per session, not per person.** Fine for one-visit conversions. Weak for loyalty, retention or "came back and bought" metrics.
- **Audiences are code.** Every new segment is a developer task, and an audience that calls an external API blocks rendering until it resolves.
- **Governance is your job.** There's no central activity list unless you build one. Tests that are never switched off are the most common mess I clean up.

## How to measure experimentation success

This is the part that decides whether experimentation earns its keep. I measure at two levels: **is this experiment a success?** and **is our experimentation programme a success?**

![The experiment measurement framework: before launch define hypothesis, primary metric, guardrails, minimum detectable effect and sample size; during the test check sample ratio and data quality; after the test read the confidence interval and decide to ship, iterate or stop]({{ '/assets/img/blog/eds-experimentation/02-measurement-framework.svg' | relative_url }}){: width="1200" height="620" loading="lazy" decoding="async"}

### Start with a written hypothesis

Every experiment I approve has one sentence in this shape:

> **Because** we saw *[evidence]*, **we believe** that *[change]* for *[audience/page]* **will** *[move primary metric by at least X]*, **without** *[harming guardrail]*.

For example: *Because session recordings show visitors scrolling past the hero without reading it, we believe that replacing the hero image with a three-point value statement on `/pricing` will increase "Start trial" clicks by at least 15% relative, without increasing bounce rate or LCP.*

If a team can't fill the brackets, the test isn't ready. "Let's see what happens" isn't a hypothesis; it's a way to find a false winner.

### Choose metrics in three tiers

| Tier | What it is | EDS examples | Rule |
|---|---|---|---|
| **Primary metric** | The one number that decides the test | Conversion rate on a named conversion (`Conversion Name: start-trial`), form submissions per visit | **Exactly one.** Decided before launch |
| **Secondary metrics** | Explain *why* the primary moved | Click-through to the next step, `viewblock` on the section you changed, scroll depth | Inform; never pick the winner |
| **Guardrail metrics** | Things that must not get worse | LCP, INP and CLS of each variant, JavaScript errors, bounce rate, unsubscribes, support contacts | A guardrail failure blocks shipping, whatever the primary says |

Two EDS-specific points. First, **replace the default "any click" conversion.** Out of the box, any click counts as a conversion, including clicks on the cookie banner and the menu toggle. Install [aem-rum-conversion](https://github.com/adobe/aem-rum-conversion) and name the conversion that matters with `Conversion Name`, `Conversion Element` (`Link`, `Labeled Link` or `Form`) and, for forms, `Conversion Value Field`.

Second, **use performance as a guardrail.** Operational Telemetry already records Core Web Vitals per page view. A challenger with a heavier hero image can win on clicks and lose on LCP, and that LCP loss costs you organic traffic months later. Use the [OpTel Explorer](https://www.aem.live/docs/optel-explorer) facets, or your analytics tool, to compare each variant's vitals before you call a winner.

### Size the test before you launch

Decide the **minimum detectable effect (MDE)**: the smallest relative lift worth acting on. Then calculate the sample you need. At 95% confidence (two-sided) and 80% power, per variant:

| Baseline conversion | Detect 10% lift | Detect 20% lift | Detect 30% lift |
|---|---|---|---|
| 2% | 80,700 | 21,100 | 9,800 |
| 5% | 31,200 | 8,200 | 3,800 |
| 10% | 14,800 | 3,800 | 1,800 |

*Visitors per variant, from the standard two-proportion formula. My [Target vs EDS post]({{ '/blog/2026/11/adobe-target-vs-edge-delivery-services-experimentation/' | relative_url }}#a-worked-example) works through the calculation step by step.*

Three practical consequences:

- **Bold changes are cheaper to test.** Halving the MDE roughly quadruples the sample. A new value proposition is testable on far more pages than a button colour.
- **Convert to calendar time, and round up to whole weeks.** If the page gets 4,000 eligible visitors a day and you need 2 × 8,200, that's about 4 days. Run 7, so every weekday is represented. I don't run tests shorter than one week or longer than about six, because cookie churn, campaigns and seasonality start to dominate.
- **Account for sampling.** These are the *visitors* the test needs **in the data you analyse**. If you analyse Operational Telemetry at the default 1-in-100 rate, you need 100 times the traffic. That's why the plugin README recommends 1-in-10 sampling on pages with experiments:

```html
<!-- head.html, before aem.js loads: sample 1 in 10 on pages with experiments -->
<script>
  window.RUM_SAMPLING_RATE = document.head.querySelector('[name^="experiment"],[name^="campaign-"],[name^="audience-"]')
    || [...document.querySelectorAll('.section-metadata div')].some((d) => d.textContent.match(/Experiment|Campaign|Audience/i))
    ? 10
    : 100;
</script>
```

Even at 1 in 10, a test needing 8,200 visitors per variant needs 82,000 real visitors per variant to reach that in telemetry. **For most sites, telemetry is the operational view and analytics is the measurement view.**

### Send the experiment to analytics

Forwarding the assignment gives you unsampled counts, conversions on any page in the session, revenue, and segments such as new versus returning. It takes a few lines:

```javascript
// scripts.js: one event per experiment exposure, in your analytics data layer
document.addEventListener('aem:experimentation', ({ detail }) => {
  if (detail.type !== 'experiment') return;
  window.adobeDataLayer = window.adobeDataLayer || [];
  window.adobeDataLayer.push({
    event: 'experiment-exposure',
    experiment: { id: detail.experiment, variant: detail.variant },
  });
});
```

For GA4 the same handler pushes an `experiment_view` event to `window.dataLayer`. Whichever tool you use, **analyse by visit or visitor, not by page view,** and make sure the exposure event fires once per page load, not once per re-render.

### Check data quality while it runs

Don't check the result early, because peeking inflates false positives. Do check the data early. Two checks catch most broken tests in the first day or two:

**Sample ratio mismatch (SRM).** If you set a 50/50 split, the visitor counts should be close to 50/50. Suppose analytics shows 10,000 in control and 10,400 in the challenger. A chi-square test gives χ² ≈ 7.84 and p ≈ 0.005. A split that uneven is very unlikely by chance, so something is excluding visitors from one arm: a redirect losing tracking, a challenger that errors, a bot filter, or consent behaving differently. **A test with SRM is invalid, whatever the result.** Fix the cause and restart.

You can't usefully check SRM in sampled telemetry. The same split appears as roughly 100 and 104 sampled page views, which gives p ≈ 0.78, so even a serious problem looks fine. Another reason to measure in analytics.

**Data sanity.** Is the conversion firing in both arms? Do the challenger's Core Web Vitals look normal? Are there new JavaScript errors in the challenger? Use the simulation panel and `?experiment=` links to test every variant on mobile and desktop before launch, not after.

### Read the result as an interval, not a winner

When the planned sample is reached, stop and analyse. Suppose a test planned for a 5% baseline and 20% MDE ends with 31,000 visitors per arm: 1,550 conversions in control (5.0%) and 1,736 in the challenger (5.6%).

- Two-proportion z-test: **z ≈ 3.33, p ≈ 0.001.** The difference is statistically significant.
- 95% confidence interval for the difference: **+0.25 to +0.95 percentage points,** or about **+5% to +19% relative.**

The useful sentence for stakeholders is the second one: "The new hero most likely lifts trial starts by between 5% and 19%." The interval tells you whether the effect is practically significant. If your MDE was 20%, even the top of this range is below it. It's a real win, but a smaller one than hoped. That should temper the forecast you put in the business case.

Then apply decision rules you agreed before launch:

| Outcome | Decision |
|---|---|
| Primary significantly better, guardrails fine | **Ship.** Promote the challenger, remove the test |
| Primary significantly better, a guardrail significantly worse | **Don't ship as is.** Fix the guardrail (often image weight or layout shift) and retest |
| No significant difference, interval narrow around zero | **Stop.** The change doesn't matter much. Ship whichever is cheaper to maintain |
| No significant difference, interval wide | **Inconclusive.** The test was underpowered. Don't call it a loss; make a bolder change or test a busier page |
| Primary significantly worse | **Valuable learning.** Record why, revert, and use it in the next hypothesis |

Two more rules I hold teams to. **One primary metric per test:** if you check ten metrics, one will look significant by chance. **Few challengers:** with four challengers at 95% confidence, the chance of at least one false winner is about 18.5%. If you do run several, apply a correction such as Bonferroni (divide the significance level by the number of comparisons).

### Measure the programme, not just the tests

Individual tests answer individual questions. Leadership wants to know whether experimentation is worth the effort. I report four numbers each quarter:

| Programme metric | What it tells you | Healthy direction |
|---|---|---|
| **Velocity:** experiments concluded per month | Whether the process is light enough | Rising, then stable |
| **Quality:** share of experiments with a written hypothesis, pre-registered metric and sample size | Whether results can be trusted | Close to 100% |
| **Win rate:** share of conclusive tests where the challenger won | Whether hypotheses come from evidence | Industry figures are often quoted at roughly 10–30%. Much higher usually means tests are too safe or analysis is too generous |
| **Cumulative impact:** sum of the *lower bounds* of shipped wins, with each lift applied to its own page's traffic | What the programme has really added | Conservative and defensible |

Losses and flat results aren't failures in this view. A test that stops a bad redesign from shipping saves money too. Record them in the same register.

## The experimentation operating model

Tools don't make a programme. A small, repeatable loop does.

![The EDS experimentation lifecycle as a loop: research, hypothesis and register, build the challenger and preview, QA and launch, monitor data quality, analyse at the planned sample, decide and promote, then clean up and share learning, feeding the next hypothesis]({{ '/assets/img/blog/eds-experimentation/03-lifecycle.svg' | relative_url }}){: width="1200" height="600" loading="lazy" decoding="async"}

**Roles.** On most projects, I set out roles like this:

- **Experiment owner** (marketing or product): writes the hypothesis and owns the decision.
- **Author**: builds the challenger, in documents or Universal Editor.
- **Developer**: owns the plugin, audiences, conversions, code-only variants and analytics forwarding.
- **Analyst**: sizes the test, checks SRM, and signs off the read-out.

On a small team one person wears three of these hats. That's fine, as long as the analysis step isn't skipped.

**The register.** One shared sheet, one row per experiment: ID, page, scope, hypothesis, primary metric, guardrails, MDE, required sample, start date, planned end date, owner, result and decision. It prevents two tests on the same page, makes cleanup someone's job, and becomes your organisation's memory of what works.

**Cleanup.** When a test ends, remove the experiment metadata, promote or delete the challenger, delete fragment manifest rows, and remove code-only branches from the block. Stale tests are the most common EDS experimentation problem I find in audits. They quietly send a share of traffic to an old variant for months.

## Common pitfalls on EDS

- **Measuring "any click".** Install the conversion plugin and name the conversion.
- **Testing on low-traffic pages at default sampling.** Results are noise. Raise sampling, forward to analytics, or don't test.
- **Calling a winner early.** Decide the sample size up front and wait for it.
- **Ignoring the session boundary.** Assignment can change between sessions. Don't use EDS experimentation for metrics that need consistent exposure over weeks without stickier storage.
- **Challengers that drift from control.** Copy the control *just before* launch. A challenger copied two weeks earlier may be missing content updates, and you'll be testing those too.
- **Forgetting SEO hygiene.** Use `noindex,nofollow` on `/experiments/**`, keep challengers out of the sitemap, and use canonical plus temporary redirects if you use `redirect` resolution.
- **Slow audience functions.** An audience that calls an API blocks rendering. Cache the answer, or resolve it at the edge.
- **Two experiments touching the same element.** A page experiment and a fragment experiment changing the same banner produce results nobody can interpret. One owner per element.
- **Never cleaning up.** Every test needs an end date and a person responsible for removing it.

## FAQ

**Is EDS experimentation available on AEM as a Cloud Service?**
Yes. Sites delivered through Edge Delivery Services on AEM as a Cloud Service, whether authored in documents or in Universal Editor, use the same plugin. Universal Editor adds a guided panel on top. Traditional AEM Sites pages without EDS don't use this plugin.

**Does it affect Core Web Vitals?**
Very little when set up as recommended. The plugin loads only on pages with experiments, there's no third-party call, and the challenger is one same-origin fetch in the eager phase. Watch the challenger's own content: a heavier hero affects LCP whichever tool you use.

**Do I need cookie consent?**
Adobe states that Operational Telemetry with the default configuration needs no opt-in, because it uses no cookies and collects no personal data. Variant assignment uses session storage. Your privacy team decides, and the plugin supports `Experiment Requires Consent` and `updateUserConsent()` when they want consent first.

**Does the plugin tell me when a result is significant?**
No. It shows counts and conversion rates from sampled telemetry. Calculate significance yourself, or in your analytics tool, from the unsampled data.

**Can I run A/B tests on content from AEM Assets or Content Fragments?**
Yes, if they're rendered through blocks. The challenger page or fragment references different content, or a code-only variant changes which content the block requests.

**How many experiments can run at once?**
One per page, one per section, and as many fragment experiments as you can govern. Traffic is the real limit: overlapping tests on the same journey split your sample and make interactions harder to read.

**What happens when the end date passes?**
The experiment stops running and visitors get the control, but the metadata and challenger pages stay where they are. Clean them up.

## Closing thought

EDS experimentation makes the mechanics of A/B testing almost free: no licence, no performance cost, and no separate tool for authors. That's its great strength and its trap. When running a test costs nothing, teams run tests that can't answer anything.

My standard is simple. **Write the hypothesis, pick one primary metric and its guardrails, size the test, measure exposure in unsampled analytics, check the split, wait for the sample, read the interval, and clean up.** Do that, and the plugin's low cost turns into what experimentation is for: a steady supply of decisions you can defend.

If you're setting up experimentation on an EDS or AEM as a Cloud Service site, or trying to rescue a programme that's producing more noise than learning, [get in touch](/contact/).

### References

- [Experimentation](https://www.aem.live/docs/experimentation) (aem.live)
- [aem-experimentation plugin, README](https://github.com/adobe/aem-experimentation) (Adobe, GitHub)
- [Experiments documentation](https://github.com/adobe/aem-experimentation/blob/main/documentation/experiments.md) (Adobe, GitHub)
- [AEM RUM conversion tracking plugin](https://github.com/adobe/aem-rum-conversion) (Adobe, GitHub)
- [Operational Telemetry](https://www.aem.live/docs/rum) and [OpTel Explorer](https://www.aem.live/docs/optel-explorer) (aem.live)
- [Operational Telemetry checkpoints](https://www.aem.live/developer/rum) (aem.live)
- [Contextual experimentation](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/sites/contextual-experimentation) (Adobe Experience League)
- [Universal Editor experimentation for AEM crosswalk](https://developer.adobe.com/uix/docs/extension-manager/extension-developed-by-adobe/universal-editor-crosswalk-experimentation/) (Adobe Developer)
- [How long should I run an A/B test?](https://experienceleague.adobe.com/en/docs/target/using/activities/abtest/sample-size-determination) (Adobe Experience League)
- [Website testing and Google Search](https://developers.google.com/search/docs/crawling-indexing/website-testing) (Google Search Central)

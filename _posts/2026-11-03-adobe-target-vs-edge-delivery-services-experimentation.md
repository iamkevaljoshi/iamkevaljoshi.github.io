---
layout: post
title: "Adobe Target vs Edge Delivery Services experimentation: which to use for testing and personalisation"
seo_title: "Adobe Target vs EDS Experimentation: Which to Use"
description: "Adobe Target or Edge Delivery Services experimentation? A practical comparison of authoring, statistics, audiences, performance, SEO and how to run both."
ai_summary: "Edge Delivery Services experimentation suits content and layout A/B tests: variants are ordinary documents and add no network call before the page renders. Adobe Target suits audience-based and AI-driven personalisation with richer statistics and reporting, at a measurable cost to page speed. The post compares both, works through sample size and significance, and explains how to run them together safely."
date: 2026-11-03 20:00:00 +0530
category: digital-experience
tags: [Personalisation, Experimentation, Adobe Target, Edge Delivery Services]
---

Almost every Edge Delivery Services (EDS) project I've worked on reaches the same meeting. Marketing wants to "test the new hero". Someone points out the organisation already pays for Adobe Target. Someone else has read that EDS has experimentation built in and asks why we'd add another script to a site that currently scores 100 in Lighthouse. The meeting ends with no decision and a follow-up nobody wants.

The honest answer is that the two tools solve overlapping but different problems. EDS experimentation is a lightweight, document-driven way to run content and layout tests with almost no performance cost. Adobe Target is a full decisioning platform with a statistics engine, machine-learning activities, and access to your Experience Platform audiences. Treating them as competitors is how teams end up either over-engineering a button-colour test or under-powering a personalisation programme.

This post is the sequel to my piece on [personalisation and why it matters]({{ '/blog/2026/11/personalisation-why-it-matters-and-how-to-do-it-well/' | relative_url }}). That post covered the why, the maturity ladder, privacy and where decisions should run. This one is narrower and more practical: **when to use which tool on an EDS site, what each costs you in speed and rigour, and how to run both without them fighting.**

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **EDS experimentation is for content and layout tests.** Variants are ordinary documents, the split is set in page metadata, and there's no extra network call before the page renders.
- **Adobe Target is for audience-driven and AI-driven personalisation.** Experience Targeting, Auto-Allocate, Auto-Target, Automated Personalization and Recommendations, with Real-Time CDP audiences and Analytics for Target (A4T) reporting.
- **Target on EDS costs real speed.** Adobe's own figures show about 1.3 seconds added to mobile LCP on the first call. Enable it only on pages that need it.
- **Statistics are the biggest gap.** Target reports confidence and has a sample size calculator. EDS reports on sampled Operational Telemetry, which divides your effective sample size by the sampling rate.
- **Plan sample size before you launch.** At a 4% baseline, detecting a 10% relative lift needs roughly 39,500 visitors per variant. Most low-traffic pages can't support that test.
- **Both can be SEO-safe** if the primary content stays the same for everyone, variant URLs stay out of the index, and tests end when they've answered the question.
- **You can run both,** as long as one tool owns each page or slot, consent is shared, and assignments flow into one analytics view.

## What EDS experimentation actually is

EDS experimentation is a plugin, not a product. It lives in your project code (the [adobe/aem-experimentation](https://github.com/adobe/aem-experimentation) repository, now on v2), runs in the browser in the eager phase, and is driven entirely by metadata that authors add to documents. There's no separate console and no extra licence.

### How an experiment is set up

The workflow on [aem.live](https://www.aem.live/docs/experimentation) is deliberately simple:

1. Pick an experiment ID, ideally tied to your ticketing system.
2. Copy the control page into a folder such as `/experiments/exp0042/` and edit the copy. That copy is the challenger.
3. Add metadata to the control page and publish both.

A typical page metadata block looks like this:

| Metadata | |
|---|---|
| Experiment | hero-cta-test |
| Experiment Variants | https://main--site--org.aem.page/experiments/exp0042/challenger-1 |
| Experiment Split | 20 |
| Experiment Start Date | 2026-11-10 |
| Experiment End Date | 2026-11-24 |

The plugin's [experiments documentation](https://github.com/adobe/aem-experimentation/blob/main/documentation/experiments.md) lists the full set of keys: `Experiment`, `Experiment Variants`, `Experiment Split`, `Experiment Variant Names`, `Experiment Audience`, `Experiment Status`, `Experiment Start Date`, `Experiment End Date`, `Experiment Requires Consent` and `Experiment Resolution`. A few details matter in practice:

- **The split is per challenger, and the control gets the remainder.** With one challenger and a split of `20`, the challenger gets 20% and the control 80%. With no split, traffic is divided evenly across control and challengers.
- **Scope can be page, section or fragment.** Section experiments use the same keys in Section Metadata. Fragment experiments use an `Experiment Manifest` spreadsheet with a CSS selector per row. You get one page-level experiment per page.
- **Variants are swapped in place by default.** The visitor stays on the control URL. Setting `Experiment Resolution` to `redirect` sends them to the variant URL instead.
- **Assignment is sticky per session.** The chosen variant is kept in `sessionStorage` by default.
- **Code-only tests are possible.** Put a number in `Experiment Variants` and the plugin adds `experiment-*` and `variant-*` classes to `<body>` for your CSS or JavaScript to act on.

### Audiences and campaigns

The same plugin handles **audiences** and **campaigns**. Audiences are JavaScript functions you register in `scripts.js` (for example `mobile`, `desktop`, or a geography check), and authors map them to variant URLs with metadata such as `Audience: Mobile`. Campaigns work the same way, keyed on a campaign parameter in the URL, which suits email and social traffic.

This is rule-based, client-side segmentation. It's useful, but it's not an audience platform. The functions run in the browser, and the plugin's [audiences documentation](https://github.com/adobe/aem-experimentation/blob/main/documentation/audiences.md) is clear that an audience calling an external service **blocks rendering until it resolves**. Multiple audiences combine as "or"; for "and" you write a combined function.

### Simulation and reporting

In preview, authors can switch between variants to check the setup. In v2 that simulation panel moved out of the page and into the AEM Sidekick extension. A contextual "experimentation rail" is described in the README as still in development, so I wouldn't plan a workflow around it yet.

Reporting comes from [Operational Telemetry](https://www.aem.live/docs/rum), the cookieless real user monitoring built into EDS. By default, any click counts as a conversion; with the RUM conversion plugin you can name specific conversions in metadata. Results need a domain key to view. Operational Telemetry samples **one in 100 page views** by default, and that single fact shapes most of what follows about statistics.

## What Adobe Target brings

Target is a different class of tool. It's a hosted decisioning service with its own UI, workflow, audience model and reporting.

### Activity types

According to the [Target activities guide](https://experienceleague.adobe.com/en/docs/target/using/activities/target-activities-guide), current activity types are:

| Activity | What it does | When I use it |
|---|---|---|
| A/B Test | Fixed traffic split between experiences | Proper hypothesis tests with a statistics engine behind them |
| Auto-Allocate | Multi-armed bandit that shifts traffic to the leader | Short campaigns where earning matters more than learning |
| Auto-Target | Machine learning picks the best experience per visitor | Several strong experiences and enough traffic to train a model |
| Automated Personalization | Machine learning combines offers per visitor | Many interchangeable offers in a few slots |
| Multivariate Test | Tests combinations of elements | Rarely; it needs a lot of traffic |
| Experience Targeting | Rule-based content for defined audiences | The workhorse of segment-based personalisation |
| Recommendations | Product or content recommendations from algorithms | Catalogues and large content libraries |

Auto-Target, Automated Personalization and Recommendations are marked as **Target Premium** features in Adobe's documentation. Check your contract before you design around them.

### Audiences and data

Target's audiences can use its own visitor profile, Adobe Analytics segments, and **Real-Time CDP audiences** through the Adobe Target destination. Adobe's [destination documentation](https://experienceleague.adobe.com/en/docs/experience-platform/destinations/catalog/personalization/adobe-target-connection) is specific: same-page and next-page personalisation need the Web SDK, a datastream, and edge segmentation. Without a datastream you're limited to next-session personalisation. This is where Target has no real substitute on EDS: if your segments live in Experience Platform, Target is how they reach the page.

### Reporting and statistics

Target reports A/B results with **Welch's t-test**, two-tailed, comparing each experience to the control, and offers **Bayesian reporting** for conversion goals with "Chance to Beat Control" as the headline metric ([statistical calculations](https://experienceleague.adobe.com/en/docs/target/using/reports/statistical-methodology/statistical-calculations)). Auto-Allocate has its own method: about 80% of new visitors are allocated to favour the leader and 20% stay random, and allocation starts only after each experience has at least 1,000 visitors and 50 conversions ([Auto-Allocate](https://experienceleague.adobe.com/en/docs/target/using/activities/auto-allocate/automated-traffic-allocation)).

With **[Analytics for Target (A4T)](https://experienceleague.adobe.com/en/docs/target/using/integrate/a4t/a4t)**, results are reported in Adobe Analytics against your real business metrics. A4T supports A/B (manual, Auto-Allocate and Auto-Target), Experience Targeting, MVT and Recommendations, but **not Automated Personalization**.

### Authoring

Target offers the **Visual Experience Composer (VEC)** for point-and-click changes and the **form-based composer** for offers delivered to named locations or scopes. On AEM as a Cloud Service, Experience Fragments can be exported to Target as offers.

In my experience, on EDS the form-based route with clearly named decision scopes is more reliable than the VEC. EDS blocks are decorated in JavaScript after load, so selectors captured in the VEC can break when a developer changes a block. A named scope that the block itself reads is a contract both sides can see.

## How Target runs on Edge Delivery Services

Adobe documents the integration in [Integrating Adobe Target with Edge Delivery Services](https://www.aem.live/developer/target-integration). The recommended path is the **Experience Platform Web SDK** (alloy.js); at.js is still supported but legacy. Adobe also publishes the [AEM martech plugin](https://github.com/adobe-rnd/aem-martech), which vendors the Web SDK and Adobe Client Data Layer and splits the work across EDS's loading phases. Its README says it's offered through Adobe's co-innovation projects with AEM Engineering, so check access with your Adobe team:

- **Eager:** personalisation. `loadEager` waits for the Target decision before rendering the first section, which avoids flicker. Personalisation runs only when the page has `Target` metadata and consent allows it, with a default `personalizationTimeout` of 1,000 ms.
- **Lazy:** analytics and the data layer, after the main content has rendered.
- **Delayed:** Launch tags and other third-party scripts.

That design is sensible, but it can't remove the round trip. Adobe's own measurements in the integration guide:

| Scenario | LCP added | Total Blocking Time | PageSpeed points lost |
|---|---|---|---|
| Mobile, first call | about 1.3 s | 20–40 ms | 0–5 |
| Mobile, later calls | about 0.1 s | 20–40 ms | 0–3 |
| Desktop, first call | about 0.5 s | 0–20 ms | 0–3 |
| Desktop, later calls | 0.3–0.5 s | 0–20 ms | 0–3 |

The guide's advice is to **enable Target only on pages that need it**, using `Target: on` in page metadata as a feature flag, and to keep offers lightweight because complex modifications add their own delay and can flicker. Target applies changes after blocks are decorated, so any block logic that depends on a Target change needs a `MutationObserver`.

If you've used the Web SDK elsewhere, you'll know the standard [prehiding snippet](https://experienceleague.adobe.com/en/docs/experience-platform/web-sdk/personalization/manage-flicker), which hides the body for up to 3,000 ms by default. On EDS I don't use a body-hiding snippet. Waiting for the decision in the eager phase, with a tight timeout and a good default, is a better trade.

If performance is the deciding factor for you, my notes on [keeping Lighthouse at 100 on EDS]({{ '/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/' | relative_url }}) go deeper on the eager, lazy and delayed budget.

## Where each runs in the page lifecycle

![Where EDS experimentation and Adobe Target run in the EDS page lifecycle, from edge to delayed phase, with their reporting paths]({{ '/assets/img/blog/target-vs-eds-experimentation/01-page-lifecycle.svg' | relative_url }}){: width="1200" height="640" loading="lazy" decoding="async"}

Both tools make their decision in the eager phase, before the largest contentful paint. The difference is what they need to do it. The experimentation plugin reads metadata that's already in the HTML, picks a variant, fetches one more document from the same origin, and swaps it in. Target has to send a request to the Adobe Edge Network and wait for a decision, which may include evaluating Real-Time CDP edge audiences.

Neither runs at the CDN in a standard setup. If you need truly server-side or edge decisions, Target offers server-side SDKs and the Edge Network API, and you can build edge logic on EDS (I compare the options in [edge worker vs JSON2HTML]({{ '/blog/2026/10/aem-eds-edge-worker-vs-json2html/' | relative_url }})). That's custom architecture, not configuration, so budget for it.

## Side-by-side comparison

| Dimension | EDS experimentation | Adobe Target on EDS |
|---|---|---|
| **Cost and licensing** | Part of your project code; no extra licence | Separate licence; Auto-Target, AP and Recommendations need Premium |
| **Authoring** | Copy a document, edit, add metadata. Authors stay in Word, Google Docs or Universal Editor | Target UI, VEC or form-based. A separate tool, login and workflow |
| **Statistical rigour** | Basic conversion view on sampled telemetry; no documented significance method | Welch's t-test or Bayesian, confidence intervals, sample size guidance, A4T |
| **Audiences and data** | Browser-side functions you write; campaigns from URL parameters | Target profiles, Analytics segments, Real-Time CDP edge audiences |
| **Personalisation depth** | Rule-based variants per audience or campaign | Rules, bandits, per-visitor ML, recommendations |
| **Performance** | No third-party call; one extra same-origin fetch when a variant is served | Edge Network round trip in the eager phase; about 1.3 s mobile LCP on first call (Adobe's figure) |
| **Flicker** | Low; variant resolved before first section renders | Low with the eager wait; higher with heavy offers or VEC changes |
| **SEO** | Variants are separate documents; keep them out of the index | Client-side changes on one URL; redirect offers need care |
| **Governance** | Lives in Git and documents; easy to review, easy to forget | Central activity list, approvals, priorities and workspaces |
| **Consent** | `Experiment Requires Consent` per test | Web SDK consent; martech plugin defaults to pending |

The rows that decide most projects are statistics, audiences and performance. If you need Real-Time CDP audiences or machine learning, the decision is made. If you don't, the question is whether your test needs Target's statistics or just a fair split and a sensible read-out.

## Statistical rigour: sample size and significance

This is where I see most teams go wrong, with either tool. A test is a measurement. If the instrument can't detect the size of change you're looking for, the result is noise with a chart on top.

### A worked example

Suppose a landing page converts at **4%**, and you want to detect a **10% relative lift** (4.0% to 4.4%) with the usual settings: 5% significance (two-sided) and 80% power. Adobe's [sample size guidance](https://experienceleague.adobe.com/en/docs/target/using/activities/abtest/sample-size-determination) recommends at least 95% confidence and 80% power as a general rule.

The standard formula for comparing two proportions is:

```text
n per variant = ( z(α/2) · √(2·p̄·(1−p̄)) + z(β) · √(p1·(1−p1) + p2·(1−p2)) )² / (p2 − p1)²

p1 = 0.040, p2 = 0.044, p̄ = 0.042
z(α/2) = 1.960 (95% two-sided), z(β) = 0.842 (80% power)

numerator   = (1.960 · √(2 · 0.042 · 0.958) + 0.842 · √(0.0384 + 0.042064))²
            = (1.960 · 0.28368 + 0.842 · 0.28366)²
            = (0.5560 + 0.2388)² = 0.7948² ≈ 0.6318
denominator = 0.004² = 0.000016

n ≈ 39,500 visitors per variant (about 79,000 in total)
```

With 6,000 eligible visitors a day split 50/50, that's about 13 days. Round up to **two full weeks** so every weekday is represented equally, as Adobe's guidance also suggests. If you were happy to detect only a 20% lift (4.0% to 4.8%), you'd need about 10,300 per variant, but I'd still run at least one full week.

Now suppose the test ends with 42,000 visitors per variant: 1,680 conversions in control (4.0%) and 1,848 in the challenger (4.4%). A two-proportion z-test gives z ≈ 2.89 and p ≈ 0.004. The 95% confidence interval for the difference is roughly **+0.13 to +0.67 percentage points**. That's a real effect, but notice how wide the interval is: the true lift could be anywhere from about 3% to 17% relative. Report the interval, not just the winner.

### What sampling does to EDS results

Here's the part that catches EDS teams. Operational Telemetry samples one page view in 100 by default. **Sampling divides your effective sample size by the sampling rate.** The 39,500 visitors per variant above become about 395 sampled visits, with around 16 conversions in each arm. No statistical method can separate 16 from 17.

The plugin README says as much: on pages with fewer than 100,000 monthly page views, you're unlikely to reach significance with default sampling, and it recommends sampling one in ten. That helps, but even then you'd need about 395,000 real visitors per variant to get the 39,500 sampled visits the test needs. For anything other than high-traffic pages, I send the experiment and variant to the analytics tool (the plugin fires an `aem:experimentation` event for exactly this) and analyse conversions there, on unsampled data.

### Peeking and multiple comparisons

Two more traps apply to both tools:

- **Peeking.** Checking a fixed-horizon test every day and stopping when it crosses 95% inflates false positives. Adobe's guidance says monitoring until significance "causes the confidence interval to be vastly underestimated". Decide the sample size up front and wait for it. Target's Bayesian reporting is designed for continuous monitoring, and Auto-Allocate uses bounds that account for repeated evaluation, which are two good reasons to use Target when stakeholders can't resist looking.
- **Multiple comparisons.** Each extra challenger is another chance of a false positive. With four challengers against a control at 95% confidence, the chance of at least one false winner is 1 − 0.95⁴ ≈ 18.5%. Fewer, bolder variants beat many timid ones.

## SEO: testing without upsetting Google

Google's guidance on [A/B testing and search](https://developers.google.com/search/docs/crawling-indexing/website-testing) is short and practical:

- **No cloaking.** Don't show Googlebot a different set of URLs or content from what people see.
- **Use `rel="canonical"` on alternate URLs** in multi-URL tests, pointing at the original. Google prefers this to `noindex`.
- **Use a 302, not a 301,** if you redirect visitors to a variant URL. JavaScript redirects are fine too.
- **Run tests only as long as necessary,** then remove the variants and the test code.

On EDS, the default experimentation behaviour swaps variant content into the control URL, so the variant documents are only reachable if something links to them. aem.live recommends keeping them out of the index with `robots: noindex,nofollow`, applied in bulk to `/experiments/**` through the metadata sheet. That's reasonable for in-place swaps. If you use `Experiment Resolution: redirect`, the variant URL becomes a real page visitors land on, and I'd follow Google's advice instead: canonical to the control and a temporary redirect. Either way, keep variants out of the sitemap.

With Target, changes are applied on the same URL, so the main risks are heavy client-side changes to primary content and redirect offers that aren't temporary. Keep the primary content, headings and links consistent for everyone, and personalise supporting modules. For the wider principles, see [what actually matters in SEO]({{ '/blog/2026/11/what-actually-matters-in-seo/' | relative_url }}).

## Decision guide

| If you need to… | Use | Why |
|---|---|---|
| Test a hero, headline, CTA or layout on a high-traffic page | **EDS experimentation** | Authors own it, no performance cost, results good enough for big effects |
| Test on a low-traffic page | **EDS experimentation + analytics**, or don't test | Sampled telemetry won't reach significance; read results from unsampled data |
| Show different content to Real-Time CDP audiences | **Target** | On an Adobe stack, Target (or Journey Optimizer) is how edge audiences reach the page |
| Personalise for logged-in customers or known segments | **Target** (Experience Targeting) | Profiles, priorities and governance |
| Let a model choose per visitor | **Target** (Auto-Target or AP, Premium) | No equivalent in EDS |
| Maximise conversions during a short campaign | **Target** (Auto-Allocate) | Bandit shifts traffic while the campaign runs |
| Vary content by campaign source or device | **EDS** campaigns or audiences | Simple rules, no extra call |
| Report results to the business in Adobe Analytics | **Target with A4T**, or EDS events into Analytics | One source of truth for metrics |
| Recommend products or articles | **Target Recommendations** (Premium) | Algorithms and catalogue feeds |

### Three scenarios from real projects

**A content-led marketing site with no Target licence.** EDS experimentation for every test, with experiment and variant pushed into the analytics tool. Raise the sampling rate on the pages you test. Don't buy Target to test headlines.

**A retailer with Real-Time CDP and Target Premium.** Target owns the home page, category pages and logged-in journeys, with Experience Targeting for known segments and Recommendations on product pages. EDS experimentation owns landing-page and template tests that authors run without a ticket. The split is by page, written down.

**A B2B site with Target licensed but little traffic.** In my experience, this is the scenario where Target is most often wasted. Use Experience Targeting for a handful of high-value segments, skip A/B tests that can't reach significance, and use EDS experimentation only for big, bold changes on the few pages with enough traffic.

## Running both without conflict

Both tools can live in the same EDS project. They both run in the eager phase, so the rules are about ownership and data, not code.

- **One owner per page or slot.** A page with an EDS experiment doesn't get `Target: on`, or Target only touches a named slot the experiment doesn't change. Two tools changing the same element produce results nobody can interpret.
- **Order is predictable.** The experimentation plugin resolves the variant document first; Target applies its changes after blocks are decorated. Target offers must therefore work on every EDS variant, or the page must be excluded.
- **Share consent.** Use one consent manager. Map it to the Web SDK consent and to `Experiment Requires Consent`, so a visitor who declines is in neither.
- **One analytics view.** Send EDS assignments to the same place as Target's, so you can see overlap and exclude it.
- **One register of live tests.** A simple sheet with page, tool, owner, start and end dates, metric and decision. It's dull and it's the thing that prevents most collisions.
- **Retire tests promptly.** Remove experiment metadata and variant documents when the test ends, and archive Target activities.

Forwarding the EDS assignment to the Adobe Client Data Layer takes a few lines. Adjust the payload to your schema:

```javascript
// scripts.js: forward EDS experiment, audience and campaign assignments to analytics
document.addEventListener('aem:experimentation', (event) => {
  window.adobeDataLayer = window.adobeDataLayer || [];
  window.adobeDataLayer.push({
    event: 'aem-experimentation',
    experimentation: event.detail,
  });
});
```

If you run several sites from one codebase, put the experimentation and martech configuration in shared code and keep the flags in metadata, as I describe in [repoless EDS]({{ '/blog/2026/10/aem-eds-repoless-one-codebase-many-sites/' | relative_url }}).

## FAQ

**Is EDS experimentation free?**
There's no separate licence. It's an open-source plugin in your project code, and Operational Telemetry is part of EDS. The cost is engineering time to integrate it and the discipline to run tests properly.

**Can EDS experimentation replace Adobe Target?**
For content and layout A/B tests on pages with enough traffic, often yes. For Real-Time CDP audiences, machine-learning activities, recommendations or A4T reporting, no. They overlap only at the simple end.

**Does Adobe Target hurt Core Web Vitals on EDS?**
It can. Adobe's measurements show about 1.3 seconds added to mobile LCP on the first call and much less on later calls. Limit it to pages that need it with the `Target` metadata flag, keep offers light, and avoid body-hiding snippets.

**Should I use the Visual Experience Composer on EDS?**
It works, but in my experience form-based activities with named decision scopes are more robust, because EDS decorates blocks in JavaScript and VEC selectors can break when block code changes.

**How long should a test run?**
Until it reaches the sample size you calculated before launch, rounded up to whole weeks. Not until it "looks significant". If the calculation says months, the test isn't worth running on that page; make a bolder change or test somewhere busier.

**Will A/B testing hurt my SEO?**
Not if you follow Google's guidance: no cloaking, canonical or `noindex` on variant URLs as appropriate, temporary redirects only, and tests removed when they end.

**Can I use Real-Time CDP audiences with EDS experimentation?**
Not directly. Audiences in the plugin are functions you write in the browser. If your segments live in Experience Platform, Target (or Journey Optimizer) via the Web SDK is the supported path.

## Closing thought

The question is rarely "Target or EDS?". It's "what decision are we trying to make, and what does it need?" A headline test needs a fair split, enough traffic and patience. A personalisation programme needs audiences, governance and a statistics engine. Matching the tool to the decision saves money, performance and a lot of arguments.

My default on EDS is simple: **EDS experimentation for content and layout tests, Target for audience-driven and AI-driven personalisation,** one owner per page, and every result read from unsampled data with a sample size agreed before launch.

If you're weighing Target against EDS experimentation, or trying to get both running cleanly on one site, [get in touch](/contact/).

### References

- [Experimentation](https://www.aem.live/docs/experimentation) (aem.live)
- [Integrating Adobe Target with Edge Delivery Services](https://www.aem.live/developer/target-integration) (aem.live)
- [Operational Telemetry](https://www.aem.live/docs/rum) (aem.live)
- [aem-experimentation plugin and documentation](https://github.com/adobe/aem-experimentation) (Adobe, GitHub)
- [AEM martech plugin](https://github.com/adobe-rnd/aem-martech) (Adobe, GitHub)
- [Target activities guide](https://experienceleague.adobe.com/en/docs/target/using/activities/target-activities-guide) (Adobe Experience League)
- [How can I learn about the statistical calculations used in A/B test activities?](https://experienceleague.adobe.com/en/docs/target/using/reports/statistical-methodology/statistical-calculations) (Adobe Experience League)
- [How long should I run an A/B test?](https://experienceleague.adobe.com/en/docs/target/using/activities/abtest/sample-size-determination) (Adobe Experience League)
- [Auto-Allocate overview](https://experienceleague.adobe.com/en/docs/target/using/activities/auto-allocate/automated-traffic-allocation) (Adobe Experience League)
- [Adobe Analytics for Target (A4T)](https://experienceleague.adobe.com/en/docs/target/using/integrate/a4t/a4t) (Adobe Experience League)
- [Adobe Target connection (Real-Time CDP destination)](https://experienceleague.adobe.com/en/docs/experience-platform/destinations/catalog/personalization/adobe-target-connection) (Adobe Experience League)
- [Manage flicker for personalized experiences using the Web SDK](https://experienceleague.adobe.com/en/docs/experience-platform/web-sdk/personalization/manage-flicker) (Adobe Experience League)
- [A/B testing best practices for Search](https://developers.google.com/search/docs/crawling-indexing/website-testing) (Google Search Central)

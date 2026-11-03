---
layout: post
title: "Personalisation that works: why it matters and how to do it without the creepiness"
seo_title: "Personalisation: Why It Matters and How to Do It Well"
description: "A practitioner's guide to web personalisation: why it matters, the maturity ladder, how to build it, where to run it, privacy, SEO, measurement and mistakes."
date: 2026-11-02 14:10:00 +0530
category: digital-experience
tags: [Personalisation, Digital Experience, Architecture]
---

Most personalisation programmes fail for boring reasons. Not because the idea is wrong, but because the team bought a platform before deciding what to personalise, shipped a flicker-prone script that slowed every page, never ran a holdout, and then couldn't tell whether any of it worked.

This post is the version I'd give a team starting out: **why personalisation matters, a way to think about it, how to build it, where to run it, and where it goes wrong.** I use my own site as a small worked example near the end, because it's the easiest way to show the moving parts without a vendor demo in the way.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **Personalisation is relevance, not decoration.** Showing someone the thing they were already trying to find is the goal. Using their first name in a banner is not.
- **Start with contextual and segment-based rules.** They work for anonymous visitors, need little data, and deliver most of the value. Models come later.
- **Run it as a loop:** signals, profile, decision, experience, measurement, and back again. Without the last step you're guessing.
- **Always have a default,** and keep a **holdout group** so you can prove the lift.
- **Where it runs matters.** Client-side is easy but risks flicker and slower pages. The edge or the server avoids both.
- **Consent and trust are design constraints,** not afterthoughts. First-party data, plain-language explanations and an easy reset beat clever tracking.
- **Personalisation can hurt SEO and performance** if it hides content from crawlers or blocks rendering. It doesn't have to.

## Why personalisation matters

Visitors arrive with a goal and little patience. A generic page makes every visitor do the work of finding their own path, and many won't.

The commercial case is well documented, though numbers vary by survey, so treat them as directional. McKinsey's 2021 consumer research reported that [most consumers expect personalised interactions and get frustrated when they don't receive them](https://www.mckinsey.com/capabilities/growth-marketing-and-sales/our-insights/the-value-of-getting-personalization-right-or-wrong-is-multiplying), and that faster-growing companies draw a larger share of their revenue from personalisation than slower-growing peers. I'd read those figures as a signal of expectation, not a promise of lift: the survey was consumer-facing and US-based, and your own results will depend on your audience and execution.

The practical benefits I see in enterprise work:

- **Shorter paths to the goal.** A returning customer sees their next step. A new prospect sees the proof they need first.
- **Better conversion on the pages that matter,** because the message fits the visitor's stage.
- **Higher content value.** Articles, offers and products reach the people most likely to need them, not just the ones who browse.
- **Cleaner insight.** Treating segments differently forces you to define who they are and what they want, which is useful even before any tooling.

There's a catch, and it's the reason for the rest of this post: **bad personalisation is worse than none.** Wrong guesses, creepy specificity and slow pages all cost trust.

## The personalisation loop

![The personalisation loop: signals, profile, decision, experience, measurement and learning]({{ '/assets/img/blog/personalisation/01-personalisation-loop.svg' | relative_url }}){: width="1200" height="420" loading="lazy" decoding="async"}

Every personalisation system, from a three-line cookie rule to an enterprise decisioning engine, does the same five things:

1. **Collect signals.** Page views, search terms, product views, purchases, campaign source, and consented CRM data.
2. **Build a profile.** Turn raw events into something usable: a segment, an intent, a lifecycle stage.
3. **Decide.** Choose what to show. Rules first; models when you have the data to justify them. Always define a default.
4. **Deliver the experience.** Apply the decision on the web, in email, in the app, or in the sales conversation, consistently and fast.
5. **Measure.** Compare personalised against a holdout group, against the goal you defined at the start.

Then **learn**: keep what wins, retire what doesn't, and refine the signals. Most teams are strong on steps 1 to 4 and skip 5, which is why many programmes can't answer "is it working?"

## The maturity ladder

![The personalisation maturity ladder from contextual to behavioural to predictive]({{ '/assets/img/blog/personalisation/02-maturity-ladder.svg' | relative_url }}){: width="1200" height="480" loading="lazy" decoding="async"}

Treat personalisation as a ladder and climb it one rung at a time.

**1. Contextual.** Where and when the visitor is: location, device, language, referrer, campaign, time of day. It works for **anonymous visitors**, needs no stored profile, and carries the lowest privacy risk. A visitor from a paid campaign sees the message that matches the ad.

**2. Segment-based.** Who the visitor is: industry, role, new or existing customer. A handful of well-defined segments, each with content that fits, usually beats a hundred micro-segments nobody can maintain.

**3. Behavioural.** What this visitor did: the pages they read, the products they viewed, whether they've been before. This is where first-party storage and consent start to matter.

**4. Predictive and one-to-one.** Models choose content or next-best actions for each person. It needs a unified profile, plenty of traffic, and governance. It's powerful when those exist and expensive theatre when they don't.

**Most of the value usually sits on rungs 1 to 3.** I'd rather see a team run six well-measured rules than a model nobody can explain.

## How to do it: a practical sequence

### 1. Start with a decision, not a tool

Write down, for each audience: **who are they, what are they trying to do, what do we want them to do next, and what proof do they need?** If you can't fill that in, no platform will do it for you.

### 2. Pick a small number of high-value moments

Good first candidates:

- the **home page hero** for returning versus new visitors
- **campaign landing pages** that should mirror the ad
- **next-step prompts** on content pages, such as a related article or a relevant case study
- **language and region** selection
- **logged-in states** that surface account actions

Avoid personalising everywhere at once. Every variant is something you must design, write, test and maintain.

### 3. Define your signals and be honest about consent

List the signals you need and ask of each: **is it necessary, do we have a lawful basis, and can we do it without identifying the person?** Contextual and on-device signals are the easiest to defend.

### 4. Write the rules, and the default

A rule is a condition, an audience and a variant, for example "returning visitor whose longest visit was to the certifications page: show that section first". Write the **default experience first**. It's what crawlers, new visitors and everyone who falls outside a rule will see, so it has to stand on its own.

### 5. Choose where it runs

This is the architectural decision that most affects speed, SEO and flicker, so it gets its own section below.

### 6. Measure against a holdout

Reserve a share of eligible visitors who see the default. Compare them with the personalised group on **the goal you named at the start**, not just clicks. Without a holdout you can't separate the effect of personalisation from seasonality, campaigns or a good week.

### 7. Review and retire

Review rules on a schedule. A variant that no longer wins, or that targets a campaign that ended, should be removed. Stale personalisation is a quiet source of broken experiences.

## Where should personalisation run?

![Comparing client-side, edge and server-side personalisation]({{ '/assets/img/blog/personalisation/03-where-to-personalise.svg' | relative_url }}){: width="1200" height="460" loading="lazy" decoding="async"}

The same decision can be applied in three places.

**In the browser.** The page loads the default, a script fetches a decision, and the content is swapped. It's the easiest to add and works on any stack, but it can **flicker** or require hiding the page while the decision arrives. Adobe's own community guidance on a server-rendered app with client-side offers describes exactly this: the default renders first, then the offer replaces it, and the usual workaround is to hide the body until the decision returns, which they describe as a bit of a hack. Moving to server-side delivery is the suggested alternative.

**At the edge.** A CDN rule or worker picks a variant from a cookie, header or geography **before the response leaves the CDN**. No flicker, no extra round trip, and it caches well per variant. The limits are coarse signals and the need for a clear cache-key plan so variants don't leak between visitors.

**On the origin server.** The application renders the personalised page with full access to the profile. It's the richest and the safest for sensitive data, but it's slower and harder to cache.

My rule of thumb: **serve one fast, indexable page to everyone and layer personalisation on top.** Do it at the edge where signals are coarse and the content is shared, on the server where data is sensitive, and in the browser only for modules that aren't critical to the first paint.

### If you run on AEM

- **AEM as a Cloud Service:** Adobe Target and the Experience Platform Web SDK are the standard route for client-side personalisation, with Experience Fragments as reusable variants. Plan the Dispatcher and CDN cache keys before you add variants.
- **Edge Delivery Services:** the documented Adobe Target integration applies decisions **after blocks are decorated**, so changes can shift content, and the round trip happens in the eager phase, so it affects LCP. Adobe's own measurements show roughly 1.3 seconds added to mobile LCP on the first call, and about 0.1 seconds on later calls, so enable it **only on pages that need it**, flagged through page metadata. Also check the native [experimentation capabilities](https://www.aem.live/docs/experimentation) first, which are lighter for tests.

If you're deciding between the two delivery models, my [EDS versus traditional AEMaaCS post]({{ '/blog/2026/11/aem-edge-delivery-services-vs-traditional-aemaacs/' | relative_url }}) covers the wider trade-offs.

## Personalisation, privacy and trust

Trust is the constraint everything else has to fit inside.

- **Prefer first-party, on-device signals.** If the decision can be made in the visitor's browser from their own visits, nothing needs to leave the device.
- **Collect the minimum.** Don't store what you won't use.
- **Respect browser signals.** Honouring Global Privacy Control and Do Not Track is a cheap, visible way to show respect.
- **Explain it in plain language.** A small "Why am I seeing this?" note builds more trust than any amount of cleverness.
- **Make reset easy.** If a visitor can clear what you know in one click, they're far more comfortable.
- **Avoid creepy specificity.** "Welcome back, you were reading about X" feels helpful. "We noticed you looked at Y at 2 a.m." doesn't.
- **Follow the law that applies to you,** such as GDPR, ePrivacy rules and India's DPDP Act, and take legal advice for your situation. I'm describing design principles here, not legal guidance.

## Personalisation and SEO

Personalisation and search can coexist if you keep to a few rules.

- **Crawlers need a complete default.** Googlebot should get the same core content a typical visitor sees. If key content only appears after a personalisation script runs, it may not be indexed.
- **Don't confuse personalisation with cloaking.** Google's [spam policies](https://developers.google.com/search/docs/essentials/spam-policies) define cloaking as presenting different content to users and search engines **with the intent to manipulate rankings and mislead users**. The policy doesn't mention personalisation or geolocation, so the safe design is to vary supporting content for people while keeping the primary content the same for everyone.
- **Keep variants out of the index.** Personalised states shouldn't create separate crawlable URLs unless they're genuinely distinct pages.
- **Don't let it hurt Core Web Vitals.** Blocking rendering until a decision arrives hurts LCP, and content that jumps hurts CLS. Both are measured in field data. I cover the thresholds in [what actually matters in SEO]({{ '/blog/2026/11/what-actually-matters-in-seo/' | relative_url }}).

## A worked example: personalisation on this site

This site has a small personalisation layer, and it's a useful illustration because it follows every principle above.

- **Signals:** which pages a visitor spends time on and how far they scroll in articles. All of it is stored in the browser's own storage, and nothing is sent anywhere.
- **Decision:** for a returning visitor, simple rules pick one message, most specific first: continue an unfinished article, highlight new posts since the last visit, or surface the section the visitor spent most time on.
- **Experience:** the matching card is moved up and labelled "Picked for you", with a small welcome-back note. The page layout doesn't shift when the note appears.
- **Default:** a first-time visitor, a crawler, and anyone who's opted out all see the standard page.
- **Privacy:** it honours Global Privacy Control and Do Not Track, has a "Why am I seeing this?" explanation, and a one-click reset.
- **Measurement:** about one in ten visitors is a holdout who see the default, and an anonymous event records which variant was shown, so the effect can be compared.

None of that needs a platform. It needs a clear decision and a willingness to measure.

## Common mistakes

- **Buying the platform first.** Tools don't supply the strategy, content or measurement.
- **No default.** The fallback is what most visitors, and every crawler, will see.
- **No holdout.** You can't prove lift without a comparison group.
- **Too many segments.** Each one needs content, testing and upkeep. Start with three to five.
- **Personalising the wrong things.** A first name in a banner is rarely the problem your visitors have.
- **Ignoring performance.** A decision that blocks rendering costs more than it earns.
- **Treating consent as a banner.** It's a design constraint on what data you can use at all.
- **Letting rules go stale.** Expired campaigns and old offers quietly damage the experience.

## The checklist

**Strategy**

- Each audience has a stated goal, next step and proof point.
- You've picked **a few high-value moments**, not the whole site.
- Success is defined by a **business goal**, not just clicks.
{: .checklist}

**Data and privacy**

- Every signal is **necessary, lawful and minimal**.
- Browser privacy signals are respected.
- Visitors can see **why** and can **reset**.
{: .checklist}

**Build**

- A complete **default experience** exists for everyone and for crawlers.
- The decision runs at the **edge or server** where possible.
- It doesn't block first paint or shift the layout.
{: .checklist}

**Measure**

- A **holdout group** is in place.
- Results are reviewed on a schedule, and losing variants are retired.
{: .checklist}

## Closing thought

Good personalisation feels like a helpful colleague who remembers what you were doing. Bad personalisation feels like being followed around a shop. The difference is rarely the technology. It's whether the team chose a clear purpose, respected the visitor, kept the default strong and measured the result.

Start small, prove it, then climb.

If you're planning personalisation on AEM or Edge Delivery Services and want the architecture, privacy and performance trade-offs reviewed before you build, [get in touch]({{ '/contact/' | relative_url }}).

### References

- [The value of getting personalization right or wrong is multiplying](https://www.mckinsey.com/capabilities/growth-marketing-and-sales/our-insights/the-value-of-getting-personalization-right-or-wrong-is-multiplying) (McKinsey, 2021)
- [Integrating Adobe Target with Edge Delivery Services](https://www.aem.live/developer/target-integration) (aem.live)
- [Experimentation](https://www.aem.live/docs/experimentation) (aem.live)
- [Personalization overview](https://experienceleague.adobe.com/en/docs/experience-manager-learn/cloud-service/personalization/overview) (Adobe Experience League)
- [Spam policies for Google web search](https://developers.google.com/search/docs/essentials/spam-policies) (Google Search Central)
- [Understanding Core Web Vitals and Google search results](https://developers.google.com/search/docs/appearance/core-web-vitals) (Google Search Central)
- [Next.js Server Side Rendering: Adobe Target flickering issue](https://experienceleaguecommunities.adobe.com/adobe-target-14/next-js-server-side-rendering-adobe-target-flickering-issue-105049) (Adobe Experience League Community)

---
layout: post
title: "How to estimate an AEM project, and why estimates go wrong"
seo_title: "How to Estimate an AEM Project: A Practical Method"
description: "A practical method for estimating AEM projects: drivers, a component complexity model, PERT, contingency, a worked example and why estimates go wrong."
date: 2026-11-03 19:00:00 +0530
category: architecture
tags: [AEM, Estimation, Delivery, Architecture]
---

Most AEM programmes I've been asked to rescue didn't fail because the team couldn't build components. They failed because someone committed to a number in week zero, before anyone knew how many components there really were, whether SSO was federated, or who was going to move 2,000 pages of content. The build was fine. The estimate was fiction.

I've estimated AEM work from both sides: as the architect writing the RFP response, and as the delivery lead who inherited someone else's number six months later. The pattern repeats. The developer effort is usually close. Everything around it, such as content, environments, identity, testing, UAT and the people who keep the project moving, is missing or squeezed.

This is the method I use now: not a formula to trust blindly, but a way of building a number you can defend, explain and revise.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **Estimate the drivers, not the pages.** Unique components and their complexity, templates, integrations, content migration, languages, environments and non-functionals drive AEM effort. Page count mostly drives content work.
- **Build bottom-up, check top-down, then compare with past projects.** If the three disagree, the disagreement is the most useful thing you'll learn.
- **Use ranges.** Three-point estimates (PERT) and a risk-based buffer beat a single number with a flat 10% on top.
- **The cone of uncertainty is real.** At RFP stage an estimate can plausibly be off by a factor of four either way. Commit in phases: fund discovery, then commit to build.
- **Coding is less than half the budget.** In the illustrative example below it's 42%. Delivery management, QA, content, architecture and launch work make up the rest.
- **AI coding assistants change the coding slice, not the whole project.** The evidence is mixed, so measure your own team's speed for two sprints before you discount anything.

## Why AEM estimates go wrong

Three forces work against every estimator, and none of them is specific to AEM.

**The cone of uncertainty.** Barry Boehm described it in 1981 as a "funnel curve", and Steve McConnell popularised it as the cone of uncertainty. At the initial concept stage, the eventual effort can plausibly land anywhere from 0.25× to 4× the estimate. The range narrows as you approve a product definition, finish requirements and complete the design. The catch is that the cone doesn't narrow by itself. It narrows because you make decisions. A project that keeps changing scope stays wide.

**The planning fallacy and Hofstadter's law.** Kahneman and Tversky named the planning fallacy: we predict our own task durations optimistically even when similar tasks overran. Buehler, Griffin and Ross showed it experimentally in 1994. Hofstadter put it more memorably in *Gödel, Escher, Bach*: it always takes longer than you expect, even when you take Hofstadter's law into account.

**Strategic misrepresentation.** Bent Flyvbjerg's work on large projects adds the uncomfortable part: some estimates are low on purpose, because low numbers win bids and budgets. In agency land this shows up as "we'll sort it out in change requests". His remedy, **reference class forecasting**, is to take the "outside view": look at how comparable past projects actually turned out, and adjust from there rather than from your own detailed plan.

![The cone of uncertainty mapped to AEM project milestones, and the effort breakdown of an illustrative mid-size AEM project]({{ '/assets/img/blog/how-to-estimate-an-aem-project/01-cone-and-composition.svg' | relative_url }}){: width="1200" height="620" loading="lazy" decoding="async"}

The left side is why I won't give a single number at RFP stage. The right side is why the number surprises people: coding is less than half of it.

## The estimate drivers

Before I estimate anything, I fill in a driver sheet. Every row either changes the number or becomes an assumption.

| Driver | What to count or decide | Why it matters |
|---|---|---|
| Unique components or blocks | Count by complexity tier, after de-duplicating variants | The core of build effort |
| Templates | Page templates, policies, structure | Usually small, but each adds QA and authoring setup |
| Integrations | Each external system, direction, auth method, environments available | The riskiest line, because you depend on someone else's team |
| Content migration | Page count, asset count, automated vs manual split, who does it | The most commonly forgotten line |
| MSM and localisation | Languages, markets, live copy vs language copy, translation vendor | Multiplies content, testing and authoring setup |
| Personalisation and analytics | Data layer, tag management, Target or experiments | Data layer work touches every component |
| Authoring and workflow | Approval workflows, permissions, author roles, editor choice | Drives configuration and training |
| Environments and platform | AEMaaCS programmes, environments, advanced networking, CDN, domains | Lead times outside your control |
| Non-functionals | Performance targets, security reviews, uptime, load | Testing effort and remediation |
| Accessibility | Target (usually WCAG 2.2 AA), audit approach | Cheap if built in, expensive if retrofitted |
| SEO and redirects | URL changes, redirect map size, sitemap, structured data | A launch blocker if missed |
| Testing | Unit, integration, regression, cross-browser, UAT support | 25–40% of dev effort in my experience |
| Launch and hypercare | Cut-over, DNS, rehearsal, weeks of hypercare | Always longer than the plan says |

A 20,000-page site built from 25 components can cost less to build than a 500-page site with 60 bespoke ones. Pages drive content migration, QA sampling and redirects, not component development.

## A component complexity model

Components are where most estimators start, so it's worth getting the tiers right. The ranges below are **from my own delivery history** on AEM as a Cloud Service with Core Components and HTL. They include back-end and front-end development, dialog or model definition, unit tests, accessibility built in and code review. They exclude QA and design. Your numbers will differ, and you should replace mine with yours as soon as you have them.

| Tier | Typical examples | Characteristics | Dev days (my experience) |
|---|---|---|---|
| Simple | Text, image, button, quote, divider, simple teaser | Extends a Core Component, few fields, no logic | 2–4 |
| Medium | Card list, accordion, tabs, hero with variants, video, content fragment display | Multifields, variants, responsive behaviour, some JavaScript, light Sling Model logic | 5–8 |
| Complex | Faceted search, store locator, forms with CRM submission, product listing, interactive calculators | API calls, state, error handling, caching decisions, performance concerns | 10–20+ |

Three rules keep this honest:

1. **Count unique components after consolidation.** A design system with "Hero A", "Hero B" and "Hero C" is usually one component with variants. I've cut 60-component inventories to 35 just by doing this in discovery.
2. **Anything touching an external system is complex**, however simple the UI looks. The UI is the easy part.
3. **Global components are special.** Header, footer and navigation look like one component each but often behave like three: mega-menu, mobile navigation, language switcher, and MSM inheritance rules. I estimate them individually.

## Bottom-up, top-down and the outside view

I build three estimates and compare them. This is triangulation, and it's the single habit that has saved me most often.

### Bottom-up

Count the drivers, apply the complexity model and add the non-component work. That gives ideal developer effort. Then convert to capacity: meetings, reviews and environment issues eat time, so I use a focus factor of around 0.75–0.8 on a well-run team, lower on a new client.

### Top-down

Take the developer effort and apply ratios for everything else. These are ratios I've seen hold across many AEM programmes, as a sense check rather than a law:

| Role or activity | Ratio I use as a sense check |
|---|---|
| QA and testing | 25–40% of development effort |
| Project or delivery management | 10–15% of total effort |
| Business analysis | 5–10% of total effort |
| Solution architecture | 5–8% of total effort |
| Hypercare | 2–4 weeks of a reduced team |

If your bottom-up number implies QA at 10% of development, the bottom-up number is wrong, not the ratio.

### The outside view

Finally, ask what the last three comparable projects actually cost: not their estimates, their actuals. If your new number is 40% cheaper than every comparable, you need a specific reason, such as smaller scope or Edge Delivery Services instead of a full publish tier. "This client is more organised" is not a reason. This is reference class forecasting in practice, and it needs honest actuals from past projects. Start recording them.

## Three-point estimates, PERT and contingency

### PERT for line items

For anything uncertain, I ask for three numbers: optimistic (O), most likely (M) and pessimistic (P). PERT combines them into an expected value and a rough spread:

```text
Expected (E)       = (O + 4M + P) / 6
Standard deviation = (P - O) / 6

Example: store locator component
O = 8 days, M = 12 days, P = 25 days
E  = (8 + 48 + 25) / 6 = 13.5 days
SD = (25 - 8) / 6     ≈ 2.8 days
```

Notice that the expected value is higher than the most likely value. Estimates are skewed: things can go a little better than planned, or a lot worse. That asymmetry is the planning fallacy in one formula.

### Contingency from risks, not a flat percentage

A flat 10–15% contingency is better than nothing, but it can't be explained. I prefer a short risk register where each risk carries a probability and an impact, and the buffer is the sum of the expected values:

| Risk | Probability | Impact | Buffer |
|---|---|---|---|
| SSO federation with the client's IdP delayed | 30% | 3 weeks of blocked author testing | ~1 week |
| CRM API sandbox unavailable until late | 40% | 4 dev-weeks of rework | ~1.6 weeks |
| Design not final for complex components | 50% | 3 dev-weeks | 1.5 weeks |

This gives the client a reason for every week of buffer, and a way to remove it: fix the risk and the buffer goes.

## The things everyone forgets

This list comes from post-mortems, mostly mine.

- **Content entry and migration.** Who moves the content, using what, and who checks it? Even with scripted import, someone has to clean up the pages the script can't handle.
- **Author training and enablement.** Training material, sessions per market, a sandbox with sample content, and office hours after launch.
- **Adobe provisioning lead times.** Contract to Admin Console organisation, product profiles, Cloud Manager programme and environments. Adobe provisions purchased environments during onboarding, but the business steps around it, such as the contract, the named system administrator and access requests, have taken weeks on projects I've run.
- **IMS and SSO.** Authors log in through Adobe IMS, usually federated with Entra ID or Okta. The client's identity team has its own queue.
- **Networking.** If AEM calls a back-end system that only accepts known IPs, you need advanced networking configured in Cloud Manager and an allow-list change on the client's firewall. Adobe's side is quick. The firewall change request is not.
- **DNS, CDN and certificates.** Domain verification, certificates, DNS changes owned by a different team, and any customer-managed CDN in front of Adobe's.
- **Dispatcher.** Caching rules, filters, redirects and cache invalidation. Small, fiddly and always underestimated.
- **Performance testing, UAT and defect fixing.** Load test on stage with production-sized content. UAT is a phase, not a meeting: budget developers to fix what it finds.
- **Design handoff gaps.** Missing states (empty, error, loading), missing breakpoints and no authoring guidance for designers' intentions.
- **Licence and Adobe dependencies.** Which products are licensed, Adobe support turnaround, and features that need Adobe to enable them.

For a migration from AEM 6.5, most of these get worse, not better; I covered that in [the AEMaaCS migration playbook](/blog/2026/11/aem-on-premise-and-managed-services-to-aem-as-a-cloud-service-migration/).

## A worked example

Here's a worked estimate for a fictional mid-size site. **It is illustrative**: the numbers come from my complexity model and ratios above, not from a real client. Use it to see the shape, not to price your project.

**Scope:** corporate marketing site on AEM as a Cloud Service with Core Components. 30 unique components (12 simple, 12 medium, 6 complex), 8 templates, 4 integrations (site search, CRM forms, analytics data layer, a product feed), about 2,000 pages across 5 languages, WCAG 2.2 AA, redesign included in a separate design budget.

### Bottom-up development effort

| Item | Count | Dev days each (M) | Dev days |
|---|---|---|---|
| Simple components | 12 | 3 | 36 |
| Medium components | 12 | 6.5 | 78 |
| Complex components | 6 | 15 | 90 |
| Templates and policies | 8 | 2 | 16 |
| Integrations | 4 | mixed | 55 |
| Foundations: project setup, design tokens, Dispatcher, CDN rules, pipelines | | | 30 |
| MSM and translation setup | | | 15 |
| **Total** | | | **320 days ≈ 64 ideal dev-weeks** |

At a focus factor of 0.8, 64 ideal weeks needs about 80 weeks of developer capacity. Two back-end and two front-end developers over an 18-week build give 72 weeks, plus roughly half the tech lead's time: about 81.

### Team and timeline

Timeline: 4 weeks discovery, 18 weeks build (nine two-week sprints), 4 weeks stabilisation and UAT, 4 weeks launch and hypercare. **30 weeks in total.**

| Role | Allocation | Person-weeks |
|---|---|---|
| Delivery lead / PM | 1.0 throughout | 30 |
| Solution architect | 1.0 discovery, 0.5 build and UAT, 0.25 hypercare | 16 |
| AEM tech lead | 0.5 discovery, 1.0 build and UAT, 0.5 hypercare | 26 |
| Business analyst | 1.0 discovery, 0.75 build, 0.5 UAT | 20 |
| AEM back-end developers | 2 × build, plus UAT defect fixing | 40 |
| Front-end developers | 2 × build, plus UAT defect fixing | 40 |
| QA engineers | 1.5 × build, UAT and hypercare | 35 |
| DevOps / platform | Spikes for pipelines, networking, CDN, go-live | 8 |
| Migration developer | Import scripts and validation | 8 |
| Content editors | Manual migration of ~30% of pages, content QA | 10 |
| UX / design support | 0.5 through discovery and build | 11 |
| Accessibility audit | Specialist audit and retest | 3 |
| Performance testing | Load test on stage | 2 |
| Author training | Materials, sessions per market | 3 |
| **Total (most likely)** | | **252** |

Now the sense checks. QA is 35 against 106 weeks of development roles: 33%. PM is 12% of the total, BA 8%, architecture 6%. All within the ranges I expect.

### The range

With an optimistic total of around 210 person-weeks and a pessimistic one of around 340, PERT gives:

```text
E  = (210 + 4 × 252 + 340) / 6 ≈ 260 person-weeks
SD = (340 - 210) / 6           ≈ 22 person-weeks
```

I'd present this as **250–300 person-weeks, about 30–34 weeks elapsed**, with the risk register explaining the upper end. Strictly, you should combine PERT values per line item rather than for the total, but at proposal stage the simplification is fine as long as you say so.

## How Edge Delivery Services changes the estimate

If the same site is built on Edge Delivery Services, the shape of the estimate changes. I compared the platforms in [EDS vs traditional AEMaaCS](/blog/2026/11/aem-edge-delivery-services-vs-traditional-aemaacs/); here's what it means for numbers, **in my experience**:

- **Blocks are cheaper than components.** Plain JavaScript and CSS, no Sling Models, no HTL, no clientlibs. On projects I've run, simple and medium blocks took noticeably less time than the equivalent AEM components. Complex, API-driven blocks less so: the integration is still the hard part.
- **Back-end Java mostly disappears.** So does most Dispatcher work. Server-side logic moves to APIs, an edge worker or App Builder, which you need to estimate separately.
- **Content modelling depends on the editor.** Document-based authoring and the Universal Editor need different modelling work. Decide early.
- **Content migration can be scripted with Adobe's Importer,** which turns existing pages into documents using transformation scripts you write and refine. It's a developer tool, so budget a developer.
- **Performance becomes a budget, not a phase,** enforced on every block during the build.

What doesn't change: integrations, content entry, translation, UAT, training, DNS and the human lead times.

## How AI coding assistants change estimates in 2026

Every client now asks how much AI takes off the estimate. The honest answer is: less than the hype, more than zero, and it depends on your team. Here's the evidence I rely on.

| Study | What it measured | Result |
|---|---|---|
| METR RCT (July 2025) | 16 experienced open-source developers, 246 real tasks in their own repositories | 19% *slower* with AI allowed. They expected a 24% speed-up and believed afterwards they'd been 20% faster |
| METR follow-up (Feb 2026) | 57 developers, 800+ tasks, late-2025 tools | Speed-ups of 18% and 4%, both with confidence intervals including zero. METR calls the data unreliable (developers refused to work without AI) and thinks real speed-ups are likely larger |
| Google RCT (Paradis et al., 2024) | 96 Google engineers on one enterprise-grade task | About 21% faster, with a large confidence interval |
| Cui et al. (Management Science) | Field experiments with nearly 5,000 developers at Microsoft, Accenture and a Fortune 100 firm | About 26% more completed tasks for developers using Copilot, with bigger gains for less-experienced developers |
| DORA 2024 | Survey of software professionals | Higher AI adoption associated with an estimated 1.5% drop in delivery throughput and 7.2% drop in delivery stability |
| DORA 2025 | Survey of nearly 5,000 professionals | Positive relationship with throughput, still negative with stability. "AI doesn't fix a team; it amplifies what's already there" |

Two lessons. Perception is unreliable: METR's developers felt faster while being slower, so don't let enthusiasm set the discount. And the gains show up in coding, which is only part of the budget.

My practical rule:

1. **Apply AI adjustments only to development line items,** never to content entry, UAT, provisioning, SSO or stakeholder time.
2. **Do the arithmetic.** If coding is 42% of the budget and AI makes it 20% faster, the project saves about 8%, before any extra review or rework.
3. **Measure, then adjust.** Estimate without AI, track velocity for the first two sprints, then re-forecast.
4. **Expect bigger gains on repetitive work.** Scaffolding components and blocks, unit tests and import scripts benefit most; I've seen much larger gains on refactoring-heavy cloud migrations. Integration debugging and environment issues benefit least.
5. **Keep QA intact.** DORA's stability finding is a reason to keep testing effort where it is, not to trim it.

## Communicating the estimate

How you present a number matters as much as the number.

**Always give a range.** A single figure gets remembered as a promise. A range with assumptions gets remembered as an estimate.

**Keep an assumptions log** and put it in the proposal, not an appendix nobody reads:

```yaml
assumptions:
  - id: A01
    text: "30 unique components after consolidation; variants are authorable options"
    impact_if_wrong: "+3-15 dev days per additional component"
  - id: A02
    text: "Client provides CRM sandbox with test data by sprint 3"
    impact_if_wrong: "Forms integration slips; ~1.6 weeks risk buffer held"
  - id: A03
    text: "Client content team migrates ~600 pages manually, agency supports"
    impact_if_wrong: "+10 person-weeks of content editors"
  - id: A04
    text: "Single IdP federated with Adobe IMS by end of discovery"
    impact_if_wrong: "Author testing and training blocked"
```

**Commit in phases.** I ask for a paid discovery of 3–4 weeks, then commit to build with a much narrower range. This walks the client down the cone of uncertainty instead of pretending it doesn't exist. What I do in those weeks is in [the solution architect's first two weeks](/blog/2026/11/solution-architect-first-two-weeks/).

**Re-forecast openly** after two or three sprints. Clients forgive changes they see early, not surprises at UAT.

## Red flags in RFPs

These make me widen the range or ask questions before pricing:

- **"Approximately 50 components" with no designs.** The real count could be 30 or 90.
- **Fixed price, fixed scope, fixed date,** with discovery included in the build.
- **"Content migration: client responsibility"** with no named team or tool.
- **Many languages, no localisation model.** Live copies or language copies? Who translates? See [MSM and language copies](/blog/2026/11/aem-msm-language-copies-cloud-service/).
- **Integrations listed by name only,** with no API documentation, environments or owners.
- **"Accessibility compliant" without a standard.** And no budget for an audit. [Building it into components](/blog/2026/11/accessibility-on-aem-fix-the-component-not-the-page/) is cheaper than fixing pages later.
- **Go-live date set before contract signature,** with Adobe licences not yet signed.
- **No product owner named on the client side.** Decisions will be slow, and slow decisions keep the cone wide.

## FAQ

**How accurate should an AEM estimate be at RFP stage?**
Not very. Per McConnell's cone, early estimates can be off by a factor of four either way. Give a range, list your assumptions and propose a paid discovery to narrow it.

**What contingency percentage should I add?**
I'd rather show a risk register than a percentage. If a client insists on a figure, 15–25% at the end of discovery is what I've found defensible, more before it.

**Is a 2,000-page site "medium"?**
Page count alone doesn't tell you. Unique components, integrations and languages decide build effort. Pages decide content and redirect work.

**Can AI let us quote less in 2026?**
Somewhat, on the coding slice, once you've measured it on your team. Controlled studies range from a 19% slowdown to a 20–26% speed-up depending on developers and tasks, so don't discount the whole project.

**Is EDS always cheaper to build?**
Usually for the front end, in my experience, and there's no Dispatcher or publish-tier work. But integrations, content and organisational work cost the same.

## Closing thought

Good AEM estimates aren't about clever spreadsheets. They come from counting the right things, being honest about what you don't know yet, and remembering that coding is less than half of the work. Triangulate, use ranges, keep an assumptions log and commit in phases.

The estimates that hurt me most were given too early, as a single number, to someone who needed it to be small. The ones that held were the ones I could explain line by line.

Need a second opinion on an AEM estimate or an RFP before you commit? [Get in touch](/contact/).

### References

- [The Cone of Uncertainty](https://www.construx.com/blog/the-cone-of-uncertainty/) (Construx)
- [Cone of uncertainty: history and caveats](https://en.wikipedia.org/wiki/Cone_of_uncertainty) (Wikipedia)
- [From Nobel Prize to Project Management: Getting Risks Right](https://arxiv.org/abs/1302.3642) (Bent Flyvbjerg, Project Management Journal, via arXiv)
- [Exploring the "planning fallacy": why people underestimate their task completion times](https://doi.org/10.1037/0022-3514.67.3.366) (Buehler, Griffin and Ross, Journal of Personality and Social Psychology)
- [Measuring the impact of early-2025 AI on experienced open-source developer productivity](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/) (METR)
- [We are changing our developer productivity experiment design](https://metr.org/blog/2026-02-24-uplift-update/) (METR)
- [How much does AI impact development speed? An enterprise-based randomized controlled trial](https://arxiv.org/abs/2410.12944) (Paradis et al., Google, via arXiv)
- [The effects of generative AI on high-skilled work: evidence from three field experiments with software developers](https://pubsonline.informs.org/doi/10.1287/mnsc.2025.00535) (Cui et al., Management Science)
- [Announcing the 2024 DORA report](https://cloud.google.com/blog/products/devops-sre/announcing-the-2024-dora-report) (Google Cloud)
- [Announcing the 2025 DORA report](https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report) (Google Cloud)
- [Onboarding journey for AEM as a Cloud Service](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/onboarding/journey/overview) (Experience League)
- [Configuring advanced networking for AEM as a Cloud Service](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/security/configuring-advanced-networking) (Experience League)
- [Bulk importing using the Importer](https://experienceleague.adobe.com/en/docs/experience-manager-learn/sites/document-authoring/how-to/bulk-importing-using-importer) (Experience League)

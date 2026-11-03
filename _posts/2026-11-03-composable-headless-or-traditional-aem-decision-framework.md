---
layout: post
title: "Composable, headless or traditional AEM: a decision framework for CTOs"
seo_title: "Composable vs Headless vs Traditional AEM: CTO Framework"
description: "A practical framework for choosing traditional AEM, hybrid, headless, Edge Delivery or a composable MACH stack: scoring matrix, scenarios and anti-patterns."
date: 2026-11-03 19:20:00 +0530
category: architecture
tags: [AEM, Headless, Composable, Architecture]
---

At some point in almost every platform conversation I'm in, someone puts up a slide with "MACH" on it. Sometimes it's a vendor, sometimes it's a newly hired head of engineering who has done it before, and sometimes it's a board member who read that monolithic suites are dead. The question that follows is always some version of: *should we stay on AEM, go headless, or go fully composable?*

It's the right question asked in the wrong way. "Composable", "headless" and "traditional" aren't three products on a shelf. They're positions on a spectrum of how much of your stack you decouple, and how much integration work you agree to own as a result. Edge Delivery Services makes it more confusing still, because it doesn't sit neatly anywhere on that spectrum.

This post is the framework I use with CTOs and enterprise architects to make that decision on evidence rather than fashion. It's AEM-literate because that's my background, but it's deliberately honest about when AEM is not the answer.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **These are architectures, not products.** Coupled, hybrid, headless and composable describe how far you separate content, presentation and capabilities. AEM can play in the first three, and as one component of the fourth.
- **Edge Delivery Services is its own thing.** It feels coupled to authors and is decoupled in delivery, but it is not headless: it serves pages, not a content API for apps.
- **Composable carries a tax.** Every extra vendor adds integration code, orchestration, contracts, skills and an operating model. Licence savings are often eaten by the team you need to run it.
- **Decide on eleven dimensions, weighted for your organisation:** channels, authoring, team skills, time to market, performance, personalisation, governance, integration landscape, vendor count, lock-in and existing investment.
- **The most expensive mistakes are anti-patterns, not wrong products:** headless for a brochure site, composable without a platform team, and "lift and shift" to headless.
- **Migrate with the strangler pattern.** Pick one channel or section, route it at the CDN, prove it, then expand. Big-bang re-platforms are where budgets go to die.

## Define the terms before you debate them

Half the arguments I referee are two people using the same word for different things. Here's the vocabulary I insist on.

![The architecture spectrum from coupled to hybrid to headless to composable, with Edge Delivery Services placed off the main axis]({{ '/assets/img/blog/composable-headless-or-traditional-aem-decision-framework/01-architecture-spectrum.svg' | relative_url }}){: width="1200" height="590" loading="lazy" decoding="async"}

### Coupled (traditional AEM Sites)

One platform manages content **and** renders the page. In AEM as a Cloud Service that's Author, the Publish tier running HTL and Sling Models, the Dispatcher and the CDN. Authors work in the Page Editor or the Universal Editor, with editable templates, component policies, Multi Site Manager and workflows. You get the strongest governance and the fewest vendors, and you need Java and AEM back-end skills to build on it.

### Hybrid (CMS edits, a JavaScript app renders)

The CMS still owns content, preview and in-context editing, but a separate front-end application renders some or all of the experience. In AEM this used to mean the **SPA Editor**. Adobe deprecated it in release 2025.01: existing implementations stay supported for P1/P2 fixes and security issues, but there are no new features, and Adobe recommends the **Universal Editor** for new projects.

The Universal Editor is the hybrid story in 2026. Adobe describes it as compatible with "virtually any architecture (SSR, CSR), web framework (Next.js, React, Astro, etc.), and hosting models". You instrument your app so authors can click and edit content in place, while your front-end team keeps its own stack and hosting.

### Headless

The CMS delivers structured content as JSON and knows nothing about pages. In AEM that means **Content Fragments**, delivered through:

- **GraphQL persisted queries**, which Adobe recommends because they "can be cached at the Dispatcher and Content Delivery Network (CDN) layers";
- the **AEM REST OpenAPI for Content Fragment Delivery**, described as "a HTTP REST alternative to the AEM GraphQL API", available on Preview and Publish and enabled through a support request.

The front end owns routing, rendering, SEO metadata, sitemaps and preview. That last one surprises teams every time.

### Edge Delivery Services: a different model

EDS doesn't fit the axis, and I think vendors and partners do customers a disservice by pretending it does. To authors it **feels coupled**: they author pages in the Universal Editor, Document Authoring or Word and Google Docs, and they publish pages. To developers it's **decoupled delivery**: front-end-only blocks in GitHub, pre-rendered HTML served from the edge, no Publish tier. But it is **not headless**: it delivers web pages, not a content API for a mobile app or a kiosk. I covered the delivery trade-offs in detail in [Edge Delivery Services vs traditional AEMaaCS](/blog/2026/11/aem-edge-delivery-services-vs-traditional-aemaacs/), so I won't repeat them here.

### Composable and MACH

Composable means assembling your digital experience stack from **best-of-breed services**, each replaceable: a headless CMS (Contentful, Sanity, Storyblok, Contentstack or AEM itself), a commerce engine, search, DAM, personalisation, and a front end typically on Next.js hosted on Vercel or Netlify. The **MACH Alliance**, a not-for-profit industry body, frames this as Microservices, API-first, Cloud-native SaaS and Headless.

Note the subtle point: **headless is a property of one component; composable is a property of the whole estate.** You can run headless AEM inside a suite strategy, and you can run a composable estate where AEM is the content service.

## The industry reality check

Before scoring anything, it's worth separating the market narrative from the evidence.

**Analysts haven't declared suites dead.** In the 2025 Gartner Magic Quadrant for Digital Experience Platforms (published January 2025, the latest edition I could verify), the Leaders were Adobe, Optimizely and Acquia: suite vendors that have added composable options. API-first vendors such as Contentstack and Uniform were placed as Visionaries, with Gartner crediting strengths such as "composable flexibility". My reading: the market is converging. Suites are opening up, and composable vendors are adding the orchestration and visual editing that suites always had.

**MACH adoption is real, but read the source.** The MACH Alliance's own annual research (its fourth survey covered 551 IT decision makers at enterprises with 5,000+ employees) reported that 85% saw clear evidence of ROI. It's a useful signal, but it's research commissioned by an advocacy body and surveys organisations that already chose MACH. The same research named education, internal resistance and reliance on vendors as barriers, which matches what I see.

**The composable tax is the part slides leave out.** In my experience the costs shift rather than disappear:

| Cost line | Suite or AEM-centric | Composable |
|---|---|---|
| Licences | Fewer, larger contracts | Many smaller contracts, often usage-based |
| Integration | Mostly pre-built | Yours: APIs, webhooks, orchestration, retries |
| Preview and visual editing | Built in | Assembled, often with an extra product |
| Operations | One vendor's SLA | Many SLAs; incidents cross vendor boundaries |
| Skills | Platform specialists | Strong platform and front-end engineering team |
| Vendor management | One or two relationships | One per capability, plus renewals and roadmaps |
| Security and compliance | One assessment | One per vendor, plus your integration layer |

None of this makes composable wrong. It makes it an **operating model decision**, not a technology decision.

## The decision framework: eleven dimensions

These are the dimensions I score, with the question I actually ask in the workshop.

| Dimension | The question to ask |
|---|---|
| **Channels** | Is the web the product, or one of many channels (apps, screens, voice, partners)? |
| **Authoring** | Do marketers need in-context editing and true preview, or are forms fine? |
| **Team capability** | Do you have Java/AEM skills, strong JavaScript skills, or neither in-house? |
| **Time to market** | Do you need to launch in months, and how often do you ship afterwards? |
| **Performance and SEO** | Is organic search a top-three acquisition channel? |
| **Personalisation** | Segment-level, or one-to-one decisions at request time? |
| **Governance and compliance** | Regulated content, approvals, audit, accessibility obligations, many markets? |
| **Integration landscape** | How many systems (PIM, commerce, CRM, search, DAM) must the experience talk to? |
| **TCO and vendor count** | How many contracts and support boundaries can procurement and ops absorb? |
| **Lock-in and exit cost** | How portable are your content model, code and data if you leave? |
| **Existing investment** | What do you already own, licence and know how to run? |

A few notes from the field on the ones teams get wrong.

**Channels.** "Omnichannel" in a strategy deck often means "website plus a mobile app that shows three articles". That doesn't need a composable estate. It needs a handful of Content Fragments behind a persisted query.

**Authoring.** Marketers rarely say "we need in-context editing" in requirements. They say it, loudly, three months after go-live. Always show authors the real editing experience for each option before deciding. I've written more about this in [Universal Editor vs document-based authoring](/blog/2026/11/universal-editor-vs-document-based-authoring/).

**Performance and SEO.** Headless doesn't hurt SEO by itself, but client-side rendering does, and AI crawlers that don't execute JavaScript are less forgiving still. If you go headless, server-side rendering or static generation is not optional. See [what actually matters in SEO](/blog/2026/11/what-actually-matters-in-seo/).

**Personalisation.** Segment-level personalisation works on every option. Request-time, one-to-one decisions need an edge or server layer and a decisioning engine, which is architecture you design whichever way you go. My [personalisation post](/blog/2026/11/personalisation-why-it-matters-and-how-to-do-it-well/) covers the trade-offs.

**Lock-in.** Composable doesn't remove lock-in; it spreads it. Your content model and your integration code are the real lock-in, and they're yours either way. Ask how you would export content, assets and URLs from each option.

## Scoring matrix

Here's my default scoring of how well each option fits **when that dimension is a strong requirement**. 5 is a strong fit, 1 is a poor fit. These are opinions from my own delivery experience, not vendor data, so challenge them in your workshop.

| Dimension (strong need) | Traditional AEM | AEM + EDS | Hybrid (UE + JS app) | Headless AEM | Composable |
|---|:-:|:-:|:-:|:-:|:-:|
| Many channels beyond web | 2 | 2 | 3 | 5 | 5 |
| In-context editing and preview | 5 | 5 | 4 | 2 | 2–3 |
| Java/AEM team in place | 5 | 3 | 3 | 4 | 1 |
| Strong JavaScript team in place | 2 | 4 | 5 | 4 | 5 |
| Fast time to market | 3 | 5 | 3 | 3 | 2 |
| Performance and SEO by default | 3 | 5 | 3 | 3 | 3 |
| One-to-one personalisation | 4 | 3 | 4 | 3 | 4 |
| Governance and compliance | 5 | 4 | 4 | 3 | 2 |
| Complex integration landscape | 3 | 3 | 4 | 4 | 5 |
| Few vendors, low TCO | 4 | 5 | 3 | 3 | 1 |
| Low exit cost | 2 | 3 | 3 | 3 | 4 |
| Protect existing AEM investment | 5 | 4 | 4 | 4 | 1 |

Two scores deserve explanation. Composable scores well on lock-in because each piece is replaceable, but only if your integration layer is clean. And composable scores low on time to market because in my experience the first release takes longer; it's later releases that can speed up.

To use it, weight the dimensions for your organisation and multiply. I keep the weights in a file next to the architecture decision record so the reasoning survives the people who made it:

```yaml
# decision-weights.yaml: 0 = irrelevant, 3 = critical
weights:
  channels: 1            # web plus a light app
  authoring: 3           # 40 marketers, many markets
  team_java: 2
  team_js: 1
  time_to_market: 2
  performance_seo: 3     # organic is the top channel
  personalisation: 1
  governance: 3          # regulated
  integrations: 1
  vendor_count_tco: 2
  exit_cost: 1
  existing_aem: 3
# score(option) = sum(weight * fit) ; record the result and the dissent in the ADR
```

The number isn't the decision. Its value is that it forces people to argue about **weights** (what matters to the business) instead of **products** (what they like).

## Five typical scenarios

### 1. Global brand, 30 markets, marketing-led, web only

Many authors, translation, local campaigns, strong brand governance, organic search matters. Few channels beyond the website.

**Recommendation: AEM with Edge Delivery Services and Universal Editor authoring**, using MSM and language copies on AEM Author and repoless for one codebase across markets. If there's a healthy traditional AEMaaCS estate already, keep it and build new sections on EDS. Composable would multiply integration work without adding anything the business asked for.

### 2. Retailer with web, app, in-store screens and a strong JavaScript team

Commerce is the core, channels genuinely multiply, the engineering team already runs Next.js and has platform engineers.

**Recommendation: composable**, with a headless CMS, commerce engine and search, and a front end on Next.js. If AEM is already licensed, it can be the content and asset service here: Content Fragments via persisted queries, with the Universal Editor instrumented into the Next.js app so marketers keep visual editing. Fund the platform team before the first sprint.

### 3. Regulated bank or insurer with an existing AEM estate

Java team, strict approvals and audit, a logged-in customer portal, a mobile app, an AEM 6.5 or AEMaaCS estate that works.

**Recommendation: stay AEM-centric, mixed by surface.** Public marketing pages on EDS, authenticated areas on traditional AEMaaCS or a dedicated application, app content from Content Fragments. Composable here mostly adds vendor risk assessments and audit scope.

### 4. Digital-native scale-up with no AEM

Small product-led team, one website plus an app, a few content editors, everything in TypeScript.

**Recommendation: a SaaS headless CMS and a JavaScript front end on Vercel or Netlify.** This is "composable-lite": two or three vendors, not twelve. Buying an enterprise DXP here would be the mirror image of the anti-patterns below. Revisit when you have many markets and many authors.

### 5. B2B manufacturer with a PIM and a large product catalogue

Thousands of product pages generated from the PIM, documentation, a dealer portal, a small marketing team, and a website that is the main sales tool.

**Recommendation: AEM with EDS for content and product pages**, rendered from PIM data with JSON2HTML or an edge worker ([how to choose](/blog/2026/10/aem-eds-edge-worker-vs-json2html/)), and the dealer portal as a separate application. The data is already structured; what's needed is fast, crawlable pages, not a new commerce estate.

## Anti-patterns I keep seeing

**1. Headless for a marketing brochure site.** A 200-page corporate site, one channel, ten authors, rebuilt as headless CMS plus a React app. The team then spends months rebuilding preview, page assembly, SEO metadata, redirects and sitemaps: the things a page-based CMS gives you on day one. If the web is the only channel, page-based delivery (EDS, traditional AEM or a page-oriented SaaS CMS) almost always wins.

**2. Composable with no platform team.** Buying five best-of-breed products and handing the integration to a project team that disbands at go-live. Composable estates need a permanent team that owns the integration layer, the shared front-end platform, observability, vendor roadmaps and upgrades. No team, no composable. You just have five vendors and a support gap.

**3. "Lift and shift" to headless.** Exporting page-shaped content into a headless CMS with the same structure. You get JSON blobs that mirror old page layouts, no reuse across channels, and a front end that reconstructs pages from rich-text fields. Headless only pays off when you **redesign the content model** around reusable, channel-neutral structures.

**4. Choosing by quadrant.** Analyst reports describe vendors in general; they don't know your weights. Use them for a shortlist, not a decision.

**5. Client-side rendering on a search-dependent site.** Covered above, but it's common enough to list. Render on the server or at build time.

**6. Treating the decision as all-or-nothing.** Most estates I work on mix two or three of these patterns behind one domain. That's not indecision; it's fitting the architecture to the surface.

## The migration path: strangle, don't rewrite

Whichever direction you choose, the way to get there is the **strangler fig pattern**, which Martin Fowler describes as building new functionality alongside the old system and moving behaviour over piece by piece until the legacy can be retired. For a digital experience estate, the "façade" is usually your CDN.

A sequence that has worked for me:

1. **Start with one channel or one section.** A campaign hub, a blog, one market, or the mobile app's content. Pick something visible enough to matter and small enough to finish in a quarter.
2. **Model content for the target, not the source.** Especially if the target is headless or composable. This is where lift-and-shift is avoided.
3. **Route at the CDN.** Send the new path to the new origin and everything else to the old one. Visitors see one site.
4. **Share the seams:** design tokens, header and footer, analytics and consent, so the join is invisible.
5. **Measure before expanding:** real-user performance, conversion, author effort, and incident load on your team.
6. **Expand section by section, and decommission as you go.** Running two platforms forever is the most expensive outcome of all.

A minimal routing rule makes the idea concrete. This is pseudo-config; the syntax depends on your CDN:

```yaml
# CDN origin selection during a strangler migration
routes:
  - match: "/blog/*"          # migrated first
    origin: new-frontend       # EDS, Next.js on Vercel, etc.
  - match: "/campaigns/*"
    origin: new-frontend
  - match: "/*"               # everything else, for now
    origin: aem-publish
```

If you need to put a budget against this, my approach to sizing these programmes is in [how to estimate an AEM project](/blog/2026/11/how-to-estimate-an-aem-project/).

## FAQ

**Is AEM a composable DXP?**
It can be part of one. AEM exposes Content Fragments over GraphQL and REST OpenAPI, the Universal Editor works with external front ends, and Edge Delivery Services can sit behind any CDN. But AEM is also a suite with deep built-in capabilities, and most of its value for enterprises comes from using those, not from treating it as a generic content API.

**Is Edge Delivery Services headless?**
No. It's decoupled in delivery: front-end-only code and pre-rendered HTML at the edge. But it serves web pages, not a content API for other channels. If you need content in a native app, you add Content Fragments alongside it.

**Is the SPA Editor still an option in 2026?**
For existing sites, yes: Adobe deprecated it in release 2025.01 but continues to fix P1 and P2 issues and security vulnerabilities. For new projects, Adobe recommends the Universal Editor, which works with React, Next.js and other frameworks.

**Can we go headless and keep visual editing?**
Yes, with more effort. With AEM, instrument your front end for the Universal Editor. With other headless CMSs, most now offer a visual editing or live preview option, sometimes as a separate product. Prototype it with real authors before you commit.

**Is composable cheaper?**
Sometimes on licences, rarely in total. The integration layer, platform team and vendor management are real, ongoing costs. Model total cost over five years, including people, not just subscriptions.

**How long should this decision take?**
In my experience, four to six weeks: a discovery of channels, authors and systems, a weighted scoring workshop, and a short proof of concept on the two leading options with real content and real authors. Longer than that usually means the weights haven't been agreed.

## Closing thought

The debate between composable, headless and traditional is rarely about technology. It's about **where you want complexity to live**: inside a vendor's product, or inside your own team. Suites put it in the product and charge you for it. Composable puts it in your team and charges you for that instead.

Pick the option whose complexity you can afford to own, weight the decision openly, and migrate one surface at a time. The organisations that get this right are rarely the most radical; they're the ones that are clearest about what their business actually needs.

Facing a platform decision and want an independent architect to pressure-test the options? [Get in touch](/contact/).

### References

- [SPA Editor deprecation](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/hybrid/spa-editor-deprecation) (Experience League)
- [Universal Editor introduction](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/universal-editor/introduction) (Experience League)
- [Persisted GraphQL queries](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/headless/graphql-api/persisted-queries) (Experience League)
- [AEM REST OpenAPI for Content Fragment Delivery](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/headless/aem-rest-openapi-content-fragment-delivery) (Experience League)
- [Adobe Experience Manager as a Cloud Service APIs](https://developer.adobe.com/experience-cloud/experience-manager-apis) (Adobe Developer)
- [Edge Delivery Services overview](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/edge-delivery/overview) (Experience League)
- [MACH Alliance global annual research](https://machalliance.org/global-annual-research) (MACH Alliance)
- [New research reveals expanding support and ROI for MACH](https://cmscritic.com/on-your-mach-get-set-grow-new-research-reveals-expanding-support-roi-for-mach) (CMS Critic)
- [Gartner Magic Quadrant for Digital Experience Platforms 2025: the rundown](https://www.cxtoday.com/contact-centre/gartner-magic-quadrant-for-digital-experience-platforms-2025-the-rundown/) (CX Today)
- [2025 Gartner Magic Quadrant for Digital Experience Platforms](https://business.adobe.com/resources/reports/gartner-mq-digital-experience-platforms-2025.html) (Adobe)
- [Strangler Fig Application](https://martinfowler.com/bliki/StranglerFigApplication.html) (Martin Fowler)
- [Strangler fig pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/modernization-decomposing-monoliths/strangler-fig.html) (AWS Prescriptive Guidance)

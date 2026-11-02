---
layout: post
title: "AEM Edge Delivery Services vs traditional AEM as a Cloud Service: benefits, trade-offs and when to use which"
seo_title: "AEM Edge Delivery Services vs Traditional AEMaaCS: When to Use"
description: "How Edge Delivery Services differs from traditional AEM as a Cloud Service delivery, its real benefits and limits, and a decision guide for enterprise teams."
date: 2026-11-02 09:10:00 +0530
tags: [AEM, Edge Delivery Services, AEM as a Cloud Service, Architecture]
---

Every AEM programme I've worked on in the last two years has had the same conversation at some point: *should this be on Edge Delivery Services, or "normal" AEM as a Cloud Service?* Sometimes it's asked about a single campaign site, sometimes about a 40-market re-platform.

Adobe's own documentation now leans clearly in one direction. Edge Delivery Services (EDS) is described as replacing the Publish tier, Dispatcher and Core Components with a SaaS, front-end-first model, and Adobe recommends it for new projects. The traditional approach stays fully supported. So the honest answer isn't "EDS always" or "traditional always". It's knowing **what each architecture is good at**, and recognising that most enterprise estates end up running both.

This post compares them as an architect would: how they work, where EDS is genuinely superior, where traditional AEMaaCS still wins, and how to decide.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **Both are AEM as a Cloud Service.** EDS is part of AEM Sites and needs an AEM Sites license. The difference is the *delivery* architecture, not the product.
- **EDS replaces Publish + Dispatcher** with pre-rendered semantic HTML served from an edge origin (`aem.live`) behind a CDN. Code lives in GitHub and goes live in seconds, with no Maven build or Cloud Manager deployment.
- **EDS wins on** performance (Adobe's target is a Lighthouse score of 100 for every site), developer velocity, operational simplicity, SEO and AI-search readiness, and running cost.
- **Traditional AEMaaCS still wins on** server-side Java logic on publish, deep per-user gated experiences, strict template and component-policy governance, and protecting a large existing component investment.
- **You don't have to choose for the whole estate.** Both can serve one domain behind the CDN, so you can migrate section by section.
- **My default for new content-led sites in 2026:** Edge Delivery Services with Universal Editor authoring, plus edge or API-based logic for the dynamic parts.

## Two delivery architectures, side by side

![Traditional AEM as a Cloud Service delivery compared with Edge Delivery Services]({{ '/assets/img/blog/eds-vs-aemaacs/01-architecture-compared.svg' | relative_url }}){: width="1200" height="600" loading="lazy" decoding="async"}

### Traditional AEM as a Cloud Service

Authors edit in AEM Author with the Page Editor or Universal Editor. Content is replicated to the **Publish tier**, where Sling resolves each request and HTL components backed by Java (Sling Models, OSGi services) render the page. The **Dispatcher** caches and filters responses in front of Publish, and a **CDN** sits in front of that.

Code is a Maven project deployed through **Cloud Manager pipelines**: build, code quality checks, tests and deployment, typically measured in tens of minutes.

This model is powerful. Anything Java can do, Publish can do at request time. It also comes with real operational weight: Dispatcher rules, cache invalidation, publish-side scaling and performance tuning, and front-end assets that pass through the same pipeline as back-end code.

### Edge Delivery Services

Content comes from an authoring source:

- **Universal Editor** on AEM Author (AEM authoring);
- **Document Authoring**;
- **Microsoft Word and Excel** via SharePoint, or **Google Docs and Sheets** via Drive.

When an author previews or publishes, the **Admin API** ingests the content as semantic HTML into the **Content Bus**. Code (blocks, styles, scripts) lives in **GitHub** and is synced to the **Code Bus** by AEM Code Sync. Visitors are served from the `aem.live` origin through a CDN, either Adobe-managed or your own Akamai, Cloudflare, Fastly or CloudFront.

There's **no Publish tier and no Dispatcher** in the delivery path. Cloud Manager states that with AEM authoring, "a publish tier is not required when Edge Delivery handles content delivery".

Front-end code is plain HTML, CSS and vanilla JavaScript organised as **blocks**, with no transpilers or bundlers. Pages load in three phases (eager, lazy, delayed), so the content needed for first paint arrives first and third-party scripts wait.

## Where Edge Delivery Services is genuinely superior

### 1. Performance by design, not by heroics

On traditional AEM, a fast site is achievable but takes discipline: clientlib optimisation, Dispatcher tuning, image renditions, careful third-party loading. On EDS, performance is the **default**:

- pages are pre-rendered and served from the edge;
- the loading model protects Largest Contentful Paint;
- images are optimised automatically;
- every pull request gets an automatic PageSpeed Insights check, so regressions are caught before merge.

Adobe's FAQ puts it bluntly: every EDS site "can and should achieve a Lighthouse score of 100". In my experience that's realistic, provided you keep martech and third-party tags in the delayed phase.

### 2. Developer velocity

A front-end change on traditional AEMaaCS means a pipeline run. On EDS, a developer pushes to a branch, previews it at `branch--site--org.aem.page` with real content, and merges. The change is live in seconds.

There's no Maven, no OSGi and no Java required for the presentation layer, which widens the hiring pool to any good front-end developer and makes AI-assisted development far more effective.

### 3. Operational simplicity and cost

No Publish tier to scale, no Dispatcher configuration to maintain, and no cache-invalidation puzzles: publishing pushes invalidation to the CDN. For content-heavy sites, Adobe's own comparison describes EDS as potentially "a faster and more cost-effective solution". Licensing details depend on your contract: EDS requires an AEM Sites license and is assigned per program in Cloud Manager, so confirm the commercial model with your Adobe account team.

### 4. SEO and AI-search readiness out of the box

EDS serves clean semantic HTML in the initial response, with metadata managed through metadata blocks and bulk metadata sheets, and sitemaps and robots.txt managed per site. That covers much of the technical SEO foundation by default. It's also exactly what AI crawlers need: many of them don't execute JavaScript at all. (More in [What actually matters in SEO](/blog/2026/11/what-actually-matters-in-seo/) and [SEO vs GEO](/blog/2026/10/seo-vs-geo-making-your-site-visible-in-ai-search/).)

### 5. Authoring choice

You can keep **AEM authoring with the Universal Editor**, with AEM workflows, permissions, MSM and Content Fragments. You can use **Document Authoring** for speed, or let marketing teams write in **Word or Google Docs**. Different sites in one organisation can use different authoring models on the same platform.

### 6. Built-in experimentation and real-user monitoring

EDS ships with an experimentation framework for A/B testing and audiences without cookies or a performance hit, and it's compatible with Adobe Target. It also collects real-user performance data (Operational Telemetry), so you're measuring what visitors actually experience.

### 7. Multi-site at scale

With **repoless**, one codebase serves many brands, markets and environments, and new sites are created by API rather than by cloning repositories. I covered the setup and governance in [Repoless on AEM Edge Delivery Services](/blog/2026/10/aem-eds-repoless-one-codebase-many-sites/).

## Where traditional AEM as a Cloud Service still wins

EDS isn't the right tool for everything, and Adobe's own comparison is candid that it has "limited templating and component policies" and is "still maturing in terms of features and documentation". These are the situations where I keep traditional delivery, or at least plan carefully.

**1. Server-side Java on publish.** Sling servlets, OSGi services and publish-side integrations that run on every request have no equivalent in EDS. That logic has to move to APIs, App Builder, an edge worker or the browser. Often it can, and should; sometimes the effort isn't justified.

**2. Deep per-user, gated experiences.** EDS supports **site authentication** (token-based protection of a whole site), which is fine for intranets and previews. But per-user authorisation, closed user groups and member portals are typically enforced **at the CDN with your identity provider**, as Adobe's FAQ notes. That's very doable, but it's architecture you build, not a checkbox. Logged-in, transactional apps are often better as a dedicated application anyway.

**3. Strict template and component-policy governance.** Organisations that rely heavily on Editable Templates, the Style System, the Responsive Grid and component policies to constrain authors will find EDS lighter-touch. The Universal Editor, the editor Adobe recommends for new work, deliberately doesn't bring back the Template Editor, Style System or Responsive Grid.

**4. A large, healthy existing investment.** If you have hundreds of well-built HTL components, stable performance and a team fluent in the stack, a big-bang move rarely pays off. Migrating incrementally, starting with new sections and campaigns, usually does.

**5. Headless delivery to apps.** Content Fragments delivered via GraphQL to native apps and other channels is a separate pattern from EDS page delivery, and it keeps the publish-side delivery APIs in play. Note also that the **SPA Editor was deprecated** in release 2025.01. Existing SPA Editor sites remain supported, but new work should use the Universal Editor.

## Side-by-side comparison

| | Traditional AEMaaCS | Edge Delivery Services |
|---|---|---|
| **Delivery path** | Author → Publish (Sling/HTL) → Dispatcher → CDN | Authoring → Admin API → Content Bus (`aem.live`) → CDN |
| **Rendering** | Server-side Java/HTL per uncached request | Pre-rendered semantic HTML, decorated by block JS |
| **Front-end stack** | HTL, clientlibs, often a webpack/Node build | Vanilla JS and CSS blocks, no build step |
| **Deploy** | Cloud Manager pipeline (tens of minutes) | GitHub push, live in seconds |
| **Authoring** | Page Editor, Universal Editor | Universal Editor, Document Authoring, Word/Excel, Google Docs/Sheets |
| **Performance** | Achievable with tuning | Lighthouse 100 is the design target |
| **Server-side logic** | Full Java/OSGi on publish | None in the delivery path; use APIs, edge or App Builder |
| **Auth and gated content** | CUGs and publish-side auth | Site token auth; per-user auth at the CDN with your IdP |
| **Personalisation** | Target, ContextHub, server-side | Target, built-in experimentation, client or edge logic |
| **Governance** | Templates, policies, Style System | Lighter: block models, Universal Editor rules, code review |
| **Multi-site** | MSM, Live Copies | MSM with AEM authoring, plus repoless for one codebase |
| **Ops burden** | Dispatcher, publish scaling, cache invalidation | Mostly CDN and code; no publish tier |
| **Skills** | Java, Sling, HTL, AEM back-end | Strong front-end; AEM authoring knowledge for UE setups |

## Pros and cons at a glance

**Edge Delivery Services**

- ✅ Best-in-class performance by default
- ✅ Live in seconds; branch previews with real content
- ✅ Front-end-only stack, so a wider talent pool and better AI-assisted development
- ✅ No Publish tier or Dispatcher to run
- ✅ Clean HTML for SEO and AI crawlers
- ✅ Flexible authoring, including keeping AEM governance
- ⚠️ No server-side Java in the delivery path
- ⚠️ Per-user authorisation is something you design at the CDN
- ⚠️ Lighter template governance; discipline moves into block design and code review
- ⚠️ Newer platform, with some features and documentation still maturing
- ⚠️ Requires a mindset shift for teams used to building "components"

**Traditional AEM as a Cloud Service**

- ✅ Full server-side power (Sling, OSGi, Java integrations)
- ✅ Mature governance: templates, policies, Style System
- ✅ Closed user groups and publish-side security patterns
- ✅ A huge ecosystem, Core Components and an experienced talent pool
- ⚠️ Performance takes deliberate engineering
- ⚠️ Slower release cycle through pipelines
- ⚠️ More moving parts to operate (Publish, Dispatcher, cache)
- ⚠️ Higher skill bar for front-end changes

## Which one to use when

![Decision tree: Edge Delivery Services, traditional AEM as a Cloud Service, or hybrid]({{ '/assets/img/blog/eds-vs-aemaacs/02-which-one-decision-tree.svg' | relative_url }}){: width="1200" height="640" loading="lazy" decoding="async"}

My rules of thumb from real programmes:

| Scenario | Recommendation |
|---|---|
| New marketing, brand or product-information site | **EDS** with Universal Editor |
| Campaign microsites and landing pages | **EDS**, often with Document Authoring for speed |
| Blog, newsroom, documentation, knowledge base | **EDS** |
| Multi-brand, multi-market estate on one design system | **EDS + repoless**, MSM via AEM authoring |
| Commerce storefront | **EDS** with Adobe Commerce storefront drop-ins; prices and stock via APIs |
| Data-driven pages from a PIM or API | **EDS** with JSON2HTML or an edge worker ([how to choose](/blog/2026/10/aem-eds-edge-worker-vs-json2html/)) |
| Member portal or heavily personalised logged-in area | **Traditional**, or a dedicated app; EDS only if auth runs at the edge |
| Sites built on heavy publish-side Java integrations | **Traditional** until that logic moves to APIs |
| Healthy existing AEMaaCS site, no pressing issues | **Stay traditional**, build new sections on EDS |
| Headless content for native apps | **Content Fragments and GraphQL**, alongside either |

## Running both: the hybrid pattern

![One domain, two origins: CDN routes paths to Edge Delivery or traditional publish]({{ '/assets/img/blog/eds-vs-aemaacs/03-coexistence-routing.svg' | relative_url }}){: width="1200" height="430" loading="lazy" decoding="async"}

Adobe confirms that EDS and AEM Sites can coexist on the same domain, and that pages on one can consume content from the other. In practice the CDN routes by path:

- content-led paths such as `/`, `/products/*` and `/blog/*` go to Edge Delivery;
- server-heavy paths such as `/account/*` and `/portal/*` stay on publish.

Both are authored from one AEM Author with the Universal Editor. Visitors and search engines see one site.

To make the seams invisible:

- **Share design tokens** (colours, typography, spacing as CSS custom properties) so both origins look identical.
- **Share the header and footer**, typically authored once as fragments and consumed by both.
- **Keep URLs identical** during migration, or `301` every change. A re-platform is the highest-risk moment for SEO.
- **Move one section per release,** and compare real-user performance and conversions before and after.

## Migrating from traditional AEMaaCS to EDS

A sequence that has worked well for me:

1. **Inventory and classify** templates and components by usage. In most estates, a small share of components does most of the work. Retire the long tail rather than porting it.
2. **Map components to blocks**, designing each block's content model for authors, not for the old markup. Variants usually replace near-duplicate components.
3. **Choose the authoring model.** Universal Editor keeps AEM workflows, permissions, MSM and translation. Document Authoring is fastest for teams that don't need them.
4. **Plan multi-site from day one** with repoless and the Configuration Service, so markets and environments share one codebase.
5. **Move server-side logic out** to APIs, App Builder, edge workers or publish-time rendering.
6. **Protect SEO:** URL mapping, redirects, canonicals, metadata and sitemaps, validated on staging before cut-over.
7. **Set a performance budget** and keep martech in the delayed phase. Most EDS performance regressions are third-party scripts.
8. **Start with a pilot section,** measure, then scale.

## Gotchas from the field

- **"Lighthouse 100" is a starting point, not a guarantee.** One tag manager configured synchronously can undo it. Govern third-party scripts like code.
- **Don't port components one-to-one.** EDS rewards fewer, well-designed blocks with variants. A 1:1 port carries over the complexity you were trying to leave behind.
- **Preview and live URLs are public by default.** Enable site authentication where needed, and expose only the intended `aem.page`/`aem.live` endpoints behind your CDN.
- **Universal Editor isn't the Page Editor.** Plan author training, especially for teams used to the Style System and layout mode.
- **Treat site configuration as code** once you're on the Configuration Service; it otherwise becomes invisible API state.
- **Register EDS sites in Cloud Manager early**: support tickets require it, and domains, certificates and CDN mappings are managed there.

## Closing thought

Traditional AEM as a Cloud Service is a mature, powerful application platform. Edge Delivery Services is a **delivery architecture** that gets the content layer out of the way: fast, simple and cheap to run. For content-led experiences, which is most of what enterprises publish, EDS is now the better default. For the parts that genuinely need server-side power, traditional delivery is still there, on the same domain and authored from the same AEM.

The real decision isn't "EDS or AEM". It's **which parts of your estate need a server, and which just need to be fast.**

Planning an EDS adoption or a move from traditional AEMaaCS? [Get in touch](/contact/). I'm happy to pressure-test the architecture.

### References

- [Edge Delivery Services overview](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/edge-delivery/overview) (Experience League)
- [Introduction to Edge Delivery Services in Cloud Manager](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/using-cloud-manager/edge-delivery-sites/introduction-to-edge-delivery-services) (Experience League)
- [Understanding AEM Sites offerings and differences](https://experienceleague.adobe.com/en/perspectives/understanding-aem-sites-offerings-and-differences) (Adobe Experience League Perspectives)
- [Edge Delivery Services FAQ](https://www.aem.live/docs/faq) (aem.live)
- [Configuring site authentication](https://aem.live/docs/authentication-setup-site) (aem.live)
- [Experimentation](https://www.aem.live/docs/experimentation) (aem.live)
- [SPA Editor deprecation](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/hybrid/spa-editor-deprecation) (Experience League)
- [Page Editor and Universal Editor](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/universal-editor/page-editor-universal-editor) (Experience League)

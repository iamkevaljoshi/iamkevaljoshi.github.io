---
layout: post
title: "The real cost of AEM: licences, hosting, build and run for AEM as a Cloud Service and Edge Delivery Services"
seo_title: "The Real Cost of AEM: Licences, Build and Run (TCO Guide)"
description: "What AEM as a Cloud Service and Edge Delivery Services really cost over three years: licence drivers, content requests, build, migration, run and hidden costs, with a TCO worksheet."
ai_summary: "The AEM licence is rarely the biggest number in a three-year total cost of ownership. AEM Sites as a Cloud Service is licensed mainly by content requests per month (HTML and JSON page views counted at the edge, in production only), with add-ons such as Assets, Dynamic Media, Forms, Extended Security and extra environments. Edge Delivery Services is part of the AEM Sites licence. Build, migration and the team that runs the platform usually cost more than the licence, and hidden costs such as content migration, integrations, training, overage from bots and monitoring, and a second CDN catch teams out. The post explains each driver, how Edge Delivery Services changes the profile, a TCO worksheet, levers to reduce cost and questions to ask Adobe and partners."
date: 2026-11-08 12:00:00 +0530
category: architecture
tags: [AEM as a Cloud Service, Edge Delivery Services, TCO, Licensing, Architecture]
---

"How much does AEM cost?" is the first question in almost every conversation I have with a new client, and the honest answer is never the one they expect. They're usually braced for the licence. The licence matters, but over three years it's rarely the biggest number. The build, the migration, the team that runs the platform and a handful of costs nobody put in the business case usually add up to more.

This post is the view I give CTOs, procurement and digital leads before they sign anything. It explains **what drives each part of the cost of AEM as a Cloud Service (AEMaaCS) and Edge Delivery Services (EDS), where the surprises come from, and how to build a total cost of ownership (TCO) you can defend.**

One thing it won't do is quote Adobe prices. Licence pricing is negotiated per contract and covered by non-disclosure terms, and any number you find online is either out of date or someone else's deal. What I can give you is the drivers, the ratios I see on projects, and the questions that get you a real number.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **Think in three-year TCO, not licence.** In my experience the licence is often between a quarter and a half of the three-year total. Build, migration and run make up the rest.
- **AEM Sites as a Cloud Service is licensed mainly by content requests:** HTML and JSON page requests, counted at the edge, in production only. Images, CSS and JavaScript don't count. Bots you don't block and health checks you misconfigure do.
- **Add-ons change the number more than people expect:** AEM Assets tiers, Dynamic Media, Forms, Extended Security (WAF) and additional environments are separate line items.
- **Edge Delivery Services is part of the AEM Sites licence,** and development is free. It usually lowers build and run cost through simpler code, no Dispatcher and faster pages, but it doesn't remove the licence.
- **Upgrades are continuous on AEMaaCS,** so the expensive upgrade project every few years disappears. You pay for that with continuous regression testing and code quality instead.
- **The hidden costs are predictable:** content migration, integrations, authoring training, content request overage, a second CDN, extra environments and multi-site governance.
- **Use the worksheet below,** fill in your own numbers, and ask Adobe and your partner the questions at the end before you sign.

## Where the money really goes

Most business cases I review compare a licence quote with "the build" and stop there. That misses the larger half of the picture. A realistic three-year view has four layers, and the licence is only the visible one.

![The cost of AEM over three years as layers: the licence is the visible part, while build, migration, the run team and hidden costs such as content migration, integrations, training and overage sit below it. Proportions are illustrative]({{ '/assets/img/blog/aem-cost/01-tco-layers.svg' | relative_url }}){: width="1200" height="620" loading="lazy" decoding="async"}

The proportions in that diagram are illustrative, not a benchmark. They shift with your traffic, your number of sites and how much you already have. A global brand with dozens of sites and heavy traffic will see the licence take a bigger share. A single-brand site moving from WordPress will see build and content migration dominate year one. The point is that **every layer needs a line in the business case,** and the bottom three are where projects run over.

## How AEM as a Cloud Service is licensed

Adobe's commercial terms change over time and vary by contract, so treat this section as a map of the drivers, then confirm each against your sales order and the current [product description](https://helpx.adobe.com/legal/product-descriptions/aem-cloud-service.html).

### Sites: content requests

AEM Sites as a Cloud Service is licensed by **content requests per month**. Adobe's [content requests documentation](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/programs/content-requests) is the reference, and the details matter because they decide whether you stay inside your entitlement:

| Counted | Not counted |
|---|---|
| Successful HTML and JSON responses (HTTP 100–299), served from cache or origin | Images, CSS, JavaScript and other static assets |
| Requests from HTTP libraries and automation (curl, headless browsers, custom scripts) | Redirects (3xx), 404s and other errors (4xx, 5xx) |
| Monitoring and uptime tools that aren't on Adobe's exclusion list | Well-known search engine and AI crawlers (Googlebot, Bingbot, ChatGPT, Perplexity and others on Adobe's list) |
| Server-side prefetch requests | DDoS traffic blocked by AEM, `/system/probes/health`, `/etc.clientlibs/*`, `favicon.ico` |
| Traffic from visitors who block analytics | Same-domain Experience Fragment requests under `/content/experience-fragments/` |

Three facts I make sure every client hears:

- **Counting happens at the edge,** where the first caching layer receives the request. A page served entirely from the CDN cache still counts. Caching saves money on infrastructure; it doesn't reduce content requests.
- **Only production counts.** Stage, development and rapid development environments don't consume your entitlement.
- **Your analytics and Adobe's count will differ.** Analytics misses visitors who block tags and never sees automated traffic. The Cloud Manager [License dashboard](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/programs/license-dashboard) is the billable view (a Business Owner has to sign in to see it), and Adobe can provide a report of the top volume drivers. If you run your own CDN in front of AEM, the dashboard only sees Adobe's CDN, and your contract will say how to report the rest.

Some Adobe material has described headless JSON API traffic as counted at a reduced ratio. The current documentation is less specific, saying API responses that deliver page content may count depending on context. If you're building a headless or hybrid site with heavy API traffic, **get the counting rule for your traffic pattern written into the contract.**

### Environments

A Cloud Manager program gets production and stage as a pair (you can't have one without the other), plus development and rapid development environments (RDEs) depending on your entitlement. In practice I see programs start with one production and stage pair, one or two development environments and one RDE, then buy more as teams grow. Extra environments and extra RDEs are add-ons. Confirm exactly what's included before you plan your branching and release model around it.

### Add-ons that change the number

| Add-on | What it's for | When you'll need it |
|---|---|---|
| **AEM Assets** (tiers such as Prime and Ultimate) | Digital asset management, renditions, Content Hub | Any serious DAM requirement. Tiers differ in features and user limits; check which features you actually use |
| **Dynamic Media** | Image and video delivery, smart crop, transformations | Large image catalogues, retail, video. Storage-based metrics may apply |
| **AEM Forms** | Adaptive forms, document generation | Regulated forms, applications, onboarding journeys |
| **Extended Security** (formerly WAF-DDoS Protection) | WAF rules on the Adobe CDN | Most enterprise sites. Basic traffic filters and rate limits are included without it |
| **Additional environments and RDEs** | More parallel development and testing | Several teams or parallel release streams |
| **Other Experience Cloud products** | Target, Analytics, Real-Time CDP and others | Separate licences, often bundled in negotiation |

The pattern I see most often is a deal scoped for Sites, followed six months later by a scramble for Assets, Extended Security or more environments. **Price the add-ons you will need in year two before you sign year one.**

### Edge Delivery Services

The [aem.live FAQ](https://www.aem.live/docs/faq) is direct: Edge Delivery Services is part of AEM Sites and requires an AEM Sites licence, and development access is free. Your Adobe account team estimates licensing based on the site's needs and traffic. So EDS isn't a cheaper licence in itself. Where it changes the cost is in build and run, which I cover [below](#how-edge-delivery-services-changes-the-cost-profile).

## Build cost

The build is usually the largest single number in year one, and the hardest to compare between proposals. I've written a separate guide to [estimating an AEM project]({{ '/blog/2026/11/how-to-estimate-an-aem-project/' | relative_url }}), so here I'll stick to what drives the number:

- **Number of components or blocks,** and how many variants each has. This is the single biggest driver on traditional AEM.
- **Number of templates and page types,** and how different they really are.
- **Integrations:** commerce, search, CRM, identity, DAM, personalisation. Each one is a mini-project with its own testing and failure modes.
- **Sites and languages:** multi-site management, language copies and translation workflows add real effort. See my post on [one codebase for many sites]({{ '/blog/2026/10/aem-eds-repoless-one-codebase-many-sites/' | relative_url }}) for how EDS reduces this.
- **Authoring experience:** a well-designed authoring model takes time, and skimping on it moves the cost into every author's working day for years.
- **Non-functional requirements:** performance budgets, accessibility, security testing and the go-live runbook.

When you compare proposals, compare **scope per component and integration,** not day rates. A cheaper rate on a vaguer scope is usually the more expensive option by month nine.

## Migration cost

If you're moving from AEM 6.x on-premise or Adobe Managed Services, migration is its own budget line. My [migration playbook]({{ '/blog/2026/11/aem-on-premise-and-managed-services-to-aem-as-a-cloud-service-migration/' | relative_url }}) covers the work in detail. The cost drivers are:

- **Code refactoring** to Cloud Service patterns: immutable `/apps`, no custom run modes at runtime, Sling Content Distribution instead of replication agents, and the like. The Best Practices Analyzer gives you an early measure.
- **Content and asset volume,** which decides how long the Content Transfer Tool runs and how many top-up rounds you need.
- **Integrations that relied on network access,** which may need dedicated egress IPs, VPNs or a redesign.
- **Regression testing** of everything that worked before.
- **Running two platforms in parallel** for the overlap period, including two licences and two support models.

Migration is also where a platform decision can save money. If you're rebuilding anyway, it's worth asking whether some sites should move to EDS rather than lift-and-shift. My [EDS vs traditional AEMaaCS comparison]({{ '/blog/2026/11/aem-edge-delivery-services-vs-traditional-aemaacs/' | relative_url }}) helps with that decision.

## Run cost

This is the layer business cases forget most often. AEMaaCS removes infrastructure work, but it doesn't remove the need for a team.

### What Cloud Service removes

- **Upgrade projects.** AEMaaCS updates continuously, so there's no multi-month upgrade every few years. On 6.x that alone could be a six-figure project.
- **Infrastructure operations:** servers, patching, scaling, backups and the Adobe-managed CDN are Adobe's job.
- **Capacity planning for traffic peaks,** within the limits of your licence.

### What it adds or keeps

- **Continuous regression.** Adobe's updates are tested against your code in your pipeline, so you need good automated tests and someone to act when a pipeline fails. My [Cloud Manager pipelines post]({{ '/blog/2026/11/aem-cloud-manager-pipelines-quality-gates-rde-config-pipeline/' | relative_url }}) covers how to keep that cheap.
- **A product team.** Someone has to own the backlog, release new components, keep content models clean and support authors.
- **Monitoring and observability:** log forwarding to your own tooling, alerting and synthetic checks. Set synthetic checks up so they don't burn content requests.
- **Security:** WAF and traffic filter rules, penetration testing and access reviews.
- **Support:** Adobe support covers the platform, but most organisations also pay a partner for application support and enhancements.

### Illustrative run team

For a single-brand AEMaaCS site of moderate complexity, after go-live, this is the kind of steady-state team I'd plan for. **These ratios are illustrative from my own projects, not a benchmark:**

| Role | Typical allocation |
|---|---|
| Product owner or platform lead | 0.5–1 |
| AEM developers (back end and front end) | 2–3 |
| QA, ideally with automation | 0.5–1 |
| DevOps and platform support | 0.25–0.5 |
| Architect (shared, for design and governance) | 0.1–0.25 |
| Content and authoring support | 0.5–1, often in the marketing team |

An EDS site of similar scope often runs with a smaller development team, because blocks are simpler and there's no Java or Dispatcher to maintain. Multi-site programs need more governance and less development per site.

## Hidden costs that catch teams out

These appear in almost every program I've reviewed. None of them are surprising in hindsight, which is why they belong in the business case.

- **Content migration and clean-up.** Moving content is the easy part. Rewriting, restructuring, tagging and removing what nobody reads is weeks of work for content teams, and it's rarely in the agency quote.
- **Integrations nobody listed.** The form that posts to a CRM, the store locator, the careers feed, the cookie banner, the search index. Each is small; together they're a sprint or three.
- **Authoring training and change management.** New authoring tools change how marketers work. Budget for training, guides and a support period after launch.
- **Content request overage.** Bots with generic user agents, uptime monitors hitting HTML pages every minute, soft 404s returning 200, client-side redirects and prefetching can all inflate your count. The arithmetic adds up fast: one uptime check a minute from ten locations is over 430,000 requests a month, before anyone has visited the site.
- **A second CDN.** If brand or security policy requires your own CDN in front of Adobe's, that's another contract, another configuration to maintain, and annual reporting of traffic to Adobe. My [CDN configuration post]({{ '/blog/2026/11/aem-cloud-service-cdn-yaml-headers-proxy-redirects/' | relative_url }}) shows how much the Adobe CDN can now do, which often removes the need.
- **Extra environments.** Parallel teams, a performance test environment, a training environment. Each is an add-on.
- **Multi-site governance.** Every new site needs owners, templates, translation workflow and analytics setup, even when the code is shared.
- **Third-party services:** search, consent management, form handling, translation memory, digital accessibility monitoring.
- **Running old and new platforms in parallel** during migration, including licences you can't cancel early.

## How Edge Delivery Services changes the cost profile

EDS doesn't change the licence model. It changes where the build and run money goes.

![Cost profile of traditional AEM as a Cloud Service compared with Edge Delivery Services across licence, build, run team, infrastructure and operations, performance work and authoring. Edge Delivery Services shifts cost down in build, run and performance, while licence stays similar]({{ '/assets/img/blog/aem-cost/02-eds-cost-profile.svg' | relative_url }}){: width="1200" height="600" loading="lazy" decoding="async"}

| Cost area | Traditional AEMaaCS | Edge Delivery Services |
|---|---|---|
| Licence | AEM Sites | AEM Sites (EDS is part of it) |
| Build | Java, HTL, Sling models, Dispatcher, clientlibs | Vanilla JavaScript blocks and CSS; smaller, more front-end-heavy team |
| Run team | Back-end skills needed for the life of the platform | Mostly front-end; simpler code to maintain |
| Infrastructure and ops | Publish tier, Dispatcher, caching rules | No publish or Dispatcher layer to tune; CDN and caching handled by the service |
| Performance work | Often a dedicated optimisation phase | Designed for a high Lighthouse score from the start |
| Authoring | AEM authoring | Document-based or Universal Editor; may need less training for content teams |
| Fit | Complex logic, personalisation, deep AEM features | Content-led sites, campaigns, high-traffic marketing |

The caveat is fit. If your site depends on server-side logic, complex workflows or AEM features EDS doesn't support, forcing it into EDS moves cost into custom workarounds. My [composable, headless or traditional decision framework]({{ '/blog/2026/11/composable-headless-or-traditional-aem-decision-framework/' | relative_url }}) is the place to start that decision.

## A TCO worksheet you can fill in

This is the structure I use with clients. Fill it in for three years, with your partner's estimates and Adobe's quote. If a cell is empty, that's a question to ask, not a zero.

| Line item | Year 1 | Year 2 | Year 3 | Notes |
|---|---|---|---|---|
| **Licences** | | | | |
| AEM Sites (content request entitlement) | | | | Based on forecast traffic plus growth |
| AEM Assets / Dynamic Media | | | | Tier and storage |
| Forms, Extended Security, other add-ons | | | | |
| Additional environments and RDEs | | | | |
| Other Adobe products (Target, Analytics…) | | | | |
| **Build** | | | | |
| Discovery, architecture and design | | | | |
| Components or blocks, templates | | | | Per component, not day rate |
| Integrations | | | | One line per integration |
| Testing, accessibility, performance, security | | | | |
| **Migration** | | | | |
| Code refactoring | | | | From Best Practices Analyzer |
| Content and asset migration, clean-up | | | | Include content team time |
| Parallel running of old platform | | | | Licences and support |
| **Run** | | | | |
| Product and development team | | | | Internal or partner |
| Application support and enhancements | | | | |
| Monitoring, logging, synthetic checks | | | | |
| Penetration testing and security reviews | | | | |
| **Hidden and third-party** | | | | |
| Authoring training and change management | | | | |
| Second CDN, search, consent, translation | | | | |
| Contingency | | | | I use 15–20% in year one |
| **Total** | | | | |

Two habits make the worksheet useful. **Forecast content requests from real data,** using CDN logs or server logs rather than analytics page views, and add your growth plan. And **put contingency on year one,** because that's where unknowns turn into invoices.

## How to reduce cost without cutting corners

- **Right-size the content request entitlement.** Block unwanted bots with traffic filter rules, point monitors at `/system/probes/health` or use `HEAD` requests, return real 404 status codes, use server-side redirects, and reduce JSON calls per page. Adobe's documentation lists these, and they're cheap to implement.
- **Choose EDS where it fits.** For content-led sites, the smaller build and run team is usually the biggest saving available.
- **Build a component library once.** Reuse across sites is where multi-site programs save money, whether through MSM on AEM or [repoless EDS]({{ '/blog/2026/10/aem-eds-repoless-one-codebase-many-sites/' | relative_url }}).
- **Use the Adobe CDN fully** before buying another one. Headers, redirects, proxying and WAF are all configuration now.
- **Invest in automated tests early.** Continuous updates make regression testing a running cost; automation makes it a small one.
- **Clean content before you migrate it.** Every page you don't move is a page you don't test, translate or maintain.
- **Negotiate add-ons with the main deal.** Assets, Extended Security and extra environments are easier to price together than one at a time later.
- **Keep the architecture simple.** Every integration, custom workflow and bespoke authoring tweak has a run cost for as long as the platform lives.

## Questions to ask before you sign

**Ask Adobe:**

1. How exactly will our traffic be counted, including headless or API traffic, and can that be written into the contract?
2. What's the content request entitlement, what happens on overage, and how is it priced?
3. Which environments and RDEs are included, and what does each additional one cost?
4. Is Edge Delivery Services included for all our sites, and are there limits on the number of sites?
5. Which add-ons do we need for our requirements (Assets tier, Dynamic Media, Forms, Extended Security), and can they be priced now for later years?
6. If we use our own CDN, what reporting is required?

**Ask your implementation partner:**

1. How is the estimate built: per component, template and integration, or as a lump sum?
2. What's excluded? Content migration, training, accessibility testing and performance work are common gaps.
3. What does the run team look like after go-live, and what does it cost per year?
4. How will you keep our content request usage under control?
5. What's your test automation approach for continuous AEM updates?
6. Where would you recommend EDS instead of traditional AEM for our sites, and why?

## FAQ

**How much does an AEM licence cost?**
Adobe doesn't publish prices. AEM Sites as a Cloud Service is priced mainly on content requests per month, plus add-ons, and every deal is negotiated. Your Adobe account team will quote based on traffic and requirements. Be wary of any figure you find online.

**What counts as a content request?**
A successful HTML or JSON response to a page request in production, counted at the edge whether it's served from cache or origin. Images, CSS, JavaScript, redirects, errors and well-known bots don't count. Adobe's documentation has the full list.

**Is Edge Delivery Services cheaper than traditional AEM?**
Not as a licence: it's part of AEM Sites. It's often cheaper to build and run, because the code is simpler, there's no Dispatcher or publish tier to tune, and the team can be smaller. That saving depends on your site being a good fit for EDS.

**Do I still pay for upgrades on AEM as a Cloud Service?**
Not as projects. Updates are continuous and applied by Adobe. You do pay for keeping your code compatible: automated tests, fixing pipeline failures and occasionally reworking deprecated APIs.

**Why is my content request count higher than my analytics page views?**
Analytics doesn't see visitors who block tags, automated traffic, monitoring tools or crawlers with generic user agents. Adobe counts at the edge. The License dashboard is the billable number; CDN log analysis helps you find the cause.

**How long should a TCO cover?**
Three years is the minimum I use, because that's a typical contract term and it captures the build, the migration and two full years of running. Five years is better for platform decisions you'll live with longer.

## Closing thought

The cheapest AEM program isn't the one with the lowest licence quote. It's the one that knew its costs before signing: the licence drivers, the build scope, the migration, the team it needs to run, and the hidden items that turn up in every project.

If you take one thing from this post, make it the worksheet. **Fill in every line for three years, treat every blank as a question, and get the content request counting rules in writing.** That's how you avoid the year-two conversation nobody wants to have.

If you're building a business case for AEM as a Cloud Service or Edge Delivery Services, or trying to understand why your current costs are higher than expected, [get in touch](/contact/).

### References

- [Understand Cloud Service content requests](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/programs/content-requests) (Adobe Experience League)
- [License dashboard](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/programs/license-dashboard) (Adobe Experience League)
- [Adobe Experience Manager as a Cloud Service product description](https://helpx.adobe.com/legal/product-descriptions/aem-cloud-service.html) (Adobe)
- [Manage environments](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/using-cloud-manager/manage-environments) (Adobe Experience League)
- [Edge Delivery Services FAQ](https://www.aem.live/docs/faq) (aem.live)
- [Introduction to Edge Delivery Services in Cloud Manager](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/using-cloud-manager/edge-delivery-sites/introduction-to-edge-delivery-services) (Adobe Experience League)
- [Protecting AEM websites: traffic filter and WAF rules](https://experienceleague.adobe.com/en/docs/experience-manager-learn/cloud-service/security/traffic-filter-and-waf-rules/overview) (Adobe Experience League)

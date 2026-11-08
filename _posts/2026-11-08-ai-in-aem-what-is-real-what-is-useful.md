---
layout: post
title: "AI in AEM in 2026: what's real, what's useful and what to wait for"
seo_title: "AI in AEM 2026: Agents, Sites Optimizer and What's Real"
description: "An architect's honest map of AI in Adobe Experience Manager in 2026: AEM agents, Sites Optimizer, LLM Optimizer, Generate Variations and AI in Assets, with status, licensing and what to pilot first."
ai_summary: "AI in Adobe Experience Manager is now a mix of features you can use today, features in limited or early access, and announcements without dates. Usable now: AI-generated metadata and smart tags in Assets, Generate Variations in the AEM editors (metered, with Edge Delivery Services), Sites Optimizer for SEO, accessibility and performance fixes, LLM Optimizer for AI visibility, and local developer tooling such as AGENTS.md, Adobe skills and MCP servers in the AEM and Dispatcher SDKs. AEM agents (Brand Experience, Content Advisor and Governance) are documented and available through an Agentic SKU or a phased Try Before You Buy programme, on AEM as a Cloud Service and Edge Delivery Services only. CX Enterprise Coworker, LLM Apps and parts of Brand Visibility are announced without general availability dates. Pilot narrow, measurable use cases with human review, and put governance in place before automation."
date: 2026-11-08 11:00:00 +0530
category: architecture
tags: [AI, AEM as a Cloud Service, AEM Agents, Sites Optimizer, LLM Optimizer, Governance]
---

Every AEM conversation I've had this year has included the same question, usually from someone senior: "What's our AI strategy for AEM?" Behind it there's often a slide from Adobe Summit, a competitor's press release, and a worry about being left behind. What's usually missing is a clear picture of what actually exists, what it costs, and what it's good for.

This post is that picture, as of November 2026. I've built it from Adobe's own documentation and announcements, and from what I've seen work and not work on projects. I've been strict about one thing: **if I couldn't confirm a capability in Adobe's documentation, I say so.** AI moves faster than any other part of the Adobe stack, and a good share of what was shown on stage hasn't reached customers yet.

It's written for CTOs, digital leads and architects who need to decide where to spend the next six months. If you're still choosing between AEM delivery models, read my [composable, headless or traditional AEM framework]({{ '/blog/2026/11/composable-headless-or-traditional-aem-decision-framework/' | relative_url }}) first. Most of what follows needs AEM as a Cloud Service.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **AI in AEM is real, but uneven.** Some features are documented and usable today. Others are in limited availability, early access or a phased trial. Several Summit 2026 announcements have no general availability date yet.
- **Usable now:** AI-generated metadata and smart tags in Assets, Generate Variations inside the AEM editors, Sites Optimizer for SEO, accessibility and performance fixes, LLM Optimizer for AI search visibility, and local developer tools (AGENTS.md, Adobe skills and MCP servers in the AEM and Dispatcher SDKs).
- **Available with conditions:** the AEM agents (Brand Experience, Content Advisor and Governance) are documented, but you get them through an Agentic SKU or a Try Before You Buy programme that's "rolling out in phases". They need AEM as a Cloud Service or Edge Delivery Services. AEM 6.5 on-premise isn't supported.
- **Announced, not dated:** CX Enterprise Coworker ("in the coming months"), LLM Apps for AEM, and the full Adobe Brand Visibility solution.
- **Most of it is licensed or metered.** Generate Variations uses metered "generative actions", agents need an Agentic SKU, and Content Optimization needs Dynamic Media with OpenAPI. Budget before you pilot.
- **Pilot first:** AI metadata in Assets, Sites Optimizer on alt text and broken links, Generate Variations with EDS experimentation, and developer tooling. They're low risk, quick to measure and reversible.
- **Governance before automation.** Decide what AI may draft, what a human must approve, and how you'll measure quality, before anything publishes on its own.

## How to read this map

AI announcements blur three very different states. I use four labels throughout:

| Label | What it means | How I confirmed it |
|---|---|---|
| **Usable** | Documented, with setup steps, for current AEM as a Cloud Service customers (licence permitting) | Experience League documentation or release notes |
| **Conditional** | Documented, but access is limited: early access, limited availability, a phased trial or a separate SKU | Status wording on Adobe's own pages |
| **Announced** | Described in an Adobe press release, no general availability date | Adobe newsroom |
| **Build** | Not a product: a pattern you build with AEM APIs, App Builder and an LLM of your choice | Architecture, not a feature |

Statuses change monthly. Treat this as a snapshot and check the linked pages before you commit budget.

![Map of AI capabilities across the AEM content lifecycle, from create and manage assets to optimise, be found by AI, build and run, marked as usable, conditional or announced]({{ '/assets/img/blog/ai-in-aem/01-ai-capability-map.svg' | relative_url }}){: width="1200" height="660" loading="lazy" decoding="async"}

## Authoring and content creation

### Generate Variations

**Usable, metered.** Generate Variations creates copy variants of a selected piece of content, guided by suggestions or your own prompt, a reference web page or an uploaded brief. It's now integrated into the **Universal Editor** and the **Content Fragment Editor** through extensions, and into **AEM Sidekick** for document-based authoring. The older standalone version still works but "will be deprecated".

The practical details matter:

- **Licence:** you need an AEM as a Cloud Service entitlement that includes Edge Delivery Services, and a product profile. Usage is metered: one generated copy variant is one "generative action". Each licence includes a base number; more can be bought.
- **Where it shines:** headline and call-to-action alternatives that you then test. That's the whole point. Generated variants are hypotheses, not answers, and the documentation itself points you to Edge Delivery Services experimentation to measure them. My post on [EDS experimentation]({{ '/blog/2026/11/aem-eds-experimentation-how-it-works-and-how-to-measure-success/' | relative_url }}) covers how to run those tests properly.
- **Risk:** volume without validation. Ten variants of a headline are cheap; deciding which one is true, on-brand and compliant isn't.

### Generative AI and the Experience Production Agent

Adobe's "AI in AEM" overview describes generative AI in the editing interface that is "aware of brand tone and style guidelines", alongside **AEM Content AI** for AI-assisted authoring and natural-language discovery. The documentation for these is lighter than for other features. I'd treat them as part of the agent experience below, rather than a separate product to plan around.

The **Experience Production Agent**, part of the Brand Experience Agent, is more concrete. Its documented jobs include:

- **Content Update:** change, remove, replace or add elements in pages, content fragments, forms and assets, from natural language, a Jira ticket PDF or a screenshot.
- **Content Create:** new pages from a brief, a template and a prompt, opened in the Universal Editor for editing. This job is in **Limited Availability**: you request access by email.
- **Figma to content fragments:** import Figma designs into content models, fragments and HTML templates.
- **Forms Creation and Communication Creation:** adaptive forms and print correspondence from natural-language requirements.

**Conditional.** These are useful for the dull, high-volume work that clogs content teams: "update the price on 40 product pages" or "replace this disclaimer everywhere". That's where I'd start. Creating new pages from a prompt is the most visible demo and the least proven in production.

### AI translation

**Usable (check licence).** AEM can use a large language model as a translation service, starting with Microsoft Azure OpenAI, and accepts uploaded style guides to keep terminology consistent. It sits inside the translation framework you may already use for [language copies and MSM]({{ '/blog/2026/11/aem-msm-language-copies-cloud-service/' | relative_url }}). It's worth a side-by-side test against your current vendor for low-risk content. Keep human review for legal, regulated and brand-critical copy.

## Assets and content discovery

### Smart tags and AI-generated metadata

**Usable.** Two related features, often confused:

- **Smart tags** are applied automatically when assets are uploaded to AEM as a Cloud Service. They're keywords, generated in English only.
- **AI-generated metadata** adds a generated **title, description and keywords** on an "AI-Generated" tab. You decide whether the AI title replaces the asset title, or only fills it when none exists. You can disable it for the whole environment or per folder. Existing assets keep any metadata already generated.

This is the least glamorous and most immediately valuable AI feature in AEM. Most DAMs have thousands of assets called `IMG_4821.jpg` with no description. Better metadata improves search for authors and gives a starting point for alt text. I say "starting point" deliberately: a generated description says what's in an image, while good alt text says why it's on the page. My [accessibility post]({{ '/blog/2026/11/accessibility-on-aem-fix-the-component-not-the-page/' | relative_url }}) explains the difference.

### Content Advisor Agent: discovery and optimisation

**Conditional.** The Content Advisor Agent has two documented jobs:

- **Discovery** finds assets, content fragments and adaptive forms from natural-language queries.
- **Content Optimization** creates channel-ready image variations from instructions: resize, crop for an Instagram Story, change backgrounds, recolour, sharpen. It needs a **Dynamic Media licence**, **Dynamic Media with OpenAPI** enabled, and assets in an **approved** state. You use it through the AI Assistant in Experience Cloud.

The approval requirement is a good design choice: the agent works from sanctioned assets, not whatever's in the DAM. If your rights and approval metadata is a mess, fix that first, because the agent will only ever be as trustworthy as the approval data behind it.

### Content Hub and Firefly

**Usable with entitlements.** Content Hub lets marketers find approved assets and create variations from templates and brand elements, including Firefly generative features. Creating with Adobe Express needs an Express entitlement. If you already license GenStudio or Firefly, this is how that capability reaches people who don't live in AEM.

## Governance agent

**Conditional.** The **Governance Agent**, called the Brand Governance Agent in Adobe's Summit announcement, is meant to enforce security, regulatory and brand policies. Its documented skills include **brand validation** and **permission troubleshooting**: for example, auditing why a user or group has write access to a path.

The permission troubleshooting is genuinely useful today. Anyone who has debugged an AEM access control list at 6 p.m. before a launch knows why. Brand validation is promising but depends on how well your brand rules are written down. An agent can't enforce a guideline that only exists in a designer's head.

## Site optimisation: Sites Optimizer

**Usable, with many parts in early access.** AEM Sites Optimizer is the most mature AI product in this space, because it does something narrow and measurable: it finds problems on your live site, suggests fixes and, increasingly, deploys them. The current release notes (updated 5 November 2026) list opportunity types across:

- **Performance:** Core Web Vitals, with suggested code patches.
- **SEO:** meta tags, sitemaps, canonicals, hreflang, redirect chains, broken backlinks and internal links, structured data including FAQ, and pages with high impressions but low click-through.
- **Accessibility:** alt text, colour contrast, form accessibility and ARIA labels, with a unified accessibility report in early access.
- **Conversion:** no call to action above the fold, and ad intent mismatch.
- **Hygiene and security:** leftover lorem ipsum, cookie banner issues and vulnerable dependencies.

The direction of travel is from suggestion to deployment. Alt text, call-to-action and forms fixes can deploy to AEM Author. Code fixes can arrive as pull requests through Cloud Manager, including for GitHub, GitLab, Bitbucket and Azure DevOps. Broken-backlink redirects can deploy to Dispatcher (early access). **Site Health Monitor** has been generally available since January 2026, and **Preflight** checks now run in the Universal Editor and Page Editor.

Two cautions. First, many of the newest features are labelled **early access, "available on request"**, so check which ones your contract includes. Second, auto-deploy is only as safe as your review process. I'd allow automatic fixes for alt text drafts and redirects, and require a normal pull request review for anything touching code. The same rule I apply to any [Cloud Manager pipeline]({{ '/blog/2026/11/aem-cloud-manager-pipelines-quality-gates-rde-config-pipeline/' | relative_url }}) applies here.

## Being found by AI: LLM Optimizer and Brand Visibility

**LLM Optimizer: usable.** Adobe announced general availability of LLM Optimizer in October 2025. It monitors traffic from AI assistants and agents, benchmarks how often your brand is cited or recommended, and suggests changes for your own pages and third-party sources. It can run on its own and integrates with AEM Sites, so recommendations can reach authoring workflows.

**Adobe Brand Visibility: announced.** In June 2026, after closing its Semrush acquisition, Adobe announced Brand Visibility. It combines Semrush's AI search data with LLM Optimizer, either standalone or integrated with AEM. The announcement didn't give availability terms, so ask your account team what's actually included.

**LLM Apps: announced.** At Summit 2026 Adobe said AEM "will enable" brands to build experiences that run inside LLM interfaces. That's a statement of direction, not a feature you can plan a project around yet.

None of this replaces the fundamentals. AI assistants cite pages they can crawl, read without JavaScript and trust. My posts on [SEO vs GEO]({{ '/blog/2026/10/seo-vs-geo-making-your-site-visible-in-ai-search/' | relative_url }}) and [AI crawlers, robots.txt and llms.txt]({{ '/blog/2026/11/llms-txt-ai-crawlers-robots-txt-what-to-allow/' | relative_url }}) cover what to fix first. Tools help you measure. They don't make thin content worth citing.

## Building and running AEM: developer and migration AI

This is where I've seen the fastest real productivity gains this year, and it gets the least attention in executive slides.

### Local AI tooling for developers

**Usable.** Adobe documents four pieces for AEM as a Cloud Service Java development (page updated 29 October 2026):

- **AGENTS.md:** a project context file that AI coding tools read at the start of each session, generated from your `pom.xml` by an Adobe skill.
- **Agent skills** from the `adobe/skills` repository: creating components, Dispatcher configuration, migration, workflows and code assessment.
- **The AEM Quickstart MCP server**, bundled with the local SDK, which lets an AI tool read AEM logs, diagnose OSGi bundles that won't start and trace recent requests.
- **The Dispatcher MCP server**, bundled with the Dispatcher SDK, with tools to validate, lint, trace a request and inspect the cache.

Supported tools include Claude Code, Cursor and GitHub Copilot. Adobe invites feedback to "help shape product development", so expect changes. My advice: adopt AGENTS.md and the MCP servers now. They're free, local and make AI coding assistants far less likely to invent AEM APIs.

### Development Agent

**Conditional.** The Development Agent's documented job is **pipeline troubleshooting**: it finds the root cause of a failed Cloud Manager build and suggests a fix. Template updates and component configuration are named as uses, without detailed jobs yet. If your team loses hours to red pipelines, this is a strong candidate for a trial.

### Experience Modernization Agent

**Conditional.** The Experience Modernization Agent migrates sites to Edge Delivery Services from a live website, from Figma designs or both. It can map old content into new Figma-derived blocks, or generate pages from Figma frames.

It's the most commercially interesting agent for anyone planning a [migration]({{ '/blog/2026/11/aem-on-premise-and-managed-services-to-aem-as-a-cloud-service-migration/' | relative_url }}). It's also the one where I'd be most careful about estimates. Agents accelerate the repetitive 70% of page migration. The remaining 30% (block design, content modelling, integrations, redirects and SEO) is where migrations succeed or fail, and that's still architecture work.

## Orchestration: agents across Experience Cloud

**Agent Orchestrator: usable.** Adobe announced general availability of Experience Platform Agent Orchestrator and its first agents in September 2025. Those agents focus on audiences and journeys rather than content.

**CX Enterprise Coworker: announced.** At Summit 2026 Adobe unveiled CX Enterprise Coworker, built on open standards including MCP and agent-to-agent protocols, with the line that it "will be generally available in the coming months". AEM's agent documentation already refers to AEM skills in Coworker. That's the direction: AEM content capabilities becoming tools that cross-product agents can call.

For architects, the important part is the open standards. MCP support means agent workflows aren't locked to one interface. It also means you need to treat agent access like any other API integration: scoped permissions, audit logs and least privilege.

## Build your own: when the product doesn't fit

Not every AI use case has an Adobe product, and not every organisation has the licences. The patterns I see working:

| Pattern | How it's built | Good for |
|---|---|---|
| **Author assistant in the Universal Editor** | A UE extension calling an LLM through App Builder, using your brand guide as context | Tone checks, summaries, SEO titles, reading-level checks |
| **Answers grounded in your own content** | Content fragments exposed through GraphQL, indexed in a vector store, answered by an LLM | Support and product Q&A grounded in approved content |
| **Enrichment on publish** | An event-driven App Builder action that classifies or summarises content when it's published | Taxonomy, related content, structured data |
| **Edge-side personalisation** | Edge logic that picks pre-approved variants, not text generated in real time | Fast, safe [personalisation]({{ '/blog/2026/11/personalisation-why-it-matters-and-how-to-do-it-well/' | relative_url }}) |

Two rules from projects. First, **generate at authoring time, not request time**. Content generated on the fly for each visitor is hard to review, hard to cache and hard to defend. Generate drafts, review them, publish them. Second, **ground everything in approved content**. An assistant that answers from your content fragments is an asset. One that answers from its training data is a liability with your logo on it.

Build-your-own also means owning the model contract, data residency, prompt-injection defences and evaluation. Price that honestly against an Adobe licence.

## Summary table

| Capability | Status | Access or licence | Best first use | Main risk |
|---|---|---|---|---|
| AI-generated metadata and smart tags | Usable | AEM Assets as a Cloud Service | Make DAM search work | Treating descriptions as alt text |
| Generate Variations | Usable, metered | AEMaaCS with EDS entitlement; generative actions | Variants to A/B test | Volume without validation |
| Sites Optimizer | Usable, many parts in early access | Sites Optimizer licence | Alt text, broken links, Core Web Vitals | Auto-deploying unreviewed code |
| LLM Optimizer | Usable | Standalone or with AEM | Baseline AI visibility | Chasing metrics over content quality |
| Local AI dev tools | Usable | Free with the SDKs | AGENTS.md and MCP for developers | Over-trusting generated code |
| AI translation | Usable (check licence) | Translation framework, Azure OpenAI | Low-risk content | Regulated copy without review |
| Brand Experience, Content Advisor and Governance agents | Conditional | Agentic SKU or phased trial; AEMaaCS or EDS | Content updates, permission audits, pipeline fixes | Weak approval and brand data |
| Content Create (prompt to page) | Conditional: limited availability | Request access | Drafts for review | Off-brand pages at scale |
| Content Optimization (images) | Conditional | Dynamic Media with OpenAPI | Channel renditions | Rights and approval metadata gaps |
| CX Enterprise Coworker | Announced | "Coming months" | Watch | Planning on dates that don't exist |
| LLM Apps, full Brand Visibility | Announced | Not dated | Watch | Same |

## Licensing and access: the part nobody puts on the slide

Three facts shape every AI business case on AEM in 2026:

1. **It's AEM as a Cloud Service and Edge Delivery Services first.** The agents need them. AEM 6.5 LTS on Managed Services is getting agents "progressively" through a co-innovation programme. AEM 6.5 on-premise isn't supported. For some organisations, AI is the strongest argument yet for finishing the cloud migration.
2. **Much of it is a separate line item.** Agents come through an Agentic SKU or Try Before You Buy. Generate Variations is metered. Content Optimization needs Dynamic Media. Sites Optimizer and LLM Optimizer are their own products. Ask your account team for a written list of what your contract includes. Don't assume a demo means entitlement.
3. **Trials are phased.** "Rolling out in phases" means your organisation may not have access yet, even if another one does.

## Governance: decide before you automate

AI changes who, or what, produces content. Governance is how you keep the organisation accountable for it.

- **Data.** Adobe has stated publicly that it doesn't train generative AI on customer content, and its Experience Cloud generative AI guidelines say inputs and outputs may be reviewed for abuse prevention. Read the security fact sheets for each feature you enable, and involve your privacy team, especially for personal data in forms and communications.
- **Brand.** Write your brand rules down in a form an agent can use: tone, banned claims, terminology and image rules. Adobe's Brand Intelligence, announced for GenStudio, learns from approvals and rejections. Even then, someone has to own the rules.
- **Legal and rights.** Generated images and copy need the same rights checks as anything else. Keep usage-rights metadata accurate. Note where AI was used, if your sector or market requires disclosure.
- **Human review.** Define three tiers: AI may **draft** (anything), AI may **change with approval** (most content), and AI may **publish directly** (almost nothing in year one). Put the tiers in your workflow, not just in a policy document.
- **Quality and accessibility.** Generated content still has to meet WCAG, SEO and editorial standards. Run the same checks: Sites Optimizer's Preflight is a sensible gate.
- **Audit.** Know who asked an agent to do what, and what it changed. Prefer features that leave a trail in AEM versions, Jira or pull requests.

## Readiness: where to start

![AI readiness ladder for AEM: foundations, assist, automate with review and agentic workflows, with what each level needs and what to pilot at each step]({{ '/assets/img/blog/ai-in-aem/02-readiness-ladder.svg' | relative_url }}){: width="1200" height="600" loading="lazy" decoding="async"}

Most organisations I work with are between levels 1 and 2. That's fine. The jump that matters isn't to "agentic", it's from scattered experiments to a governed, measured pipeline.

### Pilot first

My shortlist for a first 8–12 weeks, in order:

1. **AI-generated metadata in Assets.** Turn it on for one folder, measure search success and time-to-find with authors, then expand. Low risk, easy to reverse.
2. **Sites Optimizer on alt text, broken backlinks and Core Web Vitals.** Clear before-and-after metrics, and fixes go through review.
3. **Generate Variations with EDS experimentation.** Three to five tests on high-traffic pages, with a written hypothesis for each. Track generative action consumption.
4. **Developer tooling.** AGENTS.md, Adobe skills and the MCP servers for the whole team; the Development Agent for pipeline failures if you have access.
5. **An AI visibility baseline** with LLM Optimizer on your top 50 pages, before you spend money on fixes.

### What to wait for

- **Unreviewed autonomous publishing.** No product removes the need for review, and no audit committee will thank you for trying.
- **Prompt-to-page at scale.** Content Create is in limited availability. Pilot it, but don't plan a content operating model around it yet.
- **Undated announcements.** Coworker, LLM Apps and the full Brand Visibility suite. Track them; don't put them on the critical path.

### How to run a pilot

Pick one use case and one team. Write down the baseline (hours, error rate, search success, conversion). Define the review step. Track cost, including generative actions and credits. Run for six to eight weeks, then decide: scale, change or stop. A pilot without a baseline is a demo with a budget.

## FAQ

**Do I need AEM as a Cloud Service to use AI in AEM?**
For the agents, yes: they need AEM as a Cloud Service or Edge Delivery Services, with AEM 6.5 LTS on Managed Services following progressively and on-premise unsupported. Some products, such as LLM Optimizer, can run without AEM. Build-your-own patterns work on any version, at your own cost.

**Is our content used to train Adobe's models?**
Adobe has publicly stated it doesn't train generative AI on customer content. Its generative AI guidelines also note that inputs and outputs may be reviewed for abuse prevention. Check the security fact sheet for each feature with your privacy team.

**Will AI agents replace our AEM developers or authors?**
Not in 2026. They remove repetitive work: bulk content updates, pipeline triage, renditions and first drafts. That frees people for modelling, design, integration and judgement, which is where projects succeed or fail.

**What's the difference between Sites Optimizer and LLM Optimizer?**
Sites Optimizer improves your site itself: performance, SEO, accessibility and conversion issues, with fixes. LLM Optimizer measures and improves how AI assistants see and cite your brand. They're complementary; most organisations need Sites Optimizer's fundamentals first.

**How do we stop generated content going off-brand?**
Write brand rules down in a usable form, keep a human approval step, and check outputs with the same tools you use for human content. Use generated variants as hypotheses to test, not final copy.

**Should we wait until the agents are more mature?**
Not entirely. Start with the usable, low-risk features and your governance model now. When the agents mature, you'll be ready to use them safely, and your competitors who waited will still be writing their AI policy.

## Closing thought

The honest answer to "what's our AI strategy for AEM?" in 2026 isn't a vision slide. It's a short list: fix your metadata and approvals, let AI find and fix site issues under review, use generation to create test hypotheses, give your developers the tooling, and measure everything. That's less exciting than an autonomous agent building pages from a prompt. It's also what will still be delivering value when the next set of announcements arrives.

If you're working out where AI fits in your AEM platform, or need a realistic plan and business case before your next Adobe renewal, [get in touch](/contact/).

### References

- [AI in AEM as a Cloud Service](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/ai-in-aem/overview) (Adobe Experience League)
- [Overview of agents in AEM](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/ai-in-aem/agents/overview) (Adobe Experience League)
- [Brand Experience Agent](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/ai-in-aem/agents/brand-experience/overview) (Adobe Experience League)
- [Content Optimization agent](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/ai-in-aem/agents/content-optimization/overview) (Adobe Experience League)
- [Governance Agent overview](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/ai-in-aem/agents/governance/overview) (Adobe Experience League)
- [Generate Variations, integrated in AEM editors](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/ai-in-aem/generate-variations/generate-variations-integrated-editor) (Adobe Experience League)
- [AI-generated metadata in AEM Assets](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/manage/enhance-content-discovery-with-ai-generated-metadata) and [Smart tags](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/manage/smart-tags) (Adobe Experience League)
- [Local development with AI tools](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/ai-in-aem/local-development-with-ai-tools) (Adobe Experience League)
- [AEM Sites Optimizer release notes](https://experienceleague.adobe.com/en/docs/experience-manager-sites-optimizer/content/documentation/release-notes) (Adobe Experience League)
- [Adobe delivers LLM Optimizer](https://news.adobe.com/news/2025/10/adobe-delivers-llm-optimizer-businesses-boost-visibility-across-ai-powered-chat-services-browsers) (Adobe newsroom, October 2025)
- [Adobe announces general availability of AI agents](https://news.adobe.com/news/2025/09/adobe-announces-general-availability-ai-agents) (Adobe newsroom, September 2025)
- [Adobe introduces brand visibility solution](https://news.adobe.com/news/2026/04/adobe-introduces-brand-visibility-solution) (Adobe newsroom, April 2026)
- [Adobe unveils CX Enterprise Coworker](https://news.adobe.com/news/2026/04/adobe-unveils-cx-enterprise-coworker) (Adobe newsroom, April 2026)
- [Adobe introduces Brand Intelligence](https://news.adobe.com/news/2026/04/adobe-introduces-brand-intelligence) (Adobe newsroom, April 2026)
- [Introducing Adobe Brand Visibility](https://news.adobe.com/news/2026/06/introducing-adobe-brand-visibility) (Adobe newsroom, June 2026)
- [Building the agentic web with Adobe Experience Manager](https://blog.developer.adobe.com/en/publish/2026/02/building-the-agentic-web-with-adobe-experience-manager) (Adobe Developer blog, February 2026)
- [Updating Adobe's Terms of Use](https://blog.adobe.com/en/publish/2024/06/10/updating-adobes-terms-of-use) (Adobe blog, June 2024)
- [Adobe Experience Cloud generative AI user guidelines](https://www.adobe.com/legal/licenses-terms/adobe-dx-gen-ai-user-guidelines.html) (Adobe)

---
layout: post
title: "AI-assisted AEM as a Cloud Service migration: what Adobe's Cloud Migration skill really changes"
seo_title: "AI-Assisted AEMaaCS Migration: Adobe's Cloud Migration Skill"
description: "A migration architect's view of Adobe's AEM Cloud Migration skill: what it automates, what stays manual, how to govern it and how it changes your effort estimate."
ai_summary: "Adobe's AEM Cloud Migration solution is an agent skill package for AI coding tools that reads Best Practices Analyzer findings from a CSV or from Cloud Acceleration Manager through an MCP server, and fixes them one pattern per session in batches of five, pausing for review. It covers Java patterns such as schedulers, replication and event listeners, OSGi configuration and secrets, Classic UI dialogs and custom widgets, static-to-editable templates, Dispatcher conversion and Oak indexes (beta). Repository structure, content transfer, integrations, users and regression testing stay manual. The post explains the workflow, governance, where it helps most and how to adjust a migration estimate for it, with illustrative ranges rather than Adobe figures."
date: 2026-11-12 09:00:00 +0530
category: aem-cloud-service
tags: [AEM as a Cloud Service, Migration, AI, BPA, Estimation]
---

Every AEM as a Cloud Service migration I've run has had the same shape. The Best Practices Analyzer (BPA) report arrives with hundreds or thousands of findings. Most are mechanical: a scheduler that needs rewriting, an OSGi configuration in the wrong format, a Classic UI dialog that has to become Touch UI. A few are genuinely hard: reverse replication, an integration that assumed a fixed IP, a content model that only worked because nobody ever cleaned it up. The mechanical work takes weeks of developer time, and the hard work gets squeezed.

In 2026 Adobe released an AI-assisted answer to the mechanical part: the **AEM Cloud Migration skill**, an agent skill for AI coding tools that reads your BPA findings and refactors code one pattern at a time. Clients now ask me two questions about it. Does it make migrations cheaper? And can we trust code an AI wrote?

This post is my answer as a migration architect: **what the skill is, how the workflow runs, what it covers and what it leaves to you, how to govern it, and how I'd adjust an effort estimate for it.** If you're estimating a migration, use it alongside my [AEMaaCS migration estimator]({{ '/tools/aem-migration-estimator/' | relative_url }}) and the [migration playbook]({{ '/blog/2026/11/aem-on-premise-and-managed-services-to-aem-as-a-cloud-service-migration/' | relative_url }}).

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **It's a skill package, not a product.** The `aem-cloud-service` package from [Adobe Skills](https://github.com/adobe/skills) contains a **migration** skill that runs the workflow and a **code-assessment** skill that holds the transformation rules. It runs inside AI coding tools that support agent skills and MCP, such as Claude Code.
- **It reads BPA findings** from a CSV export, or from Cloud Acceleration Manager (CAM) through Adobe's MCP server, or works on files you name.
- **One pattern per session, five findings per batch,** and it stops for your review after every batch. It never carries on by itself.
- **It covers more than I expected:** Java patterns (scheduler, replication, event listeners, AssetManager, Guava cache, InputStream), OSGi configuration and Cloud Manager secrets, Classic UI dialogs and custom widgets, static-to-editable templates, Dispatcher conversion, HTL lint and Oak indexes (beta).
- **It doesn't cover the rest of a migration:** repository restructuring, content transfer, integrations, users and permissions, front-end changes, performance and regression testing. Adobe's own documentation says repository structure and content transfer are out of scope.
- **Governance is the real work:** a runbook first, one pattern per branch and commit, human review of every batch, your own tests, and the local SDK validation (beta) as a signal, not proof.
- **Effort impact is uneven.** In my working assumptions, mechanical code buckets shrink a lot, dialogs and templates shrink a bit, and content, integrations and QA barely change. On a typical migration that's a **5–15% saving on total effort, not 50%.** These are illustrative ranges, not Adobe figures.

## What the AEM Cloud Migration skill is

Adobe describes the AEM Cloud Migration solution as "an agent-based toolset that guides developers through migrating" AEM 6.x, AMS or on-premise Java code and OSGi configuration to AEM as a Cloud Service ([overview](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/cloud-migration-skill/overview-cloud-migration-skill)). It has three parts:

| Part | What it does |
|---|---|
| **Migration skill** | Runs the workflow: reads findings, picks one pattern, batches the work, reports and waits. Also generates a read-only migration runbook |
| **Code-assessment skill** | Holds the transformation rules for each pattern, such as how to rewrite a scheduler or a replication call. The migration skill hands every code change to it |
| **AEM MCP server** | Connects the agent to Cloud Acceleration Manager so it can fetch BPA findings for a CAM project directly |

Both skills ship in one package, `aem-cloud-service`, in the open-source [adobe/skills](https://github.com/adobe/skills) repository, alongside skills for Dispatcher, workflows, components and generating an `AGENTS.md` file for your project. In Claude Code you install it from the plugin marketplace:

```text
/plugin marketplace add adobe/skills
/plugin install aem-cloud-service@adobe-skills
```

Adobe's overview says it works in "any AI-enabled IDE that supports agent skills and the Model Context Protocol (MCP)" and links to per-IDE instructions. I'd check those for your team's tool before you plan around it.

### Don't confuse it with the Experience Modernization Agent

Adobe also offers the **Experience Modernization Agent**, and the names cause confusion in client meetings. They're different things:

| | AEM Cloud Migration skill | Experience Modernization Agent |
|---|---|---|
| **Target** | AEM as a Cloud Service (AEM Sites, Java stack) | Edge Delivery Services only |
| **Source** | Your AEM 6.x, AMS or on-premise code base | Most CMSs, including legacy AEM, read as public HTML |
| **Who runs it** | Your developers, in their IDE | Adobe's Agentic Outcome Engineers, on your behalf ([delivery model](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/ai-in-aem/agents/brand-experience/modernization/delivery-model)) |
| **What it moves** | Code and configuration | Content, layout and brand, rebuilt as an EDS site |
| **Access** | Open-source skills | Through your Adobe account team |

If the plan is "rebuild on Edge Delivery Services", the Modernization Agent is the relevant conversation. My [EDS vs traditional AEMaaCS]({{ '/blog/2026/11/aem-edge-delivery-services-vs-traditional-aemaacs/' | relative_url }}) post covers that decision. The rest of this post is about the Cloud Migration skill, for the much more common lift-and-shift to AEM as a Cloud Service.

## How the workflow runs

![The AI-assisted migration workflow: BPA findings from a CSV or Cloud Acceleration Manager feed the migration skill, which produces a read-only runbook, then works one pattern per session in batches of five, handing each change to the code-assessment skill; a developer reviews and commits each batch, validation runs on the local Cloud SDK, and Cloud Manager pipelines deploy. Content transfer, repository structure, integrations, users and regression testing sit outside the loop.]({{ '/assets/img/blog/ai-assisted-migration/01-workflow.svg' | relative_url }}){: width="1200" height="640" loading="lazy" decoding="async"}

### 1. Give it findings

There are three sources, and the skill keeps them separate ([using the skill](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/cloud-migration-skill/using-cloud-migration-skill)):

- **A BPA CSV:** "Fix scheduler findings using BPA CSV at `./reports/bpa.csv`." The fastest path.
- **CAM through MCP:** the agent lists your CAM projects and **you confirm which one**. Adobe recommends this for the most current findings. Tool names have moved: the overview page names `fetch-cam-bpa-findings-by-*` tools, while the current skill source treats those as deprecated in favour of newer AEM MCP server recipes. Follow the current docs for your setup.
- **Manual:** name the files, with no BPA report at all.

If the MCP call fails, the skill **stops and shows the error**. It doesn't quietly switch to the CSV or start guessing. That's the behaviour you want, and it says something about how carefully the workflow is designed.

### 2. Start with the runbook

Ask "Review my code for AEMaaCS migration" and the skill writes a **read-only** `migration-runbook.md`: each supported pattern, the affected files and a starter prompt. No code changes. I'd make this the first deliverable of any AI-assisted migration, because it turns a BPA report into a work plan your team can review. Adobe notes that heuristic findings in the runbook are candidates to confirm, not authoritative counts.

### 3. One pattern per session, five findings per batch

Ask it to "fix everything" and it will ask you to pick a pattern first. Then it:

1. Reads the transformation rules for that pattern from the code-assessment skill **before** touching code.
2. Changes up to **five** findings.
3. Reports what it did, and **stops**.
4. Carries on only when you reply "continue".

Adobe's guidance is to review each batch's diff and commit it with a pattern-scoped message, one pattern per commit. If you stop halfway, a new session with the same pattern and source resumes where it left off.

### 4. Validate (beta)

The skill can build the migrated code, deploy it to a **local AEM as a Cloud Service SDK** through the AEM Quickstart MCP server and check bundle and component state. It never edits source code to make a check pass. Adobe is explicit about the limits: validation is in beta, it doesn't test business logic, and the build skips unit tests, so "run your own tests". Treat a pass as a strong signal, not a guarantee.

## What it covers, and what it doesn't

From Adobe's overview and the skill's own documentation, these are the patterns it handles:

| Area | Patterns | What changes |
|---|---|---|
| **Java code** | `scheduler`, `resourceChangeListener`, `replication`, `eventListener`, `eventHandler`, `assetApi`, `guavaCache`, `inputStream`, `htlLint` | Rewrites to Cloud Service patterns (for example Sling Jobs, Sling Content Distribution, Caffeine instead of Guava cache) |
| **OSGi configuration** | `.cfg.json` conversion, run mode scoping, unsupported run modes | Moves secrets and environment values to Cloud Manager variables. It never prints secret values |
| **Legacy UI** | `lui` (Classic UI and Coral 2 dialogs), `cdw` (custom ExtJS widgets) | Converts to Coral 3 / Granite UI. Run widgets first, then dialogs |
| **Templates** | Template modernisation | Creates editable templates and AEM Modernize Tools rules from static templates |
| **Dispatcher** | `dispatcherConversion` | Wraps Adobe's Dispatcher converter, with a hard stop if filter rules are lost |
| **Oak indexes** | `oakIndex` (beta) | Wraps Adobe's index converter and works out the next free `-custom-N` name |
| **Packages** | Vault package install-time dependencies | Removes `day/cq60/product:*` dependencies that block installation |

That's broader than I expected. Templates, dialogs and Dispatcher conversion are where migrations usually lose time.

Here's what stays with your team:

- **Repository structure.** Splitting mutable and immutable content and moving `/etc` designs and configuration is out of scope; Adobe points to its Refactoring Tools. On most projects this is a large share of BPA findings (URS and CAV).
- **Content transfer.** Content Transfer Tool runs, rehearsals and the final top-up.
- **Integrations.** Egress IPs, OAuth, secrets on the other side, firewall rules and third-party contracts.
- **Users and permissions.** The move to Adobe IMS, groups and access control lists.
- **Business logic and custom components.** The skill fixes known anti-patterns; it doesn't know whether your pricing component still calculates VAT correctly.
- **Front end, CDN and caching design.** Client libraries, [Dispatcher caching rules]({{ '/blog/2026/11/dispatcher-on-aem-as-a-cloud-service-caching-and-invalidation/' | relative_url }}) beyond conversion, and [CDN configuration]({{ '/blog/2026/11/aem-cloud-service-cdn-yaml-headers-proxy-redirects/' | relative_url }}).
- **Testing.** Functional, regression, performance, security, accessibility and UAT.
- **Products that need rethinking.** Reverse replication, Communities, classic Commerce Integration Framework and Search & Promote need a design decision, not a refactor.

## Governance: how I'd run it on a client project

AI-written code goes to production on the same pipelines as everything else, so it needs the same rigour, plus a few extra habits.

**Set up the project for agents first.** The same package includes an `ensure-agents-md` skill that generates `AGENTS.md` and `CLAUDE.md` from your `pom.xml`. Adobe's [AI-assisted development guidance](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/ai-in-aem/local-development-with-ai-tools) recommends project context files, because agents otherwise mix up the AEM Java stack with Edge Delivery Services.

**Make the runbook a reviewed artefact.** Generate it, check it against the BPA report and agree the pattern order with the tech lead. My usual order is configuration and packages first (so builds deploy), then Java patterns, then UI, templates and Dispatcher, then indexes.

**One pattern, one branch, small pull requests.** Batches of five fit naturally into reviewable commits. A pull request per pattern, or per few batches, keeps reviews real rather than rubber stamps.

**A human reviews every batch.** The reviewer must know the AEM pattern being applied. "The AI did it" isn't a review comment. I'd add a checklist to the pull request template: tests updated, behaviour unchanged, no secrets in the diff, and any `needs_manual_review` items resolved.

**Tests before trust.** Run unit tests, the Cloud Manager [code quality gates]({{ '/blog/2026/11/aem-cloud-manager-pipelines-quality-gates-rde-config-pipeline/' | relative_url }}) and your functional tests. The skill's validation step builds without unit tests, so it can't replace them.

**Be careful with the local SDK.** Adobe warns that installing a bundle can start schedulers and listeners. Check that the local SDK can't reach production systems before you validate.

**Keep secrets out of the loop.** The skill writes secret handling to a git-ignored file and never prints values. Keep it that way: no production credentials in prompts or repository history.

**Measure it.** Record time per batch and the review rework rate per pattern. After two or three patterns you'll know where it saves time on *your* code base, which is worth more than any vendor figure.

## How it changes the effort estimate

This is the question clients really ask, and the honest answer is: **it depends which BPA buckets dominate your report.**

The figures below are **my working assumptions**, based on how much of each bucket is mechanical and on what the skill covers today. They are not Adobe figures. I'll replace them with actuals as AI-assisted migrations complete, and you should do the same.

![Expected effect of AI-assisted refactoring on each BPA bucket: large reductions for mechanical Java patterns, OSGi configuration and Classic UI dialogs; moderate for static templates, Oak indexes and Dispatcher conversion; little or none for repository structure, reverse replication, integrations, content migration and QA. Illustrative, not Adobe figures.]({{ '/assets/img/blog/ai-assisted-migration/02-effort-impact.svg' | relative_url }}){: width="1200" height="620" loading="lazy" decoding="async"}

### Adjusting the estimator's rates

The [migration estimator]({{ '/tools/aem-migration-estimator/' | relative_url }}) lets you edit the rate for every BPA bucket under step 3. For an AI-assisted project, I'd start with these adjustments to the per-finding rate:

| Estimator bucket | Default rate (PD per finding) | AI-assisted starting point | Why |
|---|---|---|---|
| Developer guideline fixes (DG) | 0.5 | 0.25–0.3 | Scheduler, Guava cache and InputStream patterns are covered |
| Replication agents (code using replication APIs) | 1 | 0.5 | `replication` pattern covered; agent configuration review remains |
| Incompatible APIs (OU, NCC, IOI) | 0.75 | 0.5 | Partly covered by deprecated-API rules |
| OSGi configuration and run modes | 0.2 | 0.1 | Conversion and secrets extraction covered |
| Classic UI dialogs and widgets | 1.5 | 0.6–0.9 | Dialog and widget conversion covered; authoring retest remains |
| Static templates → editable | 3 | 2–2.5 | Templates and Modernize Tools rules generated; content conversion and validation remain |
| Oak index definitions | 1 | 0.6–0.8 | Beta: keep generous review time |
| Repository structure (URS, CAV) | 0.15 | no change | Out of scope for the skill |
| Reverse replication | 5 | no change | Needs redesign, not refactoring |
| Overlays of /libs | 1 | no change | Needs design decisions |
| Forms, Commerce, Communities | as default | no change | Product decisions, not code patterns |

Outside the BPA buckets:

- **Dispatcher conversion:** reduce by about a third if you use the skill's converter branch. Caching design, CDN rules and testing stay the same.
- **Add 2–4 person-days of setup:** installing skills, connecting the MCP server, generating `AGENTS.md`, a local SDK for validation, and agreeing the review process.
- **Add review effort:** I'd keep around 25–30% of the original effort for each automated bucket as review and rework time. That's already built into the ranges above.
- **Leave content migration, integrations, QA, cutover and hypercare unchanged.** In my experience they're 50–60% of a migration's effort, and the skill doesn't touch them.

### What that means for the total

Run the estimator's sample report with and without these adjustments and you'll see the pattern. Refactoring drops noticeably, but the total moves much less, because QA, content and integrations dominate. On the estimator's sample report (4,800 pages, 46 custom components, 14 Classic UI dialogs) the saving is about 18 person-days, **around 6%** of the effort before overheads. Code-heavy projects with many Java patterns and Classic UI dialogs will see **10–15%**. Content-heavy, integration-heavy projects will see less.

That's still worth having. On a 400-person-day migration, a 10% saving is 40 person-days, two months of a developer's time, and they're the dullest two months. My advice to clients is to bank the saving as **more testing and a calmer cutover**, not as a shorter timeline, at least until you have actuals from your own code base. My [estimation post]({{ '/blog/2026/11/how-to-estimate-an-aem-project/' | relative_url }}) explains why buffers matter, and the [cost of AEM]({{ '/blog/2026/11/real-cost-of-aem-licences-hosting-build-and-run/' | relative_url }}) post shows where migration sits in total cost.

## Where I expect it to help most, and least

**Most:**

- **Large Java code bases with classic anti-patterns:** many schedulers, event listeners, replication calls and `AssetManager` usages. This is what the code-assessment rules are built for.
- **Sites with dozens of Classic UI dialogs.** Dialog conversion is tedious, well understood and easy to review.
- **Teams new to AEM as a Cloud Service.** The rules encode Adobe's target patterns, so the skill teaches as it works. Review the diffs as training material.
- **Partners running several migrations.** The runbook and batch discipline make work predictable across projects.

**Least:**

- **Content-heavy, code-light sites,** where most effort is content migration, QA and redirects.
- **Heavily integrated platforms,** where the risk sits in systems the skill can't see.
- **Projects that need redesign anyway,** such as Communities, reverse replication or heavy `/libs` overlays.
- **Messy code bases with no tests,** where every AI change needs a slow manual check. Write characterisation tests for the riskiest areas first.

## FAQ

**Is the AEM Cloud Migration skill free?**
The skills are open source in the [adobe/skills](https://github.com/adobe/skills) repository. You need an AI coding tool and its model usage, and for the CAM route, access to Cloud Acceleration Manager and the AEM MCP server. Check current terms with your Adobe account team.

**Does it replace Cloud Acceleration Manager or BPA?**
No. It consumes BPA findings, from a CSV or from CAM, and works on them. You still run BPA and use CAM for readiness, content transfer and migration tracking.

**Can it migrate content?**
No. Content transfer stays with the Content Transfer Tool, and repository restructuring with Adobe's Refactoring Tools. Both are explicitly out of scope.

**Is AI-generated code safe to deploy?**
As safe as your review and tests make it. The skill is conservative by design (one pattern, batches of five, a stop after every batch, no silent fallbacks), but the responsibility for what reaches production stays with your team.

**Which patterns are in beta?**
At the time of writing, Oak index migration and the local SDK validation are labelled beta in Adobe's documentation. Review their output with extra care.

**Should we wait for it to mature?**
I wouldn't wait. Start with the read-only runbook and one low-risk pattern, such as OSGi configuration or HTL lint, measure the result, then decide how far to rely on it.

**Does it work for AEM 6.5 LTS upgrades?**
No. It targets AEM as a Cloud Service. The skill's documentation is explicit that it's scoped to migrating to Cloud Service, not to Edge Delivery or AEM 6.5 LTS.

## Closing thought

The Cloud Migration skill doesn't change *what* an AEM migration is. You still restructure the repository, move the content, rewire integrations and test everything. What it changes is the **mechanical middle**: the hundreds of findings that used to fill developers' weeks. Run with discipline, it moves that work faster and more consistently than a team doing it by hand.

My recommendation is to start with the runbook, govern it like any other code change, measure it per pattern, and re-estimate with real numbers. Use the saving to make the migration safer before you use it to make it shorter.

If you're planning an AEM as a Cloud Service migration and want help deciding how far to lean on AI-assisted refactoring, [get in touch](/contact/).

### References

- [AI-assisted code migration to AEM as a Cloud Service](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/cloud-migration-skill/overview-cloud-migration-skill) (Adobe Experience League)
- [Using the AEM Cloud Migration skill](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/cloud-migration-skill/using-cloud-migration-skill) (Adobe Experience League)
- [adobe/skills: AEM as a Cloud Service plugin](https://github.com/adobe/skills/tree/main/plugins/aem/cloud-service) (Adobe, GitHub)
- [Local development with AI tools](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/ai-in-aem/local-development-with-ai-tools) (Adobe Experience League)
- [Experience Modernization Agent: AOE delivery model](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/ai-in-aem/agents/brand-experience/modernization/delivery-model) (Adobe Experience League)
- [Using Best Practices Analyzer](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/cloud-migration/best-practices-analyzer/using-best-practices-analyzer) (Adobe Experience League)
- [AEM Cloud Migration using agentic AI](https://exadel.com/news/aem-cloud-migration-using-agentic-ai) (Exadel)

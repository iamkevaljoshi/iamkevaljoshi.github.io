---
layout: post
title: "Multi-site management and language copies in AEM as a Cloud Service: patterns that scale"
seo_title: "AEM MSM and Language Copies on Cloud Service: Patterns"
description: "How to structure MSM, language copies and translation in AEM as a Cloud Service for 40+ markets: content structure, rollout configs, pitfalls and governance."
ai_summary: "Multi Site Manager (MSM) reuses and synchronises content between sites, while language copies and the translation framework turn one language into another; MSM never translates. The pattern that scales is to translate once into a master per language, then make each market a live copy of its language master, keeping inheritance one level deep. The post covers rollout configuration as code on Cloud Service, Edge Delivery Services and governance."
date: 2026-11-03 18:20:00 +0530
category: aem-cloud-service
tags: [AEM, AEM as a Cloud Service, MSM, Multilingual]
---

Every large AEM estate I've worked on started with a simple promise: "author once, publish everywhere". Five years later the same estate usually has live copies of live copies, markets that cancelled inheritance on whole pages "just for the campaign", translation jobs that overwrite local edits, and a rollout that takes most of an afternoon and nobody dares to run on a Friday.

None of that is a product failure. Multi Site Manager (MSM) and the translation framework in AEM are mature and work well at 40+ markets. What goes wrong is the design: which tool is used for which job, how deep inheritance goes, and who is allowed to break it.

This post is the architecture guidance I give teams before they create the first blueprint on AEM as a Cloud Service (AEMaaCS): the content structure that scales, how MSM and translation fit together, what's different in the cloud, how it works with Edge Delivery Services, and the governance that keeps it healthy.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **MSM and translation solve different problems.** MSM reuses and synchronises content between sites. Language copies and the translation framework turn one language into another. MSM does not translate anything.
- **The pattern that scales:** author in a source language master, translate into one master per language, then make each market a live copy of its language master. Translate once per language, roll out once per market.
- **Keep inheritance one level deep.** Markets inherit from language masters, never from other markets. Chains of live copies are the most common cause of slow rollouts and confused authors.
- **Break inheritance at the component, not the page.** Use `cq:isContainer` on containers where markets add local components, and treat "suspend" as temporary.
- **On Cloud Service, MSM configuration is code.** Custom rollout configurations live under `/apps/msm/<project>/rolloutconfigs`, OSGi tweaks ship as `.cfg.json`, and rollouts run as asynchronous jobs.
- **It works with Edge Delivery Services too.** With Universal Editor (AEM authoring) and repoless, each MSM site maps 1:1 to an aem.live site sharing one codebase.
- **Governance decides success more than configuration.** Agree who can create live copies, cancel inheritance and run rollouts before the first market goes live.

## MSM, language copies or separate sites?

Start with vocabulary, because these terms get mixed up in workshops.

- **Blueprint (source):** the pages live copies are based on. A blueprint configuration points at a source path and unlocks the Rollout command and the Create Site wizard.
- **Live copy:** a copy that keeps a *live relationship* with its source. Shallow (one page) or deep (a page and its children).
- **Rollout and Synchronize:** rollout pushes changes from the blueprint to live copies; synchronize pulls them from the live copy side.
- **Language copy:** a language branch of a site, identified by its **language root** (for example `/content/acme/language-masters/fr`). Translation projects create and update language copies.

You need both for a multi-market estate, plus the judgement to know when neither is right.

| Situation | Use | Why |
|---|---|---|
| Same content, same language, several markets (`/de/de`, `/at/de`, `/ch/de`) | **MSM live copies** | Reuse with controlled local variation; one rollout updates all |
| Same content, different language | **Language copy + translation project** | Translation needs its own workflow, review and translation memory |
| Many markets in several languages | **Both:** translate language masters, then live copies per market | Translation cost scales with languages, not markets |
| A market with its own information architecture, products and team | **Separate site** (own branch, maybe own templates) | Inheritance would be cancelled almost everywhere; it's noise |
| Sub-brand that shares components but not content | **Separate site, shared code and templates** | Reuse belongs in code and templates, not live relationships |
| A one-off copy as a starting point | **Copy, or Create Site with "Live Copy" cleared** | No ongoing relationship to maintain |

My rule of thumb: if a market would cancel inheritance on more than about a third of its pages, it isn't a live copy, it's a separate site wearing a live copy costume. Make it a separate site and save everyone the pain.

## The content structure that scales

![Recommended content structure: an English language master is translated into German, French, Spanish and Japanese language masters, and each language master is the MSM source for market live copies]({{ '/assets/img/blog/aem-msm-language-copies/01-language-masters-to-market-live-copies.svg' | relative_url }}){: width="1200" height="640" loading="lazy" decoding="async"}

The structure I use, and the one Adobe's own examples (WKND, and the aem.live MSM guide) follow, looks like this:

```text
/content/acme
├── language-masters          ← not published as a site; source of truth
│   ├── en                    ← authored by the global team
│   ├── de                    ← language copy, translated from en
│   ├── fr
│   └── ja
├── de/de                     ← live copy of language-masters/de
├── at/de                     ← live copy of language-masters/de
├── ch/de, ch/fr              ← live copies of de and fr masters
├── fr/fr, be/fr
├── us/en, gb/en              ← live copies of language-masters/en
└── jp/ja
```

A few rules that save trouble later:

1. **Name language roots with ISO codes.** AEM recognises `en`, or language plus country as `en_GB`, `en_gb` or `en-gb`. The language root is how translation knows the target language, so get it right on day one.
2. **One level of grouping only.** Adobe allows language roots under a single grouping node such as `europe/de`. Two levels down (`americas/central-america/es`) are not detected as language copies. I prefer a flat `language-masters` folder.
3. **Country, then language, for markets.** `/content/acme/ch/fr` maps cleanly to `acme.com/ch/fr`, to Dispatcher or CDN rules, and to one repoless site per market on Edge Delivery Services.
4. **Masters are not a market.** Don't publish `language-masters` as a live site. It's tempting to make `/en` the US site; the day the US needs a local promotion, every other English market inherits it.
5. **Mirror the structure everywhere else.** Experience Fragments under `/content/experience-fragments/acme/<country>/<language>`, assets under `/content/dam/acme/<language>` where they need translation. The Core Components Experience Fragment component relies on that mirroring (more below).
6. **Add languages at the top of the blueprint.** Adobe warns that languages added below its first level, or content placed directly under a language root, won't carry over on rollout.

## How MSM behaves, and the parts that bite

### Rollout configurations, triggers and actions

A rollout configuration is a **trigger** plus an ordered list of **synchronisation actions**. AEM ships these:

| Installed configuration | Trigger | Actions |
|---|---|---|
| Standard rollout config | On Rollout | contentUpdate, contentCopy, contentDelete, referencesUpdate, productUpdate, orderChildren |
| Activate on Blueprint activation | On Activation | targetActivate |
| Deactivate on Blueprint deactivation | On Deactivation | targetDeactivate |
| Push on modify | On Modification | contentUpdate, contentCopy, contentDelete, referencesUpdate, orderChildren |
| Push on modify (shallow) | On Modification | contentUpdate, contentCopy, contentDelete, orderChildren |
| Promote Launch | On Rollout | contentUpdate, contentCopy, contentDelete, referencesUpdate, orderChildren, markLiveRelationship |

Other actions include `editProperties`, `notify`, `workflow` and `PageMoveAction`; a few, such as `targetActivate` and `PageMoveAction`, must be the only action in their configuration.

MSM resolves which configurations apply in this order: the live copy page, the blueprint source page, the live copy's parent, then the system default. In practice I set the configuration on the blueprint root and the live copy roots, and forbid anyone from changing it lower down.

Two things to know:

- **"Push on modify" is a trap at scale.** Adobe's own best practices warn that on-modification triggers can slow authoring, don't guarantee event order and can cause commit conflicts. I've never kept one in production for more than a handful of pages.
- **Page moves aren't rolled out by the standard config.** Creations and deletions are. For moves, Adobe recommends a separate configuration containing only `PageMoveAction`, with the On Rollout trigger, placed before the standard configuration.

### Components are aggregates

A rollout replaces a component *and all its children*. If a market adds a local teaser inside an inherited container, the next rollout removes it. The fix is to mark container components with `cq:isContainer`, so locally added children survive. Decide which containers get this flag at design time, as part of the component library, not after the first market complains.

### Cancel, suspend, reset and detach

| Action | Scope | Use it for |
|---|---|---|
| **Cancel inheritance** | One component (or a locked page property) | A permanent local variation |
| **Suspend** | A page (optionally with children) | A short-term exception, such as a market campaign |
| **Reset** | A page | Throwing away local changes and re-inheriting |
| **Detach** | A page or tree | Ending the relationship permanently. Cannot be undone |

The Live Copy Overview console in Sites lets you see a blueprint and its live copies and run rollout, synchronise, suspend, resume, reset and detach from one place. Make it part of every market editor's training: it's the fastest way to spot a page that was suspended "for two weeks" a year ago.

## Language copies and the translation framework

The translation side has four moving parts:

1. **A translation provider** configured in Translation Cloud Services. AEM includes a Microsoft Translator connector out of the box; human translation vendors provide their own connectors, and there's a manual XML export and import route when no connector exists.
2. **A Translation Integration Framework configuration** that sets, per site or asset tree, the method (machine, human or do not translate), the provider, whether tags and page assets are translated, whether jobs auto-execute, and whether updates send only changed fields.
3. **Translation rules** that decide which properties are translatable. Spend time here. Untranslated alt text and SEO titles are the classic finding in a multilingual audit.
4. **Translation projects** that bundle pages into jobs and track their status from Draft through Ready For Review to Complete.

The detail that matters most for architecture is how updates work. When a page already exists in the target language copy, AEM doesn't overwrite it. It puts a copy in a **launch**, imports the translation into the launch, and only overwrites the language copy when the launch is promoted. Project properties can auto-promote and delete those launches. That review step is what protects your German master from a half-finished translation.

If you edit translated text in AEM, **Update Translation Memory** sends the corrected strings back to the vendor's translation memory, provided the connector implements it. Make that a habit, or you'll pay to fix the same sentence every quarter.

### AI translation

In 2026, AEM Sites can use a large language model as a translation provider. Adobe's AI translation integration is configured in Translation Cloud Services; at launch it supports Azure OpenAI with your own licence and credentials. You can upload a style guide per locale, AEM generates editable translation rules for tone and terminology, and you set "agentic translation" as the method in the framework configuration. It then uses the same translation projects and launches as any other provider.

In my experience, the most valuable part is the per-locale style guide, not the model. Keep human review on regulated and high-traffic pages until you've measured quality.

## Combining MSM and translation without overwriting anyone

The flow I recommend for a 40-market estate:

1. The global team authors and approves in `language-masters/en`.
2. A translation project updates `language-masters/de`, `/fr`, `/ja` and so on. Reviewers in each language approve the launch and promote it.
3. Only then does someone roll out from each language master to its markets (`de/de`, `at/de`, `ch/de`).
4. Markets make local changes by cancelling inheritance on specific components, never by editing translated text that should have been fixed in the master.

The anti-pattern is translating *inside* live copies: making `/fr/fr` a live copy of the English master and translating it in place. Adobe's guidance says that if you do this, you must cancel inheritance on the translated pages or components so a rollout doesn't overwrite them with English, and that some connectors manage inheritance for you. It works for a few markets. At 40, you end up with every live copy cancelled everywhere and MSM doing nothing useful. Translate the masters instead.

The pay-off: translation cost scales with languages, not markets. French is translated once and rolled out to France, Belgium and Switzerland, and Swiss French can still cancel inheritance on its pricing component.

## Content Fragments, Experience Fragments and Assets

**Content Fragments.** MSM for Content Fragments is available in the Content Fragments console: you can create live copies of a fragment or a folder, roll out, synchronise, suspend, reset and detach. In the Content Fragment editor you can cancel inheritance per field or variation (for composite fields, only at the top level). The limits matter: only the Standard rollout config is supported, there are no on-modify triggers, you can't compare a source and its live copy, and you must remove **Unique** constraints from the models you copy. For translation, the framework can use the "Translatable" flag on Content Fragment Model fields to generate translation rules automatically.

**Experience Fragments.** Experience Fragments work with MSM and translation like pages. The useful trick is localisation in the Core Components Experience Fragment component: when it's placed on a template, and your XF tree mirrors the site structure, a header pointing to `/content/experience-fragments/acme/us/en/header` automatically renders `/content/experience-fragments/acme/ch/de/header` on a Swiss German page. It falls back through language root, blueprint and live copy. It only applies to XFs on templates, not ones dropped onto a page.

**Assets.** Asset translation uses the same language copy idea: language roots in the DAM, Create & Translate from the References panel, and metadata and tags translated with the asset. Machine translation translates metadata, not binaries. Separately, MSM for Assets lets you create live copies of asset folders. My advice: don't localise assets unless you must. Most images are language-neutral. Translate metadata (alt text, titles) and keep a single binary; create language copies only for assets with text in them.

## What's different on AEM as a Cloud Service

MSM and translation behave the same in the cloud. What changes is how you configure and operate them.

| Topic | AEM 6.5 habit | Cloud Service reality |
|---|---|---|
| Custom rollout configurations | Created in CRXDE on the server | Code in `ui.apps` under `/apps/msm/<project>/rolloutconfigs`, deployed via Cloud Manager |
| Excluding properties or node types from sync | OSGi console | `.cfg.json` for the action factory PIDs (for example `com.day.cq.wcm.msm.impl.actions.ContentUpdateActionFactory`) |
| Default rollout configuration | OSGi console | `.cfg.json` for `com.day.cq.wcm.msm.impl.LiveRelationshipManagerImpl` |
| Language list | Edit under `/libs` or `/apps` | Copy to `/apps/wcm/core/resources/languages`, point the Language Manager at it via code |
| Large rollouts | Long-running request | Asynchronous jobs, tracked on the Async Jobs status page, and schedulable |
| Programmatic rollout | Anywhere | MSM API is for author only |

A word on the OSGi action configurations: properties like `cq.wcm.msm.action.excludedprops` replace the default list rather than adding to it. Copy the current defaults from the Developer Console before you add your own pattern, or you'll start syncing `jcr:` and `cq:` properties you never meant to touch.

### Sample: two rollout configurations as code

A common need is a market rollout that never deletes pages automatically, plus Adobe's recommended page-move config. In `ui.apps`, under `src/main/content/jcr_root/apps/msm/acme/rolloutconfigs/`:

`market-rollout/.content.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0"
          xmlns:cq="http://www.day.com/jcr/cq/1.0"
    jcr:primaryType="cq:RolloutConfig"
    jcr:title="Acme market rollout (no deletes)"
    jcr:description="Standard rollout without contentDelete. Deletions are handled by a governed process."
    cq:trigger="rollout">
    <contentUpdate jcr:primaryType="cq:LiveSyncAction"/>
    <contentCopy jcr:primaryType="cq:LiveSyncAction"/>
    <referencesUpdate jcr:primaryType="cq:LiveSyncAction"/>
    <orderChildren jcr:primaryType="cq:LiveSyncAction"/>
</jcr:root>
```

`page-move/.content.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0"
          xmlns:cq="http://www.day.com/jcr/cq/1.0"
    jcr:primaryType="cq:RolloutConfig"
    jcr:title="Acme page move"
    cq:trigger="rollout">
    <PageMoveAction jcr:primaryType="cq:LiveSyncAction"/>
</jcr:root>
```

Add `<filter root="/apps/msm/acme"/>` to the `ui.apps` `filter.xml`. Action node names must match the installed action names exactly, and the order of child nodes is the order of execution. Then, on the blueprint and live copy roots, select "Acme page move" first and "Acme market rollout" second. Test on a Rapid Development Environment or a dev environment with a production-like tree before it goes anywhere near stage; pipeline and RDE guidance is in my post on [Cloud Manager pipelines and quality gates](/blog/2026/11/aem-cloud-manager-pipelines-quality-gates-rde-config-pipeline/).

Removing `contentDelete` also stops components deleted in the master from disappearing in markets, so someone has to clean those up. I use it only where an accidental deletion would be expensive. If you're coming from 6.5, configurations like these move from CRXDE-era nodes into code during the [cloud migration](/blog/2026/11/aem-on-premise-and-managed-services-to-aem-as-a-cloud-service-migration/).

## MSM with Edge Delivery Services and Universal Editor

If you deliver through Edge Delivery Services with AEM authoring (Universal Editor), MSM still lives in AEM author: live copies, rollouts and language copies are managed in the Sites console as usual. The delivery side is what changes.

The aem.live guide requires **repoless** for this. Each MSM site gets its own aem.live site, a 1:1 relationship, all sharing one GitHub repository and codebase. The steps are, in short: give each market its own configuration under `/conf/<brand>/<market>`, create an aem.live site per market through the configuration service with a path mapping (for example `/content/website/ch/` to `/`), and create an Edge Delivery Services cloud configuration per market folder with the project type "aem.live with repoless config setup".

I covered the configuration service, governance and the enterprise MSM topology in [Repoless on Edge Delivery Services](/blog/2026/10/aem-eds-repoless-one-codebase-many-sites/). For the authoring trade-offs between Universal Editor and documents, see [Universal Editor vs document-based authoring](/blog/2026/11/universal-editor-vs-document-based-authoring/). If your team is still choosing a delivery tier, [EDS vs traditional AEMaaCS](/blog/2026/11/aem-edge-delivery-services-vs-traditional-aemaacs/) is the place to start.

In my experience, market editors still need the Sites console for inheritance management on EDS projects, so include it in their training.

## Pitfalls I see on almost every estate

1. **Inheritance chains.** Market B is a live copy of market A, which is a live copy of the master. Adobe explicitly recommends limiting this kind of chained inheritance for performance and reliability. Every hop multiplies rollout time and makes "where did this text come from?" unanswerable.
2. **Page-level suspension as a habit.** A suspended page receives nothing, including legal copy fixes. Report on suspended pages monthly and expire them.
3. **Cancelling inheritance on whole containers.** One market changes one teaser and cancels the entire container. From then on, it misses every new component added in the master. Use `cq:isContainer` and cancel on the specific child.
4. **Rolling out the whole tree.** Rolling out a whole language master with all sub-pages to every market is a long asynchronous job. Roll out the changed section, schedule large rollouts off-peak, and watch the Async Jobs page.
5. **Deletions and unpublishing.** A rollout can remove pages or components in live copies; it doesn't on its own sort out what was already published, redirects or sitemaps. Treat deletions as a governed change with an unpublish and redirect step. If you're worried about SEO impact, the basics are in [what actually matters in SEO](/blog/2026/11/what-actually-matters-in-seo/).
6. **Reference rewriting surprises.** `referencesUpdate` rewrites references so live copies point at their own equivalent pages. Markets that excluded sections, or link across brands, can still end up with links into the master tree. Run a link check on each market after the first rollout.
7. **Wasted translation spend.** Translating live copies as well as masters, sending unchanged fields because "Disable Update-Only Translation" was ticked, or never using Update Translation Memory, so the same corrections are paid for every quarter.
8. **Author confusion.** Editors who don't understand the lock icon cancel inheritance to "unlock" a field and never re-enable it. Training beats tooling here.

## Governance recommendations

Configuration takes days. Governance decides whether MSM still works in year three.

**Roles and permissions**

- **Global content team:** edits language masters, owns the English master and translation projects.
- **Language reviewers:** approve and promote translation launches per language.
- **Market editors:** edit their market only and cancel inheritance on components. By policy, they don't suspend, detach or create live copies.
- **MSM administrators** (a small group): create live copies, run full-tree rollouts, detach, and own rollout configurations.

Model these as IMS-backed AEM groups with ACLs per `/content/acme/<country>` branch, so a market editor simply can't write to another market.

**Rules worth writing down**

- One level of inheritance: market from language master, never market from market.
- Local change means component-level cancel; page suspension needs a ticket and an expiry date.
- No new live copy without an owner, a rollout configuration and a launch date.
- Rollout cadence agreed with markets (for example, weekly plus urgent) and published.
- Translation rules reviewed whenever a component is added.
- Custom rollout configurations only through code review and the pipeline.

**Monitoring**

- A monthly report of suspended, cancelled and detached pages per market, plus rollout job durations: a sudden jump usually means someone created a chain.
- Accessibility and SEO checks per market after major rollouts. Local edits break things in local ways: see [fix the component, not the page](/blog/2026/11/accessibility-on-aem-fix-the-component-not-the-page/).

## FAQ

**Does MSM translate content?**
No. MSM creates structure and synchronises content between sources and live copies. Translation is handled by language copies, the Translation Integration Framework and a provider: Microsoft Translator out of the box, a vendor connector, or, in 2026, an LLM through the AI translation integration.

**Should every market be a live copy?**
No. Markets that share most of their content with a language master should be. Markets with their own IA, products and team are better as separate sites sharing code and templates. If a market would cancel inheritance on a large share of its pages, MSM is costing more than it saves.

**Can I put custom rollout configurations under /libs on Cloud Service?**
No. `/libs` and `/apps` are immutable at runtime. Put custom configurations under `/apps/msm/<project>/rolloutconfigs` in your `ui.apps` package and deploy them through Cloud Manager.

**How do translation updates avoid overwriting live content?**
When a target page already exists, AEM imports the translation into a launch. The language copy only changes when someone promotes the launch, unless you've configured the project to auto-promote.

**Does MSM work with Edge Delivery Services?**
Yes, with AEM authoring (Universal Editor) and repoless enabled. Each MSM site becomes its own aem.live site, mapped by path, sharing one codebase.

## Closing thought

MSM and translation in AEM scale well past 40 markets when the structure is boring: translated language masters, one level of live copies, component-level exceptions, and configuration in code. Most problems I'm asked to fix come from shortcuts taken in the first three months, such as chaining markets or translating inside live copies, that become very expensive to undo once hundreds of pages depend on them.

Spend a week on structure and governance before the first rollout. It's the cheapest week of the programme.

Designing or untangling a multi-site, multilingual AEM estate? [Get in touch](/contact/).

### References

- [Multi Site Manager and Live Copy overview](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/sites/administering/reusing-content/msm/overview) (Experience League)
- [MSM best practices](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/sites/administering/reusing-content/msm/best-practices) (Experience League)
- [Configuring Live Copy synchronization](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/sites/administering/reusing-content/msm/live-copy-sync-config) (Experience League)
- [Creating and synchronizing Live Copies](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/sites/administering/reusing-content/msm/creating-live-copies) (Experience League)
- [Extending the Multi Site Manager](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/configuring-and-extending/msm) (Experience League)
- [Translating content for multilingual sites](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/sites/administering/reusing-content/translation/overview) (Experience League)
- [Preparing content for translation](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/sites/administering/reusing-content/translation/preparation) (Experience League)
- [Configuring the Translation Integration Framework](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/sites/administering/reusing-content/translation/integration-framework) (Experience League)
- [Managing translation projects](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/sites/administering/reusing-content/translation/managing-projects) (Experience League)
- [AI translation integration](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/sites/administering/reusing-content/translation/ai-translation-integration) (Experience League)
- [MSM for Content Fragments](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/sites/administering/content-fragments/msm-for-content-fragments) (Experience League)
- [Experience Fragment component (localisation)](https://experienceleague.adobe.com/en/docs/experience-manager-core-components/using/wcm-components/experience-fragment) (Experience League)
- [Translate assets](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/admin/translate-assets) (Experience League)
- [Reuse assets using MSM for Assets](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/manage/reuse-assets-using-msm) (Experience League)
- [Multi site management with AEM authoring as your content source](https://www.aem.live/developer/repoless-multisite-manager) (aem.live)

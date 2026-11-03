---
layout: post
title: "Universal Editor vs document-based authoring on Edge Delivery Services: which to pick and when"
seo_title: "Universal Editor vs Document Authoring on AEM EDS"
description: "Universal Editor, Experience Workspace (formerly Document Authoring) or Word and Google Docs for AEM Edge Delivery Services: trade-offs and a decision guide."
ai_summary: "Edge Delivery Services offers three authoring models: Word or Google Docs, Experience Workspace (formerly Document Authoring) and AEM authoring with the Universal Editor. All three publish through the same delivery path, so the choice is about governance, author experience and where content lives. The Universal Editor suits regulated and multi-market estates, Experience Workspace suits new sites, and documents get familiar teams publishing fastest."
date: 2026-11-03 18:00:00 +0530
category: edge-delivery-services
tags: [AEM, Edge Delivery Services, Universal Editor, Authoring]
---

Once a team decides to build on Edge Delivery Services (EDS), the next argument starts almost immediately: *how will people actually author this site?* Marketing wants to keep writing in Word. The AEM platform team wants Universal Editor, workflows and MSM. Someone has seen a demo of Adobe's browser-based editor and asks why we wouldn't just use that.

Delivery is the same whichever way you go. Authoring is not: it decides where content lives, how much structure and validation you get, how translation and approvals work, how developers model blocks, and how painful it is to change your mind later. It is the decision I see teams spend the least time on and regret the most.

The landscape has also moved in 2026: Document Authoring (da.live) is now **Experience Workspace**, and Adobe's recommendations differ depending on which documentation you read. This post sets out what each option is today, compares them, and ends with a decision guide and scenarios.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **There are three serious authoring models for EDS sites:** document-based (Word and Excel in SharePoint, or Google Docs and Sheets in Drive), **Experience Workspace** (formerly Document Authoring, on da.live) and **AEM authoring with the Universal Editor** (the "xwalk" model, content in AEM as a Cloud Service).
- **All three publish to the same Content Bus** and the same `aem.page` and `aem.live` delivery. Performance is not the differentiator. Governance, author experience and content location are.
- **Universal Editor on AEM** wins when you need field-level models and validation, AEM workflows, MSM Live Copies, Launches, AEM translation integrations and deep AEM Assets use.
- **Experience Workspace** is now what aem.live encourages for new projects, and it has picked up versions, approvals, MSM, translation connectors and scheduling. It is not the AEM author repository, and that matters.
- **Word and Google Docs** remain the fastest way to get a familiar team publishing, with the least structure and the weakest guardrails.
- **You can mix them** across sites in one organisation, especially with repoless. Moving a live site between models later is a content migration, so choose deliberately.

## The three authoring models in 2026

![Comparison of document-based authoring, Experience Workspace and AEM authoring with the Universal Editor, all publishing to the Edge Delivery Content Bus]({{ '/assets/img/blog/ue-vs-document-authoring/01-authoring-options-compared.svg' | relative_url }}){: width="1200" height="630" loading="lazy" decoding="async"}

The aem.live authoring guide lists five options: Experience Workspace, Microsoft Word and Excel, Google Docs and Sheets, the AEM Content Fragment Editor and the AEM Universal Editor. The Content Fragment Editor is for structured, headless content, so for page authoring the real choice is between three models.

### Document-based: Word, Excel, Google Docs and Sheets

Authors write in the tools they already use. A page is a document, sections are separated by `---` or a horizontal rule, and a **block** is a table whose first row names the block, for example `Cards (highlight)`. Spreadsheets become JSON endpoints, which is how metadata, redirects, placeholders and navigation data are managed. Authors preview and publish using the **AEM Sidekick** browser extension.

You get speed and zero training, but no real validation: if an author breaks a block table, the block breaks.

### Experience Workspace (formerly Document Authoring)

Document Authoring (DA), Adobe's own browser-based document editor at da.live, is now called **Experience Workspace**. Adobe describes the change as "an upgrade, not a migration": existing DA content and integrations keep working, and enabling the new experience is optional (it's switched on with an `ew.enabled` flag). On top of the original document editor it adds a WYSIWYG canvas with a layout mode, an AI assistant (which can be disabled with a flag), MCP and REST APIs, and integration with AEM Assets and Dynamic Media.

The CMS features around it have grown considerably. The current documentation covers version history, snapshots, comments, sheets, a form-based **structured content** editor driven by schemas, a **Request Publish** approval workflow, **Schedule Publish**, a **Multi-Site Manager** app and **translation projects** with connectors.

One important constraint: Adobe states that Experience Workspace "only works with the document-based repository of Edge Delivery Services". It is not an editor for content that lives in AEM Author.

### AEM authoring with the Universal Editor

Here content lives in the AEM as a Cloud Service author repository. Authors work in the **Universal Editor** (UE) for in-context editing and the **Sites console** for page management. When an author publishes, AEM renders semantic HTML for EDS ingestion and the page goes to preview or live. Adobe's documentation lists workflows, MSM, translation and Launches as available through AEM in this setup.

Projects start from the `aem-boilerplate-xwalk` template, and blocks are instrumented for the UE with three JSON files at the project root: `component-definition.json`, `component-models.json` and `component-filters.json`. More on those in the developer section below.

### Universal Editor on other content sources

The UE is content-agnostic and can also edit Experience Workspace content (aem.live calls this the "Author Bus"), using the same instrumentation files. Its status needs care. Adobe's own FAQ calls authoring in AEM with the UE "the official, non-early access expression of the Universal Editor", setup requires Universal Editor to be enabled on your IMS organisation (it notes this "currently requires AEM Sites credits"), and the docs now say: "For new projects, we recommend Experience Workspace instead of Universal Editor." For Adobe Commerce storefronts, the UE-on-DA path is already marked deprecated for new storefronts. I would not start a new project on it in late 2026.

### What Adobe recommends depends on which page you read

Experience League's AEM Sites authoring-methods page still calls the Universal Editor "the first choice for AEM projects leveraging Edge Delivery Services". The aem.live Experience Workspace page says "AEM Authoring remains fully supported on aem.live. However new projects are encouraged to use the rich new features of Experience Workspace", and that "for headless use cases, the Universal Editor is still recommended."

My reading: Adobe is investing heavily in Experience Workspace as the EDS-native CMS, while AEM authoring with the UE remains the supported enterprise-governance path. Adobe's partner guidance on aem.live puts it well: there is "never a right or wrong direction, but a mismatch of needs vs feature set".

## Author experience

| | Word / Google Docs | Experience Workspace | AEM + Universal Editor |
|---|---|---|---|
| **Editing surface** | Desktop or web document editor | Browser canvas and document editor | In-context page editor plus properties panel |
| **WYSIWYG** | No; preview via Sidekick | Yes, canvas with layout mode and live preview | Yes, the page renders with your real code |
| **Familiarity** | Highest | High for anyone who writes documents | Lower; new to most authors, including Page Editor users |
| **Copy, paste, undo** | Excellent | Good | Weaker |
| **Guidance and validation** | None beyond templates | Partial: library, templates, structured content schemas | Strong: typed fields, required fields, filters |
| **Collaboration** | Real-time co-editing, comments | Multi-user editing, comments | AEM workflows, versions and page locking |
| **External authors (agencies)** | Easy: share the folder | IMS email-based access | AEM user provisioning |

Adobe publishes a weighted decision rubric behind the aem.live authoring guide, and it matches what I see in workshops. For "Is copy, paste, and undo important in the workflow?" it scores Word and Google at 1, Experience Workspace at 1 and the Universal Editor at −0.7. For "Is input validation and author guidance needed?" it flips: Universal Editor at 1, Experience Workspace at 0.5, Word and Google at −0.5. For "Is authoring speed and time to market critical?" the UE scores −0.5.

In my experience that last point is about onboarding, not daily speed. Authors who know a well-modelled UE site are quick, but the first month is slower, and AEM-trained authors miss Page Editor features the UE leaves out, such as layout mode and the Style System.

## Content structure and governance

This is where the options really diverge.

**Content models and validation.** With AEM authoring, every block has a model in `component-models.json`: typed fields (text, rich text, reference, select, boolean and so on), labels, defaults and validation, plus filters that control which blocks can go where. Authors fill in forms rather than build tables. With documents, structure is a convention that authors must follow. Experience Workspace sits in between: pages are still documents, but you can offer a block library and templates, and its structured content feature gives form-based editing against schemas for data-like content (published as JSON rather than pages).

**Workflow and approval.** AEM gives you AEM workflows, Launches for future-dated versions of content, and scheduled publication through Manage Publication. Experience Workspace now has a Request Publish workflow: authors submit, approvers get an email and approve or reject in an inbox app. Note the setup: you need to be onboarded by Adobe and bring your own email provider. Schedule Publish is a Prepare-menu plugin you enable per site. Word and Google Docs have nothing built in beyond who holds publish rights; teams usually bolt on a manual review step.

**Permissions.** For AEM authoring, it's AEM users, groups and ACLs, managed the way your AEM team already does. For Experience Workspace, authoring rights are read or write on folders and files for IMS organisations, IMS groups or email addresses, set in the da.live config. For SharePoint and Google Drive, it's the document platform's own sharing model. In every case, **preview and publish rights on EDS** are a separate layer, configured through the EDS Configuration Service. Plan both.

**Audit and versioning.** AEM has page versions and audit logs. Experience Workspace has version history and snapshots. SharePoint and Drive have file versioning. EDS itself keeps an audit log of preview and publish operations, whichever source you use.

My view: if you must evidence who approved what and when, AEM is still the most complete and easiest to explain to an auditor. Experience Workspace covers a lot of it now, but you configure and integrate more yourself.

## Assets, localisation and multi-site

### Assets

With AEM authoring, authors pick from AEM Assets in the UE, and referenced assets are **published with the page** through a technical account. Assets must respect EDS limits (for example 20 MB for images and PDFs, and a 10,000 px maximum side for on-the-fly image optimisation). Private asset folders need access granted to that account.

Experience Workspace integrates with AEM Assets and Dynamic Media too, and supports direct uploads. With Word and Google Docs, images are embedded in the document and pushed to the EDS media bus on preview. That's simple, but it isn't asset management: no rights metadata, no renditions, no reuse across sites without copying. If brand assets are governed in AEM Assets, that tips the decision away from plain documents.

### Translation and localisation

On AEM authoring you get the AEM translation framework with your existing connectors, language copies and translation projects. Experience Workspace ships with Google Translate out of the box, plus connectors for **Lionbridge, Smartling and Trados**, and supports custom connectors. Translation projects take a list of URLs to localise. For Word and Google Docs, translation is typically a manual or vendor-driven file process.

Adobe's EDS guidance on localisation is worth reading regardless of authoring choice: it recommends a language-first URL structure (for example `/en/`, `/en/us/`, `/es/mx/`) to avoid the duplicate-content mess of market-first estates.

### Multi-site and MSM

With AEM authoring, MSM and Live Copies work with EDS, but **you must enable repoless**: each localised site becomes its own EDS site sharing one codebase, mapped 1:1 to an AEM site. I covered repoless in detail in [Repoless on AEM Edge Delivery Services](/blog/2026/10/aem-eds-repoless-one-codebase-many-sites/), and MSM language copies in [AEM MSM and language copies on Cloud Service](/blog/2026/11/aem-msm-language-copies-cloud-service/).

Experience Workspace has its own MSM model: a **base** site and **satellite** sites, where a satellite inherits any page it doesn't have locally. Authors can detach a page, sync it back with a three-way merge that preserves local edits where possible, replace it, or reconnect it to the base. It's simpler than AEM's Live Copy and rollout configs. For many brand and market estates, simpler is fine. For estates with complex rollout rules, AEM is still the more capable tool.

## Developer model: blocks are not quite the same

The front-end code is the same in all three: vanilla JavaScript and CSS blocks in GitHub, decorated in the browser. What differs is the **content model behind each block** and the markup the block receives.

In document-based projects, the block's structure *is* the author's table. Developers write `decorate(block)` against rows and cells, and document the table layout for authors.

In UE projects, developers define the block for the editor. A minimal model looks like this:

```json
{
  "id": "quote",
  "fields": [
    { "component": "richtext", "name": "quote", "label": "Quote", "valueType": "string" },
    { "component": "text", "name": "author", "label": "Author", "valueType": "string" }
  ]
}
```

The definition registers it with the UE using the generic block resource type:

```json
{
  "title": "Quote",
  "id": "quote",
  "plugins": {
    "xwalk": {
      "page": {
        "resourceType": "core/franklin/components/block/v1/block",
        "template": { "name": "Quote", "model": "quote" }
      }
    }
  }
}
```

And the section filter controls where it can be added:

```json
{ "id": "section", "components": ["text", "image", "button", "title", "hero", "cards", "columns", "quote"] }
```

AEM then renders the stored fields as rows and cells, using conventions you need to know: field names ending in `Alt`, `Title`, `Type`, `MimeType` or `Text` collapse into attributes of another field (so `image` plus `imageAlt` becomes one image), types are inferred, and fields sharing a prefix with an underscore (`teaserText_title`, `teaserText_cta1`) are grouped into one cell.

Three practical consequences:

1. **Model first.** Adobe recommends building UE blocks in three phases: definition and model, then content, then decoration. Changing a model after authors have created content means migrating that content.
2. **The three JSON files grow quickly.** Keep them per block and merge them in a build step. Adobe's `da-block-collection` uses a `build:json` script for exactly this, with a pre-commit hook.
3. **Editor-aware JavaScript.** Blocks that restructure the DOM can lose the UE's instrumentation attributes, and interactive blocks like carousels and accordions need to react to selection in the editor. Plan a `ue.js` for those cases.

A block written for document authoring usually needs rework for the UE, and vice versa.

## Preview, publish, sheets and bulk operations

**Preview and publish.** Document-based sites use the Sidekick. Experience Workspace publishes from the editor and its apps, and also supports the Sidekick. AEM authoring publishes from the UE (destination Preview or Live), or from the Sites console using Quick Publish or Manage Publication, which also supports scheduling. AEM runs pre-publish validations, such as a single valid JSON-LD block per page and asset size limits, and aborts with an error if they fail. That's useful governance that document-based sources don't give you.

**Sheets.** Every model supports the EDS spreadsheet features: bulk metadata, redirects, placeholders, headers and your own JSON data. In SharePoint and Drive they're Excel workbooks or Google Sheets. In Experience Workspace they're sheets in the editor. With AEM authoring you create them in the Sites console from templates (Redirects, Placeholders and so on) and can import CSV. Limits apply everywhere: 100,000 redirects per site, 100k rows or 500k cells per spreadsheet, and 6 MB compressed per JSON response.

**Bulk operations.** Experience Workspace has a Bulk Operations app (preview, publish, version and more against a list of URLs) and ecosystem apps for search-and-replace. AEM has the Sites console, Manage Publication and MSM rollouts. SharePoint and Drive rely on the Sidekick and the Admin API. Note that rate limits on preview come from the underlying source, and aem.live specifically calls out "some rate limiting" for SharePoint. On large initial loads, script against the Admin API and throttle.

## Scale, licensing and migration

### Scale

The delivery limits are the same for all sources: up to 1 million pages per site as a recommended maximum, 50,000 pages per query index and 50,000 URLs per sitemap file. The authoring limits are where scale differs. Hundreds of authors across dozens of markets with role-based permissions and approvals is AEM's home ground. A small team running dozens of campaign microsites is where documents and Experience Workspace shine.

### Licensing caveats

I won't quote prices, because they depend on your contract. What I can say from the documentation: EDS is part of AEM Sites and requires an AEM Sites licence. AEM authoring obviously needs an AEM as a Cloud Service author environment. The UE on non-AEM content "currently requires AEM Sites credits". Word or Google authoring also depends on your Microsoft 365 or Google Workspace licences and admin consent to connect them. Confirm the commercial position for Experience Workspace features such as Request Publish and translation connectors with your Adobe account team before you design around them.

### Migration between models

- **Word or Google Docs to Experience Workspace:** the most straightforward. Experience Workspace has an import app that takes a list of published `aem.page` or `aem.live` URLs. The Admin API status job gives you that list. Validate after import; redirects need separate handling.
- **AEM authoring to Experience Workspace:** Adobe says content in AEM Author must be moved to the document-based repository and to contact them for details. The same import route works from your published pages, but you lose AEM-side metadata, workflows and MSM relationships, and your UE models no longer apply.
- **Documents or Experience Workspace to AEM authoring:** this is a real content migration into the JCR plus re-modelling blocks for the UE. Budget it like one.

Decide per site, before content production starts.

## Decision guide

| Question | If yes, lean towards |
|---|---|
| Do you already run AEM as a Cloud Service with trained authors, workflows and MSM? | **AEM + Universal Editor** |
| Do you need audited approvals, required fields and strict author guidance? | **AEM + Universal Editor** |
| Are brand assets governed in AEM Assets and reused across sites? | **AEM + UE**, or **Experience Workspace** |
| Is professional translation with an existing TMS in scope? | **AEM + UE** (existing connectors) or **Experience Workspace** (Lionbridge, Smartling, Trados) |
| Do authors live in Word or Google Docs and need to publish this quarter? | **Document-based** |
| Do external agencies author frequently, and does the roster change often? | **Document-based** or **Experience Workspace** |
| Is this a new EDS-only site with no AEM author tier? | **Experience Workspace** |
| Is the content largely data (products, locations, events)? | **Structured content** in Experience Workspace, Content Fragments in AEM, or JSON2HTML |
| Do you want AI-assisted authoring in the editor? | **Experience Workspace** (assistant can be disabled) |

### Scenario recommendations

**Marketing team already in Microsoft 365.** Word and Excel in SharePoint, if the site is content-led, the team is small and nobody needs field validation. It's the fastest route to live. If you expect approvals, translation or many more authors within a year, go straight to Experience Workspace and accept a little training.

**Regulated enterprise with an approval workflow.** AEM authoring with the Universal Editor. Workflows, versioning, permissions and audit trails are mature, your compliance team already understands them, and pre-publish validations add a further gate. Experience Workspace's Request Publish is promising, but it requires Adobe onboarding and your own email integration, and I'd want to see it pass your audit requirements before committing.

**Multi-market estate with MSM.** If you already use AEM MSM, keep it: AEM authoring plus repoless, one EDS site per localised AEM site, one codebase. For a new estate with simple inheritance (a base site and market satellites that override a few pages), Experience Workspace MSM is genuinely simpler. Decide based on how complex your rollout rules really are, not how complex they were on the old platform.

**Campaign microsites.** Experience Workspace or Google Docs, on repoless sites that reuse the main design system. Speed matters more than governance, sites are short-lived, and agencies can be given access without provisioning AEM users.

**Existing AEM investment.** AEM authoring with the UE for the main estate, so you keep content, workflows, MSM, translation and Assets. Use document-based or Experience Workspace sites for campaigns and experiments alongside it. This is the hybrid I see most often in 2026.

## Mixing authoring models

You don't have to choose one model for the whole organisation. Different EDS sites can use different content sources while sharing one GitHub codebase through repoless, and the Configuration Service holds the content source per site. A typical pattern is AEM authoring for the governed corporate and market sites, plus Experience Workspace for campaigns.

Two cautions. First, **blocks need to cope with both content shapes** if they're shared between a UE site and a document site. Test each block against both, or keep separate variants. Second, **within one site, keep one source of truth.** Splitting one site's pages across two authoring systems complicates permissions, publishing and support, so avoid it unless there is a clear, time-boxed reason such as a phased migration.

Whatever you pick, delivery is the same, so the performance work from [keeping Lighthouse at 100](/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/) applies equally. If you're still deciding whether EDS is right at all, start with [EDS vs traditional AEM as a Cloud Service](/blog/2026/11/aem-edge-delivery-services-vs-traditional-aemaacs/).

## FAQ

**Is Document Authoring (da.live) being retired?**
No. It has been renamed Experience Workspace and extended. Adobe states existing DA content, integrations and API usage keep working, and the new workspace experience is enabled with a flag. The da.live URLs are still in use.

**Is the Universal Editor deprecated for Edge Delivery Services?**
Not for AEM authoring. Adobe describes authoring in AEM with the UE as the official, non-early access form of the editor, and aem.live says AEM authoring "remains fully supported". What Adobe now steers away from for new projects is using the UE on top of Experience Workspace content; for Commerce storefronts that path is marked deprecated.

**Can I use Experience Workspace to edit content stored in AEM Author?**
No. Adobe says Experience Workspace only works with the document-based repository of Edge Delivery Services. Content in AEM Author would have to be moved, and you would lose AEM-side features such as workflows and Live Copies.

**Do I need AEM Author at all for an EDS site?**
No. Document-based and Experience Workspace sites run without an author tier. You still need an AEM Sites licence for EDS. You only need AEM Author if you choose AEM authoring with the Universal Editor.

**Which option gives authors the most guidance?**
AEM authoring with the UE: typed fields, required fields and filters on which blocks can go where. Experience Workspace offers templates, a block library and schema-driven structured content. Word and Google Docs offer conventions only.

**Can authors switch from Word to the Universal Editor later?**
Yes, but it's a migration. Content must be imported into AEM and blocks re-modelled for the UE. Going the other way, from Word or Google Docs to Experience Workspace, is much easier with the import app.

## Closing thought

The authoring decision is about people and governance, not technology. All three models land on the same fast delivery path. The question is whether your authors need the structure, workflow and multi-market machinery of AEM, or whether a document-centric workspace gets them publishing sooner with enough control.

My default in late 2026: **AEM authoring with the Universal Editor** where an AEM estate, regulatory approvals or complex MSM already exist, and **Experience Workspace** for new EDS-only sites and campaigns. Word and Google Docs remain a perfectly good start for small, content-led teams. Whatever you choose, let real authors try it on real content before you sign off.

Choosing an authoring model for an Edge Delivery Services programme? [Get in touch](/contact/).

### References

- [Authoring guide: choosing an authoring option](https://www.aem.live/docs/authoring-guide) (aem.live)
- [Authoring decision rubric data](https://www.aem.live/tools/decisions.json?sheet=authoring) (aem.live)
- [About Experience Workspace](https://www.aem.live/docs/ew/about) (aem.live)
- [Document Authoring is now Experience Workspace](https://www.aem.live/docs/ew/da-is-ew) (aem.live)
- [Authoring with AEM and the Universal Editor](https://www.aem.live/docs/aem-authoring) (aem.live)
- [Content modelling and component model definitions](https://www.aem.live/developer/component-model-definitions) (aem.live)
- [Creating blocks instrumented for the Universal Editor](https://www.aem.live/developer/universal-editor-blocks) (aem.live)
- [Set up the Universal Editor for Experience Workspace](https://www.aem.live/docs/ew/administering/set-up-universal-editor) (aem.live)
- [Publishing content from AEM Sites authoring to Edge Delivery Services](https://www.aem.live/docs/publishing-from-authoring) (aem.live)
- [Multi-site management with AEM authoring (repoless MSM)](https://www.aem.live/developer/repoless-multisite-manager) (aem.live)
- [Experience Workspace: Multi-Site Manager](https://www.aem.live/docs/ew/administering/multi-site-manager) (aem.live)
- [Experience Workspace: Request Publish](https://www.aem.live/docs/ew/administering/request-publish) (aem.live)
- [Experience Workspace: Translation](https://www.aem.live/docs/ew/administering/translation) (aem.live)
- [Experience Workspace: Permissions and security](https://www.aem.live/docs/ew/administering/permissions) (aem.live)
- [Limits](https://www.aem.live/docs/limits) (aem.live)
- [Authoring methods for AEM Sites](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/sites/authoring/authoring-methods) (Adobe Experience League)

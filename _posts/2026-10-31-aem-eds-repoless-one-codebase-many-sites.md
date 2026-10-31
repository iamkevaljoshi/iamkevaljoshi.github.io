---
layout: post
title: "Repoless on AEM Edge Delivery Services: one codebase, many sites"
seo_title: "Repoless AEM Edge Delivery Services: One Codebase, Many Sites"
description: "Repoless on AEM Edge Delivery Services: how one codebase serves many brands, markets and environments, setup with DA or AEM authoring, and governance."
date: 2026-10-31 13:00:00 +0530
tags: [AEM, Edge Delivery Services, Repoless, Architecture]
---

Almost every enterprise I work with runs more than one website. Usually it's the same brand in twenty markets. Sometimes it's five brands on one design system, or a main site plus a steady stream of campaign microsites. On classic AEM we solved this with shared component libraries, MSM and careful package management. On Edge Delivery Services (EDS), the first instinct is often to create one GitHub repository per site.

That works for site number two. By site number ten you're running a code-replication business: cherry-picking the same block fix across repos, chasing drift and reviewing the same pull request over and over.

**Repoless** is Adobe's answer. One codebase serves many sites, and what makes each site different is configuration, not code. In this post I'll cover what repoless is, why and when to use it, how to set it up with both Document Authoring and AEM authoring (Universal Editor), and, most importantly for enterprise programmes, how to govern it.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **Repoless** lets many EDS sites share **one GitHub repository**. Only your first (canonical) site needs a repo; every other site is created through the **Configuration Service** API and points at that same code.
- Each site keeps its **own content source, domain, indexes, sitemap, metadata, access rules and CDN config**.
- Use it for **multi-market, multi-language (MSM), multi-brand, separate stage/prod environments**, and for splitting very large estates.
- The trade-off is **blast radius**: every push reaches every site. Treat the shared repo as a product, treat configuration as code, and design differences as config, not forks.

## The problem repoless solves

![Repo per site versus repoless: one codebase serving many sites]({{ '/assets/img/blog/eds-repoless/01-repo-per-site-vs-repoless.svg' | relative_url }}){: width="1200" height="500" loading="lazy" decoding="async"}

In the original EDS model, a site *was* a GitHub repo. The `fstab.yaml` in the repo pointed at the content, and the site URL was literally `branch--repo--owner.aem.page`. Code and site were bound one-to-one.

For a multi-site estate that creates a familiar set of problems:

- **Duplication.** Every block, style and script exists N times.
- **Drift.** Within a few months, "the same" header block has five subtly different implementations.
- **Release friction.** One accessibility fix becomes N pull requests, N reviews and N deployments.
- **Slow site launches.** A new market means a new repo, a new Code Sync install, new pipelines and new config files before anyone writes content.

Repoless breaks the one-to-one binding. A site becomes a configuration object that *references* a codebase instead of *owning* one.

## How repoless works

Repoless is built on the **Configuration Service**, which is managed through REST calls to the Admin API (`admin.hlx.page`). It introduces a small, clean domain model:

![Configuration Service model: organization, profiles, code, content sources and sites]({{ '/assets/img/blog/eds-repoless/02-configuration-service-model.svg' | relative_url }}){: width="1200" height="570" loading="lazy" decoding="async"}

- **Organization.** The top-level container. It carries the same name as your GitHub org, so there are no naming conflicts. An org holds sites, profiles and users.
- **Code (repository).** One GitHub repo per codebase, connected via **AEM Code Sync**. Your first site, the *canonical* site, keeps the code synchronised. When you push, every site using that codebase gets the update.
- **Content source.** Where a site's content comes from when authors preview and publish: AEM authoring (Universal Editor), Document Authoring, SharePoint, Google Drive or BYOM.
- **Profile.** A reusable bundle of configuration (headers, index definitions, additional metadata, Sidekick plugins and so on) that many sites can share. A site can have at most one profile, and where a site and its profile disagree, **the site wins**.
- **Site.** The thing that combines code, content and configuration into a web experience. A site lives at `https://main--{site}--{org}.aem.page`.

The key point: **which code a site uses is just a configuration setting.** Point ten sites at the same repo and you have ten sites on one codebase.

### Configuration moves from files to an API

This is the part teams underestimate. In "document mode", configuration was scattered across the repo and the content source. With the Configuration Service it's centralised and managed via API:

| Concern | Document mode | Configuration Service |
|---|---|---|
| Content source | `fstab.yaml` | ContentConfig |
| Folder mappings | `fstab.yaml` | FoldersConfig |
| Headers | `.helix/headers.xlsx` | HeadersConfig |
| CDN, access, extra metadata | `.helix/config.xlsx` | CDN / Access / Metadata config |
| Index definitions | `helix-query.yaml` | IndexConfig |
| Sitemap | `helix-sitemap.yaml` | SitemapConfig |
| robots.txt | `robots.txt` in GitHub | RobotsConfig |
| Sidekick plugins | `tools/sidekick/config.json` | SidekickConfig |

Once the Configuration Service is enabled, its settings override the files in your repo and content source. **Delete the old files** so nobody edits a `fstab.yaml` that no longer does anything. (I've seen that cost a team half a day.)

## Why enterprises use it

These are the drivers I see on real programmes, roughly in order of frequency:

1. **Multi-market and multi-language with MSM.** One blueprint in AEM, live copies per market, and one EDS site per market, all on the same code.
2. **Multi-brand on a shared design system.** Brands differ in design tokens, logos and content, not in how a carousel works.
3. **Environment separation.** Separate staging and production sites (fed from AEM stage and prod authors) running the same codebase.
4. **Fast launches.** Campaign microsites, event sites or new markets become an API call plus content, not a repo-bootstrapping project.
5. **Scaling very large estates.** Adobe's guidance for large sites is to keep a single site up to around a million pages (splitting indexes and sitemaps by section), and to consider splitting into multiple repoless sites beyond that, typically along market, brand or business-unit lines.
6. **Consolidation after M&A or re-platforming.** Several legacy sites land on one platform codebase without forcing them into one content tree.

The common thread: **many sites that look and behave mostly the same but have different content, owners or lifecycles.**

## Setting it up

### Option A: Document Authoring or SharePoint content

Prerequisites: a canonical site already set up with code and content (the developer tutorial gets you there), an Admin API access token, and the content source URL for the new site.

Creating a repoless site is a single `PUT`:

```bash
curl -X PUT https://admin.hlx.page/config/acme/sites/brand-ch.json \
  -H 'x-auth-token: <token>' \
  -H 'content-type: application/json' \
  --data '{
    "code": { "owner": "acme", "repo": "brand-web" },
    "content": {
      "source": { "url": "https://content.da.live/acme/brand-ch/" }
    }
  }'
```

The site is immediately available at `https://main--brand-ch--acme.aem.page`. It shows the 404 page until you preview some content. For local development, point the AEM CLI at the site you're working on:

```bash
aem up --url https://main--brand-ch--acme.aem.page
```

### Option B: AEM authoring (Universal Editor)

This is the common enterprise path, and it has a few more steps. You need **AEM as a Cloud Service 2025.4 or later** and the Configuration Service set up.

**1. Get an Admin API token.** Log in at `admin.hlx.page/login` with your Adobe identity and use the resulting token in `x-auth-token` headers.

**2. Point the site at your code and your AEM author.** The content source is AEM's Edge Delivery endpoint, configured as markup:

```bash
curl -X PUT https://admin.hlx.page/config/acme/sites/brand-web.json \
  -H 'content-type: application/json' \
  -H 'x-auth-token: <token>' \
  --data '{
    "code": {
      "owner": "acme",
      "repo": "brand-web",
      "source": { "type": "github", "url": "https://github.com/acme/brand-web" }
    },
    "content": {
      "source": {
        "url": "https://author-p12345-e67890.adobeaemcloud.com/bin/franklin.delivery/acme/brand-web/main",
        "type": "markup",
        "suffix": ".html"
      }
    }
  }'
```

**3. Publish the path mappings.** Create a page from the Configuration template at the root of your site in AEM, then map the content and that configuration page via the site's public config:

```bash
curl -X POST https://admin.hlx.page/config/acme/sites/brand-web/public.json \
  -H 'content-type: application/json' \
  -H 'x-auth-token: <token>' \
  --data '{
    "paths": {
      "mappings": [
        "/content/brand/:/",
        "/content/brand/configuration:/.helix/config.json"
      ],
      "includes": ["/content/brand/"]
    }
  }'
```

Check it with `https://main--brand-web--acme.aem.live/config.json`. From here, `paths.json` and `fstab.yaml` in the repo are ignored, so remove them.

**4. Grant the technical account publish rights.** Copy the technical account ID from AEM's **Edge Delivery Services Configuration** (Authentication tab) and give it the `config_admin` role in the site's `access.json`, alongside your named admins.

**5. Switch the project type.** In the same Cloud Services configuration, change the project type to **"aem.live with repoless config setup"**, then confirm the site still renders in the Universal Editor and that a re-publish shows up on `aem.page`.

### Scaling out: MSM markets and environments

With the base site in place, every additional market is another site config pointing at the same repo, plus its own path mappings and its own Cloud Services configuration in AEM. The relationship is **one AEM MSM site to one aem.live site**:

![Enterprise topology: AEM authoring with MSM live copies, one aem.live site per market, shared repository and per-market domains]({{ '/assets/img/blog/eds-repoless/03-enterprise-topology-msm.svg' | relative_url }}){: width="1200" height="570" loading="lazy" decoding="async"}

The same pattern gives you **clean environment separation**. Your stage author publishes to `brand-de`, your prod author publishes to `brand-de-prod`, both on the same repo with the same path mappings. It combines with MSM too, so `brand-ch-prod` is just another site.

## Designing for "same code, different sites"

Repoless only pays off if site differences live in **configuration and content**, not in `if (site === 'ch')` branches. The patterns I recommend:

**Themes via metadata, not forks.** Keep brand differences in design tokens (CSS custom properties) and select the theme per site through bulk metadata. Each site's metadata sheet lives with that site's content, so the code stays identical:

```js
// scripts.js
import { getMetadata, loadCSS } from './aem.js';

async function loadTheme() {
  const theme = getMetadata('theme'); // e.g. "brand-a", set per site in bulk metadata
  if (theme) {
    await loadCSS(`${window.hlx.codeBasePath}/styles/themes/${theme}.css`);
  }
}
```

**Feature flags per site.** For behaviour that has to differ (a market without e-commerce, a region with a different consent provider), read a flag from a per-site config sheet rather than branching in code.

**Blocks are naturally opt-in.** EDS only loads a block's JS and CSS when the content actually uses that block. A brand-specific block adds no weight to sites that never use it, so you rarely need a separate repo just because one brand needs one extra component.

**Profiles for shared defaults.** Put headers, index definitions and Sidekick plugins that should be identical everywhere into a profile. Keep site-level overrides rare and deliberate, because every override is a place where sites can drift.

## Governance: where repoless succeeds or fails

Technically, repoless is a few API calls. Organisationally, it changes how you ship. These are the guardrails I put in place on enterprise programmes.

**1. Respect the blast radius.** One merge to `main` reaches every site. So:

- Run automated checks (functional tests, accessibility, Lighthouse) against **every site's** branch preview in the PR, not just the canonical one. Feature branches resolve against any site, so `https://my-feature--brand-ch--acme.aem.page` previews your branch's code with the Swiss content.
- Use CODEOWNERS for shared blocks and treat block content models as contracts: extend, deprecate, never silently break.
- Publish release notes, because market teams need to know what changed on their site.

**2. Treat configuration as code.** Configuration Service settings live behind an API, not in git. Without discipline that becomes a pile of `curl` commands in someone's shell history. Keep the JSON for every site and profile in a repository, review changes via pull requests, and apply them from a pipeline with a service token. You get audit history, rollback and environment parity.

**3. Manage tokens and access deliberately.** Admin tokens are powerful. Use short-lived personal tokens for humans, scoped service credentials for pipelines, and keep `access.json` roles (admin, author, publish) explicit per site.

**4. Set naming conventions early.** Site names show up in URLs, configs, dashboards and support tickets. A pattern like `{brand}-{market}[-{env}]` (`brand-ch`, `brand-ch-prod`) saves real pain at site number thirty.

**5. Make ownership explicit.**

| Area | Platform team | Market / brand team |
|---|---|---|
| Shared repo (blocks, styles, scripts) | Owns, reviews, releases | Requests, tests on their site |
| Profiles (shared defaults) | Owns | Consulted |
| Site config (content source, mappings, CDN) | Owns via config pipeline | Requests changes |
| Content, metadata, redirects, themes | Enables | Owns |

## Pros and cons

**Pros**

- One codebase: fix once, ship everywhere, no drift.
- New sites in minutes via API, not days of repo bootstrapping.
- Independent content, domains, indexes, sitemaps, access rules and redirects per site.
- Clean multi-environment and MSM stories with AEM authoring.
- Shared profiles keep cross-site settings consistent.
- Lower total cost of ownership: one pipeline, one review queue, one set of tests.

**Cons and risks**

- Every push affects every site, so testing and release discipline become mandatory.
- Configuration lives in an API, so without config-as-code it becomes invisible and hard to audit.
- All sites share one release cadence. A market that needs to freeze or move faster pulls against the model.
- Divergent requirements can creep into the shared code as site-specific conditionals.
- AEM authoring setup has more moving parts (path mappings, technical account, Cloud Services config), and misconfigurations show up as confusing blank pages in the Universal Editor.

## When should you use it?

![Decision tree: separate repos, single site with sections, or repoless]({{ '/assets/img/blog/eds-repoless/04-repoless-decision-tree.svg' | relative_url }}){: width="1200" height="640" loading="lazy" decoding="async"}

My rule of thumb:

- **Different products with different front ends?** Separate codebases. Repoless isn't a reason to merge things that shouldn't share code.
- **Same code, but no need for separate content, domains, indexes or permissions?** Stay on **one site** and split indexes, sitemaps and metadata by section. Don't create sites you don't need.
- **Same code, separate ownership or lifecycle, same release train?** That's the sweet spot for **repoless**.
- **Same code, but one site needs a different release cadence?** Repoless with site-level flags and opt-in blocks, or move that outlier to its own codebase. Don't let one exception reshape the platform for everyone.

## Write it down as an ADR

Moving to repoless is exactly the kind of decision worth an [architecture decision record](https://adr.github.io/){:target="_blank" rel="noopener"}. A starting point:

```
# ADR-012: Run all market sites as repoless sites on one codebase

Status: Accepted
Context: 14 market sites share 90% of blocks; per-site repos cause drift
         and 14x review effort for shared fixes.
Decision: One repo (brand-web), one aem.live site per MSM market and
          environment, shared profile for headers/index/sidekick,
          site config managed as code via pipeline.
Consequences: Single release train for all markets; cross-site test
              suite required on every PR; market-specific behaviour
              must be expressed as config or opt-in blocks.
```

## Gotchas from the field

- **Blank page in the Universal Editor after switching to repoless?** View the page source first. Check that `config.json`, `paths.json` mappings and `component-definition.json` load, then look in the AEM author `error.log` for 404s from the page component.
- **Don't break the canonical site.** It's what keeps Code Sync flowing to every other site. Don't delete it or uninstall Code Sync from its repo.
- **Old config files lie.** After moving to the Configuration Service, repo files like `fstab.yaml` and `helix-query.yaml` no longer apply. Remove them.
- **Local dev targets one site at a time.** Always start `aem up` with `--url` for the site you're testing, and test shared changes on more than one site before merging.
- **Plan indexes and sitemaps per site.** Each site gets its own, which is good for isolation. Design them deliberately, especially if you split a large site into several.

## Closing thought

Repoless turns "a site" from a repository into a configuration object. That's a small technical change with a big organisational effect: your codebase becomes a **platform product** and your sites become **tenants** of it. Get the platform discipline right (tests across sites, config as code, clear ownership) and adding market number twenty costs about as much as adding market number two.

If you're planning a multi-site or multi-market rollout on Edge Delivery Services and want to pressure-test the architecture, [get in touch](/contact/). For data-driven pages on the same platform, see [edge worker vs JSON2HTML for dynamic pages](/blog/2026/10/aem-eds-edge-worker-vs-json2html/).

### References

- [Repoless: one codebase, many sites](https://www.aem.live/docs/repoless) (aem.live)
- [Setting up the configuration service](https://aem.live/docs/config-service-setup) (aem.live)
- [Reusing code across sites with AEM authoring](https://www.aem.live/developer/repoless-authoring) (aem.live)
- [Multi site management with AEM authoring](https://aem.live/developer/repoless-multisite-manager) (aem.live)
- [Repoless stage and prod environments](https://www.aem.live/developer/repoless-environments) (aem.live)
- [Large sites](https://www.aem.live/docs/large-sites) (aem.live)

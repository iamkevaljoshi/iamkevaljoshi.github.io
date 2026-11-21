---
title: "Repoless: one codebase, many sites"
description: "What repoless means on Edge Delivery Services: many sites sharing one GitHub repository via the Configuration Service, when to use it, and the blast radius."
track: eds
level: 4
order: 24
minutes: 9
outcome: "By the end you can explain how one repository serves many sites, decide when repoless is worth it, and name the guardrails a shared codebase needs."
prereq: "Lesson 20, fstab, paths.json and content mappings."
terms:
  - { t: "Repoless", d: "A setup where several Edge Delivery Services sites run from one code repository, and each site is a configuration object rather than a repository." }
  - { t: "Canonical site", d: "The first site, whose repository is connected through the AEM Code Sync GitHub app." }
  - { t: "Profile", d: "A reusable bundle of configuration, such as headers or index definitions, that many sites can share." }
  - { t: "Blast radius", d: "How many sites a single code change can affect." }
mistake: "Treating repoless as free. One merge to main now reaches every site, so teams that skip shared testing and ownership rules ship a market-wide bug with one pull request."
try_it:
  - "List the sites in an estate you know and mark which differ in code, and which only in content, domain or owner."
  - "For each difference in code, write whether it could be a theme or a flag set in metadata or configuration."
  - "Skim the repoless blog post and find the table that maps each old config file to its Configuration Service setting."
  - "Draft a site naming pattern such as `brand-market-env` for five example sites."
  - "Write one rule you would put in CODEOWNERS for the shared blocks folder."
quiz:
  - q: "What defines which code a repoless site uses?"
    options:
      - "A setting in its configuration that points at a repository"
      - "The name of the GitHub branch alone"
      - "A copy of the repository inside each site"
      - "A header added by the CDN"
    answer: 0
    why: "Repoless breaks the one-to-one tie between site and repository. Which code a site uses becomes a configuration value, so many sites can point at one repo."
  - q: "A market team needs a different checkout flow, and the rest of the estate does not. What is the best first move?"
    options:
      - "Fork the repository for that market"
      - "Add a site check such as if site is 'ch' in the shared scripts"
      - "Make it an opt-in block or a flag read from per-site configuration"
      - "Move every market to separate repositories"
    answer: 2
    why: "Blocks only load where content uses them, and flags keep differences in configuration. Hard-coded site checks and forks lead straight back to drift."
  - q: "You have one site with 5,000 pages and no need for separate domains or owners. Should you use repoless?"
    options:
      - "Yes, every site should be repoless"
      - "Yes, because it improves Lighthouse scores"
      - "No, because repoless only supports two sites"
      - "No, stay on one site and split indexes and sitemaps by section"
    answer: 3
    why: "Repoless pays off when sites differ in owner, domain, content or lifecycle. If they do not, extra sites add overhead without value, and performance is unaffected either way."
  - q: "Which is NOT a real consequence of repoless?"
    options:
      - "A push to main reaches every site on the codebase"
      - "Each site keeps its own content source and domain"
      - "All sites share one release cadence"
      - "A fix to a shared block needs a separate pull request per site"
    answer: 3
    why: "The main benefit is that one fix ships to every site with one pull request. The costs are shared cadence and blast radius, not repeated pull requests."
go_deeper:
  - { title: "Repoless on AEM Edge Delivery Services: one codebase, many sites", url: "/blog/2026/10/aem-eds-repoless-one-codebase-many-sites/", why: "full setup, governance and decision tree" }
  - { title: "AEM MSM language copies on Cloud Service", url: "/blog/2026/11/aem-msm-language-copies-cloud-service/", why: "how markets map to sites when AEM is the author" }
  - { title: "Previous lesson: Multi-language sites", url: "/learn/eds/multi-language/" }
  - { title: "Next lesson: Project: a blog with an index and a sitemap", url: "/learn/eds/project-blog-index-sitemap/" }
---
## The problem: site number ten

You launch one site. It lives in a GitHub repository, and the repository name is part of its URL. Site two gets a copy of the repo. By site ten you are applying the same block fix ten times, and the "same" header exists in five slightly different versions.

**Repoless** removes the copying. One repository holds the code, and every site is a configuration entry that points at it.

Think of a franchise. There is one recipe book (the code), and many restaurants (the sites), each with its own menu prices, address and staff. You fix a recipe once.

## How it works

Repoless is built on the **Configuration Service**, managed through REST calls to `admin.hlx.page`. In the model the author's post describes:

- the **organisation** is the top container, with the same name as your GitHub org
- **code** is a repository connected through the AEM Code Sync app
- a **site** combines code, a content source and configuration
- a **profile** shares common settings between sites, and where a site and its profile disagree, the site wins

Creating a site is a single API call. This shows the shape, from the repoless blog post:

```bash
curl -X PUT https://admin.hlx.page/config/acme/sites/brand-ch.json \
  -H 'x-auth-token: <token>' \
  -H 'content-type: application/json' \
  --data '{
    "code": { "owner": "acme", "repo": "brand-web" },
    "content": { "source": { "url": "https://content.da.live/acme/brand-ch/" } }
  }'
```

The new site appears at a URL of the form `https://main--brand-ch--acme.aem.page`. It shows a 404 until you preview some content. Each site keeps its own content, domain, index, sitemap and redirects. For authoring in AEM there are more steps, with path mappings and a technical account, so follow the current documentation closely.

## Config becomes data, not files

This is the part people underestimate. Content source, folder mappings, index definitions, sitemap and robots settings move from files in the repo into per-site configuration. Once the service is on, the old files are overridden, so delete them. It also means your configuration needs the same discipline as code: keep the JSON in a repository, review changes, and apply them from a pipeline.

## When it pays off, and when it does not

Good fits are many markets, several brands on one design system, separate stage and production sites, and fast launches of campaign sites. It is a poor fit when sites have genuinely different front ends, or when one site just needs separate sections. Then one site with split indexes is simpler.

Make differences configuration, not code. Choose a theme through metadata, switch behaviour through a flag, and let blocks be opt-in because they only load where used.

## The cost: blast radius

Every push reaches every site. So test shared changes against several sites, use CODEOWNERS for shared blocks, treat block content models as contracts, and name sites consistently, for example `brand-market-env`. A market that needs to freeze or move faster pulls against the model, so decide early how you will handle that.

## What to check in the current docs

The endpoints and JSON shapes above come from a blog post and the aem.live configuration service pages. They can change, so confirm them in the current Configuration Service documentation before scripting anything.

<details markdown="1">
<summary>Stretch question: why must a repoless site's differences live in configuration?</summary>

If you branch on the site name in shared code, you rebuild the drift repoless was meant to remove, and every site pays the weight and risk of every other site's special cases. Configuration is per site by nature and does not touch shared code. That is why the same codebase can stay small, tested and boring.

</details>

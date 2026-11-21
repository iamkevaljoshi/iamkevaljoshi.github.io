---
title: "Sitemaps, redirects and robots.txt"
description: "How Edge Delivery Services generates sitemaps from an index, manages redirects in a spreadsheet, and serves robots.txt from the repo or the Configuration Service."
track: eds
level: 4
order: 22
minutes: 9
outcome: "By the end you can generate a sitemap from your index, add a redirect without code, and say where robots.txt is configured on your project."
prereq: "Lesson 21, Metadata, indexing and helix-query.yaml."
terms:
  - { t: "Sitemap", d: "An XML file that lists the URLs of a site so search engines can discover them." }
  - { t: "helix-sitemap.yaml", d: "The configuration that tells the platform which index to read and where to write each sitemap." }
  - { t: "Redirects sheet", d: "A spreadsheet named redirects with Source and Destination columns, placed in the content root." }
  - { t: "robots.txt", d: "A plain text file that tells crawlers which paths they may fetch, and where the sitemap is." }
mistake: "Using wildcards in the redirects sheet, or redirecting every retired page to the home page. Wildcards are not supported there, and mass home-page redirects look like soft 404s to search engines."
try_it:
  - "Generate a helix-sitemap.yaml with the Edge Delivery Services config helper, pointing at your /query-index.json."
  - "Open `/sitemap.xml` on your .aem.live site and check that it lists published pages."
  - "Create a spreadsheet named `redirects` with columns `Source` and `Destination`, and add one row."
  - "Preview it, check the redirect on the .page site, then publish and check on .live."
  - "Open `/robots.txt` and confirm it contains a Sitemap line with the full URL."
quiz:
  - q: "What do the Source and Destination columns of the redirects sheet hold?"
    options:
      - "Both are always full URLs"
      - "A regular expression and a replacement"
      - "A relative source path and a path or full URL as destination"
      - "A page title and its new title"
    answer: 2
    why: "Source is a relative path. Destination can be a relative path within the site or a full URL elsewhere. Regular expressions are not supported in the sheet."
  - q: "You have 300 retired URLs following the pattern /old/*. What does the documentation advise?"
    options:
      - "Put one wildcard row in the redirects sheet"
      - "Handle common patterns at the CDN and map the rest one by one"
      - "Redirect them all to the home page"
      - "Delete them and let search engines work it out"
    answer: 1
    why: "The sheet does not do wildcards, and the docs warn that pattern redirects can loop or land on 404s. CDN rules suit true patterns, while individual mapping keeps relevance. A home page dump is the exact thing to avoid."
  - q: "A page is published with robots set to noindex. How can the generated sitemap skip it?"
    options:
      - "It cannot, because sitemaps list everything published"
      - "Unpublish the sitemap and publish it again"
      - "Add the page to robots.txt as Disallow"
      - "Include a robots property in the index so the sitemap can see it"
    answer: 3
    why: "Sitemaps skip published noindex pages if the index has a robots column. robots.txt only controls crawling and would not remove the page from the sitemap."
  - q: "Your team edits robots.txt in the repository but the live file never changes. What is a likely explanation?"
    options:
      - "The site uses the Configuration Service, which overrides the repository file"
      - "robots.txt cannot be changed after launch"
      - "The CDN deletes the file every night"
      - "The file must be edited in the sitemap spreadsheet"
    answer: 0
    why: "With the Configuration Service enabled, its robots setting wins over the repo file. This is the same lesson as with fstab.yaml."
go_deeper:
  - { title: "llms.txt, AI crawlers and robots.txt: what to allow", url: "/blog/2026/11/llms-txt-ai-crawlers-robots-txt-what-to-allow/", why: "what to put in robots.txt today" }
  - { title: "AEM redirect map builder", url: "/tools/aem-redirect-map-builder/", why: "finds chains and loops, and exports an EDS redirects sheet" }
  - { title: "Edge Delivery Services config helper", url: "/tools/edge-delivery-services-helper/", why: "generates helix-sitemap.yaml and a validated redirects sheet" }
  - { title: "llms.txt generator and validator", url: "/tools/llms-txt-generator/", why: "builds a spec-correct llms.txt to sit beside robots.txt" }
---
## The problem: three small files that decide how you are found

After launch, three questions come up every week. How do search engines find new pages? Where does an old URL go? Which crawlers may visit? Each has a small answer on Edge Delivery Services, and none needs a code deployment.

## Sitemaps: generated from the index

With no configuration at all, the platform can publish a `sitemap.xml` listing published documents. For control, you point a sitemap at your index from lesson 21:

```yaml
sitemaps:
  default:
    origin: https://www.example.com
    source: /query-index.json
    destination: /sitemap.xml
    lastmod: YYYY-MM-DD
```

`source` is the index to read and `destination` is the file to write. `origin` sets the host in the URLs, which matters because your pages are served from `.aem.live` internally. If the index has a `lastModified` property, the sitemap carries dates. If it has `robots`, pages marked noindex are skipped.

A single sitemap is limited to 50,000 URLs and 50 MB uncompressed, so large sites split by section. The docs show a sitemap index and language blocks with `hreflang` and `alternate`, which you will use in lesson 23.

## Redirects: a spreadsheet

Create a spreadsheet named `redirects` in the content root with two columns:

| Source | Destination |
|---|---|
| /old-pricing | /pricing |
| /blog/2019/launch | https://www.example.com/news/launch |

Only the sheet named `helix-default` is read. Preview first, check on `.page`, then publish. A redirect overrides a page at the same path, and removing the row restores the page unless it was unpublished.

Wildcards are not supported in the sheet. The docs advise against pattern redirects, since they can loop or send traffic to 404 pages. For a real pattern, use CDN rules. For a migration, map important URLs one to one. The site's [redirect map builder](/tools/aem-redirect-map-builder/) finds duplicates, chains and loops before you publish, and the config helper flattens chains.

## robots.txt

`robots.txt` is a plain text file at the site root. Historically it sat in the repository. On sites using the Configuration Service it is a setting there, and the repository file is overridden. A typical file is short:

```text
User-agent: *
Allow: /

Sitemap: https://www.example.com/sitemap.xml
```

Use the full URL of the sitemap or sitemap index. Whether to allow AI crawlers is a business choice, covered in the llms.txt post below.

## What to check in the current docs

Where each of these lives has shifted from repository files to the Configuration Service. Before you edit any of them, confirm which is live, and check the current aem.live pages on sitemaps, redirects and the configuration service for exact names and endpoints.

<details markdown="1">
<summary>Why does this work without a deployment?</summary>

None of these files are code. The sitemap and index are data derived from published pages, the redirects sheet is content, and robots.txt is configuration. The platform reads them at publish time, so changes go live when you publish, not when you ship a release. That separation is deliberate: marketing can fix a redirect on a Friday without a pull request.

</details>

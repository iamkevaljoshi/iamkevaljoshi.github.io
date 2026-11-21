---
title: "Multi-language sites"
description: "How to structure a multi-language Edge Delivery Services site with language folders, per-language indexes and sitemaps, hreflang, and placeholders in a locales root."
track: eds
level: 4
order: 23
minutes: 9
outcome: "By the end you can lay out language folders, give each language its own index and sitemap, and explain how hreflang links the translations."
prereq: "Lessons 21 and 22, on indexing and sitemaps."
terms:
  - { t: "Language folder", d: "A top-level path such as /en/ or /fr/ that holds all pages for one language or locale." }
  - { t: "hreflang", d: "A signal telling search engines that several URLs are translations of each other, and which audience each is for." }
  - { t: "x-default", d: "The hreflang value that names the fallback page for visitors whose language you do not serve." }
  - { t: "Locales root", d: "The language folder that holds shared items such as the placeholders sheet for that language." }
mistake: "Translating pages but forgetting the per-language index and sitemap. Search engines then see French pages with no link to their English twins, and your French listing block shows English posts."
try_it:
  - "Sketch a folder tree with /en/ and /fr/, each with an index page, a nav and a footer."
  - "Write a helix-query.yaml with two indices, one including `/en/**` and one including `/fr/**`, each with its own target."
  - "Use the Edge Delivery Services config helper to produce a helix-sitemap.yaml and add a language block per folder."
  - "Paste the sitemap URL into the hreflang checker and read its report."
  - "Decide where a `placeholders` sheet should live for each language, and why."
quiz:
  - q: "What is the usual way to organise a multi-language Edge Delivery Services site?"
    options:
      - "One document per page with all languages side by side"
      - "A separate language folder per locale, such as /en/ and /fr/"
      - "A single site where JavaScript swaps the text at runtime"
      - "A different repository for each language, always"
    answer: 1
    why: "Language folders give every translation a real, crawlable URL. Runtime text swapping hides content from search engines, and separate repositories are only one option, not the norm (see the next lesson on repoless)."
  - q: "Your blog listing in /fr/ shows English posts. Which cause fits best?"
    options:
      - "The French pages have no hreflang"
      - "The listing block fetches an index that includes every language"
      - "The sitemap is missing a lastmod value"
      - "Placeholders are not translated"
    answer: 1
    why: "A block shows what the index it fetches contains. A French listing should read a French index. hreflang and lastmod affect search engines, not what a block renders."
  - q: "What does hreflang tell a search engine?"
    options:
      - "Which pages to remove from results"
      - "How fast each page loads in each country"
      - "Which language the CSS targets"
      - "That different URLs are translations of one another"
    answer: 3
    why: "hreflang links equivalent pages across languages so the right version appears for the right audience. It is a relationship signal, and not about speed or removal."
  - q: "Which statement about translated pages is NOT true?"
    options:
      - "Each translation needs a self-referencing hreflang entry"
      - "x-default names a fallback for unmatched visitors"
      - "A French page can point to an English page that does not exist"
      - "Return links are expected between every pair of alternates"
    answer: 2
    why: "Alternates must exist and link back to each other. A reference to a missing page breaks the group, and hreflang checkers flag it."
go_deeper:
  - { title: "hreflang checker and generator", url: "/tools/hreflang-checker-generator/", why: "validates codes, self-references and return links, or generates tags" }
  - { title: "AEM MSM language copies on Cloud Service", url: "/blog/2026/11/aem-msm-language-copies-cloud-service/", why: "how language copies are managed when AEM is the authoring source" }
  - { title: "Edge Delivery Services config helper", url: "/tools/edge-delivery-services-helper/", why: "generates the index and sitemap files per language" }
  - { title: "Next lesson: Repoless: one codebase, many sites", url: "/learn/eds/repoless/" }
---
## The problem: one site, several audiences

Your company sells in Britain and France. English readers should land on English pages, French readers on French ones, and Google should know the two are twins and not duplicates. In a CMS with a language switcher this feels automatic. On Edge Delivery Services you build it from plain parts, and each part is simple.

## Language folders

The common layout is a folder per language at the top of the site:

```text
/en/index
/en/products/widgets
/fr/index
/fr/products/widgets
```

Each folder holds its own pages, and usually its own `nav` and `footer`, so the navigation can be translated. Because every translation is a real page at its own URL, search engines can crawl it, which is the main reason for choosing folders over swapping text with JavaScript.

When the content is authored in Document Authoring, SharePoint or Drive, translation is a content workflow: someone copies or translates the documents into the new folder. When AEM is the source, MSM and translation tooling can create the language copies (see the MSM post below). Either way, the platform sees folders.

## One index and one sitemap per language

This is where lesson 21 pays off. Give each language its own index, so listings and search stay in the right language:

```yaml
version: 1
indices:
  english:
    include:
      - '/en/**'
    target: /en/query-index.json
    properties:
      title:
        select: head > meta[property="og:title"]
        value: attribute(el, "content")
  french:
    include:
      - '/fr/**'
    target: /fr/query-index.json
    properties:
      title:
        select: head > meta[property="og:title"]
        value: attribute(el, "content")
```

A French listing block now fetches `/fr/query-index.json`. The same idea works for sitemaps. The docs describe a `languages` block in the sitemap configuration, where each language gets its own `source` and `destination`, plus `hreflang`, and an `alternate` pattern such as `/fr/{path}` to pair a page with its translation. Pages that share the same path suffix are linked automatically. For pages that do not share one, the docs describe a `primary-language-url` metadata value that you also index. You can also set a default language, which adds an `x-default` alternate.

## Placeholders and shared text

Small UI strings, such as "Read more", live in a `placeholders` spreadsheet. On a multilingual site that sheet can sit in each locales root folder, so each language gets its own words. Check the current placeholders documentation for exactly how a block resolves them.

## Checking the result

After publishing, fetch the sitemap and check that every URL lists its alternates, including itself, and that each alternate links back. The [hreflang checker](/tools/hreflang-checker-generator/) does this for you, and the [config helper](/tools/edge-delivery-services-helper/) generates the matching files.

## What to check in the current docs

The sitemap language syntax and where it is stored (the repository file or the Configuration Service) have moved over time. Compare any example, including the ones here, with the current sitemap documentation at aem.live before you copy it into a project.

<details markdown="1">
<summary>Stretch question: should /en/ and /fr/ be two sites or one?</summary>

If they share code, release train and owners, one site with folders is simplest. If markets have separate owners, domains, permissions or indexes, separate sites on one codebase become attractive, and that is exactly what the next lesson, repoless, is for. Do not split sites you do not need to.

</details>

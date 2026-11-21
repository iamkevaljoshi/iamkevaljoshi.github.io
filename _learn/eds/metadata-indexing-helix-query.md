---
title: "Metadata, indexing and helix-query.yaml"
description: "How page and bulk metadata work in Edge Delivery Services, and how helix-query.yaml turns published pages into a queryable query-index.json for lists and sitemaps."
track: eds
level: 4
order: 21
minutes: 10
outcome: "By the end you can set metadata for many pages at once, and write an index definition that exposes title, description, date and image through query-index.json."
prereq: "Lesson 4, Authoring in documents and spreadsheets."
terms:
  - { t: "Metadata", d: "Values such as title, description, image and robots that end up as meta tags in the page head." }
  - { t: "Bulk metadata", d: "A sheet named metadata that applies values to many pages by URL pattern." }
  - { t: "Index", d: "A list of published pages with chosen properties, kept up to date as pages are published." }
  - { t: "query-index.json", d: "The default URL where an index is served as JSON, so blocks, search and sitemaps can read it." }
mistake: "Expecting the index to contain every page. It holds only published pages, and only the properties you define, so a missing page is usually unpublished, excluded, or the property selector matches nothing."
try_it:
  - "Add a Metadata block to one page with a Title, Description and Image row, then preview it and view the page source to find the matching meta tags."
  - "Create a spreadsheet called `metadata` with columns `URL` and `template`, and a row for `/blog/**`."
  - "Open the Edge Delivery Services config helper, choose title, description, image and lastModified, and generate a helix-query.yaml."
  - "Publish a page under your included path and open `/query-index.json` to look for it."
  - "Run `aem up --print-index` locally to see the index record for the page you are editing."
quiz:
  - q: "Where does a page's metadata end up in the delivered HTML?"
    options:
      - "In the body, as a visible block"
      - "In the head, as meta tags"
      - "In a separate JSON file only"
      - "In the CSS of the page"
    answer: 1
    why: "The Metadata block is removed from the visible content and its values become meta tags in the head, which is why search engines and social previews can use them."
  - q: "A page has a Metadata block with robots set to noindex, and the bulk metadata sheet sets robots to index for the same path. Which wins?"
    options:
      - "The bulk sheet, because it is site wide"
      - "Whichever was published most recently"
      - "They are merged into one value"
      - "The page metadata block, because page level beats bulk"
    answer: 3
    why: "Page level metadata overrides bulk metadata. Bulk gives defaults, and the page keeps the right to differ."
  - q: "Your blog listing block shows nothing, and /query-index.json is empty although pages exist. What is the most likely first cause?"
    options:
      - "The pages are previewed but not yet published"
      - "The block CSS has a typo"
      - "The Sidekick is out of date"
      - "The browser is caching the JSON forever"
    answer: 0
    why: "The index contains only published pages, so previewed-only content never appears. Caching and CSS cannot make the JSON itself empty."
  - q: "Which is NOT true about helix-query.yaml?"
    options:
      - "It can include and exclude path patterns"
      - "It uses selectors to read values from the page HTML"
      - "It is read from the rendered DOM after JavaScript runs"
      - "It can define several indices for different sections"
    answer: 2
    why: "Selectors run against the HTML source delivered by the service, not the DOM after your scripts run. That is why a value added by JavaScript cannot be indexed."
go_deeper:
  - { title: "Edge Delivery Services config helper", url: "/tools/edge-delivery-services-helper/", why: "generates helix-query.yaml and a bulk metadata sheet in your browser" }
  - { title: "What actually matters in SEO", url: "/blog/2026/11/what-actually-matters-in-seo/", why: "why titles, descriptions and indexing decisions matter" }
  - { title: "Previous lesson: fstab, paths.json and content mappings", url: "/learn/eds/paths-fstab-mappings/" }
  - { title: "Next lesson: Sitemaps, redirects and robots.txt", url: "/learn/eds/sitemaps-redirects-robots/" }
---
## The problem: a list page that knows nothing

You are building a blog. Authors publish posts. The home page should show the latest six, with title, image and date. But in Edge Delivery Services every page is its own document. Nothing links them together. Who keeps the list?

You do not, by hand. The platform keeps an **index**: a database-like list of your published pages, and you decide what it records.

## Metadata first

Each page can carry **metadata**, put in a Metadata block at the bottom of the document. A few rows such as `Title`, `Description`, `Image` and `Robots` become meta tags in the page head.

For hundreds of pages you do not edit each one. A spreadsheet named `metadata` in the content root applies values by URL pattern:

| URL | template | robots |
|---|---|---|
| `/blog/**` | blog | |
| `/drafts/**` | | noindex |

Rows are read top to bottom, and page level metadata beats the sheet. When several teams own metadata, the Configuration Service can combine several sheets. Check the current docs for how to register them.

## The index: helix-query.yaml

An index definition says which pages to include and what to extract from each. This is the shape generated by the site's helper tool:

```yaml
version: 1
indices:
  blog:
    include:
      - '/blog/**'
    target: /query-index.json
    properties:
      title:
        select: head > meta[property="og:title"]
        value: attribute(el, "content")
      description:
        select: head > meta[name="description"]
        value: attribute(el, "content")
      image:
        select: head > meta[property="og:image"]
        value: attribute(el, "content")
      lastModified:
        select: none
        value: parseTimestamp(headers["last-modified"], "ddd, DD MMM YYYY hh:mm:ss GMT")
```

Read it like a query. `include` and `exclude` choose pages. Each property has a `select` (a CSS selector against the page HTML head or body) and a `value` (a small expression that pulls out the text). The selectors run against the **source HTML**, not the page after your JavaScript. Use `aem up --print-index` to try them locally.

Pages enter the index when they are **published**, and leave when unpublished. After you change the properties, run a reindex.

## Using the result

The index is served as JSON, by default at `/query-index.json`. A block fetches it:

```js
const resp = await fetch('/query-index.json');
const { data } = await resp.json();
```

Each item in `data` has `path` plus your properties. A listing block loops over it, sorts and builds cards. A sitemap can be built from the same data, which the next lesson covers.

## What has changed, and what to check

The same index definition can live in `helix-query.yaml` in the repo or, on sites using the Configuration Service, as an index configuration in the service. Spreadsheet-based indexes (a `raw_index` sheet) apply only to Google Drive and SharePoint content, and not to Document Authoring or AEM sources. Selector syntax and the exact top-level keys can evolve, so compare with the current indexing reference at aem.live, and build in your own config from the helper rather than from memory.

<details markdown="1">
<summary>Stretch question: why index at all instead of crawling pages from the browser?</summary>

A browser would have to fetch every page to read its title, which is slow and wasteful. The index does that work once, on publish, and serves one small JSON file. It is the same reason a database has an index: pay the cost when writing, so reading is cheap. Large lists need paging, so check the current docs for how to fetch pages of results.

</details>

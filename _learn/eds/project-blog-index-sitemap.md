---
title: "Project: a blog with an index and a sitemap"
description: "Build a five-page blog on Edge Delivery Services with a helix-query.yaml index, a listing block reading query-index.json, a generated sitemap and a redirect."
track: eds
level: 4
order: 25
minutes: 25
kind: project
outcome: "By the end you can ship a small blog whose listing is driven by query-index.json, with a generated sitemap and a working redirect, and prove each with a URL check."
prereq: "Lessons 6 (first published page), 14 (custom blocks) and 20 to 22 (mappings, indexing, sitemaps and redirects)."
terms:
  - { t: "Index record", d: "One row in query-index.json describing a published page, with the properties you defined." }
  - { t: "Listing block", d: "A block that fetches an index and builds a list of cards from it." }
  - { t: "Definition of done", d: "A short list of checks that you can run to prove the project works." }
mistake: "Checking only the preview site. The index and sitemap contain published pages only, so a blog that looks perfect on .page can have an empty query-index.json on .live."
try_it:
  - "Start from your repository based on the aem-boilerplate, with a content source connected, as in lesson 6."
  - "Author five pages: `/blog/` (the listing page) and four posts under `/blog/`. Give each post a Title, Description, Image and a Publication Date in its Metadata block."
  - "Add helix-query.yaml to the root of the repository (or the index configuration, if your project uses the Configuration Service), then push it."
  - "Create a `blog-list` block that fetches `/query-index.json` and builds cards. Place it on `/blog/`."
  - "Add helix-sitemap.yaml pointing at the index, then add a `redirects` sheet that sends `/news` to `/blog/`."
  - "Preview and publish every page, including the redirects sheet, then run the checks in the definition of done."
quiz:
  - q: "Your /query-index.json on .live is empty, but the posts look correct on .page. What do you check first?"
    options:
      - "Whether the posts are published, not only previewed"
      - "Whether the listing block has a CSS class"
      - "Whether the sitemap has a lastmod format"
      - "Whether the redirect sheet has two columns"
    answer: 0
    why: "The index records published pages only. CSS, sitemap formats and the redirect sheet cannot make the index empty."
  - q: "A post appears in the index but its image field is empty. Which is the most likely cause?"
    options:
      - "The image selector matches no meta tag in the page head"
      - "The listing block ran too late"
      - "The sitemap destination is wrong"
      - "The redirect shadows the post"
    answer: 0
    why: "Properties come from selectors run against the page HTML. If the page has no matching og:image tag, or the selector reads a different tag, the value is empty. The block, sitemap and redirect are downstream and do not affect index values."
  - q: "You add the redirect /news to /blog/, but /news still shows an old page. What explains it, given that redirects override pages?"
    options:
      - "Redirects only work on the .page site"
      - "The redirects sheet was saved but not previewed and published"
      - "Redirects need a wildcard to work"
      - "The sitemap must list /news first"
    answer: 1
    why: "Like all content, the sheet takes effect once published. A wildcard is unsupported, and sitemaps play no part in redirecting."
  - q: "Which check is NOT part of a sensible definition of done here?"
    options:
      - "query-index.json lists all four posts with title, description, date and image"
      - "sitemap.xml lists the published pages"
      - "The listing page renders cards from the index"
      - "The Lighthouse score is exactly 100 on every page"
    answer: 3
    why: "A score is a good goal but not a defined check for this project, and it depends on images and network. The other three prove the index, sitemap and listing, which is what the project teaches."
go_deeper:
  - { title: "Edge Delivery Services config helper", url: "/tools/edge-delivery-services-helper/", why: "generate helix-query.yaml, helix-sitemap.yaml and the redirects sheet for this project" }
  - { title: "AEM redirect map builder", url: "/tools/aem-redirect-map-builder/", why: "check redirect lists for chains and loops" }
  - { title: "Edge Delivery Services performance: keep Lighthouse 100", url: "/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/", why: "keep your listing block fast" }
  - { title: "Next lesson: Universal Editor and authoring models", url: "/learn/eds/universal-editor-authoring-models/" }
---
## What you are building

A blog with five pages: one listing page at `/blog/` and four posts. The listing builds itself from an index, so adding a post never means editing the listing. You also publish a sitemap and one redirect. This ties together lessons 20 to 22 in a small, checkable project.

```text
/blog/                 listing page (blog-list block)
/blog/first-post
/blog/second-post
/blog/third-post
/blog/fourth-post
/news                  redirect to /blog/
```

## Step 1: author the posts

In each post, finish the document with a Metadata block:

| Key | Value |
|---|---|
| Title | A short, specific title |
| Description | One sentence, about 150 characters |
| Image | A hero image on the page |
| Publication Date | e.g. 2026-11-21 |

The date needs its own meta tag to be indexable, and the image needs to be present in the head, which Edge Delivery Services generates from the page's first image when you do not set one. Preview each page and view the source to confirm the tags exist before you index them.

## Step 2: define the index

Create `helix-query.yaml` in the repository root. The selectors below read the head. Adapt the date selector and format to the exact meta tag your page produces, and confirm it with `aem up --print-index`.

```yaml
version: 1
indices:
  blog:
    include:
      - '/blog/**'
    exclude:
      - '/blog/'
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
      date:
        select: head > meta[name="publication-date"]
        value: attribute(el, "content")
      lastModified:
        select: none
        value: parseTimestamp(headers["last-modified"], "ddd, DD MMM YYYY hh:mm:ss GMT")
```

The listing page is excluded so it does not list itself. If your project uses the Configuration Service, put the same definition into the index configuration instead of the file, and remember the service overrides the file. The [config helper](/tools/edge-delivery-services-helper/) generates a correct starting file.

## Step 3: the listing block

Create `blocks/blog-list/blog-list.js`:

```js
export default async function decorate(block) {
  const resp = await fetch('/query-index.json');
  if (!resp.ok) return;
  const { data } = await resp.json();
  const posts = data
    .filter((p) => p.path.startsWith('/blog/') && p.path !== '/blog/')
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const ul = document.createElement('ul');
  posts.forEach((p) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = p.path;
    a.textContent = p.title;
    const desc = document.createElement('p');
    desc.textContent = p.description;
    li.append(a, desc);
    ul.append(li);
  });
  block.replaceChildren(ul);
}
```

This sorts by the date string, which works for ISO dates such as `2026-11-21`. Add the image yourself with `createOptimizedPicture` from `aem.js` once the text version works. Put a `blog-list` block on `/blog/`.

## Step 4: sitemap and redirect

Add `helix-sitemap.yaml`:

```yaml
sitemaps:
  default:
    origin: https://main--your-site--your-org.aem.live
    source: /query-index.json
    destination: /sitemap.xml
    lastmod: YYYY-MM-DD
```

Use your real production host as `origin` when you have one. Then create a `redirects` spreadsheet in the content root with `Source` `/news` and `Destination` `/blog/`.

## What done looks like

Publish all five pages and the redirects sheet, then check on the `.live` site:

1. `/query-index.json` returns JSON, with four records, each having title, description, date and image.
2. `/sitemap.xml` lists the published blog URLs.
3. `/blog/` shows four cards, newest first, with working links.
4. `/news` redirects to `/blog/`.
5. Publish a fifth post and, without touching the listing or the code, see it appear in the index and the listing.

Point 5 is the real proof: the content is now driving the page.

## If it does not work

An empty index usually means unpublished pages, a wrong `include`, or selectors matching nothing. Use `aem up --print-index` locally, or the index record URL for the page on `admin.hlx.page` (see the current indexing docs). If the sitemap is missing, check whether your site uses the Configuration Service, since its settings override the repository files.

<details markdown="1">
<summary>Stretch question: what changes if the blog gets 5,000 posts?</summary>

Fetching one huge JSON file and sorting it in the browser stops being sensible. You would page the request, or split the index by section or year, and keep the sitemap within its 50,000 URL limit. Check the current indexing reference for paging parameters before you build it.

</details>

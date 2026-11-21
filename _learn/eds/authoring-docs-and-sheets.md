---
title: "Authoring in documents and spreadsheets"
description: "How authors build EDS pages in Word or Google Docs: sections, blocks as tables, the metadata block, spreadsheets as JSON and the Sidekick for preview and publish."
track: eds
level: 1
order: 4
minutes: 8
outcome: "By the end you can structure a document into sections and blocks, add page metadata, publish a spreadsheet as JSON, and use the Sidekick to preview and publish."
prereq: "Lesson 2: How a page gets from a document to the browser."
terms:
  - { t: "Section", d: "A part of a page, created in a document by a horizontal rule (three hyphens on a line, or Insert, Horizontal line)." }
  - { t: "Block table", d: "A table whose merged first row holds the block name, and whose other rows and cells hold the block's content." }
  - { t: "Metadata block", d: "A block that sets page-level information such as title and description. It is the one block common to all sites." }
  - { t: "Variant", d: "A name in parentheses after a block name, such as `Columns (highlight)`, passed to the code as a style hint." }
  - { t: "Sidekick", d: "The browser extension used to preview, publish and unpublish pages." }
mistake: "Using bold, colour and spacing to make things look right in the document. The page styling comes from code. Misusing headings for size, for example, breaks the semantic structure that search engines and screen readers rely on."
try_it:
  - "Create a new Google Doc or Word document with a Heading 1, a paragraph and a bulleted list."
  - "Add a horizontal rule, then a second heading. That is now a second section."
  - "Insert a table. Merge the first row, type `Cards` as the block name, and add two rows of content."
  - "Add a Metadata table at the end with rows for `Title` and `Description`."
  - "In a spreadsheet, put `name` and `role` in row one and add two rows. Name the sheet `shared-default` and preview it to see its JSON."
quiz:
  - q: "How does an author start a new section in a document?"
    options:
      - "Press Enter three times"
      - "Insert a page break"
      - "Use a Heading 1"
      - "Add a horizontal rule"
    answer: 3
    why: "A horizontal rule marks a section break. Headings and paragraphs belong inside sections and do not split them, and page breaks have no meaning for the web page."
  - q: "An author wants a Columns block with a highlighted style. What do they write?"
    options:
      - "A table whose merged first row reads `Columns (highlight)`"
      - "A table with the text 'make this highlighted' in the first cell"
      - "A bold, yellow-shaded paragraph"
      - "A heading called Columns-Highlight"
    answer: 0
    why: "Variants go in parentheses after the block name. The developers decide what the variant does. Formatting in the document is not carried over as design."
  - q: "A workbook has three sheets: `shared-default`, `shared-jobs` and `draft`. What does the plain `.json` URL deliver?"
    options:
      - "All three sheets in one response"
      - "Only the `draft` sheet"
      - "The `shared-default` sheet, as a single sheet"
      - "Nothing, because there are several sheets"
    answer: 2
    why: "With several sheets, only those prefixed `shared-` are delivered, and `shared-default` is the default one. The `draft` sheet stays private, and `?sheet=jobs` would fetch `shared-jobs`."
  - q: "Which is NOT true of preview in the Sidekick?"
    options:
      - "The preview URL has no custom domain"
      - "Search engines are not meant to see it"
      - "It makes the page visible to everyone on your live domain"
      - "You can share the link to get a review"
    answer: 2
    why: "Preview gives a reviewable `.aem.page` URL. Publishing is what makes content visible on the live site. Confusing the two is how unfinished pages go public."
go_deeper:
  - { title: "Universal Editor vs document-based authoring", url: "/blog/2026/11/universal-editor-vs-document-based-authoring/", why: "when to author in documents and when in a visual editor" }
  - { title: "Metadata, indexing and helix-query.yaml", url: "/learn/eds/metadata-indexing-helix-query/", why: "what spreadsheets and metadata power later" }
  - { title: "Previous lesson: The code repository, the GitHub app and the content source", url: "/learn/eds/repo-github-app-content-source/" }
  - { title: "Next lesson: Local development with the AEM CLI", url: "/learn/eds/local-dev-aem-up/" }
---
## Authoring is writing, with a few rules

An author's question is simple: "What do I type to get a page like that?" On EDS the answer is a document that looks a lot like the finished page, plus a handful of conventions. You write meaning, not layout. The developers decide how it looks.

## Sections, headings and text

Use real headings (Heading 1, Heading 2), paragraphs, lists, links and images. These become semantic HTML.

To split the page into **sections**, add a horizontal rule: type `---` on its own line in Word or Google Docs, or use **Insert, Horizontal line** in Google Docs. Sections often become full-width bands with their own background, but that is the developer's decision.

## Blocks are tables

A **block** is a table with a merged first row holding the block name. The rows below carry the content.

```text
+--------------------------------------+
| Cards                                |
+------------------+-------------------+
| [image]          | Fast by default   |
+------------------+-------------------+
| [image]          | Simple to author  |
+------------------+-------------------+
```

Which blocks exist depends on your site's code. For variations, add a **variant** in brackets: `Cards (dark)`. The developers decide what each variant does. You cannot invent blocks as an author; you can only use the ones your team has built.

## The metadata block

Every page can end with a **Metadata** table. It is the one block common to all sites. Typical rows are:

```text
+-------------+----------------------------------+
| Metadata                                       |
+-------------+----------------------------------+
| Title       | Our story                        |
| Description | How the company started          |
+-------------+----------------------------------+
```

This feeds the page's `<head>`, used by search engines and social sharing. Lesson 21 covers metadata in more depth.

## Spreadsheets become JSON

Not all content is a page. A spreadsheet previewed with the Sidekick is served as JSON at the matching `.json` path, so `/team` becomes `/team.json`. Developers use it as a small data API for navigation, redirects, tables and lists.

A workbook with one sheet delivers that sheet. With several, only sheets prefixed `shared-` are delivered, and `shared-default` is served on its own. You can request `?sheet=jobs` to get `shared-jobs`. The response contains `columns`, `data` rows and `total`. Cell values are strings, so structured values need parsing in code.

## Preview and publish with the Sidekick

Install the AEM Sidekick extension for Chrome and pin it. With the document open:

1. Click **Preview**. You get a `.aem.page` URL to share for review. It is not on your domain and is not meant for search engines.
2. When happy, open the preview and click **Publish**. The page is now on `.aem.live` for everyone.

To remove a page, delete or rename the source document first, then use **Unpublish** (live only) or **Delete** (preview too) on the preview page. Deletion is permanent, so plan redirects for any published page you delete.

<details markdown="1">
<summary>Why does this work? Authors write a table, yet visitors see cards.</summary>

The table becomes simple markup with the block name as a class. The developers' block code then decorates that markup and the site's CSS styles it. The table is a contract between authors and developers: this content, in this shape, gets this treatment.

</details>

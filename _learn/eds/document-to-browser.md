---
title: "How a page gets from a document to the browser"
description: "Follow a page from a Word or Google document to preview on .aem.page and live on .aem.live: content bus, code bus, generated markup and block decoration."
track: eds
level: 1
order: 2
minutes: 9
outcome: "By the end you can trace the path of a page from document to browser and say where content, code and decoration each come from."
prereq: "Lesson 1: What Edge Delivery Services is."
terms:
  - { t: "Preview", d: "A step that pulls the current document into the content store and serves it on a `.aem.page` URL for review." }
  - { t: "Publish", d: "A step that makes previewed content available on the `.aem.live` delivery tier and clears the relevant CDN cache." }
  - { t: "Content bus", d: "The store that holds your previewed and published content, such as documents, spreadsheets and PDFs." }
  - { t: "Code bus", d: "The store that holds your JavaScript and CSS from GitHub, organised by branch." }
  - { t: "Decoration", d: "JavaScript that runs in the browser and turns a block's plain markup into its final structure." }
mistake: "Assuming that saving a document updates the live site. Saving only changes the source. Nothing reaches `.aem.page` until you preview, and nothing reaches `.aem.live` until you publish."
try_it:
  - "Open any EDS site and view its page source. Find the `<main>` element and note the plain `<div>` structure inside it."
  - "Open DevTools, reload, and find the requests for `scripts.js` and `styles.css` in the Network tab."
  - "Change a `.aem.live` URL in the address bar to `.aem.page` for the same path and compare the pages."
  - "Draw your own version of the flow diagram below from memory."
quiz:
  - q: "You edit a Google Doc and save it. Where does the change appear?"
    options:
      - "On `.aem.live` within seconds"
      - "On `.aem.page` automatically"
      - "Nowhere yet: you must preview it, then publish it"
      - "In the GitHub repository as a commit"
    answer: 2
    why: "The document is only the source. Previewing pulls it into the content store (`.aem.page`) and publishing delivers it on `.aem.live`. Content never becomes a Git commit."
  - q: "Where does the HTML for a page come from?"
    options:
      - "A developer writes each page's HTML by hand in the repository"
      - "A server-side template renders it from JCR nodes"
      - "It is generated from the document as semantic HTML, then decorated by block code in the browser"
      - "A browser framework builds the whole page from JSON"
    answer: 2
    why: "The platform converts the document into semantic HTML. Your code then decorates blocks. The pages are not hand-written, and there is no JCR or client-side framework in the standard path."
  - q: "A developer pushes a CSS change to a feature branch. What is true?"
    options:
      - "It is visible only after the next content publish"
      - "It is available on that branch's own URLs, using the same content"
      - "It goes live on the main site straight away"
      - "It is blocked until a Cloud Manager pipeline runs"
    answer: 1
    why: "The code bus keeps each branch as its own environment, with its own URLs. Only merging into `main` affects the main site, and there is no Cloud Manager pipeline in this setup."
  - q: "Which statement about blocks is NOT true?"
    options:
      - "A block starts life as a table in the document"
      - "The block name becomes a CSS class on the generated markup"
      - "Block JavaScript can turn simple markup into richer structure"
      - "Each block must be written as a full HTML page by the author"
    answer: 3
    why: "Authors write a table and developers write decoration code. Authors never write the HTML. The table is converted to simple divs, and your JavaScript decorates them."
go_deeper:
  - { title: "AEM Edge Delivery Services vs traditional AEM as a Cloud Service", url: "/blog/2026/11/aem-edge-delivery-services-vs-traditional-aemaacs/", why: "compares the delivery paths side by side" }
  - { title: "Universal Editor vs document-based authoring", url: "/blog/2026/11/universal-editor-vs-document-based-authoring/", why: "how authoring choices affect the same flow" }
  - { title: "Previous lesson: What Edge Delivery Services is", url: "/learn/eds/what-is-eds/" }
  - { title: "Next lesson: The code repository, the GitHub app and the content source", url: "/learn/eds/repo-github-app-content-source/" }
---
## The question: where does the HTML come from?

You wrote a document with a heading, a paragraph and a table. A visitor opens a fast, styled web page. Nobody wrote that page's HTML. So how does it get there?

Think of a print shop. Authors hand in a manuscript (the document). The shop keeps one stock of typefaces and layouts (your code). When you ask for a proof, the shop sets the manuscript in the layouts and shows you a copy. When you approve, it prints the real run.

## The flow

```text
 Author edits document  (Google Docs, Word, Document Authoring, AEM)
          |
          |  Sidekick: Preview
          v
   Content bus  (state: preview)  -->  https://main--repo--org.aem.page/path
          |
          |  Sidekick: Publish
          v
   Content bus  (state: publish)  -->  https://main--repo--org.aem.live/path
                                         ^
                                         |  CDN
   GitHub repo  --AEM Code Sync-->  Code bus (per branch): scripts.js, styles.css, blocks/
```

The **content bus** holds your text, spreadsheets and other content in two states, preview and publish. The **code bus** holds your JavaScript and CSS from GitHub, one environment per branch. At request time the two meet: the platform produces markup from the content and your repository's `head.html`, and the browser loads your code.

## What the markup looks like

The document is converted into **semantic HTML**: headings become headings, paragraphs become paragraphs, and horizontal rules split the page into **sections**. A table becomes a **block**: a `<div>` whose class is the block name, containing plain divs for its rows and cells.

```html
<main>
  <div>
    <h1>Welcome</h1>
    <p>A short introduction.</p>
    <div class="cards">
      <div>
        <div><p>First card title</p></div>
        <div><p>First card text</p></div>
      </div>
    </div>
  </div>
</main>
```

That is the markup before your code runs. The browser then loads `scripts.js` and `styles.css`, finds each block, and calls that block's JavaScript to **decorate** it: wrap items in a list, add classes, load images. The author never sees any of this. Lessons 7 and 8 cover decoration properly.

## Why it is built this way

Plain semantic HTML arrives in the first response, so the browser can paint quickly. Decoration is small and loaded per block, only for blocks on the page. Splitting content and code also lets authors and developers work independently: content changes need no deployment, and code changes on a branch can be tested on real content using the branch's own URL.

When code merges into `main`, the CDN cache for the affected files is cleared so the change goes live. When an author publishes, the cache for that page is cleared too.

<details markdown="1">
<summary>Predict first, then reveal: you change the footer document and publish it. Do you need a code deployment?</summary>

No. The footer is content, so publishing it is enough. You would only need a deployment if you changed the footer block's JavaScript or CSS. Knowing which side a change belongs to saves a lot of confusion.

</details>

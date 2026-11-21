---
title: "Forms and dynamic data"
description: "How forms and live data work on a static Edge Delivery Services site: spreadsheet-defined forms, the submission service, and fetching JSON from a block."
track: eds
level: 5
order: 27
minutes: 9
outcome: "By the end you can explain how a form is defined and submitted on EDS, and choose between a spreadsheet endpoint, a client-side fetch and publish-time rendering for dynamic data."
prereq: "Lessons 4 (documents and spreadsheets) and 8 (decoration)."
terms:
  - { t: "Spreadsheet as JSON", d: "Any published sheet on EDS is also served as a JSON endpoint, with one object per row." }
  - { t: "Form definition sheet", d: "A spreadsheet whose rows list each field's name, type, label and whether it is required." }
  - { t: "Submission endpoint", d: "A URL that receives the form data with a POST request and stores or forwards it." }
  - { t: "Adaptive Forms Block", d: "Adobe's current forms block for EDS, which can be driven from a spreadsheet or authored in the Universal Editor." }
  - { t: "Client-side fetch", d: "A block that requests JSON in the browser after the page loads and renders it." }
mistake: "Putting an API key or a form handler secret in block JavaScript. Everything in your repository is public to the browser, so the key is exposed to every visitor."
try_it:
  - "Create a spreadsheet with columns for field name, label and type, add three rows, and publish it. Open its `.json` URL and read the result."
  - "Write down which of those fields should be required, and what error a visitor should see if one is missing."
  - "Create a second sheet called `faq` with `question` and `answer` columns and publish it."
  - "Write a block that fetches `/faq.json` and renders each row as a `details` element."
  - "Decide where a form's data should end up (a sheet, an email, an API) and name who must be allowed to read it."
quiz:
  - q: "Why can a static EDS site have forms at all?"
    options:
      - "Every EDS page is rendered by a server on each request"
      - "The form block runs in the browser and posts to a submission endpoint that stores the data"
      - "Forms are converted to images so they need no handler"
      - "The CDN stores form entries in its cache"
    answer: 1
    why: "The page is static, but the form is JavaScript in the browser and the data is posted elsewhere. Pages are not rendered per request, and caches are not storage for submissions."
  - q: "A site needs an events listing that changes a few times a day, the same for everyone, and must appear in search. What is the best fit?"
    options:
      - "A client-side fetch only, so the data is always fresh"
      - "A client-side fetch with a loading spinner"
      - "An edge worker that renders on every request"
      - "Publish-time rendering so the events are real pages, then republish on change"
    answer: 3
    why: "Content fetched in the browser is not in the page that crawlers and indexes see. Publish-time rendering gives real, cached pages, as long as you republish when data changes."
  - q: "A teammate stores a payment provider secret in a block's JavaScript because the repo is private. What is wrong?"
    options:
      - "Nothing, private repos keep secrets hidden"
      - "The script is delivered to every visitor's browser, so the secret is public"
      - "Secrets are only a problem for CSS files"
      - "The secret will expire after the first deployment"
    answer: 1
    why: "A private repository does not make the deployed files private. Anything a block ships is readable in the browser, so secrets belong behind a server or an edge worker."
  - q: "Which is NOT a sensible reason to choose a spreadsheet-defined form?"
    options:
      - "The form is simple and authors can edit it without a developer"
      - "You want to change a label without a code release"
      - "The form needs complex multi-panel business logic and integrations"
      - "The submissions can be collected into a sheet"
    answer: 2
    why: "Adobe positions spreadsheet definitions for simpler forms and the visual Universal Editor route for complex ones. Complex logic is where a spreadsheet stops being the right tool."
go_deeper:
  - { title: "Edge worker vs JSON2HTML on EDS", url: "/blog/2026/10/aem-eds-edge-worker-vs-json2html/", why: "choosing where dynamic data is rendered" }
  - { title: "Universal Editor vs document-based authoring", url: "/blog/2026/11/universal-editor-vs-document-based-authoring/", why: "the authoring route you pick affects how forms are built" }
  - { title: "Next lesson: Experimentation and personalisation", url: "/learn/eds/experimentation-personalisation/" }
---
## A static site that still collects data

A page on EDS is static HTML from a CDN. So how does a "Contact us" form work? And how does a page show data that changes, like opening hours or a product list?

The answer is that **the page stays static and the behaviour moves into the browser**. A block's JavaScript runs after the page loads, builds the form, and sends the data somewhere else. This lesson gives you the three tools and when to use each.

## Forms

Forms on EDS are built by a forms block. For current projects, Adobe documents the **Adaptive Forms Block**, which supports two routes:

- **Document-based:** you define the form in a spreadsheet (Excel or Google Sheets). It suits simple forms.
- **Universal Editor:** you build the form visually, with panels, business logic and integrations. It suits complex forms.

Adobe's documentation notes that this needs an AEM Forms licence, so confirm that before promising it. Older projects, and the aem-boilerplate and Block Collection, have used a simpler `form` block that reads a definition sheet. Check which one your codebase already has, as the names and columns differ.

In the simple spreadsheet style, each row describes a field:

| Name | Type | Label | Mandatory |
|---|---|---|---|
| email | email | Your email | true |
| message | textarea | How can we help? | true |
| submit | submit | Send | |

The block fetches the sheet as JSON, creates the inputs, validates required fields in the browser, and on submit sends a `POST` request to a **submission endpoint**. Adobe provides a Forms Submission Service that can write entries into a SharePoint or Google Sheets file, and the Universal Editor route also offers submit actions such as REST and email. Exact setup differs by block version, so follow the page in the aem.live docs for yours.

## Dynamic data: three places it can run

Any published sheet is also JSON, so data is easy to reach. The real question, as in the [edge worker and JSON2HTML post](/blog/2026/10/aem-eds-edge-worker-vs-json2html/), is *when* the data is turned into HTML:

| Approach | Runs | Good for | Watch out |
|---|---|---|---|
| Client-side fetch in a block | In the visitor's browser | Small, non-critical data, widgets | Not in the indexed HTML; can shift layout |
| Publish-time rendering (JSON2HTML) | When someone previews and publishes | Same-for-everyone pages that must be indexed | Fresh only after republish |
| Edge worker | On every request | Per-visitor or real-time data, secrets | Adds latency to each request |

A client-side example, as a block that renders an FAQ sheet:

```js
export default async function decorate(block) {
  const resp = await fetch('/faq.json');
  if (!resp.ok) return;
  const { data } = await resp.json();
  block.textContent = '';
  data.forEach((row) => {
    const item = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = row.question;
    const answer = document.createElement('p');
    answer.textContent = row.answer;
    item.append(summary, answer);
    block.append(item);
  });
}
```

Notice `textContent` rather than `innerHTML`: data from a sheet or API is untrusted, and this keeps it from becoming markup. Notice also the early return, so a failed request leaves the page intact.

## Rules that keep it fast and safe

- Anything above the fold should not wait for a fetch, or LCP suffers (see lesson 15).
- Never ship secrets in block code. Put them behind a worker or a server.
- Handle failure: a form or widget that breaks should not break the page.
- Make forms accessible: real labels, visible errors, keyboard use (lesson 13).

<details markdown="1">
<summary>Predict first, then reveal: your product list loads by client-side fetch. Will Google index it?</summary>

It may be seen if Google runs your JavaScript, but you are relying on that, and the content is not in the HTML returned by the CDN, the sitemap or the query index. If the products must rank, render them at publish time so they exist as real pages.

</details>

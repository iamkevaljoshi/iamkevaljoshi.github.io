---
title: "Sling: how a URL becomes a response"
description: "Follow one URL through Apache Sling: resource lookup, resource type, script selection, inheritance and the /apps over /libs overlay."
track: aem
level: 1
order: 4
minutes: 9
outcome: "By the end you can take an AEM URL, split it into its parts, and say which node and which script will produce the response."
prereq: "Lesson 3, The JCR: nodes, properties and paths."
terms:
  - { t: "Apache Sling", d: "The web framework inside AEM that maps a request URL to a node in the repository and then to a script that renders it." }
  - { t: "Resource", d: "What Sling calls a piece of content it can serve, usually backed by a JCR node." }
  - { t: "Selector and extension", d: "Dot-separated parts after the resource path in a URL. The extension picks the format, and selectors refine it." }
  - { t: "sling:resourceSuperType", d: "A property on a component that names another component to inherit scripts from." }
  - { t: "Overlay", d: "A file or node in /apps that takes the place of the same path in /libs, so you can customise without editing /libs." }
mistake: "Assuming a URL points to a file. In AEM it points to a resource, and the script that renders it is chosen from the resource's type. If you do not know the type, you will edit the wrong script and wonder why nothing changes."
try_it:
  - "On a local author, open a page in the editor, then open the same page with .html at the end of its path and note the URL structure."
  - "Add .infinity.json or .1.json to the end of a content path, for example /content/mysite/us/en/home/jcr:content.1.json, and read the JSON that comes back."
  - "Find the sling:resourceType of that page's jcr:content node."
  - "Locate the matching folder under /apps (or /libs) and find the script named after the component."
  - "Write the URL of your page as: path, selectors, extension, suffix. Mark which parts are empty."
quiz:
  - q: "What does Sling use to decide which script renders a resource?"
    options:
      - "The file extension of the URL only"
      - "The resource's sling:resourceType, plus selectors and extension"
      - "The author's username"
      - "The order in which pages were created"
    answer: 1
    why: "Sling looks at the resource type first, then uses the request method, selectors and extension to choose among the scripts of that type. The extension alone cannot say what to render."
  - q: "In the URL /content/mysite/us/en/home.print.html, what is 'print'?"
    options:
      - "The extension"
      - "A suffix"
      - "A query string parameter"
      - "A selector"
    answer: 3
    why: "Between the resource path and the extension, dot-separated words are selectors. They let one resource be rendered in several variations, such as a printable view."
  - q: "Your component should behave like a product component, with one script changed. What is the cleanest approach on Cloud Service?"
    options:
      - "Copy all of the product component into /apps and edit it"
      - "Edit the script in /libs through CRXDE Lite"
      - "Replace the pages in /content with static HTML"
      - "Extend it from /apps with sling:resourceSuperType, overriding one script"
    answer: 3
    why: "Inheritance means you only write what differs, and /libs stays untouched. Copying everything makes you own all of it, and /libs cannot be changed on a running Cloud Service instance."
  - q: "Which is NOT part of how Sling turns a request into a response?"
    options:
      - "Resolving the path to a resource in the repository"
      - "Choosing a script from the resource type and the URL parts"
      - "Looking up a matching row in a SQL table of pages"
      - "Running the script to produce the output"
    answer: 2
    why: "Sling works on the content tree, not on SQL tables. It resolves a resource, picks a script and runs it."
go_deeper:
  - { title: "JCR explained for SQL developers", url: "/blog/2026/11/jcr-explained-for-sql-developers/", why: "how the tree behind Sling differs from tables" }
  - { title: "Dispatcher on AEM as a Cloud Service", url: "/blog/2026/11/dispatcher-on-aem-as-a-cloud-service-caching-and-invalidation/", why: "why URL shape matters for caching" }
  - { title: "HTL basics (lesson 8)", url: "/learn/aem/htl-basics/", why: "the templates Sling runs" }
  - { title: "Next lesson: Project structure", url: "/learn/aem/project-structure/" }
---
## From address to answer

When you type a street address, someone has to work out which building you mean, and then what to do when you arrive. Sling does both for every request.

Apache **Sling** is the web framework inside AEM. Its core idea is simple: **the URL points at content, and the content decides how it is rendered.** You do not map URLs to controllers by hand.

## Splitting a URL

Take this URL:

```text
/content/mysite/us/en/home.print.a4.html/extra/info?x=1
```

Sling reads it in pieces:

| Part | Value | Meaning |
|---|---|---|
| Resource path | `/content/mysite/us/en/home` | Which node to serve |
| Selectors | `print.a4` | Optional modifiers for the variant |
| Extension | `html` | The output format |
| Suffix | `/extra/info` | Extra path after the extension, often used for extra data |
| Query | `x=1` | Ordinary query string |

Most real URLs only use the path and the extension. Selectors and suffixes appear when one piece of content needs several renderings.

## The journey of one request

Follow `/content/mysite/us/en/home.html`:

1. **Resolve.** Sling finds the node `/content/mysite/us/en/home`, and then its `jcr:content` child for the page data.
2. **Read the type.** The node has `sling:resourceType = "mysite/components/page"`. That is a relative path into the repository.
3. **Find the script.** Sling searches `/apps/mysite/components/page` first, then `/libs/mysite/components/page`. It looks for a script that matches the request. For a plain `.html` GET request, a script named after the component, such as `page.html`, is the usual match.
4. **Run it.** The HTL script renders, may include child resources, and the output goes back as the response.

Because each component node carries its own type, a page is built by repeating steps 2 to 4 for every child. This is how an author's choices turn into markup.

## Inheritance and the overlay

Components can inherit. If `/apps/mysite/components/page` has `sling:resourceSuperType = "core/wcm/components/page/v3/page"`, any script it lacks is looked up on the parent. You write only what differs.

There is a related idea for locations. Sling searches `/apps` **before** `/libs`. So a file at the same relative path in `/apps` takes the place of the one in `/libs`. That is an **overlay**.

Overlays exist, but on AEM as a Cloud Service they should be a last resort. `/libs` belongs to Adobe and changes with every product update, so an overlay that copies a whole file can quietly go stale or break after an update. Prefer inheriting from a component and overriding one thing. You will see this again with Core Components in lesson 14.

<details markdown="1">
<summary>Predict first, then reveal: what happens if no script matches the request?</summary>

Sling falls back along the inheritance chain, and then to a default renderer. If you request an extension or selector that no script handles, you typically get a plain default output or an error, not your page. When a URL gives a surprising response, check the resource type and then the script name, selectors and extension. One of those is almost always the cause.

</details>

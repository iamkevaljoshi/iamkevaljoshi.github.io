---
title: "Universal Editor and authoring models"
description: "Compare the three ways to author an Edge Delivery Services site, and see how the Universal Editor learns about your blocks through three JSON files."
track: eds
level: 5
order: 26
minutes: 10
outcome: "By the end you can choose an authoring model for a site, and explain what component-definition, component-models and component-filters each tell the Universal Editor."
prereq: "Lessons 4 (documents and spreadsheets) and 7 (the anatomy of a block)."
terms:
  - { t: "Authoring model", d: "The place authors write content and the tool they use, for example Word or Google Docs, Experience Workspace, or AEM with the Universal Editor." }
  - { t: "Universal Editor (UE)", d: "A visual, in-context editor where authors click on the real page and edit fields in a properties panel." }
  - { t: "component-definition.json", d: "Lists the blocks authors can add, and which model each one starts with." }
  - { t: "component-models.json", d: "Describes the editable fields of each block, such as text, image and required flags." }
  - { t: "component-filters.json", d: "Says where each component may be placed, for example which blocks are allowed inside a section." }
mistake: "Choosing the authoring model last. Delivery is identical for all of them, but content lives in different places, so switching after launch is a content migration, not a setting."
try_it:
  - "List the authors of a site you know and write down, for each, the tool they already use daily."
  - "Score the three models against four questions: is validation needed, is copy and paste speed critical, are workflows and approvals needed, is time to market critical?"
  - "Open the `aem-boilerplate-xwalk` repository on GitHub and find `component-definition.json`, `component-models.json` and `component-filters.json` at the root."
  - "Pick one block, such as `quote`, and find its entry in all three files."
  - "Write down which fields the author would see for that block, and which would be required."
quiz:
  - q: "Which statement about the three authoring models is correct?"
    options:
      - "They publish to the same delivery path, so the choice is about governance, author experience and where content lives"
      - "Universal Editor sites are faster because they render on the server"
      - "Document-based sites cannot use blocks, only default content"
      - "Each model needs its own separate CDN configuration"
    answer: 0
    why: "All models feed the same content bus and the same aem.page and aem.live delivery, so performance is not the differentiator. The tempting speed claim confuses editing experience with delivery."
  - q: "A designer adds a new block to the codebase, but authors cannot find it in the Universal Editor's add menu. Where should you look first?"
    options:
      - "The block's CSS file, because a selector may be missing"
      - "The definition and filters JSON files, since a block must be listed and permitted"
      - "fstab.yaml, because it controls which blocks are visible"
      - "The Sidekick configuration, because it controls the add menu"
    answer: 1
    why: "The UE only offers what is defined and permitted. CSS affects how a block looks after it exists, and the Sidekick is a document-authoring tool."
  - q: "A regulated organisation runs 20 markets, needs approvals, Live Copies and field validation. Which model fits best?"
    options:
      - "Word documents, because authors already know them"
      - "Google Docs, because co-editing is the strongest feature"
      - "AEM authoring with the Universal Editor, because content and governance sit in AEM"
      - "Whichever is cheapest, since they behave the same"
    answer: 2
    why: "Typed fields, required fields, workflows and MSM are the reasons teams choose AEM with the UE. Documents win on familiarity and speed, but have the weakest guardrails."
  - q: "Which is NOT true about changing a block's model after authors have created content?"
    options:
      - "Existing content may need to be migrated to match the new fields"
      - "It is cheaper to settle the model before content production starts"
      - "Adobe recommends definition and model first, then content, then decoration"
      - "The Universal Editor rewrites all existing content automatically"
    answer: 3
    why: "Nothing rewrites stored content for you. That is exactly why the model comes first, and why a late change costs a migration."
go_deeper:
  - { title: "Universal Editor vs document-based authoring on Edge Delivery Services", url: "/blog/2026/11/universal-editor-vs-document-based-authoring/", why: "the full comparison, decision guide and migration paths" }
  - { title: "Repoless: one codebase, many sites", url: "/blog/2026/10/aem-eds-repoless-one-codebase-many-sites/", why: "mixing authoring models across sites" }
  - { title: "Next lesson: Forms and dynamic data", url: "/learn/eds/forms-dynamic-data/" }
---
## The question teams argue about too late

Imagine you have built a fast site. Now a marketer asks: "So where do I write the content?" One person says Word, another says AEM, a third has seen a browser editor in a demo. They are all right, which is why the choice needs care.

The good news is that **delivery does not change**. Whatever authors use, the page ends up in the same place and is served the same way from `aem.page` and `aem.live`. What changes is where content lives, how much structure you get, and how hard it is to change your mind.

## The three models

| Model | Content lives in | Strength | Weakness |
|---|---|---|---|
| **Document-based** (Word, Excel, Google Docs and Sheets) | SharePoint or Google Drive | Zero training, fast start | Almost no validation |
| **Experience Workspace** (formerly Document Authoring, da.live) | Adobe's document repository | Browser editor with versions, approvals and more | Not an editor for content in AEM Author |
| **AEM with the Universal Editor** | AEM as a Cloud Service author | Typed fields, workflows, MSM, translation | Lower familiarity, slower copy and paste |

Adobe's own advice differs by page: Experience League still calls the Universal Editor the first choice for AEM projects on EDS, while aem.live encourages Experience Workspace for new projects. Check the current wording when you decide. The [comparison post](/blog/2026/11/universal-editor-vs-document-based-authoring/) walks through the trade-offs in detail.

In a document, a block is a table whose first row is the block name. In the Universal Editor, a block is a component with **fields**. The difference is who enforces structure: a table relies on the author's care, a field enforces it.

## How the Universal Editor learns about your blocks

Projects built for the UE usually start from the `aem-boilerplate-xwalk` template. Three JSON files at the project root teach the editor what exists:

1. **`component-definition.json`**: the menu of things authors can add.
2. **`component-models.json`**: the fields shown for each one.
3. **`component-filters.json`**: the rules for where each may go.

A trimmed example for a quote block:

```json
{
  "definition": {
    "title": "Quote",
    "id": "quote",
    "plugins": {
      "xwalk": {
        "page": {
          "resourceType": "core/franklin/components/block/v1/block",
          "template": { "name": "Quote", "model": "quote" }
        }
      }
    }
  },
  "model": {
    "id": "quote",
    "fields": [
      { "component": "text-area", "name": "quote", "label": "Quote", "valueType": "string" },
      { "component": "text-input", "name": "author", "label": "Author", "valueType": "string" }
    ]
  },
  "filter": { "id": "section", "components": ["text", "image", "quote"] }
}
```

In the real project these live in three separate files (shown together here for reading). The pattern is: a definition names the block and its model, the model lists the fields, and the filter list controls placement. Adding `quote` to the `section` filter is what lets authors drop it into a section.

AEM then turns the stored fields into the same rows and cells your decoration code expects. Your block JavaScript still runs as in lesson 8, though blocks that rearrange the DOM may need extra care so the editor can still select them.

## Decide early, build in order

Three habits save pain. Choose the model **per site before content production starts**. Build in this order: definition and model, then content, then decoration. Finally, keep JSON files per block and merge them in a build step, because three monolithic files grow quickly. Verify exact property names against the current Adobe documentation before you copy any snippet, since the schema evolves.

<details markdown="1">
<summary>Stretch question: why not let every team pick whatever they like?</summary>

You can, site by site, especially with repoless setups. The danger is not variety, it is accidental choice. Teams that drift into Word because it is familiar, then later need approvals and field validation, face a migration with re-modelled blocks. Treat the model like a database choice: easy on day one, expensive on day 400.

</details>

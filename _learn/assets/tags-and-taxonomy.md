---
title: "Tags and taxonomy"
description: "How to choose between free text, dropdowns and tags in AEM Assets, how tag namespaces and hierarchy work, and how to design a taxonomy that does not sprawl."
track: assets
level: 2
order: 9
minutes: 9
outcome: "By the end you can design a small tag taxonomy with facets, namespaces and owners, and explain why tags link Assets to Sites."
prereq: "Lesson 7, Metadata schemas."
terms:
  - { t: "Tag", d: "A controlled label from a managed hierarchy that can be applied to assets and pages." }
  - { t: "Namespace", d: "The top level of a tag hierarchy, such as `marketing`, which groups related tags and appears before the colon in a tag ID." }
  - { t: "Tag ID", d: "The stable identifier of a tag, such as `marketing:season/spring`, made of namespace and path." }
  - { t: "Facet", d: "One independent way of describing an asset, such as colour, season or channel." }
  - { t: "Taxonomy", d: "The agreed structure and vocabulary of your tags, together with the rules for who may change it." }
mistake: "Letting everyone create tags freely. Within a year you have 'Summer', 'summer-2025' and 'SS25' side by side, filters stop working, and nobody dares to clean them up."
try_it:
  - "Pick one asset type you manage, such as product photos, and list the five questions people ask when searching for one."
  - "Turn each question into a facet and write three to six example values under each."
  - "Decide for each facet whether it is a tag, a dropdown or free text, and give one reason."
  - "Choose a namespace for the facets, and name an owner for each namespace."
  - "In an AEM environment, open Tools, then Tagging, and find where a namespace like yours would sit."
quiz:
  - q: "Which situation is best solved with a tag rather than free text?"
    options:
      - "A photographer's one-off note about the shoot location"
      - "A campaign season that dozens of assets share and people filter by"
      - "A unique caption for a single image"
      - "A private reminder for the next editor"
    answer: 1
    why: "Tags earn their keep when many assets share a value and people filter on it. One-off notes and captions are naturally free text."
  - q: "A tag has the ID `marketing:season/spring`. What do the parts mean?"
    options:
      - "`marketing` is the namespace and `season/spring` is the path inside it"
      - "`marketing` is the folder and `season/spring` is the asset name"
      - "`marketing` is the author and `season/spring` is the title"
      - "`marketing` is the site and `season/spring` is the page path"
    answer: 0
    why: "A tag ID is namespace, a colon, then the path through the hierarchy. The tags live under /content/cq:tags, not in the asset folders."
  - q: "Your German team wants to see tags in German while the English team sees English. What is the right approach?"
    options:
      - "Create a second copy of the whole taxonomy in German"
      - "Tag assets twice, once per language"
      - "Keep one tag ID and add translated titles to each tag"
      - "Replace tags with a free-text field per language"
    answer: 2
    why: "The ID is what is stored on assets, so it should be stable and language neutral. Titles can be localised per tag. Duplicating the tree creates two vocabularies that drift apart."
  - q: "Which is NOT a sound way to prevent tag sprawl?"
    options:
      - "Name an owner for each namespace"
      - "Review and merge near-duplicate tags on a schedule"
      - "Document facets and example values for authors"
      - "Let any author create tags so nobody is blocked"
    answer: 3
    why: "Open creation is the usual cause of sprawl. Controlled creation with a quick request route keeps authors productive and the vocabulary clean."
go_deeper:
  - { title: "Content modelling: JCR vs relational vs document database", url: "/blog/2026/11/content-modelling-jcr-vs-relational-vs-document-database/", why: "tags are structure, so model them on purpose" }
  - { title: "Agent-ready AEM site: structured content", url: "/blog/2026/11/agent-ready-aem-site-structured-content-nlweb-webmcp/", why: "why consistent labels help machines as well as people" }
  - { title: "Next lesson: Collections and sharing", url: "/learn/assets/collections-and-sharing/" }
---
## The problem: five spellings of one idea

A retailer lets every merchandiser type keywords. Search for "trainers" and you find some images. "Sneakers", "running shoes" and "trainer" hide the rest. The DAM holds the assets, but nobody can find them.

The fix is to separate three kinds of value:

| Kind | Example | Best for |
|---|---|---|
| **Free text** | A caption or a note | Unique descriptions |
| **Controlled single value** | A dropdown for "Brand" | One right answer per asset |
| **Tags** | `product:footwear/trainers` | Shared vocabulary, filtering, reuse across Assets and Sites |

If many assets share a value and people filter by it, it should be controlled. If it is unique to one asset, free text is fine.

## How tags are stored

Tags are not stored on folders or in the asset's folder tree. They live in their own hierarchy under `/content/cq:tags`. The top level is the **namespace**, and tags nest below it:

```text
/content/cq:tags/
  marketing/
    season/
      spring
      summer
    channel/
      email
      social
  product/
    footwear/
      trainers
      boots
```

The tag ID is the namespace, a colon, then the path: `marketing:season/spring`. When an author tags an asset, the **ID** is saved on the asset's metadata, and the title is looked up for display. A tag with no namespace goes into the `default` namespace, which shows as Standard Tags. That is convenient and also how sprawl starts.

Members of the tag administrators group, and users with modify rights on `/content/cq:tags`, can create tags and change the hierarchy. Moving or merging a tag leaves a pointer from the old tag to the new one, so existing tagged content still resolves.

## Designing a taxonomy

1. **Start with facets.** A facet is an independent way of describing an asset: product category, season, channel, region. Facets become the second level under a namespace.
2. **Keep depth shallow.** Two or three levels is usually enough. Deep trees make authors hunt, and they pick the wrong leaf.
3. **Use stable IDs.** The ID is what is saved on assets. Choose it once, in lower case, in a language-neutral form.
4. **Localise the titles, not the IDs.** Each tag can have titles per language, so the German team sees German while the stored value stays the same. Adding languages is a setup step on the tags root, so plan it early and check the current Experience League steps for your environment.
5. **Give every namespace an owner.** Someone decides whether a new tag is needed, merges duplicates and retires old ones.

## Tags are the bridge to Sites

The same tag tree serves pages, content fragments and assets. If "spring" is a tag on both a hero image and a campaign page, a listing component can pull everything for spring without a custom field. That reuse only works when both teams share one taxonomy, which is another reason not to let each team invent its own.

Smart tags, generated by machine learning, are covered in lesson 17. They add suggestions on top of your taxonomy, they do not replace it.

<details markdown="1">
<summary>Stretch question: when is a dropdown better than a tag?</summary>

When an asset can have exactly one value and the list is short and stable, such as "Asset status". A dropdown gives you a single, visible choice, and nobody can add a second one by accident. Tags suit values where several apply at once and the vocabulary grows with the business.

</details>

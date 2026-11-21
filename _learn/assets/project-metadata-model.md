---
title: "Project: design a metadata model"
description: "Design a metadata model for a fictional retailer with 200,000 product images and 30,000 campaign assets: fields, tag facets, mappings, owners and a schema layout."
track: assets
level: 2
order: 12
minutes: 20
kind: project
outcome: "By the end you can produce a one-page metadata model with fields, mappings, tag facets and owners, and check it against a 'what good looks like' list."
prereq: "Lessons 7 to 11 of this level."
terms:
  - { t: "Metadata model", d: "The agreed set of fields, tags, mappings and owners that describe your assets." }
  - { t: "Facet", d: "An independent dimension for tagging, such as season or channel." }
  - { t: "Field owner", d: "The role accountable for a field being filled correctly." }
  - { t: "Source of truth", d: "The system that holds the authoritative value, for example a PIM for product data." }
mistake: "Designing the model from the list of everything you could record, instead of from the decisions people make. The result is a long form that nobody completes."
try_it:
  - "Read the brief below and list the five to eight decisions people make when choosing an asset (find, reuse, approve, publish, retire)."
  - "For each decision, write the field or tag that answers it, and mark it required, optional or derived."
  - "Fill in the model table: field, type, mapped property, required, source and owner."
  - "Define three to five tag facets with two levels and five example values each."
  - "Sketch the schema layout: which tabs, which fields on which tab, and which two folders get variants."
  - "Test the model on 10 imaginary assets, including a product image and a campaign banner, and note any missing field."
  - "Score yourself against the 'what good looks like' list at the end."
quiz:
  - q: "In the retailer model, why is the SKU best held as a read-only field populated from the PIM?"
    options:
      - "Because AEM cannot store text fields"
      - "Because a single source of truth avoids typing errors and conflicting copies"
      - "Because read-only fields are faster to search"
      - "Because authors prefer not to enter data"
    answer: 1
    why: "Product identity belongs to the PIM. Re-typing it in the DAM creates a second version that drifts. Speed of search is not the reason."
  - q: "A campaign asset needs a usage-region restriction, but product images do not. How should the model handle it?"
    options:
      - "Add the field to the default schema for every asset"
      - "Put the restriction in the file name"
      - "Skip it and rely on authors remembering"
      - "Add it to a campaign folder variant of the schema only"
    answer: 3
    why: "A folder-level schema variant keeps product images uncluttered while campaign assets get the extra field. The default schema would add noise to 200,000 images."
  - q: "Which tag facet design is best for 230,000 assets?"
    options:
      - "One namespace with 400 flat tags"
      - "Several facets, each shallow, each with an owner and a naming rule"
      - "A separate namespace per team, each inventing its own tags"
      - "A single free-text keywords field"
    answer: 1
    why: "Independent, shallow facets with owners scale and can be combined in filters. Flat lists are hard to browse and per-team vocabularies duplicate each other."
  - q: "Which is a warning sign that your model is too big?"
    options:
      - "Every required field has a named owner"
      - "Dropdowns are used for values with fixed lists"
      - "Authors skip half the optional fields and nothing uses them"
      - "Two tag facets can be combined in one filter"
    answer: 2
    why: "Fields that people skip and that no decision uses are cost without benefit. The other options describe healthy design choices."
go_deeper:
  - { title: "Content modelling: JCR vs relational vs document database", url: "/blog/2026/11/content-modelling-jcr-vs-relational-vs-document-database/", why: "modelling thinking that carries over to metadata" }
  - { title: "Image optimisation on AEM", url: "/blog/2026/11/image-optimisation-on-aem-dynamic-media-and-edge-delivery-services/", why: "metadata that delivery will later depend on" }
  - { title: "Previous lesson: Bulk metadata editing and import", url: "/learn/assets/bulk-metadata-editing-and-import/" }
---
## The brief

**Northway Outfitters** is a fictional retailer. Its AEM Assets environment will hold:

- **200,000 product images**, shot by studios and supplied with some embedded metadata. Product data (SKU, name, colour, size range) lives in a PIM.
- **30,000 campaign assets**: banners, social cuts, lookbooks, email headers and a few videos, made by an in-house team and two agencies.

Four groups use the library: merchandisers who pick product images, a brand team who approves campaigns, web teams who publish, and agencies who deliver files in.

**Environment:** optional. You can do this on paper or in a spreadsheet. If you have an AEM Assets as a Cloud Service environment, build the schema in Tools, Assets, Metadata Schemas to see it working.

## Step 1: start from decisions

| Decision | What answers it |
|---|---|
| Is this the right product? | SKU, product name |
| Is it the right look? | Colour, shot type |
| Is it for this season and channel? | Season and channel tags |
| Am I allowed to use it here? | Usage region, rights end date |
| Is it approved? | Status |
| Who made it, and who do I ask? | Creator or agency, owner |

If a field answers no decision, leave it out.

## Step 2: the model table

| Field | Type | Mapped to property | Required | Source and owner |
|---|---|---|---|---|
| Title | Text | `./jcr:content/metadata/dc:title` | Yes | Embedded or author; asset owner |
| Description | Text | `./jcr:content/metadata/dc:description` | No | Author; asset owner |
| SKU | Text, read only | `./jcr:content/metadata/northway:sku` | Yes (products) | PIM sync; merchandising ops |
| Shot type | Dropdown | `./jcr:content/metadata/northway:shotType` | Yes (products) | Studio at upload; studio lead |
| Campaign name | Text or dropdown | `./jcr:content/metadata/northway:campaign` | Yes (campaigns) | Brand team |
| Usage region | Multi-value dropdown | `./jcr:content/metadata/northway:usageRegion` | Yes (campaigns) | Brand and legal |
| Rights end date | Date | `./jcr:content/metadata/northway:rightsEnd` | Yes (campaigns) | Brand and legal |
| Status | Dropdown | `./jcr:content/metadata/northway:status` | Yes | Brand team |
| Copyright | Text | `./jcr:content/metadata/dc:rights` | No | Embedded from supplier |
| Tags | Standard tags | `./jcr:content/metadata/cq:tags` | Yes (one season) | Taxonomy owner |

Notes: custom fields use a `northway` namespace you own. Remember to register the namespace in the way your environment requires. Supplier-owned fields (`dc:rights`) come from embedded metadata (lesson 8), while team-owned fields stay out of the file namespaces.

## Step 3: tag facets

```text
/content/cq:tags/northway/
  season/    ss26, aw26, evergreen
  channel/   web, email, social, print
  category/  footwear/trainers, footwear/boots, apparel/jackets
  audience/  men, women, kids
```

Four facets, two levels at most. The taxonomy owner approves new tags. Titles are localised for the German and French sites; IDs stay in English.

## Step 4: sample schema layout

```text
Form: northway-product   (apply to /content/dam/northway/products)
  Tab Basic:     Title*, Description, Shot type*, SKU* (read only)
  Tab Tagging:   Tags* (season, category, audience)
  Tab Rights:    Copyright (read only if embedded)

Form: northway-campaign  (apply to /content/dam/northway/campaigns)
  Tab Basic:     Title*, Campaign name*, Status*
  Tab Tagging:   Tags* (season, channel)
  Tab Rights:    Usage region*, Rights end date*, Copyright
```

The `default` form stays untouched. Each variant is a copy applied to its folder, and subfolders inherit it.

## Step 5: test it

Take 10 imaginary assets, including a product shot, a social cut, a video and an agency delivery with no embedded metadata. Can you fill every required field in under a minute? Which field did you not know how to answer?

## What good looks like

- Every field answers a decision someone actually makes.
- Required fields number fewer than eight per form, and each has an owner.
- Product data is mirrored from the PIM, not retyped.
- Custom fields sit in your own namespace, and each property is mapped by one field only.
- Tag facets are independent, two levels deep at most, with a named taxonomy owner.
- Variants are applied by folder, and the default schema is unchanged.
- You have said how existing assets will be filled: by export, edit and import (lesson 11).

<details markdown="1">
<summary>Stretch question: what would you change at 2 million assets?</summary>

Fewer manual fields and more derived ones. At that scale people cannot fill forms, so you rely on embedded metadata from suppliers, PIM synchronisation, rules at upload and automated enrichment. The model gets stricter about ownership, because one wrong convention is repeated a million times.

</details>

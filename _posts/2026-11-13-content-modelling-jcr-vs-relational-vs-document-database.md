---
layout: post
title: "Content modelling three ways: the same domain in JCR, relational and document databases"
seo_title: "Content Modelling: JCR vs Relational vs Document Database"
description: "One domain of articles, authors and products modelled three ways, in JCR Content Fragments, relational tables and MongoDB documents, with the trade-offs."
ai_summary: "This post models a single domain, articles, authors, products and categories, in three databases: a relational schema in PostgreSQL, documents in MongoDB, and a JCR tree in AEM with Content Fragment Models. It compares how each handles identity, relationships, many-to-many links, schema enforcement, localisation, versioning, ordering and bulk updates. Relational modelling normalises and joins at read time; document modelling shapes data for the read and duplicates on purpose; JCR modelling organises content by where it lives and who governs it, with paths as identity and references as paths. The recommendation is to model each kind of data where its access pattern and its owners are, not to force one model onto everything."
date: 2026-11-13 12:00:00 +0530
category: databases
tags: [Content Modelling, JCR, PostgreSQL, MongoDB, AEM, Data Modelling]
---

Give three experienced teams the same brief, "articles written by authors, tagged with categories, mentioning products", and you get three models that look nothing alike. The SQL team draws five tables and three join tables. The MongoDB team draws two collections with a lot of nesting. The AEM team draws a folder tree and a Content Fragment Model, and says "the path is the ID".

None of them is wrong. Each model encodes a different assumption about **who reads the data, who writes it and how it changes**. In design reviews, most of the modelling problems I find come from a team carrying the assumptions of one model into another engine: relational thinking in the JCR, JCR thinking in MongoDB, or document thinking in Postgres.

This post takes one domain and models it three ways, side by side, so the trade-offs are visible rather than theoretical. It's the fourth post in my database series. If the JCR is new to you, start with [JCR explained for SQL developers]({{ '/blog/2026/11/jcr-explained-for-sql-developers/' | relative_url }}).

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **Relational models normalise and join at read time.** Every fact lives once, constraints protect integrity, and any question can be asked later. You pay with joins and a schema migration for every change.
- **Document models are shaped for the read.** You embed what's read together and duplicate on purpose. Reads are one round trip; updates to shared data fan out across documents.
- **JCR models are shaped by location and governance.** The tree reflects how authors browse, how permissions are inherited and how content is published and translated. The path is the identity, and references are mostly paths.
- **Many-to-many is where the models diverge most.** Join tables in SQL, arrays of IDs (or embedded summaries) in MongoDB, multi-value path properties in the JCR.
- **Localisation is a parallel tree in AEM**, a translation table in SQL, and usually an embedded map or separate documents in MongoDB.
- **My recommendation:** model each kind of data in the engine whose access pattern and ownership it matches. Editorial content in the JCR, transactional and relational data in SQL, high-volume aggregates that are read as a unit in a document store. Don't force one model onto everything.

## The domain

The brief is deliberately ordinary, because ordinary is where the decisions are:

| Entity | Attributes | Relationships |
|---|---|---|
| **Article** | title, slug, summary, body (rich text), hero image, publish date, status | one or more authors; many categories; mentions many products |
| **Author** | name, bio, photo, social links | writes many articles |
| **Product** | SKU, name, price, description, variants (size, colour) | appears in many articles; belongs to categories |
| **Category** | name, parent category | many articles, many products |

Add two real-world constraints: the site runs in **English and German**, and **editors need versioning and approval** before anything goes live. Those two lines change the models more than any entity does.

![The same domain modelled three ways: relational tables with join tables, MongoDB documents with embedded summaries, and a JCR tree of Content Fragments referenced by path]({{ '/assets/img/blog/content-modelling-jcr-vs-relational-vs-document-database/01-three-models.svg' | relative_url }}){: width="1200" height="600" loading="lazy" decoding="async"}

## Model 1: relational (PostgreSQL)

A relational designer starts from the entities and their relationships, then normalises: every fact in one place, every relationship explicit.

```sql
CREATE TABLE author (
  author_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL,
  photo_url   text
);

CREATE TABLE article (
  article_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug         text NOT NULL UNIQUE,
  status       text NOT NULL CHECK (status IN ('draft','review','published')),
  published_at timestamptz
);

-- Localised fields live in their own table, one row per language
CREATE TABLE article_i18n (
  article_id bigint REFERENCES article ON DELETE CASCADE,
  lang       text   NOT NULL,
  title      text   NOT NULL,
  summary    text,
  body       text,
  PRIMARY KEY (article_id, lang)
);

CREATE TABLE article_author (
  article_id bigint REFERENCES article ON DELETE CASCADE,
  author_id  bigint REFERENCES author,
  position   smallint NOT NULL,          -- author order on the byline
  PRIMARY KEY (article_id, author_id)
);

CREATE TABLE product (
  product_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku        text NOT NULL UNIQUE,
  price      numeric(10,2) NOT NULL
);

CREATE TABLE article_product (
  article_id bigint REFERENCES article ON DELETE CASCADE,
  product_id bigint REFERENCES product,
  PRIMARY KEY (article_id, product_id)
);

CREATE TABLE category (
  category_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parent_id   bigint REFERENCES category,
  name        text NOT NULL
);
```

(I've left out `author_i18n`, `product_variant` and the category join tables; they follow the same pattern.)

Rendering one article page is a join:

```sql
SELECT a.slug, i.title, i.body, au.name, p.sku, p.price
FROM article a
JOIN article_i18n   i  ON i.article_id = a.article_id AND i.lang = 'de'
JOIN article_author aa ON aa.article_id = a.article_id
JOIN author         au ON au.author_id = aa.author_id
LEFT JOIN article_product ap ON ap.article_id = a.article_id
LEFT JOIN product         p  ON p.product_id = ap.product_id
WHERE a.slug = 'winter-running-guide'
ORDER BY aa.position;
```

**What this model is good at:**

- **Integrity.** Foreign keys stop an article pointing at a product that doesn't exist. Deleting an author who still has articles fails loudly, which is what you want.
- **Ad hoc questions.** "Which authors wrote about products under 50 euros last quarter?" is one query, written today, against a schema designed months ago.
- **One fact, one place.** Change a product's price once and every article shows the new price.

**What it's bad at for content:**

- **Rich, nested, evolving content.** An article body made of components (text, image, quote, product carousel) doesn't map neatly to columns. Teams either store HTML or JSON in a column, which gives up most of the relational benefits, or build an entity-attribute-value structure, which is worse.
- **Workflow and versioning.** Drafts, approvals and version history all have to be designed: a `article_version` table, status rules, a publishing process that copies rows to a live schema. CMSs exist because this is a lot of work.
- **Schema change.** A new field is a migration, a deploy and often a backfill. Fine for a product catalogue, painful for marketing content that changes shape every quarter.

## Model 2: document (MongoDB)

A document designer starts from the **reads**: what does the article page need, in one fetch? MongoDB's own guidance is that data accessed together should be stored together. The answer is to embed what belongs to the article and keep a small, deliberately duplicated summary of what doesn't.

```json
{
  "_id": "winter-running-guide",
  "status": "published",
  "publishedAt": "2026-11-01T09:00:00Z",
  "i18n": {
    "en": { "title": "Winter running guide", "summary": "...", "body": [ ] },
    "de": { "title": "Laufen im Winter", "summary": "...", "body": [ ] }
  },
  "authors": [
    { "authorId": "a-102", "name": "Priya Shah", "photo": "/img/a-102.jpg" }
  ],
  "productIds": [ "SKU-4411", "SKU-4420" ],
  "categoryIds": [ "running", "winter" ]
}
```

The `authors` array is the **extended reference** pattern: the author's ID plus the two fields the article page needs, copied in. The page renders without a second query. The cost is that when Priya changes her photo, every article that embeds it needs updating:

```javascript
db.articles.updateMany(
  { "authors.authorId": "a-102" },
  { $set: { "authors.$[a].photo": "/img/a-102-new.jpg" } },
  { arrayFilters: [ { "a.authorId": "a-102" } ] }
)
```

Products are **referenced, not embedded**, because price and stock change on their own schedule and a product appears in many articles. When you need them, you either do a second query or a `$lookup`:

```javascript
db.articles.aggregate([
  { $match: { _id: "winter-running-guide" } },
  { $lookup: { from: "products", localField: "productIds",
               foreignField: "sku", as: "products" } }
])
```

**What this model is good at:**

- **Read performance for the main use case.** One document, one index lookup, everything the page needs.
- **Flexible, nested content.** The body can be an array of typed components, each with its own fields, without a table per component type.
- **Evolving shape.** New fields appear in new documents; old documents keep working. A JSON Schema validator on the collection can still enforce the essentials.

**What it's bad at:**

- **Questions you didn't design for.** "Articles by authors who also wrote about product X" is an aggregation pipeline you write later and index for later.
- **Shared data.** Duplication means fan-out updates, and your application code, not the database, owns their consistency.
- **Unbounded growth.** Embedding comments or view events in the article document hits the **16 MB BSON document limit** eventually and slows every read long before that. Unbounded arrays belong in their own collection. I cover the patterns in [MongoDB schema design for relational developers]({{ '/blog/2026/11/mongodb-schema-design-for-relational-developers/' | relative_url }}).

## Model 3: JCR (AEM with Content Fragments)

An AEM architect starts from neither entities nor reads. The first question is: **where does this content live, who governs it and how is it published and translated?** The tree is the answer.

In AEM as a Cloud Service, structured content like this is modelled as [Content Fragments](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/content-fragments/content-fragments): the schema is a **Content Fragment Model**, stored under `/conf/<site>/settings/dam/cfm/models`, and each fragment is an asset under `/content/dam`. A model defines typed fields, including **fragment references** to other fragments and **content references** to assets.

```text
/conf/mysite/settings/dam/cfm/models/
  article        (title, slug, summary, body: multi-line rich text,
                  heroImage: content reference,
                  authors: fragment reference, multiple,
                  products: text (SKU), multiple,
                  cq:tags for categories)
  author         (name, bio, photo)

/content/dam/mysite/
  en/
    authors/priya-shah            ← Content Fragment (author)
    articles/2026/11/winter-running-guide   ← Content Fragment (article)
  de/
    authors/priya-shah
    articles/2026/11/winter-running-guide
/content/cq:tags/mysite/categories/running, winter
```

Under the hood, a fragment is a `dam:Asset` whose field values sit on a `jcr:content/data/master` node (variations sit beside `master`). A reference to an author is a **property holding a path**:

```text
/content/dam/mysite/en/articles/2026/11/winter-running-guide/jcr:content/data/master
  title    = "Winter running guide"
  authors  = [ "/content/dam/mysite/en/authors/priya-shah" ]
  products = [ "SKU-4411", "SKU-4420" ]
  cq:tags  = [ "mysite:categories/running", "mysite:categories/winter" ]
```

Notice three decisions that only make sense in the JCR:

1. **Localisation is a parallel tree** (`/en`, `/de`), not a column or a map. That's how AEM's translation framework, language copies and permissions work. I explain why in [MSM and language copies on AEMaaCS]({{ '/blog/2026/11/aem-msm-language-copies-cloud-service/' | relative_url }}).
2. **Articles are bucketed by year and month.** The JCR is a tree, and a single folder with tens of thousands of children is slow to list, slow to author and, if the parent is orderable, slow to write. Bucketing keeps every folder small.
3. **Products are stored as SKUs, not fragments.** Price and stock belong to the commerce system. The article holds a key; the page fetches live product data at render time. I cover when data belongs outside the JCR in [the next post]({{ '/blog/2026/11/when-aem-content-belongs-outside-the-jcr/' | relative_url }}).

Categories use **AEM tags**, which are themselves nodes in a tree under `/content/cq:tags`, with localised titles. That gives authors a governed taxonomy picker and gives queries an indexed property to filter on.

Delivery to a front end is typically a **persisted GraphQL query**, which can resolve fragment references in one response, so the consumer sees nested JSON much like the MongoDB document above.

**What this model is good at:**

- **Editorial workflow for free.** Versioning, approval workflows, scheduled publishing, preview, permissions inherited down the tree, translation and MSM all work because the content is in the shape AEM expects.
- **Governance by location.** "The German team can edit `/content/dam/mysite/de`" is one ACL, not application logic.
- **Schema that authors can evolve.** Adding a field to a Content Fragment Model doesn't need a database migration.

**What it's bad at:**

- **Relational questions.** "Every article that references Priya" needs a query on a path property, and the AEM reference search works in that direction. Arbitrary joins don't exist; JCR-SQL2 has joins but on Oak they rarely perform well enough for production. More in [JCR queries and Oak indexes]({{ '/blog/2026/11/jcr-queries-oak-indexes-aem-performance/' | relative_url }}).
- **Integrity.** A path reference is a string. Move or delete the author fragment outside AEM's reference-aware UI and the article points at nothing. AEM adjusts references when you move content through its UI, but a script that moves nodes directly won't.
- **High-volume, high-write data.** It's a content repository, not a transactional database.

## Side by side

| Concern | Relational | Document (MongoDB) | JCR / Content Fragments |
|---|---|---|---|
| **Identity** | Surrogate key (`article_id`) plus a unique slug | `_id`, often a natural key | The path; optional `jcr:uuid` via `mix:referenceable` |
| **One-to-many** | Foreign key on the child | Embed the children if bounded | Child nodes, or a reference property |
| **Many-to-many** | Join table | Array of IDs, or embedded summaries | Multi-value path property, or tags |
| **Schema enforced by** | DDL and constraints | Optional JSON Schema validator; mostly the application | Node types and the Content Fragment Model; `nt:unstructured` enforces almost nothing |
| **Referential integrity** | Foreign keys | None; application code | None for paths; AEM UI adjusts references on move |
| **Localisation** | Translation table (`article_i18n`) | Embedded map per language, or one document per language | Parallel language trees with translation tooling |
| **Versioning and drafts** | You design it | You design it | Built in: versions, workflows, preview and publish |
| **Ordering** | `ORDER BY` a column | Array order, or a sort field | Orderable child nodes (`nt:unstructured`, `sling:OrderedFolder`) or a property |
| **Changing shared data** | One update | Fan-out update across documents | One update; referrers read the new value |
| **Ad hoc queries** | Excellent | Good, with the right indexes | Limited; needs Oak indexes designed up front |
| **Permissions** | Grants on tables, row-level security | Roles per collection; field-level in some setups | ACLs on paths, inherited down the tree |

The row I'd draw attention to is **"changing shared data"**. Relational and JCR models both reference shared data, so one change is seen everywhere. The document model trades that away for read speed. Whether that's a good trade depends entirely on how often the shared data changes compared with how often it's read.

## How I choose a model

I don't start by asking which database is best. I ask four questions about each kind of data in the domain.

**1. Who writes it, and through what?** Authors, through an editorial UI with review and publish? That's content, and in an AEM estate it belongs in the JCR. A checkout, an ERP sync or an API? That's transactional or operational data, and it belongs in a database built for it.

**2. How is it read?** Always as a whole, by key (an article page, a user's cart)? A document model fits naturally. Sliced many ways, aggregated, reported on? Relational. Browsed by location and rendered as pages? The JCR, or whatever your CMS uses.

**3. How often does the shared part change?** If an author's name changes twice a year and is read millions of times a day, duplicating it into articles is a good trade. If a product's price changes hourly, reference it.

**4. What are the invariants?** "Stock can't go negative", "an order has exactly one customer", "every invoice line belongs to an invoice". Invariants across rows want constraints and transactions, which is the relational database's home ground. Postgres has supported `jsonb` since 9.4, so needing some flexible structure isn't a reason to leave it; I compare that option in [Postgres JSONB vs MongoDB]({{ '/blog/2026/11/postgres-jsonb-vs-mongodb/' | relative_url }}).

Applied to the domain in this post, my recommendation is a mixed model:

| Data | Where | Why |
|---|---|---|
| Articles, authors, categories | **AEM: Content Fragments and tags** | Editorial workflow, translation, permissions, preview |
| Products, prices, stock | **Commerce platform or PIM** (usually relational underneath) | Transactional, high change rate, owned by another team |
| Article view counts, ratings | **External store**, document or relational | High write volume, not editorial |
| Search across all of it | **Search index** | Built from the other three, not a source of truth |

That's not polyglot persistence for its own sake. Each store is there because its data has a different writer and a different read pattern. I go further into that framing in [SQL vs NoSQL is the wrong question]({{ '/blog/2026/11/sql-vs-nosql-is-the-wrong-question/' | relative_url }}).

## Common mistakes

| Mistake | Where | What happens | Fix |
|---|---|---|---|
| Modelling the JCR like a database: one flat folder per "table" | JCR | Huge flat folders, slow listing and authoring, poor permission design | Design the tree around governance, language and browsing; bucket large sets |
| Using `nt:unstructured` everywhere with no model | JCR | No enforcement; every consumer guesses the shape | Content Fragment Models or component dialogs as the contract |
| Storing transactional data (stock, orders) in the JCR | JCR | Write contention, replication load, no transactions across nodes | Keep it in the system of record; reference by key |
| Normalising content into dozens of tables | SQL | Every article render is a ten-way join; every new component a migration | Keep editorial content in a CMS, or store the component body as `jsonb` |
| Building versioning and workflow by hand in SQL | SQL | Months of effort to recreate a CMS badly | Use a CMS for editorial content |
| Embedding shared, frequently changing data | MongoDB | Fan-out updates, stale copies | Reference it; embed only stable summary fields |
| Embedding unbounded arrays | MongoDB | Documents grow towards 16 MB; reads slow down | Separate collection, indexed by parent ID |
| Moving or deleting JCR content with scripts | JCR | Broken path references across the site | Use AEM's move with reference adjustment, or check references first |
| Choosing one database for everything | All | The model fits one kind of data and fights the rest | Match each kind of data to its writer and its read pattern |

## Closing thought

A data model is a set of bets about the future: which questions you'll ask, which data will change and who will change it. Relational models bet on unknown future questions and protect integrity. Document models bet on known reads and accept duplication. The JCR bets on editorial governance: location, permissions, translation and publishing.

The mistake isn't picking the wrong model. It's using one model for data that's making a different bet. Put editorial content where authors can govern it, transactional data where invariants are protected, and read-heavy aggregates where they're cheapest to read.

If you're modelling content for AEM, or deciding what belongs in the JCR and what doesn't, [get in touch](/contact/).

### References

- [Content Fragments](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/content-fragments/content-fragments) (Adobe Experience League)
- [Content Fragment Models](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/sites/administering/content-fragments/content-fragment-models) (Adobe Experience League)
- [Persisted GraphQL queries](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/headless/graphql-api/persisted-queries) (Adobe Experience League)
- [JCR 2.0 specification (JSR 283)](https://developer.adobe.com/experience-manager/reference-materials/spec/jcr/2.0/index.html) (Adobe Developer)
- [Data modelling in MongoDB](https://www.mongodb.com/docs/manual/data-modeling/) (MongoDB documentation)
- [MongoDB limits and thresholds](https://www.mongodb.com/docs/manual/reference/limits/) (MongoDB documentation)
- [PostgreSQL: constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) (PostgreSQL documentation)

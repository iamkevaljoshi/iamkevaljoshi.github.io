---
layout: post
title: "MongoDB schema design for relational developers: embed, reference and the mistakes I keep seeing"
seo_title: "MongoDB Schema Design for Relational Developers"
description: "How SQL developers should design MongoDB schemas: embed vs reference, the main design patterns, unbounded arrays, the 16 MiB limit, transactions and common mistakes."
ai_summary: "MongoDB schema design starts from access patterns, not entities. Relational developers should embed data that is read together and bounded in size, reference data that is shared, large or grows without limit, and use patterns such as extended reference, subset, computed values, bucketing, polymorphic documents and schema versioning. The post explains the 16 MiB document limit, the unbounded array anti-pattern, multikey index rules, $lookup costs, multi-document transactions and their 60-second default lifetime, schema validation with $jsonSchema, and how Oak's MongoMK maps JCR nodes onto documents, then lists the mistakes I see most often in reviews."
date: 2026-11-14 11:00:00 +0530
category: databases
tags: [MongoDB, Schema Design, Data Modelling, NoSQL, Databases]
---

The first MongoDB schema a relational team writes is usually a third-normal-form database with curly braces. There's a `customers` collection, an `orders` collection, an `order_items` collection and a `products` collection, each document holding a foreign key to the others, and every screen in the application runs four `$lookup` stages to put them back together. It works in development. Then it reaches production, it's slower than the PostgreSQL it replaced, and someone concludes that "MongoDB doesn't scale".

MongoDB scales well enough. What didn't work was the model. A document database rewards you for designing around how data is **read and written together**, not how it's **related in the abstract**. That's a real shift for anyone trained on normalisation.

This post is the guide I'd give a developer who knows SQL well and is about to design their first serious MongoDB schema. It's part of a series on databases from an AEM architect's point of view. If you haven't decided whether you need a document database at all, start with [SQL vs NoSQL is the wrong question]({{ '/blog/2026/11/sql-vs-nosql-is-the-wrong-question/' | relative_url }}) and [Postgres JSONB vs MongoDB]({{ '/blog/2026/11/postgres-jsonb-vs-mongodb/' | relative_url }}).

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **Design from access patterns, not entities.** List the queries and writes first, with their frequency, then shape documents so the hot paths read one document.
- **Embed what is read together, owned by the parent and bounded in size.** Reference what is shared, large, independently updated or unbounded.
- **Unbounded arrays are the most common production failure.** Documents grow, indexes on the array grow, and eventually you hit the **16 MiB** document limit.
- **Duplication is a tool, not a sin.** Copy the few fields you display (the *extended reference* pattern) and accept that you must update copies when the source changes.
- **Transactions exist, but a schema that needs them everywhere is a relational schema in disguise.** Single-document writes are atomic; design so most business operations touch one document.
- **Use schema validation.** "Schemaless" means the database doesn't enforce a schema by default, not that you don't have one. `$jsonSchema` validators and a `schemaVersion` field save you later.

## The mental shift: from entities to access patterns

In relational design you model the domain first and worry about queries later; new queries are cheap to add. In MongoDB the order is reversed. The question is "what does the application read and write, how often, and together with what?" The schema is shaped by the workload, which makes the common path fast and some uncommon paths more awkward.

Here's the translation table I use when I explain this to SQL developers:

| Relational idea | MongoDB equivalent | Where the analogy breaks |
|---|---|---|
| Table | Collection | Documents in a collection don't have to share a shape |
| Row | Document | A document can hold what would be several tables' rows |
| Column | Field | Fields can be arrays and nested documents |
| Foreign key | Reference (an `_id` stored in another document) | Not enforced; no cascade |
| Join | Embedding, or `$lookup` in an aggregation | `$lookup` works, but it's not the default path |
| Transaction | Single-document atomicity; multi-document transactions | Multi-document transactions have time and cache limits |
| `ALTER TABLE` | Nothing; old and new shapes coexist | You need a migration strategy in code |

Before I design a collection, I write an access pattern list like this one for a simple ordering system:

| # | Operation | Frequency | Latency need |
|---|---|---|---|
| 1 | Show product page (product, price, stock, top reviews) | Very high | < 50 ms |
| 2 | Show order history for a customer | High | < 100 ms |
| 3 | Place an order | Medium | < 200 ms |
| 4 | Update a product's price | Low | Seconds are fine |
| 5 | Monthly sales report by category | Daily batch | Minutes are fine |

That list drives every decision below. Operation 1 should read one document. Operation 5 can afford an aggregation pipeline over many documents, or a separate analytics store.

## Embed or reference: the core decision

![A decision flow for embedding or referencing related data in MongoDB, based on whether data is read together, bounded, shared and independently updated]({{ '/assets/img/blog/mongodb-schema-design-for-relational-developers/01-embed-or-reference.svg' | relative_url }}){: width="1200" height="600" loading="lazy" decoding="async"}

Every relationship in your domain gets one of three treatments: embed it, reference it, or reference it and copy a few fields (a hybrid). The questions I ask, in order:

1. **Is it read together with the parent most of the time?** If not, embedding just makes the parent document heavier.
2. **Is it bounded?** An address list has maybe five entries. A comment thread or an event log does not have a natural upper bound.
3. **Is it owned by the parent, or shared?** Order lines belong to one order. A product is shared by thousands of orders.
4. **Is it updated independently and often?** Stock levels change constantly; embedding them in every document that shows a product turns one write into thousands.

| Relationship | Typical answer | Example |
|---|---|---|
| One-to-few, owned | **Embed** | Customer addresses, order lines |
| One-to-many, bounded, read together | **Embed**, maybe a subset | Product variants, the latest reviews |
| One-to-many, unbounded | **Reference** from the child | Reviews, comments, events, audit entries |
| Many-to-one, shared | **Reference**, copy display fields | Order → product, article → author |
| Many-to-many | **Arrays of references** on one or both sides, if bounded | Products ↔ categories |

Here's an order with embedded lines and a hybrid reference to the product:

```javascript
// orders collection
{
  _id: ObjectId("..."),
  customerId: ObjectId("..."),
  placedAt: ISODate("2026-11-14T05:30:00Z"),
  status: "PAID",
  shippingAddress: { line1: "...", city: "Mumbai", postcode: "400001", country: "IN" },
  lines: [
    {
      productId: ObjectId("..."),
      sku: "CHAIR-OAK-01",
      name: "Oak dining chair",     // copied at order time
      unitPrice: NumberDecimal("4999.00"),
      quantity: 4
    }
  ],
  total: NumberDecimal("19996.00"),
  schemaVersion: 2
}
```

Two things are deliberate. The shipping address is **copied**, because the order must still show where it was shipped if the customer later edits their address book. The product's name and price are copied into the line because an order is a historical record; a relational schema needs `order_lines.unit_price` for the same reason.

## Design patterns worth knowing

MongoDB documents a set of [schema design patterns](https://www.mongodb.com/docs/manual/data-modeling/design-patterns/). These are the ones I reach for most often.

### Extended reference

Store the reference and the handful of fields you display with it. An article document stores `author: { _id, name, avatarUrl }` rather than just the author's id. You save a lookup on every read and pay with an update fan-out when the author changes their name. That's a good trade when the copied fields change rarely, and a bad one for anything volatile like stock or price.

### Subset

Keep the most-used part of a large related set inside the parent, and the rest in its own collection. A product document embeds its **ten most recent reviews** for the product page; all reviews live in a `reviews` collection for the "see all" page. Writes update both, usually with a capped `$push`:

```javascript
db.products.updateOne(
  { _id: productId },
  { $push: { recentReviews: { $each: [review], $sort: { createdAt: -1 }, $slice: 10 } } }
)
```

### Computed values

If every product page shows the average rating and the number of reviews, don't compute them on read. Maintain `ratingCount` and `ratingSum` with `$inc` on each review write, or recompute them in a scheduled job. This is the document-world version of a materialised aggregate, and it's often the single biggest read optimisation available.

### Bucketing (group data)

For time series and event data, group many small records into one document per entity per time window: one document per sensor per hour, for example, with an array of readings and precomputed min/max/count. It cuts the number of documents and index entries dramatically. For pure time-series workloads, MongoDB's [time series collections](https://www.mongodb.com/docs/manual/core/timeseries-collections/) do the bucketing for you, and I'd use them before hand-rolling buckets.

### Polymorphic documents

One collection can hold documents of different shapes that share a purpose: a `products` collection with chairs, lamps and gift cards, each with its own attributes. Add a `type` discriminator field and index the common fields. Relational developers often reach for one collection per type; resist it unless the types really are queried separately.

### Schema versioning

Add a `schemaVersion` field from day one. When the shape changes, new writes use the new version, the application reads both, and a background job (or lazy migration on read) upgrades old documents. This replaces the `ALTER TABLE` you no longer have.

## Unbounded arrays and the 16 MiB limit

MongoDB's [limits page](https://www.mongodb.com/docs/manual/reference/limits/) states that "the maximum BSON document size is 16 mebibytes", and that BSON documents support no more than 100 levels of nesting. Most teams read that as "16 MiB is huge, we'll never get there". They usually don't hit the limit. They hit the problems that come long before it.

An array that grows without a bound causes trouble in this order:

1. **Every read gets slower.** You fetch the whole document to show its title, unless every query projects carefully.
2. **Every write gets more expensive.** Updating a large document has a cost in the storage engine, in replication and in the cache.
3. **Indexes on the array grow with it.** A multikey index has one entry **per array element**, so a document with 50,000 tags has 50,000 index entries.
4. **Finally, writes fail** with a document-too-large error, usually on a popular entity in production, at the worst possible moment.

The classic examples are `followers` on a user, `comments` on a post, `events` on an account and `members` on a group. The fix is to **invert the relationship**: store the parent's id on the child, in its own collection, and index it.

```javascript
// Instead of posts.comments: [ ... thousands ... ]
db.comments.insertOne({ postId: postId, author: { _id: userId, name: "Asha" }, text: "...", createdAt: new Date() })
db.comments.createIndex({ postId: 1, createdAt: -1 })
```

If you need some comments on the post itself, combine this with the subset pattern.

### An AEM aside: Oak met the same limit

If you've run AEM on MongoMK, you've seen a real system deal with this. Oak's Document Node Store keeps each JCR node as a document in a `nodes` collection, with revision history stored inside the document. Busy nodes accumulate revisions, so Oak **splits** old revisions out into separate "previous" documents to keep the main document small. It's the bucketing and archive pattern, applied by the repository itself. I cover how that affects AEM operations in [Oak storage: TarMK, MongoMK and AEM as a Cloud Service]({{ '/blog/2026/11/oak-storage-tarmk-mongomk-aem-cloud-service/' | relative_url }}).

## Indexing a document model

Indexing in MongoDB will feel familiar: B-tree indexes, compound indexes, unique and partial indexes. A few differences matter for schema design:

- **Multikey indexes.** Indexing an array field creates an entry per element. In a compound index, each document can have at most one indexed field that is an array, so `{ tags: 1, categories: 1 }` fails on a document where both are arrays. That constraint should influence which fields you model as arrays.
- **Order of compound keys.** MongoDB's guidance is the ESR rule: Equality fields first, then Sort fields, then Range fields. I go into this, with the equivalent rules in PostgreSQL, MySQL, Oracle and Oak, in [database indexing across engines]({{ '/blog/2026/11/database-indexing-postgresql-mysql-oracle-mongodb-oak/' | relative_url }}).
- **Limits.** A collection can have no more than 64 indexes and a compound index no more than 32 fields. If a polymorphic collection is heading towards either, look at the attribute pattern instead: store the variable attributes as an array of `{ k, v }` pairs and cover them with one compound index on `attrs.k` and `attrs.v`.

Check every important query with `.explain("executionStats")` before release. I compare MongoDB's plan output with the relational engines in [reading query plans side by side]({{ '/blog/2026/11/reading-query-plans-postgresql-mysql-oracle-mongodb/' | relative_url }}).

## $lookup: joins exist, so use them deliberately

`$lookup` is a left outer join inside an aggregation pipeline, and since MongoDB 5.1 the joined collection can be sharded. It's useful and I use it, but there are reasons it isn't your everyday read path:

- Each looked-up document is a separate index probe (or worse, a scan, if the foreign field isn't indexed).
- Pipelines with several `$lookup` stages are harder to reason about and tune than a SQL join, and there's no cost-based join reordering of the kind PostgreSQL or Oracle give you.
- On sharded clusters, a lookup can fan out across shards.

My rule: `$lookup` is fine for **admin screens, reports and low-frequency reads**. If a high-traffic screen needs it, that's a signal to embed or copy the fields it needs. MongoDB's own [anti-patterns guidance](https://www.mongodb.com/docs/manual/data-modeling/design-antipatterns/) lists reducing `$lookup` operations for the same reason.

## Transactions: available, but don't design around them

Every write to a single document is atomic, including updates to its embedded arrays and subdocuments. That's the main reason embedding is powerful: placing an order with its lines in one `insertOne` needs no transaction at all.

MongoDB has supported multi-document ACID transactions on replica sets since 4.0 and on sharded clusters since 4.2. They work, and I use them for the operations that really span documents, such as moving stock between warehouses or creating an order and reserving inventory atomically. Know the constraints from the [production considerations](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/):

- By default, a transaction must finish within **60 seconds** (`transactionLifetimeLimitSeconds`); longer ones are aborted.
- A transaction too large for the WiredTiger cache fails.
- Write conflicts abort the transaction, so the application must **retry**. The drivers' callback API (`withTransaction` and its equivalents) handles transient errors for you; use it rather than hand-written commit logic.
- Transactions add latency and contention. They're not free in the way a relational developer may expect.

```javascript
const session = client.startSession();
await session.withTransaction(async () => {
  await inventory.updateOne(
    { sku: "CHAIR-OAK-01", available: { $gte: 4 } },
    { $inc: { available: -4, reserved: 4 } },
    { session }
  );
  await orders.insertOne(order, { session });
}, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
```

If you find yourself wrapping most operations in transactions, step back. The schema is probably normalised in a way that fights the database. I go deeper on read and write concerns, and how they compare with relational isolation levels, in [transactions and isolation levels in practice]({{ '/blog/2026/11/transactions-isolation-levels-mvcc-in-practice/' | relative_url }}).

## Schema validation: you still have a schema

"Schemaless" is the most misleading word in this field. Your application has a schema; the only question is whether anyone writes it down. MongoDB lets you enforce one with [`$jsonSchema` validation](https://www.mongodb.com/docs/manual/core/schema-validation/):

```javascript
db.createCollection("orders", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["customerId", "placedAt", "status", "lines", "schemaVersion"],
      properties: {
        status: { enum: ["PENDING", "PAID", "SHIPPED", "CANCELLED"] },
        lines: { bsonType: "array", minItems: 1, maxItems: 500 },
        schemaVersion: { bsonType: "int", minimum: 1 }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
})
```

Note the `maxItems` on `lines`. A validator is the cheapest place to enforce that an array stays bounded. When you're migrating an existing collection, start with `validationAction: "warn"`, read the logs, fix the data, then switch to `"error"`.

## Worked example: a product catalogue

Here's how I'd model a modest e-commerce catalogue, the kind that often sits next to an AEM site. The access patterns are the ones in the table near the top.

| Collection | Contains | Why |
|---|---|---|
| `products` | Product, variants, specs, category ids, `ratingCount`/`ratingSum`, the latest 10 reviews | Product page is one read; variants are bounded and owned |
| `inventory` | One document per SKU per location | Changes constantly; must not rewrite product documents |
| `reviews` | One document per review, with `productId` | Unbounded; paginated separately |
| `orders` | Order, lines with copied name and price, copied address | Historical record; placed in one write |
| `customers` | Profile and a bounded address book | Owned, bounded |
| `categories` | Tree, with `ancestors` array for breadcrumbs | Small, read-heavy, cached |

The `categories` collection uses an array of ancestors (`ancestors: ["home", "furniture", "chairs"]`) so a breadcrumb or "everything under furniture" query is a single indexed read. That's the same idea as a materialised path, and anyone who has worked with JCR paths will recognise it. I compare the same domain modelled in JCR, relational tables and documents in [content modelling three ways]({{ '/blog/2026/11/content-modelling-jcr-vs-relational-vs-document-database/' | relative_url }}).

Where should that catalogue live relative to AEM? Not in the JCR. High-write product, inventory and order data belongs in a service with its own database, exposed to AEM through APIs. I explain the patterns in [when AEM content belongs outside the JCR]({{ '/blog/2026/11/when-aem-content-belongs-outside-the-jcr/' | relative_url }}).

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| One collection per relational table | Every screen needs several `$lookup`s; slower than the SQL it replaced | Model from access patterns; embed owned, bounded data |
| Unbounded arrays (`comments`, `followers`, `events`) | Growing documents, huge multikey indexes, eventually 16 MiB errors | Child collection with a parent id; subset pattern for the top N |
| Embedding volatile shared data (stock, price) everywhere | One change becomes thousands of writes | Reference it; copy only stable display fields |
| Copying fields with no plan to update them | Stale author names and category labels everywhere | Decide per field: historical snapshot or kept in sync, and write the sync job |
| No schema validation | Typos and type drift (`"42"` vs `42`) silently break queries | `$jsonSchema` validators, typed models, `schemaVersion` |
| Using transactions for everything | Latency, aborts and retries under load | Redesign so most business operations touch one document |
| Indexes added by guesswork | Write amplification, unused indexes, missed ESR order | Index from the access pattern list; verify with explain |
| Money as doubles | Rounding errors in totals | `Decimal128` (`NumberDecimal`) or integer minor units |

## What I'd recommend

Before writing code, write the access pattern table; it's the most valuable hour of the project. Default to embedding owned, bounded data, hunt for unbounded arrays in every review, add validation and `schemaVersion` on day one, and keep a list of the operations that really need transactions.

Be honest about that last list. If the access pattern list is full of ad hoc joins, flexible reporting and multi-entity transactions, a relational database with a few JSONB columns may serve you better. That's the subject of the [next post in the series]({{ '/blog/2026/11/postgres-jsonb-vs-mongodb/' | relative_url }}).

## Closing thought

The hardest part of MongoDB schema design isn't learning the operators. It's unlearning the habit of modelling the world before modelling the workload. Once you start from "what does this screen read?" the decisions become fairly mechanical: embed what belongs together, reference what's shared or unbounded, copy what you display, and write the schema down even though nobody forces you to.

If you're reviewing a MongoDB design, planning a migration from a relational model, or deciding where data should live next to an AEM platform, [get in touch](/contact/).

### References

- [Data modelling: schema design patterns](https://www.mongodb.com/docs/manual/data-modeling/design-patterns/) (MongoDB)
- [Schema design anti-patterns](https://www.mongodb.com/docs/manual/data-modeling/design-antipatterns/) (MongoDB)
- [MongoDB limits and thresholds](https://www.mongodb.com/docs/manual/reference/limits/) (MongoDB)
- [Production considerations for transactions](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/) (MongoDB)
- [Schema validation](https://www.mongodb.com/docs/manual/core/schema-validation/) (MongoDB)
- [Time series collections](https://www.mongodb.com/docs/manual/core/timeseries-collections/) (MongoDB)

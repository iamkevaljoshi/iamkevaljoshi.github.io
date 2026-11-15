---
layout: post
title: "Postgres JSONB vs MongoDB: do you still need a document database?"
seo_title: "Postgres JSONB vs MongoDB: Do You Need a Document DB?"
description: "Postgres JSONB vs MongoDB compared on modelling, GIN indexes, operators, update cost, scale-out, operations and licensing, with a recommendation for each workload."
ai_summary: "PostgreSQL's JSONB type stores documents in a decomposed binary form that can be indexed with GIN (jsonb_ops or the smaller jsonb_path_ops) or with B-tree expression indexes, and queried with containment, existence and SQL/JSON path operators, plus JSON_TABLE since PostgreSQL 17. That covers most document-shaped needs inside a relational database with real joins and transactions. MongoDB still wins for document-first workloads with heavy partial updates, native sharding, rich BSON types, change streams and Atlas features. The post compares modelling, indexing, update cost, planner statistics, scale-out, operations and licensing, and recommends a hybrid default: relational columns for what you query, JSONB for the variable rest."
date: 2026-11-14 12:00:00 +0530
category: databases
tags: [PostgreSQL, MongoDB, JSONB, NoSQL, Databases]
---

"We need flexible attributes, so we're adding MongoDB." I hear some version of that in a lot of architecture reviews. The team already runs PostgreSQL for orders and customers, the new feature has product attributes that vary by category, and the instinct is to bring in a second database for the "unstructured" part.

Sometimes that's the right call. More often, the team is about to take on a second operational database, a second backup strategy, a second security review and a consistency problem between two stores, to solve something a `jsonb` column and a GIN index would have handled in an afternoon.

The reverse mistake also happens. A team that loves PostgreSQL stores everything as one big `jsonb` blob per entity and then wonders why updates are slow and the planner makes strange choices. This post is how I decide between the two. It's the companion to [MongoDB schema design for relational developers]({{ '/blog/2026/11/mongodb-schema-design-for-relational-developers/' | relative_url }}), and it builds on the broader argument in [SQL vs NoSQL is the wrong question]({{ '/blog/2026/11/sql-vs-nosql-is-the-wrong-question/' | relative_url }}).

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **If you already run PostgreSQL and the documents are part of a relational domain, start with JSONB.** You keep joins, foreign keys, transactions and one operational stack.
- **Use the hybrid pattern:** real columns for what you filter, join and sort on; `jsonb` for the variable remainder. Pure "one JSONB column per table" designs throw away most of what PostgreSQL is good at.
- **Index deliberately.** GIN with `jsonb_path_ops` for containment queries, B-tree **expression indexes** for hot single keys, and generated columns when a key deserves first-class status.
- **JSONB updates rewrite the whole value.** Large, frequently patched documents are where PostgreSQL hurts and MongoDB's update model shines.
- **MongoDB earns its place** for document-first workloads with high write rates, native sharding, change streams, rich BSON types, or a team and toolchain built around it, especially on Atlas.
- **Don't run both for one domain** unless you have a clear boundary. Two sources of truth for the same entity cost more than either database.

## What JSONB actually is

PostgreSQL has two JSON types. `json` stores the text as given; `jsonb` parses it into a decomposed binary format. The [documentation](https://www.postgresql.org/docs/current/datatype-json.html) sums up the trade: `jsonb` is slightly slower to write because of the conversion, but significantly faster to process, and it supports indexing. It also normalises the document: whitespace isn't kept, key order isn't preserved and duplicate keys keep only the last value. In practice I use `jsonb` and nothing else.

A typical hybrid table looks like this:

```sql
CREATE TABLE product (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku          text        NOT NULL UNIQUE,
  category_id  bigint      NOT NULL REFERENCES category(id),
  name         text        NOT NULL,
  price        numeric(12,2) NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  attrs        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT attrs_is_object CHECK (jsonb_typeof(attrs) = 'object')
);
```

`sku`, `category_id`, `price` and `name` are columns because every query uses them, they have types and constraints, and the planner keeps statistics on them. Chair dimensions, lamp wattage and fabric codes go into `attrs`, because they vary by category and are queried less often.

## The query toolbox

PostgreSQL's JSON operator set has grown a lot since `jsonb` arrived in 9.4. The ones I use daily:

| Need | Syntax | Notes |
|---|---|---|
| Get a field as `jsonb` | `attrs -> 'dimensions'` | Chainable |
| Get a field as text | `attrs ->> 'colour'` | Cast for numbers: `(attrs ->> 'watts')::int` |
| Get by path | `attrs #>> '{dimensions,height}'` | Text array path |
| Subscript (PostgreSQL 14+) | `attrs['dimensions']['height']` | Also works in `UPDATE ... SET` |
| Containment | `attrs @> '{"colour": "oak"}'` | GIN-indexable |
| Key exists | `attrs ? 'fireRating'` | GIN-indexable with the default opclass |
| SQL/JSON path | `attrs @? '$.tags[*] ? (@ == "outdoor")'` | GIN-indexable |
| Rows from JSON (PostgreSQL 17+) | `JSON_TABLE(...)` | SQL-standard shredding into columns |

Containment is the workhorse. It's expressive, readable and indexable:

```sql
-- Oak chairs with a fire rating, in a given category
SELECT id, sku, name, price
FROM   product
WHERE  category_id = 42
AND    attrs @> '{"material": "oak", "fireRating": "BS5852"}';
```

For anything that would be an `$elemMatch` or a range filter in MongoDB, SQL/JSON path expressions do the job:

```sql
-- Products with an in-stock variant priced under 5,000
SELECT sku
FROM   product
WHERE  attrs @? '$.variants[*] ? (@.stock > 0 && @.price < 5000)';
```

PostgreSQL 17 added the SQL-standard `JSON_TABLE`, `JSON_QUERY`, `JSON_VALUE` and `JSON_EXISTS` functions. `JSON_TABLE` is the one that matters for reporting, because it turns arrays inside documents into rows you can join and aggregate:

```sql
SELECT p.sku, v.colour, v.stock
FROM   product p,
       JSON_TABLE(p.attrs, '$.variants[*]'
         COLUMNS (colour text PATH '$.colour',
                  stock  int  PATH '$.stock')) AS v
WHERE  v.stock < 5;
```

This is where PostgreSQL pulls ahead of a document store for mixed workloads: the document data joins to customers, orders and categories with the full SQL optimiser behind it.

## Indexing JSONB properly

### GIN: jsonb_ops vs jsonb_path_ops

GIN indexes index the keys and values inside each document. PostgreSQL ships two [operator classes for jsonb](https://www.postgresql.org/docs/current/gin.html#GIN-BUILTIN-OPCLASSES):

| Operator class | Supports | Trade-off |
|---|---|---|
| `jsonb_ops` (default) | `@>`, `@?`, `@@` and the key-existence operators (`?` and its any/all forms) | Bigger index; supports key-existence queries |
| `jsonb_path_ops` | `@>`, `@?`, `@@` | Smaller and faster for those operators; no `?` support |

The documentation's summary: `jsonb_path_ops` "supports fewer operators but offers better performance for those operators". If your queries are containment and path queries, which they usually are, use it:

```sql
CREATE INDEX product_attrs_gin ON product USING gin (attrs jsonb_path_ops);
```

### B-tree expression indexes for hot keys

A GIN index answers "which documents contain this?". It's not useful for ranges, sorting or equality on a single key that you filter on constantly. For those, index the expression:

```sql
CREATE INDEX product_colour_idx ON product ((attrs ->> 'colour'));
CREATE INDEX product_watts_idx  ON product (((attrs ->> 'watts')::int));

-- The query must use the same expression to match the index
SELECT sku FROM product WHERE (attrs ->> 'watts')::int BETWEEN 40 AND 60;
```

There's a second, less obvious benefit. PostgreSQL keeps statistics per column, not per key inside a `jsonb` value, so for a predicate on a key the planner falls back to generic selectivity estimates. When you create an expression index, `ANALYZE` gathers statistics on that expression too, and the estimates improve. If a JSONB query gets a strange plan, missing statistics are one of the first things I check. I cover how to read those plans in [reading query plans side by side]({{ '/blog/2026/11/reading-query-plans-postgresql-mysql-oracle-mongodb/' | relative_url }}).

### Promote keys that earn it

When a key appears in most queries, it has outgrown the document. Make it a generated column:

```sql
ALTER TABLE product
  ADD COLUMN colour text GENERATED ALWAYS AS (attrs ->> 'colour') STORED;
CREATE INDEX ON product (colour);
```

The document stays the source of truth, while the column gives you a type, statistics, a simple index and readable SQL. I treat this as the normal lifecycle of a JSONB key: it starts in the document, and when it becomes important it gets promoted. More on index types across engines in [database indexing across PostgreSQL, MySQL, Oracle, MongoDB and Oak]({{ '/blog/2026/11/database-indexing-postgresql-mysql-oracle-mongodb-oak/' | relative_url }}).

## Updates: where the models really differ

This is the section most comparisons skip, and it's often the deciding factor.

**In PostgreSQL, updating one key in a `jsonb` value writes a new version of the whole value.** `jsonb_set` and subscript assignment are convenient syntax, not partial in-place updates. Because of MVCC, the row gets a new version, and large values are stored out of line by [TOAST](https://www.postgresql.org/docs/current/storage-toast.html) (compressed and split into chunks once a row passes roughly 2 kB). So patching a counter inside a 200 kB document rewrites 200 kB, creates dead tuples for vacuum to clean up, and generates WAL in proportion.

```sql
-- Convenient, but rewrites the whole attrs value
UPDATE product
SET    attrs = jsonb_set(attrs, '{variants,0,stock}', '12')
WHERE  sku = 'CHAIR-OAK-01';
```

**MongoDB's update operators are designed for this.** `$set`, `$inc`, `$push` and `$pull` target fields inside a document, and the update language (including array filters and pipeline updates) is richer than PostgreSQL's JSON functions. The storage engine still does its own work underneath, but frequent small changes to big documents are a normal MongoDB workload, and they're an anti-pattern in PostgreSQL.

The practical rule:

| Document behaviour | PostgreSQL JSONB | MongoDB |
|---|---|---|
| Written once, read often (events, snapshots, payloads) | Excellent | Excellent |
| Small documents, occasional updates | Excellent | Excellent |
| Large documents, frequent small patches | Painful: write amplification, bloat | Good, if documents stay bounded |
| Counters and hot fields inside documents | Move them to columns | Natural with `$inc` |

If you're on PostgreSQL and hit this, the fix is usually to pull the hot fields out of the document into columns or a child table, which is what you should have done anyway.

## Types, validation and integrity

JSON has strings, numbers, booleans, null, arrays and objects. That's it. There's no date, no decimal type distinct from number, no binary and no object id. In `jsonb`, numbers are stored as PostgreSQL `numeric`, which at least avoids floating-point surprises, but dates are strings until you cast them.

MongoDB's BSON adds `Date`, `Decimal128`, `ObjectId`, binary data, 32- and 64-bit integers and more. If your documents are full of timestamps and money, BSON is more honest, although in the hybrid PostgreSQL design those fields would be typed columns anyway.

For integrity, both can enforce structure, in different ways:

- **PostgreSQL:** `CHECK` constraints on `jsonb` expressions, foreign keys on promoted columns, and full relational integrity across tables. You can also validate against a JSON Schema with extensions, though I keep checks simple and in SQL where I can.
- **MongoDB:** `$jsonSchema` validators per collection, but no foreign keys and no cross-collection constraints. Referential integrity is the application's job.

If the document references other entities and those references must be valid, PostgreSQL has a structural advantage that's hard to replicate.

## Transactions and consistency

PostgreSQL's transactions are the reason many teams stay. Updating a product's JSON attributes, its price column, an audit row and an outbox event in one transaction is ordinary SQL. The defaults are well understood (Read Committed, with Repeatable Read and Serializable available), and there are no lifetime limits beyond what you configure.

MongoDB has multi-document transactions too, but they come with a 60-second default lifetime, retry requirements and a cost that makes them something to use sparingly. A MongoDB schema is designed so most operations touch one document. If your workload naturally spans many entities per operation, that's a strong signal for PostgreSQL. I compare the two models, along with MySQL and Oracle, in [transactions, isolation levels and MVCC in practice]({{ '/blog/2026/11/transactions-isolation-levels-mvcc-in-practice/' | relative_url }}).

## Scale-out, operations and ecosystem

Here MongoDB has real advantages, and I don't think PostgreSQL enthusiasts always acknowledge them.

| Concern | PostgreSQL | MongoDB |
|---|---|---|
| Replication and failover | Streaming replication; failover through tooling (Patroni) or a managed service | Replica sets with built-in election and automatic failover |
| Horizontal scaling | Vertical first; read replicas; sharding through extensions such as Citus | Native sharding, with zone sharding and resharding |
| Change feeds | Logical decoding, `LISTEN`/`NOTIFY`, Debezium | Change streams, built into the drivers |
| Managed services | Many: RDS, Aurora, Cloud SQL, AlloyDB, Azure, and others | Atlas (MongoDB's own); others offer MongoDB-compatible APIs |
| Search and vectors | Full-text search, `pgvector` | Atlas Search, Atlas Vector Search |
| Licence | PostgreSQL Licence (permissive) | Community Server under SSPL; Atlas and Enterprise are commercial |

Two points need care.

**Licensing.** MongoDB Community Server has been under the Server Side Public License since 2018. That's fine for using MongoDB inside your own application, but it's not an OSI-approved open source licence, and some organisations' legal teams have rules about it. PostgreSQL's licence raises no such questions. Check with your legal team before you assume either way.

**"Compatible" isn't "the same".** Several services and projects speak the MongoDB wire protocol on other engines. Amazon DocumentDB is AWS's own implementation. Microsoft's open-source [DocumentDB](https://github.com/microsoft/documentdb) is a PostgreSQL extension that adds BSON support and powers Azure Cosmos DB for MongoDB vCore; it moved to the Linux Foundation in 2025, and FerretDB 2.x uses it to offer a MongoDB-compatible front end on PostgreSQL. These are interesting options for teams that want MongoDB's API on a PostgreSQL base, but test your actual queries and drivers: feature coverage differs between them and MongoDB itself.

If your plan includes semantic search over content, both sides have credible answers. I compare `pgvector`, Atlas Vector Search and dedicated vector databases in [vector search for RAG over CMS content]({{ '/blog/2026/11/vector-search-pgvector-vs-mongodb-atlas-vs-vector-database/' | relative_url }}).

## Performance: what I'd actually expect

I'm wary of published JSONB vs MongoDB benchmarks. Results depend on document size, index design, update pattern, hardware and how hard each side was tuned, and most benchmarks are written to prove a point. What I've seen hold up in practice:

- **Point reads by key** are fast on both. Neither is your bottleneck.
- **Containment and filter queries with a good index** are comparable. Without the right index, both degrade to scans.
- **Mixed queries joining documents to relational data** favour PostgreSQL clearly, because MongoDB needs `$lookup` or application-side joins.
- **Write-heavy workloads patching large documents** favour MongoDB, for the reasons in the updates section.
- **Very large data sets needing horizontal write scaling** favour MongoDB's native sharding, unless you're prepared to run Citus or a distributed PostgreSQL service.

If performance is the deciding factor, prototype with your own documents and access patterns for a week. It's cheaper than a migration two years later.

## Where AEM fits

On AEM projects the question usually comes up for data that sits next to the CMS: form submissions, product data, user preferences, personalisation profiles, or content synced from another system. None of it belongs in the JCR, for the reasons I set out in [when AEM content belongs outside the JCR]({{ '/blog/2026/11/when-aem-content-belongs-outside-the-jcr/' | relative_url }}).

My default for that adjacent data is PostgreSQL with JSONB columns, behind a service that AEM calls over an API. Form payloads go in as `jsonb` with a few promoted columns (form id, submitted date, status), which gives the business team SQL reporting without an export pipeline. I'd choose MongoDB when the client already runs Atlas well, or when the data really is document-first and high-write, such as a large, frequently updated product catalogue fed from a PIM.

AEM itself is a useful reminder that a document store and a hierarchical repository are different things. Oak can run on MongoDB through MongoMK, but it uses MongoDB as a storage layer for JCR nodes rather than exposing a document model to you. I cover that in [Oak storage: TarMK, MongoMK and AEM as a Cloud Service]({{ '/blog/2026/11/oak-storage-tarmk-mongomk-aem-cloud-service/' | relative_url }}).

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| Adding MongoDB for "flexible attributes" next to PostgreSQL | Two stores, two backup plans, cross-store consistency bugs | A `jsonb` column with GIN and expression indexes |
| One `jsonb` blob per row, nothing else | No types, no foreign keys, poor planner estimates | Hybrid: columns for queried fields, `jsonb` for the rest |
| `json` instead of `jsonb` | No GIN indexing; reparsed on every access | Use `jsonb` |
| Default `jsonb_ops` when you only use `@>` | Larger index than needed | `jsonb_path_ops` |
| GIN index for range or sort queries | Index not used; sequential scan | B-tree expression index or generated column |
| Query expression doesn't match the index expression | Index ignored | Use the exact indexed expression, cast included |
| Counters and hot fields inside large JSONB | Write amplification, bloat, vacuum pressure | Promote to columns or a child table |
| Choosing MongoDB, then needing multi-entity transactions everywhere | Transaction overhead, retries and contention | Reconsider the model or the database |
| Assuming "MongoDB-compatible" means identical | Missing operators or driver behaviour in production | Test real queries against the chosen service |
| Ignoring SSPL until procurement | Late legal blocker | Check licensing early |

## What I'd recommend

- **Already on PostgreSQL, document data belongs to a relational domain:** stay on PostgreSQL. Hybrid tables, `jsonb_path_ops` GIN, expression indexes and generated columns for hot keys.
- **New, document-first service with high write rates, bounded documents and scale-out needs:** MongoDB, ideally on Atlas unless you have a strong operations team. Design it properly using the [schema design guide]({{ '/blog/2026/11/mongodb-schema-design-for-relational-developers/' | relative_url }}).
- **Heavy reporting across documents and relational data:** PostgreSQL, or a warehouse fed from either.
- **Team already expert in one of them:** weight that heavily. Operational familiarity beats a modest feature advantage almost every time.
- **Both in the same estate:** fine, as long as each owns distinct domains. Never two sources of truth for the same entity.

For the wider choice between relational engines, see [MySQL vs PostgreSQL vs Oracle: how to choose]({{ '/blog/2026/11/mysql-vs-postgresql-vs-oracle-how-to-choose/' | relative_url }}).

## Closing thought

The useful question isn't "relational or document?" It's "where do the variable parts of my data live, and what do I need to do with them?" For most teams already on PostgreSQL, the answer is a `jsonb` column and two well-chosen indexes. For teams whose whole workload is documents, with heavy partial updates and scale-out needs, MongoDB is a mature, sensible choice. The expensive outcome is the one in the middle: two databases holding halves of the same thing.

If you're weighing a document database against your existing PostgreSQL estate, or deciding where data next to an AEM platform should live, [get in touch](/contact/).

### References

- [JSON types](https://www.postgresql.org/docs/current/datatype-json.html) (PostgreSQL documentation)
- [JSON functions and operators](https://www.postgresql.org/docs/current/functions-json.html) (PostgreSQL documentation)
- [GIN built-in operator classes](https://www.postgresql.org/docs/current/gin.html#GIN-BUILTIN-OPCLASSES) (PostgreSQL documentation)
- [TOAST](https://www.postgresql.org/docs/current/storage-toast.html) (PostgreSQL documentation)
- [Update operators](https://www.mongodb.com/docs/manual/reference/operator/update/) (MongoDB)
- [Production considerations for transactions](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/) (MongoDB)
- [DocumentDB](https://github.com/microsoft/documentdb) (GitHub)

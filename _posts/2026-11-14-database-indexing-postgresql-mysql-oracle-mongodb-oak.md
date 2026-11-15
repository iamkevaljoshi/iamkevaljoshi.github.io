---
layout: post
title: "Database indexing across engines: PostgreSQL, MySQL, Oracle, MongoDB and Oak"
seo_title: "Indexing in PostgreSQL, MySQL, Oracle, MongoDB and Oak"
description: "Composite, partial, expression and covering indexes in PostgreSQL, MySQL and Oracle, the MongoDB ESR rule and multikey indexes, and Oak indexes in AEM."
ai_summary: "Indexes in PostgreSQL, MySQL, Oracle, MongoDB and Apache Jackrabbit Oak share one idea, a sorted structure that turns a scan into a lookup, but differ in the details that decide performance. The post compares B-tree basics, the leftmost-prefix rule and skip scans, partial and expression indexes, covering indexes (Postgres INCLUDE and index-only scans, InnoDB secondary indexes carrying the primary key, Oracle composite indexes), invisible indexes and online builds. It covers MongoDB compound and multikey indexes, the Equality-Sort-Range rule, partial and covered queries, and Oak's property and Lucene indexes in AEM, including one-index-per-query and ordered properties. It ends with a design method and the common indexing mistakes."
date: 2026-11-14 13:00:00 +0530
category: databases
tags: [Indexing, PostgreSQL, MySQL, Oracle, MongoDB, Oak]
---

In most performance reviews I do, the slowest query in the system has an index. It just isn't the right one: the columns are in the wrong order, the query wraps the column in a function, or the index covers the filter but not the sort.

Indexing is one of the few skills that transfers almost completely between database engines. A B-tree in PostgreSQL, a B-tree in Oracle, a compound index in MongoDB and a Lucene property index in AEM's Oak repository are all the same idea: a sorted copy of some of your data, kept up to date on every write, that lets the engine jump to the rows it needs. The differences are in the details, and the details are where queries go wrong.

This post puts five engines side by side: PostgreSQL, MySQL (InnoDB), Oracle, MongoDB and Apache Jackrabbit Oak. On enterprise AEM programmes, most teams work with more than one of them.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **An index is a sorted copy of some columns with a pointer back to the row.** It speeds up reads that match its order and slows down every write. Each index has to earn its place.
- **Column order in a composite index is the design.** Put equality columns first, then the sort column, then range columns. MongoDB calls this the **ESR rule** (Equality, Sort, Range); the same logic applies to relational B-trees.
- **Partial indexes** (Postgres, MongoDB) index only the rows you query. MySQL has no partial indexes; Oracle gets a similar effect from a function-based index that returns `NULL` for rows to skip.
- **Expression indexes** fix "the query uses `LOWER(email)`, the index is on `email`". Postgres, MySQL 8.0.13+ and Oracle all support them; the query must use the same expression.
- **Covering indexes** let the engine answer from the index alone. Postgres has `INCLUDE`; InnoDB secondary indexes always carry the primary key; Oracle and MySQL cover by adding columns to the key. MongoDB covers when the projection only uses indexed fields.
- **MongoDB indexes arrays automatically (multikey),** but a compound index can contain at most one array field per document.
- **Oak uses one index per query.** Every restricted property, the path restriction and the sort must be in the same Lucene index, or Oak filters and sorts by reading nodes.
- **Measure, don't guess.** Read the plan, then check usage statistics and drop indexes nobody uses.

## What an index actually is

PostgreSQL, MySQL, Oracle and MongoDB all use a **B-tree** (or B+tree) as their default index; Oak's Lucene indexes are inverted indexes, a different structure with the same purpose. A B-tree is a balanced tree of sorted keys, a few levels deep even for hundreds of millions of rows. A lookup walks from the root to a leaf in a handful of page reads, then follows a pointer to the row, or scans along the leaves for a range.

That gives you three things, and costs you two:

| You get | You pay |
|---|---|
| Fast equality lookups | Extra work on every `INSERT`, `UPDATE` and `DELETE` that touches indexed columns |
| Fast range scans (`BETWEEN`, `>`, `<`, prefix `LIKE 'abc%'`) | Storage and memory: indexes compete with data for the buffer cache |
| Rows already in order, so `ORDER BY` with `LIMIT` stops early | |

The third benefit is underrated. "The 20 newest orders for this customer" with an index on `(customer_id, created_at)` reads 20 index entries and stops. Without the sort in the index, it reads and sorts every order for that customer.

### Where the row lives

The pointer from index to row differs by engine, and it matters for design:

| Engine | Table storage | What a secondary index points to |
|---|---|---|
| **PostgreSQL** | Heap (unordered) | A physical tuple location (TID) |
| **MySQL InnoDB** | Clustered: the table is the primary key B-tree | The primary key value, so a secondary lookup does a second B-tree walk |
| **Oracle** | Heap by default; index-organised tables (IOT) are optional | A ROWID (physical address) |
| **MongoDB** (WiredTiger) | Collection stored by an internal record id | The record id |
| **Oak** (Lucene index) | The node store | The node path |

InnoDB has the biggest practical consequence. Every secondary index stores the primary key, so **a long primary key makes every index bigger**, and a random one (such as a version 4 UUID) scatters inserts across the clustered index. I recommend a compact, roughly increasing primary key, and a separate unique column for an external identifier if you need one.

## Composite indexes and column order

A composite index on `(a, b, c)` is sorted by `a`, then `b` within each `a`, then `c`. It can serve:

- `WHERE a = ?`
- `WHERE a = ? AND b = ?`
- `WHERE a = ? AND b = ? AND c > ?`
- `WHERE a = ? ORDER BY b`

It can't efficiently serve `WHERE b = ?` on its own, because `b` values are scattered across every `a`. That's the **leftmost prefix rule**, and it holds in all three relational engines.

There is a modern nuance: **skip scan**. Oracle has had index skip scans for a long time. MySQL 8.0.13 added a skip scan range access method. PostgreSQL 18 added skip scan for multicolumn B-tree indexes; the [release notes](https://www.postgresql.org/docs/current/release-18.html) describe it as allowing those indexes to be used "in more cases". Skip scan helps when the leading column has few distinct values. It doesn't replace a correctly ordered index, and I wouldn't design around it.

### Equality, then sort, then range

The ordering rule I use everywhere is the one MongoDB documents as the [ESR guideline](https://www.mongodb.com/docs/manual/tutorial/equality-sort-range-guideline/):

1. **Equality** columns first (`status = 'OPEN'`, `customer_id = 42`).
2. **Sort** columns next (`ORDER BY created_at DESC`).
3. **Range** columns last (`total > 100`, `created_at >= '2026-01-01'`).

Why sort before range? After a range condition, matching entries are no longer in sort order, so the engine sorts in memory. Sort before range keeps the output ordered so `LIMIT` stops early, at the cost of checking the range by scanning index entries. For paged results that's usually the better trade.

```sql
-- Query: open orders for a customer over 100, newest first, first page
SELECT id, total, created_at
FROM orders
WHERE customer_id = 42 AND status = 'OPEN' AND total > 100
ORDER BY created_at DESC
LIMIT 20;

-- E, E, S, R
CREATE INDEX orders_cust_status_created_total
  ON orders (customer_id, status, created_at DESC, total);
```

The same index works in PostgreSQL, MySQL 8 (which supports descending index columns) and Oracle. In MongoDB:

```javascript
db.orders.createIndex({ customerId: 1, status: 1, createdAt: -1, total: 1 })

db.orders.find(
  { customerId: 42, status: "OPEN", total: { $gt: 100 } }
).sort({ createdAt: -1 }).limit(20)
```

## Partial indexes

A partial index contains only the rows that match a condition. If 98% of orders are closed and every hot query looks at open ones, index only the open ones: smaller, faster to maintain, more likely to stay in memory.

| Engine | Support | Example |
|---|---|---|
| **PostgreSQL** | Native ([`WHERE` clause](https://www.postgresql.org/docs/current/indexes-partial.html)) | `CREATE INDEX ... ON orders (customer_id, created_at) WHERE status = 'OPEN';` |
| **MongoDB** | Native ([`partialFilterExpression`](https://www.mongodb.com/docs/manual/core/index-partial/)) | `createIndex({ customerId: 1, createdAt: -1 }, { partialFilterExpression: { status: "OPEN" } })` |
| **Oracle** | No `WHERE` clause; a B-tree doesn't store entries whose key columns are all `NULL`, so a function-based index that returns `NULL` for other rows has the same effect | `CREATE INDEX ... ON orders (CASE WHEN status = 'OPEN' THEN customer_id END);` |
| **MySQL** | Not supported | Separate table for the hot subset, or accept a full index |

The **query must imply the index condition**: in Postgres, a query on `status = $1` with a bind variable may not match a partial index on `status = 'OPEN'`, because the planner can't prove the parameter will be `'OPEN'` when it builds a generic plan. With Oracle's `CASE` trick, the query must use **the same expression** as the index.

Partial unique indexes are also the cleanest way to express "only one active row per customer": `CREATE UNIQUE INDEX ... ON subscriptions (customer_id) WHERE active;` in Postgres, or a unique index with a `partialFilterExpression` in MongoDB.

## Expression (function-based) indexes

The most common reason an index isn't used is a function around the column:

```sql
SELECT * FROM users WHERE LOWER(email) = 'keval@example.com';
```

An index on `email` doesn't help, because it's sorted by `email`, not by `LOWER(email)`. Index the expression instead:

| Engine | Syntax | Notes |
|---|---|---|
| **PostgreSQL** | `CREATE INDEX ON users (LOWER(email));` | Any immutable expression ([docs](https://www.postgresql.org/docs/current/indexes-expressional.html)) |
| **MySQL 8.0.13+** | `CREATE INDEX users_email_lower ON users ((LOWER(email)));` | Note the double parentheses: functional key parts. Earlier versions: index a generated column |
| **Oracle** | `CREATE INDEX users_email_upper ON users (UPPER(email));` | Function-based indexes; functions must be deterministic |
| **MongoDB** | No expression indexes | Store the normalised value in its own field, or use a case-insensitive collation on the index |

Often you don't need one. **Normalise on write** (store emails lower-case). **Rewrite date truncation as a range**: `created_at >= '2026-11-14' AND created_at < '2026-11-15'` instead of `DATE(created_at) = '2026-11-14'`. And **watch implicit conversions**: comparing a `VARCHAR` column with a number in MySQL, or a `VARCHAR2` column with an `NVARCHAR2` bind in Oracle, can wrap the column in a conversion and silently disable the index.

## Covering indexes

A covering index contains every column a query needs, so the engine never visits the table. It's the cheapest way to make a hot, narrow query faster.

| Engine | How you cover | What to check in the plan |
|---|---|---|
| **PostgreSQL** | Key columns plus non-key columns with `INCLUDE` (Postgres 11+) | `Index Only Scan`, and a low `Heap Fetches` count |
| **MySQL InnoDB** | Add columns to the key; secondary indexes already include the primary key | `Using index` in `EXPLAIN` |
| **Oracle** | Add columns to the key, or use an index-organised table | Index access with no `TABLE ACCESS BY INDEX ROWID` step |
| **MongoDB** | Every filtered and projected field in the index; exclude `_id` unless it's indexed | `totalDocsExamined: 0` in `executionStats` |

```sql
-- PostgreSQL: look up by customer, return status and total without touching the heap
CREATE INDEX orders_cust_created_incl
  ON orders (customer_id, created_at DESC) INCLUDE (status, total);
```

PostgreSQL has a catch. An index-only scan checks the **visibility map** and fetches the heap row when a page isn't marked all-visible, so on a heavily updated table with lagging vacuum it can do almost as many heap fetches as a normal scan ([documentation](https://www.postgresql.org/docs/current/indexes-index-only-scans.html)). Keep autovacuum healthy where you rely on covering indexes.

In MongoDB, a multikey index can't cover a query on the array field. If the field you're projecting is an array, expect to read the documents.

## MongoDB: compound, multikey and the rest

MongoDB indexes behave much like relational B-trees, with a few specific rules.

**Multikey indexes.** Index a field that holds an array and MongoDB creates one index entry per element, automatically. It's what makes `{ tags: "databases" }` fast. The [multikey documentation](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-multikey/) sets the limit that catches people: in a compound multikey index, each document can have **at most one indexed field whose value is an array**. An index on `{ tags: 1, categories: 1 }` fails to accept a document where both are arrays.

**Index types worth knowing:**

| Type | Use |
|---|---|
| Compound | The default; up to 32 fields |
| Unique, partial | Constraints and subsets; prefer partial to sparse |
| TTL | Expire documents after a time, such as sessions and tokens |
| Wildcard | Unknown or user-defined field names; not a replacement for designed indexes |
| Text, `2dsphere` | Basic full-text and location; on Atlas, Atlas Search is usually the better full-text option |

**The `_id` index** is always there and is unique. If you have a natural, immutable key, use it as `_id` rather than adding a second unique index beside the generated `ObjectId`.

I go further into embedding, references and array design in the [MongoDB schema design post]({{ '/blog/2026/11/mongodb-schema-design-for-relational-developers/' | relative_url }}), and compare GIN indexes on Postgres JSONB with MongoDB indexes in the [JSONB vs MongoDB post]({{ '/blog/2026/11/postgres-jsonb-vs-mongodb/' | relative_url }}).

## Oak: indexes in AEM's content repository

AEM's repository, Apache Jackrabbit Oak, has indexes too, and the same principles apply with two twists. I cover Oak queries in detail in [JCR queries that don't hurt AEM]({{ '/blog/2026/11/jcr-queries-oak-indexes-aem-performance/' | relative_url }}); here's how they compare.

| Concept | Relational / MongoDB | Oak |
|---|---|---|
| Default index structure | B-tree | Lucene index (`type = lucene`); synchronous property indexes exist in the product |
| Composite index | Ordered key columns | One index rule listing several properties; order of definition doesn't matter in the same way |
| Index combination | Postgres bitmap AND / MongoDB index intersection (rarely chosen) | **None: one index per query** |
| Sort from the index | Key order | `ordered = true` on the property |
| Partial index | `WHERE` / `partialFilterExpression` | `includedPaths` (by path) and index rules per node type |
| Hints | Optimizer hints, `hint()` | Index `tags` with `selectionPolicy = tag`, and `option(index tag ...)` in the query |
| Write cost | Synchronous on commit | Lucene indexes update asynchronously (`[async, nrt]`), so a fresh write may not be searchable for a moment |
| Defined in | DDL / `createIndex` / migrations | Index definitions under `/oak:index`, deployed from `ui.apps` on AEM as a Cloud Service |

The **one index per query** rule is the one that catches relational developers. In Postgres, two single-column indexes on `status` and `created_at` can be combined with a bitmap AND. In Oak, if your query restricts `cq:tags` and `cq:template` and orders by `jcr:created`, all three properties must be in the **same** index definition, with `jcr:created` marked `ordered`. Otherwise Oak picks the cheapest index for part of the query and filters or sorts the rest by reading nodes, which shows up as "Index-Traversed" warnings.

The **path restriction** is Oak's equivalent of the leading equality column. Queries should restrict a path, and the index should set `evaluatePathRestrictions = true` so it handles that restriction itself. `includedPaths` behaves like a partial index on a subtree: content outside it isn't indexed at all.

On AEM as a Cloud Service, [custom indexes](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/operations/indexing) must be `lucene`, versioned (`acme.articles-1-custom-1`) and are built during the deployment before traffic switches.

## Building indexes without downtime

Creating an index on a large, busy table is an operation in itself:

| Engine | Online option | Caveats |
|---|---|---|
| **PostgreSQL** | `CREATE INDEX CONCURRENTLY` | Slower; can't run in a transaction block; a failed build leaves an `INVALID` index to drop and retry |
| **MySQL InnoDB** | Online DDL: `ALGORITHM=INPLACE, LOCK=NONE` | Brief metadata locks at start and end; watch replication lag on large builds |
| **Oracle** | `CREATE INDEX ... ONLINE` | Online index builds are an Enterprise Edition feature |
| **MongoDB** | Index builds don't block reads and writes for the whole build | Exclusive lock briefly at the start and end; on replica sets builds run across members |
| **Oak on AEMaaCS** | New index version built during the rolling deployment | Large `includedPaths` mean longer deployments |

### Test before you commit: invisible and hypothetical indexes

MySQL 8 and Oracle support [invisible indexes](https://dev.mysql.com/doc/refman/8.4/en/invisible-indexes.html): maintained on writes, ignored by the optimiser. Make an index invisible, watch for regressions, then drop it. PostgreSQL has no equivalent; the HypoPG extension lets you test hypothetical indexes with `EXPLAIN`.

## Finding unused and missing indexes

Every index slows writes and takes memory. Unused ones are pure cost. Each engine can tell you which are used:

| Engine | Where to look |
|---|---|
| PostgreSQL | `pg_stat_user_indexes.idx_scan` (since the last statistics reset); `pg_stat_statements` for slow queries |
| MySQL | `sys.schema_unused_indexes`; `performance_schema` statement digests |
| Oracle | `DBA_INDEX_USAGE` (12.2 and later) or index monitoring; AWR reports |
| MongoDB | `$indexStats` aggregation stage; the profiler and slow query log |
| Oak | Query Performance tool and Explain Query in the AEMaaCS Developer Console; traversal warnings in logs |

Check usage across a full business cycle before dropping anything. An index used only by the month-end report looks unused for 29 days.

For missing indexes, start from the slow queries by total time and read their plans, the subject of the [query plans post]({{ '/blog/2026/11/reading-query-plans-postgresql-mysql-oracle-mongodb/' | relative_url }}).

## A design method that works on every engine

The steps I follow on any engine:

1. **List the access patterns:** queries with filters, sorts, limits and frequency, not tables. The [SQL vs NoSQL post]({{ '/blog/2026/11/sql-vs-nosql-is-the-wrong-question/' | relative_url }}) explains why that list drives the design.
2. **Design one index per important pattern,** ordered equality, sort, range.
3. **Merge overlaps.** An index on `(a, b)` makes one on `(a)` redundant.
4. **Cover or partially index** the hottest, narrowest queries.
5. **Read plans against production-like volumes,** then re-check usage after go-live.

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| One single-column index per column | Engine can use only one (or combines them expensively) | Composite indexes designed per query |
| Range column before sort column | In-memory sort; `LIMIT` can't stop early | Equality, sort, range |
| Function or cast around the indexed column | Index ignored | Expression index, normalise on write, or rewrite as a range |
| Leading wildcard `LIKE '%term'` | B-tree can't help | Full-text search (Postgres `tsvector`/GIN, MySQL `FULLTEXT`, Oracle Text, Atlas Search, Oak full-text) |
| Random UUID primary key on InnoDB | Fragmented clustered index, bigger secondary indexes | Compact increasing key; UUID as a separate unique column |
| Partial index with a parameterised condition (Postgres) | Planner can't prove the predicate; index not used | Literal predicate in the query, or a full index |
| Two array fields in one MongoDB compound index | Inserts of documents with both arrays fail | Redesign the index or the schema |
| Oak query restrictions spread over several indexes | Index traversal; slow on large repositories | One tagged Lucene index with every restricted property and `ordered` sort |
| Indexing everything "just in case" | Slow writes, memory pressure, longer deployments | Index for measured access patterns; drop unused indexes |
| Building a large index in a blocking way at peak | Locked table or long pipeline | Online builds, off-peak, or Oak's versioned indexes with narrow `includedPaths` |

## Closing thought

An index is a sorted copy of your data, built for a query you expect to run. Design it from the query, order the columns by equality, sort and range, and check the plan. The engine-specific details, such as Postgres's visibility map, InnoDB's clustered primary key, Oracle's `NULL` handling, MongoDB's multikey limits and Oak's one-index-per-query rule, decide whether that sorted copy actually gets used.

On mixed estates (an AEM platform with Oak, a commerce database on MySQL or Oracle, a Postgres service behind an API, perhaps MongoDB for user data) the same discipline pays off in each of them. If your team needs a hand reviewing indexes or query performance across engines, [get in touch](/contact/).

### References

- [Indexes](https://www.postgresql.org/docs/current/indexes.html) (PostgreSQL documentation)
- [Partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html) (PostgreSQL documentation)
- [Indexes on expressions](https://www.postgresql.org/docs/current/indexes-expressional.html) (PostgreSQL documentation)
- [Index-only scans and covering indexes](https://www.postgresql.org/docs/current/indexes-index-only-scans.html) (PostgreSQL documentation)
- [PostgreSQL 18 release notes](https://www.postgresql.org/docs/current/release-18.html) (PostgreSQL)
- [CREATE INDEX statement](https://dev.mysql.com/doc/refman/8.4/en/create-index.html) (MySQL 8.4 Reference Manual)
- [Invisible indexes](https://dev.mysql.com/doc/refman/8.4/en/invisible-indexes.html) (MySQL 8.4 Reference Manual)
- [Indexes and index-organized tables](https://docs.oracle.com/en/database/oracle/oracle-database/23/cncpt/indexes-and-index-organized-tables.html) (Oracle Database Concepts)
- [The ESR (Equality, Sort, Range) guideline](https://www.mongodb.com/docs/manual/tutorial/equality-sort-range-guideline/) (MongoDB)
- [Multikey indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-multikey/) (MongoDB)
- [Partial indexes](https://www.mongodb.com/docs/manual/core/index-partial/) (MongoDB)
- [Content search and indexing](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/operations/indexing) (Adobe Experience League)
- [Lucene index](https://jackrabbit.apache.org/oak/docs/query/lucene.html) (Apache Jackrabbit Oak)

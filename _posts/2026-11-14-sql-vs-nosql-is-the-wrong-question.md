---
layout: post
title: "SQL vs NoSQL is the wrong question: choose a database by access patterns, consistency and operations"
seo_title: "SQL vs NoSQL Is the Wrong Question: How to Choose a Database"
description: "Stop asking SQL or NoSQL. Choose a database by access patterns, consistency, real scale, team skills and operational cost, with a decision table and examples."
ai_summary: "SQL versus NoSQL is a misleading way to choose a database, because NoSQL covers document, key-value, wide-column, graph and search engines with little in common, relational databases now handle JSON well, MongoDB supports multi-document transactions and distributed SQL databases scale horizontally. This post replaces the label with five questions: what the access patterns are and how well they are known, which invariants need transactions and how stale reads can be, what the real data volume and write rate are, what the team can already run and debug, and who operates backups, upgrades and failover. It includes a workload decision table, three worked scenarios, a view on polyglot persistence and common mistakes. The default recommendation is a managed relational database unless a specific requirement argues otherwise."
date: 2026-11-14 10:00:00 +0530
category: databases
tags: [Databases, NoSQL, PostgreSQL, MongoDB, Architecture, Data Modelling]
---

Some architecture reviews start with a slide titled "SQL or NoSQL?". Two columns, a list of adjectives under each ("structured", "scalable", "flexible", "ACID"), and a decision made somewhere between the adjectives and the coffee. Six months later the team is writing joins in application code against a document store, or sharding a relational database they never needed to shard, and nobody can remember why the choice was made.

The question is wrong because both labels are too broad to mean anything. "NoSQL" includes MongoDB, Redis, Cassandra, DynamoDB, Neo4j and Elasticsearch, which have about as much in common as a lorry, a bicycle and a ferry. "SQL" includes SQLite on a phone and a globally distributed Spanner cluster. And the lines have blurred: Postgres stores and indexes JSON, MongoDB has multi-document transactions, and several SQL databases now scale horizontally.

This post is how I frame the database decision instead: five questions, a decision table and three worked examples. It's the seventh post in my database series. If you want the engine-level comparison afterwards, read [MySQL vs PostgreSQL vs Oracle]({{ '/blog/2026/11/mysql-vs-postgresql-vs-oracle-how-to-choose/' | relative_url }}) and [Postgres JSONB vs MongoDB]({{ '/blog/2026/11/postgres-jsonb-vs-mongodb/' | relative_url }}).

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **"NoSQL" isn't a category you can choose.** Document, key-value, wide-column, graph and search engines solve different problems. Choose a data model and an engine, not a label.
- **The old trade-offs have blurred.** Postgres and MySQL handle JSON; MongoDB supports multi-document ACID transactions; distributed SQL databases shard automatically.
- **Decide on five things:** access patterns, consistency, real scale, team skills and operations. In that order.
- **Access patterns first.** If you know every query up front and they're all by key, a key-value or document store fits. If the questions will change, a relational database keeps your options open.
- **Most systems never outgrow one well-run relational primary** plus read replicas. Be honest about numbers before designing for scale you don't have.
- **Operations decide the real cost.** The database your team can back up, restore, upgrade and debug at 3 a.m. beats the one with the better benchmark.
- **My default:** a managed relational database (usually PostgreSQL), plus a specialised store only when a specific workload proves it needs one.

## Why the label fails

Here's what "NoSQL" actually contains:

| Model | Examples | Good at | Poor at |
|---|---|---|---|
| **Document** | MongoDB, Couchbase, Firestore | Aggregates read and written as a unit; evolving shape | Cross-document relationships and ad hoc joins |
| **Key-value** | Redis, DynamoDB (in its simplest use), Memcached | Very fast lookups by key; caching; sessions | Anything that isn't a lookup by key |
| **Wide-column** | Cassandra, ScyllaDB, Bigtable | Huge write volumes, time-ordered data, multi-region writes | Ad hoc queries; data modelled per query |
| **Graph** | Neo4j, Amazon Neptune | Traversing deep, many-hop relationships | Bulk aggregation and simple CRUD at scale |
| **Search** | Elasticsearch, OpenSearch, Solr | Full-text relevance, faceting, fuzzy matching | Being a system of record |

And the "SQL" side has moved too:

- **PostgreSQL** has had `jsonb` with GIN indexing since 9.4, and MySQL has a native `JSON` type. A flexible attribute bag is no longer a reason to leave a relational database.
- **MongoDB** has supported multi-document transactions since 4.0 on replica sets and 4.2 on sharded clusters. Its default write concern has been `majority` since 5.0 for most deployments.
- **Distributed SQL** databases such as Google Spanner, CockroachDB and YugabyteDB offer SQL and transactions across many nodes.

So when someone says "we need NoSQL because we need scale", or "we need SQL because we need transactions", they're usually repeating a trade-off from 2012. The useful question is narrower: **what does this workload need, and which engine provides it with the least effort and risk?**

## Question 1: what are your access patterns?

This is the question that matters most and gets asked least. Before choosing anything, I ask the team to write down the **top ten reads and top five writes** with expected frequency. Not entities, not a domain model: queries.

```text
R1  Get order by ID, with lines and customer name        2,000/s
R2  List a customer's last 20 orders                     300/s
R3  Search products by text, filter by category, price   800/s
R4  Daily revenue by region and category                 1/day
W1  Create order with lines, decrement stock             40/s
W2  Update order status                                  100/s
```

Then look at the shape of the list:

- **All by key, all known up front** (R1, R2, W2): a document or key-value model fits perfectly. You design the data around these reads and they're one lookup each. DynamoDB's single-table design takes this to its logical end: you model the table for the access patterns, and new patterns may need new indexes or a redesign.
- **Many filters and sorts, some unknown** (R3, R4): a relational database's query planner, and indexes you can add later, keep you flexible. Full-text relevance (R3) is a search engine's job, fed from the system of record.
- **Writes that touch several entities atomically** (W1): this is a consistency question, below.

The trap is that access patterns are rarely as known as teams think. Reporting, support tooling, data exports and "can we just see…" requests arrive after launch. **The less certain you are about future queries, the more a relational model is worth.** A document model optimised for today's reads makes tomorrow's unexpected question expensive; a normalised schema makes it a new index.

## Question 2: what consistency do you need?

Two separate questions hide here.

**Which invariants span more than one record?** "An order's lines and the stock decrement happen together or not at all." "A transfer debits one account and credits another." These need multi-record transactions. Every major relational database does this as its core job. MongoDB can, but its own guidance is that a well-designed schema usually needs transactions rarely, and that they carry a performance cost. If most of your writes need them, you're fighting the model. DynamoDB and Cassandra offer transactional or lightweight-transaction features with narrower scope; read the limits carefully before relying on them.

**How stale can a read be?** Reading from a replica, a cache or an eventually consistent store means a user may not see their own write immediately.

| Requirement | Example | What it implies |
|---|---|---|
| **Strict** | Balance after a payment; stock at checkout | Read from the primary, inside a transaction |
| **Read-your-writes** | A user edits a profile and reloads | Route that user's reads to the primary briefly, or use session consistency |
| **Bounded staleness** | Product listing, a few seconds old | Replicas or caches with a short TTL |
| **Eventual** | View counts, recommendations, search index | Asynchronous pipelines are fine |

Note that the defaults also differ between relational engines. PostgreSQL and Oracle default to Read Committed; MySQL's InnoDB defaults to Repeatable Read. I compare them, with the anomalies each allows, in [transactions, isolation levels and MVCC]({{ '/blog/2026/11/transactions-isolation-levels-mvcc-in-practice/' | relative_url }}).

Most systems have a small core of data that needs strict consistency and a large periphery that tolerates staleness. Design for that split rather than choosing one database to satisfy the strictest requirement everywhere, or the loosest.

## Question 3: how big is it, really?

"Scale" is the most abused word in database selection. Put numbers on it:

- **Data size** now and in three years, including indexes.
- **Peak writes per second**, and whether they're spread across keys or concentrated on a few hot ones.
- **Peak reads per second**, and how cacheable they are.
- **Geography**: do writes need to happen in several regions, or is one primary region with read replicas enough?

A single modern relational primary on decent hardware, with good indexes, handles far more than most applications will ever need, and read replicas plus a cache take care of read-heavy traffic. The limits that genuinely force horizontal write scaling are high sustained write rates, datasets that don't fit comfortably on one node, or a requirement to accept writes in several regions at once.

When you hit them, the options are:

| Option | How it scales | Cost |
|---|---|---|
| **Read replicas + cache** | Reads | Replication lag; cache invalidation |
| **Partitioning in one database** (Postgres declarative partitioning, MySQL partitioning) | Manageability of large tables | Partition-key design |
| **Sharded document store** (MongoDB sharding) | Reads and writes, built in | Shard-key choice is critical and hard to change |
| **Wide-column store** (Cassandra) | Very high writes, multi-region | Query-specific data models; eventual consistency by default |
| **Distributed SQL** (Spanner, CockroachDB, YugabyteDB) | Reads and writes with SQL and transactions | Latency on cross-node transactions; cost; newer operating knowledge |
| **Application-level sharding** of a relational database | Anything | You own the routing, rebalancing and cross-shard queries forever |

The honest advice: **design so you could scale later, but don't pay for it now.** Choose keys that would make good shard keys, keep transactions inside one aggregate where you can, and keep analytics off the transactional database. That keeps all the options in the table open.

## Question 4: what does your team know?

A database you understand is faster in practice than a better database you don't. Production incidents are debugged by reading query plans, lock waits, replication status and slow-query logs. That's knowledge built over years.

Ask:

- Who on the team has **run this engine in production**, not just used it in a tutorial?
- Can they **read its query plans**? (I put them side by side in [reading query plans]({{ '/blog/2026/11/reading-query-plans-postgresql-mysql-oracle-mongodb/' | relative_url }}).)
- Do they know its **data modelling idioms**? Relational developers new to MongoDB tend to normalise it into collections and join with `$lookup`; MongoDB developers new to Postgres tend to put everything in one `jsonb` column. Both get the worst of both worlds.
- Does the wider organisation have **DBAs, platform support or a managed-service contract** for it?

This isn't an argument against learning. It's an argument for counting the learning as a cost, and for not adding a second unfamiliar engine to a project that's already learning a new framework.

## Question 5: who operates it?

The licence or cloud bill is the visible cost. The operational cost is the real one:

| Operational task | What to check |
|---|---|
| **Backup and restore** | Point-in-time recovery? How long does a full restore take? Has anyone tested it? |
| **High availability** | Automatic failover? How long? What happens to in-flight writes? |
| **Upgrades** | Major version upgrades: in place, rolling, or dump and restore? |
| **Observability** | Slow-query logs, plans, lock and replication metrics in your existing tooling? |
| **Security** | Encryption, network isolation, IAM integration, auditing |
| **Connection management** | Pooling needed? (Postgres usually wants PgBouncer or similar at scale) |
| **Cost model** | Instance-based, request-based or storage-based? How does it behave under a traffic spike? |

Managed services (Amazon RDS and Aurora, Azure Database for PostgreSQL, Cloud SQL, MongoDB Atlas, DynamoDB) remove much of this, which is why I nearly always recommend them over self-hosting. They don't remove it all: you still own schema design, indexes, query performance, pool sizing and testing restores. See [backup, restore and disaster recovery]({{ '/blog/2026/11/database-backup-restore-disaster-recovery/' | relative_url }}) for the part teams most often skip.

## A decision table by workload

Putting the five questions together, this is where I start for common workloads. It's a starting point, not a rule.

| Workload | Where I start | Why |
|---|---|---|
| Business transactions: orders, payments, bookings | **Relational** (PostgreSQL, MySQL, Oracle where already licensed) | Invariants across records; ad hoc reporting |
| Content and catalogue with varying attributes | **Relational with `jsonb`**, or **document** | Depends on how relational the rest is |
| User profiles, carts, preferences read by user ID | **Document** or **key-value** | One aggregate, read by key |
| Sessions, rate limits, short-lived state | **Key-value** (Redis, Valkey) | Speed and expiry; loss is tolerable |
| Event streams, IoT readings, logs at high volume | **Wide-column** or **time-series** | Write volume; time-ordered access |
| Full-text and faceted search | **Search engine**, fed from the system of record | Relevance; not a source of truth |
| Fraud rings, recommendations over deep relationships | **Graph** | Multi-hop traversal |
| Analytics and reporting | **Warehouse** or columnar store | Keep it off the transactional database |
| Editorial content in an AEM estate | **The JCR**, through AEM | Workflow, translation and publishing; see below |

### Where the JCR fits

The JCR is technically "NoSQL": a hierarchical content repository, stored by Oak on segment or document storage, queried with JCR-SQL2 that looks like SQL but isn't relational. Neither label helps you use it. It's a **content repository**, chosen because AEM is chosen, and good at exactly one workload: authored, governed, published content. I explain the model in [JCR explained for SQL developers]({{ '/blog/2026/11/jcr-explained-for-sql-developers/' | relative_url }}) and where its boundary sits in [when AEM content belongs outside the JCR]({{ '/blog/2026/11/when-aem-content-belongs-outside-the-jcr/' | relative_url }}).

## Three worked examples

**A product catalogue with reviews for a retailer.** Products have many category-specific attributes; reviews are written by customers at high volume; search needs facets. Access patterns: product by ID, list by category with filters, search, reviews by product. Recommendation: **PostgreSQL** for products (`jsonb` for the variable attributes, GIN-indexed), reviews in a separate partitioned table keyed by product, and a **search engine** for faceted search. One relational engine the team knows, one specialised store with a clear job. MongoDB would also work well here; the deciding factor would be what the team already runs.

**A mobile app's user state across devices.** Profile, settings, saved items and progress, always read and written by user ID, with very spiky traffic. Access patterns are few and known. Recommendation: **a document or key-value store** (DynamoDB or MongoDB Atlas), with the item for a user designed around its reads. Strict cross-user transactions aren't needed. Pay-per-request pricing suits the spikes.

**A booking platform for appointments.** Double-booking must be impossible; staff, rooms and customers relate in many ways; operations teams need flexible reporting. Recommendation: **a relational database**, with the "no overlapping bookings" invariant enforced in the database (PostgreSQL's exclusion constraints on time ranges do exactly this). A document store would push that invariant into application code, where race conditions live.

## Polyglot persistence: useful, but not free

"Use the right database for each job" is good advice with a hidden cost. Every additional engine brings its own backups, monitoring, security reviews, upgrades, skills and failure modes, plus the pipelines that keep data in sync between them. In reviews I see more systems hurt by too many databases than by too few.

My rule: **one primary system of record per bounded context**, plus specialised stores only when a workload clearly needs one (search, cache, analytics), and each fed from the system of record rather than written independently. Caching in particular is a layer, not a database; I cover it in [caching in front of databases]({{ '/blog/2026/11/caching-in-front-of-databases-redis-cdn/' | relative_url }}).

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| Choosing by label ("NoSQL scales") | The engine fits a problem you don't have | Write down access patterns and numbers first |
| Designing for hypothetical scale | Sharding, eventual consistency and complexity on day one | Scale-ready keys, single primary until the numbers say otherwise |
| Document store for highly relational data | Joins and integrity rebuilt in application code | Relational, or reshape the domain into true aggregates |
| Relational schema for data that's always read as a blob | Ten-table joins to render one object | `jsonb` column, or a document store |
| Using the search engine as the system of record | Data loss on re-index; no transactions | Feed search from the database |
| Ignoring read-your-writes with replicas | Users don't see their own changes | Primary reads for the writer, briefly |
| Adding a database per feature | Operational sprawl; sync bugs | One system of record per context |
| Not counting team experience | Slow incidents, poor modelling | Treat learning as a cost in the decision |
| Self-hosting by default | Backups, failover and upgrades become a side job | Managed service unless there's a reason not to |
| Skipping restore tests | Backups that don't work when needed | Scheduled, timed restore drills |

## Closing thought

Databases aren't SQL or NoSQL. They're bundles of trade-offs: a data model, a consistency model, a scaling model and an operating model. Choose the bundle by writing down how your data is read and written, what must never go wrong, how big it really is, and who will run it. Most of the time that leads to a managed relational database and one or two specialised stores with clear jobs. Sometimes it leads to a document store or a wide-column store, and then you'll know exactly why.

If you're choosing a database for a new platform, or untangling one chosen for the wrong reasons, [get in touch](/contact/).

### References

- [PostgreSQL: JSON types](https://www.postgresql.org/docs/current/datatype-json.html) (PostgreSQL documentation)
- [PostgreSQL: transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html) (PostgreSQL documentation)
- [MySQL: transaction isolation levels](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html) (MySQL documentation)
- [MongoDB: transactions](https://www.mongodb.com/docs/manual/core/transactions/) (MongoDB documentation)
- [MongoDB: default write concern](https://www.mongodb.com/docs/manual/reference/write-concern/) (MongoDB documentation)
- [Amazon DynamoDB: data modelling](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/data-modeling.html) (AWS documentation)
- [Apache Cassandra: data modelling](https://cassandra.apache.org/doc/latest/cassandra/developing/data-modeling/index.html) (Apache Cassandra documentation)
- [PostgreSQL: exclusion constraints](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-EXCLUSION) (PostgreSQL documentation)

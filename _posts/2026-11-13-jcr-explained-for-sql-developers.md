---
layout: post
title: "JCR explained for SQL developers: nodes, properties, paths and where the analogy breaks"
seo_title: "JCR Explained for SQL Developers: A Practical Guide"
description: "The Java Content Repository for SQL developers: nodes vs rows, properties vs columns, paths vs keys, node types, references, versioning, ACLs and its limits."
ai_summary: "The Java Content Repository (JCR), implemented in AEM by Apache Jackrabbit Oak, stores content as a tree of nodes with typed properties rather than tables of rows. For SQL developers, a node is roughly a row, a property a column and a path a primary key, but the tree is the main index, node types are optional and often permissive (nt:unstructured), references are usually path strings without integrity, and there are no aggregates or cheap joins. The post maps relational concepts to JCR, explains mixins, versioning, ACLs, sessions and the single Oak workspace, shows the same data in SQL and JCR form, and lists where the analogy breaks and the mistakes it causes."
date: 2026-11-13 09:00:00 +0530
category: databases
tags: [JCR, Oak, AEM, Content Modelling, SQL]
---

Every AEM project I join has a strong Java developer who knows PostgreSQL or Oracle inside out and has never touched a content repository. In the first week they ask the same questions. "Where's the schema?" "How do I join pages to authors?" "Why is there no `COUNT(*)`?" And, a little later, "Why did my query just log a warning about traversing 100,000 nodes?"

The Java Content Repository (JCR) looks enough like a database to be familiar and behaves differently enough to hurt you. This post is the translation guide I give SQL developers on day one: what maps cleanly, what maps loosely, and where the analogy breaks.

It's the first post in a series on databases for AEM architects and the developers who work with them. The next ones cover [how Oak stores the tree]({{ '/blog/2026/11/oak-storage-tarmk-mongomk-aem-cloud-service/' | relative_url }}) and [how to query it without hurting AEM]({{ '/blog/2026/11/jcr-queries-oak-indexes-aem-performance/' | relative_url }}).

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **JCR is a tree, not a set of tables.** A node is roughly a row, a property roughly a column and a path roughly a primary key. But the hierarchy itself carries meaning: where content sits decides its permissions, its URL and how it's queried.
- **In AEM, the JCR implementation is Apache Jackrabbit Oak.** It implements the JCR 2.0 API (JSR 283) with some documented differences, including a **single workspace**.
- **"Content is the schema."** Node types exist and can be strict, but most AEM content uses permissive types such as `nt:unstructured`. The rules live in components, templates and code, not in DDL.
- **References are usually path strings.** There are no foreign keys and no referential integrity. Move a page and anything pointing at its old path breaks unless something updates it.
- **There are no aggregates and no cheap joins.** JCR-SQL2 can't `GROUP BY` or `COUNT`, and joins are something to avoid. Design the tree so you read by path, not by query.
- **Sessions are snapshots.** An Oak session sees the repository as it was when the session started. `session.save()` commits your changes atomically. It's closer to optimistic MVCC than to row locking.
- **Versioning and ACLs are built in.** That's the part relational databases make you build yourself, and it's why a CMS uses a content repository at all.

## Why a content repository at all?

A relational database is very good at many rows with the same shape, related by keys, queried in ways you can't predict. A website's content is something else:

- It's **hierarchical**. Sites contain language roots, which contain sections, which contain pages, which contain components.
- It's **irregular**. A hero component has four fields, a carousel has a list of slides, and next month someone adds a new component with nine more.
- It needs **versioning, permissions per branch, ordering of siblings, binaries and full-text search** as first-class features.

You can model that in tables, as the [content modelling post]({{ '/blog/2026/11/content-modelling-jcr-vs-relational-vs-document-database/' | relative_url }}) shows, but you'd be rebuilding a content repository by hand. The [JCR specification](https://jackrabbit.apache.org/jcr/jcr-api.html) standardised those features in one Java API: JSR 170 for JCR 1.0, then JSR 283 for JCR 2.0. In AEM, that API is implemented by [Apache Jackrabbit Oak](https://jackrabbit.apache.org/oak/docs/), with Apache Sling on top mapping URLs to nodes.

## The mapping, concept by concept

![The same author record as a relational row and as a JCR node: table to parent node, row to node, column to property, primary key to path, foreign key to path string]({{ '/assets/img/blog/jcr-explained-for-sql-developers/01-row-to-node.svg' | relative_url }}){: width="1200" height="600" loading="lazy" decoding="async"}

Here's the translation table I draw on the whiteboard. "Close" means you can think in SQL terms safely; "loose" means the intuition helps but will mislead you in edge cases.

| SQL concept | JCR equivalent | How close |
|---|---|---|
| Database / schema | Repository (one Oak workspace) | Loose |
| Table | A parent node whose children share a type, such as `/content/dam/acme/authors` | Loose |
| Row | Node | Close |
| Column | Property | Close |
| Column type | Property type (`String`, `Long`, `Double`, `Decimal`, `Boolean`, `Date`, `Binary`, `Name`, `Path`, `Reference`, `WeakReference`, `URI`) | Close |
| Array column | Multi-valued property | Close |
| Primary key | Path (and, for referenceable nodes, `jcr:uuid`) | Close, until you move a node |
| Foreign key | Path string, or a `Reference` / `WeakReference` property | Loose |
| `CREATE TABLE` | Node type definition (CND), often permissive | Loose |
| `ALTER TABLE ADD COLUMN` | Just set the property | Not needed |
| Index | Oak index under `/oak:index` | Close |
| `SELECT` | JCR-SQL2, XPath, or Sling `Resource` reads by path | Loose |
| `JOIN` | Supported in JCR-SQL2, rarely a good idea | Breaks |
| `GROUP BY`, `COUNT`, `SUM` | Not supported | Breaks |
| Transaction | Session changes committed by `session.save()` | Loose |
| `GRANT` / row-level security | ACLs on nodes, inherited down the tree | Better than SQL |
| Audit / history tables | Built-in versioning (`mix:versionable`) | Better than SQL |
| BLOB column | `Binary` property, usually inside an `nt:file` / `nt:resource` structure | Close |

The parts that "break" are what relational databases are best at; the parts that are "better" are what you'd otherwise build yourself.

## Nodes and properties: rows and columns, mostly

A node has a name, a primary node type, optional mixin types, properties and child nodes. Here's a page in AEM, as you'd see it in CRXDE Lite or a JSON export:

```text
/content/acme/en/articles/indexing-basics          (cq:Page)
  jcr:content                                      (cq:PageContent)
    jcr:title        = "Indexing basics"           String
    jcr:created      = 2026-11-10T09:12:00.000+05:30 Date
    cq:template      = "/conf/acme/settings/wcm/templates/article"
    sling:resourceType = "acme/components/page"
    authorPath       = "/content/dam/acme/authors/keval-joshi"
    cq:tags          = ["acme:topics/databases", "acme:topics/aem"]  String[]
    root                                           (nt:unstructured)
      container                                    (nt:unstructured)
        text_123                                   (nt:unstructured)
          sling:resourceType = "acme/components/text"
          text = "<p>An index is a sorted copy...</p>"
```

Three things to notice:

1. **The page isn't a single row.** It's a small tree: a `cq:Page` node, a `jcr:content` child holding the page properties, and a subtree of components. Reading "a page" means reading a subtree.
2. **Properties are typed per value, not per column.** Nothing stops one article storing `authorPath` as a `String` and another as a `Path`, or another from omitting it entirely. The node type permits it.
3. **Namespaced names are conventions with history.** `jcr:` belongs to the specification, `sling:` to Sling, `cq:` to AEM. Your own properties shouldn't use those prefixes. Use plain names or your own namespace.

## Paths: primary keys that change

The path is the identity you'll use almost all the time. Sling resolves URLs to paths, components read children by relative path, and AEM's references are mostly path strings. Reading by path is the fastest operation the repository has.

Unlike a surrogate key, though, a path **encodes the hierarchy**. Move or rename a page and its path changes, and so does the path of every descendant. AEM's move dialog offers to update references in other pages, which is the closest thing you get to `ON UPDATE CASCADE`, and it only covers the references AEM knows how to find.

If you need a stable identity, Oak gives you one only for referenceable nodes. The [Oak differences page](https://jackrabbit.apache.org/oak/docs/differences.html) is explicit: "only referenceable nodes in Oak have a UUID assigned". Add the `mix:referenceable` mixin and the node gets a `jcr:uuid`. Don't set `jcr:uuid` by hand on other nodes: Oak keeps a unique index on it.

My recommendation: **treat paths as primary keys inside AEM, and never as primary keys outside it.** If an external system (a search index, a CRM, an analytics warehouse) needs to reference AEM content, give it a stable business identifier stored as a property, or a UUID, and resolve it to a path at read time.

## Node types and mixins: schema, if you want it

JCR does have a schema language. Node types are declared in Compact Namespace and Node Type Definition (CND) notation:

```text
<acme = 'https://example.com/acme/ns/1.0'>

[acme:Author] > nt:base
  - acme:name (string) mandatory
  - acme:email (string)
  - acme:bio (string)
  + * (nt:unstructured)
```

That gives you mandatory properties, types, constraints on child nodes and default values. It's real, enforced schema.

In practice, almost no AEM content uses custom node types like this. Pages are `cq:Page`, assets are `dam:Asset`, and everything inside them is `nt:unstructured`, which allows any property and any child. Adobe's guidance and most experienced teams favour that, for good reasons:

- **Node type changes are hard to roll out.** Content that violates a new definition can become unsaveable.
- **AEM's tooling assumes the standard types.**
- **The schema already lives elsewhere:** in dialogs, Content Fragment Models, Sling Models and template policies.

**Mixins** are the useful part. A mixin adds behaviour or properties to any node regardless of its primary type, a bit like a trait:

| Mixin | What it adds |
|---|---|
| `mix:referenceable` | A `jcr:uuid`, so the node can be the target of a `Reference` property |
| `mix:versionable` | Version history and check-in / check-out |
| `mix:created`, `mix:lastModified` | `jcr:created`, `jcr:createdBy`, `jcr:lastModified`, `jcr:lastModifiedBy` |
| `mix:title` | `jcr:title`, `jcr:description` |
| `mix:lockable` | Locking support |

## "Content is the schema"

David Nüscheler's model for JCR content is often summarised as "data first, structure later. Maybe." That's the mindset shift. In a relational project you design tables, then load data. In an AEM project you design **components and the tree**, and the structure of the content emerges from what authors create with them.

Validation lives in the authoring UI (required dialog fields), in Content Fragment Models and Sling Models, and in template policies. The consequence is that the repository will happily store content your code can't handle. Old content created by a previous version of a component is the AEM equivalent of a column that "should" be `NOT NULL` but has nulls in production. Write models defensively, and when a component changes shape, plan a content migration the same way you'd plan a data migration in SQL.

## References: foreign keys without integrity

There are two ways to relate nodes:

| Approach | Example | Integrity | Typical use in AEM |
|---|---|---|---|
| **Path string** | `authorPath = "/content/dam/acme/authors/keval-joshi"` | None | Almost everything: links, fragment references, image paths, Experience Fragment paths |
| **`Reference` property** | Points at a node's `jcr:uuid` | Target can't be deleted while referenced | Rare in AEM content |
| **`WeakReference` property** | Points at a `jcr:uuid` | None, but survives moves | Occasional |

AEM uses path strings almost everywhere. Content Fragment references, image fields and links in rich text all store paths. That means:

- **Deleting the target leaves a dangling path.** The AEM UI warns about references; code that deletes nodes gets no warning.
- **There's no reverse index.** "Which pages use this fragment?" is a query, not a lookup on an indexed foreign key.
- **Publishing doesn't follow references automatically.** AEM's publish wizard offers to include them; scripted publishing has to do it explicitly.

## Querying: think in reads, not in SELECTs

JCR supports JCR-SQL2 and XPath, and AEM adds QueryBuilder. JCR-SQL2 looks familiar:

```sql
SELECT * FROM [cq:PageContent] AS c
WHERE ISDESCENDANTNODE(c, '/content/acme/en/articles')
  AND c.[cq:tags] = 'acme:topics/databases'
ORDER BY c.[jcr:created] DESC
```

But results are nodes, not projections; there's no `GROUP BY`, `COUNT` or `SUM`; joins run in memory and are a last resort; and without a matching Oak index the query traverses the tree. On AEM as a Cloud Service, Adobe's [query best practices](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/operations/query-and-indexing-best-practices) say the engine stops a query once it has read 100,000 nodes, and that "queries should be avoided where it is possible to do so".

If the tree is designed well, `/content/acme/en/articles/2026/11` already is the "articles from November" query. The [query post]({{ '/blog/2026/11/jcr-queries-oak-indexes-aem-performance/' | relative_url }}) covers JCR-SQL2, XPath, QueryBuilder and Oak indexes in depth.

## Sessions, save and transactions

In JDBC you open a connection, start a transaction, run statements and commit. In JCR you get a **session**, make changes in memory and call `session.save()`. Everything you changed since the last save is committed atomically, or none of it is.

The important difference is what the session sees. The Oak documentation says that "a session reflects a stable view of the repository from the time the session was acquired". That's snapshot isolation. Another thread's committed changes aren't visible to you until you call `session.refresh()`, and two sessions can each read, decide and save in a way that produces **write skew**, the classic anomaly of snapshot isolation. Conflicting saves to the same property fail at save time; there's no row lock to wait on.

Practical rules I give teams:

- **Keep sessions short.** Use the request's `ResourceResolver`, or a service user resolver in try-with-resources. Long-lived sessions see stale data.
- **Save in batches** during bulk work, not once per node and not once for a million nodes.
- **Expect conflicts on hot nodes.** A counter node updated by many requests is a bad idea in any MVCC store. High-write data belongs [outside the JCR]({{ '/blog/2026/11/when-aem-content-belongs-outside-the-jcr/' | relative_url }}).

I compare this with Postgres, InnoDB and Oracle MVCC in the [transactions and isolation levels post]({{ '/blog/2026/11/transactions-isolation-levels-mvcc-in-practice/' | relative_url }}).

## Versioning: history tables for free

In a relational system, audit history means trigger-maintained history tables, temporal tables or event sourcing. In JCR, add `mix:versionable` and call `checkin()`: the repository stores a frozen copy of the node and its subtree in version storage under `/jcr:system/jcr:versionStorage`, and you can list, compare and restore versions.

AEM builds page versioning, timewarp and restore on this. Two caveats:

- **Versions cost storage and time.** AEM purges them according to version purge settings; don't version every node on every change from your own code.
- **Oak implements part of JCR versioning.** The Oak differences page notes that activities, configurations and baselines aren't implemented, and the `merge` variants of `VersionManager` throw `UnsupportedRepositoryOperationException`.

## Access control: permissions follow the tree

Permissions in JCR are access control lists stored in the tree itself, as `rep:policy` child nodes holding allow and deny entries per principal. They **inherit downwards**. Grant `jcr:read` on `/content/acme/en` and the group can read every page under it, unless a deny further down says otherwise. Restrictions such as `rep:glob` narrow an entry to matching paths.

In relational terms, imagine row-level security where the predicate is always "is this row under that path". It's very effective when the content tree mirrors the organisation (one branch per brand, market or team) and painful when it doesn't. **Design the tree with permissions in mind**, because restructuring it later is a migration.

On AEM as a Cloud Service, define service users and their ACLs in code with repoinit scripts rather than by hand. My [AEMaaCS migration post]({{ '/blog/2026/11/aem-on-premise-and-managed-services-to-aem-as-a-cloud-service-migration/' | relative_url }}) covers why.

## Workspaces: one, in practice

The JCR specification lets a repository hold several workspaces, a bit like several databases on one server. Oak doesn't. The documentation says it plainly: "An Oak repository only has one default workspace." AEM's author and publish aren't two workspaces of one repository; they're separate repositories, and content moves between them by replication (Sling Content Distribution on AEM as a Cloud Service).

Separation in AEM comes from paths, ACLs and separate environments.

## Where the analogy breaks

These are the places where SQL intuition actively misleads, in the order I see them cause trouble:

| SQL intuition | JCR reality | What to do instead |
|---|---|---|
| "I'll query for it." | Queries need a matching Oak index and still cost more than reads by path. | Design the tree so the answer sits at a predictable path; query only when you must, with an index. |
| "Flat tables of millions of rows are fine." | Millions of siblings under one node are slow to list and, with orderable types, expensive to store. | Bucket content by date, hash or category; use unordered types for large sibling sets. |
| "The database enforces integrity." | Nothing enforces path references. | Validate in code, check references before delete, use stable IDs for external systems. |
| "Aggregates are cheap." | There are none. | Precompute, or use a database or search engine that can aggregate. |
| "Many writes per second is normal." | Oak is optimised for read-heavy content with a moderate write rate. | Put high-write, transactional or user data in a database built for it. |
| "Schema migrations are DDL." | There's no DDL. Migrations rewrite content. | Version components, migrate content with jobs, keep models tolerant of old shapes. |
| "Same-name rows are normal." | Same-name siblings are deprecated in Oak. | Give every node a unique name. |

The second row deserves emphasis. `nt:unstructured` children are **orderable**, which means Oak keeps the order of child names. Oak's own documentation warns that a node with very many orderable children can hit the MongoDB 16 MB document limit on the document node store. Adobe's guidance is to use unordered types such as `sling:Folder` or `oak:Unstructured` for large sets of siblings where order doesn't matter. I cover the storage side in the [Oak storage post]({{ '/blog/2026/11/oak-storage-tarmk-mongomk-aem-cloud-service/' | relative_url }}).

## Common mistakes

| Mistake | Why it happens | Fix |
|---|---|---|
| Querying on every request | SQL habit: "just select it" | Read by path, prefetch and cache, or precompute |
| Thousands of children under one `nt:unstructured` node | A "table" mental model | Date or hash buckets; unordered folder types |
| Storing user or transactional data in the JCR | "It's a database, isn't it?" | External database or service; see the outside-the-JCR post |
| External systems keyed on AEM paths | Paths look like primary keys | Stable business IDs or UUIDs stored as properties |
| Custom node types for business content | Wanting enforced schema | `nt:unstructured` plus Content Fragment Models and validation in code |
| Long-lived sessions in services | Treating a session like a connection pool | Short-lived resolvers in try-with-resources |
| A shared "counter" or "last updated" node | Row-update habits | External store, or event-driven aggregation |
| Assuming publish follows references | Foreign key habits | Publish references explicitly; check before unpublish |
| Permissions bolted on after the tree is built | Table-level `GRANT` habits | Design the tree around who edits what |

## Closing thought

The JCR isn't a worse relational database. It's a different tool, built for hierarchical, irregular, versioned and permissioned content. The trouble starts when SQL habits are applied without translation.

When I onboard a SQL developer onto AEM, I don't start with the API. I start with the tree: where content lives, why it lives there, and what each path tells you. Once that clicks, the rest of the JCR makes sense.

The next post in the series goes one level down, into [how Oak actually stores that tree]({{ '/blog/2026/11/oak-storage-tarmk-mongomk-aem-cloud-service/' | relative_url }}) on-premise and on AEM as a Cloud Service. If you're onboarding a team onto AEM or reviewing a content model, [get in touch](/contact/).

### References

- [Jackrabbit Oak documentation](https://jackrabbit.apache.org/oak/docs/) (Apache)
- [Changes from Jackrabbit 2 to Oak](https://jackrabbit.apache.org/oak/docs/differences.html) (Apache)
- [JCR API](https://jackrabbit.apache.org/jcr/jcr-api.html) (Apache Jackrabbit)
- [Node type notation (CND)](https://jackrabbit.apache.org/jcr/node-type-notation.html) (Apache Jackrabbit)
- [Query and indexing best practices](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/operations/query-and-indexing-best-practices) (Adobe Experience League)
- [David's model: a guide for content modelling](https://jackrabbit.apache.org/archive/wiki/JCR/DavidsModel_115513389.html) (Apache Jackrabbit wiki archive)

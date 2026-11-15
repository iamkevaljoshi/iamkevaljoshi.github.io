---
layout: post
title: "JCR queries that don't hurt AEM: JCR-SQL2, XPath, QueryBuilder and Oak indexes"
seo_title: "JCR Queries and Oak Indexes: AEM Performance Guide"
description: "How to write JCR-SQL2, XPath and QueryBuilder queries that use Oak indexes, define Lucene indexes in code on AEMaaCS, read query plans and fix traversal warnings."
ai_summary: "AEM queries run on Apache Jackrabbit Oak, which picks one index per query by estimated cost and falls back to traversing the repository when no index fits. On AEM as a Cloud Service, custom indexes must be of type lucene, deployed from ui.apps with versioned names such as acme.articles-1-custom-1, and a query that reads 100,000 nodes is stopped. The post compares JCR-SQL2, XPath and QueryBuilder, explains property and Lucene indexes, index tags and selectionPolicy, ordered properties and path restrictions, shows how to read Oak plans with explain and the Developer Console query tools, maps them to SQL EXPLAIN, and lists the query mistakes that slow AEM down."
date: 2026-11-13 11:00:00 +0530
category: databases
tags: [JCR, Oak, AEM as a Cloud Service, Indexing, Performance]
---

The page renders fine in development. It renders fine on stage. Six months after go-live, when the site has 40 times more content, it takes four seconds, and the publish logs fill with lines like this:

```text
*WARN* Traversed 98000 nodes with filter Filter(query=select [jcr:path], [jcr:score], * from [cq:PageContent] ...
consider creating an index or changing the query
```

Nothing in the code changed. The content did. That's the defining property of a query without an index: it gets slower in proportion to the repository, not the result. On AEM as a Cloud Service it eventually stops working altogether.

This post is how I approach queries on AEM projects: when to avoid them, how to write them so Oak can use an index, how to define those indexes in code on AEM as a Cloud Service (AEMaaCS), and how to read the plan the way you'd read `EXPLAIN` in SQL. If the JCR itself is new to you, start with [JCR explained for SQL developers]({{ '/blog/2026/11/jcr-explained-for-sql-developers/' | relative_url }}).

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **The best query is no query.** Adobe's own guidance is that "queries should be avoided where it is possible to do so". Read by path, design the tree for your access patterns, and prefetch or cache what you can't.
- **Oak picks one index per query by cost.** If no index can answer the restrictions, it traverses nodes. On AEMaaCS a query that reads 100,000 nodes is stopped.
- **JCR-SQL2, XPath and QueryBuilder all end up as the same Oak query.** XPath is converted to SQL-2; QueryBuilder generates XPath. Pick the one your team reads best, and check the plan.
- **On AEMaaCS, custom indexes must be `lucene`.** Define them in `ui.apps` under `_oak_index`, name them `<prefix>.<name>-<n>-custom-<n>` (or `<ootb>-<n>-custom-<n>` for customised product indexes), and treat each version as immutable.
- **Every index should have `includedPaths`, `queryPaths`, `async = [async, nrt]`, `compatVersion = 2` and `evaluatePathRestrictions = true`.** Use `tags` with `selectionPolicy = tag` so only the queries you intend use it.
- **Sort in the index, not in memory.** Mark sort properties `ordered = true`; otherwise Oak reads the whole result and sorts it.
- **Read the plan.** `explain` in front of a SQL-2 query, or Explain Query in the Developer Console, tells you which index was chosen and which restrictions it handles.

## First, avoid the query

Most slow queries I find in reviews shouldn't exist. They're a SQL habit applied to a tree: "select all articles where…" when the articles already live under a predictable path.

| Need | Query-first approach | Better approach |
|---|---|---|
| Latest articles in a section | Query `cq:PageContent` under the section, order by date | Date-bucketed tree (`/articles/2026/11`) read by path, or a list maintained on publish |
| Children of a page for navigation | Query by parent path | `Resource.listChildren()`, which is a read, not a query |
| "Related articles" on every page | Tag query per request | Precompute on publish or on a schedule, store the result, cache the rendered HTML |
| Site-wide counts and facets | QueryBuilder with facets on every request | Precompute, or use an external search service |
| Find content for a one-off fix | Query in a request thread | Sling Job or workflow, with keyset pagination |

Adobe's [query and indexing best practices](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/operations/query-and-indexing-best-practices) recommend the same: traverse a predictable taxonomy, or prefetch results and refresh them with a schedule or a change listener (`ResourceChangeListener`). And remember that on publish, Dispatcher and the CDN cache the HTML. A query in a component runs once per cache miss, so cache design matters as much as query design. My [Dispatcher post]({{ '/blog/2026/11/dispatcher-on-aem-as-a-cloud-service-caching-and-invalidation/' | relative_url }}) covers that side.

When you genuinely need a query (search pages, listings over large or unpredictable sets, back-office tools), make it a good one.

## How Oak runs a query

Oak's [query engine](https://jackrabbit.apache.org/oak/docs/query/query-engine.html) "uses a cost based query optimizer". For each query it asks every index for an estimated cost. An index that can't handle the restrictions returns infinity. The cheapest wins, and if nothing can handle the query, Oak traverses nodes and filters them one by one.

Three consequences matter for design:

1. **One index per query.** Oak doesn't combine two indexes the way Postgres combines bitmaps. If your query filters on `cq:tags` and `jcr:created`, both need to be in the same index definition. (Union queries are the exception: an `or` across different properties can be converted into a `union`, and each branch can use its own index.)
2. **Restrictions the index can't handle are applied afterwards**, by reading each candidate node. The query works, but reads far more than it returns. Oak logs that as "index traversal".
3. **The cost estimate can pick the wrong index.** Two Lucene indexes covering `cq:PageContent` may both claim a query. Index tags solve that (see [below](#index-tags-and-selectionpolicy)).

## JCR-SQL2, XPath and QueryBuilder

Here is the same query in all three languages: article pages under one section, tagged "databases", newest first.

```sql
-- JCR-SQL2
SELECT * FROM [cq:PageContent] AS c
WHERE ISDESCENDANTNODE(c, '/content/acme/en/articles')
  AND c.[cq:tags] = 'acme:topics/databases'
ORDER BY c.[jcr:created] DESC
OPTION(INDEX TAG acmeArticles)
```

```text
# XPath
/jcr:root/content/acme/en/articles//element(*, cq:PageContent)
  [@cq:tags = 'acme:topics/databases']
  order by @jcr:created descending
  option(index tag acmeArticles)
```

```text
# QueryBuilder (predicates, as used by the Java API or /bin/querybuilder.json)
path=/content/acme/en/articles
type=cq:PageContent
property=cq:tags
property.value=acme:topics/databases
orderby=@jcr:created
orderby.sort=desc
p.limit=20
p.guessTotal=100
```

| Language | Strengths | Watch out for |
|---|---|---|
| **JCR-SQL2** | Closest to SQL; explicit selectors and joins; the form Oak runs internally | Joins exist but are rarely a good idea; bracket every name with a colon |
| **XPath** | Compact for path-based queries; still fully supported; Oak converts it to SQL-2 | Easy to write an unrestricted `//*` without noticing |
| **QueryBuilder** | AEM's predicate API; good for search UIs built from parameters; paging helpers | Counting totals and unbounded limits are expensive; custom predicate evaluators that filter in Java defeat the index |

I don't have a strong preference between SQL-2 and XPath. Teams with a SQL background read SQL-2 more easily. What matters is that the query has a **path restriction**, a **node type**, **property restrictions the index covers**, a **limit**, and an ordering the index can satisfy. Oak's own [SQL-2 grammar](https://jackrabbit.apache.org/oak/docs/query/grammar-sql2.html) states it flatly: "All queries should have a path restriction".

### QueryBuilder settings that matter

Adobe calls out two QueryBuilder settings specifically:

- **`p.guessTotal`.** Without it, QueryBuilder counts the full result to report a total. Set it to a sensible number, such as one more than you'll page through, and show "more than 100 results" instead of an exact count.
- **`p.limit`.** Never `-1` on a request path. Adobe recommends 1,000 or fewer.

And don't use deep offset pagination (`p.offset=5000`). Oak still has to read the first 5,000 results. Use **keyset pagination** instead: order by a property and ask for the next page "after" the last value you saw.

## Oak index types

The [Oak documentation](https://jackrabbit.apache.org/oak/docs/query/query.html) describes several index implementations. These are the ones you meet in AEM:

| Index type | How it's maintained | Good at | Where it applies |
|---|---|---|---|
| **Property index** (`type = property`) | Synchronously, in the same commit | Exact matches on one property, such as `jcr:uuid` | Product indexes everywhere; custom ones on AEM 6.5 only |
| **Lucene index** (`type = lucene`) | Asynchronously, with optional near-real-time (`nrt`) updates | Multiple property restrictions, path restrictions, ordering, full-text, `like` | The only custom type supported on AEMaaCS |
| **Node type index** | Synchronously | Restrictions on primary type or mixin | Product |
| **Counter index** | Asynchronously | Estimating node counts for the cost model | Product |

The [AEMaaCS indexing documentation](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/operations/indexing) is unambiguous: "index management on AEM as a Cloud Service is only supported for indexes of type `lucene`". On AEM 6.5 you'll still find custom property indexes; when migrating, convert them to Lucene.

The synchronous versus asynchronous difference matters for application logic. A Lucene index with `[async, nrt]` makes new content searchable within seconds on the instance that wrote it, but not instantly. Code that writes a node and immediately queries for it can miss it. If you need read-your-own-writes, read by path.

## Anatomy of a Lucene index definition

Here is a custom index for the article query above, as it lives in `ui.apps/src/main/content/jcr_root/_oak_index/acme.articles-1-custom-1/.content.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0"
    xmlns:cq="http://www.day.com/jcr/cq/1.0"
    xmlns:nt="http://www.jcp.org/jcr/nt/1.0"
    xmlns:oak="http://jackrabbit.apache.org/oak/ns/1.0"
    jcr:primaryType="oak:QueryIndexDefinition"
    type="lucene"
    async="[async,nrt]"
    compatVersion="{Long}2"
    evaluatePathRestrictions="{Boolean}true"
    includedPaths="[/content/acme]"
    queryPaths="[/content/acme]"
    tags="[acmeArticles]"
    selectionPolicy="tag">
    <indexRules jcr:primaryType="nt:unstructured">
        <cq:PageContent jcr:primaryType="nt:unstructured">
            <properties jcr:primaryType="nt:unstructured">
                <tags jcr:primaryType="nt:unstructured"
                    name="cq:tags"
                    propertyIndex="{Boolean}true"/>
                <created jcr:primaryType="nt:unstructured"
                    name="jcr:created"
                    propertyIndex="{Boolean}true"
                    ordered="{Boolean}true"
                    type="Date"/>
                <template jcr:primaryType="nt:unstructured"
                    name="cq:template"
                    propertyIndex="{Boolean}true"/>
            </properties>
        </cq:PageContent>
    </indexRules>
</jcr:root>
```

What each setting does:

| Setting | Why it's there |
|---|---|
| `type = lucene` | Required on AEMaaCS |
| `async = [async, nrt]` | Asynchronous indexing with near-real-time updates; Adobe recommends always specifying it |
| `compatVersion = 2` | The current Lucene index behaviour; required |
| `evaluatePathRestrictions = true` | Lets the index handle `ISDESCENDANTNODE`, instead of filtering paths afterwards |
| `includedPaths` | Only content under these paths is indexed: smaller, faster to rebuild |
| `queryPaths` | The index is only considered for queries under these paths |
| `tags` + `selectionPolicy = tag` | The index is only used by queries that ask for the tag |
| `propertyIndex = true` | Index the property for equality and range restrictions |
| `ordered = true` | Index the property for sorting; without it Oak sorts in memory |

What I deliberately left out: full-text (`analyzed`, `nodeScopeIndex`) and aggregation of child nodes. Adobe recommends using `analyzed` "only when needed". Full-text indexing of every page's components is expensive to build and to keep. Add it when there's a search feature that needs it, and nowhere else.

### Index tags and selectionPolicy

Tags are how you stop the optimiser surprising you. With `selectionPolicy = tag`, the index is ignored unless the query includes `option(index tag acmeArticles)`. That makes the index private to the queries you designed it for, so a product update or another team's index can't change your plan, and your index can't hijack someone else's queries. Tag names may only contain letters, digits and underscores. I tag every custom index I write.

## Index definitions in code on AEMaaCS

On AEMaaCS, indexes are code. You can't create one in CRXDE on production, and you shouldn't want to. The rules from Adobe's [indexing documentation](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/operations/indexing):

- **Location:** `ui.apps/src/main/content/jcr_root/_oak_index/`, included in the package filter.
- **Package settings:** the content package needs `noIntermediateSaves=true` and `allowIndexDefinitions=true`.
- **Naming a fully custom index:** a short prefix, a name, a version and `-custom-<n>`, for example `acme.articles-1-custom-1`.
- **Customising a product index:** `<indexName>-<productVersion>-custom-<customVersion>`, for example `damAssetLucene-8-custom-1`. Adobe prefers customising `damAssetLucene` to creating new indexes on `dam:Asset`.
- **Changing an index:** deploy a new version (`-custom-2`). Treat a deployed definition as immutable.
- **Deployment:** AEMaaCS deploys with a rolling model. Old and new code run against the same repository for a while, so the new index is built (and the repository reindexed) before traffic switches, and the old version is kept for about a week for rollback.

Three operational points follow from that:

1. **Reindexing makes deployments longer.** A new index over a large DAM or content tree adds time to the pipeline. Narrow `includedPaths` keeps that cost down.
2. **Watch the size.** Adobe notes that the platform can block or remove indexes that hurt stability, and that a custom index growing total index size by more than 100% needs rethinking.
3. **Validate locally.** Run the AEMaaCS SDK and Explain Query against realistic content volume before the pipeline does it for you. My [Cloud Manager post]({{ '/blog/2026/11/aem-cloud-manager-pipelines-quality-gates-rde-config-pipeline/' | relative_url }}) covers how index deployments fit in the pipelines.

## Reading the plan

In Oak you can put `explain` in front of a SQL-2 query. It doesn't run the query; it returns the plan. `explain measure` also returns the estimated cost, and `measure` runs the query and reports how many rows each selector read. Both are documented in the [SQL-2 grammar](https://jackrabbit.apache.org/oak/docs/query/grammar-sql2.html).

A plan for the article query with the index above looks roughly like this (abridged):

```text
[cq:PageContent] as [c] /* lucene:acme.articles-1-custom-1(/oak:index/acme.articles-1-custom-1)
  +:ancestors:/content/acme/en/articles +cq:tags:acme:topics/databases
  ordering:[jcr:created DESC] */
```

What to check:

| Look for | Good sign | Bad sign |
|---|---|---|
| Index name | Your tagged index | `traverse` or an unexpected index |
| Path restriction | `+:ancestors:...` inside the index part | Path not mentioned (filtered afterwards) |
| Property restrictions | Each restriction appears in the index part | Restrictions missing (filtered afterwards) |
| Ordering | `ordering` handled by the index | Sorted in memory after reading everything |

On AEMaaCS, use the **Query Performance** tool in the **Developer Console**. It shows slow queries (Adobe defines these as "reading / scanning more than 5000 rows") and gives each a read optimisation score: "a query for which every restriction (and any ordering) can be handled at the index will typically score 90% or above." Its **Explain Query** tab shows the index chosen and the plan. The "Include Node Count" option reads the whole result set, so Adobe advises against it in general. On AEM 6.5 the equivalent tools live under **Tools → Operations → Diagnosis**.

### Compared with SQL EXPLAIN

If you know relational plans, this mapping helps. I go deeper into each engine in the [query plans post]({{ '/blog/2026/11/reading-query-plans-postgresql-mysql-oracle-mongodb/' | relative_url }}).

| Relational | Oak |
|---|---|
| `EXPLAIN` | `explain` prefix / Explain Query |
| `EXPLAIN ANALYZE` (rows actually read) | `measure` prefix / Include Execution Time |
| Sequential scan | `traverse` |
| Index scan with filter on the remaining predicates | Index traversal: index used, some restrictions applied afterwards |
| Index scan that satisfies `ORDER BY` | `ordered = true` property handled by the index |
| Combining indexes (bitmap AND) | Not available; one index per query |
| Planner statistics | Index cost estimates and the counter index |
| Query hints | `option(index tag ...)` |

## Traversal and index traversal warnings

Two warnings matter, and they mean different things:

```text
Traversed 98000 nodes with filter ...; consider creating an index or changing the query
Index-Traversed 60000 nodes with filter ...
```

**"Traversed"** means no index was used. Fix it with an index or a narrower query.

**"Index-Traversed"** means an index was used but Oak still read many nodes, because:

- a restriction isn't in the index, so it's applied after reading;
- the sort property isn't `ordered`, so the whole result was read for sorting;
- the result is large and the code iterates all of it.

Fix the index definition, add a limit, or stop iterating everything.

AEMaaCS also enforces a hard ceiling: the query engine stops a query after reading 100,000 nodes. On AEM 6.5 this is configurable through `queryLimitReads` and `queryLimitInMemory` (JMX or the `oak.queryLimitReads` system property). If your 6.5 instance doesn't set them, set them before migrating, so you find the queries that will fail on AEMaaCS while you still control the timeline. You can also make traversal fail in development with `option(traversal fail)` at the end of a query, which turns a quiet warning into a test failure.

## A review checklist for every query

When I review a query, I go through these in order:

1. **Can this be a read by path instead?**
2. **Does it run on a request thread on publish?** If so, is the output cached by Dispatcher and the CDN, or prefetched?
3. **Does it have a path restriction and a node type?**
4. **Is every property restriction in one index?** Is the index tagged and the query using the tag?
5. **Is the sort property `ordered`?**
6. **Is there a limit?** For QueryBuilder, is `p.guessTotal` set and `p.limit` not `-1`?
7. **Does pagination use keysets rather than large offsets?**
8. **Does the plan show the expected index and all restrictions handled there?**
9. **Has it been run against production-sized content?** A query that's fine over 2,000 pages tells you nothing about 200,000.

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| No path restriction (`//*` or `[nt:base]` everywhere) | Large index scans or traversal | Always restrict path and node type |
| Restrictions spread across two indexes | Oak uses one; the rest are filtered by reading nodes | Put every restricted property in one index |
| Sorting on a property that isn't `ordered` | Whole result read and sorted in memory | `ordered = true` in the index |
| `p.limit=-1` and no `p.guessTotal` | Counts and reads the full result | Bounded limit; `p.guessTotal` |
| Deep offset pagination | Reads every skipped result | Keyset pagination |
| Custom predicate evaluator that filters in Java | Index can't help; full result read | Move the restriction into the JCR query |
| Untagged custom index | Another query uses it, or another index wins yours | `tags` with `selectionPolicy = tag` |
| Full-text everything | Huge index, slow reindex on deployment | Index only the properties you query; `analyzed` only when needed |
| Editing a deployed index definition in place | Inconsistent behaviour across rolling deployments | New version: `-custom-2` |
| Query immediately after write | Async index hasn't caught up | Read by path for read-your-own-writes |
| Tested only on a small content set | Fine in dev, traversal in production | Test with production-like volume |

## Closing thought

Oak queries aren't slow. Unindexed and unbounded queries are slow, and Oak makes it unusually easy to write one without noticing, because the query still returns the right answer on a small repository. The habits that fix it are the same as in any database: restrict, index, bound and read the plan. AEM adds one more, which is the most effective of all: design the content tree so you don't need the query in the first place.

The next post in this part of the series compares [content modelling in the JCR, relational and document databases]({{ '/blog/2026/11/content-modelling-jcr-vs-relational-vs-document-database/' | relative_url }}), and the [indexing post]({{ '/blog/2026/11/database-indexing-postgresql-mysql-oracle-mongodb-oak/' | relative_url }}) puts Oak indexes next to Postgres, MySQL, Oracle and MongoDB. If you're chasing traversal warnings or slow listings on AEM, [get in touch](/contact/).

### References

- [Query and indexing best practices](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/operations/query-and-indexing-best-practices) (Adobe Experience League)
- [Content search and indexing](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/operations/indexing) (Adobe Experience League)
- [The query engine](https://jackrabbit.apache.org/oak/docs/query/query-engine.html) (Apache Jackrabbit Oak)
- [Oak query overview](https://jackrabbit.apache.org/oak/docs/query/query.html) (Apache Jackrabbit Oak)
- [Lucene index](https://jackrabbit.apache.org/oak/docs/query/lucene.html) (Apache Jackrabbit Oak)
- [Property index](https://jackrabbit.apache.org/oak/docs/query/property-index.html) (Apache Jackrabbit Oak)
- [SQL-2 grammar](https://jackrabbit.apache.org/oak/docs/query/grammar-sql2.html) (Apache Jackrabbit Oak)
- [XPath grammar](https://jackrabbit.apache.org/oak/docs/query/grammar-xpath.html) (Apache Jackrabbit Oak)

---
title: "Oak indexes and queries"
description: "How AEM runs repository queries, why they are slow without an index, how Lucene indexes and index tags work, and how to deploy indexes as code on Cloud Service."
track: aem
level: 4
order: 26
minutes: 10
outcome: "By the end you can explain why a query is slow, read its plan to see whether an index was used, and describe how a custom index reaches Cloud Service."
prereq: "The JCR, nodes and properties (lesson 3). Dispatcher caching (lesson 23) helps for context."
terms:
  - { t: "Oak", d: "Apache Jackrabbit Oak, the repository implementation underneath AEM that stores content and runs queries." }
  - { t: "Index", d: "A prepared lookup structure that lets Oak find matching nodes without reading every node." }
  - { t: "Traversal", d: "Answering a query by walking through nodes one by one because no suitable index exists." }
  - { t: "Lucene property index", d: "An Oak index, defined as nodes under `/oak:index`, that covers chosen properties for fast search and sorting." }
  - { t: "Index tag", d: "A label on an index that a query can request with `option(index tag ...)`, so only the intended index is used." }
mistake: "Writing a query that works on your small local content and shipping it. Without an index it traverses the repository, so it gets slower as content grows, and on Cloud Service a query that reads too many nodes is stopped."
try_it:
  - "Open the query tools available to you. On a local SDK, use the Query Builder debugger or the CRXDE query tool. On a Cloud Service environment, use the Query Performance tool in the Developer Console."
  - "Run `SELECT * FROM [cq:Page] AS p WHERE ISDESCENDANTNODE(p, '/content/mysite')` with `explain` in front of it and read the plan."
  - "Find the words `traverse` or `lucene:` in the plan. Which one did Oak choose?"
  - "Open the Oak index generator at /tools/oak-index-generator/ and generate a definition for a property such as `cq:tags` with a tag name."
  - "Compare the generated folder name with the naming pattern `<name>-<n>-custom-<n>` and say what changes when you edit the index later."
quiz:
  - q: "Why is a query without a matching index slow?"
    options:
      - "Oak must read through many nodes one by one to find matches"
      - "Oak sends the query to the CDN, which is slower than the repository"
      - "Oak refuses to run it until an administrator approves it"
      - "Oak sorts results in the browser instead of on the server"
    answer: 0
    why: "Without a suitable index Oak traverses, reading nodes until it finds matches. That cost grows with content, which is why a fast query on a small local repository can fail in production."
  - q: "A query filters on two properties, but your index covers only one. What is the most likely outcome?"
    options:
      - "Oak combines your index with a second one to cover both filters"
      - "The query fails straight away with an error about the missing index"
      - "The second filter is silently dropped so that the results come back fast"
      - "Oak uses the index for one filter and checks the other on each candidate node"
    answer: 3
    why: "Oak normally picks one index per query. Restrictions the index cannot handle are applied afterwards to each candidate node. The query still works but reads extra nodes, so put every filtered property in the same index."
  - q: "You add a custom index to speed up your query, but a product update changes which index Oak picks for other queries. Which practice prevents surprises?"
    options:
      - "Name the index so it sorts first in the repository"
      - "Give the index a tag, and have your query ask for it with `option(index tag ...)`"
      - "Add every property in the repository to your index"
      - "Run the query twice and keep the faster result"
    answer: 1
    why: "Tags (with a tag selection policy) make an index private to queries that request it, so neither side can hijack the other's plan. Indexing everything makes the index large and slow to maintain."
  - q: "Which is NOT true for custom indexes on AEM as a Cloud Service?"
    options:
      - "You change a deployed index by editing the existing definition in place"
      - "They are defined in code and deployed through Cloud Manager"
      - "Names follow a pattern that includes `custom` and a version number"
      - "They should be of type `lucene`"
    answer: 0
    why: "A deployed index definition is treated as immutable. To change it you add a new version, for example by increasing the number after `custom`. The other statements describe how indexes are deployed and named."
go_deeper:
  - { title: "JCR queries, Oak indexes and AEM performance", url: "/blog/2026/11/jcr-queries-oak-indexes-aem-performance/", why: "query syntax, index anatomy, plans and a review checklist" }
  - { title: "Oak index generator", url: "/tools/oak-index-generator/", why: "generate an index definition for your query" }
  - { title: "JCR explained for SQL developers", url: "/blog/2026/11/jcr-explained-for-sql-developers/", why: "the repository model if queries still feel foreign" }
---
## The problem: search that gets slower as you succeed

You build a "latest articles" list. It queries the repository for pages under `/content/mysite` tagged with a topic, newest first. On your laptop, with thirty pages, it takes a blink. A year later, with fifty thousand pages, it takes seconds, and on Cloud Service it may be stopped altogether.

Nothing in the query changed. The content grew, and the query was answered by looking at everything.

## How a query runs

AEM stores content in a tree of nodes and properties (the JCR), and **Oak** is the engine that stores and searches it. You can query with JCR-SQL2, XPath or the Query Builder, which turn into the same plan.

Oak looks at your query, asks each index how cheaply it could answer, and picks the cheapest. If no index fits, it **traverses**: it walks nodes and checks each. Traversal over a large path is the classic cause of a slow AEM instance.

Two rules from the model:

1. **One index per query.** Oak does not merge two indexes. If you filter on a tag and a date, both belong in the same index definition.
2. **Anything the index cannot handle is checked afterwards,** node by node. The result is correct but the work is more than the result size suggests.

## Making a query use an index

Here is a query and the index idea behind it:

```text
SELECT * FROM [cq:PageContent] AS c
WHERE ISDESCENDANTNODE(c, '/content/mysite/en/articles')
  AND c.[cq:tags] = 'mysite:topics/databases'
ORDER BY c.[jcr:created] DESC
OPTION(INDEX TAG mysiteArticles)
```

A **Lucene property index** lists the properties it covers (here `cq:tags` and `jcr:created`) and the node type and paths it applies to. The `OPTION(INDEX TAG ...)` clause names the tag on the index, so the query uses the index you designed for it. Tags only allow letters, digits and underscores.

An index lives in the repository under `/oak:index`, and in your project as files under `ui.apps/src/main/content/jcr_root/_oak_index/`. The [Oak index generator](/tools/oak-index-generator/) on this site produces a definition you can review and adapt.

## Reading the plan

Put `explain` in front of a SQL2 query and Oak returns the plan instead of the results. You are looking for a line starting with `lucene:` followed by your index name. If you see `traverse`, no index was used.

On Cloud Service the **Query Performance** tool in the Developer Console lists slow queries and shows an **Explain Query** view. Adobe flags queries that read more than a few thousand rows, and the engine stops a query that reads far more than that. Treat any traversal warning in the logs as a bug to fix, not noise.

## Indexes as code on Cloud Service

You cannot click an index into existence on a running Cloud Service environment. Index definitions are deployed as code, in the same pipeline as everything else. Custom indexes are of type `lucene`, and their names follow a pattern with a version and the word `custom`, for example `mysite.articles-1-custom-1`.

Treat a deployed definition as immutable. To change an index, add a new version (`-custom-2`) rather than editing the old one. The platform builds the new index and switches to it. This is why you test queries against realistic content volume locally before the pipeline runs.

## Habits that keep queries healthy

- **Avoid the query** where you can. Walking a known path is cheaper than searching.
- **Restrict path and node type.** A search across `/jcr:root//*` forces wide scans.
- **Put every filtered and sorted property in one index.**
- **Tag your indexes** and request the tag in the query.

<details markdown="1">
<summary>Stretch question: why might "just add an index for everything" be a bad plan?</summary>

Every index must be updated whenever matching content changes, and it takes storage and build time. A large, vague index slows writes, takes longer to deploy and is harder to reason about. A small index shaped for one family of queries is faster to maintain and easier to review.

</details>

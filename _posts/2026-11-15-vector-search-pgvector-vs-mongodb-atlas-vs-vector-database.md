---
layout: post
title: "Vector search for RAG over CMS content: pgvector vs MongoDB Atlas vs a dedicated vector database"
seo_title: "pgvector vs MongoDB Atlas vs Vector DB for RAG over CMS"
description: "Choosing a vector store for RAG over CMS content: pgvector, MongoDB Atlas Vector Search or a dedicated vector DB, plus chunking AEM content and hybrid search."
ai_summary: "Retrieval-augmented generation over CMS content needs a vector store, but for most enterprise sites the store is the easy part. pgvector adds vector columns, HNSW and IVFFlat indexes and iterative filtered scans to Postgres; MongoDB Atlas Vector Search adds $vectorSearch with pre-filter fields, quantization and native hybrid search; dedicated vector databases earn their place at very large scale or with specialised retrieval needs. The post compares the three, explains dimension and filtering limits, shows how to chunk AEM pages and Content Fragments with metadata, keeps the index in sync with publishing, and recommends hybrid keyword plus vector search with reciprocal rank fusion as the default."
date: 2026-11-15 12:00:00 +0530
category: databases
tags: [Vector Search, pgvector, MongoDB, RAG, AEM, PostgreSQL]
---

"We need a vector database" is now a line item in almost every AI proposal I review. Usually it sits next to a chatbot that answers questions from the corporate website, the product documentation or the intranet, all of which live in a CMS. And usually the team has spent weeks comparing vector databases while nobody has decided how a 40-component AEM page becomes something an embedding model can read.

That's the wrong way round. For retrieval-augmented generation (RAG) over CMS content, answer quality depends far more on **what you put in the index** (chunks, metadata, freshness, permissions) than on which engine holds the vectors. For most enterprise content volumes, use the database you already run unless you have a specific reason not to.

This post compares the three realistic options, pgvector, MongoDB Atlas Vector Search and a dedicated vector database, and then spends equal time on the part that decides success: chunking AEM content, keeping the index in sync with publishing, and hybrid search.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **CMS content is small by vector standards.** Even a large multi-site, multi-language AEM estate rarely produces more than a few million chunks. That is comfortably within what pgvector or Atlas Vector Search handle.
- **Use pgvector if you run Postgres,** Atlas Vector Search if you run MongoDB Atlas. You get transactions, joins or aggregations, backups and access control you already operate, next to the vectors.
- **A dedicated vector database earns its place** at hundreds of millions of vectors, with very high query rates, or when you need retrieval features (multi-vector, built-in rerankers, tiered storage) your database lacks.
- **Watch the limits.** pgvector indexes `vector` columns up to 2,000 dimensions (`halfvec` up to 4,000). Atlas indexes up to 8,192. A 3,072-dimension embedding needs `halfvec` or a reduced dimension in Postgres.
- **Filtered vector search is the hard part.** Use pgvector 0.8's iterative index scans, or Atlas `filter` fields declared in the index.
- **Chunk by component and heading, not by character count,** and carry path, locale, template, tags and permissions as metadata on every chunk.
- **Hybrid search (keyword plus vector) should be your default.** Product codes, names and acronyms are where pure vector search fails, and they are exactly what people type.
- **Re-index on publish, not on a nightly crawl,** and delete on unpublish. Stale or withdrawn content in answers is the fastest way to lose trust.

## What RAG over a CMS actually needs

![RAG over CMS content: publish events feed a chunker, an embedding model and a vector store with metadata; queries run hybrid retrieval with filters, then reranking and generation]({{ '/assets/img/blog/vector-search-pgvector-vs-mongodb-atlas-vs-vector-database/01-rag-pipeline.svg' | relative_url }}){: width="1200" height="560" loading="lazy" decoding="async"}

A RAG system over website content has two paths:

1. **Indexing:** when content is published, split it into chunks, compute an embedding vector for each chunk, and store the vector with the chunk text and its metadata.
2. **Querying:** embed the user's question, find the nearest chunks (filtered by locale, site, audience), optionally rerank them, and pass the best few to a language model with the question.

The vector store only does "find the nearest chunks, with filters, fast". Everything else is your pipeline. For a CMS use case I compare stores on five things:

| Requirement | Why it matters for CMS content |
|---|---|
| **Filtering** | Answers must come from the right site, language, market and audience. Almost every query is filtered. |
| **Hybrid search** | People search for product names, SKUs and acronyms. Embeddings blur those. |
| **Freshness** | Publish and unpublish must reach the index in minutes, including deletes. |
| **Operations** | Backups, access control, monitoring, cost. Another database is another on-call rota. |
| **Scale** | Rarely the constraint for CMS content, but check it honestly. |

Raw nearest-neighbour speed isn't on the list. At a few million vectors, every option is fast enough with an approximate index.

## pgvector: vectors in the database you already run

[pgvector](https://github.com/pgvector/pgvector) is a Postgres extension that adds vector types, distance operators and approximate nearest-neighbour (ANN) indexes. It's available on every major managed Postgres service, so on most projects "adding a vector database" is `CREATE EXTENSION vector`.

### The basics

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE content_chunk (
  id           bigserial PRIMARY KEY,
  source_path  text        NOT NULL,          -- e.g. /content/acme/en/products/widget
  locale       text        NOT NULL,
  site         text        NOT NULL,
  content_type text        NOT NULL,          -- page, content-fragment, pdf
  heading      text,
  body         text        NOT NULL,
  tags         text[]      NOT NULL DEFAULT '{}',
  published_at timestamptz NOT NULL,
  embedding    vector(1536) NOT NULL,
  body_tsv     tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(heading,'') || ' ' || body)) STORED
);

CREATE INDEX content_chunk_embedding_hnsw
  ON content_chunk USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX content_chunk_site_locale ON content_chunk (site, locale);
CREATE INDEX content_chunk_tsv ON content_chunk USING gin (body_tsv);
```

A query is ordinary SQL. `<=>` is cosine distance (`<->` is Euclidean, `<#>` negative inner product):

```sql
SELECT id, source_path, heading, 1 - (embedding <=> $1) AS similarity
FROM content_chunk
WHERE site = 'acme' AND locale = 'en-gb'
ORDER BY embedding <=> $1
LIMIT 10;
```

### What to know before you commit

**Dimension limits.** pgvector stores up to 16,000 dimensions, but HNSW and IVFFlat only index `vector` columns up to **2,000 dimensions**. `halfvec` (half-precision) indexes up to 4,000. If your embedding model produces 3,072 dimensions, either store `halfvec(3072)`, or ask the model for fewer dimensions if it supports that (several current models do, with a small quality cost). Decide this before you embed a million chunks.

**HNSW vs IVFFlat.** HNSW gives better recall-for-speed and doesn't need training data, at the cost of slower builds and more memory. IVFFlat builds faster but must be created after the table has data, and its recall drifts as content changes. For CMS content, which changes continuously, I default to HNSW.

**Filtering.** This is the classic pgvector trap. An ANN index returns the nearest *candidates* (40 by default, from `hnsw.ef_search`), and Postgres applies your `WHERE` clause afterwards. If only 2% of chunks are `locale = 'de-ch'`, a filtered query can return three rows instead of ten. pgvector 0.8.0 added **iterative index scans**, which keep scanning the index until enough rows pass the filter:

```sql
SET hnsw.iterative_scan = relaxed_order;   -- or strict_order
SET hnsw.ef_search = 100;
```

For a filter that is very selective and always present, such as tenant or site, a **partial index per value** or table partitioning is often better still: each locale or site gets its own small, dense index.

### When pgvector is the right answer

- You already run Postgres and have people who know it.
- You want vectors next to relational data: joins to product tables, permissions, transactional consistency between content and its embedding.
- Your scale is in the low tens of millions of vectors or below.
- You want hybrid search in one query (see [below](#hybrid-search-should-be-your-default)).

If you are weighing Postgres against MongoDB more generally, I compare them in [Postgres JSONB vs MongoDB]({{ '/blog/2026/11/postgres-jsonb-vs-mongodb/' | relative_url }}), and indexing in general in [the indexing post]({{ '/blog/2026/11/database-indexing-postgresql-mysql-oracle-mongodb-oak/' | relative_url }}).

## MongoDB Atlas Vector Search

[Atlas Vector Search](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-overview/) stores embeddings as an array (or BSON binary vector) field in ordinary documents, indexes them with a separate `vectorSearch` index, and queries them with the `$vectorSearch` aggregation stage. The search indexes are maintained by a separate process (`mongot`) alongside the database, so they are eventually consistent with your writes, typically within seconds.

### The basics

The index definition declares the vector field and any fields you want to filter on:

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 1536,
      "similarity": "cosine", "quantization": "scalar" },
    { "type": "filter", "path": "site" },
    { "type": "filter", "path": "locale" },
    { "type": "filter", "path": "tags" }
  ]
}
```

And the query:

```javascript
db.content_chunks.aggregate([
  { $vectorSearch: {
      index: "chunks_vector",
      path: "embedding",
      queryVector: questionEmbedding,
      numCandidates: 200,
      limit: 10,
      filter: { site: "acme", locale: "en-gb" }
  } },
  { $project: { sourcePath: 1, heading: 1, body: 1,
                score: { $meta: "vectorSearchScore" } } }
]);
```

### What to know before you commit

**Pre-filtering is built in,** but only on fields declared as `filter` in the index (booleans, dates, numbers, strings, ObjectIds, UUIDs and arrays of them). Forget to declare `locale` and the query fails, rather than silently returning too few results. That is better behaviour than a post-filter surprise.

**Dimensions and quantization.** `numDimensions` goes up to 8,192, so large embedding models fit without tricks. Scalar and binary quantization are index options, which cut memory substantially, with binary rescoring against full-precision vectors.

**Hybrid search.** MongoDB added native hybrid search with the `$rankFusion` stage (and later `$scoreFusion`), combining a `$search` (full-text) pipeline and a `$vectorSearch` pipeline. Check the version requirements for your cluster tier in the current docs, because these features moved from preview to general availability at different times.

**Self-managed.** Search and Vector Search were historically Atlas-only. MongoDB 8.2 brought them to Community Edition and Enterprise Server as a public preview. If you run MongoDB on your own infrastructure, check the feature's current status before you plan production on it.

### When Atlas Vector Search is the right answer

- Your content or application data already lives in MongoDB Atlas.
- Your chunks are naturally documents with nested metadata, and you don't want to flatten them.
- You need large embeddings or quantization without managing it yourself.

My [MongoDB schema design post]({{ '/blog/2026/11/mongodb-schema-design-for-relational-developers/' | relative_url }}) covers how to shape those documents.

## Dedicated vector databases

Pinecone, Qdrant, Weaviate, Milvus and similar products are built for one job; Elasticsearch and OpenSearch sit in between, with mature keyword search plus vector fields. Their advantages:

- **Scale and cost at the top end:** billions of vectors, disk-based or tiered indexes, serverless pricing that scales to zero.
- **Retrieval features:** sparse and dense vectors together, multi-vector (late interaction) models, built-in rerankers, namespaces for multi-tenancy.
- **Filtering engineered into the index,** rather than bolted on.

And real costs:

- **Another system of record to sync.** Every publish, unpublish, permission change and deletion now has to reach a second store. The sync job is where most RAG bugs live.
- **Another security boundary.** Chunk text is your content. It needs the same access control, encryption and data residency review as the CMS.

### My decision table

| Situation | Recommendation |
|---|---|
| Postgres in the estate, under ~10–20 million chunks | **pgvector** |
| MongoDB Atlas in the estate | **Atlas Vector Search** |
| Elasticsearch/OpenSearch already powers site search | Add vectors there; you get keyword search and ranking you've already tuned |
| Hundreds of millions of vectors, high QPS, or multi-tenant SaaS | **Dedicated vector database** |
| A proof of concept | Whatever your team can stand up in a day; don't let the POC choose production |

For a typical enterprise website or documentation RAG, I recommend the first three rows far more often than the fourth. The [SQL vs NoSQL post]({{ '/blog/2026/11/sql-vs-nosql-is-the-wrong-question/' | relative_url }}) makes the same argument more generally: decide from access patterns and operations, not category labels.

## Chunking AEM content

This is where AEM experience pays off, and where generic RAG tutorials let you down. They assume a pile of text files. An AEM page is a tree of components in the JCR (see [JCR explained for SQL developers]({{ '/blog/2026/11/jcr-explained-for-sql-developers/' | relative_url }})), and a lot of it is navigation, footers, teasers that repeat other pages, and Experience Fragments shared across hundreds of pages.

### Where to get the content from

| Source | Good for | Watch out for |
|---|---|---|
| **Rendered HTML from publish or the CDN** | What visitors actually see, including fragments | Strip header, footer, navigation and cookie banners, or every chunk looks alike |
| **Content Fragments via GraphQL persisted queries or the REST OpenAPI** | Structured content: FAQs, product specs, articles | Fragments referenced by other fragments; resolve them deliberately |
| **Edge Delivery Services pages** | `.plain.html` returns the main content without page decoration; the query index lists pages and metadata | Blocks are tables in the source; turn them into readable text |

I generally index **rendered HTML for pages** (what visitors see) and **fragment JSON for structured content** (the cleaner unit for FAQs and specs).

### How to chunk

- **Split on structure first.** Component boundaries and headings (`h2`, `h3`) are natural chunk edges. A "Specifications" section should be one chunk, not split halfway through a table.
- **Then cap by size.** Somewhere around 200–500 tokens per chunk works for most website content, with a small overlap when you have to split prose.
- **Prepend context.** Put the page title and section heading at the top of each chunk's text before embedding: "Widget Pro > Specifications > Battery". A chunk that just says "Up to 12 hours" is useless on its own.
- **Index shared content once.** An Experience Fragment that appears on 800 pages should be one chunk with its own path, not 800 near-duplicates crowding out everything else.
- **Skip boilerplate.** Legal footers, cookie text and "related articles" teasers add noise. Exclude by component resource type.

### What metadata to carry

| Field | From | Used for |
|---|---|---|
| `source_path`, `url` | Page path and its public URL | Citations, deletes on unpublish |
| `site`, `locale` | Content tree (`/content/<site>/<language>`) | Filters on every query |
| `template`, `content_type` | `cq:template`, fragment model | Boosting docs over marketing, or excluding |
| `tags` | `cq:tags` | Filters and facets |
| `published_at` | Replication timestamp | Freshness, tie-breaks |
| `audience` / `acl_group` | Closed user groups or your own model | **Permission filtering** |

The last row matters most for intranets and partner portals. If the CMS restricts a page to a group, the retrieval query must restrict it too. Never rely on the language model to "not mention" things it was given.

## Keeping the index in sync with publishing

A nightly crawl is how most RAG pilots start, and how most of them end up answering with a price that changed last Tuesday. Index on events instead:

- **On AEM as a Cloud Service,** [AEM Eventing](https://experienceleague.adobe.com/en/docs/experience-manager-learn/cloud-service/aem-eventing/overview) delivers page and content events through Adobe I/O Events to a webhook, Adobe I/O Runtime (App Builder) or Amazon EventBridge. A small worker fetches the published content, chunks it, embeds it and upserts the chunks.
- **Unpublish and delete are events too.** Delete every chunk with that `source_path`. Test this path explicitly; it is the one that gets forgotten.
- **Re-embed by hash.** Store a hash of each chunk's text and only call the embedding model when it changes. Republishing a page whose body didn't change shouldn't cost anything.
- **Version the embedding model.** Store the model name with each vector. Changing models means re-embedding everything, and you can't mix vectors from two models in one index.
- **Reconcile weekly** against the sitemap or query index to catch missed events.

This is the same pattern as any content leaving the JCR, which I discuss in [when AEM content belongs outside the JCR]({{ '/blog/2026/11/when-aem-content-belongs-outside-the-jcr/' | relative_url }}). The CMS stays the source of truth; the vector index is a derived, rebuildable projection. Treat it like a cache, and make sure you can rebuild it from scratch in a known time.

## Hybrid search should be your default

Embeddings are good at meaning and bad at exact tokens. A visitor typing "WX-4500 battery" wants the page with "WX-4500" in it, not the page about a similar product with a better-written battery paragraph. Keyword search gets that right. Hybrid search runs both and fuses the results.

**Reciprocal rank fusion (RRF)** is the simplest robust fusion: each result scores `1 / (k + rank)` in each list, and you sum the scores. It needs no score normalisation, which is why both MongoDB's `$rankFusion` and most search engines offer it. In Postgres you can write it yourself:

```sql
WITH semantic AS (
  SELECT id, row_number() OVER (ORDER BY embedding <=> $1) AS rank
  FROM content_chunk
  WHERE site = $3 AND locale = $4
  ORDER BY embedding <=> $1
  LIMIT 50
),
keyword AS (
  SELECT id, row_number() OVER (ORDER BY ts_rank_cd(body_tsv, query) DESC) AS rank
  FROM content_chunk, websearch_to_tsquery('english', $2) AS query
  WHERE site = $3 AND locale = $4 AND body_tsv @@ query
  ORDER BY ts_rank_cd(body_tsv, query) DESC
  LIMIT 50
)
SELECT c.id, c.source_path, c.heading,
       coalesce(1.0 / (60 + s.rank), 0) + coalesce(1.0 / (60 + k.rank), 0) AS rrf_score
FROM semantic s
FULL OUTER JOIN keyword k USING (id)
JOIN content_chunk c USING (id)
ORDER BY rrf_score DESC
LIMIT 10;
```

The `'english'` configuration is wrong for German or Japanese content; use one per locale, or a search engine with proper language analysis. And a **reranker** (a cross-encoder model that scores each question–chunk pair) on the top 20–50 fused results usually improves answer quality more than any change of vector store.

## Measure retrieval, not vibes

Before comparing engines, build an evaluation set: 50–100 real questions from search logs or support tickets, each with the page that should answer it. Measure **recall@10** (did the right chunk appear in the top 10?) as you change chunking, heading context, hybrid vs vector-only, reranking and `ef_search` or `numCandidates`. In my experience, chunking and hybrid search move the numbers far more than the choice of engine. Also confirm the vector index is used at all; [reading query plans]({{ '/blog/2026/11/reading-query-plans-postgresql-mysql-oracle-mongodb/' | relative_url }}) covers `EXPLAIN` in both engines.

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| Choosing the vector store before designing chunks | Weeks of benchmarks, poor answers anyway | Build the evaluation set and chunker first |
| Embedding whole pages | One vector averages navigation, hero and five topics | Chunk by component and heading |
| No locale or site filter | English answers to German questions; one brand's content in another's bot | Metadata on every chunk; filter on every query |
| pgvector post-filter on a selective filter | Three results instead of ten, silently | Iterative scans, partial indexes or partitions |
| 3,072-dimension `vector` column in Postgres | Index creation fails above 2,000 dimensions | `halfvec`, or fewer dimensions from the model |
| Nightly crawl only | Stale prices, withdrawn pages still quoted | Event-driven upserts and deletes |
| Vector-only search | Misses SKUs, names, acronyms | Hybrid with RRF, then rerank |
| Ignoring permissions | Restricted content appears in public answers | Filter by audience in the retrieval query |

## Closing thought

The vector store is the least interesting decision in a RAG project, and the one that gets the most meeting time. For CMS content, pick the database you already operate, pgvector or Atlas, and move a dedicated vector database to the "when we outgrow it" column. Spend the saved time on chunking that respects how AEM pages are built, metadata that makes filtering possible, event-driven sync with publishing, and hybrid search. That's what users notice.

If you are planning RAG or an AI assistant over AEM content and want a second opinion on the architecture, [get in touch](/contact/).

### References

- [pgvector](https://github.com/pgvector/pgvector) (GitHub)
- [MongoDB Vector Search overview](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-overview/) (MongoDB docs)
- [How to index fields for vector search](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/) (MongoDB docs)
- [Native hybrid search with $rankFusion](https://www.mongodb.com/products/updates/public-preview-native-hybrid-search-in-mongodb-atlas-with-rankfusion/) (MongoDB)
- [MongoDB Search and Vector Search for Community Edition](https://www.mongodb.com/company/blog/product-release-announcements/supercharge-self-managed-apps-search-vector-search-capabilities) (MongoDB)
- [AEM Eventing](https://experienceleague.adobe.com/en/docs/experience-manager-learn/cloud-service/aem-eventing/overview) (Adobe Experience League)
- [Persisted GraphQL queries](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/headless/graphql-api/persisted-queries) (Adobe Experience League)
- [Full text search in PostgreSQL](https://www.postgresql.org/docs/current/textsearch.html) (PostgreSQL documentation)

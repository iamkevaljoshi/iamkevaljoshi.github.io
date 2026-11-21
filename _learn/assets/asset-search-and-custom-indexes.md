---
title: "Asset search and custom indexes"
description: "How AEM asset search uses the damAssetLucene index, why custom metadata is not searchable by default, and how to customise it safely on Cloud Service."
track: assets
level: 6
order: 34
minutes: 10
outcome: "By the end you can explain why a custom metadata field does not appear in search, and outline how to make it searchable by customising the asset index as code."
prereq: "Oak indexes and queries in the AEM track (lesson 26 there) and metadata schemas (lesson 7)."
terms:
  - { t: "damAssetLucene", d: "The out-of-the-box Oak index that serves searches over `dam:Asset` nodes. Its name carries a version number." }
  - { t: "Index rule", d: "The part of a Lucene index definition that says which node type is indexed and which properties are included." }
  - { t: "Customised OOTB index", d: "A copy of Adobe's index definition with your additions, renamed with a `-custom-` suffix and deployed as code." }
  - { t: "Facet", d: "A filter in the search UI that shows value counts, such as brand or status. Facets rely on the property being indexed for that purpose." }
  - { t: "Analysed property", d: "A property indexed for full-text matching, so searching a word finds it inside longer text." }
mistake: "Adding a metadata field to the schema and assuming it is searchable. The form stores the value, but the index does not know about it, so searches silently return nothing."
try_it:
  - "Add a text field called `Campaign code` to a metadata schema and fill it for one asset, using lesson 7."
  - "Search the Assets UI for that exact code and note that nothing is found, or that results depend on other fields."
  - "Look up the current `damAssetLucene` version on a Cloud Service dev environment and write down its name."
  - "Open /tools/oak-index-generator/ and generate a new index for a test query, then read the output to see the structure of an index rule."
  - "Write, as a checklist, the steps you would take to add `campaignCode` to a customised OOTB asset index and deploy it."
quiz:
  - q: "A new schema field `Campaign code` is filled in on 500 assets, yet searching for a code finds nothing. What is the most likely cause?"
    options:
      - "The property is not part of the asset search index"
      - "The assets have not been published yet"
      - "Search only looks at file names"
      - "The schema form must be saved on the folder instead"
    answer: 0
    why: "A schema controls the editing form, not the index. Unless the property is indexed, search cannot find it. Publishing and folder settings are unrelated to author-side search."
  - q: "You want a property to be searchable in the Assets UI. What is the recommended approach on Cloud Service?"
    options:
      - "Create a brand-new index on `dam:Asset` with your own name"
      - "Customise the OOTB index by copying its latest definition and adding your property"
      - "Edit `damAssetLucene` in place using CRXDE Lite on production"
      - "Switch search off and rely on folders"
    answer: 1
    why: "Adobe's guidance is to customise the OOTB asset index rather than create competing indexes, and to ship it as code. Editing a running environment by hand is not how Cloud Service works."
  - q: "What does the new name `damAssetLucene-<n>-custom-1` tell you?"
    options:
      - "A customised copy of version n, so any future change becomes -custom-2"
      - "An index that only the developer who created it can query"
      - "A temporary index that Adobe deletes after one deployment"
      - "An index that replaces tags with metadata"
    answer: 0
    why: "The suffix marks your customisation of a specific OOTB version, and a deployed definition is treated as immutable, so changes go in as a new version. It is not private or temporary."
  - q: "Which is a mistake when customising the asset index?"
    options:
      - "Copying the definition from a Cloud Service dev environment"
      - "Keeping the whole OOTB definition and adding only your property"
      - "Testing with realistic asset volume before the pipeline"
      - "Starting from the local SDK copy and removing nodes that look unused"
    answer: 3
    why: "The SDK copy can lag behind the cloud version and may lack parts the cloud needs, so deleting nodes that look unused can break the deployment. Always start from the current cloud definition and keep it complete."
go_deeper:
  - { title: "JCR queries, Oak indexes and AEM performance", url: "/blog/2026/11/jcr-queries-oak-indexes-aem-performance/", why: "how plans, tags and index rules work" }
  - { title: "Oak index generator", url: "/tools/oak-index-generator/", why: "builds new index definitions for your own queries" }
  - { title: "Database indexing: PostgreSQL, MySQL, Oracle, MongoDB and Oak", url: "/blog/2026/11/database-indexing-postgresql-mysql-oracle-mongodb-oak/", why: "the same ideas in other databases" }
  - { title: "Next lesson: Migrating assets to Cloud Service", url: "/learn/assets/migrating-assets-to-cloud-service/" }
---
## The problem: the field everyone filled in and nobody can find

A brand team adds a `Campaign code` field to their schema. Six months later, 40,000 assets carry codes, and a manager searches for `SPRING-24`. Nothing. The data is in the repository, but search does not read the repository. It reads an **index**.

## How asset search is served

When you type in the Assets UI, AEM turns your request into a query over `dam:Asset` nodes, and an Oak index answers it. On Cloud Service the out-of-the-box index is **damAssetLucene**, with a version number in its name (for example `damAssetLucene-8`; the number changes as Adobe updates it). Adobe's documentation notes that queries written against it may be served by a different search engine behind the scenes, which is why you keep to the supported definition format.

If you have read the Oak lessons, this is the same machinery: an index lists node types and properties, and Oak uses only what is indexed. Properties outside the index are not searchable, and a query that falls back to traversal is slow and may be stopped.

So there are two separate questions for any metadata field:

| Question | Where it is answered |
|---|---|
| Can authors edit it? | The metadata schema (lesson 7) |
| Can people search and filter by it? | The search index |

## Customising the OOTB index

The recommended route is to **customise the out-of-the-box index**, not to add a rival index on `dam:Asset`. The rules, from Adobe's indexing documentation, in outline:

1. Get Adobe's **latest definition** of the index from a Cloud Service environment, not from the local SDK, which can be behind.
2. Rename it with the custom suffix, so `damAssetLucene-8` becomes `damAssetLucene-8-custom-1`.
3. Keep the **whole definition**, including parts such as the `tika` node that the cloud needs. Add only what you want, under the `dam:Asset` index rule.
4. Commit it to the project as code and deploy it through Cloud Manager. Indexing and switch-over are handled by the platform.
5. When Adobe moves to a new OOTB version, merge your additions into the new definition and use the matching suffix.

An addition looks like this:

```xml
<campaignCode jcr:primaryType="nt:unstructured"
    name="jcr:content/metadata/campaignCode"
    propertyIndex="{Boolean}true"
    analyzed="{Boolean}true"
    nodeScopeIndex="{Boolean}true"/>
```

`propertyIndex` supports exact filters, `analyzed` supports word matching, and `nodeScopeIndex` includes the value in full-text search. Facets and ordering may need further flags, so check the current documentation for the exact settings your search needs. Where the property lives depends on your schema (for most DAM metadata it is under `jcr:content/metadata`).

Be honest about tools: the [Oak index generator](/tools/oak-index-generator/) on this site builds **new** indexes for your own queries. It does not produce a customised OOTB asset index, so use it to learn the structure, not as the final file.

## Testing and operating

- **Rehearse on a dev environment** with realistic volume. Reindexing a large repository takes time.
- **Check the plan** with the Query Performance tool, as in the Oak lessons, and look for the index name in the plan.
- **Keep a short list** of added properties and why, so the next OOTB merge is routine.
- **Be selective.** Each indexed property costs time on every write. Index fields people genuinely search or facet on.

Related: bulk metadata imports (lesson 11) trigger index updates too, which matters at scale (lesson 36).

<details markdown="1">
<summary>Stretch question: why not just create `acme.assetSearch` on `dam:Asset` and skip the merge work?</summary>

Oak chooses one index per query, so two indexes on the same node type can compete and give inconsistent results, and the UI is built around the OOTB one. Adobe's advice to customise rather than duplicate trades a little maintenance for predictable behaviour. Confirm the current guidance before you decide.

</details>

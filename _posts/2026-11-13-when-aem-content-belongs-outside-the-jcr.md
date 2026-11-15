---
layout: post
title: "When AEM content belongs outside the JCR: UGC, commerce, user data and the patterns that work"
seo_title: "When AEM Data Belongs Outside the JCR (and How to Do It)"
description: "Which data doesn't belong in the AEM repository on Cloud Service, from UGC and commerce to user data and analytics, and the integration patterns that work."
ai_summary: "On AEM as a Cloud Service, content flows one way, from author to publish, reverse replication is not supported, and each publish instance has its own repository that can be recycled at any time. That makes the JCR the wrong home for user-generated content, form submissions, user profiles, live commerce data, analytics events and other high-write or per-user data. This post gives a decision test based on who writes the data, how fast, how much and how it is read, then compares five patterns: client-side calls to external APIs, Sling servlets that proxy to a backend, App Builder actions, scheduled import into Content Fragments, and the Commerce Integration Framework. It covers JDBC DataSourcePool and advanced networking, caching, secrets and the common mistakes."
date: 2026-11-13 13:00:00 +0530
category: databases
tags: [AEM as a Cloud Service, JCR, Architecture, Integration, App Builder, Content Fragments]
---

"Can we store the reviews in the repository? It's just a few nodes." I hear a version of that in almost every AEM project that adds something interactive: product reviews, comments, a wishlist, a "was this helpful?" button, event registrations. On AEM 6.5 there was an answer, more or less: write to publish, reverse-replicate to author, replicate out again. It never worked well. On AEM as a Cloud Service it doesn't work at all.

The JCR is an excellent repository for **content that authors create, govern and publish**, and a poor database for almost everything else. The hard part is deciding, item by item, which side of the line data sits on, then choosing an integration pattern that doesn't break your caching or security.

This post is the decision test I use, and the five patterns I reach for. It's the fifth post in my database series, and it builds on the [content modelling comparison]({{ '/blog/2026/11/content-modelling-jcr-vs-relational-vs-document-database/' | relative_url }}) and the [Oak storage post]({{ '/blog/2026/11/oak-storage-tarmk-mongomk-aem-cloud-service/' | relative_url }}).

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **Content flows one way on AEMaaCS.** Author publishes to publish. Adobe states that reverse replication from publish to author "is not supported", and each publish instance has its own repository that can be recycled at any time.
- **So anything written by site visitors doesn't belong in the JCR:** reviews, comments, ratings, form submissions, user profiles, preferences, carts, events and analytics.
- **Nor does anything owned by another system of record:** prices, stock, orders, CRM data. Keep a key in AEM and fetch the rest.
- **Decide by writer, write rate, volume, per-user scope and read pattern.** If the answer to "who writes it?" isn't "an author, through AEM", it's probably external.
- **Five patterns cover nearly every case:** client-side calls to an API, a Sling servlet that proxies, an App Builder action, scheduled import into Content Fragments, and the Commerce Integration Framework for commerce.
- **Protect your cache.** Per-user data fetched server-side into a page makes the page uncacheable. Fetch it client-side, or make the server-side call cacheable.
- **My default** is client-side calls to an API layer (App Builder or your own services) for anything per-user or real-time, and import into Content Fragments for slow-changing data that authors need to enrich.

## Why the JCR is the wrong place for this data

The reasons are architectural, not about performance tuning.

**Content flows from author to publish, and only that way.** Adobe's [development guidelines](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/development-guidelines) say plainly that "reverse replication from Publish to Author is not supported in AEM as a Cloud Service". If you need data shared across the publish farm, the same guidelines point to "an external persistence store" shared among the publish instances.

**Each publish instance has its own repository.** As I covered in the [Oak storage post]({{ '/blog/2026/11/oak-storage-tarmk-mongomk-aem-cloud-service/' | relative_url }}), publish runs on segment storage per instance. A review written to one instance isn't on the others, and publish instances are scaled and replaced by the platform. The guidelines tell you to assume "the instance it is running in can be brought down at any time". Anything written there is local and temporary.

**Even on author, it's the wrong workload.** The author tier is a shared repository built for editorial changes: versioned, indexed, workflow-driven and replicated. Feeding it thousands of writes an hour from visitors means index updates, more garbage for compaction, larger backups and a busier author for every editor.

**And it's often the wrong place legally.** User profiles, submissions and preferences are personal data. They need retention rules, deletion on request, encryption choices and access audits. A content repository that's copied to every publish instance and backed up with the website is not where your data protection officer wants them.

There used to be a product for some of this. AEM Communities handled forums, comments and ratings on AEM 6.x, with an external storage provider behind it. It isn't part of AEM as a Cloud Service, so that route is closed too.

## The decision test

For each kind of data, I ask five questions. Any answer in the right-hand column is a strong signal that the data belongs outside the JCR.

| Question | Keep it in the JCR | Put it outside |
|---|---|---|
| **Who writes it?** | Authors, through AEM | Visitors, another system, an integration |
| **How often is it written?** | Edited and published by people, a few times a day | Continuously, or in bursts driven by traffic |
| **How much is there?** | Thousands to tens of thousands of items | Hundreds of thousands to millions of rows, growing without bound |
| **Is it per user?** | Same for every visitor (or per segment) | Different for each logged-in user |
| **Does it need editorial workflow?** | Yes: review, versions, translation, publish | No, or it has its own lifecycle and retention |

Applied to the data I see most often:

| Data | Where it belongs | Notes |
|---|---|---|
| Articles, pages, product stories, FAQs | JCR | Authored, translated, published |
| Product name and marketing copy | JCR, or PIM with enrichment in AEM | Authors often add copy to PIM data |
| Price, stock, promotions | Commerce platform | Changes too often; owned elsewhere |
| Reviews, ratings, comments | External database or review service | Visitor-written, unbounded, needs moderation |
| Form submissions | External store, CRM or marketing automation | Personal data; retention rules |
| User profiles, preferences, wishlists | Identity provider and an external database | Per user, personal data |
| Store locator (thousands of stores) | External database or search index, or imported Content Fragments | Depends on who maintains it |
| Page views, clicks, events | Analytics platform | Never in a content repository |
| Feature flags, "live" banners | Configuration service, or AEM content with a short TTL | Depends on who flips them |

The interesting rows are the ones in the middle: product copy and store locators. They're **reference data that authors want to enrich**. That's where the import pattern below earns its place.

## Pattern 1: call the API from the browser

The page is cached and identical for everyone. A component renders a placeholder, and client-side JavaScript calls an API for the dynamic part: the reviews list, the user's wishlist state, live stock.

```html
<!-- HTL: the cached page contains only the hook -->
<div class="cmp-reviews"
     data-sku="${model.sku}"
     data-endpoint="https://api.example.com/reviews"></div>
```

```javascript
// Client-side: fetch and render after load
const el = document.querySelector('.cmp-reviews');
const res = await fetch(`${el.dataset.endpoint}?sku=${encodeURIComponent(el.dataset.sku)}`);
renderReviews(el, await res.json());
```

**Use it when** the data is per user, real-time or changes faster than you'd want to cache the page. **Watch out for** SEO (content that only appears after JavaScript runs may matter for review snippets), CORS, layout shift (reserve the space) and authentication tokens in the browser.

This is my default for per-user data. The HTML stays fully cacheable at the CDN and in Dispatcher, and the API can have its own, shorter, caching policy. The same pattern works unchanged on Edge Delivery Services, where blocks are client-side by nature.

## Pattern 2: a Sling servlet that proxies to a backend

Sometimes the data must be in the server-rendered HTML (for SEO), or the backend can't be exposed to browsers, or you need to combine AEM content with external data on the server. A Sling servlet or Sling Model on publish calls the backend and renders the result.

On AEM as a Cloud Service, two details decide whether this works:

**Timeouts.** Adobe recommends explicit connect and read timeouts on outgoing HTTP calls (it suggests 1 second and 5 seconds) and enforces global limits when you don't set them. A slow review service must not hold publish threads.

**Networking for databases.** HTTP and HTTPS on ports 80 and 443 work by default. Connecting directly to a database on another port needs [advanced networking](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/security/configuring-advanced-networking): flexible port egress, a dedicated egress IP or a VPN, with port forwarding rules set through the Cloud Manager API. Adobe's [JDBC DataSourcePool tutorial](https://experienceleague.adobe.com/en/docs/experience-manager-learn/cloud-service/networking/examples/sql-datasourcepool) shows the OSGi configuration, connecting through the proxy host:

```json
{
  "datasource.name": "reviews-mysql",
  "jdbc.driver.class": "com.mysql.cj.jdbc.Driver",
  "jdbc.connection.uri": "jdbc:mysql://$[env:AEM_PROXY_HOST;default=proxy.tunnel]:30001/reviews",
  "jdbc.username": "$[env:REVIEWS_DB_USER]",
  "jdbc.password": "$[secret:REVIEWS_DB_PASSWORD]"
}
```

That file is `com.day.commons.datasource.jdbcpool.JdbcPoolService~reviews-mysql.cfg.json` under your `osgiconfig`. Port `30001` is mapped to the real database host and port by a `portForwards` rule. The driver has to be deployed as an OSGi bundle, and secrets come from Cloud Manager environment variables, never from the repository. I go deeper into pool sizing in [connection pooling with HikariCP and PgBouncer]({{ '/blog/2026/11/database-connection-pooling-hikaricp-pgbouncer/' | relative_url }}).

My honest view: **direct JDBC from AEM publish is rarely the best design.** It couples every publish instance to a database schema, multiplies connection pools by the number of publish pods, and puts data access logic in the CMS. An HTTP API in front of the database is usually easier to secure, cache, scale and change. I use JDBC from AEM for internal, low-volume, read-mostly lookups, and an API for everything else.

**The caching trap.** If the servlet renders per-user data into the page, that page can't be shared. Either the response is `private` (and you lose the CDN), or someone caches it publicly and shows one user's data to another. Server-side proxying works well for **shared** external data, such as the average rating for a product, with a cache TTL that matches how fresh it needs to be. It works badly for per-user data. My [Dispatcher post]({{ '/blog/2026/11/dispatcher-on-aem-as-a-cloud-service-caching-and-invalidation/' | relative_url }}) covers the header rules.

## Pattern 3: App Builder as the API layer

[Adobe App Builder](https://developer.adobe.com/app-builder/docs/intro_and_overview/) gives you serverless actions on Adobe I/O Runtime, with Adobe IMS authentication and access to Adobe APIs. For AEM projects it's a natural place for the API layer that patterns 1 and 2 call: a reviews API, a form-submission handler, a wishlist service, an event listener that reacts to AEM events.

| Strength | Limitation |
|---|---|
| Runs outside AEM, scales separately, deploys separately | Serverless constraints: execution time limits, cold starts |
| Adobe authentication and event integration built in | Its built-in storage is for app state and files, not a full database; for real data you still bring one |
| Keeps integration code out of the AEM codebase and its pipeline | Another runtime and deployment pipeline to own |

The key point is the second row. App Builder is where integration **logic** lives. The **data** still needs a database: managed Postgres, MongoDB Atlas, DynamoDB or your enterprise's standard. Choosing that store is the subject of the rest of this series, starting with [SQL vs NoSQL is the wrong question]({{ '/blog/2026/11/sql-vs-nosql-is-the-wrong-question/' | relative_url }}).

This is also the point where an AEM estate starts to become composable: AEM owns content, other services own data, and an API layer stitches them together. If you're weighing how far to take that, my [composable, headless or traditional decision framework]({{ '/blog/2026/11/composable-headless-or-traditional-aem-decision-framework/' | relative_url }}) covers the integration cost honestly.

If your organisation already runs its own API platform (Kubernetes, a cloud API gateway, an integration platform), use that instead. App Builder is a good default for AEM teams without one, not a requirement.

## Pattern 4: import into Content Fragments

Some external data **does** belong in AEM, in a copy. Store details, a product catalogue's marketing attributes, a list of events or locations: data whose system of record is elsewhere, but which authors need to enrich, translate, reference from pages and publish with editorial control.

The pattern is a scheduled or event-driven import that creates or updates Content Fragments, usually through the [AEM Sites OpenAPIs](https://developer.adobe.com/experience-cloud/experience-manager-apis/) from outside AEM, or a Sling Job inside it:

1. The source system remains the system of record for the fields it owns (address, opening hours).
2. The fragment model has separate fields that authors own (description, hero image, promotions).
3. The import updates only source-owned fields, keyed on a stable external ID, and never touches author fields.
4. Publishing follows the normal workflow, so the CDN and Dispatcher cache it like any other content.

**Use it when** the volume is in the thousands, not millions, changes are hourly or slower, and authors genuinely add value. **Don't use it** as a way to get live data into pages. Synchronising prices into the JCR every five minutes is the anti-pattern this whole post is about.

If you use Adobe's guidance for background work, run imports as **Sling Jobs**, which have an at-least-once guarantee, rather than Sling Commons Scheduler tasks, which Adobe advises against because execution isn't guaranteed.

## Pattern 5: commerce through CIF or the edge

Commerce is the most common "outside the JCR" case, and it has its own tooling. The [Commerce Integration Framework (CIF)](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/content-and-commerce/cif-storefront/introduction) connects AEM as a Cloud Service to Adobe Commerce through its GraphQL APIs (third-party platforms need an extra integration layer), so product and category pages render catalogue data without importing it, while authors still build the experience around it.

Check Adobe's current direction before starting a new build, though. Adobe's [content and commerce documentation](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/content-and-commerce/introduction) now points new projects to Edge Delivery Services with the Adobe Commerce Storefront, and suggests existing CIF customers consider moving there to get new commerce features. On Edge Delivery Services, product pages are rendered from commerce or PIM data at the edge or client-side, which I compare in [edge worker vs JSON2HTML]({{ '/blog/2026/10/aem-eds-edge-worker-vs-json2html/' | relative_url }}). Either way, the rule holds: catalogue, price and stock stay in commerce; storytelling stays in AEM; the page combines them.

## Content Fragments or external data?

This is the question I get most often in workshops, so here's the comparison in one place.

| | Content Fragments in AEM | External database or service |
|---|---|---|
| **Best for** | Editorial, structured content authors own | Transactional, high-volume or per-user data |
| **Workflow** | Versions, review, translation, scheduled publish | Whatever you build |
| **Volume** | Thousands to tens of thousands per site comfortably | Effectively unlimited |
| **Writes** | Authors, plus occasional imports | Visitors, systems, APIs |
| **Delivery** | GraphQL persisted queries or delivery APIs, cached at CDN | Your API, your caching |
| **Querying** | By path, model and indexed fields | Whatever the database supports |
| **Personal data** | Avoid | Designed for it, with retention and access controls |
| **Cost of change** | Edit the model in the UI | Schema migration and deploy |

If you find yourself designing Content Fragment Models with fields like `userId`, `submittedAt` or `status: pending`, it's external data wearing a CMS costume.

## Security and operations checklist

Moving data out of the JCR moves responsibilities with it:

- **Secrets** in Cloud Manager secret environment variables (`$[secret:NAME]` in OSGi configuration), or in your API platform's secret store. Never in content or code.
- **Authentication** for visitor-facing APIs: tokens from your identity provider, short-lived, scoped. Don't proxy unauthenticated writes through AEM to a database.
- **Rate limiting and abuse** controls on any endpoint that accepts writes from the public, especially reviews and forms. Add moderation for UGC.
- **Timeouts and fallbacks** so the page renders when the external service is down: hide the reviews, don't fail the page.
- **Data protection**: retention, deletion on request and access logging for personal data, owned by whoever owns the database.
- **Backups and recovery** for the external store, tested. The AEM backup doesn't cover it. See [backup, restore and DR]({{ '/blog/2026/11/database-backup-restore-disaster-recovery/' | relative_url }}).

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| Writing visitor data to the publish repository | Data on one instance only; lost when the instance is recycled | External store shared by all publish instances |
| Trying to rebuild reverse replication with custom code | Fragile, unsupported, author load from visitor traffic | Send the data to an external service |
| Syncing live prices or stock into the JCR | Constant publishing, cache churn, stale data anyway | Fetch live data at render time or client-side |
| Rendering per-user data server-side into cacheable pages | Wrong user's data served from cache, or no caching at all | Client-side fetch for per-user parts |
| Direct JDBC from publish for public, high-volume features | Connection pools multiply with pods; schema coupled to AEM | An HTTP API in front of the database |
| No timeouts on outgoing calls | A slow backend exhausts publish threads | Explicit connect and read timeouts; fallbacks |
| Storing personal data in Content Fragments | Personal data replicated, versioned and backed up with the site | Identity provider and a governed database |
| Import jobs that overwrite author fields | Authors' enrichment lost at every sync | Separate source-owned and author-owned fields |
| Forgetting backups for the new store | The site comes back after an incident; the reviews don't | Treat the external store as production data |

## Closing thought

The question isn't "can the JCR store this?". It can store almost anything for a while. The question is whether the data has the **shape of content**: written by authors, governed, translated, published and read the same way by everyone. If it does, the JCR is a superb home for it, with workflow and caching you'd spend months building elsewhere. If it doesn't, put it in a database designed for its workload, put an API in front of it, and let AEM do what it's good at: compose that data into experiences.

If you're designing interactive features on AEM as a Cloud Service, or untangling a 6.5 implementation that relied on reverse replication, [get in touch](/contact/).

### References

- [AEM as a Cloud Service development guidelines](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/development-guidelines) (Adobe Experience League)
- [Configure advanced networking for AEM as a Cloud Service](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/security/configuring-advanced-networking) (Adobe Experience League)
- [SQL connection using JDBC DataSourcePool](https://experienceleague.adobe.com/en/docs/experience-manager-learn/cloud-service/networking/examples/sql-datasourcepool) (Adobe Experience League)
- [Adobe App Builder overview](https://developer.adobe.com/app-builder/docs/intro_and_overview/) (Adobe Developer)
- [AEM as a Cloud Service APIs](https://developer.adobe.com/experience-cloud/experience-manager-apis/) (Adobe Developer)
- [Introducing the AEM Commerce Integration Framework](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/content-and-commerce/cif-storefront/introduction) (Adobe Experience League)
- [Content and Commerce](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/content-and-commerce/introduction) (Adobe Experience League)
- [Content Fragments](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/content-fragments/content-fragments) (Adobe Experience League)

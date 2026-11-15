---
layout: post
title: "Oak storage explained: TarMK, MongoMK and what AEM as a Cloud Service actually runs on"
seo_title: "Oak Storage: TarMK vs MongoMK vs AEM Cloud Service"
description: "How Apache Oak stores AEM content: Segment/TarMK vs Document Node Store (MongoMK, RDBMK), when MongoMK made sense, compaction, and what changes on AEMaaCS."
ai_summary: "Apache Oak, the repository under AEM, persists content through a node store. The Segment Node Store (TarMK) writes immutable segments into tar files on local disk and is fast, simple and single-writer. The Document Node Store (MongoMK, or RDBMK on a relational database) keeps each node as a document so several AEM instances can share one repository, at the cost of latency, operations and revision garbage collection. This post explains both, Adobe's criteria for choosing MongoMK on-premise, revision cleanup and compaction, data stores for binaries, and what AEM as a Cloud Service changes: Adobe runs the storage and cleanup, and your job becomes keeping the repository lean."
date: 2026-11-13 10:00:00 +0530
category: databases
tags: [AEM, Apache Oak, JCR, MongoDB, AEM as a Cloud Service]
---

"Should we run author on MongoDB?" For years that was one of the first questions in any on-premise AEM sizing workshop. It usually came from someone who had heard that MongoDB "scales" and that tar files sounded old-fashioned. The honest answer was almost always "no", and the reasons say a lot about how AEM really stores content.

Underneath every AEM instance sits **Apache Oak**, the JCR implementation, with two very different storage engines. One writes append-only tar files to local disk. The other turns every node into a document in MongoDB or a relational database. This post explains both as a database person would, then what AEM as a Cloud Service (AEMaaCS) changes: the storage problem becomes Adobe's, and the *content hygiene* problem stays yours.

If you're new to the JCR model itself, start with [JCR explained for SQL developers]({{ '/blog/2026/11/jcr-explained-for-sql-developers/' | relative_url }}). This post goes one layer down.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **Oak separates node storage from binary storage.** A *node store* holds the content tree and revisions; a *data store* holds large binaries.
- **The Segment Node Store (TarMK) is the default** and Adobe's recommendation for most author and all publish instances. Append-only tar files on local disk: fast, simple, single-writer.
- **The Document Node Store (MongoMK or RDBMK) lets several AEM instances share one repository.** You gain horizontal author scaling; you pay in latency and operational effort.
- **MongoMK only made sense for very large authoring loads.** Adobe's criteria mean hundreds of concurrent authors. Publish should never run on it.
- **Both engines create garbage.** TarMK needs revision cleanup and two to three times the repository size in disk; MongoMK needs revision garbage collection.
- **On AEMaaCS you don't choose or operate the node store.** Cleanup is Adobe's job. Yours is purging versions, audit logs and workflows, and not using the JCR as a high-write database.

## The two layers: node store and data store

![Oak's two node stores compared: the Segment Node Store writing tar files to local disk for one instance, the Document Node Store sharing MongoDB or a relational database across a cluster, and how AEM as a Cloud Service splits author and publish]({{ '/assets/img/blog/oak-storage-tarmk-mongomk-aem-cloud-service/01-oak-node-stores.svg' | relative_url }}){: width="1200" height="620" loading="lazy" decoding="async"}

Oak has two persistence concerns, and confusing them is the root of many bad sizing estimates.

| Layer | What it holds | Implementations |
|---|---|---|
| **Node store** | The content tree: nodes, properties, small values, and every revision of them | Segment Node Store (TarMK), Document Node Store (MongoMK, RDBMK) |
| **Data store / blob store** | Large binaries, referenced from the node store by content hash | File data store, Amazon S3 data store, Azure Blob data store, or "inline" in the node store |

When a DAM user uploads a 40 MB image, the binary goes to the data store and the node store gets a small reference. Binaries are identified by their content hash, so uploading the same file twice doesn't double the storage. It also means deleting an asset doesn't immediately free the space: the binary stays until **data store garbage collection** confirms nothing references it any more.

Think of a `BLOB` column moved to object storage, with a sweeper on a schedule. That's why disk usage doesn't drop straight after deleting 10,000 assets.

## The Segment Node Store (TarMK)

TarMK is Oak's default. Adobe's [storage elements documentation](https://experienceleague.adobe.com/en/docs/experience-manager-65/content/implementing/deploying/introduction/storage-elements-in-aem-6) puts it plainly: "By default, AEM 6 uses the Tar storage to store nodes and binaries."

### How it writes

The [Oak segment documentation](https://jackrabbit.apache.org/oak/docs/nodestore/segment/overview.html) describes the design. Content is written as **immutable segments**, which are grouped into **tar files** in `crx-quickstart/repository/segmentstore`. A small journal file records which segment holds the current head of the tree. Nothing is updated in place: a change writes new segments and moves the head.

If you know database internals, this is a log-structured store. That has the usual consequences:

- **Writes are cheap and sequential.** There's no network hop and no row locking. A single TarMK author is fast.
- **Reads are local.** Segments are memory-mapped, and hot content sits in the operating system's page cache. This is why TarMK publish instances serve uncached requests so quickly.
- **Old revisions pile up.** Every save leaves the previous version of changed nodes in older segments. Without cleanup, the store grows forever.
- **One writer.** A segment store belongs to exactly one running Oak instance. You can't point two AEM authors at the same `segmentstore` folder.

### High availability on TarMK

Because one instance owns the store, TarMK availability comes from copying, not sharing:

- **Publish farms.** Each publish instance has its own TarMK repository, kept in sync by replication from author. Adobe's [recommended deployments](https://experienceleague.adobe.com/en/docs/experience-manager-65/content/implementing/deploying/deploying/recommended-deploys) call this a *TarMK farm*: shared-nothing instances that scale linearly and allow rolling updates.
- **Cold standby for author.** A standby instance continuously pulls segments from the primary. Failover isn't automatic; something outside AEM has to detect the failure and start the standby as primary.

For most organisations, a single TarMK author with cold standby, good backups and a tested failover runbook is the right author design. It's boring, and boring is what you want under a CMS. It's configured through `org.apache.jackrabbit.oak.segment.SegmentNodeStoreService`; Adobe's storage page warns that this PID changed in AEM 6.3, so configuration copied from older projects may silently do nothing.

## The Document Node Store (MongoMK and RDBMK)

The Document Node Store solves a different problem: **several Oak instances sharing one repository**. It's described in the [Oak DocumentNodeStore documentation](https://jackrabbit.apache.org/oak/docs/nodestore/documentmk.html).

### How it writes

Each JCR node becomes a document, keyed by depth and path, in a `nodes` collection (or table). Property values carry the revision that wrote them, and revisions include the writing instance's cluster ID. The coordination is the interesting part:

- **Leases.** Each instance renews a lease every ten seconds, set to expire two minutes ahead. If an instance stops renewing, another runs recovery for it; since Oak 1.10, an instance that loses its lease stops accessing the store.
- **Background reads.** Each instance checks the root document for other instances' changes about once a second. A save on author A appears on author B after a short delay: **eventual consistency between cluster members**.
- **Caching.** Every uncached read is a network round trip, so Oak's in-memory and persistent caches matter far more than on TarMK.

### MongoMK versus RDBMK

There are two document store back ends:

| Back end | Store | Notes |
|---|---|---|
| **MongoMK** | MongoDB replica set | The main supported option for AEM author clusters. Start AEM with the `crx3,crx3mongo` run modes and configure `DocumentNodeStoreService` with `mongouri` and `db`. |
| **RDBMK** | Relational database | Oak's [RDBDocumentStore](https://jackrabbit.apache.org/oak/docs/nodestore/document/rdb-document-store.html) is tested against IBM DB2, SQL Server, MySQL (MariaDB), Oracle and PostgreSQL. Adobe's AEM 6.5 support for repository persistence on relational databases is much narrower, mostly "restricted support". |

That gap between what Oak can do and what Adobe supports matters. If you're tempted by RDBMK because "we already have an Oracle team", check the [AEM 6.5 technical requirements](https://experienceleague.adobe.com/en/docs/experience-manager-65/content/implementing/deploying/introduction/technical-requirements) for your exact service pack first. RDBMK is rare enough that you'll be finding problems other customers haven't reported.

## When MongoMK made sense on-premise

Adobe's recommended deployments page is unusually specific. It suggests considering a MongoMK author cluster with two or more active authors when you expect:

- thousands of named users connecting per day,
- hundreds of concurrent users,
- hundreds of thousands of asset ingestions per day,
- hundreds of thousands of page edits per day, or
- tens of thousands of searches per day.

It also says that if you don't expect those numbers in the first 18 months, start on TarMK and re-evaluate. And it says MongoMK isn't recommended for publish at all.

Very few organisations hit those numbers: mostly large DAM operations with continuous bulk ingestion, or global newsrooms.

### The pain points I saw in reviews

| Pain point | Why it happens | What helped |
|---|---|---|
| **Slower than a single TarMK author** | Every cache miss is a network round trip; writes go through MongoDB's replication | Generous Oak caches, persistent cache on fast local disk, AEM and MongoDB in the same data centre with low latency |
| **Two teams, no owner** | AEM team doesn't know MongoDB; DBA team doesn't know Oak's access patterns | A named owner for the whole stack, shared dashboards, joint runbooks |
| **Repository growth** | Revision garbage collection not running or not keeping up | Monitor revision GC, run it during quiet hours, investigate long-running sessions that block it |
| **Lease and clock issues** | Network blips, long GC pauses or clock drift make an instance lose its lease | JVM tuning, NTP everywhere, alerting on lease failures |
| **Licence and version drift** | Adobe certifies specific MongoDB versions per service pack | Pin MongoDB to the certified version; plan upgrades with AEM service packs |

None of these means MongoMK can't work; they mean it costs more to run than the brochure suggested. For most teams that chose it, a well-sized TarMK author would have been faster and cheaper. If you want to see how MongoDB is designed to be used when it's your application's own database, I cover that in [MongoDB schema design for relational developers]({{ '/blog/2026/11/mongodb-schema-design-for-relational-developers/' | relative_url }}).

## Garbage: revision cleanup and compaction

Both node stores keep old revisions, so both need garbage collection. This is the single most common operational gap I find on self-hosted AEM.

### TarMK: revision cleanup

Adobe's [revision cleanup documentation](https://experienceleague.adobe.com/en/docs/experience-manager-65/content/implementing/deploying/deploying/revision-cleanup) is the reference. The essentials:

- **Online revision cleanup is the recommended approach.** It runs by default once a day on author and publish, inside the daily maintenance window.
- **Tail and full compaction.** Since AEM 6.5, *tail* compaction rewrites only the most recent segments and tar files, while *full* compaction rewrites the whole repository. The default runs tail compaction on weekdays and full compaction on Sundays.
- **Generations.** Online cleanup keeps two generations of the repository; offline cleanup keeps one, so offline usually reclaims more space.
- **Disk.** Adobe recommends sizing disk at **two to three times** the estimated repository size, because full compaction temporarily grows the store. Cleanup is cancelled if free disk falls below 25% of the repository's current footprint.

Offline compaction is still useful after a big content clean-up or before a migration. AEM must be stopped, and you run `oak-run`:

```bash
# AEM stopped, backup taken first
# Optional: remove unreferenced checkpoints (Adobe suggests this only above ~100 checkpoints)
java -jar oak-run-1.22.x.jar checkpoints crx-quickstart/repository/segmentstore rm-unreferenced
# Compact
java -Dsun.arch.data.model=32 -jar oak-run-1.22.x.jar compact crx-quickstart/repository/segmentstore
```

The `oak-run` version must match the major and minor version of your instance's Oak core. A mismatched `oak-run` is a reliable way to turn a maintenance window into an incident. Check the Oak version in the Web Console, then download the matching jar.

### MongoMK: revision garbage collection

The Document Node Store doesn't compact files; it deletes old revision data from documents. Oak calls this **revision garbage collection**. Since Oak 1.8 it can run continuously on MongoDB, and it can also be triggered through the `RepositoryManagementMBean` or with `oak-run revisions`. On RDB it isn't scheduled by default, which is one more reason RDBMK needs extra care.

### Data store garbage collection

**Data store garbage collection** removes unreferenced binaries, normally in the weekly maintenance window on AEM 6.5. With a shared data store, every repository using it must take part in the mark phase before anything is swept, or you delete binaries another instance still needs.

### A maintenance calendar that works

For self-hosted AEM 6.5 (including 6.5 LTS), this is the schedule I recommend:

| Task | Frequency | Notes |
|---|---|---|
| Online revision cleanup | Daily, quiet hours | Tail on weekdays, full at the weekend (the default) |
| Data store garbage collection | Weekly | After revision cleanup; never in parallel with online backup |
| Version purge | Weekly or monthly | Keep what your editors and legal team actually need |
| Workflow and audit log purge | Weekly | Completed workflow instances grow faster than anyone expects |
| Offline compaction | Before migrations, after big clean-ups | Planned downtime, matched `oak-run` |

## What AEM as a Cloud Service runs on

On AEMaaCS you don't pick a microkernel, and you can't see the storage. Adobe's [architecture overview](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/overview/architecture) describes it at a high level:

- **Author:** a cluster of author pods sharing **one repository**, which Adobe describes as "a cloud-based instance of a JCR-compliant content repository, implemented by the Apache Oak technology" and "primarily based on blob-based cloud storage".
- **Publish:** a farm of publish instances, "each with their own content repository of published content".
- **Binaries:** uploaded directly to, and served from, a cloud data store.

Adobe doesn't document the node store implementation in detail, and you shouldn't build anything that depends on it. The shape matches what Oak was designed for, though. Community write-ups on Oak's [composite node store](https://experienceleaguecommunities.adobe.com/t5/adobe-experience-manager/exploring-the-sling-feature-model-part-2-composite-nodestore-aem/td-p/373187) describe the author repository as a MongoDB-backed Document Node Store, with `/apps` and `/libs` mounted read-only from a segment store baked into the deployment image. That's the **shared-store pattern behind a clustered author**. Publish, with a repository per instance, is the **shared-nothing farm pattern** that TarMK publish farms always used. Adobe kept the two designs that worked on-premise and took on the operational burden of both.

### What Adobe owns now

On AEMaaCS, Adobe's [maintenance tasks documentation](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/operations/maintenance) says **data store garbage collection is Adobe-owned and not configurable**. Compaction, storage sizing, backups and failover are part of the service too.

### What you still own

What you control is **how much garbage you create**. These are the levers:

- **Version purge and audit log purge** are declared in an `mt.yaml` file and deployed with a config pipeline. Adobe says purging isn't enabled by default yet but will be.
- **Workflow, project and ad hoc task purge** are configured in Git under the maintenance window nodes.
- **What you write to the repository.** Counters, logs, user activity and form submissions written as JCR nodes all create revisions on author, and often on publish too.

A trimmed `mt.yaml` looks like this. Adobe's page lists the full set of audit log types, and every property must be declared because there are no inherited defaults:

```yaml
kind: "MaintenanceTasks"
version: "1"
metadata:
  envTypes: ["dev", "stage", "prod"]
data:
  versionPurge:
    paths: ["/content"]
    maximumAgeDays: 90
    maximumVersions: 10
    minimumVersions: 1
    retainLabelledVersions: false
  auditLogPurge:
    rules:
      - replication:
          maximumAgeDays: 30
          contentPath: "/content"
          types: ["Activate", "Deactivate", "Delete", "Test", "Reverse", "Internal Poll"]
```

Deploy it through the config pipeline described in my [Cloud Manager pipelines post]({{ '/blog/2026/11/aem-cloud-manager-pipelines-quality-gates-rde-config-pipeline/' | relative_url }}). Once it's declared, keep it declared: Adobe notes that removing the file later fails the pipeline.

### Migrating from TarMK or MongoMK

Before the first Content Transfer Tool extraction, I run revision cleanup (or offline compaction), data store garbage collection and a version purge on the source. Smaller repositories extract faster and fail less, and corrupt tar files are a known cause of extraction failures, so a consistency check is worth the time. The wider plan is in my [AEM 6.5 to Cloud Service migration guide]({{ '/blog/2026/11/aem-on-premise-and-managed-services-to-aem-as-a-cloud-service-migration/' | relative_url }}).

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| Choosing MongoMK because "MongoDB scales" | Slower authoring, more infrastructure, two teams to coordinate | Use Adobe's criteria; default to TarMK with cold standby |
| Running publish on MongoMK | Shared store becomes a single point of contention for read traffic | TarMK farm: one repository per publish instance |
| Disabling revision cleanup "because it was slow" | Repository grows until the disk fills, then emergency offline compaction | Keep the daily window, size disk at 2–3×, monitor cleanup results |
| Using a mismatched `oak-run` version | Failed or damaging compaction | Match `oak-run` major and minor version to the instance's Oak core |
| Treating the JCR as a high-write database | Revision churn, bloated repository, slow queries and replication | Move high-write data to a real database (see below) |
| No version purge on AEMaaCS | Version storage grows for years; slower operations and migrations | Declare `versionPurge` in `mt.yaml` and deploy it |

The sixth row deserves its own post, and it has one: [when AEM content belongs outside the JCR]({{ '/blog/2026/11/when-aem-content-belongs-outside-the-jcr/' | relative_url }}).

## What I'd recommend

- **Self-hosted:** TarMK for publish, always; TarMK with cold standby for author unless you meet Adobe's MongoMK criteria. Keep the default cleanup schedule and monitor it.
- **Already on MongoMK and heading to AEMaaCS:** don't switch back to TarMK first. Invest in revision GC monitoring and caching until you move.
- **On AEMaaCS:** focus on hygiene: purges in Git, and the JCR holds content, not transactional data.

## Closing thought

TarMK versus MongoMK was always a database decision dressed up as an AEM decision, and the right answer was usually the simpler one. AEM as a Cloud Service has taken that decision away, which is a good thing, but it hasn't taken away the physics. Every save is a revision, every revision has to be cleaned up, and the cheapest garbage is the garbage you never write.

Next in this series: [JCR queries that don't hurt AEM]({{ '/blog/2026/11/jcr-queries-oak-indexes-aem-performance/' | relative_url }}), which covers the other half of Oak performance.

Cleaning up a repository before migration? [Get in touch](/contact/).

### References

- [Storage elements in AEM 6.5](https://experienceleague.adobe.com/en/docs/experience-manager-65/content/implementing/deploying/introduction/storage-elements-in-aem-6) (Adobe Experience League)
- [Recommended deployments](https://experienceleague.adobe.com/en/docs/experience-manager-65/content/implementing/deploying/deploying/recommended-deploys) (Adobe Experience League)
- [Revision cleanup](https://experienceleague.adobe.com/en/docs/experience-manager-65/content/implementing/deploying/deploying/revision-cleanup) (Adobe Experience League)
- [AEM 6.5 technical requirements](https://experienceleague.adobe.com/en/docs/experience-manager-65/content/implementing/deploying/introduction/technical-requirements) (Adobe Experience League)
- [Introduction to the architecture of AEM as a Cloud Service](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/overview/architecture) (Adobe Experience League)
- [Maintenance tasks in AEM as a Cloud Service](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/operations/maintenance) (Adobe Experience League)
- [Oak Segment Tar overview](https://jackrabbit.apache.org/oak/docs/nodestore/segment/overview.html) (Apache Jackrabbit Oak)
- [Oak DocumentNodeStore](https://jackrabbit.apache.org/oak/docs/nodestore/documentmk.html) (Apache Jackrabbit Oak)
- [RDBDocumentStore](https://jackrabbit.apache.org/oak/docs/nodestore/document/rdb-document-store.html) (Apache Jackrabbit Oak)

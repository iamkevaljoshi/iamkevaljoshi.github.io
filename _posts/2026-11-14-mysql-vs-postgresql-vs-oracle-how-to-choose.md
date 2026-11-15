---
layout: post
title: "MySQL vs PostgreSQL vs Oracle in 2026: how to choose, and when Oracle is still worth it"
seo_title: "MySQL vs PostgreSQL vs Oracle in 2026: How to Choose"
description: "MySQL vs PostgreSQL vs Oracle in 2026: licensing and cost, features, operations, managed cloud options, and when Oracle is still worth paying for."
ai_summary: "MySQL, PostgreSQL and Oracle are all mature relational databases, so the choice in 2026 is about cost, features, operations and team skills rather than raw capability. PostgreSQL is the default for new systems thanks to its permissive licence, extension ecosystem (PostGIS, pgvector), strong SQL and transactional DDL. MySQL remains a good fit for simple, read-heavy web workloads and teams that already run it, with 8.4 and 9.7 as the LTS lines after 8.0 reached end of life. Oracle is still justified for RAC, Active Data Guard, heavy PL/SQL estates and certified vendor applications, but per-processor licensing and paid options make it the most expensive choice, especially in public cloud."
date: 2026-11-14 09:00:00 +0530
category: databases
tags: [PostgreSQL, MySQL, Oracle Database, Database Architecture, Cloud]
---

"Which database should we use?" sounds like a technical question. In most architecture reviews I sit in, it turns out to be a commercial question, an operations question and a hiring question wearing a technical costume. All three of the big relational engines (MySQL, PostgreSQL and Oracle Database) can store your orders, run your joins and survive a server failure. The differences that matter in 2026 are what each costs you over five years, what your team can actually operate at 2 a.m., and which features you'd otherwise have to build yourself.

This is the comparison I use when a client asks me to pick one for a new system, or to justify keeping the one they already have. I work mostly on AEM platforms, where the relational database usually sits beside the content repository rather than inside it, but I've designed, tuned and migrated all three engines, and I'll be direct about where each one wins.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **PostgreSQL is my default for new systems.** Permissive licence, the richest SQL and extension ecosystem (PostGIS, pgvector, partitioning, JSONB), transactional DDL and excellent managed options on every cloud.
- **MySQL is still a sound choice** for simple, read-heavy web workloads and for teams that already run it well. Plan your upgrades: 8.0 reached end of life in April 2026, and the long-term support lines are now **8.4** and **9.7**.
- **Oracle is justified by specific features, not by habit:** Real Application Clusters, Active Data Guard, a large PL/SQL estate, or a vendor application that is only certified on Oracle. If none of those apply, you're paying for an insurance policy you won't claim.
- **Cost is dominated by licensing and people, not hardware.** Oracle Enterprise Edition plus options is a different order of magnitude from either open-source engine, and public-cloud vCPU counting makes it worse.
- **Managed services change the operations story.** RDS, Aurora, Cloud SQL, AlloyDB and Azure flexible server remove most of the patching and backup toil for Postgres and MySQL. Oracle's best-managed options sit on Oracle's own cloud or Oracle hardware inside the hyperscalers.
- **Don't choose on benchmarks.** At typical enterprise scale, schema design, indexing and connection management matter far more than the engine.

## The short version, in one table

| Dimension | MySQL | PostgreSQL | Oracle Database |
|---|---|---|---|
| Licence | GPLv2 Community; commercial Enterprise Edition | [PostgreSQL Licence](https://www.postgresql.org/about/licence/) (permissive, BSD-style) | Commercial, per processor or named user; SE2 and EE |
| Current releases (Nov 2026) | 8.4 LTS, 9.7 LTS; calendar-versioned innovation releases | 18 stable; 19 scheduled for release this month | AI Database 26ai (long-term release replacing 23ai) |
| SQL depth | Good since 8.0 (CTEs, window functions, CHECK) | Excellent; standards-leaning, rich types | Excellent; decades of proprietary extensions |
| Procedural code | Stored procedures, limited | PL/pgSQL plus other languages | PL/SQL, packages, the most mature |
| Extensibility | Storage engines, plugins | Extensions are the killer feature | Options and packs (paid) |
| Default isolation | Repeatable Read (InnoDB) | Read Committed | Read Committed |
| Transactional DDL | No (DDL is atomic, but commits implicitly) | Yes | No |
| High availability | Group Replication, InnoDB Cluster, managed failover | Streaming replication, Patroni, managed failover | Data Guard; RAC for active-active |
| Typical cost profile | Low | Low | High, plus options and support |
| Hiring market | Large | Large and growing | Specialist, expensive |

The rest of this post explains why each row matters.

## Licensing and cost: where the decision is usually made

### PostgreSQL

PostgreSQL ships under the PostgreSQL Licence, a short permissive licence similar to BSD or MIT. You can run it anywhere, embed it, fork it and sell products built on it with no copyleft obligations. There's no "enterprise edition" held back by the project. Commercial vendors (EDB, Crunchy Data, the cloud providers) sell support, tooling and managed services around it, and some sell proprietary forks, but the database you download is the whole database.

### MySQL

MySQL Community Server is GPLv2. For internal use and for SaaS that's rarely an issue. It becomes one if you **distribute** software that embeds MySQL, which is why Oracle sells a commercial licence. Oracle also keeps some features in **MySQL Enterprise Edition** (thread pool, audit, firewall, enterprise backup, and in 9.7, dynamic data masking). With the [9.7 LTS release in April 2026](https://blogs.oracle.com/mysql/mysql-9-7-0-lts-is-now-available-expanded-community-capabilities-and-dynamic-data-masking-for-enterprise), Oracle moved several capabilities into Community, so check the current split rather than relying on what you knew in the 5.7 days.

### Oracle Database

Oracle is licensed per **processor** or per **named user plus**, with two main editions:

- **Standard Edition 2 (SE2):** limited to servers with at most two sockets, and each database can use at most 16 CPU threads. No RAC since 19c, and most enterprise options aren't available.
- **Enterprise Edition (EE):** licensed per processor after applying Oracle's core factor, plus **paid options** on top: Partitioning, Real Application Clusters, Active Data Guard, Advanced Security, Advanced Compression, and the Diagnostics and Tuning Packs that most DBAs assume are free because the screens are there in Enterprise Manager.

Annual support is typically around 22% of the licence price, every year, and it rises over time. In licence audits, the expensive surprise is rarely the core licence. It's an option someone used once, such as a partitioned table or an AWR report, which then counts as usage.

Public cloud makes this sharper. Under Oracle's [cloud licensing policy](https://www.oracle.com/a/ocom/docs/cloud-licensing.pdf), on AWS, Azure and Google Cloud two vCPUs count as one processor licence when multithreading is enabled, and the on-premises core factor doesn't apply. The same workload can need noticeably more licences on a hyperscaler than on an Intel server in your own data centre. Oracle Cloud Infrastructure and the Oracle Database@AWS, @Azure and @Google Cloud offerings are priced to make that comparison favour staying with Oracle.

### What it really costs

Licence lines are only the start. Over five years I look at:

| Cost line | MySQL / PostgreSQL | Oracle |
|---|---|---|
| Software licence | None (or optional vendor support) | Processor or NUP licences, plus options |
| Annual support | Optional | Mandatory to receive patches, about 22% a year |
| Managed service premium | Moderate | High, or licence-included pricing |
| DBA skills | Widely available | Specialist, priced accordingly |
| Audit risk | None | Real; budget for licence management |
| Exit cost | Low | High: PL/SQL, proprietary SQL, tooling |

I covered the same "the licence is the small part" argument for AEM in [the real cost of AEM]({{ '/blog/2026/11/real-cost-of-aem-licences-hosting-build-and-run/' | relative_url }}). The pattern holds for databases: people and lock-in dominate.

## Features that actually change designs

All three engines do joins, foreign keys, triggers, views, window functions and JSON. The differences that change a design are narrower than vendor comparison pages suggest.

### Where PostgreSQL pulls ahead

- **Extensions.** [PostGIS](https://postgis.net/) for geospatial, [pgvector](https://github.com/pgvector/pgvector) for embeddings, `pg_partman` for partition management, `pg_stat_statements` for query analysis, TimescaleDB for time series. One engine can cover workloads that would otherwise need three products. I compare pgvector with dedicated vector stores in the [vector search post]({{ '/blog/2026/11/vector-search-pgvector-vs-mongodb-atlas-vs-vector-database/' | relative_url }}).
- **Rich indexing.** Partial, expression, covering (`INCLUDE`), GIN, GiST, BRIN, and since PostgreSQL 18, B-tree skip scan. I go through these in the [indexing post]({{ '/blog/2026/11/database-indexing-postgresql-mysql-oracle-mongodb-oak/' | relative_url }}).
- **JSONB with real indexing.** Good enough that many teams don't need a separate document database. See [Postgres JSONB vs MongoDB]({{ '/blog/2026/11/postgres-jsonb-vs-mongodb/' | relative_url }}).
- **Transactional DDL.** `CREATE TABLE`, `ALTER TABLE` and index changes can be rolled back with the rest of a migration. If a Flyway or Liquibase script fails half-way, you don't end up with a half-migrated schema.
- **Steady release cadence.** One major release a year. [PostgreSQL 18](https://www.postgresql.org/about/news/postgresql-18-released-3142/) (September 2025) added an asynchronous I/O subsystem, `uuidv7()`, virtual generated columns by default and OAuth authentication. PostgreSQL 19 is in release candidate and scheduled for general availability later this month.

The weak spots are real too. MVCC leaves dead row versions in the table, so **vacuum** needs monitoring and tuning. Each connection is an operating system process, so you need a **connection pooler** such as PgBouncer at scale (my [connection pooling post]({{ '/blog/2026/11/database-connection-pooling-hikaricp-pgbouncer/' | relative_url }}) covers sizing). There are no optimizer hints in core, which frustrates DBAs coming from Oracle.

### Where MySQL holds its own

- **Simplicity at the read-heavy end.** Primary-key lookups through InnoDB's clustered index are fast and predictable. For a catalogue, a session store or a classic LAMP-style application, MySQL is easy to run and easy to hire for.
- **Replication and scale-out tooling.** Asynchronous and semi-synchronous replication, Group Replication and InnoDB Cluster are mature, and [Vitess](https://vitess.io/) gives you horizontal sharding that some of the largest web platforms run on.
- **Thread-per-connection is lighter** than Postgres's process-per-connection, so very high connection counts hurt less (though you still want a pool).

The gaps: DDL isn't transactional (each DDL statement commits implicitly), there are no partial indexes, and the extension ecosystem is thin by comparison. The default **Repeatable Read** isolation behaves differently from what most developers expect, which I unpack in the [transactions and isolation post]({{ '/blog/2026/11/transactions-isolation-levels-mvcc-in-practice/' | relative_url }}).

The version picture also needs attention. MySQL 8.0 reached end of life in April 2026. The supported long-term lines are 8.4 and 9.7, and Oracle has moved later innovation releases to calendar versions. If you're on 8.0 on a managed service, check whether you're now paying extended-support fees.

### Where Oracle is still ahead

- **Real Application Clusters (RAC):** several instances serving one database, active-active, with shared storage. Nothing in open-source Postgres or MySQL is a drop-in equivalent.
- **Active Data Guard:** physical standbys open read-only, with automatic block repair and well-understood switchover and failover, operated by tooling that has existed for two decades.
- **The optimizer and its tooling:** SQL Plan Management, adaptive plans, the AWR and ASH performance repositories, SQL Monitor. When a plan changes overnight, Oracle gives you more ways to see why and pin it back.
- **PL/SQL and packages:** package state, autonomous transactions and a vast built-in library. For a team with hundreds of thousands of lines of PL/SQL, this alone can decide the question.
- **Converged features:** Oracle pitches [AI Database 26ai](https://www.oracle.com/database/ai-native-database-26ai/), the long-term release replacing 23ai, as one engine for relational, JSON, graph, spatial and vector search.

## Operations: what your team will live with

| Task | MySQL | PostgreSQL | Oracle |
|---|---|---|---|
| Major upgrades | In-place within LTS lines; test carefully between them | `pg_upgrade` or logical replication; yearly cadence | Release updates quarterly; upgrades are projects |
| Housekeeping | Purge of undo history; watch long transactions | Vacuum and autovacuum tuning; bloat | Undo retention, statistics jobs, space management |
| Connection handling | Threads; pool anyway | Processes; PgBouncer or a managed pooler | Dedicated or shared server; connection pools |
| Backup and PITR | Binlog-based; XtraBackup or MySQL Enterprise Backup | WAL archiving; pgBackRest, Barman | RMAN, mature and comprehensive |
| HA | Group Replication, InnoDB Cluster, Orchestrator | Patroni, repmgr, managed | Data Guard, RAC |
| Observability | Performance Schema, sys schema | `pg_stat_*` views, `pg_stat_statements` | AWR, ASH (Diagnostics Pack licence) |

Backup and restore deserves its own post, and it has one: [backup, restore and disaster recovery]({{ '/blog/2026/11/database-backup-restore-disaster-recovery/' | relative_url }}).

### Managed cloud options

Most new systems I design run on a managed service, and that changes the operations comparison a lot.

| Cloud | PostgreSQL | MySQL | Oracle |
|---|---|---|---|
| AWS | RDS for PostgreSQL, Aurora PostgreSQL | RDS for MySQL, Aurora MySQL | RDS for Oracle (BYOL or licence included for SE2), Oracle Database@AWS |
| Azure | Azure Database for PostgreSQL flexible server | Azure Database for MySQL flexible server | Oracle Database@Azure |
| Google Cloud | Cloud SQL, AlloyDB | Cloud SQL | Oracle Database@Google Cloud |
| Oracle Cloud | OCI Database with PostgreSQL | HeatWave MySQL | Autonomous Database, Exadata Database Service |

For Postgres and MySQL, managed services take away patching, backups, failover and much of the monitoring. What remains is schema design, query tuning, connection management and cost control, which is where the real work was anyway. For Oracle, the most capable managed options are Oracle's own, Autonomous Database and Exadata, in OCI or inside a hyperscaler through the Database@ partnerships. That keeps your database strategy tied to your Oracle commercial relationship.

## Where AEM fits in

On AEM as a Cloud Service you don't pick the repository's database: Adobe runs Oak on its own storage, as I explain in the [Oak storage post]({{ '/blog/2026/11/oak-storage-tarmk-mongomk-aem-cloud-service/' | relative_url }}). The relational database question comes up **beside** AEM: form submissions, user-generated content, product data, loyalty points, anything high-write or transactional that shouldn't live in the JCR. I go through those patterns in [when AEM content belongs outside the JCR]({{ '/blog/2026/11/when-aem-content-belongs-outside-the-jcr/' | relative_url }}).

For those side databases my advice is nearly always PostgreSQL on the same cloud as the rest of your integration layer, fronted by an API (often App Builder or a small service), rather than AEM talking to the database directly. If AEM must connect over JDBC, Adobe's [JDBC DataSourcePool guide](https://experienceleague.adobe.com/en/docs/experience-manager-learn/cloud-service/networking/examples/sql-datasourcepool) shows the pattern: a `com.day.commons.datasource.jdbcpool.JdbcPoolService` factory configuration, the driver embedded as an OSGi bundle, and traffic routed through advanced networking port forwarding to `AEM_PROXY_HOST`. All three engines work there. The choice of engine matters far less than keeping transactional load away from the publish tier.

## Scenarios and what I'd recommend

| Scenario | My recommendation | Why |
|---|---|---|
| New product or service, no legacy constraints | PostgreSQL, managed | Lowest lock-in, richest features, easy hiring |
| Read-heavy web application, team already runs MySQL well | MySQL 8.4 or 9.7 LTS, managed | Switching engines buys little; upgrade off 8.0 |
| Geospatial, vector search or mixed relational/JSON | PostgreSQL | PostGIS, pgvector and JSONB in one engine |
| Packaged ERP or banking product certified only on Oracle | Oracle | Support contracts depend on certification |
| Large PL/SQL estate with no budget to rewrite it | Oracle for now; plan a migration assessment | Rewriting PL/SQL is the biggest cost of leaving |
| Need active-active on one database with near-zero RTO | Oracle RAC, or redesign for distributed Postgres | RAC is unique; the alternatives change your architecture |
| Sidecar store for AEM (forms, UGC, commerce data) | PostgreSQL behind an API | Keeps AEM stateless and the data portable |
| Massive horizontal scale on simple access patterns | MySQL with Vitess, or a distributed SQL engine | Proven sharding; or see the [SQL vs NoSQL post]({{ '/blog/2026/11/sql-vs-nosql-is-the-wrong-question/' | relative_url }}) |

### When Oracle is still worth it

I'm not anti-Oracle. I'm anti-default. Oracle earns its price when at least one of these is true:

1. **You use RAC or Active Data Guard for a real availability requirement**, signed off by the business, and you have the DBAs to run them.
2. **The application is certified only on Oracle**, and running it elsewhere voids vendor support.
3. **You have a large, valuable PL/SQL codebase**, and the cost and risk of rewriting it exceed several years of licences.
4. **You already own perpetual licences** with support you'd keep paying anyway, and the workload fits within them without new options.

If none of those apply, the honest answer is usually PostgreSQL. If you're in the third group and want to know what leaving looks like, my [Oracle to PostgreSQL migration guide]({{ '/blog/2026/11/migrating-oracle-to-postgresql/' | relative_url }}) covers the assessment, the tools and the gotchas.

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| Choosing on a vendor benchmark | Wrong engine for your access patterns; the bottleneck turns out to be the schema | Prototype your top five queries on realistic data |
| Assuming Oracle Diagnostics and Tuning Packs are included | Audit finding for AWR or SQL Tuning Advisor usage | Set `CONTROL_MANAGEMENT_PACK_ACCESS` to match your licences |
| Moving Oracle to a hyperscaler without recounting licences | Licence requirement goes up under vCPU rules | Model licences against Oracle's cloud policy before migrating |
| Staying on MySQL 8.0 | No community fixes; extended-support fees on managed services | Upgrade to 8.4 or 9.7 LTS, test in staging first |
| Running PostgreSQL without vacuum monitoring | Table bloat, slow queries, in the worst case transaction ID wraparound | Monitor dead tuples and oldest transaction age; tune autovacuum |
| Opening a Postgres connection per request at scale | Memory pressure, `too many connections` | PgBouncer or a managed pooler; size the app pool properly |
| Treating MariaDB as MySQL | Replication, JSON and optimizer differences surprise you | Pick one and test against it |
| Using database-specific features without noting the lock-in | Exit cost grows quietly | Record each proprietary feature as an architecture decision |
| Letting AEM publish write directly to a database | Load and outages couple to the publish tier | Put an API between AEM and the database |

## Closing thought

In 2026 there's no bad choice among these three, only expensive ones and unexamined ones. PostgreSQL is where I start, MySQL is where I stay if a team already runs it well, and Oracle is what I recommend when a specific feature or a certification makes its cost worth paying. Write down why you chose, including what would make you change your mind, and revisit it at every licence renewal.

If you're weighing a database decision alongside an AEM programme, or trying to work out whether an Oracle renewal is worth signing, [get in touch](/contact/).

### References

- [PostgreSQL Licence](https://www.postgresql.org/about/licence/) (PostgreSQL Global Development Group)
- [PostgreSQL 18 released](https://www.postgresql.org/about/news/postgresql-18-released-3142/) (PostgreSQL Global Development Group)
- [MySQL 9.7.0 LTS is now available](https://blogs.oracle.com/mysql/mysql-9-7-0-lts-is-now-available-expanded-community-capabilities-and-dynamic-data-masking-for-enterprise) (Oracle MySQL blog)
- [MySQL release model](https://dev.mysql.com/doc/refman/9.7/en/mysql-releases.html) (MySQL Reference Manual)
- [Oracle AI Database 26ai](https://www.oracle.com/database/ai-native-database-26ai/) (Oracle)
- [Licensing Oracle Software in the Cloud Computing Environment](https://www.oracle.com/a/ocom/docs/cloud-licensing.pdf) (Oracle)
- [SQL connections using JDBC DataSourcePool](https://experienceleague.adobe.com/en/docs/experience-manager-learn/cloud-service/networking/examples/sql-datasourcepool) (Adobe Experience League)

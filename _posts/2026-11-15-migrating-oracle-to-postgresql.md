---
layout: post
title: "Migrating Oracle to PostgreSQL: assessment, tools, the gotchas that bite and a safe cutover"
seo_title: "Migrating Oracle to PostgreSQL: Tools, Gotchas, Cutover"
description: "Oracle to PostgreSQL migration in practice: assessment, ora2pg and cloud tools, NULL, NUMBER, DATE and PL/SQL gotchas, data validation, testing and cutover."
ai_summary: "Oracle to PostgreSQL migrations succeed or fail on assessment and testing, not on the schema converter. Start with an inventory and an ora2pg SHOW_REPORT cost estimate, then choose tools: ora2pg for open-source conversion and data export, AWS DMS Schema Conversion or Google Database Migration Service conversion workspaces for managed targets, and AWS DMS, GoldenGate or Debezium for change data capture. The gotchas that cause most defects are empty strings becoming NULL in Oracle, NUMBER mapping, DATE holding time, sequences, PL/SQL packages and autonomous transactions, statement versus transaction rollback, identifier case and optimizer hints. Validate data with counts and checksums, replay real workloads, and cut over with CDC, a rehearsed runbook and a rollback path."
date: 2026-11-15 09:00:00 +0530
category: databases
tags: [Oracle Database, PostgreSQL, Database Migration, ora2pg, Cloud]
---

The schema converter reports 92% automatic conversion, the project plan allocates two sprints to "fix the rest", and six months later the team is still chasing defects where a report total is off by a few rows. I've seen versions of this in more than one programme. The converted DDL compiled. The problem was that Oracle and PostgreSQL disagree on what an empty string is, what a `DATE` holds and what happens to a transaction when one statement fails, and none of that shows up as a conversion warning.

Oracle to PostgreSQL is one of the migrations I'm asked about most, usually triggered by a licence renewal or a cloud move. It's very achievable, but it's more an application migration than a database one. This is the approach I'd use: assess properly, pick tools for the right jobs, know the gotchas, test the data and behaviour, and cut over with a way back.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **Decide whether to migrate before deciding how.** RAC, Active Data Guard, a certified vendor application or a huge PL/SQL estate can each make staying on Oracle the right call. My [MySQL vs PostgreSQL vs Oracle post]({{ '/blog/2026/11/mysql-vs-postgresql-vs-oracle-how-to-choose/' | relative_url }}) covers that decision.
- **Assess with evidence.** Run `ora2pg -t SHOW_REPORT --estimate_cost`, inventory application SQL (not just database objects) and list the Oracle features in use: packages, DB links, Scheduler, AQ, `UTL_*` and `DBMS_*` calls.
- **Use tools for what they're good at.** ora2pg, AWS DMS Schema Conversion or Google's conversion workspaces convert schema and code; AWS DMS, GoldenGate or Debezium move data with change data capture. None of them finishes the job.
- **The defects come from semantics, not syntax:** `''` is `NULL` in Oracle, `NUMBER` mapping, `DATE` with time, sequences after load, packages and autonomous transactions, statement-level versus transaction-level rollback, upper-case identifiers and optimizer hints.
- **Validate data mechanically** with row counts and per-table checksums, then replay real queries and compare results and timings.
- **Cut over with CDC and a rehearsed runbook.** Rehearse at least twice, reset sequences, keep a reverse replication or a clear rollback window, and define go and no-go criteria before the night.

## Should you migrate at all?

The usual drivers are licence and support cost, cloud strategy (Oracle's vCPU licensing on hyperscalers is unfavourable) and hiring. The usual blockers are:

| Blocker | Why it matters |
|---|---|
| A packaged application certified only on Oracle | You lose vendor support; this is usually decisive |
| RAC with a genuine active-active requirement | Postgres has no drop-in equivalent; the architecture has to change |
| Hundreds of thousands of lines of PL/SQL | Conversion and testing cost can exceed years of licences |
| Heavy use of Oracle-only features | Spatial, Text, AQ, Advanced Replication and others need replacements |
| No test automation | You can't prove the migrated system behaves the same |

If two or more apply, do a time-boxed assessment before promising anything.

## Assessment: what to measure

### Database objects

ora2pg's assessment report is the fastest way to size the work. It inventories objects, estimates conversion effort per object type and gives an overall migration level:

```bash
ora2pg -c ora2pg.conf -t SHOW_REPORT --estimate_cost --dump_as_html > assessment.html
```

Treat the cost estimate as a relative measure, not a quote: it's good at showing which schemas hide a few huge packages. The [ora2pg documentation](https://ora2pg.darold.net/documentation.html) explains the levels and cost units.

### What the report doesn't see

The database is only half the code. I always add:

- **Application SQL.** Native queries in Java, .NET or Python, MyBatis mappers, reports, ETL jobs and BI tools. Search for `ROWNUM`, `NVL`, `DECODE`, `(+)`, `CONNECT BY`, `SYSDATE`, `DUAL`, `.NEXTVAL` and `/*+` hints.
- **Oracle-specific packages** called from code: `DBMS_SCHEDULER`, `DBMS_LOB`, `UTL_FILE`, `UTL_HTTP`, `UTL_MAIL`, `DBMS_AQ`, `DBMS_CRYPTO`.
- **Database links** and anything that queries another Oracle database.
- **Consumers you don't own:** reporting tools, data warehouse loads, downstream extracts and integrations (including AEM, which I come back to below).
- **Data volume, LOB volume and change rate.** These decide whether an offline load fits in your downtime window or you need CDC.
- **Non-functional requirements:** RPO, RTO, peak throughput, and the top SQL by elapsed time from AWR, so you have a performance baseline to compare against.

### Choosing the target

Decide early between self-managed PostgreSQL, a managed service (Amazon RDS or Aurora PostgreSQL, Azure Database for PostgreSQL flexible server, Cloud SQL or AlloyDB) or a commercial Oracle-compatible distribution. The target decides which extensions, CDC options and tooling you get, so check that anything you'll rely on, such as [orafce](https://github.com/orafce/orafce) or `pg_hint_plan`, is supported there.

## The tools and what each is good for

| Tool | Converts schema and code | Moves data | CDC | Notes |
|---|---|---|---|---|
| [ora2pg](https://ora2pg.darold.net/) | Yes | Yes, offline, parallel | No | Open source, mature, highly configurable; also does assessment and data tests |
| [AWS DMS Schema Conversion](https://docs.aws.amazon.com/dms/latest/userguide/schema-conversion-oracle-postgresql.html) | Yes | No (use DMS tasks) | No | Managed, for RDS and Aurora PostgreSQL targets; optional [generative AI conversion](https://docs.aws.amazon.com/dms/latest/userguide/schema-conversion-convert.databaseobjects.html) |
| AWS Schema Conversion Tool (SCT) | Yes | Via extraction agents | No | The desktop tool; AWS positions DMS Schema Conversion as the managed, no-install alternative |
| AWS DMS replication tasks | No | Yes | Yes | Full load plus ongoing replication; watch LOB settings |
| [Google Database Migration Service](https://docs.cloud.google.com/database-migration/docs/oracle-to-alloydb/about-conversion-ws) | Yes, conversion workspaces | Yes | Yes | Oracle to Cloud SQL or AlloyDB; optional Gemini-assisted conversion |
| Oracle GoldenGate | No | Yes | Yes | Supports PostgreSQL targets; licensed separately |
| Debezium (Oracle connector) | No | Via Kafka | Yes | Open source CDC via LogMiner; you build the sink and the operations |

AI-assisted conversion is now built into the cloud tools. It helps with the long tail of procedural code, but it moves the work from "rewrite" to "review": every converted procedure still needs a reviewer who knows both dialects and a test that proves it behaves the same.

For ora2pg, a typical flow is export, fix, load, then test:

```bash
# Generate a migration project skeleton
ora2pg --project_base /migration --init_project hr_app

# Export schema objects (the project scripts call ora2pg per type)
ora2pg -c config/ora2pg.conf -t TABLE     -o tables.sql
ora2pg -c config/ora2pg.conf -t SEQUENCE  -o sequences.sql
ora2pg -c config/ora2pg.conf -t PACKAGE   -o packages.sql

# After loading data, compare row counts and data between source and target
ora2pg -c config/ora2pg.conf -t TEST
ora2pg -c config/ora2pg.conf -t TEST_DATA
```

## The gotchas that cause most defects

### 1. Empty string is NULL in Oracle

In Oracle, `''` is `NULL`. In PostgreSQL, `''` is an empty string, and it's not `NULL`. This breaks code in several quiet ways:

```sql
-- Oracle: returns rows where middle_name was set to ''
-- PostgreSQL: does not
SELECT * FROM person WHERE middle_name IS NULL;

-- Oracle: 'Smith' || NULL = 'Smith'
-- PostgreSQL: 'Smith' || NULL = NULL
SELECT first_name || ' ' || middle_name || ' ' || last_name FROM person;

-- Portable alternative: concat() ignores NULLs in PostgreSQL
SELECT concat_ws(' ', first_name, middle_name, last_name) FROM person;
```

Decide a policy early: convert empty strings to `NULL` during data load (my usual choice, because it matches existing application expectations), or keep them and fix every comparison. ora2pg's `NULL_EQUAL_EMPTY` directive can rewrite `IS NULL` tests with `coalesce()` to mimic Oracle, but I'd rather clean the data than carry an emulation forever.

### 2. NUMBER mapping

Oracle's `NUMBER` covers everything from flags to money. Map it deliberately:

| Oracle | PostgreSQL | Notes |
|---|---|---|
| `NUMBER(1)` used as a flag | `boolean` or `smallint` | Changing to `boolean` means changing application code |
| `NUMBER(p)` with p ≤ 9 / ≤ 18 | `integer` / `bigint` | Much faster than `numeric` for keys and joins |
| `NUMBER(p,s)` | `numeric(p,s)` | Never `real` or `double` for money |
| `NUMBER` (no precision) | `numeric`, or `bigint` if it only holds integers | Profile the data before choosing |

ora2pg's `PG_INTEGER_TYPE` and `DEFAULT_NUMERIC` settings control this. The trap is primary and foreign keys landing as unconstrained `numeric`: everything works, joins are slower, and ORMs map the columns to `BigDecimal`.

### 3. DATE holds a time

An Oracle `DATE` stores date and time to the second. A PostgreSQL `date` stores only the date. Map Oracle `DATE` to `timestamp(0)` unless you've proved the column never holds a time. Then fix the functions:

| Oracle | PostgreSQL |
|---|---|
| `SYSDATE` | `LOCALTIMESTAMP(0)` or `clock_timestamp()` (note `now()` is the transaction start time) |
| `date_col + 1` | `date_col + interval '1 day'` |
| `TRUNC(date_col)` | `date_trunc('day', date_col)` |
| `TO_DATE('2026-11-15 10:30', 'YYYY-MM-DD HH24:MI')` | `to_timestamp(...)`; `to_date` drops the time |
| `ADD_MONTHS(d, 3)` | `d + interval '3 months'` |
| `MONTHS_BETWEEN` | `age()` and `extract`, or orafce |

Decide time zones at the same time. Oracle estates often store local time in `DATE` columns; `timestamptz` is usually the better target, but converting needs a clear rule about which zone the old values were in.

### 4. Sequences and identity

`seq.NEXTVAL` becomes `nextval('seq')`, and triggers that populate keys from sequences can often be replaced with identity columns. The cutover gotcha is that **sequences must be reset after the data load**, or the first insert in production fails with a duplicate key:

```sql
SELECT setval('orders_id_seq', (SELECT max(id) FROM orders));
```

Script this for every sequence, and run it again after the final CDC sync.

### 5. PL/SQL to PL/pgSQL

PL/pgSQL is close enough to PL/SQL to look easy and different enough to make it expensive. The main differences:

| PL/SQL feature | PostgreSQL approach |
|---|---|
| Packages | No packages: one schema per package, with functions inside |
| Package variables and state | Session settings (`set_config` / `current_setting`), temporary tables, or move state to the application |
| Autonomous transactions (logging) | No native support: `dblink` or `pg_background`, or log from the application |
| `BULK COLLECT` / `FORALL` | Usually rewrite as set-based SQL, which is faster anyway |
| `DBMS_OUTPUT.PUT_LINE` | `RAISE NOTICE` |
| `EXCEPTION WHEN OTHERS` with `SQLCODE` | `WHEN OTHERS` with `SQLSTATE` and `SQLERRM` |
| Procedures that `COMMIT` | Supported in procedures (PostgreSQL 11+), not in functions |
| `DBMS_SCHEDULER` jobs | `pg_cron` or an external scheduler |
| `UTL_HTTP`, `UTL_FILE`, `UTL_MAIL` | Move to the application or an integration service |

My strong recommendation: use the migration to move logic that doesn't belong in the database (HTTP calls, files, email, scheduling) into application services, and convert only what's genuinely data logic.

### 6. A failed statement aborts the whole transaction

This one catches Java teams. In Oracle, a failed statement is rolled back and the transaction carries on. In PostgreSQL, any error puts the transaction into an aborted state, and every following statement fails until you roll back:

```text
ERROR:  current transaction is aborted, commands ignored until end of transaction block
```

Code that catches a duplicate-key exception and carries on in the same transaction will break. Use explicit savepoints or `INSERT ... ON CONFLICT`. The PostgreSQL JDBC driver's `autosave=conservative` setting adds savepoints automatically, at a performance cost: a bridge, not a destination. Transaction behaviour differs in other ways too, which I cover in [transactions, isolation levels and MVCC]({{ '/blog/2026/11/transactions-isolation-levels-mvcc-in-practice/' | relative_url }}).

### 7. Identifier case

Oracle folds unquoted identifiers to upper case; PostgreSQL folds them to lower case. If the tools keep Oracle's upper-case names as quoted identifiers, every query has to quote them forever. Convert to lower case (ora2pg does by default) and fix any application code that quotes names.

### 8. Hints and plans

PostgreSQL ignores Oracle hints (`/*+ INDEX(...) */`), and core PostgreSQL has no hint system. The `pg_hint_plan` extension exists, but I treat hints as a last resort. Most hinted Oracle queries perform well on PostgreSQL with correct indexes and fresh statistics. The ones that don't are your performance test cases. My [query plans post]({{ '/blog/2026/11/reading-query-plans-postgresql-mysql-oracle-mongodb/' | relative_url }}) covers reading `EXPLAIN ANALYZE` next to `DBMS_XPLAN`.

### Smaller syntax differences

| Oracle | PostgreSQL |
|---|---|
| `ROWNUM <= 10` | `LIMIT 10` or `FETCH FIRST 10 ROWS ONLY` |
| `NVL(a, b)` | `COALESCE(a, b)` |
| `DECODE(x, 1, 'a', 'b')` | `CASE x WHEN 1 THEN 'a' ELSE 'b' END` |
| `a.id = b.id(+)` | `LEFT JOIN` |
| `CONNECT BY PRIOR` | `WITH RECURSIVE` |
| `SELECT 1 FROM DUAL` | `SELECT 1` |
| `MINUS` | `EXCEPT` |
| `VARCHAR2(100 BYTE)` | `varchar(100)` (characters, not bytes) |
| `CLOB` / `BLOB` / `RAW` | `text` / `bytea` / `bytea` |

The orafce extension provides many Oracle functions and a `dual` table. I use it for date and string functions with no clean equivalent, and convert the rest to native SQL.

## Moving the data

Two approaches, decided by data volume and downtime tolerance:

| Approach | When | How |
|---|---|---|
| **Offline load** | Small to medium data, downtime window of hours | ora2pg parallel export, or DMS full load; freeze writes, load, validate, switch |
| **Full load plus CDC** | Large data or minimal downtime | Initial load, then continuous replication with AWS DMS, Google DMS, GoldenGate or Debezium until cutover |

Practical points:

- **Load data, then build indexes and constraints.** Much faster than loading into fully indexed tables.
- **LOBs are slow everywhere.** Measure LOB throughput early; it's often what blows the window.
- **Disable triggers during the load**, or you'll fire business logic for historical rows.
- **Watch character sets.** Mis-encoded data in a legacy single-byte source fails or corrupts on a UTF-8 target. Find it before the rehearsal.

## Testing: prove it behaves the same

| Test layer | What I check | How |
|---|---|---|
| Data | Row counts and per-table checksums match | ora2pg `TEST` and `TEST_DATA`, or aggregate hashes over ordered columns on both sides |
| Code | Converted functions return the same results | Unit tests with [pgTAP](https://pgtap.org/), driven by the same inputs as Oracle |
| Queries | Results and timings of top SQL match | Capture top statements from AWR, replay on both, compare result sets and elapsed time |
| Application | End-to-end functional regression | Existing automated tests, plus targeted tests for NULL, date and rollback behaviour |
| Concurrency | No new deadlocks or lost updates | Load tests at realistic concurrency |
| Operations | Backup, restore, failover and monitoring work | Restore a backup and fail over before go-live |

The tests that find the most bugs are boring: report totals on real data, run on both systems, compared to the cent. Add a [restore test]({{ '/blog/2026/11/database-backup-restore-disaster-recovery/' | relative_url }}) before go-live; a migration is a good moment to discover your new backups actually work.

## Cutover

A cutover runbook I'd expect to see, rehearsed at least twice against production-sized data:

1. **T-minus days:** CDC running, lag monitored, final validation run green, rollback plan signed off.
2. **Freeze:** stop application writes to Oracle; let CDC drain to zero lag.
3. **Validate:** final counts and checksums on critical tables.
4. **Reset sequences** from the maximum key values.
5. **Switch** application connection strings and pools, and restart services.
6. **Smoke test** critical journeys with real users or synthetic checks.
7. **Fallback window:** keep Oracle intact, and if possible run reverse replication from PostgreSQL to Oracle, so you can switch back without data loss.
8. **Decommission** only after the agreed stability period, and after you've confirmed no forgotten consumer still reads from Oracle.

Write go and no-go criteria in advance: which checks must pass, who decides, and the latest time to roll back.

## Where AEM fits in

AEM's own repository doesn't run on Oracle on AEM as a Cloud Service, but AEM projects often integrate with Oracle-backed systems: product data, customer records, AEM Forms data models or a custom JDBC integration. When the database behind them moves, check:

- **The JDBC pool configuration.** If AEM connects directly through a `com.day.commons.datasource.jdbcpool.JdbcPoolService` configuration, swap the driver bundle, the JDBC URL and the validation query (`SELECT 1 FROM DUAL` becomes `SELECT 1`). Adobe's [JDBC DataSourcePool guide](https://experienceleague.adobe.com/en/docs/experience-manager-learn/cloud-service/networking/examples/sql-datasourcepool) shows the pattern on AEMaaCS.
- **Advanced networking.** On AEMaaCS, non-HTTP database traffic goes through port forwarding to `AEM_PROXY_HOST`. A new database host and port (5432 instead of 1521) means a new port-forwarding rule in Cloud Manager, so add it to the cutover plan.
- **Native SQL in Sling Models or services.** It needs the same dialect review as any other application code.
- **Better still, put an API in between,** so AEM stops talking to the database directly. I argue for that in [when AEM content belongs outside the JCR]({{ '/blog/2026/11/when-aem-content-belongs-outside-the-jcr/' | relative_url }}), and the [connection pooling post]({{ '/blog/2026/11/database-connection-pooling-hikaricp-pgbouncer/' | relative_url }}) covers sizing the pool on the new target.

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| Trusting the conversion percentage | The last 10% takes most of the effort | Size the work from the assessment and the application SQL |
| Ignoring application SQL | Runtime errors after go-live | Search code, reports and ETL for Oracle syntax |
| No empty-string policy | Wrong filters and report totals | Convert `''` to `NULL` on load, or fix every comparison |
| Keys as unconstrained `numeric` | Slow joins; `BigDecimal` everywhere | Map integer `NUMBER` columns to `integer` or `bigint` |
| Oracle `DATE` to PostgreSQL `date` | Times silently truncated | Use `timestamp(0)` unless proven date-only |
| Forgetting to reset sequences | Duplicate-key errors on the first insert | Script `setval` for every sequence after the final sync |
| Catching errors and continuing a transaction | "current transaction is aborted" | Savepoints or `ON CONFLICT`; `autosave` only as a bridge |
| Porting `UTL_HTTP` and scheduler jobs as they are | Fragile extensions and hidden integrations | Move them to application services |
| Validating only row counts | Mismatched values go unnoticed | Checksums and real report comparisons |
| No rollback plan | A bad night becomes a bad month | Keep Oracle, reverse CDC, and agreed no-go criteria |
| Forgetting downstream consumers | Broken reports and integrations after decommission | Inventory every reader, including AEM integrations |

## Closing thought

Converting Oracle DDL to PostgreSQL is a solved problem. Proving the migrated system behaves the same, down to report totals and failure behaviour, is the actual project. Budget for assessment and testing, decide the semantic policies (NULLs, numbers, dates, transactions) on day one, and rehearse the cutover until it's boring.

If you're assessing an Oracle exit, or need to work out what a database migration means for the AEM integrations around it, [get in touch](/contact/).

### References

- [Ora2Pg documentation](https://ora2pg.darold.net/documentation.html) (Ora2Pg project)
- [Oracle to PostgreSQL conversion settings](https://docs.aws.amazon.com/dms/latest/userguide/schema-conversion-oracle-postgresql.html) and [converting database objects with generative AI](https://docs.aws.amazon.com/dms/latest/userguide/schema-conversion-convert.databaseobjects.html) (AWS DMS documentation)
- [Conversion workspaces for Oracle to AlloyDB](https://docs.cloud.google.com/database-migration/docs/oracle-to-alloydb/about-conversion-ws) (Google Cloud documentation)
- [orafce](https://github.com/orafce/orafce) (GitHub)
- [pgTAP](https://pgtap.org/) (pgTAP project)
- [SQL connections using JDBC DataSourcePool](https://experienceleague.adobe.com/en/docs/experience-manager-learn/cloud-service/networking/examples/sql-datasourcepool) (Adobe Experience League)

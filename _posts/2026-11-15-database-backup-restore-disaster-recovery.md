---
layout: post
title: "Backup, restore and disaster recovery for databases and AEM: RPO, RTO and the restore you haven't tested"
seo_title: "Database Backup, PITR and Disaster Recovery, Plus AEM"
description: "RPO, RTO and point-in-time recovery in PostgreSQL, MySQL, Oracle RMAN and MongoDB, how to test restores, and AEM backup on-premise and on AEM as a Cloud Service."
ai_summary: "Backups only matter if you can restore them within the recovery point and recovery time objectives the business has agreed. This guide defines RPO and RTO, separates backups from replication and DR, and explains point-in-time recovery in PostgreSQL (base backups, WAL archiving, pgBackRest, incremental backups), MySQL (physical backups plus binary logs), Oracle (RMAN, ARCHIVELOG, Flashback, Data Guard) and MongoDB (Atlas and Ops Manager continuous backup, snapshots). It covers restore testing, DR patterns, and AEM: online backup and snapshots for self-hosted AEM, and AEM as a Cloud Service self-service restore with its 24-hour and seven-day windows."
date: 2026-11-15 11:00:00 +0530
category: databases
tags: [Backup, Disaster Recovery, PostgreSQL, Oracle, MongoDB, AEM]
---

Every architecture review I run has a slide that says "Backups: daily, retained 30 days". I always ask: **when did you last restore one, and how long did it take?** The room usually goes quiet.

A backup you haven't restored is a hypothesis. This post covers RPO and RTO, point-in-time recovery in PostgreSQL, MySQL, Oracle and MongoDB, how to test restores, and AEM, where backup looks very different on-premise and on AEM as a Cloud Service.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **Agree RPO and RTO per system with the business first.** RPO is how much data you can lose; RTO is how long you can be down.
- **Replication isn't a backup.** A replica copies `DELETE FROM orders;` within milliseconds. Keep backups with history, and one copy your production credentials can't delete.
- **Point-in-time recovery (PITR) = a physical base backup + a continuous log**: WAL in PostgreSQL, binary logs in MySQL, archived redo in Oracle, the oplog in MongoDB.
- **Use the proper tools:** pgBackRest, XtraBackup plus binlogs, RMAN, Atlas or Ops Manager backup. Logical dumps alone aren't a DR plan.
- **Test restores on a schedule**, time them, and check the data.
- **Self-hosted AEM:** online backup or snapshots, segment store before data store, never alongside revision cleanup or data store GC.
- **AEM as a Cloud Service:** self-service restore covers the last 24 hours (any point) or snapshots from the last seven days, restores **content only**, and allows ten successful restores per program per month. Code and external databases are yours.

## RPO, RTO and what they cost

Two numbers define a recovery requirement:

- **Recovery Point Objective (RPO):** the maximum acceptable data loss, measured in time. An RPO of 15 minutes means losing up to the last 15 minutes of writes is acceptable.
- **Recovery Time Objective (RTO):** the maximum acceptable time from incident to service restored.

They're business decisions with technical price tags:

| Target | Typical approach | Rough cost |
|---|---|---|
| RPO 24 h, RTO 1–2 days | Nightly backup, restore by hand | Low |
| RPO minutes, RTO hours | Base backups + continuous log archiving (PITR), scripted restore | Moderate |
| RPO seconds, RTO under an hour | PITR plus a warm standby replica in another zone or region | Significant |
| RPO near zero, RTO minutes | Synchronous replication, automated failover, plus PITR for logical errors | High, and adds write latency |

Set them per system: a catalogue re-importable from a PIM doesn't need an order database's targets.

### Backups, replication and DR are different things

| Protects against | Replication / HA | Backups with PITR | Off-site, immutable copy |
|---|---|---|---|
| Server or disk failure | Yes | Yes (slower) | Yes (slowest) |
| Zone or region outage | If cross-zone or cross-region | If stored elsewhere | Yes |
| Bad deploy, accidental `DELETE` | **No**, it replicates the mistake | Yes, restore to just before | Yes |
| Ransomware or a compromised admin account | **No** | Not if the attacker can delete them | **Yes**, if truly immutable |

Teams miss the last row most often. If the same credentials can delete both the database and its backups, you have one failure domain. Copy backups to a separate account or vault with object lock.

## The building blocks

Every engine offers some mix of these:

- **Logical backups** (`pg_dump`, `mysqldump`, Data Pump, `mongodump`): portable, good for migrations and single-table restores, slow at scale.
- **Physical backups** (snapshots, RMAN, XtraBackup): the database's own files; much faster to restore.
- **Continuous log archiving**: every change, shipped as it happens. With a physical base backup, this gives PITR, my default wherever losing a day of data would hurt.

## PostgreSQL

PostgreSQL's PITR model is described in the [continuous archiving documentation](https://www.postgresql.org/docs/current/continuous-archiving.html): take a base backup with the server running, archive every write-ahead log (WAL) segment, and on restore replay WAL up to a target time, transaction or named restore point.

You can build this with `pg_basebackup` and an `archive_command`, but for production I use **[pgBackRest](https://pgbackrest.org/)** (or Barman). They handle parallel and compressed backups, retention, encryption, object storage, verification and restore in one tool:

```bash
# Full backup weekly, differential daily (schedule with cron or your orchestrator)
pgbackrest --stanza=orders --type=full backup
pgbackrest --stanza=orders --type=diff backup

# Restore to just before the bad deploy
pgbackrest --stanza=orders --delta \
  --type=time "--target=2026-11-14 10:41:00+05:30" \
  --target-action=promote restore
```

Since PostgreSQL 17, core PostgreSQL also supports **incremental base backups**: `pg_basebackup --incremental` with WAL summarisation enabled, and [`pg_combinebackup`](https://www.postgresql.org/docs/current/app-pgcombinebackup.html) to rebuild a full backup from the chain. It's useful when you don't want an external tool, but the dedicated tools are still more complete.

Things to get right:

- **Monitor the archiver.** If archiving fails, WAL piles up in `pg_wal` until the disk fills, and your RPO silently grows. Alert on `pg_stat_archiver.failed_count` and on the age of the last archived WAL.
- **`pg_dump` is for logical copies.** It's perfect for moving one schema or restoring one table into a scratch database, but it's not PITR.
- **Managed services** (RDS, Aurora, Cloud SQL, Azure Database for PostgreSQL) provide automated backups with PITR inside a retention window. Check that window, and copy snapshots to another account or region for the ransomware case.

## MySQL

MySQL's PITR is a physical or logical full backup plus the **binary log** replayed up to the moment before the incident. The [MySQL 8.4 manual](https://dev.mysql.com/doc/refman/8.4/en/point-in-time-recovery.html) walks through it.

- **Physical backups:** [Percona XtraBackup](https://www.percona.com/software/mysql-database/percona-xtrabackup) (open source) or MySQL Enterprise Backup (commercial). Both take hot backups of InnoDB without blocking writes and support incrementals.
- **Logical backups:** `mysqldump`, or the faster, parallel MySQL Shell dump and load utilities. `mysqlpump` was deprecated in 8.0 and removed in 8.4, so remove it from old scripts.
- **Binary logs:** keep `log_bin` on, use row-based logging and GTIDs, and copy binlogs off the server continuously. Their retention on the server (`binlog_expire_logs_seconds`) isn't a backup policy.

A binlog replay after restoring the last full backup looks like this:

```bash
# Find the position of the bad statement first, then replay up to it
mysqlbinlog --start-position=4 --stop-datetime="2026-11-14 10:41:00" \
  binlog.000412 binlog.000413 | mysql -u root -p
```

## Oracle: RMAN

Oracle's backup story is the most mature of the four, and most of it runs through **Recovery Manager (RMAN)**. The [Backup and Recovery User's Guide](https://docs.oracle.com/en/database/oracle/oracle-database/19/bradv/index.html) is long but worth reading. The essentials:

- **Run in `ARCHIVELOG` mode.** Without it, you can only restore to the last full backup.
- **Incremental level 0 and level 1 backups.** Level 0 is the baseline; level 1 captures changed blocks. **Block change tracking** (Enterprise Edition) makes level 1 backups read only changed blocks instead of scanning every datafile.
- **Use a fast recovery area**, autobackup the control file, and define a retention policy in RMAN rather than deleting files by hand.
- **Validate without restoring.** `RESTORE DATABASE VALIDATE` reads the backups and checks that they're usable.

```sql
CONFIGURE RETENTION POLICY TO RECOVERY WINDOW OF 14 DAYS;
CONFIGURE CONTROLFILE AUTOBACKUP ON;

BACKUP INCREMENTAL LEVEL 0 DATABASE PLUS ARCHIVELOG;   -- weekly
BACKUP INCREMENTAL LEVEL 1 DATABASE PLUS ARCHIVELOG;   -- daily
RESTORE DATABASE VALIDATE;                             -- weekly check

-- Point-in-time recovery (database mounted)
RUN {
  SET UNTIL TIME "TO_DATE('2026-11-14 10:41:00','YYYY-MM-DD HH24:MI:SS')";
  RESTORE DATABASE;
  RECOVER DATABASE;
}
ALTER DATABASE OPEN RESETLOGS;
```

Oracle also has two features that change the RTO conversation. **Flashback Database** rewinds a database to an earlier point without a full restore, which is ideal for a bad deploy. **Data Guard** keeps a standby database in sync for site-level DR. Both are Enterprise Edition capabilities, which is one reason they come up when I discuss [migrating from Oracle to PostgreSQL]({{ '/blog/2026/11/migrating-oracle-to-postgresql/' | relative_url }}): you need to replace them, usually with pgBackRest for PITR and streaming replication for a standby.

## MongoDB

MongoDB's [backup methods page](https://www.mongodb.com/docs/manual/core/backups/) is refreshingly direct about the trade-offs:

| Method | Point-in-time recovery | Notes |
|---|---|---|
| **Atlas cloud backup** | Yes, with continuous cloud backup | The easy answer on Atlas; configure the PITR window and snapshot retention |
| **Ops Manager / Cloud Manager** | Yes | Reads the oplog for replica sets and sharded clusters; Ops Manager needs Enterprise Advanced |
| **Filesystem snapshots** (LVM, EBS) | No | Journal must be on the same volume; for sharded clusters, stop the balancer and snapshot every shard and the config servers at about the same moment |
| **`mongodump` / `mongorestore`** | No | MongoDB describes them as tools for small deployments; consistency across a sharded cluster isn't guaranteed |

For anything beyond a small replica set, use Atlas backup or Ops Manager. Hand-rolled snapshot scripts for sharded clusters are fragile, and they're the kind of thing nobody tests until they're needed.

## Testing restores

This is the section that matters most, and it's the one most often skipped.

### What a restore test looks like

1. **Restore into an isolated environment** from the real backup repository, using the runbook, by someone who didn't write it.
2. **Recover to a point in time**, not just the latest backup, because that's what a real incident usually needs.
3. **Time every step**: finding the backup, provisioning, copying, replaying logs, starting up, application checks. That total is your real RTO.
4. **Check the data.** Row counts per key table, a few business invariants (orders have lines, totals match), and the most recent records you expect to see. For PostgreSQL, run `amcheck` on critical indexes; for Oracle, `RESTORE ... VALIDATE`; for MongoDB, `validate` on key collections.
5. **Write down what went wrong** and fix the runbook.

### How often

| System criticality | Restore drill | Automated verification |
|---|---|---|
| Tier 1 (orders, payments, identity) | Quarterly, full PITR | Daily: restore last backup, run checks |
| Tier 2 (internal apps, catalogues) | Twice a year | Weekly |
| Tier 3 (rebuildable data) | Yearly, or prove the rebuild works | Backup job success only |

Automated verification is cheap: a job that restores last night's backup into a throwaway instance, runs a dozen queries and posts the result. It catches expired credentials and broken archiving long before an incident does. I add it to the [go-live checklist]({{ '/blog/2026/11/aem-go-live-checklist/' | relative_url }}) on every project that owns a database.

## DR patterns

Once backups are sound, DR is a question of how much standby capacity you pay for:

| Pattern | What runs in the DR location | Typical RTO |
|---|---|---|
| **Backup and restore** | Nothing; backups are copied there | Hours to a day |
| **Pilot light** | Replicated database only; app tier built on demand | An hour or two |
| **Warm standby** | Replicated database and a scaled-down app tier | Minutes to an hour |
| **Active-active** | Full capacity in both locations | Near zero, with significant complexity |

Most organisations I work with land on warm standby for tier 1 and backup-and-restore for the rest. Active-active with a relational database is a big design commitment, not a side effect of a DR requirement.

## AEM backup and recovery

AEM adds two complications: the repository isn't a conventional database, and the platform you run on changes who does what. If you need a refresher on how Oak stores content, see [Oak storage: TarMK, MongoMK and AEM as a Cloud Service]({{ '/blog/2026/11/oak-storage-tarmk-mongomk-aem-cloud-service/' | relative_url }}).

### Self-hosted AEM (6.5 and 6.5 LTS)

Adobe's [backup and restore documentation](https://experienceleague.adobe.com/en/docs/experience-manager-65/content/sites/administering/operations/backup-and-restore) describes two approaches:

- **Online backup.** AEM copies the repository while running. It can be started from the UI or through JMX MBeans, and a *delay* setting throttles it to protect performance. Adobe notes that a 1 ms delay typically results in about 10% CPU use, and that a very large delay shouldn't let the backup run past 24 hours.
- **Filesystem snapshots**, which Adobe calls "specially suited for large repositories". The volumes must support snapshots (LVM on Linux, or cloud disk snapshots).

The rules that protect you:

- **The segment store is copied before the data store**, "to avoid repository corruption". If you script your own copy, keep that order. A segment store referencing binaries missing from the data store is a broken repository.
- **Back up an external data store separately.** If binaries live in a file data store outside `crx-quickstart` or in S3, the AEM backup doesn't include them. Use versioning on the bucket.
- **Don't run online backup alongside data store garbage collection or revision cleanup.** Adobe warns that this harms performance and can affect the results of both.
- **Cold standby isn't a backup.** It replicates deletions and corruption just like database replication.
- **Publish is usually rebuilt, not restored.** Restore or rebuild author, then republish, or clone a healthy publish instance. Keep code and Dispatcher configuration in Git so a new instance is a deployment, not an archaeology project.

### AEM as a Cloud Service

On AEMaaCS, Adobe runs the backups. What you can do yourself is defined in [Restore content in AEM as a Cloud Service](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/operations/backup):

| Aspect | What Adobe documents |
|---|---|
| **Point-in-time restore** | Continuous backups from the past **24 hours** |
| **Last week** | Snapshots from the previous **seven days**, excluding the last 24 hours |
| **What's restored** | **Content only.** Code and the AEM release stay as they are; indexes are rebuilt for the current code |
| **Limits** | Ten successful restores per program per calendar month; one restore per environment at a time; none until about six hours after an environment is created |
| **Permissions** | No user can restore by default; an admin grants it through a product profile |
| **Regional DR** | For production, content is continuously copied to a remote region and kept for three months; Adobe's reliability engineers use it during a regional outage |
| **Deleted environments** | Their data is permanently lost |

The design consequences:

- **A restore discards everything written after the restore point**, across the whole environment. If editors published 40 pages after the bad change, those edits go too. Adobe recommends trying narrower options first: reinstalling a content package, Restore Tree for Sites pages, restoring asset versions or re-uploading assets.
- **Code doesn't roll back with content.** If the incident was a deployment that changed content structures, check the commits between the restore point and now. Rolling back code is a separate Cloud Manager action.
- **Seven days is short.** If someone deletes a rarely visited section and nobody notices for two weeks, platform restore can't help. For content you can't recreate, use versioning and version purge settings that keep enough history (see the `mt.yaml` example in my Oak post), and consider periodic content package exports of critical trees.
- **Your other data isn't covered.** Forms submissions in an external database, commerce data, Adobe Commerce, App Builder state, and anything behind your [JDBC DataSourcePool]({{ '/blog/2026/11/database-connection-pooling-hikaricp-pgbouncer/' | relative_url }}) need their own backup and DR, aligned with AEM's. Restoring AEM content to yesterday while an external order database stays at today can leave references broken.

Plan this before go-live. The [migration guide]({{ '/blog/2026/11/aem-on-premise-and-managed-services-to-aem-as-a-cloud-service-migration/' | relative_url }}) covers the operating model changes.

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| No agreed RPO/RTO | Over-engineered for some systems, under-protected for others | Agree targets per system with the business |
| Treating replicas or cold standby as backups | Accidental deletes and corruption are replicated instantly | Keep PITR backups with history in addition to HA |
| Backups deletable with production credentials | Ransomware or a compromised account removes data and backups | Separate account or vault, immutable retention |
| WAL or binlog archiving failing silently | RPO grows from minutes to days; disks fill | Alert on archive failures and on the age of the last archived log |
| Never testing restores | The first restore attempt happens during the incident | Scheduled drills and automated daily verification |
| Self-hosted AEM backup copying data store before segment store | Repository references missing binaries | Segment store first, or a consistent snapshot of both |
| Assuming AEMaaCS restore covers code and external data | Mismatched code and content; external systems out of sync | Review commits; give external data its own DR plan |
| Discovering the seven-day limit after the fact | Old deletions can't be recovered | Version retention, content package exports for critical trees |

## What I'd recommend

- **Write down RPO and RTO for every system** and get them signed off. Revisit them yearly.
- **PITR by default** for PostgreSQL (pgBackRest), MySQL (XtraBackup plus binlogs), Oracle (RMAN in `ARCHIVELOG` mode) and MongoDB (Atlas or Ops Manager backup).
- **At least one immutable, off-account copy** of every tier 1 backup.
- **Automated restore verification daily** for tier 1, and a full drill every quarter with timings recorded.
- **For AEM on AEMaaCS**, grant restore permissions before you need them, and give every external system its own plan.

## Closing thought

The backup technology across PostgreSQL, MySQL, Oracle, MongoDB and AEM is mature. What fails is the process: targets nobody agreed, archives nobody monitored, restores nobody rehearsed. Pick a system this month, restore it to a point in time, and time it. That one exercise will tell you more about your DR posture than any policy document.

Want a second pair of eyes on a backup and DR design? [Get in touch](/contact/).

### References

- [Continuous archiving and point-in-time recovery](https://www.postgresql.org/docs/current/continuous-archiving.html) (PostgreSQL documentation)
- [pg_combinebackup](https://www.postgresql.org/docs/current/app-pgcombinebackup.html) (PostgreSQL documentation)
- [pgBackRest](https://pgbackrest.org/) (pgBackRest)
- [Point-in-time (incremental) recovery](https://dev.mysql.com/doc/refman/8.4/en/point-in-time-recovery.html) (MySQL 8.4 Reference Manual)
- [Percona XtraBackup](https://www.percona.com/software/mysql-database/percona-xtrabackup) (Percona)
- [Backup and Recovery User's Guide](https://docs.oracle.com/en/database/oracle/oracle-database/19/bradv/index.html) (Oracle Database 19c)
- [Backup methods for a self-managed deployment](https://www.mongodb.com/docs/manual/core/backups/) (MongoDB)
- [Atlas cloud backups](https://www.mongodb.com/docs/atlas/backup/cloud-backup/overview/) (MongoDB Atlas)
- [Backup and restore in AEM 6.5](https://experienceleague.adobe.com/en/docs/experience-manager-65/content/sites/administering/operations/backup-and-restore) (Adobe Experience League)
- [Restore content in AEM as a Cloud Service](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/operations/backup) (Adobe Experience League)

---
layout: post
title: "Transactions, isolation levels and MVCC in practice: PostgreSQL, MySQL, Oracle, MongoDB and the JCR"
seo_title: "Transactions, Isolation Levels and MVCC in Practice"
description: "How isolation levels and MVCC really behave in PostgreSQL, MySQL, Oracle, MongoDB and AEM's JCR: anomalies, defaults, lost updates, retries and common mistakes."
ai_summary: "Isolation levels are defined by the anomalies they prevent, but each engine implements them differently. PostgreSQL and Oracle default to Read Committed and MySQL InnoDB to Repeatable Read. PostgreSQL's Repeatable Read is snapshot isolation and its Serializable uses SSI; Oracle's Serializable is snapshot isolation and still allows write skew; InnoDB's Repeatable Read reads from a snapshot but updates see the latest committed row. All three use MVCC, keeping old versions in the heap (Postgres) or undo (InnoDB, Oracle). MongoDB adds multi-document transactions with read and write concerns, and Oak gives each JCR session a snapshot committed atomically by save(). The post covers lost updates, locking versus optimistic concurrency, retries and common mistakes."
date: 2026-11-14 15:00:00 +0530
category: databases
tags: [Transactions, PostgreSQL, MySQL, Oracle Database, MongoDB, JCR]
---

A bug report I've seen in some form on almost every project: "Two people updated the same record and one change disappeared." Nothing errored. The logs are clean. The database did exactly what it was told, at the isolation level it was told to use, and most of the team didn't know what that level was.

Transactions are one of those topics everyone learned once, as the four letters ACID and a table of anomalies, and then stopped thinking about because the framework handles it. The framework doesn't handle it. It picks the database's default, and the defaults differ between engines in ways that change how your code behaves. A pattern that's safe on PostgreSQL can lose updates on MySQL. A Serializable transaction on Oracle doesn't give you the guarantee the word suggests.

This post is the practical version: what each isolation level prevents, how PostgreSQL, MySQL InnoDB and Oracle implement them with MVCC, how MongoDB transactions and read and write concerns fit in, and how AEM's JCR sessions behave. Then the patterns I recommend and the mistakes I see in code reviews.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **Know your default.** PostgreSQL and Oracle default to **Read Committed**. MySQL InnoDB defaults to **Repeatable Read**. MongoDB reads with read concern `local` and, since 5.0, writes with `w: "majority"` by default.
- **Same name, different behaviour.** Postgres Repeatable Read is snapshot isolation and errors on concurrent updates. InnoDB Repeatable Read reads from a snapshot but **updates the latest row**, so read-modify-write in application code can lose updates. Oracle's Serializable is snapshot isolation and still allows write skew. Only Postgres Serializable (SSI) is truly serializable among these.
- **MVCC means readers don't block writers**, but old versions have to live somewhere: in the table in Postgres (vacuum), in undo in InnoDB and Oracle (purge, `ORA-01555`). Long transactions are expensive in all of them.
- **Prevent lost updates explicitly:** atomic `UPDATE ... SET x = x - 1`, `SELECT ... FOR UPDATE`, or optimistic locking with a version column. Don't rely on the isolation level to do it for you.
- **Higher isolation means retries.** Serializable and snapshot conflicts are normal, not exceptional. Wrap transactions in retry logic, keep them short, and make them idempotent.
- **In AEM, a JCR session is a snapshot and `save()` is the commit.** Use one short-lived session or resource resolver per unit of work, refresh before writing, and retry on conflict.

## Anomalies first, levels second

The SQL standard defines isolation levels by which anomalies they forbid. That's the useful way to think about them, so start with the anomalies.

| Anomaly | What happens | Example |
|---|---|---|
| **Dirty read** | You read another transaction's uncommitted change | You see a price that is later rolled back |
| **Non-repeatable read** | Reading the same row twice gives different values | Stock is 5, then 3, within one transaction |
| **Phantom** | Re-running a query returns new or missing rows | A report's total doesn't match its own detail rows |
| **Lost update** | Two read-modify-write cycles overlap; one overwrites the other | Two editors both save; the first edit vanishes |
| **Write skew** | Two transactions read overlapping data, write different rows, and together break a rule | Two doctors both go off call because each saw the other on call |

The standard levels, in theory:

| Level | Dirty read | Non-repeatable read | Phantom |
|---|---|---|---|
| Read Uncommitted | Possible | Possible | Possible |
| Read Committed | Prevented | Possible | Possible |
| Repeatable Read | Prevented | Prevented | Possible |
| Serializable | Prevented | Prevented | Prevented |

Notice that lost update and write skew aren't in the standard's table at all. That's the gap where most real bugs live, and where engines differ most.

## What each engine actually does

| Level | PostgreSQL | MySQL InnoDB | Oracle |
|---|---|---|---|
| Read Uncommitted | Accepted, behaves as Read Committed | Dirty reads possible | Not supported |
| Read Committed | **Default.** New snapshot per statement | Snapshot per statement; fewer gap locks | **Default.** Statement-level read consistency |
| Repeatable Read | Snapshot isolation: one snapshot per transaction, no phantoms; concurrent update raises a serialization error | **Default.** Snapshot for plain reads; locking reads and updates see the latest committed row; next-key locks | Not supported |
| Serializable | True serializability via SSI; may raise serialization errors | Repeatable Read, with plain `SELECT` turned into locking reads when autocommit is off | Transaction-level snapshot; `ORA-08177` on conflicting update; write skew still possible |

Sources: [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html), [InnoDB transaction isolation levels](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html), and Oracle's [data concurrency and consistency](https://docs.oracle.com/en/database/oracle/oracle-database/23/cncpt/data-concurrency-and-consistency.html) chapter.

Three behaviours in that table cause most of the surprises.

### PostgreSQL Repeatable Read fails fast

In Postgres, if two Repeatable Read transactions update the same row, the second one to commit gets an error:

```text
ERROR:  could not serialize access due to concurrent update
SQLSTATE: 40001
```

That's a feature. Postgres refuses to let you overwrite a change you never saw. You have to catch `40001` and retry the whole transaction. Postgres Serializable goes further with [Serializable Snapshot Isolation](https://wiki.postgresql.org/wiki/SSI): it tracks read and write dependencies and aborts one transaction if a dangerous pattern appears, which catches write skew too.

### InnoDB Repeatable Read reads old, writes new

InnoDB's default is the one that surprises developers most. A plain `SELECT` reads from the snapshot taken at the transaction's first read. An `UPDATE`, `DELETE` or `SELECT ... FOR UPDATE` operates on the **latest committed** version. So this classic pattern loses updates silently:

```sql
-- Session A and Session B, both at REPEATABLE READ
START TRANSACTION;
SELECT balance FROM account WHERE id = 42;     -- both read 100
-- application computes 100 - 30 = 70 (A) and 100 - 50 = 50 (B)
UPDATE account SET balance = 70 WHERE id = 42; -- A commits
UPDATE account SET balance = 50 WHERE id = 42; -- B waits for A's lock, then overwrites
COMMIT;
-- Final balance: 50. A's debit is lost. No error.
```

On Postgres at Repeatable Read, B's update would fail with `40001`. On Postgres at Read Committed, and on Oracle's default, B's update also goes through and A's change is lost. Isolation level alone doesn't protect application-side read-modify-write in most defaults. You have to design for it.

### Oracle Serializable isn't fully serializable

Oracle implements Serializable as transaction-level snapshot isolation. If you update a row someone else changed after your snapshot, you get `ORA-08177: can't serialize access for this transaction`. But two transactions that read the same rows and update **different** rows both commit, so write skew is possible. If a business rule spans rows ("at least one doctor on call"), enforce it with a lock or a constraint, not by trusting the level.

## MVCC: where old versions live

All three relational engines use multi-version concurrency control. Readers see a consistent snapshot without blocking writers, and writers don't block readers. The difference is where the history is kept, which decides what a long-running transaction costs you.

![Where each engine keeps old versions for MVCC: PostgreSQL in the table, InnoDB and Oracle in undo, MongoDB and Oak per-session snapshots]({{ '/assets/img/blog/transactions-isolation-levels-mvcc-in-practice/01-where-old-versions-live.svg' | relative_url }}){: width="1200" height="600" loading="lazy" decoding="async"}

| | PostgreSQL | MySQL InnoDB | Oracle |
|---|---|---|---|
| Where old versions live | In the table heap, as dead tuples | Undo logs | Undo tablespace |
| Cleanup | `VACUUM` / autovacuum | Purge threads | Undo retention and reuse |
| Symptom of long transactions | Table and index bloat; in extremes, transaction ID wraparound risk | Growing history list length; slower reads walking undo chains | `ORA-01555: snapshot too old` for long queries |
| What to monitor | Dead tuples, `age(datfrozenxid)`, oldest `xact_start` in `pg_stat_activity` | `History list length` in `SHOW ENGINE INNODB STATUS` | Undo usage, `UNDO_RETENTION` vs longest query |

The practical lesson is the same everywhere: **a transaction left open is not free.** An idle-in-transaction connection from a forgotten debugging session, or a batch job that opens a transaction and then calls a slow external API, will hold back cleanup for the whole database. In Postgres I always set `idle_in_transaction_session_timeout`, and on every engine I alert on the age of the oldest open transaction.

## Preventing lost updates: three patterns

Here are the patterns I recommend, roughly in order of preference.

### 1. Let the database do the arithmetic

If the change can be expressed as a single statement, do that. The row lock and the latest value are handled for you on every engine:

```sql
UPDATE account
SET    balance = balance - 30
WHERE  id = 42
AND    balance >= 30;   -- check rows affected = 1
```

### 2. Pessimistic locking

When you need to read, decide in code and then write, lock the row while you read it:

```sql
BEGIN;
SELECT balance FROM account WHERE id = 42 FOR UPDATE;
-- decide in application code
UPDATE account SET balance = :newBalance WHERE id = 42;
COMMIT;
```

`FOR UPDATE` works the same way in Postgres, MySQL and Oracle. Add `NOWAIT` or `SKIP LOCKED` for queue-style workloads. Keep the transaction short: you're holding a lock while your code runs.

### 3. Optimistic locking with a version column

For user-facing edits, where a person might keep a form open for ten minutes, you can't hold a lock. Use a version number and check it on write:

```sql
UPDATE article
SET    title = :title, body = :body, version = version + 1
WHERE  id = :id
AND    version = :versionTheUserLoaded;
-- 0 rows updated means someone else saved first: reload and show a conflict
```

JPA's `@Version` does exactly this. It's the right default for anything an editor touches, and it's the same idea as Oak's conflict detection on `save()`, which I come to below.

### Retries are part of the design

At Repeatable Read or Serializable, conflicts surface as errors you must retry: SQLSTATE `40001` in Postgres, deadlocks (`1213`) in MySQL, `ORA-08177` and `ORA-00060` in Oracle. A minimal retry wrapper in Java:

```java
public <T> T inTransaction(Supplier<T> work) {
    int attempts = 0;
    while (true) {
        try {
            return transactionTemplate.execute(status -> work.get());
        } catch (ConcurrencyFailureException e) {
            if (++attempts >= 3) throw e;
            sleepWithJitter(attempts);   // e.g. 50ms, 100ms, 200ms plus jitter
        }
    }
}
```

Two rules make retries safe: the whole transaction is retried, not the failed statement, and nothing outside the database (an email, an HTTP call, a message) happens inside the retried block. Send those after commit, or use an outbox table.

## MongoDB: transactions, read concern and write concern

MongoDB guarantees **single-document atomicity** always, which is why good document design (embedding what changes together) avoids most transaction needs. I cover that in the [MongoDB schema design post]({{ '/blog/2026/11/mongodb-schema-design-for-relational-developers/' | relative_url }}). For the rest, MongoDB has had multi-document ACID [transactions](https://www.mongodb.com/docs/manual/core/transactions/) on replica sets since 4.0 and on sharded clusters since 4.2.

Two settings decide what "committed" and "consistent" mean:

| Setting | Options | What it controls |
|---|---|---|
| [Read concern](https://www.mongodb.com/docs/manual/reference/read-concern/) | `local` (default), `available`, `majority`, `linearizable`, `snapshot` | Whether you can read data that might be rolled back after a failover |
| [Write concern](https://www.mongodb.com/docs/manual/reference/write-concern/) | `w: 1`, `w: "majority"` (default since 5.0 for most deployments), `j: true` | How many members must acknowledge a write before it's reported successful |

Inside a transaction, use read concern `snapshot` and write concern `majority` for the behaviour most relational developers assume. Practical points:

- Transactions have a **lifetime limit**, 60 seconds by default (`transactionLifetimeLimitSeconds`). Long transactions put pressure on the WiredTiger cache, and MongoDB aborts them rather than let that grow.
- Write conflicts abort the transaction with the `TransientTransactionError` label. The drivers' callback API (`withTransaction`) retries these for you.
- Use **causally consistent sessions** if a user must read their own write from a secondary.

```javascript
const session = client.startSession();
try {
  await session.withTransaction(async () => {
    await orders.insertOne({ _id: orderId, items, status: "placed" }, { session });
    await stock.updateOne(
      { sku, qty: { $gte: n } },
      { $inc: { qty: -n } },
      { session }
    );
  }, {
    readConcern: { level: "snapshot" },
    writeConcern: { w: "majority" }
  });
} finally {
  await session.endSession();
}
```

If you find yourself writing many multi-document transactions, it's worth asking whether the data is really relational. That's the question in [SQL vs NoSQL is the wrong question]({{ '/blog/2026/11/sql-vs-nosql-is-the-wrong-question/' | relative_url }}) and [Postgres JSONB vs MongoDB]({{ '/blog/2026/11/postgres-jsonb-vs-mongodb/' | relative_url }}).

## JCR sessions and save() in AEM

AEM developers work with transactions every day without calling them that. Oak, the JCR implementation behind AEM, is MVCC too. The [Oak documentation](https://jackrabbit.apache.org/oak/docs/dos_and_donts.html) puts it plainly: "each session starts with a snapshot view of the repository", and "concurrent changes from other sessions are not visible to a session until it gets refreshed".

The mapping to relational concepts:

| Relational | JCR / Oak | Sling |
|---|---|---|
| Transaction | Session's transient changes | ResourceResolver's pending changes |
| `COMMIT` | `session.save()` | `resolver.commit()` |
| `ROLLBACK` | `session.refresh(false)` | `resolver.revert()` |
| Snapshot | The revision the session is based on | Same, via the underlying session |
| Serialization failure | `InvalidItemStateException` ("OakState0001: Unresolved conflicts") | `PersistenceException` wrapping it |

A `save()` is atomic: all the session's changes become visible together, or none do. If another session changed the same properties or nodes in a conflicting way after your snapshot, the save fails, and by default your changes are discarded. That's optimistic concurrency, the same idea as the version column above. Oak's guidance is to avoid long-running sessions, call `refresh()` before applying changes, and retry on conflict.

What this means in AEM code:

```java
// One short-lived service resolver per unit of work, not a field on the service
try (ResourceResolver resolver = resolverFactory.getServiceResourceResolver(
        Map.of(ResourceResolverFactory.SUBSERVICE, "order-writer"))) {
    for (int attempt = 1; ; attempt++) {
        try {
            resolver.refresh();                       // start from the latest revision
            Resource node = resolver.getResource(path);
            ModifiableValueMap props = node.adaptTo(ModifiableValueMap.class);
            props.put("status", "processed");
            resolver.commit();                        // session.save()
            break;
        } catch (PersistenceException e) {
            resolver.revert();
            if (attempt >= 3) throw e;
        }
    }
}
```

The JCR-specific mistakes I see in reviews:

- **Long-lived resolvers held in an OSGi service field.** They read stale data unless auto-refresh happens to run, and they collide with other writers. Open one per request or job and close it.
- **One giant save** for a bulk import of tens of thousands of nodes. It's slow and memory-hungry. Save in batches (a few hundred to a thousand nodes), and accept that a batch import is not atomic, so make it resumable.
- **Treating the repository like an OLTP database.** Counters, votes or form submissions written to the same node from many publish instances create constant conflicts. On AEM as a Cloud Service, publish instances each have their own repository anyway. That data belongs outside the JCR, as I argue in [when AEM content belongs outside the JCR]({{ '/blog/2026/11/when-aem-content-belongs-outside-the-jcr/' | relative_url }}).
- **Expecting a transaction across the JCR and an external database.** There isn't one in practice. Write to one, then the other, with an idempotency key and a reconciliation job, or publish an event and let a consumer update the second store.

For the bigger picture of how JCR sessions compare with relational concepts, see [JCR explained for SQL developers]({{ '/blog/2026/11/jcr-explained-for-sql-developers/' | relative_url }}).

## Which isolation level should you use?

My defaults, for typical OLTP applications:

| Situation | Recommendation |
|---|---|
| General web or API workload on Postgres or Oracle | Keep Read Committed; prevent lost updates with atomic updates, `FOR UPDATE` or version columns |
| General workload on MySQL | Keep Repeatable Read, but use the same lost-update patterns; consider Read Committed if gap-lock deadlocks hurt |
| Business rules that span rows (limits, quotas, scheduling) | Postgres Serializable with retries, or explicit locks on every engine |
| Reports that must be internally consistent | A read-only transaction at Repeatable Read (Postgres, MySQL) or `SET TRANSACTION READ ONLY` (Oracle) |
| Multi-document changes in MongoDB | Redesign to single-document where possible; otherwise `withTransaction` with `snapshot` and `majority` |
| AEM repository writes | Short-lived resolver, refresh, commit, retry on conflict |

Changing the global default is rarely the right fix. Raise isolation for the specific transactions that need it, and make sure your code retries.

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| Assuming the same default on every engine | Code that's safe on Postgres loses updates on MySQL | Check the default; test concurrency explicitly |
| Read in one transaction, write in another | Lost updates regardless of isolation level | Atomic update, `FOR UPDATE` or a version check |
| Trusting Oracle Serializable to enforce cross-row rules | Write skew; rule violated with no error | Lock the rows involved or enforce with a constraint |
| No retry on `40001`, deadlock or `ORA-08177` | Random user-facing errors under load | Retry the whole transaction with backoff and jitter |
| Side effects inside a retried transaction | Duplicate emails, payments or messages | Do them after commit, or use an outbox |
| Long transactions around remote calls | Bloat, undo growth, `ORA-01555`, lock waits | Fetch remote data first; keep transactions to milliseconds |
| `idle in transaction` connections | Vacuum blocked; locks held indefinitely | `idle_in_transaction_session_timeout`; fix pool leaks |
| MongoDB transactions as the default tool | Hitting the 60-second limit; cache pressure | Model for single-document atomicity first |
| Long-lived JCR sessions in services | Stale reads, `OakState0001` conflicts | One resolver per unit of work; refresh before writing |
| Expecting atomicity across JCR and a database | Partial writes after failures | Idempotency keys, events and reconciliation |

## Closing thought

Isolation levels aren't a dial you turn up for safety. They're a contract that each engine interprets in its own way, and none of the defaults protect you from the most common bug, the lost update. Learn what your engine's default really does, prevent lost updates in the code that matters, keep transactions short, and treat retries as normal. The same thinking applies whether you're writing SQL, a MongoDB transaction or a Sling servlet that commits to the JCR.

Reading query plans is the natural next step once your transactions are correct: see [reading query plans across engines]({{ '/blog/2026/11/reading-query-plans-postgresql-mysql-oracle-mongodb/' | relative_url }}). If you're chasing a concurrency bug in an AEM integration or a database behind it, [get in touch](/contact/).

### References

- [Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html) (PostgreSQL documentation)
- [Transaction Isolation Levels](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html) (MySQL 8.4 Reference Manual)
- [Data Concurrency and Consistency](https://docs.oracle.com/en/database/oracle/oracle-database/23/cncpt/data-concurrency-and-consistency.html) (Oracle Database Concepts)
- [Transactions](https://www.mongodb.com/docs/manual/core/transactions/), [Read Concern](https://www.mongodb.com/docs/manual/reference/read-concern/) and [Write Concern](https://www.mongodb.com/docs/manual/reference/write-concern/) (MongoDB manual)
- [Oak: Dos and Don'ts](https://jackrabbit.apache.org/oak/docs/dos_and_donts.html) (Apache Jackrabbit Oak)
- [Serializable Snapshot Isolation](https://wiki.postgresql.org/wiki/SSI) (PostgreSQL wiki)

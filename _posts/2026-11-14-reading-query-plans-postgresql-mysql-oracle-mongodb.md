---
layout: post
title: "Reading query plans side by side: PostgreSQL, MySQL, Oracle, MongoDB and Oak"
seo_title: "Reading Query Plans: Postgres, MySQL, Oracle, MongoDB"
description: "How to read EXPLAIN ANALYZE in PostgreSQL and MySQL, DBMS_XPLAN in Oracle, explain executionStats in MongoDB and Oak's Explain Query in AEM, side by side."
ai_summary: "Every database answers the same questions in its query plan: how each table or collection is accessed, how many rows the optimiser expected against how many it actually processed, how data is joined, and where time, I/O, sorting and spills happen. This post shows how to get and read actual plans in PostgreSQL (EXPLAIN ANALYZE, with buffers by default since version 18), MySQL 8 (EXPLAIN, FORMAT=TREE and EXPLAIN ANALYZE), Oracle (EXPLAIN PLAN, DBMS_XPLAN.DISPLAY_CURSOR with ALLSTATS LAST), MongoDB (explain with executionStats) and Oak on AEM (Explain Query, index cost and traversal), with a translation table, a repeatable tuning workflow and common mistakes."
date: 2026-11-14 14:00:00 +0530
category: databases
tags: [Query Optimisation, PostgreSQL, MySQL, Oracle, MongoDB, AEM]
---

"The query is slow" is where most performance tickets start, and it's the least useful sentence in them. Slow because it scans ten million rows? Because the optimiser expected 12 rows and got 400,000? Because a sort spilled to disk, or a nested loop ran a lookup 50,000 times? The query plan answers all of these, and on almost every slow-query review I've done, the answer was in the plan before anyone touched an index.

The trouble is that each engine prints its plan differently: an indented tree in PostgreSQL, a table or tree in MySQL, a numbered grid in Oracle, a JSON document in MongoDB, and a single line of text in Oak. Once you know they're all answering the same questions, switching between them gets much easier.

This post reads plans for the same kind of query across PostgreSQL, MySQL 8, Oracle, MongoDB and Oak. It's part of a database series; the companion piece on [indexing across engines]({{ '/blog/2026/11/database-indexing-postgresql-mysql-oracle-mongodb-oak/' | relative_url }}) covers the fixes you'll usually apply once a plan has told you what's wrong.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **Always get the actual plan, not just the estimate.** `EXPLAIN ANALYZE` (PostgreSQL, MySQL 8), `DBMS_XPLAN.DISPLAY_CURSOR` with `ALLSTATS LAST` (Oracle), `explain("executionStats")` (MongoDB), and Explain Query with execution in AEM.
- **The most useful single check is estimated rows against actual rows.** A large gap means the optimiser was guessing, and a bad plan usually follows from a bad guess.
- **Then look at the access path:** full scan or index, and whether filters are applied in the index or after fetching rows.
- **Then look for the expensive operators:** sorts that spill, hash joins with many batches, nested loops with huge loop counts, `Using temporary; Using filesort`, `SORT` stages and Oak traversal.
- **Analyse runs the statement.** Wrap DML in a transaction and roll back, and be careful on production.
- **In AEM, Oak's plan line tells you which index was chosen and which restrictions it handled.** Anything not in the index part of the plan is filtered in memory, and traversal is never acceptable on a real query.

## The five questions every plan answers

Whatever the engine, I read a plan with the same five questions:

| Question | What to look for | Why it matters |
|---|---|---|
| 1. How is each table or collection accessed? | Full scan, index range scan, index-only or covered | Scanning everything is the most common root cause |
| 2. How many rows did it expect, and how many did it get? | Estimate vs actual, per operator | Bad estimates lead to bad join methods and orders |
| 3. How are rows combined? | Nested loop, hash join, merge join, lookup | Wrong method for the data volume is expensive |
| 4. Where does the work go? | Time, buffers or logical reads, keys and documents examined | Shows the operator to fix |
| 5. What extra work happens after access? | Sorts, spills, filters after fetch, temporary tables | Often fixable with a better index |

The example throughout is the kind of query every application has: a customer's recent paid orders.

```sql
SELECT o.id, o.placed_at, o.total
FROM   orders o
WHERE  o.customer_id = 1234
AND    o.status = 'PAID'
ORDER  BY o.placed_at DESC
LIMIT  20;
```

## PostgreSQL: EXPLAIN (ANALYZE)

### Getting the plan

`EXPLAIN` shows the estimated plan. `EXPLAIN ANALYZE` runs the statement and adds actual timings and row counts. Since PostgreSQL 18, the [documentation](https://www.postgresql.org/docs/current/using-explain.html) notes that "the `ANALYZE` option implicitly enables the `BUFFERS` option"; on older versions, ask for it explicitly with `EXPLAIN (ANALYZE, BUFFERS)`.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.id, o.placed_at, o.total
FROM   orders o
WHERE  o.customer_id = 1234 AND o.status = 'PAID'
ORDER  BY o.placed_at DESC
LIMIT  20;
```

A healthy plan, in PostgreSQL 18 format (illustrative, trimmed):

```text
Limit  (cost=0.43..41.87 rows=20 width=28) (actual time=0.038..0.104 rows=20.00 loops=1)
  Buffers: shared hit=23
  ->  Index Scan Backward using orders_customer_placed_idx on orders o
        (cost=0.43..760.21 rows=367 width=28) (actual time=0.037..0.099 rows=20.00 loops=1)
        Index Cond: (customer_id = 1234)
        Filter: (status = 'PAID'::text)
        Rows Removed by Filter: 3
        Index Searches: 1
        Buffers: shared hit=23
Planning Time: 0.190 ms
Execution Time: 0.127 ms
```

### Reading it

- **Read inside out.** The most indented node runs first and feeds its parent. Here the index scan feeds the `Limit`.
- **`cost=startup..total`** is in arbitrary planner units, for comparing plans of one query only.
- **`rows` in the cost part is the estimate; `rows` in the actual part is reality.** In PostgreSQL 18 actual rows show two decimals because they're **per-loop averages**.
- **`loops` multiplies.** The docs are explicit: "Multiply by the `loops` value to get the total time actually spent in the node." A node with `actual time=0.05` and `loops=40000` cost two seconds.
- **`Index Cond` vs `Filter`.** `Index Cond` is applied while walking the index; `Filter` is applied after fetching each row. A large `Rows Removed by Filter` means the index isn't selective enough for the query, and a composite index such as `(customer_id, status, placed_at)` would avoid the waste.
- **`Buffers: shared hit` vs `read`.** Hits came from PostgreSQL's cache; reads came from the OS or disk. A plan that's fast when warm and slow when cold shows up here.
- **Sorts and hashes.** A `Sort` node reports its `Sort Method` and memory or disk use; a `Hash` node with more than one batch spilled to disk. Both point at `work_mem` or at an index that could deliver rows in order.

### Tips

- `EXPLAIN ANALYZE` on `INSERT`, `UPDATE` or `DELETE` really changes data. Run it inside `BEGIN; ... ROLLBACK;`.
- For production, the [`auto_explain`](https://www.postgresql.org/docs/current/auto-explain.html) module logs plans of slow statements automatically, and `pg_stat_statements` tells you which statements are worth examining in the first place.

## MySQL 8: EXPLAIN, FORMAT=TREE and EXPLAIN ANALYZE

### The traditional table

Plain `EXPLAIN` in MySQL returns one row per table access, with columns that experienced MySQL developers read at a glance:

```text
+----+-------------+-------+------+---------------------------+-----------------+---------+-------+------+----------+-----------------------------+
| id | select_type | table | type | possible_keys             | key             | key_len | ref   | rows | filtered | Extra                       |
+----+-------------+-------+------+---------------------------+-----------------+---------+-------+------+----------+-----------------------------+
|  1 | SIMPLE      | o     | ref  | idx_customer              | idx_customer    | 8       | const |  412 |    10.00 | Using where; Using filesort |
+----+-------------+-------+------+---------------------------+-----------------+---------+-------+------+----------+-----------------------------+
```

The columns that matter most:

| Column | Read it as |
|---|---|
| `type` | Access type, from best to worst roughly: `const`, `eq_ref`, `ref`, `range`, `index` (full index scan), `ALL` (full table scan) |
| `key` | The index actually chosen (`possible_keys` lists candidates) |
| `rows` × `filtered` | Estimated rows read, and the percentage expected to survive the remaining conditions |
| `Extra` | `Using index` (covering, good), `Using where` (filter after read), `Using filesort` (extra sort), `Using temporary` (temporary table) |

Here, `Using filesort` with a `ref` on `idx_customer` tells me the index finds the customer's orders but can't deliver them in date order. An index on `(customer_id, status, placed_at)` removes both the filter and the sort.

### FORMAT=TREE and EXPLAIN ANALYZE

`EXPLAIN FORMAT=TREE` shows the iterator tree MySQL actually executes, and `EXPLAIN ANALYZE` (MySQL 8.0.18 and later) runs the query and adds actuals. The [MySQL 8.4 manual](https://dev.mysql.com/doc/refman/8.4/en/explain.html) states that `EXPLAIN ANALYZE` "always uses the `TREE` output format", and reports for each iterator the estimated cost and rows, the time to first row, time per loop, rows returned and number of loops.

```text
-> Limit: 20 row(s)  (cost=45.3 rows=20) (actual time=0.95..0.97 rows=20 loops=1)
    -> Sort: o.placed_at DESC, limit input to 20 row(s) per chunk  (cost=45.3 rows=412)
         (actual time=0.95..0.96 rows=20 loops=1)
        -> Filter: (o.`status` = 'PAID')  (cost=45.3 rows=41.2) (actual time=0.07..0.88 rows=377 loops=1)
            -> Index lookup on o using idx_customer (customer_id=1234)  (cost=45.3 rows=412)
                 (actual time=0.06..0.80 rows=412 loops=1)
```

It reads like PostgreSQL: inside out, estimates next to actuals, loops to multiply. Notice the estimate of 41.2 rows after the filter against 377 actual: MySQL assumed the status filter would keep 10% of rows because it had no statistics on `status`. A histogram (`ANALYZE TABLE orders UPDATE HISTOGRAM ON status`) fixes the estimate; a better index fixes the query.

The same caveat applies: `EXPLAIN ANALYZE` executes the statement.

## Oracle: EXPLAIN PLAN and DBMS_XPLAN

### Estimated plan

The classic approach writes the plan into a plan table and formats it with `DBMS_XPLAN.DISPLAY`:

```sql
EXPLAIN PLAN FOR
SELECT o.id, o.placed_at, o.total
FROM   orders o
WHERE  o.customer_id = :cust AND o.status = 'PAID'
ORDER  BY o.placed_at DESC
FETCH FIRST 20 ROWS ONLY;

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);
```

Treat this as a **prediction**. `EXPLAIN PLAN` doesn't run the statement, doesn't peek at bind values the way a real execution does, and can show a different plan from the one the application gets.

### Actual plan with row-source statistics

What I use in practice is the plan from the cursor cache, with runtime statistics:

```sql
SELECT /*+ gather_plan_statistics */ o.id, o.placed_at, o.total
FROM   orders o
WHERE  o.customer_id = 1234 AND o.status = 'PAID'
ORDER  BY o.placed_at DESC
FETCH FIRST 20 ROWS ONLY;

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'ALLSTATS LAST'));
```

Trimmed and illustrative output:

```text
-----------------------------------------------------------------------------------------------------
| Id  | Operation                       | Name                 | Starts | E-Rows | A-Rows | Buffers |
-----------------------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT                |                      |      1 |        |     20 |      24 |
|*  1 |  VIEW                           |                      |      1 |     20 |     20 |      24 |
|*  2 |   WINDOW NOSORT STOPKEY         |                      |      1 |    367 |     20 |      24 |
|*  3 |    TABLE ACCESS BY INDEX ROWID  | ORDERS               |      1 |    367 |     21 |      24 |
|*  4 |     INDEX RANGE SCAN DESCENDING | ORDERS_CUST_DATE_IX  |      1 |    388 |     23 |       4 |
-----------------------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------
   3 - filter("O"."STATUS"='PAID')
   4 - access("O"."CUSTOMER_ID"=1234)
```

### Reading it

- **Indentation and `Id`** give the tree; the most indented child of a parent runs first.
- **`E-Rows` vs `A-Rows`** is the estimate-against-actual check. Be careful: `E-Rows` is per execution, `A-Rows` is the total across all `Starts`, so compare `E-Rows × Starts` with `A-Rows`.
- **`Buffers`** is logical reads, the closest thing to a universal cost measure in Oracle. Add `Reads` for physical I/O when you see it.
- **The predicate section is where the answers are.** `access` predicates are used to navigate an index; `filter` predicates are applied afterwards. The asterisk next to an `Id` means that operation has a predicate.
- **Look for the extras:** `SORT ORDER BY` with temporary space, `HASH JOIN` with large memory use, `NESTED LOOPS` with a very high `Starts` count on the inner side, and `Note` lines about dynamic sampling, SQL plan baselines or adaptive plans.

`STOPKEY` is the good news in this plan: Oracle reads the index in descending date order and stops after 20 rows, so no sort is needed.

### SQL Monitor and licensing

For long-running statements, Oracle's Real-Time SQL Monitoring report is the best plan visualisation I know, with per-operation time, waits and progress. It's part of the separately licensed **Oracle Tuning Pack**, so check your licences before you build it into a runbook. `DISPLAY_CURSOR` with `ALLSTATS LAST` doesn't need it, which is one reason it's my default.

## MongoDB: explain("executionStats")

### Getting the plan

`explain()` has three verbosity modes: `queryPlanner` (the chosen plan, without running it), `executionStats` (runs the winning plan and reports what it did) and `allPlansExecution` (also reports partial execution of the rejected candidates).

```javascript
db.orders.find(
  { customerId: 1234, status: "PAID" },
  { _id: 1, placedAt: 1, total: 1 }
).sort({ placedAt: -1 }).limit(20).explain("executionStats")
```

Trimmed and illustrative output for the healthy case (exact stages vary by version):

```javascript
{
  queryPlanner: {
    winningPlan: {
      stage: "LIMIT",
      inputStage: {
        stage: "PROJECTION_SIMPLE",
        inputStage: {
          stage: "FETCH",
          inputStage: {
            stage: "IXSCAN",
            indexName: "customerId_1_status_1_placedAt_-1",
            direction: "forward"
          }
        }
      }
    },
    rejectedPlans: [ ]
  },
  executionStats: {
    nReturned: 20,
    executionTimeMillis: 1,
    totalKeysExamined: 20,
    totalDocsExamined: 20
  }
}
```

### Reading it

The [explain results reference](https://www.mongodb.com/docs/manual/reference/explain-results/) defines the stages and counters. The ones I check first:

| Signal | Healthy | Problem |
|---|---|---|
| Access stage | `IXSCAN` | `COLLSCAN`: every document examined |
| `totalKeysExamined` : `totalDocsExamined` : `nReturned` | Close to 1 : 1 : 1 | Many more keys or documents than results returned |
| `SORT` stage | Absent: the index provides the order | Present: an in-memory sort, limited by memory and slower |
| Covered query | `IXSCAN` with no `FETCH` above it | `FETCH` when you only need indexed fields |
| `rejectedPlans` | Few, clearly worse | Several close candidates can lead to plan flipping |

A plan with `IXSCAN` on `{ customerId: 1 }` alone would show `totalDocsExamined` in the hundreds for 20 results, followed by a `SORT` stage. The fix follows MongoDB's Equality, Sort, Range guidance, which I cover in the [indexing post]({{ '/blog/2026/11/database-indexing-postgresql-mysql-oracle-mongodb-oak/' | relative_url }}): an index of `{ customerId: 1, status: 1, placedAt: -1 }`.

Two version-related notes. When a query runs on the slot-based execution engine, the stage tree appears under `winningPlan.queryPlan` rather than directly under `winningPlan`, so scripts that parse explain output need to handle both shapes. And for aggregation pipelines, explain returns a `stages` array, where early `$match`, `$sort` and `$limit` stages may be absorbed into the initial `$cursor` stage. Check which stages actually reached the query layer.

Schema design affects all of this as much as indexes do; see [MongoDB schema design for relational developers]({{ '/blog/2026/11/mongodb-schema-design-for-relational-developers/' | relative_url }}).

## Oak: Explain Query in AEM

### Where to find it

Oak, the repository under AEM, has a query engine with its own plans. On AEM as a Cloud Service, the **Query Performance** tool is reached through the Developer Console in Cloud Manager: pick a pod, open Queries, and you get Slow Queries, Popular Queries and **Explain Query**. Adobe's [query and indexing best practices](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/operations/query-and-indexing-best-practices) describe it in detail. On AEM 6.5 the same tool is under Tools, Operations, Diagnosis, Query Performance.

Explain Query takes JCR-SQL2 or XPath. For QueryBuilder, enable debug logging for `com.day.cq.search` to see the XPath it generates, then explain that. By default the tool plans without executing; you can include execution time and read the first page of results.

### Reading the plan

An Oak plan is a line of text with the index and its restrictions inside a comment. Adobe's example, for a query on assets under `/content/dam` filtered by title and ordered by creation date, starts like this (trimmed):

```text
[dam:Asset] as [a] /* lucene:damAssetLucene-9(/oak:index/damAssetLucene-9)
  +:ancestors:/content/dam ... */
```

In the full plan, the title restriction and the ordering on `jcr:created` also appear inside the Lucene part, which is what you want to see.

What to check:

- **The index name.** `lucene:damAssetLucene-9(...)` says which index Oak chose, and the name in brackets is its path. If you expected your custom index and see another, the cost estimates favoured the other one.
- **Restrictions with `+`.** Each `+` term is a restriction the index handles. Anything in your query that's **not** in the index part is applied by the query engine as a filter on the results, which means reading nodes you then throw away.
- **Ordering.** If the `ordering` isn't handled by the index (the property needs `ordered=true` in the index definition), Oak sorts the whole result set in memory.
- **Traversal.** A plan that says `traverse` means no index could serve the query, and Oak walks the repository. The logs say "Traversed N nodes with filter ... consider creating an index or changing the query". Adobe documents a traversal limit of 100,000 nodes, after which the query is stopped.

The Query Performance tool also gives a **Read Optimization** score: the ratio of rows scanned to results read. Adobe's guidance is that a query whose restrictions and ordering are all handled by the index "will typically score 90% or above". Slow Queries lists queries reading or scanning more than 5,000 rows.

### How it compares

Oak's plan is far less detailed than PostgreSQL's or Oracle's, with no per-operator timings or join methods, but the questions are the same: which index, which conditions it handles, what's filtered or sorted afterwards, and whether it was a full scan. I cover writing queries and index definitions that pass these checks in [JCR queries and Oak indexes for AEM performance]({{ '/blog/2026/11/jcr-queries-oak-indexes-aem-performance/' | relative_url }}).

## The translation table

| Concept | PostgreSQL | MySQL 8 | Oracle | MongoDB | Oak |
|---|---|---|---|---|---|
| Estimated plan | `EXPLAIN` | `EXPLAIN` / `FORMAT=TREE` | `EXPLAIN PLAN` + `DISPLAY` | `explain("queryPlanner")` | Explain Query (no execution) |
| Actual plan | `EXPLAIN ANALYZE` | `EXPLAIN ANALYZE` | `DISPLAY_CURSOR(..., 'ALLSTATS LAST')` | `explain("executionStats")` | Explain Query with execution |
| Full scan | `Seq Scan` | `type: ALL` | `TABLE ACCESS FULL` | `COLLSCAN` | `traverse` |
| Index used | `Index Scan`, `Bitmap Index Scan` | `key`, `type: ref/range` | `INDEX RANGE SCAN` | `IXSCAN` | `lucene:<index>` |
| Index-only | `Index Only Scan` | `Using index` | Index access with no table access | `IXSCAN` without `FETCH` | Not applicable in the same way |
| Applied in index | `Index Cond` | Key parts used (`key_len`) | `access(...)` | Index bounds | `+` restrictions |
| Applied after fetch | `Filter`, `Rows Removed by Filter` | `Using where`, `filtered` | `filter(...)` | `docsExamined` > `nReturned` | Query engine filtering |
| Extra sort | `Sort` | `Using filesort` | `SORT ORDER BY` | `SORT` stage | In-memory ordering |
| Work measure | Time, `Buffers` | Time, rows | `Buffers`, `A-Time` | Keys and docs examined | Rows scanned, Read Optimization |

## A repeatable workflow

On every slow-query investigation I follow the same steps:

1. **Find the statement that matters.** `pg_stat_statements`, MySQL's Performance Schema or slow log, Oracle AWR or `V$SQL` (AWR also needs a licence: the Diagnostics Pack), MongoDB's profiler, or AEM's Slow Queries list. Fix the query that costs the most in total, not the one someone complained about loudest.
2. **Reproduce with realistic parameters.** Plans depend on values. A customer with 20 orders and one with 200,000 can get different plans, and both are "correct".
3. **Get the actual plan.** Estimates alone hide the most common problem.
4. **Find the first operator where estimates and actuals diverge** by an order of magnitude or more. That's usually where the plan went wrong.
5. **Decide the cause:** missing or stale statistics, a missing or wrongly ordered index, a non-sargable predicate (a function or cast on the indexed column), or a query that asks for too much.
6. **Change one thing and re-check the plan.** Then check the other important queries on the same table, because a new index can change their plans too.

Statistics deserve a special mention. `ANALYZE` in PostgreSQL, `ANALYZE TABLE` and histograms in MySQL, `DBMS_STATS` in Oracle: a surprising number of "bad plans" are good plans built on stale numbers. After a bulk load or migration, gather statistics before you tune anything, a step that matters a lot in projects like [migrating Oracle to PostgreSQL]({{ '/blog/2026/11/migrating-oracle-to-postgresql/' | relative_url }}).

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| Tuning from the estimated plan only | You optimise a plan the engine doesn't actually run | Get actuals: `ANALYZE`, `ALLSTATS LAST`, `executionStats` |
| Running `EXPLAIN ANALYZE` on DML in production | Data really changes | `BEGIN; ... ROLLBACK;` or use a copy |
| Testing with different parameter values than production | A plan that's fast for you and slow for real users | Reproduce with real, skewed values |
| Ignoring `loops` and `Starts` | A cheap-looking node is executed thousands of times | Multiply per-loop numbers; compare `E-Rows × Starts` with `A-Rows` |
| Fixing a filter with a new single-column index | Index used, but rows still filtered and sorted | Composite index matching equality, sort and range |
| Stale statistics after a bulk load | Wild estimates and odd join choices | Gather statistics, then re-check |
| `EXPLAIN PLAN` in Oracle with literals instead of binds | Plan differs from the application's | `DISPLAY_CURSOR` on the real cursor |
| Ignoring MongoDB's docs-examined ratio | "It uses an index" while reading thousands of documents | Aim for keys and docs examined close to `nReturned` |
| Accepting an Oak plan without checking restrictions | Index used, but most work done by in-memory filtering | Every restriction and the ordering in the index part of the plan |

## Closing thought

Reading plans transfers between systems better than almost any other database skill. The syntax differs, but the questions don't: what was accessed, how, how many rows were expected and how many arrived, and what extra work happened afterwards. Ask those five questions and you can find the problem in an unfamiliar system in minutes.

If you have slow queries on PostgreSQL, MySQL, Oracle or MongoDB, or an AEM platform hitting traversal warnings and slow-query alerts, [get in touch](/contact/).

### References

- [Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html) (PostgreSQL documentation)
- [auto_explain](https://www.postgresql.org/docs/current/auto-explain.html) (PostgreSQL documentation)
- [EXPLAIN statement](https://dev.mysql.com/doc/refman/8.4/en/explain.html) (MySQL 8.4 Reference Manual)
- [DBMS_XPLAN](https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_XPLAN.html) (Oracle Database PL/SQL Packages and Types Reference)
- [Explain results](https://www.mongodb.com/docs/manual/reference/explain-results/) (MongoDB)
- [Query and indexing best practices](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/operations/query-and-indexing-best-practices) (Adobe Experience League)

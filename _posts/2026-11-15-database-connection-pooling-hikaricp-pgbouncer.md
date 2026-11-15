---
layout: post
title: "Database connection pooling done right: HikariCP, PgBouncer, ProxySQL, MongoDB drivers and AEM"
seo_title: "Connection Pooling: HikariCP, PgBouncer, MongoDB and AEM"
description: "How to size and run connection pools: HikariCP settings, PgBouncer modes, ProxySQL, MySQL Router, the MongoDB driver pool, serverless pitfalls and AEM's JDBC pool."
ai_summary: "Database connections are expensive and finite, so applications borrow them from a pool. This guide explains why smaller pools are usually faster, how to calculate the total connections a fleet opens, and how to configure HikariCP (fixed size, maxLifetime, leak detection). It compares PgBouncer session, transaction and statement modes and what breaks in transaction mode, covers ProxySQL, MySQL Router and RDS Proxy pinning, the MongoDB driver pool defaults, serverless pitfalls, and AEM's JDBC Connections Pool, including AEM as a Cloud Service advanced networking, secrets and autoscaling publish tiers."
date: 2026-11-15 10:00:00 +0530
category: databases
tags: [Connection Pooling, PostgreSQL, MySQL, MongoDB, AEM, Performance]
---

The most counter-intuitive fix I recommend in performance reviews is this: **make the connection pool smaller**. A team sees slow queries and "connection timeout" errors under load, so they raise the pool from 50 to 200. The database slows down further, because it's now juggling four times as many active sessions on the same CPUs and disks. Then someone adds more application instances, and the multiplication gets worse.

Connection pooling looks like plumbing, but it sets how much concurrency your database actually sees. This post covers HikariCP, PgBouncer, ProxySQL and MySQL Router, the MongoDB driver pool, serverless platforms, and the JDBC pool inside AEM, which has some unusual traps on AEM as a Cloud Service.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **A pool caps concurrency as well as saving connection setup time.** Databases do best with active sessions close to their CPU and I/O capacity, not hundreds.
- **Count the fleet, not the instance.** Total connections = instances × pool size. Autoscaling multiplies this without asking you.
- **HikariCP:** small, fixed-size pools, a short `connectionTimeout`, and `maxLifetime` below every timeout in the network path.
- **PgBouncer transaction mode** is the big PostgreSQL win, but session state (`SET`, session advisory locks, `LISTEN`, SQL `PREPARE`) breaks. Protocol-level prepared statements work with `max_prepared_statements`.
- **MySQL:** ProxySQL multiplexes; MySQL Router has pooled since 8.0.29 and shared connections since 8.0.32. RDS Proxy works until sessions get pinned.
- **MongoDB:** one `MongoClient` per application; the default `maxPoolSize` of 100 applies per server.
- **Serverless:** client outside the handler, a pool of one or two, a proxy in front.
- **AEM:** the JDBC Connections Pool needs advanced networking and secrets on AEM as a Cloud Service, and a `pool.size` sized for an **autoscaling** publish tier.

## Why pools exist, and why they also limit you

Opening a connection means a TCP handshake, usually TLS, authentication and server memory; for PostgreSQL, a whole new process. A pool opens connections once and lends them out.

| Engine | Server-side cost of a connection | Default connection limit |
|---|---|---|
| **PostgreSQL** | One backend process per connection | `max_connections` typically 100 ([docs](https://www.postgresql.org/docs/current/runtime-config-connection.html)) |
| **MySQL (InnoDB)** | One thread per connection | `max_connections` 151 |
| **Oracle** | A dedicated server process by default; shared server and Database Resident Connection Pooling (DRCP) as alternatives | Set by `PROCESSES` and `SESSIONS` |
| **MongoDB** | Memory and server resources per connection on `mongod`/`mongos` | High, but each connection still costs memory |

The pool's second job gets forgotten: it's a **concurrency limiter**. An 8-core database runs about 8 things at once. Extra queries wait inside the database, where waiting is expensive; queueing them in the application's pool is usually faster overall.

### The maths that matters

Two calculations come up in every review.

**How many connections do you need?** Little's law: connections in use = request rate × time each request holds a connection. If an API does 2,000 queries a second and each holds a connection for 5 ms, you need about **10** busy connections on average. Add headroom for bursts and you're still far below 100.

**How many connections will you open?** Multiply everything:

```text
total = app instances × pool size per instance
      = 12 pods × maximumPoolSize 20  = 240 connections
      → on a PostgreSQL server with max_connections = 200, this fails at peak
```

Now add a second service, a batch job, a reporting tool and the DBA's laptop. Make this calculation part of every capacity plan, and redo it whenever someone changes an autoscaling limit.

## HikariCP: the Java default

HikariCP is the default pool in Spring Boot and the pool I recommend for any Java application. Its defaults are sensible, and its documentation is opinionated in useful ways.

### Pool size

The [HikariCP pool sizing guide](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing) proposes a starting formula:

```text
connections = (core_count × 2) + effective_spindle_count
```

For a 4-core database server with one disk, that's 9; round to 10. Treat it as a starting point for **the whole database**, not each application instance, and then load test. On SSD-backed cloud databases, the "spindle" term is fuzzy, but the order of magnitude holds: **tens, not hundreds**.

If you have 12 application instances and the database is happy with about 40 active connections, a pool of 3 or 4 per instance is right. That feels uncomfortably small, but it works because each connection is busy for milliseconds.

### The settings I always set

HikariCP's defaults ([README](https://github.com/brettwooldridge/HikariCP)) and what I change:

| Setting | Default | My recommendation |
|---|---|---|
| `maximumPoolSize` | 10 | Calculate from the fleet total; often 5–20 |
| `minimumIdle` | Same as `maximumPoolSize` | Leave unset; HikariCP recommends a fixed-size pool |
| `connectionTimeout` | 30 s | 2–5 s for user-facing APIs; fail fast rather than queue for 30 s |
| `maxLifetime` | 30 min | A few seconds to a minute below any database, proxy or firewall connection timeout |
| `keepaliveTime` | 2 min | Keep; lower it if a NAT gateway or firewall drops idle connections sooner |
| `leakDetectionThreshold` | 0 (off) | 2–10 s in test environments; logs a stack trace for connections held too long |
| `connectionTestQuery` | none | Leave unset with JDBC4 drivers; they use `isValid()` |

In Spring Boot:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://db.internal:5432/orders
    username: orders_app
    hikari:
      pool-name: orders-pool
      maximum-pool-size: 8
      connection-timeout: 3000      # ms
      max-lifetime: 1740000         # 29 min, below a 30 min proxy timeout
      keepalive-time: 120000
      leak-detection-threshold: 5000
```

### Watch the right metrics

Watch HikariCP's **pending threads** and acquire time in Micrometer. Pool at maximum with an idle database: the pool, or something holding connections, is the bottleneck. Pool at maximum with a busy database: a bigger pool won't help. Fix the queries; my post on [reading query plans]({{ '/blog/2026/11/reading-query-plans-postgresql-mysql-oracle-mongodb/' | relative_url }}) is where I'd start.

The most common cause of pool exhaustion I find isn't load. It's **holding a connection while doing something else**, such as an HTTP call. Keep transactions short. My [transactions and isolation post]({{ '/blog/2026/11/transactions-isolation-levels-mvcc-in-practice/' | relative_url }}) covers why long transactions hurt in other ways too.

## PgBouncer for PostgreSQL

An application pool limits connections from one process. When you have many processes (lots of pods, several services, serverless functions), you also need a pool **between** them and PostgreSQL. PgBouncer is the standard choice: a lightweight proxy that accepts many client connections and maps them onto a few server connections.

![Where connection pools sit: application pools such as HikariCP or the MongoDB driver inside each instance, an optional proxy pool such as PgBouncer, ProxySQL or RDS Proxy, and the database with its connection limit]({{ '/assets/img/blog/database-connection-pooling-hikaricp-pgbouncer/01-pool-layers.svg' | relative_url }}){: width="1200" height="560" loading="lazy" decoding="async"}

### The three modes

From the [PgBouncer configuration reference](https://www.pgbouncer.org/config.html):

| Mode | Server connection returned to the pool… | Use it for |
|---|---|---|
| `session` (default) | When the client disconnects | Apps that rely on session state; mostly reduces connection setup cost |
| `transaction` | When each transaction ends | Most web and API workloads; the big multiplexing win |
| `statement` | After each statement; multi-statement transactions aren't allowed | Rare; autocommit-only workloads |

Transaction mode is what people mean when they say "put PgBouncer in front". It lets 1,000 client connections share 20 server connections, because most clients are idle between transactions.

### What breaks in transaction mode

PgBouncer's [feature map](https://www.pgbouncer.org/features.html) is explicit. In transaction mode, the next transaction may run on a different server connection, so anything tied to the session doesn't work:

- `SET` and `RESET` of session parameters (use `SET LOCAL` inside the transaction instead)
- `LISTEN`
- `WITH HOLD` cursors
- SQL-level `PREPARE` and `DEALLOCATE`
- Temporary tables that outlive a transaction (`ON COMMIT DROP` is fine)
- Session-level advisory locks (`pg_advisory_lock`; use `pg_advisory_xact_lock`)

**Prepared statements** used to be the big one, because JDBC and most drivers use protocol-level prepared statements. PgBouncer 1.21 added support for them in transaction mode, controlled by `max_prepared_statements`; the current documentation shows a default of 200. If you're running an older PgBouncer, upgrade rather than disabling prepared statements in the driver.

Also note that `server_reset_query` (by default `DISCARD ALL`) isn't used in transaction mode. Session state you set on a connection leaks to the next client. That's why the list above matters.

### A minimal configuration

```ini
[databases]
orders = host=10.0.1.20 port=5432 dbname=orders

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 2000        ; client side: cheap
default_pool_size = 20        ; server connections per user/database pair
reserve_pool_size = 5
max_prepared_statements = 200
server_idle_timeout = 600
```

`max_client_conn` can be large because client connections are cheap for PgBouncer. `default_pool_size` is the number that reaches PostgreSQL, per user and database pair, so add them up across pairs. With PgBouncer in front, keep application pools small too. Two layers of large pools just move the queue around.

Use `SHOW POOLS;` and `SHOW STATS;` on the PgBouncer admin console. A growing `cl_waiting` means clients are queuing for server connections.

Managed PostgreSQL services increasingly build a pooler in. Use it rather than running your own, but check which mode it uses and whether it supports prepared statements.

## MySQL: ProxySQL, MySQL Router and RDS Proxy

MySQL's thread-per-connection model is cheaper than PostgreSQL's process-per-connection, so small fleets often get away with application pools alone. At scale, the options are:

- **ProxySQL.** A MySQL-protocol proxy that does query routing (read/write split), caching and **multiplexing**: reusing backend connections across client connections when it's safe. Like PgBouncer's transaction mode, it disables multiplexing for a connection when session state appears, such as user variables, temporary tables or locks. Its [multiplexing documentation](https://proxysql.com/documentation/multiplexing/) lists the conditions.
- **MySQL Router.** Oracle's router for InnoDB Cluster and ReplicaSet added a connection pool in 8.0.29 and **connection sharing** in 8.0.32, controlled by `connection_sharing` and `connection_sharing_delay`. See the [connection sharing documentation](https://dev.mysql.com/doc/mysql-router/8.4/en/mysql-router-general-features-connection-sharing.html).
- **Amazon RDS Proxy.** A managed proxy for MySQL, MariaDB, PostgreSQL and SQL Server on RDS and Aurora. It multiplexes at transaction boundaries until a client does something that **pins** the session. AWS's [pinning documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy-pinning.html) is worth reading line by line: for MySQL, prepared statements, temporary tables, `GET_LOCK` and many `SET` statements pin; for PostgreSQL, `SET`, `PREPARE`, `LISTEN`, cursors and session advisory locks do. Watch the `DatabaseConnectionsCurrentlySessionPinned` metric. If most sessions are pinned, you're paying for a proxy that isn't multiplexing.

The lesson across all three: **a proxy can only share connections between clients that don't leave state behind.** Write your data access code so each transaction is self-contained, and proxies work well.

## The MongoDB driver pool

MongoDB drivers manage their own pool; there's no separate HikariCP equivalent. The defaults from MongoDB's [connection pool overview](https://www.mongodb.com/docs/manual/administration/connection-pool-overview/):

| Setting | Default | Notes |
|---|---|---|
| `maxPoolSize` | 100 | Per server the client connects to, not per cluster |
| `minPoolSize` | 0 | Raise it only if cold-start latency matters |
| `maxConnecting` | 2 | Connections being established at once; raising it risks connection storms |
| `waitQueueTimeoutMS` | 0 (no limit) | Set it so callers fail fast instead of hanging |
| `maxIdleTimeMS` | driver-specific | Close idle connections before a firewall drops them |

Three rules prevent most MongoDB connection problems:

1. **One `MongoClient` per application.** Each client has its own pool and is thread-safe. A client per request is the classic mistake.
2. **Do the multiplication.** 30 pods × `maxPoolSize` 100 × 3 replica set members is a possible 9,000 connections. Under a slow-down they can all open. Cap `maxPoolSize` to the workload.
3. **Sharded clusters add a layer.** Your app pools connections to `mongos`, and each `mongos` pools connections to every shard. Tune both sides.

```javascript
// Created once at startup and shared
const client = new MongoClient(process.env.MONGODB_URI, {
  maxPoolSize: 20,
  maxConnecting: 2,
  waitQueueTimeoutMS: 2000,
  maxIdleTimeMS: 300000,
});
```

## Serverless: where pools go to die

Each concurrent function instance has its own pool, and a spike can create hundreds of instances in seconds. A pool of 10 in each of 300 instances is 3,000 connections. What works:

- **Create the client outside the handler** so warm invocations reuse it.
- **Use a pool size of 1 or 2**; an instance usually handles one request at a time.
- **Put a proxy in front**: RDS Proxy, PgBouncer, or your managed provider's pooler.
- **Cap function concurrency** so the database's capacity is an explicit limit.

## AEM's JDBC Connections Pool

AEM has its own pool, used when components or services need a relational database: product data, form submissions, legacy lookups. It's an OSGi factory service, `com.day.commons.datasource.jdbcpool.JdbcPoolService`, and you get a `DataSource` from the `DataSourcePool` service by name. Adobe's [AEM 6.5 documentation](https://experienceleague.adobe.com/en/docs/experience-manager-65/content/implementing/developing/platform/jdbc) lists its properties:

| Property | Purpose |
|---|---|
| `datasource.name` | Name you look up with `DataSourcePool.getDataSource()` |
| `jdbc.driver.class`, `jdbc.connection.uri` | Driver and URL; the driver must be deployed as an OSGi bundle |
| `jdbc.username`, `jdbc.password` | Credentials |
| `jdbc.validation.query` | Query used to check a connection, such as `SELECT 1` |
| `default.readonly`, `default.autocommit` | Connection defaults |
| `pool.size` | Maximum connections in this pool |
| `pool.max.wait.msec` | How long a caller waits for a connection |
| `datasource.svc.properties` | Extra service properties |

### On AEM as a Cloud Service

Adobe's [SQL DataSourcePool tutorial](https://experienceleague.adobe.com/en/docs/experience-manager-learn/cloud-service/networking/examples/sql-datasourcepool) sets out the rules:

- **Advanced networking is required.** Non-HTTP connections, including JDBC, "must be proxied out of AEM". You need flexible port egress, a dedicated egress IP or a VPN configured in Cloud Manager, with a **port forward** from a port such as `30001` to your database's host and port.
- **The host is `AEM_PROXY_HOST`.** The connection URL points at the proxy, not the database.
- **No secrets in Git.** Use OSGi environment variables and secrets, set per environment in Cloud Manager or with the `aio` CLI.
- **Embed the driver** as an OSGi bundle in your `all` package.

A configuration in `ui.config` looks like this:

```json
{
  "datasource.name": "products-db",
  "jdbc.driver.class": "org.postgresql.Driver",
  "jdbc.connection.uri": "jdbc:postgresql://$[env:AEM_PROXY_HOST;default=proxy.tunnel]:30001/products",
  "jdbc.username": "$[env:PRODUCTS_DB_USER]",
  "jdbc.password": "$[secret:PRODUCTS_DB_PASSWORD]",
  "jdbc.validation.query": "SELECT 1",
  "default.readonly": true,
  "default.autocommit": true,
  "pool.size": 5,
  "pool.max.wait.msec": 2000
}
```

saved as `com.day.commons.datasource.jdbcpool.JdbcPoolService~products-db.cfg.json`.

### Sizing it for an autoscaling tier

**The AEMaaCS publish tier scales out under load**, and every publish instance gets its own pool. With a large `pool.size`, your database sees a surge of connections exactly when traffic peaks. My rules:

- **Keep `pool.size` small** (often 3–5) and set `pool.max.wait.msec` to a couple of seconds so requests fail fast rather than pile up threads.
- **Do the fleet calculation with the maximum publish count**, not the usual count, and put PgBouncer, ProxySQL or RDS Proxy in front if the numbers don't fit.
- **Don't query the database on every page render.** Cache at Dispatcher and the CDN, or call a small API over HTTP instead. My posts on [when AEM content belongs outside the JCR]({{ '/blog/2026/11/when-aem-content-belongs-outside-the-jcr/' | relative_url }}) and [caching in front of databases]({{ '/blog/2026/11/caching-in-front-of-databases-redis-cdn/' | relative_url }}) cover those patterns.
- **Always close connections** with try-with-resources. A leaked connection in an OSGi service is invisible until the pool is empty.

```java
@Reference
private DataSourcePool dataSourcePool;

public Optional<Product> findProduct(String sku) throws Exception {
    DataSource ds = (DataSource) dataSourcePool.getDataSource("products-db");
    try (Connection c = ds.getConnection();
         PreparedStatement ps = c.prepareStatement(
             "SELECT sku, name, price FROM product WHERE sku = ?")) {
        ps.setString(1, sku);
        try (ResultSet rs = ps.executeQuery()) {
            return rs.next() ? Optional.of(map(rs)) : Optional.empty();
        }
    }
}
```

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| Raising the pool size to fix slow queries | More contention in the database; everything slows | Find the slow queries; size pools to database capacity |
| Sizing per instance, ignoring the fleet | `too many connections` when autoscaling kicks in | Total = instances × pool size; plan for maximum scale |
| `maxLifetime` longer than a firewall or proxy timeout | Random "connection reset" errors after idle periods | Set `maxLifetime` and keep-alives below the shortest timeout in the path |
| Holding a connection during HTTP calls or file I/O | Pool exhaustion at modest load | Short transactions; do slow work outside them |
| A new `MongoClient` per request | Thousands of connections; memory pressure on `mongod` | One client per application, created at startup |
| Default pool sizes in serverless functions | Connection storms during spikes | Pool of 1–2, client outside the handler, a proxy in front |
| Large `pool.size` on AEMaaCS publish | Database overwhelmed when publish scales out | Small pools, a proxy, and caching or an API instead of per-render JDBC |
| Database credentials in OSGi config in Git | Secrets exposed to everyone with repo access | `$[secret:…]` with Cloud Manager environment variables |

## What I'd recommend

- **Start from the database's capacity** and work backwards to pool sizes per instance. Write the calculation down.
- **At scale, add a proxy:** PgBouncer for PostgreSQL, ProxySQL or MySQL Router for MySQL, and keep code free of session state.
- **AEM:** small pools, secrets in Cloud Manager, and caching or an API layer in preference to JDBC from publish.

## Closing thought

A connection pool is a promise about how much work you'll ask the database to do at once. Most pooling incidents I've seen came from making that promise too large. Keep pools small, count the whole fleet, keep transactions short, and the database will usually do better with less.

Chasing connection errors or sizing a database for AEM? [Get in touch](/contact/).

### References

- [About pool sizing](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing) (HikariCP wiki)
- [HikariCP configuration](https://github.com/brettwooldridge/HikariCP) (HikariCP, GitHub)
- [PgBouncer configuration](https://www.pgbouncer.org/config.html) and [features](https://www.pgbouncer.org/features.html) (PgBouncer)
- [Connection settings: max_connections](https://www.postgresql.org/docs/current/runtime-config-connection.html) (PostgreSQL documentation)
- [ProxySQL multiplexing](https://proxysql.com/documentation/multiplexing/) (ProxySQL)
- [MySQL Router connection sharing and reuse](https://dev.mysql.com/doc/mysql-router/8.4/en/mysql-router-general-features-connection-sharing.html) (MySQL)
- [Avoiding pinning an RDS Proxy](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy-pinning.html) (AWS)
- [Connection pool overview](https://www.mongodb.com/docs/manual/administration/connection-pool-overview/) (MongoDB)
- [Connecting to SQL databases](https://experienceleague.adobe.com/en/docs/experience-manager-65/content/implementing/developing/platform/jdbc) (Adobe Experience League, AEM 6.5)
- [SQL connections using JDBC DataSourcePool](https://experienceleague.adobe.com/en/docs/experience-manager-learn/cloud-service/networking/examples/sql-datasourcepool) (Adobe Experience League, AEM as a Cloud Service)

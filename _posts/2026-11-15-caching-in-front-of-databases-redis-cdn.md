---
layout: post
title: "Caching in front of databases: Redis, CDNs, invalidation and stampedes (and what AEM Dispatcher already taught us)"
seo_title: "Caching in Front of Databases: Redis, CDN, Invalidation"
description: "Caching in front of databases: cache-aside and write-through with Redis, invalidation, stampede protection, CDN caching for APIs and lessons from AEM Dispatcher."
ai_summary: "Caching in front of a database trades freshness for speed and resilience, so the design work is in deciding what may be stale and for how long. The post covers the layers (browser, CDN, application memory, Redis or Valkey, the database's own buffer cache), the patterns (cache-aside, read-through, write-through, write-behind, refresh-ahead), invalidation by TTL, delete-on-write, versioned keys and change data capture, the race that leaves stale data after a delete, and stampede protection with locks, jitter, probabilistic early refresh and stale-while-revalidate. It explains CDN caching for API responses with surrogate keys, Redis operational choices such as eviction policy and licensing, and maps each idea to AEM Dispatcher's statfile invalidation, grace period and serve-stale-on-error."
date: 2026-11-15 13:20:00 +0530
category: databases
tags: [Caching, Redis, CDN, Performance, AEM, Dispatcher]
---

"Just put Redis in front of it" is the most common performance fix I hear proposed, and one of the most commonly regretted. It usually works on day one. Then a price change takes an hour to appear, a deploy empties the cache and the database falls over under the reload, and someone discovers that the cache has been serving one customer's basket to another.

None of that is Redis's fault. A cache is a copy of data that's allowed to be wrong for a while. The engineering is in deciding **which data, how wrong, and for how long**.

If you work with AEM, you already know most of this, because Dispatcher is a well-designed cache in front of a content repository. I'll draw that parallel throughout, because the lessons transfer in both directions.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **Fix the query before you cache it.** A missing index cached is still a missing index, waiting for the next cache miss.
- **Cache-aside with a TTL is the right default.** Read from the cache, fall back to the database, populate the cache. Every entry expires, always.
- **Invalidate by deleting, not updating,** and do it after the database transaction commits. Keep a TTL as the safety net for the deletes you'll miss.
- **Versioned keys** (a generation number in the key) invalidate whole groups at once. It's exactly how Dispatcher's `.stat` files work.
- **Protect against stampedes:** single-flight locks, jittered TTLs, probabilistic early refresh, and serving stale while revalidating.
- **Use the CDN for public API responses,** with `s-maxage` and `stale-while-revalidate`, and surrogate keys if you need targeted purges.
- **Never cache personalised data under a shared key.** Put the user or tenant in the key, or don't cache it in shared layers at all.
- **Run Redis as a cache, not a database:** `maxmemory` set, an eviction policy chosen, and the application working (slowly) when Redis is down.

## The layers

![Caching layers in front of a database: browser, CDN, application memory, Redis or Valkey, and the database buffer cache, with typical TTLs and invalidation for each, and the AEM equivalent of each layer]({{ '/assets/img/blog/caching-in-front-of-databases-redis-cdn/01-cache-layers.svg' | relative_url }}){: width="1200" height="600" loading="lazy" decoding="async"}

A read can be answered at any of these layers, and each has a different cost and freshness model:

| Layer | Shared by | Typical latency | How it's invalidated | AEM equivalent |
|---|---|---|---|---|
| **Browser** | One user | Zero network | `Cache-Control: max-age`, can't be purged | Same |
| **CDN** | Everyone at a point of presence | Tens of ms | TTL, purge API, surrogate keys | Adobe-managed CDN |
| **Application memory** (Caffeine, Guava, a `Map`) | One process | Nanoseconds | TTL, size limit, local events | Sling Model caching, OSGi service caches |
| **Distributed cache** (Redis, Valkey, Memcached) | All app instances | Sub-millisecond to ~1 ms on a local network | TTL, explicit delete, versioned keys | Dispatcher (files on disk, per publish) |
| **Database buffer cache** | All queries | In-database | Automatic | Oak's caches and segment cache |

Two notes on the bottom row. PostgreSQL's shared buffers and InnoDB's buffer pool cache **pages**, not query results, so a well-indexed query on a warm database is often fast enough without any cache at all. MySQL removed its **query cache** in 8.0 because it scaled badly under writes; Oracle still offers a server-side result cache (`RESULT_CACHE`), which is worth knowing about for read-mostly lookup data. Check your query plans first ([reading query plans]({{ '/blog/2026/11/reading-query-plans-postgresql-mysql-oracle-mongodb/' | relative_url }})) and your indexes ([indexing across engines]({{ '/blog/2026/11/database-indexing-postgresql-mysql-oracle-mongodb-oak/' | relative_url }})). On projects I review, a surprising number of "we need Redis" conversations end with a composite index.

## The patterns

| Pattern | How it works | Good for | Watch out for |
|---|---|---|---|
| **Cache-aside** (lazy loading) | App reads cache; on miss, reads DB and writes cache | Most read-heavy data | First request after expiry is slow; stampedes |
| **Read-through** | Cache library loads from DB on miss | Same as cache-aside, less code | Ties the cache to the data access layer |
| **Write-through** | App writes DB and cache together | Data read immediately after write | Caches data nobody reads; two writes to keep consistent |
| **Write-behind** (write-back) | App writes cache; cache writes DB later | Very high write rates, counters | Data loss if the cache fails before flushing |
| **Refresh-ahead** | Refresh hot keys before they expire | Predictable hot keys (home page data, config) | Refreshes things nobody asks for any more |

My recommendation for almost every application: **cache-aside with a TTL, delete on write.** Add refresh-ahead for a handful of known hot keys. Use write-behind only for data you can afford to lose, such as view counters, and never for orders or payments.

### Cache-aside in code

```python
import json, random, time, redis

r = redis.Redis(host="cache", port=6379, socket_timeout=0.05)

PRODUCT_TTL = 300  # seconds

def get_product(product_id: int) -> dict:
    key = f"product:v1:{product_id}"
    try:
        cached = r.get(key)
        if cached is not None:
            return json.loads(cached)
    except redis.RedisError:
        pass  # cache down: fall through to the database, don't fail the request

    product = db.fetch_product(product_id)        # one indexed query
    if product is None:
        return None

    try:
        ttl = PRODUCT_TTL + random.randint(0, 60)  # jitter, see stampedes
        r.set(key, json.dumps(product), ex=ttl)
    except redis.RedisError:
        pass
    return product
```

Four details in there matter more than they look:

- **A short socket timeout.** If Redis is slow, a 50 ms timeout and a database read beats a request hanging for seconds.
- **Cache failures are swallowed.** The cache is an optimisation. Your application should still work, more slowly, without it. Test that.
- **A version in the key** (`v1`). When the cached shape changes in a deploy, bump it, and old entries simply expire unread.
- **Jittered TTLs,** so thousands of keys written at the same moment don't all expire at the same moment.

## Invalidation

### Strategy 1: TTL only

Let entries expire and accept staleness up to the TTL. This is the simplest, most robust strategy, and for a surprising amount of data it's all you need: reference data, catalogue descriptions, configuration, anything where "up to five minutes old" is acceptable to the business. **Ask the business** what staleness is acceptable per data type; the answer is rarely "zero" once they see the cost.

It's also exactly what AEM as a Cloud Service does at the CDN: publishing doesn't purge the CDN, so HTML freshness is a TTL decision. I explain that in detail in [Dispatcher on AEM as a Cloud Service]({{ '/blog/2026/11/dispatcher-on-aem-as-a-cloud-service-caching-and-invalidation/' | relative_url }}).

### Strategy 2: delete on write

When the application changes a row, delete the matching cache key so the next read reloads it.

```python
def update_price(product_id: int, price: Decimal):
    with db.transaction():
        db.execute("UPDATE product SET price = %s WHERE id = %s", (price, product_id))
    # after commit, not inside the transaction
    r.delete(f"product:v1:{product_id}")
```

**Delete, don't update.** Writing the new value into the cache from the write path invites races between two writers. Deleting is idempotent: the worst case is one extra database read.

**Delete after commit.** If you delete before the transaction commits, a concurrent reader can reload the old value from the database and put it back in the cache, where it stays until the TTL. That's the most common "the cache is wrong and nobody knows why" bug I find.

Even after commit, there is a narrow race: a reader that loaded the old value *before* your commit can write it to the cache *after* your delete. Mitigations, from simplest:
- **Keep a TTL on everything,** so the window is bounded.
- **Delayed double delete:** delete again a second or two later.
- **Versioned values:** store the row's `updated_at` or version column with the cached value, and use a small Lua script or `WATCH`/`MULTI` to refuse to overwrite a newer version with an older one.

The [transactions and isolation post]({{ '/blog/2026/11/transactions-isolation-levels-mvcc-in-practice/' | relative_url }}) explains why a reader can still see the old row after your update has been issued.

### Strategy 3: versioned keys (generation numbers)

Some changes invalidate a whole group: a category's product listing, every page of a search result, everything for one tenant. Deleting by pattern (`KEYS category:42:*`) is slow and dangerous on a busy Redis; `SCAN` is safer but still not atomic. Instead, put a **generation number** in the key:

```python
def category_page_key(category_id: int, page: int) -> str:
    gen = r.get(f"category:gen:{category_id}") or b"0"
    return f"category:{category_id}:g{gen.decode()}:page:{page}"

def invalidate_category(category_id: int):
    r.incr(f"category:gen:{category_id}")   # every old key is now unreachable
```

Old entries are never deleted; they become unreachable and expire by TTL. One atomic increment invalidates any number of keys.

If that sounds familiar, it should. **This is how Dispatcher's `.stat` files work.** Dispatcher doesn't delete every cached HTML file when you publish; it touches a `.stat` file, and any cached file older than the `.stat` file in its branch is treated as stale. `statfileslevel` decides how wide the group is. A generation key per category is a `.stat` file per category.

### Strategy 4: change data capture

When many applications write to the same database, delete-on-write in each application doesn't scale; someone forgets. **Change data capture (CDC)** reads the database's change log (Postgres logical replication, MySQL binlog, Oracle redo through tools like GoldenGate or Debezium, MongoDB change streams) and invalidates keys from the changes themselves. It catches writes from batch jobs and manual fixes that application-level invalidation never sees.

| Strategy | Freshness | Complexity | Use when |
|---|---|---|---|
| TTL only | Up to TTL | Lowest | Staleness acceptable |
| Delete on write | Near-immediate | Low | One application owns writes |
| Versioned keys | Near-immediate for groups | Low–medium | Lists, searches, per-tenant data |
| CDC | Seconds | High | Many writers, strict freshness |

## Stampedes

A **cache stampede** (or dogpile) happens when a hot key expires and hundreds of concurrent requests all miss at once, all run the same expensive query, and all write the same value back. On a busy site it's how a cache that was saving the database becomes the reason it falls over, and a full cache flush after a deploy or a Redis restart is the same thing on every key at once.

### Defences, in the order I add them

**1. Jittered TTLs.** Already in the code above. Stops synchronised expiry of keys written together.

**2. Single-flight (a short lock).** Only one request recomputes; the others wait briefly or get the stale value.

```python
def get_with_lock(key, loader, ttl=300, lock_ttl=10):
    value = r.get(key)
    if value is not None:
        return json.loads(value)
    lock_key = f"lock:{key}"
    if r.set(lock_key, "1", nx=True, ex=lock_ttl):   # we won: recompute
        try:
            data = loader()
            r.set(key, json.dumps(data), ex=ttl + random.randint(0, 60))
            return data
        finally:
            r.delete(lock_key)
    # someone else is recomputing: wait briefly, then retry the cache
    for _ in range(20):
        time.sleep(0.05)
        value = r.get(key)
        if value is not None:
            return json.loads(value)
    return loader()  # give up waiting; protect latency over the database
```

Inside one JVM, Caffeine's `LoadingCache` gives you single-flight per key for free; use it as a small first-level cache in front of Redis for the hottest keys.

**3. Serve stale while revalidating.** Store a "soft" expiry inside the value and a longer "hard" TTL on the key. After the soft expiry, one request refreshes in the background while everyone else still gets the old value. This is the same idea as HTTP `stale-while-revalidate`.

**4. Probabilistic early refresh.** Each reader refreshes slightly early with a probability that rises as expiry approaches (the "XFetch" approach from Vattani, Chierichetti and Lowenstein's paper on optimal stampede prevention). It spreads recomputation with no locks at all, and works well for very hot keys.

**5. Warm the few dozen keys that matter** after deploys or failovers.

Dispatcher has had answers to this for years: `/gracePeriod` stops a burst of publishes causing repeated re-rendering, and `/serveStaleOnError` returns the last good copy if publish is unavailable. Steal those ideas.

## The CDN in front of your API

For public, non-personalised data, the cheapest cache is the one that stops requests reaching your infrastructure at all. API responses can be cached at a CDN just like pages:

```http
Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=600, stale-if-error=86400
Surrogate-Key: product-123 category-42
Vary: Accept-Encoding
```

- **`s-maxage`** applies to shared caches (the CDN) and **`max-age`** to the browser. Keep the browser short so you can still change things.
- **`stale-while-revalidate`** and **`stale-if-error`** are the HTTP versions of the stampede and resilience defences above.
- **Surrogate keys** (Fastly's `Surrogate-Key`, cache tags on other CDNs, often on higher tiers) let you purge every response tagged `product-123` when that product changes, without knowing their URLs. That's delete-on-write at the edge.
- **Keep `Vary` minimal.** `Vary: Cookie` or `Vary: Authorization` effectively disables shared caching. `Vary: User-Agent` fragments it.

The same rules apply to AEM. AEM's GraphQL **persisted queries** exist precisely so that headless responses are GET requests with stable URLs that Dispatcher and the CDN can cache, and Adobe's CDN behaves as I describe in the [cdn.yaml post]({{ '/blog/2026/11/aem-cloud-service-cdn-yaml-headers-proxy-redirects/' | relative_url }}). When AEM pages call external data, such as prices or stock, from a database, the [patterns in this post about content outside the JCR]({{ '/blog/2026/11/when-aem-content-belongs-outside-the-jcr/' | relative_url }}) decide whether you cache the page, the data API, or both, at different TTLs.

## What Dispatcher already taught us

If you've run AEM, you've operated a mature cache for years. Here's the mapping:

| Dispatcher concept | General caching equivalent |
|---|---|
| Cache files on disk, filled on first request | Cache-aside |
| `.stat` files and `statfileslevel` | Versioned keys / generation numbers, invalidation scope |
| Flush on publish (activation) | Delete on write, triggered by the system of record |
| `/invalidate` globs (only HTML auto-invalidated) | Deciding which data a write affects |
| `/gracePeriod` | Debouncing invalidation bursts |
| `/serveStaleOnError` | `stale-if-error`, serving last good copy |
| `/ignoreUrlParams` | Normalising cache keys |
| `/rules` deny for personalised paths | Never caching per-user data under shared keys |
| CDN TTL via `Surrogate-Control` | `s-maxage` |
| `enableTTL` | Respecting origin expiry headers |

The lessons go both ways. Teams struggle with Dispatcher invalidation for the same reason they struggle with Redis: nobody decided how stale each type of content may be, or which writes affect which cached responses.

## Running Redis (or Valkey) as a cache

### Configuration that matters

```text
maxmemory 6gb
maxmemory-policy allkeys-lru     # or allkeys-lfu for skewed hot sets
```

- **Set `maxmemory`.** Without it, Redis grows until the operating system kills it.
- **Choose the eviction policy.** For a pure cache, `allkeys-lru` or `allkeys-lfu`. The `volatile-*` policies only evict keys with a TTL, and `noeviction` returns errors on write when memory is full; both surprise teams that mix cache data with other data.
- **Don't mix cache data with data you need to keep** (sessions, queues, rate limits) in the same instance. Different durability, different eviction. Separate instances or at least separate logical clusters.
- **Persistence is optional for a cache.** If losing the cache is survivable (it must be), you can often turn RDB/AOF off or down and avoid fork latency spikes. Plan the warm-up instead.
- **Avoid `KEYS` in production.** It blocks the server. Use `SCAN`, or better, versioned keys so you never need to enumerate.

### Redis, Valkey and licensing

In 2024 Redis moved from the BSD licence to source-available licences, which led the Linux Foundation to launch **Valkey**, a BSD-licensed fork. In 2025 Redis 8 added **AGPLv3** as an open-source option alongside its source-available licences. For caching, the two are protocol-compatible for the commands in this post, and the major clouds offer managed versions (AWS ElastiCache and MemoryDB support Valkey, for example). Let legal read the licence that applies to you, and pick the managed service your platform already supports. Both are fine caches.

### Pools and timeouts

A cache client needs a bounded pool and short timeouts, just like a database client; see [connection pooling]({{ '/blog/2026/11/database-connection-pooling-hikaricp-pgbouncer/' | relative_url }}) for sizing.

## What not to cache

- **Personalised responses under a shared key.** If the key doesn't include the user or tenant, someone else will see it. Of all caching bugs, this is the one that becomes a data protection incident.
- **Data that must be exactly right at the moment of a decision:** stock at checkout, account balances, permission checks after a role change. Read those from the database, or use very short TTLs plus explicit invalidation.
- **Things that are already fast.** A primary key lookup on a warm Postgres is often under a millisecond. A cache adds a network hop, a second failure mode and a consistency problem for little gain.

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| Caching instead of fixing a slow query | Cache misses still hurt; stampedes cause outages | Index and tune first |
| No TTL on some keys | Stale data forever after a missed delete | TTL on every key, always |
| Invalidating before commit | Old value reloaded and cached | Delete after commit; delayed double delete |
| Updating the cache from the write path | Races leave the wrong value | Delete, let readers repopulate |
| `KEYS pattern*` to invalidate groups | Redis blocks; latency spikes | Versioned keys |
| No stampede protection on hot keys | Database overload when a key expires | Single-flight, stale-while-revalidate, early refresh |
| App fails when Redis is down | Cache outage becomes full outage | Short timeouts; fall back to the database |
| No `maxmemory` or wrong eviction policy | Out-of-memory kills, or write errors | `maxmemory` plus `allkeys-lru`/`lfu` |
| User data under shared keys or public CDN headers | One user's data shown to another | User or tenant in the key; `private` headers |

## Closing thought

Caching is a business decision dressed up as a technical one. For each type of data, agree how stale it may be, what invalidates it, and what happens when the cache is empty or gone. Then implement the boring version: cache-aside, TTLs on everything, delete after commit, versioned keys for groups, and stampede protection on the handful of hot keys. Put the CDN in front of anything public.

AEM teams have been doing this with Dispatcher for over a decade. The vocabulary changes from `.stat` files to generation keys, but the thinking is the same, and it's one of the most transferable skills an AEM architect has.

If you're designing caching for an AEM platform and the services around it, or chasing stale-data bugs, [get in touch](/contact/).

### References

- [Caching patterns](https://docs.aws.amazon.com/whitepapers/latest/database-caching-strategies-using-redis/caching-patterns.html) (AWS whitepaper: Database Caching Strategies Using Redis)
- [Key eviction](https://redis.io/docs/latest/develop/reference/eviction/) (Redis documentation)
- [Redis licensing](https://redis.io/legal/licenses/) (Redis)
- [Valkey](https://valkey.io/) (Linux Foundation)
- [RFC 9111: HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111) (IETF)
- [RFC 5861: HTTP Cache-Control extensions for stale content](https://www.rfc-editor.org/rfc/rfc5861) (IETF)
- [Optimal probabilistic cache stampede prevention](https://www.vldb.org/pvldb/vol8/p886-vattani.pdf) (Vattani, Chierichetti and Lowenstein, VLDB 2015)
- [Caching in AEM as a Cloud Service](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/content-delivery/caching) (Adobe Experience League)
- [MySQL 8.0: retiring support for the query cache](https://dev.mysql.com/blog-archive/mysql-8-0-retiring-support-for-the-query-cache/) (MySQL blog)

---
layout: post
title: "Letting AI agents query your database safely: MCP servers, read-only roles, RLS and prompt injection"
seo_title: "Letting AI Agents Query Your Database Safely (MCP, RLS)"
description: "Letting AI agents and MCP servers query Postgres, MySQL, Oracle or MongoDB safely: least-privilege roles, views, row-level security, limits and auditing."
ai_summary: "Connecting an AI agent to a database through an MCP server turns every piece of text the agent reads into a potential instruction, so safety has to come from the database, not the prompt. The post explains the threat model, including the lethal trifecta of private data, untrusted content and an exfiltration channel, and two real lessons: a read-only MCP server bypassed with COMMIT, and a prompt-injected support ticket that read secrets through a privileged key. It then sets out layered controls: a dedicated identity per agent, read-only by privileges or a replica, curated views, row-level security, server-enforced timeouts and row limits, parameterised tools instead of free SQL, auditing, and human approval for writes, with examples for Postgres, MySQL, Oracle and MongoDB."
date: 2026-11-15 13:00:00 +0530
category: databases
tags: [AI Agents, MCP, Database Security, PostgreSQL, MongoDB, Row-Level Security]
---

Connecting an AI agent to a database takes about five minutes now. Install an MCP server, paste a connection string into your editor's config, and ask "how many orders did we take last week?". It works, it's impressive, and on projects I review the connection string is very often the application's own credentials, the ones that can write to every table.

That's the part worth slowing down for. An agent with database access isn't a reporting tool with a chat box on top. It's a program that **decides what to run based on text it reads**, and some of that text comes from places you don't control: support tickets, product reviews, CMS content, the database rows themselves. If the agent can be talked into running a query, the only thing that limits the damage is what its database identity is allowed to do.

This post is how I set that up. It covers the threat model, two real incidents worth learning from, and the layered controls I recommend, with examples for PostgreSQL, MySQL, Oracle and MongoDB.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **Assume the agent will eventually run whatever an attacker wants.** Prompt injection has no complete fix today. Design so that this is survivable.
- **Safety lives in the database, not in the prompt or the MCP server's "read-only" flag.** A dedicated role with `SELECT` on specific views is a control. A system prompt saying "never modify data" is a suggestion.
- **Never give an agent the application's credentials,** a superuser, Supabase's `service_role` key or anything that bypasses row-level security.
- **Read-only should mean read-only by privilege,** or better, a connection to a read replica, not a transaction mode the session can switch off.
- **Expose views, not tables.** Curate columns, mask personal data and give the model clean names and comments.
- **Use row-level security** (Postgres RLS, Oracle VPD, MongoDB views with restricted privileges) when the agent acts for a specific user or tenant.
- **Enforce limits server-side:** statement timeout, row and byte caps, connection limits, and a separate pool so an agent can't starve the application.
- **Prefer parameterised tools to free-form SQL** for anything customer-facing. Keep free SQL for internal analysts on a replica.
- **Log every query with the agent, user and conversation that caused it.**
- **Writes need a human, or a narrow, idempotent tool.** Never a general `execute_sql` with write privileges.

## The threat model

### Three ingredients

Simon Willison's description of the **[lethal trifecta](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/)** is the clearest framing I know. An agent is dangerous when it has all three of:

1. **Access to private data,** such as your database.
2. **Exposure to untrusted content,** text that an attacker can influence.
3. **A way to send data out,** an outbound channel such as a web request, an email, or simply writing into a place the attacker can read.

A database agent almost always has the first. It usually has the second without anyone noticing, because the database itself contains untrusted text: a customer's support ticket, a product review, a name field, a CMS page body. If it can write anywhere, or call any other tool that reaches the outside world, it has the third.

### Lesson one: "read-only" that wasn't

Anthropic's original reference Postgres MCP server, which was later deprecated and archived, wrapped every query in a read-only transaction. [Datadog Security Labs showed](https://securitylabs.datadoghq.com/articles/mcp-vulnerability-case-study-SQL-injection-in-the-postgresql-mcp-server/) that because it accepted multiple statements, a query starting with `COMMIT;` ended the read-only transaction, and everything after it ran with the full privileges of the connection.

The lesson isn't "that server had a bug". It's that **read-only enforced in the tool layer is only as strong as the tool's parser**. If the database role could write, the agent could write.

### Lesson two: the support ticket that read the secrets

In mid-2025, [General Analysis demonstrated](https://generalanalysis.com/blog/supabase-mcp-blog) an attack on a test Supabase project. An attacker filed a support ticket containing instructions addressed to the AI. Later, a developer asked their coding assistant, connected through the Supabase MCP server, to look at open tickets. The assistant read the ticket, followed the embedded instructions, queried a table of integration tokens and wrote them back into the ticket thread, where the attacker could read them.

All three ingredients were there: the `service_role` key bypassed row-level security, the ticket was untrusted text, and writing to the ticket table was the exfiltration channel. No component was "hacked". Every tool did exactly what it was designed to do.

These two cases shape everything below. **Assume the model will be manipulated, and make the database identity the boundary.**

## The MCP database server landscape

The [Model Context Protocol](https://modelcontextprotocol.io/) is how most agents reach databases today. The servers fall into three groups:

| Type | Examples | What the agent can do |
|---|---|---|
| **Free-form SQL or query tools** | Community Postgres and MySQL servers, vendor servers for Supabase, Neon and others | Run any statement the connection's role permits |
| **Vendor servers with guardrails** | [MongoDB MCP Server](https://github.com/mongodb-js/mongodb-mcp-server) (read-only mode, disabled tools, document and byte caps, collection-scan rejection) | Run find/aggregate and metadata operations within configured limits |
| **Curated tool servers** | [MCP Toolbox for Databases](https://github.com/googleapis/genai-toolbox) (tools defined as parameterised SQL in YAML), your own server | Call named tools with typed parameters; no free SQL |

- **Server flags are defence in depth, not the boundary.** MongoDB's `--readOnly` and `--indexCheck` are useful, but configure the database role as if they didn't exist.
- **MCP tool annotations** such as `readOnlyHint` are hints for the client, not enforcement.
- **Pin and review the server you install.** It's code running with your credentials.

On AEM projects I see the same pattern with agents that talk to AEM itself, which I cover in [coding AEM with AI agents]({{ '/blog/2026/11/coding-aem-with-ai-agents-agents-md-skills-mcp/' | relative_url }}): a service user with exactly the JCR permissions the task needs is the AEM equivalent of everything in this post. Never `admin`.

## Layer 1: a dedicated identity per agent

Every agent, and ideally every agent use case, gets its own database login. Not the application's, not a developer's, not a shared "readonly" account used by five tools.

That gives you privileges sized to the job, attribution in logs, a kill switch (lock one role without touching anything else) and separate connection limits.

```sql
-- PostgreSQL
CREATE ROLE agent_sales_analyst LOGIN PASSWORD :'pw'
  CONNECTION LIMIT 5
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

REVOKE ALL ON SCHEMA public FROM agent_sales_analyst;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;   -- default in Postgres 15+, check older versions
```

Use short-lived credentials where your platform supports them (IAM database authentication on the cloud providers, Vault dynamic secrets), and never put the password in a prompt, a skill file or a repository.

## Layer 2: read-only by privilege, preferably on a replica

There are three ways to make an agent read-only. Only two of them are real.

| Approach | Is it a boundary? |
|---|---|
| Transaction or session mode (`SET default_transaction_read_only`, `BEGIN READ ONLY`) | **No.** The session can change it back, as the `COMMIT` bypass showed. |
| Role with only `SELECT` privileges | **Yes.** The database refuses writes regardless of what SQL arrives. |
| Connection to a **read replica** | **Yes, and more.** Writes are impossible, and heavy queries don't touch the primary. |

My default for analytical agents is both: a `SELECT`-only role, connected to a replica. The replica also protects the primary's performance, which matters because agents write surprisingly heavy SQL.

```sql
-- MySQL 8: grant SELECT on specific views only
CREATE USER 'agent_sales'@'%' IDENTIFIED BY '...' WITH MAX_USER_CONNECTIONS 5;
GRANT SELECT ON reporting.v_orders_summary TO 'agent_sales'@'%';
GRANT SELECT ON reporting.v_products TO 'agent_sales'@'%';
```

```javascript
// MongoDB: a custom role with find on named collections or views only
db.getSiblingDB("admin").createRole({
  role: "agentSalesRead",
  privileges: [
    { resource: { db: "shop", collection: "orders_summary" }, actions: ["find"] },
    { resource: { db: "shop", collection: "products_public" }, actions: ["find"] }
  ],
  roles: []
});
```

Avoid the built-in MongoDB `read` role for agents. It covers every collection in the database, including the one with tokens in it.

## Layer 3: views, not tables

Agents query a small, well-named schema far better than a 400-table ERP. Views give you safety and accuracy together:

- **Column curation:** leave out secrets, tokens, password hashes and internal flags entirely.
- **Masking:** expose `left(email, 2) || '***'` or a hashed customer key rather than raw personal data.
- **Pre-joined, business-friendly shapes:** `v_orders_summary` with `order_date`, `region`, `net_amount_gbp` is far easier to query correctly than five normalised tables.
- **Comments the model can read.** Many MCP servers pass table and column comments to the model.

```sql
CREATE SCHEMA agent_api;

CREATE VIEW agent_api.v_orders_summary
WITH (security_barrier = true) AS
SELECT o.id            AS order_id,
       o.created_at::date AS order_date,
       c.region,
       c.tenant_id,
       o.status,
       o.net_amount    AS net_amount_gbp
FROM orders o
JOIN customers c ON c.id = o.customer_id;

COMMENT ON VIEW agent_api.v_orders_summary IS
  'One row per order. Amounts in GBP excluding VAT. Use for revenue and order counts.';

GRANT USAGE ON SCHEMA agent_api TO agent_sales_analyst;
GRANT SELECT ON agent_api.v_orders_summary TO agent_sales_analyst;
```

In MongoDB, a **view** defined with an aggregation `$project` stage does the same job, and you grant `find` on the view without granting anything on the underlying collection.

This is the same idea as a content model built for its consumers, which I discuss in [content modelling three ways]({{ '/blog/2026/11/content-modelling-jcr-vs-relational-vs-document-database/' | relative_url }}): shape the data for the reader, and the reader makes fewer mistakes.

## Layer 4: row-level security when the agent acts for someone

An internal analyst agent may legitimately see every region. A customer-facing assistant must see only that customer's rows, and an agent in a multi-tenant SaaS only that tenant's. That filter must not depend on the model remembering to add `WHERE tenant_id = ...`.

### PostgreSQL

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;   -- applies to the table owner too

CREATE POLICY tenant_isolation ON orders
  FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id')::bigint);
```

The agent's backend sets `app.tenant_id` from the authenticated user's session **before** handing the connection to the agent's tools, never from anything the model produces. Three details catch people out:

- **Superusers and roles with `BYPASSRLS` skip policies.** So do table owners, unless you `FORCE` it. The agent role must be none of these.
- **Views run with the owner's privileges by default,** so RLS on the base table can be bypassed through a view. On Postgres 15 and later, create views with `security_invoker = true` when you rely on RLS underneath.
- **A user-settable setting is only safe if the agent can't set it.** If the agent can run free SQL, it can run `SELECT set_config('app.tenant_id', '42', false)`. For free-SQL agents, use a database role per tenant or a connection the agent can't reconfigure; for parameterised tools, set it in your code.

### Other engines

| Engine | Mechanism |
|---|---|
| **Oracle** | Virtual Private Database (`DBMS_RLS` policies) adds predicates to every query; Real Application Security for application users. Check your edition and licensing. |
| **MySQL** | No native RLS. Use views filtered on a per-user mapping, or a database per tenant. |
| **MongoDB** | No document-level policies in the server. Use views per tenant with restricted privileges, or enforce the filter in a curated tool. |
| **Supabase** | Postgres RLS, but **never** connect an agent with the `service_role` key, which bypasses it. |

## Layer 5: limits the server enforces

Agents produce cartesian joins, `SELECT *` over hundred-million-row tables and recursive CTEs with no exit. Limits must sit where the agent can't remove them.

| Limit | PostgreSQL | MySQL | MongoDB |
|---|---|---|---|
| Statement time | `statement_timeout` on the role; also enforce in the pooler or driver | `max_execution_time` (SELECT only) | `maxTimeMS` on each operation |
| Idle transactions | `idle_in_transaction_session_timeout`, `transaction_timeout` (17+) | `wait_timeout` | Session and transaction lifetime limits |
| Rows returned | Wrap queries with `LIMIT` in the tool; cap in the server | Same | MCP server `maxDocumentsPerQuery`, `maxBytesPerQuery` |
| Connections | `CONNECTION LIMIT` on the role, a separate pool | `MAX_USER_CONNECTIONS` | Separate user and driver pool size |

```sql
ALTER ROLE agent_sales_analyst SET statement_timeout = '15s';
ALTER ROLE agent_sales_analyst SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE agent_sales_analyst SET work_mem = '16MB';
```

A caveat that matters: **role-level settings in Postgres are defaults, not ceilings.** A session can `SET statement_timeout = 0`. That's fine when the agent only calls parameterised tools, but for free-SQL agents add an outer limit the session can't change: a timeout in your MCP server or driver that cancels the query, or a pooler-level query timeout such as PgBouncer's `query_timeout`. Give agents their own pool, as described in [connection pooling with HikariCP and PgBouncer]({{ '/blog/2026/11/database-connection-pooling-hikaricp-pgbouncer/' | relative_url }}), so a burst of agent traffic can't starve the application.

Also cap the result **before** it reaches the model. Ten thousand rows in a context window is expensive, slow, and an easy way to leak far more data than the question needed.

## Layer 6: parameterised tools instead of free SQL

Free-form SQL is wonderful for an internal analyst exploring a reporting replica. For anything customer-facing, or anything that can see personal data, I recommend **named tools with typed parameters**:

```yaml
# MCP Toolbox for Databases style: the agent can call this, and nothing else
tools:
  order_status_for_customer:
    kind: postgres-sql
    source: orders-replica
    description: Status and dates of one order belonging to the signed-in customer.
    parameters:
      - name: order_number
        type: string
        description: The order number the customer quoted, e.g. A-102938.
    statement: |
      SELECT order_number, status, created_at, shipped_at
      FROM agent_api.v_customer_orders
      WHERE order_number = $1
      LIMIT 1;
```

The customer identity comes from the authenticated session and RLS, not from a parameter the model fills in. The model chooses *which* tool and *which* order number; it never writes SQL. Prompt injection can still make it call the tool with odd arguments, but the worst case is now "looked up one of the customer's own orders".

| | Free-form SQL | Parameterised tools |
|---|---|---|
| Flexibility | Any question | Questions you anticipated |
| Injection blast radius | Everything the role can see | What the tools can return |
| Query cost | Unbounded without server limits | Known and indexed |
| Best for | Internal analytics on a replica | Customer-facing, PII, writes |

A middle ground that works well: free SQL against a narrow `agent_api` schema of views on a replica, for internal users only.

## Layer 7: audit everything

You need to answer "what did the agent run, for whom, and why?" after the fact. Log at two levels:

- **In the database:** `pgaudit` or `log_statement` for the agent role in Postgres, the audit log plugins in MySQL, Unified Auditing in Oracle, the auditing feature in MongoDB Enterprise and Atlas.
- **In the agent or MCP layer:** the user, the conversation or session ID, the tool called, its arguments, the row count returned and the time taken. Correlate the two with an `application_name` or comment that carries the session ID.

```sql
-- Tag every agent connection so database logs link back to the conversation
SET application_name = 'agent:sales:conv-7f3a';
```

Review the logs regularly at first: they show which views to add and which indexes are missing ([reading query plans]({{ '/blog/2026/11/reading-query-plans-postgresql-mysql-oracle-mongodb/' | relative_url }}) helps with the second).

## Writes: humans in the loop

If an agent must change data, I follow three rules:

1. **No general write tool.** Not `execute_sql` with `INSERT/UPDATE/DELETE`. Instead, narrow tools such as `create_refund_request(order_number, reason)` that validate inputs and write to a staging table or call an API with its own business rules.
2. **Human approval for anything destructive or irreversible.** Many MCP clients support confirmation prompts; the MongoDB MCP server, for instance, requires confirmation for drops and `delete-many` by default.
3. **Never on production with a coding assistant.** Development agents get development databases. Copying production into a developer's agent workspace is a data protection incident waiting to happen.

The [transactions and isolation post]({{ '/blog/2026/11/transactions-isolation-levels-mvcc-in-practice/' | relative_url }}) is a useful read before you let anything automated write concurrently with users.

## Prompt injection: what actually helps

There's no reliable filter that detects malicious instructions in text. What helps is limiting what a successful injection can achieve:

- **Break the trifecta.** An agent that reads untrusted content should not also have an outbound channel. If the support-ticket agent can't write to tickets or call the web, a hijacked instruction has nowhere to send data.
- **Split agents by trust.** One agent reads tickets and summarises them; a different one, with different credentials, queries orders. Pass structured data between them, not free text.
- **Treat query results as data.** Tell the model so in the system prompt, but don't rely on it.
- **Keep secrets out of reachable tables.** If tokens must be in the database, put them in a schema no agent role can read.
- **Watch for unusual shapes:** queries against system catalogues, `information_schema` sweeps, or sudden large result sets from a customer-facing agent.

## Common mistakes

| Mistake | What happens | Fix |
|---|---|---|
| Agent uses the application's credentials | Any injection can write or delete anything | Dedicated role per agent |
| "Read-only" via transaction mode or server flag only | Bypassed with `COMMIT` or a `SET` | `SELECT`-only privileges, read replica |
| `service_role`, superuser or `BYPASSRLS` | Row-level security silently ignored | Least-privileged role, `FORCE ROW LEVEL SECURITY` |
| Tenant ID taken from the model | Agent reads another tenant's data | Set it from the authenticated session in code |
| Full tables exposed | Secrets and PII in the context window | Curated views in an `agent_api` schema |
| Timeouts only as role defaults | Agent turns them off | Enforce in the driver, pooler or MCP server too |
| Agent shares the application pool | Agent traffic starves the app | Separate pool and connection limit |
| Untrusted content plus outbound tool | Data exfiltration by injection | Separate agents; remove the outbound channel |

## Closing thought

The question isn't whether an agent can be tricked; it can. The question is what its database identity lets it do once it has been. If the answer is "read five curated views of one tenant's data on a replica, for fifteen seconds, with every query logged", you can let the agent loose and sleep well. If the answer is "whatever the application can do", no prompt will save you.

None of these controls are new. Roles, views, row-level security, timeouts and audit logs are what DBAs have used for decades. Agents just make them mandatory.

If you're connecting agents to production data, or to AEM, and want a review of the access design, [get in touch](/contact/).

### References

- [MCP vulnerability case study: SQL injection in the Postgres MCP server](https://securitylabs.datadoghq.com/articles/mcp-vulnerability-case-study-SQL-injection-in-the-postgresql-mcp-server/) (Datadog Security Labs)
- [Supabase MCP can leak your entire SQL database](https://generalanalysis.com/blog/supabase-mcp-blog) (General Analysis)
- [The lethal trifecta for AI agents](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/) (Simon Willison)
- [Model Context Protocol](https://modelcontextprotocol.io/) (modelcontextprotocol.io)
- [MongoDB MCP Server](https://github.com/mongodb-js/mongodb-mcp-server) (GitHub)
- [MCP Toolbox for Databases](https://github.com/googleapis/genai-toolbox) (GitHub)
- [Row security policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) (PostgreSQL documentation)
- [CREATE VIEW](https://www.postgresql.org/docs/current/sql-createview.html) (PostgreSQL documentation)
- [Client connection defaults](https://www.postgresql.org/docs/current/runtime-config-client.html) (PostgreSQL documentation)

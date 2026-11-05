---
layout: post
title: "Migrating AEM on-premise and Managed Services to AEM as a Cloud Service: an architect's playbook"
seo_title: "AEM 6.5 to AEM as a Cloud Service Migration: Architect's Guide"
description: "How to migrate AEM 6.5 on-premise or AMS to AEM as a Cloud Service: steps, tools (BPA, CAM, CTT, AI migration skill), what breaks, precautions and benefits."
ai_summary: "Moving from AEM 6.5 on-premise or Managed Services to AEM as a Cloud Service is a re-platform, not an upgrade, and most of the work is making code fit the cloud operating model. This playbook walks through assessing, planning, refactoring, migrating content and going live with Adobe's toolchain, the customisations that break most often, the precautions that matter at go-live, and how AI-assisted migration roughly halves the timeline."
date: 2026-11-03 09:00:00 +0530
category: aem-cloud-service
tags: [AEM, AEM as a Cloud Service, Cloud Migration, Architecture]
start_here: 2
start_here_why: "The playbook I use to move AEM 6.x estates to the cloud."
---

I've lost count of the AEM 6.x estates I've assessed for a move to AEM as a Cloud Service (AEMaaCS). Some were tidy, Touch UI-only codebases that moved in a few months. Others had fifteen years of customisations: Classic UI dialogs, homegrown replication agents, cron jobs writing to the file system, and Dispatcher configs nobody fully understood any more.

In 2026 the question is no longer *whether* to move but *how*. Adobe Managed Services support for classic AEM 6.5 ended on **31 August 2026**, and on-premise core support is planned to end in **February 2027**. Meanwhile the newest capabilities, including the Universal Editor, Edge Delivery Services and Adobe's AEM AI agents, are cloud-first or cloud-only.

This is the playbook I use as a solutions architect: what changes, the steps in order, the tools for each step, what works and what doesn't, the precautions that save you at go-live, and the benefits you actually get.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **It's a re-platform, not an upgrade.** AEMaaCS is the same product family running under a different operating model: immutable code, autoscaled stateless publish, Adobe-managed CDN, IMS login and continuous releases. Most of the work is making your code fit that model.
- **The journey has five phases:** assess, plan, refactor code, migrate content, go live. Code refactoring and content top-ups run in parallel.
- **Adobe's toolchain covers most of it:** Best Practices Analyzer (BPA) and Cloud Acceleration Manager (CAM) to assess; the `aio aem-migration` plugin and, new in 2026, the **AI Cloud Migration skill** with the AEM MCP Server to refactor; the Content Transfer Tool (CTT) to move content; Cloud Manager to build, test and deploy.
- **What breaks most often:** custom run modes, Sling schedulers, custom replication agents, writes to `/apps` or the file system, DAM Update Asset customisations, unversioned Oak indexes, Classic UI, and Dispatcher configs with custom Apache modules.
- **Precautions that matter most:** a proof of migration early, frequent CTT top-ups to shorten the freeze, IMS groups planned before ingestion, load testing on stage with production-sized content, and URL/redirect parity for SEO.
- **AI cuts the timeline roughly in half.** With AI-assisted refactoring, testing and validation, a small migration drops from 3–4 months to 2–3, and a large estate from 9–15 months to 4–6. That only works if network, identity and content work start in parallel from week one.
- **The pay-off:** no more upgrades, autoscaling, built-in CDN and WAF, a governed delivery pipeline, and access to everything Adobe ships next.

## Why 2026 is the deadline year

| | Date (per Adobe) | What it means |
|---|---|---|
| AEM 6.5 on **Adobe Managed Services** | Support ended by **31 Aug 2026** | AMS customers on classic 6.5 should already be on 6.5 LTS or mid-migration |
| AEM 6.5 **on-premise** core support | Planned to end **Feb 2027** | Service packs are supported until 28 Feb 2027 |
| Extended support (if approved) | Until **Feb 2028** | Critical security fixes only, on the last service pack (6.5.26.0) |
| **AEM 6.5 LTS** | Continues the 6.5 line | A supported on-prem/AMS path, but it still has upgrades, and Adobe's AEM agents aren't available there |

AEM 6.5 LTS is a legitimate stopgap if your organisation has a hard reason to stay self-hosted, such as data residency rules Adobe's cloud regions can't meet or a contract that ends at an awkward time. But it buys you time, not a destination. If you're going to touch the codebase anyway, put that effort into the cloud move.

## What actually changes

![Architecture before and after: AEM 6.5 on-premise or Managed Services compared with AEM as a Cloud Service]({{ '/assets/img/blog/aem-cloud-migration/02-before-after-architecture.svg' | relative_url }}){: width="1200" height="600" loading="lazy" decoding="async"}

The traps in a cloud migration come from a handful of architectural shifts. Understand these and every BPA finding makes sense.

1. **Code is immutable.** `/apps` and `/libs` can only change through a Cloud Manager deployment. Anything that writes there at runtime, such as a config page that saves into `/apps`, has to move to `/conf` or `/content`.
2. **Publish is stateless and disposable.** Publish pods autoscale and are rebuilt from a "golden master". Anything written on one publish node is invisible to the others and lost when the pod is recycled. User-generated content belongs in an external store.
3. **There are many pods, so there are many copies of everything.** A Sling Scheduler fires on every pod. A local file in `/tmp` exists on one pod only. Code that assumed "one author, a few publishers" needs rethinking.
4. **Deployments are blue-green.** During a deployment, old and new code run side by side against the same repository. Content structure and index changes must be backward compatible.
5. **Identity moves to Adobe IMS.** Authors log in through the Adobe Admin Console, usually federated with your IdP (Entra ID, Okta). Local author users are gone.
6. **The CDN is part of the product.** Every environment comes with an Adobe-managed CDN. Redirects, traffic filter rules, WAF rules, request transformations and origin selectors are configured as code through the config pipeline.
7. **No servers to log into.** There's no SSH, no JVM flags, no `crx-quickstart` access, and no CRXDE Lite on stage or production. You get the Developer Console, log tailing and log forwarding.
8. **Adobe releases continuously.** Maintenance releases roll out automatically and feature releases arrive monthly. Your code has to build against the current SDK and pass the AEM Analyser on every build.

## What works, what changes and what doesn't

This is the list I walk stakeholders through in the first week. It's built from BPA findings across real estates plus Adobe's documentation.

| Area | On AEM 6.5 | On AEMaaCS | Action |
|---|---|---|---|
| Sites, editable templates, Core Components, MSM, translation | ✅ | ✅ | Works largely as-is |
| Static templates | ✅ | ⚠️ Discouraged | Convert to editable templates (AEM Modernize Tools) |
| Classic UI / ExtJS / Coral 2 dialogs | ✅ | ❌ | Convert to Coral 3 Touch UI dialogs |
| Custom run modes (`config.uat`, `config.author.mumbai`) | ✅ | ❌ | Only `author`/`publish` × `dev`/`stage`/`prod`; use environment variables for the rest |
| OSGi configs in XML, hard-coded secrets | ✅ | ❌ | `.cfg.json` with `$[env:…]` and `$[secret:…]` |
| Sling Scheduler for "run once" jobs | ✅ | ⚠️ Runs on every pod | Scheduled Sling Jobs |
| Custom replication agents, reverse replication | ✅ | ❌ | Sling Content Distribution via the Replication API; UGC to an external store |
| Writes to `/apps`, `/libs` at runtime | ✅ | ❌ | Move to `/conf`, `/content` or `/var` |
| Persisting to local disk | ✅ | ❌ | Temporary use only; persist to the repository or external storage |
| DAM Update Asset workflow customisations | ✅ | ❌ | Asset microservices with processing profiles, plus post-processing workflows |
| ImageMagick/FFmpeg command-line steps | ✅ | ❌ | Asset compute workers (App Builder) |
| Custom Oak indexes | ✅ | ⚠️ | Versioned names like `acme.product-1-custom-1`; must include a `tika` node |
| Workflows on publish | ✅ | ❌ | Run on author, or move the logic out |
| AEM Communities | ✅ | ❌ | Third-party or custom service |
| Dispatcher | Any Apache module | ⚠️ Immutable files, allowed modules only | Convert to the cloud layout and validate with SDK tools |
| Outbound calls on non-standard ports, IP allow-listing, VPN | ✅ | ⚠️ | Advanced networking: flexible egress, dedicated egress IP or VPN |
| Sending email (SMTP) | ✅ | ⚠️ | Advanced networking plus Day CQ Mail Service config |
| Local author users | ✅ | ❌ | Adobe IMS users and groups via the Admin Console |
| SPA Editor | ✅ | ⚠️ Deprecated | Supported for existing sites; new work on the Universal Editor |
| AEM Forms | ✅ | ✅ Separate service | Plan it as its own workstream with its own tooling |

## The toolchain

| Tool | Phase | What it does |
|---|---|---|
| **Best Practices Analyzer (BPA)** | Assess | Package installed on the source (6.1+). Scans code and repository for cloud incompatibilities by severity (CRITICAL, MAJOR, ADVISORY, INFO) and uploads the report straight to CAM. |
| **Cloud Acceleration Manager (CAM)** | All | Adobe's migration cockpit: readiness from the BPA report, effort estimates, code refactoring guidance, content migration sets and ingestions, and go-live checks. |
| **`aio aem-migration` plugin** | Refactor | Adobe I/O CLI commands for Repository Modernizer (restructures packages into `ui.apps`/`ui.content`/`ui.config`/`all`), Dispatcher Converter and Index Converter. |
| **AEM Modernize Tools** | Refactor | Converts static templates to editable, foundation components to Core Components, and Classic dialogs to Touch UI. |
| **AI Cloud Migration skill + AEM MCP Server** (2026) | Refactor | Agent skill in your AI IDE. It reads BPA findings from CAM and fixes code one pattern at a time: schedulers, replication, event listeners, Assets API, OSGi configs, legacy dialogs, Dispatcher conversion and Oak indexes (beta). |
| **AEM as a Cloud Service SDK** | Refactor | Local quickstart and Dispatcher tools (`validate.sh`, `docker_run.sh`) that match the cloud runtime. |
| **AEM Analyser** | Refactor | Maven plugin that runs the same checks as Cloud Manager at build time. |
| **Rapid Development Environments (RDE)** | Refactor | Cloud environments you can push code to in seconds, without a pipeline. |
| **Content Transfer Tool (CTT)** | Migrate | Extracts content from the source author or publish into a migration set, then ingests it into AEMaaCS. Supports top-ups. |
| **AzCopy pre-copy** | Migrate | Copies blobs directly from an S3, Azure or File data store. Used automatically for migration sets over 200 GB. |
| **Bulk Import Service** | Migrate | Imports assets from S3 or Azure Blob into Assets. Useful for DAM-only loads from outside AEM. |
| **Cloud Manager** | Deploy | Pipelines with code quality, security and Experience Audit gates; environments; domains and certificates; advanced networking; config pipeline for CDN and log forwarding. |

### The AI Cloud Migration skill: what's real

This is the biggest change to migration tooling in years, so it's worth being precise. It's an agent skill package (`aem-cloud-service` in Adobe's `adobe/skills` repository). It runs in any AI IDE that supports agent skills and MCP. The AEM MCP Server connects it to CAM, so the agent pulls BPA findings directly.

How I use it:

1. Start with the read-only assessment. Ask the agent to *"Review my code for AEMaaCS migration"* and it writes a `migration-runbook.md` listing every affected file and pattern count. Nothing is changed.
2. Fix **one pattern per session**, for example *"Fix scheduler findings from project …"*. Changes are applied in batches of five, with a pause for review after each batch.
3. Use the **migration validation** step (beta). It deploys to the local SDK and checks bundle and component state.

It removes a lot of mechanical work, such as converting XML OSGi configs, extracting secrets into Cloud Manager variables and rewriting `ResourceChangeListener`s. It doesn't make design decisions: where UGC should live, whether a publish-side servlet should become an API, or how to restructure a 400-component library. Review every batch as you would a pull request.

## The migration, step by step

![The five phases of an AEM to AEM as a Cloud Service migration and the tools used in each]({{ '/assets/img/blog/aem-cloud-migration/01-migration-journey.svg' | relative_url }}){: width="1200" height="560" loading="lazy" decoding="async"}

### Step 1: Assess (weeks 1–4)

**Run BPA on a production clone,** not on a developer instance. Findings depend on content as well as code. Install BPA from the Software Distribution portal and generate the report with the CAM upload key. The source must reach `casstorageprod.blob.core.windows.net` for the upload, which in locked-down AMS or on-prem networks means a firewall ticket. Raise it on day one.

Then go beyond BPA. It doesn't see everything:

- **Integrations inventory.** Every outbound call: host, port, auth method, whether the target allow-lists your IP. This decides your advanced networking design.
- **Inbound integrations.** What pushes into AEM (PIM feeds, translation vendors, DAM sync) and how it authenticates. Those credentials move to IMS technical accounts or service credentials.
- **Repository health.** Total size, node store and data store size, number of assets, and Lucene index size (CTT expects **≤ 25 GB**). Run revision cleanup and data store garbage collection first.
- **Traffic baseline.** Page views and request volumes from your CDN or Dispatcher logs. AEMaaCS Sites licensing is based on content requests, so check what you're about to be billed for.
- **Custom features nobody remembers.** Search the codebase for `Scheduler`, `ReplicationAgent`, `/apps` writes, `java.io.File` and `Runtime.exec`. BPA finds most of these, but grepping takes ten minutes and builds confidence.

### Step 2: Decide the target and plan

Make three decisions before refactoring:

1. **Lift-and-shift, refactor, or re-platform the delivery tier.** A pure lift-and-shift (minimum change to pass the cloud contract) is fastest. Refactoring as you go, such as moving to Core Components or retiring dead templates, costs more now and less later. For content-led sites, consider moving delivery to **Edge Delivery Services** at the same time. I compare the options in [Edge Delivery Services vs traditional AEMaaCS](/blog/2026/11/aem-edge-delivery-services-vs-traditional-aemaacs/). My default: lift-and-shift the platform, fix what the cloud contract forces, and run EDS as a separate, phased track.
2. **Consolidation.** CTT can't merge content from several sources into one target. If you're merging two 6.5 instances, consolidate on the source side first, or plan separate programs.
3. **Program and environment model.** How many Cloud Manager programs (per brand, per region, or one)? Which regions? How many dev environments and RDEs? Who are the Cloud Manager business owners and deployment managers?

Then run a **proof of migration**: extract a representative slice (say 10% of `/content/dam` and one site) into a dev environment. This gives you real extraction and ingestion speeds to plan the freeze, and it surfaces data problems early: broken references, invalid node names, oversized nodes.

### Step 3: Refactor the code

Start with structure, then work through findings by severity.

**Restructure the repository.** AEMaaCS requires a clean split between mutable content and immutable code. The Repository Modernizer does the first pass:

```bash
npm install -g @adobe/aio-cli
aio plugins:install @adobe/aio-cli-plugin-aem-cloud-service-migration
aio aem-migration:repository-modernizer   # ui.apps / ui.content / ui.config / all
aio aem-migration:dispatcher-converter    # AMS or on-prem config to the cloud layout
aio aem-migration:index-converter         # custom Oak indexes to cloud naming
```

**Convert OSGi configs** to `.cfg.json`, scoped only by supported run modes, with environment-specific values and secrets in Cloud Manager:

```json
// ui.config/src/main/content/jcr_root/apps/acme/osgiconfig/config.publish.prod/com.acme.crm.CrmClient.cfg.json
{
  "endpoint": "$[env:CRM_API_URL]",
  "apiKey": "$[secret:CRM_API_KEY]",
  "timeoutMs": 5000
}
```

**Replace "run once" schedulers with scheduled Sling Jobs**, which execute once across the cluster instead of once per pod:

```java
jobManager.createJob("com/acme/feeds/sync")
    .schedule()
    .cron("0 0 2 * * ?")   // 02:00 daily
    .add();
```

Pair it with a `JobConsumer` for the topic, and make the job idempotent: pods restart, and jobs can be retried.

**Create service users and base structure with repoinit** instead of content packages:

```text
create service user acme-feed-service
set ACL for acme-feed-service
    allow jcr:read,rep:write on /content/dam/acme/feeds
end
```

**Fix the rest of the BPA list:**

- custom replication agents to the Replication API (Sling Content Distribution) or the Publish Content Tree workflow;
- DAM Update Asset steps to processing profiles and post-processing workflows;
- Oak indexes to versioned `-custom-N` names;
- Classic UI to Touch UI;
- outbound connections to advanced networking.

**Validate Dispatcher locally** before Cloud Manager tells you about it 30 minutes later:

```bash
./bin/validate.sh ./dispatcher/src
./bin/docker_run.sh ./dispatcher/src host.docker.internal:4503 8080
```

Throughout, build with the **AEM Analyser** and the latest SDK, and iterate on an **RDE**. A full-stack pipeline run takes tens of minutes, and you'll run hundreds.

### Step 4: Set up the cloud platform

This runs in parallel with refactoring and is often on the critical path, because it involves other teams:

- **IMS and SSO.** Claim your domain in the Admin Console and federate with your IdP. Create IMS groups that mirror the AEM groups you're keeping. CTT ingestion generates bulk-upload files for groups and users to help.
- **Advanced networking.** Choose flexible port egress, a dedicated egress IP, or VPN. You get one configuration per program, so decide once, before integrations testing.
- **CDN.** Decide whether the Adobe CDN fronts traffic directly or sits behind your own Akamai, Cloudflare or Fastly. If it's your own, configure the `X-Forwarded-Host` and `X-AEM-Edge-Key` headers. Move edge redirects and security rules into config-pipeline YAML.
- **Log forwarding** to Splunk, Datadog, Elastic or similar, so operations teams keep their dashboards.
- **Domains and certificates** in Cloud Manager, ready for the DNS switch.

A starting traffic filter rule. Run it in `log` mode first, tune from real traffic, then switch to `block`:

```yaml
kind: "CDN"
version: "1"
metadata:
  envTypes: ["dev", "stage", "prod"]
data:
  trafficFilters:
    rules:
      - name: limit-requests-per-ip
        when:
          reqProperty: tier
          equals: "publish"
        rateLimit:
          limit: 100
          window: 10
          penalty: 300
          count: all
          groupBy:
            - reqProperty: clientIp
        action: log
```

### Step 5: Migrate content with the Content Transfer Tool

![Content migration timeline: proof of migration, full extraction, validation, production ingestion, top-ups, content freeze and go-live]({{ '/assets/img/blog/aem-cloud-migration/03-content-migration-timeline.svg' | relative_url }}){: width="1200" height="440" loading="lazy" decoding="async"}

How CTT works: **extraction** copies content from the source into a cloud-hosted **migration set**, and **ingestion** loads a migration set into a target environment. One extraction can be ingested into several environments.

The rules that shape the plan, from Adobe's documentation:

- **Source:** AEM 6.3 or later, Java 8+, CTT 2.0+ (3.x recommended). Older versions must upgrade first.
- **1:1 tiers:** install CTT on the source author to migrate to author, and on the source publish to migrate to publish. Alternatively, ingest author everywhere and publish from the cloud author.
- **Disk:** the source needs free space of roughly data store size plus 1.5 × node store size (the data store counts as 64 GB at most), unless you pre-copy.
- **Large repositories:** from CTT 2.0.16, migration sets over **200 GB** automatically use the AzCopy **pre-copy** for blobs. Run data store garbage collection in the previous seven days and give it a single migration set.
- **Migration sets:** at most **10 per CAM project**, including expired ones. They expire after a prolonged period of inactivity. Extraction keys last **14 days** and can be renewed.
- **Wipe vs top-up:** the first ingestion should use **wipe** (it's faster). Top-ups transfer only deltas: extract with overwrite off and ingest with wipe off. Top-ups fail if content *structure* changed since the initial extraction. With versions included and wipe off, version purging must be disabled.
- **Restricted paths:** `/apps`, `/libs`, `/home` and most of `/etc` can't be migrated. Code comes from the pipeline, and users come from IMS.
- **Users aren't migrated; groups are.** Only groups referenced in ACLs or CUGs on migrated content come across, and they must be recreated in IMS. Users are created automatically on first IMS login.
- **Author is unavailable during author ingestion**, and you can't run pipelines then. Publish keeps serving.

The sequence I recommend:

1. Proof of migration in dev, timing every step.
2. Full extraction from production with pre-copy, ingested into stage with wipe. Validate page counts, asset counts, references, ACLs and a sample of renditions.
3. Ingest the **same** migration set into production. Don't re-extract.
4. **Top-ups weekly**, then daily as go-live approaches, so the final delta is small.
5. Content freeze, final top-up into stage and prod, smoke test, go live.

### Step 6: Test like it's a new platform, because it is

- **Functional regression** with your existing suites, plus Cloud Manager custom functional tests and UI tests (Cypress, Selenium or WebdriverIO) so they run on every deployment.
- **Author UAT.** IMS login, permissions, workflows, MSM rollouts and translation all behave slightly differently. Authors find what tests don't.
- **Load testing on stage** with production-sized content and realistic traffic shapes, including cache-miss scenarios. Watch CDN cache hit ratio, publish response times and author performance under concurrent editing.
- **Security testing** within Adobe's published policy, plus verification of your traffic filter and WAF rules.
- **SEO parity.** Crawl old and new sites and diff status codes, canonicals, titles, hreflang, structured data and sitemaps. Every changed URL needs a `301`.

### Step 7: Go live

- **Freeze authoring** on the source (lock it or remove permissions; don't rely on an email).
- **Final top-up** into stage and production, then smoke test.
- **Pre-warm the CDN cache** by crawling key pages if you expect a traffic spike.
- **Lower DNS TTLs** in advance, then switch DNS (CNAME to `cdn.adobeaemcloud.com`) or re-point your BYO CDN origin.
- **Watch** CDN logs, publish error rates, 404s and Core Web Vitals for the first 72 hours, with a rollback plan: the source stays intact until you're confident.

### Step 8: After go-live

Run a hypercare period of two to four weeks. Then decommission the source environment (archive a final backup) and end the AMS or hosting contract. After that, invest in what the cloud enables: CDN-level redirects and rate limits, the Universal Editor, Edge Delivery Services for selected sites, and Adobe's AEM agents.

## On-premise vs Managed Services: what differs

The phases are identical, but the starting point isn't.

| | From on-premise | From Adobe Managed Services |
|---|---|---|
| **Cloud Manager** | New to the team: pipelines, quality gates and roles all need onboarding | Familiar; teams already deploy through AMS Cloud Manager |
| **Dispatcher** | Often heavily customised, with arbitrary modules; most effort | AMS layout is closer to the cloud layout; the converter handles much of it |
| **Network access for CTT and BPA** | Corporate firewall changes, proxies, sometimes SSL interception (CA import needed) | Raise an AMS ticket for outbound access to Azure blob storage |
| **Data store** | Often File Data Store on SAN or NAS; check disk headroom for pre-copy | Usually S3 or Azure; pre-copy needs read keys or a SAS URI, and egress costs apply |
| **Contract timing** | Align with hardware or hosting renewals | Align with the AMS contract end; with classic 6.5 support already ended, timing is pressing |
| **Operations handover** | Your ops team loses servers and gains Cloud Manager, logs and CDN config | AMS CSE relationship changes; clarify who owns what under AEMaaCS support |

## Precautions: the things that bite at go-live

These come from real programmes, not the documentation.

1. **Start the firewall and IMS work in week one.** BPA uploads, CTT extraction, SSO federation and advanced networking all need other teams. They're on the critical path more often than code is.
2. **Clean the repository before you migrate it.** Purge old versions, audit logs, orphaned assets and dead sites. Every gigabyte you don't move is time off your freeze window.
3. **Don't change content structure between the initial extraction and go-live.** Top-ups can't handle moved or restructured trees. If a big restructuring is planned, do it before the full extraction or after go-live.
4. **Plan IMS groups before the first production ingestion.** Ingested groups aren't usable until they exist in IMS with the same names and members.
5. **Make everything idempotent and pod-safe.** Jobs retry, pods restart, and two code versions coexist during deployments. Code that "only runs once" will eventually run twice.
6. **Treat indexes as code with versions.** A changed index definition means a new `-custom-N` version, and reindexing a large repository takes time. Don't change indexes in the last sprint before go-live.
7. **Budget for Asset reprocessing.** Migrated assets keep their renditions. Any new processing profiles or Dynamic Media setup apply only on reprocessing, which takes time at scale.
8. **Watch for hard-coded hostnames, file paths and IPs.** `localhost:4503`, `/mnt/crx/...` and partner allow-lists of your old egress IPs are all common.
9. **Protect SEO.** Same URLs, or a complete `301` map. Same canonicals, `robots.txt` and sitemaps. A re-platform is the moment rankings are most at risk. (More in [What actually matters in SEO](/blog/2026/11/what-actually-matters-in-seo/).)
10. **Don't let the cloud move become a redesign.** Scope creep ("while we're at it, let's rebuild the header") is the most common reason migrations miss dates. Run redesigns as a separate track.
11. **Keep the source alive and frozen, not deleted,** until hypercare ends.
12. **Validate CTT ingestions with numbers,** not eyeballing: node counts, asset counts, page counts per site, and a reference-integrity check.

## The benefits, honestly

**What you really get:**

- **No more upgrades.** No 6.4-to-6.5-style projects ever again. Adobe ships maintenance releases continuously and features monthly. You still own compatibility (your build must pass the current SDK and AEM Analyser), but the six-month upgrade programme is gone.
- **Autoscaling.** Publish scales with traffic. Product launches and campaign spikes stop being capacity-planning exercises.
- **A built-in CDN and edge security.** Traffic filter rules, rate limiting and, with the right licence, WAF rules are configured as code and deployed by pipeline.
- **A governed delivery pipeline.** Every release passes code quality, security and performance gates, and deployments are blue-green with no downtime.
- **Security and compliance posture.** Adobe patches the stack; you no longer chase JVM, OS or Apache CVEs.
- **Access to what's next.** The Universal Editor, Edge Delivery Services, Content Hub, Dynamic Media with OpenAPI, AEM Sites Optimizer and Adobe's AEM AI agents are cloud-first or cloud-only.
- **Lower operational load.** Fewer servers, fewer on-call pages, and backups and disaster recovery handled by Adobe.

**What you give up, or pay for differently:**

- Direct server access, JVM tuning and arbitrary Apache modules.
- Some legacy features (Classic UI, Communities, publish-side workflows).
- Licensing based on content requests (Sites) or users (Assets) rather than infrastructure. Model this from real traffic early.
- A faster release cadence on Adobe's side, which means you need automated regression tests to keep up.

## How long does it take?

From the programmes I've been involved in, assuming a competent team and no redesign:

| Estate | Traditional delivery | AI-assisted delivery |
|---|---|---|
| Single site, Touch UI, modest customisation, under 500 GB | 3–4 months | **2–3 months** |
| Multi-site, moderate customisation, several integrations, 1–5 TB | 6–9 months | **3–5 months** |
| Multi-brand global estate, heavy legacy, Classic UI, 10 TB+ | 9–15 months | **4–6 months** |

The AI-assisted figures assume two things. First, AI is used across the whole delivery, not only for code fixes. Second, the work AI can't speed up starts in week one and runs in parallel: network approvals, IMS and SSO setup, partner allow-lists, and content migration rehearsals. Without that parallelism you save engineering effort but not calendar time, because the critical path simply moves to those tasks.

## How AI shortens the migration

AI shortens the migration by taking the mechanical, high-volume work off the critical path. Here's where I see real savings, and where I don't.

| Phase | Where AI helps | Typical saving |
|---|---|---|
| **Assess** | The Cloud Migration skill turns the BPA report into a per-file runbook. An AI assistant can inventory integrations, hostnames, file-system access and schedulers across the codebase in hours rather than weeks of manual review. | 50–70% |
| **Refactor code** | Pattern fixes from the Cloud Migration skill: schedulers to Sling Jobs, replication, event listeners and handlers, the Assets API, OSGi XML to `.cfg.json` with secrets extracted, Classic and Coral 2 dialogs to Coral 3, static to editable templates, Dispatcher conversion and Oak index renaming. Each batch ends in a review, not a rewrite. | 50–70% |
| **Testing** | Generating unit tests for refactored Sling Models and services, Cloud Manager UI and functional tests from existing user journeys, and load-test scripts from CDN logs. Also analysing SEO crawl diffs and redirect maps at scale. | 30–50% |
| **Content validation** | Scripts that compare page, asset and reference counts between source and target after each ingestion, and triage of ingestion logs. | 30–50% |
| **Documentation and enablement** | Runbooks, the cut-over plan, ops handover notes, and Universal Editor and Touch UI training material for authors. | 40–60% |
| **After go-live** | Adobe's AEM agents (cloud only) for content, governance and site optimisation work. These are benefits you only unlock by being on AEMaaCS. | Ongoing |

**Where AI doesn't save time:**

- **Content transfer throughput.** CTT extraction and ingestion speed depends on repository size and network, not on how fast you write code. Pre-copy, repository clean-up and early top-ups are still the levers.
- **Organisational lead times.** Firewall changes, IdP federation, security sign-off and partner allow-lists move at the speed of other teams.
- **Architecture decisions.** Where UGC should live, what becomes an API, whether a section goes to Edge Delivery Services. AI can draft options, but an architect has to own the decision.
- **The content freeze.** It's bounded by the final top-up, smoke tests and business sign-off.

To get the AI-assisted timeline, set things up in this order:

1. **Upload BPA to CAM in week one** and connect the AEM MCP Server, so the agent works from live findings rather than a stale CSV.
2. **Run the read-only runbook first** and use it to size the work and split it into pattern-based tickets.
3. **Run pattern sessions in parallel** across developers. Each developer owns a pattern, such as schedulers or dialogs, and reviews every batch of five changes as a pull request.
4. **Keep the guardrails:** the AEM Analyser, the local SDK, migration validation (beta), and Cloud Manager quality gates on every change. AI makes changes faster, and the gates keep them correct.
5. **Spend the saved engineering time on testing,** not on extra scope. That's what turns faster refactoring into a safer go-live.

The biggest variables are rarely code. They're network approvals, IMS and SSO setup, integration partners updating allow-lists, and how many times you need to re-run content migration because of data quality. AI compresses the engineering. Planning compresses everything else.

## Should you move to Edge Delivery Services at the same time?

Possibly, but not by default in the same release. A cloud migration already changes the platform, operating model, deployment process and identity provider. Adding a delivery re-architecture multiplies the risk.

My approach is to move to AEMaaCS first with the existing components, then move content-led sections to Edge Delivery Services incrementally behind the same CDN. Exceptions: if a site is due a redesign anyway, or the component library is so legacy that porting it costs as much as rebuilding, going straight to EDS can be cheaper. The decision guide is in [EDS vs traditional AEMaaCS](/blog/2026/11/aem-edge-delivery-services-vs-traditional-aemaacs/), and multi-site setup is in [Repoless on EDS](/blog/2026/10/aem-eds-repoless-one-codebase-many-sites/).

## Go-live checklist

- BPA CRITICAL and MAJOR findings resolved, and the report re-run on the final codebase
- Full-stack pipeline green with quality gates at the agreed thresholds
- Dispatcher validated; CDN config (redirects, traffic filters, WAF) deployed and tested in `log` mode, then `block` mode
- Advanced networking live; every integration tested end to end from stage
- IMS groups created, SSO tested, author permissions verified by real authors
- Final top-up timed in rehearsal; freeze window agreed with the business
- Load test passed on stage with production-sized content
- SEO crawl diff clean; `301` map deployed; sitemaps and `robots.txt` correct
- Domains and certificates in Cloud Manager; DNS TTLs lowered
- Log forwarding and alerting live; on-call and Adobe support routes agreed
- Rollback plan written, with the source environment kept intact

## FAQ

**Can I migrate directly from AEM 6.3 or 6.4?**
CTT supports AEM 6.3 and later as a source, and BPA runs on 6.1 and later. Your code must still be refactored to the cloud contract, so the source version matters less than the state of the codebase.

**Is there downtime?**
For visitors, no: the source publish keeps serving until the DNS switch. For authors, there's a content freeze covering the final top-up and smoke testing, and the cloud author is unavailable during any author ingestion. Frequent top-ups keep that window to hours rather than days.

**Are users and passwords migrated?**
No. Groups referenced by migrated content are migrated and must be recreated in IMS. Users are created on first login through Adobe IMS, typically via your corporate SSO.

**Do I have to rewrite all my components?**
No. HTL components, Sling Models and editable templates generally work as they are. You rewrite what violates the cloud contract (runtime writes, schedulers, replication, file system, Classic UI) and modernise what BPA flags as deprecated.

**Can I keep my own CDN?**
Yes. A customer-managed CDN can sit in front of the Adobe-managed CDN, with the required headers configured. Adobe's CDN remains in the path.

**Is AEM 6.5 LTS a better option?**
It's a valid supported path if you have to stay self-hosted. But it's still an upgrade you run, you'll face the next one later, and Adobe's AEM agents aren't available on it. For most organisations, the cloud move is the better use of the same effort.

**How much faster is an AI-assisted migration?**
In my experience, roughly half the calendar time: 2–3 months instead of 3–4 for a small site, and 4–6 months instead of 9–15 for a large estate. Most of the saving comes from code refactoring, test generation and validation. Content transfer speed and organisational lead times don't change, so they need to start early.

**Does the AI migration skill replace a migration team?**
No. It speeds up the mechanical refactoring and gives you a good runbook. Architecture decisions, integrations, content migration, testing and cut-over still need experienced people.

## Closing thought

The technical side of an AEMaaCS migration is well understood now, and Adobe's tooling, especially with the AI-assisted code migration in 2026, takes much of the toil out of it. What decides whether a migration lands smoothly is everything around the code: network and identity work started early, a rehearsed content migration with a short freeze, and the discipline not to turn a platform move into a redesign.

Get those right and the cloud move is the last major AEM upgrade your team ever runs.

Planning a move from AEM 6.5 or AMS to AEM as a Cloud Service? [Get in touch](/contact/). I'm happy to review a BPA report or pressure-test a migration plan.

### References

- [AEM 6.5 on-premise support timelines and service pack policy](https://experienceleague.adobe.com/en/docs/experience-cloud-kcs/kbarticles/ka-42541) (Adobe KB)
- [Getting started with the migration journey to AEM as a Cloud Service](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/getting-started) (Experience League)
- [Using the Best Practices Analyzer](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/cloud-migration/best-practices-analyzer/using-best-practices-analyzer) (Experience League)
- [Cloud Acceleration Manager overview](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/cloud-acceleration-manager/introduction-cam/overview-cam) (Experience League)
- [Content Transfer Tool overview](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/cloud-migration/content-transfer-tool/overview-content-transfer-tool) (Experience League)
- [Content Transfer Tool guidelines and best practices](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/cloud-migration/content-transfer-tool/guidelines-best-practices-content-transfer-tool) (Experience League)
- [Handling large content repositories (AzCopy pre-copy)](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/cloud-migration/content-transfer-tool/handling-large-content-repositories) (Experience League)
- [Group migration](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/cloud-migration/content-transfer-tool/group-migration) (Experience League)
- [AI-assisted code migration to AEM as a Cloud Service](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/cloud-migration-skill/overview-cloud-migration-skill) (Experience League)
- [Release notes for migration tools](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/release-notes/migration-tools/release-notes-migration-tools-current) (Experience League)
- [Content migration FAQ](https://experienceleague.adobe.com/en/docs/experience-manager-learn/cloud-service/migration/moving-to-aem-as-a-cloud-service/content-migration/faq) (Experience League)
- [Adobe skills repository](https://github.com/adobe/skills) (GitHub)

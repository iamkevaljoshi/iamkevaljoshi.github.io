---
layout: post
title: "Running AEM Cloud Manager pipelines well: quality gates, rapid development environments and the config pipeline"
seo_title: "AEM Cloud Manager Pipelines: Quality Gates, RDE, Config"
description: "How to run delivery on AEM as a Cloud Service: Cloud Manager pipeline types, quality gates, RDEs, the config pipeline for CDN and WAF, and faster builds."
date: 2026-11-03 18:40:00 +0530
category: aem-cloud-service
tags: [AEM, AEM as a Cloud Service, Cloud Manager, DevOps]
---

Every AEM as a Cloud Service (AEMaaCS) team I work with ends up with the same complaint around month three: "the pipeline is slow". A one-line CSS fix waits behind a full Maven build, a code scan, a stage deployment and a test suite. A redirect for a campaign launching tomorrow sits in a queue behind a Java release. Developers start batching changes to avoid the wait, which makes each release riskier, which makes everyone more nervous about the pipeline.

In almost every case the pipeline isn't the problem. The team is using one pipeline for everything. Cloud Manager has grown into a set of pipelines with different payloads, gates and speeds, plus Rapid Development Environments (RDEs) for the inner loop. Used together, they let a CDN rule ship in minutes and a Java change ship safely, without one blocking the other.

This post is how I set up and run delivery on AEMaaCS: which change goes through which pipeline, how the quality gates actually behave, what the config pipeline can do in 2026, how to use RDEs properly, and the habits that keep pipelines fast and boring. If you're still on the way to the cloud, start with my [AEM to AEM as a Cloud Service migration playbook](/blog/2026/11/aem-on-premise-and-managed-services-to-aem-as-a-cloud-service-migration/); this is what comes after.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **Use the right pipeline for the change.** Full-stack for Java and repository code, front-end for site themes, web tier config for Dispatcher, the config pipeline for CDN, WAF, redirects and log forwarding. Splitting them is the single biggest speed win.
- **Quality gates have three tiers.** Critical issues (security rating below B, reliability below D) fail the build. Important issues (maintainability below A, coverage below 50%) pause it for a human override. Info issues are reported only.
- **The config pipeline does more than CDN in 2026:** traffic filter and WAF rules, redirects, request and response transformations, origin selectors, log forwarding, maintenance purge rules, API client registration and edge functions, with managed secrets.
- **RDEs are for the inner loop, not for sign-off.** `aio aem:rde:install` deploys bundles, packages, OSGi configs, Dispatcher and config YAML without a pipeline, but skips every quality gate.
- **There's no rollback button.** You roll forward by redeploying a known-good commit. Canary deployments (beta) give you a three-hour window to cancel on publish before traffic moves.
- **Faster builds come from structure, not tricks:** Smart Build module caching, separate front-end and web tier pipelines, a lean test suite, and fixing the code quality issues that keep pausing the pipeline.

## The pipeline landscape

![The Cloud Manager pipeline landscape: full-stack, front-end, web tier config, config and code quality pipelines, with the RDE inner loop]({{ '/assets/img/blog/cloud-manager-pipelines/01-pipeline-landscape.svg' | relative_url }}){: width="1200" height="730" loading="lazy" decoding="async"}

Cloud Manager organises pipelines along two axes.

**Production or non-production.** A production pipeline builds once, deploys to stage, runs the stage tests, then deploys to production. A non-production pipeline either deploys to a development environment or runs a code quality scan without deploying anything.

**What it deploys.** This is where most teams leave speed on the table:

| Pipeline type | Deploys | Key constraints (per Adobe) |
|---|---|---|
| **Full-stack** | Back-end code, front-end code built in Maven, and Dispatcher config | Only one full-stack pipeline per environment. Skips Dispatcher config if a web tier config pipeline exists |
| **Front-end** | A front-end build for site themes | Multiple can run concurrently; much faster than full-stack |
| **Web tier config** | HTTPD/Dispatcher configuration only | One per environment; requires Dispatcher flexible mode |
| **Config** (targeted deployment) | CDN, WAF, log forwarding, maintenance and other YAML configs | One per environment; deploys in minutes |
| **Edge Delivery config** | Config for Edge Delivery Services sites registered in Cloud Manager | Production only; no dev or stage tiers |
| **Code quality only** | Nothing | Runs build and scans; useful on feature branches |

A program can have up to 300 pipelines across all types, so don't be shy about creating dedicated ones. Configuring or running them requires the **Deployment Manager** role.

## Which change goes through which pipeline

This is the table I put in every project's README. It stops "where does this go?" conversations in Slack.

| Change | Pipeline | Notes |
|---|---|---|
| Java, Sling Models, servlets, OSGi services | Full-stack | Needs unit tests to hold coverage |
| HTL, component dialogs, clientlibs in `ui.apps` | Full-stack | Front-end in clientlibs still goes full-stack |
| OSGi configs (`.cfg.json`) | Full-stack | Use `$[env:…]` and `$[secret:…]` for values that differ |
| Oak index definitions, repoinit, service users | Full-stack | Must be backward compatible during blue-green |
| Site theme CSS and JS (site templates) | Front-end | Cloud Manager runs `npm run build` and deploys `dist` |
| Dispatcher filters, rewrites, cache rules, vhosts | Web tier config | Flexible mode only; validate locally first |
| CDN redirects, transformations, traffic filters, WAF | Config | `kind: "CDN"`; WAF flags need a licence |
| Log forwarding, purge rules | Config | `LogForwarding`, `MaintenanceTasks` |
| Environment variables and secrets | Cloud Manager UI, API or CLI | No pipeline; applied on save |
| Content, templates, policies | Not a pipeline | Authored, not deployed |

The line that causes the most arguments: clientlib changes look like front-end work but live in `ui.apps`, so they go full-stack. The front-end pipeline is for site themes. If you want front-end speed, the theme architecture has to come first.

## Source control and branching

### Adobe's Git, private GitHub or your own Git

Every program comes with an Adobe-hosted Git repository, but most enterprises want code where it already lives. **github.com** repositories connect through the Adobe GitHub app: every pull request triggers a code quality pipeline and reports back as a GitHub check. **GitHub Enterprise Server, GitLab, Bitbucket Cloud and Azure DevOps** connect as external repositories with an access token and a webhook, and also support pull request validation.

Read the limitations first. Per Adobe's documentation at the time of writing:

- **Web tier and config pipelines are not supported with private repositories.** If you need them, those folders have to live in the Adobe repository, which usually means a sync job.
- **Artifact reuse doesn't apply to private GitHub repositories**, and no Git tag is created on production runs. Tag releases yourself.
- **Pull request validation can't be paused** once a repository is validated.

Even so, the pull request checks alone justify connecting your own Git. A coverage drop found in a pull request is far cheaper than one found as a paused production pipeline.

### A branching strategy that fits Cloud Manager

Each pipeline tracks one branch. I keep it simple:

- **`main`** is production. The production pipeline builds from it.
- **`develop`** feeds the dev environment's full-stack pipeline, triggered on commit.
- **Feature branches** get pull request checks and are validated on an RDE, not on the shared dev environment.
- **A hotfix path** from `main`, rehearsed once before go-live, not during an incident.

Avoid long-lived `qa` or `uat` branches that drift apart. Stage is part of the production pipeline, so nothing reaches stage that won't go to production next.

## The quality gates, and how they actually behave

### Code quality: the three tiers

Code quality testing runs right after the build in every pipeline. It's SonarQube-based, with Adobe's custom rules for AEM on top. Issues fall into three tiers:

- **Critical:** the pipeline fails immediately.
- **Important:** the pipeline pauses until someone overrides or rejects.
- **Info:** reported, no effect on the run.

| Metric | Tier | Fails when |
|---|---|---|
| Security rating | Critical | below B |
| Reliability rating | Critical | below D |
| Maintainability rating | Important | below A |
| Coverage (line and condition) | Important | below 50% |
| Skipped unit tests | Info | more than 1 |
| Open issues | Info | more than 0 |
| Duplicated lines | Info | more than 1% |
| Cloud Service compatibility | Info | more than 0 |

On a production pipeline, a Deployment Manager, Project Manager or Business Owner can override important failures. On a code-quality-only pipeline you can't, because the scan is the last step. In pipeline settings you can set how important failures behave: **Ask every time** (the default), **Fail immediately** or **Continue immediately**.

My advice: set dev pipelines to **Fail immediately** and keep production on **Ask every time**. A coverage drop that can't be ignored on dev never reaches production. And track overrides: overriding the same issue every release is a tech debt ticket, not a pipeline problem.

For genuine false positives, suppress the specific rule, such as `@SuppressWarnings("squid:S2068")`, at the narrowest scope. If it's a real hard-coded password, remove the password.

### "Can we skip the tests?"

No. Cloud Manager runs a fixed command, `mvn --batch-mode org.jacoco:jacoco-maven-plugin:prepare-agent package`, so you can't pass `-DskipTests`. Put `skipTests` in the POM and coverage collapses below 50%, pausing the pipeline anyway. Write the tests.

### Functional tests, UI tests and the experience audit

After stage deployment, the production pipeline runs:

- **Product functional tests:** Adobe's own tests against stage, which catch customisations that break core AEM behaviour.
- **Custom functional tests:** your HTTP integration tests (JUnit, run with Maven). This step always runs; with no test JAR, it passes.
- **Custom UI tests:** optional, packaged as a Docker build context. Adobe recommends **Cypress** and also documents **Playwright**, **WebdriverIO** and **Selenium WebDriver**. You opt in with a `testing.properties` file containing `ui-tests.version=1`. Each run gets 2 CPUs, 1 GiB of memory and a 30-minute timeout; Adobe recommends staying under 15 minutes.
- **Experience audit:** Google Lighthouse scores for performance, accessibility, best practices and SEO on up to 25 paths. Always on for production pipelines, informational only.

Older guides mention dedicated security and performance testing steps. The current documentation has no explicit security testing step (security rules run in code quality), so load testing on stage is your job.

Because the experience audit can't fail, teams ignore it. I put its slowest-five-pages report in the sprint review. It's the cheapest early warning you get for performance and [accessibility regressions that start in a component](/blog/2026/11/accessibility-on-aem-fix-the-component-not-the-page/).

## The config pipeline: CDN, WAF and friends as code

The config pipeline is the most underused feature in Cloud Manager. It deploys YAML files from a `config` folder in your repository, in minutes, with no Java build. You create it as a **targeted deployment** pipeline with the **Config** type.

### What it supports in 2026

| `kind` | Covers | Publish delivery | Edge Delivery |
|---|---|---|---|
| `CDN` | Traffic filters and WAF, request/response transformations, redirects, origin selectors, basic auth | Yes | Yes |
| `CDN` | Custom error pages, purge API key, customer-managed CDN token | Yes | No |
| `LogForwarding` | Forwarding logs to external destinations | Yes | Yes |
| `MaintenanceTasks` | Version, audit log and workflow purge rules | Yes | No |
| `Otel` | OpenTelemetry export (limited availability) | Yes | No |
| `API` | Client ID registration for OpenAPI-based AEM APIs | Yes | No |
| `EdgeFunctions` | Edge function declarations | Yes | Yes |

Folder and file names under `config` are up to you. Each file needs a `kind`, a `version`, optional `metadata.envTypes` to scope it, and a `data` block.

### A sample `cdn.yaml`

```yaml
kind: "CDN"
version: "1"
metadata:
  envTypes: ["dev", "stage", "prod"]
data:
  trafficFilters:
    rules:
      # Start in log mode, switch to block once CDN logs show no false positives
      - name: rate-limit-per-ip
        when:
          reqProperty: tier
          equals: publish
        rateLimit:
          limit: 100
          window: 10
          penalty: 300
          count: all
          groupBy:
            - reqProperty: clientIp
        action: log
      # Requires the Extended Security licence and WAF enabled in Cloud Manager
      - name: block-attacks-from-bad-ips
        when:
          reqProperty: tier
          in: ["author", "publish"]
        action:
          type: block
          wafFlags:
            - ATTACK-FROM-BAD-IP
  redirects:
    rules:
      - name: spring-campaign
        when: { reqProperty: originalPath, equals: "/spring" }
        action:
          type: redirect
          status: 302
          location: /content/acme/en/campaigns/spring-2027.html
  requestTransformations:
    rules:
      - name: strip-tracking-param
        when: { reqProperty: path, like: "/content/*" }
        actions:
          - type: unset
            queryParamMatch: ^utm_.*$
```

A few rules I follow:

- **Start WAF and rate limit rules in log mode,** check the CDN logs, then switch to block. Adobe recommends this, and it stops you blocking your own load test.
- **Licensing WAF doesn't switch it on.** WAF flags need the Extended Security licence and WAF enabled in Cloud Manager. Standard traffic filters and rate limits work for all Sites customers.
- **The file is capped at 100 KB.** Thousands of vanity redirects belong elsewhere.
- **Secrets never go in YAML.** Reference them as {% raw %}`${{SPLUNK_TOKEN}}`{% endraw %} and store them as config pipeline secrets, supported since early 2026.
- **Test on an RDE first:** add `"rde"` to `envTypes` and deploy with `aio aem:rde:install -t env-config`.

For Edge Delivery Services sites, the Edge Delivery config pipeline applies the supported kinds to production. My [EDS vs traditional AEMaaCS comparison](/blog/2026/11/aem-edge-delivery-services-vs-traditional-aemaacs/) covers where each fits.

## Rapid Development Environments and the local loop

### What RDEs are for

An RDE is a cloud AEM environment you deploy to from your laptop, without a pipeline. Every program gets one; production programs can license more. New RDEs and resets come up on the latest AEM version.

You can deploy:

- Content packages, bundles, OSGi configurations and content files
- Dispatcher/Apache config as a zip (flexible mode only)
- Config pipeline YAML (`-t env-config`, with `"rde"` in `envTypes`)
- Front-end theme packages (`-t frontend`), bypassing the front-end pipeline

### The commands I use daily

```bash
# One-off setup
aio plugins:install @adobe/aio-cli-plugin-aem-rde
aio login
aio aem:rde:setup

# Check it's ready, then deploy the all package
aio aem:rde:status
aio aem:rde:install all/target/acme.all-1.0.0-SNAPSHOT.zip

# Deploy only to author, or push Dispatcher and CDN config
aio aem:rde:install -s author ui.config/target/acme.ui.config-1.0.0-SNAPSHOT.zip
aio aem:rde:install dispatcher/target/acme.dispatcher.cloud-1.0.0-SNAPSHOT.zip
aio aem:rde:install -t env-config ./config

# Tail logs, see what's deployed, remove a single OSGi config
aio aem:rde:logs --target=author
aio aem:rde:history
aio aem:rde:delete com.acme.core.impl.SomeServiceImpl

# Snapshot a known-good state, or wipe everything
aio aem rde snapshot create before-upgrade-test
aio aem:rde:reset
```

### RDE limits worth knowing

- **No quality gates.** RDE code hasn't been scanned or tested. It's a sandbox, not evidence for sign-off.
- **Content packages can't be deleted** individually; a reset takes a few minutes and wipes all custom code, config and content.
- **CLI-synced content packages are limited to 1 GB**, there's no preview tier, and you get up to seven snapshots per RDE.

One RDE shared by a whole team becomes a fight over who reset it. In my experience one per two or three developers, or per workstream, is the right ratio. Budget for it.

### The local loop still matters

RDEs don't replace the AEM SDK. Every developer should run the SDK quickstart locally and have the Dispatcher tools installed, and run this before any Dispatcher change leaves their laptop:

```bash
./bin/validate.sh src/dispatcher
./bin/docker_run_hot_reload.sh src/dispatcher host.docker.internal:4503 8080
```

`validate.sh` runs the Dispatcher validator, an `httpd -t` syntax check and the immutability check for Adobe's base files. Ten seconds locally saves a failed pipeline run.

## Making pipelines faster

Adobe doesn't publish typical run times, and they vary a lot with codebase size. In my experience a full-stack production run on a mid-sized enterprise codebase takes somewhere between 45 minutes and well over an hour before approvals, while web tier and config pipelines complete in minutes, as Adobe says. These are the levers I pull, in order of impact:

1. **Stop using full-stack for things that aren't code.** Move Dispatcher to a web tier pipeline and CDN rules to the config pipeline. In my experience this removes a large share of full-stack runs.
2. **Turn on Smart Build.** It caches Maven modules and rebuilds only those changed since the last successful run. It's available for code quality and dev full-stack pipelines, and in beta for production pipelines since Cloud Manager 2026.4. To force a module to always rebuild, set `<maven.build.cache.enabled>false</maven.build.cache.enabled>` in its POM.
3. **Watch the front-end module.** Every build runs in a fresh container, so `frontend-maven-plugin` downloads Node and installs dependencies every time. Pin versions, keep dependencies lean, and don't lint and test front-end code twice.
4. **Skip the Dispatcher module** with a Maven profile activated by `IGNORE_DISPATCHER_PACKAGES` when a web tier pipeline owns it.
5. **Keep the "all" package clean.** When it embeds only skipped content packages, Cloud Manager scans them directly, which Adobe says saves over 10 minutes per run for projects with dozens of embedded packages.
6. **Budget the UI tests.** Keep the pipeline suite to critical journeys and run the long regression suite in your own CI against stage.
7. **Fix the issues that pause the pipeline.** A pipeline waiting for a manager to override a coverage drop is the slowest pipeline of all.

On Java: the build container defaults to JDK 8 for compatibility. Add a `.cloudmanager/java-version` file containing `21` (or `17`) so your build matches the runtime.

## Approvals, scheduling, canary and rollback

### Approvals and scheduling

The production phase can include an **approval step**, a **scheduled deployment** and, for customers with that service, a **CSE support** step. You can also set **Pause before deploying to Production**. Steps waiting for a human time out after 14 days, long enough to forget a release is half-done. I prefer a named release owner who approves the same day. Scheduling is about people being available, not outage windows: AEMaaCS deployments are designed for zero downtime.

### There is no rollback button

Cloud Manager doesn't roll back a deployment. Your options:

- **Re-execute** the last production run: it redeploys the same artifacts without rebuilding, but only for the most recent execution and only if it reached the production step. Useful for an infrastructure hiccup, not for bad code.
- **Roll forward:** revert the commit or point the pipeline at a known-good tag, and run it again. This is the real rollback, and it takes a full pipeline run.
- **Canary deployments (beta):** for full-stack pipelines, Cloud Manager starts canary publish instances with the new code, reachable with the `X-Aem-Canary: true` header while live traffic stays on stable. You can cancel within a three-hour window; otherwise it promotes automatically, and after promotion there's no rollback. Author isn't covered.

Content changes, index definitions and repoinit scripts aren't undone by redeploying old code. That's why backward-compatible changes are a rule on AEMaaCS, and why feature flags via environment variables are cheaper than any rollback.

## Variables, secrets and automation

### Environment and pipeline variables

Environment variables can target all services, author, publish or preview, up to 400 per environment (raised in 2026). Secret values can be updated but never viewed again, and saving applies them without a deployment. Reference them in OSGi configs as `$[env:API_URL;default=https://api.example.com]` and `$[secret:API_KEY]`. Dispatcher can use normal variables but not secrets. Pipeline variables, such as `NODE_VERSION` for front-end builds, are for build time.

### Automating Cloud Manager

The Cloud Manager API is the right way to build release dashboards or chain AEM into a wider release train. The Adobe I/O CLI plugin covers daily needs:

```bash
aio plugins:install @adobe/aio-cli-plugin-cloudmanager
aio cloudmanager:program:list-pipelines
aio cloudmanager:pipeline:create-execution 1234567
aio cloudmanager:current-execution:get 1234567
aio cloudmanager:current-execution:advance 1234567   # override a gate or approve
aio cloudmanager:environment:set-variables 98765 --variable FEATURE_X_ENABLED true
```

The service account behind an integration needs the Deployment Manager, Program Manager or Business Owner role to advance or cancel steps. Since Cloud Manager 2026.4 there's also an MCP server that exposes the Cloud Manager public APIs as tools for AI-enabled IDEs. It's handy for "why did last night's run pause?" questions; I'd still keep approvals with humans.

## Pipeline hygiene checklist

The list I run through when I inherit an AEMaaCS programme:

- [ ] A README table maps every type of change to a pipeline
- [ ] Dispatcher has its own web tier config pipeline, in flexible mode
- [ ] CDN, WAF, redirects and log forwarding go through the config pipeline, not support tickets
- [ ] Pull request checks run on every pull request
- [ ] Dev pipelines fail immediately on important issues; production asks
- [ ] Coverage stays above 50% without suppressions; overrides are logged and reviewed
- [ ] `.cloudmanager/java-version` is set and Smart Build is on where available
- [ ] UI tests cover critical journeys and finish under 15 minutes
- [ ] Experience audit paths cover key templates; the trend is reviewed each sprint
- [ ] Each developer or workstream has RDE access
- [ ] Secrets live in Cloud Manager, never in Git or YAML
- [ ] Releases are tagged, and the roll-forward path has been rehearsed
- [ ] A named release owner approves production on the day

## FAQ

**Can I deploy only Dispatcher changes without a full build?**
Yes, with a web tier config pipeline, provided your Dispatcher config is in flexible mode. Once it exists, the full-stack pipeline ignores Dispatcher config for that environment. Check the repository limitation first: web tier and config pipelines aren't supported with private repositories.

**Who can override a failed code quality gate?**
Only important failures (maintainability and coverage) can be overridden, by a Deployment Manager, Project Manager or Business Owner on a production pipeline. Critical failures (security and reliability) always fail the run, and code-quality-only pipelines can't be overridden.

**Is Playwright supported for Cloud Manager UI tests?**
Yes. Adobe recommends Cypress but documents Playwright, WebdriverIO and Selenium WebDriver too. Tests run in a Docker image with 2 CPUs, 1 GiB of memory and a 30-minute timeout.

**Should we test on an RDE or on the dev environment?**
Both, for different reasons. RDEs are for fast iteration by individual developers. The dev environment, deployed through a pipeline, is where integrated code gets scanned and tested before it heads to stage.

**How do we roll back a bad production deployment?**
Roll forward: revert and run the pipeline again, or redeploy a known-good tag. Re-execution only redeploys the last run. Canary deployments (beta) let you cancel on publish within three hours before promotion.

## Closing thought

Cloud Manager is opinionated, and most of the frustration I see comes from fighting those opinions instead of using them. Teams that split their changes across the right pipelines, keep the quality gates green and give developers RDEs tend to ship small changes often, with little drama.

The pipeline can't make your code better. It can make bad code expensive and good habits cheap, and that's most of what a delivery platform should do.

Want a second pair of eyes on your Cloud Manager setup or release process? [Get in touch](/contact/).

### References

- [Cloud Manager CI/CD pipelines](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/using-cloud-manager/cicd-pipelines/introduction-ci-cd-pipelines) (Experience League)
- [Configuring a production pipeline](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/using-cloud-manager/cicd-pipelines/configuring-production-pipelines) (Experience League)
- [Code quality testing](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/using-cloud-manager/test-results/code-quality-testing) (Experience League)
- [Custom UI testing](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/using-cloud-manager/test-results/functional-testing/ui-testing) (Experience League)
- [Experience audit testing](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/using-cloud-manager/test-results/experience-audit-testing) (Experience League)
- [Deploying your code](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/using-cloud-manager/deploy-code) (Experience League)
- [Canary deployments](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/deploying/canary-deployments) (Experience League)
- [Using config pipelines](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/operations/config-pipeline) (Experience League)
- [Traffic filter rules including WAF rules](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/security/traffic-filter-rules-including-waf) (Experience League)
- [Configuring traffic at the CDN](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/content-delivery/cdn-configuring-traffic) (Experience League)
- [Rapid Development Environments](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/rapid-development-environments) (Experience League)
- [Private repositories in Cloud Manager](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/using-cloud-manager/managing-code/private-repositories) (Experience League)
- [External repositories in Cloud Manager](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/using-cloud-manager/managing-code/external-repositories) (Experience League)
- [Build environment](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/using-cloud-manager/create-application-project/build-environment-details) (Experience League)
- [Cloud Manager 2026.4.0 release notes](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/release-notes/cloud-manager/2026/2026-4-0) (Experience League)
- [Cloud Manager plugin for the Adobe I/O CLI](https://github.com/adobe/aio-cli-plugin-cloudmanager) (GitHub)

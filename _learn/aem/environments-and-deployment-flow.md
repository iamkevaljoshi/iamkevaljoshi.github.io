---
title: "Environments and the deployment flow"
description: "Dev, stage, production and Rapid Development Environments explained: how code moves, why deployments are rolling, and why new code must tolerate the old version."
track: aem
level: 5
order: 30
minutes: 9
outcome: "By the end you can explain how a change travels from your laptop to production, choose between an RDE and a dev environment, and say why deployments must be backward compatible."
prereq: "Lesson 29 (Cloud Manager pipelines and quality gates)."
terms:
  - { t: "Environment", d: "A running copy of AEM in the cloud, with its own author and publish services, such as dev, stage or production." }
  - { t: "Rapid Development Environment (RDE)", d: "A cloud environment you deploy to straight from your machine, without a pipeline, for fast feedback." }
  - { t: "Rolling deployment", d: "A release method where new instances start and pass health checks while old ones still serve traffic, then the old ones are retired." }
  - { t: "Immutable content", d: "Code and OSGi configuration, stored in Git and changed only through a pipeline." }
  - { t: "Mutable content", d: "Content such as /content and /conf that authors and some packages change while the system runs." }
mistake: "Assuming the new version replaces the old one in a single instant. For a short time both run side by side, so code that only works with the new data shape or the new index can break live traffic during a release."
try_it:
  - "Draw four boxes in a row: laptop, RDE or dev, stage, production. Under each, write what you would test there."
  - "Pick a change that renames a content property. Write the two-release plan that keeps the old code working during the rollout."
  - "List which of your project's folders are immutable (code, configs) and which content paths are mutable."
  - "If you have an RDE, deploy the `all` package to it and compare how long that takes with a pipeline run."
quiz:
  - q: "What is a Rapid Development Environment mainly for?"
    options:
      - "Final sign-off before production, because it is the fastest to test"
      - "Quick feedback on code from your machine, without a pipeline or quality gates"
      - "Serving visitors during traffic peaks"
      - "Storing a backup copy of production content"
    answer: 1
    why: "An RDE is a sandbox for the inner development loop. Because it skips quality gates, it is never evidence for sign-off."
  - q: "During a rolling deployment, why must new code work with the previous version still running?"
    options:
      - "Because the new nodes are slower and need the old ones to help"
      - "Because Cloud Manager can only deploy one module at a time"
      - "Because old and new instances run side by side for a while and share the same content"
      - "Because Dispatcher caches both versions for a week"
    answer: 2
    why: "Both versions run together and read the same repository during the switchover. The other options describe mechanisms that do not exist."
  - q: "You rename a property that old code still reads, and deploy it in one release. What is the safest approach instead?"
    options:
      - "Release 1: support both names. Release 2: remove the old one"
      - "Rename it and rely on a rollback if something breaks"
      - "Rename it only on the production environment"
      - "Rename it and ask authors to stop editing for an hour"
    answer: 0
    why: "Spreading a breaking change over two releases keeps the first compatible with the old version. Mutable content is not undone by redeploying old code, so relying on rollback is risky."
  - q: "Which statement about environments is NOT true?"
    options:
      - "Code reaches production only after passing through stage in a production pipeline"
      - "You should edit code on a running stage instance to test a quick fix"
      - "Code and OSGi configs are immutable and deployed from Git"
      - "Dev environments are typically used for integration testing of shared work"
    answer: 1
    why: "Running instances are not edited by hand, because that would make stage differ from production. Fixes go back through Git and the pipeline."
go_deeper:
  - { title: "Running AEM Cloud Manager pipelines well: quality gates, RDEs and the config pipeline", url: "/blog/2026/11/aem-cloud-manager-pipelines-quality-gates-rde-config-pipeline/", why: "RDE commands, limits and the no-rollback rule in detail" }
  - { title: "AEM go-live checklist", url: "/blog/2026/11/aem-go-live-checklist/", why: "what to confirm on stage before the first production release" }
  - { title: "Previous lesson: Cloud Manager pipelines and quality gates", url: "/learn/aem/cloud-manager-pipelines/" }
---
## The problem: how do you test safely without touching live?

A change that works on your laptop can still fail in the cloud: different data, different configuration, real Dispatcher and CDN. Teams solve this with a ladder of environments, each closer to production than the last.

## The ladder

| Environment | Purpose | How code gets there |
|---|---|---|
| Local SDK | Write and debug | You run Maven on your machine |
| RDE | Fast cloud feedback | The `aio` CLI, no pipeline |
| Dev | Integration of the team's work | A non-production pipeline |
| Stage | A rehearsal that mirrors production | The first half of the production pipeline |
| Production | Real visitors | The second half, after approval |

Stage and production are deliberately alike, so a result on stage predicts production. Nothing reaches stage that is not going to production next, which is why long-lived "QA" branches that drift away tend to cause trouble.

## RDEs: the inner loop

A full pipeline run is minutes to an hour. That is far too slow for "change one line, look at it". An **RDE** lets you deploy bundles, packages, OSGi configuration and Dispatcher configuration from your command line, using the `aio` CLI with the AEM RDE plugin. You can reset it to a clean state when it gets messy.

The cost: an RDE skips quality gates, so it proves nothing about code quality. Use it to learn quickly, then let the pipeline give the real verdict. Check Adobe's current documentation for how many RDEs a program includes, as limits and licensing change.

## Rolling deployments: old and new run together

When a production deployment starts, Cloud Manager does not stop AEM and swap versions. New instances start and pass health checks while the old ones keep serving visitors. Then the old instances are retired. This is a **rolling deployment**, and it is how Cloud Service avoids downtime.

Picture replacing the crew of a moving train carriage by carriage. For a while, old and new crew work together. So your new code must work if the old code is still running beside it, and the old code must survive the new content structures.

The rules follow:

- **Immutable content** (code, OSGi configs) arrives in Git and is deployed by the pipeline.
- **Mutable content** is installed in stages: index definitions first, then service users, their ACLs and node types as the new version starts, and everything else after the switch.
- Mutable content is **not removed** if you roll back. So adding new structures must not break old code.
- For service users and ACLs, Adobe advises spreading the change over at least two releases: one that bridges old and new, one that cleans up.

Cloud Manager has no "rollback" button. You fix forward by deploying a known-good commit.

## Content and lifecycle

Code flows up the ladder, but content does not follow it automatically. Content on stage is usually a copy of production content so tests are realistic. Cloud Manager offers a content copy feature to copy content from one environment to another, but treat it as a deliberate, scheduled act, because it replaces what is there. Check the current documentation for exactly which content types and directions are supported.

Environments also have a lifecycle: they can be created, updated and deleted in Cloud Manager, and environments in sandbox programs are hibernated when not in use. Confirm current behaviour for your program type before relying on it.

<details markdown="1">
<summary>Stretch question: why not simply stop AEM during a release?</summary>

A short outage on a busy site means lost revenue and trust, and CDN-cached pages would soon go stale or fail. Rolling deployments trade a little engineering discipline (backward-compatible changes) for continuous availability. That trade is the heart of the Cloud Service model.

</details>

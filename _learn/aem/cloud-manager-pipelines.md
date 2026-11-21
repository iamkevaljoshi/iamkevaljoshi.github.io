---
title: "Cloud Manager pipelines and quality gates"
description: "How Cloud Manager turns a Git commit into a running AEM environment: pipeline types, what each deploys, the quality gates that stop bad code, and approvals."
track: aem
level: 5
order: 29
minutes: 10
outcome: "By the end you can pick the right Cloud Manager pipeline for a change and explain which quality gate failures stop a deployment and which only ask for a decision."
prereq: "Lesson 5 (project structure) and lesson 6 (local setup). You should know that code lives in a Maven project with modules such as core and ui.apps."
terms:
  - { t: "Program", d: "The Cloud Manager container for one AEM project: it holds the Git repository, the environments and the pipelines." }
  - { t: "Pipeline", d: "An automated sequence that builds code, tests it and deploys it to an environment." }
  - { t: "Full-stack pipeline", d: "A pipeline that builds and deploys back-end code, the content packages and Dispatcher configuration from the Maven project." }
  - { t: "Quality gate", d: "An automated check in a pipeline that can fail the run or pause it for a human decision." }
  - { t: "Config pipeline", d: "A fast pipeline that deploys only YAML configuration, such as CDN rules, without a Java build." }
mistake: "Sending every change through the full-stack pipeline, and treating a paused run as 'broken'. A redirect then waits behind a Java build, and a paused run is really the pipeline asking a person to accept a known risk."
try_it:
  - "Open the Maven project from lesson 7 and list which of its folders would be deployed by a full-stack pipeline."
  - "Run `mvn clean install` and note how long it takes. This is the shortest possible build step in a pipeline."
  - "Write down, for these changes, which pipeline you would use: a Sling Model fix, a CDN redirect, a Dispatcher filter rule, a new OSGi config."
  - "Open your own site's Cloud Manager program (if you have access) and read the pipeline list. Note which are production and which are non-production."
quiz:
  - q: "What does a production pipeline do, in order?"
    options:
      - "Deploys to production first, then tests there"
      - "Builds and scans the code, deploys to stage, tests, waits for approval, then deploys to production"
      - "Copies the dev environment to production without building"
      - "Runs only the tests and leaves deployment to the author"
    answer: 1
    why: "A production pipeline proves the change on stage before production. Deploying to production first would defeat the purpose of the gates."
  - q: "A marketing team needs a CDN redirect live today. The last Java release is still waiting for approval. What is the best route?"
    options:
      - "Put the redirect in the Java module and wait for the full-stack run"
      - "Edit the redirect on the live publish instance in the Web Console"
      - "Ask Adobe to apply it for you manually"
      - "Put the redirect in the config pipeline YAML, which deploys on its own"
    answer: 3
    why: "The config pipeline deploys CDN YAML independently and quickly. The full-stack route works but blocks the redirect behind unrelated code, and you cannot edit running instances by hand."
  - q: "Code quality scanning finds that unit test coverage fell below the threshold on a production pipeline. What typically happens?"
    options:
      - "The run is paused until someone with the right role approves or rejects it"
      - "The run fails immediately and cannot be continued"
      - "The run continues silently and nobody is told"
      - "The code is rolled back from stage automatically"
    answer: 0
    why: "Coverage is an 'important' issue, which pauses the run for an override. Only 'critical' issues, such as a low security rating, fail the run at once. Nothing is silently skipped."
  - q: "Which statement about quality gates is NOT true?"
    options:
      - "Code quality rules are checked after the build, in every pipeline"
      - "The experience audit reports Lighthouse-style scores and is informational"
      - "You can skip unit tests in Cloud Manager by passing -DskipTests"
      - "Critical findings fail the pipeline before anything is deployed"
    answer: 2
    why: "Cloud Manager runs a fixed Maven command, so you cannot pass your own flags. Disabling tests in the POM just drops coverage and pauses the pipeline anyway."
go_deeper:
  - { title: "Running AEM Cloud Manager pipelines well: quality gates, RDEs and the config pipeline", url: "/blog/2026/11/aem-cloud-manager-pipelines-quality-gates-rde-config-pipeline/", why: "the full detail behind this lesson, including tiers and faster builds" }
  - { title: "AEM go-live checklist", url: "/blog/2026/11/aem-go-live-checklist/", why: "where pipelines fit in launch readiness" }
  - { title: "Next lesson: Environments and the deployment flow", url: "/learn/aem/environments-and-deployment-flow/" }
---
## The problem: code must reach the cloud safely

On older AEM, someone copied a package onto a server. On AEM as a Cloud Service you cannot. You do not own the servers, and nothing is changed by hand. Every change to code or configuration goes through **Cloud Manager**, Adobe's CI/CD tool. CI/CD means a robot builds, checks and deploys your change the same way every time.

Think of an airport security line. Everyone, including the pilot, goes through the same scanners. That sameness is the point.

## Programs, environments and pipelines

A **program** is the Cloud Manager home of one AEM project. Inside it you find:

- a **Git repository** (Adobe-hosted, or your own GitHub, GitLab and similar, connected to Cloud Manager);
- **environments**: dev, stage and production, plus Rapid Development Environments (next lesson);
- **pipelines**: the automation that moves code from the repository into an environment.

Each pipeline follows one Git branch. There are two families. A **production pipeline** builds, deploys to stage, tests, then deploys to production. A **non-production pipeline** deploys to a dev environment, or only runs the code quality scan without deploying.

## Pick the pipeline for the change

Not every change needs a Java build. Cloud Manager has pipelines with different payloads:

| Pipeline | Deploys | Typical change |
|---|---|---|
| Full-stack | Back-end code, content packages and Dispatcher config | A Sling Model, an HTL file, an OSGi config |
| Front-end | A front-end build for a site theme | Theme CSS and JavaScript |
| Web tier config | Dispatcher/Apache configuration only | A new filter or cache rule |
| Config | YAML such as CDN rules and log forwarding | A redirect, a traffic filter |

Clientlibs inside `ui.apps` still ship through full-stack. The front-end pipeline is for a theme built as its own front-end module. The blog post below has the full table, including constraints such as how many of each type an environment can have.

## What the quality gates check

Right after the build, Cloud Manager runs **code quality testing**. It uses SonarQube rules plus Adobe's own rules for AEM, and issues fall into three tiers:

- **Critical:** the pipeline fails immediately. A security rating below B is an example.
- **Important:** the pipeline **pauses** and waits for a person with the right role to override or reject. Low unit test coverage is an example.
- **Info:** reported only.

After stage deployment, a production pipeline runs **functional tests** (Adobe's product tests and any tests you wrote) and an **experience audit** (Lighthouse-style scores for performance, accessibility, best practices and SEO on selected paths). The audit cannot be skipped in production pipelines, and it informs rather than blocks.

Older material mentions separate "security" and "performance" test steps. Current documentation has no dedicated security test step, because security rules run inside code quality. Load testing is your own job.

## Triggers and approvals

A pipeline starts manually, or when someone pushes to its branch, depending on how you set it up. Production pipelines can add an **approval step** and a scheduled deployment. Approvals matter because a pipeline, however clever, cannot judge business timing.

<details markdown="1">
<summary>Predict first, then reveal: your pipeline paused on a coverage failure. What should you do first?</summary>

Look at what changed. If your new code lacks tests, add tests and push again: that is the real fix. Override only when the risk is understood and accepted, and note it. An override repeated on every release is a technical debt ticket, not a pipeline problem.

</details>

---
title: "Best Practices Analyzer and Repository Modernizer"
description: "Learn what the Best Practices Analyzer reports, how to read its findings, what the Repository Modernizer restructures, and how both feed migration estimates."
track: aem
level: 6
order: 36
minutes: 9
outcome: "By the end you can explain what BPA findings mean, what the Repository Modernizer changes in a project, and how Cloud Acceleration Manager and the Content Transfer Tool fit in."
prereq: "Lessons 1 to 5 of this track, especially the idea that code is immutable on AEM as a Cloud Service."
terms:
  - { t: "Best Practices Analyzer (BPA)", d: "A tool you run on an existing AEM 6.x instance that scans code and repository content for patterns that need work before moving to Cloud Service." }
  - { t: "Repository Modernizer", d: "A tool that restructures an AEM project's packages into the separate code and content layout Cloud Service expects." }
  - { t: "Cloud Acceleration Manager (CAM)", d: "Adobe's migration workspace where you see BPA results, refactoring guidance and content migration activity." }
  - { t: "Content Transfer Tool (CTT)", d: "The tool that extracts content from the source AEM into a migration set and ingests it into a Cloud Service environment." }
  - { t: "Severity", d: "The rating on each BPA finding, from the ones that block a migration down to informational notes." }
mistake: "Treating a clean-looking BPA report as proof the code is ready. BPA scans for known patterns; it does not see everything, so skipping a manual review of schedulers, integrations and file access leaves surprises for late testing."
try_it:
  - "Open the Adobe Experience League page for the Best Practices Analyzer and read the list of pattern categories."
  - "Pick three categories and write one sentence on why each would break on a platform where publish nodes are disposable."
  - "Look at the Adobe documentation for the Repository Modernizer and note which package folders it produces."
  - "Sketch the before and after folder tree of a small project with one mixed content-and-code package."
  - "Decide which BPA severities would count as 'must fix before go-live' for your project, and write the rule down."
quiz:
  - q: "What is the main job of the Best Practices Analyzer?"
    options:
      - "To move content from the old AEM to the new one"
      - "To scan an existing AEM for patterns that need work before a cloud move"
      - "To restructure project packages into code and content layers"
      - "To load test the new Cloud Service environment"
    answer: 1
    why: "BPA assesses; it changes nothing. Moving content is the Content Transfer Tool and restructuring packages is the Repository Modernizer."
  - q: "Your BPA report lists many findings, a few at the highest severity and hundreds that are informational. What should you do first?"
    options:
      - "Fix the highest severity findings and plan the rest by theme and effort"
      - "Fix everything in the order it appears in the report"
      - "Ignore the report and rely on a manual code review"
      - "Wait until the content has been migrated, then re-run it"
    answer: 0
    why: "Severity tells you what blocks or breaks a cloud deployment, so start there and group the rest into themes for planning. Fixing in report order wastes effort, and a manual review alone misses what the tool finds."
  - q: "After running the Repository Modernizer, a project has separate packages for application code, content and configuration. Why does Cloud Service want that split?"
    options:
      - "Because Maven cannot build mixed packages at all"
      - "Because content packages are faster to deploy than code"
      - "Because code ships immutably via the pipeline, while content stays editable"
      - "Because Adobe needs to count the packages for licensing"
    answer: 2
    why: "Code under /apps is deployed by Cloud Manager and cannot change at runtime, while content is changed by authors. Mixing them breaks that contract. The other options invent technical limits that do not exist."
  - q: "Which statement about BPA and migration estimates is NOT true?"
    options:
      - "Findings can be grouped into refactoring effort for the estimate"
      - "BPA results can be viewed in Cloud Acceleration Manager"
      - "Repository size and asset counts also affect content migration effort"
      - "A BPA report alone gives the complete migration effort"
    answer: 3
    why: "BPA covers code and repository patterns, but effort also depends on content volume, integrations, testing and the network and identity work around the migration. It is an input to the estimate, not the whole estimate."
go_deeper:
  - { title: "AEM 6.5 or AMS to AEM as a Cloud Service: the migration playbook", url: "/blog/2026/11/aem-on-premise-and-managed-services-to-aem-as-a-cloud-service-migration/", why: "the full toolchain and what BPA findings mean in practice" }
  - { title: "AI-assisted AEM Cloud Service migration", url: "/blog/2026/11/ai-assisted-aem-cloud-service-migration/", why: "how BPA findings drive AI-assisted refactoring" }
  - { title: "AEM migration estimator", url: "/tools/aem-migration-estimator/", why: "turns a BPA CSV into an effort estimate" }
  - { title: "Next lesson: Estimation and planning", url: "/learn/aem/estimation-and-planning/" }
---
## Why you scan before you plan

Imagine buying an old house and asking a surveyor in before you agree a renovation budget. The surveyor does not fix anything. They produce a report: this wall is load-bearing, this wiring is unsafe, this damp is cosmetic. Without it, any budget is a guess.

The **Best Practices Analyzer (BPA)** is that surveyor for AEM. You run it on an existing AEM 6.x system, ideally a recent copy of production, because findings depend on content as well as code. It does not change anything. It tells you what will need work to run on AEM as a Cloud Service.

## Reading a BPA report

Each finding has three things worth reading:

- **A pattern category.** What kind of problem it is, for example code that writes to `/apps` at runtime, schedulers, replication API use, legacy Classic UI dialogs or custom Oak indexes.
- **A severity.** Findings range from ones that will stop a cloud deployment through to advisory and informational notes. Adobe's documentation lists the current levels.
- **A location.** The paths or classes affected, so you can see how widespread it is.

Do not read it top to bottom. Group findings by theme, count the affected files, and rank by severity. A hundred informational notes can be less work than one scheduler that runs on every pod.

Most categories make sense once you remember how Cloud Service differs: code is immutable, publish nodes are disposable, there are many instances, and identity moves to Adobe's login. A scheduler that "runs once" will now run on each instance. A file written to local disk exists on one instance only.

BPA is not complete. Search the code yourself for schedulers, file access and unusual integrations as a cross-check, as the migration playbook post describes.

## What the Repository Modernizer does

Older projects often have one package that contains code, content and configuration together. Cloud Service wants them separated, because **code** is deployed through the pipeline and then immutable, while **content** is edited by authors at runtime.

The Repository Modernizer takes the first pass at restructuring the project. A typical outcome is separate modules for application code, content and configuration, plus an aggregating package, which matches the layout of the AEM Project Archetype:

```text
Before                         After
my-project/                    my-project/
  content-package/               ui.apps/      (code under /apps)
    /apps/...  code              ui.content/   (content and config under /content, /conf)
    /content/... content         ui.config/    (OSGi configuration)
    /etc/... mixed config        all/          (one package that embeds the others)
```

It is a starting point, not a finish line. You still review what landed where, fix anything that wrote into `/apps` at runtime, and run the build.

## Where CAM and the Content Transfer Tool fit

**Cloud Acceleration Manager (CAM)** is Adobe's workspace for the journey. You upload the BPA results there, follow refactoring guidance and track content migration.

The **Content Transfer Tool (CTT)** moves content. It extracts content from the source into a migration set and then ingests it into a Cloud Service environment. The next lessons come back to it, because it shapes the cutover plan.

## How this feeds estimation

BPA gives you counts: how many findings in which categories. The modernizer tells you how tangled the packages are. Together with repository size and asset counts, they replace gut feel with evidence. The migration estimator on this site reads a BPA CSV for exactly this reason. The next lesson shows how to turn those inputs into a range.

<details markdown="1">
<summary>Predict first, then reveal: BPA shows zero scheduler findings. Is that enough?</summary>

Not on its own. BPA looks for known patterns, and custom code can hide behaviour in ways it does not detect. A quick search of the codebase for scheduler registrations and file system access takes minutes and either confirms the report or finds what it missed. Treat BPA as strong evidence, not a guarantee.

</details>

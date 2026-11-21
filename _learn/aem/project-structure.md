---
title: "Project structure: core, ui.apps, ui.content and ui.config"
description: "What each module of the AEM Project Archetype is for, and why Cloud Service splits immutable code in /apps from mutable content in /content."
track: aem
level: 1
order: 5
minutes: 9
outcome: "By the end you can say which module a given file belongs in, and explain why code and content are deployed differently."
prereq: "Lessons 3 and 4, on the JCR and Sling."
terms:
  - { t: "AEM Project Archetype", d: "Adobe's Maven template that generates a correctly structured AEM project, ready for Cloud Manager." }
  - { t: "Content package", d: "A zip of repository content and a filter that says which paths it owns. AEM installs it into the repository." }
  - { t: "Immutable content", d: "Code and configuration under /apps and /libs, which is deployed with the application and not edited at runtime on Cloud Service." }
  - { t: "Mutable content", d: "Content that people or the system change at runtime, such as /content, most of /conf and /var." }
  - { t: "filter.xml", d: "The file in a content package that lists the repository paths the package is allowed to install or replace." }
mistake: "Putting everything in one module, or putting content in ui.apps. Cloud Service installs /apps as immutable, so content placed there cannot be edited later, and a careless filter can overwrite authors' work on every deployment."
try_it:
  - "Generate an archetype project (lesson 7 gives the full command) or open any existing AEM project."
  - "List the top-level folders and match each to its job using the table in this lesson."
  - "Open ui.apps/src/main/content/META-INF/vault/filter.xml and list the roots it claims."
  - "Open ui.content's filter.xml and compare. Which paths are owned by content, and which by code?"
  - "Find the all module's pom.xml and spot the packages it embeds."
quiz:
  - q: "Which module holds OSGi configuration?"
    options:
      - "core"
      - "ui.content"
      - "ui.config"
      - "dispatcher"
    answer: 2
    why: "ui.config deploys OSGi configuration, split by run mode. core holds Java code compiled to an OSGi bundle, and ui.content holds mutable content and configuration."
  - q: "A teammate saves a new component's HTL file straight into /apps on the running Cloud Service author using CRXDE Lite. Why is this a problem?"
    options:
      - "/apps is immutable at runtime, so changes go through a pipeline"
      - "HTL files must live in /content in order to be rendered"
      - "CRXDE Lite deletes any file that is larger than one megabyte"
      - "Components can only ever be defined inside the core module"
    answer: 0
    why: "On Cloud Service /apps is deployed as part of an immutable build, so it is not editable at runtime. The other options invent rules that do not exist."
  - q: "You deploy ui.content with a filter root of /content/mysite in replace mode. What is the risk?"
    options:
      - "Dispatcher will refuse to cache the pages"
      - "The deployment will be skipped by Cloud Manager"
      - "Java code in core will be removed"
      - "Pages authors already created there may be overwritten"
    answer: 3
    why: "The filter says which paths the package owns. A broad root in the default replace mode means the package contents replace what is there, so authors' work can be lost. Keep content packages to starter content only, and filter narrowly."
  - q: "Which is NOT a reason Cloud Service separates immutable and mutable content?"
    options:
      - "New versions can be built, tested and rolled out as a single image"
      - "Every instance runs the same code, so behaviour is consistent"
      - "Authors can hot-fix code on a live instance faster"
      - "Content changes by authors are not wiped by a code deployment"
    answer: 2
    why: "Hot-fixing a running instance is exactly what the split prevents. Consistency, repeatable deployments and keeping author content safe are the benefits."
go_deeper:
  - { title: "Cloud Manager pipelines and quality gates", url: "/blog/2026/11/aem-cloud-manager-pipelines-quality-gates-rde-config-pipeline/", why: "how the all package gets deployed" }
  - { title: "AEM on-premise and managed services to Cloud Service migration", url: "/blog/2026/11/aem-on-premise-and-managed-services-to-aem-as-a-cloud-service-migration/", why: "what changes when code and content are separated" }
  - { title: "Configuration, secrets and run modes (lesson 31)", url: "/learn/aem/config-secrets-run-modes/", why: "more on ui.config" }
  - { title: "Next lesson: Local setup", url: "/learn/aem/local-setup-sdk-maven/" }
---
## Why a project has modules

Imagine moving house. You would not throw furniture, boxes of books and the family pets into one van. Each needs different handling. An AEM project has the same problem: Java code, front-end assets, component definitions, configuration, sample content and web-server rules all need different treatment, so they are kept in separate modules.

The **AEM Project Archetype** generates that layout for you, and Cloud Manager expects it.

## The modules

| Module | What goes in it |
|---|---|
| `core` | Java: Sling Models, servlets, services. Built as an OSGi bundle. |
| `ui.apps` | Component definitions, HTL, dialogs, client libraries, installed under `/apps`. |
| `ui.apps.structure` | A small package that declares the repository structure, so code packages do not overwrite each other. |
| `ui.config` | OSGi configuration (by run mode) and Repo Init scripts. |
| `ui.content` | Starter content and configuration under `/content` and `/conf`. |
| `ui.frontend` | Webpack build for CSS and JavaScript, which produces a client library for `ui.apps`. |
| `all` | The single package that embeds everything above. This is what is deployed. |
| `dispatcher` | Dispatcher and web-server configuration. |
| `it.tests`, `ui.tests` | Integration tests and UI tests. |

Newer archetype versions may also include an `analyse` module that checks the package structure. The exact set depends on the options you choose when you generate the project.

## Immutable versus mutable

This is the most important idea in the lesson.

- **Immutable:** `/apps` and `/libs`. Code and configuration. They are built, tested and deployed as part of a new version of the application, and cannot be changed at runtime.
- **Mutable:** `/content`, most of `/conf`, `/var` and similar. These are changed by authors and by the system while the instance runs.

Why? On Cloud Service, a new version is built, tested and rolled out as a whole, and every instance runs the same code. If anyone could edit `/apps` on a live instance, instances would drift and you could not reproduce a bug. So code goes in through the pipeline, and content stays free to change.

The practical rule for you: **code in `ui.apps`, `core` and `ui.config`; starter content in `ui.content`.**

## filter.xml: who owns which path

Every content package has a `filter.xml`. It lists the paths the package may write to:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<workspaceFilter version="1.0">
    <filter root="/apps/mysite" />
    <filter root="/apps/mysite-packages" />
</workspaceFilter>
```

In the default mode a filter root is **replaced**: what is in the package becomes what is in the repository. That is safe for `/apps/mysite`, because only your code lives there. It is dangerous for a path authors edit. So `ui.content` should claim only what it genuinely owns, and be careful with merge and replace behaviour. For content that was created once and then edited, it is usually better to deploy the starter once and not keep re-deploying it.

<details markdown="1">
<summary>Stretch question: why does `all` exist if each module is already a package?</summary>

Cloud Manager deploys one artifact. The `all` package embeds the others, so a release is one unit, versioned and tested together. Each other package is marked so it is not deployed on its own, which stops half a release from reaching an environment.

</details>

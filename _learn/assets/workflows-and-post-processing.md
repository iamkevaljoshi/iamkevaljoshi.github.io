---
title: "Workflows and post-processing"
description: "How asset processing moved from the 6.5 DAM Update Asset workflow to microservices, and how optional post-processing workflows add custom steps on Cloud Service."
track: assets
level: 3
order: 15
minutes: 9
outcome: "By the end you can explain what a post-processing workflow is for, how it is attached to a folder, and what makes one risky."
prereq: "Asset compute microservices (lesson 14)."
terms:
  - { t: "DAM Update Asset workflow", d: "The AEM 6.5 workflow that did all asset processing on the author server. Legacy for processing on Cloud Service." }
  - { t: "Post-processing workflow", d: "An optional standard workflow that runs after microservices processing finishes." }
  - { t: "Auto-start workflow", d: "The folder setting, in the Asset Processing tab, where you choose a post-processing model." }
  - { t: "Completion step", d: "The final step, DAM Update Asset Workflow Completed Process, that marks processing as finished." }
  - { t: "Transient workflow", d: "A workflow that does not keep its run history, which reduces repository overhead." }
mistake: "Rebuilding the old 6.5 DAM Update Asset workflow as a post-processing workflow. On Cloud Service the microservices already do that work, so you only slow ingestion and duplicate effort."
try_it:
  - "List the custom steps your current DAM runs after upload, such as notifying a team or setting a metadata value."
  - "For each, ask: is this processing (a rendition), or business logic after processing?"
  - "Open Tools, Workflow, Models in an environment you have access to and look at the existing models without editing them."
  - "Sketch a two-step post-processing model on paper that ends with the completion step."
quiz:
  - q: "On Cloud Service, who creates thumbnails and the web rendition?"
    options:
      - "The DAM Update Asset workflow running on the author server"
      - "A workflow launcher that you must configure for each folder"
      - "The asset microservices, with no workflow needed"
      - "The publish tier when assets are first requested"
    answer: 2
    why: "Microservices do standard processing. The DAM Update Asset workflow is the 6.5 way and is not how Cloud Service generates renditions."
  - q: "A brand team wants an approval task created for every new asset in the Legal folder, after renditions exist. What fits best?"
    options:
      - "A post-processing workflow attached to that folder"
      - "A custom App Builder worker that also creates tasks"
      - "A change to the default processing profile"
      - "A manual reminder in the team chat"
    answer: 0
    why: "A post-processing workflow is for steps that run after processing. A worker produces renditions, not business tasks, and the default profile is not editable."
  - q: "You attach a custom model as a folder's auto-start workflow but forget the final step. What is the likely outcome?"
    options:
      - "Nothing, the platform adds the final step for you"
      - "The workflow is rejected when you save the folder"
      - "Assets are processed twice as a safety measure"
      - "Assets may never be marked as finished processing"
    answer: 3
    why: "Adobe documents the completion step as the one that marks processing as finished. Without it, assets can appear stuck, and the platform does not repair the model."
  - q: "Which is a pitfall of heavy post-processing workflows?"
    options:
      - "They stop microservices from generating renditions"
      - "They make ingestion slower, because assets are not finished until they complete"
      - "They are only available on AEM 6.5"
      - "They can only run on one folder in the whole DAM"
    answer: 1
    why: "Processing is not complete until the workflow reaches its end, so long or fragile steps delay every upload in scope. They do not block renditions, and they are a Cloud Service feature."
go_deeper:
  - { title: "Cloud Manager pipelines, quality gates and RDE", url: "/blog/2026/11/aem-cloud-manager-pipelines-quality-gates-rde-config-pipeline/", why: "how custom workflow code reaches your environments" }
  - { title: "Migration playbook", url: "/blog/2026/11/aem-on-premise-and-managed-services-to-aem-as-a-cloud-service-migration/", why: "retiring 6.5 workflow customisations" }
  - { title: "Next lesson: Video, PDF and other formats", url: "/learn/assets/video-pdf-and-other-formats/" }
---
## The old way and the new way

Picture a factory with one conveyor belt. In AEM 6.5, that belt was the **DAM Update Asset** workflow. Every upload rode it on the author server: make thumbnails, extract metadata, create renditions. Teams customised it by inserting their own steps, and over the years those belts grew long and fragile.

On Cloud Service the factory work moved to cloud microservices (lesson 14). The standard processing no longer needs you to model it as a workflow at all. This is the biggest mental shift for anyone upgrading: **do not rebuild the old workflow**.

## So what are workflows still for?

Some steps are not about renditions. They are business logic that should happen once an asset is ready: start a review, set a rights field, call another system, move a file. For that, Cloud Service offers **post-processing workflows**. They run after microservices finish, and they must be standard AEM workflow models.

## Attaching one

Adobe documents two routes:

1. On a folder, open Properties, then the Asset Processing tab, and choose the model under **Auto-start Workflow**.
2. Configure the **Custom Workflow Runner** OSGi service with a path or expression mapping.

Your model needs one rule: the last step must be **DAM Update Asset Workflow Completed Process**. That step tells AEM processing is done, and the asset moves on to its finished state.

```text
Upload -> microservices -> [your steps ...] -> DAM Update Asset Workflow Completed Process
```

To switch off post-processing for a folder, Adobe's approach is to apply an empty model that contains only the completion step, set as transient.

## Launchers versus the cloud model

In 6.5, workflow launchers watched the repository and started workflows when nodes changed. That model is why teams wired many things to uploads. On Cloud Service, the supported flow is microservices first, then an optional post-processing workflow you attach deliberately. Keep launcher-style thinking for non-processing events and check Experience League before assuming an old launcher still fits.

## Pitfalls

- **Heavy steps slow everyone.** The asset is not finished until the workflow ends, so a slow external call delays every upload in that folder.
- **Doing processing in a workflow.** Renditions belong in profiles or workers.
- **Wide scope.** Attaching a workflow at a high folder runs it for a lot of assets. Scope it narrowly.
- **No failure plan.** Decide what happens when an external system is down.

Use transient workflows where you do not need history, and keep steps short.

<details markdown="1">
<summary>Stretch question</summary>

An agency hands over 6.5 customisations: three custom steps inside DAM Update Asset. How would you triage them?

Sort each into three piles: already done by microservices (drop it), a rendition need (profile or worker), or real business logic (post-processing workflow). Most steps usually land in the first pile.

</details>

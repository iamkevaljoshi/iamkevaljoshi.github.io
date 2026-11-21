---
title: "Capstone: plan a migration end to end"
description: "Project: turn a fictional AEM 6.5 estate into a migration plan with an architecture choice, estimate range, timeline, risks, cutover plan and go-live checklist."
track: aem
level: 6
order: 40
minutes: 30
kind: project
outcome: "By the end you can produce a one-to-two page migration plan for a realistic AEM estate and check it against a clear definition of a good answer."
prereq: "Lessons 35 to 39 of this track: architecture choice, BPA, estimation, the migration playbook and the go-live checklist."
terms:
  - { t: "Migration plan", d: "A short document that states the target architecture, the effort range, the phases, the risks and the cutover approach." }
  - { t: "Estate", d: "Everything you are migrating: sites, templates, components, content, integrations and the people and systems around them." }
  - { t: "Assumptions log", d: "A list of things treated as true in the estimate, each with an owner and a date to check." }
  - { t: "Definition of done", d: "The observable conditions that tell you the plan is complete, used here for self-assessment." }
mistake: "Writing a plan that is a list of tasks with no reasons. A reviewer cannot tell whether the architecture choice, the range or the risks came from the evidence, so the plan cannot be challenged or trusted."
try_it:
  - "Read the estate brief below and underline the facts that will drive the architecture choice and the effort."
  - "Choose the target architecture and write three sentences of reasoning that use the facts, not preferences."
  - "Open the migration estimator, enter the numbers, and record the total and timeline. Then vary the key inputs to get a low and a high figure."
  - "Write a phased timeline using the phases from the playbook lesson, showing which work overlaps."
  - "List your top five risks, each with a probability, an impact and a mitigation with an owner."
  - "Write the cutover plan: top-up schedule, freeze length, DNS or CDN switch, redirects, rehearsal and rollback."
  - "Pick ten go-live checklist items across at least five areas, each with an owner and a blocks-launch rating."
  - "Score your plan against the definition of a good answer at the end and fix the weakest section."
quiz:
  - q: "Why should the estimate in your plan be a range with stated assumptions?"
    options:
      - "A range is quicker to produce than a single figure"
      - "It shows what is uncertain and lets the sponsor plan around it"
      - "Ranges are required by Cloud Manager"
      - "It lets you avoid listing any risks"
    answer: 1
    why: "Ranges and assumptions make the uncertainty visible. They are not faster, not a platform rule, and they sit alongside the risk list rather than replacing it."
  - q: "In the estate below, the BPA report flags schedulers and runtime writes to /apps. Where should that show up in your plan?"
    options:
      - "Only in the go-live checklist"
      - "Nowhere, because BPA findings are fixed automatically"
      - "In the content migration phase"
      - "In the refactoring effort, the timeline and the risk list"
    answer: 3
    why: "Those findings are code refactoring work, so they affect effort, the build phase and the risk of late surprises. They are not content migration items and they are not fixed automatically."
  - q: "Your rehearsal suggests the final top-up plus validation takes 10 hours, but the business can accept a 6-hour freeze. What belongs in the plan?"
    options:
      - "More frequent top-ups to shrink the delta, then a second rehearsal"
      - "A note saying the freeze will be 6 hours regardless"
      - "Dropping validation to save time"
      - "Postponing the whole programme"
    answer: 0
    why: "Smaller deltas from earlier and more frequent top-ups are the lever, and a repeat rehearsal proves it. Declaring the number or dropping validation ignores the evidence."
  - q: "Which is NOT a feature of a good migration plan?"
    options:
      - "Risks with owners and mitigations"
      - "An architecture choice tied to the estate facts"
      - "A rollback plan described and rehearsed before cutover"
      - "A single fixed date presented with no assumptions"
    answer: 3
    why: "A date with no assumptions hides the uncertainty the plan exists to expose. The other three are what make a plan checkable and credible."
go_deeper:
  - { title: "AEM migration estimator", url: "/tools/aem-migration-estimator/", why: "use it for the estimate range in this project" }
  - { title: "How to estimate an AEM project, and why estimates go wrong", url: "/blog/2026/11/how-to-estimate-an-aem-project/", why: "ranges, risks and the assumptions log" }
  - { title: "AEM 6.5 or AMS to AEM as a Cloud Service: the migration playbook", url: "/blog/2026/11/aem-on-premise-and-managed-services-to-aem-as-a-cloud-service-migration/", why: "a full worked reference for the phases and cutover" }
  - { title: "The AEM go-live checklist", url: "/blog/2026/11/aem-go-live-checklist/", why: "pick your checklist subset from here" }
  - { title: "AEM redirect map builder", url: "/tools/aem-redirect-map-builder/", why: "for the redirect part of your cutover plan" }
---
## The brief

You are the architect at a consultancy. A fictional company, **Northwind Foods**, runs AEM 6.5 on its own servers and must move to AEM as a Cloud Service. Produce the migration plan the steering group will review. Here is the estate:

| Item | Value |
|---|---|
| Source | AEM 6.5 on-premise, one author, two publish |
| Sites | 3: corporate brand, product catalogue, careers |
| Page templates | 14, mostly static templates, 4 editable |
| Components in use | 52, about 30 after merging near-duplicates |
| Locales | 4 (English, French, German, Spanish) |
| Pages | about 18,000 |
| Assets | about 60,000, repository about 150 GB |
| Integrations | 5: site search, CRM forms, product feed, SSO, analytics tags |
| Team | 3 AEM developers, 2 QA engineers, part-time architect and project manager |
| Business facts | Marketing wants faster pages; organic search is the main channel; careers site has 4 editors, brand site has 25 across markets |

**BPA summary:** 3 findings at the highest severity (a scheduler that syncs the product feed, runtime writes to `/apps`, a custom replication agent), 40 at major severity (mostly Classic UI dialogs and static templates), about 300 advisory and informational. A repository with mixed code and content packages.

## What to produce

Write a plan of one to two pages with these sections.

**1. Architecture choice.** Which option fits each site: traditional AEM Sites, Edge Delivery Services, headless, or a mix? Use the estate facts. A defensible answer might keep the brand site on AEM as a Cloud Service for its governance and markets, and consider Edge Delivery Services for the careers site. A different answer is fine if the reasoning holds.

**2. Estimate range.** Use the migration estimator with the numbers above, then vary inputs such as component count, contingency and rehearsals to get a low and a high total. List at least five assumptions with owners.

**3. Phased timeline.** Use the phases from the playbook lesson, showing which run in parallel.

**4. Top five risks.** For each: probability, impact, mitigation, owner. Think about the scheduler, SSO, firewall access for the transfer tools, redirects and content freeze.

**5. Cutover plan.** Top-up schedule, freeze length, DNS or CDN switch, redirect approach, rehearsal and rollback.

**6. Go-live checklist subset.** Ten items from at least five areas, each with an owner and a rating.

## What "done" looks like

Use this to self-assess. A good plan:

- Ties the architecture choice to at least three facts from the brief, and names what it traded away.
- Gives a **range**, not a point, plus assumptions that explain the width.
- Connects BPA findings to refactoring effort and to named risks.
- Shows overlapping tracks (code and content) rather than a strict waterfall.
- Has risks that are specific to this estate, each with an owner, not generic statements like "scope creep".
- Describes a cutover with top-ups, a bounded freeze, redirects, a rehearsal and a rollback trigger.
- Picks checklist items with a reason and an owner, and says which would block launch.
- Fits on one to two pages and could be read by a steering group in ten minutes.

If any bullet is missing, that section is your next edit.

<details markdown="1">
<summary>Stretch question: what would change your plan if SSO federation took six weeks longer than expected?</summary>

Author acceptance testing and content ingestion rehearsals depend on authors being able to log in, so the test phase would slip even if the code is ready. The mitigation is to start identity work in week one, run it in parallel, and list it as an assumption with an owner. In the estimate, that risk would contribute a weighted buffer, not a flat percentage.

</details>

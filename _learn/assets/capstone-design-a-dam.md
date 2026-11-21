---
title: "Capstone: design a DAM end to end"
description: "A capstone design project: take a fictional multinational with 1.2 million legacy assets and produce a full AEM Assets design, from metadata model to migration plan."
track: assets
level: 6
order: 37
minutes: 30
kind: project
outcome: "By the end you can produce and defend a complete DAM design covering structure, metadata, processing, delivery, governance, integrations and a phased migration."
prereq: "Lessons 1 to 36 of this track. This project is done on paper or in a spreadsheet, so no AEM environment is required."
terms:
  - { t: "Design brief", d: "The statement of a client's situation, numbers and constraints that your design must answer." }
  - { t: "Phasing", d: "Splitting delivery into stages that each give value and reduce risk, rather than one big switch." }
  - { t: "Success measure", d: "A number you can check later to prove the design worked, such as time to find an asset." }
  - { t: "Trade-off", d: "A choice where improving one quality costs another, which a good design states openly." }
  - { t: "Assumption", d: "A fact you have not been given and have decided to rely on, written down so it can be challenged." }
mistake: "Answering with a list of features. A design is a set of decisions tied to the brief's numbers, with reasons and trade-offs, so a feature tour scores badly however long it is."
try_it:
  - "Read the brief below and underline every number and constraint. Write them as a one-page fact sheet, plus your assumptions."
  - "Design the folder structure and naming convention, then the metadata model, and justify each against the 8 brands and 5 regions."
  - "Choose processing profiles and delivery for the Sites and Edge Delivery Services estate, and state the trade-offs."
  - "Define roles, permissions, approvals and expiry rules, including how the two agencies get access."
  - "List integration points and the API used for each, then write the migration plan in at least four phases."
  - "Add the top five risks with mitigations and five success measures with targets, then self-assess with the checklist."
quiz:
  - q: "Which opening best starts a DAM design for the brief below?"
    options:
      - "A list of every AEM Assets feature"
      - "A fact sheet of the brief's numbers, constraints and your assumptions"
      - "A migration schedule with dates"
      - "A choice of folder names for the first brand"
    answer: 1
    why: "Decisions need to be tied to facts, and assumptions need to be visible. Starting from features or dates leads to a design that answers nothing in particular."
  - q: "The brief has 1.2 million assets in three systems. What belongs in the plan before any bulk transfer starts?"
    options:
      - "Importing the smallest system first without any checks"
      - "Waiting until all five regions agree on a single logo"
      - "Inventory, deduplication and a metadata mapping, followed by a rehearsal"
      - "Switching off search to speed up processing"
    answer: 2
    why: "Cleaning and mapping decide what moves and how it will be found, and rehearsals expose the real timing and failures (lesson 35). Importing first copies the mess into the new DAM."
  - q: "Two agencies must deliver files but must not see other brands' assets or rights data. Which design satisfies this?"
    options:
      - "Share one admin login between both agencies"
      - "Give both agencies read access to everything and rely on trust"
      - "Email files to a manager who uploads them"
      - "Per-brand groups with upload-only folders for each agency, and approval before release"
    answer: 3
    why: "Least privilege through groups and folder permissions, plus an approval step, keeps work moving and protects other brands (lessons 26 and 28). Shared logins and open read access fail an audit."
  - q: "Which is NOT a mark of a strong capstone answer?"
    options:
      - "Every decision is linked to a number or constraint in the brief"
      - "It names risks and how they would be reduced"
      - "It states trade-offs and assumptions openly"
      - "It specifies exact product limits from memory, with no sources"
    answer: 3
    why: "Unsourced limits go out of date and cannot be defended. A strong answer says which limits must be checked in the current documentation and designs so that it does not depend on a remembered number."
go_deeper:
  - { title: "Migrating AEM on-premise and Managed Services to AEM as a Cloud Service: an architect's playbook", url: "/blog/2026/11/aem-on-premise-and-managed-services-to-aem-as-a-cloud-service-migration/", why: "phasing, rehearsals and go-live precautions" }
  - { title: "Composable, headless or traditional AEM: a decision framework", url: "/blog/2026/11/composable-headless-or-traditional-aem-decision-framework/", why: "a model for weighing trade-offs" }
  - { title: "AEM go-live checklist", url: "/blog/2026/11/aem-go-live-checklist/", why: "what to check before cutover" }
  - { title: "AEM migration estimator", url: "/tools/aem-migration-estimator/", why: "a first sizing to compare with your plan" }
---
## The brief

**Meridian Group** is a multinational consumer goods company. It has asked you to design its DAM on AEM Assets as a Cloud Service.

- **8 brands**, some global and some regional, with different branding rules.
- **1.2 million legacy assets** in **3 systems**: an ageing AEM 6.5 instance, a third-party DAM and a shared file server. Estimated 30 to 40 percent are duplicates or unused.
- **5 regions**, each with local marketing teams and local rights rules.
- **2 external agencies** that produce photography and video and need to deliver into the DAM.
- A **Sites and Edge Delivery Services estate**: some brand sites on AEM Sites, newer ones on Edge Delivery Services.

You may state assumptions. Where you need a figure the brief does not give, invent a reasonable one and flag it.

## What to produce

Write one document of four to six pages, or a spreadsheet with one tab per section. Do it on paper: no environment is needed.

1. **Structure and naming** (lesson 3): top-level folder strategy (by brand, region or both?), naming rules, and what lives outside the main tree.
2. **Metadata model** (lessons 7 to 9, 12): schemas per asset type, mandatory fields, controlled vocabularies, tags and taxonomy, and which fields must be searchable (lesson 34).
3. **Processing and enrichment** (lessons 13 to 17): profiles for images and video, post-processing, and whether smart tags help or add noise.
4. **Delivery** (lessons 19 to 24): how Sites and Edge Delivery Services get optimised images, which delivery option for which channel, caching, and what is delivered to the public versus kept private.
5. **Governance and permissions** (lessons 26 to 30): roles, groups, agency access, approvals, expiry and rights, versions, duplicates and cleanup.
6. **Integration** (lessons 32 and 33): connection points such as a PIM, Creative Cloud, and any central DAM feeding regional Sites (Connected Assets), with the API for each.
7. **Migration plan** (lesson 35): phases, tools per source, rehearsals, validation, cutover and the legacy ID strategy.
8. **Risks and success measures:** top five risks and five measurable targets.

## A sample shape for the answer

A short fragment shows the level of specificity expected:

```text
Decision: one global brand tree, regional subfolders inside each brand.
Why: 8 brands have distinct rules; regions differ mainly in rights, which are metadata, not folders.
Trade-off: regional teams see fewer folders but rely on filters, so rights-region must be searchable.
Assumption: 60% of assets are global, 40% regional.
```

## Phasing hint

A defensible plan is rarely one big switch. For example: foundation and governance first, then the cleaned AEM 6.5 content with the Content Transfer Tool, then files from storage via bulk import, then agencies and integrations, then retirement of the old systems. You may choose differently, if you explain why.

## What good looks like

Score yourself honestly, one point each:

- Every section cites at least one number from the brief.
- The folder design explains why it is not simply "by region".
- Rights, expiry and region are modelled as metadata with controlled values.
- Agencies have least-privilege access and an approval step.
- Duplicates and junk are removed before migration, with a target.
- Integrations name the mechanism, such as aem-upload or an Author API, and the credential type.
- The migration has at least four phases, rehearsals and a validation checklist with counts, checksums and metadata.
- Risks include processing backlog, stakeholder disagreement over taxonomy and cutover freeze.
- Success measures are numbers, for example "median time to find an asset under 30 seconds".
- Limits and product names are marked "verify in current documentation" rather than quoted from memory.

Eight or more means a solid design. Below six, revisit the sections with no points.

<details markdown="1">
<summary>Stretch question: what would you cut if the budget halved?</summary>

Cut by value, not by section. Smart tags, advanced video profiles and a second integration are usually deferrable, whereas metadata, permissions and migration quality are expensive to fix later. Saying what you would defer, and the risk of doing so, is a strong sign of a real design.

</details>

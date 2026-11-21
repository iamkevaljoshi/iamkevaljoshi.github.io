---
title: "Permissions and access control"
description: "Who can see, change and publish what in AEM Assets as a Cloud Service: product profiles, groups, folder permissions, inheritance and designing from your folders."
track: assets
level: 5
order: 26
minutes: 10
outcome: "By the end you can design a small set of groups and folder-level permissions that give each team the access it needs, and no more."
prereq: "Lesson 3 (folder structure and naming). The general ACL model is in the AEM track lesson on security and permissions."
terms:
  - { t: "Product profile", d: "An Adobe Admin Console grouping that decides whether a person may reach an AEM environment at all, and at what broad level." }
  - { t: "Group", d: "A named set of users inside AEM that permissions are granted to, so you never grant them to individuals." }
  - { t: "Folder permission", d: "An access entry on a DAM folder, such as view or edit, that cascades to everything beneath it." }
  - { t: "Inheritance", d: "The rule that a folder uses the permissions of its parent unless something nearer overrides them." }
  - { t: "Least privilege", d: "Giving each group only the access its work needs." }
mistake: "Granting access person by person, or using explicit deny to patch gaps. The result is a permission set nobody can explain, and an audit or a leaver turns into days of detective work."
try_it:
  - "Take the folder tree you built in lesson 3 and list the top two levels."
  - "Write down four roles you actually need, for example viewer, contributor, asset manager and administrator, with one sentence each."
  - "Build a grid: rows are folders, columns are roles, cells are none, view, edit or manage."
  - "Mark every cell where you would be tempted to use a deny, then redesign the folders or roles so no deny is needed."
  - "Name each group after the folder and the role, for example `brand-a-contributors`, and note who owns membership."
quiz:
  - q: "In AEM Assets as a Cloud Service, what does a product profile in the Admin Console mainly control?"
    options:
      - "Whether a person can reach the environment, and at what broad level"
      - "Which individual folders each person may open"
      - "Which renditions are generated for each folder"
      - "Which assets are published to the website"
    answer: 0
    why: "Product profiles are the front door: they say who can reach an environment. What someone may do in a given folder is decided inside AEM by groups and folder permissions."
  - q: "A brand has an Internal folder under its main folder. Agency staff must see Brand but not Internal. What is the sturdiest design?"
    options:
      - "Deny the agency group on Internal and allow it on Brand"
      - "Keep Internal in a separate branch that the agency group is never granted"
      - "Give each agency user a personal permission on Brand"
      - "Rename Internal so agency staff are unlikely to open it"
    answer: 1
    why: "If the structure itself separates audiences, access is simply never granted. A deny works but is fragile, and per-user entries or obscurity do not scale or protect anything."
  - q: "A contributor leaves the company. Which setup makes removing their access quickest and safest?"
    options:
      - "Permissions granted directly to each person on each folder"
      - "A shared team login that you change when someone leaves"
      - "Permissions granted to groups, with the person removed from the groups"
      - "A deny entry added for that person on the root folder"
    answer: 2
    why: "Group-based access means one membership change removes all of it. Direct grants must be hunted down folder by folder, and a shared login hides who did what."
  - q: "Which statement about folder permissions is NOT true?"
    options:
      - "Permissions on a parent folder usually cascade to its children"
      - "Roles such as viewer and contributor are best mapped to groups"
      - "Granting edit on a high folder gives edit on everything below it"
      - "A group's access is fixed by its name, whatever the folder"
    answer: 3
    why: "A group name means nothing to AEM. Access comes only from the permission entries attached to it, which is why naming and documentation matter. The other three statements describe inheritance and grouping correctly."
go_deeper:
  - { title: "Security and permissions (AEM track)", url: "/learn/aem/security-and-permissions/", why: "how ACLs, principals and IMS work underneath" }
  - { title: "Folder structure and naming conventions", url: "/learn/assets/folders-structure-and-naming/", why: "the structure your permissions will sit on" }
  - { title: "JCR explained for SQL developers", url: "/blog/2026/11/jcr-explained-for-sql-developers/", why: "why folders are nodes and permissions are entries on them" }
---
## The problem: a library everyone can reach

A DAM with 50,000 assets and 400 users is a shared office. Without rules, the finance team's draft logos sit next to the approved brand kit, an agency can overwrite a master file, and nobody can say who allowed it. Permissions are how you turn one big library into rooms with the right keys.

## Two layers: who gets in, and what they can do

Think of a building. The **front door** decides whether you can enter the environment. The **room locks** decide which rooms you may use once inside.

- **Front door: Adobe Admin Console.** On AEM as a Cloud Service, people sign in through Adobe IMS. Product profiles (for AEM Assets, typically collaborator, power user and administrator levels) grant access to the environment. Check Experience League for the exact profile names in your tenant, as they have changed over time.
- **Room locks: groups and folder permissions.** Inside AEM, users belong to groups, and groups are given permissions on folders under `/content/dam`. In the Assets view you typically apply view or edit permission to a folder for a group. The underlying model is the JCR ACL covered in the [security lesson](/learn/aem/security-and-permissions/).

Permissions on a folder cascade to its subfolders and assets. That is the central idea: **design your folders, then grant at the right level**.

## Roles in practice

Most teams need only four roles. The names are yours; the pattern is what matters.

| Role | Typical access | Typical members |
|---|---|---|
| Viewer | Browse and download | Sales, regional staff, partners |
| Contributor | Upload and edit metadata in their own area | Brand teams, agencies |
| Asset manager | Edit across a brand, manage metadata, publish, delete | DAM team |
| Administrator | Configuration, profiles, schemas | A few named people |

Adobe's own guidance is to grant permissions to groups, never individuals, and to keep a permission matrix in a document. AEM also ships standard groups such as `dam-users`; custom groups can be members of them to inherit baseline access. Treat that as a starting point, and check what the standard groups already grant before you add to them.

## Designing from the folder structure

Here is a typical layout and how access maps onto it.

```text
/content/dam/
  acme-brands/
    brand-a/
      approved/        viewers: all staff      contributors: brand-a team
      work-in-progress/ viewers: brand-a team   contributors: brand-a team, agency-x
    brand-b/
      ...
  internal-only/       viewers: hq-staff
```

Because `approved` and `work-in-progress` are separate folders, the rule is plain: everyone reads approved, only the brand and its agency touch work in progress. Nobody needs a deny. Compare that with one flat folder where you try to hide half the files with denies: it breaks the day someone moves an asset.

## Common mistakes

- **Per-user permissions.** They pile up and never get removed.
- **Explicit deny as a fix.** A deny near a leaf overrides an allow above it, which surprises people. Use it rarely, and write down why.
- **Too much at the root.** Edit rights on `/content/dam` give edit to every brand.
- **Granting to see, forgetting to publish.** Who may publish is a separate decision from who may edit. Keep it with asset managers.
- **No owner for group membership.** Groups drift unless someone is accountable for them.

Test as the lowest role, not as an administrator. An admin session will never show you a missing permission.

<details markdown="1">
<summary>Stretch question: should agencies sit in your groups or in their own?</summary>

Give each agency its own group, scoped to the folders it works in. That way you can remove one agency at the end of a contract without touching anyone else, and the folder history still shows which agency uploaded what.

</details>

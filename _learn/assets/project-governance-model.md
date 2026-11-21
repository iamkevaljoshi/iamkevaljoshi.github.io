---
title: "Project: design a governance model"
description: "A paper project: design roles, folder permissions, an approval flow, an expiry policy and a clean-up routine for a fictional company with 8 brands and 3 agencies."
track: assets
level: 5
order: 31
minutes: 20
kind: project
outcome: "By the end you can produce a one-page governance model for a multi-brand DAM and check it against a 'what good looks like' list."
prereq: "Lessons 26 to 30 of this track, and lesson 3 (folder structure)."
terms:
  - { t: "Governance model", d: "A short written set of rules that says who can do what in the DAM, how assets are approved, how long they live and how they are cleaned up." }
  - { t: "Permission matrix", d: "A grid of groups against folders showing the access each group has." }
  - { t: "Policy owner", d: "The named person accountable for one rule, such as expiry or clean-up." }
  - { t: "Exception path", d: "The agreed way to ask for access or a rule change outside the normal model." }
mistake: "Writing a long policy document that nobody reads. A governance model that does not fit on one page is rarely followed, and an unfollowed model is the same as none."
try_it:
  - "Read the brief below and list the three biggest risks it creates, for example agency overreach, expired licences and duplicate sprawl."
  - "Define five or six groups, name each one, and write who is in it and who owns its membership."
  - "Fill in a permission matrix for the folder tree, with no deny entries and no per-user grants."
  - "Draw the approval flow as a single line of states, and mark who moves an asset between them and what is gated."
  - "Write the expiry policy and the monthly clean-up routine, each with an owner and a date."
  - "Assemble everything on one page, then score it against the self-assessment list."
quiz:
  - q: "In the sample brief, why is each agency given its own group rather than a shared 'agencies' group?"
    options:
      - "AEM does not allow shared groups for external users"
      - "Agencies need different permissions on different days"
      - "Agencies are not allowed to edit any metadata"
      - "One agency can be removed at contract end without touching the others"
    answer: 3
    why: "Separate groups limit each agency to its own work areas and make offboarding a single change. Shared groups are possible, but they blur who can see what."
  - q: "The matrix for Brand A needs agency staff to read approved assets but not see internal ones. What is the best design?"
    options:
      - "Put internal material in its own folder or branch that the agency group never receives"
      - "Put everything in one folder and deny the agency on each internal file"
      - "Give the agency per-user access to approved assets only"
      - "Trust the agency not to open internal files"
    answer: 0
    why: "Structure beats exceptions. Not granting access is simpler and more reliable than a pile of denies or individual grants, and trust is not a control."
  - q: "Your governance page lists an expiry policy but names no owner and no review date. What is the likely outcome?"
    options:
      - "It works anyway, because AEM enforces the policy fully"
      - "It becomes a document nobody acts on, and expired licences go unnoticed"
      - "AEM will assign an owner automatically"
      - "Expiry will be switched off by the scheduler"
    answer: 1
    why: "Tools flag and unpublish, but humans decide renewals and replacements. A rule without an owner and a date is just text."
  - q: "Which model for 400 users would you reject?"
    options:
      - "Six groups, a matrix on one page and a named owner per group"
      - "Four approval states with two gates, for publishing and sharing"
      - "Personal permissions for senior staff, who are 'too busy' for groups"
      - "A monthly clean-up with a report, triage and a record of removals"
    answer: 2
    why: "Exceptions for senior people create the very sprawl the model is meant to prevent, and they are hardest to find later. The other designs match the patterns taught in this level."
go_deeper:
  - { title: "Permissions and access control", url: "/learn/assets/permissions-and-access/", why: "the role and folder design this project uses" }
  - { title: "Approvals and review", url: "/learn/assets/approvals-and-review/", why: "the lightweight states and gates" }
  - { title: "Usage, references and cleanup", url: "/learn/assets/usage-references-and-cleanup/", why: "the clean-up routine" }
  - { title: "AEM Go-Live checklist", url: "/blog/2026/11/aem-go-live-checklist/", why: "where governance fits before launch" }
---
## What you are building

This is a **paper project**: you need a document or spreadsheet, not an environment. If you do have an AEM Assets as a Cloud Service sandbox, you can test one or two folder permissions at the end, but the thinking is the point. Allow about 20 minutes, or longer if you want to polish it.

You will produce a **one-page governance model** for the company below, then score it.

## The brief

**Acme Consumer Group** sells household products.

- **8 brands**, each with its own marketing team of about 10 people.
- **400 users** in total: brand teams, regional sales staff, a 6 person central DAM team, and legal.
- **3 agencies**: a creative agency, a photography studio and a video house. Each works for several brands, but must not see other agencies' work or any brand's internal material.
- About **120,000 assets** today, growing by 15,000 a year.
- **Licensed content:** roughly 8 percent of images are stock or rights-managed, with end dates.
- **Problems today:** agencies can overwrite masters, three versions of the same logo are in circulation, and last year two licences lapsed unnoticed.

## Steps

### 1. Roles and groups

Start from the four roles in [lesson 26](/learn/assets/permissions-and-access/): viewer, contributor, asset manager, administrator. Then turn them into groups by brand and agency. A workable starting set:

```text
all-staff-viewers          read approved assets, all brands
brand-<x>-contributors     upload and edit in work-in-progress, brand x   (x8)
brand-<x>-managers         manage, approve and publish, brand x           (x8)
agency-creative            contribute in assigned work-in-progress only
agency-photo               contribute in assigned work-in-progress only
agency-video               contribute in assigned work-in-progress only
dam-admins                 configuration and schemas (3 named people)
legal-rights               edit rights metadata everywhere, read-only otherwise
```

That is a lot of groups. If it feels heavy, reduce it: one contributors and one managers group per brand is the minimum that still stops one brand editing another.

### 2. Folders and the permission matrix

```text
/content/dam/acme/
  brand-a/ approved/  work-in-progress/  _archive/
  brand-b/ ...
  shared/  logos-and-templates/
```

Fill a grid, rows are folders and columns are groups, with cells of none, view, edit or manage. Rules to hold yourself to: no deny entries, no individual grants, and agencies only appear on the work-in-progress folders they are assigned.

### 3. Approval flow

Use `draft -> in review -> approved -> retired`. Decide who moves an asset into each state, and put two gates in writing: only `approved` assets are published, and only `approved` assets go into collections shared externally. Say which tool does the review (the review task in AEM Assets, or Workfront if you have it) and where the outcome is recorded: an `approval.status` metadata field.

### 4. Expiry policy

State that every rights-managed asset must carry a licence end date, regions and channels. Name the policy owner (for example the legal-rights group), the warning times (60 and 30 days before), and the action: renew, replace or retire. Remember from lesson 27 that expiry unpublishes inside AEM, but cannot recall copies or clear a cache.

### 5. Clean-up routine

Copy the monthly routine from lesson 30. Assign an owner, decide the archive path, and set retention for campaign images, product images and signed releases with legal.

### 6. One page

Put it on a single page with these headings: **Roles**, **Folders and access**, **Approval**, **Expiry**, **Clean-up**, **Owners and exceptions**. The last heading says who to ask for access that is not in the model.

## What done looks like

- A single page, readable in five minutes.
- Every rule has a named owner and a review date.
- No deny entries and no per-user permissions.
- Agencies cannot see each other or internal material.
- Expiry and clean-up have a monthly rhythm.

## What good looks like: self-assessment

Score one point for each yes.

1. Could a new starter find their group from the page alone?
2. Can you remove an agency with one change?
3. Is "approved" defined, and does something depend on it?
4. Does every licensed asset have an end date and a contact?
5. Does clean-up have an owner, a report and a record?
6. Does the page say what happens when someone needs an exception?

Five or six is a strong model. Three or four means there are gaps to close before you roll it out. Two or fewer: simplify and begin again with the folders.

<details markdown="1">
<summary>Stretch question: what would you change if a ninth brand arrived by acquisition with 40,000 assets?</summary>

Add one folder branch and two groups, and run the clean-up routine on the incoming assets before they go live: duplicates and expired licences are most likely in a newly acquired library. If the model needed larger changes, that is the sign it was too tied to individual brands.

</details>

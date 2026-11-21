---
title: "Approvals and review"
description: "How to design a lightweight approval model for AEM Assets as a Cloud Service: review tasks, approval status in metadata, publish gating and where Workfront fits."
track: assets
level: 5
order: 28
minutes: 9
outcome: "By the end you can design a simple approval model with clear states and gates, and name which AEM and Adobe tools can support it."
prereq: "Lesson 26 (permissions and access) and lesson 7 (metadata schemas)."
terms:
  - { t: "Review task", d: "A request in AEM Assets asking named reviewers to approve or reject the assets in a folder or collection." }
  - { t: "Approval status", d: "A metadata value, such as draft, in review or approved, that says whether an asset is cleared for use." }
  - { t: "Publish gating", d: "A rule that only assets in an approved state, and only certain people, may be published or shared." }
  - { t: "Proofing", d: "Detailed visual review with comments on the asset itself, typically done in a separate tool such as Workfront." }
mistake: "Building a heavy multi-step approval flow for every asset. People route around it, and the DAM fills with unofficial copies that nobody has checked."
try_it:
  - "Choose three states only, for example draft, in review and approved, and write what each one means."
  - "For each state, write who may move an asset into it."
  - "Decide which asset types skip review, such as internal working files."
  - "Write the one rule for publishing: for example, only approved assets, only by asset managers."
  - "Check what your own environment offers for reviews by creating a review task on a test folder, if you can, and note what the reviewer sees."
quiz:
  - q: "What is a sensible minimum for an approval model in a DAM?"
    options:
      - "A different workflow for each brand and asset type"
      - "A few clear states, named people who can change them, and one publish rule"
      - "No states, only a naming convention such as FINAL in the filename"
      - "A single approver for the whole organisation"
    answer: 1
    why: "Clear states, owners and a gate are enough for most teams. Per-type workflows get abandoned, a filename tag is unreliable, and one approver becomes a bottleneck."
  - q: "A designer uploads 40 draft images for a campaign and the brand manager must sign them off. Which native approach fits?"
    options:
      - "Email the images and note the reply in a spreadsheet"
      - "Delete the drafts and upload only the final ones"
      - "Grant the brand manager edit rights on the whole DAM"
      - "Create a review task on the folder and let the reviewer approve or reject"
    answer: 3
    why: "A review task on a folder or collection is the built-in way to ask for sign-off, and it gives a record. Email leaves no trace in the DAM, and broad edit rights do not create a decision."
  - q: "Why store approval status in metadata rather than only in a task?"
    options:
      - "Metadata is the only place AEM allows text"
      - "Tasks cannot record who approved anything"
      - "Metadata lets you search, filter and gate publishing on the status later"
      - "Metadata is automatically approved by AEM"
    answer: 2
    why: "A task finishes and disappears from view, while a status value stays on the asset and can drive search, reports and rules. The other options misstate what tasks and metadata do."
  - q: "Which statement about review and approval tools is NOT safe to assume?"
    options:
      - "Workfront can handle detailed proofing for assets linked to AEM"
      - "Approval can be done outside Workfront too"
      - "Product names and options in this area change, so check Experience League"
      - "Every Adobe tool in this area is available and identical in every licence"
    answer: 3
    why: "Capabilities depend on your products and licence, and Adobe has renamed and replaced several offerings. Always confirm what you are entitled to before you design around a tool."
go_deeper:
  - { title: "Permissions and access control", url: "/learn/assets/permissions-and-access/", why: "who may approve and publish" }
  - { title: "Metadata schemas", url: "/learn/assets/metadata-schemas/", why: "how to add a status field with fixed values" }
  - { title: "Workflows and post-processing", url: "/learn/assets/workflows-and-post-processing/", why: "automating steps after an asset changes state" }
  - { title: "AI in AEM: what is real, what is useful", url: "/blog/2026/11/ai-in-aem-what-is-real-what-is-useful/", why: "where automated checks may help review" }
---
## The problem: is this the approved logo?

A regional team downloads a logo from the DAM. It is the old one. The agency that uploaded the new version never told anyone it was final, and the brand team never saw it. Approval is not paperwork; it is how people know **which asset they may use**.

## Start with states, not tools

Before you pick a feature, decide what an asset can be. A good model is small:

```text
draft  ->  in review  ->  approved  ->  retired
```

- **Draft:** work in progress. Visible only to the creating team.
- **In review:** waiting on a named reviewer.
- **Approved:** cleared for use and, if allowed, for publishing.
- **Retired:** no longer to be used, kept for reference.

Four states are plenty. Every extra state is another thing people forget to update.

## What AEM and Adobe give you

Verify these against Experience League for your environment, because Adobe's offerings here have shifted.

- **Review tasks in AEM Assets.** You select a folder or collection, create a review task, and the named reviewers approve or reject assets. The requester is notified when the review completes. This is the lightest native option.
- **Workfront.** Workfront has an integration with AEM Assets and Assets Essentials, and proofing, meaning detailed comments on the image itself, is typically done there. It needs configuration by a Workfront administrator and a suitable licence.
- **Brand Portal and Content Hub.** Brand Portal was a separate distribution layer for approved assets, and Adobe positions Content Hub as the newer route for brand asset sharing. Their status and your entitlement vary, so confirm before designing around either.
- **Custom workflows.** You can build approval steps with AEM workflows, as covered in the [workflows lesson](/learn/assets/workflows-and-post-processing/). Use this when the native options do not match your process, but treat it as a project, not a setting.

Approval does not have to live in one tool. Many teams review in Workfront or a design tool, then record the result in the DAM.

## Record the result in metadata

Whatever tool does the review, store the **outcome** on the asset, so the DAM can act on it.

```yaml
approval:
  status: "approved"            # draft | in-review | approved | retired
  approved_by: "j.smith"
  approved_on: "2026-11-03"
```

Add `approval.status` to your [metadata schema](/learn/assets/metadata-schemas/) as a dropdown with fixed values. Now you can filter the library to approved assets, and build collections for regional teams that contain only approved items.

## Gating: where approval bites

An approval model has teeth only if something depends on it. Three common gates:

1. **Publishing:** only asset managers publish, and only approved assets. Permissions from [lesson 26](/learn/assets/permissions-and-access/) enforce who; a workflow or a checklist enforces the status.
2. **Sharing:** only approved assets go into collections shared with partners.
3. **Search defaults:** give consumers a saved view that shows approved assets first.

Be honest about enforcement. A status field is a label. If you need the system to **prevent** publishing unapproved assets, that usually needs a workflow or custom validation. If you only need people to **notice**, a clear status and a good default view often suffice.

## Keep it lightweight

Review the assets that carry risk: brand masters, campaign hero images, anything with a person or a licence. Let routine, low-risk files go straight to approved with a simple rule. The goal is that the approved folder can be trusted, not that everything is slow.

<details markdown="1">
<summary>Stretch question: should an edit to an approved asset reset it to draft?</summary>

For brand masters, yes: a changed file is a new thing to approve. For a typo fix in a description, no. Decide by what changed, and write the rule down. Versions (the next lesson) give you the history to see exactly what changed.

</details>

---
title: "Usage, references and cleanup"
description: "How to see where an asset is used in AEM Assets as a Cloud Service, delete and move assets without breaking pages, and run a regular clean-up routine."
track: assets
level: 5
order: 30
minutes: 9
outcome: "By the end you can check where an asset is used before changing it, choose between archive and delete, and write a simple monthly clean-up routine."
prereq: "Lesson 29 (versions and duplicate detection)."
terms:
  - { t: "Reference", d: "A link from a page, fragment or other asset to an asset, tracked by AEM so it can show you where something is used." }
  - { t: "Where-used", d: "The view, typically called References, that lists what uses an asset." }
  - { t: "Broken reference", d: "A reference to an asset that has been deleted or moved, so the page shows a gap or an error." }
  - { t: "Archive", d: "Keeping an asset out of daily use, for example by moving it to a restricted folder and marking it retired, instead of deleting it." }
mistake: "Deleting assets because 'nobody uses them' without checking. A page, a content fragment or a hard-coded link somewhere may still depend on the asset, and the first sign is a broken image on a live page."
try_it:
  - "In a test project, open an asset used on a page and look at its References panel."
  - "Try to delete it, and read the warning that appears."
  - "Write down which of your assets might be used in ways AEM cannot see, such as an image URL pasted into text or an external site."
  - "Draft a retention rule for three asset types, for example campaign images, product images and legal documents."
  - "Write a monthly clean-up checklist of five steps, with an owner for each."
quiz:
  - q: "What is the safest first step before deleting an asset in a shared DAM?"
    options:
      - "Check its references, and unpublish and replace where it is used"
      - "Delete it from publish first and see what breaks"
      - "Rename it to include the word DELETE"
      - "Wait a year, whatever the references"
    answer: 0
    why: "Checking references tells you what depends on the asset so you can replace it first. Deleting to see what breaks puts the breakage on a live site, and renaming changes nothing about dependencies."
  - q: "An asset shows no references, yet the homepage uses it through a full publish URL pasted into a rich text field. What is the risk?"
    options:
      - "None, because AEM always follows pasted URLs"
      - "AEM may not detect that use, so deleting it breaks the page"
      - "The page will switch to a placeholder automatically"
      - "The asset cannot be deleted at all"
    answer: 1
    why: "Adobe knowledge base guidance notes that references written as full publish or CDN URLs are not detected. Using repository paths in content keeps usage visible, and that is a content rule as much as a technical one."
  - q: "A licensed campaign image has expired but the legal team wants a record of what was used. What is the best action?"
    options:
      - "Delete it, since expired assets have no value"
      - "Keep it live but rename it"
      - "Move it into a restricted archive folder and mark it retired"
      - "Leave it where it is and tell people not to use it"
    answer: 2
    why: "Archiving keeps the record without leaving it available for casual reuse. Deleting loses the evidence, and an instruction to people is not a control."
  - q: "Which clean-up approach is the weakest?"
    options:
      - "A monthly report of expired, unreferenced and duplicate assets"
      - "Retention rules by asset type, agreed with legal"
      - "A named owner who reviews and signs off deletions"
      - "A one-off big purge every few years by whoever has time"
    answer: 3
    why: "Clean-up works as a routine with rules and an owner. A rare big purge is risky, because nobody remembers what is safe to remove and the volume is too large to review."
go_deeper:
  - { title: "Expiry and rights management", url: "/learn/assets/expiry-and-rights-management/", why: "what to do with assets that have expired" }
  - { title: "Caching and the CDN for assets", url: "/learn/assets/caching-and-cdn-for-assets/", why: "why deleted assets can still be served for a while" }
  - { title: "Dispatcher on AEM as a Cloud Service: caching and invalidation", url: "/blog/2026/11/dispatcher-on-aem-as-a-cloud-service-caching-and-invalidation/", why: "how cached copies are cleared" }
  - { title: "Image optimisation on AEM: Dynamic Media and Edge Delivery Services", url: "/blog/2026/11/image-optimisation-on-aem-dynamic-media-and-edge-delivery-services/", why: "other places a delivered copy may sit" }
---
## The problem: the image that vanished from the homepage

Someone tidies the DAM and removes 300 "unused" images. A week later a landing page shows a broken image, and a content fragment used by the mobile app has a hole where a photo was. The assets were used, just not where the tidier looked.

Clean-up is valuable, because a library that is half junk is hard to search and costs money to keep. It is also the one governance task that can break things on a live site. The answer is to **look before you delete**, and to make clean-up a routine rather than an event.

## Usage and references

When a page, content fragment or other asset uses an asset, AEM records a **reference**. In the Assets UI, an asset's References view lists what uses it, and it flags things such as expired assets. Read it before you move, replace or delete.

What the references view can show you depends on how the content was authored. Experience League knowledge base guidance warns that an asset referenced through a **full publish or CDN URL** (for example pasted into a rich text field) is not detected as a reference. The rule for content teams is therefore: pick assets with the asset picker, so the link is a repository path such as `/content/dam/acme/brand-a/logo.png`, and AEM can see it.

References cannot see outside AEM. Another website, an email already sent, a print file, or a partner's page may use a delivered URL. Deleting may still break those.

## Deleting and moving safely

- **Delete:** AEM generally warns when an asset is referenced, and workflow-based deletes will not remove a referenced asset. Treat that as a safety net, not a plan. Replace the references first.
- **Large deletes:** very large batches, typically several hundred assets or more in one go, can time out in the UI. Delete in sensible chunks and check the result.
- **Move:** moving changes the path. Check the references afterwards, and confirm in your environment how references are updated, because behaviour can depend on how the content links to the asset.
- **After deletion:** the asset may remain visible for a time. A cached copy on the CDN or Dispatcher can keep serving until the cache expires or is purged, as covered in the [caching lesson](/learn/assets/caching-and-cdn-for-assets/). Unpublish first, then delete, and plan the cache purge for anything sensitive.

## Archive or delete?

| Choose | When |
|---|---|
| **Archive** | Legal or brand history matters, licence evidence is needed, or reuse is possible later |
| **Delete** | The asset is a true duplicate, a failed upload or a temporary working file |

A practical archive is a folder such as `/content/dam/acme/_archive/2026/` with tight permissions (see [lesson 26](/learn/assets/permissions-and-access/)) and `approval.status = retired`. It stays findable for those who need it, and out of everyone else's search.

Retention rules should come from your business, not from AEM: how long to keep campaign images, product images that are no longer sold, signed releases. Agree them with legal, write them down, then apply them.

## A clean-up routine

Run this monthly, with a named owner:

```text
1. Report   expired assets, assets with no references older than 12 months, duplicates
2. Triage   keep, archive, replace or delete, with a reason
3. Notify   uploaders and brand owners of what will go, with a date
4. Act      unpublish, move to archive or delete, in small batches
5. Check    sample pages for broken images, then purge caches if needed
6. Record   what was removed, by whom, and why
```

For a library of 200,000 images, "no references" is a starting list, not a verdict. A product image with no page may still feed a feed to a marketplace. Ask the owner.

<details markdown="1">
<summary>Stretch question: an agency wants all its old campaign files deleted at contract end. What do you check first?</summary>

Check whether any of them are referenced or licensed for continued use, and whether the contract requires you to keep them. Then archive rather than delete, restrict access, and remove the agency's group. Deleting on request alone can destroy records you are obliged to hold.

</details>

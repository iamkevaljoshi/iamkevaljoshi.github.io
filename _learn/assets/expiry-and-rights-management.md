---
title: "Expiry and rights management"
description: "How asset expiry works in AEM Assets as a Cloud Service, what it does and does not enforce, and how to pair it with usage rights metadata and a human process."
track: assets
level: 5
order: 27
minutes: 9
outcome: "By the end you can explain what an expiry date does in AEM Assets, what it cannot do, and how to design rights metadata and a process around it."
prereq: "Lesson 7 (metadata schemas)."
terms:
  - { t: "Expiry date", d: "A date stored in the asset's metadata after which AEM treats the asset as expired." }
  - { t: "Usage rights", d: "The terms that say where, how long and by whom an asset may be used, often set by a licence or a contract." }
  - { t: "Rights-managed asset", d: "An asset, such as a licensed photograph, whose use is limited by contract rather than owned outright." }
  - { t: "On time and off time", d: "A separate setting that limits delivery of an asset to a window of time." }
mistake: "Believing that an expiry date means the asset can no longer be seen or used anywhere. Copies, downloads, cached pages and files already placed in other systems are not recalled by a date in metadata."
try_it:
  - "Pick three assets that have a licence, such as a stock photo, a model release and a font file."
  - "For each, write the licence end date, the allowed regions and channels, and who to contact."
  - "Sketch the metadata fields you would add to hold those four facts, and mark which are required."
  - "Decide who gets a warning 60 days before expiry, and what they must do in response."
  - "Write the replacement plan: where does the new image come from, and who updates the pages?"
quiz:
  - q: "In AEM Assets as a Cloud Service, what is the main automatic effect when an asset passes its expiry date?"
    options:
      - "The asset is permanently deleted from the repository"
      - "The asset is unpublished and flagged, and ordinary users lose edit and download"
      - "Every page that uses the asset is removed from publish"
      - "Nothing, because expiry is only a label for humans"
    answer: 1
    why: "A scheduled job unpublishes expired assets and they are flagged, with restrictions for users who are not administrators. It does not delete the asset or remove pages, and it is more than a label."
  - q: "A photo licence ends on 30 June. The image was downloaded last year and sits in a partner's brochure. What does the expiry date do about that copy?"
    options:
      - "It disables the copy through the file's embedded metadata"
      - "It recalls the copy automatically via the download log"
      - "Nothing, so your process must tell the partner to stop using it"
      - "It blocks the partner's printer from using the file"
    answer: 2
    why: "Expiry only governs the asset inside your system. A file that has left the DAM cannot be controlled by a date, so the licence terms and a human notification are what protect you."
  - q: "You need a rule such as 'only usable in the EU until 2027, then needs legal sign-off'. What is the best approach?"
    options:
      - "Put the whole rule in the title of the asset"
      - "Rely on the expiry date alone and ignore the regions"
      - "Delete the asset and re-upload it each year"
      - "Add structured rights metadata and a review process, and use expiry for the end date"
    answer: 3
    why: "Expiry holds one date. Regions, channels and sign-off need their own metadata fields and an owner who acts on them. Putting rules in a title cannot be searched, filtered or reported on."
  - q: "Which statement about expiry is NOT a good practice?"
    options:
      - "Trust the date field alone, with no owner and no warnings"
      - "Make the expiry date required for rights-managed asset types"
      - "Notify the uploader or owner before the date, not only after"
      - "Report regularly on assets expiring in the next 90 days"
    answer: 0
    why: "A field with no owner is a field nobody reads. Expiry works when it is required where it matters, warned about in advance and reported on by someone accountable."
go_deeper:
  - { title: "Metadata schemas", url: "/learn/assets/metadata-schemas/", why: "how to add and require rights fields" }
  - { title: "Caching and the CDN for assets", url: "/learn/assets/caching-and-cdn-for-assets/", why: "why a cached copy can outlive an unpublish" }
  - { title: "Image optimisation on AEM: Dynamic Media and Edge Delivery Services", url: "/blog/2026/11/image-optimisation-on-aem-dynamic-media-and-edge-delivery-services/", why: "where delivered copies of images live" }
---
## The problem: the licence ended, the image did not

A retailer buys a photo for a 12 month campaign. Eighteen months later it is still on the homepage, and the photographer's lawyer sends an invoice. Nobody was careless on purpose. The licence end date lived in an email.

Rights management is about moving facts like that out of inboxes and into the DAM, where they can be searched, warned about and acted on.

## What AEM does when an asset expires

In AEM Assets as a Cloud Service, an asset's expiry date is stored in its metadata as `prism:expirationDate`. Authors typically set it in the asset's properties, in a field labelled Expires. Per Experience League, a scheduled background job then does the work:

- It **unpublishes** expired assets from publish, and from Dynamic Media where that is in use. By default the job runs once a day, shortly after midnight, so expiry is not instant.
- Expired assets are **flagged** in the card and list views, and you can find them with an expiry status filter in search.
- Users without administrator permissions cannot edit, copy, move, publish or download an expired asset.
- Email notifications to uploaders, both before and after expiry, are available but need to be switched on in configuration. Do not assume they are on.

Two details trip people up. First, a compound asset is not flagged the moment one of its sub-assets expires; it is flagged after the next job run. Second, **on time and off time** is a different mechanism: it limits delivery to a time window, checked when the asset is requested. Know which one you are using, and verify the current behaviour in your own environment before you rely on either.

## What expiry cannot do

Expiry controls the asset **inside your system**. It cannot:

- recall a file someone has already downloaded or sent to an agency or partner;
- clear a page that has copied the image URL into hard-coded content, or an old cached version in a CDN (see the [caching lesson](/learn/assets/caching-and-cdn-for-assets/));
- tell you what the licence actually allows.

So the tool is half of the answer. The other half is a process with an owner.

## Modelling rights as metadata

One date is not a licence. A practical rights block might look like this:

```yaml
rights:
  licence_type: "rights-managed"        # owned | royalty-free | rights-managed
  licence_end: "2027-06-30"             # also drives the expiry date
  allowed_regions: ["EU", "UK"]
  allowed_channels: ["web", "print"]
  rights_contact: "rights@acme.example"
  agreement_ref: "CONTRACT-2291"
```

Add these as fields in your [metadata schema](/learn/assets/metadata-schemas/), and make the important ones required for the asset types they apply to. Keep values to controlled lists where you can, so that you can filter and report on them. Where you need custom expiry behaviour, such as a different warning period per licence type, a custom field plus a workflow or report is often safer than stretching the built-in field. Check Experience League for current guidance.

## A process that makes it stick

1. **Capture** rights at upload, not months later.
2. **Warn** the owner 60 and 30 days before the end date.
3. **Decide**: renew, replace or retire.
4. **Replace** references, then let expiry unpublish the old asset.
5. **Review** a monthly report of what is expiring and what has expired.

<details markdown="1">
<summary>Predict first, then reveal: expiry fires at midnight, but a campaign page is cached for a day. What does a visitor see?</summary>

Possibly the old image. The asset may be unpublished, yet a cached page or CDN copy can keep serving it until the cache expires or is purged. If a licence end is strict, plan the removal ahead of the date rather than relying on the scheduler alone.

</details>

---
title: "Collections and sharing"
description: "When to use an AEM Assets collection instead of a folder, how static and smart collections differ, and how link sharing, expiry and permissions work."
track: assets
level: 2
order: 10
minutes: 8
outcome: "By the end you can choose between a folder, a collection and a shared link for a given request, and set sensible sharing and expiry rules."
prereq: "Lesson 3, Folder structure and naming conventions."
terms:
  - { t: "Collection", d: "An ordered set of references to assets, folders or other collections, so assets can be grouped without being copied or moved." }
  - { t: "Static collection", d: "A collection whose members change only when someone adds or removes them." }
  - { t: "Smart collection", d: "A collection filled by a saved search, so it updates as matching assets appear." }
  - { t: "Link sharing", d: "Creating a link that lets people without an AEM account view or download chosen assets, usually with an expiry date." }
mistake: "Using folders to answer every request. A 'Summer sale' folder holding copies of images from six places creates duplicates that go out of date, while a collection would have pointed at the originals."
try_it:
  - "Pick a request you often get, such as 'all images for the summer newsletter', and decide whether it should be a folder, a collection or a link."
  - "In an AEM Assets environment, create a static collection and add three assets from different folders."
  - "Check that the original assets are still in their home folders and nothing was copied."
  - "Save a search and, if your environment offers it, create a smart collection from it."
  - "Create a share link with the shortest expiry that still works for the recipient, and note what the recipient can download."
quiz:
  - q: "What is the key difference between a collection and a folder?"
    options:
      - "A collection stores references, so the same asset can appear in many collections"
      - "A collection stores faster copies of the assets"
      - "A collection can only hold images"
      - "A collection is visible only to administrators"
    answer: 0
    why: "A collection points at assets that stay where they are. A folder is where an asset lives, and an asset can have only one home."
  - q: "A designer needs to send 40 approved images to an external printer who has no AEM account. What is the best fit?"
    options:
      - "Give the printer an author login"
      - "Create a share link with an expiry date"
      - "Move the images to a new folder and open the folder to everyone"
      - "Email the images one by one from a local copy"
    answer: 1
    why: "Link sharing is made for recipients without accounts, and expiry limits exposure. An author login is far more access than needed, and emailing local copies bypasses the DAM."
  - q: "A smart collection is built from a saved search for 'status = approved'. A new approved asset is uploaded. What happens?"
    options:
      - "Nothing until someone adds it by hand"
      - "The collection is deleted and recreated"
      - "The asset is copied into the collection"
      - "It appears in the collection because the saved search now matches it"
    answer: 3
    why: "Smart collections are driven by search criteria, so you cannot add assets manually. A static collection is the one that waits for human edits."
  - q: "Which statement about shared links is NOT true?"
    options:
      - "Admins can set a default validity period for links"
      - "Users can choose whether to include originals, renditions or both, within what admins allow"
      - "If an asset is moved after the link is created, the link keeps working"
      - "Recipients do not need an AEM account"
    answer: 2
    why: "Adobe's documentation says that moving an asset breaks its link, so you must create and send a new one. The other statements describe documented behaviour."
go_deeper:
  - { title: "JCR queries and Oak indexes for AEM performance", url: "/blog/2026/11/jcr-queries-oak-indexes-aem-performance/", why: "what a saved search is really asking the repository" }
  - { title: "Next lesson: Bulk metadata editing and import", url: "/learn/assets/bulk-metadata-editing-and-import/" }
  - { title: "Previous lesson: Tags and taxonomy", url: "/learn/assets/tags-and-taxonomy/" }
---
## The problem: one asset, many requests

An image of a trainer lives in `/content/dam/product/footwear/`. The newsletter team wants it. So does the Black Friday landing page, the buyer's lookbook and an agency. Do you copy the file into four folders? Then you have four versions, and one of them still shows last season's colour.

You need a way to **group without moving**, and a way to **hand over without giving the keys**. Those are collections and link sharing.

## Folders, collections and links

| Tool | Think of it as | Use it when |
|---|---|---|
| **Folder** | The shelf where the asset lives | You are organising for the long term, with permissions and schemas attached |
| **Collection** | A playlist of references | A temporary or cross-cutting group: a campaign, a pitch, a shortlist |
| **Share link** | A time-limited visitor pass | People without an AEM account need to view or download |

Rule of thumb: an asset has one home folder and any number of collections.

## Collections in practice

A collection holds references to assets, folders and other collections. Nothing is copied. Delete the collection and the assets are untouched.

There are two types, both documented for Cloud Service:

- **Static collections** change only when someone adds or removes members.
- **Smart collections** are driven by a saved search. Matching assets appear as they are added, you cannot add assets by hand, and you remove one by deleting its saved search.

Collections can be shared with other AEM users at different privilege levels, from viewing to editing to full control. Owners and editors can change members and permissions. For sharing to work, users generally need read access in the places collections are stored, so test with a real non-admin user, not just your own account. There are also practical limits: annotations and comments work on the parent collection only, for example.

## Sharing outside AEM

Link sharing creates a URL that works without an AEM login. Points to design around:

- Admins set a **default validity period** in the Assets configuration for link sharing, and users can change the expiry in the sharing dialog. After expiry the link stops working.
- Users need edit permission on the asset or folder to create a link, and admins can show or hide the button for groups.
- The sender chooses **originals, renditions or both**, within options admins make editable, read-only or hidden. Sharing renditions is usually safer than sharing originals.
- If an asset is moved, its link breaks.
- For external use from the author tier, Adobe recommends a dispatcher-style allowlist so only the link-share pages are reachable.

For distributing approved assets to many partners over time, Adobe documents Brand Portal as a separate route. Adobe's product naming around partner portals keeps changing, so check Experience League for its current status before you plan around it. Rights and expiry of the assets themselves come in level 5.

## A worked decision

A retailer's marketing lead asks for "everything for the summer sale". Create a **smart collection** if the assets all carry a `season` tag, or a **static collection** if the list is hand-picked. Share the collection internally. Send the agency a **share link with renditions only** and a 14 day expiry. Nothing is copied and nothing is left open.

<details markdown="1">
<summary>Why does this work? A hidden benefit of references</summary>

Because the collection points at the live asset, a corrected image or updated metadata is visible everywhere immediately. Copies would each need fixing. The trade-off is that deleting or moving an original affects every collection that references it, which is why home folders should be stable and changes deliberate.

</details>

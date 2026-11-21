---
title: "Creative Cloud and Connected Assets"
description: "How designers use AEM Assets from Photoshop, InDesign and Illustrator, and how Connected Assets lets Sites authors use a remote DAM as the single source of truth."
track: assets
level: 6
order: 33
minutes: 9
outcome: "By the end you can explain how creatives and Sites authors reach DAM assets without copying files, and name the main limits of each approach."
prereq: "Versions and duplicate detection (lesson 29) and using assets in Sites (lesson 24) help."
terms:
  - { t: "Adobe Asset Link", d: "A panel inside Creative Cloud apps such as Photoshop, InDesign and Illustrator for browsing, checking out and checking in AEM Assets content." }
  - { t: "Check out and check in", d: "Locking an asset while you edit it, then saving your change back as a new version." }
  - { t: "Connected Assets", d: "A feature that lets Sites authors search a remote AEM Assets deployment from the Page Editor and use its assets on pages." }
  - { t: "System of record", d: "The one place whose copy of an asset is treated as the truth." }
  - { t: "Remote DAM", d: "The AEM Assets deployment that owns the assets, as seen from a separate Sites deployment." }
mistake: "Letting designers export from the DAM, edit the file on their desktop and upload it again under a new name. You get duplicates, broken links and nobody knows which file is current."
try_it:
  - "Draw the journey of one product image from photoshoot to a web page, marking every place a copy of the file is made."
  - "Mark each copy as necessary or avoidable, then say which tool in this lesson would remove the avoidable ones."
  - "If you have Creative Cloud for enterprise and a Cloud Service environment, open the Asset Link panel in InDesign, sign in and browse to a folder."
  - "Place an asset as a linked file, change it in AEM, and note how the link reports the new version."
  - "Write down three constraints from this lesson that would affect a Connected Assets rollout in your organisation."
quiz:
  - q: "What is the main benefit of using Asset Link instead of exporting files from the DAM?"
    options:
      - "Designers work on files stored in Creative Cloud, not in AEM"
      - "Designers can use AEM assets from inside their tools, and changes return as new versions"
      - "It converts every asset to a PSD automatically"
      - "It removes the need for metadata"
    answer: 1
    why: "The panel keeps the asset in the DAM and brings it into the app, so edits save back as versions. It does not move the library into Creative Cloud and has nothing to do with metadata."
  - q: "A global brand has one central DAM and five regional Sites deployments. Which feature lets regional authors use central assets without a mass migration?"
    options:
      - "A nightly export of the whole library to every Sites deployment"
      - "Giving authors admin rights on the central DAM"
      - "Connected Assets, configured from each Sites deployment to the remote DAM"
      - "Uploading the assets again in each region"
    answer: 2
    why: "Connected Assets lets authors search the remote DAM from the Page Editor and fetches only the assets they use. Mass copies recreate the duplicate problem the central DAM was meant to solve."
  - q: "An author drags a remote image onto a page. A week later the central team retires that asset in the DAM. What should you expect?"
    options:
      - "The page keeps working, because a read-only copy was fetched, so retired assets still need a cleanup process"
      - "The image disappears from the page immediately"
      - "The local copy is deleted and the page breaks at publish time"
      - "The central team is blocked from retiring assets that have been fetched"
    answer: 0
    why: "Fetched copies are read-only local assets, so retiring the original does not remove them. That is why governance needs a way to find and replace outdated fetched assets."
  - q: "Which is NOT a sound expectation of Connected Assets?"
    options:
      - "Remote assets are fetched on demand, and a slow fetch can time out"
      - "Authors need permissions on both deployments"
      - "Fetched assets are read-only, with non-destructive component edits"
      - "Every asset type, including content fragments, is supported"
    answer: 3
    why: "Adobe's documentation lists limits, including that content fragments, experience fragments and video are not supported. The other three describe real behaviour."
go_deeper:
  - { title: "Image optimisation on AEM: Dynamic Media and Edge Delivery Services", url: "/blog/2026/11/image-optimisation-on-aem-dynamic-media-and-edge-delivery-services/", why: "how delivery fits with a central DAM" }
  - { title: "Next lesson: Asset search and custom indexes", url: "/learn/assets/asset-search-and-custom-indexes/" }
---
## The problem: three copies of every logo

A designer needs the latest brand logo. She exports it from the DAM, drops it in a project folder and later emails the edited version to a colleague, who uploads it again. A Sites author, meanwhile, downloaded the logo last year and re-uploaded it to a regional website. Now there are at least four copies, and the one on the website is out of date.

Both integrations in this lesson attack the same problem: **the DAM is the single source of truth, and people use it from where they already work.**

## For creatives: Adobe Asset Link

Adobe Asset Link is a panel inside Photoshop, InDesign and Illustrator that connects to AEM Assets. According to Adobe's documentation, users can browse and search the DAM, check assets out and in, and place them. It requires a Creative Cloud for enterprise entitlement, and Cloud Service environments are described as pre-configured for it, whereas AEM 6.x needs administrators to install and map users (legacy). Confirm the current app list and naming on Experience League, because Adobe has changed names in this area before.

Two behaviours matter:

- **Linked placement.** In InDesign you can place an asset as a link. When the asset changes in AEM, the layout notices.
- **Check out and check in.** Checking out signals "I am editing this", and checking in saves the result as a new version (see lesson 29), so nothing is overwritten silently.

Adobe's docs also describe linking AEM Assets with Creative Cloud storage and Workfront review flows. Capabilities there are changing, so verify what your licence includes rather than assuming.

## For Sites authors: Connected Assets

Many companies run the DAM and the website as separate AEM deployments. **Connected Assets** lets an author in the Page Editor search the remote DAM in the Content Finder and drop an asset onto a component. Documents go into the Download component and images into the Image component.

What actually happens is worth understanding:

```text
Remote DAM (system of record)        Sites deployment
/content/dam/brand/logo.png   --->   /content/dam/connectedassets/... (read-only copy)
        fetched when the author drops it on a page
```

Only assets that authors use are fetched, and the local copy is read-only. Adobe's documented constraints include:

- Each Sites deployment connects to one remote DAM, though one DAM can serve several Sites deployments.
- Content fragments, experience fragments and video are not supported.
- Fetches can time out, and the author retries.
- Metadata on fetched copies cannot be edited, and metadata schemas are not fetched.
- A remote asset retired in the DAM can still be used on pages, so cleanup must be planned.
- The setup needs administrators to configure CORS, cookies and a connection test.

Adobe's page also points to Dynamic Media with OpenAPI as the way to connect Assets as a Cloud Service to Sites. How either approach applies to Edge Delivery Services is not covered there, so check the latest guidance if your estate uses it. Lesson 24 covers the delivery side.

## Choosing your pattern

| Need | Pattern |
|---|---|
| Designers edit masters in Adobe apps | Asset Link |
| Regional Sites use central assets, few copies | Connected Assets |
| A whole library must live in another environment | Migrate it (lesson 35) |

<details markdown="1">
<summary>Stretch question: Connected Assets still copies assets. Is that a contradiction?</summary>

Not quite. It copies only assets that are used, makes them read-only and keeps the source as the system of record. That is very different from a free-for-all export, but it does mean governance (lesson 30) has to cover fetched copies too.

</details>

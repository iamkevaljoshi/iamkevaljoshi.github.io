---
title: "Project: configure a processing profile"
description: "A hands-on project: define a processing profile with three web renditions, apply it to a folder, test it with real files, and plan how to verify and roll back."
track: assets
level: 3
order: 18
minutes: 20
kind: project
outcome: "By the end you can design, apply and verify a processing profile that adds three web renditions, and describe how you would roll it back."
prereq: "Lessons 13 to 17. An AEM Assets as a Cloud Service environment is recommended, but a paper version is given below."
terms:
  - { t: "Test folder", d: "A small folder used to try a profile safely before applying it to real content." }
  - { t: "Acceptance check", d: "A specific, observable test that tells you the work is done." }
  - { t: "Rollback", d: "Returning to the previous state when a change causes problems." }
  - { t: "Reprocess", d: "Re-running processing on assets that already exist." }
mistake: "Applying a new profile straight to a production root folder. You then process thousands of assets with settings nobody has checked, and because renditions cannot be bulk deleted, undoing it is slow."
try_it:
  - "Create a test folder named profile-test and upload six files: two photos, one PNG with transparency, one very small image, one PDF and one file larger than 20 MB."
  - "As an administrator, create a profile under Tools, Assets, Processing Profiles with the three renditions in the brief."
  - "Apply the profile to profile-test from the folder's Properties, Asset Processing tab."
  - "Upload the six files again as new assets, or reprocess the existing ones, and wait for processing to finish."
  - "Open each asset's Renditions view and tick off the acceptance checks."
  - "Write down your rollback plan and your verdict on each check."
quiz:
  - q: "Why test in a dedicated folder first?"
    options:
      - "Profiles only work in folders that are named test"
      - "A profile affects every asset in scope and is slow to undo"
      - "Production folders cannot have profiles"
      - "Testing first makes the renditions higher quality"
    answer: 1
    why: "Scope is the risk. A bad profile on a big folder creates many unwanted renditions, and renditions cannot be bulk deleted. A small test folder keeps mistakes cheap."
  - q: "Your profile says a 1200 px wide rendition. The test image is 800 px wide. What is the expected outcome?"
    options:
      - "A 1200 px image, upscaled from the original"
      - "An error, and no rendition at all is created"
      - "A rendition within the maximum bounds, so observe the result"
      - "The original is deleted"
    answer: 2
    why: "Width and height are maximum bounds with aspect ratio preserved, so small originals are a good edge case to test. Never assume, observe what the system produces for small files."
  - q: "You applied the profile and a transparent PNG now has a black background in the JPEG rendition. What does this teach?"
    options:
      - "JPEG has no transparency, so choose PNG or WebP for assets that need it"
      - "AEM is faulty and needs a bug report"
      - "Transparency cannot be handled in any format"
      - "The folder had the wrong permissions"
    answer: 0
    why: "Format choice matters: JPEG cannot hold transparency. The failure is predictable from the format, which is exactly what edge-case test files are for."
  - q: "Which is the BEST rollback plan for a bad profile?"
    options:
      - "Delete the whole folder and re-upload all of the files"
      - "Do nothing, because the default renditions still exist"
      - "Ask authors to ignore the extra renditions for now"
      - "Fix the profile, reprocess if needed, and clean up old renditions one by one"
    answer: 3
    why: "Changing the profile stops bad output for new assets, but old renditions remain. Knowing that before you start is why the test folder matters."
go_deeper:
  - { title: "Image optimiser tool", url: "/tools/image-optimiser/", why: "preview sizes, formats and quality before choosing them" }
  - { title: "Image optimisation on AEM: Dynamic Media and Edge Delivery Services", url: "/blog/2026/11/image-optimisation-on-aem-dynamic-media-and-edge-delivery-services/", why: "check whether on-demand delivery would suit instead" }
  - { title: "Renditions and processing profiles", url: "/learn/assets/renditions-and-processing-profiles/", why: "refresher on the concepts" }
---
## The brief

A retailer's website team needs three images from every product photo. Their design system has a card, a gallery view and a retina hero. Developers have asked for:

| Name | Max width | Max height | Format | Quality |
|---|---|---|---|---|
| `web-card` | 400 | 400 | WebP | 75 |
| `web-gallery` | 800 | 800 | WebP | 75 |
| `web-hero` | 1600 | 900 | JPEG | 80 |

These are example numbers. Adjust them to your project, but keep them to three. Use the image optimiser tool at /tools/image-optimiser/ to see how quality changes the file size before settling.

Environment: this works best on an AEM Assets as a Cloud Service environment where you have administrator rights. If you do not have one, do the **paper version**: write the profile as a table like the one above, then write what you expect each of the six test files to produce, and compare with a colleague who does have access, or with the Adobe documentation.

## Steps

Follow the try-it steps. Key points while doing them:

1. **Test folder first.** Use six varied files: edge cases find problems that nice photos hide.
2. **Name renditions clearly.** Names are how developers and APIs find them later, so choose a convention like `web-card`.
3. **Apply to the folder, not the root.** One profile per folder, inherited by subfolders.
4. **Remember the scope rule.** The profile affects new or updated assets, so reprocess existing ones deliberately.

## Verify

Open the Renditions view on each asset. Check:

- Three new renditions exist, with the names you chose.
- The default renditions are still there, because profiles add to default processing.
- Widths do not exceed the maximums and the aspect ratio is unchanged.
- The transparent PNG looks right in each format.
- The small image behaves sensibly.
- The PDF is excluded or handled as you intended. If you set a MIME include rule, this proves it.

## Rolling back

Before you start, decide what you will do if it is wrong. Correct or remove the profile from the folder, which stops bad output for new assets. Existing wrong renditions remain, and Adobe notes renditions cannot be bulk deleted, so plan individual removal, custom cleanup or re-upload for a small set. This is why you never begin in production.

## What good looks like

Score yourself:

- Exactly three renditions, each with a stated consumer.
- Edge cases tested, not just happy-path photos.
- Names follow a convention.
- A written rollback plan, and a note on who will approve production use.
- You can explain why you did not generate more sizes.

<details markdown="1">
<summary>Stretch question</summary>

If the site later needs a fourth size, what is your process?

Add it to the profile, test it on the test folder, then reprocess production deliberately in batches. Consider first whether on-demand delivery could provide it with no new stored renditions.

</details>

---
title: "Project: organise a small asset library"
description: "A hands-on project: design a folder structure and naming rule for a fictional brand with three regions and two product lines, then test it against 20 sample files."
track: assets
level: 1
order: 6
minutes: 15
kind: project
outcome: "By the end you can produce a folder structure and naming rule for a real brief, apply it to 20 files, and judge it against a clear definition of good."
prereq: "Lessons 1 to 5 of this track. A paper or spreadsheet is enough; an AEM Assets as a Cloud Service environment is optional."
terms:
  - { t: "Naming rule", d: "A short pattern, such as product-subject-view.ext, that makes names predictable." }
  - { t: "Shared area", d: "A folder for assets used across regions or brands, such as logos and legal text." }
  - { t: "Drafts area", d: "A clearly marked place for work in progress, with an owner and a clean-up rule." }
  - { t: "Definition of good", d: "Written checks you use to decide whether the design works, before real people use it." }
mistake: "Designing the folder tree first and testing it never. A structure that looks neat on paper often fails on the first awkward file, such as a campaign shot used in two regions, so always test with real examples."
try_it:
  - "Read the brief below and list the facts that differ: who needs different access, and who needs different processing. Those are your folder boundaries."
  - "Sketch the folder tree to a maximum of four levels, including a shared area and a drafts area."
  - "Write the naming rule in two lines, with one correct example and one incorrect example."
  - "Place all 20 files from the list below into your tree, renaming each to your rule."
  - "Note every file that was hard to place, and fix the design, not the file."
  - "Optional, with an environment: create the folders, upload the renamed sample files and check that names survive unchanged."
  - "Score yourself against the definition of good and write down the two biggest weaknesses."
quiz:
  - q: "In the project, a campaign photo is used by EMEA and APAC. Where should it live?"
    options:
      - "In both regional folders as copies"
      - "In the shared area, with metadata showing the campaign and regions"
      - "In the EMEA folder, and APAC must ask for it"
      - "In a personal drafts folder"
    answer: 1
    why: "One original in a shared place avoids drifting copies. Copies in two folders create two versions of the truth, and a personal folder hides it."
  - q: "You score your design and find that 9 of 20 sample files needed a judgement call about where to put them. What does this tell you?"
    options:
      - "The files are badly named"
      - "Users will need more training"
      - "The sample set is too small to say anything"
      - "The structure's rules are ambiguous and need redesigning"
    answer: 3
    why: "Many judgement calls mean the structure does not map to how assets are actually used. Training only hides the problem, and renaming files does not fix ambiguous placement."
  - q: "Which naming rule is the best fit for the project?"
    options:
      - "product-subject-view.ext in lower case with hyphens, no status words"
      - "Any readable name, as long as it includes the date"
      - "Region first, then initials of the photographer, then FINAL"
      - "The camera's original file name, to avoid mistakes"
    answer: 0
    why: "A rule based on content is stable and readable. Status words go stale, initials tie files to people, and camera names say nothing about the content."
  - q: "Which is NOT part of a sensible definition of good for this library?"
    options:
      - "A stranger can predict where a file belongs"
      - "Names contain no spaces, special characters or version numbers"
      - "Every region has its own copy of every shared asset"
      - "Access or processing differences are reflected in folder boundaries"
    answer: 2
    why: "Duplicating shared assets per region is the problem the structure should remove. The other checks are measurable ways to confirm the design works."
go_deeper:
  - { title: "Content modelling: JCR vs relational vs document database", url: "/blog/2026/11/content-modelling-jcr-vs-relational-vs-document-database/", why: "thinking about hierarchy versus attributes" }
  - { title: "AEM multi-site and language copies on Cloud Service", url: "/blog/2026/11/aem-msm-language-copies-cloud-service/", why: "regional structure in the Sites world" }
  - { title: "Metadata schemas", url: "/learn/assets/metadata-schemas/", why: "next level: moving what folders cannot hold into metadata" }
  - { title: "Image optimiser tool", url: "/tools/image-optimiser/", why: "prepare sample images if you are uploading to an environment" }
---
## The brief

You are the new asset manager at **Northwind Outdoor**, a fictional brand. The business has:

- **3 regions:** EMEA, APAC and Americas. Each has its own marketing team, who may edit only their region's content.
- **2 product lines:** Footwear and Apparel.
- **Campaign assets:** about 40 new campaign shots per quarter, some used in one region, some in all three.
- **Global assets:** logos, brand guidelines and legal text that everyone uses but only the central team may edit.
- **Volume today:** roughly 6,000 existing files, growing by 1,500 a year.

Your job is to design the structure and naming rule before the first migration batch, and to test it. This works on paper or a spreadsheet. If you have an AEM Assets as a Cloud Service environment, you can also build and upload to it.

## Step 1: find the real boundaries

Remember lesson 3: make a folder boundary where access or processing differs. Here, regions differ in access, and global assets differ in who may edit. Product lines do not differ in access, so they probably belong lower down or in metadata. Decide, and write one sentence of justification.

## Step 2: draw the tree

Keep it to four levels. A starting point to improve, not to copy:

```text
/content/dam/northwind/
  shared/        (central team edit only)
    logos/
    guidelines/
    legal/
  emea/ | apac/ | americas/
    campaigns/
    products/
  drafts/        (owner named in the folder title, cleaned quarterly)
```

## Step 3: write the naming rule

Two lines, such as: `lower-case, hyphens only, product-subject-view.ext` and `no status words, no versions, no spaces`. Add one good and one bad example.

## Step 4: place 20 sample files

Rename and place each of these. Several are deliberately awkward.

```text
Hero Image (final) v2.JPG
trail-runner_side_FINAL.psd
IMG_4412.jpg
Summer Sale 50% off!!.png
northwind-logo-black.svg
northwind logo white.png
EMEA spring campaign - model1.jpg
apac_spring_banner_new.jpg
Jacket-Waterproof_front.jpg
jacket waterproof back.jpg
Legal disclaimer 2026.pdf
brand guidelines v7 final.pdf
fleece-pullover blue 01.jpg
fleece-pullover blue 02.jpg
americas-launch-video-30s.mp4
Photo shoot Priya's folder copy.zip
campaign-all-regions-hero.jpg
tent-3person-open.jpg
TENT 3 PERSON (closed).jpg
sizing-chart-apparel.pdf
```

Tip: the `.zip` and the two logos raise real questions, such as whether archives belong in the DAM and which logo is canonical. Record your answers.

## Step 5: what good looks like

Score each line 0 or 1. Aim for 7 or more.

1. A stranger can predict where a file belongs without asking.
2. At most 2 of 20 files needed a judgement call.
3. No name contains spaces, special characters, status words or version numbers.
4. Shared assets exist once, in the shared area.
5. Access differences map to folder boundaries.
6. The tree is no more than four levels deep.
7. There is a drafts area, with a clean-up rule.
8. The naming rule fits on two lines.

## If you used an environment

Create the folders, upload your renamed files, and confirm that names appear unchanged and that thumbnails and metadata appear after processing. Names that were rewritten tell you a character slipped through.

<details markdown="1">
<summary>Stretch question: where would product line go?</summary>

If Footwear and Apparel have different owners and permissions, make them folders. If they do not, keep them as metadata (level 2), so one asset can be found by product line without moving it. Defend your choice with the access differences from the brief.

</details>

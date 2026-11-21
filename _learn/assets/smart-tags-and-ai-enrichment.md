---
title: "Smart tags and AI enrichment"
description: "How smart tags suggest keywords for images, text and video in AEM Assets as a Cloud Service, and how to review and control them without over-trusting AI."
track: assets
level: 3
order: 17
minutes: 9
outcome: "By the end you can explain how smart tags are generated, control them per folder, and set up a human review step before the tags are trusted."
prereq: "Tags and taxonomy (lesson 9)."
terms:
  - { t: "Smart tags", d: "Keywords that AEM generates automatically from the content of an asset using machine learning." }
  - { t: "Confidence score", d: "A number showing how sure the model is about a tag. Manual tags count as 100 percent." }
  - { t: "Curation", d: "Reviewing generated tags to remove wrong ones or promote useful ones." }
  - { t: "Reprocessing", d: "Running processing again, which also regenerates smart tags and discards earlier moderation." }
  - { t: "Inherited setting", d: "A folder option that takes its value from the parent folder unless you override it." }
mistake: "Treating smart tags as finished metadata. They are suggestions with errors, they are English-only, and moderation changes are lost if an asset is reprocessed."
try_it:
  - "Upload ten varied images to a test folder and open the Properties of each."
  - "Write down the generated tags and mark each as correct, vague or wrong."
  - "Calculate roughly what percentage you would trust without review."
  - "Check the folder's Asset Processing tab and find the smart tag settings and their inherited state."
  - "Write a one-paragraph review rule for your team: who reviews, how often and what counts as a wrong tag."
quiz:
  - q: "What is the safest description of smart tags?"
    options:
      - "Machine-suggested keywords that should be reviewed before use"
      - "Final, accurate metadata that needs no checking"
      - "A replacement for your taxonomy and controlled vocabulary"
      - "Human-written tags copied from similar assets"
    answer: 0
    why: "Smart tags are model output, so they are probabilistic. They help discovery but do not replace a controlled taxonomy or human judgement."
  - q: "A fashion retailer reports that tags confuse 'slim fit' and 'regular fit'. What explains this?"
    options:
      - "A configuration error in their environment"
      - "The folder was set to Inherited by mistake"
      - "The model struggles with subtle visual distinctions and abstract attributes"
      - "Smart tags only work for landscape photographs"
    answer: 2
    why: "Adobe's documentation says the models do poorly on subtle differences, tiny details and subjective attributes. That is a limit of the technique, not a setup mistake."
  - q: "You curate tags on 500 assets, then someone reprocesses the folder. What happens?"
    options:
      - "Your edits are kept because they are manual"
      - "Only the promoted tags survive"
      - "The assets are deleted and re-uploaded"
      - "The generated tags return and your edits are lost"
    answer: 3
    why: "Per Adobe, moderation is lost on reprocessing and the original tags reappear. If curation matters, capture the approved tags in a controlled taxonomy and avoid casual reprocessing."
  - q: "Which is NOT a sound practice?"
    options:
      - "Disabling smart tags on a folder of sensitive or confidential images"
      - "Assigning a person to review tags before assets are widely published"
      - "Relying on English smart tags as the only tags for a multilingual library"
      - "Treating smart tags as an aid to search, not as the only source of metadata"
    answer: 2
    why: "Smart tags are generated in English only, so a multilingual library needs translated metadata too. The other practices apply the review and control that the feature needs."
go_deeper:
  - { title: "AI in AEM: what is real, what is useful", url: "/blog/2026/11/ai-in-aem-what-is-real-what-is-useful/", why: "a sober look at AI features and where they help" }
  - { title: "Tags and taxonomy", url: "/learn/assets/tags-and-taxonomy/", why: "the controlled vocabulary smart tags should support" }
  - { title: "Next lesson: Project: configure a processing profile", url: "/learn/assets/project-processing-profile/" }
---
## The problem

A library has 200,000 images and almost no keywords. Nobody has time to tag them by hand, so search returns little. **Smart tags** offer a head start: AEM looks at the content of an asset and suggests keywords such as "beach", "dog" or "laptop".

## How it works in practice

Adobe's documentation describes smart tags as provisioned automatically on AEM as a Cloud Service, with tagging for images, text and video on by default. Tags are generated during upload and processing, so there is no extra upload step. Assets uploaded before tagging was on are not tagged retroactively: you enable it on the folder and reprocess.

You control it **per folder**. In a folder's Properties, the Asset Processing tab has settings for smart tags for images, text and video, plus colour tags for images. Each defaults to Inherited from the parent, and you can set Disable. Use this for folders where automatic analysis is not appropriate, such as confidential or personal imagery.

## Reviewing and curating

Tags carry a **confidence score**, and manual tags count as 100 percent. In the Manage Tags view, people can remove wrong tags and promote helpful ones to raise their ranking in search. Adobe advises reviewing generated tags for brand conformance before assets are used or distributed.

A realistic review process:

1. Sample new uploads weekly.
2. Remove tags that mislead or embarrass the brand.
3. Feed recurring good terms into your controlled taxonomy.
4. Do not reprocess carelessly, because moderation is lost on reprocessing.

## What smart tags are not

Be honest with stakeholders:

- They are probabilistic. The documentation says the models perform poorly on subtle distinctions, tiny details and abstract qualities such as mood or season.
- They are generated in English only. Other languages need translated metadata.
- Videos above 300 MB are not auto-tagged, per Adobe.
- They sit in full-text search and rank below exact metadata matches. They help discovery, not precision.

## Legal and privacy thoughts

Images can contain people, children, licensed works and confidential products. Decide whether automated analysis is acceptable for each folder, and involve your legal and privacy team. Reviewing tags also protects against offensive or biased labels reaching a published site. This lesson is not legal advice.

## Related features

Smart crop and other intelligence features are separate and mostly sit with delivery (Level 4). Adobe's product names in this area have changed several times, so check Experience League for the current names of Content Hub, GenStudio and similar offerings rather than relying on a course.

<details markdown="1">
<summary>Stretch question</summary>

Should smart tags replace your taxonomy?

No. A taxonomy is deliberate, consistent and governed. Smart tags are broad, noisy and unreviewed. Use them for discovery and for finding candidate terms, with your taxonomy as the authority.

</details>

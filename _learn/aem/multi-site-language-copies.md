---
title: "Multi-site and language copies"
description: "How Multi Site Manager lets AEM reuse one site as live copies and language copies, with rollout, inheritance and translation, and a sound structure."
track: aem
level: 3
order: 20
minutes: 10
outcome: "By the end you can choose between a live copy and a language copy, lay out language roots, and explain what cancelling inheritance does."
prereq: "Lesson 3 on the JCR and lesson 12 on templates."
terms:
  - { t: "Multi Site Manager (MSM)", d: "The AEM feature that creates and keeps related copies of content, such as regional sites." }
  - { t: "Blueprint", d: "A source site structure from which live copies can be created." }
  - { t: "Live copy", d: "A page tree that stays linked to a source and can receive its changes through rollout." }
  - { t: "Language copy", d: "A copy of a site in another language, created to be translated and managed per language." }
  - { t: "Rollout", d: "The action that pushes changes from a source to its live copies." }
  - { t: "Inheritance cancellation", d: "Breaking the link on a page or component so it no longer follows the source." }
mistake: "Copying a site by hand for each market. Copies drift apart, fixes must be repeated, and nobody can say which pages are meant to differ."
try_it:
  - "Sketch a content tree for a site in English, French and German using language roots."
  - "Mark which pages must stay identical everywhere and which are allowed to differ per market."
  - "For each market, decide: live copy (same language, regional changes) or language copy (needs translation)?"
  - "Write down who owns approving a rollout and who owns translation."
  - "Explain in two sentences what happens when someone cancels inheritance on a page."
quiz:
  - q: "A brand has a global site in English and wants a French version translated by an agency. What is the best fit?"
    options:
      - "A language copy of the English site"
      - "A manual copy and paste of every page"
      - "A new AEM instance for French"
      - "An Experience Fragment per page"
    answer: 0
    why: "Language copies exist for exactly this: a structured copy for translation. Manual copies drift and a new instance duplicates cost, and Experience Fragments reuse blocks, not site trees."
  - q: "A regional page was edited locally and inheritance was cancelled. The source page later changes. What happens on rollout?"
    options:
      - "The regional page is overwritten with the source"
      - "The source change is rejected"
      - "The regional page keeps its own version and no longer follows the source"
      - "Both pages are deleted and recreated"
    answer: 2
    why: "Cancelling inheritance detaches the page or component from the source, which is its purpose. The tempting wrong answer is overwrite, but that happens only while inheritance is intact."
  - q: "Which content tree structure is recommended for languages?"
    options:
      - "/content/site/home-fr and /content/site/home-de beside each other"
      - "A language folder per language, such as /content/site/en and /content/site/fr"
      - "One tree with language chosen by a cookie"
      - "Language codes added at random depths per section"
    answer: 1
    why: "Clean language roots give predictable paths, simple rules and easier tooling. Ad hoc names and depths break language switchers and automation."
  - q: "Which statement about hreflang is true in this lesson's scope?"
    options:
      - "MSM generates correct hreflang tags automatically, so no work is needed"
      - "hreflang decides which rollout configuration runs"
      - "hreflang is for search engines and belongs to the SEO lesson, not MSM"
      - "hreflang is required for live copies to work"
    answer: 2
    why: "A sound language structure makes hreflang easier, but the tags are an SEO concern handled by your page code and are covered in lesson 27. They do not control rollout or live copy behaviour."
go_deeper:
  - { title: "AEM MSM and language copies on Cloud Service", url: "/blog/2026/11/aem-msm-language-copies-cloud-service/", why: "a deeper practical walkthrough" }
  - { title: "hreflang checker and generator", url: "/tools/hreflang-checker-generator/", why: "check tags once your structure exists" }
  - { title: "SEO and accessibility on AEM", url: "/learn/aem/seo-and-accessibility/", why: "where hreflang is covered" }
---
## The problem: one brand, many sites

A retailer runs a global site, plus regional sites for the UK, France and Germany. Most pages are the same. Some differ: prices, offers, legal lines, language. If every site is a hand-made copy, every fix has to be repeated and the copies slowly diverge.

**Multi Site Manager (MSM)** is AEM's answer. You keep one source and create related copies that know where they came from.

## Live copies and language copies

Two different relationships solve two different problems.

| | Live copy | Language copy |
|---|---|---|
| Purpose | Same language, regional variation | Same content, another language |
| Link to source | Stays linked, receives rollouts | Created for translation |
| Typical change | Local promo on a global page | Translated text |
| Source | Blueprint or a site | The source language site |

A **blueprint** is a source structure for live copies. When the source changes, a **rollout** pushes updates to the live copies according to rollout configurations. Cancelling **inheritance** on a page or component detaches it, so local edits stay and later source changes are not applied to it. Use that deliberately: a page full of cancelled inheritance is a copy again.

## A recommended structure

Give each language its own root, so paths are predictable:

```text
/content/mysite/en
/content/mysite/fr
/content/mysite/de
```

Predictable roots simplify language switchers, translation jobs, rules in Dispatcher and reporting. The same discipline applies to the DAM and to Content Fragment folders: mirror language roots there when assets and fragments are language-specific.

## Translation

Language copies connect to translation through the translation integration framework, which lets you send content to a translation provider and bring translated content back. The workflow in practice: create or update the source, create or refresh the language copy, start a translation job, review the translated content, and publish. Decide in advance who reviews.

## hreflang is not MSM

Search engines learn which page belongs to which language through hreflang tags. A clean structure makes them easier to produce, but they belong to the SEO lesson (27), not to MSM.

## What to take away

Use live copies for regional variation, language copies for translation, and cancel inheritance sparingly. Settle the folder structure before the first copy is made, because moving trees later is expensive.

<details markdown="1">
<summary>Predict first, then reveal: should a UK site be a live copy or a language copy of the US site?</summary>

Usually a live copy. The language is the same, so you want to follow the source and locally change prices, spelling in a few places, and offers. A language copy fits when the main change is translation. Many real projects combine both.

</details>

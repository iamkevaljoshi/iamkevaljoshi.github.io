---
title: "Browsing, searching and filtering"
description: "How people find assets in AEM Assets: browsing folders, full-text search, filters and facets, saved searches, and why metadata quality decides search quality."
track: assets
level: 1
order: 5
minutes: 8
outcome: "By the end you can choose between browsing and searching, use filters and search syntax to narrow results, and explain why poor metadata means poor search."
prereq: "Lessons 3 and 4 of this track."
terms:
  - { t: "Browsing", d: "Moving through the folder tree to find assets by where they were put." }
  - { t: "Search", d: "Finding assets by what they are, using keywords and metadata, wherever they live." }
  - { t: "Facet (filter)", d: "A search refinement such as file type, size, last modified date or approval status." }
  - { t: "Smart collection", d: "A saved search that updates automatically as matching assets change." }
  - { t: "Smart tags", d: "Tags suggested by AI from the image content. They rank higher in search than other metadata." }
mistake: "Blaming the search box when results are poor. Search can only match what is recorded. If titles are blank and descriptions are missing, even a perfect search engine returns nothing useful, and people go back to asking colleagues."
try_it:
  - "Choose five assets you know exist. For each, write the keywords a stranger would type to find it."
  - "Check whether those keywords appear in the title, description or tags you would expect to have. Count the misses."
  - "If you have an environment: search with an exact phrase in double quotes, then with a wildcard such as `spring*`, and compare the results."
  - "Apply a file-type filter and a date filter, then save the search or turn it into a smart collection."
quiz:
  - q: "When is browsing better than searching?"
    options:
      - "When you know roughly where the asset belongs and want to see its neighbours"
      - "When you need every asset tagged with a certain keyword"
      - "When the library has millions of assets"
      - "When metadata is complete"
    answer: 0
    why: "Browsing is for exploring a known area and seeing context. Keyword and metadata questions across the whole library, especially at scale, are search questions."
  - q: "A marketer searches 'running' and gets 600 results, many irrelevant. What is the best next step?"
    options:
      - "Ask an admin to delete all the older assets"
      - "Add filters such as file type and date, and narrow the scope"
      - "Give up and browse every folder instead"
      - "Search again with the same word"
    answer: 1
    why: "Facets and scope narrow results without changing the library. Browsing everything is slower, and repeating the search changes nothing. Note that smart tags can broaden matches, which is one reason for noisy results."
  - q: "Searches for a product code return nothing, although the photographs exist. What is the most likely root cause?"
    options:
      - "The search index is too small"
      - "Browsers cannot search for numbers"
      - "Search only works on file names"
      - "The code is not recorded in any field that search covers"
    answer: 3
    why: "Search matches recorded information. If the code is not in the title, description, tags or another searchable field, it cannot be found. Fixing metadata at ingestion is the real cure."
  - q: "Which statement about saved searches and collections is NOT true?"
    options:
      - "A smart collection updates as matching assets change"
      - "A static collection holds references that people choose by hand"
      - "A saved search reruns the stored criteria"
      - "A smart collection is a fixed list that never changes"
    answer: 3
    why: "Smart collections are saved searches, so their contents follow the criteria. A static collection is the fixed hand-picked list. Lesson 10 covers collections in detail."
go_deeper:
  - { title: "JCR queries and Oak indexes for AEM performance", url: "/blog/2026/11/jcr-queries-oak-indexes-aem-performance/", why: "what sits underneath asset search" }
  - { title: "Oak index generator tool", url: "/tools/oak-index-generator/", why: "for custom asset indexes when default search is not enough" }
  - { title: "Smart tags and AI enrichment", url: "/learn/assets/smart-tags-and-ai-enrichment/", why: "how automatic tags help search" }
  - { title: "Next lesson: Project: organise a small asset library", url: "/learn/assets/project-organise-a-library/" }
---
## Two ways to find something

Imagine a shop. You can walk the aisles (browsing), or ask the assistant for "waterproof blue jacket, size M" (searching). Walking works when you know the shop. Asking works when you know the item. A good DAM supports both, and people switch constantly.

- **Browsing** follows where an asset was put. It depends on your folder design (lesson 3).
- **Searching** follows what an asset is. It depends on metadata (level 2).

## Browsing

You move through folders, with card or list views and sorting. It is great for context: you see the other hero shots from the same shoot. It is poor at cross-cutting questions such as "every approved image of this product, in any campaign". The Assets interface also loads results in chunks, so very large folders load more as you scroll.

## Searching

In AEM Assets you search from the search field in the top bar, and by default results are scoped to the folder you are in, which you can widen. A few things worth knowing:

- **Full-text search** ignores case, treats several words as AND, and ranks results by relevance.
- **Exact phrases and wildcards:** double quotes for a phrase, `*` and `?` as wildcards, and a leading dash to exclude a term.
- **Filters (facets):** narrow by file type, size, last modified date, approval status and similar. Administrators can adjust which facets appear.
- **Saved searches and smart collections:** save a search so you can rerun it, or turn it into a smart collection that stays current.
- **Smart tags:** AI-suggested tags rank higher than other metadata, and also power finding visually similar images. They can broaden results, so some will be less relevant than expected.

```text
Search:    "running shoe" spring*
Filters:   File type = Image, Approval status = Approved, Modified = last 6 months
Scope:     /content/dam/acme/emea
```

The exact interface and available filters evolve, so check Experience League for your environment.

## Why metadata quality decides search quality

Search does not understand your business. It matches words that someone recorded. Consider two uploads of the same photo:

| | Upload A | Upload B |
|---|---|---|
| Title | `IMG_4412` | Women's trail running shoe, side view |
| Description | (blank) | Spring 2026 hero, EMEA, product code TR-220 |
| Result for "trail" | Not found | Found |

The photographs are identical. Only one is findable. This is why later lessons spend so long on schemas, embedded metadata and tags: they decide whether your library is an asset or a liability.

## What to do about it

Treat findability as a requirement from day one. Decide which fields are mandatory, enforce names and titles at upload, and review what people actually search for. Search terms that return nothing are a free to-do list.

<details markdown="1">
<summary>Stretch question: should you build a deeper folder tree to improve findability?</summary>

Usually not. A deeper tree makes browsing harder and does nothing for a search that is missing the keywords. If people cannot find things, first check whether the metadata they search for exists. Add filters and tags before adding folder levels.

</details>

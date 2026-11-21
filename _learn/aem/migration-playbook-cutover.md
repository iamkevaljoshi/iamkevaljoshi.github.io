---
title: "The migration playbook and cutover"
description: "The phases of an AEM as a Cloud Service migration, how top-up transfers shrink the content freeze, and how to plan redirects, cutover and rollback."
track: aem
level: 6
order: 38
minutes: 10
outcome: "By the end you can lay out the phases of an AEM migration, explain how top-ups shorten the content freeze, and describe a cutover with a rehearsed rollback."
prereq: "The previous lessons in this level, and the idea of author and publish tiers from lesson 2."
terms:
  - { t: "Content freeze", d: "A window in which authors stop changing content on the source so the final transfer is complete and consistent." }
  - { t: "Top-up", d: "An incremental Content Transfer Tool run that moves only what changed since the previous extraction." }
  - { t: "Cutover", d: "The moment live traffic switches from the old platform to the new one, usually by changing DNS or a CDN origin." }
  - { t: "Cutover rehearsal", d: "A timed practice run of the final steps, including rollback, before the real launch." }
  - { t: "Hypercare", d: "A period of closer monitoring and faster response after go-live." }
mistake: "Treating cutover as a single event on launch day. Teams that never rehearse the final top-up and rollback discover their real freeze length and their rollback problems while the business is watching."
try_it:
  - "Write the seven phases as column headings: assess, plan, build or refactor, content migration, test, cutover, hypercare."
  - "Under each, list who is involved and what must be true before the next phase starts."
  - "Estimate how long a final top-up would take for a repository you know, and propose a freeze window."
  - "Open the redirect map builder and paste ten old and new URLs to see how it finds chains and duplicates."
  - "Write a three-line rollback plan: what triggers it, what you do, and who decides."
quiz:
  - q: "What is the main purpose of running frequent top-up transfers before go-live?"
    options:
      - "To keep the final delta small and the content freeze short"
      - "To avoid ever needing a content freeze"
      - "To test that DNS records are correct"
      - "To move code from the old system to the new one"
    answer: 0
    why: "Top-ups carry only what changed, so the last one is small. They shorten the freeze rather than remove it, and the Content Transfer Tool moves content, not code, which comes through the pipeline."
  - q: "Your rehearsal shows the final top-up takes nine hours, but the business agreed to a four-hour freeze. What is the best response?"
    options:
      - "Launch anyway and hope it runs faster on the day"
      - "Cut the freeze and skip validation to hit four hours"
      - "Move the go-live date without telling anyone"
      - "Run more top-ups to shrink the delta, then rehearse again"
    answer: 3
    why: "The rehearsal exists to expose this. Smaller deltas from more frequent top-ups are the lever, and a repeat rehearsal confirms the result. Skipping validation or hoping trades a known problem for an unknown one."
  - q: "The old site has 3,000 URLs that change on the new platform. What does that mean for the plan?"
    options:
      - "Nothing, because search engines work out moved pages themselves"
      - "Each changed URL should get a redirect, ideally a single hop, built and tested before cutover"
      - "Redirects can wait until a month after launch"
      - "Only the home page needs a redirect"
    answer: 1
    why: "Visitors and search engines follow old URLs, so each changed one needs a redirect to avoid 404s and lost rankings. Chains and loops should be removed before launch, not discovered afterwards."
  - q: "Which statement about rollback is NOT true?"
    options:
      - "The old platform should stay unchanged during hypercare"
      - "Lower DNS TTLs help a rollback propagate quickly"
      - "A rollback plan is only useful if it has been rehearsed"
      - "Rollback is unnecessary if the project passed UAT"
    answer: 3
    why: "Passing UAT lowers risk but does not remove it, and production traffic finds problems testing missed. The other statements describe what makes a rollback actually work."
go_deeper:
  - { title: "AEM 6.5 or AMS to AEM as a Cloud Service: the migration playbook", url: "/blog/2026/11/aem-on-premise-and-managed-services-to-aem-as-a-cloud-service-migration/", why: "step by step, including Content Transfer Tool rules" }
  - { title: "AEM redirect map builder", url: "/tools/aem-redirect-map-builder/", why: "validates and generates redirect rules" }
  - { title: "AEM go-live checklist", url: "/blog/2026/11/aem-go-live-checklist/", why: "cutover timeline, go/no-go and rollback" }
  - { title: "AI-assisted AEM Cloud Service migration", url: "/blog/2026/11/ai-assisted-aem-cloud-service-migration/", why: "where AI shortens the code phases" }
---
## A migration is a sequence, not a switch

Moving a large AEM estate is like moving house. You survey it, plan the move, pack, carry things over in several trips, check the new place, and only then hand back the keys. The trips matter most: carrying everything in one go on the last day means a long, risky day.

## The phases

| Phase | What happens | Done when |
|---|---|---|
| **Assess** | Run BPA, inventory integrations, sites and content | You know the scope and the unknowns |
| **Plan** | Choose the target, estimate, set the timeline, plan the freeze | Estimate and plan are agreed |
| **Build or refactor** | Fix BPA findings, restructure the repository, set up Cloud Manager | Pipeline builds and deploys cleanly |
| **Content migration** | Transfer content with the Content Transfer Tool | Content validated in stage |
| **Test** | Functional, performance, security, accessibility, SEO parity | Sign-off from QA and the business |
| **Cutover** | Final transfer, switch traffic | Production serves from the new platform |
| **Hypercare** | Watch, fix, redirect, tune | Metrics stable, hypercare reviewed |

Code refactoring and content transfers overlap, which is why a good plan has two tracks running side by side.

## Content: transfer early and often

The Content Transfer Tool extracts content into a migration set and ingests it into a Cloud Service environment. The first transfer is the biggest. Later **top-ups** move only what changed.

```text
Week 1   Full extraction -> ingest into stage          (large, slow)
Week 4   Top-up                                        (small)
Week 7   Top-up                                        (smaller)
Week 9   Daily top-ups as go-live nears                (tiny)
T-0      Content freeze, final top-up, smoke test, switch
```

The **content freeze** is the period when authors stop editing on the source so the final top-up is complete. Frequent top-ups keep that last delta small, so the freeze is hours rather than days. Check Adobe's Content Transfer Tool guidance for current rules, such as limits on migration sets and the fact that author is unavailable during an author ingestion, because they shape your timetable.

## Cutover and redirects

At cutover, traffic moves to the new platform, typically by changing DNS or re-pointing the CDN origin. A few habits make it boring, which is the goal:

- **Lower DNS TTLs** days beforehand so the change, and any reversal, propagates quickly.
- **Launch with nothing new.** No deployments and no content changes during the switch.
- **Redirect every changed URL.** Collect old and new URLs, find duplicates, chains and loops, and flatten to single hops. The [redirect map builder](/tools/aem-redirect-map-builder/) on this site does this and outputs rules you can adapt for your setup.

## Rehearsal and rollback

A **cutover rehearsal** is a timed practice of the final steps: the last top-up, validation, smoke tests, the switch to a test hostname, and the rollback. Its job is to produce real numbers, such as how long the final transfer takes, and to catch the surprises while nothing is at stake.

Plan the rollback before you need it. For code, that usually means redeploying the previous release through the pipeline. For the platform, it means pointing DNS or the CDN back at the old site, which only works if that site stays untouched and warm through hypercare. Decide in advance what triggers it and who decides.

<details markdown="1">
<summary>Stretch question: why not just extract everything once, on the last weekend?</summary>

Because the full extraction is the slowest step and the one most likely to reveal data problems such as broken references. Doing it once, late, puts all that risk and a very long freeze on launch week. Doing it early and topping up turns a big unknown into a series of small, measured steps.

</details>

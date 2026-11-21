---
title: "The go-live checklist"
description: "A grouped AEM go-live checklist covering performance, security, SEO, accessibility, monitoring, content and operations, with the reason each item matters."
track: aem
level: 6
order: 39
minutes: 9
outcome: "By the end you can build a go-live checklist grouped by area, explain why each item exists, and run a go or no-go decision using it."
prereq: "The previous lesson on the migration playbook and cutover."
terms:
  - { t: "Go-live checklist", d: "A list of checks, each with an owner, that must pass or be consciously accepted before production traffic moves." }
  - { t: "Go/no-go meeting", d: "The final decision meeting where open items are reviewed and the launch is approved or delayed." }
  - { t: "Stage", d: "The pre-production environment used for performance and security testing, ideally matching production." }
  - { t: "Core Web Vitals", d: "Google's field measures of loading, interactivity and visual stability, used to judge real user experience." }
  - { t: "Smoke test", d: "A short set of checks on the live hostname to confirm the essentials work right after cutover." }
mistake: "Tick-box launching: marking items done without evidence or an owner. The checklist then gives false comfort, and the one item nobody truly checked is the one that fails in production."
try_it:
  - "Create seven headings: performance, security, SEO, accessibility, monitoring, content and operations."
  - "Under each, write three checks and one sentence on what goes wrong if it is skipped."
  - "Give every item a named owner and a date, not a team name."
  - "Mark each item as blocks launch, launch with a plan, or does not block."
  - "Role-play a go/no-go meeting with a friend and decide on one deliberately failing item."
quiz:
  - q: "Why does a go-live checklist group items by area, such as SEO or security?"
    options:
      - "So each area has a clear owner who can show evidence"
      - "So the list looks shorter to management"
      - "Because Adobe requires that exact grouping"
      - "So testing can be skipped for low-risk areas"
    answer: 0
    why: "Grouping lets you assign ownership and ask for proof per area. It does not shorten the real work, and no particular grouping is mandated."
  - q: "On launch morning, redirects for the top 50 traffic URLs are missing but a few long-tail redirects are not mapped yet. What is the sensible call?"
    options:
      - "Launch and fix everything later, since redirects are minor"
      - "Delay a month until every redirect exists"
      - "Fix the top-traffic redirects before launch and monitor the long tail"
      - "Remove the old site so visitors must use new URLs"
    answer: 2
    why: "Missing redirects on high-traffic or heavily linked URLs block launch, while the long tail can be monitored and fixed during hypercare. Treating all redirects the same either risks rankings or delays pointlessly."
  - q: "Which check best protects you from accidentally hiding the whole new site from search engines?"
    options:
      - "A visual review of the home page on stage"
      - "Checking noindex, canonicals and robots.txt on the production hostname"
      - "Running a load test on stage"
      - "Confirming the SSL certificate has not expired"
    answer: 1
    why: "Stage settings often differ from production, so indexing directives must be checked where they matter. A good-looking page, a load test or a valid certificate says nothing about indexing."
  - q: "Which statement about a go-live checklist is NOT true?"
    options:
      - "Some open items can be accepted with a plan and a date"
      - "Cutover should happen without new deployments or content changes"
      - "Monitoring should be set up before launch, not after"
      - "A completed checklist guarantees nothing will go wrong"
    answer: 3
    why: "A checklist lowers risk and makes decisions explicit, but it guarantees nothing. That is why monitoring, hypercare and rollback still matter."
go_deeper:
  - { title: "The AEM go-live checklist", url: "/blog/2026/11/aem-go-live-checklist/", why: "the full 40-plus item list, cutover timeline and go/no-go table" }
  - { title: "AEM cloud service cdn.yaml: headers, proxy and redirects", url: "/blog/2026/11/aem-cloud-service-cdn-yaml-headers-proxy-redirects/", why: "CDN configuration items from the checklist" }
  - { title: "AEM redirect map builder", url: "/tools/aem-redirect-map-builder/", why: "check the redirect items before launch" }
  - { title: "Next lesson: Capstone, plan a migration end to end", url: "/learn/aem/capstone-plan-a-migration/" }
---
## Why a checklist at all

Pilots use checklists before every flight, not because they forget how to fly, but because the cost of one missed item is high and the work is routine enough to skim. Launch day is the same. The team is tired, the business is watching, and the item that fails is rarely a clever one. It is usually something like a certificate, a robots rule or a missing redirect.

The best checklists teach as they go: each item carries the reason it exists, so people can judge edge cases instead of ticking boxes.

## The groups, and why each matters

**Performance.** Test on stage with production-sized content, because an empty environment lies. Check Core Web Vitals on key templates. Slow pages cost conversions and rankings, and fixing them after launch happens under pressure.

**Security.** Confirm secrets are set as environment values rather than in the repository, access is least-privilege, and CDN rules such as rate limits start in a log-only mode before blocking. A rule that blocks real customers on day one is a security feature causing an outage.

**SEO.** Check `noindex`, canonical tags, `robots.txt` and the sitemap on the **production hostname**, plus redirects for every changed URL. These are the biggest causes of lost organic traffic after a launch, and stage settings often differ from production.

**Accessibility.** Run automated checks and a manual pass on key journeys against your target standard. It is cheap to fix before launch and costly, and sometimes a legal matter, afterwards. The accessibility checker tool on this site can help with the first pass.

**Monitoring.** Alerts, log access and a named person watching them must exist before traffic moves. If you only discover the 5xx rate during hypercare by chance, you are not monitoring.

**Content.** Counts of pages and assets match, links and references resolve, and the freeze has actually been applied. Content is the one thing you cannot rebuild from the repository.

**Operations.** The rollback is rehearsed, the DNS TTLs were lowered, a support rota covers hypercare, and the previous release is tagged and ready. Launch with nothing new, so there is nothing new to roll back.

## Making it real

A checklist item needs an owner, a due date and evidence:

```text
Item:      Top 200 landing pages redirect in a single hop
Owner:     Priya (SEO lead)
Due:       T-7 days
Evidence:  Crawl report attached, 0 chains, 0 loops
Status:    Blocks launch if failed
```

Then classify every item as **blocks launch**, **launch with a plan** or **does not block**. In the go/no-go meeting you review only the failures and the "with a plan" items, and either accept them with a date or delay. The goal is a conscious decision, not a perfect score.

The full list of items, with the cutover timeline, is in the go-live checklist post linked below. Treat it as a menu to adapt, not a form to copy.

<details markdown="1">
<summary>Stretch question: why check indexing rules on the production hostname rather than stage?</summary>

Because the file and header settings that control indexing are often environment specific. Stage is commonly set to block search engines on purpose. If that setting is copied to production, or production differs in some other way, only a check against the real hostname after the switch will catch it.

</details>

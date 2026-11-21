---
title: "Choosing an architecture: AEM, Edge Delivery Services or headless"
description: "Compare traditional AEM Sites, headless Content Fragments, Edge Delivery Services and hybrid builds, and learn the questions that decide which one fits."
track: aem
level: 6
order: 35
minutes: 10
outcome: "By the end you can pick between traditional AEM Sites, headless, Edge Delivery Services and a hybrid for a given project, and justify the choice with the questions that matter."
prereq: "Lessons 1 to 5 of this track, so you know what Sites, Content Fragments and publish delivery are."
terms:
  - { t: "Traditional (coupled) AEM Sites", d: "AEM manages the content and also renders the pages, using templates, components and HTL on the publish tier." }
  - { t: "Headless", d: "AEM stores structured content as Content Fragments and delivers it as JSON, for example through GraphQL persisted queries, while a separate front end renders it." }
  - { t: "Edge Delivery Services (EDS)", d: "A page-based model where content is authored in documents or the Universal Editor and served as fast pre-rendered HTML from the edge, with front-end-only code." }
  - { t: "Hybrid", d: "AEM keeps authoring and in-context editing, while a JavaScript application renders some or all of the experience." }
  - { t: "Composable", d: "An estate assembled from separate best-of-breed services, where AEM may be only one of the pieces." }
mistake: "Choosing an architecture because it is fashionable, for example going headless for a brochure site. You then rebuild preview, routing and SEO yourself and authors lose in-context editing, which they notice after go-live."
try_it:
  - "Pick a real site you know and list its channels (web only, or web plus app, kiosk and so on)."
  - "Write down how many authors it has, how often they publish, and whether they need to see the page while editing."
  - "Write down the team's skills: Java and AEM, JavaScript front end, or neither."
  - "Score the four options (traditional, headless, EDS, hybrid) from 1 to 5 against channels, authoring, skills, performance and integrations."
  - "Add up the scores, then ask which single answer you would most regret getting wrong. That is your tiebreaker."
quiz:
  - q: "In a headless AEM setup, what does AEM deliver to the front end?"
    options:
      - "Fully rendered HTML pages built from HTL templates"
      - "Structured content, such as Content Fragments, as JSON"
      - "A bundle of React components for the site"
      - "Static pages exported from a Word document"
    answer: 1
    why: "Headless means AEM serves structured content and knows nothing about pages. The front end owns rendering. Rendered HTML from HTL is the traditional model."
  - q: "A retailer has a website and a mobile app that both show the same product copy, and 40 marketers who want to see pages as they edit. What is the most sensible direction?"
    options:
      - "Fully headless, because the app needs structured content"
      - "Traditional only, and copy the text into the app by hand"
      - "A hybrid or mixed approach: page authoring for the site, fragments for the shared copy"
      - "Composable, with a separate vendor for every capability"
    answer: 2
    why: "Two needs pull in different directions: in-context editing for the site and reusable content for the app. Mixing approaches serves both. Going fully headless would cost the marketers their preview, and copying by hand lets content drift."
  - q: "A small team of JavaScript developers must launch a content-led marketing site fast, with top-tier Core Web Vitals and no Java skills. Which option fits best on those facts?"
    options:
      - "Traditional AEM Sites with custom Java components"
      - "Headless with a bespoke server-rendered application"
      - "A composable stack with six new vendors"
      - "Edge Delivery Services with front-end-only blocks"
    answer: 3
    why: "EDS suits front-end teams that want speed and performance by default. The tempting headless option adds routing, preview and SEO work you would have to own."
  - q: "Which statement about choosing an architecture is NOT true?"
    options:
      - "Composable estates tend to add integration, contract and operations work"
      - "Headless AEM does not by itself solve SEO, because the front end owns it"
      - "The decision should weigh team skills and existing investment as well as technology"
      - "Going composable removes lock-in because every piece is replaceable"
    answer: 3
    why: "Composable spreads lock-in rather than removing it: your content model and integration code stay yours. The other three statements are real trade-offs."
go_deeper:
  - { title: "Composable, headless or traditional AEM: a decision framework", url: "/blog/2026/11/composable-headless-or-traditional-aem-decision-framework/", why: "the full eleven-dimension scoring matrix and scenarios" }
  - { title: "AEM Edge Delivery Services vs traditional AEM as a Cloud Service", url: "/blog/2026/11/aem-edge-delivery-services-vs-traditional-aemaacs/", why: "how EDS and the traditional model compare in detail" }
  - { title: "The real cost of AEM: licences, hosting, build and run", url: "/blog/2026/11/real-cost-of-aem-licences-hosting-build-and-run/", why: "cost is one of the deciding questions" }
  - { title: "A solution architect's first two weeks", url: "/blog/2026/11/solution-architect-first-two-weeks/", why: "how the discovery that feeds this decision is run" }
---
## The question behind the question

A new project starts and someone asks: "Should we use AEM, headless, or Edge Delivery Services?" It sounds like a choice between products. It is really a choice about **where the work lands**: who renders the page, who builds preview, who owns performance, and which skills the team needs.

Think of building a restaurant. You can rent a fully fitted kitchen (traditional AEM), buy ingredients and cook in several places (headless), or run a fast counter with a short menu (Edge Delivery Services). None is better in general. Each fits a different business.

## The four options in plain terms

**Traditional (coupled) AEM Sites.** AEM stores the content and renders the pages. Authors edit in context, templates and policies keep the design safe, and governance features are strong. You need Java and AEM skills.

**Headless.** AEM holds structured content as Content Fragments and serves it as JSON, commonly through GraphQL persisted queries. A separate front end, perhaps a mobile app or a JavaScript site, does the rendering. This is a good fit when one piece of content feeds many channels. The cost is that your front-end team now owns routing, SEO metadata and preview.

**Edge Delivery Services (EDS).** Authors work in documents or the Universal Editor. Pages are served as pre-rendered HTML from the edge, built from front-end-only blocks in a Git repository. It is page-based, so it is **not** headless: it serves pages, not a content API for apps. It tends to give excellent performance by default.

**Hybrid and composable.** In a hybrid, AEM still owns editing while a JavaScript application renders. In a composable estate, AEM is one service among several. Both are real options, and both carry integration and operations work that licence savings rarely cover.

## The questions that decide

Ask these in a workshop, in this order:

1. **Channels:** is the web the product, or one of several channels?
2. **Authoring:** do marketers need to see the page while they edit?
3. **Team skills:** Java and AEM, JavaScript, or neither in house?
4. **Performance and SEO:** is organic search a top acquisition channel?
5. **Integrations:** how many systems must the experience talk to?
6. **Cost and complexity:** how many vendors and support boundaries can you run?

A simple starting table:

| If your strongest need is... | Lean towards | Watch out for |
|---|---|---|
| Governance, many markets, in-context editing | Traditional AEM Sites | Needs Java and AEM skills |
| One content set across web, app and screens | Headless | You rebuild preview, routing and SEO |
| Speed to launch and top performance, front-end team | Edge Delivery Services | Not a content API for apps |
| Custom front-end stack plus real editing | Hybrid (Universal Editor) | Two systems to run |
| Replaceable parts, strong platform team | Composable | The integration tax |

Mixing is normal. A site on EDS or traditional Sites can use a few Content Fragments for content an app also needs.

## Writing the decision down

Teams that choose well record the reasoning, not just the result. A short architecture decision record lists the options, the weights you gave to each question, and the dissent. The decision framework post linked below shows a scoring matrix you can adapt. The number is not the decision. Its value is that people argue about **what matters to the business** instead of which product they like.

<details markdown="1">
<summary>Stretch question: why is "headless for everything" a risky default?</summary>

Headless removes the page from AEM, so the things the page used to give you for free, such as in-context preview, routing, SEO metadata and sitemaps, become your front end's job. That is worth it when several channels need the same content. For a single website it often just moves cost from the platform to your own team.

</details>

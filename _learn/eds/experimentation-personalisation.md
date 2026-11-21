---
title: "Experimentation and personalisation"
description: "How A/B testing works on Edge Delivery Services through the experimentation plugin, how it differs from personalisation, and the privacy limits to respect."
track: eds
level: 5
order: 28
minutes: 9
outcome: "By the end you can set up the metadata for a simple EDS experiment, explain how a visitor is assigned a variant, and say when you need personalisation tooling instead."
prereq: "Lessons 15 (three-phase loading) and 18 (measuring real users with RUM)."
terms:
  - { t: "Experiment", d: "A controlled test where visitors are randomly shown the control page or a challenger, so you can compare outcomes." }
  - { t: "Control and challenger", d: "The control is the current page, a challenger is a changed version of it." }
  - { t: "Experimentation plugin", d: "Code in your project, adobe/aem-experimentation, that reads page metadata and swaps in a challenger in the browser." }
  - { t: "Personalisation", d: "Showing different content to different visitors based on who they are or their context, rather than testing one change on everyone." }
  - { t: "Holdout", d: "A group that deliberately sees the default experience so you can prove a change helped." }
mistake: "Starting an experiment without a hypothesis and a planned sample size. The result is a pile of sampled page views that looks like an answer but cannot support one."
try_it:
  - "Write a hypothesis in the form: if we change X, then Y will improve, because Z."
  - "Name one primary metric and two guardrail metrics, such as bounce or page speed."
  - "On a copy of a page under `/experiments/`, make the change and keep the control untouched."
  - "Add the experiment rows to the control's metadata block: `Experiment`, `Experiment Variants` and `Experiment Split`."
  - "Preview the control and use the Sidekick experimentation panel to switch between variants."
  - "Add a bulk metadata rule to mark `/experiments/**` as `noindex,nofollow`."
quiz:
  - q: "Where is the variant for a visitor decided in the EDS experimentation plugin?"
    options:
      - "At the CDN, which caches a different page per variant"
      - "In the Admin API, when the page is published"
      - "In the browser, using metadata and a weighted random draw"
      - "In the author's Sidekick, one visitor at a time"
    answer: 2
    why: "Everyone gets the same cached control page, and the plugin decides in the browser. That is why caching and time to first byte are unaffected, but also why assignment is not tied to a person."
  - q: "You set Experiment Split to 100 with one challenger. What do you get?"
    options:
      - "A 50 percent challenger and a 50 percent control, split evenly"
      - "A 100 percent challenger and no control, because splits are per challenger and the control gets the remainder"
      - "Two challengers and no control"
      - "An error, because the split must add up to 100"
    answer: 1
    why: "Splits describe the challengers, and the control gets what is left. A total of 100 removes the control, which defeats the test."
  - q: "A retailer wants to show different homepage content to returning high-value customers, using audience data from a customer platform. Which tool fits?"
    options:
      - "The EDS experimentation plugin alone, with more variants"
      - "A larger split percentage on the plugin"
      - "Robots rules, so only some visitors see the page"
      - "A personalisation tool or edge logic fed by audience data, such as Adobe Target"
    answer: 3
    why: "The plugin is for content and layout tests that everyone is eligible for. Audience-driven and model-driven personalisation needs a platform with profiles, with its speed and consent costs weighed up."
  - q: "Which is NOT a good practice for personalisation?"
    options:
      - "Always keep a default experience for visitors with no data"
      - "Respect consent before using visitor data"
      - "Hide content from crawlers so only the personalised version exists"
      - "Measure against a holdout group"
    answer: 2
    why: "Content hidden from crawlers harms search, and the main content should be the same for everyone. A default, consent and a holdout are what make personalisation safe and provable."
go_deeper:
  - { title: "EDS experimentation: how it works and how to measure success", url: "/blog/2026/11/aem-eds-experimentation-how-it-works-and-how-to-measure-success/", why: "the mechanics, metadata keys and statistics in depth" }
  - { title: "Adobe Target vs EDS experimentation", url: "/blog/2026/11/adobe-target-vs-edge-delivery-services-experimentation/", why: "when to use which, and the speed cost of Target" }
  - { title: "Personalisation that works", url: "/blog/2026/11/personalisation-why-it-matters-and-how-to-do-it-well/", why: "the loop, maturity ladder and privacy" }
  - { title: "Next lesson: Edge workers and JSON2HTML", url: "/learn/eds/edge-workers-json2html/" }
---
## Two ideas that get mixed up

You think a new hero will convert better. How do you know? Guessing is how redesigns go wrong. An **experiment** answers the question: half of visitors see the old hero, half see the new one, and you compare.

**Personalisation** is a different question: should *this* visitor see something different from *that* one, because of who they are or where they are? One tests a change on everyone. The other tailors content to groups. EDS has a built-in answer for the first and relies on other tools for the second.

## How an EDS experiment works

The mechanics are simple, which is the point:

1. The CDN serves the normal, cached **control** page to everyone.
2. Authors add experiment metadata. In a document that is rows in the page's metadata block, which EDS turns into `<meta>` tags.
3. A small loader in your scripts sees those tags and loads the plugin. **No experiment, no plugin download.**
4. In the browser, the plugin makes a weighted random draw and remembers it in `sessionStorage`.
5. If a challenger is chosen, it fetches that page and swaps its content in before the first section renders.
6. A telemetry checkpoint records which variant was shown, so results appear alongside your other measurements.

A control page's metadata might look like this:

| Metadata key | Value |
|---|---|
| Experiment | EXP-0042 hero wording |
| Experiment Variants | /experiments/exp0042/challenger-1 |
| Experiment Split | 50 |

Splits are per challenger, so 50 gives a 50 percent challenger and a 50 percent control. The challenger is an ordinary document under `/experiments/`, which you should mark `noindex` with a bulk metadata rule. Section and fragment experiments exist too, and code-only experiments use a number of variants and read classes added to the body.

Two consequences matter. Because assignment is stored per browser session, it identifies a *session*, not a *person*. And because reporting uses sampled Operational Telemetry (default one page view in 100), you need enough traffic to see a real effect. Decide the hypothesis, primary metric, guardrails and sample size **before** launch, and avoid stopping early because a graph looks good.

On AEM with the Universal Editor, an experimentation panel creates the challenger and sets the split for you, with some limits such as page-level A/B tests with one goal. The plugin underneath is the same. The [how-it-works post](/blog/2026/11/aem-eds-experimentation-how-it-works-and-how-to-measure-success/) covers the details.

## Where personalisation fits

The plugin can target simple audiences that you define in code, such as mobile or desktop. For richer audiences, recommendations or automated allocation, teams use a platform such as Adobe Target. That comes with a cost: Adobe's own figures, quoted in the [Target comparison](/blog/2026/11/adobe-target-vs-edge-delivery-services-experimentation/), show a noticeable hit to mobile LCP on the first call, so enable it only where it earns its keep.

Where personalisation runs matters. In the browser it risks flicker and slower pages. At the edge or server it avoids both, but needs more engineering (next lesson).

## Privacy is a design constraint

Personalisation uses data about people, so:

- Get **consent** before using personal data, and give declined visitors the default.
- Prefer **first-party, contextual** signals such as page, device or country over tracking.
- Keep main content the same for crawlers and everyone, and vary only supporting parts.
- Keep a **default** and a **holdout**, and retire tests when done.

The plugin has a consent-aware option so that declined visitors receive the control and send no experiment events.

<details markdown="1">
<summary>Stretch question: why is assignment per session a problem for some tests?</summary>

A visitor who returns tomorrow may be drawn again and land in a different arm. That is fine for a single-page conversion, but it breaks tests that depend on repeated exposure, such as whether someone converts a week later. For those, use stickier storage (after checking consent) or measure in your analytics tool with an identifier.

</details>

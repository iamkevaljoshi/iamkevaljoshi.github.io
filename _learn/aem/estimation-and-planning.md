---
title: "Estimation and planning"
description: "Why AEM estimates go wrong, how to estimate with ranges instead of single numbers, and which drivers, assumptions and risks to track."
track: aem
level: 6
order: 37
minutes: 9
outcome: "By the end you can produce a ranged AEM estimate from its main drivers, with a written assumptions log and a short risk list."
prereq: "The previous lesson on the Best Practices Analyzer, and a rough idea of what templates and components are."
terms:
  - { t: "Estimate range", d: "A low and a high figure with a most likely value between them, instead of one number." }
  - { t: "Driver", d: "A property of the project, such as the number of unique components or integrations, that moves the effort up or down." }
  - { t: "Assumption", d: "Something you are treating as true to produce the estimate, written down so it can be checked." }
  - { t: "Contingency", d: "Extra effort held against named risks, ideally explained rather than a flat percentage." }
  - { t: "Cone of uncertainty", d: "The idea that early estimates can be wrong by a large factor and only narrow as the project is defined." }
mistake: "Committing to a single number at the start. The estimate is then treated as a promise, the unknowns surface later, and the gap becomes a change-request argument instead of a planning conversation."
try_it:
  - "Choose a project you know and list its drivers: unique components, templates, integrations, content volume and locales."
  - "For each driver, write a low, likely and high value for the effort in days."
  - "Add the non-coding work: QA, project management, content migration, training and hypercare."
  - "Open the migration estimator tool and enter the same counts, then compare its total with yours."
  - "Write five assumptions and three risks, each with an owner and a date to check it."
quiz:
  - q: "Why is a range usually better than a single-number estimate?"
    options:
      - "It makes the project look cheaper to the client"
      - "It shortens the time needed to produce the estimate"
      - "It shows the uncertainty honestly, so people plan around it"
      - "It removes the need for any assumptions"
    answer: 2
    why: "A range communicates how sure you are. It does not make the work cheaper or quicker, and it still needs assumptions, which are what explain the width of the range."
  - q: "A site has 20,000 pages but only 25 unique components, and another has 500 pages but 60 bespoke components. Which is likely to cost more to build?"
    options:
      - "The 20,000-page site, because pages drive build effort"
      - "The 500-page site, because components drive build effort"
      - "They cost the same, because the totals are similar"
      - "It cannot be said without counting authors"
    answer: 1
    why: "Unique components and their complexity drive build effort, while page count mostly drives content migration, QA sampling and redirects. Assuming pages drive the build is the usual mistake."
  - q: "You estimated 120 days of development, but your QA line is only 10 days. What does that suggest?"
    options:
      - "The QA line is probably too low and should be rechecked"
      - "The team is very efficient, so it is fine"
      - "QA can be added later as contingency"
      - "The estimate is too high and should be cut"
    answer: 0
    why: "QA usually runs at a sizeable fraction of development effort. A very low ratio is a sign the bottom-up number is incomplete, not a sign of efficiency."
  - q: "Which is NOT a good use of an assumptions log?"
    options:
      - "Recording that a CRM sandbox will be available by sprint two"
      - "Giving each assumption an owner and a check date"
      - "Reviewing it when the scope or design changes"
      - "Hiding unknowns so the estimate looks firmer"
    answer: 3
    why: "The point of the log is to expose unknowns so they can be checked or priced. Hiding them makes the estimate look firmer while moving the risk to delivery."
go_deeper:
  - { title: "How to estimate an AEM project, and why estimates go wrong", url: "/blog/2026/11/how-to-estimate-an-aem-project/", why: "drivers, complexity tiers, PERT and a worked example" }
  - { title: "AEM migration estimator", url: "/tools/aem-migration-estimator/", why: "an editable estimate from a BPA CSV and your site" }
  - { title: "The real cost of AEM: licences, hosting, build and run", url: "/blog/2026/11/real-cost-of-aem-licences-hosting-build-and-run/", why: "where the money goes beyond the build" }
  - { title: "Next lesson: The migration playbook and cutover", url: "/learn/aem/migration-playbook-cutover/" }
---
## Why estimates go wrong

Someone asks for a number in week zero. You do not yet know how many components there really are, whether single sign-on is federated or who will move 2,000 pages of content. You give a number anyway, and it becomes a promise.

Three forces cause this. Early on, the true effort can sit far above or below your figure, and the uncertainty only shrinks as requirements and design firm up. People are also optimistic about their own tasks, even when similar ones overran. And low numbers win bids and budgets, so some estimates are low on purpose. The blog post linked below covers the reasoning in more depth.

The fix is not to guess better. It is to estimate in a way that shows what you know and what you do not.

## Use ranges, not points

For each uncertain item, write three numbers: optimistic, most likely and pessimistic. A common way to combine them weights the most likely value more heavily:

```text
Expected = (optimistic + 4 x likely + pessimistic) / 6

Store locator component
optimistic 8 days, likely 12 days, pessimistic 25 days
Expected = (8 + 48 + 25) / 6 = 13.5 days
```

Notice that the expected value is above the most likely one. Things can go slightly better than planned, or much worse. A range of 100 to 180 days is more useful to a sponsor than "140 days", because it tells them how much to hold back.

## The drivers to count

Estimate drivers, not pages. The ones that move an AEM estimate most:

- **Unique components** after merging variants, by complexity tier.
- **Templates**, each adding configuration and QA.
- **Integrations**, the riskiest line, because you depend on someone else's team.
- **Content volume**, which drives migration effort, QA sampling and redirects.
- **Locales**, which multiply content, testing and authoring setup.
- **Testing and quality**, including accessibility, performance and security.
- **Launch and hypercare**, always longer than the plan says.

Coding is usually well under half of the budget. Delivery management, QA, content, architecture and launch work make up the rest, so check your total against ratios from past projects. If your bottom-up number implies QA at a tenth of development, the number is wrong.

For a migration, the BPA report from the last lesson is a driver source: finding counts by category become refactoring effort, and repository size drives content migration. The [migration estimator](/tools/aem-migration-estimator/) does that conversion, with every rate editable, so use it to sanity-check your own sheet.

## Assumptions and risks

An estimate is a set of assumptions with arithmetic on top. Write them down:

| Assumption | Owner | Check by |
|---|---|---|
| CRM API sandbox available by sprint 2 | Integration lead | End of sprint 1 |
| Design final for the 6 complex components | Design lead | Before build starts |
| Client IT completes firewall changes in 2 weeks | Client PM | Week 1 |

Then keep a short risk list where each risk has a probability and an impact. The buffer is the sum of the expected values, so you can explain every week of contingency, and remove it when the risk is fixed. A flat 10 percent cannot be explained to anyone.

Finally, commit in phases. Fund discovery first, then commit to build once the cone has narrowed.

<details markdown="1">
<summary>Stretch question: a client insists on a fixed price today. What do you do?</summary>

Offer a fixed price for the discovery phase and a range for the rest, with the assumptions attached. If a single figure is unavoidable, price the pessimistic end plus a risk buffer, and state that a change in any listed assumption reopens the number. Hiding uncertainty does not remove it, it just moves the argument to later.

</details>

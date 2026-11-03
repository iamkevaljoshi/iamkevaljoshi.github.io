---
layout: post
title: "What a solution architect does in the first two weeks of a project"
seo_title: "Solution Architect: First Two Weeks on a New Project"
description: "A day-by-day playbook for a solution architect's first two weeks on a client project: interviews, discovery, NFRs, C4, ADRs, a RAID log, a spike and a readout."
ai_summary: "A solution architect's first two weeks should be spent listening in week one and shaping in week two. That means interviewing stakeholders, raising access requests on day one, writing non-functional requirements with numbers, capturing key decisions as a C4 context diagram and a few architecture decision records, spiking the riskiest assumption early and ending with a readout rather than a long document."
date: 2026-11-03 19:40:00 +0530
category: architecture
tags: [Solution Architecture, Delivery, Leadership]
---

I've joined a lot of client projects as the solution architect: sometimes at kick-off, sometimes three months in when something has gone sideways, and once on a Friday afternoon with go-live the following month. The first two weeks always decide how the rest goes. Either you earn the trust to make decisions, or you spend the project defending decisions somebody else made for you.

Nobody hands you a plan for those two weeks. The statement of work describes what the client is buying. It doesn't tell you who really owns the identity provider, why the last vendor left, or that a security review takes six weeks to book.

This is the playbook I use. It comes from agency work on AEM and digital experience platforms, but little of it is AEM-specific: a day-by-day plan, the questions I ask, the artefacts I produce, the mistakes I've stopped making, and where AI genuinely helps in 2026.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **Week 1 is for listening, week 2 is for shaping.** Don't propose a target architecture until you've interviewed the people who will live with it.
- **Raise every access request on day one.** Adobe Admin Console, Cloud Manager, repositories and analytics all have lead times, and they sit on the critical path more often than any technical question.
- **Write the non-functional requirements down with numbers.** "Fast" and "accessible" aren't requirements. "LCP ≤ 2.5 s at the 75th percentile" and "WCAG 2.2 AA" are.
- **Make a few decisions visible.** One C4 context diagram, three to five Architecture Decision Records and a RAID log do more than a 60-page document.
- **Spike the riskiest assumption in week 2,** not in sprint 4.
- **End with a readout,** not a document drop: what we heard, what we decided, what we need from you.
- **AI speeds up reading and drafting.** It doesn't do the listening, and it doesn't own the decisions.

## Why the first two weeks matter

On most agency projects the architect arrives after the sale. Scope, budget and often the timeline already exist. Your job in the first fortnight is to find the gap between what was sold and what's true, while that gap is still cheap to close.

Three things are at stake:

1. **Trust.** Client IT teams have seen agencies come and go. They judge you on whether you listen, whether you understand their constraints, and whether you're honest about what you don't know yet.
2. **Decisions.** Early choices (hosting model, authoring approach, integration patterns, environments) are the expensive ones to reverse. Richards and Ford's first law of software architecture is that everything is a trade-off. Early decisions lock in their trade-offs for years, so make them deliberately and write the trade-offs down.
3. **Momentum.** The development team will start sprint 1 whether you're ready or not. Without an architecture runway, they'll make the decisions themselves, one ticket at a time.

![Timeline of a solution architect's first ten working days, week 1 listen and map, week 2 shape]({{ '/assets/img/blog/solution-architect-first-two-weeks/01-ten-day-timeline.svg' | relative_url }}){: width="1200" height="660" loading="lazy" decoding="async"}

## Week 1: listen and map

### Day 1: access and reading

The most useful thing I do on day one is raise access requests: all of them, before I know whether I'll need them. In my experience lead times range from an hour to several weeks, and the long ones always involve a security team in another time zone.

| Access | Usually granted by | Why it's slow |
|---|---|---|
| Adobe Admin Console product profiles | Client system administrator | Often one named admin, frequently on leave |
| Cloud Manager (Business Owner, Deployment Manager, Developer) | Client system administrator | Needs the right product profile, not just an AEM login |
| Repositories (Cloud Manager Git, GitHub, Azure DevOps) | Client IT or previous vendor | Licence seats, SSO onboarding, handover politics |
| Analytics and tag manager | Marketing operations | Data protection approval |
| VPN, client laptop, CDN and log consoles | Security and infrastructure | Device compliance, "read-only for vendors" exceptions |

Track each request with a date and an owner, and chase daily. When access blocks you in week 3, the tracker turns "the agency is slow" into a dated fact.

Then read, in this order: the **SOW** and change requests (especially the assumptions section, where risk was quietly parked during the sale); the **RFP and our proposal** (the differences between them are often more interesting than either); the **BRD or backlog** for volume and themes; and any **existing architecture documentation**, assuming it's out of date.

Finish with a first stakeholder map and 30 minutes with the delivery lead. You'll spend more time with them than with anyone, so agree early how you'll handle estimates, risks and client communication together.

### Days 2–3: stakeholder interviews

I aim for eight to twelve interviews of 45 minutes over two or three days.

| Stakeholder | What I need from them |
|---|---|
| Business owner or sponsor | Outcomes, success measures, hard dates, what failure looks like |
| Marketing and digital | Campaign cadence, personalisation ambitions, channels, current pain |
| Authors and content operations | How content is really produced, approvals, volumes, languages, workarounds |
| IT and enterprise architecture | Standards, approved technologies, integration patterns, who signs off |
| Security | Policies, review lead times, pen-test expectations, identity and SSO |
| Infrastructure and operations | Hosting, CDN, DNS, monitoring, who runs it after go-live |
| Data and analytics | Tracking, consent, data layer, CDP, reporting dependencies |
| Legal and compliance | Data residency, privacy (GDPR, India's DPDP Act), accessibility obligations |

Three rules I learned the hard way. **Interview authors, not just their managers:** the manager describes the process, the author shows you the spreadsheet they use because the process doesn't work. **Ask about the last project:** "what went wrong last time?" reveals more constraints than "what are your requirements?" **Don't solution in the room:** when you catch yourself saying "we could just…", write it down for week 2. Every unanswered question goes into a question log with an owner and a date.

### Day 4: current-state discovery

Turn what you heard into an inventory:

- **Systems:** CMS, DAM, commerce, search, CRM, CDP, PIM, identity provider, CDN, analytics, consent. Version, owner, hosting, contract end date.
- **Integrations:** direction, protocol, authentication, frequency, and who owns the other end.
- **Traffic:** page views, peaks, geography, cache hit ratio. Real numbers from analytics or CDN logs, not "about a million a month".
- **Content volume:** sites, languages, pages, assets, templates, components, and how much is actually maintained.
- **Pain points:** the top ten, ranked by the people who feel them.

If a codebase exists, get an hour with whoever knows it best. It can save a week of reading.

### Day 5: NFRs, RAID and the playback

NFRs are where agency projects most often go wrong, because nobody writes them down until a load test fails. I draft them on day 5 with a number on every line, even a provisional one.

| Area | A usable NFR | Anchor |
|---|---|---|
| Performance | LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 at the 75th percentile, mobile | Core Web Vitals |
| Availability | 99.9% monthly for publish; author maintenance windows agreed | Client and platform SLAs |
| Scalability | 3× normal peak during the main campaign | Last year's analytics |
| Security | SSO for all authors; pen test before go-live | Client security policy |
| Accessibility | WCAG 2.2 Level AA for every template and component | Legal obligation, client policy |
| SEO | URL parity or a complete 301 map | SEO team |
| Data residency | Personal data stored and processed in a named region | Legal, DPO |

Accessibility in particular changes how you build components, so it has to be stated at the start. More on that in [Accessibility on AEM: fix the component, not the page](/blog/2026/11/accessibility-on-aem-fix-the-component-not-the-page/).

Start the **RAID log** the same day: risks, assumptions, issues and dependencies, each with an owner and a date. Watch the assumptions column. Every assumption in the SOW belongs there until someone confirms it.

End the week with a 30-minute playback: "Here's what we heard. Here's what we think is true. Tell us where we're wrong." It's the cheapest correction mechanism I know, and it shows you listened.

## Week 2: shape

### Day 6: draw the context

I draw one diagram first: a system context diagram from Simon Brown's C4 model. Your system as a single box, the people who use it, and the systems it talks to. Nothing else.

It sounds too simple. Getting client IT to agree on one picture of the boundary flushes out most integration surprises: the CRM nobody mentioned, the legacy search appliance, the translation vendor pushing XML over SFTP. If there's time, sketch a container diagram (CDN, delivery tier, author, integration layer) and stop there.

Review it with client IT the same day, as a draft that invites corrections. That review is often when they start treating you as a colleague rather than a vendor.

### Day 7: write the key decisions as ADRs

By now three to five big decisions are visible. On AEM projects they're usually things like: AEM as a Cloud Service with traditional delivery, Edge Delivery Services or headless (my framework is in [Composable, headless or traditional AEM](/blog/2026/11/composable-headless-or-traditional-aem-decision-framework/)); Universal Editor or document-based authoring; one codebase for many sites or one per brand; and where integrations live.

Each goes into an Architecture Decision Record, the format Michael Nygard proposed in 2011. His argument still holds: small, modular documents have a chance of being kept up to date. Martin Fowler's more recent write-up gives the same advice: about a page each, stored in the repository next to the code, numbered, and never edited once accepted. A changed decision gets a new ADR that supersedes the old one.

The template I use, close to Nygard's original:

```markdown
# ADR-003: Use Edge Delivery Services for marketing pages

Status: Proposed | Accepted | Superseded by ADR-0xx
Date: 2026-11-10
Deciders: <client architect>, <agency SA>, <product owner>

## Context
The forces at play: goals, constraints, NFRs, skills, licences, deadlines.
Facts, not opinions.

## Options considered
1. Option A: what it is, main pros and cons
2. Option B: ...

## Decision
We will ... (active voice, one paragraph)

## Consequences
Positive, negative and neutral. What gets easier, what gets harder,
and the follow-up tickets or RAID entries.
```

The "Deciders" line matters more than the format: an ADR the client never agreed to is just an opinion with a number. Write them as Proposed in week 2 and get them accepted at the readout.

### Day 8: spike the riskiest assumption

Pick the assumption in the RAID log that would hurt most if wrong, and prove or disprove it with a prototype timeboxed to two days. Spikes I've run in week 2:

- Can the product API serve the listing page within the performance budget, or do we need a cache layer?
- Will the client's identity provider federate with Adobe IMS the way we assumed?
- Does the chosen authoring approach work for the authors we interviewed on day 2?

The output is a one-page note: what we tested, what happened, what it means. Occasionally it changes the estimate, which is exactly why you want it in week 2.

Then settle what sprint 1 needs: which **environments** exist and who can deploy to each; a **branching** model (trunk-based with short-lived branches is my default); and the **quality gates** that block a merge or a deployment. On AEM as a Cloud Service much of this is shaped by Cloud Manager, which I cover in [Cloud Manager pipelines, quality gates, RDEs and the config pipeline](/blog/2026/11/aem-cloud-manager-pipelines-quality-gates-rde-config-pipeline/).

### Day 9: definition of done, runway and estimates

**Put NFRs in the definition of done.** If accessibility, performance and security aren't there, they become a phase at the end, and phases at the end get cut.

```text
A story is done when:
- Merged to main with the pipeline and quality gates green
- Unit tests meet the agreed threshold
- Passes automated accessibility checks plus a keyboard and screen reader check
- Stays within the performance budget on the agreed test pages
- Authoring tested by someone other than the developer
- ADRs updated if the story changed a decision
- Demonstrated to the product owner on dev
```

**Build the architecture runway.** The Scaled Agile Framework defines it as the existing code, components and infrastructure that let teams deliver near-term features with little rework or waiting. You don't need SAFe to use the idea. For sprint 1 it's the project skeleton, working environments and pipelines, a base component pattern, the front-end build and the first integration stub, each as a backlog item with an owner.

**Sense-check estimates with the delivery lead.** By day 9 you know things the sales estimate didn't: new integrations, NFRs that add work, assumptions that proved false. Agree privately what goes to the client as a risk, what becomes a change request and what the team absorbs, so nobody is surprised at the readout. More in [How to estimate an AEM project](/blog/2026/11/how-to-estimate-an-aem-project/).

### Day 10: the readout

Sixty minutes with the sponsor, client IT and the core team, about ten slides: what we heard, current state on a page, the context diagram, key decisions and their status, NFRs, the top five risks, what the spike showed, how we'll build and release, what sprint 1 delivers, and **the asks**. The asks slide matters most: name the person, the decision and the date.

## The deliverables, and why so few

| Artefact | Format | Size |
|---|---|---|
| Stakeholder map | Slide or diagram | 1 page |
| Interview notes and question log | Shared tracker | Living |
| Systems and integrations inventory | Spreadsheet | Living |
| NFRs with numbers | Wiki or repository | 1–2 pages |
| RAID log | Tracker | Living |
| C4 context (and maybe container) diagram | Diagram as code or shared tool | 1–2 diagrams |
| ADRs and spike note | Markdown in the repository | 1 page each |
| Environments, branching, definition of done | Repository or team board | 1–2 pages |
| Readout | Slides | About 10 |

If the client later needs a fuller architecture document, I use arc42 as the skeleton. What you already have maps straight onto its twelve sections: the context diagram into section 3 (context and scope), ADRs into section 9 (architecture decisions), NFRs into section 10 (quality requirements) and RAID risks into section 11 (risks and technical debt). You fill it progressively instead of writing it in one go.

### Interview questions I reuse

- What does success look like 12 months after go-live, and how will you measure it?
- What's the one thing that must not go wrong?
- What happened on the last project like this?
- Walk me through how content goes from idea to published. Where does it get stuck?
- Which systems must this talk to, who owns them, and how fast do they respond to change?
- What security, privacy or accessibility reviews do we need, and how long do they take to book?
- Who signs off the architecture, and who can say no late in the project?
- Who else should I talk to?

### First-two-weeks checklist

- [ ] Access requests raised on day 1 and tracked
- [ ] SOW, RFP, proposal and existing docs read; assumptions listed
- [ ] 8–12 interviews, including real authors; question log running
- [ ] Inventory, traffic and content volumes from real data
- [ ] Draft NFRs with numbers; RAID log started
- [ ] Week 1 playback held
- [ ] C4 context diagram reviewed with client IT
- [ ] 3–5 ADRs in the repository
- [ ] Spike on the riskiest assumption, written up
- [ ] Environments, branching and definition of done agreed
- [ ] Sprint 1 runway in the backlog; estimate deltas agreed with the delivery lead
- [ ] Readout held, with named asks and dates

## What not to do

**Don't redesign everything.** You'll find plenty wrong with the current platform. Most of it doesn't matter for this project. Fix what blocks the outcome and log the rest as technical debt.

**Don't write a 60-page document nobody reads.** I've done it. It took two weeks, was out of date in four, and nobody opened it after sign-off. Short ADRs, one or two diagrams and a living RAID log get read because they're small and they change.

**Don't promise dates before discovery.** When a sponsor asks on day 3 whether March still works, the honest answer is "I'll tell you on day 10, and here's what I need to find out first." Then tell them on day 10.

**Don't treat client IT as an obstacle.** They'll run this after you leave. Their standards are constraints to design for, not hurdles to argue past.

## The soft skills that make it work

### Building trust with client IT

Ask for their help, then show you used it. Share diagrams as drafts and incorporate corrections visibly. Credit them in the readout. Be explicit about what you don't know: "I haven't looked at the search integration yet, so treat this as a guess" builds more credibility than a confident answer that's wrong in week 4.

### Saying no

Someone will ask for something that doesn't fit: out-of-scope features, a clashing technology, a date the evidence doesn't support. What works for me:

- **Separate the need from the request.** "We need an app" is often "authors need to publish from their phones".
- **Say what it would take,** not just no: "We can, if we drop X or raise a change request."
- **Write it down** as an ADR or RAID entry, so a corridor argument becomes a recorded decision.
- **Escalate through the delivery lead,** never around them.

Gregor Hohpe's image of the architect riding the elevator between the engine room and the penthouse fits agency life well. In one week you'll explain CDN caching to a developer and explain to a sponsor why the date moves. Both need the same honesty in different words.

## How AI helps in 2026, and where it doesn't

I use AI assistants throughout the first two weeks for the mechanical parts, which leaves more time for conversations.

| Task | How AI helps | Caveat |
|---|---|---|
| Reading SOW, RFP, BRD, old docs | Summaries, assumption lists, contradictions between documents | Check claims against the source; summaries drop the clause that matters |
| Interview notes | Themes, actions and RAID candidates from transcripts | Get consent to record; some clients forbid it |
| Codebase exploration | Mapping modules, integrations, hard-coded hosts and schedulers in hours | It finds what's there, not why; confirm with the people who wrote it |
| Diagrams and ADRs | First drafts of C4 diagrams as code (Structurizr DSL, PlantUML, Mermaid) and ADR text | Plausible and subtly wrong; review with client IT, and own the decision |

Two caveats override that table. **Data handling:** check the client's policy before pasting a contract, codebase or interview notes into any tool. Many allow only approved enterprise tools; some allow none on their code. Ask in week 1. **Confidence isn't evidence:** a summary saying "the system has no external dependencies" is a hypothesis to verify, not a fact for the readout.

## FAQ

**What if I join a project that's already months in?**
Compress week 1 into three or four days and spend more of it on what's been decided and why. Write retrospective ADRs for the big past decisions so the team has a record, then point week 2 at the riskiest open question rather than revisiting everything.

**Do I really need ADRs on a small project?**
Yes, just fewer. Even a three-month build has two or three decisions someone will question later. A one-page ADR takes an hour and saves a meeting every time the question returns.

**Should the readout include estimates?**
Include estimate deltas and risks, agreed with the delivery lead beforehand. Estimates are a joint position between delivery and architecture, not something the architect presents alone.

**How do I get NFRs when the client says "just make it fast"?**
Propose numbers and ask them to disagree. Core Web Vitals give defensible performance targets, WCAG 2.2 AA is the usual accessibility baseline, and last year's analytics give a peak load. People adjust a number far more easily than they invent one.

**C4 or arc42: do I need both?**
They solve different problems. C4 is a way to draw diagrams at consistent levels of detail; arc42 is a template for organising architecture documentation. C4 diagrams slot neatly into arc42's context, building block and deployment sections.

## Closing thought

The first two weeks aren't about producing architecture. They're about earning the right to make architecture decisions with the client rather than for them. Listen properly in week 1, make a handful of decisions visible in week 2, and leave the team a runway they can build on from sprint 1.

Most struggling projects I've seen didn't fail on a bad technical choice. They failed because nobody wrote down the assumption that proved false, or nobody asked an author how they actually work. Two disciplined weeks fix most of that.

Starting a new AEM or digital experience project and want a second pair of eyes on the first fortnight? [Get in touch](/contact/).

### References

- [The C4 model for visualising software architecture](https://c4model.com/) (Simon Brown)
- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) (Michael Nygard, Cognitect)
- [Architecture Decision Record](https://martinfowler.com/bliki/ArchitectureDecisionRecord.html) (Martin Fowler)
- [Lightweight Architecture Decision Records](https://www.thoughtworks.com/radar/techniques/lightweight-architecture-decision-records) (Thoughtworks Technology Radar)
- [arc42 overview](https://arc42.org/overview) (arc42)
- [Fundamentals of Software Architecture, 2nd edition](https://www.oreilly.com/library/view/fundamentals-of-software/9781098175504/) (Mark Richards and Neal Ford, O'Reilly)
- [The Software Architect Elevator](https://www.oreilly.com/library/view/the-software-architect/9781492077534/) (Gregor Hohpe, O'Reilly)
- [Architectural Runway](https://framework.scaledagile.com/architectural-runway) (Scaled Agile Framework)
- [AEM as a Cloud Service onboarding journey](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/onboarding/journey/overview) (Adobe Experience League)
- [Web Vitals](https://web.dev/articles/vitals) (Google, web.dev)
- [Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/) (W3C)

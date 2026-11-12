---
layout: post
title: "Making your AEM site agent-ready: structured content, Schema.org, NLWeb and WebMCP"
seo_title: "Agent-Ready AEM Sites: Structured Content, NLWeb and WebMCP"
description: "How to prepare an AEM or Edge Delivery Services site for AI agents that query and act, not just read: structured content, Schema.org, NLWeb, MCP, WebMCP and security."
ai_summary: "AI search cites pages; AI agents query sites and take actions. For AEM teams the durable preparation is unglamorous: structured content in Content Fragments, accurate Schema.org JSON-LD, semantic and accessible HTML, stable URLs, and forms that work without JavaScript tricks. On top of that sit emerging protocols with very different maturity: MCP is widely supported, NLWeb is an open-source reference implementation from Microsoft, WebMCP is a draft W3C community group report in a Chrome origin trial, and A2A is for agent-to-agent systems rather than websites. The post separates what to do now, next and what to watch, and covers prompt injection, rate limits and measuring agent traffic."
date: 2026-11-12 12:00:00 +0530
category: seo-ai-search
tags: [AI agents, Structured content, Schema.org, NLWeb, WebMCP, MCP, AEM as a Cloud Service, Edge Delivery Services]
---

For the past two years the AI conversation on AEM projects has been about visibility: will ChatGPT, Perplexity or Google's AI Overviews cite our pages? I've written about that in [SEO vs GEO]({{ '/blog/2026/10/seo-vs-geo-making-your-site-visible-in-ai-search/' | relative_url }}) and in [llms.txt, AI crawlers and robots.txt]({{ '/blog/2026/11/llms-txt-ai-crawlers-robots-txt-what-to-allow/' | relative_url }}).

The question clients now ask is different. **What happens when an AI agent doesn't just read our site, but uses it?** It asks the store locator for the nearest branch, compares three products, checks availability, fills in the contact form, books the test drive. Agents in browsers and assistants can already attempt this by reading the page like a person would. A new set of protocols promises to make it reliable.

This post is my architect's view of what that means for an AEM or Edge Delivery Services site: **which standards are real, which are early, and what you should actually change in your content model, markup and platform.** The short version is that most of the useful work is the same work that makes a site good for people and search engines, done more rigorously.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **Agents move from citing to querying to acting.** Each step needs more from your site: readable pages, then structured answers, then actions with clear inputs and outcomes.
- **MCP is the real, widely supported layer** for connecting AI applications to tools and data. It matters to websites mainly through the protocols built on it.
- **NLWeb** (Microsoft, announced May 2025) turns Schema.org and RSS data you already publish into a natural-language endpoint, and every instance is also an MCP server. It's an open-source reference implementation with proof-of-concept sample code, not a product.
- **WebMCP** lets a page expose "tools" to agents in the browser, either with JavaScript (`document.modelContext.registerTool`) or declaratively with `toolname` and `tooldescription` attributes on forms. It's a **draft W3C community group report** and a Chrome origin trial. Experiment, don't depend on it.
- **A2A** is for agents talking to agents, not for websites. **AGENTS.md** is for coding agents in your repository, not for visitors.
- **For AEM, the durable preparation is structured content:** Content Fragments with good models, delivered through the Content Fragment Delivery OpenAPI or GraphQL persisted queries, plus accurate Schema.org JSON-LD on every important page.
- **Semantic, accessible HTML is agent-readable HTML.** Labelled forms, real buttons and clear headings help screen readers and agents for the same reasons.
- **Treat agents as untrusted clients.** Prompt injection through content and user-generated text, rate limits, and confirmation for consequential actions are part of the design.

## From citing to querying to acting

It helps to separate three levels of agent interaction, because they need different things from you and they're at very different stages of maturity.

![Three levels of agent interaction with a website: read and cite, query, and act, with what each needs from an AEM site and how mature the supporting standards are]({{ '/assets/img/blog/agent-ready-aem/01-read-query-act.svg' | relative_url }}){: width="1200" height="620" loading="lazy" decoding="async"}

**Read and cite.** An AI crawler or search engine fetches pages and uses them to answer questions. This is GEO territory: crawl access, rendering, clear answers, trust signals. It's mature and it's where most of your AI traffic comes from today.

**Query.** An agent asks your site a question and expects a structured answer: "which of your savings accounts has no monthly fee?" Today it usually does this by reading several pages. Protocols like NLWeb, or a content API exposed through MCP, let it ask directly and get JSON back.

**Act.** An agent completes a task: submits an enquiry, books an appointment, adds to basket. Agents in browsers already try this by clicking through pages, which is fragile. WebMCP proposes a contract: the page declares which actions exist, what inputs they take and what they do.

Most organisations should be solid at level one, preparing level two, and experimenting at level three. The rest of this post follows that order.

## The protocol landscape, honestly labelled

Every vendor deck now has a slide with these acronyms. Here's what each one is and how much weight I'd put on it in November 2026.

| Standard | What it is | Who's behind it | Status | Relevance to your website |
|---|---|---|---|---|
| **MCP** (Model Context Protocol) | Open protocol for connecting AI applications to data sources and tools | Open source; supported by Claude, ChatGPT, VS Code, Cursor and many others | **Real and widely adopted** | Indirect: the transport that NLWeb and WebMCP build on or map to, and how you'd expose a content API to agents |
| **NLWeb** | Open protocols and a reference implementation that turn Schema.org and RSS data into a natural-language "ask" interface returning Schema.org JSON | Microsoft; created by R.V. Guha (creator of RSS and Schema.org) | **Early:** sample code is described as proof of concept | Medium: a way to let agents query your content, built on data you should publish anyway |
| **WebMCP** | Browser API for pages to expose tools to agents: imperative (`registerTool`) and declarative (form attributes) | Google and Microsoft, via the W3C Web Machine Learning Community Group | **Pre-standard:** draft community group report; Chrome origin trial | High in future, low today: the most direct route to reliable agent actions on your pages |
| **A2A** (Agent2Agent) | Protocol for agents to coordinate with other agents | Announced by Google in April 2025; donated to the Linux Foundation in June 2025 | **Real, different problem** | Low for websites; relevant if you build agents for customer service or operations |
| **AGENTS.md** | A file in a repository that tells AI coding agents how to work on the project | Open convention; adopted by Adobe for AEM and EDS projects | **Real** | None for visitors; useful for your developers |
| **llms.txt** | A Markdown file listing the content you'd like language models to read | Community proposal | **Inconsistent support** | Covered in my [llms.txt post]({{ '/blog/2026/11/llms-txt-ai-crawlers-robots-txt-what-to-allow/' | relative_url }}) |

Two things stand out. First, **none of the website-specific standards is finished.** Second, **all of them reward the same foundations:** structured data, clear semantics and well-defined actions. That's the part you can invest in without betting on a winner.

### MCP in one paragraph

The [Model Context Protocol](https://modelcontextprotocol.io/docs/getting-started/intro) is an open standard for connecting AI applications to external systems. Its own documentation compares it to a USB-C port for AI. An MCP server exposes tools, resources and prompts; a client such as Claude or ChatGPT connects to it. For a website owner, MCP matters in two ways: it's how you'd offer a structured content or search API to agents, and it's the model that NLWeb instances and WebMCP tools map onto.

### NLWeb

[NLWeb](https://news.microsoft.com/source/features/company-news/introducing-nlweb-bringing-conversational-interfaces-directly-to-the-web/) was announced by Microsoft on 19 May 2025. The idea is simple and, for AEM teams, encouraging: it uses the **Schema.org and RSS data sites already publish**, loads it into a vector store, and answers natural-language questions through an `ask` method that returns Schema.org-shaped JSON. Microsoft's announcement says "every NLWeb instance is also a Model Context Protocol (MCP) server", so agents can query it without custom integration.

The [GitHub repository](https://github.com/nlweb-ai/NLWeb) is honest about maturity: it calls itself a reference implementation, describes its samples as proof-of-concept, and lists cloud deployment options as "coming soon". Early adopters named in the announcement include Shopify, Tripadvisor, Eventbrite and O'Reilly Media.

My take: **don't deploy NLWeb because of NLWeb. Publish excellent Schema.org data, because NLWeb, search engines and AI answers all use it.** If a client has a large catalogue or content library and wants a conversational search pilot, NLWeb is a reasonable open-source starting point to evaluate alongside commercial site-search products.

### WebMCP

[WebMCP](https://webmachinelearning.github.io/webmcp/) is the one to watch for actions. Edited by engineers from Microsoft and Google, it's published as a **Draft Community Group Report** by the W3C Web Machine Learning Community Group, which means it isn't on the W3C Recommendation track yet. It defines two approaches:

- **Imperative:** JavaScript registers tools on `document.modelContext` with a name, description, input schema and a function to run. Early previews used `navigator.modelContext`; the current draft uses `document.modelContext`, which tells you how much the API is still moving.
- **Declarative:** Chrome's [declarative API](https://developer.chrome.com/docs/ai/webmcp/declarative-api) turns an ordinary HTML form into a tool with two attributes:

```html
<form toolname="requestCallback"
      tooldescription="Asks a mortgage adviser to call the user back within one working day."
      action="/content/bank/en/contact/callback">
  <label for="cb-name">Name</label>
  <input id="cb-name" name="name" autocomplete="name" required>

  <label for="cb-phone">Phone number</label>
  <input id="cb-phone" name="phone" type="tel" autocomplete="tel" required
         toolparamdescription="UK phone number, including area code">

  <label for="cb-time">Best time to call</label>
  <select id="cb-time" name="time">
    <option>Morning</option><option>Afternoon</option><option>Evening</option>
  </select>

  <button type="submit">Request a call back</button>
</form>
```

When an agent invokes the tool, Chrome focuses the form and fills it in, visibly. Unless the form has `toolautosubmit`, **the user still presses submit.** Browsers that don't support WebMCP ignore the attributes and the form works as normal. Chrome describes the declarative API as being in an origin trial and "under active discussion".

The declarative design is good news for AEM teams. It means **well-built forms with proper labels are most of the work**, and the attributes can be added from a component's dialog or block configuration later.

### A2A and AGENTS.md

[A2A](https://developers.googleblog.com/en/google-cloud-donates-a2a-to-linux-foundation/) solves a different problem: agents from different vendors coordinating with each other. It's important if you build a customer-service agent that hands off to a booking agent, but your website doesn't need to speak it. AGENTS.md is for coding agents working in your repository; Adobe now uses it in AEM and Edge Delivery Services projects. Neither changes what your visitors' agents see.

## What this means for an AEM site

Here's how I map the foundations onto an AEM as a Cloud Service or Edge Delivery Services platform.

![The agent-ready stack on AEM: structured content in Content Fragments, delivery as HTML with JSON-LD and as content APIs, agent interfaces from llms.txt to NLWeb and WebMCP, and controls for security, rate limits and measurement]({{ '/assets/img/blog/agent-ready-aem/02-agent-ready-stack.svg' | relative_url }}){: width="1200" height="640" loading="lazy" decoding="async"}

### 1. Structured content first

Agents answer questions from facts, and facts live best in structured content. On AEM that means **Content Fragments with well-designed Content Fragment Models**: a product, branch, rate, event or FAQ is a fragment with typed fields, not a paragraph of rich text inside a page.

This is the same decision I discuss in the [composable, headless or traditional AEM framework]({{ '/blog/2026/11/composable-headless-or-traditional-aem-decision-framework/' | relative_url }}). Agent readiness adds a new reason to model the content that matters as data, even on a site rendered as pages:

- **Model facts, not layouts.** "Interest rate", "minimum deposit", "opening hours" as fields with types and units, not "teaser text 2".
- **One source of truth.** The same fragment feeds the page, the JSON-LD and any API, so an agent can't get a different answer from each.
- **Dates and validity.** Add "valid from" and "valid until" fields for prices and offers. Stale facts are worse for agents than missing ones, because they act on them.

AEM as a Cloud Service offers two ways to deliver that content as data, according to [Adobe's API overview](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/headless/apis-headless-and-content-fragments):

| API | Shape | Best for |
|---|---|---|
| **Content Fragment Delivery with OpenAPI** | REST, JSON, path-based, optimised for CDN delivery | Simple, cacheable access to fragments; an easy base for an MCP or NLWeb data feed |
| **GraphQL with persisted queries** | Schema from Content Fragment Models; clients request only the fields they need | Precise queries across related fragments; Adobe recommends persisted queries for production because they're cached |

The older Content Fragment support in the Assets HTTP API is deprecated, so don't build new integrations on it. GraphQL on AEM is read-only; management goes through the separate Content Fragment OpenAPIs, and agents should never get write access to those.

### 2. Schema.org JSON-LD that matches the page

Schema.org is the vocabulary that search engines, AI answers and NLWeb all read. For most AEM sites the gap isn't whether JSON-LD exists, it's whether it's **complete and correct**: an `Organization` on every page and very little else.

Generate it from the same source as the visible content. On AEM Sites, a page component or a Sling Model can emit JSON-LD from page properties and fragment fields. On Edge Delivery Services, the metadata block and the page's own content can drive a small script in the `head` or a server-side step. A product-like example:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FinancialProduct",
  "name": "Everyday Saver",
  "url": "https://www.example.com/en/savings/everyday-saver",
  "description": "Instant-access savings with no monthly fee.",
  "interestRate": { "@type": "QuantitativeValue", "value": 4.1, "unitText": "AER %" },
  "feesAndCommissionsSpecification": "No monthly fee",
  "provider": { "@type": "BankOrCreditUnion", "name": "Example Bank" }
}
</script>
```

Rules I hold teams to:

- **Only mark up what's visible on the page.** Hidden or contradictory markup erodes trust with search engines, and agents acting on it will make mistakes in your name.
- **Use the most specific type** that fits (`Product`, `Offer`, `Event`, `LocalBusiness`, `FAQPage`, `HowTo`, `FinancialProduct`), with prices, currencies, availability and opening hours as structured values.
- **Generate, don't hand-write.** JSON-LD typed into a rich-text field goes stale on the next price change.
- **Validate in the pipeline.** Run the Schema.org validator or Google's Rich Results Test on key templates as part of release checks.

### 3. Semantic, accessible HTML is agent-readable HTML

Agents that operate a browser rely on the same structure as assistive technology: headings that describe sections, links with meaningful text, buttons that are buttons, inputs with labels, errors announced next to the field. The WebMCP declarative API even falls back to a field's `<label>` when no parameter description is given.

So the work from my [accessibility post]({{ '/blog/2026/11/accessibility-on-aem-fix-the-component-not-the-page/' | relative_url }}) pays twice: **fix the component, not the page**, and both screen readers and agents benefit on every page that uses it. On AEM, prioritise the form components, navigation, accordions and tabs, and any custom block that hides content behind JavaScript-only interactions.

### 4. Stable URLs and canonical answers

Agents remember and reuse URLs, and AI answers cite them. Keep URLs stable, redirect when they change, and keep one canonical page per product, location or answer. Duplicate pages per campaign and per market with slightly different facts confuse agents more than they confuse search engines. The fundamentals in [what actually matters in SEO]({{ '/blog/2026/11/what-actually-matters-in-seo/' | relative_url }}) apply directly.

### 5. Forms and actions designed for delegation

Before any WebMCP attribute, review your key journeys as if a careful assistant were completing them for a customer:

- **Can the form be completed in one place,** with clear required fields and formats, or does it depend on hover menus, drag-and-drop or multi-step JavaScript widgets?
- **Is the outcome explicit?** A confirmation message and reference number, not just a page change.
- **Are consequential actions confirmable?** Payment, cancellation and data changes should require a clear human confirmation step, which is also what WebMCP's security section expects.
- **Do errors say what to fix** in text next to the field?

AEM Forms and EDS forms can meet all of these. The ones that don't are usually the same ones with poor accessibility and conversion rates.

## Security: treat agents as untrusted clients

Agent access widens the attack surface in ways content teams aren't used to.

**Prompt injection through your own content.** If an agent reads text from your page and treats it as instructions, then anything on that page is a potential command: product reviews, comments, forum posts, even a compromised marketing banner. The WebMCP draft lists prompt injection as a key threat, including poisoned tool descriptions and malicious tool outputs. For AEM teams:

- Keep user-generated content clearly separated and marked up as such, and moderate it.
- Never put instructions to agents in hidden text. It's indistinguishable from an attack and may break search guidelines.
- Review tool descriptions (WebMCP) and API descriptions (MCP) with the same care as legal copy.

**Rate limits and caching.** Agents query more and in less predictable patterns than people. On AEM as a Cloud Service, use [traffic filter rules and rate limits in cdn.yaml]({{ '/blog/2026/11/aem-cloud-service-cdn-yaml-headers-proxy-redirects/' | relative_url }}) for APIs and search endpoints, and cache structured responses at the CDN. Persisted GraphQL queries and the Delivery OpenAPI are designed for that.

**Authenticated actions.** Anything behind a login stays behind your existing authentication. Agents acting for a signed-in user should go through the same consent and session controls as the user, with confirmation for anything irreversible. Don't create special "agent" back doors.

**Least privilege for APIs.** Expose read-only, published content to agents. Management APIs and author endpoints are never part of an agent integration.

## Measuring agent traffic

You can't manage what you can't see, and most analytics tools don't count agents that never run your tags.

- **CDN logs are the source of truth.** On AEMaaCS, forward CDN logs and break traffic down by user agent: search crawlers, AI crawlers, AI assistants fetching on a user's behalf, and browser-based agents (which often look like ordinary browsers).
- **Watch the request mix.** Agents fetch JSON-LD-rich pages, sitemaps, `llms.txt` and APIs more than people do. A rise in API or search-endpoint traffic without a matching rise in sessions is a signal.
- **Track outcomes, not just hits.** For forms, record whether submissions were agent-invoked. WebMCP's declarative API exposes an `agentInvoked` flag on the submit event for exactly this.
- **Referrals.** AI assistants increasingly send visitors with identifiable referrers. Segment them in analytics, as covered in my GEO post.

## A readiness checklist

{: .checklist}
- Key facts (products, prices, locations, rates, events, FAQs) live in Content Fragments with typed fields, not in rich text.
- Each fact has one source of truth feeding the page, JSON-LD and any API.
- Every important template outputs specific, valid Schema.org JSON-LD generated from content, matching what's visible.
- Prices, offers and availability carry validity dates and are never stale on publish.
- Content is available as data through the Content Fragment Delivery OpenAPI or GraphQL persisted queries, read-only and CDN-cached.
- Pages render meaningful HTML without JavaScript for the main content.
- Headings, links, buttons and form labels pass an accessibility check at component level.
- Key forms work in a single, labelled flow with explicit confirmations and inline error messages.
- Consequential actions require a human confirmation step.
- Canonical URLs are stable, with redirects for every change.
- User-generated content is separated, moderated and never treated as instructions.
- Rate limits protect APIs, search and form endpoints at the CDN.
- CDN logs are forwarded and agent traffic is reported separately from human traffic.
- One owner is accountable for "agent readiness" across content, platform and analytics.

## Roadmap: now, next, watch

**Now (this quarter).** Do the work that pays off with or without agents:

1. Audit Schema.org coverage on your top 20 templates and fix the gaps from content, not by hand.
2. Identify the five most-asked factual questions customers have and make sure each has a structured, canonical answer.
3. Fix the accessibility of your key forms and navigation components.
4. Start reporting AI crawler and agent traffic from CDN logs.

**Next (6–12 months).** Expose structured content deliberately:

1. Move the facts that matter into Content Fragment Models if they aren't already.
2. Offer a read-only, cached content API for them, and decide whether to wrap it as an MCP server for partners or assistants.
3. Pilot conversational search over that data, evaluating NLWeb alongside your current site-search vendor.
4. Add `toolname` and `tooldescription` to one or two low-risk forms (a newsletter, a call-back request) behind a feature flag, and measure agent-invoked submissions.

**Watch (don't build on yet).**

- WebMCP moving from community group draft to a standards-track specification and shipping beyond an origin trial.
- Agent identity and authentication standards for acting on a signed-in user's behalf.
- Adobe's own agent capabilities in AEM. I map the current state in [AI in AEM]({{ '/blog/2026/11/ai-in-aem-what-is-real-what-is-useful/' | relative_url }}).
- Whether major assistants prefer NLWeb, site-provided MCP servers, or simply better page understanding.

## FAQ

**Do I need to build an MCP server for my website?**
Not yet, for most sites. Publish good structured data and a clean, cached content API first. An MCP server is a thin layer on top of that when a specific assistant, partner or internal agent needs it.

**Is NLWeb something I install on AEM?**
NLWeb is a separate service: it ingests your Schema.org, RSS or similar feeds into a vector store and answers queries. AEM's role is to publish clean, complete feeds and JSON-LD. Treat it as an experiment; its samples are described as proof of concept.

**Should we add WebMCP attributes to our forms now?**
On one or two low-risk forms, as an experiment, yes. Browsers without support ignore the attributes, so the risk is low. Don't put WebMCP on payments or account changes, and don't promise anything to the business based on an origin-trial API.

**Will agents replace our website traffic?**
For simple factual questions, some of it, as AI answers already do. For considered purchases, complex products and anything that needs trust, agents still send people to the site or act through it. Being the clearest, most reliable source is how you stay in the loop either way.

**Is this different for Edge Delivery Services?**
The principles are identical. EDS gives you fast, simple HTML by default, which helps. You'll implement JSON-LD in metadata or blocks, and you'll still want Content Fragments or another structured source for facts that appear across many pages.

**How does this relate to GEO?**
GEO gets you cited; agent readiness gets you used. The foundations overlap heavily: crawlable pages, structured data, clear answers and trust. Start with my [SEO vs GEO]({{ '/blog/2026/10/seo-vs-geo-making-your-site-visible-in-ai-search/' | relative_url }}) post if you haven't done that work.

## Closing thought

There's a lot of noise about the "agentic web", and most of the protocols behind it are months or years from being dependable. But the direction is clear, and the preparation is reassuringly old-fashioned: **model your facts as content, describe them with Schema.org, build accessible components and honest forms, and protect your endpoints.** A site that does that well is better for customers today and ready for whichever agent standard wins.

If you're planning an agent-readiness review for an AEM or Edge Delivery Services site, or deciding what to model as structured content, [get in touch](/contact/).

### References

- [What is the Model Context Protocol?](https://modelcontextprotocol.io/docs/getting-started/intro) (modelcontextprotocol.io)
- [Introducing NLWeb: Bringing conversational interfaces directly to the web](https://news.microsoft.com/source/features/company-news/introducing-nlweb-bringing-conversational-interfaces-directly-to-the-web/) (Microsoft, 19 May 2025)
- [NLWeb repository](https://github.com/nlweb-ai/NLWeb) (GitHub)
- [WebMCP, Draft Community Group Report](https://webmachinelearning.github.io/webmcp/) (W3C Web Machine Learning Community Group)
- [WebMCP declarative API](https://developer.chrome.com/docs/ai/webmcp/declarative-api) (Chrome for Developers)
- [WebMCP updates, clarifications and next steps](https://patrickbrosset.com/articles/2026-02-23-webmcp-updates-clarifications-and-next-steps/) (Patrick Brosset, February 2026)
- [Google Cloud donates A2A to the Linux Foundation](https://developers.googleblog.com/en/google-cloud-donates-a2a-to-linux-foundation/) (Google Developers Blog)
- [AEM APIs for structured content delivery and management](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/headless/apis-headless-and-content-fragments) (Adobe Experience League)
- [AEM GraphQL API for use with Content Fragments](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/headless/graphql-api/content-fragments) (Adobe Experience League)
- [Schema.org](https://schema.org/) and [Rich Results Test](https://search.google.com/test/rich-results) (Google)

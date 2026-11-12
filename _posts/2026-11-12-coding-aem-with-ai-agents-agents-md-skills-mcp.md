---
layout: post
title: "Coding AEM with AI agents: AGENTS.md, Adobe skills and MCP on AEM as a Cloud Service and Edge Delivery Services"
seo_title: "Coding AEM with AI Agents: AGENTS.md, Skills and MCP"
description: "A practical guide to using Claude Code, Cursor, Copilot and Codex on AEM: AGENTS.md, Adobe's agent skills, the AEM and Dispatcher MCP servers, workflows, limits and governance."
ai_summary: "AI coding agents work well on AEM only when they know which AEM they're in: they routinely confuse the Java, JCR and OSGi stack of AEM as a Cloud Service with the plain HTML, CSS and JavaScript of Edge Delivery Services. Adobe now ships the context to fix that: AGENTS.md in the EDS boilerplate, a generated AGENTS.md for Java projects, agent skills in the adobe/skills repository (create-site, content-driven-development and block tools for EDS; create-component, dispatcher, migration and code-assessment for AEMaaCS), a Quickstart MCP server in the AEM SDK and a Dispatcher MCP server in the Dispatcher SDK. The post explains the setup for each stack, gives sample AGENTS.md outlines, a plan, small diff, verify and review workflow, where agents help and where they quietly break things, and how to govern them in a team."
date: 2026-11-12 11:00:00 +0530
category: edge-delivery-services
tags: [AI, AI coding agents, Edge Delivery Services, AEM as a Cloud Service, Developer experience]
---

Give an AI coding agent an Edge Delivery Services (EDS) project with no context, and there's a fair chance it confidently adds a Sling Model. There is no Sling on EDS. Give the same agent a Java AEM as a Cloud Service (AEMaaCS) project, and it may write a block in vanilla JavaScript and wonder why nothing renders. The agent is capable. It just doesn't know which AEM it's in.

That's the core problem with AI-assisted AEM development, and Adobe says it plainly on aem.live: coding agents "often mix up" the Java, JCR and OSGi stack of AEM Sites with the lightweight HTML, CSS and JavaScript stack of Edge Delivery Services. In 2026 Adobe started shipping the fix: project context files, agent skills and Model Context Protocol (MCP) servers for both stacks.

This post is the practical guide I give teams. It covers **what ships today, how to set it up on each stack, how I structure AGENTS.md, the workflow that keeps agents honest, where they help and where they quietly break things, and how to govern them**. For the wider picture of AI across AEM, from Sites Optimizer to agents, see [AI in AEM in 2026]({{ '/blog/2026/11/ai-in-aem-what-is-real-what-is-useful/' | relative_url }}).

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **Context beats model choice.** An agent that knows your stack, structure and commands outperforms a "smarter" one that doesn't. Agents start every session knowing nothing about your project.
- **Two AEMs, two setups.** EDS is HTML, CSS and JavaScript with blocks. AEMaaCS is Java, HTL, Sling, OSGi and Dispatcher. Never share one context file across both.
- **AGENTS.md is the map.** The EDS boilerplate ships one; for Java projects Adobe's `ensure-agents-md` skill generates one from your `pom.xml`. Keep it short, accurate and in version control.
- **Skills are the procedures.** The [adobe/skills](https://github.com/adobe/skills) repository has plugins for EDS (`create-site`, `content-driven-development`, `page-import`, `block-inventory` and more) and AEMaaCS (`create-component`, `dispatcher`, `migration`, `code-assessment`, workflow and RDE skills).
- **MCP gives agents eyes.** The AEM SDK includes a Quickstart MCP server (logs, bundle diagnosis, request traces). The Dispatcher SDK includes one that validates and traces Dispatcher config.
- **Workflow matters more than tooling:** plan, small diffs, verify with real tools (linting and PageSpeed for EDS; tests, the SDK and the Dispatcher validator for Java), then human review.
- **Agents are good at** blocks, CSS, boilerplate and tests. **They're weak at** repository structure, permissions, caching and anything that fails silently. Review those by hand.

## Why context matters more than the model

AEM is two very different platforms behind one product name, and the public web is full of advice for both, plus a decade of AEM 6.x material that no longer applies.

| | Edge Delivery Services | AEM as a Cloud Service (Java) |
|---|---|---|
| Code | Vanilla JavaScript, CSS, HTML | Java (Sling Models, OSGi), HTL, clientlibs |
| Unit of UI | Block (`blocks/<name>/<name>.js` + `.css`) | Component (`.content.xml`, dialog, HTL, model) |
| Content | Documents, Document Authoring or Universal Editor | JCR, Universal Editor or Page Editor |
| Run locally | `aem up` on localhost:3000 | AEM SDK quickstart, Dispatcher in Docker |
| Verify | Lint, Lighthouse/PageSpeed, the page itself | Unit tests, SDK, Dispatcher validator, pipelines |
| Easy to get wrong | Loading phases, LCP, content model | Repository structure, permissions, caching |

Without context, an agent guesses which column it's in. Adobe adds a nice detail: if you ask an agent to search for "EDS", it finds CDN vendors or medical results. Their advice is to tell the agent to "search the www.aem.live website", and to point it at `/llms.txt`.

![The context layers for AI coding agents on AEM: AGENTS.md as the project map, scoped instruction files, skills as procedures, MCP servers for runtime evidence, and prompts, shown side by side for Edge Delivery Services and AEM as a Cloud Service]({{ '/assets/img/blog/ai-coding-agents-aem/01-context-layers.svg' | relative_url }}){: width="1200" height="640" loading="lazy" decoding="async"}

Adobe's developer guide describes the layers well, and I've adopted its vocabulary:

- **AGENTS.md** says *what the project is*. It's "a map, not a manual".
- **Instruction files** hold *scoped rules* for one concern, such as unit testing or dialogs.
- **Skills** encode *how to do a task correctly*. The agent loads one when a task matches its description.
- **MCP servers** give the agent *runtime evidence*: logs, request traces, validation results.
- **Prompts** stay short, because the other layers carry the context.

## What ships today

### For Edge Delivery Services

The [AEM Boilerplate](https://github.com/adobe/aem-boilerplate) includes an `AGENTS.md` covering project structure, setup commands, coding conventions and block patterns. Claude Code reads `CLAUDE.md` rather than `AGENTS.md`, so aem.live suggests keeping both.

Adobe's [EDS skills](https://www.aem.live/developer/ai-coding-agents) include:

| Skill | What it does |
|---|---|
| `create-site` | New site: repository from the boilerplate, code sync, initial content, live URL |
| `content-driven-development` | The full workflow for building or changing blocks on an existing site |
| `page-import` | Imports or migrates pages from an existing website |
| `docs-search` | Searches aem.live documentation |
| `block-inventory` | Surveys the project's blocks and the Block Collection |
| `block-collection-and-party` | Finds reference block implementations |

The repository holds more than the page lists. When I checked it, the EDS plugin also contained skills such as `code-review`, `testing-blocks`, `content-modeling`, `ue-component-model` and `figma-to-content`. There's also a separate content operations plugin with skills like `cwv-optimizer`, `structured-data` and `accessibility-fix`. Skills change often, so read the repository rather than any blog post (including this one).

aem.live also lists MCP servers that help on EDS: Context7 for indexed documentation, a Browser MCP for screenshots, and two community servers, the Helix MCP Server and the DA MCP Server, which it marks as **unofficial**. It warns that every MCP server consumes context, so disable the ones you don't use.

### For AEM as a Cloud Service (Java)

Adobe's [Local Development with AI Tools](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/ai-in-aem/local-development-with-ai-tools) page documents the Java side:

| Skill | What it does |
|---|---|
| `ensure-agents-md` | Generates `AGENTS.md` and `CLAUDE.md` from your `pom.xml`, modules and add-ons. Runs once |
| `create-component` | Scaffolds dialog, HTL, Sling Model, tests and clientlibs |
| `dispatcher` | Dispatcher and Apache configuration, with sub-skills for authoring, performance, security and incidents |
| `migration` | Migrates AEM 6.x, AMS or on-premise code, one pattern at a time |
| `workflow` | Workflow model design, custom steps and debugging |
| `code-assessment` | Finds best-practice and correctness issues and fixes them pattern by pattern; never commits |

Two MCP servers ship with the SDKs:

- **AEM Quickstart MCP server** (in the AEM SDK, at `http://localhost:4502/bin/mcp`). Its tools are `aem-logs`, `diagnose-osgi-bundle` (why a bundle or component won't start) and `recent-requests` (recent requests with Sling's processing trace). This is the one I'd add first. "Why doesn't my component render?" becomes a question the agent can answer from evidence instead of guessing.
- **Dispatcher MCP server** (in the Dispatcher SDK, run in Docker). Its tools include `validate`, `lint`, `trace_request`, `inspect_cache` and `tail_logs`. Dispatcher is where agents make their most expensive mistakes, so a validator in the loop matters. I cover what those mistakes cost in [Dispatcher on AEM as a Cloud Service]({{ '/blog/2026/11/dispatcher-on-aem-as-a-cloud-service-caching-and-invalidation/' | relative_url }}).

Adobe also documents an AEM MCP server connected to Cloud Acceleration Manager for migration findings, and supports a local Best Practices Analyzer CSV as the alternative.

## Setting it up

### Installing skills

There are several install routes, and the sources differ in the details:

```bash
# Claude Code (both stacks use the same marketplace)
/plugin marketplace add adobe/skills
/plugin install aem-edge-delivery-services@adobe-skills
/plugin install aem-cloud-service@adobe-skills

# GitHub CLI extension
gh extension install ai-ecoverse/gh-upskill
gh upskill adobe/skills --skills-path plugins/aem/edge-delivery-services --all   # as on aem.live
gh upskill adobe/skills --path plugins/aem/cloud-service --all                  # as on Experience League

# Vercel skills CLI
npx skills add https://github.com/adobe/skills/tree/main/plugins/aem/cloud-service --all
```

Codex has its own marketplace command, and the repository README says GitHub Copilot CLI reads the same plugin manifests. Note the inconsistency: aem.live uses `--skills-path` and Experience League uses `--path` for `gh upskill`. Adobe's developer guide recommends `.agents/skills/` as the folder for installed skills. Check `gh upskill --help` and the current README before you script this for a team.

My rule for teams: **install skills into the repository, not just on one laptop.** Skills installed through a personal plugin marketplace help one developer; skills committed to the repository help everyone and get reviewed like code.

### Connecting the MCP servers (Java)

For Claude Code, Adobe's example adds the SDK's server like this:

```bash
claude mcp add --transport http aem-cs-sdk http://localhost:4502/bin/mcp \
  --header "Authorization: Basic YWRtaW46YWRtaW4="
```

That header is the local `admin:admin`. It's fine for the local SDK only. Never copy it to a shared config or point it at a cloud environment. The Dispatcher server runs with `./bin/docker_run_mcp.sh` from the Dispatcher SDK, and `./bin/docker_run_mcp.sh help` prints the IDE configuration. Adobe notes a Docker API version mismatch some users hit (`DOCKER_API_VERSION`), so keep that page handy.

### EDS: give the agent eyes

EDS work is visual, and agents guess at visual output. aem.live recommends screenshots of `localhost:3000` or browser automation (it mentions `playwright-cli` and `agent-browser`). In my experience this is the single biggest quality jump on EDS: an agent that can see the page fixes its own CSS. It also recommends a handful of command-line tools agents use well, such as `rg`, `jq`, `gh` and `curl`.

## How I write AGENTS.md

Adobe's guidance is right: AGENTS.md should be short and stable, and it changes when the architecture changes, not every sprint. Generated or boilerplate files are a good start, but they don't know your decisions. These are my outlines, trimmed. They aren't Adobe's templates.

### For an Edge Delivery Services project

```markdown
# AGENTS.md — acme-eds (Edge Delivery Services)

## What this is
Edge Delivery Services site for www.acme.com. Plain HTML/CSS/JS.
NOT the AEM Java stack: no Sling, HTL, OSGi, JCR or Maven here.
Docs: search www.aem.live; overview at https://www.aem.live/llms.txt

## Structure
- blocks/<name>/<name>.js + <name>.css — one folder per block
- scripts/aem.js — core library, never edit
- scripts/scripts.js — eager/lazy/delayed loading phases
- styles/ — global styles and fonts
- This repo serves 3 sites (repoless); site config lives in the config service

## Commands
- npm run lint (must pass before any commit)
- aem up — local preview on http://localhost:3000

## Rules
- Content first: check the content model before writing block code
- Nothing in the eager phase except LCP-critical code; third-party scripts go in delayed
- No new npm runtime dependencies without a decision record
- Keep Lighthouse at 100 on mobile; test with real content, not lorem ipsum
- Scoped rules: .agents/instructions/blocks.md, .agents/instructions/a11y.md
```

### For an AEM as a Cloud Service project

```markdown
# AGENTS.md — acme-sites (AEM as a Cloud Service, Java)

## What this is
AEM Sites on AEM as a Cloud Service. Java 21, AEM archetype structure.
NOT Edge Delivery Services. Target is AEMaaCS, not AEM 6.5.

## Modules
- core/ — Sling Models, services (OSGi DS annotations only)
- ui.apps/ — components, HTL, clientlibs (immutable /apps)
- ui.config/ — OSGi configs per run mode (author, publish, dev, stage, prod only)
- ui.content/ — sample content only; never real content
- dispatcher/ — flexible mode; never edit default_* files

## Commands
- mvn clean install -PautoInstallSinglePackage (local SDK)
- mvn test (unit tests, AEM Mocks)
- Dispatcher: ./bin/validate.sh src (Dispatcher SDK) before any change

## Rules
- Extend Core Components; don't copy them
- Mutable content under /conf, /var or /content, never /apps
- Service users only, via repoinit; no admin sessions
- No secrets in code; environment values via Cloud Manager variables
- Every Sling Model has a unit test
- Scoped rules: .agents/instructions/testing.junit5.md, dispatcher.md
```

Two habits make these work. First, I put **"NOT the other stack"** in the first lines, because it prevents the most common failure. Second, I link scoped instruction files from AGENTS.md. Adobe's guide notes that deeper files aren't always picked up automatically, so the link is how the agent finds them.

## A workflow that keeps agents honest

The tools matter less than the loop around them. This is the loop I use and teach.

![The agent workflow loop on AEM: plan, then small diffs, then verify with stack-specific checks (lint, Lighthouse and screenshots for Edge Delivery Services; unit tests, the SDK, the Quickstart MCP server and the Dispatcher validator for AEM as a Cloud Service), then human review, then update the context files]({{ '/assets/img/blog/ai-coding-agents-aem/02-agent-workflow.svg' | relative_url }}){: width="1200" height="560" loading="lazy" decoding="async"}

1. **Plan before code.** Ask for a plan: files to touch, the content model or dialog contract, and how it will be verified. Correcting a plan costs seconds; correcting a 600-line diff costs an afternoon.
2. **Give the contract first.** For a component: the dialog fields, properties and expected HTML. For a block: the content structure authors will create and a screenshot of the design. Adobe's guide recommends the same, plus asking for tests *before* refactoring.
3. **Small diffs.** One block, one component, one pattern at a time. Adobe's `migration` and `code-assessment` skills deliberately work one pattern per batch and pause for review, which is a good model to copy.
4. **Verify with real tools, not the agent's opinion.**
   - EDS: `npm run lint`, the page on localhost with real content, a screenshot comparison, and a Lighthouse or PageSpeed run on the preview URL. I explain the performance budget in [keeping Lighthouse at 100]({{ '/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/' | relative_url }}).
   - AEMaaCS: `mvn test`, deployment to the local SDK, the Quickstart MCP server's logs and request traces, and the Dispatcher validator for any Dispatcher change. Then the Cloud Manager quality gates, which I cover in [Cloud Manager pipelines]({{ '/blog/2026/11/aem-cloud-manager-pipelines-quality-gates-rde-config-pipeline/' | relative_url }}).
5. **Human review on every pull request.** AI code review (aem.live mentions Copilot, Claude Code and Codex) is a useful first pass, not a replacement for a reviewer who knows AEM.
6. **Update the context.** When you correct the agent the same way twice, write it down: a line in AGENTS.md, an instruction file or a skill. aem.live suggests asking the agent to update the skill itself. This is how the setup gets better over time.

## Where agents help, and where they hurt

This is my honest split for both stacks.

| Agents do well | Agents do badly (review by hand) |
|---|---|
| Scaffolding EDS blocks from a clear content model | Choosing the content model in the first place |
| CSS from a screenshot, with visual feedback | Loading-phase decisions that affect LCP on EDS |
| Sling Model and HTL boilerplate, dialogs from a spec | Repository structure: what belongs in `/apps`, `/conf`, `/var` |
| Unit tests with AEM Mocks | Service users, ACLs and repoinit permissions |
| Refactoring one known pattern (for example `unbounded-query`) | Dispatcher filters, cache rules and TTLs |
| Explaining unfamiliar code and logs | OSGi configuration and service lifecycles "from memory" |
| Migrating pages into EDS blocks (with review) | Anything multi-site or repoless that spans projects |
| Writing documentation and runbooks | Changes that fail silently: resource type resolution, caching, MSM |

The pattern is clear. **Agents are strong where mistakes are loud.** A broken block looks broken, and a failing test fails. **They're weak where mistakes are quiet.** A wrong ACL, an over-broad Dispatcher filter or a cache rule that serves stale prices passes every test and surfaces in production. Adobe's guide makes the same point: don't let the assistant invent OSGi configuration, validate Dispatcher rules with proper tooling, and don't assume resource type resolution is right.

Two EDS specifics. Agents love adding dependencies and frameworks; EDS projects stay fast precisely because they don't. And agents rarely think about authors. A block that works with the developer's sample content but confuses authors in [Universal Editor or documents]({{ '/blog/2026/11/universal-editor-vs-document-based-authoring/' | relative_url }}) is a failure, even if it scores 100.

On [repoless setups]({{ '/blog/2026/10/aem-eds-repoless-one-codebase-many-sites/' | relative_url }}), where one codebase serves many sites, say so in AGENTS.md. An agent that changes a shared block for one site breaks the others.

## Security and governance

Treat an agent as a fast, junior contributor with access to your machine. That framing makes most of the rules obvious.

- **Secrets.** Never put credentials in AGENTS.md, skills, prompts or MCP configs that get committed. The SDK's `admin:admin` header is for localhost only. For cloud environments, use Cloud Manager variables and keep agents away from production credentials entirely.
- **Code only, not content.** Adobe's guidance is to keep the assistant to code and not let it change JCR content or published pages. I agree. Content changes go through authoring and workflow, where people are accountable.
- **Prompt injection.** Agents read files, web pages and tool output, and any of them can contain instructions. Be careful with MCP servers you didn't write, especially community servers with write access, and with skills from unknown sources. Review third-party skills like any dependency: read them before you install them.
- **Least privilege for tools.** Start agents in a mode that asks before running commands or editing files. Allow-list safe commands (lint, tests) rather than granting blanket shell access.
- **Licences and IP.** Check your client contract and your organisation's AI policy before sending client code to a hosted model. Many enterprises require approved tools, specific data-retention settings or both. Ask; don't assume.
- **Accountability.** The person who merges owns the code. "The agent wrote it" isn't a defence in an incident review.

## Rolling it out to a team

What I've seen work, in order:

1. **Start with one stack and one champion.** EDS is the easier start: smaller surface, visual feedback and Adobe's most mature skills.
2. **Commit the context.** AGENTS.md, instruction files and skills live in the repository and change through pull requests.
3. **Agree the rules before the tools:** what agents may change, required checks, and review expectations. Put them in AGENTS.md so the agent reads them too.
4. **Measure something real:** cycle time per block or component, defects found in review, rework after QA. Not "lines of code generated".
5. **Run a short retro after two weeks.** Turn repeated corrections into instruction files or skills.
6. **Keep humans on the hard parts.** Content modelling, Dispatcher, permissions and performance stay with experienced engineers, with agents assisting.

The teams that get the most from agents aren't the ones with the most tools installed. They're the ones that wrote down how they work, so the agent can follow it.

## FAQ

**Which agent should we use for AEM?**
Adobe's pages list Claude Code, Cursor, Codex, GitHub Copilot, Gemini and Zed. The skills install into several of them. Pick the one your organisation approves, then invest in context; that matters more than the model.

**Do we need both AGENTS.md and CLAUDE.md?**
If anyone uses Claude Code, yes, or keep one file and point the other at it. Adobe's `ensure-agents-md` skill creates both for Java projects, and aem.live suggests keeping both for EDS.

**Will the `ensure-agents-md` skill overwrite our file?**
No. Adobe says it runs only when there's no AGENTS.md and never overwrites one. That also means it won't update itself: edit the file when your structure changes.

**Can an agent migrate our AEM 6.5 code to AEM as a Cloud Service?**
Adobe's `migration` skill helps, one pattern at a time, using findings from Cloud Acceleration Manager or a BPA CSV. It speeds up code refactoring; it doesn't remove content migration, integration work or regression testing. Plan the whole migration as you would anyway.

**Are the community MCP servers safe?**
aem.live labels the Helix and DA MCP servers as unofficial. Review what they can do, prefer read-only use, and don't give any MCP server credentials it doesn't need.

**Is this useful on AEM 6.5?**
The repository has a separate `aem-6-5-lts` plugin with replication, workflow, Dispatcher and index skills. The Local Development page targets AEMaaCS specifically, so check the 6.5 plugin's own documentation.

## Closing thought

AI agents don't make AEM simple. They make the simple parts fast, and that leaves more time for the parts that need an architect. The difference between a team that gets value and one that gets mess is almost entirely context and discipline: tell the agent which AEM it's in, give it procedures and evidence, keep the diffs small, verify with real tools and review everything that fails silently.

If you're setting up AI-assisted development on an AEM or Edge Delivery Services team, or want a second opinion on your AGENTS.md and guardrails, [get in touch](/contact/).

### References

- [AI coding agents](https://www.aem.live/developer/ai-coding-agents) and [AI](https://www.aem.live/ai) (aem.live)
- [Local Development with AI Tools](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/ai-in-aem/local-development-with-ai-tools) (Adobe Experience League)
- [An AEM developer's guide to AGENTS.md, skills and prompt libraries](https://experienceleague.adobe.com/en/perspectives/an-aem-developer-s-guide-to-agents-md-skills-and-prompt-libraries) (Adobe Experience League)
- [AI-assisted development overview](https://experienceleague.adobe.com/en/docs/experience-manager-learn/cloud-service/ai/ai-assisted-development/overview) (Adobe Experience League)
- [AI-Assisted Code Migration to AEM as a Cloud Service](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/cloud-migration-skill/overview-cloud-migration-skill) (Adobe Experience League)
- [adobe/skills](https://github.com/adobe/skills) and [AEM Boilerplate](https://github.com/adobe/aem-boilerplate) (Adobe, GitHub)

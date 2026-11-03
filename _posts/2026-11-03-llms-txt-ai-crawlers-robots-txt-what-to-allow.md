---
layout: post
title: "llms.txt, AI crawlers and robots.txt: what to allow in 2026"
seo_title: "AI Crawlers, robots.txt and llms.txt: What to Allow in 2026"
description: "Which AI crawlers to allow or block in 2026: search bots, user-triggered fetchers and training bots, three robots.txt templates, llms.txt facts and checks."
date: 2026-11-03 17:40:00 +0530
category: seo-ai-search
tags: [GEO, AI Search, robots.txt, llms.txt]
---

Every AI visibility audit I run now starts in the same place: a robots.txt file that nobody owns. Someone added `User-agent: GPTBot` and `Disallow: /` in 2023 because the news said so. Someone else turned on a "block AI bots" toggle at the CDN. Marketing is now asking why the brand never shows up in ChatGPT, and nobody connects the two.

The problem isn't that teams block AI bots. It's that they block the wrong ones, for the wrong reasons, and can't see the side effects. In 2026 there are at least three very different kinds of AI bot, each vendor documents them differently, and the controls for Google's AI Overviews don't live in robots.txt at all.

This post is the decision guide I use with clients. It groups the crawlers by what they actually do, explains how robots.txt is really parsed, gives three templates with honest trade-offs, and puts llms.txt in its proper place. It builds on my earlier post on [SEO vs GEO](/blog/2026/10/seo-vs-geo-making-your-site-visible-in-ai-search/), which covers the wider picture.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **Classify before you block.** AI bots fall into three groups: search and answer index bots (they decide whether you can be cited), user-triggered fetchers (they fetch a page because a person asked) and training crawlers (they decide whether future models learn from you).
- **Blocking a training crawler doesn't remove you from AI answers; blocking a search bot does.** OpenAI, Anthropic, Perplexity, Apple and others now separate these, so you can opt out of training and stay visible.
- **Several user-triggered fetchers say robots.txt may not apply** (OpenAI's ChatGPT-User, Perplexity-User, Google's user-triggered fetchers, Meta-ExternalFetcher). Your WAF is the real control for them, and it's also what most often blocks them by accident.
- **Google-Extended does not control AI Overviews or AI Mode.** Those are governed by Googlebot, snippet controls (`nosnippet`, `max-snippet`, `data-nosnippet`) and, since 2026, a Search Console setting. Google-Extended covers Gemini training and grounding.
- **The most common breakage isn't robots.txt.** It's a CDN or WAF default, a specific user-agent group that silently drops your `*` rules, or a robots.txt that returns a 5xx.
- **llms.txt is cheap and harmless, but not a ranking lever.** Google Search ignores it. Agents, IDE tools and documentation platforms do use it. Add one if you have docs or a product people integrate with; don't expect traffic.

## The three kinds of AI bot

![AI crawlers grouped into search and answer index bots, user-triggered fetchers, and training crawlers and tokens]({{ '/assets/img/blog/llms-txt-ai-crawlers-robots-txt-what-to-allow/01-ai-crawler-groups.svg' | relative_url }}){: width="1200" height="620" loading="lazy" decoding="async"}

The mistake behind most bad robots.txt files is treating "AI bots" as one category. They aren't. I sort them into three groups, and each group gets a different default.

**1. Search and answer index bots.** These build the index an assistant retrieves from when it answers a question and cites sources: OAI-SearchBot for ChatGPT search, Claude-SearchBot, PerplexityBot, and of course Googlebot and Bingbot, which feed AI Overviews, AI Mode and Copilot. Block one of these and you disappear from that assistant's answers. **Default: allow.**

**2. User-triggered fetchers.** When someone pastes your URL into ChatGPT, or asks Claude to read a page, a fetcher such as ChatGPT-User or Claude-User retrieves that single page in real time. Vendors treat this as acting on a person's behalf, and several say robots.txt may not apply. **Default: allow, and make sure your WAF doesn't block them by accident.**

**3. Training crawlers and usage tokens.** GPTBot, ClaudeBot, Meta-ExternalAgent and CCBot collect content that may train models. Google-Extended and Applebot-Extended aren't crawlers at all: they're robots.txt tokens that tell Google and Apple how they may *use* what Googlebot and Applebot already fetched. **Default: a business and legal decision, not an SEO one.**

There's also a fourth, awkward category: **mixed-use crawlers**. Googlebot, Bingbot and Applebot power both classic search and AI features. You can't block them to stop AI use without losing search. Their AI controls live in tokens, meta tags and webmaster settings, which I cover below.

## What each vendor says in 2026

Crawler names and policies change every few months, so this is based on each vendor's own documentation as of November 2026. Check the links in the references before you ship.

| User agent / token | Vendor | Group | robots.txt | What blocking does |
|---|---|---|---|---|
| `OAI-SearchBot` | OpenAI | Search | Honoured | Removed from ChatGPT search answers |
| `ChatGPT-User` | OpenAI | User-triggered | "May not apply" | Limited effect; use WAF if you must |
| `GPTBot` | OpenAI | Training | Honoured | Opts out of training only |
| `Claude-SearchBot` | Anthropic | Search | Honoured | Less visible in Claude search results |
| `Claude-User` | Anthropic | User-triggered | Honoured | Claude can't fetch your pages for users |
| `ClaudeBot` | Anthropic | Training | Honoured | Opts out of training only |
| `PerplexityBot` | Perplexity | Search | Allow recommended | Removed from Perplexity results |
| `Perplexity-User` | Perplexity | User-triggered | "Generally ignores" | Little; WAF only |
| `Googlebot` | Google | Search (mixed-use) | Honoured | Removed from Google Search entirely |
| `Google-Extended` | Google | Token | Honoured | Opts out of Gemini training and grounding |
| `Bingbot` | Microsoft | Search (mixed-use) | Honoured | Removed from Bing and Copilot |
| `Applebot` | Apple | Search (mixed-use) | Honoured | Removed from Siri, Spotlight, Safari |
| `Applebot-Extended` | Apple | Token | Honoured | Opts out of Apple model training |
| `Meta-ExternalAgent` | Meta | Training | Honoured | Opts out of Meta training |
| `Meta-ExternalFetcher` | Meta | User-triggered | "May bypass" | Little; WAF only |
| `Amazonbot` | Amazon | Training and products | Honoured | Opts out of Amazon model training |
| `CCBot` | Common Crawl | Training dataset | Honoured | Keeps you out of future Common Crawl snapshots |

### OpenAI

OpenAI documents three main agents and is explicit that **"each setting is independent of the others"**. Disallow GPTBot and your content "should not be used in training generative AI foundation models"; allow OAI-SearchBot and you can still appear in ChatGPT search. Sites that block OAI-SearchBot "will not be shown in ChatGPT search answers". For ChatGPT-User, OpenAI says: "Because these actions are initiated by a user, robots.txt rules may not apply." OpenAI also notes that search changes can take about 24 hours after a robots.txt update.

### Anthropic

Anthropic runs the same three-way split: **ClaudeBot** for training, **Claude-SearchBot** for search quality, and **Claude-User** for user-initiated fetches. Unlike OpenAI and Perplexity, Anthropic says its bots honour robots.txt, and that disabling Claude-User stops retrieval of your content for user queries, which may reduce your visibility in user-directed web search. It also supports the non-standard `Crawl-delay` directive.

### Perplexity

Perplexity documents **PerplexityBot** for its search index (not foundation model training) and **Perplexity-User** for user-requested fetches, which "generally ignores robots.txt rules". Read that alongside a well-publicised dispute: in August 2025 Cloudflare reported that, when Perplexity's declared crawlers were blocked, undeclared crawlers with a generic Chrome user agent and unpublished IPs appeared, and de-listed Perplexity as a verified bot. Perplexity disputed the analysis, attributing the traffic to a third-party browsing service. Whoever is right, the lesson is general: **robots.txt is a request, not enforcement**, and your logs are the only evidence that counts.

### Google

This is where most of the confusion sits.

- **Googlebot** crawls for Search, and AI Overviews and AI Mode are built on the Search index. Blocking Googlebot removes you from Google, full stop.
- **Google-Extended** has no user agent of its own. It's a token that controls whether content Google crawls may be used for training future Gemini models **and for grounding in Gemini Apps and Vertex AI**. Google states it "does not impact a site's inclusion in Google Search nor is it used as a ranking signal". It does **not** control AI Overviews or AI Mode.
- **User-triggered fetchers** such as Google-Agent (agents on Google infrastructure browsing for a user) and Gemini Notebook "generally ignore robots.txt rules", per Google's own list.
- Google also says it intends to support the IETF AIPREF training preference, written as `User-agent: __usage_ai-training`, in early 2027.

The practical trade-off people miss: blocking Google-Extended also opts you out of *grounding* in the Gemini app. If Gemini app visibility matters to you, that's a real cost.

### Microsoft Bing and Copilot

Bingbot feeds both Bing and Copilot, so there's no separate Copilot crawler to block. Until now, Bing used the `noarchive` and `nocache` meta tags to limit use in Copilot answers. On 30 October 2026 Microsoft announced replacements: an **AI Training** preference (based on the AIPREF syntax, settable in robots.txt or per page) and a page-level **AI Grounding** preference, with `Allow`, `DisallowExtended` (Microsoft's own experiences only) and `Disallow`. Microsoft says it starts honouring them on 1 February 2027, and after 1 March 2027 `noarchive` and `nocache` no longer count as training or grounding preferences. If you rely on those tags today, put this on your roadmap now.

### Apple, Meta, Amazon, Common Crawl and the rest

- **Apple:** Applebot powers Siri, Spotlight and Safari features. Applebot-Extended "does not crawl webpages"; it only decides whether Applebot's data may train Apple's foundation models. Pages that disallow it "can still be included in search results".
- **Meta:** Meta-ExternalAgent crawls for training and product indexing and honours robots.txt. Meta-ExternalFetcher handles user-requested fetches and "may bypass robots.txt". A newer meta-webindexer supports Meta AI search results.
- **Amazon:** Amazonbot improves Amazon's services and "may be used to train Amazon AI models". Amzn-SearchBot supports Alexa search experiences and isn't used for training. Amzn-User does live, user-initiated fetches. Amazon doesn't support `Crawl-delay`.
- **Common Crawl:** CCBot builds the open Common Crawl dataset that many models have been trained on. Blocking it affects future snapshots, not data already collected.
- **DuckDuckGo:** DuckAssistBot fetches pages for cited DuckAssist answers, honours robots.txt, and DuckDuckGo says the data isn't used to train models.
- **Bytespider:** ByteDance's crawler. If you opt out of training, include it and check your logs to confirm the rule is respected.

## How robots.txt actually works (RFC 9309)

robots.txt has been a formal standard since 2022 as RFC 9309. Four rules explain most of the surprises I see.

**1. A crawler obeys one group, not all of them.** It looks for a group whose `User-agent` matches its product token (case-insensitive). If one exists, it uses that group and **ignores `User-agent: *` entirely**. Only if no group matches does it fall back to `*`. If several groups name the same bot, their rules are combined.

This is the classic trap:

```text
User-agent: *
Disallow: /checkout/
Disallow: /account/
Disallow: /internal-search

# Added later "to be explicit"
User-agent: OAI-SearchBot
Allow: /
```

OAI-SearchBot now follows only its own group, so it's allowed into `/checkout/`, `/account/` and your internal search results. Whenever you add a named group, **repeat every rule you still want it to follow**.

**2. The most specific path wins.** The matching rule with the most characters takes precedence, and when an `Allow` and a `Disallow` are equally specific, `Allow` wins. Google supports `*` and `$` wildcards in paths.

```text
User-agent: *
Disallow: /products/
Allow: /products/*.html$
```

Product pages ending in `.html` are crawlable; everything else under `/products/` isn't.

**3. Errors matter.** A 4xx on robots.txt means "crawl everything". A 5xx or unreachable file means "assume complete disallow". Google pauses crawling for the first 12 hours of 5xx errors, then falls back to its last cached copy. A misconfigured edge rule that returns 503 for robots.txt can quietly stop every compliant crawler.

**4. It's cached and it's not security.** Crawlers shouldn't cache it for more than 24 hours, so changes aren't instant. The RFC is explicit that the rules "are not a form of access authorization". Anything genuinely private needs authentication, not a `Disallow` line that advertises its path.

## The mistakes I keep finding

- **The CDN overrides robots.txt.** Cloudflare replaced its single "Block AI bots" toggle with separate **Search**, **Agent** and **Training** controls in 2026. Since 15 September 2026, new domains are offered presets: the ad-supported preset sets Training to "Disallow AI Training" and **Agent to "Block on pages with ads"**. "Agent" is exactly where ChatGPT-User and Claude-User live. Choosing plain **Block** for Training now also stops mixed-use crawlers like Googlebot, Bingbot and Applebot, which takes search down with it. Other CDNs and WAFs have their own bot-management categories, so check those too.
- **Bot-fight and challenge modes.** JavaScript challenges and CAPTCHAs block every crawler that doesn't run a browser, including the search bots you want. Allowlist verified bots rather than challenging them.
- **Blocking user-triggered agents at the WAF without realising.** A rule like "block non-browser user agents" or "block data-centre ASNs" catches ChatGPT-User and Claude-User. The user asked an assistant about your product, and the assistant couldn't read your page.
- **Named groups that drop the `*` rules**, as above. Very common after someone copies an "AI bots" snippet from a blog post.
- **Blocking Googlebot or Bingbot to stop AI answers.** You lose search. Use the controls in the next section.
- **Forgotten subdomains and staging leftovers.** robots.txt is per host, so `docs.example.com` needs its own file. And a staging `Disallow: /` shipped to production is still the most expensive line I've seen go live.

On AEM Edge Delivery Services, robots.txt and metadata are configured per site; on multi-site setups that's the Configuration Service, which I covered in the [repoless post](/blog/2026/10/aem-eds-repoless-one-codebase-many-sites/). Review AI rules there and at the CDN, not just in the repo.

## Controlling AI Overviews, AI Mode and Copilot without blocking crawlers

If you want to stay in Google Search but limit what its AI features use, robots.txt is the wrong tool. Google's levers are:

| Control | Where | Effect on AI Overviews and AI Mode |
|---|---|---|
| `nosnippet` | Meta robots or `X-Robots-Tag` | No snippet, and content isn't used as a direct input for AI Overviews or AI Mode |
| `max-snippet:[n]` | Meta robots or `X-Robots-Tag` | Limits how much text can be shown or used as direct input |
| `data-nosnippet` | Attribute on `span`, `div`, `section` | Excludes that element's text from snippets; Google lists it among AI feature controls |
| Search generative AI control | Search Console, Settings | Excludes the whole property from AI Overviews, AI Mode and Discover AI features |
| `noindex` | Meta robots or `X-Robots-Tag` | Removes the page from Search entirely |
| `Google-Extended` | robots.txt | Gemini training and grounding only; **not** AI Overviews |

The Search Console control is new: Google says it rolled out to all websites worldwide by 31 August 2026, applies per property (subdomains inherit from the parent), takes effect within one to two days, and isn't used as a ranking signal elsewhere in Search. It doesn't affect training; that's still Google-Extended.

`data-nosnippet` is the precise tool I use most. It lets you keep a page fully visible while protecting one block, such as member pricing or a licensed paragraph:

```html
<p>Our standard plans start at €49 per month.</p>
<div data-nosnippet>
  <p>Partner pricing: available to registered partners only.</p>
</div>
```

For Bing and Copilot, use `noarchive` and `nocache` until early 2027, then the new page-level preferences:

```html
<meta name="Bingbot" content="ai-grounding:disallowextended">
```

`disallowextended` keeps your content available to Microsoft's own experiences such as Copilot while excluding third-party grounding services. Use `ai-grounding:disallow` to opt out completely. Every one of these controls reduces your presence in AI answers. Use them for content you need to protect, not as a default.

## Three robots.txt templates

All three assume you replace the private paths and sitemap with your own. Group-sharing (several `User-agent` lines above one set of rules) is valid under RFC 9309.

### Template A: maximum AI visibility

For most B2B, SaaS, e-commerce and services sites, this is my recommendation. Everything that helps you get cited is allowed, including training, because being represented accurately in future models has value.

```text
# Template A: maximum AI visibility
# No named groups, so every bot follows these rules.
User-agent: *
Disallow: /account/
Disallow: /checkout/
Disallow: /internal-search
Allow: /

Sitemap: https://www.example.com/sitemap.xml
```

**Trade-off:** your content can be used for training by any compliant crawler. If that's acceptable, there's nothing else to manage, which is a real advantage. Make sure the CDN agrees with this file.

### Template B: visible in AI search, opted out of training

For brands that want citations but don't want to contribute training data.

```text
# Template B: AI search yes, training no
User-agent: *
Disallow: /account/
Disallow: /checkout/
Disallow: /internal-search
Allow: /

# Training crawlers and usage tokens
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: Meta-ExternalAgent
User-agent: Amazonbot
User-agent: CCBot
User-agent: Bytespider
Disallow: /

# AIPREF training preference: Bing from Feb 2027, Google planned for early 2027
User-agent: __usage_ai-training
Disallow: /

Sitemap: https://www.example.com/sitemap.xml
```

OAI-SearchBot, Claude-SearchBot, PerplexityBot, Googlebot, Bingbot, Applebot and the user-triggered fetchers have no named group, so they follow `*`.

**Trade-offs:** blocking Google-Extended also removes you from **grounding** in the Gemini app. Amazonbot also improves Amazon's products and services, so blocking it may affect more than training. Blocking CCBot only affects future snapshots. And none of this removes content already collected.

### Template C: publisher, locked down

For publishers and owners of licensed content who want classic search traffic and nothing else.

```text
# Template C: publisher, locked down
# Default: no access
User-agent: *
Disallow: /

# Classic search engines (mixed-use: AI controls via tokens and settings)
User-agent: Googlebot
User-agent: Bingbot
User-agent: Applebot
Disallow: /account/
Disallow: /checkout/
Allow: /

# Social link previews, so shared links still render
User-agent: facebookexternalhit
User-agent: LinkedInBot
User-agent: Twitterbot
Allow: /

# Usage tokens for the mixed-use crawlers above
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: __usage_ai-training
Disallow: /

Sitemap: https://www.example.com/sitemap.xml
```

Pair it with the Search Console generative AI control (or `nosnippet`/`max-snippet` on premium templates), Bing's `ai-grounding:disallow` from 2027, and WAF rules for user-triggered fetchers you want to refuse.

**Trade-offs, honestly:** you vanish from ChatGPT, Claude, Perplexity and Meta AI citations, while those assistants keep answering questions on your topic using competitors and whoever quotes you. Some user-triggered fetchers will still reach you unless blocked at the edge, and any new search engine you haven't named is blocked by default. It's a legitimate commercial position, especially if you're negotiating licences or trying Cloudflare's pay per crawl (still in closed beta), but it's a visibility cost, not a free win.

## llms.txt: what it is and who reads it

**What it is.** llms.txt is a proposal published by Jeremy Howard in September 2024 at llmstxt.org. It's a Markdown file at `/llms.txt` with an H1 (the only required part), a short blockquote summary, and H2 sections listing links to your most useful pages, with an "Optional" section for links an agent can skip. The proposal also suggests offering clean Markdown versions of pages at the same URL plus `.md`. **llms-full.txt** isn't in the proposal; it's a convention used by documentation platforms that bundles all content into one file.

```markdown
# Example Digital

> Example Digital builds AEM and Edge Delivery Services platforms for multi-brand enterprises.

## Services
- [AEM as a Cloud Service migration](https://www.example.com/services/aem-migration): assessment, refactoring and cut-over
- [Edge Delivery Services](https://www.example.com/services/eds): build, performance and authoring

## Optional
- [Case studies](https://www.example.com/work)
```

**What Google says.** Google's guide to generative AI features says creating llms.txt "will neither harm nor help your site's visibility or rankings in Google Search, as Google Search ignores them". John Mueller has compared it to the keywords meta tag: a site's claim about itself that a search engine can verify by reading the site directly.

**Who actually reads it.** Not the big search crawlers, as far as any vendor has confirmed. In my experience the real users are agents and developer tools: coding assistants and IDE agents that are pointed at a docs site, MCP-style tools, and people pasting a URL into a chat. Documentation platforms such as Mintlify generate llms.txt and llms-full.txt automatically, and vendors including Anthropic, OpenAI, Cloudflare and Vercel publish them for their docs. That tells you where the value is: **developer documentation and products people integrate with**.

**My recommendation.** If you have docs, an API or a product that people build on, add one; it takes an hour and agents do use it. For a marketing site, add a short one if it's trivial on your platform, then forget about it. Don't spend budget on it, don't let anyone sell it as GEO, and spend the time on server-rendered HTML instead, because that's what every crawler actually reads.

## Verifying who is really crawling you

A user-agent string is free to fake. Before you trust or block anything, check the logs and verify the source.

**Step 1: see who comes and what they get.**

```bash
# Requests per AI user agent (case-insensitive)
grep -Eio 'GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-User|Claude-SearchBot|PerplexityBot|Perplexity-User|Google-Agent|Applebot|bingbot|Amazonbot|CCBot|Bytespider|meta-externalagent' access.log \
  | sort | uniq -c | sort -rn

# Status codes served to one bot (combined log format: status is field 9)
grep -i 'OAI-SearchBot' access.log | awk '{print $9}' | sort | uniq -c
```

A wall of 403s for a bot you meant to allow is the WAF talking. On AEM as a Cloud Service or any managed CDN, pull CDN logs rather than origin logs, because blocked requests never reach the origin.

**Step 2: verify the source.** Vendors publish either reverse DNS patterns or IP range JSON files:

| Vendor | How to verify |
|---|---|
| Google | Reverse DNS to `googlebot.com` or `google.com`, then forward-confirm; or Google's published IP range JSON files |
| Microsoft | Reverse DNS to `search.msn.com`; or `bingbot.json` |
| Apple | Reverse DNS to `applebot.apple.com`; or `applebot.json` |
| Amazon | Reverse DNS to `crawl.amazonbot.amazon`, then forward-confirm |
| Common Crawl | Reverse DNS to `crawl.commoncrawl.org`; or `ccbot.json` |
| OpenAI | IP ranges per bot: `searchbot.json`, `gptbot.json`, `chatgpt-user.json` |
| Anthropic | IP list at `claude.com/crawling/bots.json` |
| Perplexity | `perplexitybot.json` and `perplexity-user.json` |

Reverse DNS has to be confirmed in both directions:

```bash
host 66.249.66.1
# 1.66.249.66.in-addr.arpa domain name pointer crawl-66-249-66-1.googlebot.com.
host crawl-66-249-66-1.googlebot.com
# must resolve back to 66.249.66.1
```

The IP range files share a simple `prefixes` format, so one small script covers most of them:

```python
# verify_ip.py: python3 -I verify_ip.py 203.0.113.10 https://openai.com/searchbot.json
import ipaddress, json, sys, urllib.request

ip = ipaddress.ip_address(sys.argv[1])
data = json.load(urllib.request.urlopen(sys.argv[2]))
nets = [p.get("ipv4Prefix") or p.get("ipv6Prefix") for p in data["prefixes"]]
print("verified" if any(ip in ipaddress.ip_network(n) for n in nets if n) else "NOT in published ranges")
```

**Step 3: test the rules themselves.** My free [GEO audit tool](/tools/geo-audit/) checks a page against your live robots.txt for 19 crawlers across all three groups, flags blocked search and answer bots separately from training bots, and checks whether the content is readable without JavaScript. It can't see your WAF, so pair it with step 1. For the classic SEO side, the [SEO audit tool](/tools/seo-audit/) covers indexability and meta robots.

## FAQ

**Will blocking GPTBot remove my site from ChatGPT?**
No. GPTBot is OpenAI's training crawler. ChatGPT search uses OAI-SearchBot, and OpenAI states the settings are independent. Block GPTBot and allow OAI-SearchBot if you want to be cited without contributing training data.

**Does blocking Google-Extended remove me from AI Overviews?**
No. Google-Extended controls Gemini training and grounding in Gemini Apps and Vertex AI. AI Overviews and AI Mode are part of Search, controlled by Googlebot access, `nosnippet`, `max-snippet`, `data-nosnippet` and the Search Console generative AI setting.

**Can I stop ChatGPT or Perplexity reading a page a user pastes in?**
Not reliably with robots.txt. OpenAI says rules "may not apply" to ChatGPT-User and Perplexity says Perplexity-User "generally ignores" them. You can block their published IP ranges at the WAF, but think about whether you really want to refuse a person who is actively asking about you.

**Is llms.txt worth it?**
For developer docs and APIs, yes: agents and IDE tools use it. For a marketing site it's harmless but won't change rankings or AI Overview visibility. Google says Search ignores it.

**How quickly do robots.txt changes take effect?**
Usually within a day. RFC 9309 says crawlers shouldn't cache the file for more than 24 hours, OpenAI quotes about 24 hours, and DuckDuckGo says 72 hours for DuckAssistBot. Already-collected training data isn't removed.

## Closing thought

The right AI crawler policy for most sites is boring: allow the search and answer bots, don't block user-triggered fetchers by accident, and make a deliberate, documented decision about training. Then make sure the CDN, the WAF and robots.txt all say the same thing, and check the logs every quarter, because vendors add and rename agents constantly.

What I'd avoid is the reflex block. It feels protective, but for most brands the bigger risk in 2026 isn't being learned from. It's being absent when a buyer asks an assistant who to shortlist.

If you'd like a second pair of eyes on your crawler policy or CDN bot rules, especially on AEM, [Get in touch](/contact/).

### References

- [RFC 9309: Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309.html) (IETF)
- [How Google interprets the robots.txt specification](https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt) (Google Search Central)
- [Google's common crawlers, including Google-Extended](https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers) (Google Search Central)
- [Google's user-triggered fetchers](https://developers.google.com/search/docs/crawling-indexing/google-user-triggered-fetchers) (Google Search Central)
- [Robots meta tag, data-nosnippet and X-Robots-Tag specifications](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag) (Google Search Central)
- [Search generative AI control](https://support.google.com/webmasters/answer/16908024?hl=en) (Search Console Help)
- [Optimizing your website for generative AI features on Google Search](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) (Google Search Central)
- [Overview of OpenAI crawlers](https://developers.openai.com/api/docs/bots) (OpenAI)
- [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) (Anthropic)
- [Perplexity crawlers](https://docs.perplexity.ai/guides/bots) (Perplexity)
- [Perplexity is using stealth, undeclared crawlers to evade website no-crawl directives](https://blog.cloudflare.com/perplexity-is-using-stealth-undeclared-crawlers-to-evade-website-no-crawl-directives/) (Cloudflare, 2025)
- [Your content, your choice: clearer preferences for training and grounding](https://blogs.bing.com/search/2026/10/your-content-your-choice-clearer-preferences-for-training-and-grounding/) (Microsoft Bing, 2026)
- [Have it both ways: stay discoverable in search while disallowing AI training](https://blog.cloudflare.com/accountable-mixed-use-ai-crawlers/) (Cloudflare, 2026)
- [The /llms.txt file](https://llmstxt.org/) (llmstxt.org)
- [Google says llms.txt comparable to keywords meta tag](https://www.searchenginejournal.com/google-says-llms-txt-comparable-to-keywords-meta-tag/544804/) (Search Engine Journal)

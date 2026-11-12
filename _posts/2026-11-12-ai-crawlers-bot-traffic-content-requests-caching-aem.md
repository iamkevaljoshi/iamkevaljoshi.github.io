---
layout: post
title: "AI crawlers are now a line item: bot traffic, content requests and caching on AEM"
seo_title: "AI Crawlers on AEM: Bot Traffic, Content Requests and Caching"
description: "How AI crawlers and bots affect AEM as a Cloud Service and Edge Delivery Services: which bot requests count as content requests, cache misses, measuring from CDN logs and controls."
ai_summary: "Automated traffic is now about a third of web traffic, and AI crawlers behave differently from people: they fetch long-tail pages in parallel, miss the cache and rarely send visitors back. On AEM as a Cloud Service, Adobe excludes well-known search engines and recognised AI crawlers from billable content requests, so the licence risk comes from unidentified bots, AI agents using browser user agents and user agents lost behind your own CDN. The infrastructure cost, cache misses reaching Dispatcher and publish, applies either way. The post shows how to measure bot traffic from CDN logs, how to classify bots by purpose, and how to control them with robots.txt, cdn.yaml traffic filters and rate limits, and caching, without losing visibility in AI search."
date: 2026-11-12 10:00:00 +0530
category: aem-cloud-service
tags: [AI crawlers, AEM as a Cloud Service, CDN, Content requests, Edge Delivery Services, GEO]
---

A client's AEM as a Cloud Service content requests climbed steadily for three months while their analytics showed flat human traffic. Marketing assumed a reporting fault. Finance assumed a licence surprise. The CDN logs told a simpler story: thousands of requests an hour from clients nobody had invited, fetching old product pages that no person had opened in a year, almost all of them missing the cache.

That story is now common, and AI is a large part of it. Crawlers collect training data, search bots index pages for AI answers, and agents fetch pages on behalf of users. Some of that traffic is worth having. Some of it costs money. Most teams can't tell which is which.

This post is the architect's view of bot traffic on **AEM as a Cloud Service and Edge Delivery Services**: what Adobe counts towards your licence and what it doesn't, what bots do to your caches, how to measure it from CDN logs, and how to control it **without disappearing from AI search**.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **Automated traffic is about a third of the web.** Cloudflare reports that 32% of traffic on its network is automated, and AI bots alone send more than 10 billion requests a week.
- **AI crawlers behave badly for caches.** They fetch long-tail pages in parallel, rarely revisit the same URL, and push popular content out of the cache. Every miss goes to your origin.
- **Most of it is training, not search.** In Cloudflare's 2025 data, about 80% of AI crawling was for training, and training crawlers send very few visitors back.
- **On AEMaaCS, well-known bots aren't billable.** Adobe excludes well-known search engines and recognised AI/LLM crawlers from content requests. The billable risk is everything else: unidentified bots, AI agents using browser user agents, monitoring tools, and user agents lost behind your own CDN.
- **Cache misses cost you either way.** Even excluded bots reach Dispatcher and publish on a miss, which affects performance and capacity for real visitors.
- **Measure before you block.** Add the bot name to your CDN logs, forward them, and group requests by bot, cache status and path.
- **Control by purpose:** allow search and answer bots you want citations from, decide deliberately on training crawlers, rate-limit unidentified heavy clients, and block empty user agents. Use robots.txt for the polite bots and `cdn.yaml` traffic filters for the rest.

## How big the bot problem is

The best public data comes from Cloudflare, because it sees a large share of the web.

In April 2026, Cloudflare reported that **32% of traffic across its network comes from automated sources**, including search crawlers, uptime checkers, ad networks and AI assistants. AI bot traffic alone exceeded **10 billion requests a week**, and AI crawlers made up about **80% of self-identified AI bot traffic**.

What matters more than the volume is the *purpose*. Cloudflare's August 2025 analysis split AI crawling into three groups:

| Purpose | Share of AI crawling (12 months to mid-2025) | What it means for you |
|---|---|---|
| Training | About 80% | Your content may train a model; few or no visitors come back |
| Search | About 18% | Your content may be cited in AI answers, with a link |
| User actions | About 2% | A person asked an assistant something and it fetched your page |

The same post published **crawl-to-refer ratios**: how many pages a platform crawls for each visitor it sends back. In July 2025 they ranged from about 5 for Google to about 1,091 for OpenAI and about 38,000 for Anthropic. These ratios change month by month, so check Cloudflare Radar for current figures, but the shape is stable: **training crawlers take a lot and give little back; search and answer bots give something back.**

That is the heart of every decision in this post. "Block AI" is the wrong question. "Which bots earn their cost?" is the right one.

## Why AI crawlers break caches

A CDN works because people are predictable. Most visitors look at the same few hundred pages, so those pages stay in cache and the origin rarely sees a request.

AI crawlers are not predictable in that way. Cloudflare's research describes them as:

- **Sequential and wide.** They scan a site section by section, reaching rarely visited pages instead of popular ones.
- **Rarely repeating.** In Cloudflare's agent model, 70–100% of pages fetched are unique, so there's little for a cache to reuse.
- **Parallel and stateless.** Many instances run at once, with no shared browser cache or session, so each looks like a new visitor.
- **Error-heavy.** Many fetches from popular AI crawlers return 404s or redirects.

The result is a higher cache miss rate, and worse: under the common least-recently-used eviction policy, the long-tail pages crawlers fetch push out the popular pages people need. Cloudflare saw a clear hit-rate drop on a single node when AI crawler traffic was added.

![How a bot request flows through AEM as a Cloud Service: classification at the CDN decides whether it is billable, the cache decides whether it reaches Dispatcher and publish, and long-tail crawling turns into cache misses and origin load]({{ '/assets/img/blog/ai-crawlers-cost/01-bot-request-path.svg' | relative_url }}){: width="1200" height="620" loading="lazy" decoding="async"}

On AEM as a Cloud Service, a miss at the Adobe-managed CDN goes to Dispatcher, and a miss at Dispatcher goes to AEM publish, which renders the page. I explain those three layers in my [Dispatcher post]({{ '/blog/2026/11/dispatcher-on-aem-as-a-cloud-service-caching-and-invalidation/' | relative_url }}). A crawler walking 50,000 old product pages can turn a calm publish tier into a busy one, and slow pages down for the people who are actually buying.

## Do bots count as content requests?

This is the question finance asks, and the answer is more nuanced than most people expect.

AEM Sites as a Cloud Service is licensed largely by **content requests**: HTML and JSON responses, counted where the first caching layer receives them, whether served from cache or origin. My [cost of AEM post]({{ '/blog/2026/11/real-cost-of-aem-licences-hosting-build-and-run/' | relative_url }}) covers the licensing model. For bots, Adobe's content requests documentation (last updated 29 September 2026) is specific:

| Traffic | Billable? | Notes |
|---|---|---|
| Well-known search engines, social networks and HTTP libraries tagged by Fastly | **No** | Examples include Googlebot, Bingbot, SemrushBot, AhrefsBot and ClaudeBot |
| Well-known AI/LLM crawlers tagged by Fastly | **No** | Examples include ChatGPT, Perplexity and Gemini Deep Research |
| AEM's own monitoring and pod warm-up, `/system/probes/health` | No | Use this URL, or `HEAD` requests on Edge Delivery Services, for uptime checks |
| Redirects (3xx), errors (4xx, 5xx), `/etc.clientlibs/*`, `favicon.ico` | No | Only successful HTML and JSON responses count |
| **Other automated traffic: unidentified bots, scrapers, monitoring tools not on the list** | **Yes** | Adobe says this is "counted as billable content requests" |
| **An AI agent using a generic browser user agent** | **Possibly** | If it isn't identified as a bot, it looks like a person |
| Soft 404s (a 200 status for a missing page) | Yes | Return a real 404 |

Three practical consequences:

1. **The famous AI crawlers aren't your licence problem.** If GPTBot or ClaudeBot hammers your site, it costs you cache capacity and origin load, not content requests, as long as it's recognised.
2. **The unknown ones are.** Scrapers, SEO tools you haven't heard of, AI agents driving a headless browser with a normal Chrome user agent, and aggressive uptime monitors are billable. They are also the hardest to see in analytics.
3. **Your own CDN can break the exclusion.** If you run Akamai, Cloudflare or CloudFront in front of AEM and it doesn't pass the original `User-Agent` through, every bot looks the same to Adobe and none can be excluded. Adobe calls this out explicitly. Check it on every customer-managed CDN setup.

### Edge Delivery Services

Adobe's documentation describes content requests as routing "through Edge Delivery Services or customer-provided caching systems", so the same counting applies to EDS sites delivered under an AEM Sites licence. The infrastructure picture is different, though: there's no Dispatcher or publish tier for crawlers to overload. Misses go to Adobe's EDS delivery, which is designed for this. On EDS, bot traffic is mainly a **content requests and visibility** question, not a capacity one. My [EDS vs traditional AEMaaCS post]({{ '/blog/2026/11/aem-edge-delivery-services-vs-traditional-aemaacs/' | relative_url }}) covers the wider differences.

## Know your bots: four groups

User agents change and new bots appear every month, so classify by **purpose**, not by name. Each major AI company now separates its bots by purpose and documents them.

| Group | Examples (from the vendors' own docs) | Follows robots.txt? | What you get in return |
|---|---|---|---|
| **Search engines** | Googlebot, Bingbot | Yes | Organic search traffic |
| **AI search and answer bots** | OAI-SearchBot (OpenAI), Claude-SearchBot (Anthropic), PerplexityBot | Yes | Citations and links in AI answers |
| **Training crawlers** | GPTBot (OpenAI), ClaudeBot (Anthropic), CCBot (Common Crawl) | Yes | Possibly brand presence in model knowledge; no direct traffic |
| **User-triggered fetchers** | ChatGPT-User, Claude-User, Perplexity-User | **Not necessarily** | A real person asked about you |

Two details from the vendors' documentation are worth knowing:

- **User-triggered fetchers may ignore robots.txt.** OpenAI says robots.txt rules "may not apply" to ChatGPT-User, and Perplexity says Perplexity-User "generally ignores robots.txt rules", because a person requested the fetch. If you need to stop them, robots.txt won't do it.
- **The tokens are separate on purpose.** Blocking GPTBot (training) doesn't block OAI-SearchBot (search), and blocking ClaudeBot doesn't block Claude-SearchBot. That separation is what makes a nuanced policy possible.

User agents can be spoofed, which is why OpenAI and Perplexity publish IP ranges (for example `openai.com/searchbot.json` and `perplexity.ai/perplexitybot.json`). On the Adobe-managed CDN you don't verify these yourself: Fastly's classification, exposed as `botName` in CDN rules, does that work.

## Measuring bot traffic from your CDN logs

Don't block anything until you've measured it. Client-side analytics won't help: bots don't run your tags, and Adobe itself notes that consent and blockers make client-side data undercount.

### Step 1: add the bot name to the logs

Adobe's content requests documentation shows how to add Fastly's bot classification and the client's network to every CDN log line with a request transformation in `cdn.yaml`:

```yaml
kind: "CDN"
version: "1"
data:
  requestTransformations:
    rules:
      - name: log-bot-and-network
        when: "*"
        actions:
          - type: set
            logProperty: bot_name
            value: { reqProperty: botName }
          - type: set
            logProperty: cli_network
            value: { reqProperty: clientAsName }
```

Deploy it through the config pipeline, as I describe in the [cdn.yaml post]({{ '/blog/2026/11/aem-cloud-service-cdn-yaml-headers-proxy-redirects/' | relative_url }}). From then on, each log line carries `bot_name` and `cli_network` next to the standard fields such as `req_ua`, `url`, `status`, `cache` and `cli_ip`.

### Step 2: get the logs somewhere you can query

Forward CDN logs to Splunk, Datadog, Elastic or similar with a `LogForwarding` config, or download them from Cloud Manager for a one-off analysis. A week of data is usually enough to see the pattern.

### Step 3: ask four questions

**Who is fetching, and how much?** In Splunk, for example:

```text
index=aem_cdn status=200
| eval bot=coalesce(bot_name, "(not identified)")
| stats count AS requests, sum(eval(cache="HIT")) AS hits by bot
| eval hit_rate=round(hits/requests*100,1)
| sort -requests
```

**Which unidentified clients are heaviest?** These are your likely billable bots:

```text
index=aem_cdn status=200 NOT bot_name=*
| stats count by req_ua, cli_network
| sort -count | head 30
```

**What are crawlers hitting?** Group by the first path segments to see whether they're walking the long tail:

```text
index=aem_cdn bot_name=*
| rex field=url "^(?<section>/[^/]+/[^/]+)"
| stats count, sum(eval(cache!="HIT")) AS misses by section
| sort -misses
```

**How many 404s and redirects are bots generating?** Cloudflare found many AI crawler fetches end in errors. A spike here usually means old URLs in a crawler's queue, and is a cheap fix with redirects.

If you'd rather not use a log platform, the downloaded log is JSON lines, so `jq` works for a quick look:

```bash
jq -r 'select(.status==200) | [(.bot_name // "(not identified)"), .cache] | @tsv' cdn.log \
  | sort | uniq -c | sort -rn | head -20
```

Turn the answers into three numbers for your stakeholders: **share of requests from bots**, **cache hit rate for bots versus people**, and **requests from unidentified automated clients per day**. The last one is the closest proxy for billable bot traffic.

## Visibility versus cost

Here is the trade-off every content owner now faces.

Block everything and you protect your origin, but you also disappear from AI answers. ChatGPT, Claude and Perplexity can't cite what their search bots can't read, and AI answers are where a growing share of research starts. I cover how AI answers pick sources in [SEO vs GEO]({{ '/blog/2026/10/seo-vs-geo-making-your-site-visible-in-ai-search/' | relative_url }}).

Allow everything and you pay, in cache capacity and sometimes in content requests, for training crawlers that may never send a visitor.

My default policy for clients is:

- **Allow** search engines and AI search bots. They're the ones that send visitors and citations.
- **Allow** user-triggered fetchers. A person asked about you; that's a lead, not a scraper.
- **Decide deliberately** on training crawlers. Many brands allow them for visibility in model knowledge; publishers often block them. It's a business decision, so write it down with the reason.
- **Rate-limit** unidentified heavy clients, and **block** empty user agents and clearly abusive networks.

My post on [llms.txt, AI crawlers and robots.txt]({{ '/blog/2026/11/llms-txt-ai-crawlers-robots-txt-what-to-allow/' | relative_url }}) goes deeper on the robots.txt side.

![Decision matrix for bot traffic: allow search engines, AI search bots and user-triggered fetchers; decide on training crawlers per business policy; rate-limit unidentified automated clients; block empty user agents and abusive networks]({{ '/assets/img/blog/ai-crawlers-cost/02-bot-policy.svg' | relative_url }}){: width="1200" height="560" loading="lazy" decoding="async"}

## Controls that work on AEM

### 1. robots.txt for the polite bots

Robots.txt is the cheapest control because well-behaved bots stop before they fetch. An example that keeps AI search and blocks training:

```text
# Search engines and AI search: allowed
User-agent: Googlebot
User-agent: Bingbot
User-agent: OAI-SearchBot
User-agent: Claude-SearchBot
User-agent: PerplexityBot
Allow: /

# Training crawlers: blocked by policy (review yearly)
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: CCBot
Disallow: /

# Everyone else: keep out of low-value areas
User-agent: *
Disallow: /search
Disallow: /*?*sort=

Sitemap: https://www.example.com/sitemap.xml
```

Two limits to remember. Robots.txt is a request, not a wall: user-triggered fetchers may ignore it, and abusive scrapers will. And `Crawl-delay` is non-standard: Anthropic documents support for it, Google ignores it. Use real rate limits for real control.

### 2. Traffic filters and rate limits in cdn.yaml

Traffic filter rules run at the Adobe-managed CDN, before the cache and before Dispatcher. Adobe's own example for managing content requests blocks requests with no user agent, plus named networks or bots you've decided to refuse:

```yaml
kind: "CDN"
version: "1"
data:
  trafficFilters:
    rules:
      - name: block-empty-user-agent
        when:
          anyOf:
            - { reqHeader: user-agent, exists: false }
            - { reqHeader: user-agent, equals: '' }
        action: block
      - name: block-refused-bots-and-networks
        when:
          anyOf:
            - { reqProperty: botName, equals: "UnwantedBot" }
            - { reqProperty: clientAsName, equals: "UnwantedClientNetwork" }
        action: block
```

For unidentified heavy clients, a per-IP rate limit on the publish tier, scoped to traffic Fastly hasn't classified as a known bot. Start in `log` mode, check the CDN logs, then switch to `block`:

```yaml
kind: "CDN"
version: "1"
data:
  trafficFilters:
    rules:
      - name: rate-limit-unidentified-clients
        when:
          allOf:
            - { reqProperty: tier, equals: publish }
            - { reqProperty: botName, exists: false }
        rateLimit:
          limit: 50
          window: 10
          penalty: 300
          count: all
          groupBy:
            - reqProperty: clientIp
        action: log
```

Before relying on the `botName` condition, check in your logs how unclassified requests appear: if `bot_name` shows as an empty string rather than missing, use `equals: ''` instead of `exists: false`. Choose the limit from your logs, not from this example: look at the highest legitimate per-IP rate (office networks and corporate proxies can be busy) and set the limit comfortably above it. Remember that rate limits are counted per CDN point of presence, and that Cloud Manager IP allowlists and `allow` rules take precedence over blocks. The [cdn.yaml post]({{ '/blog/2026/11/aem-cloud-service-cdn-yaml-headers-proxy-redirects/' | relative_url }}) covers syntax, evaluation order and the WAF licence.

### 3. Caching built for crawlers

You can't stop search bots walking your long tail, and you don't want to. You can make each walk cheaper:

- **Longer CDN TTLs for HTML with stale-while-revalidate.** A page that is five minutes stale is fine for a crawler and usually fine for people. Serving stale while refreshing in the background turns many crawler misses into hits. Set it through `Surrogate-Control` in Dispatcher, as described in the [Dispatcher post]({{ '/blog/2026/11/dispatcher-on-aem-as-a-cloud-service-caching-and-invalidation/' | relative_url }}).
- **Strip junk query parameters.** Crawlers love `?sort=`, `?page=999` and tracking parameters. Each unique URL is a separate cache object. Remove unused parameters at the CDN with a request transformation and ignore them in Dispatcher.
- **Fix the 404s and redirect chains.** Old URLs in crawler queues generate misses and wasted renders. Redirect the ones with value and let the rest return a fast, real 404.
- **Keep sitemaps honest.** Accurate `lastmod` dates help good crawlers fetch only what changed instead of everything.

### 4. Ask the boring questions

- **Is the user agent reaching AEM?** If you run your own CDN in front, confirm it forwards `User-Agent` unchanged. Otherwise the well-known bot exclusion can't work.
- **Are your own tools the problem?** Adobe lists custom search crawlers, SEO crawlers and uptime monitors among the common causes of content request growth. Point monitoring at `/system/probes/health` (or use `HEAD` on EDS), and schedule your own crawls sensibly.
- **Are soft 404s returning 200?** They count as content requests and keep crawlers coming back.

## Decision guide

| Situation | What I do |
|---|---|
| Content requests rising, human analytics flat | Add `bot_name` logging, forward logs, find the top unidentified clients |
| A known AI training crawler is heavy on cache misses | Decide on policy; block in robots.txt if refused; improve HTML TTLs either way |
| AI search bots are fetching a lot | Leave them alone; they're your citations. Improve caching instead |
| Unidentified clients with browser user agents fetching at machine speed | Per-IP rate limit in `log` mode, then `block` |
| Requests with no user agent | Block |
| Your own CDN in front of AEM | Verify `User-Agent` is forwarded; fix before anything else |
| Monitoring tools hitting real pages | Move them to `/system/probes/health` or `HEAD` requests |
| Long-tail product or article archive being crawled | Stale-while-revalidate on HTML, clean query parameters, honest sitemaps |
| Edge Delivery Services site | Same measurement and robots.txt policy; capacity is rarely the issue, content requests and visibility are |

## FAQ

**Will blocking GPTBot remove us from ChatGPT search?**
Not according to OpenAI's documentation. GPTBot collects training data; ChatGPT search uses OAI-SearchBot, and user-requested fetches use ChatGPT-User. Each has its own robots.txt token. The same separation exists at Anthropic (ClaudeBot, Claude-SearchBot, Claude-User) and Perplexity (PerplexityBot, Perplexity-User).

**Do AI crawlers count towards our AEM content requests?**
Adobe excludes well-known search engines and recognised AI/LLM crawlers that Fastly tags. Unidentified bots, AI agents using generic browser user agents and monitoring tools not on Adobe's exclusion list do count. So does any bot whose user agent is lost behind your own CDN.

**Why do bots still matter if they're not billable?**
Because cache misses cost capacity and speed. A crawler walking your long tail sends requests to Dispatcher and publish that real visitors then queue behind, and it evicts popular pages from cache.

**Is robots.txt enough?**
For well-behaved crawlers, yes, and it's the cheapest control. For user-triggered fetchers it may be ignored by design, and for scrapers it's ignored by intent. Use CDN traffic filters and rate limits for those.

**Should we block all AI to protect our content?**
That's a legitimate choice for some publishers, but for most brands and B2B sites it trades a modest cost for invisibility in AI answers. I'd block training by policy if the business wants to, keep AI search open, and control the rest with rate limits.

**How often should we review this?**
Quarterly. New bots appear, vendors rename and split their crawlers, and the crawl-to-refer ratios change. Keep the policy in a short document next to your `cdn.yaml`.

## Closing thought

AI crawlers turned bot management from an operations footnote into a business decision. The good news for AEM teams is that the tools are already in place: Fastly's bot classification, CDN logs, `cdn.yaml` traffic filters and the caching levers in Dispatcher. Adobe has also drawn a sensible line on licensing by excluding the bots it can recognise.

What's usually missing is the measurement and the policy. **Log the bot name, look at a week of data, decide which bots earn their cost, and enforce that decision at the CDN.** It's a day's work that saves months of arguing about a content requests graph.

If your content requests or origin load are climbing and nobody can explain why, [get in touch](/contact/).

### References

- [Understand Cloud Service content requests](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/using-cloud-manager/content-requests) (Adobe Experience League, updated 29 September 2026)
- [Why we're rethinking cache for the AI era](https://blog.cloudflare.com/rethinking-cache-ai-humans) (Cloudflare, April 2026)
- [The crawl-to-click gap: Cloudflare data on AI bots, training, and referrals](https://blog.cloudflare.com/crawlers-click-ai-bots-training/) (Cloudflare, August 2025)
- [Overview of OpenAI crawlers](https://developers.openai.com/api/docs/bots) (OpenAI)
- [Does Anthropic crawl data from the web, and how can site owners block the crawler?](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-the-web) (Anthropic)
- [Perplexity crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers.md) (Perplexity)
- [Configuring traffic at the CDN](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/content-delivery/cdn-configuring-traffic) (Adobe Experience League)
- [Traffic filter rules including WAF rules](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/security/traffic-filter-rules-including-waf) (Adobe Experience League)

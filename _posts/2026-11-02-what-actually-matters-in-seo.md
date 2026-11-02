---
layout: post
title: "What actually matters in SEO in 2026: a practitioner's priority list"
seo_title: "What Matters in SEO in 2026: A Priority Checklist"
description: "What matters most in SEO in 2026, from Google's own documentation: technical foundation, content, trust, titles, page experience and the myths to ignore."
date: 2026-11-02 09:00:00 +0530
tags: [SEO, Technical SEO, Content Strategy]
---

Ask ten people what matters in SEO and you'll get two hundred "ranking factors". Most of those lists mix what Google actually uses with folklore, things that used to work in 2012, and things that are true but hardly move the needle.

This post takes the opposite approach. It's a **priority list**: what to fix first, what to do well, and what to stop worrying about. Every claim is anchored in Google's own documentation, most of it updated in 2025 or 2026, plus the sworn testimony and leaked documentation that showed how user behaviour feeds into ranking. Where something is opinion or unconfirmed, I say so.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **SEO is a chain of gates:** discover, crawl, render, index, rank, appear, satisfy. A page that fails an early gate never reaches the later ones, so **technical health comes first**.
- **Content that genuinely satisfies the searcher is the biggest lever** once you're indexed. Google's guidance is consistent: original, people-first content with first-hand expertise, not content written to a word count or a keyword list.
- **Trust underpins everything.** E-E-A-T isn't a ranking factor you can score, but it describes what Google's systems try to reward, and Google says trust is the most important part.
- **Links still matter,** but PageRank is one signal among many. Earn them; buying or trading them is link spam.
- **Titles, snippets and structured data** decide whether you get the click once you rank.
- **Page experience is a real but modest signal.** Hit the Core Web Vitals thresholds, then stop obsessing.
- **Searcher satisfaction is measured.** Click data feeds ranking through systems such as Navboost, so pages that leave people going back to the results are fighting gravity.

## How a page earns a ranking

![How a page earns a ranking: discover, crawl, render, index, rank, appear, satisfy]({{ '/assets/img/blog/seo-what-matters/01-how-a-page-earns-a-ranking.svg' | relative_url }}){: width="1200" height="480" loading="lazy" decoding="async"}

It helps to picture search as a pipeline:

1. **Discover.** Google finds URLs through links and sitemaps.
2. **Crawl.** Googlebot fetches the URL, if robots.txt allows it and the server responds properly.
3. **Render.** Google runs the page's JavaScript to see the final content.
4. **Index.** Google decides whether the page is worth storing, which URL is the canonical one, and what it's about.
5. **Rank.** Many ranking systems score indexed pages for a query. Google's own guide lists systems for link analysis and PageRank, freshness, original content, passage ranking, reviews, reliable information, site diversity, spam detection and more.
6. **Appear.** Google builds the title link, snippet and any rich result.
7. **Satisfy.** The searcher clicks, reads and either finishes or goes back to try another result.

Two consequences shape everything else in this post. First, **no amount of content quality helps a page that isn't indexed.** Second, **ranking doesn't end at the click.** What searchers do afterwards feeds back into the system.

## The SEO priority stack

![The SEO priority stack, from technical foundation to measurement]({{ '/assets/img/blog/seo-what-matters/02-seo-priority-stack.svg' | relative_url }}){: width="1200" height="560" loading="lazy" decoding="async"}

I use this stack in audits. Work bottom-up: each layer multiplies the one below it, and none can compensate for a missing foundation.

## Layer 1: Technical foundation

The goal is simple: **every page you want found is reachable, renderable, indexable and has exactly one canonical URL.**

**Crawling**

- **Don't block what Google needs.** robots.txt controls crawling, not indexing. Never block the CSS and JavaScript required to render the page; Google's starter guide is explicit about this.
- **Return honest status codes.** `200` for real pages, `301` for permanent moves, `404` or `410` for gone pages. Avoid "soft 404s": error pages that return `200`.
- **Link with real links.** Google follows `<a href="...">`. Navigation built from click handlers on `div`s may never be discovered.

**Indexing**

- **One piece of content, one URL.** Pick a canonical with redirects or `rel="canonical"`. Duplicate URLs from tracking parameters, trailing slashes, `http`/`https` or `www`/non-`www` split your signals. Google says duplicate content on your own site doesn't cause a manual action, but it does waste crawling and dilutes signals.
- **Use `noindex` to keep pages out of results.** Blocking a URL in robots.txt can still leave it indexed without content, because Google can't see the `noindex`.

```html
<!-- On every indexable page -->
<link rel="canonical" href="https://www.example.com/services/aem-migration/">

<!-- On pages that should never appear in search -->
<meta name="robots" content="noindex">
```

**Sitemaps**

Sitemaps help discovery, especially for large or new sites, but Google calls a submitted sitemap "merely a hint". Some details people get wrong:

- Google **ignores `<priority>` and `<changefreq>`**.
- Google uses `<lastmod>` only if it's consistently accurate. Update it for real content changes, not for a new copyright year in the footer.
- Each sitemap is limited to **50,000 URLs or 50 MB** uncompressed. Use a sitemap index beyond that.

**JavaScript**

Google renders JavaScript, but rendering can be delayed, and many AI crawlers don't run JavaScript at all. Put the main content, links and metadata in the server-rendered HTML. (I go deeper on the AI crawler side in [SEO vs GEO](/blog/2026/10/seo-vs-geo-making-your-site-visible-in-ai-search/).)

**Site structure and internal links**

- Use **descriptive URLs** (`/blog/aem-migration-checklist/`, not `/p?id=4821`). They help people more than rankings, since Google says keywords in URLs have "hardly any effect".
- Make important pages reachable within a few clicks, link related pages together, and use **descriptive anchor text**. Internal links are how you tell Google which pages you consider important.
- **Crawl budget** is only a real concern for very large sites (Google's guide points to roughly a million or more pages, or 10,000+ pages that change daily). For most sites it's a non-issue.

## Layer 2: Content that satisfies intent

Once you're indexed, this is the biggest lever. Google's March 2024 core update folded the old "helpful content system" into its core ranking systems, so helpfulness isn't a separate filter any more. It's part of how everything is ranked.

**Match the intent first.** Before writing, search the query yourself. Are the top results guides, product pages, comparison tables, videos or tools? If Google consistently shows one format, a different format will struggle however good it is. Intent beats keywords.

**Write people-first content.** Google's helpful-content guidance offers self-assessment questions worth applying to every important page:

- Does it provide **original information, reporting, research or analysis**?
- Does it give a **substantial, complete** description of the topic, and go beyond the obvious?
- Does it show **first-hand expertise** and a depth of knowledge?
- Would someone **bookmark it or recommend it**?
- Will a reader **leave feeling they've learned enough** to achieve their goal?

And the warning signs of search-engine-first content: writing to a word count, covering trending topics outside your expertise, summarising others without adding value, and changing dates on pages without meaningfully updating them.

**Cover the topic, not the keyword.** Modern ranking systems such as BERT, RankBrain and neural matching understand concepts and synonyms. Repeating a phrase doesn't help; keyword stuffing is a spam policy violation. Cover the questions a real person would have next.

**Length is a consequence, not a target.** Google says it plainly: "there's no magical word count target". A definition might need 80 words; a migration guide might need 4,000.

**AI-assisted content is allowed, scaled filler isn't.** Google judges the content, not the tool. But "using generative AI to produce large amounts of text without manual oversight or curation" is the kind of low-effort content its systems demote, and mass-producing pages to manipulate rankings falls under the **scaled content abuse** spam policy. Disclose AI use where readers would reasonably wonder how the content was made.

**Keep it current when the query deserves it.** Freshness systems favour recent content for queries where recency matters (news, new releases, changing regulations). An evergreen definition doesn't need monthly "updates".

## Layer 3: Trust and authority

**E-E-A-T, correctly understood.** Experience, Expertise, Authoritativeness and Trust come from Google's Search Quality Rater Guidelines. Google is explicit that E-E-A-T **is not itself a ranking factor**, and raters' scores don't directly affect rankings. Raters help Google evaluate whether its ranking systems reward the right things. So you don't "add E-E-A-T" to a page; you build a site that genuinely has it, and Google's systems look for the signals that correlate with it. Of the four, Google says **trust is the most important**. It weighs these qualities more heavily on "Your Money or Your Life" topics such as health, finance and safety.

Practical signals that support trust:

- **Who:** clear bylines linking to a real author page, an About page, and contact details. Google specifically warns against fabricated authors and AI-generated headshots.
- **How:** explain how you know, such as testing methodology for reviews, data sources for research, and project experience for advice.
- **Why:** the content exists to help readers, not primarily to attract search traffic.
- **Accuracy:** cite sources, avoid easily disproved claims, and correct mistakes.

**Links still matter.** Google's ranking systems guide still lists link analysis and PageRank, though its starter guide describes PageRank as "just one" of many signals. The links that count are the ones you **earn**: original research others cite, tools people use, expert commentary journalists quote. Buying links, excessive link exchanges and large-scale guest posting for links are **link spam**.

**Mentions and reputation beyond your site.** Reviews, press coverage, conference talks, community answers and consistent business information all reinforce who you are. This matters even more for AI-generated answers, which cross-check facts across many sources.

## Layer 4: Search presentation

Ranking gets you seen; presentation gets you **chosen**.

**Title links.** Google's best practices: a unique, descriptive and concise `<title>` on every page, no keyword stuffing, no repeated boilerplate, and the brand used briefly at the start or end. Google sets **no character limit** but truncates long titles to fit the screen, so put the important words first.

Google rewrites titles when it finds a problem. The most common reasons are half-empty titles ("| Brand"), outdated titles (an old year), titles that don't match the page, near-identical titles across many pages, and pages with **no clear main heading**. The fix is usually to make the `<title>` and the visible `<h1>` agree.

**Meta descriptions** aren't a ranking factor, but they often become the snippet. Write a specific, accurate summary of what the page offers. Google may pull a different snippet from the page when that better matches the query.

**Structured data** makes pages **eligible** for rich results such as breadcrumbs, articles, products, reviews, events and organisation details. It doesn't boost rankings by itself, and it must describe what's visible on the page.

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "What actually matters in SEO in 2026",
  "author": { "@type": "Person", "name": "Keval Joshi", "url": "https://iamkevaljoshi.github.io/about/" },
  "datePublished": "2026-11-02"
}
```

**Images:** use descriptive file names and alt text, place images near related text, and serve modern formats at sensible sizes. Image search is a real traffic source for many sites.

## Layer 5: Page experience

Google's Core Web Vitals targets are:

| Metric | Measures | Good |
|---|---|---|
| **LCP** (Largest Contentful Paint) | Loading speed of the main content | 2.5 s or less |
| **INP** (Interaction to Next Paint) | Responsiveness to taps, clicks and keys | under 200 ms |
| **CLS** (Cumulative Layout Shift) | Visual stability | under 0.1 |

Google's wording is careful: good Core Web Vitals and page experience "align with what our core ranking systems seek to reward". In practice they work more like a **tie-breaker** than a trump card. A fast page with weak content won't outrank a slower page that answers the question far better.

Still, speed and stability affect conversions and satisfaction directly, which feeds the next section. Hit the thresholds using real-user (field) data in Search Console, then put the remaining effort into content. Also: serve over **HTTPS**, make pages work well on **mobile** (Google indexes the mobile version), and avoid **intrusive interstitials** that cover the content.

## The signal people underestimate: satisfied searchers

For years Google publicly played down the role of clicks. Two events changed the conversation:

- In the **2023 US antitrust trial**, Google's Pandu Nayak testified about **Navboost**, a system that uses aggregated click and interaction data to refine rankings. He described it as one of Google's important signals.
- In **May 2024**, leaked internal API documentation referenced Navboost and click-based attributes, consistent with that testimony.

The exact mechanics aren't public, and the leak shows what data exists, not how it's weighted. But the direction is clear: **pages that leave searchers going back to the results are working against the system.**

The practical lesson isn't to chase click-through hacks. Make sure the page **delivers on the promise of its title**: answer early, then expand; make the page easy to scan; don't hide the answer behind pop-ups or walls of preamble.

## What doesn't matter (much)

![What matters in SEO versus what Google says doesn't matter]({{ '/assets/img/blog/seo-what-matters/03-what-matters-vs-myths.svg' | relative_url }}){: width="1200" height="520" loading="lazy" decoding="async"}

Google's SEO starter guide addresses several long-running myths directly:

| Myth | What Google says |
|---|---|
| The meta keywords tag helps | Google "doesn't use the keywords meta tag" |
| Pages need a minimum word count | "There's no magical word count target" |
| Keywords in the domain or URL boost rankings | They have "hardly any effect beyond appearing in breadcrumbs" |
| You need a specific number or order of headings | No "magical, ideal amount of headings"; out-of-order headings don't matter to Search |
| Duplicate content triggers a penalty | Your own duplicates don't cause a manual action (copying others' content is different) |
| Subdomains vs subfolders is a ranking decision | Choose "whatever makes sense for your business" |
| E-E-A-T is a ranking factor to optimise | "No, it's not" |
| Sitemap priority controls crawling | Google ignores `<priority>` and `<changefreq>` |

None of these items are bad practice. Descriptive URLs and a logical heading structure still help readers. They just aren't where rankings come from.

## What can sink you: spam policies

Google's spam policies are where SEO goes from "not helping" to "actively harmful". The full list includes cloaking, doorway pages, hidden text and links, keyword stuffing, link spam, scraping, sneaky redirects, thin affiliate pages, user-generated spam and hacked content. Three policies were introduced in **March 2024** and remain the most relevant today:

- **Scaled content abuse:** "many pages are generated for the primary purpose of manipulating search rankings", whether by AI, people or both.
- **Site reputation policy** (originally "site reputation abuse"): third-party content published on a host site mainly to exploit the host's ranking signals, such as unrelated coupon or casino sections on a news site.
- **Expired domain abuse:** buying an expired domain to repurpose its reputation for unrelated, low-value content.

Violations can lead to algorithmic demotion or a manual action, visible in Search Console. Google runs periodic spam updates; the rule of thumb is simple: **if a tactic only makes sense because of search engines, it's probably a risk.**

## Measure what matters

- **Google Search Console:**
  - the **Page indexing** report (what's indexed and why not);
  - **Performance** (queries, clicks, impressions and position);
  - **Core Web Vitals** (field data);
  - **URL Inspection** (how Google sees a specific page);
  - **Manual actions**.
- **Bing Webmaster Tools:** Bing powers several other search and AI experiences, so it's worth verifying your site there too.
- **Analytics:** measure conversions from organic traffic, not just sessions. Rankings are a means, not the goal.
- **A simple cadence:** check indexing weekly, review performance monthly, and re-audit the technical foundation after every redesign or platform migration, which is when most SEO disasters happen.

## The checklist

**Technical foundation**

- Important pages return `200`, appear in the sitemap and are **indexed** (check Search Console).
- Each page has **one canonical URL**; duplicates redirect or point to it.
- robots.txt doesn't block important pages, CSS or JavaScript.
- Main content and links are in the **server-rendered HTML**.
- No soft 404s; moved pages use `301` redirects.
- Sitemap `lastmod` values are accurate.
{: .checklist}

**Content**

- The page format **matches the intent** of what currently ranks.
- It adds something **original**: experience, data, examples or analysis.
- It **answers early**, then goes deeper; one clear main topic per page.
- It's **accurate and current** for queries where recency matters.
{: .checklist}

**Trust**

- A **named author** with a real author page; About and contact pages.
- Sources cited; methodology explained where relevant.
- Links are **earned**, not bought or swapped.
{: .checklist}

**Presentation**

- A unique, descriptive `<title>` that agrees with the visible `<h1>`.
- A specific meta description.
- Valid **structured data** that matches visible content.
- Descriptive image alt text.
{: .checklist}

**Experience**

- LCP ≤ 2.5 s, INP < 200 ms, CLS < 0.1 in **field data**.
- Works well on mobile; HTTPS; no intrusive interstitials.
{: .checklist}

## If you run on AEM

Most SEO problems on enterprise AEM estates come from the platform layer, not the content:

- **AEM as a Cloud Service:** get **canonicals, vanity URLs and redirects** right at the Dispatcher and CDN layers. Shorten `/content/brand/en/...` paths with resource mapping, and make sure every page variant has one canonical URL. Migrations are the highest-risk moment: map every old URL to a new one with `301` redirects before go-live.
- **Edge Delivery Services:** pages are server-rendered semantic HTML and fast by default, which takes care of much of Layers 1 and 5. Manage metadata, redirects, sitemaps and robots.txt per site, and on multi-site setups through the Configuration Service, which I covered in the [repoless post](/blog/2026/10/aem-eds-repoless-one-codebase-many-sites/). For data-driven pages that should rank, render them at publish time rather than in the browser; see [edge worker vs JSON2HTML](/blog/2026/10/aem-eds-edge-worker-vs-json2html/).

## Closing thought

The uncomfortable truth about SEO is that **most of what matters isn't clever.** Make pages reachable and indexable. Publish content that's genuinely the best answer for the person searching. Show who's behind it. Present it accurately. Make it fast enough. Then measure and repeat.

The tactics that promise shortcuts tend to end up on Google's spam policy page.

If you're planning an AEM migration or platform change and want the SEO risks covered before launch, [get in touch](/contact/).

### References

- [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) (Google Search Central)
- [Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) (Google Search Central)
- [A guide to Google Search ranking systems](https://developers.google.com/search/docs/appearance/ranking-systems-guide) (Google Search Central)
- [Spam policies for Google web search](https://developers.google.com/search/docs/essentials/spam-policies) (Google Search Central)
- [Influencing your title links in search results](https://developers.google.com/search/docs/appearance/title-link) (Google Search Central)
- [Understanding Core Web Vitals and Google search results](https://developers.google.com/search/docs/appearance/core-web-vitals) (Google Search Central)
- [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) (Google Search Central)
- [Navboost: what the docs tell us](https://seranking.com/blog/navboost/) (SE Ranking, on the trial testimony and API leak)

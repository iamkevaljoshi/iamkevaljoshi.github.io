---
layout: post
title: "AEM go-live checklist: the 40 things I check before launch"
seo_title: "AEM Go-Live Checklist: 40 Checks Before Launch (AEMaaCS and EDS)"
description: "A senior architect's AEM go-live checklist for AEM as a Cloud Service and Edge Delivery Services: 40 checks, a cutover timeline, go/no-go criteria, rollback and hypercare."
ai_summary: "A go-live on AEM as a Cloud Service or Edge Delivery Services succeeds or fails in the two weeks before launch. This checklist covers 40 checks across platform, CDN and DNS, Dispatcher, redirects, SEO, analytics and consent, performance, accessibility, security, content, integrations and monitoring, plus seven Edge Delivery Services specifics such as push invalidation and the redirects sheet. It adds a T-14 to T+14 cutover timeline, a go/no-go table, a rollback plan for a platform with no rollback button, and how to run hypercare."
date: 2026-11-08 13:00:00 +0530
category: aem-cloud-service
tags: [AEM as a Cloud Service, Edge Delivery Services, Go-live, Cloud Manager, SEO]
---

I've been on the bridge call for a lot of AEM launches. The ones that went badly rarely failed because of a big architectural mistake. They failed because of small things nobody owned: a `noindex` left over from stage, a DNS record with a 24-hour TTL, a redirect map that covered 80% of the old URLs, a consent banner that blocked the analytics everyone needed to judge the launch.

This is the checklist I use on AEM as a Cloud Service (AEMaaCS) and Edge Delivery Services (EDS) projects. It's 40 checks, plus seven that only apply to EDS. Each one is there because I've seen a launch suffer without it. After the checklist come a cutover timeline, a go/no-go table, a rollback plan and how I run hypercare.

If you're migrating from AEM 6.5 or Managed Services, read this alongside my [migration playbook]({{ '/blog/2026/11/aem-on-premise-and-managed-services-to-aem-as-a-cloud-service-migration/' | relative_url }}). That post covers how to get there; this one covers the last two weeks.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **Most launch problems are ownership problems.** Give every item below a named owner and a date, not a team.
- **Freeze code and content before launch, and launch with nothing new.** Adobe's own go-live checklist says the cutover should happen "without any new deployment or content update".
- **Lower DNS TTLs days before cutover,** and test on a production-like subdomain first.
- **Redirects, `noindex` and robots.txt** cause most post-launch SEO losses. Check them on the production hostname, not on stage.
- **There's no rollback button in Cloud Manager.** Plan rollback as "redeploy the previous release" for code and "point DNS back" for the platform, and rehearse both.
- **Hypercare is part of the launch.** Two weeks of daily checks on errors, 404s, Core Web Vitals, indexing and conversions.

## How to use this checklist

Copy it into whatever your team tracks work in. For each item, add three columns: **owner**, **due date** and **evidence** (a screenshot, a link, a log query). "Done" without evidence isn't done.

The items are grouped by area, roughly in the order I review them. Most apply to both AEMaaCS and EDS; where an item is specific to one, I say so.

![AEM cutover timeline from T-14 days to T+14 days: freeze and final rehearsals, DNS TTL lowered, final content top-up and go/no-go, cutover with no new deployments, then hypercare with daily checks]({{ '/assets/img/blog/aem-go-live/01-cutover-timeline.svg' | relative_url }}){: width="1200" height="560" loading="lazy" decoding="async"}

## The checklist

### Platform and environments (1–4)

- **1. Stage matches production.** Same code version, same AEM release, same OSGi and Dispatcher configuration, and a representative copy of production content. Adobe recommends running performance and security tests on a stage environment sized like production; development environments aren't.
- **2. The production pipeline has run end to end,** including custom functional and UI tests, and the release you'll launch is the one that passed. Note its Git tag. (My [Cloud Manager pipelines post]({{ '/blog/2026/11/aem-cloud-manager-pipelines-quality-gates-rde-config-pipeline/' | relative_url }}) covers the quality gates.)
- **3. Environment variables and secrets are set in production,** not just stage, and none are hard-coded in the repository.
- **4. Admin Console notification profiles are set up,** so the right people receive incident and maintenance emails from Adobe. This is on Adobe's checklist and is easy to forget.
{: .checklist}

### CDN, DNS and certificates (5–9)

- **5. Custom domains and SSL certificates are installed and valid** in Cloud Manager (or on your own CDN), including apex and `www`, with expiry dates recorded somewhere someone will see them.
- **6. A production-like test subdomain has been through UAT.** Adobe suggests pointing a test subdomain at production before go-live to check redirects, caching and Dispatcher behaviour. I treat this as mandatory.
- **7. DNS TTLs are lowered in advance.** Drop the TTL on records you'll change to around 300 seconds at least a day or two before cutover, so changes and any rollback propagate quickly. Raise it again after hypercare.
- **8. CDN configuration is deployed through the config pipeline:** traffic filter rules, redirects, headers and origin selectors. Rate limits and WAF rules start in **log mode** and move to **block** only after you've reviewed the logs. See my [cdn.yaml guide]({{ '/blog/2026/11/aem-cloud-service-cdn-yaml-headers-proxy-redirects/' | relative_url }}).
- **9. HTTP redirects to HTTPS everywhere,** and apex redirects to `www` (or the other way round), with a single hop, tested with `curl -I`.
{: .checklist}

### Dispatcher and caching (10–13)

- **10. Dispatcher configuration validates locally** with the SDK's validation tools, and the virtual hosts are reviewed. Adobe's checklist flags the default `ServerAlias *`; if you narrow it, keep the hosts Adobe lists plus your custom domains.
- **11. Cache headers are deliberate.** HTML, client libraries, images and APIs each have a known `Cache-Control` or `Surrogate-Control`, and personalised or authenticated responses are never cached.
- **12. Invalidation works:** publish a test page and confirm it updates on the production hostname within the expected time, through the CDN.
- **13. Dispatcher filters are tight.** Only the selectors, extensions and paths you expect are allowed; `/crx`, `/system`, `/bin` and unexpected JSON selectors are blocked on publish.
{: .checklist}

### Redirects and URLs (14–16)

- **14. The redirect map covers the URLs that matter,** not just the sitemap. Pull old URLs from analytics, Search Console (top pages and top linked pages) and server logs. Every high-traffic or high-backlink URL has a single-hop `301` to its closest new equivalent.
- **15. Redirects are tested automatically.** A script requests every old URL and checks the status code and final location. Run it on stage, on the test subdomain and again straight after cutover.
- **16. The 404 page returns a real `404` status,** is helpful (search, top links) and is tracked in analytics, so you can find missing redirects during hypercare.
{: .checklist}

### SEO and AI crawlers (17–21)

- **17. No `noindex` on production.** Check the meta robots tag and `X-Robots-Tag` header on the production hostname. Stage often blocks indexing on purpose; the risk is that the setting travels.
- **18. robots.txt is the production version,** allows important content, CSS and JavaScript, and points to the sitemap. Decide your AI crawler policy on purpose (see my [AI crawlers and llms.txt post]({{ '/blog/2026/11/llms-txt-ai-crawlers-robots-txt-what-to-allow/' | relative_url }})).
- **19. Sitemaps list only canonical, indexable, `200` URLs** on the production domain, with `hreflang` for multilingual sites.
- **20. Canonicals and `hreflang` use absolute production URLs.** A canonical pointing at a stage or `publish-p…adobeaemcloud.com` hostname is one of the most damaging and most common mistakes I see.
- **21. Search Console is ready:** the domain property is verified, the new sitemap is submitted at cutover, and someone has a baseline export of clicks and top pages from before launch. My [SEO priorities post]({{ '/blog/2026/11/what-actually-matters-in-seo/' | relative_url }}) has the wider checklist, and the [SEO audit tool]({{ '/tools/seo-audit/' | relative_url }}) runs most of these checks on a URL.
{: .checklist}

### Analytics, tags and consent (22–24)

- **22. Tags fire on the production hostname.** Analytics and tag management are often configured by hostname, and some tools behave differently on preview or stage domains. Check page views, key events and conversions in a debugger.
- **23. Consent works as designed:** the banner appears in the right regions, choices are honoured, and tags wait for consent where they must. A consent bug can mean either a compliance problem or no data on launch day.
- **24. Baselines exist.** Export the key metrics from the old site for the same period last year and the last four weeks: traffic by channel, conversion rate, top landing pages. Without a baseline, every post-launch conversation becomes opinion.
{: .checklist}

### Performance (25–27)

- **25. Core Web Vitals are within budget** on the key templates (home, listing, detail, form, article), on mobile, measured on production infrastructure. For EDS, the target is a Lighthouse score of 100 on mobile and desktop; my [EDS performance post]({{ '/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/' | relative_url }}) explains how.
- **26. Images are sized and modern.** Hero images are served at the right width in WebP or AVIF with `width` and `height` set, and nothing above the fold is lazy-loaded. For one-off assets, the [image optimiser]({{ '/tools/image-optimiser/' | relative_url }}) does this in the browser.
- **27. A load test has been run on stage** at expected peak traffic plus a margin, including cache-miss scenarios such as search, forms and personalised APIs. Know where it breaks before your customers find out.
{: .checklist}

### Accessibility (28–29)

- **28. No critical or serious automated issues** on the key templates, checked with axe or the [accessibility checker]({{ '/tools/accessibility-checker/' | relative_url }}).
- **29. A keyboard and screen-reader pass** on the main journeys: navigation, search, forms, checkout or contact. Fix issues in the component, not the page, as I describe in [accessibility on AEM]({{ '/blog/2026/11/accessibility-on-aem-fix-the-component-not-the-page/' | relative_url }}).
{: .checklist}

### Security and access (30–33)

- **30. Security headers are set:** HSTS, `X-Content-Type-Options`, `Referrer-Policy`, frame protection and a Content Security Policy (report-only first if it's new). The CDN is a good place for the static ones.
- **31. Author access follows least privilege.** Users are in groups, not given direct permissions; admin accounts are few and named; leavers and agency test accounts from the build are removed.
- **32. Publish is locked down:** no default credentials, no open author endpoints exposed through custom domains, and closed user groups or gated content tested as an anonymous user.
- **33. A basic security scan has passed** on stage (dependency checks, OWASP-style tests on forms and APIs) and any findings are triaged with a decision, not just a ticket.
{: .checklist}

### Content (34–36)

- **34. A content freeze is agreed and communicated,** with dates, exceptions (for example, urgent legal changes) and who approves them.
- **35. The final content top-up has run** and been verified: page counts, asset counts and spot checks of high-traffic pages. The [page comparison tool]({{ '/tools/web-page-comparison/' | relative_url }}) compares old and new URLs for UI and content parity.
- **36. Content authors are trained and ready,** with publishing permissions, workflows and a named person to call during hypercare.
{: .checklist}

### Integrations (37–38)

- **37. Every integration is pointed at production:** forms to CRM, search indexes, commerce, DAM connections, translation, identity. Test each with a real transaction and confirm it arrives at the other end.
- **38. Third-party allowlists include the new platform.** Systems that restrict inbound calls by IP or hostname need AEMaaCS egress details (or your dedicated egress IP, if you have advanced networking) before launch, not after.
{: .checklist}

### Monitoring and logging (39–40)

- **39. Logs are forwarded and searchable:** CDN, Dispatcher and AEM logs reach your log platform, and someone has saved queries for 5xx errors, 404s and blocked requests.
- **40. Alerts go to people who will act on them:** uptime checks on key URLs, error-rate alerts and certificate expiry, routed to an on-call rota for the launch window.
{: .checklist}

### Edge Delivery Services extras

If any part of the site is on EDS, add these. They come from Adobe's [EDS go-live checklist](https://www.aem.live/docs/go-live-checklist) and my own projects.

- **Production CDN points at the `main` branch** on `aem.live`. Adobe is explicit: "Always use the `main` branch for production sites."
- **Push invalidation is configured** for your CDN (Fastly, Akamai, Cloudflare, CloudFront or the Adobe-managed CDN), the CDN sends `X-Push-Invalidation: enabled` to the origin, and you've published a small change and seen it on the production domain.
- **The redirects sheet is filled in** with retired URLs, prioritising pages with backlinks in Search Console.
- **Sitemap and robots.txt are right for production.** EDS generates sitemaps from the query index and serves different robots.txt files on preview, live and production hosts. Check the production one.
- **Canonical URLs return `2xx`,** not a redirect or error.
- **Operational Telemetry is running before launch,** so you have a before-and-after comparison.
- **Adobe is told about the launch** by email to the address on the EDS go-live checklist, with your `aem.live` URLs, production domain, date, time and contact.
{: .checklist}

## The cutover timeline

Dates make the checklist real. This is the timeline I put in front of the steering group.

| When | What happens | Owner |
|---|---|---|
| **T-14 days** | Release candidate tagged; code freeze for anything but launch blockers. Redirect map final. Load test on stage. | Tech lead |
| **T-10 days** | UAT on the production-like subdomain: redirects, caching, forms, integrations, tags. | QA lead |
| **T-7 days** | Content freeze starts. Production deployment of the release candidate (not live yet). Security and accessibility sign-off. | Delivery manager |
| **T-3 days** | DNS TTLs lowered to about 300 seconds. Cutover runbook rehearsed, including rollback. | Platform owner |
| **T-1 day** | Final content top-up and verification. **Go/no-go meeting.** | Architect |
| **T-0** | DNS or CDN switch. No new deployments, no content changes. Smoke tests on the production hostname. Sitemap submitted. | Platform owner |
| **T+1 to T+3** | Hypercare: hourly then daily checks on errors, 404s, redirects, tags and conversions. Content freeze lifted when stable. | Whole team |
| **T+14 days** | Hypercare review. DNS TTLs raised. Lessons learnt written down. | Delivery manager |

Two rules for the day itself. **Launch early in the week and early in the working day** for your main market, so the team and Adobe support are available for the first hours. And **launch exactly what you tested**: the cutover is a DNS or CDN change, not a deployment.

## The go/no-go meeting

The day before launch, decide on evidence, not mood. I use a short table; any red in the first column is a no-go.

| Blocks launch | Launch with a plan | Doesn't block |
|---|---|---|
| Release candidate failed functional or UI tests | Minor visual defects on low-traffic pages | Cosmetic issues in authoring UI |
| Redirects missing for top traffic or top backlink URLs | Long-tail redirects not yet mapped (404s monitored) | Nice-to-have redirects for retired campaigns |
| `noindex` or wrong canonical on production templates | Some sitemap `lastmod` values inaccurate | Missing structured data on minor templates |
| Forms or transactions not reaching their systems | One integration on a manual fallback for a week | Reporting dashboards not yet rebuilt |
| Analytics or consent broken on key pages | A secondary tag delayed | New marketing tags requested last minute |
| Critical security or accessibility findings open | Moderate findings with fix dates | Minor findings in the backlog |
| No tested rollback | Rollback tested but slower than target | |

The middle column is where judgement lives. "Launch with a plan" means a named owner and a date for every item, recorded in the meeting notes.

## Rollback: plan it before you need it

Cloud Manager has no rollback button. That surprises people, but it shapes how you plan:

- **Code:** rolling back means redeploying the previous release tag through the production pipeline. That's a full pipeline run, so know how long it takes and keep the previous tag ready. This is one more reason to launch with no new deployments: if nothing changed, there's nothing to roll back.
- **CDN configuration:** revert the commit and rerun the config pipeline. It's fast, but someone has to be ready.
- **Content:** use page versions and a controlled republish for individual pages. For anything larger, check the current backup and restore options for your programme in Cloud Manager before launch day, not during an incident.
- **The platform:** if you're replacing an old site, the real rollback is pointing DNS (or your CDN origin) back at it. That only works if the old platform stays warm and unchanged for the hypercare period and your TTLs are low.

Rehearse the rollback at T-3 days. A rollback plan nobody has tried is a hope, not a plan.

## Hypercare: the first two weeks

The launch isn't done at T-0. For two weeks I run a short daily check with the team, using a fixed list:

| Check | Source | What "good" looks like |
|---|---|---|
| Errors | CDN and AEM logs | 5xx rate back to normal within hours |
| 404s | Analytics, logs, EDS 404 reports | Top 404s redirected daily; trend falling |
| Indexing | Search Console | Sitemap processed; no rise in excluded pages |
| Organic traffic | Search Console, analytics | Within normal variation of the baseline after the first week |
| Core Web Vitals | Field data, Operational Telemetry on EDS | At or better than pre-launch on key templates |
| Conversions | Analytics, CRM | Forms and transactions arriving; rate close to baseline |
| Blocked traffic | CDN logs | No legitimate users caught by traffic filters |

Expect some movement in organic traffic for a few weeks after a migration, even when everything is right. What you're looking for is a trend, not a single bad day. Keep the content freeze until the first daily checks are clean, then lift it in stages.

At T+14, hold a short review: what went well, what nearly went wrong, and what goes on the checklist next time. That last part is how this list got to 40.

## FAQ

**How long before launch should the code freeze start?**
I aim for about two weeks for code (launch blockers only) and about a week for content, then a final content top-up the day before. Smaller sites can compress this, but never to zero: you need time to test exactly what you'll launch.

**Do I need to tell Adobe about the go-live?**
For EDS, yes: the go-live checklist asks you to email Adobe with your URLs, domain, date and contact. For AEMaaCS, follow Adobe's go-live checklist, and if you use your own CDN, the routing setup goes through a support ticket. Either way, have your support contacts and escalation path ready before launch day.

**Should we launch on a Friday?**
No. Launch early in the week, early in the working day for your main market, when the team and support are available for the next 48 hours.

**What's the most common go-live mistake you see?**
A production setting copied from stage: `noindex`, a stage hostname in canonicals, or a test analytics property. Check every SEO and tracking item on the production hostname, after cutover, not just before.

**Can we keep the old site running after launch?**
Yes, and you should, unchanged and not indexed, for at least the hypercare period. It's your platform rollback and your reference for "what did the old page say?" questions.

**How do I know the launch was a success?**
Decide before launch: for example, error rates normal within 24 hours, 404s from old URLs under an agreed threshold within a week, organic traffic within normal variation of the baseline after a few weeks, and conversions at or above baseline. Then report against those numbers at T+14.

## Closing thought

A go-live checklist isn't about distrust. It's how a team turns hard-won lessons into habits, so the launch is boring. Boring is the goal: no surprises on the bridge call, a quiet first week, and a steering group that talks about results instead of incidents.

Take this list, add the things your own launches have taught you, and give every line an owner.

If you're planning an AEM as a Cloud Service or Edge Delivery Services launch and want a second pair of eyes on the plan, [get in touch](/contact/).

### References

- [Go-Live Checklist for AEM as a Cloud Service](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/onboarding/journey/go-live-checklist) (Adobe Experience League)
- [Go-Live for migrations to AEM as a Cloud Service](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/migration-journey/go-live) (Adobe Experience League)
- [Edge Delivery Services go-live checklist](https://www.aem.live/docs/go-live-checklist) (aem.live)
- [Push invalidation setup for production CDNs](https://www.aem.live/docs/setup-byo-cdn-push-invalidation) (aem.live)
- [Traffic filter rules including WAF rules](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/security/traffic-filter-rules-including-waf) (Adobe Experience League)
- [Configuring traffic at the CDN](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/content-delivery/cdn-configuring-traffic) (Adobe Experience League)

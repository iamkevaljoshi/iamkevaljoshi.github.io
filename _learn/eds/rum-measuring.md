---
title: "Measuring real users with RUM"
description: "How Operational Telemetry (RUM) on Edge Delivery Services shows real-visitor Core Web Vitals, and how to read it so you catch regressions the lab misses."
track: eds
level: 3
order: 18
minutes: 9
outcome: "By the end you can explain what Operational Telemetry collects, and use field data to tell whether a change helped or hurt real visitors."
prereq: "Lessons 15 to 17."
terms:
  - { t: "RUM (Real User Monitoring)", d: "Measuring performance from the browsers of real visitors rather than from a lab test." }
  - { t: "Operational Telemetry", d: "Adobe's name for the RUM data that Edge Delivery Services collects, sampled and without cookies." }
  - { t: "Core Web Vitals", d: "Google's three user-experience metrics: LCP, INP and CLS." }
  - { t: "75th percentile", d: "The value that 75 percent of visits are at or better than; the threshold Google uses to judge a page." }
  - { t: "Sampling", d: "Recording only a fraction of page views, which keeps the cost low but widens the margin of error on narrow filters." }
mistake: "Trusting one Lighthouse run and ignoring field data. A lab score is a single simulated load, so it misses slow phones, odd templates and scripts that misbehave later."
try_it:
  - "Read the Operational Telemetry page on aem.live and note what it says it collects and what it does not."
  - "Open the Operational Telemetry Explorer for your site (you will need the domain key) and look at LCP, INP and CLS."
  - "Filter by device type: compare mobile and desktop."
  - "Filter to one URL and note how the margin of error changes."
  - "Find the date of your last deploy and compare the week before with the week after."
  - "Write down one regression you would investigate first, and why."
quiz:
  - q: "Why do you need field data when you already have a Lighthouse score?"
    options:
      - "Lighthouse is inaccurate for all pages"
      - "Field data is faster to collect"
      - "Google ignores lab data completely"
      - "Real devices and interactions differ from one simulated load"
    answer: 3
    why: "Lab data is repeatable but narrow. Field data covers real devices, networks, templates and interactions, including INP. Lab data is not inaccurate, just limited."
  - q: "You filter the telemetry to a single low-traffic URL and the numbers look wild. What is the most likely reason?"
    options:
      - "Few sampled page views, so the margin of error is large"
      - "The URL is broken"
      - "Telemetry only works on the home page"
      - "The explorer cannot show single URLs"
    answer: 0
    why: "Telemetry samples a fraction of page views, so narrow filters leave few data points. Look at templates or broader groups before drawing conclusions."
  - q: "Your mobile LCP got worse the week after a release that added a tag. What is the sensible next step?"
    options:
      - "Ignore it, since the lab score is still 100"
      - "Wait for next month's report"
      - "Compare before and after for that release, then test the tag's loading phase"
      - "Disable telemetry to remove the noise"
    answer: 2
    why: "Most regressions line up with a deploy or a new tag, so comparing around the release narrows the cause quickly. A green lab score does not cancel a real-user regression."
  - q: "Which is NOT true about Operational Telemetry on EDS?"
    options:
      - "It samples a fraction of page views"
      - "It does not use cookies for identifying visitors"
      - "It records Core Web Vitals from real visits"
      - "It replaces the need for any lab testing"
    answer: 3
    why: "Field and lab data answer different questions. Lab runs are repeatable and fast for catching problems in a pull request. Field data confirms what visitors really experience."
go_deeper:
  - { title: "Edge Delivery Services performance: how to keep a 100 Lighthouse score after go-live", url: "/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/", why: "a weekly monitoring routine and alerting ideas" }
  - { title: "What actually matters in SEO", url: "/blog/2026/11/what-actually-matters-in-seo/", why: "how field metrics relate to search" }
  - { title: "Next lesson: Project, audit a slow page and fix it", url: "/learn/eds/project-fix-slow-page/" }
---
## The problem: the lab says green, the users say slow

A lab test is like a driving test on an empty road in good weather. Real visitors drive in rain, on old phones, with a dozen tabs open. Two sites with the same Lighthouse 100 can feel very different in practice. You need to see what real people experience.

That is **RUM**, real user monitoring. On Edge Delivery Services it comes built in, under the name **Operational Telemetry**.

## What gets measured

Operational Telemetry is collected by default. Adobe's documentation describes it as sampling a small share of page views, using no cookies or client-side identifiers for visitors, and not fingerprinting. It records Core Web Vitals plus checkpoints such as time to first byte. Two caveats from the docs matter in practice: iOS traffic does not report these metrics, and narrow filters widen the margin of error. Whether you must declare it in your privacy notice is a question for your privacy team.

The three Core Web Vitals, judged at the 75th percentile of visits, are:

| Metric | Asks | Good |
|---|---|---|
| LCP | When did the main content appear? | 2.5 s or less |
| INP | How fast does the page respond to input? | 200 ms or less |
| CLS | Does the page jump around? | 0.1 or less |

"75th percentile" means that three out of four visits must be at least this good. A site is not passing because the average looks fine.

## Where to look

The **Operational Telemetry Explorer** on aem.live charts these metrics over time. You can filter by device type, URL and checkpoint, and you need the domain key for your site. Start broad (the whole site, mobile), then narrow to a template or a section. Keep an eye on how the margin of error grows as you narrow, because sampling means a rarely visited URL has few data points.

Google also publishes field data you can see in PageSpeed Insights and in Search Console's Core Web Vitals report. That data comes from the Chrome UX Report over a rolling 28-day window, so it lags behind a fix. Telemetry is faster for checking a change; Search Console is closer to what Google sees.

## A simple weekly routine

1. **Check mobile first.** It is where problems show earliest.
2. **Compare around releases.** Put the date of each deploy next to the chart. A step change almost always has a cause you shipped.
3. **Go from metric to cause.** Poor LCP points at the hero image or something before it; poor CLS at images without dimensions, banners or fonts; poor INP at heavy handlers or late scripts.
4. **Write it down.** A regression you saw but did not record will happen again.

```text
Week 41  mobile  LCP 2.1 s   INP 150 ms  CLS 0.04   good
Week 42  mobile  LCP 3.4 s   INP 160 ms  CLS 0.05   LCP regressed
          note: release on Tuesday added a tag manager to head.html
Week 43  mobile  LCP 2.2 s   INP 150 ms  CLS 0.04   fixed, tag moved to consented.js
```

That table is illustrative, not real data, but it is the shape of a useful record.

<details markdown="1">
<summary>Why does this work if only a sample of visits is recorded?</summary>

Statistics. A random sample of a large number of visits describes the whole well, and the benefit is that collection costs almost nothing for visitors. The price is uncertainty on small groups, which is why you read the margin of error and prefer broad filters before concluding anything.

</details>

## Lab and field together

Use lab tools such as PageSpeed Insights and the site's [SEO audit tool](/tools/seo-audit/) for fast, repeatable checks on a pull request. Use telemetry to confirm what visitors really feel. The two together catch problems neither would alone.

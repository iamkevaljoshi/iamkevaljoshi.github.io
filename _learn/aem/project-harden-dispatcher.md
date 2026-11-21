---
title: "Project: harden and tune a Dispatcher configuration"
description: "A hands-on project: start from the Dispatcher SDK defaults, run a security probe on the filters, fix the findings, add caching rules and validate the configuration."
track: aem
level: 4
order: 28
minutes: 20
kind: project
outcome: "By the end you can harden a Dispatcher filter set against a security probe, add cache rules for a page and a static asset, and prove the configuration validates."
prereq: "Lessons 22 to 24, and the AEM as a Cloud Service SDK downloaded. A local AEM project from the Project Archetype helps, since it contains a `dispatcher` module."
terms:
  - { t: "Dispatcher SDK", d: "Adobe's download containing the Dispatcher tools, a Docker setup and the baseline configuration for AEM as a Cloud Service." }
  - { t: "Validator", d: "The `validate` script in the SDK that checks directives, Apache syntax and that immutable files were not changed." }
  - { t: "Security probe", d: "A fixed list of sensitive paths, such as the OSGi console or JSON dumps, that you test to prove they are blocked." }
  - { t: "Baseline", d: "The default filter and cache files from the SDK or archetype, which you include and then extend with your own rules." }
mistake: "Editing the immutable default files in the SDK. Your change works in a local test but is ignored in the cloud, so the hardening you think you did is not deployed. Add your rules in your own files after the include."
try_it:
  - "Open the `dispatcher/src` folder of your project. Locate `conf.dispatcher.d/filters/filters.any`, `conf.dispatcher.d/cache/rules.any` and your farm file, and confirm that `filters.any` includes `default_filters.any`."
  - "Run the validator before changing anything to get a clean baseline: from the SDK folder run `./bin/validate.sh <path to your dispatcher/src>`."
  - "Copy your filter rules (and the contents of the default filters they include) into the tester at /tools/aem-dispatcher-filter-tester/ and run the security probe. Record every path flagged as allowed."
  - "Fix each finding by tightening or adding rules in `filters.any`, retest in the tool until the probe is clean, and confirm a normal page URL and a clientlib URL are still allowed."
  - "Add cache rules and headers: deny caching for a personalised path, and set long immutable caching for versioned static assets and a short TTL for HTML in your vhost file."
  - "Re-run `validate.sh`, then optionally start the local Dispatcher with the SDK's Docker script and request a page twice to confirm the second answer comes from cache."
  - "Write your definition of done in a few lines and tick each against evidence."
quiz:
  - q: "You add an allow rule near the top of the filter list and a broad deny near the bottom. A request matches both. What decides?"
    options:
      - "The allow, because it appears first"
      - "The deny, because the last matching rule wins"
      - "The more specific rule, regardless of position"
      - "Neither, so the request is allowed by default"
    answer: 1
    why: "Order matters. The last matching rule decides, so a broad deny placed after your allow would block the request. Specificity does not matter to Dispatcher, only position."
  - q: "Your hardening works in the local tester and passes validate.sh, but a probe path is still open on the cloud environment. What is the most likely cause?"
    options:
      - "The CDN overrides Dispatcher filters on any cloud environment"
      - "The rule sits in an immutable default file that Cloud Manager ignores"
      - "The validator reuses cached results for up to a day after a change"
      - "Cloud environments do not apply filters in the same way at all"
    answer: 1
    why: "Changes to immutable default files are not transferred to the cloud. Rules belong in your own files, such as `filters.any`, after the include. The other options misdescribe how the platform works."
  - q: "Which cache setup for the project is sensible?"
    options:
      - "Cache the account page for a day to reduce load on publish"
      - "Ignore all query parameters, including the ones that the page really uses"
      - "Short HTML TTL, long immutable TTL for versioned files, personalised paths never cached"
      - "Give every file type the same one hour TTL to keep things simple"
    answer: 2
    why: "Different content has different change rates and privacy needs. Caching personalised pages leaks data, ignoring parameters a page really uses serves wrong content, and a single TTL fits nothing well."
  - q: "Which is a poor definition of done for this project?"
    options:
      - "The probe finds no allowed sensitive paths and normal pages still load"
      - "validate.sh reports no errors and no immutable file was modified"
      - "A page and a static asset each have a documented cache rule or header"
      - "The filters look tidier and fewer rules exist than before"
    answer: 3
    why: "Done must be provable. Fewer rules is not evidence of safety, and could mean you removed a needed allow. The other three are observable results you can show."
go_deeper:
  - { title: "AEM Dispatcher filter tester", url: "/tools/aem-dispatcher-filter-tester/", why: "the tool you use for the security probe" }
  - { title: "Dispatcher on AEM as a Cloud Service: caching rules, invalidation and the mistakes that cost you", url: "/blog/2026/11/dispatcher-on-aem-as-a-cloud-service-caching-and-invalidation/", why: "TTL recipes, validation and the review checklist" }
  - { title: "Dispatcher filters, caching and invalidation", url: "/learn/aem/dispatcher-filters-caching-invalidation/", why: "revisit the rules behind each step" }
  - { title: "The CDN and cdn.yaml", url: "/learn/aem/cdn-and-cdn-yaml/", why: "where edge rules complement this work" }
---
## The brief

You have inherited a Dispatcher configuration. It works, but nobody has checked what it exposes or how it caches. Your job is to leave it safer and faster, and to prove both.

The project follows the loop a real review uses: **measure, fix, measure again.** The security probe in the filter tester is your measuring stick for the filters. The validator is your measuring stick for deployability. You will not need a running cloud environment.

## Step 1: find the files that matter

In an archetype project the Dispatcher configuration lives under `dispatcher/src`. Three places matter:

```text
dispatcher/src/
  conf.dispatcher.d/
    filters/filters.any          # yours: includes default_filters.any
    cache/rules.any              # yours: includes default_rules.any
    available_farms/mysite.farm  # your farm (statfileslevel, ignoreUrlParams)
  conf.d/available_vhosts/mysite.vhost   # yours: headers and TTLs
```

Your files include the defaults and add to them. The `default_*` files are immutable: edit them and nothing changes in the cloud. If your project is still on the legacy layout, treat that as a finding and note it, because the later steps assume the flexible layout.

## Step 2: get a clean baseline

Run the validator before touching anything, so you know failures you see later are yours:

```bash
./bin/validate.sh path/to/dispatcher/src
```

It runs in phases: allowed directives and required includes, Apache syntax, and a check that immutable files are unchanged. Expect it to pass on a fresh archetype.

## Step 3: run the security probe

Open the [Dispatcher filter tester](/tools/aem-dispatcher-filter-tester/). Paste the contents of your `filters.any` and the default filters it includes, because the tool reads rules you paste and does not follow `$include` itself. Run the **security probe**. It tests paths that should never reach publish, such as the OSGi console, CRXDE, Query Builder, and JSON dumps like `.infinity.json`, and confirms a normal page is still allowed.

Write down every path reported as allowed. A baseline from the SDK should be close to clean, but a project that has added a broad rule often is not.

## Step 4: fix the findings

Fix each finding in `filters.any`, after the include. Prefer removing a broad allow over adding more denies. A typical repair replaces a path-only allow with one that names the extension:

Before, this rule allows every rendering under the site, including JSON dumps:

```text
/0100 { /type "allow" /method "GET" /path "/content/mysite/*" }
```

After, it allows only what the site needs:

```text
/0100 { /type "allow" /method "GET" /path "/content/mysite/*" /extension '(html|json)' /selectors '(model)?' }
```

Treat that as a pattern, not a recipe: write the narrowest rule that your own site needs, and remember the last matching rule wins. Re-run the probe after each change. Check that your home page and one clientlib URL are still allowed, or you have broken the site rather than secured it.

## Step 5: add caching rules

Add two deliberate decisions. First, in `rules.any`, deny caching for a personalised path:

```text
$include "./default_rules.any"
/0100 { /glob "/content/mysite/*/account/*" /type "deny" }
```

Second, in your vhost, give a page and a versioned static asset their own headers, following the pattern from the Dispatcher blog post: a short `max-age` with `stale-while-revalidate` for HTML, a long immutable value for versioned client libraries, and `private` for the account path. Scope each `LocationMatch` tightly.

## Step 6: validate and, optionally, run it

Run `validate.sh` again. It should pass with no immutable file modified. If you have Docker, the SDK includes a script to start Dispatcher locally against a publish instance. Request one page twice and compare response headers. A cache hit is evidenced by identical content with no new work on the publish side.

## Definition of done

- The security probe reports **no sensitive path allowed**, and a normal page and clientlib are still **allowed**.
- `validate.sh` **passes**, and you changed **no** `default_*` file.
- A personalised path is **excluded from cache**, a page has a **short TTL**, and a versioned static asset has a **long immutable TTL**.
- You can state, for each of those, **which layer** (browser, CDN, Dispatcher) is controlled by which setting.

<details markdown="1">
<summary>Stretch question: what could still go wrong even if every box above is ticked?</summary>

The tester is an approximation of Dispatcher's matching, and a probe checks a fixed list of paths. It cannot know your custom endpoints. Run the real Dispatcher against a publish instance, test your own sensitive URLs, and ask a second person to review the filters. Also remember the CDN may still hold a copy until its TTL ends.

</details>

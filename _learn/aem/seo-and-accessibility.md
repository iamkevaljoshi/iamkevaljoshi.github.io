---
title: "SEO and accessibility on AEM"
description: "The SEO and accessibility basics an AEM project owns: canonical URLs, sitemaps, robots.txt, hreflang, structured data, semantic HTML and component accessibility."
track: aem
level: 4
order: 27
minutes: 9
outcome: "By the end you can list the SEO signals and accessibility basics an AEM component or template must get right, and where each is controlled."
prereq: "Dispatcher filters, caching and invalidation (lesson 23)."
terms:
  - { t: "Canonical URL", d: "The one address you declare as the preferred version of a page, so duplicates do not split search signals." }
  - { t: "Sitemap", d: "An XML file listing the URLs you want search engines to discover." }
  - { t: "hreflang", d: "Markup that tells search engines which language or region version of a page to show to which audience." }
  - { t: "Structured data (JSON-LD)", d: "A block of machine-readable facts about a page, such as an article or a product, that search engines can read." }
  - { t: "Semantic HTML", d: "Using elements for their meaning (headings, lists, buttons, landmarks) so browsers and assistive technology understand the page." }
mistake: "Treating accessibility and SEO as page-level fixes by authors. Most failures are built into components and templates, so fixing one page leaves the same defect on every page that uses the component."
try_it:
  - "Open a page of your site, view source and find the `<link rel=\"canonical\">`, the `<title>`, the meta description and any `<script type=\"application/ld+json\">` block."
  - "Request `/robots.txt` and the sitemap URL for your site. Does robots.txt point at the sitemap? Are important pages blocked?"
  - "Run the page through the SEO audit tool at /tools/seo-audit/ and note two findings."
  - "Run the same page through the accessibility checker at /tools/accessibility-checker/ and find one issue that comes from a component, not content."
  - "Tab through the page with only the keyboard. Can you see where focus is at every step, and reach every control?"
quiz:
  - q: "A page is reachable at three URLs (with a tracking parameter, with `www`, and without). What should you do for SEO?"
    options:
      - "Leave it, since search engines always pick the right one"
      - "Block the duplicate URLs in robots.txt"
      - "Declare one canonical URL and redirect or point the others to it"
      - "Add the page to the sitemap three times"
    answer: 2
    why: "Duplicates split signals, and you should name a single preferred URL. Blocking in robots.txt stops crawling but does not consolidate signals. Listing all three in the sitemap makes the confusion worse."
  - q: "An author fixes a missing `alt` text on one image. The same component is on 200 pages with the same defect in its markup. What is the better fix?"
    options:
      - "Repeat the same author fix by hand on every one of those pages"
      - "Fix the component so alt text is required or decorative images are handled"
      - "Add a single ARIA label to the page template to cover them all"
      - "Hide the image on all pages until the team has time to look at it"
    answer: 1
    why: "A defect in the component or its authoring dialog repeats everywhere. Fixing it once, for example by requiring alt text or offering a decorative option, keeps new pages right too."
  - q: "When should you reach for ARIA attributes?"
    options:
      - "On every element, to be safe"
      - "Instead of using headings and buttons"
      - "Only when native HTML cannot express the behaviour, such as a custom tab widget"
      - "Only to make the page score better in audits"
    answer: 2
    why: "Native elements already carry meaning and keyboard behaviour. ARIA is for gaps, and wrong ARIA can make things worse. Using it everywhere or instead of real elements is a common mistake."
  - q: "Which is NOT true of a sitemap on AEM?"
    options:
      - "It helps discovery but does not guarantee indexing"
      - "It can be generated from the pages you mark as sitemap roots"
      - "It should list URLs that are public and canonical"
      - "Once generated, it needs no filter or access rule on the web tier"
    answer: 3
    why: "The sitemap is requested like any other URL, so the Dispatcher filter must allow it. A sitemap is a hint to crawlers, not a promise, and it should list the canonical public URLs."
go_deeper:
  - { title: "What actually matters in SEO", url: "/blog/2026/11/what-actually-matters-in-seo/", why: "the priority stack, with an AEM section" }
  - { title: "Accessibility on AEM: fix the component, not the page", url: "/blog/2026/11/accessibility-on-aem-fix-the-component-not-the-page/", why: "common component failures and a definition of done" }
  - { title: "Hreflang checker and generator", url: "/tools/hreflang-checker-generator/", why: "build and check language alternates" }
  - { title: "SEO audit", url: "/tools/seo-audit/", why: "check a page's basics" }
  - { title: "Accessibility checker", url: "/tools/accessibility-checker/", why: "scan markup for common problems" }
---
## Why these two belong together

Search engines and screen readers have something in common. Neither sees your design. They read your HTML, in order, and rely on it to say what things mean. A page that is clear to one is usually clear to the other. And both problems are usually decided by developers in templates and components, not by authors page by page.

## The SEO signals your project owns

**Canonical URL.** Each page should have one preferred address, declared with `rel="canonical"`, so `www`, tracking parameters and trailing slashes do not split the page's signals. On AEM, also keep redirects and shortened URLs consistent at the CDN and Dispatcher layers, as covered in earlier lessons.

**Sitemap.** AEM as a Cloud Service uses the Apache Sling Sitemap module. In outline, you mark a page as a sitemap root, configure the scheduler that regenerates sitemaps, and the XML is served on the content path with a sitemap selector. Because a sitemap is requested like any other URL, your Dispatcher filter must allow it.

**robots.txt.** It controls crawling, not indexing. To keep a page out of results use `noindex`. Never block the CSS and JavaScript needed to render the page.

**hreflang.** For language and region copies (lesson 20), each page lists its alternates, including itself, with the matching language code. Errors are common when copies are added manually, so a generator or checker helps.

**Metadata fields.** The page title, description and Open Graph fields come from page properties. A good template renders them into `<head>` and gives authors sensible defaults.

**Structured data.** Facts such as an article, a breadcrumb or a product can be emitted as JSON-LD by the component that owns them:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "${page.title}",
  "datePublished": "${page.published}"
}
</script>
```

In HTL the expressions use `${...}`. Escape values for the right context so a quote in a title cannot break the JSON.

## Accessibility basics

The foundation is simple and mostly free if you start with it:

- **Semantic HTML.** Real headings in order, lists as lists, and `<button>` for actions and `<a>` for navigation.
- **Text alternatives.** Meaningful images need `alt` text. Decorative ones need an empty `alt` so assistive technology skips them.
- **Keyboard and focus.** Everything usable with a mouse must work with the keyboard, in a logical order, with a visible focus indicator.
- **ARIA only when needed.** Native elements already carry roles and keyboard behaviour. Use ARIA to fill gaps such as a custom tab widget, and not to cover for a div that should have been a button.

## Fix it in the component

Suppose a card component wraps a whole card in a link with a vague "Read more" label. Fixing one page changes one card. Fixing the component changes every card, including those not yet authored. Add dialog rules so authors cannot publish an image without alt text or a decorative choice, and test components with the keyboard and an automated checker before release. AEM Core Components give you a strong start, but they do not cover your custom markup or your content.

<details markdown="1">
<summary>Stretch question: why might a perfect automated accessibility score still hide problems?</summary>

Automated checks catch only a share of issues, mainly missing attributes and obvious contrast errors. They cannot tell whether alt text is meaningful, whether the focus order makes sense, or whether a custom widget is usable with a screen reader. Manual keyboard testing and some assistive technology testing are needed too.

</details>

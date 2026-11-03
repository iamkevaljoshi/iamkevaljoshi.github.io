---
layout: post
title: "Accessibility on AEM: fix the component, not the page"
seo_title: "AEM Accessibility: Fix Components, Not Pages (WCAG 2.2)"
description: "Why accessibility on AEM Sites and Edge Delivery Services is a component problem: legal context, common failures with HTL and block fixes, testing, governance."
date: 2026-11-03 17:00:00 +0530
category: digital-experience
tags: [Accessibility, WCAG 2.2, AEM, Edge Delivery Services]
---

The first accessibility audit I ran on a large AEM estate came back with thousands of issues. The client's first instinct was to raise a ticket for each one and hand them to the content team. When we grouped the findings by the component that produced them, almost all of them traced back to about a dozen components: the header, a card, a carousel, a custom accordion, the footer, a form field, and a couple of templates. The remainder were authoring choices: missing alt text, skipped heading levels, "Read more" links.

That's the defining trait of accessibility on component-based platforms. AEM Sites with Core Components and HTL, and Edge Delivery Services (EDS) with blocks, both assemble pages from a small set of reusable parts. A defect in one part repeats on every page that uses it. So does a fix.

Here's how I approach accessibility on AEM programmes, from the legal context to component fixes, authoring guardrails, testing and governance.

<nav class="toc" aria-label="Contents" markdown="1">
**Contents**

* TOC
{:toc}
</nav>

{::options toc_levels="2" /}

## TL;DR

- **Accessibility on AEM is a component problem first.** Most issues live in a handful of components, templates and policies. Fix them once and thousands of pages improve on the next deployment.
- **The legal floor has risen.** The European Accessibility Act has applied since 28 June 2025, the US ADA Title II rule sets WCAG 2.1 AA for public entities (now due April 2027 and April 2028), and India's GIGW 3.0 targets WCAG 2.1 AA. Build to **WCAG 2.2 AA** so you don't have to rework when standards catch up.
- **Responsibility splits three ways:** developers own markup, ARIA, keyboard and focus; designers own contrast, focus styles and target size; authors own alt text, headings, link text and captions. Templates and policies are where you make authors' jobs easy.
- **Core Components are a good start, not a guarantee.** Adobe's own conformance report lists gaps, and your custom components and CSS can undo what Core Components get right.
- **On EDS, your `decorate()` functions are the component.** They must output semantic HTML, keep document headings and alt text, and add ARIA and keyboard support where the pattern needs it.
- **Automate what you can, test the rest by hand.** axe-core in Playwright, pa11y and Lighthouse catch a meaningful share of issues by volume; keyboard and screen reader testing catches the rest.
- **Make it part of the definition of done:** accessibility acceptance criteria on every component ticket, an accessibility statement, and an ACR if you sell software.

## Why now: the legal landscape in late 2026

I'm not a lawyer, and you should get legal advice for your markets. But the direction is clear, and every client conversation I have now starts here.

| Jurisdiction | Instrument | Technical baseline | Status |
|---|---|---|---|
| **EU** | European Accessibility Act (Directive 2019/882) | EN 301 549 | Applies to in-scope products and services since **28 June 2025**. Covers e-commerce, consumer banking, e-books, electronic communications, some transport services and more. Microenterprises providing services are exempt. |
| **EU** | EN 301 549 **V3.2.1** | WCAG **2.1** AA | The version currently cited for presumption of conformity |
| **EU** | EN 301 549 **V4.1.1** | WCAG **2.2** AA | Published **2 September 2026**; not yet cited in the Official Journal, so V3.2.1 remains the legal reference for now |
| **US** | ADA Title II rule (state and local government) | WCAG **2.1** AA | An interim final rule in April 2026 moved compliance to **26 April 2027** (populations of 50,000+) and **26 April 2028** (smaller entities and special districts). The technical standard didn't change. |
| **India** | RPwD Act 2016, IS 17802, GIGW 3.0 | WCAG **2.1** AA | GIGW 3.0 applies to government websites and apps; IS 17802 is the national ICT accessibility standard aligned with WCAG 2.1 and EN 301 549 |

Two practical conclusions:

1. **Build to WCAG 2.2 AA.** It's a superset of 2.1 (minus the obsolete 4.1.1 Parsing), EN 301 549 V4.1.1 already references it, and the new criteria (Focus Not Obscured, Dragging Movements, Target Size, Consistent Help, Redundant Entry, Accessible Authentication) mostly concern components you're building anyway.
2. **Treat it as a platform capability, not a project.** A one-off remediation decays within a few release cycles unless the component library and authoring process hold the line.

## One component, many pages

![Diagram: five shared components feed templates and policies, which render on every page. Responsibilities are split between developer, designer and author.]({{ '/assets/img/blog/aem-accessibility/01-one-component-many-pages.svg' | relative_url }}){: width="1200" height="600" loading="lazy" decoding="async"}

On AEM, a page is a composition: a template, a few container components, and content components with author-supplied values. Issues therefore fall into three buckets, and each needs a different owner and a different fix.

| Bucket | Example | Fixed by | Scope of fix |
|---|---|---|---|
| **Component code** | Accordion headers are `div`s with click handlers | Developer | Every instance, next deployment |
| **Design system** | Brand grey text at 3.2:1 on white; focus outline removed in a CSS reset | Designer and front-end developer | Every instance, next deployment |
| **Authored content** | Alt text "image1.jpg", H2 followed by H5, "Click here" links | Author, guided by policies | Page by page, unless a guardrail prevents it |

When I triage an audit, I tag every finding with a bucket and the component that produced it, then sort by pages affected. That usually shows that fixing ten components resolves most of the volume, which changes the conversation with budget holders.

### Where responsibility sits

- **Developers:** semantic HTML, correct ARIA (or none), accessible names, keyboard operation, focus management, status messages, and the authoring dialog itself.
- **Designers:** contrast (4.5:1 for normal text, 3:1 for large text and UI components), visible focus styles, target size (24 × 24 CSS pixels minimum under WCAG 2.2), reflow and motion.
- **Authors:** meaningful alt text (or marking an image decorative), logical headings, descriptive link text, captions and plain language.
- **Architects:** templates, policies and models that make the right thing easy. That's the lever most programmes underuse.

## The component failures I see most, and how to fix them

These come from audits of AEM Sites and EDS projects. The patterns are well documented in the W3C ARIA Authoring Practices Guide (APG); the failures are in how teams implement them.

### Accordion and tabs

**The failure:** clickable `div`s, no `aria-expanded`, panels hidden with `display:none` but the header not focusable, or tab widgets built from links that reload the page. Heading levels are hard-coded, so an accordion inside an H3 section emits H2s.

**The fix:** a real `button` inside a heading, with the heading level configurable by policy. The Core Components accordion already uses buttons and lets you configure the heading element; custom accordions often don't.

```html
<!-- HTL: custom accordion item -->
<div class="acme-accordion" data-sly-use.acc="com.acme.core.models.Accordion">
  <sly data-sly-list.item="${acc.items}">
    <h3 data-sly-element="${acc.headingElement}" class="acme-accordion__heading">
      <button type="button" class="acme-accordion__button"
              id="${item.id}-button"
              aria-expanded="${item.expanded ? 'true' : 'false'}"
              aria-controls="${item.id}-panel">${item.title}</button>
    </h3>
    <div class="acme-accordion__panel" id="${item.id}-panel"
         role="region" aria-labelledby="${item.id}-button"
         hidden="${!item.expanded}">
      <sly data-sly-resource="${item.path}"></sly>
    </div>
  </sly>
</div>
```

For tabs, follow the APG pattern: `role="tablist"`, `role="tab"` with `aria-selected` and `aria-controls`, roving `tabindex`, and arrow-key navigation. If your "tabs" navigate to other pages, they're navigation, not tabs: use a `nav` with a list of links and `aria-current="page"`.

### Carousel

**The failure:** autoplay with no pause control, slide changes that steal focus, unlabelled previous and next icons, hidden slides still in the tab order, and dots that are 8 pixels wide.

**The fix:** no autoplay by default. If the business insists, provide a visible pause button (WCAG 2.2.2), pause on hover and focus, label controls, make inactive slides `inert` or hidden, and make indicators at least 24 × 24 pixels. The Core Components carousel has an Accessibility tab with labels for the carousel, previous, next, play, pause and the item list, plus an option to use each item's title as its label. Automatic transitions are an author option; I turn the default off in the design dialog policy and keep it off.

My honest opinion: most carousels shouldn't exist. If a stakeholder wants one, I ask what proportion of users see slide three. Analytics usually settles it.

### Mega-menu and header

**The failure:** top-level items that open on hover only, submenus that can't be closed with Escape, `role="menu"` applied to site navigation (which makes screen readers expect application-style menus), and a sticky header that covers the focused element when tabbing (WCAG 2.2 Focus Not Obscured).

**The fix:** disclosure navigation. Each top-level item is a `button` with `aria-expanded` that toggles a list of links. Escape closes the open panel and returns focus to its button. Don't use `role="menu"` for website navigation. Add `scroll-padding-top` equal to the sticky header height so focused elements aren't hidden behind it.

The EDS boilerplate header is a reasonable start: it toggles `aria-expanded`, labels the hamburger button and closes on Escape. Teams then add hover-only flyouts and break it, so retest after every design change.

### Modal dialogs

**The failure:** a `div` overlay where focus escapes to the page behind, no Escape handling, and focus lost on close.

**The fix:** use the native `dialog` element with `showModal()`. It makes the rest of the page inert, handles Escape and supports `aria-labelledby`. You still need to return focus to the trigger on close.

```js
// Works in an HTL clientlib or an EDS block
function openModal(trigger, dialog) {
  dialog.showModal();
  dialog.addEventListener('close', () => trigger.focus(), { once: true });
}
```

### Cards with full-card links

**The failure:** the whole card wrapped in an `a`, so a screen reader announces the title, description, date and "Read more" as one long link; or a card with three links to the same URL (image, title, "Read more"), tripling the tab stops.

**The fix:** one real link on the title, stretched over the card with a pseudo-element. The card stays clickable, the link name is the title, and there's one tab stop.

```html
<article class="card">
  <img src="${card.image}" alt="" loading="lazy">
  <h3 class="card__title"><a class="card__link" href="${card.link}">${card.title}</a></h3>
  <p>${card.description}</p>
</article>
```

```css
.card { position: relative; }
.card__link::after { content: ""; position: absolute; inset: 0; }
.card:focus-within { outline: 3px solid var(--focus-colour); outline-offset: 2px; }
.card__link:focus { outline: none; } /* the card shows focus instead */
```

The image is decorative here because the title carries the meaning. If the image adds information the title doesn't, give it real alt text.

### Forms

**The failure:** placeholder used as the label, errors shown only in red, error messages not associated with fields, and required fields marked with a red asterisk that's never announced.

**The fix:** a visible `label` for every input, `aria-describedby` linking hint and error text, `aria-invalid="true"` on invalid fields, an error summary linking to each field, and `autocomplete` on personal data fields (WCAG 1.3.5). WCAG 2.2 adds Redundant Entry and Accessible Authentication, which matter for multi-step and login forms. Test AEM Forms output as rigorously as your own components.

### Video and media

**The failure:** autoplaying background video with no pause, embedded players without captions, and transcripts nobody asked authors for.

**The fix:** a pause control for any motion longer than five seconds, captions as a required field in the video component dialog or block, a transcript link option, and respect for `prefers-reduced-motion`.

### Icon buttons

**The failure:** a search, close or share button that contains only an SVG, giving it no accessible name.

**The fix:** an accessible name on the button and the icon hidden from assistive technology.

```html
<button type="button" class="icon-button" aria-label="${'Close' @ i18n}">
  <svg aria-hidden="true" focusable="false"><use href="#icon-close"></use></svg>
</button>
```

Use the `i18n` option so the label is translated with the rest of the site. Hard-coded English `aria-label`s on a localised site are one of the most common findings in multi-language AEM estates.

## What Core Components give you, and where they stop

Core Components are the best default on AEM Sites. The image component supports alt text, can take its description from the DAM asset, and has a "decorative" option. The title component lets you restrict heading levels by policy. The accordion uses buttons and a configurable heading element. The carousel has the labelling options described above.

But be precise about what that means:

- **Adobe's published conformance report for Core Components is dated September 2021** and evaluates WCAG 2.0 and 2.1 at A and AA, Section 508 and EN 301 549 V3.1.1. It doesn't cover WCAG 2.2.
- **It lists partial support in several places**, including undeclared decorative chevrons in breadcrumb and accordion, nested accordion heading levels, Text component tables without programmatic headers, missing focus indicators on teaser image links, and text over images that may lack contrast.
- **Your proxy components and CSS can undo it all.** A `:focus { outline: none; }` in a reset stylesheet fails WCAG whatever the HTL does.
- **Authors can still get it wrong.** An alt text field doesn't ensure useful alt text.

My rule: start from Core Components, test each proxy as if you'd written it yourself, and document known gaps and fixes per component.

## Edge Delivery Services: the block is the component

On EDS, a block's `decorate(block)` function turns the author's table into the final DOM. That function is your component, so it carries the same responsibilities as HTL.

- **Headings come from the document.** An author's Heading 2 becomes an `h2`. Don't restyle a block's first paragraph to look like a heading; if a block needs a heading, keep or create a real one.
- **Alt text comes from the document image.** Authors set it in Word or Google Docs (or in the Universal Editor, for AEM-authored EDS). Make sure your block passes it through: `createOptimizedPicture(img.src, img.alt)` rather than an empty string.
- **Preserve semantics when restructuring.** The boilerplate cards block converts rows into a `ul` of `li`s, which is correct for a list of cards. Don't flatten that into `div`s.
- **Add ARIA and keyboard support in JavaScript where the pattern needs it.** A tabs block, for example:

```js
// blocks/tabs/tabs.js
export default function decorate(block) {
  const tablist = document.createElement('div');
  tablist.setAttribute('role', 'tablist');
  const uid = Math.random().toString(36).slice(2, 7);

  const tabs = [...block.children].map((row, i) => {
    const [label, content] = row.children;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.id = `tab-${uid}-${i}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `panel-${uid}-${i}`);
    tab.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    tab.tabIndex = i === 0 ? 0 : -1;
    tab.textContent = label.textContent.trim();

    content.id = `panel-${uid}-${i}`;
    content.setAttribute('role', 'tabpanel');
    content.setAttribute('aria-labelledby', tab.id);
    content.hidden = i !== 0;
    block.append(content);
    row.remove();
    tablist.append(tab);
    return { tab, content };
  });

  const select = (next) => tabs.forEach(({ tab, content }, i) => {
    const on = i === next;
    tab.setAttribute('aria-selected', on ? 'true' : 'false');
    tab.tabIndex = on ? 0 : -1;
    content.hidden = !on;
    if (on) tab.focus();
  });

  tablist.addEventListener('keydown', (e) => {
    const current = tabs.findIndex(({ tab }) => tab === document.activeElement);
    const keys = { ArrowRight: 1, ArrowLeft: -1 };
    if (e.key in keys) select((current + keys[e.key] + tabs.length) % tabs.length);
    if (e.key === 'Home') select(0);
    if (e.key === 'End') select(tabs.length - 1);
  });
  tabs.forEach(({ tab }, i) => tab.addEventListener('click', () => select(i)));
  block.prepend(tablist);
}
```

- **Don't trust the Lighthouse score alone.** EDS projects work hard to [keep Lighthouse at 100](/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/), and the pull request check runs PageSpeed Insights. Lighthouse's accessibility category is a useful floor, but a 100 there means "no automatically detectable issues on this URL", not "accessible".

If you're choosing between authoring models, the guardrails differ a lot. I cover that in [Universal Editor vs document-based authoring](/blog/2026/11/universal-editor-vs-document-based-authoring/), and the wider platform trade-offs in [EDS vs traditional AEMaaCS](/blog/2026/11/aem-edge-delivery-services-vs-traditional-aemaacs/).

## Authoring guardrails: make the right thing the easy thing

In my audits, authors produce a sizeable share of issues, and they're rarely to blame: they were given an optional alt field and a rich text editor offering H1 to H6. Here's what I configure.

| Guardrail | AEM Sites | EDS |
|---|---|---|
| **Alt text** | Image component policy: enable "Get alternative text from DAM" so the asset's description is reused; make the asset's description field required in the Assets metadata schema; keep the "decorative" option for genuinely decorative images | Train authors to set alt text in Word or Google Docs; with Universal Editor, make the alt field `required` in the component model |
| **Heading levels** | Title component policy restricts allowed heading types; template structure fixes the H1 | Keep headings in the document; review with a heading-outline check in preview |
| **Rich text** | RTE paragraph formats limited by policy (no H1 in body text, no underline) | Document styles; avoid manual bold "headings" |
| **Colour and contrast** | Style System offers only pre-approved, contrast-checked variants; no free colour pickers | Block variants map to tested CSS, not author-chosen colours |
| **Link text** | Component labels like "Link text (describe the destination)"; avoid a free-text "Read more" default | Author guidance and a preview check for generic link text |
| **Captions** | Caption or transcript as a required field in the video component | Same, in the block model or table structure |

Two caveats. A required field in the Assets metadata schema flags assets missing it, but doesn't by itself block publishing; add a workflow check if that matters. And required fields only force *a* value: "image" is a value. Pair every guardrail with a short author guide on what good alt text looks like.

## Testing: an accessibility pyramid

| Layer | Tools | What it catches | When it runs |
|---|---|---|---|
| **Static and unit** | axe-core in Jest (via jsdom) for block and clientlib output | Missing names, invalid ARIA, duplicate IDs | Every commit |
| **Component** | `@axe-core/playwright` against a component library page per component and variant | The above, in a real browser, including contrast | Every pull request |
| **Page** | pa11y-ci or Lighthouse CI on key templates; Cloud Manager Experience Audit; the EDS PageSpeed Insights check | Regressions on real content | Every deployment |
| **Spot checks** | My free [accessibility checker](/tools/accessibility-checker/), browser extensions | Quick triage of any URL | Ad hoc |
| **Manual** | Keyboard only, NVDA with Firefox or Chrome, VoiceOver on macOS and iOS, TalkBack, 200% and 400% zoom | Focus order, meaningful names, announcements, logic, usability | Every new component, before release |

Because AEM projects tend to use vanilla JavaScript (EDS) or HTL with clientlibs, JSX linting plugins don't apply. axe-core is the workhorse instead:

```js
// tests/a11y/accordion.spec.js
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('accordion: no detectable WCAG 2.2 AA violations', async ({ page }) => {
  await page.goto('/content/acme/library/accordion.html');
  await page.getByRole('button', { name: 'Shipping' }).click(); // test the open state too
  const results = await new AxeBuilder({ page })
    .include('.acme-accordion')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
```

```json
{
  "defaults": { "standard": "WCAG2AA", "runners": ["axe", "htmlcs"], "timeout": 30000 },
  "urls": [
    "https://stage.example.com/en.html",
    "https://stage.example.com/en/products/sample-product.html",
    "https://stage.example.com/en/contact.html"
  ]
}
```

**How much does automation catch?** Deque's 2021 study of over 2,000 audits found that, on average, 57% of accessibility issues *by volume* were covered by its automated axe testing. That's counted by issue count, not by WCAG success criteria, and it's a vendor measuring its own tool; frequent, easy-to-detect issues like contrast push the figure up. Whether alt text is *meaningful*, whether focus order makes sense, whether a screen reader user can complete checkout: those need a person. Automation stops regressions; it doesn't prove conformance.

The most valuable manual test is still the cheapest: unplug the mouse and try to complete the top three journeys with the keyboard. I do it in every sprint review where a new component is demoed.

## Governance: keeping it fixed

### Definition of done for a component

Every component or block ticket I write includes acceptance criteria like these:

- [ ] Semantic HTML: correct elements for headings, lists, buttons and links; landmarks where relevant
- [ ] Every interactive element is reachable and operable by keyboard, in a logical order, with a visible focus indicator (3:1 against adjacent colours)
- [ ] Every interactive element has an accessible name; icon-only controls have a translated label
- [ ] ARIA follows the APG pattern for the widget, or isn't used at all
- [ ] Text contrast at least 4.5:1 (3:1 for large text); UI components and focus indicators at least 3:1
- [ ] Targets at least 24 × 24 CSS pixels or adequately spaced
- [ ] Works at 320 CSS pixel width and at 400% zoom without horizontal scrolling
- [ ] No content flashes or moves for more than five seconds without a pause control; respects `prefers-reduced-motion`
- [ ] The authoring dialog or block model enforces required accessibility fields (alt, captions, heading level)
- [ ] axe test in CI passes for every variant and state; keyboard and screen reader test recorded

### Statements and reports

- **Accessibility statement.** Publish one: the standard you target, known limitations, a contact route and a response time. Under the EAA, service providers must also explain how their service meets the accessibility requirements, so align the statement with your legal team's view of that obligation.
- **ACR (VPAT).** If you sell software or a platform built on AEM, customers will ask for an Accessibility Conformance Report based on ITI's VPAT template. Base it on a real audit, not on assumptions about Core Components.
- **Regular audits.** A full manual audit of the component library yearly and after any redesign, plus a sample of high-traffic pages each quarter.

## FAQ

**Are AEM Core Components WCAG 2.2 compliant out of the box?**
Not provably. Adobe's published conformance report for Core Components dates from 2021, evaluates WCAG 2.0 and 2.1, and lists partial support in several areas. Core Components are a strong starting point, but you need to test your proxies, styling and configuration against WCAG 2.2 AA yourself.

**Do I need WCAG 2.2 if the law says 2.1?**
Legally, it depends on the jurisdiction, and for many it's still 2.1 AA. Practically, EN 301 549 V4.1.1 already references 2.2, the new criteria are modest, and conforming to 2.2 also meets 2.1. Building to 2.2 now avoids a second remediation later.

**Can an accessibility overlay widget make an AEM site compliant?**
No. Overlays don't fix the underlying markup, can interfere with users' own assistive technology, and don't create conformance. Spend the money on fixing the components.

**How do I get alt text right at scale with thousands of assets?**
Put a description field in the Assets metadata schema, mark it required, and let the image component reuse it, with a page-level override where context changes the meaning. AI-generated suggestions can help with backlogs, but have a person review them: an accurate description isn't always the right alt text for the context.

**Is Edge Delivery Services more or less accessible than AEM Sites?**
Neither by default. EDS starts with clean, lightweight markup, and fast pages help everyone. But blocks are custom JavaScript, so accessibility depends entirely on how you write `decorate()` and how authors structure documents.

## Closing thought

Accessibility on AEM gets cheaper the closer you work to the source. Fixing pages one by one is endless; fixing components, templates and policies is finite, and every new page benefits automatically. The organisations I've seen succeed treat accessibility like security: a property of the platform with owners, acceptance criteria and automated gates, backed by real people testing with real assistive technology.

Start with your ten most-used components, a keyboard, and a screen reader. You'll learn more in an afternoon than from any score.

Want a second pair of eyes on your component library or an audit plan for your AEM estate? [Get in touch](/contact/).

### References

- [Directive (EU) 2019/882 on the accessibility requirements for products and services](https://eur-lex.europa.eu/eli/dir/2019/882/oj) (EUR-Lex)
- [EN 301 549 V4.1.1 is final: what changed and what you should do](https://www.deque.com/blog/en-301-549-v4-1-1-is-final-what-changed-what-it-means-and-what-you-should-do/) (Deque)
- [EN 301 549 published](https://nda.ie/news/en301549-published) (National Disability Authority, Ireland)
- [Extension of compliance dates for the ADA Title II web and mobile accessibility rule](https://www.govinfo.gov/content/pkg/FR-2026-04-20/html/2026-07663.htm) (Federal Register)
- [GIGW 3.0: scope and objective](https://guidelines.india.gov.in/scope-and-objective/) (Government of India)
- [Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/) (W3C)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/) (W3C WAI)
- [AEM Core Components Accessibility Conformance Report](https://www.adobe.com/accessibility/compliance/aem-core-components-acr.html) (Adobe)
- [Carousel component](https://experienceleague.adobe.com/en/docs/experience-manager-core-components/using/wcm-components/carousel) (Experience League)
- [Image component](https://experienceleague.adobe.com/en/docs/experience-manager-core-components/using/wcm-components/image) (Experience League)
- [Title component](https://experienceleague.adobe.com/en/docs/experience-manager-core-components/using/wcm-components/title) (Experience League)
- [Universal Editor model definitions, fields and component types](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/universal-editor/field-types) (Experience League)
- [Metadata schemas in AEM Assets](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/manage/metadata-schemas) (Experience League)
- [Keeping it 100](https://www.aem.live/developer/keeping-it-100) (aem.live)
- [Automated testing study identifies 57 percent of digital accessibility issues](https://www.deque.com/blog/automated-testing-study-identifies-57-percent-of-digital-accessibility-issues/) (Deque)

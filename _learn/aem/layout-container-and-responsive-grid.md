---
title: "The Layout Container and the responsive grid"
description: "How AEM's Layout Container and 12-column responsive grid place components, how breakpoints work, and why the Style System is safer for variation."
track: aem
level: 2
order: 13
minutes: 8
outcome: "By the end you can explain how the responsive grid positions components, when to let authors resize them, and when to use the Style System instead."
prereq: "Lesson 12 (templates and policies)."
terms:
  - { t: "Layout Container", d: "The container component that holds other components on an editable template page and arranges them on a responsive grid." }
  - { t: "Responsive grid", d: "A grid, 12 columns wide by default, where each component spans a number of columns that can differ per breakpoint." }
  - { t: "Breakpoint", d: "A screen width at which the layout may change, typically one for phones and one for tablets, with desktop as the default." }
  - { t: "Layout mode", d: "An editing mode in the page editor where authors drag component edges to resize them for the chosen breakpoint." }
  - { t: "Style System", d: "A policy feature that lets authors pick from named CSS classes defined by developers, instead of free-form layout." }
mistake: "Letting authors resize everything in layout mode on every page. Pages drift apart visually, and fixed per-component widths are hard to keep accessible and consistent as the design changes."
try_it:
  - "Open a page from your template in the editor and select the main container."
  - "Switch the toolbar to Layout mode and drag a component's edge so it spans fewer columns."
  - "Change the device emulator to a phone width and see whether the layout differs."
  - "Open the container's policy in the template editor and check whether layout mode is allowed for this container."
  - "In CRXDE Lite, find the `cq:responsive` node under the component and read the column properties."
quiz:
  - q: "What does a component's width in the responsive grid describe?"
    options:
      - "A fixed pixel width that applies at every screen size"
      - "How many of the 12 columns it spans at a given breakpoint"
      - "How much padding its dialog uses"
      - "The ratio of its image rendition"
    answer: 1
    why: "Widths are in columns, so they scale with the screen, and each breakpoint can have its own value. A pixel width would defeat responsive behaviour."
  - q: "A design needs one teaser variant with a dark background. What is the most maintainable approach?"
    options:
      - "Let authors drag colours in layout mode"
      - "Duplicate the component and change the CSS"
      - "Define a Style System class in the policy so authors pick 'Dark'"
      - "Use an inline style attribute in the dialog"
    answer: 2
    why: "A style is one class, defined once, reused everywhere and changeable in CSS. Duplicating a component creates two things to maintain, and inline styles bypass the design system."
  - q: "Authors report that a layout looks right on desktop but is cramped on phones. Where should the fix start?"
    options:
      - "Reducing the number of components on the page"
      - "Increasing the grid to 24 columns"
      - "Removing the phone breakpoint entirely"
      - "Setting the component's phone-width column span and checking the container policy"
    answer: 3
    why: "Layout is stored per breakpoint, so the phone span can differ from desktop. Adding columns or dropping breakpoints does not repair a bad phone layout."
  - q: "Which is NOT a good use of the Layout Container?"
    options:
      - "Placing a text block beside an image on desktop and stacking them on phone"
      - "Building the page's main region on an editable template"
      - "Giving authors space to arrange approved components"
      - "Positioning every component by exact pixel offsets on each page"
    answer: 3
    why: "Pixel-perfect positioning chosen page by page is exactly what the grid is not for. It is for flexible column-based arrangement within rules the template sets."
go_deeper:
  - { title: "Accessibility on AEM: fix the component, not the page", url: "/blog/2026/11/accessibility-on-aem-fix-the-component-not-the-page/", why: "layout order and reading order must still make sense" }
  - { title: "Previous lesson: Editable templates and content policies", url: "/learn/aem/templates-and-policies/" }
  - { title: "Next lesson: Core Components", url: "/learn/aem/core-components/" }
---
## The problem: layout is a design decision and an authoring decision

A marketing author wants a text block next to an image on a desktop page, and the same two blocks stacked on a phone. They should not need a developer, and they should not be able to break the brand. The **Layout Container** and the **responsive grid** give them a bounded way to do that.

## How the grid works

The Layout Container is a container component, usually the main region of an editable template page. Inside it, each component sits on a grid that is 12 columns wide by default. A component spans, say, 6 columns, so two of them sit side by side. On a phone breakpoint the same components can each span 12 columns and stack.

```text
Desktop (12 columns)        Phone (12 columns)
[ Text 6 ][ Image 6 ]       [ Text 12  ]
                            [ Image 12 ]
```

The values are stored on the content node, under a responsive node for each breakpoint. You rarely edit them by hand, but it helps to know they are plain properties:

```xml
<cq:responsive jcr:primaryType="nt:unstructured">
  <default jcr:primaryType="nt:unstructured" width="{String}6" offset="{String}0"/>
  <phone jcr:primaryType="nt:unstructured" width="{String}12"/>
</cq:responsive>
```

Treat the exact property names as an illustration, and look at your own content to see them.

## Breakpoints

Desktop is the default. Phone and tablet breakpoints, with their widths, are set up in the template, and the editor's device emulator lets authors check each one. Pick the breakpoints in the design phase and keep them aligned with your CSS, otherwise the grid and your media queries disagree.

## Layout mode versus rules from the template

In **layout mode**, authors drag edges to resize components for the selected breakpoint. That is powerful, and also how pages drift apart. The container's policy decides how much freedom there is. The Core Components **Container** also has a simple, non-grid layout, and projects often use that for tightly controlled sections and use the grid only where authors need flexibility.

## Use the Style System for looks

Layout answers "where and how wide". It should not answer "what does this look like". For colour, spacing variants or a dark card, use the **Style System**. In the component policy, a developer adds named CSS classes; the author picks one from a menu in the editor; the class lands on the component's wrapper.

```css
.cmp-teaser.style--dark { background: #1b1b1b; color: #fff; }
```

The author picks "Dark", you maintain one class, and a redesign changes one rule. This is why most teams treat the grid as a layout tool and styles as the variation tool.

## A practical rule

Let authors choose structure and width within the grid, give them styles for appearance, and keep spacing, typography and colour in your CSS. Where you can, check reading order: the order of components in the page is the order a screen reader gives, however they look.

<details markdown="1">
<summary>Stretch question: why not give authors a colour picker?</summary>

Free choice leads to pages that clash with the brand and fail contrast checks. A short list of approved styles keeps design decisions with designers, and one CSS change updates every use. Constraint is the feature.

</details>

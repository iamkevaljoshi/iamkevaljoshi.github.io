---
title: "Variants and section metadata"
description: "Give authors safe choices: block variants written in brackets become CSS classes, and section metadata styles a whole section. Learn when to use each."
track: eds
level: 2
order: 9
minutes: 8
outcome: "By the end you can offer a block in several looks using variants, and apply a background or style to a whole section with Section Metadata."
prereq: "Lessons 7 and 8."
terms:
  - { t: "Variant", d: "A named option in brackets after the block name, such as `Hero (dark)`, which becomes a CSS class on the block." }
  - { t: "Section Metadata", d: "A block placed inside a section whose entries describe that section rather than render content." }
  - { t: "Style key", d: "The Section Metadata entry named `Style`, whose values become classes on the section element." }
  - { t: "Data attribute", d: "A `data-*` attribute on the section, created from other Section Metadata entries." }
mistake: "Creating a new block for every small visual difference. Teams end up with `hero`, `hero-dark` and `hero-centered`, each copy drifting out of date, when one block with two variants would do."
try_it:
  - "Add a `Hero (dark)` table to a test page and view the source to confirm the block has the classes `hero` and `dark`."
  - "Add a rule for `.hero.dark` in `hero.css` that changes the background and text colour."
  - "Try `Hero (dark, centered)` and note that you now have three classes."
  - "Add a `Section Metadata` table with `Style` in the first cell and `highlight` in the second, then check the section's classes."
  - "Compare the result with a section that has no metadata and write down what changed."
quiz:
  - q: "An author writes `Columns (super wide)` in the first cell. What class list does the block get?"
    options:
      - "`columns` and `super` and `wide`, as three classes"
      - "`columns super-wide`"
      - "`columns-super-wide`"
      - "`columns` only, because spaces are not allowed"
    answer: 1
    why: "Words inside one option are joined with a hyphen, and commas separate options. Splitting on spaces is a common guess but is not how it is turned into classes."
  - q: "You need the same pale-blue background behind a block and the plain text above it. Which tool fits?"
    options:
      - "A variant on the block, repeated on every block in the section"
      - "Inline styles typed into the document"
      - "A Section Metadata block with a `Style` entry"
      - "A new block that wraps both"
    answer: 2
    why: "A section groups all its content, so a section style covers default content and blocks together. A block variant only reaches that one block."
  - q: "A designer asks for a Hero in dark, light and photo versions. What is the most maintainable approach?"
    options:
      - "One Hero block with three variants controlled by CSS and, where needed, JavaScript"
      - "Three blocks copied from each other, one per look"
      - "Three documents with the same content in different colours"
      - "A single Hero that decides its look from the page URL"
    answer: 0
    why: "One block with variants shares structure and logic. Copies drift, and URL-based looks hide the choice from the author."
  - q: "Which statement about variants is NOT true?"
    options:
      - "They appear as classes on the block element"
      - "They let one block code base serve several looks"
      - "Authors pick them in the block's name cell"
      - "They change which JavaScript file is loaded"
    answer: 3
    why: "The block name decides the files, and variants only add classes. If a variant needs different behaviour, your `decorate` function checks `block.classList.contains(...)`."
go_deeper:
  - { title: "Universal Editor vs document-based authoring", url: "/blog/2026/11/universal-editor-vs-document-based-authoring/", why: "how variants and section options appear to authors in each tool" }
  - { title: "Accessibility on AEM: fix the component, not the page", url: "/blog/2026/11/accessibility-on-aem-fix-the-component-not-the-page/", why: "why variants must keep contrast and structure safe" }
  - { title: "Next lesson: Fonts, icons and images", url: "/learn/eds/fonts-icons-images/" }
---
## The problem: one block, many looks

Your designer wants a Hero on the home page with a dark background, and the same Hero on a campaign page with centred text. You could copy the block and call it `hero-dark`. In six months you would have five copies, each slightly different. Variants solve this by letting authors choose a look without you forking code.

## Variants: options in brackets

In the document, the author writes the option in brackets after the block name. The service turns each option into a class on the block element:

| Authored first cell | Resulting block element |
|---|---|
| `Hero` | `<div class="hero">` |
| `Hero (dark)` | `<div class="hero dark">` |
| `Hero (dark, centered)` | `<div class="hero dark centered">` |
| `Hero (full width)` | `<div class="hero full-width">` |

Commas separate options, and spaces inside one option become hyphens. This happens in the HTML you receive, so by the time your `decorate` function runs, the classes are already there.

Most variants are pure CSS:

```css
.hero {
  background: var(--background-color);
  color: var(--text-color);
}

.hero.dark {
  background: #14213d;
  color: #fff;
}

.hero.centered .hero-content {
  text-align: center;
}
```

When a variant changes behaviour, check for the class in JavaScript:

```js
export default function decorate(block) {
  if (block.classList.contains('centered')) {
    block.querySelector('h1, h2')?.classList.add('hero-heading-centered');
  }
}
```

The variant does not change *which* files load. It is just a hook. Keep variants few, named for the look (`dark`) or layout (`centered`), not for a page (`campaign-june`).

## Section Metadata: styling the whole section

A **section** is everything between two horizontal rules (`---`) in the document. Sometimes you want to style that whole group: a tinted band, extra padding, a different background behind several blocks.

For that, authors add a **Section Metadata** block inside the section, with each entry as a key and value:

| Section Metadata | |
|---|---|
| Style | highlight |

The `Style` entry adds its values as classes on the section element, so the section gets `highlight`. The boilerplate's `styles.css` already ships rules for `main .section.light` and `main .section.highlight`, which set a background, remove the margin and add padding. Other entries become `data-*` attributes on the section, with names the project chooses, which suits CSS attribute selectors or JavaScript.

```css
main .section.highlight {
  background-color: var(--light-color);
  margin: 0;
  padding: 40px 0;
}
```

## Variant or section style?

Ask where the choice applies. If it changes one block, use a variant. If it changes the stage behind several things, use Section Metadata. Both are class-based, so both stay in CSS you control. Authors cannot invent options, only choose from ones you have written, which is how you give them confidence without giving them the power to break the design. See [Universal Editor versus document-based authoring](/blog/2026/11/universal-editor-vs-document-based-authoring/) for how these options surface in each editor.

<details markdown="1">
<summary>Stretch question: should a variant ever change the content structure?</summary>

Avoid it. If `Cards (compact)` needs a different table shape, authors must remember two shapes. Prefer variants that change only presentation, and create a separate block when the content model genuinely differs.

</details>

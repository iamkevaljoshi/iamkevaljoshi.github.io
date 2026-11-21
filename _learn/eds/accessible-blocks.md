---
title: "Accessibility in blocks"
description: "Build accessible Edge Delivery Services blocks: semantic elements, keyboard operation, visible focus, alt text and reduced motion, with a details-based accordion."
track: eds
level: 2
order: 13
minutes: 9
outcome: "By the end you can decorate a block into semantic, keyboard-operable markup, and add focus styles, alt text handling and reduced-motion support."
prereq: "Lessons 7 to 12."
terms:
  - { t: "Semantic element", d: "An HTML element whose tag says what it is, such as `button`, `nav`, `ul` or `details`, so browsers and assistive technology can use it." }
  - { t: "Focus", d: "The element that receives keyboard input. A visible focus style shows keyboard users where they are." }
  - { t: "Accessible name", d: "The text that a screen reader announces for a control, from its content, `alt` or an `aria-label`." }
  - { t: "prefers-reduced-motion", d: "A media query that tells you the visitor has asked their system to minimise animation." }
mistake: "Building controls from `div` elements and click handlers. They cannot be reached with the keyboard or announced as buttons, so people using a keyboard or screen reader cannot use the block at all."
try_it:
  - "Add an `Accordion` block with three rows of question and answer to a test page."
  - "Use the Tab and Space keys to open each item without touching the mouse."
  - "Add a `:focus-visible` outline in the CSS and tab through again."
  - "Add the `prefers-reduced-motion` rule and toggle the setting in your operating system or in developer tools rendering options."
  - "Run the Accessibility checks in Lighthouse and the accessibility tree view in developer tools and fix anything flagged."
quiz:
  - q: "Why is a `div` with a click listener a poor button?"
    options:
      - "It is not focusable, not announced as a button and ignores Space"
      - "It is slower for the browser to render"
      - "Divs cannot have styles"
      - "It does not work on any touch screen"
    answer: 0
    why: "A real `button` brings focus, keyboard activation and its role for free. A div works with a mouse or touch and fails keyboard and screen reader users."
  - q: "Your accordion rows are `details` and `summary` elements. What do you get without writing any JavaScript?"
    options:
      - "Only a smooth open and close animation"
      - "Keyboard use and announced state, with no script needed"
      - "Automatic closing of the other open items"
      - "Nothing, because the platform removes them"
    answer: 1
    why: "Browsers implement the toggle and expose its state natively. They do not close other items automatically, and animation would be your CSS."
  - q: "A card image is purely decorative. What is the right alt value?"
    options:
      - "The file name"
      - "The word `image`"
      - "An empty `alt` attribute, `alt=\"\"`"
      - "No `alt` attribute at all"
    answer: 2
    why: "An empty alt tells assistive technology to skip it. A missing attribute makes some screen readers read the file name, and 'image' adds noise. Meaningful images need real descriptions from the author."
  - q: "Which CSS removes keyboard users' only cue about where they are?"
    options:
      - "`a:focus-visible { outline: 2px solid; }`"
      - "`summary { cursor: pointer; }`"
      - "`@media (prefers-reduced-motion: reduce) { * { transition: none; } }`"
      - "`* { outline: none; }` with no replacement"
    answer: 3
    why: "Removing outlines without a replacement hides focus. The other rules are fine: a pointer cursor is cosmetic, and reduced-motion rules respect user settings."
go_deeper:
  - { title: "Accessibility on AEM: fix the component, not the page", url: "/blog/2026/11/accessibility-on-aem-fix-the-component-not-the-page/", why: "why the block is the right place to fix accessibility" }
  - { title: "Universal Editor vs document-based authoring", url: "/blog/2026/11/universal-editor-vs-document-based-authoring/", why: "what authors control, such as alt text, in each editor" }
  - { title: "Next lesson: Project, three custom blocks", url: "/learn/eds/project-three-blocks/" }
---
## The problem: authors cannot fix what the block gets wrong

An author can write good alt text. They cannot make your accordion work with a keyboard. Accessibility is mostly decided in the block, which is why the best place to fix it is the block, not each page. The post [fix the component, not the page](/blog/2026/11/accessibility-on-aem-fix-the-component-not-the-page/) argues the same on AEM.

## Start with the right element

The cheapest accessibility win is using the element the browser already knows. A heading is an `h2`. A list is a `ul`. A control that does something is a `button`. A control that goes somewhere is an `a`.

Take an FAQ block. The authored table has a question in the first cell and an answer in the second. The raw rows are divs. Decorate them into `details` and `summary`:

```js
export default function decorate(block) {
  [...block.children].forEach((row) => {
    const [label, body] = row.children;

    const summary = document.createElement('summary');
    summary.className = 'accordion-item-label';
    summary.append(...label.childNodes);

    body.className = 'accordion-item-body';

    const details = document.createElement('details');
    details.className = 'accordion-item';
    details.append(summary, body);

    row.replaceWith(details);
  });
}
```

You get, with no further code, keyboard focus on each `summary`, Enter and Space to toggle, and the open or closed state announced by assistive technology. This is better than a div-based accordion with ARIA attributes you would have to maintain.

When a native element does not exist, such as a carousel's next control, still use a `button`, and give it a name:

```js
const next = document.createElement('button');
next.type = 'button';
next.setAttribute('aria-label', 'Next slide');
```

## Keyboard and focus

Everything a mouse can do must work with Tab, Shift+Tab, Enter and Space. Check that the tab order follows the visual order. Never remove the focus outline without replacing it:

```css
.accordion summary:focus-visible,
.accordion a:focus-visible {
  outline: 2px solid var(--link-color);
  outline-offset: 2px;
}
```

`:focus-visible` shows the outline for keyboard users and usually not after a mouse click, so you keep the cue without annoying anyone.

## Text alternatives

Images come from authors, so alt text is their job and your responsibility to preserve. In `decorate`, copy `img.alt` when you replace a picture, as lesson 10 did. For decorative images, authors can leave the alt empty, and `alt=""` tells screen readers to skip it. For an icon-only link, give the link a name, since the boilerplate's icon `img` has an empty alt by default.

Do not use CSS `content` for meaningful text. Screen readers may skip it and authors cannot edit it.

## Motion and contrast

Some visitors get sick from movement. Respect their system setting:

```css
.accordion .accordion-item-body {
  transition: opacity 0.2s ease;
}

@media (prefers-reduced-motion: reduce) {
  .accordion .accordion-item-body {
    transition: none;
  }
}
```

Variants (lesson 9) are a risk for contrast. A `dark` variant needs text that passes contrast checks on its background. Check each variant, not just the default.

## Test it

Unplug the mouse, tab through the page and use the accessibility tree in developer tools. Run Lighthouse's accessibility audit, but remember it finds only a part of the problems. Keyboard testing finds the rest.

<details markdown="1">
<summary>Stretch question: why not add `role="button"` and `tabindex="0"` to a div and call it done?</summary>

Those two attributes give you a focusable thing announced as a button, but not Enter and Space handling, disabled state or form behaviour. You would rebuild what `button` already offers, and each rebuilt piece is a chance for a bug. Use the native element unless the design truly makes it impossible.

</details>

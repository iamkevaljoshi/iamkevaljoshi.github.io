---
title: "HTL basics: writing markup that is secure by default"
description: "Learn HTL, the templating language AEM components use: expressions, automatic escaping, data-sly blocks, and why logic belongs in Java instead."
track: aem
level: 2
order: 8
minutes: 9
outcome: "By the end you can read and write a simple HTL template, explain why its output is escaped by default, and choose the right data-sly block for a job."
prereq: "Lesson 4 (how Sling picks a script) and lesson 7 (a deployed hello component)."
terms:
  - { t: "HTL", d: "HTML Template Language: AEM's server-side templating language, formerly called Sightly. A template is valid HTML with extra `data-sly-*` attributes and `${...}` expressions." }
  - { t: "Expression", d: "Anything written as `${...}`. It reads a value and prints it, optionally with options after an `@`." }
  - { t: "Context", d: "Where an expression sits (text, attribute, URI, script). HTL escapes output for that context automatically." }
  - { t: "data-sly-use", d: "A block that loads a helper, usually a Sling Model, and gives it a name you can use in expressions." }
  - { t: "Block statement", d: "A `data-sly-*` attribute that controls rendering, such as `data-sly-test` for conditions or `data-sly-list` for loops." }
mistake: "Using `@ context='unsafe'` to make author content 'just work'. It switches off escaping, so a pasted script tag now runs on your public pages, which is cross-site scripting."
try_it:
  - "Open the hello component from lesson 7 and find its `.html` script under `ui.apps`."
  - "Add a paragraph that prints a property with `${properties.jcr:title}` and redeploy."
  - "Set that property to `<b>bold</b>` in CRXDE Lite and see that the tags show as text, not bold."
  - "Add `@ context='html'` to the expression and compare. Notice HTL filters the output rather than trusting it blindly."
  - "Wrap the paragraph in `data-sly-test=\"${properties.jcr:title}\"` and confirm an empty title now renders nothing."
quiz:
  - q: "Why does `${properties.text}` placed between two HTML tags not run a script an author typed into it?"
    options:
      - "HTL strips every angle bracket from every property"
      - "HTL escapes output for the context it appears in by default"
      - "The author dialog blocks script tags before saving"
      - "Dispatcher removes scripts from responses"
    answer: 1
    why: "Escaping happens in HTL at render time, chosen by context. Dialogs and Dispatcher do not sanitise stored text, so they cannot be relied on for this."
  - q: "A component needs to loop over child items and skip the whole block when there are none. Which is the best HTL?"
    options:
      - "A `data-sly-list` on the `ul` with a `data-sly-test` on the same element guarding it"
      - "A Java scriptlet that builds the list as a string"
      - "A `data-sly-resource` pointing at a fixed path"
      - "A `data-sly-call` with a hard-coded number of items"
    answer: 0
    why: "Test and list combine well: the test decides whether anything renders and the list repeats an element per item. Scriptlets do not exist in HTL, and a fixed path or count ignores what the author created."
  - q: "A teammate wants to sort items and call a web service from inside the HTL file. What is the right response?"
    options:
      - "Fine, HTL expressions can call any Java method"
      - "Put it in an inline script block in the template"
      - "Move the logic into a Sling Model and let HTL only display the result"
      - "Move it into a client library"
    answer: 2
    why: "HTL is deliberately weak so logic stays testable in Java. A client library runs in the browser, which is the wrong place for server-side work."
  - q: "Which statement is NOT true?"
    options:
      - "`data-sly-template` and `data-sly-call` let you reuse a fragment of markup"
      - "`data-sly-use` can load a Sling Model by class name"
      - "Attributes holding URLs, like `href`, are treated as a URI context"
      - "Setting `context='unsafe'` is a safe way to allow rich text"
    answer: 3
    why: "Unsafe turns escaping off entirely. For rich text you use the `html` context, which keeps a safe subset of markup and removes the dangerous parts."
go_deeper:
  - { title: "Accessibility on AEM: fix the component, not the page", url: "/blog/2026/11/accessibility-on-aem-fix-the-component-not-the-page/", why: "good markup in the HTL script is where accessibility starts" }
  - { title: "Next lesson: Sling Models", url: "/learn/aem/sling-models/" }
  - { title: "Sling: how a URL becomes a response", url: "/learn/aem/sling-url-to-response/", why: "how Sling finds the HTL script to run" }
---
## The problem: templates that leak

Early web templates let developers write real code in the page and print raw values. Two bad things followed. Logic and markup tangled together, and one unescaped value could turn a text field into an attack. An author who types `<script>` into a title should get the words, not a running script.

HTL (HTML Template Language) was designed to stop both. A template is plain HTML, so front-end developers can read it. Anything dynamic is either an expression such as `${properties.jcr:title}` or a `data-sly-*` attribute. There is no way to write a loop body of Java in it.

## Expressions and escaping

An expression reads a value and prints it. HTL looks at **where** you printed it, which is the *context*, and escapes accordingly:

| Where | Default handling |
|---|---|
| Between tags | HTML-escaped text |
| Normal attribute | Attribute-escaped |
| `href` or `src` | URI-checked, unsafe schemes removed |
| Inside `script` or `style` | Not set automatically: you must state a context |

You change the behaviour with options after an `@`:

```html
<h2>${properties.jcr:title}</h2>
<div>${properties.text @ context='html'}</div>
<a href="${properties.link @ context='uri'}">Read more</a>
```

The second line is for rich text. The `html` context keeps safe markup and strips dangerous parts. Reach for `unsafe` only when you truly own the value, and almost never for author input.

## The blocks you will use daily

| Block | Job |
|---|---|
| `data-sly-use.name="..."` | Load a Sling Model or helper |
| `data-sly-test` | Render an element only if the value is truthy |
| `data-sly-list` / `data-sly-repeat` | Repeat the content, or the whole element |
| `data-sly-resource` | Include another resource, usually a child component |
| `data-sly-template` / `data-sly-call` | Define and reuse a markup fragment |

A real component often looks like this:

```html
<section class="cmp-teaser" data-sly-use.model="com.example.core.models.TeaserModel"
         data-sly-test="${model.title}">
  <h2 class="cmp-teaser__title">${model.title}</h2>
  <ul data-sly-test="${model.links}">
    <li data-sly-repeat="${model.links}"><a href="${item.url}">${item.label}</a></li>
  </ul>
</section>
```

Inside a list, HTL gives you `item` and `itemList` (with `index`, `first`, `last`). `data-sly-test` on the section hides the whole component when it has no title, a handy pattern for empty components.

## Why logic stays out

Try writing "show only published links, sorted by date" in HTL. You cannot, and that is the point. That belongs in a Sling Model, where it has unit tests and a debugger. HTL only shows what the model decides.

Before: a template that tried to filter and format would be unreadable and untestable. After: `model.links` arrives ready, and the template stays five lines long. The next lesson builds that model.

<details markdown="1">
<summary>Predict first, then reveal: what prints?</summary>

Given `properties.title` equal to `5 < 6 & more`, the line `<h2>${properties.title}</h2>` prints `5 &lt; 6 &amp; more` in the source, which the browser shows as the original text. The escaping is automatic, so a value can never accidentally break your markup.

</details>

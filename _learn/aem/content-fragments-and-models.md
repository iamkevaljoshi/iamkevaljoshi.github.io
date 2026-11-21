---
title: "Content Fragments and Content Fragment Models"
description: "How AEM stores structured content with no layout attached, why the Content Fragment Model matters, and how fragments differ from page content."
track: aem
level: 3
order: 16
minutes: 9
outcome: "By the end you can explain what a Content Fragment and a Content Fragment Model are, and decide when structured content beats page content."
prereq: "Lessons 3 and 10: the JCR, and components with dialogs."
terms:
  - { t: "Content Fragment", d: "A piece of structured content, such as an article or a product, stored without any layout or design." }
  - { t: "Content Fragment Model", d: "The definition of a fragment's fields, such as a title, a summary and an image, that every fragment of that type must follow." }
  - { t: "Fragment Reference", d: "A model field that points to another Content Fragment, so content can be linked instead of copied." }
  - { t: "Variation", d: "An alternative version of a fragment's content, such as a shorter summary for a mobile app." }
  - { t: "Presentation-free", d: "Content that says what something is, not how it looks, so any channel can style it." }
mistake: "Treating a Content Fragment like a mini page and putting layout hints or HTML styling into it. The fragment then looks wrong in every channel except the first one you built."
try_it:
  - "Pick a product or article on a site you know and list its fields: title, summary, image, author, date, body."
  - "Mark which of those fields would be identical on a website, a mobile app and a kiosk."
  - "Write the model as a table of field name, type (text, number, date, reference) and required or not."
  - "Decide which field should be a reference to another fragment, for example the author."
  - "Ask what would happen to 200 existing articles if you renamed the summary field. That is why models need care."
quiz:
  - q: "What is the main difference between a Content Fragment and page content?"
    options:
      - "A fragment is structured and has no layout, so many channels can reuse it"
      - "A fragment is stored outside the repository so it loads faster"
      - "A fragment is only used for images and videos"
      - "A fragment can only be shown on one page at a time"
    answer: 0
    why: "Fragments hold fields, not presentation, which is what makes them reusable across channels. They live in the repository like everything else and are not limited to one page."
  - q: "A team renames a field in a model that already has 300 fragments. What is the safest way to think about this?"
    options:
      - "Nothing happens, because fragments are independent copies of the model"
      - "It is a contract change that can affect existing fragments and every consumer of the content"
      - "Only fragments created after the change are affected"
      - "AEM blocks the change so it can never go wrong"
    answer: 1
    why: "Fragments depend on their model, and queries or components may depend on field names. Editing a model already in use can affect dependent fragments, so plan changes like an API change."
  - q: "An author wants the same author biography on 40 articles, edited once. Which model feature fits?"
    options:
      - "Copy the biography text into each article fragment"
      - "A longer multi line text field on the article model"
      - "A Fragment Reference from the article to an Author fragment"
      - "A variation on each article called biography"
    answer: 2
    why: "A reference links to one source of truth, so one edit updates every article. Copying drifts out of sync, and variations are alternative versions of the same fragment, not a way to share content between fragments."
  - q: "Which statement is NOT true about Content Fragment Models?"
    options:
      - "They define the fields a fragment of that type has"
      - "They are configuration and are stored under /conf"
      - "They need to be enabled before fragments can be created from them"
      - "They decide the colours and fonts used to display the content"
    answer: 3
    why: "Models describe data, not design. Styling belongs to whichever channel renders the fragment, which is exactly the point of keeping content presentation-free."
go_deeper:
  - { title: "Composable, headless or traditional AEM: a decision framework", url: "/blog/2026/11/composable-headless-or-traditional-aem-decision-framework/", why: "when structured content is the right foundation" }
  - { title: "Content modelling: JCR vs relational vs document database", url: "/blog/2026/11/content-modelling-jcr-vs-relational-vs-document-database/", why: "how to think about fields, references and change" }
  - { title: "Next lesson: Experience Fragments", url: "/learn/aem/experience-fragments/" }
---
## The problem: content trapped in pages

A bank writes a product description for its savings account. It appears on the website, in the mobile app and on a branch kiosk. If that text lives inside a page component, the app team has to copy it out. Six months later the copies disagree.

The fix is to store the description **once, as data**, with no design attached, and let each channel decide how to show it. In AEM that data is a **Content Fragment**.

## Models: the shape of the data

Every fragment is created from a **Content Fragment Model**. The model is the blueprint: a list of fields with types.

```text
Model: Article
  title     Single line text   required
  summary   Multi line text
  hero      Content Reference  (an image in the DAM)
  author    Fragment Reference (to an Author fragment)
  body      Multi line text    (rich text)
  published Date and time
```

Typical field types include single and multi line text, number, boolean, date and time, enumeration, tags, content reference (to assets or pages), fragment reference, composite and JSON object. Models are configuration, so they are stored under `/conf`, and on Cloud Service you enable the Content Fragment Models feature on a configuration (through the Configuration Browser) and enable each model before authors can use it.

An author then opens the Assets UI, picks a folder, chooses **Create > Content Fragment**, selects the model, and fills in the fields. The fragment itself is stored as a node tree under `/content/dam`, like any asset. Adobe has also introduced a newer Content Fragment editor alongside the original one. Adobe's docs advise that if you create a model in the new editor, you keep using that editor for that model.

## Fragments are not pages

A page carries layout: containers, components and styles. A fragment carries only fields. That means a fragment cannot be "viewed" on its own the way a page can. It becomes visible when something consumes it: a Core Component placed on a page, or an API call, which is the next-but-one lesson (GraphQL and persisted queries).

| | Page content | Content Fragment |
|---|---|---|
| Holds | Components and layout | Fields and values |
| Reused by | Copying or Experience Fragments | References and API queries |
| Best for | One designed experience | Content many channels need |

Fragments can also have **variations**, for example a short summary for an app, while the master variation stays the main version.

## Why models deserve respect

A model is a contract. Fragments depend on it, and so do the components, queries and apps that read the fields. Adobe's own documentation warns that editing a model already in use can affect dependent fragments. Treat model changes like API changes: add fields freely, rename or remove them rarely and deliberately.

<details markdown="1">
<summary>Stretch question: when is a page component still the better choice?</summary>

When the content only ever appears once, in one designed place, such as a unique campaign landing hero. Structuring it as a fragment adds a model, a folder and a query for no reuse benefit. Choose fragments where reuse and multiple channels are real, not hypothetical.

</details>

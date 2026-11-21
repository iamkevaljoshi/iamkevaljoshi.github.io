---
title: "Components and dialogs"
description: "How an AEM component is defined in the repository, how its dialog saves values as properties, and how a Sling Model reads them back."
track: aem
level: 2
order: 10
minutes: 9
outcome: "By the end you can describe the anatomy of a component, write a small Touch UI dialog, and trace a dialog value from the author's keyboard to the rendered page."
prereq: "Lessons 8 and 9 (HTL and Sling Models), and lesson 3 (nodes and properties)."
terms:
  - { t: "Component", d: "A reusable building block: a node of type `cq:Component` with an HTL script, an optional dialog and optional logic." }
  - { t: "sling:resourceType", d: "A property on content that names the component that renders it, as a path such as `mysite/components/teaser`." }
  - { t: "sling:resourceSuperType", d: "A property on a component that names the component it inherits scripts and dialogs from." }
  - { t: "Dialog (`_cq_dialog`)", d: "The author form, built from Granite UI field components, whose values are stored as properties on the content node." }
  - { t: "Edit config (`_cq_editConfig`)", d: "Optional configuration for editing behaviour, such as drag and drop, inline editing and listeners." }
mistake: "Thinking the dialog stores values 'in the component'. The component is code. Dialog values are saved on the content node under the page, so changing the component never changes existing content, only how it is shown."
try_it:
  - "In your archetype project, open `ui.apps/src/main/content/jcr_root/apps/<project>/components` and list the folders."
  - "Open one component's `.content.xml` and find `jcr:primaryType`, `jcr:title` and `componentGroup`."
  - "Open its `_cq_dialog/.content.xml` and identify one field and its `name` attribute."
  - "Author a component on a page, then open the page in CRXDE Lite and find the property with that same name."
  - "Rename the field's `name` in a copy of the dialog and note that old content no longer shows the value."
quiz:
  - q: "Where do the values an author types into a dialog end up?"
    options:
      - "As properties on the component's definition under `/apps`"
      - "As properties on the content node inside the page under `/content`"
      - "In the component's HTL file"
      - "In the page's template under `/conf`"
    answer: 1
    why: "The component under `/apps` is shared code. Each use on a page is a content node, and the dialog saves to that node. Writing to `/apps` would change every page at once."
  - q: "A content node has `sling:resourceType=\"mysite/components/hero\"`. What does Sling do first?"
    options:
      - "It looks for a script in `/apps/mysite/components/hero`, then its supertypes"
      - "It reads the dialog to decide what to show"
      - "It searches `/content` for a matching title"
      - "It calls the Sling Model directly"
    answer: 0
    why: "Rendering starts with the resource type and walks up the supertype chain to find a script. The model is only used if the script asks for it with `data-sly-use`."
  - q: "You rename a dialog field from `heading` to `title` after pages already use it. What happens?"
    options:
      - "Sling Models migrate the property automatically"
      - "The repository rewrites old property names on save"
      - "Existing components show nothing until the content is migrated or re-saved"
      - "Nothing, AEM maps both names"
    answer: 2
    why: "Property names are a contract between dialog, model and stored content. A rename leaves old content under the old name, so you need a content migration or a fallback in code."
  - q: "Which is NOT true about `_cq_dialog`?"
    options:
      - "It is built from Granite UI field resources"
      - "Each field's `name` becomes the property name, such as `./title`"
      - "It must exist for a component to render"
      - "It can be inherited through `sling:resourceSuperType`"
    answer: 2
    why: "Plenty of components have no dialog, for example a divider. The dialog is only needed when authors configure something."
go_deeper:
  - { title: "Accessibility on AEM: fix the component, not the page", url: "/blog/2026/11/accessibility-on-aem-fix-the-component-not-the-page/", why: "why dialogs should ask for the things accessible markup needs" }
  - { title: "Previous lesson: Sling Models", url: "/learn/aem/sling-models/" }
  - { title: "Next lesson: Client libraries", url: "/learn/aem/client-libraries/" }
---
## The problem: one design, a thousand uses

A designer draws a teaser card. Authors will use it on hundreds of pages, each with different words and pictures. You need one definition of how a teaser looks and works, plus a form so authors can fill in their own values without touching code.

In AEM that definition is a **component**, and the form is its **dialog**.

## Anatomy of a component

A component is a folder under `/apps`. In your project it sits in `ui.apps`:

```text
apps/mysite/components/teaser/
  .content.xml        the component definition
  teaser.html         the HTL script
  _cq_dialog/         the author form
  _cq_editConfig.xml  optional edit behaviour
```

The definition is a node of type `cq:Component`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<jcr:root xmlns:sling="http://sling.apache.org/jcr/sling/1.0"
          xmlns:cq="http://www.day.com/jcr/cq/1.0"
          xmlns:jcr="http://www.jcp.org/jcr/1.0"
    jcr:primaryType="cq:Component"
    jcr:title="Teaser"
    jcr:description="A card with a title and a link"
    componentGroup="MySite - Content"/>
```

`jcr:title` is the name authors see, and `componentGroup` decides which group it appears under in the component list.

## Two properties that connect everything

- On **content**, `sling:resourceType` names the component, for example `mysite/components/teaser`. This is how lesson 4's Sling lookup finds your script.
- On a **component**, `sling:resourceSuperType` names the component it extends. A child inherits the parent's script and dialog unless it has its own.

Inheritance is how proxy components work in lesson 14.

## The dialog

A dialog is a tree of Granite UI (the Touch UI toolkit) fields. Each field has a `name` such as `./title`, which is the property it writes on the content node:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<jcr:root xmlns:sling="http://sling.apache.org/jcr/sling/1.0"
          xmlns:granite="http://www.adobe.com/jcr/granite/1.0"
          xmlns:cq="http://www.day.com/jcr/cq/1.0"
          xmlns:jcr="http://www.jcp.org/jcr/1.0"
          xmlns:nt="http://www.jcp.org/jcr/nt/1.0"
    jcr:primaryType="nt:unstructured"
    jcr:title="Teaser"
    sling:resourceType="cq/gui/components/authoring/dialog">
  <content jcr:primaryType="nt:unstructured"
      sling:resourceType="granite/ui/components/coral/foundation/container">
    <items jcr:primaryType="nt:unstructured">
      <title jcr:primaryType="nt:unstructured"
          sling:resourceType="granite/ui/components/coral/foundation/form/textfield"
          fieldLabel="Title"
          name="./title"/>
    </items>
  </content>
</jcr:root>
```

After an author saves, the page contains something like `/content/mysite/en/home/jcr:content/root/container/teaser` with `title = "Hello"` and `sling:resourceType = mysite/components/teaser`.

## Where the dialog is shown

When an author selects a component and clicks the wrench icon, the editor loads that component's `_cq_dialog`. If your component has no dialog of its own, AEM looks up the `sling:resourceSuperType` chain and uses the first one it finds. That is why a proxy component with no dialog still opens the Core Component's form.

Dialog fields come in many types: text fields, checkboxes, path pickers, rich text editors and multifields for repeating groups. Each one is just another Granite UI resource type with a `name`, so learning one teaches you the rest.

## From keyboard to page

1. The author types a title and clicks Done.
2. AEM writes `title` on the content node.
3. A visitor requests the page. Sling finds the teaser script via the resource type.
4. The script loads the Sling Model, which reads `@ValueMapValue String title`.
5. HTL prints `${model.title}`, escaped.

The edit config file is optional. You add it when a component needs special behaviour, such as in-place editing or reacting after an edit. Most components work without it.

Keep property names stable. The name is a contract between dialog, model and stored content, and renaming it later means migrating content.

<details markdown="1">
<summary>Why does this work? Component code is shared, content is not</summary>

Because the component lives under `/apps` and the content under `/content`, one component can render thousands of nodes. Fixing the HTL fixes every page. That is also why you never store author data in the component folder.

</details>

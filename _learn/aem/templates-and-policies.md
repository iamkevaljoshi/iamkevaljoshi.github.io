---
title: "Editable templates and content policies"
description: "How editable templates in /conf define a page's fixed structure, starting content and policies, and how policies limit what authors can add."
track: aem
level: 2
order: 12
minutes: 9
outcome: "By the end you can explain the three parts of an editable template, say who edits each, and describe how policies control allowed components."
prereq: "Lesson 10 (components) and lesson 3 (the JCR)."
terms:
  - { t: "Editable template", d: "A template stored under `/conf` that authors with the right permissions can change in the browser, without a code deployment." }
  - { t: "Structure", d: "The locked part of the template: components every page made from it must have, such as header and footer." }
  - { t: "Initial content", d: "Content copied to a new page when it is created. Authors can then change or delete it." }
  - { t: "Policy", d: "A saved set of design rules for a component or page, such as which components are allowed in a container." }
  - { t: "Template type", d: "A blueprint for new templates, defining the base structure, initial content and policies a template starts with." }
mistake: "Putting design decisions in the page component code instead of policies. The result is a developer deployment for every small change to which components authors may use."
try_it:
  - "In the author instance open Tools, General, Templates and find your site's folder."
  - "Open a template in the editor and switch between Structure, Initial Content and Policies modes."
  - "In Structure mode click the main container, choose the policy icon, and read the allowed components list."
  - "Create a page from the template and try to add a component that is not allowed. Notice it is not in the list."
  - "Look under `/conf/<site>/settings/wcm/templates` in CRXDE Lite and find `structure`, `initial` and `policies`."
quiz:
  - q: "What is the difference between structure and initial content?"
    options:
      - "Structure is for desktop and initial content is for mobile"
      - "Structure is locked on pages and initial content is copied once and can be changed"
      - "Structure holds text and initial content holds components"
      - "Structure is only for developers and initial content only for authors"
    answer: 1
    why: "Structure stays linked to the template, so a change there reaches existing pages. Initial content is a one-time copy, so later template changes do not touch pages already made."
  - q: "You need to stop authors adding Video components in one section for all pages of one template. Where do you change it?"
    options:
      - "Edit the page component's HTL"
      - "Edit the component's dialog"
      - "Add a Dispatcher filter rule"
      - "Edit the container's policy in the template"
    answer: 3
    why: "Allowed components are a policy on that container. HTL and dialogs are about rendering and authoring a single component, and Dispatcher does not govern authoring."
  - q: "Why do projects today prefer editable templates over static templates?"
    options:
      - "Authors can change templates and policies without a code release"
      - "Static templates cannot be created in Cloud Service at all"
      - "Editable templates are always faster to render"
      - "Static templates do not use components"
    answer: 0
    why: "Static templates live in `/apps` and need a deployment to change. Editable templates keep structure and policies in `/conf`, so template authors can change them safely."
  - q: "Which statement about policies is NOT correct?"
    options:
      - "A policy can be reused by several templates"
      - "A component policy can add CSS classes authors may pick, via the Style System"
      - "A policy decides which content an author is allowed to publish"
      - "A page policy can define which clientlib categories a page loads"
    answer: 2
    why: "Policies shape the design and the toolbox. Who may publish is controlled by permissions and workflow, a different mechanism."
go_deeper:
  - { title: "AEM Edge Delivery Services vs traditional AEM as a Cloud Service", url: "/blog/2026/11/aem-edge-delivery-services-vs-traditional-aemaacs/", why: "how templates and governance differ between the two models" }
  - { title: "Previous lesson: Client libraries", url: "/learn/aem/client-libraries/" }
  - { title: "Next lesson: The Layout Container and the responsive grid", url: "/learn/aem/layout-container-and-responsive-grid/" }
---
## The problem: freedom versus brand safety

If every author can place any component anywhere, brand rules last a week. If every change needs a developer, nothing moves. You need a middle: developers supply the building blocks, a few trusted people shape pages from them, and ordinary authors work inside those rails.

**Editable templates** are that middle layer.

## Where templates live

An editable template is stored under `/conf`, not `/apps`:

```text
/conf/mysite/settings/wcm/
  template-types/   blueprints to start from
  templates/        your templates
    article-page/
      structure/    locked parts
      initial/      starting content
      policies/     links to policy definitions
  policies/         the saved policy definitions
```

That location is the big idea: configuration that authors can change lives in `/conf`, code that developers deploy lives in `/apps`. In an archetype project the `/conf` content is part of `ui.content`.

## The three parts

| Part | Behaviour | Example |
|---|---|---|
| **Structure** | Present on every page, cannot be removed by page authors, and later changes reach existing pages | Header, footer, the main container |
| **Initial content** | Copied to a new page once, then editable | A Title and an empty Text |
| **Policies** | Rules for the design | Which components a container allows |

A **page policy** applies to the whole page, for example which client library categories to load. A **component policy** applies to one component in one place, for example the allowed heading levels of a Title.

## Policies in practice

A container policy has a list of allowed components. If Image, Text and Title are ticked, the author's insert menu shows only those three. This is the guard rail: wrong components cannot be placed because they are not offered.

Component policies can also include **styles**, a set of CSS classes with friendly names. Lesson 13 shows how those give authors safe visual choices.

## Who edits what

Roles usually split like this:

- **Developers** build components and the first template type.
- **Template authors**, a small trained group, create templates and policies.
- **Content authors** create pages from those templates and cannot change them.

Access to the Templates console is by permission, so enabling it for everyone defeats the purpose.

## Why static templates are legacy

Older **static templates** are folders under `/apps` with a fixed script. Changing one means code, a build and a deployment. They are still found in older projects, and Adobe's guidance for new work is editable templates. Migration tooling exists, but plan it as real work.

<details markdown="1">
<summary>Stretch question: you change the structure and a page author's page does not update. What went wrong?</summary>

You may have changed *initial content* instead of structure. Initial content is copied at page creation, so existing pages keep the old copy. Only structure components stay linked to the template, which is why header and footer belong there.

</details>

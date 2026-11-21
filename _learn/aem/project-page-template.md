---
title: "Project: build a page template with three components"
description: "Build an editable page template with a locked header and a content region that allows three components, then create a page and author content with it."
track: aem
level: 2
order: 15
minutes: 20
kind: project
outcome: "By the end you can build an editable template with a locked header and a policy-limited content region, create a page from it and author three components."
prereq: "Lessons 8 to 14, and a working local AEM SDK and archetype project from lessons 5 to 7."
terms:
  - { t: "Template structure", d: "The locked part of a template, here a header, that every page created from it inherits." }
  - { t: "Content region", d: "The unlocked container where authors add components within the template's policy." }
  - { t: "Container policy", d: "The saved rule on the content region that lists which components authors may insert." }
  - { t: "Proxy component", d: "Your project's thin component that inherits from a Core Component, used as the allowed component." }
  - { t: "Definition of done", d: "A checklist that proves the work behaves as intended, not only that it compiles." }
mistake: "Stopping once the template saves. A template is only done when a page created from it shows the header, offers exactly the allowed components, and survives a reload and a publish-style view."
try_it:
  - "Generate a project with the AEM Project Archetype (check the archetype's README for the current version), choosing the Cloud Service option, then build and deploy it to your local author with `mvn clean install -PautoInstallSinglePackage`."
  - "Open Tools, General, Templates, open your site's folder and create a template from the Page template type. Name it 'Landing page'."
  - "In Structure mode add a container named for the header at the top and put a Text or Title proxy inside it with your site name. Leave it locked, and keep the main container below it unlocked."
  - "Select the main container and open its policy. Create a new policy that allows only the Title, Text and Image proxy components, then save."
  - "Open Initial Content mode and add one Title to the main container as a starting point. Save, then enable the template from the Templates console."
  - "In Sites create a page with the new template (if it is missing, check the allowed templates for the parent page). Author a title, a paragraph and an image."
  - "Open the page in the editor's preview and then as the published-style view without the editor. Check the header, the three components and that other components do not appear."
quiz:
  - q: "You added a Title to the header in Structure mode. A page author wants to delete it from one page. What can they do?"
    options:
      - "Delete it from the page like any component"
      - "Unlock it from the editor toolbar"
      - "Nothing, structure components are locked on pages created from the template"
      - "Edit the template's initial content"
    answer: 2
    why: "Structure is deliberately locked so every page keeps the header. Initial content, by contrast, would be copied once and could be deleted."
  - q: "After enabling the template you cannot choose it when creating a page. What is the most likely cause?"
    options:
      - "The Sling Model for the page is missing"
      - "The page policy has no clientlib"
      - "The Dispatcher filters templates"
      - "The parent page's allowed templates does not include it"
    answer: 3
    why: "Which templates may be used under a page is controlled by configuration on the parent, in addition to enabling the template. Models, clientlibs and Dispatcher have nothing to do with the template picker."
  - q: "Why use proxy components in the container's allowed list rather than the Core Components directly?"
    options:
      - "Core components cannot be inserted by authors"
      - "Proxies render faster than Core Components"
      - "Your content points at names you control, so you can extend or change versions later"
      - "Policies only accept components under `/apps/<project>`"
    answer: 2
    why: "Proxies give you stable names and the freedom to override later. Core Components can be referenced, but doing so ties your content to paths you do not own."
  - q: "Which result would NOT meet the definition of done?"
    options:
      - "The header appears on a new page without author action"
      - "The insert menu in the content region lists many extra components"
      - "A page author can add Title, Text and Image"
      - "The template and policy are saved in the project under `/conf`"
    answer: 1
    why: "Limiting the toolbox is the whole purpose of the policy. If extra components are offered, the policy is not applied to the right container or not saved."
go_deeper:
  - { title: "Accessibility on AEM: fix the component, not the page", url: "/blog/2026/11/accessibility-on-aem-fix-the-component-not-the-page/", why: "check heading order and alt text in your authored page" }
  - { title: "Previous lesson: Core Components", url: "/learn/aem/core-components/" }
  - { title: "Next level: Content Fragments and Content Fragment Models", url: "/learn/aem/content-fragments-and-models/" }
---
## What you are building

Authors need a landing page that always has your site header, and a main region where they can add only a Title, some Text and an Image. You will build that template, create a page from it and author it. It is the smallest real version of what template authors do on every project.

This ties together the level: HTL and Sling Models render the components, a dialog feeds them, a client library styles them, and policies and the grid keep authors on the rails.

## Before you start

You need the local author instance running, and an archetype project deployed. If you have not done this, work through lessons 5 to 7 first. The archetype ships proxy components for Title, Text and Image and an example set of templates, so you will use those proxies rather than writing new ones. If you prefer a custom component instead of the Image proxy, build one from lesson 10 and use it in the same way.

## How the pieces fit

```text
Landing page template
  structure
    header container  (locked)   -> Title proxy with the site name
    main container    (unlocked) -> policy: Title, Text, Image only
  initial content
    main container    -> one Title to start
  policies
    page policy       (clientlibs, from the Page template type)
    main container policy (allowed components)
```

Everything an author can change on a page lives in the unlocked main container, and everything locked lives in structure.

## The steps, with reasons

**1. Create the template from a template type.** The Page template type gives you a sensible base: a root container and the page policy. Starting from a type means you do not rebuild the basics.

**2. Put the header in Structure mode.** Anything added here is shared by every page from the template and cannot be removed by page authors. A single Title is enough for the exercise. A real site often uses an Experience Fragment, which lesson 17 covers.

**3. Set the container policy.** Select the main container, open the policy, create a new policy and tick Title, Text and Image proxies. Saving writes a policy under `/conf/<site>/settings/wcm/policies` and links the template to it.

**4. Add initial content.** Switching to Initial Content mode lets you give each new page a starting Title. It is copied once, and authors may change it.

**5. Enable and use.** A template must be enabled before authors can pick it, and the parent page must allow it. Then create a page and add the three components.

## What "done" looks like

Tick every one of these:

- A new page created from the template shows the header without any author action.
- The insert menu in the main container lists Title, Text and Image and nothing else.
- Authors can fill in all three components, and the values survive a page reload.
- The header cannot be deleted on the page.
- In `ui.content`, or the content package you export, the template appears under `/conf`. If you keep your work in source control, export it so it is not lost on the next deployment.

## If it goes wrong

- *Template missing in the page wizard:* the template is not enabled, or the parent's allowed templates does not include it.
- *Wrong components in the menu:* the policy was created on a different container, or was not saved.
- *Header missing on a page:* it was added in Initial Content mode instead of Structure.

<details markdown="1">
<summary>Stretch task: add a style option</summary>

In the Title proxy's policy for the main container, add a style called "Centred" with a CSS class, then add a matching rule to your client library. Authors can now pick it from the editor without any change to the component. Compare that with giving them free layout control.

</details>

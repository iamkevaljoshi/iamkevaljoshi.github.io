---
title: "Core Components: use, proxy and extend"
description: "What the AEM Core Components are, why you use them through proxy components, how versions work, and how to extend them without forking."
track: aem
level: 2
order: 14
minutes: 9
outcome: "By the end you can create a proxy component for a Core Component, explain why you never edit the core ones, and pick the right extension option."
prereq: "Lessons 9 to 13 (Sling Models, components, client libraries, templates, layout)."
terms:
  - { t: "Core Components", d: "Adobe's open source library of production-quality components such as Title, Text, Image, Teaser and Container, built to current best practice." }
  - { t: "Proxy component", d: "A small component in your project, with no code of its own, whose `sling:resourceSuperType` points at a Core Component." }
  - { t: "Versioned component", d: "A Core Component whose resource type includes a version, such as `image/v2/image`. Incompatible changes get a new version." }
  - { t: "Delegation", d: "A Sling Model of your own that wraps the Core Component's model and changes part of its output." }
  - { t: "Style System", d: "Policy-based CSS classes that let you vary a Core Component's look without changing its code." }
mistake: "Copying a whole Core Component into your project and editing it. You now own all its code, miss every fix and accessibility improvement, and face a painful upgrade."
try_it:
  - "Open `ui.apps` in your archetype project and find a component such as `title` under `apps/<project>/components`."
  - "Open its `.content.xml` and read the `sling:resourceSuperType` value."
  - "Open the Core Components library site (linked below) and find the same component and its documented versions."
  - "Create a new proxy component for a Core Component you have not used yet, with only a `.content.xml`."
  - "Add the new proxy to the allowed components of a container policy and check it appears in the editor."
quiz:
  - q: "What makes a component a proxy?"
    options:
      - "It copies the Core Component's HTL into your project"
      - "It runs on the publish tier only"
      - "It inherits a Core Component via `sling:resourceSuperType`"
      - "It is hidden from authors"
    answer: 2
    why: "A proxy inherits everything from the core component through the supertype, so you get its fixes by updating Core Components. A copy would lose those updates."
  - q: "You need the Title component to add a subtitle field. What is the better first step?"
    options:
      - "Extend the proxy's dialog and delegate to the core model"
      - "Edit the Core Components code in the product package"
      - "Fork the whole Title component"
      - "Build a component from nothing"
    answer: 0
    why: "Extension keeps you on the upgrade path: the proxy overlays the dialog, and a delegating model adds the field. Editing or forking cuts you off from updates."
  - q: "The Image component moves from v2 to v3 in a new release. Why do existing pages not break?"
    options:
      - "AEM rewrites all content on upgrade"
      - "Proxies keep pointing at the version in their resource type"
      - "Core Components never change"
      - "The Dispatcher translates old markup"
    answer: 1
    why: "Incompatible changes ship as a new version, so existing proxies keep pointing at the old one until you choose to move. That control is the point of versioning."
  - q: "Which statement is NOT true about proxies?"
    options:
      - "You can override the HTL in a proxy when the change is compatible"
      - "A proxy lets several projects on one instance use different versions"
      - "Policies can add styles to a proxy"
      - "Editing files under `/apps/core` is safe if the change is small"
    answer: 3
    why: "The core components are product code, so any edit is lost or conflicts on update. Overrides belong in your own proxy, where they are yours to keep."
go_deeper:
  - { title: "Accessibility on AEM: fix the component, not the page", url: "/blog/2026/11/accessibility-on-aem-fix-the-component-not-the-page/", why: "Core Components do much of the accessibility work for you" }
  - { title: "Previous lesson: The Layout Container and the responsive grid", url: "/learn/aem/layout-container-and-responsive-grid/" }
  - { title: "Next: Project, build a page template with three components", url: "/learn/aem/project-page-template/" }
---
## The problem: every project rebuilding the same Title component

Almost every site needs a title, a text block, an image, a teaser, a list, a navigation. If each project writes its own, each one also has to solve accessibility, responsive images, JSON export and the edge cases again.

**Core Components** are Adobe's answer. They are open source, maintained, and designed for AEM as a Cloud Service, with accessible markup, Sling Models, a Style System and JSON export built in. You browse them in the Core Components library site and the project's documentation.

## Never edit core; proxy it

The Core Components live under `/apps/core/wcm/components`. You do not change them and you do not point content at them directly. Instead, your project defines a **proxy component**:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<jcr:root xmlns:sling="http://sling.apache.org/jcr/sling/1.0"
          xmlns:cq="http://www.day.com/jcr/cq/1.0"
          xmlns:jcr="http://www.jcp.org/jcr/1.0"
    jcr:primaryType="cq:Component"
    jcr:title="Title"
    sling:resourceSuperType="core/wcm/components/title/v3/title"
    componentGroup="MySite - Content"/>
```

That is the whole component. It lives at `/apps/mysite/components/title` and inherits scripts, dialog and model from the core one. Content then uses `mysite/components/title` as its resource type. The archetype ships proxies like this for the common components.

Why the indirection? You own the name, so you can add styles, override one script, or switch versions per project, and your content never refers to a path you do not control.

## Versions

A Core Component's resource type includes a version, such as `core/wcm/components/image/v2/image`. Compatible changes, for example adding a CSS class, go into the existing version. Incompatible ones, for instance changing markup structure, create a new version. Check the Core Components documentation for which versions exist for each component, and for a component you already use, the release notes before you move up.

## Extending without forking

From least to most effort:

1. **Policies and the Style System:** add classes, restrict options. Try this first.
2. **Dialog overlay:** the proxy's `_cq_dialog` can add or hide fields, since dialogs resolve through the supertype.
3. **HTL override:** replace one script in the proxy when the change is compatible with the old markup.
4. **Sling Model delegation:** write your own model that wraps the core model and changes part of its output, bound to the proxy's resource type.

```java
@Model(adaptables = SlingHttpServletRequest.class,
       adapters = Title.class, resourceType = "mysite/components/title",
       defaultInjectionStrategy = DefaultInjectionStrategy.OPTIONAL)
public class MyTitle implements Title {
    @Self @Via(type = ResourceSuperType.class)
    private Title delegate;

    @ValueMapValue private String subtitle;

    public String getText() { return delegate.getText(); }
    public String getSubtitle() { return subtitle; }
    // remaining Title methods delegate in the same way
}
```

Keep the delegate a field rather than copying code. The more you copy, the closer you are to a fork.

## Why not fork

A fork freezes you at the version you copied. You miss accessibility fixes, JSON changes and security patches, and later upgrading means a manual merge. Proxy and delegate, and fork only as a last resort with a plan to come back.

<details markdown="1">
<summary>Stretch question: when would a custom component beat a Core Component?</summary>

When the thing is truly unique to your business, such as a mortgage calculator, and no Core Component comes close. If you are mostly rebuilding Title, Teaser or Image, you are paying for work that already exists.

</details>

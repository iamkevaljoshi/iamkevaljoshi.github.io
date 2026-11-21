---
title: "Project: deploy a hello-world component locally"
description: "Generate an AEM project from the archetype, add a hello component with an HTL script and a dialog, deploy to local author and place it on a page."
track: aem
level: 1
order: 7
minutes: 15
kind: project
outcome: "By the end you can generate an AEM project, add a component with a dialog, deploy it to local author and see it render on a page."
prereq: "Lessons 3 to 6. You need a local author running on port 4502, Maven and a supported Java."
terms:
  - { t: "Component", d: "A reusable piece of a page: a node type defined under /apps with a script that renders it and, usually, a dialog." }
  - { t: "HTL", d: "HTML Template Language, the secure-by-default templating language AEM components use to render markup." }
  - { t: "Dialog", d: "The form an author fills in to set a component's properties." }
  - { t: "Component group", d: "The label that decides which heading a component appears under in the editor's component list." }
mistake: "Building the project but forgetting to install it, or editing files in CRXDE Lite instead of the project. The change then disappears at the next deploy, or never appears at all. The project folder is the source of truth."
try_it:
  - "Generate the project (step 1 below) and open it in your editor."
  - "Create the component folder, .content.xml and hello.html in ui.apps."
  - "Add the dialog in a _cq_dialog folder."
  - "Deploy with mvn clean install -PautoInstallPackage from the ui.apps folder."
  - "Open a page in the Sites editor, add Hello from the component list and enter a name."
  - "Change the greeting in hello.html, redeploy and refresh to confirm the loop works."
quiz:
  - q: "In the hello component, which file does Sling run to render the markup?"
    options:
      - "The _cq_dialog/.content.xml file"
      - "The component's own .content.xml"
      - "hello.html, named after the component"
      - "The pom.xml of the ui.apps module"
    answer: 2
    why: "Sling finds the script named after the component under its resource type path. The dialog describes a form, the .content.xml defines the component node, and the pom drives the build."
  - q: "You added the component, deployed, but it is not in the editor's component list. What is the most likely cause to check first?"
    options:
      - "The Maven version is slightly too new"
      - "Its componentGroup is not allowed by the policy"
      - "The HTL file has a typo inside a comment"
      - "Local author must be restarted after deploy"
    answer: 1
    why: "The editor only lists components from groups the template's container policy allows. Check that your group matches an allowed one. A restart is not needed after a normal deploy."
  - q: "An author types a name containing a script tag into the dialog. What does HTL do with ${properties.name} in normal text?"
    options:
      - "Runs the script, because it came from the author"
      - "Escapes it for the context, so it shows as text"
      - "Deletes the whole component"
      - "Blocks the page from loading"
    answer: 1
    why: "HTL escapes output based on context by default, which is why it is called secure by default. Content is displayed safely and does not run."
  - q: "Which is NOT part of finishing this project?"
    options:
      - "The component appears in the editor on a page"
      - "The text entered in the dialog appears on the page"
      - "The source for the component lives in the project, not only in CRXDE Lite"
      - "You edited the product's /libs files so the component works"
    answer: 3
    why: "Your component belongs under /apps, in your own project. Editing /libs is never needed here and is discouraged on Cloud Service."
go_deeper:
  - { title: "HTL basics (lesson 8)", url: "/learn/aem/htl-basics/", why: "write richer templates safely" }
  - { title: "Components and dialogs (lesson 10)", url: "/learn/aem/components-and-dialogs/", why: "go further with dialog fields" }
  - { title: "Sling Models (lesson 9)", url: "/learn/aem/sling-models/", why: "move logic out of the template" }
  - { title: "Cloud Manager pipelines and quality gates", url: "/blog/2026/11/aem-cloud-manager-pipelines-quality-gates-rde-config-pipeline/", why: "how this reaches a real environment" }
---
## What you will build

You will build one small thing, end to end: a `hello` component that greets a name chosen by an author. It touches the whole chain from the previous lessons: a project module, a node under `/apps`, a Sling resource type, and a property on a content node.

**Done looks like this:** you open a page in your local author, add the Hello component, type a name in its dialog, and the page shows `Hello, <name>!`.

You need a running local author on `http://localhost:4502` (lesson 6), Maven, and the Java version your SDK requires.

## Step 1: generate the project

Run this in a folder where you keep projects:

```bash
mvn -B org.apache.maven.plugins:maven-archetype-plugin:3.4.1:generate \
  -D archetypeGroupId=com.adobe.aem \
  -D archetypeArtifactId=aem-project-archetype \
  -D archetypeVersion=58 \
  -D appTitle="My Site" \
  -D appId="mysite" \
  -D groupId="com.mysite"
```

Check the archetype's GitHub page for the latest `archetypeVersion`, because new versions are released often. By default it targets Cloud Service. Move into the new `mysite` folder.

## Step 2: build and install the starter project

```bash
cd mysite
mvn clean install -PautoInstallSinglePackage
```

This installs the starter site on local author. Open `http://localhost:4502/sites.html/content/mysite` and you should see the starter pages. Without this step you would have no page to put your component on.

## Step 3: create the component

Inside `ui.apps`, create this folder:

```text
ui.apps/src/main/content/jcr_root/apps/mysite/components/hello/
```

Add `.content.xml`, which defines the component node:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0"
          xmlns:cq="http://www.day.com/jcr/cq/1.0"
          jcr:primaryType="cq:Component"
          jcr:title="Hello"
          jcr:description="Greets a name"
          componentGroup="mysite - Content"/>
```

The group `mysite - Content` is the one the archetype's starter template allows. If you used a different `appTitle`, use the matching group name from the existing components in your project.

Add `hello.html`, the HTL script:

```html
<p class="cmp-hello">Hello, ${properties.name || 'world'}!</p>
```

`properties.name` reads the `name` property of the component's node. If an author leaves it empty, the fallback `world` is used. HTL escapes the value for you.

## Step 4: add the dialog

Create `hello/_cq_dialog/.content.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<jcr:root xmlns:sling="http://sling.apache.org/jcr/sling/1.0"
          xmlns:jcr="http://www.jcp.org/jcr/1.0"
          xmlns:nt="http://www.jcp.org/jcr/nt/1.0"
          jcr:primaryType="nt:unstructured"
          jcr:title="Hello"
          sling:resourceType="cq/gui/components/authoring/dialog">
    <content
        jcr:primaryType="nt:unstructured"
        sling:resourceType="granite/ui/components/coral/foundation/container">
        <items jcr:primaryType="nt:unstructured">
            <name
                jcr:primaryType="nt:unstructured"
                sling:resourceType="granite/ui/components/coral/foundation/form/textfield"
                fieldLabel="Name"
                name="./name"/>
        </items>
    </content>
</jcr:root>
```

The field name `./name` is the property that gets written onto the component's node. It is the same `name` your HTL reads.

## Step 5: deploy only the code

From the `ui.apps` folder:

```bash
cd ui.apps
mvn clean install -PautoInstallPackage
```

This is faster than rebuilding the whole project. Use the root build when you change several modules.

## Step 6: use it on a page

1. Open a page, for example `http://localhost:4502/editor.html/content/mysite/us/en.html`, or one from the Sites console.
2. In the editor, open the component list in the side panel and look for **Hello** in the group you set.
3. Drag it into the page's main container.
4. Open its dialog, enter your name and save.
5. The page now shows `Hello, <your name>!`.

In CRXDE Lite, find the node under the page's `jcr:content`. You should see `sling:resourceType = mysite/components/hello` and `name` with your value. That is the whole lesson in one node.

## If something is wrong

- **No Hello in the list.** Check `componentGroup` against a group the template allows. Check the deploy printed `BUILD SUCCESS`.
- **Dialog does nothing.** Check the folder is exactly `_cq_dialog` and the field name is `./name`.
- **Blank output.** Check the script is named `hello.html` and sits next to the component's `.content.xml`.

<details markdown="1">
<summary>Stretch question: where did the greeting text come from?</summary>

The author typed it, the dialog saved it as the `name` property on a node under `/content`, and Sling used that node's `sling:resourceType` to find `hello.html` under `/apps`. Content and code are separate: you can change one without touching the other.

</details>

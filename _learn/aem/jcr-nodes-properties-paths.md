---
title: "The JCR: nodes, properties and paths"
description: "How AEM stores everything as a tree of nodes and properties, what a page looks like in the repository, and what lives under /content, /apps, /libs and /conf."
track: aem
level: 1
order: 3
minutes: 9
outcome: "By the end you can read a repository path, say what a node and a property are, and find where a page's text and its component type are stored."
prereq: "Lesson 2, Author, publish and preview."
terms:
  - { t: "JCR", d: "The Java Content Repository standard: a tree of nodes with properties, which AEM uses to store content, code and configuration." }
  - { t: "Node", d: "One item in the tree. It has a name, a type, a parent and optionally children, and it carries properties." }
  - { t: "Property", d: "A named value on a node, such as a title, a number, a date or a list of strings." }
  - { t: "Path", d: "The address of a node, written as names separated by slashes, such as /content/mysite/us/en." }
  - { t: "sling:resourceType", d: "A property that says which component or script should render this node." }
mistake: "Thinking the repository is a folder of files or a set of SQL tables. It is a tree of nodes with properties, so you navigate it by path, and adding a field to one node never changes any other node."
try_it:
  - "Start a local author (lesson 6 shows how) and open CRXDE Lite from the AEM start screen tools, or go to /crx/de on your local instance."
  - "Expand the tree to /content and find a page. Open its jcr:content child and read the jcr:title property."
  - "Find the sling:resourceType property on jcr:content and note its value."
  - "Open the same path under /apps, or /libs if it is not there, and look at the component it names. Do not edit anything under /libs."
  - "Write down the full path to one component node inside the page's jcr:content tree."
quiz:
  - q: "In the JCR, what is a property?"
    options:
      - "A child node that holds other nodes"
      - "A named value stored on a node"
      - "A folder at the top of the repository"
      - "A script that renders the node"
    answer: 1
    why: "Nodes form the tree, and properties hold the values on those nodes. A child node is another node, not a property."
  - q: "A page lives at /content/mysite/us/en/home. Where is its title most likely stored?"
    options:
      - "In a property such as jcr:title on /content/mysite/us/en/home/jcr:content"
      - "In a file named home.html inside /content/mysite/us/en"
      - "In a database table row keyed by the page name"
      - "In the sling:resourceType property of the home node itself"
    answer: 0
    why: "A cq:Page node is a thin wrapper, and its data sits on the jcr:content child. The page is not a file or a table row, and sling:resourceType says how to render, not what the title is."
  - q: "A developer needs a custom version of a product component that lives under /libs. What should they do on AEM as a Cloud Service?"
    options:
      - "Edit the component in /libs directly with CRXDE Lite"
      - "Ask the author team to change the property in /content"
      - "Create their own component under /apps, and overlay or extend rather than edit /libs"
      - "Copy it into /var so it survives deployment"
    answer: 2
    why: "/libs is product code and effectively read-only on Cloud Service. Your code belongs in /apps. /var holds runtime data and is not a place for code."
  - q: "Which statement is NOT true about the JCR?"
    options:
      - "Every node has exactly one parent, apart from the root"
      - "Two sibling nodes of the same type can carry different properties"
      - "A path identifies a node by its position in the tree"
      - "You must define a fixed set of columns before you can store a node"
    answer: 3
    why: "That describes a relational table. In the JCR, node types constrain things loosely and nodes of the same type can differ, which is why content structure can evolve without migrations."
go_deeper:
  - { title: "JCR explained for SQL developers", url: "/blog/2026/11/jcr-explained-for-sql-developers/", why: "the full comparison with tables and joins" }
  - { title: "Content modelling: JCR vs relational vs document database", url: "/blog/2026/11/content-modelling-jcr-vs-relational-vs-document-database/", why: "when each model fits" }
  - { title: "Oak storage on AEM as a Cloud Service", url: "/blog/2026/11/oak-storage-tarmk-mongomk-aem-cloud-service/", why: "what stores the tree underneath" }
  - { title: "Next lesson: Sling", url: "/learn/aem/sling-url-to-response/" }
---
## One tree for everything

Think of the repository as a family tree. There is one ancestor at the top, and every other entry has exactly one parent and may have children. To point at someone you give the chain of names from the top: the path.

AEM keeps almost everything in one such tree: pages, images, component code, configuration and user accounts. This storage is the **JCR** (Java Content Repository), and Apache Oak is the engine that implements it.

Two words matter:

- A **node** is an entry in the tree. It has a name, a type and a parent.
- A **property** is a named value on a node: text, a number, a date, a boolean or a list.

A **path** is the address of a node, such as `/content/mysite/us/en/home`.

## What a page looks like

A page is not one blob. It is a small tree:

```text
/content/mysite/us/en/home                  (cq:Page)
  └─ jcr:content                            (cq:PageContent)
       jcr:title = "Welcome"
       sling:resourceType = "mysite/components/page"
       └─ root                              (a container)
            └─ hero                         (a component)
                 sling:resourceType = "mysite/components/hero"
                 text = "Hello"
```

The `cq:Page` node is a thin wrapper, and the interesting data lives on its `jcr:content` child. Each component the author drops on the page becomes another node under it, with the author's choices stored as properties. When an author fills in a dialog, they are writing properties onto a node.

The property to remember is `sling:resourceType`. It says *which code renders this node*. In the next lesson you will see how Sling uses it.

## The top-level folders

| Path | What it holds | Who changes it |
|---|---|---|
| `/content` | Pages and other site content | Authors |
| `/apps` | Your project's components, scripts and configuration | Developers, through deployment |
| `/libs` | Adobe's product code | Adobe only |
| `/conf` | Templates, policies and site configuration | Developers and authors |
| `/var` | Runtime and working data | The system |
| `/home` | Users and groups | Administrators |

On AEM as a Cloud Service, `/apps` and `/libs` are **immutable** at runtime. You change them by deploying code through a pipeline, not by editing a live instance. You must also treat `/libs` as off limits, even locally. Copying and changing product code makes every product update harder.

## Why this is not a file system or a database

A file system has folders and files, and a file is one opaque blob. A JCR node can hold many typed properties and children, and you can search inside them.

A SQL database makes you define columns first, and every row has them. In the JCR, two nodes of the same type can carry different properties, so authors can add a field to one component without any schema change. The trade-off is that you get fewer guarantees, and no joins, so you design content around the tree. The linked blog post goes through the full comparison.

**CRXDE Lite** is the browser tool that lets you see this tree. It is handy on a local instance for learning and debugging. Do not use it as a way to make changes you want to keep. Changes belong in your project's code and are deployed.

<details markdown="1">
<summary>Stretch question: why is the title on jcr:content and not on the page node?</summary>

Separating the page's identity from its content lets the repository treat the page as a container with its own position, children and rules, while the content node carries the data. It also means a page can have other children, such as sub-pages, beside `jcr:content` without the two being mixed up.

</details>

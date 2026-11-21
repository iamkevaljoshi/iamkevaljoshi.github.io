---
title: "Local development with the AEM CLI"
description: "Set up local Edge Delivery Services development: Node, the AEM CLI, aem up on localhost:3000, the project layout, linting and how local code meets real content."
track: eds
level: 1
order: 5
minutes: 9
outcome: "By the end you can install the AEM CLI, run a project locally against preview content, and know what each top-level folder is for."
prereq: "Lesson 3: The code repository, the GitHub app and the content source. You should have Git and a terminal available."
terms:
  - { t: "AEM CLI", d: "The command-line tool, installed from the npm package `@adobe/aem-cli`, that runs your project locally." }
  - { t: "aem up", d: "The command that starts the local development server and opens your site in the browser." }
  - { t: "AEM Proxy", d: "The local server that serves your local code and fetches content from the preview environment." }
  - { t: "Linting", d: "Automatic checks of your JavaScript and CSS style and common errors, run with `npm run lint`." }
mistake: "Editing content locally and expecting it to save. Local development only changes code. Content always comes from the preview environment, so edit documents in the content source."
try_it:
  - "Check Node is installed with `node -v`. Install a current LTS release if not."
  - "Run `npm install -g @adobe/aem-cli`, then clone your repo with `git clone`."
  - "In the repo folder run `npm install`, then `aem up` and open `http://localhost:3000/`."
  - "Edit a CSS value in `styles/styles.css` and watch the browser update without a manual refresh."
  - "Run `npm run lint` and read what it reports."
quiz:
  - q: "You run `aem up` and see your page. Where did the content come from?"
    options:
      - "A copy of the documents inside your repository"
      - "A local database that `aem up` created"
      - "The preview environment, fetched through the local proxy"
      - "The live site, fetched straight from the CDN"
    answer: 2
    why: "The AEM Proxy serves your local code and takes content from the preview environment. There is no local content, which also means you test against real content."
  - q: "You change `blocks/cards/cards.js` while `aem up` is running. What happens?"
    options:
      - "Nothing until you restart the CLI"
      - "The page picks up the change in the browser, without a build step"
      - "You must run a bundler first"
      - "The change is published to `.aem.live` instantly"
    answer: 1
    why: "Changes to JavaScript and CSS appear in the browser straight away, because the project has no build step. Nothing reaches the live site until you push and merge."
  - q: "A teammate says `aem: command not found`. What is the most likely fix?"
    options:
      - "Install the CLI globally with `npm install -g @adobe/aem-cli`"
      - "Delete `node_modules` and push again"
      - "Reinstall the GitHub app"
      - "Edit `head.html`"
    answer: 0
    why: "The command comes from the globally installed package. The GitHub app, `head.html` and pushes have nothing to do with the CLI being available."
  - q: "Which is NOT where you would normally work as a developer?"
    options:
      - "`blocks/` for block code and styles"
      - "`scripts/` for global JavaScript"
      - "`styles/` for global CSS"
      - "A `content/` folder for page text"
    answer: 3
    why: "Content is not in the repository. Pages are written in the content source. The other three folders are the standard homes for code."
go_deeper:
  - { title: "Edge Delivery Services performance: keep Lighthouse at 100", url: "/blog/2026/11/edge-delivery-services-performance-keep-lighthouse-100/", why: "what linting and local checks protect" }
  - { title: "Edge Delivery Services helper tool", url: "/tools/edge-delivery-services-helper/", why: "handy URL and setup helper" }
  - { title: "Previous lesson: Authoring in documents and spreadsheets", url: "/learn/eds/authoring-docs-and-sheets/" }
  - { title: "Next lesson: Project: a published page from a document", url: "/learn/eds/project-first-published-page/" }
---
## How do you develop without a server?

On traditional AEM you run a local author instance and deploy code into it. On EDS you do something much lighter: a small tool runs on your laptop, serves your local files, and borrows the content from the preview environment. It is like trying on a new coat in a shop mirror: the shop (preview content) stays put, only the coat (your code) changes.

## Install and run

You need Node.js and Git. Then install the **AEM CLI**:

```bash
npm install -g @adobe/aem-cli
git clone https://github.com/<owner>/<repo>
cd <repo>
npm install
aem up
```

`aem up` starts the **AEM Proxy** and opens `http://localhost:3000/`. The boilerplate README gives the same commands. Edits to `.css` and `.js` files show in the browser straight away, because there is no bundler or build step.

## What the proxy does

```text
Browser --> localhost:3000 (AEM Proxy)
               |-- code:    your local files
               '-- content: fetched from the preview environment
                            (https://main--repo--org.aem.page/)
```

So you always develop against real, current content. If a page looks wrong, the cause is either your code or the content structure, and you can check both. To change content, edit the document and preview it again. Local pages that do not exist in your content source simply fail to load.

## The project layout

```text
blocks/    one folder per block: cards/cards.js and cards.css
scripts/   aem.js (core library), scripts.js (global JS and block loading)
styles/    styles.css (global, includes what the first render needs),
           lazy-styles.css (loaded later)
head.html  markup merged into <head>
404.html   served when no content or code matches
icons/ fonts/
```

The conventions matter. A block's folder name, file names and CSS class name are the same, and the JavaScript is an ES module exporting a default function. Lesson 7 builds one. Keep `head.html` close to the boilerplate version, and leave `aem.js` alone unless you have a strong reason.

## Common problems

Three issues cause most first-run trouble. If `aem` is not found, the global install did not complete or your shell path does not include npm's global folder. If port 3000 is busy, another process is using it, so stop that process and run `aem up` again. If a page returns a 404 locally, the document probably has not been previewed yet, so preview it from the content source first.

Also remember that your browser caches aggressively. If a change does not appear, do a hard refresh before assuming the code is wrong.

## Linting and publishing code

The repository ships linting for JavaScript and CSS. Run:

```bash
npm run lint
```

Fix what it reports before you push. Pull requests that fail lint are a common source of avoidable rework, and clean code is part of keeping performance high.

To release code, use Git: add, commit and push. The AEM Code Sync app sends the push to the code bus, and your branch's `.aem.page` URL shows it. Merge to `main` to take it live.

<details markdown="1">
<summary>Stretch question: why does the local proxy fetch content from preview rather than live?</summary>

Preview always has the latest authored version, including pages that are not published yet. Developers need to see work in progress, and authors need to be able to review new pages without them being public. Live is for visitors only.

</details>

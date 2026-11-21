---
title: "fstab, paths.json and content mappings"
description: "How Edge Delivery Services maps a content source to URLs: fstab.yaml mountpoints, AEM path mappings, folder mapping, and what moved to the Configuration Service."
track: eds
level: 4
order: 20
minutes: 9
outcome: "By the end you can explain how a URL on your site is connected to a document or page in the content source, and find which configuration is in charge on your project."
prereq: "Lesson 3, The code repository, the GitHub app and the content source."
terms:
  - { t: "Mountpoint", d: "A line in fstab.yaml that connects a URL path prefix on your site to a folder in a content source such as Google Drive or SharePoint." }
  - { t: "Path mapping", d: "A rule, used with AEM authoring, that says which content path in AEM becomes which URL on the site." }
  - { t: "Folder mapping", d: "A rule that lets one page serve content for a whole range of URLs below a folder." }
  - { t: "Configuration Service", d: "An API on admin.hlx.page that stores site configuration centrally, and overrides the equivalent files in the repository once enabled." }
mistake: "Editing fstab.yaml or paths.json on a site that already uses the Configuration Service. The file is ignored, nothing changes, and the team loses hours wondering why."
try_it:
  - "Open the fstab.yaml in the root of your project repository, or note that it is missing, and write down where it says your content lives."
  - "Take one published URL, such as `/about`, and write the exact document or page it should come from."
  - "Open `/config.json` or `/paths.json` on your .aem.live site, if present, and see what it returns."
  - "Ask your team: is this site on the Configuration Service? Write down the answer before you change any config file."
quiz:
  - q: "What does a mountpoint in fstab.yaml do?"
    options:
      - "It connects a URL path prefix to a folder in the content source"
      - "It tells the CDN which origin server to cache"
      - "It lists the blocks a page is allowed to use"
      - "It decides which branch of the repository is published"
    answer: 0
    why: "A mountpoint links a URL prefix to a content folder. It has nothing to do with CDN origins, block lists or branches, which are handled elsewhere."
  - q: "Your site is on the Configuration Service, and a colleague edits fstab.yaml to change the content folder. What happens?"
    options:
      - "The change applies after the next code push"
      - "The change is merged with the service settings"
      - "The change is ignored, because the service settings take priority"
      - "The site returns an error until the file is removed"
    answer: 2
    why: "Once the service is enabled, its settings override the repository files. The old file is simply dead weight, which is why you should delete it."
  - q: "You have 40,000 product pages from an API and want each to have a clean URL, be indexed and rank in search. Is folder mapping a good fit?"
    options:
      - "Yes, one template page serves every product with ideal SEO"
      - "No, it gives an effectively infinite URL space and is a poor fit for SEO needs"
      - "Yes, but only if you also add a sitemap per product"
      - "No, because folder mapping only works on staging sites"
    answer: 1
    why: "Folder mapping returns 200 for any URL below the folder, which suits authenticated apps but not pages you want indexed. The docs point to real per-URL content such as a custom content source or JSON2HTML for that."
  - q: "Which statement about path mappings is NOT true?"
    options:
      - "They help AEM authoring content appear at clean site URLs"
      - "They can map a configuration page to a config file"
      - "They can be stored in the Configuration Service for a site"
      - "They are required for every site that uses Google Drive"
    answer: 3
    why: "Drive and SharePoint sites use mountpoints. Path mappings belong to AEM authoring, where the content tree has prefixes such as /content/site/ that you do not want in the URL."
go_deeper:
  - { title: "Repoless on AEM Edge Delivery Services: one codebase, many sites", url: "/blog/2026/10/aem-eds-repoless-one-codebase-many-sites/", why: "has a table of which config moved from files to the Configuration Service" }
  - { title: "Edge Delivery Services config helper", url: "/tools/edge-delivery-services-helper/", why: "generates the files that live beside fstab.yaml" }
  - { title: "Next lesson: Metadata, indexing and helix-query.yaml", url: "/learn/eds/metadata-indexing-helix-query/" }
---
## The question: how does /about find its document?

You publish a document called `about` and visit `/about`. Something, somewhere, knows that this URL belongs to that document in that folder of that drive. That something is **configuration**, and on Edge Delivery Services it has lived in more than one place over time. Knowing which place is in charge on your project saves you from the most frustrating kind of bug: editing a setting that is no longer read.

Think of a building's directory board in the lobby. The room numbers are the URLs. The board says which company is behind each door. Mapping is the board.

## The classic way: fstab.yaml

For Google Drive or SharePoint sites, the original setup is a file called `fstab.yaml` in the root of the code repository. The name comes from the Unix file that mounts disks. It "mounts" a content folder at a URL prefix:

```yaml
mountpoints:
  /: https://drive.google.com/drive/folders/your-folder-id
```

Here everything under `/` comes from that one folder. A document called `blog/hello` in the folder becomes `/blog/hello`. You could mount a second folder at `/docs/` to give another team their own space, with its own permissions.

## AEM authoring: path mappings

When content is authored in AEM, pages live under paths such as `/content/my-site/`. You do not want that in the URL. A **path mapping** says "strip this prefix". In the repoless blog post this looks like `"/content/brand/:/"`, which maps the AEM content root to the site root, and you can also map a configuration page to `/.helix/config.json`. In older setups these rules sat in a `paths.json` file in the repository. In current setups they can be part of the site's configuration instead.

## Folder mapping: handle with care

Sometimes one page has to answer many URLs, say `/orders/123` and `/orders/456`, both served by a page at `/orders/default`. That is **folder mapping**. The docs are blunt: it is recommended only for narrow cases such as authenticated sites, or single-page apps with content that is not meant to be indexed. It creates an effectively infinite URL space that always returns a 200 status. For catalogues you want indexed, prefer real content per URL, a custom content source, or JSON2HTML (covered later in lesson 29).

## What moved, and what to check

Over time, configuration moved from repository files and special spreadsheets into the **Configuration Service**, an API on `admin.hlx.page`. Once it is enabled, its settings override the files, and Adobe's guidance is to remove the old ones (`fstab.yaml`, `helix-query.yaml`, `helix-sitemap.yaml`, `robots.txt` and the Sidekick config) so nobody edits them by mistake.

So your first question on any project is not "what does fstab.yaml say?" but "is this site on the Configuration Service?" Check the current docs at aem.live for the exact endpoints, because this area has changed and may change again. The folder-mapping syntax in particular has moved between file and service, so confirm it in the current documentation before you rely on it.

<details markdown="1">
<summary>Predict first, then reveal: you add a new market folder but the URL gives a 404</summary>

Which three things would you check, in order? First, that the page was **previewed and published**, since a document does nothing until then. Second, that the URL prefix is covered by a mountpoint or path mapping. Third, that you edited the configuration that is actually live, not a stale file. Most 404s on a new section are one of these three.

</details>

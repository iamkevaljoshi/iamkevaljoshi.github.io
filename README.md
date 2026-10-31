# Keval Joshi: personal site

A multi-page [Jekyll](https://jekyllrb.com) site that GitHub Pages builds automatically. There is no build step to run locally.

## Edit the content
- `_data/profile.yml`: all text for Home, About, Experience, Work and Contact. Replace the `[bracketed]` placeholders.
- `assets/css/site.css`: colours and layout.

## Write a blog post
Add a file to `_posts/` named `YYYY-MM-DD-your-title.md`:

```markdown
---
title: "Your post title"
tags: [architecture, aws]
---
First paragraph (used as the excerpt).

## A heading
Body in Markdown. Fenced code blocks are highlighted.
```

Commit and push; the post appears under **Blog** and in the RSS feed (`/feed.xml`).

## Add a case study
Copy `_work/aem-cloud-service-migration.md`, fill in every `[placeholder]` (anonymise the client), and set `published: true`. Each case study gets its own page at `/work/<file-name>/` and appears on Home and Work.

## SEO and AI search (GEO)
- Every page has a title, description, canonical URL, Open Graph/Twitter card (`assets/img/og.png`, regenerate from `tools/og.html`) and JSON-LD structured data: Person with credentials, ProfilePage, BlogPosting, FAQPage, BreadcrumbList.
- `sitemap.xml` (jekyll-sitemap), `feed.xml`, `robots.txt` (allows search and AI crawlers) and `llms.txt` (a plain summary for AI assistants) are generated automatically.
- `summary` and `faq` in `_data/profile.yml` are written as quotable facts; keep them accurate.
- Give each post a `description:` (about 150 characters) and add `last_modified_at:` when you update it.
- Placeholders in `[square brackets]` are hidden on the site until replaced.
- After launch, add the site to Google Search Console and Bing Webmaster Tools and submit `/sitemap.xml`, and put the site URL in your LinkedIn profile.

## Publish
Repo **Settings → Pages → Deploy from a branch → `main` / root**. The site is served at `https://iamkevaljoshi.github.io/`.

## Preview locally (optional)
Needs a recent Ruby: `gem install bundler jekyll jekyll-feed && jekyll serve`.

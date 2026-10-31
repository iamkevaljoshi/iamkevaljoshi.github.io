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

## Publish
Repo **Settings → Pages → Deploy from a branch → `main` / root**. The site is served at `https://iamkevaljoshi.github.io/`.

## Preview locally (optional)
Needs a recent Ruby: `gem install bundler jekyll jekyll-feed && jekyll serve`.

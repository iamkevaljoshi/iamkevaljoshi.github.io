---
title: "GraphQL and persisted queries"
description: "How the AEM GraphQL API serves Content Fragments, and why production sites use persisted queries over GET so the CDN can cache them."
track: aem
level: 3
order: 18
minutes: 10
outcome: "By the end you can write a small GraphQL query over a Content Fragment Model, persist it, and explain why production uses the persisted version."
prereq: "Lesson 16: Content Fragments and models."
terms:
  - { t: "GraphQL", d: "A query language where the client names exactly the fields it wants and receives only those." }
  - { t: "GraphiQL", d: "The in-browser tool in AEM for writing, testing and saving GraphQL queries." }
  - { t: "Persisted query", d: "A query saved on the server under a name, then run with a simple GET request." }
  - { t: "Endpoint", d: "The configured GraphQL entry point, either the global one or one tied to a Sites configuration." }
mistake: "Sending ad hoc POST queries from the browser in production. They cannot be cached by the CDN, so every visitor hits AEM, and arbitrary queries are harder to control."
try_it:
  - "Open the GraphiQL tool on your local AEM SDK author instance, and pick an endpoint."
  - "Write a list query for a model you created, asking for two fields only."
  - "Run it and compare the response size with asking for every field."
  - "Save it with Save As, then use Copy URL on the saved query."
  - "Open the copied URL in a browser and note that it is a plain GET."
quiz:
  - q: "Why do production sites prefer persisted queries?"
    options:
      - "They allow the client to send any query it likes"
      - "They are run with GET on a short URL, so a CDN can cache them"
      - "They bypass permissions on the publish tier"
      - "They are the only way GraphQL works in AEM"
    answer: 1
    why: "A persisted query is executed with GET at a stable URL, which a CDN can cache. Ad hoc queries are not tied to a cacheable URL, and persisting does not bypass permissions."
  - q: "A model called Article exists. What query name does AEM generate for fetching a list of articles?"
    options:
      - "getArticles"
      - "articleItems"
      - "articleList"
      - "listOfArticle"
    answer: 2
    why: "AEM derives query names from the model name, such as articleList for lists and articleByPath for a single fragment. The other names are plausible but not generated."
  - q: "Your team will deploy a new query to production. What is the recommended workflow?"
    options:
      - "Create it directly on publish so it is live immediately"
      - "Persist it on author, test, then publish it so it reaches publish"
      - "Skip persisting and send it as a POST body"
      - "Ask each front-end developer to keep it in their code"
    answer: 1
    why: "Adobe recommends persisting on author and moving queries to publish through publishing or packages, not creating them on production. Raw POST bodies lose the caching and control that persisting gives."
  - q: "Which statement is NOT true about persisted query execution?"
    options:
      - "The path follows /graphql/execute.json/<path>"
      - "Variables can be passed in the URL after the path, URL-encoded"
      - "Publish responses are sent with cache headers a CDN can use"
      - "The query text is sent in the URL as an ordinary query string"
    answer: 3
    why: "The query is stored on the server and referenced by name, so the URL holds a short path rather than query text. That is why the URL stays short and cacheable."
go_deeper:
  - { title: "When AEM content belongs outside the JCR", url: "/blog/2026/11/when-aem-content-belongs-outside-the-jcr/", why: "headless delivery and where content should live" }
  - { title: "Composable, headless or traditional AEM: a decision framework", url: "/blog/2026/11/composable-headless-or-traditional-aem-decision-framework/", why: "when an API-first approach pays off" }
  - { title: "Next lesson: The DAM", url: "/learn/aem/dam-assets-renditions/" }
---
## The problem: a front end that wants data, not pages

A mobile app and a single-page application want the title and summary of the latest ten articles. They do not want HTML. AEM exposes Content Fragments to them through a **GraphQL API**: the client describes the fields it needs, and the response contains exactly those.

AEM builds the GraphQL schema from your **enabled** Content Fragment Models. A model named `Article` becomes a type, and AEM generates queries such as `articleList` (many) and `articleByPath` (one). It also adds helper fields starting with an underscore, such as `_path`. Because everything enabled becomes queryable, do not put sensitive information in model or field names.

## A small query

You try queries in **GraphiQL**, the in-browser tool, where you select an endpoint first. The global endpoint lives at `/content/cq:graphql/global/endpoint`.

```text
{
  articleList {
    items {
      _path
      title
      summary { plaintext }
    }
  }
}
```

The response mirrors the query:

```json
{
  "data": {
    "articleList": {
      "items": [
        { "_path": "/content/dam/demo/articles/first", "title": "First", "summary": { "plaintext": "Short intro." } }
      ]
    }
  }
}
```

## Why persist the query

Anyone can POST this query. That is handy while building, but poor in production: the CDN cannot cache a POST, and visitors would run arbitrary queries against your servers.

A **persisted query** is saved on the server under a name. Clients run it with a GET:

```text
GET https://<publish-host>/graphql/execute.json/<config>/<query-name>
```

The path pattern is `/graphql/execute.json/<persistent-path>`, where the path is the shortened one AEM gives you (for the global endpoint it begins with `global`). Variables are appended after the path with semicolons, such as `;category=news`, and must be URL-encoded. In GraphiQL you persist with **Save As**, then use **Copy URL** from the query menu. Queries are stored under `/conf/<config>/settings/graphql/persistentQueries/`.

You get four benefits: a short URL, a CDN-friendly GET, a fixed query that cannot be abused, and a query that is versioned with your project.

## Caching

Adobe documents default cache headers for persisted queries. On publish, the CDN lifetime (`s-maxage`) defaults to 7200 seconds, the browser `max-age` is 60, and stale-while-revalidate and stale-if-error apply. On author the CDN value is 60. You can override these on publish, for example per query in GraphiQL, which matters when content must refresh quickly. Check the current docs before relying on specific values.

## Author first, then publish

Persist and test on author. Then use **Publish** on the query in GraphiQL, or ship queries in a content package, so they exist on publish. Fragments must be published too, or the publish tier has nothing to return.

<details markdown="1">
<summary>Predict first, then reveal: you edit a fragment and the app still shows old text</summary>

Most likely the fragment was not published, or the persisted query response is still cached at the CDN for up to its TTL. Check publish status first, then the response headers, then your TTL setting.

</details>

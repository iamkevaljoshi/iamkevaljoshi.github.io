---
title: "Project: a headless content feed"
description: "Build a headless feed: model Articles, author three fragments, persist a GraphQL query, fetch it from publish and render it in a tiny HTML page."
track: aem
level: 3
order: 21
minutes: 20
kind: project
outcome: "By the end you can serve three Content Fragments as JSON through a persisted query and render them in a plain HTML page."
prereq: "Lessons 16 and 18, and a running local AEM SDK from lesson 6."
terms:
  - { t: "Content Fragment Model", d: "The blueprint that defines the Article fields." }
  - { t: "Persisted query", d: "A saved GraphQL query that is run with a GET request." }
  - { t: "Endpoint", d: "The GraphQL entry point you select in GraphiQL." }
  - { t: "CORS", d: "The browser rule that stops a page on one origin reading responses from another unless the server allows it." }
mistake: "Forgetting to enable the model and the GraphQL endpoint, or to publish fragments. GraphiQL shows no model or the feed is empty, and the cause is configuration, not your query."
try_it:
  - "Enable Content Fragment Models and GraphQL Persisted Queries on a configuration in the Configuration Browser, and make sure the Assets folder uses it."
  - "Create a model called Article with title (single line), summary (multi line), image (content reference) and body (multi line). Enable it."
  - "Create three Article fragments in a folder under /content/dam, each with a title and summary."
  - "Open GraphiQL, pick your endpoint, write the articleList query, run it, then Save As and name it article-list."
  - "Copy the query URL and fetch it with curl from your local instance."
  - "Write the HTML page below, open it in a browser, and fix CORS if the request is blocked."
quiz:
  - q: "GraphiQL shows no Article type in your schema. What should you check first?"
    options:
      - "Whether the Dispatcher is running"
      - "Whether fragments have been published to the CDN"
      - "Whether the HTML page uses fetch correctly"
      - "Whether the model is enabled and the endpoint is configured"
    answer: 3
    why: "The schema is generated from enabled models on a configured endpoint. Dispatcher, publishing and your front-end code come later in the chain."
  - q: "Your page works with the local author URL but fails against publish. Which cause fits best?"
    options:
      - "Fragments or the query were not published to publish"
      - "GraphQL does not work on publish"
      - "The query must be rewritten in SQL"
      - "The page needs a Sling model"
    answer: 0
    why: "Author content is not on publish until it is published. The query and fragments both need publishing. GraphQL works on publish, so the tempting claim is wrong."
  - q: "Why does the project fetch a persisted query instead of POSTing the query text?"
    options:
      - "POST is not allowed in browsers"
      - "A GET at a fixed URL can be cached, and the query is fixed"
      - "Persisted queries return more fields"
      - "It avoids needing to publish anything"
    answer: 1
    why: "Persisted queries run with GET at a fixed URL, which suits CDN caching and prevents arbitrary queries. Browsers can POST, and persisting does not change the returned fields."
  - q: "Which sign means you are really done?"
    options:
      - "GraphiQL runs the query without errors"
      - "The model has been created"
      - "The HTML page lists all three titles from the persisted URL"
      - "curl returns three items from the author instance"
    answer: 2
    why: "Done means the feed works end to end through the persisted URL and into a page. A working query or model proves only one link in the chain, and curl on author does not prove rendering or publish."
go_deeper:
  - { title: "Composable, headless or traditional AEM: a decision framework", url: "/blog/2026/11/composable-headless-or-traditional-aem-decision-framework/", why: "when this pattern is the right architecture" }
  - { title: "Agent-ready AEM site: structured content, NLWeb and WebMCP", url: "/blog/2026/11/agent-ready-aem-site-structured-content-nlweb-webmcp/", why: "structured feeds also help machines" }
  - { title: "Previous lesson: GraphQL and persisted queries", url: "/learn/aem/graphql-persisted-queries/" }
---
## What you will build

A small content feed with no page templates at all. Three Article fragments are served as JSON by a persisted GraphQL query, and a plain HTML page renders them. It is the smallest real headless setup, and the same shape a mobile app or single-page application would use.

## Steps

**1. Configure.** On your local SDK, enable Content Fragment Models and GraphQL Persisted Queries on a configuration in the Configuration Browser, and apply it to the Assets folder you will use. Without this, models and endpoints will not appear.

**2. Model.** In the Content Fragment Models area, create `Article` with `title`, `summary`, `image` and `body`, then enable it. Remember: this model is now a contract (lesson 16).

**3. Author.** Create three Article fragments with titles and short summaries. Use any images from your DAM.

**4. Query.** In GraphiQL select the endpoint and run:

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

Click **Save As**, name it `article-list`, then use **Copy URL** from the query menu. The URL has the form `/graphql/execute.json/<config>/article-list`.

**5. Fetch it.**

```bash
curl -s "http://localhost:4502/graphql/execute.json/global/article-list" | head -c 600
```

You should see `data.articleList.items` with three objects. On a real environment, publish the query and the fragments, then use the publish host.

**6. Render it.** Save this as `feed.html`:

```html
<!doctype html>
<meta charset="utf-8">
<title>Articles</title>
<ul id="feed"></ul>
<script>
const url = "http://localhost:4502/graphql/execute.json/global/article-list";
fetch(url)
  .then(r => r.json())
  .then(({ data }) => {
    const list = document.getElementById("feed");
    data.articleList.items.forEach(a => {
      const li = document.createElement("li");
      li.textContent = a.title + ": " + a.summary.plaintext;
      list.appendChild(li);
    });
  });
</script>
```

The code uses `textContent`, never `innerHTML`, so content cannot inject markup. If the browser blocks the request, that is CORS: the page origin is not allowed by AEM. For local testing, serve the file from a local web server and add its origin to AEM's CORS configuration, as covered in Adobe's headless documentation. Local author may also require authentication, which is one more reason to test against publish.

## Why this shape works

The page knows nothing about AEM internals. It knows one URL and the field names in the response. That is the headless contract: AEM owns content and the model, the front end owns presentation. If you later build an app, it calls the same URL. If marketing adds a fourth article, the page shows it without a code change, once the fragment is published and the cached response expires.

Notice also what is missing: no component, no template, no HTL. This is the opposite end of the spectrum from the page template project in lesson 15, and choosing between them is the subject of the architecture lessons in level 6.

## What done looks like

- The model is enabled and GraphiQL shows the `Article` type.
- Three fragments exist and are published on a real environment.
- `article-list` is persisted and runs with a GET.
- curl returns three items, and `feed.html` lists all three titles.

<details markdown="1">
<summary>Stretch question: what would you change before this went to production?</summary>

Publish the query and fragments, put the publish URL behind the CDN, set cache lifetimes to match how fast content must update, and handle empty or failed responses in the page. Also decide who may change the model, since the page now depends on its field names.

</details>

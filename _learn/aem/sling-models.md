---
title: "Sling Models: where component logic belongs"
description: "Learn what a Sling Model is, how annotations inject content and services, and how HTL uses one so component logic stays in testable Java."
track: aem
level: 2
order: 9
minutes: 9
outcome: "By the end you can write a small Sling Model, explain which annotation to use for each kind of data, and call it from HTL."
prereq: "Lesson 8 (HTL basics) and lesson 3 (JCR nodes and properties)."
terms:
  - { t: "Sling Model", d: "A plain Java class, annotated with `@Model`, that Sling creates by adapting a resource or request and filling its fields from the repository." }
  - { t: "Adaptable", d: "The thing a model is created from, usually a `Resource` or a `SlingHttpServletRequest`." }
  - { t: "Injection", d: "Sling filling a field or constructor value for you, for example from a property, a child resource or an OSGi service." }
  - { t: "@PostConstruct", d: "A method Sling calls once, after all injection, to compute derived values." }
  - { t: "Exporter", d: "A Sling feature that serialises a model to JSON, for example through `.model.json`." }
mistake: "Putting repository reads, service calls and sorting into the HTL file or doing heavy work in getters. The result is slow, untestable templates and the same logic repeated in every component."
try_it:
  - "Open `core` in your archetype project and find an existing model under `models`."
  - "Create `GreetingModel` with a `@ValueMapValue` field called `name` and a getter that returns a default when it is empty."
  - "Add `@Model(adaptables = Resource.class, defaultInjectionStrategy = DefaultInjectionStrategy.OPTIONAL)` and build with `mvn clean install`."
  - "Use it in a component with `data-sly-use.model=\"...GreetingModel\"` and print `${model.greeting}`."
  - "Write a unit test that constructs the class directly and asserts the default value."
quiz:
  - q: "What does `defaultInjectionStrategy = OPTIONAL` change?"
    options:
      - "A missing property leaves the field null instead of failing creation of the model"
      - "The model becomes lazily loaded and cached forever"
      - "Fields are injected from the request instead of the resource"
      - "The model is exported as JSON automatically"
    answer: 0
    why: "By default an injected field is required, and a missing value makes the whole adaptation fail. Optional lets new components work before an author fills every field."
  - q: "You need the current page and a request parameter inside the model. What should the adaptable be?"
    options:
      - "A `Resource`, because it is lighter"
      - "A `SlingHttpServletRequest`, as it carries request context"
      - "An OSGi service reference"
      - "A `ResourceResolver` only"
    answer: 1
    why: "Request-scoped information such as selectors, parameters and the current page comes from the request. A bare Resource has none of that."
  - q: "A model method sorts 500 items and is called three times from HTL. What is the best fix?"
    options:
      - "Call it only once from HTL using a variable"
      - "Move the sort into the HTL file"
      - "Store the sorted list in the repository"
      - "Compute it once in `@PostConstruct` and return the stored list"
    answer: 3
    why: "Work done once after injection is cheap to read many times. Naming a variable in HTL helps a little, but the real cost lives in the getter. Moving the sort into HTL is not even possible."
  - q: "Which is NOT a good reason to use a Sling Model?"
    options:
      - "Logic can be unit tested without starting AEM"
      - "HTL stays simple and readable"
      - "The same model can feed HTL and a JSON export"
      - "Models let HTL write directly to the repository"
    answer: 3
    why: "Models are for reading and shaping data for display. Writes belong in servlets or services with clear authorisation, never as a side effect of rendering."
go_deeper:
  - { title: "Coding AEM with AI agents: AGENTS.md, skills and MCP", url: "/blog/2026/11/coding-aem-with-ai-agents-agents-md-skills-mcp/", why: "how agents can help write and review models safely" }
  - { title: "Previous lesson: HTL basics", url: "/learn/aem/htl-basics/" }
  - { title: "Next lesson: Components and dialogs", url: "/learn/aem/components-and-dialogs/" }
---
## The problem: logic needs a home

Lesson 8 ended with a rule: HTL displays, it does not decide. But somebody has to read properties, fall back to defaults, fetch child items and format a date. If HTL cannot, where does that code go?

A **Sling Model** is the answer. It is an ordinary Java class. Sling creates it for you, fills in its fields from the repository, and hands it to HTL. Think of the model as a waiter: it fetches and arranges everything so the template, the table, only has to present it.

## A small model

```java
@Model(adaptables = SlingHttpServletRequest.class,
       defaultInjectionStrategy = DefaultInjectionStrategy.OPTIONAL)
public class GreetingModel {

    @ValueMapValue
    private String name;

    @SlingObject
    private Resource resource;

    private String greeting;

    @PostConstruct
    protected void init() {
        String who = (name == null || name.isEmpty()) ? "visitor" : name;
        greeting = "Hello, " + who;
    }

    public String getGreeting() { return greeting; }
}
```

And the HTL that uses it:

```html
<p data-sly-use.model="com.example.core.models.GreetingModel">${model.greeting}</p>
```

## Choosing the right annotation

| Annotation | Injects | Typical use |
|---|---|---|
| `@ValueMapValue` | A property of the component node | Dialog values such as `title` |
| `@ChildResource` | A child node or list of children | Multifield items |
| `@OSGiService` | A service from the container | Search, image utilities |
| `@Self` | The adaptable itself, or an adapted form of it | Delegating to another model |
| `@SlingObject` | Resource, request or resolver | Current page, parameters |

Use the narrow annotation, not a catch-all. `@ValueMapValue` says exactly where a value comes from, which makes the class easier to read and to reason about.

`@PostConstruct` runs once after injection. Do derived work there and keep getters trivial, because HTL may call a getter several times.

## Resource or request?

A `Resource` is just a node and its properties. A `SlingHttpServletRequest` also carries selectors, parameters and the current page. Choose the request when you need request context, and a resource when you do not, since a resource model can also be reused in places that have no request, such as a background job.

## Exporting to JSON

With a Jackson exporter annotation on the class, `.model.json` on the component URL returns the model as JSON. That is how the same logic can feed a single-page app. The Core Components use this heavily, and lesson 14 returns to it.

## Keeping it testable

Because the class is plain Java, you can test it with Mockito or the AEM mocks library without starting AEM. Keep services behind interfaces and keep methods small. Cloud Manager's code quality gate also measures test coverage, so tested models help your pipeline as well as your sanity.

<details markdown="1">
<summary>Stretch question: why not just use a servlet?</summary>

A servlet answers a URL and writes a whole response. A model prepares data for a template that Sling has already chosen. Using models keeps markup in HTL, caching decisions with the URL, and logic reusable between HTML and JSON output.

</details>

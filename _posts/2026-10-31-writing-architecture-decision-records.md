---
title: "Architecture decision records: the smallest useful habit"
tags: [architecture, documentation]
---
Sample post: replace or delete this file. Every Markdown file in `_posts/` named `YYYY-MM-DD-title.md` becomes a blog post.

Diagrams show what a system looks like. They rarely say *why*. An architecture decision record (ADR) is a short document that captures a single decision, so the reasoning survives after the team changes.

## A minimal template

```markdown
# ADR-007: Use an event bus for order updates

Status: Accepted
Context: Three downstream systems need order changes in near real time.
Decision: Publish order events to a managed event bus.
Consequences: Looser coupling, eventual consistency, need for replay tooling.
```

## Why it works

- It forces you to name the options you rejected.
- It is small enough that people actually write it.
- It lives in the repository, next to the code it explains.

Start with the next decision you find yourself explaining twice.

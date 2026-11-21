---
title: "Logging and debugging on Cloud Service"
description: "Which logs AEM as a Cloud Service gives you, how to download and tail them, how to set log levels, and how to debug a 404, a 500, a slow page or a stale page."
track: aem
level: 5
order: 32
minutes: 9
outcome: "By the end you can choose the right log for a symptom, fetch it from Cloud Manager or the aio CLI, and set a log level for your own package through configuration."
prereq: "Lesson 22 (Dispatcher mental model), lesson 24 (the CDN) and lesson 31 (configuration)."
terms:
  - { t: "error.log", d: "The AEM Java log on author and publish, where your logger output and stack traces appear." }
  - { t: "Request and access logs", d: "HTTP logs from AEM: request.log pairs each request with its response, access.log lists each request with its status." }
  - { t: "dispatcher.log", d: "The publish-tier log that shows Dispatcher decisions, such as a cache hit or miss, and which farm handled a request." }
  - { t: "CDN log", d: "A JSON log of requests at the CDN edge, including cache status, available through log forwarding." }
  - { t: "Log level", d: "How much detail is written, such as ERROR, WARN, INFO or DEBUG." }
mistake: "Looking only in error.log. A stale or 404 page is often decided at the CDN or Dispatcher and never reaches AEM, so AEM's logs show nothing and you conclude 'nothing happened'."
try_it:
  - "In your local SDK, open `crx-quickstart/logs` and find error.log, request.log and access.log."
  - "Add a `LOG.info(\"hello component rendered\")` to a Sling Model from lesson 9, rebuild, load the page and find the line in error.log."
  - "Write a logger config file for your own package at debug level, and decide which run mode folder it belongs in."
  - "If you have Cloud Manager access, run `aio cloudmanager:list-available-log-options` for an environment and read the list."
  - "Look at one request in your local Dispatcher logs and find the cache status."
quiz:
  - q: "A visitor sees an old version of a page that authors updated an hour ago. Which log is most likely to explain it first?"
    options:
      - "error.log on the author tier"
      - "The CDN log, or dispatcher.log"
      - "The author access.log file"
      - "The Maven build log from the pipeline"
    answer: 1
    why: "A stale page is a caching question, answered by cache status at the CDN or Dispatcher. Author logs tell you what authors did, not what visitors were served."
  - q: "A request returns HTTP 500 on publish. What is the best first step?"
    options:
      - "Clear the Dispatcher cache"
      - "Raise the root log level to DEBUG on production for a week"
      - "Find the request in request.log or access.log, then read error.log near that time for the stack trace"
      - "Restart the publish service"
    answer: 2
    why: "A 500 means code failed, and error.log holds the stack trace. A cache flush does not fix a server error, and a long DEBUG run floods logs and is advised against."
  - q: "You want debug output for com.acme.core only on dev. How should you set it up?"
    options:
      - "Change the root logger to debug on every environment"
      - "Edit the level in the Web Console on the dev instance"
      - "Ask Adobe support to change it for you"
      - "A logger factory config for that package in a dev run mode folder, deployed by a pipeline"
    answer: 3
    why: "Log levels are configuration as code, scoped by run mode. Console edits are not the supported route, and root-level DEBUG is noisy and discouraged."
  - q: "Which statement about logs on Cloud Service is NOT true?"
    options:
      - "Request and access logs miss requests served from the Dispatcher cache or CDN"
      - "You can download logs from Cloud Manager and tail them with the aio CLI"
      - "Cloud Manager keeps logs indefinitely so you can investigate old incidents"
      - "CDN logs can be forwarded to destinations such as Splunk or Datadog"
    answer: 2
    why: "Retention for downloadable logs is short, documented as seven days. If you need longer history, forward logs to a system you control."
go_deeper:
  - { title: "Dispatcher on AEM as a Cloud Service: caching and invalidation", url: "/blog/2026/11/dispatcher-on-aem-as-a-cloud-service-caching-and-invalidation/", why: "to read cache decisions in dispatcher.log" }
  - { title: "AEM Cloud Service CDN: cdn.yaml, headers, proxy and redirects", url: "/blog/2026/11/aem-cloud-service-cdn-yaml-headers-proxy-redirects/", why: "CDN rules and what shows up in CDN logs" }
  - { title: "Previous lesson: Configuration, secrets and run modes", url: "/learn/aem/config-secrets-run-modes/" }
---
## The problem: you cannot log in to the server

On a self-hosted AEM you opened a terminal and ran `tail -f error.log`. On Cloud Service there is no server to log in to. The platform gives you the same evidence, but you fetch it through Cloud Manager, the `aio` CLI or log forwarding. Knowing **which** log answers **which** question is most of the skill.

## The logs you get

| Log | Where | Tells you |
|---|---|---|
| `error.log` | Author, publish | Java logging, errors and stack traces |
| `request.log` | Author, publish | Each request paired with its response |
| `access.log` | Author, publish | Status, URL and size per request |
| `httpd_access.log`, `httpd_error.log` | Publish tier | Apache web server activity |
| `dispatcher.log` | Publish tier | Dispatcher actions, cache hit or miss, farm |
| CDN log | CDN edge | Cache status, status code, time to first byte |

A key detail: request and access logs do not include requests answered by the Dispatcher cache or the CDN, because those never reach AEM. A line in `dispatcher.log` looks like this (shortened):

```text
"GET /content/acme/en/home.html" - 475ms [publishfarm/0] [action miss]
```

`action miss` means Dispatcher had to ask AEM. A hit would be answered without it.

## Getting the logs

In Cloud Manager, open the environment's menu and choose **Download Logs**, then pick a service. With the `aio` CLI and its Cloud Manager plugin:

```bash
aio cloudmanager:list-available-log-options 1884
aio cloudmanager:download-logs --programId 5 1884 author aemerror
aio cloudmanager:tail-log --programId 5 1884 author aemerror
```

Here 5 is the program ID and 1884 the environment ID. The last two arguments are the service and the log name. Downloaded logs are kept for seven days, so forward them to a log platform if you need history. CDN logs are delivered through log forwarding, which you configure with the config pipeline from lesson 29.

## Log levels as code

Set levels with an OSGi factory config, in a run mode folder, so dev can be noisy and production quiet:

```json
{
  "org.apache.sling.commons.log.names": ["com.acme.core"],
  "org.apache.sling.commons.log.level": "debug"
}
```

Save it as `org.apache.sling.commons.log.LogManager.factory.config-acme.cfg.json` under `config.author.dev` and `config.publish.dev`. Adobe suggests DEBUG on dev, WARN on stage and ERROR on production, and says not to leave DEBUG on longer than needed. Leave the root level at its default INFO. Changing logging is a deployment, not an instant switch.

## Four common debugging paths

- **404:** Is it the right URL? Check the CDN log and `dispatcher.log`. A blocked path is often a Dispatcher filter (lesson 23). Then try the same path on publish: if it works there, Dispatcher or CDN is the cause, and if the content is missing, it was never published.
- **500:** Find the request in `request.log`, then read `error.log` around that time for the stack trace.
- **Slow page:** Compare the CDN `ttfb` with the AEM duration in `request.log`. Slow on a miss but fast on a hit means caching, not the server, is the lever. Slow everywhere often means a query or an index (lesson 26).
- **Stale page:** Read the cache status, then ask who should have invalidated it.

The Developer Console in Cloud Manager also offers debugging tools for cloud environments, including a read-only repository browser. Check Adobe's current documentation for what it offers on each environment type.

<details markdown="1">
<summary>Predict first, then reveal: error.log is silent but a page is wrong. Where do you look?</summary>

Look at the edge. If a request never reached AEM, AEM cannot log it. The CDN log and `dispatcher.log` show whether a cached copy answered, and for how long that copy has been held.

</details>

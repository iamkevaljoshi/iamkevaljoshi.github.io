---
title: "Configuration, secrets and run modes"
description: "How AEM as a Cloud Service handles OSGi configuration as code, run mode folders, environment variables and secrets, and why passwords never belong in Git."
track: aem
level: 5
order: 31
minutes: 9
outcome: "By the end you can put an OSGi configuration in the right run mode folder, reference an environment variable or secret from it, and explain why secrets stay out of Git."
prereq: "Lesson 5 (project structure, especially ui.config) and lesson 29."
terms:
  - { t: "OSGi configuration", d: "Settings for a Java service, stored on Cloud Service as a .cfg.json file in your project." }
  - { t: "Run mode", d: "A label such as author, publish, dev, stage or prod that decides which configuration folder applies to an instance." }
  - { t: "Environment variable", d: "A named value set per environment in Cloud Manager, which configuration can reference." }
  - { t: "Secret", d: "An environment variable whose value can be set but never read back, used for passwords and API keys." }
  - { t: "Placeholder", d: "The $[env:NAME] or $[secret:NAME] token in a config file that AEM replaces at runtime." }
mistake: "Putting an API key or password straight into a .cfg.json file. It then lives in Git history forever, appears in every environment, and the pipeline's own code scan may flag it."
try_it:
  - "Open your project's ui.config module and list the folders under osgiconfig. Note which are named config.author, config.publish and so on."
  - "Write a config for a made-up service that has a different `endpoint` on author and publish."
  - "Change one value to use `$[env:ENDPOINT_URL;default=https://example.com]` and explain what happens if the variable is unset."
  - "Using the aio CLI or Cloud Manager, find where environment variables are set for an environment (or read the documentation for it if you have no access)."
quiz:
  - q: "Where does OSGi configuration live in an AEM Cloud Service project?"
    options:
      - "In .cfg.json files in the project, in run mode folders"
      - "In the Web Console, edited on the running instance"
      - "In the author's page properties"
      - "In the Dispatcher configuration only"
    answer: 0
    why: "Configuration is code on Cloud Service: stored in Git and deployed through Cloud Manager. Changes made on a running instance are not the supported route."
  - q: "A config has an API key that must differ between stage and production. What is the right design?"
    options:
      - "Two config folders, each containing its own plain-text key"
      - "One config using a $[secret:API_KEY] placeholder, with the value set per environment"
      - "A key hard-coded in a Java constant, with a comment"
      - "One shared key in Git, because stage and production should match"
    answer: 1
    why: "A secret placeholder keeps the value out of Git and lets each environment have its own. Plain text in any folder is still committed, and a Java constant is just a hidden version of the same mistake."
  - q: "Two folders, config.publish and config.publish.prod, both define the same PID. On production publish, which applies?"
    options:
      - "config.publish, because it was created first"
      - "A merge of both, property by property"
      - "config.publish.prod, because it matches more run modes"
      - "Neither: AEM reports a conflict and stops"
    answer: 2
    why: "The folder with the most matching run modes wins, and it replaces the whole PID rather than merging properties. Assuming a merge is a common source of missing settings."
  - q: "Which statement is NOT true?"
    options:
      - "Secret values can be updated but not viewed again after saving"
      - "Placeholders let one config file behave differently per environment"
      - "You can invent any run mode name, such as config.publish.qa"
      - "Preview has no config folder of its own and inherits from publish"
    answer: 2
    why: "Cloud Service supports a fixed set of run modes: author or publish, with dev, stage or prod. Custom run modes are not supported, so a qa folder would never apply."
go_deeper:
  - { title: "Running AEM Cloud Manager pipelines well: quality gates, RDEs and the config pipeline", url: "/blog/2026/11/aem-cloud-manager-pipelines-quality-gates-rde-config-pipeline/", why: "the variables and secrets section, plus config pipeline YAML" }
  - { title: "AEM Cloud Service CDN: cdn.yaml, headers, proxy and redirects", url: "/blog/2026/11/aem-cloud-service-cdn-yaml-headers-proxy-redirects/", why: "configuration that is not OSGi but follows the same as-code idea" }
  - { title: "Previous lesson: Environments and the deployment flow", url: "/learn/aem/environments-and-deployment-flow/" }
---
## The problem: one codebase, many environments

Your code is the same everywhere, but some settings must not be. Dev talks to a test payment API, production to the real one. Author and publish may need different timeouts. Passwords differ by environment.

If you copy code per environment, the environments drift and nobody trusts stage any more. The answer is **one build, different configuration**.

## OSGi configuration as code

On AEM as a Cloud Service, settings for a Java service are stored as `.cfg.json` files in your `ui.config` module. The file name is the service's PID (usually its class name):

```text
ui.config/src/main/content/jcr_root/apps/acme/osgiconfig/
  config/                      applies everywhere
  config.author/               author only
  config.publish/              publish only
  config.publish.dev/          publish on dev
  config.publish.prod/         publish on production
```

A folder applies when **all** of its run modes match the instance. If several folders define the same PID, the one with the most matching run modes wins, and it replaces the whole configuration for that PID, not individual properties. Cloud Service supports author or publish plus dev, stage or prod. Custom run modes are not supported, and preview inherits from publish.

A small example, `com.acme.core.services.impl.WeatherClientImpl.cfg.json`:

```json
{
  "endpoint": "$[env:WEATHER_URL;default=https://test.example.com]",
  "apiKey": "$[secret:WEATHER_API_KEY]",
  "timeoutMs": 3000
}
```

## Variables and secrets

`$[env:NAME]` is replaced by an environment variable. `;default=...` gives a fallback when none is set. `$[secret:NAME]` is replaced by a secret, which has the same shape but cannot be read after it is saved. You set both per environment in Cloud Manager (or with its API or the `aio` CLI), and can target author or publish separately.

Documented rules worth remembering: names use letters, digits and underscores, and prefixes such as `ADOBE_`, `INTERNAL_` and `CONST_` are reserved. Placeholders do not work in repoinit statements, and are meant for your own configuration rather than overriding Adobe's. Secrets should be used on every environment, including stage and production. Adobe advises using environment-specific values sparingly for stage and production, because configuration that differs there weakens stage as a rehearsal.

Setting a variable does not run a pipeline or its quality gates, but the services need a few minutes to pick it up. Values are not versioned, so when you change meaning, add a new variable name rather than editing an old one that a previous release still reads.

## Why never commit a secret

Git remembers everything. A password committed once survives in history even after you delete it, is visible to everyone with repository access, and is baked into every environment. Cloud Manager's code scan also reports hard-coded credentials. A secret placeholder keeps the real value only in Cloud Manager, where you can replace it without a code change.

## What not to do on Cloud Service

The local SDK has a Web Console at `/system/console`, handy for exploring settings. On cloud environments, treat it as unavailable: running instances are not changed by hand. If you copy settings from the local console, check them into the project and deploy them. The Developer Console can show you the configuration a cloud environment is using.

<details markdown="1">
<summary>Why does this work? Where does the replacement happen?</summary>

AEM reads the `.cfg.json` file with placeholders and swaps in the values from the environment as the service starts. The Git file never holds the real value, so one build artefact can move from dev to stage to production and pick up different values in each.

</details>

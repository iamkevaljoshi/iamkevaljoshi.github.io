---
title: "Local setup: the SDK, Maven and your first run"
description: "Install the AEM as a Cloud Service SDK and Maven, start a local author on port 4502, generate a project from the archetype and deploy it."
track: aem
level: 1
order: 6
minutes: 10
outcome: "By the end you can start a local AEM author, log in, generate a project from the archetype and deploy it with Maven."
prereq: "Lesson 5, Project structure."
terms:
  - { t: "AEM as a Cloud Service SDK", d: "Adobe's download for local development: a quickstart jar that runs author or publish, plus the Dispatcher tools and the AEM APIs." }
  - { t: "Quickstart jar", d: "A single runnable jar that unpacks and starts a local AEM instance." }
  - { t: "Maven", d: "The build tool that compiles your project, builds its content packages and can install them on a running instance." }
  - { t: "Maven profile", d: "A named switch for a build, passed with -P, that turns on extra steps such as installing a package." }
  - { t: "Dispatcher tools", d: "Part of the SDK that lets you run and validate the Dispatcher configuration locally, using Docker." }
mistake: "Using the wrong Java version, or building on a machine whose Java differs from the one AEM needs. The quickstart refuses to start or the build fails with confusing errors. Check the Java version before anything else."
try_it:
  - "Check what you have installed: run java -version, mvn -v and git --version."
  - "Download the AEM as a Cloud Service SDK from the Software Distribution portal, which needs an Adobe ID with access."
  - "Unzip it into a folder, and put the quickstart jar in an empty folder of its own."
  - "Start it with java -jar and wait until the browser opens on the sign-in page."
  - "Sign in, open the Sites console, and note the port in the address bar."
quiz:
  - q: "You rename the quickstart jar to aem-publish-p4503.jar and start it. What do you get?"
    options:
      - "An author instance that listens on port 4503"
      - "A publish instance that listens on port 4503"
      - "A Dispatcher cache in front of port 4503"
      - "An author and a publish pair sharing one repository"
    answer: 1
    why: "The quickstart reads its role and port from its filename, so this starts a publish on 4503. It does not run Dispatcher, and one jar starts one instance with its own repository."
  - q: "Your build fails immediately with a Java-related error, though your code is fine. What is the best first step?"
    options:
      - "Delete the whole local Maven repository and retry"
      - "Reinstall AEM on a different port number"
      - "Rewrite the pom.xml from scratch and retry"
      - "Check java -version and mvn -v against the requirements"
    answer: 3
    why: "Mismatched Java versions cause many first-run failures, so check them before changing anything else. Deleting the repository, moving the port or rewriting the pom does not address the likely cause."
  - q: "You run a normal Maven build from the project root, and the build succeeds, but nothing changes in your local AEM. Why?"
    options:
      - "Maven only builds unless you switch on an install profile"
      - "AEM ignores packages built on the same computer as it"
      - "Local author needs a full restart after every single build"
      - "Maven installs only into publish and never into author"
    answer: 0
    why: "A plain build produces packages. Installing them into a running instance is a separate step that a profile switches on. The other options are not how it works."
  - q: "Which is NOT true about the local SDK?"
    options:
      - "It contains the quickstart jar for author and publish"
      - "It includes Dispatcher tools for local testing"
      - "It lets you try your code before a pipeline"
      - "It is a copy of your production content and users"
    answer: 3
    why: "The SDK is an empty local instance for development. It does not contain your production data, which is why you build content or import samples to test with."
go_deeper:
  - { title: "Cloud Manager pipelines and quality gates", url: "/blog/2026/11/aem-cloud-manager-pipelines-quality-gates-rde-config-pipeline/", why: "what happens after your local build works" }
  - { title: "Dispatcher on AEM as a Cloud Service", url: "/blog/2026/11/dispatcher-on-aem-as-a-cloud-service-caching-and-invalidation/", why: "what the Dispatcher tools simulate" }
  - { title: "Next lesson: the hello-world project", url: "/learn/aem/project-hello-component/" }
---
## The goal: a safe place to break things

Before you touch a shared environment, you want a copy of AEM on your own machine, where mistakes cost nothing. That is what the **AEM as a Cloud Service SDK** gives you: the same product code as the cloud, running locally.

## What you need

| Tool | Why |
|---|---|
| **Java** | AEM and Maven both run on it. The version matters. |
| **Maven** | Builds and deploys your project. |
| **Git** | Most projects live in a repository. |
| **Docker** (optional now) | Needed later for the Dispatcher tools. |
| **Node.js** (optional now) | Only for the `ui.frontend` build. |

For Java, do not guess. The supported version has changed between SDK releases. Recent SDK releases need a recent long-term-support Java for the quickstart, and Cloud Manager builds with a Java 11, 17 or 21 JDK. Check the notes that come with your SDK download and the current Adobe documentation, then confirm with `java -version`.

The SDK is downloaded from Adobe's Software Distribution portal. You need an Adobe ID that has access through your organisation.

## Starting author

Put the quickstart jar in an empty folder and name it so that it declares its role and port. This is the usual convention:

```bash
mkdir -p ~/aem/author
cp aem-sdk-quickstart-*.jar ~/aem/author/aem-author-p4502.jar
cd ~/aem/author
java -jar aem-author-p4502.jar
```

The first start unpacks the jar into a `crx-quickstart` folder and takes several minutes. Later starts are faster. When it is ready, a browser window typically opens on `http://localhost:4502`.

On a local SDK the starting credentials are `admin` / `admin`. That is fine on your laptop and nowhere else. Never reuse that password on a shared instance. Real environments use identity management, which a later lesson covers.

To stop it, press Ctrl+C in the terminal. Keep the `crx-quickstart` folder if you want your content to persist.

## Building and deploying a project

Generate a project from the archetype. Later you will do this for real in lesson 7. The deploy step is the one to remember:

Run this from the project root. It builds everything and installs the `all` package on local author:

```bash
mvn clean install -PautoInstallSinglePackage
```

The archetype defines this profile for author on port 4502. A sibling profile, `autoInstallSinglePackagePublish`, targets publish on 4503. Without a profile, Maven only builds packages. It does not install them.

## Common first-run problems

- **The quickstart will not start.** Check Java first. Then check you are in an empty folder with only the jar.
- **Port already in use.** Another instance or process holds 4502. Stop it or use a different port in the jar name.
- **Maven cannot download dependencies.** Check your network and any proxy or repository settings in `~/.m2/settings.xml`.
- **The build passes, nothing changes.** You forgot the install profile, or you are deploying to the wrong port.
- **It is slow on first start.** That is normal. Wait for the log to settle, and do not kill it halfway, because a half-started instance can be corrupted.

<details markdown="1">
<summary>Why does naming the jar matter?</summary>

The quickstart reads its role and port from its own filename. `aem-author-p4502.jar` starts an author on 4502, and `aem-publish-p4503.jar` starts a publish on 4503. It saves you passing options each time, and it is why people keep one folder per instance.

</details>

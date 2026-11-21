---
title: "Project: ship a change through a pipeline"
description: "Make a small change to your AEM project, push it, run it through Cloud Manager's quality gates to stage, and verify it, or rehearse the same steps locally."
track: aem
level: 5
order: 34
minutes: 20
kind: project
outcome: "By the end you can take a code change from your laptop through build, quality checks, stage deployment and verification, and say exactly what 'done' means."
prereq: "Lessons 29 to 33, and the project code from the Level 1 and Level 2 projects (the hello component and the page template)."
terms:
  - { t: "Cloud Manager Git repository", d: "The repository your pipelines build from, hosted by Adobe or connected from your own Git provider." }
  - { t: "Quality gate result", d: "The pass, pause or fail outcome of a pipeline's code quality, functional and audit steps." }
  - { t: "Stage verification", d: "Checking the deployed change on stage, through the real CDN and Dispatcher path, before approving production." }
  - { t: "Definition of done", d: "A written list of evidence that proves a change is finished, not just merged." }
mistake: "Calling a change done when the pipeline turns green. Green means the checks you have passed; you still have to look at the result on stage, with the Dispatcher and CDN in front of it."
try_it:
  - "Choose a small, visible change in your Level 1 or 2 code, such as new default text in the hello component's HTL. Create a branch and make it."
  - "Run `mvn clean install` at the project root and fix anything that fails. Then validate the Dispatcher configuration locally with the SDK's `validate.sh` script (see below)."
  - "Commit and push the branch to the Cloud Manager repository, or to your connected Git repository. Open the pipeline's page in Cloud Manager, or note your local run if you have no program."
  - "Run the non-production pipeline, watch each step, and read the code quality result. Write down every issue by tier: critical, important or info."
  - "If the pipeline pauses, decide: fix and re-run, or override with a written reason. Never override just to go faster."
  - "Run or approve the production pipeline up to stage, and open the page on stage. Compare it with your local result."
  - "Fill in the 'done' checklist below, and write one sentence on how you would undo the change if it were wrong."
quiz:
  - q: "Why run `mvn clean install` and the Dispatcher validator before you push?"
    options:
      - "Cloud Manager requires a local build before it accepts a push"
      - "They replace the pipeline's quality gates completely"
      - "They catch simple failures in seconds that would otherwise cost a full pipeline run"
      - "They deploy the change to stage for you"
    answer: 2
    why: "Local checks are a cheap early filter. They do not replace the gates, and Cloud Manager does not require them."
  - q: "The pipeline pauses on an important code quality issue. What is the right behaviour?"
    options:
      - "Override at once, since a pause means a false alarm"
      - "Delete the failing run and push again without reading it"
      - "Disable the check in the POM"
      - "Read the issue, fix it if real, and override only with a recorded reason"
    answer: 3
    why: "An important issue needs a human judgement. Reflex overrides turn the gate into theatre, and you cannot disable Cloud Manager's checks from your POM."
  - q: "The pipeline is green and the change is on stage. Which is the best next step?"
    options:
      - "Approve production immediately, since the gates passed"
      - "Open the change on stage, check it through its real URL and check logs for errors"
      - "Wait a week and then approve"
      - "Copy the stage content to dev"
    answer: 1
    why: "Gates cannot know whether the change looks and behaves as intended. Stage is where you confirm that, via the same CDN and Dispatcher path visitors use."
  - q: "Which statement about this project is NOT true?"
    options:
      - "You can follow the steps locally if you have no Cloud Manager program"
      - "The change goes to production only after the stage phase of the production pipeline"
      - "A green pipeline proves the change meets the business need"
      - "If something is wrong you normally fix forward with a new commit"
    answer: 2
    why: "Gates test code quality and basic behaviour, not whether the business wanted this. Rolling back is not a button, so the usual fix is a corrected commit."
go_deeper:
  - { title: "Running AEM Cloud Manager pipelines well: quality gates, RDEs and the config pipeline", url: "/blog/2026/11/aem-cloud-manager-pipelines-quality-gates-rde-config-pipeline/", why: "the reference for every gate and pipeline setting used here" }
  - { title: "AEM go-live checklist", url: "/blog/2026/11/aem-go-live-checklist/", why: "the bigger version of this lesson's done checklist" }
  - { title: "Dispatcher filter tester", url: "/tools/aem-dispatcher-filter-tester/", why: "a quick check before you push Dispatcher changes" }
  - { title: "Next lesson: Choosing an architecture", url: "/learn/aem/choosing-an-architecture/" }
---
## What you are building, and an honest prerequisite

You will ship a small change the way a real team does: branch, build, push, pipeline, stage, verify. The change is tiny on purpose. The skill is the path, not the edit.

**Be honest about access.** The full run needs a Cloud Manager program: a Git repository, a pipeline, a dev environment and (for the production pipeline) stage. Many learners do not have one, because it comes with an AEM as a Cloud Service licence, or a sandbox or training program from your employer or from Adobe. If that is you, do the **local simulation** in the box below. It rehearses the same steps, minus the cloud.

## The local simulation

You can reproduce most of what a pipeline does on your laptop:

```bash
mvn clean install                                   # the build and unit tests, as in the pipeline
./bin/validate.sh <path-to-your-dispatcher-src>     # Dispatcher validation from the Dispatcher SDK
mvn clean install -PautoInstallSinglePackage        # deploy to your local author instance
```

The first command is nearly what Cloud Manager's build and code quality steps start from. The second mirrors the Dispatcher check. The third plays the role of deployment. You will not get Cloud Manager's own quality gate report or stage, so say so in your notes: a local run proves the build and config are sound, not that the cloud pipeline will agree.

## The path, step by step

**1. Make a small change.** Edit the text in your hello component's HTL or an author-visible default. Keep it to one clear difference you can recognise by eye. Work on a branch.

**2. Check locally.** Build, run the Dispatcher validator, load the page on your local publish. Fix failures now, where they cost seconds.

**3. Push.** On Cloud Manager, push to the program's Git repository (Cloud Manager shows the repository URL and credentials in its Git repositories view). If your team connects GitHub or another provider, push there and let the connection do the rest.

**4. Run the pipeline.** Start the non-production pipeline, or let a push trigger it. Watch each step: build, code quality, deploy. Open the code quality report and sort what you find into critical, important and info (lesson 29).

**5. Handle a pause.** A pause is a question. If the coverage fell because your change has no test, add a test. Override only with a written reason.

**6. Stage and verify.** In the production pipeline, deploy to stage and let the functional tests and experience audit run. Open the change on stage using its real URL and check the response and the logs (lesson 32).

**7. Approve, or stop.** If stage is right, approve production. If it is wrong, push a fixing commit. Remember that there is no rollback button.

## What "done" looks like

Tick every line before you call it finished:

- The change is merged to the branch the pipeline tracks.
- The build and unit tests pass, and the code quality result has no unexplained critical or important issues.
- Dispatcher configuration passes validation (if you touched it).
- The change is visible on stage at its real URL, and the logs show no new errors for that path.
- Any override has a written reason.
- You can say in one sentence how you would fix it forward if it were wrong.

<details markdown="1">
<summary>Stretch question: which pipeline would you use if the change was only a CDN redirect?</summary>

The config pipeline. It deploys YAML in minutes and needs no Java build, so it does not queue behind code. Using the right pipeline for the payload is the skill this level has been building.

</details>

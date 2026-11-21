---
title: "The Assets APIs"
description: "Which API to use for AEM Assets as a Cloud Service: the Assets HTTP API, the OpenAPI Assets Author API and direct binary upload, with authentication in plain words."
track: assets
level: 6
order: 32
minutes: 10
outcome: "By the end you can choose the right Assets API for a task, explain why uploads use a separate mechanism, and make a first authenticated call."
prereq: "Uploading and ingestion (lesson 4) and metadata schemas (lesson 7)."
terms:
  - { t: "Assets HTTP API", d: "The older REST API under `/api/assets` for folders, asset metadata, renditions and comments. Parts of it are marked deprecated on Cloud Service." }
  - { t: "Assets Author API", d: "The newer OpenAPI-described API for managing assets on the author tier, called through Adobe Developer Console credentials." }
  - { t: "Direct binary upload", d: "A multi-step upload where the client sends the file straight to cloud storage, then tells AEM it has finished." }
  - { t: "aem-upload", d: "Adobe's open-source Node.js library and command line tool that performs direct binary upload for you." }
  - { t: "IMS access token", d: "A short-lived bearer token issued by Adobe Identity Management (IMS) that proves who or what is calling." }
mistake: "Posting a file to an asset URL with plain HTTP and expecting it to work. On Cloud Service the binary must go through direct binary upload, so hand-rolled uploads fail or bypass the supported path."
try_it:
  - "List the systems in your estate that read or write assets, such as a PIM, a CMS, an agency portal and a script. Write down which direction each one works in."
  - "For each, pick from the decision table in this lesson: HTTP API, Author API, aem-upload or none of them."
  - "Open the Assets Author API reference on developer.adobe.com and find the metadata endpoint for one asset."
  - "If you have a Cloud Service environment, create an Adobe Developer Console project, add the Assets Author API and note which credential type it offers."
  - "Call the metadata endpoint with `curl` using a token and read the response. Change one metadata field and read it back."
quiz:
  - q: "Why does AEM Assets as a Cloud Service use direct binary upload instead of a single POST of the file?"
    options:
      - "Binaries go straight to cloud storage, so large files do not pass through the AEM servers"
      - "A single POST cannot carry a file with embedded metadata"
      - "Direct upload skips processing, so assets appear in the DAM faster"
      - "Direct upload is the only way to authenticate with an IMS token"
    answer: 0
    why: "The client sends the bytes straight to storage and AEM only receives a completion call, which keeps large files off the author servers. Processing still runs afterwards, and authentication is a separate matter."
  - q: "A PIM must update the `Product SKU` metadata on 40,000 assets each night, and nobody opens AEM to do it. Which approach fits best?"
    options:
      - "Ask authors to edit the properties in the Assets UI"
      - "A server-to-server integration calling an Assets API with Developer Console credentials"
      - "Upload every file again with the new SKU in its filename"
      - "Write a script that logs in with a named user's password"
    answer: 1
    why: "Unattended jobs should use technical (server-to-server) credentials, not a person's login. Re-uploading creates duplicates and versions, and a personal password breaks when the person leaves."
  - q: "An agency script uses `/api/assets` to create an asset and push its binary. After a platform change it starts failing. What is the most likely reason?"
    options:
      - "The script's token expired, and nothing else changed"
      - "Cloud Service blocks any traffic from agency networks"
      - "Binary upload through that API is unsupported on Cloud Service, so it must move to direct upload"
      - "The `/api/assets` endpoint was renamed but behaves the same"
    answer: 2
    why: "Adobe's documentation says the HTTP API does not create assets or update binaries, and binary operations are marked deprecated on Cloud Service. An expired token would give a clear authentication error, not a feature failure."
  - q: "Which statement about choosing between the HTTP API and the Assets Author API is NOT sound?"
    options:
      - "New integrations should check the OpenAPI-based Author API first"
      - "Check the deprecation notes before building on the older HTTP API"
      - "Both APIs are interchangeable, so the choice never matters"
      - "Uploads still need direct binary upload with either API"
    answer: 2
    why: "They differ in status, endpoints, authentication and coverage, so the choice matters. Treating them as identical is how teams end up building on a deprecated surface."
go_deeper:
  - { title: "AI-assisted AEM Cloud Service migration", url: "/blog/2026/11/ai-assisted-aem-cloud-service-migration/", why: "how the AEM MCP server and AI skills use these APIs" }
  - { title: "Agent-ready AEM site", url: "/blog/2026/11/agent-ready-aem-site-structured-content-nlweb-webmcp/", why: "exposing content to machines" }
  - { title: "Next lesson: Creative Cloud and Connected Assets", url: "/learn/assets/creative-cloud-and-connected-assets/" }
---
## The problem: five systems want the same files

A retailer has a PIM that knows which product a photo belongs to, an agency that delivers new shoots, a CMS that shows images and a script that cleans metadata. People can click through the Assets UI, but machines cannot. They need an API, and in AEM Assets there is more than one, with different status and different jobs. Picking the wrong one is the usual source of rework.

## Three mechanisms, three jobs

| Task | Use | Notes |
|---|---|---|
| Upload or replace a file | Direct binary upload, usually through **aem-upload** | The only supported route for binaries on Cloud Service |
| Read or change metadata, folders, comments | **Assets Author API** (OpenAPI) for new work | Check the current reference on developer.adobe.com |
| Existing integrations on `/api/assets` | **Assets HTTP API** | Some operations are marked deprecated on Cloud Service, so check before extending |
| Deliver to the public | Neither | Use delivery (lessons 19 to 24), not author APIs |

Treat the table as a starting point. Adobe's naming and API versions in this area move, so confirm on Experience League and developer.adobe.com before committing a design.

## The HTTP API, and why it is a legacy surface

The Assets HTTP API is REST. You request something like `/api/assets/my-brand.json` and get a folder listing in a JSON format called Siren. It can list and create folders, update metadata, work with comments, and copy, move and delete. Adobe's documentation says it does **not** create assets or update binaries, and it marks binary and rendition uploads as deprecated for Cloud Service. It also carries Content Fragment operations, where Adobe recommends migrating to the OpenAPI-based Content Fragment Management API.

## The Author API and authentication

The Assets Author API is described with OpenAPI, so you get a contract, generated clients and an API playground. Calls look like `GET https://{bucket}.adobeaemcloud.com/adobe/assets/{assetId}/metadata`, where the bucket is your author hostname without the Adobe domain.

Access follows Adobe's pattern for OpenAPI-based AEM APIs:

1. Create a project in **Adobe Developer Console** and add the API.
2. Choose a credential. For unattended systems this is typically OAuth server-to-server.
3. Register the project's client ID with your AEM environment, and enable API access in the Admin Console steps Adobe documents.
4. Exchange the credential for a short-lived **IMS access token**, then send `Authorization: Bearer <token>` and an `x-api-key` header carrying the client ID.

```bash
curl -s "https://author-p12345-e67890.adobeaemcloud.com/adobe/assets/${ASSET_ID}/metadata" \
  -H "Authorization: Bearer ${IMS_TOKEN}" \
  -H "x-api-key: ${CLIENT_ID}"
```

Replace the hostname and IDs with your own. Never put the token or client secret in a repository.

## Uploading properly

Direct binary upload has three steps: ask AEM to start an upload and receive signed storage URLs, send the file parts to storage, then call AEM to complete. The library hides this:

```js
const DirectBinary = require("@adobe/aem-upload");

const options = new DirectBinary.DirectBinaryUploadOptions()
  .withUrl("https://author-p12345-e67890.adobeaemcloud.com/content/dam/my-brand")
  .withUploadFiles([{ fileName: "hero.jpg", fileSize: 204800, filePath: "./hero.jpg" }]);

new DirectBinary.DirectBinaryUpload().uploadFiles(options)
  .then((result) => console.log(result.errors));
```

The library also needs an authorisation header with a token, which you add through its HTTP options. Once the upload completes, the asset enters processing exactly as in lesson 4.

<details markdown="1">
<summary>Stretch question: why not let the integration use a service user's password?</summary>

A password is tied to a person and is hard to rotate, scope and audit. Developer Console credentials are issued to a project, can be revoked on their own and produce tokens that expire quickly. On Cloud Service, sign-in is through Adobe IMS anyway, so a technical credential is the supported way for machines.

</details>

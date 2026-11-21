---
title: "Security and permissions"
description: "How AEM as a Cloud Service decides who can do what: users, groups, JCR ACLs, service users, Adobe IMS sign-in, and why Dispatcher and the CDN are the front line."
track: aem
level: 5
order: 33
minutes: 9
outcome: "By the end you can explain how an ACL decides access, why code should use a service user rather than an admin session, and where IMS, Dispatcher and the CDN fit in."
prereq: "Lesson 3 (the JCR), lesson 22 (Dispatcher) and lesson 31 (configuration)."
terms:
  - { t: "ACL (access control list)", d: "A list of allow and deny entries on a JCR node that says which principals may do which privileges there." }
  - { t: "Principal", d: "A user or a group that an ACL entry applies to." }
  - { t: "Service user", d: "A system user with no password, created for one job in code, with only the access that job needs." }
  - { t: "Adobe IMS", d: "Adobe's identity service. On Cloud Service it signs in author users, managed through the Admin Console." }
  - { t: "Least privilege", d: "Giving a person or a piece of code only the access it needs, and nothing more." }
mistake: "Using an admin session in code because 'it just works'. A bug or an injection then runs with full rights over the repository, and the approach is no longer supported for new code."
try_it:
  - "In your local SDK, open the Users and Groups console as admin and create a test user in a new group."
  - "Using the permissions view for /content/acme, give that group read access only, then sign in as the test user and try to edit a page."
  - "Read a repoinit script in your project (or write one) that creates a service user and allows `jcr:read` on one path."
  - "Write down three things a visitor should never be able to reach through publish, and which layer (CDN, Dispatcher, ACL) blocks each."
quiz:
  - q: "What does a service user give your Java code that an admin session does not?"
    options:
      - "Faster access to the repository"
      - "Only the access its job needs, limiting the damage"
      - "A password that authors can reset"
      - "Permission to bypass the Dispatcher"
    answer: 1
    why: "A service user is about least privilege. It is not faster and has no password, and it has nothing to do with Dispatcher."
  - q: "An ACL denies a group on /content/acme/private and allows it on /content/acme. A user in the group opens /content/acme/private/offer. What happens?"
    options:
      - "Allowed, because the parent allows it"
      - "Allowed, because allow always beats deny"
      - "It depends on the order of the logins"
      - "Denied, as the nearer entry on private is inherited downwards"
    answer: 3
    why: "ACLs inherit down the tree and the entry nearest the node decides. Assuming 'allow wins' or that the parent wins leaks content."
  - q: "A team puts an admin password in config 'only for publish', since the CDN blocks admin paths. What is the main flaw?"
    options:
      - "One layer is fragile and the secret sits in Git; use a service user"
      - "Publish can never accept passwords, whatever the config says"
      - "CDNs cannot block paths, so the premise is simply false"
      - "Nothing is wrong, because the CDN protects everything behind it"
    answer: 0
    why: "Security works in layers: CDN, Dispatcher filters, then ACLs and service users. Relying on one layer, and committing a credential, removes your safety net."
  - q: "Which statement is NOT true on AEM as a Cloud Service?"
    options:
      - "Author users typically sign in through Adobe IMS"
      - "Authorisation, meaning what a user may do, is still decided by AEM groups and ACLs"
      - "Adobe IMS manages external website visitors by default"
      - "Product profiles in the Admin Console control who can reach an author instance"
    answer: 2
    why: "IMS covers author, admin and developer users. Visitors to your public site are not IMS users, and any visitor login would be a project-specific design."
go_deeper:
  - { title: "Dispatcher on AEM as a Cloud Service: caching and invalidation", url: "/blog/2026/11/dispatcher-on-aem-as-a-cloud-service-caching-and-invalidation/", why: "the Dispatcher layer in front of AEM" }
  - { title: "AEM Cloud Service CDN: cdn.yaml, headers, proxy and redirects", url: "/blog/2026/11/aem-cloud-service-cdn-yaml-headers-proxy-redirects/", why: "traffic filters and CDN rules as the outermost layer" }
  - { title: "Dispatcher filter tester", url: "/tools/aem-dispatcher-filter-tester/", why: "check that private paths are blocked" }
  - { title: "Previous lesson: Logging and debugging", url: "/learn/aem/logging-and-debugging/" }
---
## The problem: who is allowed to do what?

AEM holds draft pages, internal assets and the tools that publish to the world. You need real people to edit freely, visitors to read only what is public, and your own code to do its work without becoming a way in. Security here is **layers**, not one lock.

Think of a building. The CDN and Dispatcher are the front door and reception. ACLs are the locks on each office. Service users are the contractors with a key to exactly one room.

## Layer 1: the front line is the CDN and Dispatcher

Visitors never talk to publish directly. They reach the CDN, then Dispatcher. Both can block paths, restrict methods, rate-limit and filter (lessons 23 and 24). Dispatcher uses an allow-list approach: deny everything, then allow only what the site needs. That is why `/crx/de`, `/system/console` and unpublished paths are not reachable from the internet. If Dispatcher is wrong, everything behind it is exposed, so test it.

## Layer 2: users, groups and ACLs

Inside AEM, access is stored in the JCR itself. An **ACL** on a node holds ordered entries, each one an **allow** or **deny** of privileges, such as `jcr:read` or `jcr:write`, for a user or group.

```text
/content/acme                     allow  acme-authors   jcr:read, jcr:write
/content/acme/legal               deny   acme-authors   jcr:write
```

Rules to remember:

- Permissions **inherit** down the tree. A child node uses its own ACL first, then its parent's.
- The entry nearest the node decides, so a deny on `legal` overrides the allow above it.
- Give access to **groups**, not individuals. Staff change, groups last.
- Start from nothing and add. That is least privilege.

## Layer 3: your code uses service users

When your Sling Model or servlet must read something that the current user cannot, do not open an admin session. Create a **service user** that can do one thing, and map your bundle to it. On Cloud Service, a repoinit script creates the user and its ACL as code:

```text
create service user acme-content-reader
set ACL for acme-content-reader
  allow jcr:read on /content/acme
end
```

An OSGi service-user-mapping configuration then ties your bundle's sub-service name to that user, and your code asks Sling for a service resource resolver. If the code is attacked or buggy, the damage is limited to reading `/content/acme`. Remember the deployment rule from lesson 30: spread ACL and service-user changes over two releases so old and new code both keep working.

## Sign-in on Cloud Service

Author users usually sign in through **Adobe IMS**. In the Admin Console, product profiles decide who can reach an author instance, and an administrator profile grants admin rights. IMS handles who you are. What you may do is still decided inside AEM by groups and ACLs. IMS does not manage your website's public visitors.

## CSRF and CORS in one minute

**CSRF** is when another site tricks a logged-in browser into sending a request. AEM protects write requests with tokens, and your own POST code should respect that. **CORS** controls which other origins may call your content from a browser. Allow specific origins you trust, never everything, and configure it as code like any other setting.

<details markdown="1">
<summary>Stretch question: Dispatcher blocks /system/console. Do you still need ACLs on publish?</summary>

Yes. Layers exist because each one can fail: a filter can be mis-edited, a new path can be forgotten. ACLs and service users keep the damage small when an outer layer lets something through.

</details>

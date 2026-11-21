---
title: "Metadata schemas"
description: "How AEM Assets metadata schemas turn the Properties page into a controlled form: tabs, field types, mapped properties, required fields and folder inheritance."
track: assets
level: 2
order: 7
minutes: 9
outcome: "By the end you can explain what a metadata schema controls, read a field's 'mapped to property' setting, and decide which schema a folder of assets should use."
prereq: "Lesson 3, Folder structure and naming conventions, and a basic idea of what metadata is."
terms:
  - { t: "Metadata schema", d: "A form definition that says which metadata fields appear on an asset's Properties page, how they look and where their values are stored." }
  - { t: "Mapped to property", d: "The repository property a field reads and writes, written as a relative path such as `./jcr:content/metadata/dc:title`." }
  - { t: "Default schema", d: "The base form every asset type starts from; changing it changes the Properties page for all assets." }
  - { t: "Apply to folders", d: "The action that assigns a schema variant to a folder, so assets uploaded there use that form." }
  - { t: "Required field", d: "A field marked mandatory, so assets missing a value can be spotted and fixed." }
mistake: "Adding a field for every request. The Properties page grows to forty boxes, nobody fills them in, and search and reporting end up built on empty or inconsistent values."
try_it:
  - "In an AEM Assets author environment, open Tools, Assets, Metadata Schemas and look at the forms for `default`, `image` and `video`."
  - "Open the `default` form, select the Title field and find its Map to Property setting. Write down the path."
  - "List the five questions your team asks about an asset when they pick one, such as 'which brand?' or 'can I use it in Germany?'. Each answer is a candidate field."
  - "Mark which of those five need a controlled value (a dropdown or a tag) and which can be free text."
  - "Decide which folder would get a custom variant and which would stay on the default."
quiz:
  - q: "What does a metadata schema in AEM Assets define?"
    options:
      - "Which renditions are generated for each uploaded file"
      - "Which fields appear on the Properties page and where their values are stored"
      - "Which users can see which folders in the library"
      - "How assets are named when they are uploaded"
    answer: 1
    why: "A schema is a form definition: fields, tabs, layout and the property each field maps to. Renditions come from processing profiles, and access comes from permissions."
  - q: "A brand team wants a 'Campaign' field only for assets in /content/dam/campaigns. What is the cleanest approach?"
    options:
      - "Add the field to the default schema so every asset gets it"
      - "Ask authors to type the campaign into the Description field"
      - "Copy a form, add the field, and apply that variant to the campaigns folder"
      - "Create a separate AEM environment for campaign assets"
    answer: 2
    why: "Apply to Folders lets one folder tree use its own form, and subfolders inherit it. Editing the default schema would add the field for every asset type, and overloading Description makes the data unusable for search."
  - q: "Two schema fields are both mapped to `./jcr:content/metadata/dc:title`. What is the likely result?"
    options:
      - "Each field gets its own private copy of the value"
      - "AEM refuses to save either field"
      - "The second field is ignored automatically"
      - "Both fields read and write the same property, so they overwrite each other"
    answer: 3
    why: "The mapping is just a storage location. Two fields pointing at one property share the value, which is why Adobe's guidance is one field per property."
  - q: "Which statement about required fields is NOT a sound design habit?"
    options:
      - "Mark a field required only when a missing value would block reuse"
      - "Require fifteen fields so nothing is ever left blank"
      - "Combine required fields with a folder-level schema so rules fit the content"
      - "Use dropdowns for required fields where the values are a fixed list"
    answer: 1
    why: "Too many required fields push people to type junk just to save the form. A few required, well-chosen fields on the right folders give you data you can trust."
go_deeper:
  - { title: "JCR explained for SQL developers", url: "/blog/2026/11/jcr-explained-for-sql-developers/", why: "why metadata is just properties on a node" }
  - { title: "Content modelling: JCR vs relational vs document database", url: "/blog/2026/11/content-modelling-jcr-vs-relational-vs-document-database/", why: "thinking about structure before you store it" }
  - { title: "Next lesson: XMP and embedded metadata", url: "/learn/assets/xmp-and-embedded-metadata/" }
---
## The problem: the Properties page nobody trusts

A retailer uploads 20,000 product images. Six months later, one team has typed "SS25" into the Title field, another into Description, and a third into a field called "Season (old)". Searching for spring-summer 2025 finds a third of the images.

The files are fine. The **form** was never designed. In AEM Assets that form is the **metadata schema**.

## What a schema is

Think of a schema as the paper form a hospital hands you at reception. It decides which boxes exist, in what order, and which are compulsory. It does not hold your answers. Your answers are stored on the asset itself.

A schema defines:

- **Tabs and sections** that group fields. The default form ships with Basic, Advanced, IPTC and IPTC Extension tabs, and you can add or delete tabs.
- **Fields**, each with a type: single line text, multi value text, number, date, dropdown, standard tags, smart tags, hidden field, and some reference components.
- **Behaviour**: a label, a placeholder hint, whether the field is required, and whether it can be edited.

Each field has a **Map to Property** setting. This is the repository property the field reads and writes:

```text
Field label:        Title
Map to Property:    ./jcr:content/metadata/dc:title
```

The value lands on the asset's `metadata` node in the repository. Adobe recommends mapping only one field to a property and avoiding spaces in the path. Protected properties such as `jcr:created` should be set to disable editing.

## Which schema does an asset use?

Schemas are managed in the Assets admin under **Tools, Assets, Metadata Schemas**. Out of the box there are forms for `default`, `image` (with `jpeg` and `tiff` children), `application` (with `pdf`), `video` and a few more. An asset uses the form that matches its MIME type, so a JPEG uses `jpeg`.

The `default` form is the base for everything. Change it and every asset type changes with it, so most teams leave it alone and copy a form instead.

To give one part of the library its own fields, copy a form, edit it, and use **Apply to Folders**. Assets uploaded to that folder use the variant. Subfolders inherit the parent's schema unless you apply a different one to them. This is why the folder structure from lesson 3 matters: a clean tree means a few schemas cover a lot of ground.

Custom schemas are stored under `/conf/global/settings/dam/adminui-extension/metadataschema` in the classic Assets admin UI. Adobe support articles warn against putting them in project-specific `/conf` paths, and note that non-admin users need read access to that location to see custom forms. This is also the content you deploy through your pipeline if you want schemas under source control. The newer Assets view keeps its own metadata forms in a different place, so check Experience League for the interface your environment uses.

## Design guidance: fewer, better fields

- **Start from decisions, not data.** Add a field only if someone searches, filters, reports or makes a rights decision with it.
- **Prefer controlled values.** A dropdown or a tag stops "Spring", "spring" and "SS" from becoming three values. Tags are the next-but-one lesson.
- **Require sparingly.** Required fields are useful at folder level. Missing values show on asset cards, and a Metadata Validation search filter finds assets that need attention.
- **Reuse standard properties first.** `dc:title` and `dc:description` already travel inside files, which lesson 8 explains.
- **Put custom fields in a namespace you own**, not in `dc`.

<details markdown="1">
<summary>Stretch question: why not just give every asset type the same huge form?</summary>

Every extra field costs attention. People who see forty boxes fill in three, and the rest become noise. Different asset types also need different questions: a video wants duration and language, a logo wants usage rules. Smaller, targeted forms get more complete answers, and complete answers are what make the library searchable.

</details>

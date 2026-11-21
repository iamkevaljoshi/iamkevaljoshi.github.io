---
title: "Bulk metadata editing and import"
description: "How to change metadata on many assets in AEM Assets: the bulk editor, CSV import and export, their documented limits, and habits for testing and rolling back."
track: assets
level: 2
order: 11
minutes: 8
outcome: "By the end you can pick the right bulk method for a job, run a safe test batch, and explain how to recover if the result is wrong."
prereq: "Lessons 7 to 9 on schemas, embedded metadata and tags."
terms:
  - { t: "Bulk metadata editor", d: "A UI action that applies the same metadata values to several selected assets at once." }
  - { t: "Metadata import", d: "A CSV-based job, created from the Assets UI, that writes metadata to many assets, one row per asset path." }
  - { t: "Metadata export", d: "A job that writes the metadata of a folder's assets to a CSV file you can edit and re-import." }
  - { t: "Batch size", d: "How many assets an import processes in one go; the documented default is 50 and the maximum is 100." }
mistake: "Running a large import straight on production. A column header typo or a wrong separator writes bad values to thousands of assets, and there is no undo button."
try_it:
  - "Choose a test folder of 10 to 20 assets and export its metadata to CSV."
  - "Open the CSV and note the asset path column and how multi-value fields are written."
  - "Change one field for three rows, save, and import the file with workflows left off."
  - "Open the three assets and confirm the new values, then check one you did not change."
  - "Write a short checklist for your team: export, test batch, import, verify, keep the original CSV."
quiz:
  - q: "What does each row of a metadata import CSV represent?"
    options:
      - "One metadata field across all assets"
      - "One folder and its subfolders"
      - "One asset, identified by its repository path"
      - "One user who may edit metadata"
    answer: 2
    why: "The import is keyed by asset path, with columns for the properties to set. That is why an export is the best template: it gives you the exact headers and paths."
  - q: "You need to set 'Season = Summer' on 6,000 product images. Which is the sensible approach?"
    options:
      - "Select all 6,000 in the bulk editor and apply it once"
      - "Edit each asset's Properties page by hand"
      - "Write a script that deletes and recreates the assets"
      - "Export the folder, edit the CSV, test a small batch, then import in stages"
    answer: 3
    why: "Adobe guidance points to CSV import for large updates, and the bulk editor is best for smaller selections. Staging the import after a small test limits the damage of any mistake."
  - q: "You run an import with 'Launch Workflows' switched on for 20,000 assets. What should you expect?"
    options:
      - "The import will be slower and heavier, because it triggers the DAM Metadata Writeback workflow"
      - "The import will be faster because workflows validate the data"
      - "Nothing different, as the setting only affects the inbox notice"
      - "The import will be blocked on Cloud Service"
    answer: 0
    why: "The documentation says turning this on triggers the writeback workflow and slows the system. Leave it off unless you really need values written into the files."
  - q: "Which is NOT a good bulk-edit habit?"
    options:
      - "Keep the exported CSV so you can restore old values"
      - "Check the result on a sample of assets after the job"
      - "Rely on the system to roll back a bad import"
      - "Run large jobs at quiet times"
    answer: 2
    why: "Do not assume an undo exists. Your safety net is the CSV you exported before changing anything, which lets you re-import the previous values."
go_deeper:
  - { title: "AI-assisted AEM Cloud Service migration", url: "/blog/2026/11/ai-assisted-aem-cloud-service-migration/", why: "using scripts and checks to move data safely" }
  - { title: "AEM migration estimator", url: "/tools/aem-migration-estimator/", why: "sizing bulk work such as metadata clean-up" }
  - { title: "Next lesson: Project, design a metadata model", url: "/learn/assets/project-metadata-model/" }
---
## The problem: 6,000 assets, one missing field

A retailer realises that none of its product images has a season. Typing it into 6,000 Properties pages would take weeks. You need a bulk method, and a way to be sure you did not break anything.

## Three ways to change many assets

| Method | Good for | Watch out for |
|---|---|---|
| **Bulk metadata editor** | Dozens of selected assets that share new values | Large selections; Adobe guidance suggests CSV for bigger updates |
| **CSV export, edit, import** | Hundreds to many thousands of assets with different values | Wrong headers, paths and separators |
| **Script or API** | Rules that need logic, joins with another system, repeatable pipelines | You own the testing and the error handling |

In the bulk editor you select assets and choose to edit properties. Most fields replace existing values by default. Append mode works only for multi-value fields, and tags are added to existing ones rather than replacing them.

## CSV export and import

On Cloud Service you export from a folder with **Export metadata**, choosing all properties or only some. Export runs as a job, and the CSV is downloaded from the notification in your inbox. Exports are capped at 1,048,575 assets, the size of an Excel worksheet.

An illustrative CSV (your real export has its own header names, so always start from an export) looks like this:

```text
assetPath,dc:title,retailer:season,cq:tags
/content/dam/product/shoes/trainer-red.jpg,Red trainer,summer,marketing:season/summer
/content/dam/product/shoes/boot-black.jpg,Black boot,winter,marketing:season/winter
```

To import, use **Create, Metadata** in the Assets UI. The documented options are:

- **Batch size:** default 50, maximum 100.
- **Field separator:** comma by default.
- **Multi-value delimiter:** pipe by default.
- **Launch workflows:** off by default. Turning it on triggers the DAM Metadata Writeback workflow and slows the system.
- **Asset path column name:** tells AEM which column holds the paths.

Dates use `yyyy-MM-dd'T'HH:mm:ss.SSSXXX` by default. If you use your own namespace, **register it first**, or the properties will not import. Imports run in the background and notify you in the inbox when done.

One thing Adobe's page does not state is whether an import overwrites or appends to existing values. Do not guess: test it on five assets and look.

## Safe habits

1. **Export before you change.** The old CSV is your rollback file.
2. **Test on 10 to 20 assets** in a folder you can inspect.
3. **Validate the CSV first.** Check path column, spelling of tag IDs, date formats and stray commas inside values.
4. **Import in stages**, and run big jobs at quiet times, since bulk work is resource-intensive.
5. **Verify afterwards**: open samples, and search for the value you set.
6. **Use a non-production environment** for rehearsals when you can.

## When a script is better

If the rule is "season comes from the SKU in the filename" or "copy the rights field from the PIM", a CSV edited by hand is the wrong tool. A script using the Assets APIs, with logging and a dry-run mode, is repeatable and reviewable. The APIs are covered in level 6. The principle is the same: small batch first, record what changed, keep the original values.

<details markdown="1">
<summary>Predict first, then reveal: what if the CSV has the wrong asset path on one row?</summary>

Most likely that row fails or touches nothing, or, worse, it writes to a different asset that does exist at that path. That is why you verify a sample after importing and why exports are the best starting point: the paths come from AEM, not from memory. Path mistakes also come from folder renames, so export again just before editing.

</details>

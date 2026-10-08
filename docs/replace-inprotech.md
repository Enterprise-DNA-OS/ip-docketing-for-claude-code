# Moving off Inprotech

Two exports from Inprotech, two commands here, and a checking pass. A practice of a few thousand cases can do the import in a morning; the checking pass is the real work, and it is the same work a docketing team does when it takes over any new portfolio.

## 1. Export the case list

In Inprotech, run a case search that returns every live case (and the lapsed ones you want history for), with these columns on the results: Case Ref (IRN), Property Type, Country, Title, Local Classes, Instructor, Staff Member, Application No, Application Date, Earliest Priority Date, Registration No, Registration Date, Status, Next Renewal Date and the instructor's reference. Export the results to Excel and save as CSV (UTF-8).

Headings differ between firms. The import knows the usual ones (`INPROTECH_FIELDS` in `scripts/docket.mjs`). For anything else, write a map:

```json
{ "source_id": "IRN Code", "title": "Mark Text", "client": "Client Name", "kind": "Type", "filed_on": "Filed" }
```

## 2. Import the cases

```bash
npm run docket -- import inprotech --file=case-list.csv --dry-run --actor="Your Name"
npm run docket -- import inprotech --file=case-list.csv --actor="Your Name"
```

The dry run shows what would be added: cases, new clients (matched by name, created when new), new staff (matched by name or code). Run it again any time: unchanged rows are skipped, and a row that changed in Inprotech since the last import stops the run so you can reconcile it by hand.

What maps:

| Inprotech | Here |
|---|---|
| Case Ref / IRN | case reference (and the import key) |
| Property Type | kind: patent, trade mark, design |
| Country | country (two letters; WO for PCT) |
| Title, Local Classes | title, classes |
| Instructor | client |
| Staff Member / Signatory | attorney |
| Application No and Date, Earliest Priority Date | application number, filed, priority |
| Registration No and Date | registration number, registered (or granted) |
| Status | status: pending and filed become filed; under examination becomes examination; accepted, registered, granted, lapsed, abandoned, withdrawn map across |
| Next Renewal Date | the next renewal, for registered AU and NZ rights |
| Every other column | kept on the record as the original row (`source_row`) |

## 3. Export and import the due date list

Run the due date list (or an ad hoc due date report) for every open due date, with Case Ref, Event Description, Due Date and Responsible. Save as CSV, then:

```bash
npm run docket -- import inprotech --report=due-dates --file=due-dates.csv --actor="Your Name"
```

Events with renewal, annuity or maintenance in the name go to renewals. Everything else goes on the docket as a statutory deadline. Rerunning skips dates already there.

## 4. Check every date

Every imported deadline arrives unchecked. `npm run docket -- compliance` lists them as DOCKET-UNCHECKED. Split the list by attorney (`docket --attorney=<code> --days=3650`), check each date against the file, and `verify` it. Mark watch dates (`--non-statutory`) and correct extendable flags with `/customise` or by closing and re-adding.

## What does not come across

- **Documents.** Inprotech's attachments and document management stay where they are. Keep a link or a file path in the case notes.
- **Time and billing.** WIP, fee lists and invoices belong in your accounts system.
- **Past events.** The event history before today. The original row is kept on each case, so the dates in the export are not lost.
- **Workflow rules.** Inprotech's law update service drives its own date rules. Here, the rules are the table in `docs/compliance.md`, which your team owns and checks.
- **Client portal and e-filing.** Not in the free version. Enterprise DNA builds a client view or a link to the office's online services into your own version if you want one.

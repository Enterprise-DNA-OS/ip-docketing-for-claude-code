---
description: Bring cases and due dates across from an Inprotech case list and due date list export.
---

Follow `docs/replace-inprotech.md`.

1. Ask for the case list CSV. Read the header row and say which columns map to what (`INPROTECH_FIELDS` in `scripts/docket.mjs`). If headings differ, write a `columns.json` map.
2. Dry run: `npm run docket -- import inprotech --file=<csv> --dry-run --actor="<operator>"`. Show what would be added, including new clients and staff. Run it for real after a yes.
3. Then the due date list: `npm run docket -- import inprotech --report=due-dates --file=<csv> --actor="<operator>"`.
4. Run `/compliance`. Every imported date is unchecked until a second person verifies it against the file: plan that work by attorney.
5. Say plainly what did not come across: documents, time and billing, and the history of past events.

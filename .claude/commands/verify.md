---
description: The second-person check: confirm a docketed date against the office document.
---

1. Show the deadline (`npm run docket -- case --case=<ref>`): kind, due date, rule, basis, who docketed it.
2. Ask the operator to open the source document and confirm the date matches. The checker must not be the person who docketed it; the command refuses if they are.
3. Run `npm run docket -- verify --deadline=<id or case ref> --actor="<checker>"`.

If the date does not match, do not verify. Close it as superseded with the reason, and add the right date with `/add-deadline`.

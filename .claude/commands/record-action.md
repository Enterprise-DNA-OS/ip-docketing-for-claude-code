---
description: Record what the IP office sent (examination report, compliance report, acceptance, registration, grant, filing) and docket the deadlines it starts.
---

1. Ask for the case, the kind of action and the date printed on the document (the issue date, not the day it arrived). Kinds: filed, pct filed, first examination report, examination report, compliance report, acceptance advertised, registered, granted, other.
2. Dry run first: `npm run docket -- record-action --case=<ref> --kind="<kind>" --date=<date> --summary="<one line>" --actor="<operator>" --dry-run`. Show the deadlines it would docket, with the rule and the basis for each.
3. If the document prints a different date from the one worked out, the document wins: record the action, then close the computed deadline as superseded and `/add-deadline` the printed one, noting why.
4. Run it for real after a yes. Then say: each statutory date needs a different person to check it (`/verify`).
5. Offer `/draft-reporting-letter` to tell the client.

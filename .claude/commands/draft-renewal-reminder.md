---
description: Draft a renewal reminder letter for one client, every right due in the next 120 days in one table.
---

Run `npm run docket -- draft-renewal-reminder --client=<name or ref> --days=120`.

Open the draft in `drafts/` and show it. The official and service fees are left for the operator to add. Nothing is sent from here. Once the operator says it went, record each renewal with `mark-reminded` (the ids are in the output).

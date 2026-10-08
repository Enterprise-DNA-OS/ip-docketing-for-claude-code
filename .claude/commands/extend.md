---
description: Move an extendable deadline after an extension has been filed and granted.
---

1. Check the deadline is extendable (`/case`). Statutory dates such as the AU and NZ patent acceptance deadlines cannot be moved here: say so and stop.
2. Only after the extension request has been filed (and paid), run `npm run docket -- extend --deadline=<id> --to=<new date> --reason="<request and receipt>" --actor="<operator>"`.
3. The new date needs a fresh second-person check: `/verify`.

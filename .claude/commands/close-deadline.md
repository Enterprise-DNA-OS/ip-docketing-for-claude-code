---
description: Close a deadline: done, superseded, or not pursued on the client's instructions.
---

Run `npm run docket -- close --deadline=<id or case ref> --outcome="<what was filed or decided>" --actor="<operator>"`, adding `--how=superseded` or `--how=not-pursued` when it was not done.

The outcome names what was filed and the receipt or reference. For not pursued, name who instructed it and when, and offer to update the case status (`update-case --status=abandoned`).

---
description: Record a client's renewal instruction (renew or let lapse), or that the reminder went out.
---

- Reminder sent: `npm run docket -- mark-reminded --renewal=<id or case ref> --actor="<operator>"`.
- Instruction back: `npm run docket -- instruct --renewal=<id or case ref> --instruction=renew|let-lapse --by="<who at the client>" --actor="<operator>"`.

Read the email first and quote the line that gives the instruction. If it is unclear ("probably keep it"), do not record it: draft a one-line question back to `drafts/` instead.

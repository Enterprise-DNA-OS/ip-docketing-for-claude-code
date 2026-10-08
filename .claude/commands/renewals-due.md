---
description: Renewals by state: lapsed, in grace, reminder due, awaiting instructions, instructed.
---

Run `npm run docket -- renewals-due --days=90` (add `--client=<name>` for one client, `--days=365` for the year ahead).

Present by state:
1. **Lapsed:** grace has ended unpaid. The right is gone unless restoration is open. The attorney looks at it today.
2. **In grace:** late fees apply every month (IP Australia) or as a flat penalty (IPONZ). Pay on instructions now.
3. **Reminder due:** within 90 days and no reminder sent. Offer `/draft-renewal-reminder` per client.
4. **Awaiting instructions:** reminder sent, nothing back. Name how many days are left.
5. **Instructed:** the client said renew. Pay it: `/pay-renewal`.

Rights lapsing on the client's instructions are listed last and need no action.

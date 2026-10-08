---
description: Check the docket and renewals against the rules in docs/compliance.md and report what is missed, unchecked or about to lapse, with the rule cited.
---

1. Run `npm run docket -- compliance --json`. Each row is one finding: rule code, case, client, what is wrong.
2. Read `docs/compliance.md` for each rule code that appears: what it checks and the source it comes from.
3. Report as a table: rule, count, the worst example, the source. Severity 1 (missed, lapsed, in grace, nothing docketed) first.
4. For each finding, name the fix: the command (`/verify`, `/record-action`, `/docket-renewal`, `/draft-renewal-reminder`, `/pay-renewal`) and who should do it.
5. If a rule in `docs/compliance.md` looks out of date (fees, periods and grace rules change), say so and stop. Do not guess at law. The operator confirms the rule, then you update the doc and `DEADLINE_RULES` or `RENEWAL_RULES` in `scripts/docket.mjs` together, with a test.

Nothing here is legal advice. The doc records the rules the practice has told the system to enforce, with sources, and this command checks the data against them.

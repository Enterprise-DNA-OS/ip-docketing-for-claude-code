---
description: The docket: statutory deadlines due soon or missed, with who checked each date.
---

Run `npm run docket -- docket --days=30` (add `--attorney=<code>` for one person, `--all` to include watch dates such as opposition periods, `--days=` to look further).

Show missed dates first, then by due date. For every row with `NOT CHECKED`, say who docketed it and that a different person needs to check it against the office document: `/verify`.

Days left of 7 or fewer get named out loud. Never round a date or say "about".

---
description: Put the next renewal on file for a registered right that has none.
---

Run `npm run docket -- docket-renewal --case=<ref> --actor="<operator>"`. It works the date out from the filing date and the rules for that country and kind.

For a country without a rule here (US, EP, CN...), give the date from the office or agent: `--due=<date> --term="<what the renewal is called>"`. Check the result against the register before relying on it.

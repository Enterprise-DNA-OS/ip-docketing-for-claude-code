---
description: Put a deadline on the docket by hand (one an examiner, a hearing officer or a court has set).
---

Run `npm run docket -- add-deadline --case=<ref> --kind="<what has to be done>" --due=<date> --basis="<where the date comes from>" --actor="<operator>"`.

Add `--non-statutory` for an internal or watch date, `--extendable` when the office allows extensions. Always fill `--basis`: the letter or order and its date. Then a different person checks it with `/verify`.

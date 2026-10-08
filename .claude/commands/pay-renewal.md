---
description: Record a renewal paid at the office and put the next one on file.
---

Run `npm run docket -- pay-renewal --renewal=<id or case ref> --receipt="<office receipt>" --fee=<official fee> --actor="<operator>"`.

The command refuses a payment after grace has ended (restoration is a separate application) and a payment against a let-lapse instruction. It dockets the next renewal from the rules: say what it is and when.

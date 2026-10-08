---
description: One client's whole portfolio by country and kind, with the next date on each right.
---

Run `npm run docket -- portfolio --client=<name or reference>`.

Group by title (the same mark or invention across countries together), then country. For each right: status, number, next deadline, next renewal, who renews it. Point out gaps the client may care about: a mark registered in NZ but not AU, a right the client renews themselves, anything lapsing.

For a branded version to send, `npm run docs -- portfolio-report` writes it to `docs-out/` (a person sends it).

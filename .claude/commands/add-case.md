---
description: Open a new case (or a new client) for a patent, trade mark or design.
---

1. New client first if needed: `npm run docket -- add-client --reference=<CL-..> --name="<name>" --contact="<person>" --email=<email> --country=NZ|AU --actor="<operator>"`.
2. Then `npm run docket -- add-case --reference=<ref> --client=<client> --kind=patent|"trade mark"|design --country=<code> --title="<mark or title>" --actor="<operator>"`, with `--classes --filed --priority --application-no --attorney --agent --client-ref --policy` as known.
3. If it has been filed, record the filing so its dates are docketed: `/record-action` with kind `filed` (or `pct filed`).

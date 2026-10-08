# The rules this system checks

`/compliance` (and `npm run docket -- compliance`) checks the records against the rules below. `record-action` uses the dating rules to put deadlines on the docket. Each rule has a code, what it checks, and where it comes from.

Nothing here is legal advice. Periods, fees and grace rules change: confirm each one against the source before relying on it, and when one changes, update this file and `DEADLINE_RULES` or `RENEWAL_RULES` in `scripts/docket.mjs` together, with a test in `scripts/smoke.mjs`. The date printed on an office document always wins over a computed one.

Checked against the sources on 8 October 2026.

## Dating rules (what `record-action` dockets)

| Code | Case | Starts on | Deadline | Period | Extendable here | Source |
|---|---|---|---|---|---|---|
| AU-PAT-ACCEPT | AU patent | first examination report | put in order for acceptance | 12 months | No | Patents Act 1990 and Patents Regulations 1991; IP Australia (12 months from the first examination report, or the application lapses) |
| NZ-PAT-ACCEPT | NZ patent | first examination report | put in order for acceptance | 12 months | No | Patents Act 2013 s71, Patents Regulations 2014 r80; IPONZ, [time for putting application in order](https://www.iponz.govt.nz/get-ip/patents/examination-manual/current/time-for-putting-application-in-order-for-acceptance) |
| NZ-PAT-RESPONSE | NZ patent | first / later examination report | respond to examination report | 6 months / 3 months | Yes | Patents Act 2013 s67; IPONZ, [examination process](https://www.iponz.govt.nz/get-ip/patents/process/) |
| AU-TM-ACCEPT | AU trade mark | first examination report | put in order for acceptance | 15 months | Yes, at a fee | Trade Marks Act 1995 and Trade Marks Regulations 1995; IP Australia (15 months from the first examination report, or the application lapses) |
| NZ-TM-ACCEPT | NZ trade mark | compliance report | put in order for acceptance | 12 months | Yes, at the Commissioner's discretion | Trade Marks Regulations 2003 r61 and r62, Trade Marks Act 2002 s44; IPONZ, [extension of time requests](https://www.iponz.govt.nz/get-ip/trade-marks/practice-guidelines/current/extension-of-time-requests) |
| AU-TM-OPPOSITION | AU trade mark | acceptance advertised | opposition period ends (watch) | 2 months | n/a | Trade Marks Act 1995 s52; IP Australia |
| NZ-TM-OPPOSITION | NZ trade mark | acceptance advertised | opposition period ends (watch) | 3 months | n/a | Trade Marks Act 2002 s47; IPONZ, [trade mark process](https://www.iponz.govt.nz/about-ip/trade-marks/process/) |
| AU-PAT-OPPOSITION | AU patent | acceptance advertised | opposition period ends (watch) | 3 months | n/a | Patents Act 1990 s59; IP Australia, [challenge a new patent](https://ipfirstresponse.ipaustralia.gov.au/options/challenge-new-or-amended-patent) |
| NZ-PAT-OPPOSITION | NZ patent | acceptance advertised | opposition period ends (watch) | 3 months | n/a | Patents Act 2013 s92; IPONZ |
| PARIS-PATENT | any patent, first filing | filed | convention filing deadline | 12 months | No | Paris Convention Article 4C |
| PARIS-MARK-DESIGN | any trade mark or design, first filing | filed | convention filing deadline | 6 months | No | Paris Convention Article 4C |
| PCT-30 | PCT application | pct filed | national phase entry | 30 months from priority | No | Patent Cooperation Treaty Article 22 |
| PCT-31-AU | PCT application | pct filed | AU national phase entry | 31 months from priority | No | Patents Regulations 1991 (AU); IP Australia |

A watch date (`statutory = false`) is not our deadline: it is when a third party's chance to oppose closes. It needs no second check.

## Renewal rules (what `pay-renewal` and `docket-renewal` put on file)

| Right | First renewal | Then | Last | Grace after the due date | Source |
|---|---|---|---|---|---|
| AU trade mark | 10 years from the filing date | every 10 years | none | 6 months, $100 a month late fee | IP Australia, [renew your IP rights](https://www.ipaustralia.gov.au/manage-my-ip/renew-your-ip-rights); grace cut from 10 months to 6 for late-registered marks from 17 May 2024 |
| NZ trade mark | 10 years from the filing date or earlier priority date | every 10 years | none | 6 months (12 months before 13 January 2020) | IPONZ, [renew a trade mark](https://www.iponz.govt.nz/get-ip/trade-marks/renew/) |
| AU standard patent | 4th anniversary of the filing date | yearly, pending or granted | year 19 (20-year term) | 6 months, $100 a month | IP Australia, [renew your IP rights](https://www.ipaustralia.gov.au/manage-my-ip/renew-your-ip-rights) |
| NZ patent | 4th anniversary of the complete specification | yearly (maintenance fees while pending) | year 19 | 6 months, late penalty | IPONZ, [patent fees](https://www.iponz.govt.nz/get-ip/patents/fees) |
| AU design | 5 years from the filing date | once | year 5 (10-year maximum) | 6 months | IP Australia, [renew your IP rights](https://www.ipaustralia.gov.au/manage-my-ip/renew-your-ip-rights) |
| NZ design | 5 years | 10 years | year 10 (15-year maximum) | 6 months | IPONZ |

Rights in other countries are renewed by the foreign agent (`renewal_policy = 'agent renews'`). Put a date on file by hand with `docket-renewal --due --term` if the practice wants to track it.

## Checks (what `/compliance` reports)

| Code | Severity | A finding means | Source |
|---|---|---|---|
| DOCKET-MISSED | 1 | A statutory deadline is past its date and not closed. The right may be lost. | The dating rule that set it |
| DOCKET-7-DAYS | 2 | A statutory deadline falls in the next 7 days and is not closed. | The dating rule that set it |
| DOCKET-UNCHECKED | 2 | A statutory deadline has not been checked against the source document by a second person. | Practice policy: two-person docketing is the standard control in patent and trade mark records teams |
| CASE-NOTHING-DOCKETED | 1 | A live AU, NZ or PCT case (filed, in examination, or accepted) has no open deadline. | Practice policy: every pending case carries its next date |
| RENEWAL-NOT-DOCKETED | 1 | A registered AU or NZ right we renew has no next renewal on file. | Renewal rules above |
| RENEWAL-REMINDER | 2 | A renewal falls due within 90 days and no reminder has gone to the client. | Practice policy (IP Australia sends its own reminder only to owners without an attorney) |
| RENEWAL-NO-INSTRUCTIONS | 2 | A reminder went out, the renewal is due within 30 days, and the client has not said renew or let lapse. | Practice policy |
| RENEWAL-INSTRUCTED-UNPAID | 2 | The client said renew, it is due within 14 days, and it is not paid. | Practice policy |
| RENEWAL-GRACE | 1 | Past the due date, unpaid, inside grace: late fees apply. | Renewal rules above |
| RENEWAL-LAPSED | 1 | Grace has ended unpaid and the case is still shown as registered. The right has lapsed unless restoration is open. | Renewal rules above |

Practice policy rules are this practice's own standards, not statute. Change the thresholds with `/customise`.

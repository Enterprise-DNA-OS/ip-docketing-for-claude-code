# IP Docketing for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS]
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| What needs attention, what is late | `/attention` |
| The Monday docket meeting | `/weekly-review` |
| What is due, what did we miss | `/docket` |
| Renewals, what lapses, who has not replied | `/renewals-due` |
| Who has what due | `/workload` |
| A client's whole portfolio | `/portfolio` |
| Are we compliant, what breaches a rule | `/compliance` |
| Everything on one case | `/case` |
| A list of cases | `/cases` |
| A new case or client | `/add-case` |
| The office sent a report, an acceptance, a registration | `/record-action` |
| A date set by an examiner or a court | `/add-deadline` |
| Check a docketed date | `/verify` |
| A deadline was met or is no longer needed | `/close-deadline` |
| An extension was filed | `/extend` |
| A reminder went out, the client said renew or let lapse | `/instruct` |
| A renewal was paid | `/pay-renewal` |
| A registered right has no renewal on file | `/docket-renewal` |
| Note a call, email or meeting | `/log` |
| Renewal reminder letters | `/draft-renewal-reminder` |
| Tell the client what the office said | `/draft-reporting-letter` |
| Bring data across from Inprotech | `/import` |
| A backup | `/export` |
| Change a field, a period or a rule | `/customise` |
| A new dashboard | `/new-view` |

If an ask fits nothing here, run the CLI directly (`npm run <cli> -- --help`) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never back-date an official action, a payment or a check. Record the real date and let the compliance check say what it says.
- The date printed on the office document wins over a computed one. If they differ, record the printed date and say why in the basis.
- The person who docketed a statutory date never checks it. The CLI refuses; do not work around it.
- Never record a renewal instruction the client did not clearly give. Quote the line from their email in the note.
- Client and case records are confidential. Exports stay in `exports/` (ignored by git) and drafts in `drafts/`.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis and the guide for moving off Inprotech.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/inprotech

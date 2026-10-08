<h1 align="center">IP Docketing for Claude Code</h1>

<p align="center">
  <strong>The open-source patent and trade mark docketing system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Inprotech data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=inprotech">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/inprotech?utm_source=github&utm_medium=readme&utm_campaign=inprotech">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-inprotech">Instead of Inprotech</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

IP Docketing for Claude Code does the job you pay Inprotech for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the Inprotech dashboard cannot.

Clarivate prices Inprotech privately: a licence by user and module, an implementation project that runs for months, and yearly maintenance on top. There is no public price list, so check your own invoice. Most practices pay for every attorney, paralegal and records seat, every year, for a docket that is a few tables of dates.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=inprotech).

It covers the part of Inprotech a patent and trade mark practice runs its week on: cases by country, the official actions the IP offices send, the docket of deadlines those actions start (worked out from the AU and NZ rules, with a second-person check on every statutory date), renewals with their reminders, instructions and grace periods, and case notes. It is built for Australian and New Zealand attorney firms of one to thirty people, and for in-house brand and patent teams who manage their own portfolio.

### Ten questions Inprotech's screens do not answer in one go

1. Which statutory deadlines fall in the next 30 days, and has a second person checked each one against the office document? (`docket`)
2. Which live cases have nothing on the docket at all? (`compliance`)
3. Which registered marks have no next renewal on file? (`compliance`)
4. Which renewals are due in 90 days with no reminder sent, or no instructions back? (`renewals-due`)
5. Which marks are in their grace period right now, running a late fee, and what is the last day? (`renewals-due`)
6. What does each attorney have overdue, due this week and still unchecked? (`workload`)
7. For one client, every mark, patent and design by country, with the next date on each? (`portfolio`)
8. Which pending cases have had nothing on file for four months? (`attention`)
9. How long, on average, from filing to registration, by kind and country? (`turnaround`)
10. When the office issues a report today, what are the dates it starts, and which rule set each one? (`record-action --dry-run`)

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/ip-docketing-for-claude-code.git
cd ip-docketing-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type `/attention`. Next try `/docket`, then `/renewals-due`, then `/weekly-review`.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

| Command | What it does |
|---|---|
| `/attention` | Everything missed, due this week, unchecked, lapsing or quiet, in one list |
| `/weekly-review` | The Monday docket meeting note: deadlines, renewals, workload, compliance |
| `/docket` | Statutory deadlines due soon or missed, with who checked each date |
| `/renewals-due` | Renewals by state: lapsed, in grace, reminder due, awaiting instructions, instructed |
| `/workload` | Open deadlines by attorney: overdue, this week, unchecked |
| `/portfolio` | One client's rights by country and kind, with the next date on each |
| `/compliance` | Every rule in `docs/compliance.md` checked, with its source |
| `/case` | One case's whole file |
| `/cases` | Cases by client, attorney, kind, country or status |
| `/add-case` | Open a case (and a client) |
| `/record-action` | Record an examination report, acceptance, registration or filing and docket its dates |
| `/add-deadline` | A deadline set by an examiner, hearing officer or court |
| `/verify` | The second-person check of a docketed date |
| `/close-deadline` | Close a deadline: done, superseded or not pursued |
| `/extend` | Move an extendable deadline after the extension is filed |
| `/instruct` | Record a renewal reminder sent, or the client's instruction back |
| `/pay-renewal` | Record a renewal paid and put the next one on file |
| `/docket-renewal` | Put the next renewal on file for a right that has none |
| `/log` | A case note: call, email, meeting or note |
| `/draft-renewal-reminder` | Draft a client's renewal reminder to `drafts/`. Never sends |
| `/draft-reporting-letter` | Draft the reporting letter on the latest official action. Never sends |
| `/import` | Bring cases and due dates across from Inprotech exports |
| `/export` | Every record to a JSON backup |
| `/customise` | Add a field, change a period, add a country's rules, in plain words |
| `/new-view` | Add an HTML dashboard |

Behind them is one CLI, `npm run docket -- help`, with 32 commands and `--json` on every one. `npm run view` renders the week, the renewal book and the workload as branded HTML; `npm run docs` renders client renewal notices, client portfolio reports and the docket report.

### Your first hour: ten things to ask for

1. "What needs attention this week?"
2. "What did we miss, and what is due in the next seven days?"
3. "Which dates has nobody checked yet? Split them between Priya and Ruth."
4. "IPONZ registered KAWAKAWA RITUAL today. Record it and put the renewal on file."
5. "Draft renewal reminders for every client with a renewal in the next four months."
6. "Tui Kitchen said renew both TUI KITCHEN marks. Record it."
7. "Show me Harbour Medical's whole portfolio."
8. "Write the Monday docket note."
9. "Put our firm name and colours on the renewal notice." (`brand.json`)
10. "Bring across our Inprotech case list." (`/import`)

## Instead of Inprotech

Export the case list from an Inprotech case search to CSV, then `npm run docket -- import inprotech --file=case-list.csv --dry-run --actor="Your Name"`. Then the due date list with `--report=due-dates`. Every imported date waits for a second-person check. The whole path, the column map and what does not carry over: [docs/replace-inprotech.md](docs/replace-inprotech.md). The dating rules, renewal rules and checks, with sources: [docs/compliance.md](docs/compliance.md).

## Architecture

```
ip-docketing-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/                  the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     the thesis and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs IP Docketing for Claude Code for your business, migrates your Inprotech data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=inprotech)
- Read more: [enterprisedna.co/omni/instead-of/inprotech](https://enterprisedna.co/omni/instead-of/inprotech?utm_source=github&utm_medium=readme&utm_campaign=inprotech)

## License

MIT. Copyright (c) 2026 Enterprise DNA.

#!/usr/bin/env node
// npm test: a temp database, migrate, seed, every command, the rules and the gates. Prints PASS.
// TEST_DATABASE_URL runs the same checks against a real, empty, disposable Postgres.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { seed } from './seed.mjs';
import { run, commands, resolve, date, amount, human, addMonths, nextRenewal, deadlinesFor } from './docket.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docket-test-'));
process.env.DATA_DIR = path.join(dir, 'db');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || '';
process.env.OUTPUT_DIR = dir;

let db;
const visited = new Set();
const call = (c, o = {}, p = []) => {
  visited.add(c);
  return run(db, [c, ...p, ...Object.entries(o).map(([k, v]) => (v === true ? `--${k}` : `--${k}=${v}`))]);
};
const fails = (c, o, re, p = []) => assert.rejects(() => call(c, o, p), re);
const shell = (file, argv = []) => {
  const r = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', file), ...argv], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  return r.stdout;
};
const iso = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const rec = { actor: 'Ruth Chen' };
const other = { actor: 'Priya Singh' };
const findings = async () => (await call('compliance')).map((r) => `${r.rule} ${r.record}`);
const deadlineId = async (ref, kind) => (await call('docket', { days: '3650', all: true })).find((r) => r.case_ref === ref && r.deadline === kind).id;
const renewalId = async (ref) => (await call('renewals-due', { days: '3650' })).find((r) => r.case_ref === ref).id;

try {
  db = await getDb();
  if (db.mode === 'postgres') assert.equal((await db.query("select tablename from pg_tables where schemaname = 'public'")).length, 0, 'TEST_DATABASE_URL must be an empty, disposable database');
  assert.equal((await migrate(db)).ran.length, 1);
  assert.equal((await migrate(db)).ran.length, 0, 'migrate is safe to rerun');
  await seed(db); await seed(db);
  assert.equal((await call('cases')).length, 17, 'seed is idempotent');

  // Date arithmetic: calendar months, clamped at month end.
  assert.equal(addMonths('2025-01-31', 1), '2025-02-28');
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addMonths('2024-08-15', 30), '2027-02-15');
  assert.equal(addMonths('2025-03-31', -1), '2025-02-28');

  // The rules: what each official action dockets.
  const nzMark = { reference: 'x', kind: 'trade mark', country: 'NZ', filed_on: '2024-03-10', priority_on: null };
  assert.deepEqual(deadlinesFor(nzMark, 'compliance report', '2024-03-20').map((d) => [d.rule, d.due_on, d.statutory]), [['NZ-TM-ACCEPT', '2025-03-20', true]]);
  assert.deepEqual(deadlinesFor({ ...nzMark, country: 'AU' }, 'first examination report', '2024-03-20').map((d) => d.due_on), ['2025-06-20']);
  assert.deepEqual(deadlinesFor({ ...nzMark, kind: 'patent' }, 'first examination report', '2024-03-20').map((d) => `${d.rule} ${d.due_on}`), ['NZ-PAT-ACCEPT 2025-03-20', 'NZ-PAT-RESPONSE 2024-09-20']);
  assert.deepEqual(deadlinesFor({ ...nzMark, kind: 'patent', country: 'WO', priority_on: '2023-05-31' }, 'pct filed', '2024-05-30').map((d) => `${d.rule} ${d.due_on}`), ['PCT-30 2025-11-30', 'PCT-31-AU 2025-12-31']);
  assert.equal(deadlinesFor(nzMark, 'filed', '2024-03-10')[0].due_on, '2024-09-10', 'six-month convention deadline for a mark');
  assert.equal(deadlinesFor({ ...nzMark, priority_on: '2024-01-01' }, 'filed', '2024-03-10').length, 0, 'a case that claims priority is not a first filing');
  assert.equal(deadlinesFor({ ...nzMark, country: 'AU' }, 'acceptance advertised', '2024-06-01')[0].due_on, '2024-08-01');
  assert.equal(nextRenewal(nzMark, '2024-12-01').due_on, '2034-03-10');
  assert.equal(nextRenewal({ ...nzMark, priority_on: '2023-11-01' }, '2024-12-01').due_on, '2033-11-01', 'NZ marks renew from the earlier priority date');
  const auPatent = { kind: 'patent', country: 'AU', filed_on: '2020-07-18' };
  assert.deepEqual(nextRenewal(auPatent, '2021-01-01'), { term: 'year 4', due_on: '2024-07-18', grace_ends_on: '2025-01-18' });
  assert.equal(nextRenewal(auPatent, '2024-07-18').term, 'year 5');
  assert.equal(nextRenewal(auPatent, '2040-01-01'), null, 'a patent stops after year 19');
  assert.equal(nextRenewal({ kind: 'design', country: 'AU', filed_on: '2020-01-01' }, '2025-01-02'), null, 'an AU design renews once');
  assert.equal(nextRenewal({ kind: 'design', country: 'NZ', filed_on: '2020-01-01' }, '2025-01-02').due_on, '2030-01-01');
  assert.equal(nextRenewal({ kind: 'trade mark', country: 'US', filed_on: '2020-01-01' }, '2025-01-01'), null, 'foreign rights are renewed by the agent');

  // Every read runs and returns rows or a report.
  for (const c of ['help', 'staff', 'clients', 'cases', 'docket', 'renewals-due', 'workload', 'turnaround', 'attention', 'compliance', 'notes']) {
    assert(Array.isArray(await call(c)), c);
  }
  assert.equal((await call('cases', { client: 'CL-01' })).length, 3);
  assert.equal((await call('cases', { kind: 'patent' })).length, 5);
  assert.equal((await call('cases', { country: 'au', status: 'registered' })).length, 5);
  assert.equal((await call('portfolio', { client: 'tui' })).length, 3);
  assert.equal((await call('clients')).find((r) => r.reference === 'CL-05').live_cases, 2);

  // The seeded problems are found, every time.
  const rules = await findings();
  for (const want of ['DOCKET-MISSED T-1006', 'DOCKET-7-DAYS P-2002', 'DOCKET-UNCHECKED P-2001', 'CASE-NOTHING-DOCKETED P-2004', 'RENEWAL-NOT-DOCKETED T-1004',
    'RENEWAL-REMINDER T-1001', 'RENEWAL-NO-INSTRUCTIONS T-1002', 'RENEWAL-INSTRUCTED-UNPAID T-1009', 'RENEWAL-GRACE T-1003', 'RENEWAL-LAPSED T-1011']) assert(rules.includes(want), `compliance finds ${want}`);
  assert.equal(rules.length, 10, 'nothing else is flagged');
  assert(!rules.some((r) => r.endsWith('T-1010')), 'a mark lapsing on instructions is not a breach');
  assert(!rules.some((r) => r.endsWith('T-1008')), 'a mark the US agent renews is not ours to docket');
  assert(!rules.some((r) => r.endsWith('T-1007')), 'a watch date needs no second check');

  const docket = await call('docket');
  assert.deepEqual(docket.map((r) => r.case_ref), ['T-1006', 'P-2002']);
  assert.equal(docket[0].days_left, -3);
  assert.equal((await call('docket', { days: '120', all: true })).length, 7);
  assert.equal((await call('docket', { days: '120', attorney: 'DB' })).length, 4);
  const renewals = await call('renewals-due');
  assert.deepEqual(renewals.map((r) => `${r.case_ref} ${r.state}`), ['T-1011 lapsed', 'T-1003 in grace', 'T-1001 reminder due', 'T-1002 awaiting instructions', 'T-1009 instructed', 'T-1010 lapsing on instructions']);
  assert.equal((await call('renewals-due', { days: '3650', client: 'CL-02' })).length, 2);
  const load = await call('workload');
  assert.equal(load.find((r) => r.attorney === 'AM').overdue, 1);
  assert.equal(load.find((r) => r.attorney === 'DB').unchecked, 1);
  assert(Number((await call('turnaround')).find((r) => r.kind === 'trade mark' && r.country === 'NZ').avg_days_filing_to_registration) > 150);
  const attention = await call('attention');
  assert(attention.some((r) => r.kind === 'quiet' && r.record === 'T-1006'));
  assert(attention.some((r) => r.kind === 'deadline' && r.record === 'T-1006' && /MISSED/.test(r.why)));
  assert(attention.some((r) => r.kind === 'nothing docketed' && r.record === 'P-2004'));
  const weekly = await call('weekly-review');
  assert.deepEqual(Object.keys(weekly), ['docket (next 14 days and missed)', 'renewals (next 60 days, in grace, lapsed)', 'workload', 'compliance']);
  assert.match(human(weekly), /T-1006/);

  // Matching: reference, application number, id, part of a title or client name.
  assert.equal((await call('case', { case: 't-1001' })).case.title, 'TUI KITCHEN');
  assert.equal((await call('case', { case: '798123' })).case.reference, 'P-2002');
  assert.equal((await call('case', { case: 'hazy' })).open_deadlines[0].rule, 'AU-TM-ACCEPT');
  assert.equal((await resolve(db, 'cases', 'ca000000-0000-0000-0000-000000000016')).reference, 'P-2005');
  await assert.rejects(() => resolve(db, 'cases', 'tui kitchen'), /more than one[\s\S]*T-1001[\s\S]*T-1002/);
  await assert.rejects(() => resolve(db, 'cases', "%' or true --"), /No cases/);
  await fails('verify', { deadline: 'P-2003', ...rec }, /more than one open deadline[\s\S]*national phase/);

  // Input checks.
  assert.equal(date('14/03/2025'), '2025-03-14');
  assert.throws(() => date('2026-02-30'), /real date/); assert.throws(() => date('03/14/2025'), /real date/);
  assert.equal(amount('$1,250'), '1250'); assert.throws(() => amount('-1'), /positive/);
  await fails('docket', { days: '-1' }, /whole number/);
  await fails('cases', { typo: 'x' }, /Unknown option/);
  await fails('docket', { all: 'yes' }, /takes no value/);
  await fails('log', { case: 'T-1001', note: 'x' }, /--actor is required/);
  await fails('cases', { kind: 'copyright' }, /kind must be/);
  await fails('cases', { country: 'NZL' }, /two-letter/);

  // Staff, clients, cases.
  await call('add-staff', { code: 'ko', name: 'Kiri Ormsby', role: 'paralegal', ...rec });
  await call('add-client', { reference: 'CL-07', name: 'Piko Foods <script>Ltd</script>', contact: 'Mr Ben Ward', email: 'ben@piko.example.co.nz', ...rec });
  await call('add-case', { reference: 'T-9001', client: 'CL-07', kind: 'trade mark', country: 'nz', title: 'PIKO', classes: '29', filed: iso(-200), attorney: 'AM', ...rec });
  await fails('add-case', { reference: 't-9001', client: 'CL-07', kind: 'trade mark', country: 'NZ', title: 'Dup', ...rec }, /unique|duplicate/);
  await fails('add-case', { reference: 'T-9002', client: 'CL-07', kind: 'trade mark', country: 'NZ', title: 'X', filed: iso(-10), priority: iso(-5), ...rec }, /priority cannot be after/);
  await call('update-case', { case: 'T-9001', classes: '29, 30', 'client-ref': 'PF-1', ...rec });
  assert.equal((await call('case', { case: 'T-9001' })).case.classes, '29, 30');
  await fails('update-case', { case: 'T-9001', ...rec }, /Nothing to change/);

  // Recording an official action dockets its deadlines, then a second person checks them.
  const cr = await call('record-action', { case: 'T-9001', kind: 'compliance report', date: iso(-190), summary: 'Descriptiveness objection', ...rec });
  assert.equal(cr.status, 'examination');
  assert.deepEqual(cr.docketed.map((d) => [d.rule, d.due_on]), [['NZ-TM-ACCEPT', addMonths(iso(-190), 12)]]);
  assert((await findings()).includes('DOCKET-UNCHECKED T-9001'));
  const crId = await deadlineId('T-9001', 'put in order for acceptance');
  await fails('verify', { deadline: crId, ...rec }, /A different person checks it/);
  await call('verify', { deadline: crId, ...other });
  await fails('verify', { deadline: crId, actor: 'Kiri Ormsby' }, /Already checked/);
  assert(!(await findings()).some((r) => r.endsWith('T-9001')));
  await fails('record-action', { case: 'T-9001', kind: 'compliance report', date: iso(5), ...rec }, /future/);
  await fails('record-action', { case: 'T-9001', kind: 'letter', date: iso(0), ...rec }, /kind must be/);

  const dry = await call('record-action', { case: 'P-2004', kind: 'first examination report', date: iso(-2), 'dry-run': true, ...rec });
  assert.equal(dry.docketed.length, 2);
  assert((await findings()).includes('CASE-NOTHING-DOCKETED P-2004'), 'a dry run writes nothing');
  await call('record-action', { case: 'P-2004', kind: 'first examination report', date: iso(-2), ...rec });
  assert(!(await findings()).includes('CASE-NOTHING-DOCKETED P-2004'));
  await fails('record-action', { case: 'P-2004', kind: 'first examination report', date: iso(-1), ...rec }, /already has a first examination report/);
  const later = await call('record-action', { case: 'P-2004', kind: 'examination report', date: iso(-1), ...rec });
  assert.deepEqual(later.docketed.map((d) => d.due_on), [addMonths(iso(-1), 3)]);

  // A new patent: the convention deadline and the fourth-year renewal.
  await call('add-case', { reference: 'P-9001', client: 'CL-07', kind: 'patent', country: 'NZ', title: 'Shelf-stable kawakawa paste', attorney: 'DB', ...rec });
  const filed = await call('record-action', { case: 'P-9001', kind: 'filed', date: iso(-10), ...rec });
  assert.deepEqual(filed.docketed.map((d) => [d.rule, d.due_on]), [['PARIS-PATENT', addMonths(iso(-10), 12)]]);
  assert.equal(filed.renewal, `year 4 due ${addMonths(iso(-10), 48)}`);

  // Registration closes the watch date and puts the first renewal on file.
  const reg = await call('record-action', { case: 'T-1007', kind: 'registered', date: iso(0), ...rec });
  assert.equal(reg.status, 'registered');
  const t1007 = await call('case', { case: 'T-1007' });
  assert.equal(t1007.open_deadlines.length, 0);
  assert.equal(t1007.closed_deadlines[0].how_closed, 'superseded');
  assert.equal(t1007.renewals[0].due_on, addMonths(iso(-210), 120));

  // Deadlines: add by hand, extend, close.
  await fails('extend', { deadline: await deadlineId('P-2001', 'put in order for acceptance'), to: iso(400), reason: 'x', ...rec }, /cannot be extended/);
  const missed = await deadlineId('T-1006', 'put in order for acceptance');
  await fails('extend', { deadline: missed, to: iso(-30), reason: 'x', ...rec }, /after the current due date/);
  await call('extend', { deadline: missed, to: iso(60), reason: 'Three months extension filed and paid', ...rec });
  let rules2 = await findings();
  assert(!rules2.includes('DOCKET-MISSED T-1006'));
  assert(rules2.includes('DOCKET-UNCHECKED T-1006'), 'an extended date needs a fresh check');
  assert.equal((await call('case', { case: 'T-1006' })).open_deadlines[0].due_on, iso(60));
  const response = await deadlineId('P-2002', 'respond to examination report');
  const letter = await call('draft-reporting-letter', { case: 'P-2002' });
  const letterText = fs.readFileSync(letter.file, 'utf8');
  assert.match(letterText, /DRAFT[\s\S]*Intellectual Property Office of New Zealand[\s\S]*respond to examination report/);
  assert.match(letterText, /Kia ora Claire/);
  await fails('close', { deadline: response, ...rec }, /--outcome is required/);
  await fails('close', { deadline: response, outcome: 'x', how: 'forgot', ...rec }, /--how must be/);
  await call('close', { deadline: response, outcome: 'Response filed with amended claims', ...rec });
  await fails('close', { deadline: response, outcome: 'again', ...rec }, /Closed on/);
  assert(!(await findings()).includes('DOCKET-7-DAYS P-2002'));
  await call('add-deadline', { case: 'T-1005', kind: 'file evidence of use', due: iso(30), basis: 'Agreed with the examiner by phone', ...rec });
  await call('add-deadline', { case: 'T-1005', kind: 'chase client for labels', due: iso(7), 'non-statutory': true, ...rec });
  assert.equal((await call('docket', { days: '40' })).filter((r) => r.case_ref === 'T-1005').length, 1, 'watch dates only show with --all');

  // Renewals: reminder, instructions, payment, the next one on file.
  await call('mark-reminded', { renewal: 'T-1001', ...rec });
  assert(!(await findings()).includes('RENEWAL-REMINDER T-1001'));
  await fails('instruct', { renewal: 'T-1002', instruction: 'maybe', by: 'Sam', ...rec }, /renew or let-lapse/);
  await fails('instruct', { renewal: 'T-1002', instruction: 'renew', ...rec }, /--by is required/);
  await call('instruct', { renewal: 'T-1002', instruction: 'renew', by: 'Sam Te Rangi', ...rec });
  assert(!(await findings()).some((r) => r.endsWith('T-1002')));
  const paid = await call('pay-renewal', { renewal: 'T-1009', receipt: 'IPONZ 552190', fee: '600', ...rec });
  assert.match(paid.next_renewal, /^10 year renewal due /);
  assert(!(await findings()).some((r) => r.endsWith('T-1009')));
  await fails('pay-renewal', { renewal: await renewalId('T-1002'), receipt: 'x', date: iso(1), ...rec }, /future/);
  await call('pay-renewal', { renewal: 'T-1003', receipt: 'IPONZ 552191', ...rec });
  assert(!(await findings()).includes('RENEWAL-GRACE T-1003'));
  assert.match((await call('notes', { case: 'T-1003', limit: '5' })).map((n) => n.note).join(' '), /late fee/);
  await fails('pay-renewal', { renewal: 'T-1011', receipt: 'x', ...rec }, /Grace ended/);
  await fails('pay-renewal', { renewal: 'T-1010', receipt: 'x', ...rec }, /let it lapse/);
  await call('update-case', { case: 'T-1011', status: 'lapsed', ...rec });
  assert(!(await findings()).includes('RENEWAL-LAPSED T-1011'), 'a lapse recorded on the case clears the finding');
  const dr = await call('docket-renewal', { case: 'T-1004', ...rec });
  assert.equal(dr.term, '10 year renewal');
  assert(!(await findings()).includes('RENEWAL-NOT-DOCKETED T-1004'));
  await fails('docket-renewal', { case: 'T-1004', ...rec }, /already has/);
  await fails('docket-renewal', { case: 'T-1008', ...rec }, /No renewal rule/);
  await call('docket-renewal', { case: 'T-1008', due: iso(800), term: 'US section 8 and 9', ...rec });
  await fails('mark-reminded', { renewal: 'T-1099', ...rec }, /No open renewal/);

  // Case notes.
  await call('log', { case: 'T-1006', note: 'Coexistence agreement signed by both owners', kind: 'meeting', ...rec });
  assert.equal((await call('notes', { case: 'T-1006', limit: '1' }))[0].note, 'Coexistence agreement signed by both owners');
  assert(!(await call('attention')).some((r) => r.kind === 'quiet' && r.record === 'T-1006'), 'a note ends the quiet');

  // Drafts go to drafts/, never anywhere else.
  const reminder = await call('draft-renewal-reminder', { client: 'CL-01' });
  const reminderText = fs.readFileSync(reminder.file, 'utf8');
  assert.match(reminderText, /DRAFT[\s\S]*Kia ora Sam[\s\S]*TUI KITCHEN[\s\S]*Renew/);
  assert.equal(path.dirname(reminder.file), path.join(dir, 'drafts'));
  await fails('draft-renewal-reminder', { client: 'CL-07', days: '30' }, /no renewals due/);
  await fails('draft-reporting-letter', { case: 'P-9001-x' }, /No cases/);

  // Import from Inprotech: the case list, then the due date list.
  const cases = path.join(REPO_ROOT, 'fixtures', 'inprotech-case-list.csv');
  const dues = path.join(REPO_ROOT, 'fixtures', 'inprotech-due-dates.csv');
  const before = (await call('cases')).length;
  const d1 = await call('import', { file: cases, 'dry-run': true, ...rec }, ['inprotech']);
  assert.equal(d1.added, 4); assert.equal((await call('cases')).length, before, 'dry run writes nothing');
  const real = await call('import', { file: cases, ...rec }, ['inprotech']);
  assert.equal(real.added, 4); assert.equal(real.renewals_docketed, 3);
  assert.match(real.clients_added, /Koru Hospitality Ltd[\s\S]*Tasman Solar/); assert.match(real.staff_added, /GO Grace Okafor/);
  const koru = await call('case', { case: '1203457' });
  assert.equal(koru.case.filed_on, '2017-03-03'); assert.equal(koru.case.priority_on, '2017-02-14'); assert.equal(koru.case.status, 'registered');
  assert.equal(koru.renewals[0].due_on, '2027-02-14');
  assert.equal((await call('case', { case: 'P-88123' })).case.status, 'examination');
  assert.equal((await call('import', { file: cases, ...rec }, ['inprotech'])).unchanged, 4, 'reimport is a no-op');
  const due = await call('import', { file: dues, report: 'due-dates', ...rec }, ['inprotech']);
  assert.deepEqual([due.deadlines_added, due.renewals_added, due.unchanged], [1, 1, 1]);
  assert((await findings()).includes('DOCKET-UNCHECKED P-88123'), 'imported dates wait for a check');
  const changed = path.join(dir, 'changed.csv');
  fs.writeFileSync(changed, fs.readFileSync(cases, 'utf8').replace('Garden kneeler', 'Garden kneeling pad'));
  await fails('import', { file: changed, ...rec }, /changed in Inprotech/, ['inprotech']);
  const mapped = path.join(dir, 'mapped.csv'); const map = path.join(dir, 'map.json');
  fs.writeFileSync(mapped, 'IRN Code,Mark Text,Client Name,Type,Filed\nTM-77,RIMU,Rimu Joinery Ltd,Trade Mark,01/02/2025\n');
  fs.writeFileSync(map, JSON.stringify({ source_id: 'IRN Code', title: 'Mark Text', client: 'Client Name', kind: 'Type', filed_on: 'Filed' }));
  assert.equal((await call('import', { file: mapped, map, ...rec }, ['inprotech'])).added, 1);
  fs.writeFileSync(map, JSON.stringify({ source_id: 'Nope' }));
  await fails('import', { file: mapped, map, ...rec }, /not in the file/, ['inprotech']);
  const bad = path.join(dir, 'bad.csv');
  fs.writeFileSync(bad, 'Case Ref,Title,Instructor,Property Type,Application Date,Status\n1,A,B,Trade Mark,01/01/2024,Sleeping\n');
  await fails('import', { file: bad, ...rec }, /status "Sleeping"/, ['inprotech']);
  fs.writeFileSync(bad, 'Case Ref,Title,Instructor,Property Type,Application Date\n1,A,B,Copyright,01/01/2024\n');
  await fails('import', { file: bad, ...rec }, /property type "Copyright"/, ['inprotech']);
  fs.writeFileSync(bad, 'Case Ref,Event Description,Due Date\nNOPE-1,Acceptance,01/01/2027\n');
  await fails('import', { file: bad, report: 'due-dates', ...rec }, /Import the case list first/, ['inprotech']);
  await fails('import', { file: cases, ...rec }, /Supported import: inprotech/, ['cpa']);

  // Export.
  const exp = await call('export');
  const backup = JSON.parse(fs.readFileSync(exp.file, 'utf8'));
  assert.equal(backup.records.cases.length, 24);
  assert.equal(backup.records.cases.find((c) => c.source_id === 'D-55001').source_row.Title, 'Garden kneeler');

  for (const c of Object.keys(commands)) assert(visited.has(c), `smoke test covers ${c}`);
  assert.match(human(await call('help')), /record-action/);
  await db.close(); db = null;

  // The HTML views and documents render from the same database (embedded mode only).
  if (!process.env.DATABASE_URL) {
    assert.match(shell('view.mjs'), /views[\\/]week\.html/);
    const week = fs.readFileSync(path.join(dir, 'views', 'week.html'), 'utf8');
    assert.match(week, /T-1001|P-2004/);
    const docs = shell('docs.mjs');
    assert.match(docs, /renewal-notice/); assert.match(docs, /portfolio-report/); assert.match(docs, /docket-report/);
    const piko = fs.readdirSync(path.join(dir, 'docs-out', 'portfolio-report')).find((f) => f.includes('piko'));
    assert(!fs.readFileSync(path.join(dir, 'docs-out', 'portfolio-report', piko), 'utf8').includes('<script>Ltd'), 'documents escape text');
    assert.match(shell('docket.mjs', ['docket']), /checked_by/);
    assert.match(shell('docket.mjs', ['compliance', '--json']), /"rule"/);
  }
  console.log(`PASS: ${Object.keys(commands).length} commands checked (${process.env.DATABASE_URL ? 'postgres' : 'pglite'})`);
} finally {
  if (db) await db.close();
  fs.rmSync(dir, { recursive: true, force: true });
}

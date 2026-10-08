#!/usr/bin/env node
// The one CLI for IP Docketing for Claude Code. Every slash command drives this.
//   npm run docket -- help
//   npm run docket -- docket --days=30
//   npm run docket -- case --case=t-1001 --json
// Human tables by default, --json for machines. Records match by id, id prefix,
// reference or part of a name; an ambiguous match lists the candidates and exits 1.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv, pick } from './lib/csv.mjs';
import { table } from './lib/format.mjs';

export const commands = {
  help: 'Show commands',
  staff: 'Attorneys, paralegals and records staff',
  clients: 'Clients with their live cases and next date',
  cases: 'Cases: optional --client --attorney --kind --country --status',
  case: 'One case and everything on file: --case',
  docket: 'Open deadlines due within --days=30 (overdue always shown): optional --attorney --all (include non-statutory)',
  'renewals-due': 'Unpaid renewals due within --days=90, by state: optional --client',
  workload: 'Open deadlines by attorney: overdue, this week, next 30 days, unchecked',
  portfolio: 'One client\'s rights by country and kind, with the next date on each: --client',
  turnaround: 'Days from filing to registration or grant, by kind and country',
  attention: 'Everything missed, due this week, unchecked, lapsing or quiet in one list',
  compliance: 'Every rule in docs/compliance.md checked against the records',
  'weekly-review': 'Docket, renewals, workload and compliance in one report',
  notes: 'Case notes, newest first: optional --case --limit=30',
  'add-staff': '--code --name --actor; optional --role=attorney|paralegal|records --registration',
  'add-client': '--reference --name --actor; optional --contact --email --country',
  'add-case': '--reference --client --kind --country --title --actor; optional --classes --application-no --filed --priority --attorney --agent --client-ref --policy --status',
  'update-case': '--case --actor with changed fields (--title --classes --application-no --registration-no --attorney --agent --client-ref --policy --status)',
  'record-action': 'Record what the IP office sent and docket its deadlines: --case --kind --date --actor; optional --summary --dry-run',
  'add-deadline': 'A deadline by hand: --case --kind --due --actor; optional --non-statutory --extendable --basis',
  verify: 'Second-person check of a deadline: --deadline --actor (not the person who docketed it)',
  close: 'Close a deadline: --deadline --outcome --actor; optional --how=done|superseded|not-pursued --date',
  extend: 'Move an extendable deadline: --deadline --to --reason --actor',
  'mark-reminded': 'Record that the renewal reminder went to the client: --renewal --actor; optional --date',
  instruct: 'Record the client\'s renewal instruction: --renewal --instruction=renew|let-lapse --by --actor; optional --date',
  'docket-renewal': 'Put the next renewal on file for a case: --case --actor; optional --due --term (worked out from the rules when left out)',
  'pay-renewal': 'Record the renewal paid and docket the next one: --renewal --receipt --actor; optional --fee --date',
  log: 'Case note: --case --note --actor; optional --kind=note|call|email|meeting',
  'draft-renewal-reminder': 'Renewal reminder letter to drafts/: --client; optional --days=120',
  'draft-reporting-letter': 'Reporting letter on the latest official action to drafts/: --case',
  import: 'inprotech --file=export.csv --actor; optional --report=cases|due-dates --map=columns.json --dry-run',
  export: 'Every record, with original imported fields, to a JSON backup',
};

const KINDS = ['patent', 'trade mark', 'design'];
const STATUSES = ['drafting', 'filed', 'examination', 'accepted', 'registered', 'lapsed', 'abandoned', 'withdrawn'];
const POLICIES = ['we renew', 'client renews', 'agent renews', 'do not renew'];
const ACTIONS = ['filed', 'pct filed', 'first examination report', 'examination report', 'compliance report', 'acceptance advertised', 'registered', 'granted', 'other'];
const TABLES = ['staff', 'clients', 'cases', 'official_actions', 'deadlines', 'renewals', 'case_notes'];

// ---------------------------------------------------------------- the rules that set dates
// Each rule turns an official action into a docketed deadline. Sources: docs/compliance.md.
// months counts from the action's date, or from the priority date when from = 'priority'.
export const DEADLINE_RULES = [
  { code: 'AU-PAT-ACCEPT', kind: 'patent', country: 'AU', on: 'first examination report', deadline: 'put in order for acceptance', months: 12, statutory: true, extendable: false },
  { code: 'NZ-PAT-ACCEPT', kind: 'patent', country: 'NZ', on: 'first examination report', deadline: 'put in order for acceptance', months: 12, statutory: true, extendable: false },
  { code: 'NZ-PAT-RESPONSE', kind: 'patent', country: 'NZ', on: 'first examination report', deadline: 'respond to examination report', months: 6, statutory: true, extendable: true },
  { code: 'NZ-PAT-RESPONSE', kind: 'patent', country: 'NZ', on: 'examination report', deadline: 'respond to examination report', months: 3, statutory: true, extendable: true },
  { code: 'AU-TM-ACCEPT', kind: 'trade mark', country: 'AU', on: 'first examination report', deadline: 'put in order for acceptance', months: 15, statutory: true, extendable: true },
  { code: 'NZ-TM-ACCEPT', kind: 'trade mark', country: 'NZ', on: 'compliance report', deadline: 'put in order for acceptance', months: 12, statutory: true, extendable: true },
  { code: 'AU-TM-OPPOSITION', kind: 'trade mark', country: 'AU', on: 'acceptance advertised', deadline: 'opposition period ends', months: 2, statutory: false, extendable: false },
  { code: 'NZ-TM-OPPOSITION', kind: 'trade mark', country: 'NZ', on: 'acceptance advertised', deadline: 'opposition period ends', months: 3, statutory: false, extendable: false },
  { code: 'AU-PAT-OPPOSITION', kind: 'patent', country: 'AU', on: 'acceptance advertised', deadline: 'opposition period ends', months: 3, statutory: false, extendable: false },
  { code: 'NZ-PAT-OPPOSITION', kind: 'patent', country: 'NZ', on: 'acceptance advertised', deadline: 'opposition period ends', months: 3, statutory: false, extendable: false },
  { code: 'PARIS-PATENT', kind: 'patent', country: '*', on: 'filed', deadline: 'convention filing deadline', months: 12, statutory: true, extendable: false, firstFilingOnly: true },
  { code: 'PARIS-MARK-DESIGN', kind: 'trade mark', country: '*', on: 'filed', deadline: 'convention filing deadline', months: 6, statutory: true, extendable: false, firstFilingOnly: true },
  { code: 'PARIS-MARK-DESIGN', kind: 'design', country: '*', on: 'filed', deadline: 'convention filing deadline', months: 6, statutory: true, extendable: false, firstFilingOnly: true },
  { code: 'PCT-30', kind: 'patent', country: 'WO', on: 'pct filed', deadline: 'national phase entry', months: 30, from: 'priority', statutory: true, extendable: false },
  { code: 'PCT-31-AU', kind: 'patent', country: 'WO', on: 'pct filed', deadline: 'AU national phase entry', months: 31, from: 'priority', statutory: true, extendable: false },
];

// Renewals: when the first one falls, how often after, the last one, and the grace period.
// Counted from the filing date (or the earlier priority date for an NZ trade mark).
export const RENEWAL_RULES = {
  'AU trade mark': { first: 120, every: 120, last: null, grace: 6, term: () => '10 year renewal' },
  'NZ trade mark': { first: 120, every: 120, last: null, grace: 6, term: () => '10 year renewal', fromPriority: true },
  'AU patent': { first: 48, every: 12, last: 228, grace: 6, term: (m) => `year ${m / 12}` },
  'NZ patent': { first: 48, every: 12, last: 228, grace: 6, term: (m) => `year ${m / 12}` },
  'AU design': { first: 60, every: 60, last: 60, grace: 6, term: () => '5 year renewal' },
  'NZ design': { first: 60, every: 60, last: 120, grace: 6, term: (m) => `${m / 12} year renewal` },
};

// ---------------------------------------------------------------- input checks

const today = () => new Date().toISOString().slice(0, 10);
function required(o, k) {
  if (typeof o[k] !== 'string' || !o[k].trim()) throw Error(`--${k} is required`);
  return o[k].trim();
}
export function date(value, label = 'date', nullable = true) {
  if ((value === undefined || value === null || value === '') && nullable) return null;
  let s = String(value ?? '').trim();
  const au = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // AU and NZ write day first
  if (au) s = `${au[3]}-${au[2].padStart(2, '0')}-${au[1].padStart(2, '0')}`;
  const t = Date.parse(`${s}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== s) {
    throw Error(`${label} must be a real date (YYYY-MM-DD or DD/MM/YYYY), got "${value}"`);
  }
  return s;
}
export function amount(v, label = 'amount') {
  const s = String(v ?? '').replace(/[$,\s]/g, '');
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(s)) throw Error(`${label} must be a positive amount with at most two decimals`);
  return s;
}
function oneOf(v, choices, label) {
  if (!choices.includes(v)) throw Error(`${label} must be one of: ${choices.join(', ')}`);
  return v;
}
function intIn(v, lo, hi, label) {
  if (!/^\d+$/.test(String(v)) || Number(v) < lo || Number(v) > hi) throw Error(`${label} must be a whole number from ${lo} to ${hi}`);
  return Number(v);
}
function country(v, label = '--country') {
  const c = String(v ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) throw Error(`${label} must be a two-letter code (AU, NZ, WO for PCT, US, EP...)`);
  return c;
}
// Calendar months, clamped to the end of a short month (31 January + 1 month = 28 or 29 February).
export function addMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}
function args(argv) {
  const o = {}; const p = [];
  for (const a of argv) {
    if (!a.startsWith('--')) { p.push(a); continue; }
    const i = a.indexOf('=');
    const k = a.slice(2, i < 0 ? undefined : i);
    if (Object.hasOwn(o, k)) throw Error(`Repeated --${k}`);
    o[k] = i < 0 ? true : a.slice(i + 1);
  }
  return { o, p };
}

// ---------------------------------------------------------------- record matching

const LOOKUP = {
  staff: { label: 'name', key: 'code' },
  clients: { label: 'name', key: 'reference' },
  cases: { label: 'title', key: 'reference', also: 'application_no', join: true },
};
// Exact id or reference first; then id prefix, or part of the name (for cases, the title,
// the application number or the client's name). More than one hit lists them all.
export async function resolve(db, kind, search) {
  const spec = LOOKUP[kind];
  if (!spec) throw Error('Unknown record type');
  if (typeof search !== 'string' || !search.trim()) throw Error('A record reference is required');
  const s = search.trim();
  const exact = await db.query(`select * from ${kind} where id::text = $1 or lower(${spec.key}) = lower($1)${spec.also ? ` or (${spec.also} <> '' and lower(${spec.also}) = lower($1))` : ''}`, [s]);
  if (exact.length === 1) return exact[0];
  const client = spec.join ? ' or strpos(lower((select c.name from clients c where c.id = t.client_id)), lower($1)) > 0' : '';
  const rows = await db.query(
    `select t.* from ${kind} t where starts_with(t.id::text, lower($1)) or strpos(lower(t.${spec.label}), lower($1)) > 0${client} order by t.${spec.key}`, [s]);
  if (rows.length === 1) return rows[0];
  if (!rows.length) throw Error(`No ${kind} matches "${s}"`);
  throw Error(`"${s}" matches more than one:\n${rows.map((r) => `  ${r[spec.key]}  ${r[spec.label]}`).join('\n')}\nUse the reference.`);
}
// Deadlines and renewals have no reference of their own: match the id or id prefix, or the
// case reference when that case has exactly one open deadline or unpaid renewal.
async function resolveOpen(db, kind, search) {
  if (typeof search !== 'string' || !search.trim()) throw Error('A record reference is required');
  const s = search.trim();
  const view = kind === 'deadlines' ? 'docket' : 'renewal_book';
  const label = kind === 'deadlines' ? 'deadline' : 'term';
  const byId = await db.query(`select * from ${kind} where starts_with(id::text, lower($1))`, [s]);
  if (byId.length === 1) return byId[0];
  const rows = await db.query(`select v.id from ${view} v where lower(v.case_ref) = lower($1)`, [s]);
  if (rows.length === 1) return (await db.query(`select * from ${kind} where id = $1`, [rows[0].id]))[0];
  if (!rows.length) throw Error(`No open ${kind === 'deadlines' ? 'deadline' : 'renewal'} matches "${s}". Use the id from the docket or renewals list.`);
  const list = await db.query(`select id, case_ref, ${label}, due_on from ${view} where lower(case_ref) = lower($1) order by due_on`, [s]);
  throw Error(`${s} has more than one open ${kind === 'deadlines' ? 'deadline' : 'renewal'}:\n${list.map((r) => `  ${r.id.slice(0, 8)}  ${r[label]}  ${r.due_on}`).join('\n')}\nUse the id.`);
}

async function note(db, caseId, author, kind, text) {
  await db.query('insert into case_notes (case_id, author, kind, note) values ($1, $2, $3, $4)', [caseId, author, kind, text]);
}
async function transaction(db, fn, dry = false) {
  await db.exec('begin');
  try { const r = await fn(); await db.exec(dry ? 'rollback' : 'commit'); return r; } catch (e) { await db.exec('rollback'); throw e; }
}
async function insert(db, kind, data) {
  const keys = Object.keys(data);
  return (await db.query(`insert into ${kind} (${keys.join(', ')}) values (${keys.map((_, i) => `$${i + 1}`).join(', ')}) returning *`, Object.values(data)))[0];
}
function writeDraft(name, text) {
  const dir = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, 'drafts');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}-${randomUUID().slice(0, 8)}.md`);
  fs.writeFileSync(file, text, { flag: 'wx' });
  return file;
}

// ---------------------------------------------------------------- reads

const READS = {
  staff: (db) => db.query('select code, name, role, registration, active from staff order by active desc, role, code'),

  clients: (db) => db.query(`select c.reference, c.name, c.country, c.contact_name as contact,
      (select count(*)::int from case_status s join cases k on k.id = s.id where k.client_id = c.id) as live_cases,
      (select min(d.due_on) from docket d join cases k on k.id = d.case_id where k.client_id = c.id) as next_deadline,
      (select min(b.due_on) from renewal_book b join cases k on k.id = b.case_id where k.client_id = c.id and b.state <> 'lapsing on instructions') as next_renewal
    from clients c order by c.reference`),

  async cases(db, o) {
    const where = []; const vals = [];
    if (o.client) { vals.push((await resolve(db, 'clients', o.client)).id); where.push(`k.client_id = $${vals.length}`); }
    if (o.attorney) { vals.push((await resolve(db, 'staff', o.attorney)).id); where.push(`k.attorney_id = $${vals.length}`); }
    if (o.kind) { vals.push(oneOf(o.kind, KINDS, 'kind')); where.push(`k.kind = $${vals.length}`); }
    if (o.country) { vals.push(country(o.country)); where.push(`k.country = $${vals.length}`); }
    if (o.status) { vals.push(oneOf(o.status, STATUSES, 'status')); where.push(`k.status = $${vals.length}`); }
    return db.query(`select k.reference, c.name as client, k.kind, k.country, k.title, k.classes, k.status, s.code as attorney, k.application_no, k.filed_on,
        (select min(d.due_on) from deadlines d where d.case_id = k.id and d.closed_on is null) as next_deadline,
        (select min(r.due_on) from renewals r where r.case_id = k.id and r.paid_on is null) as next_renewal
      from cases k join clients c on c.id = k.client_id left join staff s on s.id = k.attorney_id
      ${where.length ? `where ${where.join(' and ')}` : ''} order by k.reference`, vals);
  },

  async case(db, o) {
    const k = await resolve(db, 'cases', required(o, 'case'));
    const one = (sql) => db.query(sql, [k.id]);
    return {
      case: (await one(`select k.reference, c.name as client, k.kind, k.country, k.title, k.classes, k.status, s.name as attorney, k.application_no, k.filed_on,
        k.priority_on, k.registration_no, k.registered_on, k.foreign_agent, k.client_reference, k.renewal_policy
        from cases k join clients c on c.id = k.client_id left join staff s on s.id = k.attorney_id where k.id = $1`))[0],
      open_deadlines: await one(`select substr(id::text, 1, 8) as id, deadline, due_on, days_left, statutory, extendable, rule, basis, docketed_by, verified_by
        from docket where case_id = $1 order by due_on`),
      renewals: await one(`select substr(r.id::text, 1, 8) as id, r.term, r.due_on, r.grace_ends_on, r.reminder_sent_on, r.instruction, r.paid_on, r.receipt
        from renewals r where r.case_id = $1 order by r.due_on`),
      official_actions: await one('select issued_on, kind, summary, recorded_by from official_actions where case_id = $1 order by issued_on desc'),
      closed_deadlines: await one('select kind, due_on, closed_on, how_closed, outcome from deadlines where case_id = $1 and closed_on is not null order by closed_on desc'),
      notes: await one('select created_at::date as on_date, author, kind, note from case_notes where case_id = $1 order by created_at desc limit 20'),
    };
  },

  async docket(db, o) {
    const vals = [intIn(o.days ?? '30', 0, 3650, '--days')];
    let who = '';
    if (o.attorney) { vals.push((await resolve(db, 'staff', o.attorney)).code); who = ` and attorney = $${vals.length}`; }
    return db.query(`select substr(id::text, 1, 8) as id, case_ref, client, attorney, country, case_kind as kind, deadline, due_on, days_left,
        case when statutory then 'yes' else 'watch' end as statutory, coalesce(verified_by, 'NOT CHECKED') as checked_by
      from docket where days_left <= $1::int${o.all ? '' : ' and statutory'}${who} order by due_on, case_ref`, vals);
  },

  async 'renewals-due'(db, o) {
    const vals = [intIn(o.days ?? '90', 0, 3650, '--days')];
    let who = '';
    if (o.client) { vals.push((await resolve(db, 'clients', o.client)).name); who = ` and client = $${vals.length}`; }
    return db.query(`select substr(id::text, 1, 8) as id, case_ref, client, country, case_kind as kind, title, classes, term, due_on, grace_ends_on, days_to_due,
        state, reminder_sent_on, instruction, official_fee, currency
      from renewal_book where (days_to_due <= $1::int or state in ('in grace','lapsed'))${who}
      order by array_position(array['lapsed','in grace','reminder due','awaiting instructions','instructed','lapsing on instructions','not due'], state), due_on`, vals);
  },

  workload: (db) => db.query(`select coalesce(s.code, '(none)') as attorney, s.name,
      count(*) filter (where d.statutory and d.days_left < 0)::int as overdue,
      count(*) filter (where d.statutory and d.days_left between 0 and 7)::int as this_week,
      count(*) filter (where d.statutory and d.days_left between 8 and 30)::int as next_30_days,
      count(*) filter (where d.statutory and d.verified_by is null)::int as unchecked,
      count(*) filter (where not d.statutory and d.days_left <= 30)::int as watch_dates,
      min(d.due_on) as next_due
    from docket d left join staff s on s.code = d.attorney group by 1, 2 order by overdue desc, this_week desc, 1`),

  async portfolio(db, o) {
    const c = await resolve(db, 'clients', required(o, 'client'));
    return db.query(`select k.reference, k.kind, k.country, k.title, k.classes, k.status, k.registration_no, k.registered_on,
        (select min(d.due_on) from deadlines d where d.case_id = k.id and d.closed_on is null) as next_deadline,
        (select min(r.due_on) from renewals r where r.case_id = k.id and r.paid_on is null) as next_renewal, k.renewal_policy
      from cases k where k.client_id = $1 order by k.title, k.kind, k.country`, [c.id]);
  },

  turnaround: (db) => db.query(`select kind, country, count(*)::int as cases,
      round(avg(registered_on - filed_on))::int as avg_days_filing_to_registration,
      min(registered_on - filed_on) as fastest, max(registered_on - filed_on) as slowest
    from cases where registered_on is not null and filed_on is not null group by 1, 2 order by 1, 2`),

  attention: (db) => db.query(`
    select 'deadline' as kind, case_ref as record, client, attorney,
      case when days_left < 0 then format('MISSED: %s was due %s', deadline, due_on) else format('%s due in %s days', deadline, days_left) end as why, days_left as days
      from docket where statutory and days_left <= 7
    union all select 'unchecked', case_ref, client, attorney, format('%s due %s has no second-person check', deadline, due_on), days_left
      from docket where statutory and verified_by is null and days_left > 7
    union all select 'renewal', case_ref, client, attorney, format('%s: %s due %s', state, term, due_on), days_to_due
      from renewal_book where state in ('lapsed','in grace') or (state in ('reminder due','awaiting instructions','instructed') and days_to_due <= 45)
    union all select 'nothing docketed', record, client, null, finding, null from compliance_findings where rule in ('CASE-NOTHING-DOCKETED','RENEWAL-NOT-DOCKETED')
    union all select 'quiet', reference, client, attorney,
      case when last_activity is null then format('%s, nothing on file', status) else format('%s, nothing on file for %s days', status, current_date - last_activity) end,
      -(current_date - coalesce(last_activity, filed_on))
      from case_status where status in ('filed','examination','accepted') and (last_activity is null or last_activity < current_date - 120)
    order by days nulls first, kind, record`),

  compliance: (db) => db.query('select rule, record, client, finding from compliance_findings order by severity, rule, record'),

  async notes(db, o) {
    const k = o.case ? await resolve(db, 'cases', o.case) : null;
    const limit = intIn(o.limit ?? '30', 1, 1000, '--limit');
    return db.query(`select n.created_at::date as on_date, k.reference, k.title, n.author, n.kind, n.note from case_notes n join cases k on k.id = n.case_id
      ${k ? 'where k.id = $2' : ''} order by n.created_at desc, n.id limit $1::int`, k ? [limit, k.id] : [limit]);
  },

  async 'weekly-review'(db) {
    return {
      'docket (next 14 days and missed)': await READS.docket(db, { days: '14' }),
      'renewals (next 60 days, in grace, lapsed)': await READS['renewals-due'](db, { days: '60' }),
      workload: await READS.workload(db),
      compliance: await READS.compliance(db),
    };
  },
};

// ---------------------------------------------------------------- dating engine

// Every deadline the rules give for this action on this case.
export function deadlinesFor(k, action, issuedOn) {
  const out = [];
  for (const r of DEADLINE_RULES) {
    if (r.on !== action || r.kind !== k.kind || (r.country !== '*' && r.country !== k.country)) continue;
    if (r.firstFilingOnly && k.priority_on) continue; // a case that claims priority is not the first filing
    const base = r.from === 'priority' ? (k.priority_on || k.filed_on) : issuedOn;
    if (!base) throw Error(`${k.reference} needs a ${r.from === 'priority' ? 'priority or filing' : ''} date before ${r.code} can be worked out`);
    out.push({ rule: r.code, kind: r.deadline, due_on: addMonths(base, r.months), statutory: r.statutory, extendable: r.extendable,
      basis: `${r.months} months from the ${r.from === 'priority' ? (k.priority_on ? 'priority date' : 'filing date') : action} (${base})` });
  }
  return out;
}

// The next renewal after a given date, or null when the right has run its full term.
export function nextRenewal(k, after) {
  const rule = RENEWAL_RULES[`${k.country} ${k.kind}`];
  if (!rule || !k.filed_on) return null;
  const base = rule.fromPriority && k.priority_on && k.priority_on < k.filed_on ? k.priority_on : k.filed_on;
  for (let m = rule.first; rule.last === null || m <= rule.last; m += rule.every) {
    const due = addMonths(base, m);
    if (due > after) return { term: rule.term(m), due_on: due, grace_ends_on: addMonths(due, rule.grace) };
    if (m > 1200) break;
  }
  return null;
}

async function docketRenewal(db, k, after, actor) {
  if (k.renewal_policy !== 'we renew') return null;
  const next = nextRenewal(k, after);
  if (!next) return null;
  const exists = await db.query('select 1 from renewals where case_id = $1 and due_on = $2', [k.id, next.due_on]);
  if (exists.length) return null;
  const r = await insert(db, 'renewals', { case_id: k.id, ...next, currency: k.country === 'AU' ? 'AUD' : 'NZD' });
  await note(db, k.id, actor, 'renewal', `${r.term} docketed for ${r.due_on} (grace to ${r.grace_ends_on})`);
  return r;
}

// ---------------------------------------------------------------- writes

const CASE_FIELDS = { title: 'title', classes: 'classes', 'application-no': 'application_no', 'registration-no': 'registration_no', agent: 'foreign_agent', 'client-ref': 'client_reference', policy: 'renewal_policy', status: 'status' };
function caseFields(o) {
  const data = {};
  for (const [flag, col] of Object.entries(CASE_FIELDS)) {
    if (!Object.hasOwn(o, flag)) continue;
    let v = o[flag];
    if (typeof v !== 'string') throw Error(`--${flag} needs a value`);
    if (flag === 'policy') v = oneOf(v, POLICIES, 'policy');
    if (flag === 'status') v = oneOf(v, STATUSES, 'status');
    data[col] = v;
  }
  return data;
}

const WRITES = {
  async 'add-staff'(db, o) {
    const code = required(o, 'code').toUpperCase();
    if (!/^[A-Z]{2,4}$/.test(code)) throw Error('--code is two to four letters, usually initials');
    return insert(db, 'staff', { code, name: required(o, 'name'), role: oneOf(o.role ?? 'attorney', ['attorney', 'paralegal', 'records'], 'role'), registration: o.registration ?? '' });
  },

  'add-client': (db, o) => insert(db, 'clients', {
    reference: required(o, 'reference'), name: required(o, 'name'), contact_name: o.contact ?? '', email: o.email ?? '', country: country(o.country ?? 'NZ'),
  }),

  async 'add-case'(db, o, actor) {
    const c = await resolve(db, 'clients', required(o, 'client'));
    const attorney = o.attorney ? await resolve(db, 'staff', o.attorney) : null;
    const filed = date(o.filed, '--filed');
    const k = await insert(db, 'cases', {
      reference: required(o, 'reference'), client_id: c.id, kind: oneOf(required(o, 'kind'), KINDS, 'kind'), country: country(required(o, 'country')),
      ...caseFields({ ...o, title: required(o, 'title') }), status: o.status ? oneOf(o.status, STATUSES, 'status') : (filed ? 'filed' : 'drafting'),
      filed_on: filed, priority_on: date(o.priority, '--priority'), attorney_id: attorney?.id ?? null,
    });
    if (k.priority_on && k.filed_on && k.priority_on > k.filed_on) throw Error('--priority cannot be after --filed');
    await note(db, k.id, actor, 'note', `Case opened for ${c.name}`);
    return k;
  },

  async 'update-case'(db, o, actor) {
    const k = await resolve(db, 'cases', required(o, 'case'));
    const data = caseFields(o);
    if (o.attorney) data.attorney_id = (await resolve(db, 'staff', o.attorney)).id;
    if (!Object.keys(data).length) throw Error('Nothing to change: pass at least one field');
    const keys = Object.keys(data);
    const r = (await db.query(`update cases set ${keys.map((x, i) => `${x} = $${i + 1}`).join(', ')} where id = $${keys.length + 1} returning *`, [...Object.values(data), k.id]))[0];
    await note(db, k.id, actor, 'change', `Updated ${keys.join(', ')}`);
    return r;
  },

  // The heart of docketing: what the office sent becomes dated, checked work.
  async 'record-action'(db, o, actor) {
    const k = await resolve(db, 'cases', required(o, 'case'));
    const kind = oneOf(required(o, 'kind'), ACTIONS, 'kind');
    const issued = date(required(o, 'date'), '--date', false);
    if (issued > today()) throw Error('An official action cannot be dated in the future');
    if (kind === 'first examination report' && (await db.query("select 1 from official_actions where case_id = $1 and kind = 'first examination report'", [k.id])).length) {
      throw Error(`${k.reference} already has a first examination report. Record this one as "examination report".`);
    }
    const a = await insert(db, 'official_actions', { case_id: k.id, kind, issued_on: issued, summary: o.summary ?? '', recorded_by: actor });
    const status = { filed: 'filed', 'pct filed': 'filed', 'first examination report': 'examination', 'compliance report': 'examination', 'acceptance advertised': 'accepted', registered: 'registered', granted: 'registered' }[kind];
    const patch = { status: status ?? k.status };
    if (kind === 'filed' || kind === 'pct filed') patch.filed_on = k.filed_on ?? issued;
    if (kind === 'registered' || kind === 'granted') patch.registered_on = issued;
    const keys = Object.keys(patch);
    const updated = (await db.query(`update cases set ${keys.map((x, i) => `${x} = $${i + 1}`).join(', ')} where id = $${keys.length + 1} returning *`, [...Object.values(patch), k.id]))[0];
    const docketed = [];
    for (const d of deadlinesFor(updated, kind, issued)) {
      docketed.push(await insert(db, 'deadlines', { case_id: k.id, action_id: a.id, ...d, docketed_by: actor }));
    }
    // The opposition period closing means the right is through; the watch date is done.
    if (kind === 'registered' || kind === 'granted') {
      await db.query(`update deadlines set closed_on = $1, closed_by = $2, how_closed = 'superseded', outcome = $3 where case_id = $4 and closed_on is null and not statutory`,
        [issued, actor, `Closed by ${kind}`, k.id]);
    }
    // Patents pay renewals from the fourth anniversary while still pending; marks and designs once registered.
    // A right recorded late still gets the renewal that is in its grace period now.
    let renewal = null;
    if (kind === 'registered' || kind === 'granted' || (kind === 'filed' && updated.kind === 'patent')) {
      renewal = await docketRenewal(db, updated, [issued, addMonths(today(), -6)].sort().pop(), actor);
    }
    await note(db, k.id, actor, 'office', `${kind} dated ${issued} recorded${docketed.length ? `; docketed ${docketed.map((d) => `${d.kind} ${d.due_on}`).join(', ')}` : ''}`);
    return {
      case: k.reference, action: kind, status: updated.status, dry_run: Boolean(o['dry-run']),
      docketed: docketed.map((d) => ({ id: d.id.slice(0, 8), deadline: d.kind, due_on: d.due_on, statutory: d.statutory, rule: d.rule, basis: d.basis })),
      renewal: renewal ? `${renewal.term} due ${renewal.due_on}` : 'none',
      next: docketed.some((d) => d.statutory) ? 'Each statutory date needs a second person to check it: verify --deadline=<id>.' : 'No statutory date from this action. Add one by hand if the report sets its own.',
    };
  },

  async 'add-deadline'(db, o, actor) {
    const k = await resolve(db, 'cases', required(o, 'case'));
    const d = await insert(db, 'deadlines', {
      case_id: k.id, kind: required(o, 'kind'), due_on: date(required(o, 'due'), '--due', false), statutory: !o['non-statutory'], extendable: Boolean(o.extendable),
      basis: o.basis ?? 'Entered by hand', docketed_by: actor,
    });
    await note(db, k.id, actor, 'docket', `Docketed ${d.kind} for ${d.due_on}`);
    return d;
  },

  async verify(db, o, actor) {
    const d = await resolveOpen(db, 'deadlines', required(o, 'deadline'));
    if (d.closed_on) throw Error('That deadline is closed');
    if (d.verified_by) throw Error(`Already checked by ${d.verified_by} on ${d.verified_on}`);
    if (d.docketed_by.toLowerCase() === actor.toLowerCase()) throw Error(`${actor} docketed this date. A different person checks it.`);
    const r = (await db.query('update deadlines set verified_by = $1, verified_on = $2 where id = $3 returning *', [actor, today(), d.id]))[0];
    await note(db, d.case_id, actor, 'docket', `Checked ${d.kind} due ${d.due_on} against the source document`);
    return r;
  },

  async close(db, o, actor) {
    const d = await resolveOpen(db, 'deadlines', required(o, 'deadline'));
    if (d.closed_on) throw Error(`Closed on ${d.closed_on}`);
    const how = { done: 'done', superseded: 'superseded', 'not-pursued': 'not pursued on instructions' }[o.how ?? 'done'];
    if (!how) throw Error('--how must be one of: done, superseded, not-pursued');
    const on = date(o.date, '--date') ?? today();
    if (on > today()) throw Error('A deadline cannot be closed in the future');
    const r = (await db.query('update deadlines set closed_on = $1, closed_by = $2, how_closed = $3, outcome = $4 where id = $5 returning *', [on, actor, how, required(o, 'outcome'), d.id]))[0];
    await note(db, d.case_id, actor, 'docket', `Closed ${d.kind} (${how}): ${r.outcome}${on > d.due_on && d.statutory && how === 'done' ? `. Closed ${on}, after the due date ${d.due_on}: check the office accepted it.` : ''}`);
    return r;
  },

  async extend(db, o, actor) {
    const d = await resolveOpen(db, 'deadlines', required(o, 'deadline'));
    if (d.closed_on) throw Error('That deadline is closed');
    if (!d.extendable) throw Error(`${d.kind} (${d.rule || 'by hand'}) cannot be extended. See docs/compliance.md.`);
    const to = date(required(o, 'to'), '--to', false);
    if (to <= d.due_on) throw Error('--to must be after the current due date');
    const r = (await db.query(`update deadlines set extended_from = coalesce(extended_from, due_on), due_on = $1, extensions = extensions + 1,
      verified_by = null, verified_on = null where id = $2 returning *`, [to, d.id]))[0];
    await note(db, d.case_id, actor, 'docket', `Extended ${d.kind} from ${d.due_on} to ${to}: ${required(o, 'reason')}. Needs a fresh check.`);
    return r;
  },

  async 'mark-reminded'(db, o, actor) {
    const r = await resolveOpen(db, 'renewals', required(o, 'renewal'));
    if (r.paid_on) throw Error('That renewal is paid');
    const on = date(o.date, '--date') ?? today();
    const x = (await db.query('update renewals set reminder_sent_on = $1 where id = $2 returning *', [on, r.id]))[0];
    await note(db, r.case_id, actor, 'renewal', `Renewal reminder for ${r.term} due ${r.due_on} sent ${on}`);
    return x;
  },

  async instruct(db, o, actor) {
    const r = await resolveOpen(db, 'renewals', required(o, 'renewal'));
    if (r.paid_on) throw Error('That renewal is paid');
    const instruction = { renew: 'renew', 'let-lapse': 'let lapse' }[required(o, 'instruction')];
    if (!instruction) throw Error('--instruction must be renew or let-lapse');
    const on = date(o.date, '--date') ?? today();
    const x = (await db.query('update renewals set instruction = $1, instructed_on = $2, instructed_by = $3 where id = $4 returning *', [instruction, on, required(o, 'by'), r.id]))[0];
    await note(db, r.case_id, actor, 'renewal', `${x.instructed_by} instructed: ${instruction} (${r.term} due ${r.due_on})`);
    return x;
  },

  async 'docket-renewal'(db, o, actor) {
    const k = await resolve(db, 'cases', required(o, 'case'));
    const open = await db.query('select term, due_on from renewals where case_id = $1 and paid_on is null', [k.id]);
    if (open.length) throw Error(`${k.reference} already has ${open[0].term} due ${open[0].due_on} on file`);
    const rule = RENEWAL_RULES[`${k.country} ${k.kind}`];
    let next;
    if (o.due) {
      const due = date(o.due, '--due', false);
      next = { term: o.term ?? 'renewal', due_on: due, grace_ends_on: addMonths(due, rule?.grace ?? 6) };
    } else {
      if (!rule) throw Error(`No renewal rule for ${k.country} ${k.kind}. Give --due (and --term) from the office record.`);
      next = nextRenewal(k, addMonths(today(), -(rule.grace)));
      if (!next) throw Error(`${k.reference} has run its full term: nothing left to renew`);
    }
    const r = await insert(db, 'renewals', { case_id: k.id, ...next, currency: k.country === 'AU' ? 'AUD' : 'NZD' });
    await note(db, k.id, actor, 'renewal', `${r.term} docketed for ${r.due_on} (grace to ${r.grace_ends_on})`);
    return r;
  },

  async 'pay-renewal'(db, o, actor) {
    const r = await resolveOpen(db, 'renewals', required(o, 'renewal'));
    if (r.paid_on) throw Error(`Paid on ${r.paid_on}`);
    const on = date(o.date, '--date') ?? today();
    if (on > today()) throw Error('A payment cannot be dated in the future');
    if (on > r.grace_ends_on) throw Error(`Grace ended ${r.grace_ends_on}. The office will not take this fee as a renewal; restoration is a separate application.`);
    if (r.instruction === 'let lapse') throw Error('The client said let it lapse. Record a new instruction first.');
    const x = (await db.query(`update renewals set paid_on = $1, receipt = $2, official_fee = coalesce($3, official_fee),
      instruction = coalesce(instruction, 'renew'), instructed_on = coalesce(instructed_on, $1) where id = $4 returning *`,
    [on, required(o, 'receipt'), o.fee ? amount(o.fee, '--fee') : null, r.id]))[0];
    const k = (await db.query('select * from cases where id = $1', [r.case_id]))[0];
    await note(db, k.id, actor, 'renewal', `${r.term} paid ${on}, receipt ${x.receipt}${on > r.due_on ? ' (in grace, late fee applied)' : ''}`);
    const next = await docketRenewal(db, k, r.due_on, actor);
    return { ...x, next_renewal: next ? `${next.term} due ${next.due_on}` : 'none: the right has run its full term or is renewed elsewhere' };
  },

  async log(db, o, actor) {
    const k = await resolve(db, 'cases', required(o, 'case'));
    await note(db, k.id, actor, oneOf(o.kind ?? 'note', ['note', 'call', 'email', 'meeting'], 'kind'), required(o, 'note'));
    return { case: k.reference, recorded: true };
  },
};

// ---------------------------------------------------------------- drafts (never sent)

async function draftRenewalReminder(db, o) {
  const c = await resolve(db, 'clients', required(o, 'client'));
  const days = intIn(o.days ?? '120', 1, 730, '--days');
  const rows = await db.query(`select b.*, k.registration_no from renewal_book b join cases k on k.id = b.case_id
    where k.client_id = $1 and b.state in ('reminder due','awaiting instructions','in grace','not due') and b.days_to_due <= $2::int order by b.due_on`, [c.id, days]);
  if (!rows.length) throw Error(`${c.name} has no renewals due in the next ${days} days`);
  const by = addMonths(rows[0].due_on, -1);
  const first = c.contact_name.replace(/^(dr|mr|mrs|ms|miss|prof)\.?\s+/i, '').split(' ')[0] || 'team';
  const lines = rows.map((r) => `| ${r.title} | ${r.case_kind} | ${r.country} | ${r.registration_no || r.case_ref} | ${r.classes || ''} | ${r.term} | ${r.due_on} | ${r.state === 'in grace' ? `In grace, late fees apply. Last day ${r.grace_ends_on}` : ''} |`).join('\n');
  const text = `# DRAFT: renewal reminder for ${c.name} (${c.reference})

Draft only. Nothing has been sent. Add the official and service fees before it goes. Once sent, record it: mark-reminded --renewal=<id> for each row.

To: ${c.email || '[email not on file]'}
Subject: Renewals due: ${rows.map((r) => r.title).filter((v, i, a) => a.indexOf(v) === i).join(', ')}

Kia ora ${first},

The rights below are due for renewal. If they are not renewed, they lapse and the protection ends.

| Right | Type | Country | Number | Classes | Renewal | Due | Note |
|---|---|---|---|---|---|---|---|
${lines}

Please reply with one of these for each right:

- **Renew**: we pay the official fee and report back with the receipt.
- **Let lapse**: we take no action and close our file on it.

If a mark is no longer in use, or the goods have changed, tell us and we will advise whether to renew all of the classes.

We need your instructions ${by < today() ? 'as soon as you can' : `by ${by}`}.

[Attorney name]
`;
  return { file: writeDraft(`renewal-reminder-${c.reference}`, text), client: c.reference, rights: rows.length, renewal_ids: rows.map((r) => r.id.slice(0, 8)).join(', ') };
}

async function draftReportingLetter(db, o) {
  const k = await resolve(db, 'cases', required(o, 'case'));
  const c = (await db.query('select * from clients where id = $1', [k.client_id]))[0];
  const a = (await db.query('select * from official_actions where case_id = $1 order by issued_on desc, created_at desc limit 1', [k.id]))[0];
  if (!a) throw Error(`${k.reference} has no official action on file to report`);
  const due = await db.query('select kind, due_on, statutory, extendable, basis from deadlines where action_id = $1 and closed_on is null order by due_on', [a.id]);
  const attorney = k.attorney_id ? (await db.query('select name from staff where id = $1', [k.attorney_id]))[0].name : '[Attorney name]';
  const right = `${k.country} ${k.kind} ${k.application_no || k.reference}: ${k.title}${k.classes ? ` (classes ${k.classes})` : ''}`;
  const text = `# DRAFT: reporting letter for ${c.name}, ${k.reference}

Draft only. Nothing has been sent. Read the official document and add the advice before it goes.

To: ${c.email || '[email not on file]'}
Subject: ${right}: ${a.kind} ${k.client_reference ? `(your ref ${k.client_reference})` : ''}

Kia ora ${c.contact_name.replace(/^(dr|mr|mrs|ms|miss|prof)\.?\s+/i, '').split(' ')[0] || 'team'},

The ${k.country === 'NZ' ? 'Intellectual Property Office of New Zealand' : k.country === 'AU' ? 'IP Australia' : 'office'} issued a ${a.kind} on ${a.issued_on}.

**What it says:** ${a.summary || '[summary of the official action]'}

**Our advice:** [what we recommend, and why]

${due.length ? `**The dates that matter:**\n\n${due.map((d) => `- ${d.kind}: **${d.due_on}**${d.statutory ? (d.extendable ? ' (extensions possible, at a cost)' : ' (cannot be extended: the right is lost if missed)') : ' (for your information)'}`).join('\n')}\n` : ''}
**What we need from you:** [instructions, evidence or documents, and the date we need them by]

${attorney}
`;
  return { file: writeDraft(`reporting-${k.reference}`, text), case: k.reference, action: a.kind, dates: due.length };
}

// ---------------------------------------------------------------- import from Inprotech

// Inprotech's case search and due date list export to Excel or CSV with the columns the
// firm has set up on the search. These are the usual headings; --map=columns.json overrides any.
export const INPROTECH_FIELDS = {
  cases: {
    source_id: ['Case Ref', 'IRN', 'Case Reference', 'Our Ref'],
    client: ['Instructor', 'Client', 'Owner', 'Instructor Name'],
    kind: ['Property Type', 'Case Type', 'Property'],
    country: ['Country', 'Country Code', 'Jurisdiction'],
    title: ['Title', 'Mark', 'Short Title', 'Trade Mark'],
    classes: ['Classes', 'Local Classes', 'Class'],
    application_no: ['Application No', 'Application Number', 'Official No'],
    filed_on: ['Application Date', 'Filing Date', 'Filed'],
    priority_on: ['Earliest Priority Date', 'Priority Date'],
    registration_no: ['Registration No', 'Registration Number', 'Patent No'],
    registered_on: ['Registration Date', 'Grant Date'],
    status: ['Status', 'Case Status'],
    attorney: ['Staff Member', 'Responsible Staff', 'Signatory', 'Attorney'],
    renewal_on: ['Next Renewal Date', 'Renewal Date', 'Expiry Date'],
    client_reference: ['Your Ref', 'Client Ref', 'Instructor Ref'],
  },
  'due-dates': {
    source_id: ['Case Ref', 'IRN', 'Case Reference'],
    kind: ['Event Description', 'Due Date Description', 'Event', 'Action'],
    due_on: ['Due Date', 'Due'],
    responsible: ['Responsible', 'Staff Member', 'Due Date Responsibility'],
  },
};
const KIND_MAP = { patent: 'patent', patents: 'patent', 'patent application': 'patent', 'trade mark': 'trade mark', 'trade marks': 'trade mark', trademark: 'trade mark', tm: 'trade mark', design: 'design', designs: 'design', 'registered design': 'design' };
const STATUS_MAP = { pending: 'filed', filed: 'filed', 'application filed': 'filed', 'under examination': 'examination', examination: 'examination', 'examination requested': 'examination', accepted: 'accepted', advertised: 'accepted', registered: 'registered', granted: 'registered', 'in force': 'registered', lapsed: 'lapsed', expired: 'lapsed', abandoned: 'abandoned', withdrawn: 'withdrawn', dead: 'abandoned', drafting: 'drafting' };

async function importInprotech(db, o, actor) {
  const report = oneOf(o.report ?? 'cases', ['cases', 'due-dates'], '--report');
  const fields = INPROTECH_FIELDS[report];
  const rows = parseCsv(fs.readFileSync(required(o, 'file'), 'utf8'));
  if (!rows.length) throw Error('The CSV has no rows');
  let map = {};
  if (o.map) {
    map = JSON.parse(fs.readFileSync(required(o, 'map'), 'utf8'));
    for (const [k, v] of Object.entries(map)) if (!(k in fields) || typeof v !== 'string' || !v.trim()) throw Error(`Unknown or empty map field: ${k}`);
    for (const col of Object.values(map)) if (!Object.keys(rows[0]).some((h) => h.toLowerCase() === col.toLowerCase())) throw Error(`Mapped column not in the file: ${col}`);
  }
  const read = (row, k) => String(map[k] ? pick(row, map[k]) : pick(row, ...fields[k])).trim();
  if (report === 'due-dates') return importDueDates(db, rows, read, o, actor);

  const seen = new Set();
  const input = rows.map((row, i) => {
    const line = `Row ${i + 2}`;
    const source_id = read(row, 'source_id'); const title = read(row, 'title'); const client = read(row, 'client');
    if (!source_id || !title || !client) throw Error(`${line}: a case reference, a title and a client are required. Map your headings with --map.`);
    if (seen.has(source_id.toLowerCase())) throw Error(`${line}: case ${source_id} appears twice`);
    seen.add(source_id.toLowerCase());
    const kind = KIND_MAP[read(row, 'kind').toLowerCase()];
    if (!kind) throw Error(`${line}: property type "${read(row, 'kind')}" is not one this import knows (patent, trade mark, design)`);
    const rawStatus = read(row, 'status').toLowerCase();
    const status = rawStatus ? STATUS_MAP[rawStatus] : 'filed';
    if (!status) throw Error(`${line}: status "${read(row, 'status')}" is not one this import knows. Map it in a copy of the file first.`);
    const sorted = Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b)));
    const data = {
      source_id, reference: source_id, kind, country: country(read(row, 'country') || 'NZ', `${line} country`), title, classes: read(row, 'classes'),
      application_no: read(row, 'application_no'), filed_on: date(read(row, 'filed_on'), `${line} filing date`), priority_on: date(read(row, 'priority_on'), `${line} priority date`),
      registration_no: read(row, 'registration_no'), registered_on: date(read(row, 'registered_on'), `${line} registration date`), status,
      client_reference: read(row, 'client_reference'), source_row: row,
    };
    if (data.status === 'registered' && !data.registered_on) throw Error(`${line}: ${source_id} is registered but has no registration date`);
    if (data.status !== 'drafting' && !data.filed_on) throw Error(`${line}: ${source_id} has no filing date`);
    data.source_hash = createHash('sha256').update(JSON.stringify({ ...data, source_row: sorted })).digest('hex');
    return { data, client, attorney: read(row, 'attorney'), renewal_on: date(read(row, 'renewal_on'), `${line} renewal date`) };
  });
  return transaction(db, async () => {
    let added = 0; let unchanged = 0; let renewals = 0; const clientsAdded = []; const staffAdded = [];
    for (const { data, client, attorney, renewal_on } of input) {
      const old = (await db.query('select source_hash from cases where source_id = $1', [data.source_id]))[0];
      if (old) {
        if (old.source_hash !== data.source_hash) throw Error(`Case ${data.source_id} changed in Inprotech since the last import. Reconcile it by hand before importing again.`);
        unchanged++; continue;
      }
      let c = (await db.query('select * from clients where lower(name) = lower($1)', [client]))[0];
      if (!c) {
        let ref = `IP-${String((await db.query('select count(*)::int as n from clients'))[0].n + 1).padStart(3, '0')}`;
        while ((await db.query('select 1 from clients where lower(reference) = lower($1)', [ref])).length) ref += 'X';
        c = await insert(db, 'clients', { reference: ref, name: client, country: data.country === 'AU' ? 'AU' : 'NZ' });
        clientsAdded.push(`${ref} ${client}`);
      }
      let attorneyId = null;
      if (attorney) {
        const hit = await db.query('select id from staff where lower(name) = lower($1) or lower(code) = lower($1)', [attorney]);
        if (hit.length) attorneyId = hit[0].id;
        else {
          const code = attorney.split(/\s+/).map((w) => w[0]).join('').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4).padEnd(2, 'X');
          if ((await db.query('select 1 from staff where code = $1', [code])).length) throw Error(`Staff member "${attorney}" is new but the code ${code} is taken. Add them first with add-staff.`);
          attorneyId = (await insert(db, 'staff', { code, name: attorney })).id;
          staffAdded.push(`${code} ${attorney}`);
        }
      }
      const k = await insert(db, 'cases', { ...data, client_id: c.id, attorney_id: attorneyId, renewal_policy: ['AU', 'NZ'].includes(data.country) ? 'we renew' : 'agent renews' });
      await note(db, k.id, actor, 'import', 'Imported from the Inprotech case list. Original columns kept on the record.');
      if (renewal_on && k.status === 'registered' && k.renewal_policy === 'we renew') {
        const rule = RENEWAL_RULES[`${k.country} ${k.kind}`];
        const ours = nextRenewal(k, addMonths(renewal_on, -1));
        await insert(db, 'renewals', { case_id: k.id, term: ours?.due_on === renewal_on ? ours.term : 'renewal', due_on: renewal_on,
          grace_ends_on: addMonths(renewal_on, rule?.grace ?? 6), currency: k.country === 'AU' ? 'AUD' : 'NZD' });
        renewals++;
      }
      added++;
    }
    return { report: 'cases', added, unchanged, renewals_docketed: renewals, clients_added: clientsAdded.join(', ') || 'none', staff_added: staffAdded.join(', ') || 'none',
      dry_run: Boolean(o['dry-run']), next: 'Import the due date list next (--report=due-dates), then run compliance. See docs/replace-inprotech.md.' };
  }, Boolean(o['dry-run']));
}

async function importDueDates(db, rows, read, o, actor) {
  const input = rows.map((row, i) => {
    const line = `Row ${i + 2}`;
    const source_id = read(row, 'source_id'); const kind = read(row, 'kind');
    if (!source_id || !kind) throw Error(`${line}: a case reference and an event description are required. Map your headings with --map.`);
    return { source_id, kind, due_on: date(read(row, 'due_on'), `${line} due date`, false), responsible: read(row, 'responsible'), line };
  });
  return transaction(db, async () => {
    let added = 0; let unchanged = 0; let renewals = 0;
    for (const d of input) {
      const k = (await db.query('select * from cases where lower(source_id) = lower($1) or lower(reference) = lower($1)', [d.source_id]))[0];
      if (!k) throw Error(`${d.line}: case ${d.source_id} is not here. Import the case list first.`);
      if (/renewal|annuity|maintenance/i.test(d.kind)) {
        if ((await db.query('select 1 from renewals where case_id = $1 and due_on = $2', [k.id, d.due_on])).length) { unchanged++; continue; }
        await insert(db, 'renewals', { case_id: k.id, term: d.kind, due_on: d.due_on, grace_ends_on: addMonths(d.due_on, RENEWAL_RULES[`${k.country} ${k.kind}`]?.grace ?? 6), currency: k.country === 'AU' ? 'AUD' : 'NZD' });
        renewals++; continue;
      }
      if ((await db.query('select 1 from deadlines where case_id = $1 and lower(kind) = lower($2) and due_on = $3', [k.id, d.kind, d.due_on])).length) { unchanged++; continue; }
      await insert(db, 'deadlines', { case_id: k.id, kind: d.kind, due_on: d.due_on, statutory: true, extendable: false, basis: `Imported from the Inprotech due date list${d.responsible ? `, responsible ${d.responsible}` : ''}`, docketed_by: actor });
      added++;
    }
    return { report: 'due-dates', deadlines_added: added, renewals_added: renewals, unchanged, dry_run: Boolean(o['dry-run']),
      next: 'Every imported deadline is statutory and unchecked until a second person verifies it against the file. Run docket, then verify.' };
  }, Boolean(o['dry-run']));
}

// ---------------------------------------------------------------- dispatch

const OPTIONS = {
  staff: [], clients: [], cases: ['client', 'attorney', 'kind', 'country', 'status'], case: ['case'], docket: ['days', 'attorney', 'all'],
  'renewals-due': ['days', 'client'], workload: [], portfolio: ['client'], turnaround: [], attention: [], compliance: [], 'weekly-review': [], notes: ['case', 'limit'],
  'add-staff': ['code', 'name', 'role', 'registration'], 'add-client': ['reference', 'name', 'contact', 'email', 'country'],
  'add-case': ['reference', 'client', 'kind', 'country', 'title', 'classes', 'application-no', 'filed', 'priority', 'attorney', 'agent', 'client-ref', 'policy', 'status'],
  'update-case': ['case', 'title', 'classes', 'application-no', 'registration-no', 'attorney', 'agent', 'client-ref', 'policy', 'status'],
  'record-action': ['case', 'kind', 'date', 'summary', 'dry-run'], 'add-deadline': ['case', 'kind', 'due', 'non-statutory', 'extendable', 'basis'],
  verify: ['deadline'], close: ['deadline', 'outcome', 'how', 'date'], extend: ['deadline', 'to', 'reason'],
  'docket-renewal': ['case', 'due', 'term'], 'mark-reminded': ['renewal', 'date'], instruct: ['renewal', 'instruction', 'by', 'date'], 'pay-renewal': ['renewal', 'receipt', 'fee', 'date'],
  log: ['case', 'note', 'kind'], 'draft-renewal-reminder': ['client', 'days'], 'draft-reporting-letter': ['case'],
  import: ['file', 'map', 'dry-run', 'report'], export: [],
};
const FLAGS = ['json', 'dry-run', 'all', 'non-statutory', 'extendable'];

export async function run(db, argv) {
  const { o, p } = args(argv);
  const command = p[0] || 'help';
  if (!(command in commands)) throw Error(`Unknown command "${command}". Run help.`);
  if (command === 'help') return Object.entries(commands).map(([name, usage]) => ({ command: name, usage }));
  const allowed = [...OPTIONS[command], 'json', ...(command in WRITES || command === 'import' ? ['actor'] : [])];
  for (const k of Object.keys(o)) if (!allowed.includes(k)) throw Error(`Unknown option --${k} for ${command}`);
  for (const k of FLAGS) if (Object.hasOwn(o, k) && o[k] !== true) throw Error(`--${k} takes no value`);
  if (p.length > (command === 'import' ? 2 : 1)) throw Error('Unexpected extra argument');

  if (command in READS) return READS[command](db, o);
  if (command === 'draft-renewal-reminder') return draftRenewalReminder(db, o);
  if (command === 'draft-reporting-letter') return draftReportingLetter(db, o);
  if (command === 'export') {
    const backup = { format: 'ip-docketing-for-claude-code/v1', exported_at: new Date().toISOString(), records: {} };
    for (const t of TABLES) backup.records[t] = await db.query(`select * from ${t} order by id`);
    const dir = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, 'exports');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `ip-docketing-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}.json`);
    fs.writeFileSync(file, JSON.stringify(backup, null, 2) + '\n', { flag: 'wx' });
    return { file, cases: backup.records.cases.length, deadlines: backup.records.deadlines.length, renewals: backup.records.renewals.length };
  }
  const actor = required(o, 'actor');
  if (command === 'import') {
    if (p[1] !== 'inprotech') throw Error('Supported import: inprotech');
    return importInprotech(db, o, actor);
  }
  if (command === 'record-action') return transaction(db, () => WRITES[command](db, o, actor), Boolean(o['dry-run']));
  return transaction(db, () => WRITES[command](db, o, actor));
}

// ---------------------------------------------------------------- output

const HIDE = new Set(['client_id', 'attorney_id', 'case_id', 'action_id', 'source_row', 'source_hash', 'created_at', 'updated_at']);
export function human(result) {
  if (Array.isArray(result)) {
    if (!result.length) return '  (none)';
    const cols = Object.keys(result[0]).filter((k) => !HIDE.has(k));
    return table(result, cols.map((key) => ({ key, label: key, width: ['finding', 'why', 'note', 'usage', 'basis'].includes(key) ? 90 : 60, format: (v) => (v && typeof v === 'object' ? JSON.stringify(v) : v === true ? 'yes' : v === false ? 'no' : String(v ?? '')) })));
  }
  if (result && typeof result === 'object') {
    return Object.entries(result).map(([k, v]) => (v && typeof v === 'object' ? `${k}\n${'='.repeat(k.length)}\n${human(Array.isArray(v) ? v : [v])}` : `${k}: ${v ?? ''}`)).join('\n\n');
  }
  return String(result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let db;
  try {
    db = await getDb();
    const result = await run(db, process.argv.slice(2));
    console.log(process.argv.includes('--json') ? JSON.stringify(result, null, 2) : human(result));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    if (db) await db.close();
  }
}

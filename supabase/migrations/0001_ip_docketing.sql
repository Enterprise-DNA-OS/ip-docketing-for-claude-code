-- IP Docketing for Claude Code: the records a patent and trade mark practice runs on.
-- Attorneys and staff, clients, cases (patents, trade marks, designs), official actions
-- received from the IP offices, the docket of deadlines those actions start, renewals with
-- their reminders and instructions, and case notes. Plain Postgres; runs on PGlite too.

create function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table staff (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z]{2,4}$'),
  name text not null check (btrim(name) <> ''),
  role text not null default 'attorney' check (role in ('attorney','paralegal','records')),
  registration text not null default '',            -- Trans-Tasman IP Attorneys Board registration
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  reference text not null check (btrim(reference) <> ''),
  name text not null check (btrim(name) <> ''),
  contact_name text not null default '',
  email text not null default '',
  country text not null default 'NZ' check (country ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index clients_reference_ci on clients(lower(reference));

-- One right in one country. country is the office: AU, NZ, WO for a PCT application, or any
-- other two-letter code for a case a foreign agent files for us.
create table cases (
  id uuid primary key default gen_random_uuid(),
  reference text not null check (btrim(reference) <> ''),
  client_id uuid not null references clients(id),
  kind text not null check (kind in ('patent','trade mark','design')),
  country text not null check (country ~ '^[A-Z]{2}$'),
  title text not null check (btrim(title) <> ''),  -- the mark, or the title of the invention or design
  classes text not null default '',                 -- Nice classes for a trade mark, e.g. '9, 42'
  application_no text not null default '',
  filed_on date,
  priority_on date,                                 -- earliest priority date claimed, if any
  registration_no text not null default '',
  registered_on date,                               -- registration (trade marks, designs) or grant (patents)
  status text not null default 'drafting' check (status in ('drafting','filed','examination','accepted','registered','lapsed','abandoned','withdrawn')),
  attorney_id uuid references staff(id),
  foreign_agent text not null default '',
  client_reference text not null default '',
  renewal_policy text not null default 'we renew' check (renewal_policy in ('we renew','client renews','agent renews','do not renew')),
  source_id text unique,
  source_row jsonb,
  source_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('drafting') or filed_on is not null),
  check (status <> 'registered' or registered_on is not null)
);
create unique index cases_reference_ci on cases(lower(reference));
create index cases_client_idx on cases(client_id);

-- What the IP office sent (or did): examination reports, compliance reports, acceptance,
-- registration, grant. Recording one is what puts its deadlines on the docket.
create table official_actions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id),
  kind text not null check (kind in ('filed','pct filed','first examination report','examination report','compliance report','acceptance advertised','registered','granted','other')),
  issued_on date not null,
  summary text not null default '',
  recorded_by text not null check (btrim(recorded_by) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index official_actions_case_idx on official_actions(case_id, issued_on desc);

-- The docket. statutory means the right is lost if it is missed. rule names the rule in
-- docs/compliance.md that set the date ('' for a deadline entered by hand). A second person
-- checks every statutory date (verified_by), the control a docketing team runs on.
create table deadlines (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id),
  action_id uuid references official_actions(id),
  kind text not null check (btrim(kind) <> ''),
  due_on date not null,
  statutory boolean not null default true,
  extendable boolean not null default false,
  rule text not null default '',
  basis text not null default '',                   -- how the date was worked out, in words
  docketed_by text not null check (btrim(docketed_by) <> ''),
  verified_by text,
  verified_on date,
  extended_from date,
  extensions int not null default 0,
  closed_on date,
  closed_by text,
  how_closed text check (how_closed in ('done','superseded','not pursued on instructions')),
  outcome text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((closed_on is null and how_closed is null) or (closed_on is not null and how_closed is not null and btrim(outcome) <> '')),
  check (verified_by is null or verified_by <> docketed_by)
);
create index deadlines_open_idx on deadlines(due_on) where closed_on is null;

-- One renewal (or annuity) of one case. grace_ends_on is the last day it can be paid late.
create table renewals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id),
  term text not null check (btrim(term) <> ''),     -- 'year 4', '10 year renewal', '5 year renewal'
  due_on date not null,
  grace_ends_on date not null,
  official_fee numeric(12,2) check (official_fee >= 0),
  currency text not null default 'NZD' check (currency ~ '^[A-Z]{3}$'),
  reminder_sent_on date,
  instruction text check (instruction in ('renew','let lapse')),
  instructed_on date,
  instructed_by text not null default '',           -- who at the client gave the instruction
  paid_on date,
  receipt text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (grace_ends_on >= due_on),
  check ((instruction is null) = (instructed_on is null)),
  check (paid_on is null or btrim(receipt) <> '')
);
create unique index renewals_case_due on renewals(case_id, due_on);

create table case_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id),
  author text not null check (btrim(author) <> ''),
  kind text not null default 'note',
  note text not null check (btrim(note) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index case_notes_case_idx on case_notes(case_id, created_at desc);

do $$ declare t text; begin
  foreach t in array array['staff','clients','cases','official_actions','deadlines','renewals','case_notes'] loop
    execute format('create trigger touch_updated_at before update on %I for each row execute function touch_updated_at()', t);
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from public', t);
  end loop;
end $$;

-- ------------------------------------------------------------------ views

-- Every open deadline, soonest first.
create view docket with (security_invoker = true) as
select d.id, d.case_id, k.reference as case_ref, c.name as client, s.code as attorney, k.kind as case_kind, k.country, k.title,
  d.kind as deadline, d.due_on, d.due_on - current_date as days_left, d.statutory, d.extendable, d.rule, d.basis,
  d.docketed_by, d.verified_by, d.extensions
from deadlines d join cases k on k.id = d.case_id join clients c on c.id = k.client_id left join staff s on s.id = k.attorney_id
where d.closed_on is null;

-- Every unpaid renewal and where it sits.
create view renewal_book with (security_invoker = true) as
select r.id, r.case_id, k.reference as case_ref, c.name as client, s.code as attorney, k.kind as case_kind, k.country, k.title, k.classes,
  r.term, r.due_on, r.grace_ends_on, r.due_on - current_date as days_to_due, r.official_fee, r.currency,
  r.reminder_sent_on, r.instruction, r.instructed_on, k.renewal_policy,
  case
    when r.instruction = 'let lapse' then 'lapsing on instructions'
    when current_date > r.grace_ends_on then 'lapsed'
    when current_date > r.due_on then 'in grace'
    when r.instruction = 'renew' then 'instructed'
    when r.reminder_sent_on is not null then 'awaiting instructions'
    when r.due_on - current_date <= 90 then 'reminder due'
    else 'not due'
  end as state
from renewals r join cases k on k.id = r.case_id join clients c on c.id = k.client_id left join staff s on s.id = k.attorney_id
where r.paid_on is null and k.status not in ('abandoned','withdrawn');

-- Live cases with their next deadline and when anything last happened on them.
create view case_status with (security_invoker = true) as
select k.id, k.reference, c.name as client, s.code as attorney, k.kind, k.country, k.title, k.status, k.filed_on, k.registered_on,
  (select min(d.due_on) from deadlines d where d.case_id = k.id and d.closed_on is null) as next_deadline,
  (select min(r.due_on) from renewals r where r.case_id = k.id and r.paid_on is null) as next_renewal,
  greatest(
    (select max(a.issued_on) from official_actions a where a.case_id = k.id),
    (select max(n.created_at)::date from case_notes n where n.case_id = k.id),
    (select max(d.closed_on) from deadlines d where d.case_id = k.id)
  ) as last_activity
from cases k join clients c on c.id = k.client_id left join staff s on s.id = k.attorney_id
where k.status in ('drafting','filed','examination','accepted','registered');

-- One row per breach. Rule codes are explained, with sources, in docs/compliance.md.
create view compliance_findings with (security_invoker = true) as
select 'DOCKET-MISSED'::text as rule, d.case_ref as record, d.client,
  format('%s was due %s (%s days ago) and is not closed', d.deadline, d.due_on, -d.days_left) as finding, 1 as severity
from docket d where d.statutory and d.days_left < 0
union all
select 'DOCKET-7-DAYS', d.case_ref, d.client, format('%s due %s, in %s days', d.deadline, d.due_on, d.days_left), 2
from docket d where d.statutory and d.days_left between 0 and 7
union all
select 'DOCKET-UNCHECKED', d.case_ref, d.client, format('%s due %s was docketed by %s and no second person has checked it', d.deadline, d.due_on, d.docketed_by), 2
from docket d where d.statutory and d.verified_by is null
union all
select 'CASE-NOTHING-DOCKETED', k.reference, c.name, format('Live case (%s) with no open deadline', k.status), 1
from cases k join clients c on c.id = k.client_id
where k.status in ('filed','examination','accepted') and k.country in ('AU','NZ','WO')
  and not exists (select 1 from deadlines d where d.case_id = k.id and d.closed_on is null)
union all
select 'RENEWAL-NOT-DOCKETED', k.reference, c.name, format('Registered %s with no next renewal on file', k.registered_on), 1
from cases k join clients c on c.id = k.client_id
where k.status = 'registered' and k.renewal_policy = 'we renew' and k.country in ('AU','NZ')
  and not exists (select 1 from renewals r where r.case_id = k.id and r.paid_on is null)
union all
select 'RENEWAL-REMINDER', b.case_ref, b.client, format('%s due %s (%s days) and no reminder sent', b.term, b.due_on, b.days_to_due), 2
from renewal_book b where b.state = 'reminder due' and b.renewal_policy = 'we renew'
union all
select 'RENEWAL-NO-INSTRUCTIONS', b.case_ref, b.client, format('%s due %s (%s days) and no instructions back since the reminder on %s', b.term, b.due_on, b.days_to_due, b.reminder_sent_on), 2
from renewal_book b where b.state = 'awaiting instructions' and b.days_to_due <= 30
union all
select 'RENEWAL-INSTRUCTED-UNPAID', b.case_ref, b.client, format('Client said renew on %s; not paid and due in %s days', b.instructed_on, b.days_to_due), 2
from renewal_book b where b.state = 'instructed' and b.days_to_due <= 14
union all
select 'RENEWAL-GRACE', b.case_ref, b.client, format('%s was due %s; in the grace period, late fees apply, last day %s', b.term, b.due_on, b.grace_ends_on), 1
from renewal_book b where b.state = 'in grace'
union all
select 'RENEWAL-LAPSED', b.case_ref, b.client, format('%s not paid by the end of grace on %s: the right has lapsed unless restored', b.term, b.grace_ends_on), 1
from renewal_book b join cases k on k.id = b.case_id where b.state = 'lapsed' and k.status not in ('lapsed');

revoke all on docket, renewal_book, case_status, compliance_findings from public;

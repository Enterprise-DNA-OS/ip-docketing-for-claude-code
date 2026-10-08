-- Demo data: a fictional patent and trade mark practice with offices in Wellington and Melbourne.
-- Every name, mark, number and client is invented. Dates are relative to today, so the missed
-- deadline, the mark in its grace period and the case with nothing docketed are always there.
-- Safe to run twice: every row has a fixed id.

insert into staff (id, code, name, role, registration) values
('50000000-0000-0000-0000-000000000001','AM','Aroha Mitchell','attorney','Registered patent and trade marks attorney (TTIPAB)'),
('50000000-0000-0000-0000-000000000002','DB','Daniel Brooks','attorney','Registered patent attorney (TTIPAB)'),
('50000000-0000-0000-0000-000000000003','PS','Priya Singh','paralegal',''),
('50000000-0000-0000-0000-000000000004','RC','Ruth Chen','records','')
on conflict do nothing;

insert into clients (id, reference, name, contact_name, email, country) values
('c1000000-0000-0000-0000-000000000001','CL-01','Tui Kitchen Ltd','Sam Te Rangi','legal@tuikitchen.example.co.nz','NZ'),
('c1000000-0000-0000-0000-000000000002','CL-02','Southern Cross Robotics Pty Ltd','Mei Lin','ip@scrobotics.example.com.au','AU'),
('c1000000-0000-0000-0000-000000000003','CL-03','Matariki Skincare Ltd','Hana Walker','hana@matariki.example.co.nz','NZ'),
('c1000000-0000-0000-0000-000000000004','CL-04','Bluegum Brewing Co Pty Ltd','Josh Patel','josh@bluegum.example.com.au','AU'),
('c1000000-0000-0000-0000-000000000005','CL-05','Harbour Medical Devices Ltd','Dr Claire Moss','cmoss@harbourmed.example.co.nz','NZ'),
('c1000000-0000-0000-0000-000000000006','CL-06','Ironbark Outdoor Pty Ltd','Lachlan Reid','lachlan@ironbark.example.com.au','AU')
on conflict do nothing;

insert into cases (id, reference, client_id, kind, country, title, classes, application_no, filed_on, priority_on, registration_no, registered_on, status, attorney_id, foreign_agent, client_reference, renewal_policy) values
('ca000000-0000-0000-0000-000000000001','T-1001','c1000000-0000-0000-0000-000000000001','trade mark','NZ','TUI KITCHEN','29, 30','1012345',(current_date + 45 - interval '10 years')::date,null,'1012345',(current_date + 45 - interval '10 years' + interval '7 months')::date,'registered','50000000-0000-0000-0000-000000000001','','TK-BRAND-1','we renew'),
('ca000000-0000-0000-0000-000000000002','T-1002','c1000000-0000-0000-0000-000000000001','trade mark','AU','TUI KITCHEN','29, 30','1712345',(current_date + 20 - interval '10 years')::date,null,'1712345',(current_date + 20 - interval '10 years' + interval '8 months')::date,'registered','50000000-0000-0000-0000-000000000001','','TK-BRAND-2','we renew'),
('ca000000-0000-0000-0000-000000000003','T-1003','c1000000-0000-0000-0000-000000000003','trade mark','NZ','MATARIKI GLOW','3','1023456',(current_date - 60 - interval '10 years')::date,null,'1023456',(current_date - 60 - interval '10 years' + interval '6 months')::date,'registered','50000000-0000-0000-0000-000000000001','','','we renew'),
('ca000000-0000-0000-0000-000000000004','T-1004','c1000000-0000-0000-0000-000000000004','trade mark','AU','BLUEGUM','32','2234567',current_date - 700,null,'2234567',current_date - 300,'registered','50000000-0000-0000-0000-000000000001','','','we renew'),
('ca000000-0000-0000-0000-000000000005','T-1005','c1000000-0000-0000-0000-000000000004','trade mark','AU','BLUEGUM HAZY','32, 33','2456789',current_date - 520,null,'',null,'examination','50000000-0000-0000-0000-000000000001','','','we renew'),
('ca000000-0000-0000-0000-000000000006','T-1006','c1000000-0000-0000-0000-000000000006','trade mark','AU','IRONBARK TRAIL','18, 25','2398765',current_date - 580,null,'',null,'examination','50000000-0000-0000-0000-000000000001','','IB-TM-07','we renew'),
('ca000000-0000-0000-0000-000000000007','P-2001','c1000000-0000-0000-0000-000000000002','patent','AU','Robotic picking arm for orchard canopies','','2023901234',current_date - 1360,current_date - 1700,'',null,'examination','50000000-0000-0000-0000-000000000002','','SCR-PAT-3','we renew'),
('ca000000-0000-0000-0000-000000000008','P-2002','c1000000-0000-0000-0000-000000000005','patent','NZ','Catheter securing device','','798123',current_date - 900,current_date - 1230,'',null,'examination','50000000-0000-0000-0000-000000000002','','HMD-01-NZ','we renew'),
('ca000000-0000-0000-0000-000000000009','P-2003','c1000000-0000-0000-0000-000000000005','patent','WO','Catheter securing device with release tab','','PCT/NZ2024/050011',current_date - 515,current_date - 880,'',null,'filed','50000000-0000-0000-0000-000000000002','','HMD-02-PCT','we renew'),
('ca000000-0000-0000-0000-000000000010','P-2004','c1000000-0000-0000-0000-000000000002','patent','NZ','Robotic picking arm for orchard canopies','','801456',current_date - 400,current_date - 1700,'',null,'filed','50000000-0000-0000-0000-000000000002','','SCR-PAT-3-NZ','we renew'),
('ca000000-0000-0000-0000-000000000011','D-3001','c1000000-0000-0000-0000-000000000006','design','AU','Folding camp chair','','202411234',current_date - 1625,null,'202411234',current_date - 1500,'registered','50000000-0000-0000-0000-000000000001','','IB-DES-02','we renew'),
('ca000000-0000-0000-0000-000000000012','T-1007','c1000000-0000-0000-0000-000000000003','trade mark','NZ','KAWAKAWA RITUAL','3, 44','1267890',current_date - 210,null,'',null,'accepted','50000000-0000-0000-0000-000000000001','','','we renew'),
('ca000000-0000-0000-0000-000000000013','T-1008','c1000000-0000-0000-0000-000000000001','trade mark','US','TUI KITCHEN','30','97123456',current_date - 1100,null,'7345678',current_date - 600,'registered','50000000-0000-0000-0000-000000000001','Fenwick Lane LLP, Seattle','TK-BRAND-US','agent renews'),
('ca000000-0000-0000-0000-000000000014','T-1009','c1000000-0000-0000-0000-000000000006','trade mark','NZ','IRONBARK','18, 22, 25','1034567',(current_date + 10 - interval '10 years')::date,null,'1034567',(current_date + 10 - interval '10 years' + interval '6 months')::date,'registered','50000000-0000-0000-0000-000000000001','','IB-TM-01','we renew'),
('ca000000-0000-0000-0000-000000000015','T-1010','c1000000-0000-0000-0000-000000000004','trade mark','NZ','STOUT HEART','32','1045678',(current_date - 10 - interval '10 years')::date,null,'1045678',(current_date - 10 - interval '10 years' + interval '9 months')::date,'registered','50000000-0000-0000-0000-000000000001','','','we renew'),
('ca000000-0000-0000-0000-000000000016','P-2005','c1000000-0000-0000-0000-000000000002','patent','AU','Soft gripper for delicate fruit','','2018904321',(current_date + 150 - interval '8 years')::date,null,'2018904321',current_date - 1300,'registered','50000000-0000-0000-0000-000000000002','','SCR-PAT-1','we renew'),
('ca000000-0000-0000-0000-000000000017','T-1011','c1000000-0000-0000-0000-000000000003','trade mark','AU','KAWAKAWA BALM','3','1823456',(current_date - 250 - interval '10 years')::date,null,'1823456',(current_date - 250 - interval '10 years' + interval '8 months')::date,'registered','50000000-0000-0000-0000-000000000001','','','we renew')
on conflict do nothing;

insert into official_actions (id, case_id, kind, issued_on, summary, recorded_by) values
('0a000000-0000-0000-0000-000000000001','ca000000-0000-0000-0000-000000000005','first examination report',current_date - 400,'Objection under s41: mark describes the goods (hazy is a style of beer). Evidence of use may overcome it.','Ruth Chen'),
('0a000000-0000-0000-0000-000000000002','ca000000-0000-0000-0000-000000000006','first examination report',current_date - 460,'Citation of an earlier IRONBARK mark in class 25 under s44.','Ruth Chen'),
('0a000000-0000-0000-0000-000000000003','ca000000-0000-0000-0000-000000000007','first examination report',current_date - 300,'Lack of inventive step over two cited documents; claims 1 to 12.','Priya Singh'),
('0a000000-0000-0000-0000-000000000004','ca000000-0000-0000-0000-000000000008','first examination report',current_date - 170,'Novelty objection over a US publication; unity objection.','Priya Singh'),
('0a000000-0000-0000-0000-000000000005','ca000000-0000-0000-0000-000000000009','pct filed',current_date - 515,'International application filed at IPONZ as receiving office.','Priya Singh'),
('0a000000-0000-0000-0000-000000000006','ca000000-0000-0000-0000-000000000012','acceptance advertised',current_date - 50,'Accepted and advertised in the journal.','Ruth Chen'),
('0a000000-0000-0000-0000-000000000007','ca000000-0000-0000-0000-000000000004','registered',current_date - 300,'Registered. Certificate on file.','Ruth Chen'),
('0a000000-0000-0000-0000-000000000008','ca000000-0000-0000-0000-000000000010','filed',current_date - 400,'Complete specification filed claiming the AU priority.','Priya Singh')
on conflict do nothing;

insert into deadlines (id, case_id, action_id, kind, due_on, statutory, extendable, rule, basis, docketed_by, verified_by, verified_on, closed_on, closed_by, how_closed, outcome) values
('d0000001-0000-0000-0000-000000000000','ca000000-0000-0000-0000-000000000005','0a000000-0000-0000-0000-000000000001','put in order for acceptance',(current_date - 400 + interval '15 months')::date,true,true,'AU-TM-ACCEPT','15 months from the first examination report','Ruth Chen','Priya Singh',current_date - 398,null,null,null,''),
('d0000002-0000-0000-0000-000000000000','ca000000-0000-0000-0000-000000000006','0a000000-0000-0000-0000-000000000002','put in order for acceptance',current_date - 3,true,true,'AU-TM-ACCEPT','15 months from the first examination report','Ruth Chen','Priya Singh',current_date - 455,null,null,null,''),
('d0000003-0000-0000-0000-000000000000','ca000000-0000-0000-0000-000000000007','0a000000-0000-0000-0000-000000000003','put in order for acceptance',(current_date - 300 + interval '12 months')::date,true,false,'AU-PAT-ACCEPT','12 months from the first examination report','Priya Singh',null,null,null,null,null,''),
('d0000004-0000-0000-0000-000000000000','ca000000-0000-0000-0000-000000000008','0a000000-0000-0000-0000-000000000004','respond to examination report',current_date + 5,true,true,'NZ-PAT-RESPONSE','6 months from the first examination report (as extended)','Priya Singh','Ruth Chen',current_date - 168,null,null,null,''),
('d0000005-0000-0000-0000-000000000000','ca000000-0000-0000-0000-000000000008','0a000000-0000-0000-0000-000000000004','put in order for acceptance',(current_date - 170 + interval '12 months')::date,true,false,'NZ-PAT-ACCEPT','12 months from the first examination report','Priya Singh','Ruth Chen',current_date - 168,null,null,null,''),
('d0000006-0000-0000-0000-000000000000','ca000000-0000-0000-0000-000000000009','0a000000-0000-0000-0000-000000000005','national phase entry',(current_date - 880 + interval '30 months')::date,true,false,'PCT-30','30 months from the priority date','Priya Singh','Ruth Chen',current_date - 510,null,null,null,''),
('d0000007-0000-0000-0000-000000000000','ca000000-0000-0000-0000-000000000009','0a000000-0000-0000-0000-000000000005','AU national phase entry',(current_date - 880 + interval '31 months')::date,true,false,'PCT-31-AU','31 months from the priority date','Priya Singh','Ruth Chen',current_date - 510,null,null,null,''),
('d0000008-0000-0000-0000-000000000000','ca000000-0000-0000-0000-000000000012','0a000000-0000-0000-0000-000000000006','opposition period ends',(current_date - 50 + interval '3 months')::date,false,false,'NZ-TM-OPPOSITION','3 months from the advertisement of acceptance','Ruth Chen',null,null,null,null,null,''),
('d0000009-0000-0000-0000-000000000000','ca000000-0000-0000-0000-000000000010','0a000000-0000-0000-0000-000000000008','request examination',current_date - 30,true,false,'','Requested with the filing','Priya Singh','Ruth Chen',current_date - 398,current_date - 380,'Priya Singh','done','Examination requested, receipt on file'),
('d0000010-0000-0000-0000-000000000000','ca000000-0000-0000-0000-000000000004',null,'file evidence of use',current_date - 330,true,true,'','Set by the examiner','Ruth Chen','Priya Singh',current_date - 500,current_date - 335,'Aroha Mitchell','done','Statutory declaration filed')
on conflict do nothing;

insert into renewals (id, case_id, term, due_on, grace_ends_on, official_fee, currency, reminder_sent_on, instruction, instructed_on, instructed_by, paid_on, receipt) values
('e0000001-0000-0000-0000-000000000000','ca000000-0000-0000-0000-000000000001','10 year renewal',current_date + 45,(current_date + 45 + interval '6 months')::date,null,'NZD',null,null,null,'',null,''),
('e0000002-0000-0000-0000-000000000000','ca000000-0000-0000-0000-000000000002','10 year renewal',current_date + 20,(current_date + 20 + interval '6 months')::date,null,'AUD',current_date - 40,null,null,'',null,''),
('e0000003-0000-0000-0000-000000000000','ca000000-0000-0000-0000-000000000003','10 year renewal',current_date - 60,(current_date - 60 + interval '6 months')::date,null,'NZD',current_date - 150,null,null,'',null,''),
('e0000004-0000-0000-0000-000000000000','ca000000-0000-0000-0000-000000000007','year 4',current_date + 100,(current_date + 100 + interval '6 months')::date,null,'AUD',null,null,null,'',null,''),
('e0000005-0000-0000-0000-000000000000','ca000000-0000-0000-0000-000000000011','5 year renewal',current_date + 200,(current_date + 200 + interval '6 months')::date,null,'AUD',null,null,null,'',null,''),
('e0000006-0000-0000-0000-000000000000','ca000000-0000-0000-0000-000000000014','10 year renewal',current_date + 10,(current_date + 10 + interval '6 months')::date,null,'NZD',current_date - 80,'renew',current_date - 15,'Lachlan Reid',null,''),
('e0000007-0000-0000-0000-000000000000','ca000000-0000-0000-0000-000000000015','10 year renewal',current_date - 10,(current_date - 10 + interval '6 months')::date,null,'NZD',current_date - 100,'let lapse',current_date - 70,'Josh Patel',null,''),
('e0000008-0000-0000-0000-000000000000','ca000000-0000-0000-0000-000000000016','year 7',(current_date + 150 - interval '1 year')::date,(current_date + 150 - interval '1 year' + interval '6 months')::date,null,'AUD',current_date - 300,'renew',current_date - 260,'Mei Lin',current_date - 230,'IPA receipt 88812'),
('e0000009-0000-0000-0000-000000000000','ca000000-0000-0000-0000-000000000016','year 8',current_date + 150,(current_date + 150 + interval '6 months')::date,null,'AUD',null,null,null,'',null,''),
('e0000010-0000-0000-0000-000000000000','ca000000-0000-0000-0000-000000000017','10 year renewal',current_date - 250,(current_date - 250 + interval '6 months')::date,null,'AUD',current_date - 340,null,null,'',null,'')
on conflict do nothing;

insert into case_notes (id, case_id, author, kind, note, created_at) values
('a1000000-0000-0000-0000-000000000001','ca000000-0000-0000-0000-000000000005','Aroha Mitchell','email','Asked Josh for sales figures and labels showing BLUEGUM HAZY in use since 2021.', now() - interval '20 days'),
('a1000000-0000-0000-0000-000000000002','ca000000-0000-0000-0000-000000000006','Aroha Mitchell','call','Lachlan wants to negotiate a coexistence agreement with the cited owner. Waiting on their reply.', now() - interval '150 days'),
('a1000000-0000-0000-0000-000000000003','ca000000-0000-0000-0000-000000000007','Daniel Brooks','meeting','Went through the citations with Mei. Amend claim 1 to add the canopy sensor.', now() - interval '35 days'),
('a1000000-0000-0000-0000-000000000004','ca000000-0000-0000-0000-000000000008','Daniel Brooks','note','Response drafted. Waiting on Dr Moss to confirm the amended claims.', now() - interval '6 days'),
('a1000000-0000-0000-0000-000000000005','ca000000-0000-0000-0000-000000000003','Aroha Mitchell','email','Renewal reminder sent. No reply.', now() - interval '150 days'),
('a1000000-0000-0000-0000-000000000006','ca000000-0000-0000-0000-000000000015','Aroha Mitchell','email','Josh confirmed STOUT HEART is retired. Let it lapse.', now() - interval '70 days')
on conflict do nothing;

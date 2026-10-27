-- OPTIONAL operator configuration, NOT a migration or an official Cebu taxonomy.
-- Review these suggested labels/codes with your project stakeholders first.
-- Run in the intended DEVELOPMENT project as an operator after deploying the RPC.
-- Existing categories are preserved, including disabled ones. No user data is seeded.
begin;
insert into public.report_categories(code,label,enabled) values
  ('illegal_dumping','Illegal dumping',true),
  ('overflowing_bin','Overflowing bin',true),
  ('collection_concern','Collection concern',true),
  ('other_waste_concern','Other waste concern',true)
on conflict (code) do nothing;
commit;
select code,label,enabled from public.report_categories order by code;

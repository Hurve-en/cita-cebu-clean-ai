-- Read-only structural checks after deployment. Run the complete file.
-- Expected: 4, 4; then all authenticated_select=true, all writes/anonymous_read=false.
select
  (select count(*) from pg_catalog.pg_class c
   join pg_catalog.pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname in
     ('report_categories','collection_schedules','reports','report_events')
     and c.relkind='r' and c.relrowsecurity) as community_tables_with_rls,
  (select count(*) from pg_catalog.pg_policies
   where schemaname='public' and tablename in
     ('report_categories','collection_schedules','reports','report_events')
     and cmd='SELECT') as community_select_policies;

select table_name,
  has_table_privilege('authenticated','public.'||table_name,'SELECT') as authenticated_select,
  has_table_privilege('anon','public.'||table_name,'SELECT') as anonymous_read,
  has_table_privilege('authenticated','public.'||table_name,'INSERT') as client_insert,
  has_table_privilege('authenticated','public.'||table_name,'UPDATE') as client_update,
  has_table_privilege('authenticated','public.'||table_name,'DELETE') as client_delete
from (values ('report_categories'),('collection_schedules'),('reports'),('report_events')) as t(table_name)
order by table_name;

-- Expected: 0, 0 after the transaction-based community suite.
select
  (select count(*) from auth.users where id::text like 'cd100000-%') as remaining_community_test_accounts,
  (select count(*) from public.barangays where id::text like 'cd000000-%') as remaining_community_test_barangays;

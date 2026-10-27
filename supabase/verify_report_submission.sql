-- Read-only checks. Run the complete file after the two new migrations.
-- Expected: authenticated_submit=true, anonymous_submit=false, receipt_rls=true.
select
  has_function_privilege('authenticated','public.submit_resident_report(uuid,uuid,text,text,text,text)','EXECUTE') as authenticated_submit,
  has_function_privilege('anon','public.submit_resident_report(uuid,uuid,text,text,text,text)','EXECUTE') as anonymous_submit,
  (select c.relrowsecurity from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='report_submission_receipts') as receipt_rls;

-- Expected: every value false. Receipt content is available only inside the command.
select role_name,
  has_table_privilege(role_name,'public.report_submission_receipts','SELECT') as receipt_read,
  has_table_privilege(role_name,'public.report_submission_receipts','INSERT') as receipt_insert,
  has_table_privilege(role_name,'public.report_submission_receipts','UPDATE') as receipt_update,
  has_table_privilege(role_name,'public.report_submission_receipts','DELETE') as receipt_delete
from (values ('anon'),('authenticated')) as roles(role_name);

-- Expected: all false. The RPC grants no direct report/event write privileges.
select table_name,
  has_table_privilege('authenticated','public.'||table_name,'INSERT') as client_insert,
  has_table_privilege('authenticated','public.'||table_name,'UPDATE') as client_update,
  has_table_privilege('authenticated','public.'||table_name,'DELETE') as client_delete
from (values ('reports'),('report_events')) as tables(table_name);

-- Expected: 0, 0 after running the COMPLETE rollback-based test suite.
select
 (select count(*) from auth.users where id::text like 'ce100000-%') as remaining_submission_test_accounts,
 (select count(*) from public.barangays where id::text like 'ce000000-%') as remaining_submission_test_barangays;

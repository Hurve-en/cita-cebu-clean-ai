-- READ ONLY. Run first in the intended DEVELOPMENT project's SQL Editor.
-- Review the result before applying the migration. Do not share credentials.
select current_database() as database_name, current_user as sql_role;
select count(*) as existing_auth_accounts from auth.users;
select n.nspname as schema_name, c.relname as conflicting_relation
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in
 ('profiles', 'account_access', 'barangays', 'officer_assignments');
select nspname as conflicting_internal_schema
from pg_catalog.pg_namespace where nspname = 'cebu_private';
select tgname as existing_auth_user_trigger from pg_catalog.pg_trigger
where tgrelid = 'auth.users'::regclass and not tgisinternal;

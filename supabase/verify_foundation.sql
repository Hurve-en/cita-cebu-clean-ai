-- READ ONLY. Operator verification after applying the migration.
select tablename, rowsecurity from pg_catalog.pg_tables
where schemaname = 'public' and tablename in
 ('profiles', 'account_access', 'barangays', 'officer_assignments') order by tablename;
select tablename, policyname, cmd, roles from pg_catalog.pg_policies
where schemaname = 'public' and tablename in
 ('profiles', 'account_access', 'barangays', 'officer_assignments') order by tablename;
select has_function_privilege('anon', 'public.get_current_access()', 'EXECUTE') as anon_access_rpc,
 has_function_privilege('authenticated', 'public.get_current_access()', 'EXECUTE') as signed_in_access_rpc,
 has_table_privilege('authenticated', 'public.account_access', 'UPDATE') as client_role_write;

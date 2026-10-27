-- Read-only deployed checks. Create/configure the private bucket through the
-- Dashboard or Storage API, never by mutating provider metadata with SQL.
-- Expected first row: true, false, false, false, false.
select
 (select c.relrowsecurity from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='resident_media') as metadata_rls,
 has_table_privilege('anon','public.resident_media','SELECT') as anonymous_read,
 has_table_privilege('authenticated','public.resident_media','INSERT') as direct_insert,
 has_table_privilege('authenticated','public.resident_media','UPDATE') as direct_update,
 has_table_privilege('authenticated','public.resident_media','DELETE') as direct_delete;

-- Expected: 5 rows, authenticated=true and anonymous=false for every command.
select signature,
 has_function_privilege('authenticated',signature,'EXECUTE') as authenticated,
 has_function_privilege('anon',signature,'EXECUTE') as anonymous
from (values
 ('public.prepare_resident_media(uuid,text,uuid,text,text,text,integer)'),
 ('public.finalize_resident_media(uuid)'),
 ('public.begin_resident_media_delete(uuid)'),
 ('public.finish_resident_media_delete(uuid)'),
 ('public.cancel_resident_media_request(uuid,text)')
) as commands(signature);

-- Expected: 7 policies, including 4 RESTRICTIVE guards and 3 PERMISSIVE policies.
select policyname,permissive,cmd from pg_catalog.pg_policies
where schemaname='storage' and tablename='objects' and policyname in
 ('resident_media_insert','resident_media_select','resident_media_delete',
  'resident_media_insert_guard','resident_media_select_guard','resident_media_delete_guard','resident_media_update_guard')
order by policyname;

-- Expected after Storage setup: exactly one row, public=false, limit=2097152,
-- allowed_mime_types={image/jpeg}. Zero rows means bucket setup is still pending.
select id,name,public,file_size_limit,allowed_mime_types
from storage.buckets where id='resident-media';

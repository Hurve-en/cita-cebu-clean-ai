-- Read-only. Before deployment, expected conflicting_metadata_tables=0,
-- conflicting_storage_policies=0. Existing correctly configured bucket is allowed.
select
 (select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='resident_media') as conflicting_metadata_tables,
 (select count(*) from pg_catalog.pg_policies where schemaname='storage' and tablename='objects' and policyname like 'resident_media_%') as conflicting_storage_policies;
select id,name,public,file_size_limit,allowed_mime_types from storage.buckets where id='resident-media';

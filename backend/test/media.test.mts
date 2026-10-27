import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { stageMigrations } from '../scripts/stage-migrations.mjs';
import { installStorageFixture } from './support/storage-fixture.mjs';
const backend=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.dirname(backend);
const database=new PGlite();
try {
  await database.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (
      id uuid primary key, email text, email_confirmed_at timestamptz,
      raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}'
    );
    create function auth.uid() returns uuid language sql stable as $$
      select coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
      )::uuid;
    $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  await installStorageFixture(database);
  const preflight=await database.exec(fs.readFileSync(path.join(root,'supabase/preflight_resident_media.sql'),'utf8'));
  assert.deepEqual(preflight[0]?.rows,[{conflicting_metadata_tables:0,conflicting_storage_policies:0}]);
  for(const name of stageMigrations(backend)) await database.exec(fs.readFileSync(path.join(root,'supabase/migrations',name),'utf8'));
  // Provider metadata is simulated ONLY in this local database.
  await database.exec("insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('resident-media','resident-media',false,2097152,array['image/jpeg'])");
  const verified=await database.exec(fs.readFileSync(path.join(root,'supabase/verify_resident_media.sql'),'utf8'));
  assert.deepEqual(verified[0]?.rows,[{metadata_rls:true,anonymous_read:false,direct_insert:false,direct_update:false,direct_delete:false}]);
  assert.equal(verified[1]?.rows.length,5);
  for(const item of verified[1]?.rows??[]){const row=item as Record<string,unknown>;assert.equal(row.authenticated,true);assert.equal(row.anonymous,false);}
  assert.equal(verified[2]?.rows.length,7);
  assert.equal(verified[2]?.rows.filter(r=>(r as Record<string,unknown>).permissive==='RESTRICTIVE').length,4);
  assert.equal(verified[3]?.rows.length,1);
  console.log('PASS: media preflight and deployment verification SQL execute with expected grants and policy guards');
  const suite=fs.readFileSync(path.join(backend,'test/media-storage-shim.sql'),'utf8');
  await database.exec(suite);
  for(const table of ['auth.users','public.resident_media','storage.objects']){
    const r=await database.query<{count:number}>(`select count(*)::int as count from ${table}`);assert.equal(r.rows[0]?.count,0);
  }
  console.log(`PASS: ${(suite.match(/select pg_temp\.(assert_true|expect_error)\(/g)??[]).length} local media permission/state/Storage-policy assertions`);
  console.log('PASS: fixtures and media records roll back; original schema suites still run separately');
  console.log('LIMIT: Storage metadata shim only; real byte uploads, provider metadata shape, JWT/PostgREST, concurrent transactions and device behavior require hosted acceptance. Never run the shim SQL against Supabase.');
} finally {await database.close();}

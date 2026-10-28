import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { stageMigrations } from '../scripts/stage-migrations.mjs';
import { installStorageFixture } from './support/storage-fixture.mjs';
const backend=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.dirname(backend);
const db=new PGlite();
try{
 await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 await installStorageFixture(db);
 const names=stageMigrations(backend).slice(0,16);
 for(const [index,name] of names.entries()){
  if(index===14){const prior=await db.query<{is_nullable:string}>("select is_nullable from information_schema.columns where table_schema='public' and table_name='disposal_claims' and column_name='after_id'");assert.equal(prior.rows[0]?.is_nullable,'NO');}
  if(index===12){const pre=await db.exec(fs.readFileSync(path.join(root,'supabase/preflight_unified_scan.sql'),'utf8'));assert.equal(pre[0]?.rows[0]?.conflicting_columns,0);assert.equal(pre[0]?.rows[0]?.conflicting_commands,0);}
  if(index===10){const pre=await db.exec(fs.readFileSync(path.join(root,'supabase/preflight_scan_rewards.sql'),'utf8'));assert.equal(pre[0]?.rows[0]?.conflicting_tables,0);assert.equal(pre[0]?.rows[0]?.conflicting_commands,0);}
  await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',name),'utf8'));
 }
 const manual=await db.query<{is_nullable:string}>("select is_nullable from information_schema.columns where table_schema='public' and table_name='disposal_claims' and column_name='after_id'");assert.equal(manual.rows[0]?.is_nullable,'YES');
 const checks=await db.exec(fs.readFileSync(path.join(root,'supabase/verify_scan_rewards.sql'),'utf8'));
 assert.equal(checks[0]?.rows.length,3);
 for(const row of checks[0]!.rows){assert.equal(row.rls,true);assert.equal(row.anonymous_read,false);assert.equal(row.direct_insert,false);assert.equal(row.direct_update,false);assert.equal(row.direct_delete,false);}
 assert.equal(checks[1]?.rows.length,2);for(const row of checks[1]!.rows){assert.equal(row.service_role,true);assert.equal(row.authenticated,false);assert.equal(row.anonymous,false);}
 assert.equal(checks[2]?.rows.length,4);for(const row of checks[2]!.rows){assert.equal(row.authenticated,true);assert.equal(row.anonymous,false);}
 assert.equal(checks[3]?.rows[0]?.auto_awards_enabled,false);assert.equal(checks[3]?.rows[0]?.daily_points,30);
 assert.equal(checks[4]?.rows.length,7);assert.equal(checks[5]?.rows.length,1);
 const unifiedChecks=await db.exec(fs.readFileSync(path.join(root,'supabase/verify_unified_scan.sql'),'utf8'));assert.equal(unifiedChecks[0]?.rows[0]?.is_nullable,'YES');assert.equal(unifiedChecks[1]?.rows.length,1);assert.equal(unifiedChecks[2]?.rows.length,2);for(const row of unifiedChecks[2]!.rows){assert.equal(row.authenticated,true);assert.equal(row.anonymous,false);}assert.equal(unifiedChecks[3]?.rows[0]?.private_worker,true);assert.equal(unifiedChecks[3]?.rows[0]?.client_verdict,false);assert.equal(unifiedChecks[3]?.rows[0]?.anonymous_verdict,false);
 console.log('PASS: unified scan preflight, event foreign key and restricted RPC grants');
 console.log('PASS: scan preflight and deployed structural verification SQL');
 const suite=fs.readFileSync(path.join(backend,'test/scan-rewards-local.sql'),'utf8');await db.exec(suite);
 const unified=fs.readFileSync(path.join(backend,'test/unified-scan-local.sql'),'utf8');await db.exec(unified);console.log(`PASS: ${(unified.match(/select pg_temp\.(assert_true|expect_error)\(/g)??[]).length} unified scan event eligibility, evidence, attribution and single-award assertions`);
 const cleanup=await db.query<{n:number}>("select count(*)::int n from auth.users");assert.equal(cleanup.rows[0]?.n,0);
 console.log(`PASS: ${(suite.match(/select pg_temp\.(assert_true|expect_error)\(/g)??[]).length} scan reward session, rate limit, worker privilege and duplicate assertions`);
 console.log('PASS: rewards fixtures roll back; the sixteen historical migrations execute unchanged (current rules have a separate suite)');
 console.log('LIMIT: local Auth/Storage shim; hosted uploads, staff device flows and multi-connection contention require acceptance testing.');
}finally{await db.close();}

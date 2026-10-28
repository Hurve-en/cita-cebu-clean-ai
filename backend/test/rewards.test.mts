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
 for(const [i,name] of stageMigrations(backend).slice(0,16).entries()){
  if(i===8){const preflight=await db.exec(fs.readFileSync(path.join(root,'supabase/preflight_rewards.sql'),'utf8'));assert.deepEqual(preflight[0]?.rows,[{conflicting_relations:0,conflicting_commands:0,conflicting_evidence:0}]);}
  await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',name),'utf8'));
 }
 const verified=await db.exec(fs.readFileSync(path.join(root,'supabase/verify_rewards.sql'),'utf8'));
 assert.equal(verified[0]?.rows.length,7);for(const row of verified[0]?.rows??[])assert.deepEqual(Object.values(row).slice(1),[true,false,false,false,false]);
 assert.equal(verified[1]?.rows.length,10);for(const row of verified[1]?.rows??[]){assert.equal((row as Record<string,unknown>).authenticated,true);assert.equal((row as Record<string,unknown>).anonymous,false);}
 assert.equal(verified[4]?.rows.length,7);assert.equal(verified[5]?.rows.length,1);
 console.log('PASS: rewards preflight, seven table grants/RLS, ten RPC grants, and retained Storage guards');
 const suite=fs.readFileSync(path.join(backend,'test/rewards-local.sql'),'utf8');await db.exec(suite);
 const cleanup=await db.query<{n:number}>("select count(*)::int n from auth.users");assert.equal(cleanup.rows[0]?.n,0);
 console.log(`PASS: ${(suite.match(/select pg_temp\.(assert_true|expect_error)\(/g)??[]).length} rewards earning, MFA, ownership, ledger, stock, evidence and retry assertions`);
 console.log('PASS: rewards fixtures roll back; the sixteen historical migrations execute unchanged (current rules have a separate suite)');
 console.log('LIMIT: local Auth/Storage shim; hosted uploads, staff device flows and multi-connection contention require acceptance testing.');
}finally{await db.close();}

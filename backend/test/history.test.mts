import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PGlite} from '@electric-sql/pglite';
import {stageMigrations} from '../scripts/stage-migrations.mjs';
import {installStorageFixture} from './support/storage-fixture.mjs';
const backend=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.dirname(backend),db=new PGlite();
try{
 await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 await installStorageFixture(db);
 for(const name of stageMigrations(backend))await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',name),'utf8'));
 await db.exec(fs.readFileSync(path.join(backend,'test/history-local.sql'),'utf8'));
 const empty=await db.query<{n:number}>('select count(*)::integer n from auth.users');assert.equal(empty.rows[0]?.n,0);
 console.log('PASS: unified owner-only history, bounded global pagination, actual ledger credits, upload caps, AI-only 10-point awards, duplicate rejection, unchanged event review and retryable pending-photo withdrawal; fixtures roll back');
 console.log('LIMIT: local Auth/Storage shim. Live AI accuracy, hosted requests, multiple database connections and device performance are UNVERIFIED.');
}catch(e){throw new Error(e instanceof Error?e.message:String(e));}finally{await db.close();}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { stageMigrations } from '../scripts/stage-migrations.mjs';
const backend=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.dirname(backend),database=new PGlite();
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
  for(const name of stageMigrations(backend)) await database.exec(fs.readFileSync(path.join(root,'supabase/migrations',name),'utf8'));
  const verification=await database.exec(fs.readFileSync(path.join(root,'supabase/verify_report_submission.sql'),'utf8'));
  assert.deepEqual(verification[0]?.rows,[{authenticated_submit:true,anonymous_submit:false,receipt_rls:true}]);
  for(const row of verification[1]?.rows ?? []) {
    const flags=row as Record<string,unknown>;
    for(const name of ['receipt_read','receipt_insert','receipt_update','receipt_delete']) assert.equal(flags[name],false);
  }
  assert.equal(verification[1]?.rows.length,2);
  for(const row of verification[2]?.rows ?? []) {
    const flags=row as Record<string,unknown>;
    for(const name of ['client_insert','client_update','client_delete']) assert.equal(flags[name],false);
  }
  assert.equal(verification[2]?.rows.length,2);
  console.log('PASS: submission verification SQL confirms RPC grants, receipt RLS and closed direct writes');
  const suite=fs.readFileSync(path.join(root,'supabase/tests/report_submission.sql'),'utf8');
  await database.exec(suite);
  const assertions=(suite.match(/select pg_temp\.(assert_true|expect_error)\(/g)??[]).length;
  assert.ok(assertions>=30);
  console.log(`PASS: ${assertions} resident submission SQL assertions`);
  for(const table of ['auth.users','public.reports','public.report_events','public.report_submission_receipts']) {
    const remaining=await database.query<{count:number}>(`select count(*)::int as count from ${table}`);
    assert.equal(remaining.rows[0]?.count,0);
  }
  console.log('PASS: submission fixtures and failure-injection triggers roll back');
  console.log('LIMIT: hosted JWT/PostgREST, multi-connection races and device writes are not tested by the local Auth shim.');
} finally { await database.close(); }

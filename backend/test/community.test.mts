import { installStorageFixture } from './support/storage-fixture.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import { reports, reportEvents } from '../db/schema.mjs';
import { stageMigrations } from '../scripts/stage-migrations.mjs';
const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.dirname(backend);
const names = stageMigrations(backend);
const database = new PGlite();
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
  for (const name of names) {
    await database.exec(fs.readFileSync(path.join(root, 'supabase/migrations', name), 'utf8'));
  }
  const verification = await database.exec(fs.readFileSync(path.join(root, 'supabase/verify_community_foundation.sql'), 'utf8'));
  assert.deepEqual(verification[0]?.rows, [{ community_tables_with_rls: 4, community_select_policies: 4 }]);
  assert.equal(verification[1]?.rows.length, 4);
  for (const row of verification[1]!.rows) {
    assert.equal(row.authenticated_select, true);
    for (const key of ['anonymous_read', 'client_insert', 'client_update', 'client_delete']) assert.equal(row[key], false);
  }
  console.log('PASS: deployed structural verification SQL confirms RLS and read-only grants');
  const suite = fs.readFileSync(path.join(root, 'supabase/tests/community_foundation.sql'), 'utf8');
  await database.exec(suite);
  assert.equal((suite.match(/select pg_temp\.(assert_true|expect_error)\(/g) ?? []).length, 74);
  console.log('PASS: 74 community SQL permission and validation assertions');
  for (const table of ['auth.users', 'public.barangays', 'public.reports', 'public.report_events', 'public.collection_schedules', 'public.report_categories']) {
    const result = await database.query<{ count: number }>(`select count(*)::int as count from ${table}`);
    assert.equal(result.rows[0]?.count, 0, `${table} fixture rolled back`);
  }
  console.log('PASS: community suite rolls all synthetic accounts and community data back');

  // Reuse the suite fixture, but end as Resident A for typed ORM checks.
  const fixture = suite.slice(0, suite.indexOf('set local role anon;'));
  await database.exec(fixture);
  await database.exec(`
    select set_config('request.jwt.claim.sub','cd100000-0000-4000-8000-000000000001',true);
    select set_config('request.jwt.claims','{"sub":"cd100000-0000-4000-8000-000000000001","role":"authenticated"}',true);
    set local role authenticated;
  `);
  const orm = drizzle(database);
  const own = await orm.select().from(reports);
  assert.equal(own.length, 1);
  assert.equal(own[0]?.ownerId, 'cd100000-0000-4000-8000-000000000001');
  assert.equal((await orm.select().from(reportEvents)).length, 2);
  assert.equal((await orm.select().from(reportEvents).where(eq(reportEvents.visibility, 'internal'))).length, 0);
  console.log('PASS: typed Drizzle reads enforce report ownership and hide internal notes');
  await database.exec('savepoint denied_report_write');
  await assert.rejects(
    () => orm.update(reports).set({ status: 'resolved' }),
    (error: unknown) => (error as { cause?: { code?: string } }).cause?.code === '42501',
  );
  await database.exec('rollback to savepoint denied_report_write; rollback;');
  console.log('PASS: typed Drizzle cannot bypass closed report writes');
  console.log('LIMIT: local PostgreSQL/Auth shim only; hosted JWT, PostgREST, MFA, concurrency and device integration remain untested.');
} finally {
  await database.close();
}

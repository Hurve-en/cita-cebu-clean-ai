import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq, sql } from 'drizzle-orm';
import { stageMigrations } from '../scripts/stage-migrations.mjs';
import { profiles, accountAccess } from '../db/schema.mjs';
import { createServerDatabase } from '../db/server-client.mjs';

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.dirname(backend);
const names = stageMigrations(backend);
assert.equal(names.length, 2, 'this initial foundation has two staged migrations');
const before = fs.readFileSync(path.join(backend, 'migration-map.json'), 'utf8');
stageMigrations(backend);
assert.equal(fs.readFileSync(path.join(backend, 'migration-map.json'), 'utf8'), before);
console.log('PASS: repeat staging preserves the same mapping and SQL');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cebu-drizzle-handoff-'));
try {
  const copy = path.join(temp, 'backend');
  fs.mkdirSync(copy);
  fs.cpSync(path.join(backend, 'drizzle'), path.join(copy, 'drizzle'), { recursive: true });
  fs.copyFileSync(path.join(backend, 'migration-map.json'), path.join(copy, 'migration-map.json'));
  stageMigrations(copy);
  const source = path.join(copy, 'drizzle/0000_identity_tables.sql');
  const original = fs.readFileSync(source, 'utf8');
  fs.appendFileSync(source, '\n-- unexpected historical edit\n');
  assert.throws(() => stageMigrations(copy), /Previously staged migration changed/);
  fs.writeFileSync(source, original);
  console.log('PASS: changed previously staged source is rejected');

  const destination = path.join(temp, 'supabase/migrations', names[0]!);
  const staged = fs.readFileSync(destination, 'utf8');
  fs.appendFileSync(destination, '\n-- unexpected target edit\n');
  assert.throws(() => stageMigrations(copy), /Refusing to overwrite/);
  fs.writeFileSync(destination, staged);
  console.log('PASS: changed deployment SQL is not overwritten');

  const untracked = path.join(temp, 'supabase/migrations/20990101000000_untracked.sql');
  fs.writeFileSync(untracked, 'select 1;');
  assert.throws(() => stageMigrations(copy), /Untracked Supabase migrations/);
  fs.unlinkSync(untracked);
  console.log('PASS: a competing deployment history is rejected');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

assert.throws(() => createServerDatabase(''), /server-only PostgreSQL/);
console.log('PASS: server factory requires an explicit private connection URL');

const database = new PGlite();
try {
  // Local test fixture only. Never deploy/recreate the provider's Auth schema.
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
  for (const name of names) {
    const migration = fs.readFileSync(path.join(root, 'supabase/migrations', name), 'utf8');
    assert.doesNotMatch(migration, /create\s+(?:schema\s+"?auth"?|table\s+"?auth"?\.)/i);
    await database.exec(migration);
  }
  console.log('PASS: exact generated-plus-custom deployment migrations execute');

  const suite = fs.readFileSync(path.join(root, 'supabase/tests/identity_foundation.sql'), 'utf8');
  await database.exec(suite);
  assert.equal((suite.match(/select pg_temp\.(assert_true|expect_error)\(/g) ?? []).length, 40);
  console.log('PASS: 40 SQL grant, policy, mutation and assignment assertions');
  const remaining = await database.query<{ count: number }>('select count(*)::int as count from auth.users');
  assert.equal(remaining.rows[0]?.count, 0);
  console.log('PASS: SQL suite rolls synthetic Auth accounts back');

  const orm = drizzle(database);
  const owner = 'bd100000-0000-4000-8000-000000000001';
  const foreign = 'bd100000-0000-4000-8000-000000000002';
  await database.exec(`
    begin;
    insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data) values
      ('${owner}', 'drizzle-a@example.test', now(), '{"display_name":"ORM Resident A"}'),
      ('${foreign}', 'drizzle-b@example.test', now(), '{"display_name":"ORM Resident B"}');
    set constraints all immediate;
    select set_config('request.jwt.claim.sub', '${owner}', true);
    select set_config('request.jwt.claims', '{"sub":"${owner}","role":"authenticated"}', true);
    set local role authenticated;
  `);
  const own = await orm.select().from(profiles);
  assert.equal(own.length, 1);
  assert.equal(own[0]?.userId, owner);
  console.log('PASS: typed Drizzle SELECT observes owner-only RLS');
  assert.equal((await orm.select().from(profiles).where(eq(profiles.userId, foreign))).length, 0);
  console.log('PASS: typed Drizzle SELECT cannot retrieve a foreign profile');

  await database.exec('savepoint denied_promotion');
  await assert.rejects(
    () => orm.update(accountAccess).set({ productRole: 'admin' }).where(eq(accountAccess.userId, owner)),
    (error: unknown) => {
      const cause = (error as { cause?: { code?: string } }).cause;
      return cause?.code === '42501';
    },
  );
  await database.exec('rollback to savepoint denied_promotion');
  console.log('PASS: Drizzle UPDATE does not bypass denied client role writes');

  const outcome = await orm.execute(sql`select public.get_current_access() as access`);
  const access = outcome.rows[0]?.access as { product_role: string; eligible: boolean };
  assert.equal(access.product_role, 'resident');
  assert.equal(access.eligible, true);
  console.log('PASS: typed ORM can call the constrained own-access RPC');
  await database.exec('rollback');
  console.log('LIMIT: Auth/JWT context is a local shim; hosted Auth, PostgREST, MFA, pool connections and device checks are not tested.');
} finally {
  await database.close();
}

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.mjs';

/** Trusted server/tooling only. A connection is NOT an authorization decision.
 * An owner/service connection may bypass RLS. Do not use it for unscoped user
 * queries or import this factory from the Expo application.
 * No user-facing endpoint is created or deployed by this foundation slice.
 */
export function createServerDatabase(connectionString: string) {
  if (!connectionString || !/^postgres(ql)?:\/\//.test(connectionString)) {
    throw new Error('A server-only PostgreSQL connection string is required');
  }
  const client = postgres(connectionString, {
    prepare: false,
    max: 1,
    ssl: { rejectUnauthorized: true },
    connect_timeout: 10,
  });
  return {
    db: drizzle(client, { schema }),
    close: () => client.end(),
  };
}

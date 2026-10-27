import { defineConfig } from 'drizzle-kit';

// Offline generation only: no privileged connection URL is loaded here.
// Supabase CLI owns deployment/history. Do not use drizzle-kit push/migrate.
export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema.mts',
  out: './drizzle',
  schemaFilter: ['public'],
  strict: true,
  verbose: true,
});

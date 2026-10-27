import { sql } from 'drizzle-orm';
import { authUsers } from 'drizzle-orm/supabase';
import {
  bigint, boolean, check, index, pgEnum, pgTable,
  text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';

// authUsers is an existing provider-managed reference, deliberately NOT exported
// as an application table. Never generate/create Supabase's auth.users schema.
export const cebuRole = pgEnum('cebu_role', ['resident', 'officer', 'admin']);
export const cebuProvisioningState = pgEnum('cebu_provisioning_state', ['pending', 'ready']);

export const barangays = pgTable('barangays', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique('barangays_name_unique'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('barangays_name_valid', sql`${t.name} = btrim(${t.name}) and char_length(${t.name}) between 2 and 100`),
]).enableRLS();

export const profiles = pgTable('profiles', {
  userId: uuid('user_id').primaryKey().references(() => authUsers.id, { onDelete: 'restrict' }),
  displayName: text('display_name').notNull(),
  residentBarangayId: uuid('resident_barangay_id').references(() => barangays.id, { onDelete: 'restrict' }),
  version: bigint('version', { mode: 'number' }).notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('profiles_name_valid', sql`${t.displayName} = btrim(${t.displayName}) and char_length(${t.displayName}) between 2 and 80`),
  check('profiles_version_positive', sql`${t.version} > 0`),
  index('profiles_selected_barangay').on(t.residentBarangayId),
]).enableRLS();

export const accountAccess = pgTable('account_access', {
  userId: uuid('user_id').primaryKey().references(() => authUsers.id, { onDelete: 'restrict' }),
  productRole: cebuRole('product_role').notNull().default('resident'),
  enabled: boolean('enabled').notNull().default(true),
  provisioningState: cebuProvisioningState('provisioning_state').notNull().default('ready'),
  accessVersion: bigint('access_version', { mode: 'number' }).notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('access_version_positive', sql`${t.accessVersion} > 0`),
  check('pending_accounts_disabled', sql`${t.provisioningState} <> 'pending' or not ${t.enabled}`),
]).enableRLS();

export const officerAssignments = pgTable('officer_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  officerId: uuid('officer_id').notNull().references(() => accountAccess.userId, { onDelete: 'restrict' }),
  barangayId: uuid('barangay_id').notNull().references(() => barangays.id, { onDelete: 'restrict' }),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
}, (t) => [
  check('assignment_window_valid', sql`${t.effectiveTo} is null or ${t.effectiveTo} >= ${t.effectiveFrom}`),
  uniqueIndex('officer_one_current_assignment').on(t.officerId).where(sql`${t.effectiveTo} is null`),
  index('current_officers_by_barangay').on(t.barangayId, t.officerId).where(sql`${t.effectiveTo} is null`),
]).enableRLS();

export type Profile = typeof profiles.$inferSelect;
export type Barangay = typeof barangays.$inferSelect;
export type ProductRole = typeof cebuRole.enumValues[number];

// Policies, grants, triggers and privileged functions are owned by the reviewed
// custom security migration. Do not run schema push or introspection to replace it.

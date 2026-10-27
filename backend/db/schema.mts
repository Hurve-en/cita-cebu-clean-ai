import { sql } from 'drizzle-orm';
import { authUsers } from 'drizzle-orm/supabase';
import {
  bigint, boolean, check, index, integer, pgEnum, pgTable,
  text, time, timestamp, uniqueIndex, uuid,
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

// Community data foundation. No client write grant is introduced in this slice.
export const wasteStream = pgEnum('waste_stream', ['recyclables', 'organic', 'residual']);
export const scheduleStatus = pgEnum('schedule_status', ['draft', 'published', 'archived']);
export const reportStatus = pgEnum('report_status', ['pending_review', 'in_progress', 'resolved']);
export const reportEventType = pgEnum('report_event_type', ['created', 'status_changed', 'internal_note']);
export const reportVisibility = pgEnum('report_visibility', ['resident', 'internal']);

export const reportCategories = pgTable('report_categories', {
  code: text('code').primaryKey(),
  label: text('label').notNull(),
  enabled: boolean('enabled').notNull().default(true),
}, (t) => [
  check('category_code_valid', sql`${t.code} ~ '^[a-z][a-z0-9_]{1,49}$'`),
  check('category_label_valid', sql`${t.label} = btrim(${t.label}) and char_length(${t.label}) between 2 and 80`),
]).enableRLS();

export const collectionSchedules = pgTable('collection_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  barangayId: uuid('barangay_id').notNull().references(() => barangays.id, { onDelete: 'restrict' }),
  title: text('title').notNull(),
  stream: wasteStream('stream').notNull(),
  // ISO weekday numbers 1=Monday through 7=Sunday, ascending and unique.
  weekdays: integer('weekdays').array().notNull(),
  startTime: time('start_time', { precision: 0 }).notNull(),
  endTime: time('end_time', { precision: 0 }).notNull(),
  timezone: text('timezone').notNull().default('Asia/Manila'),
  area: text('area').notNull(),
  instructions: text('instructions').notNull().default(''),
  status: scheduleStatus('status').notNull().default('draft'),
  version: bigint('version', { mode: 'number' }).notNull().default(1),
  createdBy: uuid('created_by').notNull().references(() => authUsers.id, { onDelete: 'restrict' }),
  updatedBy: uuid('updated_by').notNull().references(() => authUsers.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('schedule_title_valid', sql`${t.title} = btrim(${t.title}) and char_length(${t.title}) between 3 and 80`),
  check('schedule_area_valid', sql`${t.area} = btrim(${t.area}) and char_length(${t.area}) between 3 and 150`),
  check('schedule_instructions_valid', sql`char_length(${t.instructions}) <= 1000`),
  check('schedule_version_positive', sql`${t.version} > 0`),
  check('schedule_timezone_valid', sql`${t.timezone} = 'Asia/Manila'`),
  check('schedule_time_window_valid', sql`${t.startTime} < ${t.endTime}
    and ${t.endTime} < time '24:00' and extract(second from ${t.startTime}) = 0
    and extract(second from ${t.endTime}) = 0`),
  check('schedule_weekdays_valid', sql`cardinality(${t.weekdays}) between 1 and 7
    and array_ndims(${t.weekdays}) = 1 and array_lower(${t.weekdays}, 1) = 1
    and ${t.weekdays} <@ array[1,2,3,4,5,6,7]::integer[]
    and array_position(${t.weekdays}, null) is null
    and (cardinality(${t.weekdays}) < 2 or ${t.weekdays}[1] < ${t.weekdays}[2])
    and (cardinality(${t.weekdays}) < 3 or ${t.weekdays}[2] < ${t.weekdays}[3])
    and (cardinality(${t.weekdays}) < 4 or ${t.weekdays}[3] < ${t.weekdays}[4])
    and (cardinality(${t.weekdays}) < 5 or ${t.weekdays}[4] < ${t.weekdays}[5])
    and (cardinality(${t.weekdays}) < 6 or ${t.weekdays}[5] < ${t.weekdays}[6])
    and (cardinality(${t.weekdays}) < 7 or ${t.weekdays}[6] < ${t.weekdays}[7])`),
  index('schedules_community_status_order').on(t.barangayId, t.status, t.createdAt, t.id),
]).enableRLS();

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => authUsers.id, { onDelete: 'restrict' }),
  originalBarangayId: uuid('original_barangay_id').notNull().references(() => barangays.id, { onDelete: 'restrict' }),
  title: text('title').notNull(),
  categoryCode: text('category_code').notNull().references(() => reportCategories.code, { onDelete: 'restrict' }),
  locationText: text('location_text').notNull(),
  description: text('description').notNull(),
  status: reportStatus('status').notNull().default('pending_review'),
  version: bigint('version', { mode: 'number' }).notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('report_title_valid', sql`${t.title} = btrim(${t.title}) and char_length(${t.title}) between 3 and 120`),
  check('report_location_valid', sql`${t.locationText} = btrim(${t.locationText}) and char_length(${t.locationText}) between 3 and 200`),
  check('report_description_valid', sql`${t.description} = btrim(${t.description}) and char_length(${t.description}) between 10 and 2000`),
  check('report_version_positive', sql`${t.version} > 0`),
  index('reports_owner_order').on(t.ownerId, t.createdAt, t.id),
  index('reports_community_status_order').on(t.originalBarangayId, t.status, t.createdAt, t.id),
  index('reports_category').on(t.categoryCode),
]).enableRLS();

export const reportEvents = pgTable('report_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportId: uuid('report_id').notNull().references(() => reports.id, { onDelete: 'restrict' }),
  actorId: uuid('actor_id').notNull().references(() => authUsers.id, { onDelete: 'restrict' }),
  eventType: reportEventType('event_type').notNull(),
  previousStatus: reportStatus('previous_status'),
  nextStatus: reportStatus('next_status'),
  visibility: reportVisibility('visibility').notNull(),
  note: text('note').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('event_note_valid', sql`${t.note} = btrim(${t.note}) and char_length(${t.note}) <= 1000`),
  check('event_shape_valid', sql`(
    ${t.eventType} = 'created' and ${t.visibility} = 'resident'
    and ${t.previousStatus} is null and ${t.nextStatus} is not null and ${t.nextStatus} = 'pending_review'
  ) or (
    ${t.eventType} = 'internal_note' and ${t.visibility} = 'internal'
    and ${t.previousStatus} is null and ${t.nextStatus} is null and char_length(${t.note}) >= 1
  ) or (
    ${t.eventType} = 'status_changed' and ${t.visibility} = 'resident'
    and ${t.previousStatus} is not null and ${t.nextStatus} is not null
    and ((${t.previousStatus} = 'pending_review' and ${t.nextStatus} in ('in_progress','resolved'))
      or (${t.previousStatus} = 'in_progress' and ${t.nextStatus} = 'resolved')
      or (${t.previousStatus} = 'resolved' and ${t.nextStatus} = 'in_progress'))
    and ((${t.nextStatus} <> 'resolved' and ${t.previousStatus} <> 'resolved') or char_length(${t.note}) >= 8)
  )`),
  index('report_events_report_order').on(t.reportId, t.createdAt, t.id),
  index('report_events_actor').on(t.actorId),
]).enableRLS();

export type CollectionSchedule = typeof collectionSchedules.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type ReportEvent = typeof reportEvents.$inferSelect;

// Policies, grants, triggers and privileged functions are owned by the reviewed
// custom security migration. Do not run schema push or introspection to replace it.

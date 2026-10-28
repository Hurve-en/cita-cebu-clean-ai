import { sql } from 'drizzle-orm';
import { authUsers } from 'drizzle-orm/supabase';
import {
  bigint, boolean, check, index, integer, jsonb, primaryKey, pgEnum, pgTable,
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

// Private-by-privilege idempotency receipts; clients have no table access.
export const reportSubmissionReceipts = pgTable('report_submission_receipts', {
  ownerId: uuid('owner_id').notNull().references(() => accountAccess.userId, { onDelete: 'restrict' }),
  requestId: uuid('request_id').notNull(),
  payload: jsonb('payload').notNull(),
  reportId: uuid('report_id').notNull().unique('submission_report_unique').references(() => reports.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  primaryKey({ name: 'submission_owner_request_pk', columns: [t.ownerId, t.requestId] }),
  check('submission_payload_object', sql`jsonb_typeof(${t.payload}) = 'object'`),
  check('submission_request_not_nil', sql`${t.requestId} <> '00000000-0000-0000-0000-000000000000'::uuid`),
]).enableRLS();

// Policies, grants, triggers and privileged functions are owned by the reviewed
// custom security migration. Do not run schema push or introspection to replace it.

// App-owned media metadata only. Supabase owns storage.objects/storage.buckets.
export const residentMedia = pgTable('resident_media', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => accountAccess.userId, { onDelete: 'restrict' }),
  requestId: uuid('request_id').notNull(),
  kind: text('kind').notNull(),
  reportId: uuid('report_id').references(() => reports.id, { onDelete: 'restrict' }),
  label: text('label'),
  score: text('score'),
  modelVersion: text('model_version'),
  byteSize: integer('byte_size').notNull(),
  state: text('state').notNull().default('uploading'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  readyAt: timestamp('ready_at', { withTimezone: true }),
}, t => [
  uniqueIndex('media_owner_request').on(t.ownerId, t.requestId),
  uniqueIndex('media_one_report_photo').on(t.reportId).where(sql`${t.reportId} is not null and ${t.state} <> 'deleted'`),
  index('media_owner_order').on(t.ownerId, t.createdAt, t.id),
  check('media_size_valid', sql`${t.byteSize} between 1 and 2097152`),
  check('media_request_valid', sql`${t.requestId} <> '00000000-0000-0000-0000-000000000000'::uuid`),
  check('media_state_valid', sql`${t.state} in ('uploading','ready','delete_pending','deleted')`),
  check('media_ready_valid', sql`${t.state} <> 'ready' or ${t.readyAt} is not null`),
  check('media_shape_valid', sql`${t.state} = 'deleted' or (${t.kind} = 'disposal_photo' and ${t.reportId} is null and ${t.label} is null and ${t.score} is null and ${t.modelVersion} is null) or (${t.kind} = 'report_photo' and ${t.reportId} is not null and ${t.label} is null and ${t.score} is null and ${t.modelVersion} is null) or (${t.kind} = 'scan' and ${t.reportId} is null and ${t.label} is not null and ${t.label} in ('glass','metal','non-recyclable','organic','paper','plastic') and ${t.score} is not null and ${t.score} ~ '^(0([.][0-9]{1,8})?|1([.]0{1,8})?)$' and ${t.modelVersion} is not null and ${t.modelVersion} = 'mobilenetv2-d0744dc70738-v1')`),
]).enableRLS();

// Rewards: immutable ledger; all writes use reviewed RPCs in custom SQL.
export const rewardRules = pgTable('reward_rules', {
  id: integer('id').primaryKey().default(1),
  disposalPoints: integer('disposal_points').notNull().default(10),
  cleanupPoints: integer('cleanup_points').notNull().default(50),
  dailyClaimLimit: integer('daily_claim_limit').notNull().default(3),
}, t=>[check('reward_rules_valid',sql`${t.id}=1 and ${t.disposalPoints} between 1 and 1000 and ${t.cleanupPoints} > ${t.disposalPoints} and ${t.cleanupPoints} <= 10000 and ${t.dailyClaimLimit} between 1 and 10`)]).enableRLS();
export const rewardCatalog = pgTable('reward_catalog', {
  id: uuid('id').primaryKey().defaultRandom(), name:text('name').notNull(), description:text('description').notNull(),
  cost:integer('cost').notNull(),stock:integer('stock').notNull().default(0),enabled:boolean('enabled').notNull().default(false),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[check('reward_catalog_valid',sql`char_length(${t.name}) between 3 and 100 and char_length(${t.description}) between 10 and 1000 and ${t.cost} between 1 and 1000000 and ${t.stock} >= 0`)]).enableRLS();
export const cleanupEvents=pgTable('cleanup_events',{
  id:uuid('id').primaryKey().defaultRandom(),barangayId:uuid('barangay_id').notNull().references(()=>barangays.id),
  title:text('title').notNull(),location:text('location').notNull(),instructions:text('instructions').notNull(),
  startsAt:timestamp('starts_at',{withTimezone:true}).notNull(),endsAt:timestamp('ends_at',{withTimezone:true}).notNull(),
  points:integer('points').notNull(),capacity:integer('capacity').notNull(),status:text('status').notNull().default('published'),
  createdBy:uuid('created_by').notNull().references(()=>accountAccess.userId),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[check('cleanup_event_valid',sql`char_length(${t.title}) between 3 and 100 and char_length(${t.location}) between 3 and 200 and char_length(${t.instructions}) between 10 and 2000 and ${t.endsAt}>${t.startsAt} and ${t.points} between 2 and 10000 and ${t.capacity} between 1 and 10000 and ${t.status} in ('published','cancelled')`),index('cleanup_community_order').on(t.barangayId,t.startsAt,t.id)]).enableRLS();
export const disposalClaims=pgTable('disposal_claims',{
  id:uuid('id').primaryKey().defaultRandom(),ownerId:uuid('owner_id').notNull().references(()=>accountAccess.userId),requestId:uuid('request_id').notNull(),
  barangayId:uuid('barangay_id').notNull().references(()=>barangays.id),beforeId:uuid('before_id').notNull().references(()=>residentMedia.id),afterId:uuid('after_id').references(()=>residentMedia.id),
  location:text('location').notNull(),description:text('description').notNull(),points:integer('points').notNull(),status:text('status').notNull().default('pending'),
  reviewNote:text('review_note').notNull().default(''),reviewedBy:uuid('reviewed_by').references(()=>accountAccess.userId),reviewedAt:timestamp('reviewed_at',{withTimezone:true}),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[uniqueIndex('claim_owner_request').on(t.ownerId,t.requestId),index('claim_owner_order').on(t.ownerId,t.createdAt,t.id),index('claim_community_status').on(t.barangayId,t.status),check('claim_valid',sql`(${t.afterId} is null or ${t.beforeId}<>${t.afterId}) and ${t.requestId}<>'00000000-0000-0000-0000-000000000000'::uuid and char_length(${t.location}) between 3 and 200 and char_length(${t.description}) between 10 and 2000 and ${t.points} between 1 and 10000 and ${t.status} in ('pending','approved','rejected') and char_length(${t.reviewNote})<=1000 and ((${t.status}='pending' and ${t.reviewedBy} is null and ${t.reviewedAt} is null) or (${t.status}<>'pending' and ${t.reviewedAt} is not null and char_length(${t.reviewNote})>=8))`)]).enableRLS();
export const cleanupParticipants=pgTable('cleanup_participants',{
  id:uuid('id').primaryKey().defaultRandom(),ownerId:uuid('owner_id').notNull().references(()=>accountAccess.userId),eventId:uuid('event_id').notNull().references(()=>cleanupEvents.id),
  status:text('status').notNull().default('joined'),reviewNote:text('review_note').notNull().default(''),reviewedBy:uuid('reviewed_by').references(()=>accountAccess.userId),reviewedAt:timestamp('reviewed_at',{withTimezone:true}),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[uniqueIndex('cleanup_once_per_resident').on(t.ownerId,t.eventId),check('participant_valid',sql`${t.status} in ('joined','completed','rejected','cancelled') and char_length(${t.reviewNote})<=1000 and ((${t.status} in ('joined','cancelled') and ${t.reviewedBy} is null and ${t.reviewedAt} is null) or (${t.status} not in ('joined','cancelled') and ${t.reviewedBy} is not null and ${t.reviewedAt} is not null and char_length(${t.reviewNote})>=8))`)]).enableRLS();
export const rewardRedemptions=pgTable('reward_redemptions',{
  id:uuid('id').primaryKey().defaultRandom(),ownerId:uuid('owner_id').notNull().references(()=>accountAccess.userId),requestId:uuid('request_id').notNull(),rewardId:uuid('reward_id').notNull().references(()=>rewardCatalog.id),
  barangayId:uuid('barangay_id').notNull().references(()=>barangays.id),rewardName:text('reward_name').notNull(),cost:integer('cost').notNull(),status:text('status').notNull().default('pending'),
  reviewNote:text('review_note').notNull().default(''),fulfilledBy:uuid('fulfilled_by').references(()=>accountAccess.userId),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[uniqueIndex('redemption_owner_request').on(t.ownerId,t.requestId),index('redemption_owner_order').on(t.ownerId,t.createdAt,t.id),check('redemption_valid',sql`${t.cost}>0 and ${t.requestId}<>'00000000-0000-0000-0000-000000000000'::uuid and ${t.status} in ('pending','fulfilled','cancelled') and char_length(${t.reviewNote})<=1000`)]).enableRLS();
export const rewardLedger=pgTable('reward_ledger',{
  id:uuid('id').primaryKey().defaultRandom(),ownerId:uuid('owner_id').notNull().references(()=>accountAccess.userId),amount:integer('amount').notNull(),
  kind:text('kind').notNull(),sourceId:uuid('source_id').notNull(),actorId:uuid('actor_id').notNull().references(()=>accountAccess.userId),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[uniqueIndex('ledger_source_once').on(t.kind,t.sourceId),index('ledger_owner_order').on(t.ownerId,t.createdAt,t.id),check('ledger_valid',sql`(${t.kind} in ('disposal','scan','cleanup','refund') and ${t.amount}>0) or (${t.kind}='redemption' and ${t.amount}<0)`)]).enableRLS();

export const scanRewardConfig = pgTable('scan_reward_config', {
 id:integer('id').primaryKey().default(1),autoAwardsEnabled:boolean('auto_awards_enabled').notNull().default(false),
 dailyAwards:integer('daily_awards').notNull().default(3),dailyPoints:integer('daily_points').notNull().default(30),
 hourlyStarts:integer('hourly_starts').notNull().default(5),dailyStarts:integer('daily_starts').notNull().default(10),
},t=>[check('scan_config_valid',sql`${t.id}=1 and ${t.dailyAwards} between 1 and 10 and ${t.dailyPoints} between 1 and 1000 and ${t.hourlyStarts} between 1 and 20 and ${t.dailyStarts} between 1 and 50`)]).enableRLS();
export const scanRewardSessions=pgTable('scan_reward_sessions',{
 cleanupEventId:uuid('cleanup_event_id').references(()=>cleanupEvents.id),
 id:uuid('id').primaryKey().defaultRandom(),ownerId:uuid('owner_id').notNull().references(()=>accountAccess.userId),requestId:uuid('request_id').notNull(),
 barangayId:uuid('barangay_id').notNull().references(()=>barangays.id),beforeId:uuid('before_id').references(()=>residentMedia.id),afterId:uuid('after_id').references(()=>residentMedia.id),
 fingers:integer('fingers').notNull(),points:integer('points').notNull(),status:text('status').notNull().default('capture'),reason:text('reason').notNull().default(''),
 createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),expiresAt:timestamp('expires_at',{withTimezone:true}).notNull(),
 submittedAt:timestamp('submitted_at',{withTimezone:true}),reviewedAt:timestamp('reviewed_at',{withTimezone:true}),
 lease:uuid('lease'),leasedAt:timestamp('leased_at',{withTimezone:true}),attempts:integer('attempts').notNull().default(0),verifier:text('verifier'),reviewedBy:uuid('reviewed_by').references(()=>accountAccess.userId),
},t=>[uniqueIndex('scan_reward_request').on(t.ownerId,t.requestId),uniqueIndex('scan_reward_before').on(t.beforeId),uniqueIndex('scan_reward_after').on(t.afterId),index('scan_reward_owner_order').on(t.ownerId,t.createdAt,t.id),
 check('scan_reward_valid',sql`${t.requestId}<>'00000000-0000-0000-0000-000000000000'::uuid and ${t.fingers} between 1 and 3 and ${t.points} between 1 and 1000 and ${t.expiresAt}>${t.createdAt} and ${t.attempts} between 0 and 3 and ${t.status} in ('capture','pending','review','approved','rejected') and (${t.beforeId} is null or ${t.afterId} is null or ${t.beforeId}<>${t.afterId})`)]).enableRLS();
export const rewardImageFingerprints=pgTable('reward_image_fingerprints',{
 sha256:text('sha256').primaryKey(),sessionId:uuid('session_id').notNull().references(()=>scanRewardSessions.id),dhash:text('dhash').notNull(),
},t=>[check('reward_fingerprint_valid',sql`${t.sha256} ~ '^[0-9a-f]{64}$' and ${t.dhash} ~ '^[0-9a-f]{16}$'`)]).enableRLS();

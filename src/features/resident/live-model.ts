export type Profile = {
  user_id: string;
  display_name: string;
  resident_barangay_id: string | null;
  version: number;
  barangay_name: string | null;
};
export type Barangay = { id: string; name: string };
export type Cursor = { id: string; created_at: string };
export type Schedule = Cursor & {
  barangay_id: string;
  title: string;
  stream: "recyclables" | "organic" | "residual";
  weekdays: number[];
  start_time: string;
  end_time: string;
  timezone: "Asia/Manila";
  area: string;
  instructions: string;
  status: "published";
};
export type Report = Cursor & {
  owner_id: string;
  original_barangay_id: string;
  title: string;
  category_code: string;
  location_text: string;
  description: string;
  status: "pending_review" | "in_progress" | "resolved";
  updated_at: string;
};
export type ReportEvent = Cursor & {
  report_id: string;
  event_type: "created" | "status_changed";
  previous_status: Report["status"] | null;
  next_status: Report["status"];
  visibility: "resident";
  note: string;
};
export type Page<T> = { rows: T[]; more: boolean };
export const PAGE_SIZE = 20;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function uuid(value: unknown): string {
  if (typeof value !== "string" || !uuidPattern.test(value))
    throw Error("Invalid record identifier.");
  return value;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Unexpected account data.");
  return value as Record<string, unknown>;
}
function text(v: unknown, max: number, min = 0): string {
  if (typeof v !== "string" || v.length < min || v.length > max)
    throw Error("Unexpected account data.");
  return v;
}
function date(v: unknown): string {
  if (typeof v !== "string" || !Number.isFinite(Date.parse(v)))
    throw Error("Invalid record date.");
  return new Date(v).toISOString();
}
function status(v: unknown): Report["status"] {
  if (!["pending_review", "in_progress", "resolved"].includes(String(v)))
    throw Error("Invalid report status.");
  return v as Report["status"];
}
export function profileRow(v: unknown, user: string): Profile {
  const a = object(v);
  if (
    uuid(a.user_id) !== user ||
    !Number.isSafeInteger(a.version) ||
    Number(a.version) < 1
  )
    throw Error("Profile could not be verified.");
  return {
    user_id: user,
    display_name: text(a.display_name, 80, 2),
    resident_barangay_id:
      a.resident_barangay_id === null ? null : uuid(a.resident_barangay_id),
    version: Number(a.version),
    barangay_name:
      a.barangay == null
        ? null
        : uuid(object(a.barangay).id) === a.resident_barangay_id
          ? text(object(a.barangay).name, 100, 2)
          : null,
  };
}
export function barangayRow(v: unknown): Barangay {
  const a = object(v);
  return { id: uuid(a.id), name: text(a.name, 100, 2) };
}
export function scheduleRow(v: unknown, barangay: string): Schedule {
  const a = object(v);
  if (
    uuid(a.barangay_id) !== barangay ||
    a.status !== "published" ||
    a.timezone !== "Asia/Manila" ||
    !["recyclables", "organic", "residual"].includes(String(a.stream)) ||
    !Array.isArray(a.weekdays) ||
    a.weekdays.length < 1 ||
    a.weekdays.length > 7 ||
    a.weekdays.some(
      (d, i) =>
        !Number.isInteger(d) ||
        Number(d) < 1 ||
        Number(d) > 7 ||
        (i > 0 && Number(d) <= Number((a.weekdays as number[])[i - 1])),
    )
  )
    throw Error("Unexpected published schedule.");
  const start = text(a.start_time, 8, 5),
    end = text(a.end_time, 8, 5);
  if (
    !/^([01]\d|2[0-3]):[0-5]\d(:00)?$/.test(start) ||
    !/^([01]\d|2[0-3]):[0-5]\d(:00)?$/.test(end) ||
    start.slice(0, 5) >= end.slice(0, 5)
  )
    throw Error("Invalid collection window.");
  return {
    id: uuid(a.id),
    created_at: date(a.created_at),
    barangay_id: barangay,
    title: text(a.title, 80, 3),
    stream: a.stream as Schedule["stream"],
    weekdays: a.weekdays as number[],
    start_time: start,
    end_time: end,
    timezone: "Asia/Manila",
    area: text(a.area, 150, 3),
    instructions: text(a.instructions, 1000),
    status: "published",
  };
}
export function reportRow(v: unknown, user: string): Report {
  const a = object(v);
  if (uuid(a.owner_id) !== user) throw Error("Unexpected report ownership.");
  return {
    id: uuid(a.id),
    created_at: date(a.created_at),
    updated_at: date(a.updated_at),
    owner_id: user,
    original_barangay_id: uuid(a.original_barangay_id),
    title: text(a.title, 120, 3),
    category_code: text(a.category_code, 50, 2),
    location_text: text(a.location_text, 200, 3),
    description: text(a.description, 2000, 10),
    status: status(a.status),
  };
}
export function eventRow(v: unknown, report: string): ReportEvent {
  const a = object(v);
  if (
    uuid(a.report_id) !== report ||
    a.visibility !== "resident" ||
    !["created", "status_changed"].includes(String(a.event_type))
  )
    throw Error("Unexpected report activity.");
  return {
    id: uuid(a.id),
    created_at: date(a.created_at),
    report_id: report,
    event_type: a.event_type as ReportEvent["event_type"],
    previous_status:
      a.previous_status === null ? null : status(a.previous_status),
    next_status: status(a.next_status),
    visibility: "resident",
    note: text(a.note, 1000),
  };
}
// Only canonical timestamp/UUID values can enter a PostgREST cursor expression.
export function cursorFilter(cursor: Cursor, ascending: boolean) {
  const id = uuid(cursor.id),
    time = date(cursor.created_at),
    op = ascending ? "gt" : "lt";
  return `created_at.${op}.${time},and(created_at.eq.${time},id.${op}.${id})`;
}
export function page<T>(value: unknown, parse: (row: unknown) => T): Page<T> {
  if (!Array.isArray(value) || value.length > PAGE_SIZE + 1)
    throw Error("Unexpected collection response.");
  const rows = value.map(parse);
  return { rows: rows.slice(0, PAGE_SIZE), more: rows.length > PAGE_SIZE };
}
export function mergeRows<T extends { id: string }>(old: T[], next: T[]): T[] {
  const seen = new Set(old.map((r) => r.id));
  return [...old, ...next.filter((r) => !seen.has(r.id))];
}
export const statusLabel = (value: Report["status"]) =>
  ({
    pending_review: "Pending review",
    in_progress: "In progress",
    resolved: "Resolved",
  })[value];
export const weekdayLabel = (days: number[]) =>
  days
    .map((day) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day - 1])
    .join(" · ");
export const timeLabel = (row: Schedule) =>
  `${row.start_time.slice(0, 5)}–${row.end_time.slice(0, 5)} · Philippine time`;
export const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

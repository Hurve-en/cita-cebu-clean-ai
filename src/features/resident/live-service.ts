import type { SupabaseClient } from "@supabase/supabase-js";
import {
  barangayRow,
  cursorFilter,
  eventRow,
  page,
  PAGE_SIZE,
  profileRow,
  reportRow,
  scheduleRow,
  uuid,
  type Cursor,
  type Profile,
} from "./live-model";
const PROFILE = "user_id,display_name,resident_barangay_id,version";
const SCHEDULE =
  "id,created_at,barangay_id,title,stream,weekdays,start_time,end_time,timezone,area,instructions,status";
const REPORT =
  "id,created_at,updated_at,owner_id,original_barangay_id,title,category_code,location_text,description,status";
const EVENT =
  "id,created_at,report_id,event_type,previous_status,next_status,visibility,note";
function checked<T>(result: { data: T; error: unknown }, label: string): T {
  if (result.error)
    throw Error(
      `${label} could not be loaded. Check your connection and retry.`,
    );
  return result.data;
}
export function createResidentReadService(client: SupabaseClient) {
  return {
    async profile(user: string) {
      uuid(user);
      return profileRow(
        checked(
          await client
            .from("profiles")
            .select(PROFILE + ",barangay:barangays(id,name)")
            .eq("user_id", user)
            .single(),
          "Your profile",
        ),
        user,
      );
    },
    async barangays(after?: string) {
      let query = client
        .from("barangays")
        .select("id,name")
        .eq("enabled", true)
        .order("id")
        .limit(PAGE_SIZE + 1);
      if (after) query = query.gt("id", uuid(after));
      return page(checked(await query, "Barangays"), barangayRow);
    },
    async schedules(barangay: string, cursor?: Cursor) {
      let query = client
        .from("collection_schedules")
        .select(SCHEDULE)
        .eq("barangay_id", uuid(barangay))
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(PAGE_SIZE + 1);
      if (cursor) query = query.or(cursorFilter(cursor, false));
      return page(checked(await query, "Collection schedules"), (v) =>
        scheduleRow(v, barangay),
      );
    },
    async schedule(barangay: string, id: string) {
      const value = checked(
        await client
          .from("collection_schedules")
          .select(SCHEDULE)
          .eq("barangay_id", uuid(barangay))
          .eq("status", "published")
          .eq("id", uuid(id))
          .maybeSingle(),
        "This schedule",
      );
      return value === null ? null : scheduleRow(value, barangay);
    },
    async reports(user: string, cursor?: Cursor) {
      let query = client
        .from("reports")
        .select(REPORT)
        .eq("owner_id", uuid(user))
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(PAGE_SIZE + 1);
      if (cursor) query = query.or(cursorFilter(cursor, false));
      return page(checked(await query, "Your reports"), (v) =>
        reportRow(v, user),
      );
    },
    async report(user: string, id: string) {
      const value = checked(
        await client
          .from("reports")
          .select(REPORT)
          .eq("owner_id", uuid(user))
          .eq("id", uuid(id))
          .maybeSingle(),
        "This report",
      );
      return value === null ? null : reportRow(value, user);
    },
    async events(report: string, cursor?: Cursor) {
      let query = client
        .from("report_events")
        .select(EVENT)
        .eq("report_id", uuid(report))
        .eq("visibility", "resident")
        .order("created_at")
        .order("id")
        .limit(PAGE_SIZE + 1);
      if (cursor) query = query.or(cursorFilter(cursor, true));
      return page(checked(await query, "Report activity"), (v) =>
        eventRow(v, report),
      );
    },
    async updateProfile(
      user: string,
      current: Profile,
      name: string,
      barangay: string | null,
    ) {
      uuid(user);
      if (current.user_id !== user)
        throw Error("The account changed. Reload your profile.");
      const clean = name.trim();
      if (clean.length < 2 || clean.length > 80)
        throw Error("Enter a name between 2 and 80 characters.");
      if (barangay !== null) uuid(barangay);
      // Pin the mutation to the user who opened this form, even if the shared
      // client's identity changes while its request is being prepared.
      const session = await client.auth.getSession();
      if (session.error || session.data.session?.user.id !== user)
        throw Error("The account changed. Reload before saving.");
      const result = await client
        .rpc("update_own_profile", {
          p_display_name: clean,
          p_resident_barangay_id: barangay,
          p_expected_version: current.version,
        })
        .setHeader(
          "Authorization",
          `Bearer ${session.data.session.access_token}`,
        );
      if (result.error)
        throw Error(
          result.error.code === "40001"
            ? "Your profile changed elsewhere. Reload before saving."
            : "Your profile could not be saved. Check your account access and retry.",
        );
      return profileRow(
        Array.isArray(result.data) ? result.data[0] : result.data,
        user,
      );
    },
  };
}
export type ResidentReadService = ReturnType<typeof createResidentReadService>;

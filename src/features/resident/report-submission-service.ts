import type { SupabaseClient } from "@supabase/supabase-js";
import { categoryCode, submissionResult, SubmissionError, type PendingReport } from "./report-submission";
export type ReportCategory = { code: string; label: string };
export function createReportSubmissionService(client: SupabaseClient) {
  return {
    async categories(after?: string) {
      let query = client.from("report_categories").select("code,label").eq("enabled", true).order("code").limit(21);
      if (after) query = query.gt("code", categoryCode(after));
      const { data, error } = await query;
      if (error) throw Error("Report categories could not be loaded. Check your connection and retry.");
      if (!Array.isArray(data) || data.length > 21) throw Error("Unexpected category response.");
      const rows: ReportCategory[] = data.map(row => {
        if (typeof row.label !== "string" || row.label.length < 2 || row.label.length > 80) throw Error("Unexpected category label.");
        return { code: categoryCode(row.code), label: row.label };
      });
      return { rows: rows.slice(0, 20), more: rows.length > 20 };
    },
    async send(pending: PendingReport) {
      const session = await client.auth.getSession();
      if (session.error || session.data.session?.user.id !== pending.owner) throw new SubmissionError("42501", "Account changed. Reload before submitting.");
      const d = pending.draft;
      const result = await client.rpc("submit_resident_report", {
        p_request_id: pending.requestId, p_expected_barangay_id: d.barangay,
        p_title: d.title, p_category_code: d.category, p_location_text: d.location,
        p_description: d.description,
      }).setHeader("Authorization", `Bearer ${session.data.session.access_token}`);
      if (result.error) throw new SubmissionError(result.error.code, "Report submission could not be confirmed.");
      return submissionResult(result.data, pending);
    },
  };
}

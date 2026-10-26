/** In-memory adapter. Replace with authenticated backend calls during integration. */
export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
export const STREAMS = ["Recyclables", "Organic", "Residual"] as const;
export const REPORT_STATUSES = [
  "Pending review",
  "In progress",
  "Resolved",
] as const;
export type Day = (typeof DAYS)[number];
export type Stream = (typeof STREAMS)[number];
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export type ScheduleStatus = "Draft" | "Published" | "Archived";
export type OfficerSession = {
  id: string;
  name: string;
  email: string;
  barangayId: string;
  barangayName: string;
};
export type ScheduleDraft = {
  title: string;
  stream: Stream;
  days: Day[];
  startTime: string;
  endTime: string;
  location: string;
  instructions: string;
  status: "Draft" | "Published";
};
export type CollectionSchedule = Omit<ScheduleDraft, "status"> & {
  id: string;
  barangayId: string;
  status: ScheduleStatus;
  updatedAt: string;
};
export type ReportEvent = {
  id: string;
  status: ReportStatus;
  note: string;
  actor: string;
  createdAt: string;
};
export type OfficerReport = {
  id: string;
  barangayId: string;
  title: string;
  category: string;
  location: string;
  description: string;
  reporter: string;
  status: ReportStatus;
  createdAt: string;
  events: ReportEvent[];
};
export type OfficerData = {
  schedules: CollectionSchedule[];
  reports: OfficerReport[];
};
export const DEMO_OFFICER: OfficerSession = {
  id: "demo-officer",
  name: "Demo officer",
  email: "officer@example.com",
  barangayId: "demo-barangay",
  barangayName: "Demo Barangay",
};
let counter = 0;
const id = () => `${Date.now().toString(36)}-${++counter}`;
const ago = (hours: number) =>
  new Date(Date.now() - hours * 3600000).toISOString();
function seed(): OfficerData {
  return {
    schedules: [
      {
        id: "recyclables-week",
        barangayId: "demo-barangay",
        title: "Dry recyclables collection",
        stream: "Recyclables",
        days: ["Monday", "Thursday"],
        startTime: "08:00",
        endTime: "11:00",
        location: "Demo Zone 1 and Zone 2",
        instructions:
          "Separate clean and dry accepted recyclables. These are fictional collection times.",
        status: "Published",
        updatedAt: ago(24),
      },
      {
        id: "organic-week",
        barangayId: "demo-barangay",
        title: "Organic waste collection",
        stream: "Organic",
        days: ["Wednesday"],
        startTime: "07:00",
        endTime: "10:00",
        location: "Demo market area",
        instructions:
          "Separate food scraps from packaging. Follow local containment rules.",
        status: "Published",
        updatedAt: ago(12),
      },
      {
        id: "residual-draft",
        barangayId: "demo-barangay",
        title: "Residual collection plan",
        stream: "Residual",
        days: ["Friday"],
        startTime: "08:00",
        endTime: "11:00",
        location: "Demo Zone 3",
        instructions: "",
        status: "Draft",
        updatedAt: ago(3),
      },
      {
        id: "outside-schedule",
        barangayId: "other-barangay",
        title: "Other community schedule",
        stream: "Residual",
        days: ["Tuesday"],
        startTime: "08:00",
        endTime: "10:00",
        location: "Outside assignment",
        instructions: "",
        status: "Published",
        updatedAt: ago(4),
      },
    ],
    reports: [
      {
        id: "report-bin",
        barangayId: "demo-barangay",
        title: "Overflowing public bin",
        category: "Overflowing bin",
        location: "Demo market entrance",
        description:
          "The bin near the entrance is full and loose waste is reaching the walkway.",
        reporter: "Demo resident A",
        status: "Pending review",
        createdAt: ago(2),
        events: [
          {
            id: "bin-created",
            status: "Pending review",
            note: "Sample report received.",
            actor: "Demo resident A",
            createdAt: ago(2),
          },
        ],
      },
      {
        id: "report-dumping",
        barangayId: "demo-barangay",
        title: "Waste beside the drainage",
        category: "Illegal dumping",
        location: "Demo Zone 2, creek-side road",
        description:
          "Several bags of mixed waste have been left beside the drainage channel.",
        reporter: "Demo resident B",
        status: "In progress",
        createdAt: ago(26),
        events: [
          {
            id: "dump-assigned",
            status: "In progress",
            note: "A cleanup inspection is being coordinated.",
            actor: "Demo officer",
            createdAt: ago(6),
          },
          {
            id: "dump-created",
            status: "Pending review",
            note: "Sample report received.",
            actor: "Demo resident B",
            createdAt: ago(26),
          },
        ],
      },
      {
        id: "report-missed",
        barangayId: "demo-barangay",
        title: "Missed collection concern",
        category: "Missed collection",
        location: "Demo Zone 1",
        description:
          "Prepared bags remained at the designated collection point after the sample collection window.",
        reporter: "Demo resident C",
        status: "Resolved",
        createdAt: ago(48),
        events: [
          {
            id: "missed-done",
            status: "Resolved",
            note: "Sample follow-up collection completed and the point was cleared.",
            actor: "Demo officer",
            createdAt: ago(20),
          },
        ],
      },
      {
        id: "outside-report",
        barangayId: "other-barangay",
        title: "Outside assignment",
        category: "Other",
        location: "Other community",
        description:
          "This sample must not appear in the assigned officer workspace.",
        reporter: "Other demo resident",
        status: "Pending review",
        createdAt: ago(1),
        events: [],
      },
    ],
  };
}
export function validateSchedule(draft: ScheduleDraft): string | null {
  if (draft.title.trim().length < 3 || draft.title.trim().length > 80)
    return "Use a schedule title between 3 and 80 characters.";
  if (!STREAMS.includes(draft.stream)) return "Choose a waste stream.";
  if (!draft.days.length || draft.days.some((day) => !DAYS.includes(day)))
    return "Choose at least one collection day.";
  const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (!time.test(draft.startTime) || !time.test(draft.endTime))
    return "Use 24-hour times, for example 08:00 and 11:00.";
  if (draft.endTime <= draft.startTime)
    return "End time must be later on the same day.";
  if (draft.location.trim().length < 3 || draft.location.length > 150)
    return "Add a collection area between 3 and 150 characters.";
  if (draft.instructions.length > 1000)
    return "Keep instructions within 1,000 characters.";
  if (!["Draft", "Published"].includes(draft.status))
    return "Choose Draft or Published.";
  return null;
}
export function createOfficerService() {
  let records = seed();
  let session: OfficerSession | null = null;
  function actor() {
    if (!session) throw new Error("Open the officer demo before continuing.");
    return session;
  }
  function snapshot(): OfficerData {
    const officer = actor();
    // This is mock scoping, NOT backend authorization.
    return JSON.parse(
      JSON.stringify({
        schedules: records.schedules.filter(
          (item) => item.barangayId === officer.barangayId,
        ),
        reports: records.reports.filter(
          (item) => item.barangayId === officer.barangayId,
        ),
      }),
    ) as OfficerData;
  }
  function scheduleFor(scheduleId: string) {
    const record = records.schedules.find(
      (item) =>
        item.id === scheduleId && item.barangayId === actor().barangayId,
    );
    if (!record)
      throw new Error(
        "This schedule is unavailable in your assigned community.",
      );
    return record;
  }
  return {
    start() {
      records = seed();
      session = { ...DEMO_OFFICER };
      return { session: { ...session }, data: snapshot() };
    },
    end() {
      session = null;
      records = seed();
    },
    async load() {
      return snapshot();
    },
    async saveSchedule(scheduleId: string | undefined, draft: ScheduleDraft) {
      const officer = actor();
      const error = validateSchedule(draft);
      if (error) throw new Error(error);
      const previous = scheduleId ? scheduleFor(scheduleId) : undefined;
      if (previous?.status === "Archived")
        throw new Error("Restore this schedule before editing it.");
      const record: CollectionSchedule = {
        ...draft,
        title: draft.title.trim(),
        days: DAYS.filter((day) => draft.days.includes(day)),
        location: draft.location.trim(),
        instructions: draft.instructions.trim(),
        id: previous?.id ?? id(),
        barangayId: officer.barangayId,
        updatedAt: new Date().toISOString(),
      };
      records.schedules = previous
        ? records.schedules.map((item) =>
            item.id === previous.id ? record : item,
          )
        : [...records.schedules, record];
      return snapshot();
    },
    async archiveSchedule(scheduleId: string) {
      const record = scheduleFor(scheduleId);
      record.status = "Archived";
      record.updatedAt = new Date().toISOString();
      return snapshot();
    },
    async restoreSchedule(scheduleId: string) {
      const record = scheduleFor(scheduleId);
      if (record.status !== "Archived")
        throw new Error("Only archived schedules need restoring.");
      record.status = "Draft";
      record.updatedAt = new Date().toISOString();
      return snapshot();
    },
    async updateReport(reportId: string, status: ReportStatus, note: string) {
      const officer = actor();
      const record = records.reports.find(
        (item) =>
          item.id === reportId && item.barangayId === officer.barangayId,
      );
      if (!record)
        throw new Error(
          "This report is unavailable in your assigned community.",
        );
      if (!REPORT_STATUSES.includes(status))
        throw new Error("Choose a valid report status.");
      if (note.trim().length > 1000)
        throw new Error("Keep notes within 1,000 characters.");
      if (status === "Resolved" && note.trim().length < 8)
        throw new Error("Explain the resolution in at least 8 characters.");
      if (status === record.status && !note.trim())
        throw new Error("Change the status or add an internal note.");
      record.status = status;
      record.events.unshift({
        id: id(),
        status,
        note: note.trim() || `Status changed to ${status.toLowerCase()}.`,
        actor: officer.name,
        createdAt: new Date().toISOString(),
      });
      return snapshot();
    },
  };
}

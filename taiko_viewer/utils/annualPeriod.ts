const ANNUAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const ANNUAL_REPORTING_WINDOW = Object.freeze({
  start: "2025-10-09",
  endInclusive: "2026-09-30",
  endExclusive: "2026-10-01",
  calendarDays: 357,
  timezone: "Asia/Shanghai",
  revision: "annual-report-2026-r2-final-window"
} as const);

export const formatAnnualCalendarDate = (value: string | null | undefined) => {
  const match = String(value || "").match(ANNUAL_DATE_PATTERN);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : String(value || "");
};

export const formatAnnualPeriodRange = (
  start: string | null | undefined,
  end: string | null | undefined
) => `${formatAnnualCalendarDate(start)} – ${formatAnnualCalendarDate(end)}`;

import type { AnnualVersion } from "./types";

export const ANNUAL_SCHEMA_VERSION = 4 as const;
export const ANNUAL_ALGORITHM_VERSION = "annual-observation-v4.1.4";
export const ANNUAL_VERSION_KEY = "annual_2026" as const;
export const ANNUAL_TIME_ZONE = "Asia/Shanghai" as const;
export const ANNUAL_SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const ANNUAL_START_DATE = "2025-10-09" as const;
export const ANNUAL_END_DATE = "2026-09-11" as const;
export const ANNUAL_PUBLIC_OPEN_AT = "2026-10-02T00:00:00+08:00" as const;
export const ANNUAL_POSTER_COOLDOWN_MS = 60 * 1000;
export const ANNUAL_BUILD_TIMEOUT_MS = 4 * 60 * 1000;
export const ANNUAL_RATING_TIMEOUT_MS = 10 * 60 * 1000;
export const ANNUAL_POSTER_TIMEOUT_MS = 60 * 1000;
export const ANNUAL_POSTER_WIDTH = 1080;
export const ANNUAL_POSTER_HEIGHT = 1440;
export const ANNUAL_MAX_EVENT_PAGE_SIZE = 200;

export const getAnnualVersion = (): AnnualVersion => ({
  key: ANNUAL_VERSION_KEY,
  name: "2026 太鼓年度回顾",
  startDate: ANNUAL_START_DATE,
  endDate: ANNUAL_END_DATE,
  effectiveEndDate: ANNUAL_END_DATE,
  isOngoing: false,
  timezone: ANNUAL_TIME_ZONE
});

export const resolveAnnualVersion = (input: unknown) => {
  const value = String(input || ANNUAL_VERSION_KEY).trim();
  if (value !== ANNUAL_VERSION_KEY) return null;
  return getAnnualVersion();
};

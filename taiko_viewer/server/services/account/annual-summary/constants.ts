import type { AnnualVersion } from "./types";

export const ANNUAL_SCHEMA_VERSION = 4 as const;
export const ANNUAL_ALGORITHM_VERSION = "annual-v4.0.0";
export const ANNUAL_VERSION_KEY = "annual_2026" as const;
export const ANNUAL_TIME_ZONE = "Asia/Shanghai" as const;
export const ANNUAL_SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const ANNUAL_FORCE_BUILD_COOLDOWN_MS = 10 * 60 * 1000;
export const ANNUAL_POSTER_COOLDOWN_MS = 60 * 1000;
export const ANNUAL_BUILD_TIMEOUT_MS = 4 * 60 * 1000;
export const ANNUAL_RATING_TIMEOUT_MS = 10 * 60 * 1000;
export const ANNUAL_POSTER_TIMEOUT_MS = 60 * 1000;
export const ANNUAL_POSTER_WIDTH = 1080;
export const ANNUAL_POSTER_HEIGHT = 1440;
export const ANNUAL_MAX_EVENT_PAGE_SIZE = 200;

const shanghaiDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: ANNUAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

export const getAnnualVersion = (): AnnualVersion => ({
  key: ANNUAL_VERSION_KEY,
  name: "2026 太鼓回顾（持续更新）",
  startDate: "2026-01-01",
  endDate: null,
  effectiveEndDate: shanghaiDate(),
  isOngoing: true,
  timezone: ANNUAL_TIME_ZONE
});

export const resolveAnnualVersion = (input: unknown) => {
  const value = String(input || ANNUAL_VERSION_KEY).trim();
  if (value !== ANNUAL_VERSION_KEY) return null;
  return getAnnualVersion();
};

import type { AnnualVersion } from "./types";
import { ANNUAL_REPORTING_WINDOW } from "~/utils/annualPeriod";

export const ANNUAL_SCHEMA_VERSION = 4 as const;
export const ANNUAL_ALGORITHM_VERSION = "annual-observation-v4.5.4";
export const ANNUAL_VERSION_KEY = "annual_2026" as const;
export const ANNUAL_TIME_ZONE = ANNUAL_REPORTING_WINDOW.timezone;
export const ANNUAL_SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export { ANNUAL_REPORTING_WINDOW };
export const ANNUAL_START_DATE = ANNUAL_REPORTING_WINDOW.start;
export const ANNUAL_END_DATE = ANNUAL_REPORTING_WINDOW.endInclusive;
export const ANNUAL_REPORT_REVISION = ANNUAL_REPORTING_WINDOW.revision;
export const ANNUAL_PRODUCER_REVISION = `${ANNUAL_ALGORITHM_VERSION}:${ANNUAL_REPORT_REVISION}`;
export const ANNUAL_PUBLIC_OPEN_AT = "2026-10-02T00:00:00+08:00" as const;
export const ANNUAL_POSTER_COOLDOWN_MS = 60 * 1000;
export const ANNUAL_BUILD_TIMEOUT_MS = 4 * 60 * 1000;
export const ANNUAL_RATING_TIMEOUT_MS = 10 * 60 * 1000;
export const ANNUAL_POSTER_TIMEOUT_MS = 60 * 1000;
export const ANNUAL_POSTER_WIDTH = 1080;
export const ANNUAL_POSTER_HEIGHT = 1440;
// The share card keeps the square_bg 363x554 ratio instead of the legacy poster frame.
export const ANNUAL_SHARE_CARD_WIDTH = 1080;
export const ANNUAL_SHARE_CARD_CONTENT_HEIGHT = 1648;
export const ANNUAL_SHARE_CARD_PROMO_FOOTER_HEIGHT = 224;
export const ANNUAL_SHARE_CARD_HEIGHT = ANNUAL_SHARE_CARD_CONTENT_HEIGHT + ANNUAL_SHARE_CARD_PROMO_FOOTER_HEIGHT;
export const ANNUAL_SHARE_CARD_PROMO_URL = "https://viewer.sakura-bot.cn/annual?from=poster";
// Bump when the rendered share-card markup or CSS changes so cached files are re-rendered.
export const ANNUAL_SHARE_CARD_RENDERER_REVISION = "share-card-v4-static-capture";
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

export const getAnnualGeneratorVersion = () => ({
  ...getAnnualVersion(),
  endExclusive: ANNUAL_REPORTING_WINDOW.endExclusive,
  calendarDays: ANNUAL_REPORTING_WINDOW.calendarDays,
  reportRevision: ANNUAL_REPORT_REVISION
});

export const resolveAnnualVersion = (input: unknown) => {
  const value = String(input || ANNUAL_VERSION_KEY).trim();
  if (value !== ANNUAL_VERSION_KEY) return null;
  return getAnnualVersion();
};

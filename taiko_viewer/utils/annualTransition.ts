export const PERIOD_OVERVIEW_DURATION_MS = 1600;
export const PERIOD_OVERVIEW_REDUCED_DURATION_MS = 180;

export const clampPeriodOverviewTime = (value: number) =>
  Math.max(0, Math.min(PERIOD_OVERVIEW_DURATION_MS, Number.isFinite(value) ? value : 0));

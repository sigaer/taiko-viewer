import { createError } from "h3";

export type VersionSummaryWindow = {
  key: string;
  name: string;
  startDate: string;
  endDate: string | null;
};

const VERSION_SUMMARY_WINDOWS: VersionSummaryWindow[] = [
  {
    key: "nijiiro_2025",
    name: "虹2025",
    startDate: "2026-01-01",
    endDate: null
  }
];

export const listVersionSummaryWindows = () => VERSION_SUMMARY_WINDOWS.map((item) => ({ ...item }));

export const getDefaultVersionSummaryWindow = () => VERSION_SUMMARY_WINDOWS[0];

export const resolveVersionSummaryWindow = (versionKey?: string | null) => {
  if (!versionKey) {
    return getDefaultVersionSummaryWindow();
  }
  const target = VERSION_SUMMARY_WINDOWS.find((item) => item.key === versionKey);
  if (!target) {
    throw createError({ statusCode: 400, statusMessage: "版本参数无效" });
  }
  return target;
};

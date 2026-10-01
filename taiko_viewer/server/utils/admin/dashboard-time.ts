// Viewer rollups persist UTC wall-clock text; bot rollups and account DATEs
// persist Shanghai wall-clock text. Keep these contracts explicit at the edge.
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

export const dashboardDayKey = (date: Date) =>
  new Date(date.getTime() + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);

export const dashboardBucketStart = (date: Date, granularity: "hour" | "day") => {
  const shifted = new Date(date.getTime() + SHANGHAI_OFFSET_MS);
  shifted.setUTCMinutes(0, 0, 0);
  if (granularity === "day") shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - SHANGHAI_OFFSET_MS);
};

export const dashboardRollupTime = (text: string, source: "viewer" | "bot") => {
  const date = new Date(text.replace(" ", "T") + (source === "viewer" ? "Z" : "+08:00"));
  const local = new Date(date.getTime() + SHANGHAI_OFFSET_MS).toISOString();
  return { bucket: date.toISOString(), label: local.slice(5, 16).replace("T", " "), day: local.slice(0, 10) };
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const parseNginxLogTime = (raw: string) => {
  const match = raw.match(/^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/);
  if (!match) return null;
  const [, day, month, year, hour, minute, second, sign, offsetHours, offsetMinutes] = match;
  const monthIndex = MONTHS.indexOf(month);
  if (monthIndex < 0) return null;
  const offset = (Number(offsetHours) * 60 + Number(offsetMinutes)) * (sign === "+" ? 1 : -1);
  const date = new Date(Date.UTC(Number(year), monthIndex, Number(day), Number(hour), Number(minute), Number(second)) - offset * 60000);
  return Number.isNaN(date.getTime()) ? null : date;
};

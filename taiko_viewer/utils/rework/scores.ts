// Stage 2 slice B: pure helpers of the signed-in player's score pages (score list, rating / progress images,
// recommendations). Presentation only: requests, responses and business rules stay where they are.

/**
 * How a failed account read is presented. The account score endpoints answer
 *   400 "请先绑定鼓众 ID"                                   → the player has no bound ID   → binding prompt
 *   404 "未找到本地成绩数据，请先在「多端同步」更新数据"       → bound, no score data yet      → empty state + sync
 * (server/services/account/personal.ts, charts.ts, progress.ts). Anything else is a failure with retry.
 * A 400 without the binding wording (an invalid parameter) stays a failure.
 */
export type AccountReadKind = "binding" | "noData" | "failed";

export function accountReadKind(status: unknown, message: unknown = ""): AccountReadKind {
  const code = Number(status) || 0;
  const text = String(message || "");
  // "绑定" (bind) in the server message; written as escapes, the message is data and not copy of this module
  if (code === 400 && /绑定/.test(text)) return "binding";
  if (code === 404) return "noData";
  return "failed";
}

/** HTTP status of a $fetch / ofetch error (statusCode, status or response.status). 0 when unknown. */
export function errorStatus(error: unknown): number {
  const e = error as { statusCode?: unknown; status?: unknown; response?: { status?: unknown } } | null;
  return Number(e?.statusCode ?? e?.status ?? e?.response?.status) || 0;
}

/** Server statusMessage of a $fetch error (JSON body), or "". Blob bodies are read by resolveViewerError instead. */
export function errorStatusMessage(error: unknown): string {
  const e = error as { data?: unknown; statusMessage?: unknown } | null;
  const data = e?.data as { statusMessage?: unknown; message?: unknown } | undefined;
  if (data && typeof data === "object" && !(typeof Blob !== "undefined" && data instanceof Blob)) {
    return String(data.statusMessage || data.message || "");
  }
  return String(e?.statusMessage || "");
}

// ---------- Score list: mounted rows ----------

/** At most this many rows of one server page are mounted at once (V1.3 budget: ≤ 60 mounted rows). */
export const SCORE_ROW_WINDOW = 50;

/** Number of row windows for `count` rows (at least 1). */
export function rowWindowCount(count: number, size = SCORE_ROW_WINDOW): number {
  return Math.max(1, Math.ceil(Math.max(0, count) / size));
}

/** Rows of window `index` (0-based, clamped). */
export function rowWindow<T>(rows: readonly T[], index: number, size = SCORE_ROW_WINDOW): T[] {
  const last = rowWindowCount(rows.length, size) - 1;
  const at = Math.min(Math.max(0, Math.trunc(index) || 0), last);
  return rows.slice(at * size, at * size + size);
}

/** 1-based first and last row number of a window within the server page (for "51–100"). */
export function rowWindowRange(index: number, count: number, offset = 0, size = SCORE_ROW_WINDOW): { from: number; to: number } {
  const from = index * size + 1;
  return { from: offset + from, to: offset + Math.min(count, from + size - 1) };
}

/** Number of server pages (at least 1). */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
}

// ---------- Score list: values ----------

/** "2026-11-10 21:04:00" → "2026-11-10"; empty or unparseable → "—" (U+2014). */
export function scoreDate(value: unknown): string {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "—";
}

/** "2026-11-10 21:04:00" → "2026-11-10 21:04"; date only → the date; nothing → "—". Text, no time zone conversion. */
export function scoreDateTime(value: unknown): string {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!match) return "—";
  return match[4] ? `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}` : `${match[1]}-${match[2]}-${match[3]}`;
}

/**
 * Title and other-language title of a score row for the page language. The list API gives `title` (the Chinese
 * catalog name, or the custom title) and `titleJp` (Japanese name, may be empty).
 */
export function scoreTitles(row: { title?: string; titleJp?: string }, locale: string) {
  const zh = String(row.title || "").trim();
  const ja = String(row.titleJp || "").trim();
  if (locale === "ja" && ja) return { title: ja, titleLang: "ja", subtitle: zh && zh !== ja ? zh : null, subtitleLang: "zh-CN" };
  return { title: zh || ja, titleLang: zh ? "zh-CN" : "ja", subtitle: ja && ja !== zh ? ja : null, subtitleLang: "ja" };
}

/** Star level of a row as a number, or null ("" / missing). */
export function starOf(value: unknown): number | null {
  const n = Number(value);
  return value === "" || value === null || value === undefined || !Number.isFinite(n) || n <= 0 ? null : n;
}

// ---------- Recommendations ----------

/**
 * Ordinary recommendation reason: candidate indicator / reference indicator as a percentage, from the API's
 * deviationRatio ((candidate − reference) / reference; 0.05 = +5 %). One decimal.
 */
export function fitPercent(deviationRatio: unknown): number | null {
  const r = Number(deviationRatio);
  return Number.isFinite(r) ? Math.round((1 + r) * 1000) / 10 : null;
}

/** Signed deviation in percent with one decimal ("+5.0%", "−3.2%"); null input → "—". */
export function deviationText(deviationRatio: unknown): string {
  const r = Number(deviationRatio);
  if (!Number.isFinite(r) || deviationRatio === null || deviationRatio === "") return "—";
  const v = Math.round(r * 1000) / 10;
  return `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(1)}%`;
}

/** Fit scale shown under a recommendation: 80 %–120 %, the strict band 90 %–105 % (API `inStrictRange`). */
export const FIT_SCALE = { min: 80, max: 120, bandFrom: 90, bandTo: 105 } as const;

/** Position (0–100, two decimals) of a percentage on the fit scale, clamped to the ends. */
export function fitPosition(percent: number | null): number | null {
  if (percent === null || !Number.isFinite(percent)) return null;
  const { min, max } = FIT_SCALE;
  const p = ((Math.min(max, Math.max(min, percent)) - min) / (max - min)) * 100;
  return Math.round(p * 100) / 100;
}

/** Progress percentage clamped to 0–100 with one decimal (target recommendations). */
export function progressShare(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(Math.min(100, Math.max(0, n)) * 10) / 10 : 0;
}

// ---------- Shell: the 成绩 group ----------

/** Secondary tabs of the 成绩 (play) destination: every page of the group, current addresses. */
export const PLAY_TABS = [
  { key: "scores", to: "/account/songs" },
  { key: "b30", to: "/tools/b30" },
  { key: "trend", to: "/tools/trend" },
  { key: "progress", to: "/tools/progress" },
  { key: "recommend", to: "/tools/recommend" }
] as const;

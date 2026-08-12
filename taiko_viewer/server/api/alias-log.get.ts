import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

interface AliasLogEntry {
  time: string;
  action: string;
  user_id: string;
  user_nickname?: string;
  group_id?: number;
  group_name?: string;
  song_id: string;
  song_title: string;
  alias: string;
}

let parsedCache: { filePath: string; mtimeMs: number; data: AliasLogEntry[] } | null = null;

const findAliasLog = async () => {
  const possiblePaths = [
    resolve("/home/sigaer/taiko/logs/alias_action_log.json"),
    resolve(process.cwd(), "../../logs/alias_action_log.json"),
    resolve(process.cwd(), "../logs/alias_action_log.json"),
    resolve(process.cwd(), "logs/alias_action_log.json")
  ];
  for (const filePath of possiblePaths) {
    try {
      return { filePath, fileStat: await stat(filePath) };
    } catch {
      // Probe the next supported runtime layout.
    }
  }
  throw createError({ statusCode: 404, statusMessage: "Alias log file not found" });
};

const readAliasLogs = async () => {
  const { filePath, fileStat } = await findAliasLog();
  if (parsedCache?.filePath === filePath && parsedCache.mtimeMs === fileStat.mtimeMs) {
    return parsedCache.data;
  }
  const parsed = JSON.parse(await readFile(filePath, "utf8")) as AliasLogEntry[];
  const data = [...parsed].sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
  parsedCache = { filePath, mtimeMs: fileStat.mtimeMs, data };
  return data;
};

const positiveInteger = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export default defineEventHandler(async (event) => {
  setHeader(event, "Cache-Control", "no-store");
  const query = getQuery(event);
  const paginated = query.page !== undefined || query.pageSize !== undefined;
  const logs = await readAliasLogs();
  if (!paginated) {
    return { success: true, data: logs, total: logs.length };
  }

  const page = positiveInteger(query.page, 1);
  const pageSize = Math.min(100, positiveInteger(query.pageSize, 20));
  const keyword = String(query.keyword || "").trim().toLocaleLowerCase();
  const filtered = keyword
    ? logs.filter((entry) => [
        entry.song_id,
        entry.song_title,
        entry.alias,
        entry.user_id,
        entry.user_nickname,
        entry.group_id,
        entry.group_name,
        entry.action
      ].some((value) => String(value ?? "").toLocaleLowerCase().includes(keyword)))
    : logs;
  const offset = (page - 1) * pageSize;
  return {
    success: true,
    data: filtered.slice(offset, offset + pageSize),
    total: filtered.length,
    page,
    pageSize
  };
});

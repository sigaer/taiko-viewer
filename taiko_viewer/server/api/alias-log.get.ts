import { readFile } from "node:fs/promises";
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

export default defineEventHandler(async (event) => {
  try {
    // 尝试多个可能的路径
    const possiblePaths = [
      resolve("/home/sigaer/taiko/logs/alias_action_log.json"),
      resolve(process.cwd(), "../../logs/alias_action_log.json"),
      resolve(process.cwd(), "../logs/alias_action_log.json"),
      resolve(process.cwd(), "logs/alias_action_log.json"),
    ];

    let content: string | null = null;

    for (const filePath of possiblePaths) {
      try {
        content = await readFile(filePath, "utf-8");
        break;
      } catch {
        continue;
      }
    }

    if (!content) {
      throw createError({
        statusCode: 404,
        statusMessage: "Alias log file not found"
      });
    }

    const logs: AliasLogEntry[] = JSON.parse(content);

    // 按时间倒序排列（最新的在前）
    const sortedLogs = logs.sort((a, b) => {
      return new Date(b.time).getTime() - new Date(a.time).getTime();
    });

    setHeader(event, "Cache-Control", "no-store");
    return {
      success: true,
      data: sortedLogs,
      total: sortedLogs.length
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to read alias log: ${error}`
    });
  }
});

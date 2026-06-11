import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import mysql, { type Pool } from "mysql2/promise";
import { dirname, resolve } from "node:path";
import { getContentRuntimePaths } from "~/server/services/content";
import { getRuntimePaths } from "~/server/internal/account/shared";

let botPool: Pool | null = null;

export const getAdminRuntimeConfig = () => {
  const runtimeConfig = useRuntimeConfig();
  return {
    taikoAdminApiBase: String(
      runtimeConfig.taikoAdminApiBase || process.env.TAIKO_ADMIN_API_BASE || "http://8.138.33.103:4290"
    ).replace(/\/$/, ""),
    viewerAccessLogPath: String(
      runtimeConfig.viewerAccessLogPath ||
        process.env.VIEWER_ACCESS_LOG_PATH ||
        "/www/wwwlogs/viewer.sakura-bot.cn.log"
    ),
    taikoAdminBackupDir: String(
      runtimeConfig.taikoAdminBackupDir ||
        process.env.TAIKO_ADMIN_BACKUP_DIR ||
        "/home/sigaer/taiko/data/admin_backups"
    ),
    botDbHost: String(runtimeConfig.botDbHost || process.env.METHOD_CALLS_DB_HOST || "127.0.0.1"),
    botDbPort: Number(runtimeConfig.botDbPort || process.env.METHOD_CALLS_DB_PORT || 3306),
    botDbUser: String(runtimeConfig.botDbUser || process.env.METHOD_CALLS_DB_USER || "root"),
    botDbPassword: String(
      runtimeConfig.botDbPassword || process.env.METHOD_CALLS_DB_PASSWORD || "wtf025366"
    ),
    botDbName: String(runtimeConfig.botDbName || process.env.METHOD_CALLS_DB_NAME || "bot")
  };
};

export const getAdminManagedPaths = () => {
  const { repoRoot, userdataDir } = getRuntimePaths();
  const { songDataPath } = getContentRuntimePaths();
  return {
    repoRoot,
    userdataDir,
    songDataPath,
    songAliasPath: resolve(repoRoot, "songs", "song_alias.json"),
    coverDir: resolve(repoRoot, "assets", "cover"),
    aliasLogPath: resolve(repoRoot, "logs", "alias_action_log.json")
  };
};

export const getBotDb = () => {
  if (!botPool) {
    const config = getAdminRuntimeConfig();
    botPool = mysql.createPool({
      host: config.botDbHost,
      port: config.botDbPort,
      user: config.botDbUser,
      password: config.botDbPassword,
      database: config.botDbName,
      connectionLimit: 6,
      namedPlaceholders: true,
      charset: "utf8mb4"
    });
  }
  return botPool;
};

export const readJsonFile = async <T>(filePath: string): Promise<T> => {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as T;
};

export const readOptionalJsonFile = async <T>(filePath: string, fallback: T): Promise<T> => {
  try {
    return await readJsonFile<T>(filePath);
  } catch {
    return fallback;
  }
};

export const ensureDir = async (dirPath: string) => {
  await mkdir(dirPath, { recursive: true });
};

export const writeFileAtomic = async (filePath: string, content: string | Buffer) => {
  await ensureDir(dirname(filePath));
  const tempPath = `${filePath}.tmp-${Date.now()}`;
  if (typeof content === "string") {
    await writeFile(tempPath, content, "utf-8");
  } else {
    await writeFile(tempPath, content);
  }
  await rename(tempPath, filePath);
};

const normalizeValue = (value: unknown): unknown => {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map((item) => normalizeValue(item));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalizeValue(item)])
    );
  }
  return value;
};

export const safeJsonStringify = (value: unknown) => JSON.stringify(normalizeValue(value), null, 2);

export const sha1 = (value: string) => createHash("sha1").update(value).digest("hex");

export const getFileMtimeMs = async (filePath: string) => {
  try {
    const fileStat = await stat(filePath);
    return fileStat.mtimeMs;
  } catch {
    return 0;
  }
};

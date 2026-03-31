import { zstdDecompressSync } from "node:zlib";
import type { H3Event } from "h3";
import { createError, getHeader, readRawBody } from "h3";
import type { ResultSetHeader } from "mysql2/promise";
import { DbRow, ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";
import { type SyncLogRow, SYNC_COOLDOWN_MS, ensureNonEmpty, toIso } from "./shared";

export type SyncTargetConfig = {
  id: string;
  label: string;
  description: string;
};

export type PublicSyncTarget = Pick<SyncTargetConfig, "id" | "label" | "description">;

export type SyncDispatchResult = {
  targetId: string;
  label: string;
  ok: boolean;
  statusCode: number;
  message: string;
  receivedBytes: number;
  decompressedBytes: number;
  songCount: number | null;
};

export type PublicSyncLog = {
  id: number;
  taikoId: string;
  status: string;
  targetIds: string[];
  results: SyncDispatchResult[];
  originalBytes: number;
  compressedBytes: number;
  createdAt: string;
  updatedAt: string;
};

type SyncGatewayDispatchPayload = {
  ok: boolean;
  userid: string;
  originalBytes: number;
  compressedBytes: number;
  results: SyncDispatchResult[];
  message: string;
};

const DEFAULT_SYNC_TARGETS: SyncTargetConfig[] = [
  {
    id: "sakura-bot",
    label: "Sakura bot",
    description: "由 Sakura bot 在服务端读取 userdata 并刷新本地快照。"
  },
  {
    id: "mock-service-b",
    label: "站内 mock 接收器",
    description: "由 Sakura bot 在服务端转发 zstd 到论坛 mock 接口，验证分发链路。"
  }
];

const parseSyncTarget = (input: unknown): SyncTargetConfig | null => {
  if (!input || typeof input !== "object") return null;
  const payload = input as Record<string, unknown>;
  const id = String(payload.id || "").trim();
  const label = String(payload.label || "").trim();
  const description = String(payload.description || "").trim();
  if (!id || !label) return null;
  return {
    id,
    label,
    description
  };
};

const getLocalSyncReceiverBaseUrl = () => {
  const runtimeConfig = useRuntimeConfig();
  return (
    String(runtimeConfig.localSyncReceiverBaseUrl || process.env.TAIKO_LOCAL_SYNC_RECEIVER_BASE_URL || "").trim() ||
    "http://127.0.0.1:3102"
  ).replace(/\/+$/, "");
};

const readResponseText = async (response: Response) => {
  try {
    return (await response.text()).trim();
  } catch {
    return "";
  }
};

const readResponseJson = async (response: Response) => {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const loadSyncTargets = async () => {
  const endpoint = `${getLocalSyncReceiverBaseUrl()}/targets`;
  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json"
      }
    });
    const payload = await readResponseJson(response);
    if (!response.ok) {
      throw new Error(String(payload?.message || payload?.statusMessage || (await readResponseText(response)) || `HTTP ${response.status}`));
    }
    const targets = Array.isArray(payload?.targets)
      ? payload!.targets.map(parseSyncTarget).filter(Boolean) as SyncTargetConfig[]
      : [];
    if (!targets.length) {
      throw new Error("同步网关未返回可用目标");
    }
    return targets;
  } catch (error) {
    console.error("[account-sync] 读取 Sakura bot 同步目标失败，已回退到默认目标", error);
    return DEFAULT_SYNC_TARGETS;
  }
};

export const requestSyncDispatch = async (taikoId: string, targetIds: string[]) => {
  const endpoint = `${getLocalSyncReceiverBaseUrl()}/dispatch`;
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        userid: taikoId,
        targetIds
      })
    });
  } catch (error) {
    console.error("[account-sync] 调用 Sakura bot 同步网关失败", error);
    throw createError({ statusCode: 502, statusMessage: "无法连接 Sakura bot 同步网关" });
  }

  const payload = await readResponseJson(response);
  if (!response.ok) {
    const message =
      String(payload?.message || payload?.statusMessage || "").trim() ||
      (await readResponseText(response)) ||
      `HTTP ${response.status}`;
    throw createError({
      statusCode: response.status || 502,
      statusMessage: message
    });
  }

  const results = serializeSyncResults(payload?.results);
  if (!results.length) {
    throw createError({ statusCode: 502, statusMessage: "Sakura bot 同步网关未返回分发结果" });
  }

  return {
    ok: Boolean(payload?.ok),
    userid: String(payload?.userid || taikoId).trim(),
    originalBytes: Number(payload?.originalBytes || 0) || 0,
    compressedBytes: Number(payload?.compressedBytes || 0) || 0,
    results,
    message: String(payload?.message || "").trim()
  } satisfies SyncGatewayDispatchPayload;
};

export const toPublicSyncTargets = (targets: SyncTargetConfig[]): PublicSyncTarget[] =>
  targets.map(({ id, label, description }) => ({ id, label, description }));

export const serializeSyncResults = (value: unknown): SyncDispatchResult[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const entry = item as Record<string, unknown>;
      return {
        targetId: String(entry.targetId || "").trim(),
        label: String(entry.label || "").trim(),
        ok: Boolean(entry.ok),
        statusCode: Number(entry.statusCode || 0) || 0,
        message: String(entry.message || "").trim(),
        receivedBytes: Number(entry.receivedBytes || 0) || 0,
        decompressedBytes: Number(entry.decompressedBytes || 0) || 0,
        songCount: entry.songCount === null || entry.songCount === undefined ? null : Number(entry.songCount || 0)
      } satisfies SyncDispatchResult;
    })
    .filter(Boolean) as SyncDispatchResult[];
};

export const toPublicSyncLog = (row: SyncLogRow | null | undefined): PublicSyncLog | null => {
  if (!row) return null;
  const targetIds = (() => {
    try {
      const parsed = JSON.parse(String(row.target_ids_json || "[]"));
      return Array.isArray(parsed) ? parsed.map((item) => String(item || "").trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  })();
  const results = (() => {
    try {
      return serializeSyncResults(JSON.parse(String(row.result_json || "[]")));
    } catch {
      return [] as SyncDispatchResult[];
    }
  })();
  return {
    id: row.id,
    taikoId: row.taiko_id,
    status: String(row.status || "unknown"),
    targetIds,
    results,
    originalBytes: Number(row.original_bytes || 0) || 0,
    compressedBytes: Number(row.compressed_bytes || 0) || 0,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
};

export const getLastSyncLogRow = async (userId: number) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<SyncLogRow>[]>(
    "SELECT * FROM web_data_sync_logs WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 1",
    [userId]
  );
  return rows[0] || null;
};

export const getSyncCooldownState = async (userId: number) => {
  const lastRow = await getLastSyncLogRow(userId);
  if (!lastRow) {
    return {
      remainingSeconds: 0,
      availableAt: ""
    };
  }
  const lastCreatedAt = new Date(lastRow.created_at).getTime();
  const remainingMs = lastCreatedAt + SYNC_COOLDOWN_MS - Date.now();
  if (remainingMs <= 0) {
    return {
      remainingSeconds: 0,
      availableAt: ""
    };
  }
  return {
    remainingSeconds: Math.ceil(remainingMs / 1000),
    availableAt: toIso(lastCreatedAt + SYNC_COOLDOWN_MS)
  };
};

export const insertSyncLog = async (payload: {
  userId: number;
  taikoId: string;
  status: string;
  targetIds: string[];
  results: SyncDispatchResult[];
  originalBytes: number;
  compressedBytes: number;
}) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO web_data_sync_logs
      (user_id, taiko_id, status, target_ids_json, result_json, original_bytes, compressed_bytes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.userId,
      payload.taikoId,
      payload.status,
      JSON.stringify(payload.targetIds),
      JSON.stringify(payload.results),
      payload.originalBytes,
      payload.compressedBytes
    ]
  );
  const [rows] = await db.execute<DbRow<SyncLogRow>[]>(
    "SELECT * FROM web_data_sync_logs WHERE id = ? LIMIT 1",
    [result.insertId]
  );
  return rows[0] || null;
};

export const receiveMockSyncPayload = async (event: H3Event, targetIdInput: unknown) => {
  const targetId = String(targetIdInput || "").trim();
  ensureNonEmpty(targetId, "同步目标无效");
  const rawBody = await readRawBody(event, false);
  const receivedBuffer = rawBody instanceof Buffer ? rawBody : Buffer.from(rawBody || "");
  if (!receivedBuffer.byteLength) {
    throw createError({ statusCode: 400, statusMessage: "未收到同步数据" });
  }
  const contentType = String(getHeader(event, "content-type") || "").toLowerCase();
  if (!contentType.includes("application/zstd")) {
    throw createError({ statusCode: 415, statusMessage: "mock 接收器仅接受 application/zstd" });
  }
  const userid = String(getHeader(event, "x-taiko-userid") || "").trim();
  const decompressed = zstdDecompressSync(receivedBuffer);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(decompressed.toString("utf-8")) as Record<string, unknown>;
  } catch {
    throw createError({ statusCode: 400, statusMessage: "mock 接收器解压后 JSON 无法解析" });
  }
  const songs = Array.isArray(parsed.songs) ? parsed.songs : [];
  return {
    ok: true,
    targetId,
    userid,
    receivedBytes: receivedBuffer.byteLength,
    decompressedBytes: decompressed.byteLength,
    songCount: songs.length,
    message: `mock 目标 ${targetId} 已收到 ${songs.length} 条成绩记录`
  };
};

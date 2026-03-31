import { readFile } from "node:fs/promises";
import { zstdCompressSync, zstdDecompressSync } from "node:zlib";
import type { H3Event } from "h3";
import { createError, getHeader, getRequestURL, readRawBody } from "h3";
import type { ResultSetHeader } from "mysql2/promise";
import { DbRow, ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";
import { type SyncLogRow, SYNC_COOLDOWN_MS, ensureNonEmpty, getUserdataPath, sha256, toIso } from "./shared";

export type SyncTargetConfig = {
  id: string;
  label: string;
  description: string;
  endpoint: string;
  kind: "http" | "mock";
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

const DEFAULT_SYNC_TARGETS: SyncTargetConfig[] = [
  {
    id: "sakura-bot",
    label: "Sakura bot",
    description: "本地接收服务，接收 zstd 标准压缩后的完整成绩 JSON 并直接写入 userdata。",
    endpoint: "",
    kind: "http"
  },
  {
    id: "mock-service-b",
    label: "站内 mock 接收器",
    description: "站内 mock 接收器，用于测试多目标并发分发。",
    endpoint: "",
    kind: "mock"
  }
];

const parseSyncTarget = (input: unknown): SyncTargetConfig | null => {
  if (!input || typeof input !== "object") return null;
  const payload = input as Record<string, unknown>;
  const id = String(payload.id || "").trim();
  const label = String(payload.label || "").trim();
  const description = String(payload.description || "").trim();
  const endpoint = String(payload.endpoint || payload.url || "").trim();
  const rawKind = String(payload.kind || (endpoint ? "http" : "mock"))
    .trim()
    .toLowerCase();
  if (!id || !label) return null;
  if (rawKind === "http" && !endpoint) return null;
  return {
    id,
    label,
    description,
    endpoint,
    kind: rawKind === "mock" ? "mock" : "http"
  };
};

const getInternalNitroOrigin = () => {
  const host = String(process.env.NITRO_HOST || "127.0.0.1").trim() || "127.0.0.1";
  const port = Number(process.env.NITRO_PORT || 3000) || 3000;
  return `http://${host}:${port}`;
};

const getLocalSyncReceiverEndpoint = () => {
  const runtimeConfig = useRuntimeConfig();
  return (
    String(runtimeConfig.localSyncReceiverEndpoint || process.env.TAIKO_LOCAL_SYNC_RECEIVER_ENDPOINT || "").trim() ||
    "http://127.0.0.1:3102/receive"
  );
};

const resolveMockEndpoint = (event: H3Event | undefined, targetId: string) => {
  if (!event) {
    return `${getInternalNitroOrigin()}/api/account/sync/mock/${encodeURIComponent(targetId)}`;
  }
  const requestUrl = getRequestURL(event);
  const baseUrl = requestUrl.protocol && requestUrl.host
    ? `${requestUrl.protocol}//${requestUrl.host}`
    : getInternalNitroOrigin();
  return `${baseUrl}/api/account/sync/mock/${encodeURIComponent(targetId)}`;
};

const resolveSyncTargetEndpoint = (event: H3Event | undefined, target: SyncTargetConfig) =>
  target.kind === "mock" ? resolveMockEndpoint(event, target.id) : target.endpoint || getLocalSyncReceiverEndpoint();

export const loadSyncTargets = (event?: H3Event): SyncTargetConfig[] => {
  const runtimeConfig = useRuntimeConfig();
  const raw = String(runtimeConfig.syncTargetsJson || process.env.TAIKO_SYNC_TARGETS_JSON || "").trim();
  if (!raw) {
    return DEFAULT_SYNC_TARGETS.map((target) => ({
      ...target,
      endpoint: resolveSyncTargetEndpoint(event, target)
    }));
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("sync target config must be an array");
    }
    const targets = parsed.map(parseSyncTarget).filter(Boolean) as SyncTargetConfig[];
    if (!targets.length) {
      throw new Error("sync target config is empty");
    }
    return targets.map((target) =>
      ({
        ...target,
        endpoint: resolveSyncTargetEndpoint(event, target)
      })
    );
  } catch (error) {
    console.error("[account-sync] 解析同步目标失败，已回退到 mock 目标", error);
    return DEFAULT_SYNC_TARGETS.map((target) => ({
      ...target,
      endpoint: resolveSyncTargetEndpoint(event, target)
    }));
  }
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

export const readSyncUserdataPayload = async (taikoId: string) => {
  const filePath = getUserdataPath(taikoId);
  let rawBuffer: Buffer;
  try {
    rawBuffer = await readFile(filePath);
  } catch {
    throw createError({ statusCode: 404, statusMessage: "未找到当前绑定 ID 的本地成绩数据" });
  }
  const text = rawBuffer.toString("utf-8");
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw createError({ statusCode: 500, statusMessage: "当前绑定 ID 的本地成绩 JSON 已损坏" });
  }
  return {
    rawBuffer,
    compressedBuffer: zstdCompressSync(rawBuffer),
    parsed
  };
};

const readResponsePayload = async (response: Response) => {
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as Record<string, unknown>;
      return {
        message: String(payload.message || payload.statusMessage || "").trim() || `HTTP ${response.status}`,
        receivedBytes: Number(payload.receivedBytes || 0) || 0,
        decompressedBytes: Number(payload.decompressedBytes || 0) || 0,
        songCount: payload.songCount === null || payload.songCount === undefined ? null : Number(payload.songCount || 0)
      };
    } catch {
      return {
        message: `HTTP ${response.status}`,
        receivedBytes: 0,
        decompressedBytes: 0,
        songCount: null
      };
    }
  }
  const text = await response.text();
  return {
    message: text.trim() || `HTTP ${response.status}`,
    receivedBytes: 0,
    decompressedBytes: 0,
    songCount: null
  };
};

export const dispatchSyncPayloadToTarget = async (
  target: SyncTargetConfig,
  taikoId: string,
  compressedPayload: Buffer
) => {
  const response = await fetch(target.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/zstd",
      "X-Taiko-Userid": taikoId,
      "X-Taiko-Compression": "zstd",
      "X-Taiko-Payload-Sha256": sha256(compressedPayload)
    },
    body: compressedPayload
  });
  const payload = await readResponsePayload(response);
  return {
    targetId: target.id,
    label: target.label,
    ok: response.ok,
    statusCode: response.status,
    message: payload.message,
    receivedBytes: payload.receivedBytes || compressedPayload.byteLength,
    decompressedBytes: payload.decompressedBytes,
    songCount: payload.songCount
  } satisfies SyncDispatchResult;
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

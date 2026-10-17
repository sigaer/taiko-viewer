import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { resolve } from "node:path";
import { createError } from "h3";
import {
  fetchBindPlayerProfile,
  getRuntimePaths,
  loadWahlapCookie,
  normalizeTaikoId
} from "~/server/internal/account/shared";
import { ensureAccountSchema, getAccountDb, type DbRow } from "~/server/utils/account-db";

type JsonObject = Record<string, unknown>;
type BotBindSource = "wahlap" | "hiroba" | "manual";
type BotBindRow = {
  row_id: number;
  qq: string;
  id: string;
  visible: number | null;
  slot_index: number | null;
  is_current: number | null;
  source: string | null;
  display_name?: string | null;
};
type BotBindSummary = {
  slot: number;
  taikoId: string;
  visible: number;
  isCurrent: boolean;
  source: BotBindSource;
  displayName: string;
  isManual: boolean;
  canExternalSync: boolean;
};

export type TaikoCenterSyncResponse = {
  ok: boolean;
  taikoId: string;
  source: "wahlap" | "hiroba";
  message: string;
  userdata: JsonObject;
  imageBase64: string | null;
  imageMimeType: string | null;
  imageFilename: string | null;
};

export type TaikoCenterHirobaCard = {
  idPos: number | null;
  taikoNo: string;
  displayName: string;
  accessCode: string;
  hasPlayData: boolean;
};

const buildWahlapHeaders = (authorization: string) => ({
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) UnifiedPCWindowsWechat(0xf2541020) XWEB/16459",
  "Content-Type": "application/json",
  Referer: "https://servicewechat.com/wxeafab0667490cd23/21/page-frame.html",
  Authorization: authorization
});

const normalizeBotBindSource = (rawSource: unknown): BotBindSource => {
  const source = String(rawSource || "").trim().toLowerCase();
  return source === "hiroba" || source === "manual" ? source : "wahlap";
};

const normalizeBotBindVisible = (rawVisible: unknown) => {
  return Number(rawVisible || 0) ? 1 : 0;
};

const listBotBindRows = async (identityKey: string) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<BotBindRow[]>(
    `SELECT b.row_id, b.qq, b.id, COALESCE(b.visible, 0) AS visible,
            COALESCE(slot_index, 1) AS slot_index,
            COALESCE(is_current, 0) AS is_current,
            COALESCE(source, 'wahlap') AS source,
            m.nickname AS display_name
       FROM bind b
       LEFT JOIN taiko_manual_accounts m
         ON CAST(m.taiko_id AS BINARY) = CAST(b.id AS BINARY)
        AND b.source = 'manual'
      WHERE b.qq = ?
      ORDER BY slot_index ASC, row_id ASC`,
    [identityKey]
  );
  return rows.map((row) => ({
    row_id: Number(row.row_id || 0) || 0,
    qq: String(row.qq || "").trim(),
    id: String(row.id || "").trim(),
    visible: Number(row.visible || 0) || 0,
    slot_index: Number(row.slot_index || 1) || 1,
    is_current: Number(row.is_current || 0) || 0,
    source: String(row.source || "wahlap").trim() || "wahlap"
    ,
    display_name: row.display_name
  }));
};

const ensureSingleCurrentBotBind = async (identityKey: string) => {
  const db = getAccountDb();
  const rows = await listBotBindRows(identityKey);
  if (!rows.length) return rows;

  const currentRow = rows.find((row) => Number(row.is_current || 0) === 1) || rows[0];
  await db.execute("UPDATE bind SET is_current = 0 WHERE qq = ?", [identityKey]);
  await db.execute("UPDATE bind SET is_current = 1 WHERE row_id = ?", [currentRow.row_id]);
  return listBotBindRows(identityKey);
};

const toBotBindSummaries = (rows: BotBindRow[]): BotBindSummary[] =>
  rows.map((row) => {
    const source = normalizeBotBindSource(row.source);
    return ({
    slot: Math.max(1, Number(row.slot_index || 1) || 1),
    taikoId: String(row.id || "").trim(),
    visible: normalizeBotBindVisible(row.visible),
    isCurrent: Number(row.is_current || 0) === 1,
    source,
    displayName: source === "manual" ? String(row.display_name || "手动账号") : String(row.id || ""),
    isManual: source === "manual",
    canExternalSync: source !== "manual"
    });
  });

const buildBotBindLookupPayload = async (identityKey: string) => {
  const rows = await ensureSingleCurrentBotBind(identityKey);
  const bindings = toBotBindSummaries(rows);
  const current = bindings.find((item) => item.isCurrent) || bindings[0] || null;
  if (!current) {
    return {
      ok: true,
      found: false,
      identityKey,
      bindings: []
    };
  }
  const db = getAccountDb();
  const [stateRows] = await db.execute<DbRow<{ current_virtual: number }>[]>(
    "SELECT current_virtual FROM taiko_bind_identity_state WHERE identity_key = ? LIMIT 1",
    [identityKey]
  );
  const officialCount = bindings.filter((item) => !item.isManual).length;
  const currentVirtual =
    Number(stateRows[0]?.current_virtual || 0) === 1 && officialCount >= 2;
  return {
    ok: true,
    found: true,
    identityKey,
    taikoId: current.taikoId,
    visible: current.visible,
    currentTaikoId: current.taikoId,
    currentSlot: currentVirtual ? 0 : current.slot,
    currentVirtual,
    currentSource: current.source,
    bindings
  };
};

const upsertBotBindRecord = async (
  identityKeyInput: unknown,
  taikoIdInput: unknown,
  options: { visible?: unknown; source?: unknown; makeCurrent?: boolean } = {}
) => {
  await ensureAccountSchema();
  const identityKey = String(identityKeyInput || "").trim();
  const taikoId = normalizeTaikoId(taikoIdInput);
  if (!identityKey) {
    throw createError({ statusCode: 400, statusMessage: "缺少身份标识" });
  }
  if (!taikoId) {
    throw createError({ statusCode: 400, statusMessage: "缺少鼓众 ID" });
  }

  const visible = normalizeBotBindVisible(options.visible);
  const source = normalizeBotBindSource(options.source);
  if (source === "manual") {
    throw createError({ statusCode: 403, statusMessage: "手动账号必须通过创建或认领接口绑定" });
  }
  const makeCurrent = options.makeCurrent !== false;
  const db = getAccountDb();
  const rows = await listBotBindRows(identityKey);
  const existing = rows.find((row) => row.id === taikoId) || null;

  let slotIndex = existing ? Math.max(1, Number(existing.slot_index || 1) || 1) : 1;
  if (!existing) {
    const usedSlots = new Set(
      rows.map((row) => Math.max(1, Number(row.slot_index || 1) || 1))
    );
    while (usedSlots.has(slotIndex)) {
      slotIndex += 1;
    }
    await db.execute(
      `INSERT INTO bind (qq, id, visible, slot_index, is_current, source)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [identityKey, taikoId, visible, slotIndex, makeCurrent ? 1 : 0, source]
    );
  } else {
    await db.execute(
      "UPDATE bind SET visible = ?, source = ? WHERE row_id = ?",
      [visible, source, existing.row_id]
    );
  }

  if (makeCurrent) {
    await db.execute("UPDATE bind SET is_current = 0 WHERE qq = ?", [identityKey]);
    await db.execute("UPDATE bind SET is_current = 1 WHERE qq = ? AND id = ?", [identityKey, taikoId]);
    await db.execute(
      `INSERT INTO taiko_bind_identity_state (identity_key, current_virtual)
       VALUES (?, 0) ON DUPLICATE KEY UPDATE current_virtual = 0`,
      [identityKey]
    );
  }

  return buildBotBindLookupPayload(identityKey);
};

const switchCurrentBotBindSlot = async (identityKeyInput: unknown, slotInput: unknown) => {
  await ensureAccountSchema();
  const identityKey = String(identityKeyInput || "").trim();
  const slot = Number(slotInput || 0);
  if (!identityKey) {
    throw createError({ statusCode: 400, statusMessage: "缺少身份标识" });
  }
  if (!Number.isInteger(slot) || slot < 0) {
    throw createError({ statusCode: 400, statusMessage: "槽位无效" });
  }
  const rows = await listBotBindRows(identityKey);
  const db = getAccountDb();
  if (slot === 0) {
    const officialCount = rows.filter(
      (row) => normalizeBotBindSource(row.source) !== "manual"
    ).length;
    if (officialCount < 2) {
      throw createError({ statusCode: 409, statusMessage: "至少需要 2 个 CN/JP 账号才能使用 u0" });
    }
    await db.execute(
      `INSERT INTO taiko_bind_identity_state (identity_key, current_virtual)
       VALUES (?, 1) ON DUPLICATE KEY UPDATE current_virtual = 1`,
      [identityKey]
    );
    return buildBotBindLookupPayload(identityKey);
  }
  const target = rows.find((row) => Math.max(1, Number(row.slot_index || 1) || 1) === slot);
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: "未找到该槽位" });
  }
  await db.execute("UPDATE bind SET is_current = 0 WHERE qq = ?", [identityKey]);
  await db.execute("UPDATE bind SET is_current = 1 WHERE row_id = ?", [target.row_id]);
  await db.execute(
    `INSERT INTO taiko_bind_identity_state (identity_key, current_virtual)
     VALUES (?, 0) ON DUPLICATE KEY UPDATE current_virtual = 0`,
    [identityKey]
  );
  return buildBotBindLookupPayload(identityKey);
};

const resolveArcadeSnapshotPaths = () => {
  const { repoRoot } = getRuntimePaths();
  return {
    cacheDir: resolve(repoRoot, "data", "arcade_map_cache"),
    taklistPath: resolve(repoRoot, "data", "arcade_map_taklist_cache.json")
  };
};

const readOptionalJsonFile = async (filePath: string) => {
  try {
    await access(filePath, fsConstants.R_OK);
  } catch {
    return null;
  }
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as JsonObject;
  } catch {
    return null;
  }
};

const fetchWahlapJson = async (
  endpoint: string,
  options: {
    method?: "GET" | "POST";
    body?: JsonObject;
    notFoundMessage?: string;
  } = {}
) => {
  const authorization = await loadWahlapCookie();
  if (!authorization) {
    throw createError({ statusCode: 500, statusMessage: "当前中心未配置可用的鼓众 cookie" });
  }
  const response = await fetch(endpoint, {
    method: options.method || "GET",
    headers: buildWahlapHeaders(authorization),
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw createError({ statusCode: 503, statusMessage: "当前中心的鼓众 cookie 已失效" });
    }
    throw createError({
      statusCode: response.status || 502,
      statusMessage: options.notFoundMessage || `请求鼓众接口失败，HTTP ${response.status}`
    });
  }
  const payload = (await response.json()) as JsonObject;
  if (Number(payload.statusCode || 0) === 401 || String(payload.message || "").trim() === "Unauthorized") {
    throw createError({ statusCode: 503, statusMessage: "当前中心的鼓众 cookie 已失效" });
  }
  return payload;
};

// The former ownerless Python adapters are retired. Their frozen implementation
// remains in the Phase 6 parent commit; formal routes carry authenticated tickets.
export const proxyTaikoCenterHirobaBind = async (
  _options: {email?:unknown;password?:unknown;targetTaikoNo?:unknown;configuredByQq?:unknown} = {}
) => {throw createError({statusCode:410,statusMessage:"请使用已授权的 Hiroba 绑定接口。"});};
export const proxyTaikoCenterHirobaCredentialStatus = async (_taikoId:unknown) => {
  throw createError({statusCode:410,statusMessage:"请使用已授权的 Hiroba 凭据接口。"});
};

export const proxyTaikoCenterBindLookup = async (identityKeyInput: unknown) => {
  const identityKey = String(identityKeyInput || "").trim();
  if (!identityKey) {
    throw createError({ statusCode: 400, statusMessage: "缺少身份标识" });
  }
  try {
    return await buildBotBindLookupPayload(identityKey);
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `查询中心绑定失败：${error instanceof Error ? error.message : String(error)}`
    });
  }
};

export const proxyTaikoCenterBindUpsert = async (
  identityKeyInput: unknown,
  taikoIdInput: unknown,
  options: { visible?: unknown; source?: unknown } = {}
) => upsertBotBindRecord(identityKeyInput, taikoIdInput, { ...options, makeCurrent: true });

export const proxyTaikoCenterBindSwitchCurrent = async (
  identityKeyInput: unknown,
  slotInput: unknown
) => switchCurrentBotBindSlot(identityKeyInput, slotInput);

export const proxyTaikoWahlapPlayer = async (taikoIdInput: unknown) => fetchBindPlayerProfile(taikoIdInput);

export const proxyTaikoWahlapRanking = async (
  songIdInput: unknown,
  diffInput: unknown,
  provinceIdInput: unknown
) => {
  const songId = String(songIdInput || "").trim();
  const diff = String(diffInput || "").trim();
  const provinceId = String(provinceIdInput || "").trim();
  if (!songId || !diff) {
    throw createError({ statusCode: 400, statusMessage: "缺少歌曲或难度参数" });
  }
  const suffix = provinceId ? `/${provinceId}` : "";
  return fetchWahlapJson(`https://wl-taiko.wahlap.net/api/ranking/${songId}/${diff}${suffix}`);
};

export const proxyTaikoArcadeSnapshot = async () => {
  const { cacheDir, taklistPath } = resolveArcadeSnapshotPaths();
  const fileNames = await readdir(cacheDir).catch(() => [] as string[]);
  const citySnapshots: JsonObject[] = [];
  for (const fileName of fileNames.filter((name) => name.endsWith(".json")).sort()) {
    const filePath = resolve(cacheDir, fileName);
    try {
      const payload = (await readOptionalJsonFile(filePath)) as JsonObject | null;
      if (payload) {
        citySnapshots.push(payload);
      }
    } catch {
      // Ignore damaged cache files and continue with remaining cities.
    }
  }
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    citySnapshots,
    taklistSnapshot: await readOptionalJsonFile(taklistPath)
  };
};

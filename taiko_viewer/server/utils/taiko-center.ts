import { access, readFile, readdir } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { join, resolve } from "node:path";
import { createError } from "h3";
import {
  execFileAsync,
  fetchBindPlayerProfile,
  getRuntimePaths,
  loadWahlapCookie,
  normalizeTaikoId,
  readRawUserdataText
} from "~/server/internal/account/shared";
import { requestSyncDispatch } from "~/server/internal/account/sync";
import { ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";

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

const PYTHON_STDOUT_HELPERS = [
  "from contextlib import redirect_stdout",
  "from io import StringIO",
  "_taiko_center_log = StringIO()",
  "def _taiko_center_image_bytes(image):",
  "    return image.getvalue() if hasattr(image, 'getvalue') else image"
].join("\n");

const buildWahlapHeaders = (authorization: string) => ({
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI MiniProgramEnv/Windows WindowsWechat/WMPF WindowsWechat(0x63090a13) UnifiedPCWindowsWechat(0xf2541020) XWEB/16459",
  "Content-Type": "application/json",
  Referer: "https://servicewechat.com/wxeafab0667490cd23/21/page-frame.html",
  Authorization: authorization
});

const extractExecErrorMessage = (error: unknown, fallback: string) => {
  if (!error || typeof error !== "object") return fallback;
  const payload = error as { stderr?: Buffer | string; stdout?: Buffer | string; message?: string };
  const stderr = Buffer.isBuffer(payload.stderr) ? payload.stderr.toString("utf-8") : String(payload.stderr || "");
  const stdout = Buffer.isBuffer(payload.stdout) ? payload.stdout.toString("utf-8") : String(payload.stdout || "");
  const message = String(payload.message || "").trim();
  return stderr.trim() || stdout.trim() || message || fallback;
};

const parseJsonText = (rawText: string, fallbackMessage: string) => {
  try {
    return JSON.parse(rawText) as JsonObject;
  } catch {
    throw createError({ statusCode: 500, statusMessage: fallbackMessage });
  }
};

const readCenterUserdata = async (taikoId: string) => parseJsonText(await readRawUserdataText(taikoId), "权威成绩 JSON 已损坏");

const getCenterUserdataHistoryDir = (taikoId: string) => {
  const { userdataDir } = getRuntimePaths();
  return resolve(userdataDir, taikoId);
};

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
       LEFT JOIN taiko_manual_accounts m ON m.taiko_id = b.id AND b.source = 'manual'
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
  return {
    ok: true,
    found: true,
    identityKey,
    taikoId: current.taikoId,
    visible: current.visible,
    currentTaikoId: current.taikoId,
    currentSlot: current.slot,
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
  if (!Number.isInteger(slot) || slot <= 0) {
    throw createError({ statusCode: 400, statusMessage: "槽位无效" });
  }
  const rows = await listBotBindRows(identityKey);
  const target = rows.find((row) => Math.max(1, Number(row.slot_index || 1) || 1) === slot);
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: "未找到该槽位" });
  }
  const db = getAccountDb();
  await db.execute("UPDATE bind SET is_current = 0 WHERE qq = ?", [identityKey]);
  await db.execute("UPDATE bind SET is_current = 1 WHERE row_id = ?", [target.row_id]);
  return buildBotBindLookupPayload(identityKey);
};

const readCenterUserdataHistory = async (taikoIdInput: unknown) => {
  const taikoId = normalizeTaikoId(taikoIdInput);
  if (!taikoId) {
    throw createError({ statusCode: 400, statusMessage: "缺少鼓众 ID" });
  }
  const historyDir = getCenterUserdataHistoryDir(taikoId);
  let fileNames: string[] = [];
  try {
    fileNames = await readdir(historyDir);
  } catch {
    return { ok: true, taikoId, snapshots: [] };
  }

  const snapshotNames = fileNames
    .filter((name) => name.startsWith("data_") && name.endsWith(".json"))
    .sort();
  const snapshots: Array<{ capturedAt: string; payload: JsonObject }> = [];
  for (const fileName of snapshotNames) {
    const filePath = join(historyDir, fileName);
    try {
      const rawText = await readFile(filePath, "utf-8");
      const payload = parseJsonText(rawText, "中心历史快照 JSON 已损坏");
      const meta = (payload._meta || {}) as JsonObject;
      const capturedAt = String(meta.ts || fileName).trim();
      snapshots.push({ capturedAt, payload });
    } catch {
      continue;
    }
  }
  return { ok: true, taikoId, snapshots };
};

const runPythonBuffer = async (pythonCode: string, args: string[] = []) => {
  const { repoRoot } = getRuntimePaths();
  try {
    const result = await execFileAsync("python3", ["-c", pythonCode, ...args], {
      cwd: repoRoot,
      encoding: "buffer",
      maxBuffer: 64 * 1024 * 1024
    });
    return result.stdout as Buffer;
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: extractExecErrorMessage(error, "中心 Python 任务执行失败")
    });
  }
};

const runPythonJson = async (pythonCode: string, args: string[] = []) => {
  const buffer = await runPythonBuffer(pythonCode, args);
  const rawText = buffer.toString("utf-8").trim();
  if (!rawText) {
    throw createError({ statusCode: 500, statusMessage: "中心 Python 任务未返回 JSON" });
  }
  return parseJsonText(rawText, "中心 Python 任务返回的 JSON 无法解析");
};

const renderUpdateImage = async (taikoId: string, showAll: boolean) => {
  const code = [
    PYTHON_STDOUT_HELPERS,
    "from plugins.utils.draw_dress import render_update_changes_image",
    "import sys",
    "with redirect_stdout(_taiko_center_log):",
    "    buf = render_update_changes_image(int(sys.argv[1]), show_all=(sys.argv[2] == '1'))",
    "sys.stdout.buffer.write(_taiko_center_image_bytes(buf))"
  ].join("\n");
  return runPythonBuffer(code, [taikoId, showAll ? "1" : "0"]);
};

const ensureDispatchSucceeded = (message: string, results: Array<Record<string, unknown>>) => {
  const failed = results.find((item) => !Boolean(item?.ok));
  if (!failed) return;
  const failedMessage = String(failed.message || failed.statusMessage || "").trim();
  throw createError({
    statusCode: Number(failed.statusCode || 502) || 502,
    statusMessage: failedMessage || message || "中心同步失败"
  });
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

export const proxyTaikoCenterUserdataUpdate = async (
  taikoIdInput: unknown,
  options: { showAll?: boolean; includeImage?: boolean } = {}
): Promise<TaikoCenterSyncResponse> => {
  const taikoId = normalizeTaikoId(taikoIdInput);
  if (!taikoId) {
    throw createError({ statusCode: 400, statusMessage: "缺少鼓众 ID" });
  }
  const dispatch = await requestSyncDispatch(taikoId, ["sakura-bot"]);
  ensureDispatchSucceeded(dispatch.message, dispatch.results as Array<Record<string, unknown>>);
  const userdata = await readCenterUserdata(taikoId);
  let imageBase64: string | null = null;
  if (options.includeImage !== false) {
    const image = await renderUpdateImage(taikoId, Boolean(options.showAll));
    imageBase64 = image.length ? image.toString("base64") : null;
  }
  return {
    ok: true,
    taikoId,
    source: "wahlap",
    message: "更新成功，成绩已写入中心设备。",
    userdata,
    imageBase64,
    imageMimeType: imageBase64 ? "image/png" : null,
    imageFilename: imageBase64 ? `taiko-update-${taikoId}.png` : null
  };
};

export const proxyTaikoCenterHirobaSync = async (
  taikoIdInput: unknown,
  options: { email?: unknown; password?: unknown; showAll?: boolean; includeImage?: boolean } = {}
): Promise<TaikoCenterSyncResponse> => {
  const taikoId = normalizeTaikoId(taikoIdInput);
  const email = String(options.email || "").trim();
  const password = String(options.password || "").trim();
  if (!taikoId) {
    throw createError({ statusCode: 400, statusMessage: "缺少鼓众 ID" });
  }
  const code = [
    PYTHON_STDOUT_HELPERS,
    "from plugins.utils.hiroba.credentials import load_hiroba_credentials",
    "from plugins.utils.hiroba.sync import sync_hiroba_userdata",
    "import json, sys",
    "email = sys.argv[1].strip()",
    "password = sys.argv[2].strip()",
    "taiko_id = sys.argv[3].strip()",
    "if not email or not password:",
    "    creds = load_hiroba_credentials(taiko_id)",
    "    if not creds:",
    "        raise RuntimeError('当前中心未配置该 Hiroba 账号凭据')",
    "    email, password = creds",
    "with redirect_stdout(_taiko_center_log):",
    "    resolved = sync_hiroba_userdata(email, password, taiko_no=taiko_id)",
    "print(json.dumps({'taikoId': resolved}, ensure_ascii=False))"
  ].join("\n");
  await runPythonJson(code, [email, password, taikoId]);
  const userdata = await readCenterUserdata(taikoId);
  let imageBase64: string | null = null;
  if (options.includeImage !== false) {
    const image = await renderUpdateImage(taikoId, Boolean(options.showAll));
    imageBase64 = image.length ? image.toString("base64") : null;
  }
  return {
    ok: true,
    taikoId,
    source: "hiroba",
    message: "Hiroba 更新成功，成绩已写入中心设备。",
    userdata,
    imageBase64,
    imageMimeType: imageBase64 ? "image/png" : null,
    imageFilename: imageBase64 ? `taiko-hiroba-update-${taikoId}.png` : null
  };
};

export const proxyTaikoCenterHirobaBind = async (
  options: {
    email?: unknown;
    password?: unknown;
    targetTaikoNo?: unknown;
    configuredByQq?: unknown;
  } = {}
) => {
  const email = String(options.email || "").trim();
  const password = String(options.password || "").trim();
  const targetTaikoNo = String(options.targetTaikoNo || "").trim();
  const configuredByQq = String(options.configuredByQq || "").trim();
  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: "缺少 Hiroba 邮箱或密码" });
  }
  const code = [
    PYTHON_STDOUT_HELPERS,
    "from plugins.utils.hiroba.credentials import save_hiroba_credentials",
    "from plugins.utils.hiroba.sync import discover_hiroba_playable_cards",
    "import json, sys",
    "email = sys.argv[1].strip()",
    "password = sys.argv[2].strip()",
    "target_taiko_no = sys.argv[3].strip()",
    "configured_by_qq = sys.argv[4].strip()",
    "with redirect_stdout(_taiko_center_log):",
    "    cards = discover_hiroba_playable_cards(email, password)",
    "selected = []",
    "for card in cards:",
    "    taiko_no = str(card.taiko_no or '').strip()",
    "    if not taiko_no:",
    "        continue",
    "    if target_taiko_no and taiko_no != target_taiko_no:",
    "        continue",
    "    save_hiroba_credentials(",
    "        taiko_no,",
    "        email,",
    "        password,",
    "        configured_by_qq=(configured_by_qq or None),",
    "    )",
    "    selected.append(taiko_no)",
    "print(json.dumps({'taikoIds': selected}, ensure_ascii=False))"
  ].join("\n");
  const payload = (await runPythonJson(code, [email, password, targetTaikoNo, configuredByQq])) as {
    taikoIds?: string[];
  };
  const taikoIds = Array.isArray(payload.taikoIds)
    ? payload.taikoIds.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  let bindInfo: JsonObject | null = null;
  if (configuredByQq && taikoIds.length) {
    for (const taikoId of taikoIds) {
      await upsertBotBindRecord(configuredByQq, taikoId, {
        source: "hiroba",
        makeCurrent: false
      });
    }
    const preferredTaikoId =
      (targetTaikoNo && taikoIds.includes(targetTaikoNo) ? targetTaikoNo : taikoIds[0]) || taikoIds[0];
    bindInfo = await upsertBotBindRecord(configuredByQq, preferredTaikoId, {
      source: "hiroba",
      makeCurrent: true
    });
  }
  return {
    ok: true,
    taikoIds,
    bind: bindInfo
  };
};

export const proxyTaikoCenterHirobaCredentialStatus = async (taikoIdInput: unknown) => {
  const taikoId = normalizeTaikoId(taikoIdInput);
  if (!taikoId) {
    throw createError({ statusCode: 400, statusMessage: "缺少鼓众 ID" });
  }
  const code = [
    PYTHON_STDOUT_HELPERS,
    "from plugins.utils.hiroba.credentials import has_hiroba_credentials",
    "import json, sys",
    "print(json.dumps({'hasCredentials': bool(has_hiroba_credentials(sys.argv[1].strip()))}, ensure_ascii=False))"
  ].join("\n");
  const payload = (await runPythonJson(code, [taikoId])) as {
    hasCredentials?: boolean;
  };
  return {
    ok: true,
    taikoId,
    hasCredentials: Boolean(payload.hasCredentials)
  };
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

export const proxyTaikoCenterUserdataHistory = async (taikoIdInput: unknown) =>
  readCenterUserdataHistory(taikoIdInput);

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

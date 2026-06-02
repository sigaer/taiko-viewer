import { access, readFile, readdir } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { resolve } from "node:path";
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

type JsonObject = Record<string, unknown>;

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
  return {
    ok: true,
    taikoIds: Array.isArray(payload.taikoIds) ? payload.taikoIds : []
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

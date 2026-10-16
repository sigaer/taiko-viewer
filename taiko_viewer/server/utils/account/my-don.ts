import { getTaikoPython, getTaikoPythonEnv } from "~/server/utils/taiko-python";
import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createError } from "h3";
import type { RowDataPacket } from "mysql2/promise";
import { ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";
import { getCustomTitleCatalogFingerprint } from "~/server/utils/custom-titles";
import {
  execFileAsync,
  getCurrentBindingRow,
  getRuntimePaths,
  getUserdataPath,
  userdataFileExists,
} from "../../internal/account/shared";

const MAX_MY_DON_SHOWCASE_TITLES = 5;
const DEFAULT_MY_DON_SHOWCASE_LAYOUT = "nickname";
const MY_DON_SHOWCASE_LAYOUTS = new Set(["nickname", "full", "full_gold"]);
export type MyDonShowcaseLayout = "nickname" | "full" | "full_gold";

type MyDonShowcaseRow = RowDataPacket & {
  id: number;
  binding_id: number;
  slot_index: number;
  title_name: string;
  created_at: string;
  updated_at: string;
};

export type MyDonShowcaseTitleOption = {
  titleName: string;
  plateId: number;
  requirementType: string;
  difficultyScope: string;
  conditionText: string;
  songNames: string[];
  songIds: number[];
  constValue: number;
  isMultiSong: boolean;
  source: "official" | "custom";
  customTitleId: number | null;
  difficultyLevel: number | null;
  plateStyle: "silver" | "gold" | "rainbow" | null;
};

export type MyDonShowcaseSettings = {
  bindingId: number | null;
  taikoId: string | null;
  hasUserdata: boolean;
  isCustom: boolean;
  layoutMode: MyDonShowcaseLayout;
  selectedTitles: string[];
  availableTitles: MyDonShowcaseTitleOption[];
};

const normalizeShowcaseLayout = (value: unknown): MyDonShowcaseLayout => {
  const layout = String(value || DEFAULT_MY_DON_SHOWCASE_LAYOUT).trim().toLowerCase();
  if (!MY_DON_SHOWCASE_LAYOUTS.has(layout)) {
    throw createError({ statusCode: 400, statusMessage: "不支持的称号构图方式" });
  }
  return layout as MyDonShowcaseLayout;
};

const normalizeShowcaseTitleName = (value: unknown) => String(value || "").replace(/\s+/g, " ").trim();

const dedupeTitleNames = (values: Iterable<unknown>) => {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const rawValue of values) {
    const titleName = normalizeShowcaseTitleName(rawValue);
    if (!titleName || seen.has(titleName)) continue;
    seen.add(titleName);
    result.push(titleName);
  }
  return result;
};

const getBindingMyDonShowcaseTitles = async (bindingId: number) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<MyDonShowcaseRow[]>(
    `SELECT id, binding_id, slot_index, title_name, created_at, updated_at
       FROM web_taiko_binding_mydon_showcase_titles
      WHERE binding_id = ?
      ORDER BY slot_index ASC, id ASC`,
    [bindingId]
  );
  return dedupeTitleNames(rows.map((row) => row.title_name)).slice(0, MAX_MY_DON_SHOWCASE_TITLES);
};

const replaceBindingMyDonShowcaseSettings = async (
  bindingId: number,
  titleNames: string[] | null,
  layoutMode: MyDonShowcaseLayout
) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      "UPDATE web_taiko_bindings SET mydon_showcase_layout = ? WHERE id = ?",
      [layoutMode, bindingId]
    );
    if (titleNames !== null) {
      await connection.execute("DELETE FROM web_taiko_binding_mydon_showcase_titles WHERE binding_id = ?", [bindingId]);
      for (const [index, titleName] of titleNames.entries()) {
        await connection.execute(
          `INSERT INTO web_taiko_binding_mydon_showcase_titles (binding_id, slot_index, title_name)
           VALUES (?, ?, ?)`,
          [bindingId, index + 1, titleName]
        );
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const runMyDonPythonJson = async (repoRoot: string, userdataPath: string) => {
  const result = await execFileAsync(getTaikoPython(), [
    "-I", "-m",
    "taiko_bot.offline.my_don_cli",
    "candidates",
    "--userdata",
    userdataPath,
  ], {
    cwd: repoRoot,
    env: { ...getTaikoPythonEnv(repoRoot), TAIKO_USERDATA_DIR: getRuntimePaths().userdataDir },
    timeout: 120_000, killSignal: "SIGKILL",
    encoding: "utf-8",
    maxBuffer: 8 * 1024 * 1024,
  });
  const stdout = String(result.stdout || "[]").trim() || "[]";
  const payload = JSON.parse(stdout);
  if (!Array.isArray(payload)) return [];
  return payload as MyDonShowcaseTitleOption[];
};

const getBindingMyDonShowcaseCandidates = async (taikoId: string) => {
  if (!(await userdataFileExists(taikoId))) {
    return [] as MyDonShowcaseTitleOption[];
  }
  const { repoRoot } = getRuntimePaths();
  return runMyDonPythonJson(repoRoot, getUserdataPath(taikoId));
};

export const getMyDonShowcaseSettings = async (userId: number): Promise<MyDonShowcaseSettings> => {
  const binding = await getCurrentBindingRow(userId);
  if (!binding) {
    return {
      bindingId: null,
      taikoId: null,
      hasUserdata: false,
      isCustom: false,
      layoutMode: DEFAULT_MY_DON_SHOWCASE_LAYOUT,
      selectedTitles: [],
      availableTitles: [],
    };
  }

  const selectedTitles = await getBindingMyDonShowcaseTitles(binding.id);
  const hasUserdata = await userdataFileExists(binding.taiko_id);
  const availableTitles = hasUserdata ? await getBindingMyDonShowcaseCandidates(binding.taiko_id) : [];
  const availableMap = new Map(
    availableTitles.map((item) => [normalizeShowcaseTitleName(item.titleName), item.titleName])
  );
  const validSelectedTitles = selectedTitles
    .map((titleName) => availableMap.get(normalizeShowcaseTitleName(titleName)) || "")
    .filter(Boolean)
    .slice(0, MAX_MY_DON_SHOWCASE_TITLES);

  return {
    bindingId: binding.id,
    taikoId: binding.taiko_id,
    hasUserdata,
    isCustom: validSelectedTitles.length > 0,
    layoutMode: normalizeShowcaseLayout(binding.mydon_showcase_layout),
    selectedTitles: validSelectedTitles,
    availableTitles,
  };
};

export const updateMyDonShowcaseSettings = async (
  userId: number,
  titleNamesInput: unknown,
  layoutModeInput: unknown
): Promise<MyDonShowcaseSettings> => {
  const binding = await getCurrentBindingRow(userId);
  if (!binding) {
    throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  }
  if (!(await userdataFileExists(binding.taiko_id))) {
    throw createError({ statusCode: 400, statusMessage: "当前绑定还没有可用成绩数据，暂时无法自定义称号展示" });
  }

  const shouldUpdateTitles = titleNamesInput !== undefined;
  const titleNames = dedupeTitleNames(
    shouldUpdateTitles
      ? Array.isArray(titleNamesInput) ? titleNamesInput : []
      : await getBindingMyDonShowcaseTitles(binding.id)
  );
  const layoutMode = normalizeShowcaseLayout(
    layoutModeInput === undefined ? binding.mydon_showcase_layout : layoutModeInput
  );
  if (titleNames.length > MAX_MY_DON_SHOWCASE_TITLES) {
    throw createError({
      statusCode: 400,
      statusMessage: `最多只能自定义 ${MAX_MY_DON_SHOWCASE_TITLES} 个称号`,
    });
  }

  const availableTitles = await getBindingMyDonShowcaseCandidates(binding.taiko_id);
  const availableMap = new Map(
    availableTitles.map((item) => [normalizeShowcaseTitleName(item.titleName), item.titleName])
  );
  const normalizedSelectedTitles: string[] = [];
  for (const rawTitleName of titleNames) {
    const resolvedTitleName = availableMap.get(normalizeShowcaseTitleName(rawTitleName));
    if (!resolvedTitleName) {
      if (shouldUpdateTitles) {
        throw createError({ statusCode: 400, statusMessage: `称号「${rawTitleName}」不在可自定义范围内` });
      }
      continue;
    }
    normalizedSelectedTitles.push(resolvedTitleName);
  }

  await replaceBindingMyDonShowcaseSettings(
    binding.id,
    shouldUpdateTitles ? normalizedSelectedTitles : null,
    layoutMode
  );
  return {
    bindingId: binding.id,
    taikoId: binding.taiko_id,
    hasUserdata: true,
    isCustom: normalizedSelectedTitles.length > 0,
    layoutMode,
    selectedTitles: normalizedSelectedTitles,
    availableTitles,
  };
};

export const getMyDonImageBuffer = async (userId: number) => {
  const binding = await getCurrentBindingRow(userId);
  if (!binding) {
    throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  }

  const { repoRoot, cacheDir } = getRuntimePaths();
  const userdataPath = getUserdataPath(binding.taiko_id);
  const fileStat = await stat(userdataPath);
  const titleNames = await getBindingMyDonShowcaseTitles(binding.id);
  const layoutMode = normalizeShowcaseLayout(binding.mydon_showcase_layout);
  const showcaseCacheKey = createHash("sha1")
    .update(JSON.stringify({
      titleNames,
      layoutMode,
      customTitles: await getCustomTitleCatalogFingerprint().catch(() => "unavailable")
    }))
    .digest("hex")
    .slice(0, 12);

  const targetDir = join(cacheDir, "my-don");
  await mkdir(targetDir, { recursive: true });
  const cacheName = `${binding.taiko_id}-${fileStat.mtimeMs}-${showcaseCacheKey}.png`;
  const cachePath = join(targetDir, cacheName);

  try {
    await access(cachePath, fsConstants.R_OK);
    return await readFile(cachePath);
  } catch {
    // continue
  }

  const args = [
    "-I", "-m",
    "taiko_bot.offline.my_don_cli",
    "render",
    "--taiko-id",
    binding.taiko_id,
    "--showcase-layout",
    layoutMode,
  ];
  if (titleNames.length > 0) {
    args.push("--title-overrides-json", JSON.stringify(titleNames));
  }
  const result = await execFileAsync(getTaikoPython(), args, {
    cwd: repoRoot,
    env: { ...getTaikoPythonEnv(repoRoot), TAIKO_USERDATA_DIR: getRuntimePaths().userdataDir },
    timeout: 120_000, killSignal: "SIGKILL",
    encoding: "buffer",
    maxBuffer: 20 * 1024 * 1024,
  });
  const buffer = result.stdout as Buffer;
  await writeFile(cachePath, buffer);

  const files = await readdir(targetDir);
  await Promise.all(
    files
      .filter((name) => name.startsWith(`${binding.taiko_id}-`) && name !== cacheName)
      .map((name) => unlink(join(targetDir, name)).catch(() => undefined))
  );
  return buffer;
};

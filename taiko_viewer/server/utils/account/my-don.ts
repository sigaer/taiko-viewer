import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createError } from "h3";
import type { RowDataPacket } from "mysql2/promise";
import { ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";
import {
  execFileAsync,
  getCurrentBindingRow,
  getRuntimePaths,
  getUserdataPath,
  userdataFileExists,
} from "../../internal/account/shared";

const MAX_MY_DON_SHOWCASE_TITLES = 5;

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
};

export type MyDonShowcaseSettings = {
  bindingId: number | null;
  taikoId: string | null;
  hasUserdata: boolean;
  isCustom: boolean;
  selectedTitles: string[];
  availableTitles: MyDonShowcaseTitleOption[];
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

const replaceBindingMyDonShowcaseTitles = async (bindingId: number, titleNames: string[]) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("DELETE FROM web_taiko_binding_mydon_showcase_titles WHERE binding_id = ?", [bindingId]);
    for (const [index, titleName] of titleNames.entries()) {
      await connection.execute(
        `INSERT INTO web_taiko_binding_mydon_showcase_titles (binding_id, slot_index, title_name)
         VALUES (?, ?, ?)`,
        [bindingId, index + 1, titleName]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const runMyDonPythonJson = async (repoRoot: string, taikoId: string) => {
  const pythonCode = [
    "from pathlib import Path",
    "from plugins.utils.song_title_showcase import list_song_title_showcase_candidates, serialize_showcase_titles",
    "import json, sys",
    "repo_root = Path(sys.argv[1])",
    "taiko_id = sys.argv[2]",
    "with (repo_root / 'userdata' / f'{taiko_id}data.json').open('r', encoding='utf-8') as fp: userdata = json.load(fp)",
    "payload = serialize_showcase_titles(list_song_title_showcase_candidates(userdata.get('songs') or []))",
    "sys.stdout.write(json.dumps(payload, ensure_ascii=False))",
  ].join("; ");
  const result = await execFileAsync("python3", ["-c", pythonCode, repoRoot, taikoId], {
    cwd: repoRoot,
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
  return runMyDonPythonJson(repoRoot, taikoId);
};

export const getMyDonShowcaseSettings = async (userId: number): Promise<MyDonShowcaseSettings> => {
  const binding = await getCurrentBindingRow(userId);
  if (!binding) {
    return {
      bindingId: null,
      taikoId: null,
      hasUserdata: false,
      isCustom: false,
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
    selectedTitles: validSelectedTitles,
    availableTitles,
  };
};

export const updateMyDonShowcaseSettings = async (
  userId: number,
  titleNamesInput: unknown
): Promise<MyDonShowcaseSettings> => {
  const binding = await getCurrentBindingRow(userId);
  if (!binding) {
    throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  }
  if (!(await userdataFileExists(binding.taiko_id))) {
    throw createError({ statusCode: 400, statusMessage: "当前绑定还没有可用成绩数据，暂时无法自定义称号展示" });
  }

  const titleNames = dedupeTitleNames(Array.isArray(titleNamesInput) ? titleNamesInput : []);
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
      throw createError({ statusCode: 400, statusMessage: `称号「${rawTitleName}」不在可自定义范围内` });
    }
    normalizedSelectedTitles.push(resolvedTitleName);
  }

  await replaceBindingMyDonShowcaseTitles(binding.id, normalizedSelectedTitles);
  return {
    bindingId: binding.id,
    taikoId: binding.taiko_id,
    hasUserdata: true,
    isCustom: normalizedSelectedTitles.length > 0,
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
  const showcaseCacheKey =
    titleNames.length > 0
      ? createHash("sha1").update(JSON.stringify(titleNames)).digest("hex").slice(0, 12)
      : "default";

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

  const pythonCode = [
    "from plugins.utils.draw_dress import render_my_don_image",
    "import json, sys",
    "title_overrides = json.loads(sys.argv[2]) if len(sys.argv) > 2 else None",
    "sys.stdout.buffer.write(render_my_don_image(int(sys.argv[1]), title_overrides=title_overrides))",
  ].join("; ");
  const args = ["-c", pythonCode, binding.taiko_id];
  if (titleNames.length > 0) {
    args.push(JSON.stringify(titleNames));
  }
  const result = await execFileAsync("python3", args, {
    cwd: repoRoot,
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

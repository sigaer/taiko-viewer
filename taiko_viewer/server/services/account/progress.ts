import { getTaikoPython, getTaikoPythonEnv } from "~/server/utils/taiko-python";
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import {
  execFileAsync,
  getCurrentBindingRow,
  getRuntimePaths,
  getUserdataPath
} from "~/server/internal/account/shared";

export type ProgressKind = "dani" | "constant" | "star" | "named";
export type ConstantProgressMode = "pass" | "comprehensive";

export interface ProgressOptions {
  dani: Array<{ version: string; grades: string[] }>;
  constants: {
    pass: string[];
    comprehensive: string[];
  };
  stars: number[];
  named: string[];
  pages: {
    pass: Record<string, number>;
    comprehensive: Record<string, number>;
    star: Record<string, number>;
    named: Record<string, number>;
  };
}

export interface ProgressImageRequest {
  kind?: string;
  version?: string;
  grade?: string;
  constant?: string;
  mode?: string;
  star?: number;
  name?: string;
  page?: number;
}

const runPython = async (pythonCode: string, args: string[] = [], encoding: "buffer" | "utf8" = "buffer") => {
  const { repoRoot, userdataDir } = getRuntimePaths();
  return execFileAsync(getTaikoPython(), ["-I", "-c", pythonCode, ...args], {
    cwd: repoRoot,
    env: { ...getTaikoPythonEnv(repoRoot), TAIKO_USERDATA_DIR: userdataDir },
    timeout: 120_000, killSignal: "SIGKILL",
    encoding,
    maxBuffer: 30 * 1024 * 1024
  });
};

const ensureBindingWithUserdata = async (userId: number) => {
  const binding = await getCurrentBindingRow(userId);
  if (!binding) {
    throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  }
  try {
    await access(getUserdataPath(binding.taiko_id), fsConstants.R_OK);
  } catch {
    throw createError({
      statusCode: 404,
      statusMessage: "未找到本地成绩数据，请先在「多端同步」更新数据"
    });
  }
  return binding;
};

let optionsCache: { expiresAt: number; value: ProgressOptions } | null = null;

export const getProgressOptions = async (): Promise<ProgressOptions> => {
  if (optionsCache && optionsCache.expiresAt > Date.now()) return optionsCache.value;

  const code = [
    "import json",
    "from pathlib import Path",
    "from taiko_bot.offline.viewer import SUPPORTED_DANI_VERSIONS, _load_grade_index",
    "from taiko_bot.offline.viewer_catalog import available_pass_progress_keys, available_const_progress_keys, available_star_progress_values, load_active_song_ids, query_progress_items_by_pass_const, query_progress_items_by_const, query_progress_items_by_star",
    "dani = []",
    "for version in sorted(SUPPORTED_DANI_VERSIONS, reverse=True):",
    "    grades = []",
    "    seen = set()",
    "    for item in _load_grade_index(version).values():",
    "        grade = str(item.get('grade') or '').strip()",
    "        if grade and grade not in seen:",
    "            seen.add(grade)",
    "            grades.append(grade)",
    "    dani.append({'version': str(version), 'grades': grades})",
    "named_path = Path('songs/music_donda_list.json')",
    "named_payload = json.loads(named_path.read_text(encoding='utf-8')) if named_path.exists() else {}",
    "pass_keys = sorted(available_pass_progress_keys(), key=float)",
    "const_keys = sorted(available_const_progress_keys(), key=float)",
    "star_values = sorted(available_star_progress_values())",
    "active_ids = load_active_song_ids()",
    "named_pages = {}",
    "for name, items in named_payload.items():",
    "    count = 0",
    "    for item in items if isinstance(items, list) else []:",
    "        try:",
    "            song_id = int(item.get('id'))",
    "        except (TypeError, ValueError):",
    "            continue",
    "        if song_id in active_ids:",
    "            count += 1",
    "    named_pages[name] = max(1, (count + 59) // 60)",
    "payload = {",
    "    'dani': dani,",
    "    'constants': {",
    "        'pass': pass_keys,",
    "        'comprehensive': const_keys,",
    "    },",
    "    'stars': star_values,",
    "    'named': sorted(named_payload.keys()),",
    "    'pages': {",
    "        'pass': {key: max(1, (len(query_progress_items_by_pass_const(key)) + 59) // 60) for key in pass_keys},",
    "        'comprehensive': {key: max(1, (len(query_progress_items_by_const(float(key))) + 59) // 60) for key in const_keys},",
    "        'star': {str(value): max(1, (len(query_progress_items_by_star(value)) + 59) // 60) for value in star_values},",
    "        'named': named_pages,",
    "    },",
    "}",
    "print(json.dumps(payload, ensure_ascii=False))"
  ].join("\n");
  const result = await runPython(code, [], "utf8");
  const value = JSON.parse(String(result.stdout)) as ProgressOptions;
  optionsCache = { expiresAt: Date.now() + 5 * 60 * 1000, value };
  return value;
};

const assertChoice = (valid: boolean, message: string) => {
  if (!valid) throw createError({ statusCode: 400, statusMessage: message });
};

export const getProgressImageBuffer = async (userId: number, request: ProgressImageRequest) => {
  const binding = await ensureBindingWithUserdata(userId);
  const options = await getProgressOptions();
  const kind = String(request.kind || "") as ProgressKind;
  const page = Math.min(9999, Math.max(1, Number(request.page) || 1));
  const args = [binding.taiko_id, kind, String(page)];
  let rendererCode = "";

  if (kind === "dani") {
    const version = String(request.version || "");
    const grade = String(request.grade || "");
    const versionOptions = options.dani.find((item) => item.version === version);
    assertChoice(Boolean(versionOptions?.grades.includes(grade)), "请选择有效的段位版本和段位");
    args.push(version, grade);
    rendererCode = [
      "from taiko_bot.offline.viewer import render_dani_progress_image_bytes",
      "buf = render_dani_progress_image_bytes(int(sys.argv[1]), sys.argv[5], version=sys.argv[4], explicit_version=True)"
    ].join("\n");
  } else if (kind === "constant") {
    const mode = String(request.mode || "") as ConstantProgressMode;
    const constant = String(request.constant || "");
    assertChoice(mode === "pass" || mode === "comprehensive", "请选择有效的定数模式");
    assertChoice(options.constants[mode].includes(constant), "当前模式下没有这个定数进度表");
    args.push(mode, constant);
    rendererCode = [
      "from taiko_bot.offline.viewer import render_pass_progress_image_bytes, render_progress_image_bytes",
      "renderer = render_pass_progress_image_bytes if sys.argv[4] == 'pass' else render_progress_image_bytes",
      "buf = renderer(int(sys.argv[1]), sys.argv[5], page=int(sys.argv[3]))"
    ].join("\n");
  } else if (kind === "star") {
    const star = Number(request.star);
    assertChoice(options.stars.includes(star), "请选择有效的星级");
    args.push(String(star));
    rendererCode = [
      "from taiko_bot.offline.viewer import render_star_progress_image_bytes",
      "buf = render_star_progress_image_bytes(int(sys.argv[1]), int(sys.argv[4]), page=int(sys.argv[3]))"
    ].join("\n");
  } else if (kind === "named") {
    const name = String(request.name || "");
    assertChoice(options.named.includes(name), "请选择有效的全良难度进度");
    args.push(name);
    rendererCode = [
      "from taiko_bot.offline.viewer import render_progress_image_bytes_by_list",
      "buf = render_progress_image_bytes_by_list(int(sys.argv[1]), sys.argv[4], page=int(sys.argv[3]))"
    ].join("\n");
  } else {
    throw createError({ statusCode: 400, statusMessage: "请选择有效的进度类型" });
  }

  const code = [
    "from contextlib import redirect_stdout",
    "from io import StringIO",
    "import sys",
    "_progress_log = StringIO()",
    "with redirect_stdout(_progress_log):",
    ...rendererCode.split("\n").map((line) => `    ${line}`),
    "sys.stdout.buffer.write(buf.getvalue() if hasattr(buf, 'getvalue') else buf)"
  ].join("\n");
  const result = await runPython(code, args);
  return result.stdout as Buffer;
};

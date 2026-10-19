import { getTaikoPython, getTaikoPythonEnv } from "~/server/utils/taiko-python";
import { withPersonalScoreRead } from "./personal";
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import {
  execFileAsync,
  getCurrentBindingRow,
  getRuntimePaths,
  getUserdataPath
} from "~/server/internal/account/shared";

const DIM_ALIASES: Record<string, string> = {
  大歌: "big_song",
  大歌力: "big_song",
  节奏: "rhythm",
  节奏处理: "rhythm",
  复合: "complex_proc",
  复合处理: "complex_proc",
  精度: "accuracy_power",
  精度力: "accuracy_power",
  体力: "stamina",
  高速: "speed",
  高速处理: "speed"
};

const TREND_DIM_ALIASES: Record<string, string> = {
  rating: "综合Rating",
  综合: "综合Rating",
  总合: "综合Rating",
  综合rating: "综合Rating",
  ra: "综合Rating",
  大歌: "大歌力",
  大歌力: "大歌力",
  big_song: "大歌力",
  体力: "体力",
  stamina: "体力",
  高速: "高速处理",
  高速处理: "高速处理",
  speed: "高速处理",
  精度: "精度力",
  准度: "精度力",
  良率: "精度力",
  精度力: "精度力",
  accuracy: "精度力",
  节奏: "节奏处理",
  节奏处理: "节奏处理",
  rhythm: "节奏处理",
  复合: "复合处理",
  复合处理: "复合处理",
  complex: "复合处理"
};

const normalizeTrendDim = (token: string) => token.replace(/\s+/g, "").trim().toLowerCase();

const resolveTrendDim = (token: string) => TREND_DIM_ALIASES[normalizeTrendDim(token)];

const resolveB30Dim = (token: string) => DIM_ALIASES[token.trim()];

const PYTHON_CHART_HELPERS = [
  "from contextlib import redirect_stdout",
  "from io import StringIO",
  "_chart_log = StringIO()",
  "def _chart_image_bytes(image):",
  "    return image.getvalue() if hasattr(image, 'getvalue') else image"
].join("\n");

const ensureBindingWithUserdata = async (userId: number) => {
  const binding = await getCurrentBindingRow(userId);
  if (!binding) {
    throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  }
  const userdataPath = getUserdataPath(binding.taiko_id);
  try {
    await access(userdataPath, fsConstants.R_OK);
  } catch {
    throw createError({
      statusCode: 404,
      statusMessage: "未找到本地成绩数据，请先在「多端同步」更新数据"
    });
  }
  return binding;
};

export const runPythonImage = async (pythonCode: string, args: string[] = []) => {
  const { repoRoot, userdataDir } = getRuntimePaths();
  const result = await execFileAsync(getTaikoPython(), ["-I", "-c", pythonCode, ...args], {
    cwd: repoRoot,
    env: { ...getTaikoPythonEnv(repoRoot), TAIKO_USERDATA_DIR: userdataDir },
    timeout: 120_000, killSignal: "SIGKILL",
    encoding: "buffer",
    maxBuffer: 30 * 1024 * 1024
  });
  return result.stdout as Buffer;
};

export const toJpeg = async (pngBuffer: Buffer) => {
  const sharp = (await import("sharp")).default;
  return sharp(pngBuffer).jpeg({ quality: 85 }).toBuffer();
};

export const getB30ImageBuffer = async (
  userId: number,
  options: { n?: number; dim?: string; dynamicOrigin?: boolean }
) => {
  const binding = await ensureBindingWithUserdata(userId);
  const N = Math.min(50, Math.max(1, Number(options.n) || 30));
  const dimKey = options.dim ? resolveB30Dim(options.dim) : undefined;
  if (options.dim && !dimKey) {
    throw createError({
      statusCode: 400,
      statusMessage: "维度不支持，可用：大歌、节奏、复合、精度、体力、高速"
    });
  }
  const dynamicOrigin = Boolean(options.dynamicOrigin);
  const taikoId = binding.taiko_id;

  if (!options.dim && !dynamicOrigin) {
    const code = [
      PYTHON_CHART_HELPERS,
      "from taiko_bot.offline.viewer import render_b30_image",
      "import sys",
      "with redirect_stdout(_chart_log):",
      "    buf = render_b30_image(int(sys.argv[1]), N=int(sys.argv[2]))",
      "sys.stdout.buffer.write(_chart_image_bytes(buf))"
    ].join("\n");
    const png = await runPythonImage(code, [taikoId, String(N)]);
    return toJpeg(png);
  }

  const code = [
    PYTHON_CHART_HELPERS,
    "from taiko_bot.offline.viewer import compute_all_from_userdata, generate_dim_top_image, generate_top_N_image",
    "import sys",
    "taiko_id = int(sys.argv[1])",
    "N = int(sys.argv[2])",
    "mode = sys.argv[3]",
    "with redirect_stdout(_chart_log):",
    "    result = compute_all_from_userdata(taiko_id)",
    "    if not result:",
    "        raise SystemExit('empty')",
    "    font_path = 'assets/fonts/DDFont.ttf'",
    "    if mode == 'dim':",
    "        buf = generate_dim_top_image(result, N=N, dim=sys.argv[4], user_id=taiko_id, font_path=font_path)",
    "    else:",
    "        dynamic_origin = sys.argv[4] == '1'",
    "        buf = generate_top_N_image(result, N, user_id=taiko_id, dynamic_origin=dynamic_origin, font_path=font_path)",
    "sys.stdout.buffer.write(_chart_image_bytes(buf))"
  ].join("\n");

  if (dimKey) {
    const png = await runPythonImage(code, [taikoId, String(N), "dim", dimKey]);
    return toJpeg(png);
  }

  const png = await runPythonImage(code, [taikoId, String(N), "top", dynamicOrigin ? "1" : "0"]);
  return toJpeg(png);
};

export const getTrendImageBuffer = async (
  userId: number,
  options: {
    n?: number;
    maxDays?: number;
    dim?: string;
    barMode?: boolean;
    showAll?: boolean;
  }
) => {
  const binding = await ensureBindingWithUserdata(userId);
  const N = Math.min(50, Math.max(1, Number(options.n) || 20));
  const maxDays = Math.min(365, Math.max(1, Number(options.maxDays) || 30));
  const selectedDim = options.dim ? resolveTrendDim(options.dim) : "";
  const barMode = Boolean(options.barMode);
  const showAll = Boolean(options.showAll);

  const code = [
    PYTHON_CHART_HELPERS,
    "from taiko_bot.offline.viewer import generate_rating_trend_image",
    "import sys, json",
    "kwargs = json.loads(sys.argv[2])",
    "with redirect_stdout(_chart_log):",
    "    buf = generate_rating_trend_image(int(sys.argv[1]), **kwargs)",
    "if not buf:",
    "    raise SystemExit('empty')",
    "sys.stdout.buffer.write(_chart_image_bytes(buf))"
  ].join("\n");

  const kwargs = JSON.stringify({
    N,
    max_days: maxDays,
    bar_mode: barMode,
    show_all: showAll,
    selected_dim: selectedDim || null
  });

  const png = await runPythonImage(code, [binding.taiko_id, kwargs]);
  return toJpeg(png);
};

const RECOMMEND_DIM_ALIASES: Record<string, string> = {
  rating: "rating",
  综合: "rating",
  总合: "rating",
  daigouryoku: "daigouryoku",
  大歌力: "daigouryoku",
  大歌: "daigouryoku",
  stamina: "stamina",
  体力: "stamina",
  speed: "speed",
  高速: "speed",
  高速处理: "speed",
  accuracy_power: "accuracy_power",
  精度: "accuracy_power",
  准度: "accuracy_power",
  良率: "accuracy_power",
  精度力: "accuracy_power",
  rhythm: "rhythm",
  节奏: "rhythm",
  节奏处理: "rhythm",
  complex: "complex",
  复合: "complex",
  复合处理: "complex"
};

const normalizeRecommendDim = (token: string) => token.replace(/\s+/g, "").trim().toLowerCase();

export const resolveRecommendDim = (token: string) => {
  const trimmed = token.trim();
  if (!trimmed) {
    return { dimKey: "rating", dimLabel: "rating" };
  }
  const dimKey = RECOMMEND_DIM_ALIASES[trimmed] || RECOMMEND_DIM_ALIASES[normalizeRecommendDim(trimmed)];
  return dimKey ? { dimKey, dimLabel: trimmed } : null;
};

export const getRecommendImageBuffer = async (
  userId: number,
  options: { n?: number; dim?: string }
) => withPersonalScoreRead(userId, async binding => {
  const limit = Math.min(50, Math.max(1, Number(options.n) || 20));
  const resolved = options.dim ? resolveRecommendDim(options.dim) : { dimKey: "rating", dimLabel: "rating" };
  if (!resolved) {
    throw createError({
      statusCode: 400,
      statusMessage: "维度不支持。可用：rating/综合、大歌力、体力、高速处理、精度力、节奏处理、复合处理"
    });
  }

  const { repoRoot, userdataDir } = getRuntimePaths();
  const jsonPath = `${repoRoot}/songs/rating_structured_with_ids.json`;
  const subtitle = `维度：${resolved.dimLabel}  数量：${limit}`;
  const code = [
    PYTHON_CHART_HELPERS,
    "from taiko_bot.offline.viewer import compute_recommendations_for_user, generate_recommend_image",
    "import sys, json",
    "payload = json.loads(sys.argv[2])",
    "with redirect_stdout(_chart_log):",
    "    recs = compute_recommendations_for_user(",
    "        int(sys.argv[1]),",
    "        best_key=payload['best_key'],",
    "        limit=payload['limit'],",
    "        json_path=payload['json_path'],",
    "    )",
    "    buf = generate_recommend_image(",
    "        recs,",
    "        title='以下是可供参考的推荐歌曲',",
    "        subtitle=payload['subtitle'],",
    "        user_id=int(sys.argv[1]),",
    "        font_path='assets/fonts/DDFont.ttf',",
    "    )",
    "sys.stdout.buffer.write(_chart_image_bytes(buf))"
  ].join("\n");

  const payload = JSON.stringify({
    best_key: resolved.dimKey,
    limit,
    json_path: jsonPath,
    subtitle
  });

  const png = await runPythonImage(code, [binding.taiko_id, payload]);
  return toJpeg(png);
});

export const getWordCloudImageBuffer = async (userId: number) => {
  const binding = await ensureBindingWithUserdata(userId);
  const code = [
    "from taiko_bot.offline.viewer import render_tcloud_image",
    "import sys",
    "sys.stdout.buffer.write(render_tcloud_image(int(sys.argv[1])))"
  ].join("; ");
  return runPythonImage(code, [binding.taiko_id]);
};

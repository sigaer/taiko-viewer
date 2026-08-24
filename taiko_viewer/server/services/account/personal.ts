import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { createError } from "h3";
import {
  execFileAsync,
  getCurrentBindingRow,
  getRuntimePaths,
  getUserdataPath
} from "~/server/internal/account/shared";

type PersonalRatingSummary = {
  current: number | null;
  scoreCount: number;
};

type PersonalRecommendation = {
  title: string;
  song_id: number;
  level: number;
  is_unplayed: boolean;
  user_indicator: number;
  reference_indicator: number;
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

const runPythonJson = async (pythonCode: string, args: string[]) => {
  const { repoRoot } = getRuntimePaths();
  const result = await execFileAsync("python3", ["-c", pythonCode, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 12 * 1024 * 1024
  });
  try {
    return JSON.parse(String(result.stdout || ""));
  } catch {
    throw createError({ statusCode: 502, statusMessage: "个人数据计算结果无效" });
  }
};

export const getPersonalRatingSummary = async (userId: number): Promise<PersonalRatingSummary> => {
  const binding = await ensureBindingWithUserdata(userId);
  const { repoRoot } = getRuntimePaths();
  const ratingPath = `${repoRoot}/songs/rating_structured_with_ids.json`;
  const code = [
    "from contextlib import redirect_stdout",
    "from io import StringIO",
    "import json, sys",
    "from plugins.utils.score_calculator import aggregate_topN_value, compute_all_from_userdata",
    "log = StringIO()",
    "with redirect_stdout(log):",
    "    results = compute_all_from_userdata(int(sys.argv[1]), json_path=sys.argv[2])",
    "rating = aggregate_topN_value(results, 'AI_rating', 20) if results else 0.0",
    "print(json.dumps({'current': round(float(rating), 2) if rating > 0 else None, 'scoreCount': len(results)}, ensure_ascii=False))"
  ].join("\n");
  return await runPythonJson(code, [binding.taiko_id, ratingPath]);
};

export const getPersonalRecommendations = async (userId: number) => {
  const binding = await ensureBindingWithUserdata(userId);
  const { repoRoot } = getRuntimePaths();
  const ratingPath = `${repoRoot}/songs/rating_structured_with_ids.json`;
  const code = [
    "from contextlib import redirect_stdout",
    "from io import StringIO",
    "import json, sys",
    "from plugins.utils.score_calculator import compute_recommendations_for_user",
    "log = StringIO()",
    "with redirect_stdout(log):",
    "    recommendations = compute_recommendations_for_user(int(sys.argv[1]), best_key='rating', limit=3, json_path=sys.argv[2])",
    "fields = ('title', 'song_id', 'level', 'is_unplayed', 'user_indicator', 'reference_indicator')",
    "items = [{key: item.get(key) for key in fields} for item in recommendations if item.get('song_id') and item.get('level')]",
    "print(json.dumps({'items': items}, ensure_ascii=False))"
  ].join("\n");
  return await runPythonJson(code, [binding.taiko_id, ratingPath]) as {
    items: PersonalRecommendation[];
  };
};

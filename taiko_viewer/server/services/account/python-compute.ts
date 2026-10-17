import { createError } from "h3";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getRuntimePaths } from "../../infrastructure/runtime-paths.ts";
import { PublicationUnavailableError } from "../../infrastructure/taiko-publication/client.ts";
import { getTaikoPython, getTaikoPythonEnv } from "../../utils/taiko-python.ts";

const execFileAsync = promisify(execFile);
const compute = async (module: string, args: string[], failure: string) => {
  const { repoRoot, userdataDir } = getRuntimePaths();
  try {
    const result = await execFileAsync(getTaikoPython(), ["-I", "-m", module, ...args], {
      cwd: repoRoot, encoding: "utf8", maxBuffer: 12 * 1024 * 1024,
      timeout: 120_000, killSignal: "SIGKILL",
      env: { ...getTaikoPythonEnv(repoRoot), TAIKO_COMPUTE_ONLY: "1", TAIKO_USERDATA_DIR: userdataDir }
    });
    return JSON.parse(String(result.stdout || ""));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 75) throw new PublicationUnavailableError();
    throw createError({ statusCode: 502, statusMessage: failure });
  }
};

export const runPythonJson = (args: string[]) => compute("taiko_bot.offline.recommendation_intelligence", args, "个人数据计算结果无效");
export const runGrowthPythonJson = (taikoId: string, dataMode: string, limit = 3) =>
  compute("taiko_bot.offline.growth_compute", ["growth", "--user", taikoId, "--data-mode", dataMode, "--limit", String(limit)], "个人成长计算结果无效");

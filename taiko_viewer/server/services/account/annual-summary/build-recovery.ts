import { createHash } from "node:crypto";
import { readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

// Viewer build-state contract, not the frozen generator algorithm version.
// A legacy failure without an input revision is retried once; the new job
// records this revision before execution, so a repeated failure stays terminal.
export const ANNUAL_BUILD_STATE_REVISION = "annual-build-state-v2-report-window";

export const annualBuildInputRevision = async (userdataDir: string, taikoId: string, algorithmVersion: string) => {
  const historyDir = resolve(userdataDir, taikoId);
  const names = (await readdir(historyDir).catch((error) => {
    if (error.code === "ENOENT") return [] as string[];
    throw error;
  })).filter(name => name.startsWith("data_") && name.endsWith(".json")).sort();
  const paths = [resolve(userdataDir, `${taikoId}data.json`), ...names.map(name => resolve(historyDir, name))];
  const hash = createHash("sha256");
  hash.update(`${ANNUAL_BUILD_STATE_REVISION}:${algorithmVersion}`);
  for (const path of paths) {
    const info = await stat(path).catch(error => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    hash.update(JSON.stringify([path, info ? [info.size, info.mtimeMs, info.ino] : null]));
  }
  return hash.digest("hex");
};

export const canReuseAnnualFailure = (job: { status: string; parameters_json: string | null } | null, revision: string) => {
  if (job?.status !== "failed") return false;
  try {
    return JSON.parse(job.parameters_json || "{}").inputRevision === revision;
  } catch {
    return false;
  }
};

export const canReuseAnnualSummary = (
  summary: { provenance?: { algorithmVersion?: string | null } | null } | null,
  currentAlgorithmVersion: string
) => Boolean(
  currentAlgorithmVersion
  && summary?.provenance?.algorithmVersion === currentAlgorithmVersion
);

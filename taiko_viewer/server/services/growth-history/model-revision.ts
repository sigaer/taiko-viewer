import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { getRuntimePaths } from "~/server/internal/account/shared";

type RevisionCache = { identity: string; revision: string };
let cache: RevisionCache | null = null;

const relativeInputs = [
  "growth_compute/__main__.py",
  "plugins/utils/chart_availability.py",
  "plugins/utils/duplicate_versions.py",
  "plugins/utils/snapshot_history.py",
  "plugins/utils/score_calculator.py",
  "songs/rating_structured_with_ids.json",
  "songs/song_data.json",
  "songs/song_alias.json"
];

export async function getGrowthModelRevision() {
  const { repoRoot } = getRuntimePaths();
  const paths = relativeInputs.map(name => resolve(repoRoot, name));
  const stats = await Promise.all(paths.map(path => stat(path)));
  const identity = stats.map((item, index) => `${relativeInputs[index]}:${item.size}:${item.mtimeMs}`).join("|");
  if (cache?.identity === identity) return cache.revision;
  const hash = createHash("sha256");
  for (let index = 0; index < paths.length; index += 1) {
    hash.update(relativeInputs[index]);
    hash.update("\0");
    for await (const chunk of createReadStream(paths[index])) hash.update(chunk);
    hash.update("\0");
  }
  const revision = hash.digest("hex");
  cache = { identity, revision };
  return revision;
}

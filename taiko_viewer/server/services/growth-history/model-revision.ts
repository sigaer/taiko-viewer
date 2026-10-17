import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import { getTaikoArtifact } from "~/server/utils/taiko-artifact";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getRuntimePaths } from "~/server/internal/account/shared";
import { getTaikoPython } from "~/server/utils/taiko-python";

const execute = promisify(execFile);
let cache: { identity: string; revision: string } | null = null;

// The wheel owns the algorithm identity and the verified legacy hash bridge.
// Existing measurement rows are never rewritten by this read operation.
export async function getGrowthModelRevision() {
  const { repoRoot } = getRuntimePaths();
  const hash = createHash("sha256").update((await getTaikoArtifact()).identity);
  for (const name of ["rating_structured_with_ids.json", "song_data.json", "song_alias.json"]) {
    hash.update(`\0${name}\0`);
    for await (const chunk of createReadStream(resolve(repoRoot, "songs", name))) hash.update(chunk);
  }
  const identity = hash.digest("hex");
  if (cache?.identity === identity) return cache.revision;
  const { stdout } = await execute(getTaikoPython(), ["-I", "-m", "taiko_bot.offline.fingerprint", "--growth-root", repoRoot], {
    timeout: 60_000, maxBuffer: 64 * 1024, encoding: "utf8"
  });
  const revision = stdout.trim();
  if (!/^[0-9a-f]{64}$/.test(revision)) throw new Error("Invalid installed Growth revision");
  cache = { identity, revision };
  return revision;
}

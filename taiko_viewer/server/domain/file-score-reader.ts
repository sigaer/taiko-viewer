import { access, open, readFile, readdir, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { SCORE_READ_VERSION, type LegacyScorePayload, type ScoreReadPort } from "./score-read-contract.ts";

// Matches center external IDs and Viewer manual IDs; never accepts paths.
export function assertScoreIdentity(taikoId: string): void {
  if (typeof taikoId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(taikoId)) {
    throw new Error("Invalid score identity");
  }
}

/** Host clock is supplied explicitly; byte revisions stay independent of it. */
export function createFileScoreReader(userdataDir: string, now: () => string): ScoreReadPort {
  const currentPath = (taikoId: string) => {
    assertScoreIdentity(taikoId);
    return resolve(userdataDir, `${taikoId}data.json`);
  };
  const historyPath = (taikoId: string, name?: string) => {
    assertScoreIdentity(taikoId);
    if (name !== undefined && (!/^data_.+\.json$/.test(name) || /[/\\\0]/.test(name))) {
      throw new Error("Invalid score history name");
    }
    return name === undefined ? resolve(userdataDir, taikoId) : resolve(userdataDir, taikoId, name);
  };
  const readRawCurrent = (taikoId: string) => readFile(currentPath(taikoId), "utf8");
  return {
    contractVersion: SCORE_READ_VERSION,
    readRawCurrent,
    async readCurrent(taikoId) {
      const raw = await readRawCurrent(taikoId);
      const current = JSON.parse(raw) as LegacyScorePayload;
      return { contractVersion: SCORE_READ_VERSION, current, raw,
        revision: createHash("sha256").update(raw).digest("hex"), capturedAt: now() };
    },
    async currentExists(taikoId) {
      const path = currentPath(taikoId);
      try { await access(path, constants.R_OK); return true; } catch { return false; }
    },
    async readDailyAbility(taikoId) {
      assertScoreIdentity(taikoId);
      let file;
      try {
        file = await open(resolve(userdataDir, taikoId, "daily-ability-v1-top20.json"), "r");
        if ((await file.stat()).size > 8 * 1024 * 1024) throw new Error("Daily ability archive too large");
        return JSON.parse(await file.readFile("utf8"));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
      } finally { await file?.close(); }
    },
    listHistory: taikoId => readdir(historyPath(taikoId)),
    readHistory: (taikoId, name) => readFile(historyPath(taikoId, name), "utf-8"),
    async historyFileVersion(taikoId, name) {
      const info = await stat(historyPath(taikoId, name), { bigint: true });
      return `${name}:${info.dev}:${info.ino}:${info.size}:${info.mtimeNs}:${info.ctimeNs}`;
    },
    async historyDirectoryVersion(taikoId) {
      const info = await stat(historyPath(taikoId), { bigint: true });
      return `${info.dev}:${info.ino}:${info.mtimeNs}:${info.ctimeNs}`;
    }
  };
}

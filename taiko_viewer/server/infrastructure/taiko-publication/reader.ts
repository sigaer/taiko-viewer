import { open } from "node:fs/promises";
import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { createFileScoreReader, assertScoreIdentity } from "../../domain/file-score-reader.ts";
import { SCORE_READ_VERSION, type LegacyScorePayload, type ScoreReadPort } from "../../domain/score-read-contract.ts";
import { PublicationUnavailableError, type PublicationManifest, type PublicationReference } from "./client.ts";

type Input = {
  root: string; identity: string; now: () => string; assertActive: () => void;
  view: () => PublicationManifest | null;
  staged: Map<string, PublicationReference | null>;
  historyReplaced?: () => boolean;
};
const absent = () => Object.assign(new Error("Score object is absent"), { code: "ENOENT" });
const historyKey = (name: string) => {
  if (!/^data_[^/\\\0]+\.json$/.test(name)) throw new PublicationUnavailableError();
  return `history/${name}`;
};

/** One captured manifest, protected by its live kernel lease. */
export function createPublicationScoreReader(input: Input): ScoreReadPort {
  assertScoreIdentity(input.identity);
  const legacy = createFileScoreReader(input.root, input.now);
  const check = (identity: string) => {
    input.assertActive();
    if (identity !== input.identity) throw new PublicationUnavailableError();
  };
  const referenceFor = (key: string) => input.staged.has(key) ? input.staged.get(key)
    : key.startsWith("history/") && input.historyReplaced?.() ? undefined : input.view()?.files[key];
  const rawObject = async (reference: PublicationReference) => {
    let file;
    try {
      if (!/^[a-f0-9]{64}$/.test(reference.sha256) || !Number.isSafeInteger(reference.bytes) ||
          reference.bytes < 0 || reference.bytes > 64 * 1024 * 1024) throw new PublicationUnavailableError();
      file = await open(resolve(input.root, ".taiko-publications", input.identity, "objects", reference.sha256),
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      const info = await file.stat();
      if (!info.isFile() || info.size !== reference.bytes) throw new PublicationUnavailableError();
      const raw = await file.readFile("utf8");
      input.assertActive();
      if (Buffer.byteLength(raw) !== reference.bytes || createHash("sha256").update(raw).digest("hex") !== reference.sha256) {
        throw new PublicationUnavailableError();
      }
      return raw;
    } catch { throw new PublicationUnavailableError(); }
    finally { await file?.close(); }
  };
  const readRawCurrent = async (identity: string) => {
    check(identity);
    const reference = referenceFor("current");
    if (reference) return rawObject(reference);
    if (input.view() !== null || input.staged.has("current")) throw absent();
    const raw = await legacy.readRawCurrent(identity);
    input.assertActive();
    return raw;
  };
  return {
    contractVersion: SCORE_READ_VERSION,
    readRawCurrent,
    async readCurrent(identity) {
      const raw = await readRawCurrent(identity);
      let current: LegacyScorePayload;
      try { current = JSON.parse(raw) as LegacyScorePayload; }
      catch (error) { if (input.view()) throw new PublicationUnavailableError(); throw error; }
      return { contractVersion: SCORE_READ_VERSION, current,
        raw, revision: createHash("sha256").update(raw).digest("hex"), capturedAt: input.now() };
    },
    async currentExists(identity) {
      check(identity);
      if (input.view() !== null || input.staged.has("current")) return Boolean(referenceFor("current"));
      return legacy.currentExists(identity);
    },
    async readDailyAbility(identity) { check(identity); return legacy.readDailyAbility(identity); },
    async listHistory(identity) {
      check(identity);
      const view = input.view();
      const names = new Set(input.historyReplaced?.() ? [] : view === null ? await legacy.listHistory(identity).catch(error => {
        if (error.code === "ENOENT") return [];
        throw error;
      }) : Object.keys(view.files).filter(key => key.startsWith("history/")).map(key => key.slice(8)));
      for (const [key, reference] of input.staged) {
        if (!key.startsWith("history/")) continue;
        if (reference) names.add(key.slice(8)); else names.delete(key.slice(8));
      }
      return [...names];
    },
    async readHistory(identity, name) {
      check(identity);
      const key = historyKey(name), reference = referenceFor(key);
      if (reference) return rawObject(reference);
      if (input.view() !== null || input.staged.has(key) || input.historyReplaced?.()) throw absent();
      return legacy.readHistory(identity, name);
    },
    async historyFileVersion(identity, name) {
      check(identity);
      const key = historyKey(name), reference = referenceFor(key);
      if (reference) return `${name}:${reference.sha256}:${reference.bytes}`;
      if (input.view() !== null || input.staged.has(key) || input.historyReplaced?.()) throw absent();
      return legacy.historyFileVersion(identity, name);
    },
    async historyDirectoryVersion(identity) {
      check(identity);
      const view = input.view();
      return view === null ? legacy.historyDirectoryVersion(identity) : `publication-v1:${view.sequence}:${view.commitId}`;
    }
  };
}

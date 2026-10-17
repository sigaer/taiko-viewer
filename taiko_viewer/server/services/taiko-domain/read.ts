import type { ScoreReadPort } from "../../domain/score-read-contract.ts";
import { SCORE_READ_VERSION } from "../../domain/score-read-contract.ts";
import { currentScoreScope, withDomainScoreRead } from "./publication.ts";

/** Host composition; products consume the port without knowing storage layout. */
export function getDomainScoreReader(): ScoreReadPort {
  const scope = currentScoreScope();
  if (scope) return scope.reader;
  const call = <K extends keyof ScoreReadPort>(method: K, identity: string, ...args: unknown[]) =>
    withDomainScoreRead(identity, async () => {
      const reader = currentScoreScope(identity)!.reader;
      return (reader[method] as (...parameters: unknown[]) => Promise<unknown>)(identity, ...args);
    });
  return {
    contractVersion: SCORE_READ_VERSION,
    readCurrent: identity => call("readCurrent", identity) as ReturnType<ScoreReadPort["readCurrent"]>,
    readRawCurrent: identity => call("readRawCurrent", identity) as Promise<string>,
    currentExists: identity => call("currentExists", identity) as Promise<boolean>,
    readDailyAbility: identity => call("readDailyAbility", identity),
    listHistory: identity => call("listHistory", identity) as Promise<string[]>,
    readHistory: (identity, name) => call("readHistory", identity, name) as Promise<string>,
    historyFileVersion: (identity, name) => call("historyFileVersion", identity, name) as Promise<string>,
    historyDirectoryVersion: identity => call("historyDirectoryVersion", identity) as Promise<string>
  };
}

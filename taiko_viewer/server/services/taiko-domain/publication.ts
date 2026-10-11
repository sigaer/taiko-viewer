import { getRuntimePaths } from "../../infrastructure/runtime-paths.ts";
import { withScoreRead, withScoreWrite, currentScoreScope, stageScoreText, removeScoreProjection, onScoreRollback, scorePublication } from "../../infrastructure/taiko-publication/scope.ts";

const options = (identity: string) => {
  const { userdataDir, repoRoot } = getRuntimePaths();
  return { root: userdataDir, repoRoot, identity, now: () => new Date().toISOString() };
};
export const withDomainScoreRead = <T>(identity: string, task: () => Promise<T>) => withScoreRead(options(identity), task);
export const withDomainScoreWrite = <T>(identity: string, task: () => Promise<T>) => withScoreWrite(options(identity), task);
export { currentScoreScope, stageScoreText, removeScoreProjection, onScoreRollback, scorePublication };

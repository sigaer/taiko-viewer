import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { ScoreReadPort } from "../../domain/score-read-contract.ts";
import { withPublicationLease, PublicationUnavailableError, type PublicationLease, type PublicationReference } from "./client.ts";
import { createPublicationScoreReader } from "./reader.ts";

export type SourceOptions = { root: string; repoRoot: string; identity: string; now: () => string };
type SourceScope = {
  root: string; repoRoot: string;
  identity: string; lease: PublicationLease; reader: ScoreReadPort; mode: "read" | "write";
  staged: Map<string, PublicationReference | null>; rollback: Array<() => Promise<void>>;
  replaceHistory: boolean;
  active: boolean;
};
const scopes = new AsyncLocalStorage<SourceScope>();
const assertScope = (scope: SourceScope) => {
  if (!scope.active || !scope.lease.alive()) throw new PublicationUnavailableError();
};
export const currentScoreScope = (identity?: string) => {
  const scope = scopes.getStore();
  if (scope && (identity === undefined || scope.identity === identity)) { assertScope(scope); return scope; }
  return undefined;
};
export const scorePublication = (identity: string) => currentScoreScope(identity)?.lease.view || null;

export async function createScoreBackup(identity: string, backupKey: string) {
  const scope = currentScoreScope(identity);
  if (!scope || scope.mode !== "write" || scope.staged.size) throw new PublicationUnavailableError();
  const receipt = await scope.lease.backup(backupKey);
  // A completed backup key is immutable. It may be retried after the source
  // changes, but it cannot authorize deleting a newer generation.
  if (receipt.source.commitId !== scope.lease.view?.commitId || receipt.source.sequence !== scope.lease.view.sequence) {
    throw new PublicationUnavailableError();
  }
  return receipt;
}
export async function purgeScoreBackupArchives(identity: string, backupKey: string) {
  const scope = currentScoreScope(identity);
  if (!scope || scope.mode !== "write") throw new PublicationUnavailableError();
  await scope.lease.purgeBackupArchives(backupKey);
}
export async function verifyScoreBackup(identity: string, backupKey: string) {
  const scope = currentScoreScope(identity);
  if (!scope || scope.mode !== "write" || scope.staged.size) throw new PublicationUnavailableError();
  return scope.lease.verifyBackup(backupKey);
}
export async function restoreScoreBackup(identity: string, backupKey: string, transactionId: string) {
  const scope = currentScoreScope(identity);
  if (!scope || scope.mode !== "write" || scope.staged.size || scope.rollback.length) throw new PublicationUnavailableError();
  return scope.lease.restoreBackup(backupKey, transactionId);
}
export async function clearScoreSource(identity: string) {
  const scope = currentScoreScope(identity);
  if (!scope || scope.mode !== "write" || scope.staged.size) throw new PublicationUnavailableError();
  await removeScoreProjection(identity, "current");
  scope.replaceHistory = true;
}

async function runScope<T>(options: SourceOptions, mode: "read" | "write", task: () => Promise<T>): Promise<T> {
  const current = currentScoreScope(options.identity);
  if (current) {
    if (current.root !== options.root || current.repoRoot !== options.repoRoot) throw new PublicationUnavailableError();
    if (mode === "write" && current.mode !== "write") throw new PublicationUnavailableError();
    return task();
  }
  const transactionId = randomUUID().replaceAll("-", "");
  let scope: SourceScope | undefined;
  let result: T | undefined;
  let prepared = false;
  let confirmed = false;
  let baseSequence = 0;
  const compensate = async () => {
    const actions = scope?.rollback.splice(0).reverse() || [];
    for (const rollback of actions) await rollback().catch(() => console.error("[score-publication] compensating action failed"));
  };
  try {
    return await withPublicationLease({ ...options, mode }, async lease => {
      baseSequence = lease.view?.sequence || 0;
      const staged = new Map<string, PublicationReference | null>();
      scope = { root: options.root, repoRoot: options.repoRoot, identity: options.identity, lease, staged, rollback: [], replaceHistory: false, mode, active: true, reader: undefined as unknown as ScoreReadPort };
      scope.reader = createPublicationScoreReader({ ...options, assertActive: () => assertScope(scope!), staged, view: () => lease.view, historyReplaced: () => scope!.replaceHistory });
      try {
        result = await scopes.run(scope, task);
        assertScope(scope);
        prepared = true;
        if (mode === "write" && staged.size) {
          await lease.publish({ transactionId, replaceHistory: scope.replaceHistory });
          confirmed = true;
        }
        return result;
      } catch (error) {
        // Before publication we still own EX. Finish this request's SQL
        // compensation before a queued writer can observe those side effects.
        if (!prepared && mode === "write" && lease.alive()) await scopes.run(scope, compensate);
        throw error;
      } finally { scope.active = false; }
    });
  } catch (error) {
    // The child can die after the durable commit but before its response. Probe
    // our unique transaction only after the original lease has been closed.
    if (!confirmed && mode === "write" && scope && ((prepared && scope.staged.size) || scope.rollback.length)) {
      try {
        await withPublicationLease({ ...options, mode: "write" }, async lease => {
          confirmed = prepared && (lease.view?.commitId === transactionId || lease.view?.previousCommitId === transactionId);
          // Verification and compensation share EX. A newer writer must not
          // slip between the proof of rollback and destructive SQL cleanup.
          if (!confirmed && (lease.view?.sequence || 0) <= baseSequence) await compensate();
        });
      } catch { /* Unknown outcome stays an error; do not undo DB locks. */ }
    }
    if (confirmed) return result as T;
    throw error;
  }
}

export const withScoreRead = <T>(options: SourceOptions, task: () => Promise<T>) => runScope(options, "read", task);
export const withScoreWrite = <T>(options: SourceOptions, task: () => Promise<T>) => runScope(options, "write", task);
export async function stageScoreText(identity: string, key: string, body: string) {
  const scope = currentScoreScope(identity);
  if (!scope || scope.mode !== "write") throw new PublicationUnavailableError();
  scope.staged.set(key, await scope.lease.put(key, body));
}
export async function removeScoreProjection(identity: string, key: string) {
  const scope = currentScoreScope(identity);
  if (!scope || scope.mode !== "write") throw new PublicationUnavailableError();
  await scope.lease.remove(key);
  scope.staged.set(key, null);
}
export function onScoreRollback(identity: string, rollback: () => Promise<void>) {
  const scope = currentScoreScope(identity);
  if (!scope || scope.mode !== "write") throw new PublicationUnavailableError();
  scope.rollback.push(rollback);
}

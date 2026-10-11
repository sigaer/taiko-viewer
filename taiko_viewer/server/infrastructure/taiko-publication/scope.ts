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
  let verifiedRollback = false;
  try {
    return await withPublicationLease({ ...options, mode }, async lease => {
      baseSequence = lease.view?.sequence || 0;
      const staged = new Map<string, PublicationReference | null>();
      scope = { root: options.root, repoRoot: options.repoRoot, identity: options.identity, lease, staged, rollback: [], mode, active: true, reader: undefined as unknown as ScoreReadPort };
      scope.reader = createPublicationScoreReader({ ...options, assertActive: () => assertScope(scope!), staged, view: () => lease.view });
      try {
        result = await scopes.run(scope, task);
        assertScope(scope);
        prepared = true;
        if (mode === "write" && staged.size) {
          await lease.publish({ transactionId });
          confirmed = true;
        }
        return result;
      } finally { scope.active = false; }
    });
  } catch (error) {
    // The child can die after the durable commit but before its response. Probe
    // our unique transaction only after the original lease has been closed.
    if (!confirmed && prepared && mode === "write" && scope?.staged.size) {
      try {
        await withPublicationLease({ ...options, mode: "read" }, async lease => {
          confirmed = lease.view?.commitId === transactionId || lease.view?.previousCommitId === transactionId;
          verifiedRollback = !confirmed && (lease.view?.sequence || 0) <= baseSequence;
        });
      } catch { /* Unknown outcome stays an error; do not undo DB locks. */ }
    }
    if (confirmed) return result as T;
    if (scope && (!prepared || scope.staged.size === 0)) {
      for (const rollback of scope.rollback.reverse()) await rollback().catch(() => console.error("[score-publication] compensating action failed"));
    } else if (scope && verifiedRollback) {
      // Merely seeing a newer, different head cannot prove rollback: this
      // transaction may already be an ancestor. Never undo locks on ambiguity.
      for (const rollback of scope.rollback.reverse()) await rollback().catch(() => console.error("[score-publication] compensating action failed"));
    }
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

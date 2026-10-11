import { createError } from "h3";
import { assertBindingIdentity, captureBindingIdentity } from "../../internal/account/binding-identity.ts";
import { lockViewerBindingAuthority, rollbackViewerBindingTransaction } from "../../internal/account/binding-authority.ts";
import { mutateScoreToken, proveScoreTokenResult, readScoreTokenStatus, type ScoreTokenResult } from "../../infrastructure/account/score-token.ts";
import { MANUAL_SOURCE_ID } from "../../internal/account/source-lifecycle.ts";
import { readViewerCurrentBinding, requireViewerBindingOwner } from "../../internal/account/binding-read.ts";
import { PublicationUnavailableError } from "../../infrastructure/taiko-publication/client.ts";
import { currentScoreScope } from "../taiko-domain/publication.ts";
import { withViewerCurrentSource } from "./current-source.ts";
import type { BindingReadDb } from "../../internal/account/binding-read.ts";
import type { BindingRow } from "../../internal/account/binding-read.ts";

export const canManageExternalScoreToken = (binding: BindingRow | null) => Boolean(binding &&
  ["wahlap", "hiroba"].includes(binding.source) && !binding.manual_account_id &&
  !MANUAL_SOURCE_ID.test(binding.taiko_id) && /^[0-9]{1,25}$/.test(binding.taiko_id));

/** Source EX -> SQL owner/current -> token mutation in one SQL transaction.
 * No independent gateway can commit a token outside this authority transaction
 * or attempt a second Source EX underneath the caller's lease.
 */
export function manageViewerScoreToken(userId: number, action: "issue" | "revoke") {
  return withViewerCurrentSource(userId, "write", async (binding, db) => {
    const expected = captureBindingIdentity(binding!);
    const external = () => {
      if (binding!.source === "manual" || binding!.manual_account_id || MANUAL_SOURCE_ID.test(binding!.taiko_id)) {
        throw createError({ statusCode: 400, statusMessage: "手动账号不支持网页成绩 token" });
      }
      if (!["wahlap", "hiroba"].includes(binding!.source) || !/^[0-9]{1,25}$/.test(binding!.taiko_id)) {
        throw createError({ statusCode: 400, statusMessage: "绑定记录无效" });
      }
    };
    external();
    const connection = await db.getConnection();
    let prepared: ScoreTokenResult | undefined;
    let commitAttempted = false;
    const live = () => {
      const scope = currentScoreScope(binding!.taiko_id);
      if (!scope || scope.mode !== "write" || scope.staged.size || !scope.lease.alive()) throw new PublicationUnavailableError();
    };
    try {
      await connection.beginTransaction();
      const rows = await lockViewerBindingAuthority(connection, userId);
      const selected = rows.find(row => Number(row.is_current)) || rows[0];
      assertBindingIdentity(expected, selected);
      external();
      live();
      const result = await mutateScoreToken(connection, binding!.taiko_id, action);
      await proveScoreTokenResult(connection, binding!.taiko_id, action, result);
      live();
      prepared = result;
      commitAttempted = true;
      await connection.commit();
      return result;
    } catch (error) {
      await rollbackViewerBindingTransaction(connection);
      // A pre-COMMIT failure must roll back. An uncertain COMMIT is acknowledged
      // only by the exact persisted token outcome and still-live owner/current.
      if (commitAttempted && prepared && currentScoreScope(binding!.taiko_id)?.lease.alive()) {
        live();
        await requireViewerBindingOwner(db, userId);
        assertBindingIdentity(expected, await readViewerCurrentBinding(db, userId));
        await proveScoreTokenResult(db, binding!.taiko_id, action, prepared);
        live();
        return prepared;
      }
      throw error;
    }
    finally { connection.release(); }
  });
}

export async function readViewerScoreTokenStatus(db: BindingReadDb, taikoId: string) {
  const live = () => {
    if (!currentScoreScope(taikoId)?.lease.alive()) throw new PublicationUnavailableError();
  };
  live();
  const status = await readScoreTokenStatus(db, taikoId);
  live();
  return status;
}

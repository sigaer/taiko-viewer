import { createError } from "h3";
import { createHash } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { assertBindingIdentity, captureBindingIdentity } from "../../internal/account/binding-identity.ts";
import { lockViewerBindingAuthority, rollbackViewerBindingTransaction } from "../../internal/account/binding-authority.ts";
import { requestScoreTokenManagement } from "../../internal/account/score-token.ts";
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

/** The loopback token gateway commits its own token SQL. The caller keeps
 * Source EX and SQL owner/current locks until that bounded gateway completes.
 * Gateway side effects are not rolled back by this read-only authority txn;
 * a fresh issue intentionally rotates again after an unacknowledged operation.
 * The gateway must not attempt to acquire this caller's Source lease.
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
    let prepared: Awaited<ReturnType<typeof requestScoreTokenManagement>> | undefined;
    try {
      await connection.beginTransaction();
      const rows = await lockViewerBindingAuthority(connection, userId);
      const selected = rows.find(row => Number(row.is_current)) || rows[0];
      assertBindingIdentity(expected, selected);
      external();
      const result = await requestScoreTokenManagement(binding!.taiko_id, action);
      await proveTokenResult(connection, binding!.taiko_id, action, result);
      const scope = currentScoreScope(binding!.taiko_id);
      if (!scope || scope.mode !== "write" || scope.staged.size || !scope.lease.alive()) throw new PublicationUnavailableError();
      prepared = result;
      await connection.commit();
      return result;
    } catch (error) {
      await rollbackViewerBindingTransaction(connection);
      // No SQL mutation belongs to this authority transaction. A lost readonly
      // COMMIT ack can acknowledge the already-proven gateway result only while
      // the same owner/current identity and exact token outcome remain live.
      if (prepared && currentScoreScope(binding!.taiko_id)?.lease.alive()) {
        await requireViewerBindingOwner(db, userId);
        assertBindingIdentity(expected, await readViewerCurrentBinding(db, userId));
        await proveTokenResult(db, binding!.taiko_id, action, prepared);
        return prepared;
      }
      throw error;
    }
    finally { connection.release(); }
  });
}

async function proveTokenResult(connection: BindingReadDb, taikoId: string, action: "issue" | "revoke",
  result: Awaited<ReturnType<typeof requestScoreTokenManagement>>) {
  const [rows] = await connection.execute<RowDataPacket[]>("SELECT token_hash,token_mask FROM public_score_tokens WHERE taiko_id=? LIMIT 1", [taikoId]);
  const token = rows[0];
  if (action === "issue") {
    if (!token || !result.status.exists || token.token_hash !== createHash("sha256").update(result.token!).digest("hex") ||
        token.token_mask !== result.status.tokenMask) throw new PublicationUnavailableError();
  } else if (token || result.status.exists) throw new PublicationUnavailableError();
}

export async function proveViewerScoreTokenStatus(db: BindingReadDb, taikoId: string,
  result: Awaited<ReturnType<typeof requestScoreTokenManagement>>) {
  const [rows] = await db.execute<RowDataPacket[]>("SELECT token_mask FROM public_score_tokens WHERE taiko_id=? LIMIT 1", [taikoId]);
  if (Boolean(rows[0]) !== result.status.exists || (rows[0] && rows[0].token_mask !== result.status.tokenMask)) throw new PublicationUnavailableError();
  return result;
}

import { createHash, randomUUID } from "node:crypto";
import { createError } from "h3";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { ensureAccountSchema, getAccountDb } from "../../utils/account-db";
import { readViewerCurrentBinding, requireViewerBindingOwner, type BindingRow } from "../../internal/account/binding-read.ts";
import { assertBindingIdentity, captureBindingIdentity } from "../../internal/account/binding-identity.ts";
import { MANUAL_SOURCE_ID, sourceLifecycleFailure } from "../../internal/account/source-lifecycle.ts";
import { runAccountSyncWorker, type SyncWorkerRequest } from "../../infrastructure/account/sync-worker.ts";
import { withDomainScoreRead } from "../taiko-domain/publication.ts";
import { PublicationUnavailableError } from "../../infrastructure/taiko-publication/client.ts";
import { currentScoreScope } from "../taiko-domain/publication.ts";
import type { SyncLogRow } from "../../internal/account/shared";

export async function captureAccountSyncOwner(userId: number) {
  try {
    await ensureAccountSchema("source");
    if (!Number.isSafeInteger(userId) || userId <= 0) throw createError({ statusCode: 403, statusMessage: "账号归属无效" });
    const db = getAccountDb();
    await requireViewerBindingOwner(db, userId);
    const loadedBinding = await readViewerCurrentBinding(db, userId);
    const binding = loadedBinding && Object.freeze({ ...loadedBinding });
    if (!binding) throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID 后再同步" });
    if (binding.source === "manual" || binding.manual_account_id || MANUAL_SOURCE_ID.test(binding.taiko_id)) {
      throw createError({ statusCode: 400, statusMessage: "手动账号不关联外部平台，手录内容已经保存在中心，无需拉取同步" });
    }
    if (!/^[0-9]{1,25}$/.test(binding.taiko_id) || !["wahlap", "hiroba"].includes(binding.source)) throw new PublicationUnavailableError();
    return { db, binding, identity: captureBindingIdentity(binding) };
  } catch (error) { throw sourceLifecycleFailure(error); }
}

export async function dispatchOwnedAccountSync(userId: number, db: Pool, binding: BindingRow, targetIds: string[], suppliedRequestId?: unknown) {
  try {
    const requestId = suppliedRequestId === undefined ? randomUUID().replaceAll("-", "") :
      typeof suppliedRequestId === "string" ? suppliedRequestId.trim().replaceAll("-", "") : "";
    if (!/^[a-f0-9]{32}$/.test(requestId)) throw createError({ statusCode: 400, statusMessage: "同步请求标识无效。" });
    const expected = captureBindingIdentity(binding);
    const requestBody = { version: 1, userId, binding: { id: String(expected.id), taiko_id: expected.taiko_id,
      source: expected.source, manual_account_id: expected.manual_account_id || null }, targetIds };
    const request: SyncWorkerRequest = { requestId, requestHash: createHash("sha256").update(JSON.stringify(requestBody)).digest("hex"),
      userId, binding: requestBody.binding, targetIds };
    // The worker alone holds EX. A parent EX around this private IPC would
    // deadlock its child's acquisition; the final proof uses a fresh SH.
    const result = await runAccountSyncWorker(request, db);
    return await withDomainScoreRead(expected.taiko_id, async () => {
      const live = () => { if (!currentScoreScope(expected.taiko_id)?.lease.alive()) throw new PublicationUnavailableError(); };
      live(); await requireViewerBindingOwner(db, userId);
      assertBindingIdentity(expected, await readViewerCurrentBinding(db, userId));
      const [receipts] = await db.execute<RowDataPacket[]>(`SELECT log_id,log_hash FROM web_data_sync_receipts
        WHERE request_id=? AND request_hash=? AND user_id=? AND taiko_id=? LIMIT 1`, [requestId, request.requestHash, userId, expected.taiko_id]);
      if (!receipts[0] || Number(receipts[0].log_id) !== result.logId || receipts[0].log_hash !== result.logHash) throw new PublicationUnavailableError();
      const [rows] = await db.execute<(SyncLogRow & RowDataPacket)[]>(`SELECT * FROM web_data_sync_logs WHERE id=? AND user_id=? AND taiko_id=? LIMIT 1`, [result.logId, userId, expected.taiko_id]);
      const log = rows[0];
      if (!log || createHash("sha256").update(JSON.stringify({ status: log.status, targetIdsJson: log.target_ids_json,
        resultsJson: log.result_json, originalBytes: Number(log.original_bytes), compressedBytes: Number(log.compressed_bytes) })).digest("hex") !== result.logHash) throw new PublicationUnavailableError();
      await requireViewerBindingOwner(db, userId); assertBindingIdentity(expected, await readViewerCurrentBinding(db, userId)); live();
      return log;
    });
  } catch (error) { throw sourceLifecycleFailure(error); }
}

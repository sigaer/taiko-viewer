import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { createError } from "h3";
import { ensureAccountSchema, getAccountDb } from "../../utils/account-db";
import { assertBindingIdentity, captureBindingIdentity } from "../../internal/account/binding-identity";
import { BINDING_AUTHORITY_COLUMNS, lockViewerBindingAuthority, rollbackViewerBindingTransaction, selectViewerCurrentBinding, type ViewerBindingAuthority } from "../../internal/account/binding-authority";
import { sourceLifecycleFailure } from "../../internal/account/source-lifecycle";
import { PublicationUnavailableError } from "../../infrastructure/taiko-publication/client";
import { currentScoreScope, withDomainScoreWrite } from "../taiko-domain/publication";

type Title = { title: string; titleplateId: number };
type ReadTitle = (taikoId: string) => Promise<Title>;
type Verification = RowDataPacket & {
  id: number; user_id: number; taiko_id: string; original_title: string;
  original_titleplate_id: number; expires_at: Date | string; is_active?: number;
};
type Confirmation = RowDataPacket & {
  operation_id: string; verification_id: number; user_id: number; binding_id: number;
  taiko_id: string; source: string; challenge_hash: string; verified_hash: string;
};
const uuid = /^[a-f0-9]{32}$/, digest = /^[a-f0-9]{64}$/;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const invalidVerification = () => createError({ statusCode: 400, statusMessage: "未找到有效的绑定验证记录，请重新开始验证" });
const changedVerification = () => createError({ statusCode: 409, statusMessage: "绑定验证记录已变化，请重新开始验证" });
const foreignBinding = () => createError({ statusCode: 409, statusMessage: "该鼓众 ID 已被其他账号绑定" });
const acknowledged = () => ({ ok: true });
function identity(userId: number, taikoId: string) {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw createError({ statusCode: 403, statusMessage: "账号归属无效" });
  if (typeof taikoId !== "string" || !/^[0-9]{1,25}$/.test(taikoId)) throw createError({ statusCode: 400, statusMessage: "鼓众 ID 无效" });
}
function titleInfo(value: Title) {
  if (typeof value.title !== "string" || Buffer.byteLength(value.title, "utf8") > 1024 ||
    !Number.isInteger(value.titleplateId) || value.titleplateId < -2147483648 || value.titleplateId > 2147483647) throw new PublicationUnavailableError();
  return Object.freeze({ title: value.title, titleplateId: value.titleplateId });
}
function challengeHash(value: Verification) {
  const expiresAt = new Date(value.expires_at).getTime();
  if (!Number.isSafeInteger(Number(value.id)) || Number(value.id) <= 0 || !Number.isFinite(expiresAt)) throw new PublicationUnavailableError();
  const title = titleInfo({ title: value.original_title, titleplateId: Number(value.original_titleplate_id) });
  return hash([Number(value.id),Number(value.user_id),value.taiko_id,title.title,title.titleplateId,expiresAt]);
}
const verifiedHash = (value: Title) => hash([value.title,value.titleplateId]);
function assertExternalTarget(binding: ViewerBindingAuthority | undefined, userId: number) {
  if (binding && Number(binding.user_id) !== userId) throw foreignBinding();
  if (binding && (binding.manual_account_id || !["wahlap","hiroba"].includes(String(binding.source)))) {
    throw createError({ statusCode: 400, statusMessage: "手动账号请使用认领码绑定" });
  }
}
async function assertExternalSourceAvailable(db: Pick<Pool, "execute">, taikoId: string, locked = false) {
  // The established manual namespace stays reserved even for legacy orphaned
  // files with no remaining SQL account/birth/lifecycle record.
  if (/^98[0-9]{16}$/.test(taikoId)) throw createError({ statusCode: 400, statusMessage: "手动账号请使用认领码绑定" });
  // A bot-only or deleted manual source may have no Viewer binding. Birth and
  // lifecycle reservations still forbid an external verification from taking it.
  for (const table of ["taiko_manual_accounts","taiko_manual_creations","taiko_source_lifecycle"]) {
    const [rows] = await db.execute<RowDataPacket[]>(`SELECT taiko_id FROM ${table} WHERE taiko_id=? LIMIT 1 ${locked ? "FOR UPDATE" : ""}`, [taikoId]);
    if (rows[0]) throw createError({ statusCode: 400, statusMessage: "手动账号请使用认领码绑定" });
  }
}
async function target(db: Pick<Pool, "execute">, taikoId: string, locked = false) {
  const [rows] = await db.execute<ViewerBindingAuthority[]>(`SELECT ${BINDING_AUTHORITY_COLUMNS} FROM web_taiko_bindings WHERE taiko_id=? LIMIT 1 ${locked ? "FOR UPDATE" : ""}`, [taikoId]);
  return rows[0];
}
function validateConfirmation(value: Confirmation, userId: number, taikoId: string) {
  if (!uuid.test(value.operation_id) || !digest.test(value.challenge_hash) || !digest.test(value.verified_hash) ||
    Number(value.user_id) !== userId || value.taiko_id !== taikoId || !["wahlap","hiroba"].includes(value.source) ||
    !Number.isSafeInteger(Number(value.binding_id)) || Number(value.binding_id) <= 0 ||
    !Number.isSafeInteger(Number(value.verification_id)) || Number(value.verification_id) <= 0) throw new PublicationUnavailableError();
  return value;
}
async function confirmation(db: Pick<Pool, "execute">, userId: number, taikoId: string, filter: { operationId?: string; verificationId?: number } = {}) {
  const [rows] = await db.execute<Confirmation[]>(`SELECT operation_id,verification_id,user_id,binding_id,taiko_id,source,challenge_hash,verified_hash
    FROM web_taiko_binding_confirmations WHERE user_id=? AND taiko_id=?
    ${filter.operationId ? "AND operation_id=?" : filter.verificationId ? "AND verification_id=?" : ""}
    ORDER BY created_at DESC,operation_id DESC LIMIT 1`, [userId,taikoId,...(filter.operationId ? [filter.operationId] : filter.verificationId ? [filter.verificationId] : [])]);
  return rows[0] ? validateConfirmation(rows[0],userId,taikoId) : undefined;
}
function assertRecordedBinding(saved: Confirmation | undefined, binding: ViewerBindingAuthority | undefined) {
  if (!saved || !binding || String(binding.id) !== String(saved.binding_id) || Number(binding.user_id) !== Number(saved.user_id) ||
    binding.taiko_id !== saved.taiko_id || binding.source !== saved.source || binding.manual_account_id ||
    verifiedHash({title:binding.verified_title || "",titleplateId:Number(binding.verified_titleplate_id)}) !== saved.verified_hash) throw invalidVerification();
}
function assertGrantScope(taikoId: string) {
  const scope = currentScoreScope(taikoId);
  if (!scope || scope.mode !== "write" || scope.staged.size || scope.rollback.length) throw new PublicationUnavailableError();
}
async function currentVerification(connection: PoolConnection, userId: number) {
  const [rows] = await connection.execute<Verification[]>("SELECT *,expires_at>NOW() AS is_active FROM web_taiko_binding_verifications WHERE user_id=? LIMIT 1 FOR UPDATE", [userId]);
  return rows[0];
}

/** Preparing a public title challenge creates no source grant and consumes no
 * score. It locks SQL metadata only, so a confirmer can later reject a replaced
 * challenge without an inverted SQL -> Source dependency.
 */
export async function prepareViewerBindingVerification(userId: number, taikoId: string, readTitle: ReadTitle, ttlMs: number) {
  identity(userId,taikoId);
  try {
    await ensureAccountSchema("source");
    const db = getAccountDb();
    await assertExternalSourceAvailable(db,taikoId);
    assertExternalTarget(await target(db,taikoId),userId);
    const title = titleInfo(await readTitle(taikoId));
    if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > 3600000) throw new PublicationUnavailableError();
    // DATETIME(0) has whole-second precision; use the same exact input for ack proof.
    const expiresAt = new Date(Math.floor((Date.now()+ttlMs)/1000)*1000);
    const connection = await db.getConnection();
    let prepared: Verification | undefined;
    try {
      try {
        await connection.beginTransaction();
        await lockViewerBindingAuthority(connection,userId);
        await assertExternalSourceAvailable(connection,taikoId);
        assertExternalTarget(await target(connection,taikoId),userId);
        await connection.execute("DELETE FROM web_taiko_binding_verifications WHERE user_id=?",[userId]);
        const [result] = await connection.execute<ResultSetHeader>(`INSERT INTO web_taiko_binding_verifications
          (user_id,taiko_id,original_title,original_titleplate_id,expires_at) VALUES (?,?,?,?,?)`,
          [userId,taikoId,title.title,title.titleplateId,expiresAt]);
        prepared = {id:result.insertId,user_id:userId,taiko_id:taikoId,original_title:title.title,original_titleplate_id:title.titleplateId,expires_at:expiresAt} as Verification;
        await connection.commit();
      } catch (error) { await rollbackViewerBindingTransaction(connection); throw error; }
      finally { connection.release(); }
    } catch (error) {
      if (!prepared) throw error;
      const [rows] = await db.execute<Verification[]>("SELECT * FROM web_taiko_binding_verifications WHERE id=? AND user_id=? AND taiko_id=? LIMIT 1",[prepared.id,userId,taikoId]);
      if (!rows[0] || challengeHash(rows[0]) !== challengeHash(prepared)) throw error;
    }
    return {taikoId,originalTitle:title.title,originalTitleplateId:title.titleplateId,
      message:`已记录当前称号「${title.title || "（空）"}」，请前往鼓众广场修改称号后再回来确认。`};
  } catch (error) { throw sourceLifecycleFailure(error); }
}

async function acknowledgeExisting(db: Pool, userId: number, taikoId: string) {
  return withDomainScoreWrite(taikoId,async () => {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const bindings = await lockViewerBindingAuthority(connection,userId);
      await assertExternalSourceAvailable(connection,taikoId,true);
      const pending = await currentVerification(connection,userId);
      if (pending?.taiko_id === taikoId) throw invalidVerification();
      const saved = await confirmation(connection,userId,taikoId);
      assertRecordedBinding(saved,bindings.find(row => row.taiko_id === taikoId));
      // This is only an acknowledgement: no title update, current reset, grant
      // recreation or consumption of a later unrelated pending challenge.
      await rollbackViewerBindingTransaction(connection);
      return acknowledged();
    } catch (error) { await rollbackViewerBindingTransaction(connection); throw error; }
    finally { connection.release(); }
  });
}

export async function confirmViewerBindingVerification(userId: number, taikoId: string, readTitle: ReadTitle) {
  identity(userId,taikoId);
  try {
    await ensureAccountSchema("source");
    const db = getAccountDb();
    const [initial] = await db.execute<Verification[]>(`SELECT * FROM web_taiko_binding_verifications
      WHERE user_id=? AND taiko_id=? AND expires_at>NOW() ORDER BY id DESC LIMIT 1`,[userId,taikoId]);
    if (!initial[0]) return await acknowledgeExisting(db,userId,taikoId);
    const expectedChallenge = challengeHash(initial[0]), verificationId = Number(initial[0].id);
    const baseline = titleInfo({title:initial[0].original_title,titleplateId:Number(initial[0].original_titleplate_id)});
    await assertExternalSourceAvailable(db,taikoId);
    const initialTarget = await target(db,taikoId);
    assertExternalTarget(initialTarget,userId);
    const expectedBinding = initialTarget ? captureBindingIdentity(initialTarget) : null;
    const observed = titleInfo(await readTitle(taikoId));
    if (observed.title === baseline.title && observed.titleplateId === baseline.titleplateId) {
      throw createError({ statusCode: 400, statusMessage: "称号尚未变化，请修改后再确认" });
    }
    const observedHash = verifiedHash(observed);
    return await withDomainScoreWrite(taikoId,async () => {
      const connection = await db.getConnection(), operationId = randomUUID().replaceAll("-","");
      let prepared: Confirmation | undefined;
      try {
        try {
          await connection.beginTransaction();
          const bindings = await lockViewerBindingAuthority(connection,userId);
          await assertExternalSourceAvailable(connection,taikoId,true);
          const pending = await currentVerification(connection,userId);
          const binding = await target(connection,taikoId,true);
          assertExternalTarget(binding,userId);
          if (!pending) {
            const saved = await confirmation(connection,userId,taikoId,{verificationId});
            if (!saved || saved.challenge_hash !== expectedChallenge || saved.verified_hash !== observedHash) throw changedVerification();
            assertRecordedBinding(saved,binding);
            await rollbackViewerBindingTransaction(connection);
            return acknowledged();
          }
          if (!Number(pending.is_active) || challengeHash(pending) !== expectedChallenge) throw changedVerification();
          if (expectedBinding) assertBindingIdentity(expectedBinding,binding);
          else if (binding) throw changedVerification();
          let bindingId = Number(binding?.id || 0);
          if (binding) {
            await connection.execute("UPDATE web_taiko_bindings SET verified_title=?,verified_titleplate_id=? WHERE id=? AND user_id=?",[observed.title,observed.titleplateId,bindingId,userId]);
          } else {
            if (bindings.length >= 128) throw new PublicationUnavailableError();
            const [result] = await connection.execute<ResultSetHeader>(`INSERT INTO web_taiko_bindings
              (user_id,taiko_id,source,is_current,verified_title,verified_titleplate_id) VALUES (?,?,'wahlap',0,?,?)`,[userId,taikoId,observed.title,observed.titleplateId]);
            bindingId = result.insertId;
          }
          await selectViewerCurrentBinding(connection,userId,bindingId);
          await connection.execute("DELETE FROM web_taiko_binding_verifications WHERE id=? AND user_id=?",[verificationId,userId]);
          prepared = {operation_id:operationId,verification_id:verificationId,user_id:userId,binding_id:bindingId,taiko_id:taikoId,source:binding?.source || "wahlap",challenge_hash:expectedChallenge,verified_hash:observedHash} as Confirmation;
          await connection.execute(`INSERT INTO web_taiko_binding_confirmations
            (operation_id,verification_id,user_id,binding_id,taiko_id,source,challenge_hash,verified_hash) VALUES (?,?,?,?,?,?,?,?)`,
            [operationId,verificationId,userId,bindingId,taikoId,prepared.source,expectedChallenge,observedHash]);
          assertGrantScope(taikoId);
          await connection.commit();
        } catch (error) { await rollbackViewerBindingTransaction(connection); throw error; }
        finally { connection.release(); }
      } catch (error) {
        if (!prepared) throw error;
        const saved = await confirmation(db,userId,taikoId,{operationId});
        if (!saved || Number(saved.verification_id) !== verificationId || Number(saved.binding_id) !== Number(prepared.binding_id) ||
          saved.source !== prepared.source || saved.challenge_hash !== expectedChallenge || saved.verified_hash !== observedHash) throw error;
      }
      return acknowledged();
    });
  } catch (error) { throw sourceLifecycleFailure(error); }
}

import { createError } from "h3";
import { DbRow, ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";
import {
  type BindingRow,
  extractBindTitleInfo,
  fetchBindPlayerProfile,
  getPendingBinding,
  normalizeTaikoId,
  sanitizeBinding,
  setCurrentBindingById,
  toIso,
  type VerifyRow,
  BIND_VERIFY_TTL_MS,
  ensureNonEmpty
} from "../../internal/account/shared";

export const listBindings = async (userId: number) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<BindingRow>[]>(
    "SELECT * FROM web_taiko_bindings WHERE user_id = ? ORDER BY is_current DESC, id ASC",
    [userId]
  );
  return rows.map(sanitizeBinding);
};

export const startBindingVerification = async (userId: number, taikoIdInput: unknown) => {
  await ensureAccountSchema();
  const taikoId = normalizeTaikoId(taikoIdInput);
  ensureNonEmpty(taikoId, "请输入鼓众广场 ID");

  const db = getAccountDb();
  const [boundRows] = await db.execute<DbRow<BindingRow>[]>(
    "SELECT * FROM web_taiko_bindings WHERE taiko_id = ? LIMIT 1",
    [taikoId]
  );
  const bound = boundRows[0];
  if (bound && bound.user_id !== userId) {
    throw createError({ statusCode: 409, statusMessage: "该鼓众 ID 已被其他账号绑定" });
  }

  const profile = await fetchBindPlayerProfile(taikoId);
  const { title, titleplateId } = extractBindTitleInfo(profile);
  await db.execute("DELETE FROM web_taiko_binding_verifications WHERE user_id = ?", [userId]);
  await db.execute(
    `INSERT INTO web_taiko_binding_verifications
      (user_id, taiko_id, original_title, original_titleplate_id, expires_at)
      VALUES (?, ?, ?, ?, ?)`,
    [userId, taikoId, title, titleplateId, new Date(Date.now() + BIND_VERIFY_TTL_MS)]
  );
  return {
    taikoId,
    originalTitle: title,
    originalTitleplateId: titleplateId,
    message: `已记录当前称号「${title || "（空）"}」，请前往鼓众广场修改称号后再回来确认。`
  };
};

export const confirmBindingVerification = async (userId: number, taikoIdInput: unknown) => {
  await ensureAccountSchema();
  const taikoId = normalizeTaikoId(taikoIdInput);
  ensureNonEmpty(taikoId, "请输入鼓众广场 ID");

  const db = getAccountDb();
  const [verifyRows] = await db.execute<DbRow<VerifyRow>[]>(
    `SELECT * FROM web_taiko_binding_verifications
     WHERE user_id = ? AND taiko_id = ? AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [userId, taikoId]
  );
  const verify = verifyRows[0];
  if (!verify) {
    throw createError({ statusCode: 400, statusMessage: "未找到有效的绑定验证记录，请重新开始验证" });
  }

  const profile = await fetchBindPlayerProfile(taikoId);
  const { title, titleplateId } = extractBindTitleInfo(profile);
  if (title === verify.original_title && titleplateId === verify.original_titleplate_id) {
    throw createError({ statusCode: 400, statusMessage: "称号尚未变化，请修改后再确认" });
  }

  const [existingRows] = await db.execute<DbRow<BindingRow>[]>(
    "SELECT * FROM web_taiko_bindings WHERE user_id = ? AND taiko_id = ? LIMIT 1",
    [userId, taikoId]
  );
  await db.execute("UPDATE web_taiko_bindings SET is_current = 0 WHERE user_id = ?", [userId]);
  if (existingRows.length) {
    await db.execute(
      `UPDATE web_taiko_bindings
       SET is_current = 1, verified_title = ?, verified_titleplate_id = ?
       WHERE id = ?`,
      [title, titleplateId, existingRows[0].id]
    );
  } else {
    await db.execute(
      `INSERT INTO web_taiko_bindings
        (user_id, taiko_id, is_current, verified_title, verified_titleplate_id)
       VALUES (?, ?, 1, ?, ?)`,
      [userId, taikoId, title, titleplateId]
    );
  }
  await db.execute("DELETE FROM web_taiko_binding_verifications WHERE user_id = ?", [userId]);
  return { ok: true };
};

export const switchCurrentBinding = async (userId: number, bindingIdInput: unknown) => {
  await ensureAccountSchema();
  const bindingId = Number(bindingIdInput || 0);
  if (!Number.isInteger(bindingId) || bindingId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "绑定记录无效" });
  }

  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<BindingRow>[]>(
    "SELECT * FROM web_taiko_bindings WHERE id = ? AND user_id = ? LIMIT 1",
    [bindingId, userId]
  );
  if (!rows.length) {
    throw createError({ statusCode: 404, statusMessage: "未找到该绑定记录" });
  }
  await setCurrentBindingById(userId, bindingId);
  return { ok: true };
};

export const removeBinding = async (userId: number, bindingIdInput: unknown, forceInput?: unknown) => {
  await ensureAccountSchema();
  const bindingId = Number(bindingIdInput || 0);
  if (!Number.isInteger(bindingId) || bindingId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "绑定记录无效" });
  }

  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<BindingRow>[]>(
    "SELECT * FROM web_taiko_bindings WHERE id = ? AND user_id = ? LIMIT 1",
    [bindingId, userId]
  );
  const binding = rows[0];
  if (!binding) {
    throw createError({ statusCode: 404, statusMessage: "未找到该绑定记录" });
  }

  const [countRows] = await db.execute<Array<{ total: number }>>(
    "SELECT COUNT(*) AS total FROM web_taiko_bindings WHERE user_id = ?",
    [userId]
  );
  const total = Number(countRows[0]?.total || 0);
  const force = Boolean(forceInput);

  if (total <= 1 && !force) {
    throw createError({ statusCode: 409, statusMessage: "这是最后一个绑定 ID，请再次确认后再删除" });
  }

  await db.execute("DELETE FROM web_song_locks WHERE user_id = ? AND taiko_id = ?", [userId, binding.taiko_id]);
  await db.execute("DELETE FROM web_taiko_bindings WHERE id = ? AND user_id = ?", [bindingId, userId]);

  if (binding.is_current && total > 1) {
    const [nextRows] = await db.execute<DbRow<BindingRow>[]>(
      "SELECT * FROM web_taiko_bindings WHERE user_id = ? ORDER BY id ASC LIMIT 1",
      [userId]
    );
    const nextBinding = nextRows[0];
    if (nextBinding) {
      await setCurrentBindingById(userId, nextBinding.id);
    }
  }

  return {
    ok: true,
    removedTaikoId: binding.taiko_id,
    remainingCount: Math.max(0, total - 1)
  };
};

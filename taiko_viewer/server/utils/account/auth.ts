import type { H3Event } from "h3";
import { createError, deleteCookie, setCookie } from "h3";
import type { ResultSetHeader } from "mysql2/promise";
import { DbRow, ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";
import {
  type AccountRow,
  type SessionRow,
  createCode,
  createSessionToken,
  EMAIL_CODE_TTL_MS,
  ensureNonEmpty,
  ensureValidEmail,
  getPasswordHash,
  getSecureCookieFlag,
  normalizeEmail,
  normalizeUsername,
  readSessionTokenFromEvent,
  sanitizePublicUser,
  sendMailCode,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  sha256,
  toIso,
  verifyPasswordHash
} from "../../internal/account/shared";

const consumeEmailCode = async (
  table: "web_email_verifications" | "web_password_resets",
  email: string,
  purpose: string | null,
  code: string
) => {
  const db = getAccountDb();
  const whereClause =
    table === "web_email_verifications"
      ? "email = ? AND purpose = ? AND consumed_at IS NULL AND expires_at > NOW()"
      : "email = ? AND consumed_at IS NULL AND expires_at > NOW()";
  const params = table === "web_email_verifications" ? [email, purpose] : [email];
  const [rows] = await db.execute<DbRow<{ id: number; code_hash: string }>[]>(
    `SELECT id, code_hash FROM ${table} WHERE ${whereClause} ORDER BY id DESC LIMIT 1`,
    params
  );
  if (!rows.length || rows[0].code_hash !== sha256(code)) {
    throw createError({ statusCode: 400, statusMessage: "验证码错误或已失效" });
  }
  await db.execute(`UPDATE ${table} SET consumed_at = NOW() WHERE id = ?`, [rows[0].id]);
};

const createAndSetSession = async (event: H3Event, userId: number) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.execute(
    "INSERT INTO web_user_sessions (session_token, user_id, expires_at) VALUES (?, ?, ?)",
    [token, userId, expiresAt]
  );
  setCookie(event, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: getSecureCookieFlag(event),
    path: "/",
    expires: expiresAt
  });
  return {
    sessionToken: token,
    expiresAt: toIso(expiresAt)
  };
};

export const sendRegisterCode = async (emailInput: unknown) => {
  await ensureAccountSchema();
  const email = normalizeEmail(emailInput);
  ensureNonEmpty(email, "请输入邮箱");
  ensureValidEmail(email);

  const db = getAccountDb();
  const [existingRows] = await db.execute<DbRow<AccountRow>[]>(
    "SELECT * FROM web_user_accounts WHERE email = ? LIMIT 1",
    [email]
  );
  if (existingRows.length) {
    throw createError({ statusCode: 409, statusMessage: "该邮箱已注册" });
  }

  const [recentRows] = await db.execute<DbRow<{ created_at: string }>[]>(
    "SELECT created_at FROM web_email_verifications WHERE email = ? AND purpose = 'register' ORDER BY created_at DESC LIMIT 1",
    [email]
  );
  if (recentRows.length) {
    const lastSent = new Date(recentRows[0].created_at).getTime();
    if (Date.now() - lastSent < 60 * 1000) {
      throw createError({ statusCode: 429, statusMessage: "验证码发送过于频繁，请稍后再试" });
    }
  }

  const code = createCode();
  await db.execute(
    "INSERT INTO web_email_verifications (email, purpose, code_hash, expires_at) VALUES (?, 'register', ?, ?)",
    [email, sha256(code), new Date(Date.now() + EMAIL_CODE_TTL_MS)]
  );
  await sendMailCode(email, code, "register");
  return { ok: true };
};

export const sendPasswordResetCode = async (emailInput: unknown) => {
  await ensureAccountSchema();
  const email = normalizeEmail(emailInput);
  ensureNonEmpty(email, "请输入邮箱");
  ensureValidEmail(email);

  const db = getAccountDb();
  const [existingRows] = await db.execute<DbRow<AccountRow>[]>(
    "SELECT * FROM web_user_accounts WHERE email = ? LIMIT 1",
    [email]
  );
  if (!existingRows.length) {
    throw createError({ statusCode: 404, statusMessage: "该邮箱未注册" });
  }

  const [recentRows] = await db.execute<DbRow<{ created_at: string }>[]>(
    "SELECT created_at FROM web_password_resets WHERE email = ? ORDER BY created_at DESC LIMIT 1",
    [email]
  );
  if (recentRows.length) {
    const lastSent = new Date(recentRows[0].created_at).getTime();
    if (Date.now() - lastSent < 60 * 1000) {
      throw createError({ statusCode: 429, statusMessage: "验证码发送过于频繁，请稍后再试" });
    }
  }

  const code = createCode();
  await db.execute(
    "INSERT INTO web_password_resets (email, code_hash, expires_at) VALUES (?, ?, ?)",
    [email, sha256(code), new Date(Date.now() + EMAIL_CODE_TTL_MS)]
  );
  await sendMailCode(email, code, "reset");
  return { ok: true };
};

export const registerAccount = async (payload: { username: unknown; email: unknown; password: unknown; code: unknown }) => {
  await ensureAccountSchema();
  const username = normalizeUsername(payload.username);
  const email = normalizeEmail(payload.email);
  const password = String(payload.password || "");
  const code = String(payload.code || "").trim();

  ensureNonEmpty(username, "请输入用户名");
  ensureNonEmpty(email, "请输入邮箱");
  ensureValidEmail(email);
  ensureNonEmpty(password, "请输入密码");
  ensureNonEmpty(code, "请输入验证码");
  if (username.length > 64) {
    throw createError({ statusCode: 400, statusMessage: "用户名过长" });
  }
  if (password.length < 6) {
    throw createError({ statusCode: 400, statusMessage: "密码至少需要 6 位" });
  }

  const db = getAccountDb();
  const [userRows] = await db.execute<DbRow<AccountRow>[]>(
    "SELECT * FROM web_user_accounts WHERE username = ? OR email = ?",
    [username, email]
  );
  if (userRows.find((row) => row.username === username)) {
    throw createError({ statusCode: 409, statusMessage: "用户名已存在" });
  }
  if (userRows.find((row) => row.email === email)) {
    throw createError({ statusCode: 409, statusMessage: "邮箱已注册" });
  }

  await consumeEmailCode("web_email_verifications", email, "register", code);
  const passwordHash = await getPasswordHash(password);
  const [result] = await db.execute<ResultSetHeader>(
    "INSERT INTO web_user_accounts (username, email, password_hash, email_verified) VALUES (?, ?, ?, 1)",
    [username, email, passwordHash]
  );
  return { userId: result.insertId };
};

export const loginAccount = async (event: H3Event, payload: { identifier: unknown; password: unknown }) => {
  await ensureAccountSchema();
  const identifier = String(payload.identifier || "").trim();
  const password = String(payload.password || "");
  ensureNonEmpty(identifier, "请输入用户名或邮箱");
  ensureNonEmpty(password, "请输入密码");

  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<AccountRow>[]>(
    "SELECT * FROM web_user_accounts WHERE username = ? OR email = ? LIMIT 1",
    [identifier, normalizeEmail(identifier)]
  );
  const user = rows[0];
  if (!user || !(await verifyPasswordHash(password, user.password_hash))) {
    throw createError({ statusCode: 401, statusMessage: "用户名或密码错误" });
  }

  await db.execute("DELETE FROM web_user_sessions WHERE user_id = ? AND expires_at < NOW()", [user.id]);
  const session = await createAndSetSession(event, user.id);
  return {
    user: sanitizePublicUser(user),
    ...session
  };
};

export const logoutAccount = async (event: H3Event) => {
  await ensureAccountSchema();
  const token = readSessionTokenFromEvent(event);
  if (token) {
    const db = getAccountDb();
    await db.execute("DELETE FROM web_user_sessions WHERE session_token = ?", [token]);
  }
  deleteCookie(event, SESSION_COOKIE_NAME, { path: "/" });
  return { ok: true };
};

export const resetPassword = async (payload: { email: unknown; code: unknown; password: unknown }) => {
  await ensureAccountSchema();
  const email = normalizeEmail(payload.email);
  const code = String(payload.code || "").trim();
  const password = String(payload.password || "");
  ensureNonEmpty(email, "请输入邮箱");
  ensureValidEmail(email);
  ensureNonEmpty(code, "请输入验证码");
  ensureNonEmpty(password, "请输入新密码");
  if (password.length < 6) {
    throw createError({ statusCode: 400, statusMessage: "密码至少需要 6 位" });
  }

  await consumeEmailCode("web_password_resets", email, null, code);
  const passwordHash = await getPasswordHash(password);
  const db = getAccountDb();
  const [result] = await db.execute<ResultSetHeader>(
    "UPDATE web_user_accounts SET password_hash = ?, updated_at = NOW() WHERE email = ?",
    [passwordHash, email]
  );
  if (!result.affectedRows) {
    throw createError({ statusCode: 404, statusMessage: "该邮箱未注册" });
  }
  await db.execute(
    "DELETE FROM web_user_sessions WHERE user_id IN (SELECT id FROM web_user_accounts WHERE email = ?)",
    [email]
  );
  return { ok: true };
};

export const getAccountUserFromEvent = async (event: H3Event) => {
  await ensureAccountSchema();
  const token = readSessionTokenFromEvent(event);
  if (!token) {
    return null;
  }
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<AccountRow & SessionRow>[]>(
    `SELECT a.*, s.session_token, s.user_id, s.expires_at
     FROM web_user_sessions s
     INNER JOIN web_user_accounts a ON a.id = s.user_id
     WHERE s.session_token = ? AND s.expires_at > NOW()
     LIMIT 1`,
    [token]
  );
  const row = rows[0];
  if (!row) {
    deleteCookie(event, SESSION_COOKIE_NAME, { path: "/" });
    return null;
  }
  await db.execute("UPDATE web_user_sessions SET last_seen_at = NOW() WHERE session_token = ?", [token]);
  return row as AccountRow;
};

export const requireAccountUser = async (event: H3Event) => {
  const user = await getAccountUserFromEvent(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "请先登录" });
  }
  return user;
};

export const getCurrentAccountSummary = async (event: H3Event) => {
  const user = await getAccountUserFromEvent(event);
  return user ? sanitizePublicUser(user) : null;
};

import { access, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { constants as fsConstants, readFileSync } from "node:fs";
import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { resolve, join } from "node:path";
import { execFile } from "node:child_process";
import nodemailer from "nodemailer";
import OSS from "ali-oss";
import sharp from "sharp";
import type { H3Event, MultiPartData } from "h3";
import { createError, deleteCookie, getCookie, getHeader, readMultipartFormData, setCookie } from "h3";
import { type ResultSetHeader } from "mysql2/promise";
import { DbRow, ensureAccountSchema, getAccountDb } from "./account-db";

const scryptAsync = promisify(nodeScrypt);
const execFileAsync = promisify(execFile);

const SESSION_COOKIE_NAME = "stv_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const EMAIL_CODE_TTL_MS = 1000 * 60 * 10;
const BIND_VERIFY_TTL_MS = 1000 * 60 * 30;
const AVATAR_MAX_BYTES = 4 * 1024 * 1024;
const DEFAULT_AVATAR = "https://forum.sakura-bot.cn/miku.png";

let songCatalogCache: { mtimeMs: number; list: SongMeta[]; map: Map<number, SongMeta> } | null = null;

type AccountRow = {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  avatar_url: string | null;
  avatar_key: string | null;
  email_verified: number;
  created_at: string;
  updated_at: string;
};

type SessionRow = {
  session_token: string;
  user_id: number;
  expires_at: Date | string;
};

type BindingRow = {
  id: number;
  user_id: number;
  taiko_id: string;
  is_current: number;
  verified_title: string | null;
  verified_titleplate_id: number | null;
  created_at: string;
  updated_at: string;
};

type VerifyRow = {
  id: number;
  user_id: number;
  taiko_id: string;
  original_title: string;
  original_titleplate_id: number;
  expires_at: Date | string;
  created_at: string;
};

type LockRow = {
  song_no: number;
  level: number;
  is_locked: number;
};

type SongMeta = {
  id: number;
  song_name: string;
  song_name_jp?: string;
  category?: string;
  subtitle?: string;
  bpm?: string;
  max_combo?: number | string;
  version?: string;
  artists?: string;
  level_1?: number | string;
  level_2?: number | string;
  level_3?: number | string;
  level_4?: number | string;
  level_5?: number | string;
};

type UserdataSong = {
  song_no: number;
  level: number;
  high_score?: number;
  best_score_rank?: number;
  good_cnt?: number;
  ok_cnt?: number;
  ng_cnt?: number;
  pound_cnt?: number;
  combo_cnt?: number;
  option_flg?: unknown;
  stage_cnt?: number;
  clear_cnt?: number;
  full_combo_cnt?: number;
  dondaful_combo_cnt?: number;
  highscore_datetime?: string;
  highscore_mode?: number;
  update_datetime?: string;
  [key: string]: unknown;
};

type UserdataPayload = {
  profile?: Record<string, unknown>;
  songs?: UserdataSong[];
  achievement?: Record<string, unknown>;
};

type AccountPublicUser = {
  id: number;
  username: string;
  email: string;
  emailVerified: boolean;
  avatarUrl: string;
  createdAt: string;
};

type BindingSummary = {
  id: number;
  taikoId: string;
  isCurrent: boolean;
  verifiedTitle: string | null;
  verifiedTitleplateId: number | null;
  createdAt: string;
  updatedAt: string;
};

type PendingBindingSummary = {
  taikoId: string;
  originalTitle: string;
  originalTitleplateId: number;
  expiresAt: string;
};

type EditableSongFields = {
  high_score?: number;
  best_score_rank?: number;
  good_cnt?: number;
  ok_cnt?: number;
  ng_cnt?: number;
  stage_cnt?: number;
  clear_cnt?: number;
  full_combo_cnt?: number;
  dondaful_combo_cnt?: number;
  combo_cnt?: number;
};

const getRuntimePaths = () => {
  const runtimeConfig = useRuntimeConfig();
  const repoRoot = String(runtimeConfig.repoRoot || process.env.TAIKO_REPO_ROOT || resolve(process.cwd(), ".."));
  const userdataDir = String(runtimeConfig.userdataDir || process.env.TAIKO_USERDATA_DIR || resolve(repoRoot, "userdata"));
  const songDataPath = String(runtimeConfig.songDataPath || process.env.TAIKO_SONG_DATA_PATH || resolve(repoRoot, "songs", "song_data.json"));
  const configPath = String(runtimeConfig.taikoConfigPath || process.env.TAIKO_CONFIG_PATH || resolve(repoRoot, "config.json"));
  const cacheDir = String(runtimeConfig.accountCacheDir || process.env.TAIKO_ACCOUNT_CACHE_DIR || resolve(process.cwd(), ".data", "account-cache"));
  return { repoRoot, userdataDir, songDataPath, configPath, cacheDir };
};

const getIniValue = (content: string, key: string) => {
  const match = content.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, "m"));
  return match?.[1]?.trim() || "";
};

const loadOssutilFallback = () => {
  try {
    const content = readFileSync("/root/.ossutilconfig", "utf-8");
    return {
      endpoint: getIniValue(content, "endpoint"),
      accessKeyId: getIniValue(content, "accessKeyID"),
      accessKeySecret: getIniValue(content, "accessKeySecret")
    };
  } catch {
    return {
      endpoint: "",
      accessKeyId: "",
      accessKeySecret: ""
    };
  }
};

const getAvatarConfig = () => {
  const runtimeConfig = useRuntimeConfig();
  const fallback = loadOssutilFallback();
  return {
    endpoint: String(runtimeConfig.ossEndpoint || process.env.OSS_ENDPOINT || fallback.endpoint || ""),
    region: String(runtimeConfig.ossRegion || process.env.OSS_REGION || ""),
    bucket: String(runtimeConfig.ossBucket || process.env.OSS_BUCKET || "sigaer"),
    accessKeyId: String(runtimeConfig.ossAccessKeyId || process.env.OSS_ACCESS_KEY_ID || fallback.accessKeyId || ""),
    accessKeySecret: String(runtimeConfig.ossAccessKeySecret || process.env.OSS_ACCESS_KEY_SECRET || fallback.accessKeySecret || ""),
    publicBaseUrl: String(runtimeConfig.ossPublicBaseUrl || process.env.OSS_PUBLIC_BASE_URL || "https://static.sakura-bot.cn"),
    avatarPrefix: String(runtimeConfig.ossAvatarPrefix || process.env.OSS_AVATAR_PREFIX || "viewer/account-avatars")
  };
};

const getSmtpConfig = () => {
  const runtimeConfig = useRuntimeConfig();
  return {
    host: String(runtimeConfig.smtpHost || process.env.SMTP_HOST || ""),
    port: Number(runtimeConfig.smtpPort || process.env.SMTP_PORT || 465),
    user: String(runtimeConfig.smtpUser || process.env.SMTP_USER || ""),
    pass: String(runtimeConfig.smtpPass || process.env.SMTP_PASS || ""),
    from: String(runtimeConfig.smtpFrom || process.env.SMTP_FROM || "")
  };
};

const now = () => new Date();

const toIso = (value: Date | string | number | null | undefined) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
};

const formatLocalTimestamp = (date = now()) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const sha256 = (input: string) => createHash("sha256").update(input).digest("hex");

const normalizeUsername = (value: unknown) => String(value || "").trim();
const normalizeEmail = (value: unknown) => String(value || "").trim().toLowerCase();
const normalizeTaikoId = (value: unknown) => String(value || "").trim();

const ensureNonEmpty = (value: string, message: string) => {
  if (!value) {
    throw createError({ statusCode: 400, statusMessage: message });
  }
};

const ensureValidEmail = (email: string) => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: "邮箱格式不正确" });
  }
};

const parsePositiveInt = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
};

const getPasswordHash = async (password: string) => {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
};

const verifyPasswordHash = async (password: string, stored: string) => {
  const [salt, expectedHex] = String(stored || "").split(":");
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = (await scryptAsync(password, salt, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

const createCode = () => String(Math.floor(100000 + Math.random() * 900000));
const createSessionToken = () => randomBytes(32).toString("hex");

const getSecureCookieFlag = (event: H3Event) => {
  const forwardedProto = getHeader(event, "x-forwarded-proto") || "";
  if (forwardedProto === "https") return true;
  return process.env.NODE_ENV === "production";
};

const sanitizePublicUser = (row: AccountRow): AccountPublicUser => ({
  id: row.id,
  username: row.username,
  email: row.email,
  emailVerified: Boolean(row.email_verified),
  avatarUrl: row.avatar_url || DEFAULT_AVATAR,
  createdAt: toIso(row.created_at)
});

const sanitizeBinding = (row: BindingRow): BindingSummary => ({
  id: row.id,
  taikoId: row.taiko_id,
  isCurrent: Boolean(row.is_current),
  verifiedTitle: row.verified_title,
  verifiedTitleplateId: row.verified_titleplate_id,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at)
});

const readSessionTokenFromEvent = (event: H3Event) => {
  const authHeader = String(getHeader(event, "authorization") || "").trim();
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  return getCookie(event, SESSION_COOKIE_NAME) || "";
};

const getMailConfig = () => {
  const config = getSmtpConfig();
  return {
    ...config,
    from: config.from || "Sakura Taiko Viewer <noreply@viewer.sakura-bot.cn>"
  };
};

const getMailer = () => {
  const config = getMailConfig();
  if (config.host && config.user && config.pass) {
    return {
      from: config.from,
      transporter: nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465,
        auth: {
          user: config.user,
          pass: config.pass
        }
      })
    };
  }
  return {
    from: config.from,
    transporter: nodemailer.createTransport({
      sendmail: true,
      newline: "unix",
      path: "/usr/sbin/sendmail"
    })
  };
};

const requireConfiguredOss = () => {
  const config = getAvatarConfig();
  if (!config.endpoint || !config.bucket || !config.accessKeyId || !config.accessKeySecret) {
    throw createError({ statusCode: 500, statusMessage: "OSS 未配置，暂时无法上传头像" });
  }
  return config;
};

const getOssClient = () => {
  const config = requireConfiguredOss();
  return new OSS({
    endpoint: config.endpoint,
    region: config.region || undefined,
    bucket: config.bucket,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    secure: true
  });
};

const sendMailCode = async (email: string, code: string, purpose: "register" | "reset") => {
  const { from, transporter } = getMailer();
  const subject = purpose === "register" ? "Sakura Taiko Viewer 注册验证码" : "Sakura Taiko Viewer 找回密码验证码";
  const label = purpose === "register" ? "注册" : "重置密码";
  await transporter.sendMail({
    from,
    to: email,
    subject,
    text: `你的${label}验证码是 ${code}，10 分钟内有效。`,
    html: `<div style="font-family: sans-serif; line-height: 1.6;"><p>你的 ${label} 验证码是：</p><p style="font-size: 24px; font-weight: 700; letter-spacing: 0.2em;">${code}</p><p>验证码 10 分钟内有效。</p></div>`
  });
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

const consumeEmailCode = async (table: "web_email_verifications" | "web_password_resets", email: string, purpose: string | null, code: string) => {
  const db = getAccountDb();
  const whereClause = table === "web_email_verifications"
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

const loadJsonFile = async <T>(filePath: string): Promise<T> => {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as T;
};

const loadConfigJson = async () => {
  const { configPath } = getRuntimePaths();
  try {
    await access(configPath, fsConstants.R_OK);
    return await loadJsonFile<Record<string, unknown>>(configPath);
  } catch {
    return {};
  }
};

const loadWahlapCookie = async () => {
  const runtimeConfig = useRuntimeConfig();
  const fromRuntime = String(runtimeConfig.wahlapCookie || process.env.TAIKO_WAHLAP_COOKIE || "").trim();
  if (fromRuntime) return fromRuntime;
  const config = await loadConfigJson();
  return String(config.cookie || "").trim();
};

const fetchBindPlayerProfile = async (taikoIdInput: unknown) => {
  const taikoId = normalizeTaikoId(taikoIdInput);
  ensureNonEmpty(taikoId, "请输入鼓众广场 ID");

  const auth = await loadWahlapCookie();
  if (!auth) {
    throw createError({ statusCode: 500, statusMessage: "未配置鼓众 cookie，暂时无法验证绑定" });
  }

  const response = await fetch("https://wl-taiko.wahlap.net/api/user/search/player", {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Content-Type": "application/json",
      Referer: "https://servicewechat.com/wxeafab0667490cd23/21/page-frame.html",
      Authorization: auth
    },
    body: JSON.stringify({ keyword: taikoId, page: 1, pageSize: 10 })
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw createError({
        statusCode: 503,
        statusMessage: "鼓众 cookie 已失效，请更新 /home/sigaer/taiko/config.json 中的 cookie 或设置 TAIKO_WAHLAP_COOKIE 后重试"
      });
    }
    throw createError({ statusCode: 502, statusMessage: `读取鼓众资料失败，HTTP ${response.status}` });
  }

  const data = await response.json();
  if (Number(data?.statusCode || 0) === 401 || String(data?.message || "").trim() === "Unauthorized") {
    throw createError({
      statusCode: 503,
      statusMessage: "鼓众 cookie 已失效，请更新 /home/sigaer/taiko/config.json 中的 cookie 或设置 TAIKO_WAHLAP_COOKIE 后重试"
    });
  }
  const players = Array.isArray(data?.data?.players) ? data.data.players : [];
  const exact = players.find((item: Record<string, unknown>) => String(item.userid || "").trim() === taikoId);
  const player = exact || players[0];
  if (!player) {
    throw createError({ statusCode: 404, statusMessage: "未找到该鼓众ID，请确认输入是否正确" });
  }
  return player as Record<string, unknown>;
};

const extractBindTitleInfo = (profile: Record<string, unknown>) => {
  const costume = (profile.gameCostume || {}) as Record<string, unknown>;
  return {
    title: String(costume.title || "").trim(),
    titleplateId: Number(costume.titleplate_id || -1)
  };
};

export const listBindings = async (userId: number) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<BindingRow>[]>(
    "SELECT * FROM web_taiko_bindings WHERE user_id = ? ORDER BY is_current DESC, id ASC",
    [userId]
  );
  return rows.map(sanitizeBinding);
};

const getPendingBinding = async (userId: number) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<VerifyRow>[]>(
    "SELECT * FROM web_taiko_binding_verifications WHERE user_id = ? AND expires_at > NOW() LIMIT 1",
    [userId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    taikoId: row.taiko_id,
    originalTitle: row.original_title,
    originalTitleplateId: row.original_titleplate_id,
    expiresAt: toIso(row.expires_at)
  } satisfies PendingBindingSummary;
};

const setCurrentBindingById = async (userId: number, bindingId: number) => {
  const db = getAccountDb();
  await db.execute("UPDATE web_taiko_bindings SET is_current = 0 WHERE user_id = ?", [userId]);
  await db.execute("UPDATE web_taiko_bindings SET is_current = 1 WHERE id = ? AND user_id = ?", [bindingId, userId]);
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

const getCurrentBindingRow = async (userId: number) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<BindingRow>[]>(
    "SELECT * FROM web_taiko_bindings WHERE user_id = ? ORDER BY is_current DESC, id ASC LIMIT 1",
    [userId]
  );
  return rows[0] || null;
};

const getSongCatalog = async () => {
  const { songDataPath } = getRuntimePaths();
  const fileStat = await stat(songDataPath);
  if (songCatalogCache && songCatalogCache.mtimeMs === fileStat.mtimeMs) {
    return songCatalogCache;
  }
  const list = await loadJsonFile<SongMeta[]>(songDataPath);
  const map = new Map<number, SongMeta>();
  for (const item of list) {
    map.set(Number(item.id), item);
  }
  songCatalogCache = { mtimeMs: fileStat.mtimeMs, list, map };
  return songCatalogCache;
};

const getUserdataPath = (taikoId: string) => {
  const { userdataDir } = getRuntimePaths();
  return resolve(userdataDir, `${taikoId}data.json`);
};

const getUserdataHistoryDir = (taikoId: string) => {
  const { userdataDir } = getRuntimePaths();
  return resolve(userdataDir, taikoId);
};

const readUserdata = async (taikoId: string) => {
  const filePath = getUserdataPath(taikoId);
  try {
    await access(filePath, fsConstants.R_OK);
  } catch {
    throw createError({ statusCode: 404, statusMessage: "未找到当前绑定 ID 的本地成绩数据" });
  }
  const payload = await loadJsonFile<UserdataPayload>(filePath);
  if (!Array.isArray(payload.songs)) payload.songs = [];
  return payload;
};

const writeUserdataWithHistory = async (taikoId: string, payload: UserdataPayload, source: string) => {
  const filePath = getUserdataPath(taikoId);
  const historyDir = getUserdataHistoryDir(taikoId);
  await mkdir(historyDir, { recursive: true });
  const serialized = JSON.stringify(payload, null, 4);
  const tempPath = `${filePath}.tmp-${Date.now()}`;
  await writeFile(tempPath, serialized, "utf-8");
  await rename(tempPath, filePath);
  const timestamp = formatLocalTimestamp().replace(/[: ]/g, "_");
  const historyPayload = {
    _meta: {
      full: true,
      ts: formatLocalTimestamp(),
      source
    },
    ...payload
  };
  await writeFile(join(historyDir, `data_${timestamp}_${source}.json`), JSON.stringify(historyPayload, null, 4), "utf-8");
};

const getLockMap = async (userId: number, taikoId: string) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<LockRow>[]>(
    "SELECT song_no, level, is_locked FROM web_song_locks WHERE user_id = ? AND taiko_id = ? AND is_locked = 1",
    [userId, taikoId]
  );
  return new Set(rows.map((row) => `${row.song_no}:${row.level}`));
};

const getSongLevelLabel = (level: number) => {
  switch (level) {
    case 1:
      return "简单";
    case 2:
      return "一般";
    case 3:
      return "困难";
    case 4:
      return "魔王";
    case 5:
      return "里谱";
    default:
      return `难度 ${level}`;
  }
};

const toSongRow = (song: UserdataSong, meta: SongMeta | undefined, lockedKeys: Set<string>) => ({
  songNo: Number(song.song_no),
  level: Number(song.level),
  levelLabel: getSongLevelLabel(Number(song.level)),
  title: meta?.song_name || `ID ${song.song_no}`,
  titleJp: meta?.song_name_jp || "",
  subtitle: meta?.subtitle || "",
  category: meta?.category || "",
  bpm: meta?.bpm || "",
  version: meta?.version || "",
  artists: meta?.artists || "",
  maxCombo: meta?.max_combo || "",
  starLevel: meta ? meta[`level_${Number(song.level)}` as keyof SongMeta] || "" : "",
  isLocked: lockedKeys.has(`${song.song_no}:${song.level}`),
  highScore: parsePositiveInt(song.high_score),
  bestScoreRank: parsePositiveInt(song.best_score_rank),
  goodCnt: parsePositiveInt(song.good_cnt),
  okCnt: parsePositiveInt(song.ok_cnt),
  ngCnt: parsePositiveInt(song.ng_cnt),
  stageCnt: parsePositiveInt(song.stage_cnt),
  clearCnt: parsePositiveInt(song.clear_cnt),
  fullComboCnt: parsePositiveInt(song.full_combo_cnt),
  dondafulComboCnt: parsePositiveInt(song.dondaful_combo_cnt),
  comboCnt: parsePositiveInt(song.combo_cnt),
  updateDatetime: String(song.update_datetime || ""),
  highscoreDatetime: String(song.highscore_datetime || "")
});

export const getAccountProfile = async (userId: number) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const [userRows] = await db.execute<DbRow<AccountRow>[]>(
    "SELECT * FROM web_user_accounts WHERE id = ? LIMIT 1",
    [userId]
  );
  const user = userRows[0];
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: "用户不存在" });
  }
  const bindings = await listBindings(userId);
  const currentBinding = bindings.find((item) => item.isCurrent) || bindings[0] || null;
  const pendingBinding = await getPendingBinding(userId);
  return {
    user: sanitizePublicUser(user),
    bindings,
    currentBinding,
    pendingBinding,
    verificationStatus: {
      emailVerified: Boolean(user.email_verified),
      taikoVerified: Boolean(currentBinding)
    }
  };
};

export const uploadAvatarForUser = async (userId: number, file: MultiPartData) => {
  await ensureAccountSchema();
  if (!file?.data?.length) {
    throw createError({ statusCode: 400, statusMessage: "未收到头像文件" });
  }
  if ((file.data as Buffer).byteLength > AVATAR_MAX_BYTES) {
    throw createError({ statusCode: 400, statusMessage: "头像文件过大，请控制在 4MB 以内" });
  }
  const mime = String(file.type || "").toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) {
    throw createError({ statusCode: 400, statusMessage: "仅支持 JPG、PNG、WEBP、GIF 图片" });
  }

  const buffer = await sharp(file.data as Buffer)
    .rotate()
    .resize(320, 320, { fit: "cover" })
    .webp({ quality: 84 })
    .toBuffer();

  const ossConfig = requireConfiguredOss();
  const client = getOssClient();
  const key = `${ossConfig.avatarPrefix.replace(/^\/+|\/+$/g, "")}/${userId}/${Date.now()}.webp`;
  await client.put(key, buffer, {
    headers: {
      "Content-Type": "image/webp"
    }
  });
  const url = `${ossConfig.publicBaseUrl.replace(/\/$/, "")}/${key}`;

  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<AccountRow>[]>(
    "SELECT avatar_key FROM web_user_accounts WHERE id = ? LIMIT 1",
    [userId]
  );
  const oldKey = rows[0]?.avatar_key;
  await db.execute(
    "UPDATE web_user_accounts SET avatar_url = ?, avatar_key = ? WHERE id = ?",
    [url, key, userId]
  );

  if (oldKey && oldKey !== key) {
    try {
      await client.delete(oldKey);
    } catch {
      // Ignore old avatar deletion failure.
    }
  }

  return { avatarUrl: url };
};

export const removeAvatarForUser = async (userId: number) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<AccountRow>[]>(
    "SELECT avatar_key FROM web_user_accounts WHERE id = ? LIMIT 1",
    [userId]
  );
  const avatarKey = rows[0]?.avatar_key;
  if (avatarKey) {
    try {
      await getOssClient().delete(avatarKey);
    } catch {
      // Ignore missing remote avatar.
    }
  }
  await db.execute("UPDATE web_user_accounts SET avatar_url = NULL, avatar_key = NULL WHERE id = ?", [userId]);
  return { avatarUrl: DEFAULT_AVATAR };
};

export const listAccountSongs = async (
  userId: number,
  query: { keyword?: unknown; level?: unknown; page?: unknown; pageSize?: unknown }
) => {
  const binding = await getCurrentBindingRow(userId);
  if (!binding) {
    throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  }

  const userdata = await readUserdata(binding.taiko_id);
  const catalog = await getSongCatalog();
  const lockedKeys = await getLockMap(userId, binding.taiko_id);
  const keyword = String(query.keyword || "").trim().toLowerCase();
  const levelFilter = Number(query.level || 0);
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(100, Math.max(10, Number(query.pageSize || 25)));

  const rows = (userdata.songs || []).map((song) => toSongRow(song, catalog.map.get(Number(song.song_no)), lockedKeys));
  const filtered = rows.filter((row) => {
    if (levelFilter > 0 && row.level !== levelFilter) return false;
    if (!keyword) return true;
    return (
      row.title.toLowerCase().includes(keyword) ||
      row.titleJp.toLowerCase().includes(keyword) ||
      String(row.songNo).includes(keyword)
    );
  });
  filtered.sort((a, b) => {
    const timeA = new Date(a.updateDatetime || 0).getTime();
    const timeB = new Date(b.updateDatetime || 0).getTime();
    if (timeA !== timeB) return timeB - timeA;
    return b.highScore - a.highScore;
  });

  const start = (page - 1) * pageSize;
  return {
    currentBinding: sanitizeBinding(binding),
    total: filtered.length,
    page,
    pageSize,
    items: filtered.slice(start, start + pageSize)
  };
};

export const updateAccountSong = async (
  userId: number,
  payload: { songNo: unknown; level: unknown; values: EditableSongFields }
) => {
  const binding = await getCurrentBindingRow(userId);
  if (!binding) {
    throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  }

  const songNo = Number(payload.songNo || 0);
  const level = Number(payload.level || 0);
  if (!Number.isInteger(songNo) || songNo <= 0 || !Number.isInteger(level) || level <= 0) {
    throw createError({ statusCode: 400, statusMessage: "谱面标识无效" });
  }

  const allowedKeys = [
    "high_score",
    "best_score_rank",
    "good_cnt",
    "ok_cnt",
    "ng_cnt",
    "stage_cnt",
    "clear_cnt",
    "full_combo_cnt",
    "dondaful_combo_cnt",
    "combo_cnt"
  ] as const;

  const sanitized: Partial<UserdataSong> = {};
  for (const key of allowedKeys) {
    const raw = (payload.values as Record<string, unknown>)[key];
    if (raw === undefined || raw === null || raw === "") continue;
    sanitized[key] = parsePositiveInt(raw);
  }

  const userdata = await readUserdata(binding.taiko_id);
  const songs = userdata.songs || [];
  const target = songs.find((item) => Number(item.song_no) === songNo && Number(item.level) === level);
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: "未找到该谱面记录" });
  }

  Object.assign(target, sanitized);
  const stamp = formatLocalTimestamp();
  target.update_datetime = stamp;
  if (sanitized.high_score !== undefined) {
    target.highscore_datetime = stamp;
  }
  await writeUserdataWithHistory(binding.taiko_id, userdata, "web-account");

  const catalog = await getSongCatalog();
  const lockedKeys = await getLockMap(userId, binding.taiko_id);
  return toSongRow(target, catalog.map.get(songNo), lockedKeys);
};

export const setAccountSongLock = async (
  userId: number,
  payload: { songNo: unknown; level: unknown; locked: unknown }
) => {
  await ensureAccountSchema();
  const binding = await getCurrentBindingRow(userId);
  if (!binding) {
    throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  }
  const songNo = Number(payload.songNo || 0);
  const level = Number(payload.level || 0);
  const locked = Boolean(payload.locked);
  if (!Number.isInteger(songNo) || songNo <= 0 || !Number.isInteger(level) || level <= 0) {
    throw createError({ statusCode: 400, statusMessage: "谱面标识无效" });
  }

  const db = getAccountDb();
  if (locked) {
    await db.execute(
      `INSERT INTO web_song_locks (user_id, taiko_id, song_no, level, is_locked)
       VALUES (?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE is_locked = 1, updated_at = CURRENT_TIMESTAMP`,
      [userId, binding.taiko_id, songNo, level]
    );
  } else {
    await db.execute(
      "DELETE FROM web_song_locks WHERE user_id = ? AND taiko_id = ? AND song_no = ? AND level = ?",
      [userId, binding.taiko_id, songNo, level]
    );
  }
  return { locked };
};

const readMultipartAvatar = async (event: H3Event) => {
  const files = await readMultipartFormData(event);
  if (!files?.length) {
    throw createError({ statusCode: 400, statusMessage: "未收到上传文件" });
  }
  const avatar = files.find((item) => item.name === "avatar") || files[0];
  if (!avatar) {
    throw createError({ statusCode: 400, statusMessage: "未收到头像文件" });
  }
  return avatar;
};

export const readAvatarMultipart = readMultipartAvatar;

export const getProfileResponse = async (event: H3Event) => {
  const user = await requireAccountUser(event);
  return getAccountProfile(user.id);
};

export const getMyDonImageBuffer = async (userId: number) => {
  const binding = await getCurrentBindingRow(userId);
  if (!binding) {
    throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  }

  const { repoRoot, cacheDir } = getRuntimePaths();
  const userdataPath = getUserdataPath(binding.taiko_id);
  const fileStat = await stat(userdataPath);
  const targetDir = join(cacheDir, "my-don");
  await mkdir(targetDir, { recursive: true });
  const cacheName = `${binding.taiko_id}-${fileStat.mtimeMs}.png`;
  const cachePath = join(targetDir, cacheName);

  try {
    await access(cachePath, fsConstants.R_OK);
    return await readFile(cachePath);
  } catch {
    // continue
  }

  const pythonCode = [
    "from plugins.utils.draw_dress import render_my_don_image",
    "import sys",
    "sys.stdout.buffer.write(render_my_don_image(int(sys.argv[1])))"
  ].join("; ");
  const result = await execFileAsync("python3", ["-c", pythonCode, binding.taiko_id], {
    cwd: repoRoot,
    encoding: "buffer",
    maxBuffer: 20 * 1024 * 1024
  });
  const buffer = result.stdout as Buffer;
  await writeFile(cachePath, buffer);

  const files = await readdir(targetDir);
  await Promise.all(
    files
      .filter((name) => name.startsWith(`${binding.taiko_id}-`) && name !== cacheName)
      .map((name) => unlink(join(targetDir, name)).catch(() => undefined))
  );
  return buffer;
};

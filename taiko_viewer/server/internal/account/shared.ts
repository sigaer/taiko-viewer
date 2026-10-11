export { formatLocalTimestamp, writeUserdataWithHistory } from "../../infrastructure/taiko-publication/writer.ts";
import { getRuntimePaths } from "../../infrastructure/runtime-paths.ts";
export { getRuntimePaths } from "../../infrastructure/runtime-paths.ts";
import { access, readFile } from "node:fs/promises";
import { constants as fsConstants, readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import { promisify } from "node:util";
import nodemailer from "nodemailer";
import OSS from "ali-oss";
import sharp from "sharp";
import type { H3Event, MultiPartData } from "h3";
import { createError, getCookie, getHeader, readMultipartFormData } from "h3";
import { getRatingEntries, getSongCatalog as loadSongCatalog } from "~/server/services/content";
import { ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";
import type { DbRow } from "~/server/utils/account-db";
import { getDomainScoreReader } from "../../services/taiko-domain/read.ts";
import { withDomainScoreRead, withDomainScoreWrite } from "../../services/taiko-domain/publication.ts";
import type { LegacyScoreRecord as UserdataSong, LegacyScorePayload as UserdataPayload } from "../../domain/score-read-contract.ts";
export type { LegacyScoreRecord as UserdataSong, LegacyScorePayload as UserdataPayload } from "../../domain/score-read-contract.ts";

const scryptAsync = promisify(nodeScrypt);
export const execFileAsync = promisify(execFile);

export const SESSION_COOKIE_NAME = "stv_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
export const EMAIL_CODE_TTL_MS = 1000 * 60 * 10;
export const BIND_VERIFY_TTL_MS = 1000 * 60 * 30;
export const SYNC_COOLDOWN_MS = 1000 * 60 * 30;
export const AVATAR_MAX_BYTES = 4 * 1024 * 1024;
export const DEFAULT_AVATAR = "https://viewer.sakura-bot.cn/miku.png";
export const DEVELOPER_REVIEWER_USERNAME = "sigaer";
export const DEVELOPER_REVIEWER_EMAIL = "1106865024@qq.com";

export const isSiteOperator = (user: Pick<AccountRow, "username" | "email"> | null | undefined) =>
  Boolean(
    user &&
      String(user.username || "").trim() === DEVELOPER_REVIEWER_USERNAME &&
      normalizeEmail(user.email) === DEVELOPER_REVIEWER_EMAIL
  );

export type AccountRow = {
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

export type SessionRow = {
  session_token: string;
  user_id: number;
  expires_at: Date | string;
};

export type BindingRow = {
  id: number;
  user_id: number;
  taiko_id: string;
  source: "wahlap" | "hiroba" | "manual";
  manual_account_id: string | null;
  display_name?: string | null;
  is_current: number;
  verified_title: string | null;
  verified_titleplate_id: number | null;
  mydon_showcase_layout: string;
  created_at: string;
  updated_at: string;
};

export type VerifyRow = {
  id: number;
  user_id: number;
  taiko_id: string;
  original_title: string;
  original_titleplate_id: number;
  expires_at: Date | string;
  created_at: string;
};

export type LockRow = {
  song_no: number;
  level: number;
  is_locked: number;
};

export type SyncLogRow = {
  id: number;
  user_id: number;
  taiko_id: string;
  status: string;
  target_ids_json: string;
  result_json: string;
  original_bytes: number;
  compressed_bytes: number;
  created_at: string;
  updated_at: string;
};

export type DeveloperApplicationRow = {
  id: number;
  user_id: number;
  reply_email: string;
  reason: string;
  image_urls_json: string | null;
  status: string;
  review_note: string | null;
  reviewed_by_user_id: number | null;
  reviewed_at: Date | string | null;
  created_at: string;
  updated_at: string;
};

export type DeveloperTokenRow = {
  id: number;
  user_id: number;
  application_id: number | null;
  token_hash: string;
  token_mask: string;
  status: string;
  issued_by_user_id: number | null;
  issued_at: Date | string;
  last_used_at: Date | string | null;
  revoked_at: Date | string | null;
  created_at: string;
  updated_at: string;
};

export type SongMeta = {
  id: number;
  song_name: string;
  song_name_jp?: string;
  category?: string;
  subtitle?: string;
  bpm?: string;
  max_combo?: Array<number | string> | number | string;
  version?: string[] | string;
  artists?: string[] | string;
  shelf_status?: number | string;
  level_1?: number | string;
  level_2?: number | string;
  level_3?: number | string;
  level_4?: number | string;
  level_5?: number | string;
};

export type AccountPublicUser = {
  id: number;
  username: string;
  email: string;
  emailVerified: boolean;
  avatarUrl: string;
  createdAt: string;
};

export type BindingSummary = {
  id: number;
  taikoId: string;
  source: "wahlap" | "hiroba" | "manual";
  displayName: string;
  isManual: boolean;
  canExternalSync: boolean;
  isCurrent: boolean;
  verifiedTitle: string | null;
  verifiedTitleplateId: number | null;
  currentTitle?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PendingBindingSummary = {
  taikoId: string;
  originalTitle: string;
  originalTitleplateId: number;
  expiresAt: string;
};

export type EditableSongFields = {
  high_score?: number;
  best_score_rank?: number;
  good_cnt?: number;
  ok_cnt?: number;
  ng_cnt?: number;
  pound_cnt?: number;
  stage_cnt?: number;
  clear_cnt?: number;
  full_combo_cnt?: number;
  dondaful_combo_cnt?: number;
  combo_cnt?: number;
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

export const getOssRuntimeConfig = () => {
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

const getAvatarConfig = getOssRuntimeConfig;

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

export const toIso = (value: Date | string | number | null | undefined) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
};

export const sha256 = (input: string | Buffer) => createHash("sha256").update(input).digest("hex");
export const clipText = (value: string, limit: number) => {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 1)}…`;
};

export const normalizeUsername = (value: unknown) => String(value || "").trim();
export const normalizeEmail = (value: unknown) => String(value || "").trim().toLowerCase();
export const normalizeTaikoId = (value: unknown) => String(value || "").trim();

export const ensureNonEmpty = (value: string, message: string) => {
  if (!value) {
    throw createError({ statusCode: 400, statusMessage: message });
  }
};

export const ensureValidEmail = (email: string) => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: "邮箱格式不正确" });
  }
};

export const parsePositiveInt = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
};

export const getPasswordHash = async (password: string) => {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
};

export const verifyPasswordHash = async (password: string, stored: string) => {
  const [salt, expectedHex] = String(stored || "").split(":");
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = (await scryptAsync(password, salt, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

export const createCode = () => String(Math.floor(100000 + Math.random() * 900000));
export const createSessionToken = () => randomBytes(32).toString("hex");

export const getSecureCookieFlag = (event: H3Event) => {
  const forwardedProto = getHeader(event, "x-forwarded-proto") || "";
  if (forwardedProto === "https") return true;
  return process.env.NODE_ENV === "production";
};

export const sanitizePublicUser = (row: AccountRow): AccountPublicUser => ({
  id: row.id,
  username: row.username,
  email: row.email,
  emailVerified: Boolean(row.email_verified),
  avatarUrl: row.avatar_url || DEFAULT_AVATAR,
  createdAt: toIso(row.created_at)
});

export const sanitizeBinding = (row: BindingRow): BindingSummary => ({
  id: row.id,
  taikoId: row.taiko_id,
  source: row.source || "wahlap",
  displayName:
    row.source === "manual"
      ? String(row.display_name || row.verified_title || "手动账号")
      : row.taiko_id,
  isManual: row.source === "manual",
  canExternalSync: row.source !== "manual",
  isCurrent: Boolean(row.is_current),
  verifiedTitle: row.verified_title,
  verifiedTitleplateId: row.verified_titleplate_id,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at)
});

export const readSessionTokenFromEvent = (event: H3Event) => {
  const authHeader = String(getHeader(event, "authorization") || "").trim();
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  return getCookie(event, SESSION_COOKIE_NAME) || "";
};

export const readBearerTokenFromEvent = (event: H3Event) => {
  const authHeader = String(getHeader(event, "authorization") || "").trim();
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  return "";
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

export const sendAccountMail = async (payload: {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}) => {
  const { from, transporter } = getMailer();
  await transporter.sendMail({
    from,
    to: payload.to,
    replyTo: payload.replyTo,
    subject: payload.subject,
    text: payload.text,
    html: payload.html
  });
};

export const requireConfiguredOss = () => {
  const config = getAvatarConfig();
  if (!config.endpoint || !config.bucket || !config.accessKeyId || !config.accessKeySecret) {
    throw createError({ statusCode: 500, statusMessage: "OSS 未配置，暂时无法上传头像" });
  }
  return config;
};

export const getOssClient = () => {
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

export const sendMailCode = async (email: string, code: string, purpose: "register" | "reset" | "qq_bind") => {
  if (purpose === "qq_bind") {
    await sendAccountMail({
      to: email,
      subject: "Sakura Taiko Viewer QQ 绑定验证码",
      text: `你的 QQ 绑定验证码是 ${code}，10 分钟内有效。如非本人操作，请忽略此邮件。`,
      html: `<div style="font-family: sans-serif; line-height: 1.6;"><p>你的 QQ 绑定验证码是：</p><p style="font-size: 24px; font-weight: 700; letter-spacing: 0.2em;">${code}</p><p>验证码 10 分钟内有效。如非本人操作，请忽略此邮件。</p></div>`
    });
    return;
  }
  const subject = purpose === "register" ? "Sakura Taiko Viewer 注册验证码" : "Sakura Taiko Viewer 找回密码验证码";
  const label = purpose === "register" ? "注册" : "重置密码";
  await sendAccountMail({
    to: email,
    subject,
    text: `你的${label}验证码是 ${code}，10 分钟内有效。`,
    html: `<div style="font-family: sans-serif; line-height: 1.6;"><p>你的 ${label} 验证码是：</p><p style="font-size: 24px; font-weight: 700; letter-spacing: 0.2em;">${code}</p><p>验证码 10 分钟内有效。</p></div>`
  });
};

export const loadJsonFile = async <T>(filePath: string): Promise<T> => {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as T;
};

export const loadConfigJson = async () => {
  const { configPath } = getRuntimePaths();
  try {
    await access(configPath, fsConstants.R_OK);
    return await loadJsonFile<Record<string, unknown>>(configPath);
  } catch {
    return {};
  }
};

export const loadWahlapCookie = async () => {
  const runtimeConfig = useRuntimeConfig();
  const fromRuntime = String(runtimeConfig.wahlapCookie || process.env.TAIKO_WAHLAP_COOKIE || "").trim();
  if (fromRuntime) return fromRuntime;
  const config = await loadConfigJson();
  return String(config.cookie || "").trim();
};

export const fetchBindPlayerProfile = async (taikoIdInput: unknown) => {
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

export const extractBindTitleInfo = (profile: Record<string, unknown>) => {
  const costume = (profile.gameCostume || {}) as Record<string, unknown>;
  return {
    title: String(costume.title || "").trim(),
    titleplateId: Number(costume.titleplate_id || -1)
  };
};

export const extractUserdataCurrentTitle = (payload: UserdataPayload) => {
  const profile = (payload.profile || {}) as Record<string, unknown>;
  return extractBindTitleInfo(profile).title;
};

export const enrichBindingWithCurrentTitle = async (binding: BindingSummary) => {
  try {
    const payload = await readUserdata(binding.taikoId);
    const currentTitle = extractUserdataCurrentTitle(payload);
    return {
      ...binding,
      currentTitle: currentTitle || binding.verifiedTitle
    };
  } catch {
    return {
      ...binding,
      currentTitle: binding.verifiedTitle
    };
  }
};

export const getPendingBinding = async (userId: number) => {
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

export const setCurrentBindingById = async (userId: number, bindingId: number) =>
  (await import("../../services/account/binding-lifecycle.ts")).switchViewerBinding(userId, bindingId);

export const getCurrentBindingRow = async (userId: number) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<BindingRow>[]>(
    `SELECT b.*, m.nickname AS display_name
       FROM web_taiko_bindings b
       LEFT JOIN taiko_manual_accounts m
         ON CAST(m.taiko_id AS BINARY) = CAST(b.manual_account_id AS BINARY)
      WHERE b.user_id = ?
      ORDER BY b.is_current DESC, b.id ASC LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
};

export const getSongCatalog = async () => {
  const list = (await loadSongCatalog()) as SongMeta[];
  const map = new Map<number, SongMeta>();
  for (const item of list) {
    map.set(Number(item.id), item);
  }
  return { list, map };
};

export const getChartComboMap = async () => {
  const rows = await getRatingEntries();
  const map = new Map<string, number>();
  for (const item of rows) {
    const songNo = Number(item?.id || 0);
    const level = Number(item?.level || 0);
    const combo = Number(item?.combo || 0);
    if (!Number.isInteger(songNo) || songNo <= 0 || !Number.isInteger(level) || level <= 0) continue;
    if (!Number.isFinite(combo) || combo <= 0) continue;
    map.set(`${songNo}:${level}`, Math.floor(combo));
  }
  return map;
};

export const getUserdataPath = (taikoId: string) => {
  const { userdataDir } = getRuntimePaths();
  return resolve(userdataDir, `${taikoId}data.json`);
};

const domainScoreReader = getDomainScoreReader;
export const userdataFileExists = (taikoId: string) => domainScoreReader().currentExists(taikoId);

export const readUserdata = async (taikoId: string) => withDomainScoreRead(taikoId, async () => {
  if (!await userdataFileExists(taikoId)) {
    throw createError({ statusCode: 404, statusMessage: "未找到当前绑定 ID 的本地成绩数据" });
  }
  const { current: payload } = await domainScoreReader().readCurrent(taikoId);
  if (!Array.isArray(payload.songs)) payload.songs = [];
  return payload;
});

export const readRawUserdataText = async (taikoId: string) => withDomainScoreRead(taikoId, async () => {
  if (!await userdataFileExists(taikoId)) {
    throw createError({ statusCode: 404, statusMessage: "未找到当前绑定 ID 的本地成绩数据" });
  }
  return domainScoreReader().readRawCurrent(taikoId);
});

export const withUserdataWriteLock = <T>(identity: string, task: () => Promise<T>) => withDomainScoreWrite(identity, task);

export const rebuildUserdataAchievement = (payload: UserdataPayload) => {
  const rankCounts = Array.from({ length: 7 }, () => 0);
  const crownCounts = Array.from({ length: 3 }, () => 0);
  for (const song of payload.songs || []) {
    const rank = parsePositiveInt(song.best_score_rank);
    if (rank >= 2 && rank <= 8) rankCounts[rank - 2] += 1;
    const clear = parsePositiveInt(song.clear_cnt) > 0;
    const full = parsePositiveInt(song.full_combo_cnt) > 0;
    const dondaful = parsePositiveInt(song.dondaful_combo_cnt) > 0;
    if (clear || full || dondaful) crownCounts[0] += 1;
    if (full || dondaful) crownCounts[1] += 1;
    if (dondaful) crownCounts[2] += 1;
  }
  payload.achievement = {
    count_level: rankCounts[6] ? 5 : rankCounts[5] ? 4 : rankCounts[4] ? 3 : rankCounts[3] ? 2 : 1,
    ary_crown_count: crownCounts,
    ary_score_rank_count: rankCounts
  };
  return payload;
};

export const getLockMap = async (userId: number, taikoId: string) => {
  await ensureAccountSchema();
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<LockRow>[]>(
    "SELECT song_no, level, is_locked FROM web_song_locks WHERE user_id = ? AND taiko_id = ? AND is_locked = 1",
    [userId, taikoId]
  );
  return new Set(rows.map((row) => `${row.song_no}:${row.level}`));
};

export const getSongLevelLabel = (level: number) => {
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

const stringifySongMetaValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean).join(" / ");
  }
  return String(value || "").trim();
};

const resolveSongTitle = (song: UserdataSong, meta: SongMeta | undefined) => {
  const customTitle = String(song.song_name || "").trim();
  if (meta?.song_name) return meta.song_name;
  if (customTitle) return customTitle;
  return `ID ${song.song_no}`;
};

export const toSongRow = (song: UserdataSong, meta: SongMeta | undefined, lockedKeys: Set<string>) => ({
  songNo: Number(song.song_no),
  level: Number(song.level),
  levelLabel: getSongLevelLabel(Number(song.level)),
  title: resolveSongTitle(song, meta),
  titleJp: meta?.song_name_jp || String(song.song_name_jp || "").trim(),
  subtitle: meta?.subtitle || "",
  category: stringifySongMetaValue(meta?.category),
  bpm: stringifySongMetaValue(meta?.bpm),
  version: stringifySongMetaValue(meta?.version),
  artists: stringifySongMetaValue(meta?.artists),
  maxCombo: Array.isArray(meta?.max_combo) ? meta?.max_combo?.[Number(song.level) - 1] || "" : meta?.max_combo || "",
  starLevel: meta ? meta[`level_${Number(song.level)}` as keyof SongMeta] || "" : "",
  shelfStatus: meta?.shelf_status === undefined || meta?.shelf_status === null || meta?.shelf_status === ""
    ? null
    : Number(meta.shelf_status),
  isCustom: !meta && Boolean(String(song.song_name || "").trim()),
  isLocked: lockedKeys.has(`${song.song_no}:${song.level}`),
  highScore: parsePositiveInt(song.high_score),
  bestScoreRank: parsePositiveInt(song.best_score_rank),
  goodCnt: parsePositiveInt(song.good_cnt),
  okCnt: parsePositiveInt(song.ok_cnt),
  ngCnt: parsePositiveInt(song.ng_cnt),
  poundCnt: parsePositiveInt(song.pound_cnt),
  stageCnt: parsePositiveInt(song.stage_cnt),
  clearCnt: parsePositiveInt(song.clear_cnt),
  fullComboCnt: parsePositiveInt(song.full_combo_cnt),
  dondafulComboCnt: parsePositiveInt(song.dondaful_combo_cnt),
  comboCnt: parsePositiveInt(song.combo_cnt),
  updateDatetime: String(song.update_datetime || ""),
  highscoreDatetime: String(song.highscore_datetime || "")
});

export const readAvatarMultipart = async (event: H3Event): Promise<MultiPartData> => {
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

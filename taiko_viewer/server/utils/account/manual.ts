import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import type { H3Event } from "h3";
import { createError, getHeader } from "h3";
import { ensureAccountSchema, getAccountDb, type DbRow } from "~/server/utils/account-db";
import {
  formatLocalTimestamp,
  getRuntimePaths,
  readUserdata,
  rebuildUserdataAchievement,
  type EditableSongFields,
  type UserdataPayload,
  type UserdataSong,
  withUserdataWriteLock,
  writeUserdataWithHistory
} from "~/server/internal/account/shared";

type ManualAccountRow = {
  taiko_id: string;
  nickname: string;
  bot_identity_key: string | null;
  created_by: "viewer" | "bot";
};

type ManualOwner = { kind: "viewer"; userId: number } | { kind: "bot"; identityKey: string };
type ManualScoreInput = {
  songNo?: unknown;
  level?: unknown;
  title?: unknown;
  titleJp?: unknown;
  values?: EditableSongFields;
};

const CLAIM_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CLAIM_TTL_MS = 10 * 60 * 1000;
const MUTABLE_SCORE_KEYS = [
  "high_score",
  "best_score_rank",
  "good_cnt",
  "ok_cnt",
  "ng_cnt",
  "pound_cnt",
  "combo_cnt",
  "stage_cnt",
  "clear_cnt",
  "full_combo_cnt",
  "dondaful_combo_cnt"
] as const;

const normalizeNickname = (value: unknown) => {
  const nickname = String(value || "").trim();
  if (!nickname) throw createError({ statusCode: 400, statusMessage: "请输入账号昵称" });
  if ([...nickname].length > 24) {
    throw createError({ statusCode: 400, statusMessage: "昵称最多 24 个字符" });
  }
  return nickname;
};

const normalizeIdentityKey = (value: unknown) => {
  const identityKey = String(value || "").trim();
  if (!identityKey || identityKey.length > 191 || !identityKey.includes(":")) {
    throw createError({ statusCode: 400, statusMessage: "身份标识无效" });
  }
  return identityKey;
};

const normalizeClaimCode = (value: unknown) =>
  String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "");

const claimSecret = () => {
  const config = useRuntimeConfig();
  const secret = String(config.manualClaimSecret || "").trim();
  if (!secret) throw createError({ statusCode: 500, statusMessage: "手动账号认领密钥未配置" });
  return secret;
};

const hashClaimCode = (code: string) =>
  createHash("sha256").update(`${claimSecret()}:${code}`).digest("hex");

const generateClaimCode = () =>
  Array.from({ length: 8 }, () => CLAIM_ALPHABET[randomInt(0, CLAIM_ALPHABET.length)]).join("");

const createManualTaikoId = async () => {
  const db = getAccountDb();
  for (let attempt = 0; attempt < 30; attempt += 1) {
    let suffix = "";
    for (let index = 0; index < 16; index += 1) suffix += randomInt(0, 10);
    const taikoId = `98${suffix}`;
    const [rows] = await db.execute<DbRow<{ total: number }>[]>(
      "SELECT COUNT(*) AS total FROM taiko_manual_accounts WHERE taiko_id = ?",
      [taikoId]
    );
    if (!Number(rows[0]?.total || 0)) return taikoId;
  }
  throw createError({ statusCode: 500, statusMessage: "生成手动账号失败，请重试" });
};

const buildBlankUserdata = (taikoId: string, nickname: string): UserdataPayload => ({
  _meta: {
    full: true,
    source: "manual",
    schema_version: 2,
    manual: true,
    ts: formatLocalTimestamp()
  },
  profile: {
    mydon_name: nickname,
    userid: taikoId,
    province: "手动录入",
    is_disp_dan_on: false,
    gameCostume: {
      titleplate_id: 0,
      title: "手动录入",
      mydon_name: nickname,
      costume_1: 0,
      costume_2: 0,
      costume_3: 0,
      costume_4: 0,
      costume_5: 0,
      color_limb: 0,
      color_body: 0,
      color_face: 0,
      got_dan_max: 0,
      is_disp_dan_on: false,
      is_disp_tojiru_on: 0,
      dan_name: { grade: "00", level: 0 }
    }
  },
  songs: [],
  achievement: {
    count_level: 1,
    ary_crown_count: [0, 0, 0],
    ary_score_rank_count: [0, 0, 0, 0, 0, 0, 0]
  }
});

const getManualAccount = async (taikoId: string) => {
  await ensureAccountSchema();
  const [rows] = await getAccountDb().execute<DbRow<ManualAccountRow>[]>(
    "SELECT * FROM taiko_manual_accounts WHERE taiko_id = ? LIMIT 1",
    [taikoId]
  );
  const row = rows[0];
  if (!row) throw createError({ statusCode: 404, statusMessage: "未找到该手动账号" });
  return row;
};

const assertOwner = async (owner: ManualOwner, taikoId: string) => {
  const db = getAccountDb();
  if (owner.kind === "viewer") {
    const [rows] = await db.execute<DbRow<{ total: number }>[]>(
      `SELECT COUNT(*) AS total FROM web_taiko_bindings
        WHERE user_id = ? AND taiko_id = ? AND source = 'manual'`,
      [owner.userId, taikoId]
    );
    if (!Number(rows[0]?.total || 0)) {
      throw createError({ statusCode: 403, statusMessage: "该手动账号不属于当前用户" });
    }
  } else {
    const identityKey = normalizeIdentityKey(owner.identityKey);
    const [rows] = await db.execute<DbRow<{ total: number }>[]>(
      `SELECT COUNT(*) AS total FROM bind
        WHERE qq = ? AND id = ? AND source = 'manual'`,
      [identityKey, taikoId]
    );
    if (!Number(rows[0]?.total || 0)) {
      throw createError({ statusCode: 403, statusMessage: "该手动账号不属于当前身份" });
    }
  }
  return getManualAccount(taikoId);
};

const setViewerCurrent = async (userId: number, taikoId: string) => {
  const db = getAccountDb();
  await db.execute("UPDATE web_taiko_bindings SET is_current = 0 WHERE user_id = ?", [userId]);
  await db.execute(
    "UPDATE web_taiko_bindings SET is_current = 1 WHERE user_id = ? AND taiko_id = ?",
    [userId, taikoId]
  );
};

const compactBotSlots = async (identityKey: string, preferredTaikoId?: string) => {
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<{ row_id: number; id: string; is_current: number }>[]>(
    "SELECT row_id, id, is_current FROM bind WHERE qq = ? ORDER BY slot_index, row_id",
    [identityKey]
  );
  if (!rows.length) return;
  const current =
    rows.find((row) => row.id === preferredTaikoId) ||
    rows.find((row) => Number(row.is_current) === 1) ||
    rows[0];
  await db.execute("UPDATE bind SET is_current = 0 WHERE qq = ?", [identityKey]);
  for (const [index, row] of rows.entries()) {
    await db.execute("UPDATE bind SET slot_index = ?, is_current = ? WHERE row_id = ?", [
      index + 1,
      row.row_id === current.row_id ? 1 : 0,
      row.row_id
    ]);
  }
};

const attachViewer = async (userId: number, taikoId: string) => {
  const db = getAccountDb();
  const [ownerRows] = await db.execute<DbRow<{ user_id: number }>[]>(
    "SELECT user_id FROM web_taiko_bindings WHERE taiko_id = ? LIMIT 1",
    [taikoId]
  );
  if (ownerRows[0] && Number(ownerRows[0].user_id) !== userId) {
    throw createError({ statusCode: 409, statusMessage: "该账号已被其他 viewer 用户持有" });
  }
  await db.execute(
    `INSERT INTO web_taiko_bindings
      (user_id, taiko_id, source, manual_account_id, is_current, verified_title)
     VALUES (?, ?, 'manual', ?, 1, '手动录入')
     ON DUPLICATE KEY UPDATE source = 'manual', manual_account_id = VALUES(manual_account_id)`,
    [userId, taikoId, taikoId]
  );
  await setViewerCurrent(userId, taikoId);
};

const attachBot = async (identityKeyInput: unknown, taikoId: string) => {
  const identityKey = normalizeIdentityKey(identityKeyInput);
  const db = getAccountDb();
  const account = await getManualAccount(taikoId);
  if (account.bot_identity_key && account.bot_identity_key !== identityKey) {
    throw createError({ statusCode: 409, statusMessage: "该账号已被其他 bot 身份持有" });
  }
  const [rows] = await db.execute<DbRow<{ slot_index: number }>[]>(
    "SELECT slot_index FROM bind WHERE qq = ? ORDER BY slot_index",
    [identityKey]
  );
  const nextSlot = rows.length ? Math.max(...rows.map((row) => Number(row.slot_index || 0))) + 1 : 1;
  await db.execute(
    `INSERT INTO bind (qq, id, visible, slot_index, is_current, source)
     VALUES (?, ?, 0, ?, 1, 'manual')
     ON DUPLICATE KEY UPDATE source = 'manual'`,
    [identityKey, taikoId, nextSlot]
  );
  await db.execute("UPDATE taiko_manual_accounts SET bot_identity_key = ? WHERE taiko_id = ?", [
    identityKey,
    taikoId
  ]);
  await compactBotSlots(identityKey, taikoId);
};

export const createManualAccount = async (owner: ManualOwner, nicknameInput: unknown) => {
  await ensureAccountSchema();
  const nickname = normalizeNickname(nicknameInput);
  const taikoId = await createManualTaikoId();
  const db = getAccountDb();
  await db.execute(
    "INSERT INTO taiko_manual_accounts (taiko_id, nickname, created_by) VALUES (?, ?, ?)",
    [taikoId, nickname, owner.kind]
  );
  try {
    await writeUserdataWithHistory(taikoId, buildBlankUserdata(taikoId, nickname), "manual-create");
    if (owner.kind === "viewer") await attachViewer(owner.userId, taikoId);
    else await attachBot(owner.identityKey, taikoId);
  } catch (error) {
    await db.execute("DELETE FROM taiko_manual_accounts WHERE taiko_id = ?", [taikoId]);
    throw error;
  }
  return { ok: true, taikoId, nickname, source: "manual", displayName: nickname, isManual: true };
};

export const renameManualAccount = async (
  owner: ManualOwner,
  taikoId: string,
  nicknameInput: unknown
) => {
  const nickname = normalizeNickname(nicknameInput);
  await assertOwner(owner, taikoId);
  await withUserdataWriteLock(taikoId, async () => {
    const userdata = await readUserdata(taikoId);
    const profile = (userdata.profile ||= {});
    profile.mydon_name = nickname;
    const costume = ((profile.gameCostume ||= {}) as Record<string, unknown>);
    costume.mydon_name = nickname;
    await writeUserdataWithHistory(taikoId, userdata, "manual-rename");
  });
  await getAccountDb().execute("UPDATE taiko_manual_accounts SET nickname = ? WHERE taiko_id = ?", [
    nickname,
    taikoId
  ]);
  return { ok: true, nickname };
};

export const issueManualClaimCode = async (owner: ManualOwner, taikoId: string) => {
  await assertOwner(owner, taikoId);
  const code = generateClaimCode();
  const hash = hashClaimCode(code);
  const db = getAccountDb();
  await db.execute(
    "DELETE FROM taiko_manual_claim_codes WHERE taiko_id = ? AND consumed_at IS NULL",
    [taikoId]
  );
  await db.execute(
    `INSERT INTO taiko_manual_claim_codes (taiko_id, code_hash, issued_by, expires_at)
     VALUES (?, ?, ?, ?)`,
    [taikoId, hash, owner.kind, new Date(Date.now() + CLAIM_TTL_MS)]
  );
  return { ok: true, code, expiresAt: new Date(Date.now() + CLAIM_TTL_MS).toISOString() };
};

export const claimManualAccount = async (owner: ManualOwner, codeInput: unknown) => {
  await ensureAccountSchema();
  const code = normalizeClaimCode(codeInput);
  if (!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/.test(code)) {
    throw createError({ statusCode: 400, statusMessage: "认领码格式无效" });
  }
  const hash = hashClaimCode(code);
  const db = getAccountDb();
  const [rows] = await db.execute<DbRow<{ id: number; taiko_id: string }>[]>(
    `SELECT id, taiko_id FROM taiko_manual_claim_codes
      WHERE code_hash = ? AND consumed_at IS NULL AND expires_at > NOW() LIMIT 1`,
    [hash]
  );
  const claim = rows[0];
  if (!claim) throw createError({ statusCode: 400, statusMessage: "认领码错误、已过期或已使用" });
  const [result] = await db.execute(
    `UPDATE taiko_manual_claim_codes
        SET consumed_at = NOW()
      WHERE id = ? AND consumed_at IS NULL AND expires_at > NOW()`,
    [claim.id]
  );
  if (!Number((result as { affectedRows?: number }).affectedRows || 0)) {
    throw createError({ statusCode: 409, statusMessage: "认领码已被使用" });
  }
  if (owner.kind === "viewer") await attachViewer(owner.userId, claim.taiko_id);
  else await attachBot(owner.identityKey, claim.taiko_id);
  const account = await getManualAccount(claim.taiko_id);
  return { ok: true, taikoId: claim.taiko_id, nickname: account.nickname };
};

const getOwnerTaikoId = async (owner: ManualOwner, requested?: unknown) => {
  const requestedId = String(requested || "").trim();
  const db = getAccountDb();
  if (requestedId) {
    await assertOwner(owner, requestedId);
    return requestedId;
  }
  if (owner.kind === "viewer") {
    const [rows] = await db.execute<DbRow<{ taiko_id: string }>[]>(
      `SELECT taiko_id FROM web_taiko_bindings
        WHERE user_id = ? AND source = 'manual'
        ORDER BY is_current DESC, id LIMIT 1`,
      [owner.userId]
    );
    if (rows[0]) return rows[0].taiko_id;
  } else {
    const identityKey = normalizeIdentityKey(owner.identityKey);
    const [rows] = await db.execute<DbRow<{ id: string }>[]>(
      `SELECT id FROM bind WHERE qq = ? AND source = 'manual'
        ORDER BY is_current DESC, slot_index LIMIT 1`,
      [identityKey]
    );
    if (rows[0]) return rows[0].id;
  }
  throw createError({ statusCode: 400, statusMessage: "当前没有可操作的手动账号" });
};

export const detachManualAccount = async (owner: ManualOwner, requestedTaikoId?: unknown) => {
  const taikoId = await getOwnerTaikoId(owner, requestedTaikoId);
  const account = await assertOwner(owner, taikoId);
  const db = getAccountDb();
  const [viewerRows] = await db.execute<DbRow<{ total: number }>[]>(
    "SELECT COUNT(*) AS total FROM web_taiko_bindings WHERE taiko_id = ? AND source = 'manual'",
    [taikoId]
  );
  const viewerHeld = Number(viewerRows[0]?.total || 0) > 0;
  const botHeld = Boolean(account.bot_identity_key);
  if ((owner.kind === "viewer" && !botHeld) || (owner.kind === "bot" && !viewerHeld)) {
    throw createError({ statusCode: 409, statusMessage: "这是最后一个持有端，请使用永久删除并二次确认" });
  }
  if (owner.kind === "viewer") {
    await db.execute(
      "DELETE FROM web_taiko_bindings WHERE user_id = ? AND taiko_id = ? AND source = 'manual'",
      [owner.userId, taikoId]
    );
    const [rows] = await db.execute<DbRow<{ id: number }>[]>(
      "SELECT id FROM web_taiko_bindings WHERE user_id = ? ORDER BY id LIMIT 1",
      [owner.userId]
    );
    if (rows[0]) {
      await db.execute("UPDATE web_taiko_bindings SET is_current = 0 WHERE user_id = ?", [owner.userId]);
      await db.execute("UPDATE web_taiko_bindings SET is_current = 1 WHERE id = ?", [rows[0].id]);
    }
  } else {
    const identityKey = normalizeIdentityKey(owner.identityKey);
    await db.execute(
      "DELETE FROM bind WHERE qq = ? AND id = ? AND source = 'manual'",
      [identityKey, taikoId]
    );
    await db.execute(
      "UPDATE taiko_manual_accounts SET bot_identity_key = NULL WHERE taiko_id = ?",
      [taikoId]
    );
    await compactBotSlots(identityKey);
  }
  return { ok: true };
};

export const permanentlyDeleteManualAccount = async (
  owner: ManualOwner,
  requestedTaikoId?: unknown,
  confirmed?: unknown
) => {
  if (confirmed !== true) {
    throw createError({ statusCode: 409, statusMessage: "永久删除需要二次确认" });
  }
  const taikoId = await getOwnerTaikoId(owner, requestedTaikoId);
  await assertOwner(owner, taikoId);
  const account = await getManualAccount(taikoId);
  const db = getAccountDb();
  const botIdentity = account.bot_identity_key;
  const { userdataDir } = getRuntimePaths();
  const backupRoot = join(userdataDir, ".manual_deleted");
  const backupDir = join(backupRoot, `${taikoId}-${Date.now()}`);
  await mkdir(backupDir, { recursive: true });
  await rename(join(userdataDir, `${taikoId}data.json`), join(backupDir, `${taikoId}data.json`)).catch(() => undefined);
  await rename(join(userdataDir, taikoId), join(backupDir, taikoId)).catch(() => undefined);
  await db.execute("DELETE FROM web_song_locks WHERE taiko_id = ?", [taikoId]);
  await db.execute("DELETE FROM web_taiko_bindings WHERE taiko_id = ?", [taikoId]);
  await db.execute("DELETE FROM bind WHERE id = ? AND source = 'manual'", [taikoId]);
  await db.execute("DELETE FROM taiko_manual_accounts WHERE taiko_id = ?", [taikoId]);
  if (botIdentity) await compactBotSlots(botIdentity);
  return { ok: true, backup: backupDir };
};

const normalizeScoreIdentity = (songNoInput: unknown, levelInput: unknown) => {
  const songNo = Number(songNoInput || 0);
  const level = Number(levelInput || 0);
  if (!Number.isInteger(songNo) || songNo <= 0 || !Number.isInteger(level) || level < 1 || level > 5) {
    throw createError({ statusCode: 400, statusMessage: "歌曲 ID 或难度无效" });
  }
  return { songNo, level };
};

const normalizeScoreValues = (values: EditableSongFields | undefined) => {
  const output: Partial<UserdataSong> = {};
  for (const key of MUTABLE_SCORE_KEYS) {
    const raw = values?.[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) {
      throw createError({ statusCode: 400, statusMessage: `${key} 必须是非负整数` });
    }
    output[key] = value;
  }
  return output;
};

export const upsertManualScore = async (
  owner: ManualOwner,
  requestedTaikoId: unknown,
  input: ManualScoreInput
) => {
  const taikoId = await getOwnerTaikoId(owner, requestedTaikoId);
  await assertOwner(owner, taikoId);
  const { songNo, level } = normalizeScoreIdentity(input.songNo, input.level);
  const values = normalizeScoreValues(input.values);
  return withUserdataWriteLock(taikoId, async () => {
    const userdata = await readUserdata(taikoId);
    const songs = (userdata.songs ||= []);
    let song = songs.find((row) => Number(row.song_no) === songNo && Number(row.level) === level);
    const created = !song;
    if (!song) {
      const title = String(input.title || "").trim();
      song = {
        song_no: songNo,
        level,
        song_name: title || undefined,
        song_name_jp: String(input.titleJp || "").trim() || undefined,
        option_flg: [1, 0, 0, "00"],
        highscore_mode: 0
      };
      songs.push(song);
    }
    Object.assign(song, values);
    const totalJudgements =
      Number(song.good_cnt || 0) + Number(song.ok_cnt || 0) + Number(song.ng_cnt || 0);
    if (Number(song.combo_cnt || 0) > totalJudgements && totalJudgements > 0) {
      throw createError({ statusCode: 400, statusMessage: "最大连击不能超过良、可、不可的总物量" });
    }
    const stamp = formatLocalTimestamp();
    song.update_datetime = stamp;
    if (values.high_score !== undefined) song.highscore_datetime = stamp;
    rebuildUserdataAchievement(userdata);
    await writeUserdataWithHistory(taikoId, userdata, "manual-score");
    return { ok: true, created, taikoId, item: song, manual: true };
  });
};

export const getManualScore = async (
  owner: ManualOwner,
  requestedTaikoId: unknown,
  songNoInput: unknown,
  levelInput: unknown
) => {
  const taikoId = await getOwnerTaikoId(owner, requestedTaikoId);
  await assertOwner(owner, taikoId);
  const { songNo, level } = normalizeScoreIdentity(songNoInput, levelInput);
  const userdata = await readUserdata(taikoId);
  const item = (userdata.songs || []).find(
    (song) => Number(song.song_no) === songNo && Number(song.level) === level
  );
  if (!item) throw createError({ statusCode: 404, statusMessage: "未找到该谱面成绩" });
  return { ok: true, taikoId, item, manual: true };
};

export const deleteManualScore = async (
  owner: ManualOwner,
  requestedTaikoId: unknown,
  songNoInput: unknown,
  levelInput: unknown,
  confirmed?: unknown
) => {
  if (confirmed !== true) throw createError({ statusCode: 409, statusMessage: "删除成绩需要二次确认" });
  const taikoId = await getOwnerTaikoId(owner, requestedTaikoId);
  await assertOwner(owner, taikoId);
  const { songNo, level } = normalizeScoreIdentity(songNoInput, levelInput);
  return withUserdataWriteLock(taikoId, async () => {
    const userdata = await readUserdata(taikoId);
    const songs = userdata.songs || [];
    const index = songs.findIndex(
      (song) => Number(song.song_no) === songNo && Number(song.level) === level
    );
    if (index < 0) throw createError({ statusCode: 404, statusMessage: "未找到该谱面成绩" });
    songs.splice(index, 1);
    rebuildUserdataAchievement(userdata);
    await writeUserdataWithHistory(taikoId, userdata, "manual-score-delete");
    return { ok: true, taikoId };
  });
};

export const requireBotService = (event: H3Event) => {
  const expected = String(useRuntimeConfig().botServiceToken || "").trim();
  const actual = String(getHeader(event, "x-taiko-bot-token") || "").trim();
  if (!expected || !actual) throw createError({ statusCode: 401, statusMessage: "bot 服务认证失败" });
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw createError({ statusCode: 401, statusMessage: "bot 服务认证失败" });
  }
};

export const resolveManualTaikoIdForOwner = getOwnerTaikoId;

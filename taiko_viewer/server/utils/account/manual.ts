import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import type { H3Event } from "h3";
import { createError, getHeader } from "h3";
import { ensureAccountSchema, getAccountDb, type DbRow } from "~/server/utils/account-db";
import { getManualAccount, assertManualOwner as assertOwner, normalizeManualIdentityKey as normalizeIdentityKey, type ManualOwner } from "../../internal/account/manual-ownership";
import { attachManualViewer, attachManualBot } from "../../internal/account/manual-grants";
import { issueManualGrantCode, consumeManualGrantCode, detachManualGrant } from "../../services/account/manual-grants";
import { permanentlyDeleteManualSource } from "../../services/account/manual-lifecycle";
import { onScoreRollback, withDomainScoreRead } from "../../services/taiko-domain/publication";
import {
  formatLocalTimestamp,
  readUserdata,
  rebuildUserdataAchievement,
  type EditableSongFields,
  type UserdataPayload,
  type UserdataSong,
  withUserdataWriteLock,
  writeUserdataWithHistory
} from "~/server/internal/account/shared";

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

const normalizeClaimCode = (value: unknown) =>
  String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "");

const claimSecret = () => {
  const config = useRuntimeConfig();
  const secret = String(
    config.manualClaimSecret ||
      process.env.TAIKO_MANUAL_CLAIM_SECRET ||
      process.env.TAIKO_BOT_SERVICE_TOKEN ||
      ""
  ).trim();
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
      `SELECT COUNT(*) AS total FROM (
        SELECT taiko_id FROM taiko_manual_accounts WHERE taiko_id = ?
        UNION ALL SELECT taiko_id FROM taiko_source_lifecycle WHERE taiko_id = ?
      ) identities`,
      [taikoId, taikoId]
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

const attachViewer = (userId: number, taikoId: string) => attachManualViewer(getAccountDb(), userId, taikoId);
const attachBot = (identityKey: unknown, taikoId: string) => attachManualBot(getAccountDb(), identityKey, taikoId);

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
    const account = await assertOwner(owner, taikoId);
    const userdata = await readUserdata(taikoId);
    const profile = (userdata.profile ||= {});
    profile.mydon_name = nickname;
    const costume = ((profile.gameCostume ||= {}) as Record<string, unknown>);
    costume.mydon_name = nickname;
    await writeUserdataWithHistory(taikoId, userdata, "manual-rename");
    onScoreRollback(taikoId, async () => {
      await getAccountDb().execute("UPDATE taiko_manual_accounts SET nickname = ? WHERE taiko_id = ?", [account.nickname, taikoId]);
    });
    await getAccountDb().execute("UPDATE taiko_manual_accounts SET nickname = ? WHERE taiko_id = ?", [nickname, taikoId]);
  });
  return { ok: true, nickname };
};

export const setManualAccountVisibility = async (
  owner: ManualOwner,
  taikoId: string,
  visibleInput: unknown
) => {
  await assertOwner(owner, taikoId);
  const visible = Number(visibleInput || 0) ? 1 : 0;
  if (owner.kind !== "bot") {
    throw createError({ statusCode: 400, statusMessage: "viewer 账号公开状态由个人档案隐私设置管理" });
  }
  return withUserdataWriteLock(taikoId, async () => {
    await assertOwner(owner, taikoId);
    await getAccountDb().execute(
      "UPDATE bind SET visible = ? WHERE qq = ? AND id = ? AND source = 'manual'",
      [visible, normalizeIdentityKey(owner.identityKey), taikoId]
    );
    return { ok: true, visible };
  });
};

export const issueManualClaimCode = async (owner: ManualOwner, taikoId: string) =>
  issueManualGrantCode(owner, taikoId, () => {
    const code = generateClaimCode();
    return { code, hash: hashClaimCode(code), expiresAt: new Date(Date.now() + CLAIM_TTL_MS) };
  });

export const claimManualAccount = async (owner: ManualOwner, codeInput: unknown) => {
  const code = normalizeClaimCode(codeInput);
  if (!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/.test(code)) {
    throw createError({ statusCode: 400, statusMessage: "认领码格式无效" });
  }
  return consumeManualGrantCode(owner, hashClaimCode(code));
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
  const requestedId = String(requestedTaikoId || "").trim();
  const taikoId = requestedId || await getOwnerTaikoId(owner);
  return detachManualGrant(owner, taikoId);
};

export const permanentlyDeleteManualAccount = async (
  owner: ManualOwner,
  requestedTaikoId?: unknown,
  confirmed?: unknown
) => {
  if (confirmed !== true) {
    throw createError({ statusCode: 409, statusMessage: "永久删除需要二次确认" });
  }
  const requestedId = String(requestedTaikoId || "").trim();
  const taikoId = requestedId || await getOwnerTaikoId(owner);
  return permanentlyDeleteManualSource(owner, taikoId);
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
    await assertOwner(owner, taikoId);
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
  return withDomainScoreRead(taikoId, async () => {
    await assertOwner(owner, taikoId);
    const userdata = await readUserdata(taikoId);
    const item = (userdata.songs || []).find(
      (song) => Number(song.song_no) === songNo && Number(song.level) === level
    );
    if (!item) throw createError({ statusCode: 404, statusMessage: "未找到该谱面成绩" });
    return { ok: true, taikoId, item, manual: true };
  });
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
    await assertOwner(owner, taikoId);
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
  const expected = String(
    useRuntimeConfig().botServiceToken || process.env.TAIKO_BOT_SERVICE_TOKEN || ""
  ).trim();
  const actual = String(getHeader(event, "x-taiko-bot-token") || "").trim();
  if (!expected || !actual) throw createError({ statusCode: 401, statusMessage: "bot 服务认证失败" });
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw createError({ statusCode: 401, statusMessage: "bot 服务认证失败" });
  }
};

export const resolveManualTaikoIdForOwner = getOwnerTaikoId;

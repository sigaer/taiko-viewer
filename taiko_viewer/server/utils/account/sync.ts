import type { H3Event } from "h3";
import { createError } from "h3";
import {
  getLastSyncLogRow,
  getSyncCooldownState,
  insertSyncLog,
  loadSyncTargets,
  toPublicSyncLog,
  toPublicSyncTargets
} from "~/server/internal/account/sync";
import {
  getCurrentBindingRow,
  loadWahlapCookie,
  readUserdata,
  rebuildUserdataAchievement,
  sanitizeBinding,
  userdataFileExists,
  writeUserdataWithHistory
} from "~/server/internal/account/shared";
import { writeKinokoHistorySnapshots } from "~/server/internal/account/kinoko-history";
import { fetchKinokoHistory, fetchKinokoScores, mergeKinokoScores, assertKinokoCurrentTime } from "~/server/internal/account/kinoko-import";
import { requireAccountUser } from "./auth";
import { captureBindingIdentity, assertBindingIdentity } from "../../internal/account/binding-identity";
import { captureAccountSyncOwner, dispatchOwnedAccountSync } from "../../services/account/sync-authority.ts";
import { withViewerCurrentSource } from "../../services/account/current-source.ts";
import { canManageExternalScoreToken, readViewerScoreTokenStatus } from "../../services/account/score-token-authority.ts";

export const getAccountSyncOverview = async (event: H3Event) => {
  const user = await requireAccountUser(event);
  return withViewerCurrentSource(user.id, "read", async (currentBinding, db) => {
    const [cooldown, lastLogRow, wahlapCookie] = await Promise.all([
      getSyncCooldownState(user.id, db),
      getLastSyncLogRow(user.id, db),
      loadWahlapCookie().catch(() => "")
    ]);
    const targets = await loadSyncTargets();
    const taikoId = currentBinding?.taiko_id || "";
    const hasUserdata = taikoId ? await userdataFileExists(taikoId) : false;
    const canSyncFromWahlap =
      currentBinding?.source !== "manual" && Boolean(String(wahlapCookie || "").trim());
    const scoreTokenResult = canManageExternalScoreToken(currentBinding)
      ? await readViewerScoreTokenStatus(db, taikoId).catch(() => null)
      : null;
    return {
      currentBinding: currentBinding ? sanitizeBinding(currentBinding) : null,
      hasUserdata,
      canSyncFromWahlap,
      scoreTokenAvailable: currentBinding?.source !== "manual" && scoreTokenResult !== null,
      scoreToken: scoreTokenResult,
      targets: toPublicSyncTargets(targets),
      cooldownRemainingSeconds: cooldown.remainingSeconds,
      cooldownUntil: cooldown.availableAt,
      lastSync: toPublicSyncLog(lastLogRow)
    };
  }, { bindingRequired: false });
};

export const submitAccountSync = async (event: H3Event, payload: Record<string, unknown>) => {
  const user = await requireAccountUser(event);
  const userId = user.id;
  const { db, binding: currentBinding } = await captureAccountSyncOwner(userId);
  const wahlapCookie = await loadWahlapCookie().catch(() => "");
  if (!String(wahlapCookie || "").trim()) {
    throw createError({
      statusCode: 503,
      statusMessage: "服务端暂未配置鼓众广场访问凭据，暂时无法拉取成绩，请联系管理员"
    });
  }
  const requestedIds = Array.from(
    new Set(
      (Array.isArray(payload.targetIds) ? payload.targetIds : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
  if (!requestedIds.length) {
    throw createError({ statusCode: 400, statusMessage: "请至少选择一个同步目标" });
  }
  const targets = await loadSyncTargets();
  const targetMap = new Map(targets.map((target) => [target.id, target]));
  const selectedTargets = requestedIds.map((id) => targetMap.get(id)).filter(Boolean);
  if (selectedTargets.length !== requestedIds.length) {
    throw createError({ statusCode: 400, statusMessage: "存在无效的同步目标，请刷新页面后重试" });
  }

  const logRow = await dispatchOwnedAccountSync(userId, db, currentBinding, requestedIds, payload.requestId);
  return {
    ok: true,
    currentBinding: sanitizeBinding(currentBinding),
    log: toPublicSyncLog(logRow)
  };
};

export const importKinokoScores = async (event: H3Event, payload: Record<string, unknown>, now = new Date()) => {
  const user = await requireAccountUser(event);
  const currentBinding = await getCurrentBindingRow(user.id);
  if (!currentBinding) throw createError({ statusCode: 400, statusMessage: "请先绑定导入目标账号" });

  const apiKey = String(payload.apiKey || "").trim();
  if (!/^tk_[A-Za-z0-9_-]{20,200}$/.test(apiKey)) {
    throw createError({ statusCode: 400, statusMessage: "请输入有效的菌菌控制台 API 密钥" });
  }
  const cooldown = await getSyncCooldownState(user.id);
  if (cooldown.remainingSeconds > 0) {
    throw createError({
      statusCode: 429,
      statusMessage: `同步冷却中，请在 ${cooldown.remainingSeconds} 秒后重试`,
      data: cooldown
    });
  }

  const expected = captureBindingIdentity(currentBinding);
  const taikoId = currentBinding.taiko_id;
  const fetched = await fetchKinokoScores(apiKey, now);
  if (fetched.playerId !== taikoId) {
    throw createError({
      statusCode: 409,
      statusMessage: `密钥默认账号（${fetched.playerId}）与当前绑定账号（${taikoId}）不一致，已停止迁移`
    });
  }
  if (!fetched.songs.length) throwNoKinokoRecords(fetched.timeSummary);
  const summary = await withViewerCurrentSource(user.id, "write", async binding => {
    assertBindingIdentity(expected, binding);
    if ((await requireAccountUser(event)).id !== user.id) throw createError({ statusCode: 401, statusMessage: "请重新登录" });
    const userdata = (await userdataFileExists(taikoId))
      ? await readUserdata(taikoId)
      : { profile: { userid: taikoId }, songs: [] };
    const result = mergeKinokoScores(userdata, fetched.songs, now);
    if (!result.added && !result.updated) throwKinokoUnchanged();
    rebuildUserdataAchievement(userdata);
    if (result.added || result.updated) await writeUserdataWithHistory(taikoId, userdata, "kinoko-import");
    if ((await requireAccountUser(event)).id !== user.id) throw createError({ statusCode: 401, statusMessage: "请重新登录" });
    return result;
  });

  const partial = fetched.timeSummary.skippedTimeRecords > 0;
  const message = partial ? `已更新成绩，跳过 ${fetched.timeSummary.skippedTimeRecords} 条异常时间记录` : `已读取 ${summary.total} 条，新增 ${summary.added} 条，更新 ${summary.updated} 条`;
  const result = {
    targetId: "kinoko-import",
    label: "菌菌控制台迁移",
    ok: true,
    statusCode: 200,
    message,
    receivedBytes: fetched.receivedBytes,
    decompressedBytes: fetched.receivedBytes,
    songCount: summary.total
  };
  const logRow = await insertSyncLog({
    userId: user.id,
    taikoId,
    status: "success",
    targetIds: ["kinoko-import"],
    results: [result],
    originalBytes: fetched.receivedBytes,
    compressedBytes: fetched.receivedBytes
  });
  return {
    ok: true,
    published: true,
    partial,
    message,
    timeSummary: fetched.timeSummary,
    sourcePlayerId: fetched.playerId,
    targetTaikoId: taikoId,
    summary,
    log: toPublicSyncLog(logRow)
  };
};

export const importKinokoScoreHistory = async (event: H3Event, payload: Record<string, unknown>, now = new Date()) => {
  const user = await requireAccountUser(event);
  const currentBinding = await getCurrentBindingRow(user.id);
  if (!currentBinding) throw createError({ statusCode: 400, statusMessage: "请先绑定迁移目标账号" });

  const apiKey = String(payload.apiKey || "").trim();
  if (!/^tk_[A-Za-z0-9_-]{20,200}$/.test(apiKey)) {
    throw createError({ statusCode: 400, statusMessage: "请输入有效的菌菌控制台 API 密钥" });
  }
  const cooldown = await getSyncCooldownState(user.id);
  if (cooldown.remainingSeconds > 0) {
    throw createError({
      statusCode: 429,
      statusMessage: `同步冷却中，请在 ${cooldown.remainingSeconds} 秒后重试`,
      data: cooldown
    });
  }

  const expected = captureBindingIdentity(currentBinding);
  const taikoId = currentBinding.taiko_id;
  const fetched = await fetchKinokoHistory(apiKey, now);
  if (fetched.playerId !== taikoId) {
    throw createError({
      statusCode: 409,
      statusMessage: `密钥默认账号（${fetched.playerId}）与当前绑定账号（${taikoId}）不一致，已停止迁移`
    });
  }

  if (!fetched.records.length) throwNoKinokoRecords(fetched.timeSummary);
  const summary = await withViewerCurrentSource(user.id, "write", async binding => {
    assertBindingIdentity(expected, binding);
    if ((await requireAccountUser(event)).id !== user.id) throw createError({ statusCode: 401, statusMessage: "请重新登录" });
    const existed = await userdataFileExists(taikoId);
    const userdata = existed
      ? await readUserdata(taikoId)
      : { _meta: { full: true, source: "wahlap", source_account: taikoId }, profile: { userid: taikoId }, songs: [] };
    assertKinokoCurrentTime(userdata, now);
    const history = await writeKinokoHistorySnapshots(taikoId, fetched.records, userdata, now);
    const current = mergeKinokoScores(userdata, fetched.latestSongs, now);
    if (!history.snapshotFiles && !current.added && !current.updated) throwKinokoUnchanged();
    if (!existed || current.added > 0 || current.updated > 0) {
      rebuildUserdataAchievement(userdata);
      await writeUserdataWithHistory(taikoId, userdata, "kinoko-history-current");
    }
    if ((await requireAccountUser(event)).id !== user.id) throw createError({ statusCode: 401, statusMessage: "请重新登录" });
    return { history, current };
  });

  const partial = fetched.timeSummary.skippedTimeRecords > 0;
  const message = partial ? `已导入有效历史，跳过 ${fetched.timeSummary.skippedTimeRecords} 条异常时间记录` : `历史 ${summary.history.importedRecords} 条新增、${summary.history.skippedRecords} 条已存在，写入 ${summary.history.snapshotFiles} 个兼容快照`;
  const result = {
    targetId: "kinoko-history-import",
    label: "菌菌控制台完整历史迁移",
    ok: true,
    statusCode: 200,
    message,
    receivedBytes: fetched.receivedBytes,
    decompressedBytes: fetched.receivedBytes,
    songCount: summary.history.uniqueRecords
  };
  const logRow = await insertSyncLog({
    userId: user.id,
    taikoId,
    status: "success",
    targetIds: ["kinoko-history-import"],
    results: [result],
    originalBytes: fetched.receivedBytes,
    compressedBytes: fetched.receivedBytes
  });
  return {
    ok: true,
    published: true,
    partial,
    message,
    timeSummary: fetched.timeSummary,
    sourcePlayerId: fetched.playerId,
    targetTaikoId: taikoId,
    summary,
    log: toPublicSyncLog(logRow)
  };
};

const throwNoKinokoRecords = (summary: object): never => {
  throw createError({ statusCode: 422, statusMessage: "没有可导入的有效记录，现有成绩未改动", data: { code: "KINOKO_NO_ELIGIBLE_RECORDS", published: false, summary } });
};
const throwKinokoUnchanged = (): never => {
  throw createError({ statusCode: 409, statusMessage: "记录已存在，没有新增成绩", data: { code: "KINOKO_UNCHANGED", published: false } });
};

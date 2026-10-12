import type { H3Event } from "h3";
import { createError } from "h3";
import {
  getLastSyncLogRow,
  getSyncCooldownState,
  insertSyncLog,
  loadSyncTargets,
  requestSyncDispatch,
  toPublicSyncLog,
  toPublicSyncTargets
} from "~/server/internal/account/sync";
import {
  getCurrentBindingRow,
  getRuntimePaths,
  getUserdataPath,
  loadWahlapCookie,
  readUserdata,
  rebuildUserdataAchievement,
  sanitizeBinding,
  userdataFileExists,
  withUserdataWriteLock,
  writeUserdataWithHistory
} from "~/server/internal/account/shared";
import { scoreTimeIssue } from "~/server/internal/account/kinoko-time";
import { writeKinokoHistorySnapshots } from "~/server/internal/account/kinoko-history";
import { fetchKinokoHistory, fetchKinokoScores, mergeKinokoScores, excludeKinokoConflicts } from "~/server/internal/account/kinoko-import";
import { requestScoreTokenManagement } from "~/server/internal/account/score-token";
import { requireAccountUser } from "./auth";

export const getAccountSyncOverview = async (event: H3Event) => {
  const user = await requireAccountUser(event);
  const [currentBinding, cooldown, lastLogRow, wahlapCookie] = await Promise.all([
    getCurrentBindingRow(user.id),
    getSyncCooldownState(user.id),
    getLastSyncLogRow(user.id),
    loadWahlapCookie().catch(() => "")
  ]);
  const targets = await loadSyncTargets();
  const taikoId = currentBinding?.taiko_id || "";
  const hasUserdata = taikoId ? await userdataFileExists(taikoId) : false;
  const canSyncFromWahlap =
    currentBinding?.source !== "manual" && Boolean(String(wahlapCookie || "").trim());
  const userdataPath = taikoId ? getUserdataPath(taikoId) : "";
  const scoreTokenResult = currentBinding && currentBinding.source !== "manual"
    ? await requestScoreTokenManagement(taikoId, "status").catch((error) => {
        console.error("[account-sync] 读取网页成绩 token 状态失败", error);
        return null;
      })
    : null;
  const { userdataDir } = getRuntimePaths();
  // #region agent log
  fetch("http://localhost:7449/ingest/b08e74f3-d0d4-4722-9f28-4087fe85bf3e", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "b6e9de" },
    body: JSON.stringify({
      sessionId: "b6e9de",
      runId: "post-fix",
      hypothesisId: "H-cn",
      location: "server/utils/account/sync.ts:getAccountSyncOverview",
      message: "sync_overview_wahlap_state",
      data: {
        userId: user.id,
        taikoId,
        hasUserdata,
        canSyncFromWahlap,
        userdataPath,
        userdataDir
      },
      timestamp: Date.now()
    })
  }).catch(() => {});
  // #endregion
  return {
    currentBinding: currentBinding ? sanitizeBinding(currentBinding) : null,
    hasUserdata,
    canSyncFromWahlap,
    scoreTokenAvailable: currentBinding?.source !== "manual" && scoreTokenResult !== null,
    scoreToken: scoreTokenResult?.status || null,
    targets: toPublicSyncTargets(targets),
    cooldownRemainingSeconds: cooldown.remainingSeconds,
    cooldownUntil: cooldown.availableAt,
    lastSync: toPublicSyncLog(lastLogRow)
  };
};

export const submitAccountSync = async (event: H3Event, payload: Record<string, unknown>) => {
  const user = await requireAccountUser(event);
  const currentBinding = await getCurrentBindingRow(user.id);
  if (!currentBinding) {
    throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID 后再同步" });
  }
  if (currentBinding.source === "manual") {
    throw createError({
      statusCode: 400,
      statusMessage: "手动账号不关联外部平台，手录内容已经保存在中心，无需拉取同步"
    });
  }
  const wahlapCookie = await loadWahlapCookie().catch(() => "");
  if (!String(wahlapCookie || "").trim()) {
    throw createError({
      statusCode: 503,
      statusMessage: "服务端暂未配置鼓众广场访问凭据，暂时无法拉取成绩，请联系管理员"
    });
  }
  const cooldown = await getSyncCooldownState(user.id);
  if (cooldown.remainingSeconds > 0) {
    throw createError({
      statusCode: 429,
      statusMessage: `同步冷却中，请在 ${cooldown.remainingSeconds} 秒后重试`,
      data: {
        remainingSeconds: cooldown.remainingSeconds,
        availableAt: cooldown.availableAt
      }
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

  const taikoId = currentBinding.taiko_id;
  const hasUserdata = await userdataFileExists(taikoId);
  // #region agent log
  fetch("http://localhost:7449/ingest/b08e74f3-d0d4-4722-9f28-4087fe85bf3e", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "b6e9de" },
    body: JSON.stringify({
      sessionId: "b6e9de",
      runId: "post-fix",
      hypothesisId: "H-cn",
      location: "server/utils/account/sync.ts:submitAccountSync",
      message: "sync_submit_before_dispatch",
      data: {
        userId: user.id,
        taikoId,
        hasUserdata,
        userdataPath: getUserdataPath(taikoId),
        targetIds: requestedIds
      },
      timestamp: Date.now()
    })
  }).catch(() => {});
  // #endregion

  const dispatchPayload = await requestSyncDispatch(taikoId, requestedIds);
  const results = dispatchPayload.results;
  const status = results.every((item) => item.ok) ? "success" : results.some((item) => item.ok) ? "partial" : "failed";
  const logRow = await insertSyncLog({
    userId: user.id,
    taikoId: currentBinding.taiko_id,
    status,
    targetIds: requestedIds,
    results,
    originalBytes: dispatchPayload.originalBytes,
    compressedBytes: dispatchPayload.compressedBytes
  });
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

  const taikoId = currentBinding.taiko_id;
  const fetched = await fetchKinokoScores(apiKey, now);
  if (fetched.playerId !== taikoId) {
    throw createError({
      statusCode: 409,
      statusMessage: `密钥默认账号（${fetched.playerId}）与当前绑定账号（${taikoId}）不一致，已停止迁移`
    });
  }
  if (!fetched.songs.length) throwNoKinokoRecords(fetched.timeSummary);
  const summary = await withUserdataWriteLock(taikoId, async () => {
    const userdata = (await userdataFileExists(taikoId))
      ? await readUserdata(taikoId)
      : { profile: { userid: taikoId }, songs: [] };
    const admitted = excludeKinokoConflicts(userdata, fetched.songs, now);
    if (!admitted.records.length) throwNoKinokoRecords({ ...fetched.timeSummary, ...conflictSummary(admitted) });
    const polluted = (userdata.songs || []).some(row => scoreTimeIssue(row, now, false));
    const { changedSongs, timeSummary: _time, ...result } = mergeKinokoScores(userdata, admitted.records, now);
    if (result.added || result.updated) {
      rebuildUserdataAchievement(userdata);
      await writeUserdataWithHistory(taikoId, userdata, "kinoko-import", polluted ? changedSongs : undefined);
    }
    return { ...result, ...fetched.timeSummary, ...conflictSummary(admitted),
      duplicateRecords: result.duplicateRecords, writtenRecords: result.writtenRecords };
  });
  const partial = summary.skippedTimeRecords > 0 || summary.conflictRecords > 0;
  const message = kinokoImportMessage(summary);
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
    partial,
    message,
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

  const taikoId = currentBinding.taiko_id;
  const fetched = await fetchKinokoHistory(apiKey, now);
  if (fetched.playerId !== taikoId) {
    throw createError({
      statusCode: 409,
      statusMessage: `密钥默认账号（${fetched.playerId}）与当前绑定账号（${taikoId}）不一致，已停止迁移`
    });
  }

  if (!fetched.records.length) throwNoKinokoRecords(fetched.timeSummary);
  const summary = await withUserdataWriteLock(taikoId, async () => {
    const existed = await userdataFileExists(taikoId);
    const userdata = existed
      ? await readUserdata(taikoId)
      : { _meta: { full: true, source: "wahlap", source_account: taikoId }, profile: { userid: taikoId }, songs: [] };
    const admitted = excludeKinokoConflicts(userdata, fetched.records, now);
    if (!admitted.records.length) throwNoKinokoRecords({ ...fetched.timeSummary, ...conflictSummary(admitted) });
    // Apply the same chart conflict set to history and latest current inputs.
    const latest = excludeKinokoConflicts(userdata, fetched.latestSongs, now).records;
    const polluted = (userdata.songs || []).some(row => scoreTimeIssue(row, now, false));
    const { changedSongs, timeSummary: _time, ...current } = mergeKinokoScores(userdata, latest, now);
    const history = await writeKinokoHistorySnapshots(taikoId, admitted.records, userdata, now);
    if (!existed || current.added > 0 || current.updated > 0) {
      rebuildUserdataAchievement(userdata);
      await writeUserdataWithHistory(taikoId, userdata, "kinoko-history-current", polluted ? changedSongs : undefined);
    }
    return { history, current, ...fetched.timeSummary, ...conflictSummary(admitted),
      duplicateRecords: admitted.records.length - history.importedRecords,
      existingDuplicateRecords: history.skippedRecords, batchDuplicateRecords: admitted.records.length - history.uniqueRecords,
      writtenRecords: history.importedRecords, currentWrittenRecords: current.writtenRecords };
  });
  const partial = summary.skippedTimeRecords > 0 || summary.conflictRecords > 0;
  const message = kinokoImportMessage(summary);
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
    partial,
    message,
    sourcePlayerId: fetched.playerId,
    targetTaikoId: taikoId,
    summary,
    log: toPublicSyncLog(logRow)
  };
};

const conflictSummary = (value: ReturnType<typeof excludeKinokoConflicts>) => ({
  conflictRecords: value.conflictRecords, conflicts: value.conflicts, conflictDetailsTruncated: value.conflictDetailsTruncated
});
const throwNoKinokoRecords = (summary: object): never => {
  throw createError({ statusCode: 422, statusMessage: "No eligible Kinoko records",
    message: "没有可导入的有效记录；异常时间或已有冲突记录已跳过，现有成绩未改动。",
    data: { code: "KINOKO_NO_ELIGIBLE_RECORDS", summary: { duplicateRecords: 0, writtenRecords: 0, currentWrittenRecords: 0, conflictRecords: 0, ...summary } } });
};
const kinokoImportMessage = (s: { sourceRecords: number; validRecords: number; skippedTimeRecords: number; conflictRecords: number; duplicateRecords: number; writtenRecords: number }) =>
  `${s.skippedTimeRecords || s.conflictRecords ? "部分导入" : "导入完成"}：来源 ${s.sourceRecords} 条，有效 ${s.validRecords} 条，跳过异常时间 ${s.skippedTimeRecords} 条，已有冲突 ${s.conflictRecords} 条，重复 ${s.duplicateRecords} 条，写入 ${s.writtenRecords} 条。`;

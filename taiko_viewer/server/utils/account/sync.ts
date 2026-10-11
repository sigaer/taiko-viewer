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
import { writeKinokoHistorySnapshots } from "~/server/internal/account/kinoko-history";
import { fetchKinokoHistory, fetchKinokoScores, mergeKinokoScores } from "~/server/internal/account/kinoko-import";
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

export const importKinokoScores = async (event: H3Event, payload: Record<string, unknown>) => {
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
  const fetched = await fetchKinokoScores(apiKey);
  if (fetched.playerId !== taikoId) {
    throw createError({
      statusCode: 409,
      statusMessage: `密钥默认账号（${fetched.playerId}）与当前绑定账号（${taikoId}）不一致，已停止迁移`
    });
  }
  const summary = await withUserdataWriteLock(taikoId, async () => {
    const binding = await getCurrentBindingRow(user.id);
    if (!binding || binding.id !== currentBinding.id || binding.taiko_id !== currentBinding.taiko_id || binding.source !== currentBinding.source) throw createError({ statusCode: 409, statusMessage: "绑定已变更，请重新加载" });
    const userdata = (await userdataFileExists(taikoId))
      ? await readUserdata(taikoId)
      : { profile: { userid: taikoId }, songs: [] };
    const result = mergeKinokoScores(userdata, fetched.songs);
    rebuildUserdataAchievement(userdata);
    if (result.added || result.updated) await writeUserdataWithHistory(taikoId, userdata, "kinoko-import");
    return result;
  });

  const message = `已读取 ${summary.total} 条，新增 ${summary.added} 条，更新 ${summary.updated} 条`;
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
    sourcePlayerId: fetched.playerId,
    targetTaikoId: taikoId,
    summary,
    log: toPublicSyncLog(logRow)
  };
};

export const importKinokoScoreHistory = async (event: H3Event, payload: Record<string, unknown>) => {
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
  const fetched = await fetchKinokoHistory(apiKey);
  if (fetched.playerId !== taikoId) {
    throw createError({
      statusCode: 409,
      statusMessage: `密钥默认账号（${fetched.playerId}）与当前绑定账号（${taikoId}）不一致，已停止迁移`
    });
  }

  const summary = await withUserdataWriteLock(taikoId, async () => {
    const binding = await getCurrentBindingRow(user.id);
    if (!binding || binding.id !== currentBinding.id || binding.taiko_id !== currentBinding.taiko_id || binding.source !== currentBinding.source) throw createError({ statusCode: 409, statusMessage: "绑定已变更，请重新加载" });
    const existed = await userdataFileExists(taikoId);
    const userdata = existed
      ? await readUserdata(taikoId)
      : { _meta: { full: true, source: "wahlap", source_account: taikoId }, profile: { userid: taikoId }, songs: [] };
    const history = await writeKinokoHistorySnapshots(taikoId, fetched.records, userdata);
    const current = mergeKinokoScores(userdata, fetched.latestSongs);
    if (!existed || current.added > 0 || current.updated > 0) {
      rebuildUserdataAchievement(userdata);
      await writeUserdataWithHistory(taikoId, userdata, "kinoko-history-current");
    }
    return { history, current };
  });

  const message = `历史 ${summary.history.importedRecords} 条新增、${summary.history.skippedRecords} 条已存在，写入 ${summary.history.snapshotFiles} 个兼容快照`;
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
    sourcePlayerId: fetched.playerId,
    targetTaikoId: taikoId,
    summary,
    log: toPublicSyncLog(logRow)
  };
};

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
import { getCurrentBindingRow, sanitizeBinding } from "~/server/internal/account/shared";
import { requireAccountUser } from "./auth";

export const getAccountSyncOverview = async (event: H3Event) => {
  const user = await requireAccountUser(event);
  const [currentBinding, cooldown, lastLogRow] = await Promise.all([
    getCurrentBindingRow(user.id),
    getSyncCooldownState(user.id),
    getLastSyncLogRow(user.id)
  ]);
  const targets = await loadSyncTargets();
  return {
    currentBinding: currentBinding ? sanitizeBinding(currentBinding) : null,
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

  const dispatchPayload = await requestSyncDispatch(currentBinding.taiko_id, requestedIds);
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

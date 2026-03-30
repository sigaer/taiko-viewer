import type { H3Event } from "h3";
import { createError } from "h3";
import {
  dispatchSyncPayloadToTarget,
  getLastSyncLogRow,
  getSyncCooldownState,
  insertSyncLog,
  loadSyncTargets,
  readSyncUserdataPayload,
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
  const targets = loadSyncTargets(event);
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
  const targets = loadSyncTargets(event);
  const targetMap = new Map(targets.map((target) => [target.id, target]));
  const selectedTargets = requestedIds.map((id) => targetMap.get(id)).filter(Boolean);
  if (selectedTargets.length !== requestedIds.length) {
    throw createError({ statusCode: 400, statusMessage: "存在无效的同步目标，请刷新页面后重试" });
  }

  const userdata = await readSyncUserdataPayload(currentBinding.taiko_id);
  const results = await Promise.all(
    selectedTargets.map(async (target) => {
      try {
        return await dispatchSyncPayloadToTarget(target!, currentBinding.taiko_id, userdata.compressedBuffer);
      } catch (error: any) {
        return {
          targetId: target!.id,
          label: target!.label,
          ok: false,
          statusCode: Number(error?.statusCode || 500) || 500,
          message: String(error?.message || "同步请求发送失败"),
          receivedBytes: userdata.compressedBuffer.byteLength,
          decompressedBytes: 0,
          songCount: null
        };
      }
    })
  );
  const status = results.every((item) => item.ok) ? "success" : results.some((item) => item.ok) ? "partial" : "failed";
  const logRow = await insertSyncLog({
    userId: user.id,
    taikoId: currentBinding.taiko_id,
    status,
    targetIds: requestedIds,
    results,
    originalBytes: userdata.rawBuffer.byteLength,
    compressedBytes: userdata.compressedBuffer.byteLength
  });
  return {
    ok: true,
    currentBinding: sanitizeBinding(currentBinding),
    log: toPublicSyncLog(logRow)
  };
};

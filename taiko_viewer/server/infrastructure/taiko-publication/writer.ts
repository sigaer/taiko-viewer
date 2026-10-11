// Existing compatibility serializer; canonical storage remains the single
// center publication implementation. No SQL/product/content dependencies.
import { randomBytes } from "node:crypto";
import { createError } from "h3";
import type { LegacyScorePayload as UserdataPayload } from "../../domain/score-read-contract.ts";
import { withDomainScoreWrite, stageScoreText, currentScoreScope } from "../../services/taiko-domain/publication.ts";

export const formatLocalTimestamp = (date = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

function prepareUserdataHistory(payload: UserdataPayload, source: string, sourceSequence: number,
  observedAt = new Date(), observationId = randomBytes(16).toString("hex")) {
  if (!/^[a-z0-9-]{1,64}$/.test(source)) throw createError({ statusCode: 400, statusMessage: "成绩来源无效" });
  if (!Number.isSafeInteger(sourceSequence) || sourceSequence < 1 || !/^[a-f0-9]{32}$/.test(observationId) ||
    !Number.isFinite(observedAt.getTime())) throw createError({ statusCode: 400, statusMessage: "成绩观察标识无效" });
  const stamp = formatLocalTimestamp(observedAt);
  const timestamp = stamp.replace(/[-: ]/g, "").replace(/^(\d{8})(\d{6})$/, "$1_$2");
  const micros = String(observedAt.getMilliseconds() * 1000).padStart(6, "0");
  const sequence = String(sourceSequence).padStart(20, "0");
  const payloadMeta = payload._meta && typeof payload._meta === "object" ? payload._meta : {};
  const historyPayload = {
    ...payload,
    _meta: {
      ...payloadMeta,
      full: true,
      ts: stamp,
      source,
      writer_source: source
    }
  };
  return { historyKey: `history/data_${timestamp}_${micros}_${sequence}_${observationId}_${source}.json`, history: JSON.stringify(historyPayload, null, 4) };
}

export function prepareUserdataPublication(payload: UserdataPayload, source: string, sourceSequence: number,
  observedAt = new Date(), observationId = randomBytes(16).toString("hex")) {
  return { current: JSON.stringify(payload, null, 4), ...prepareUserdataHistory(payload, source, sourceSequence, observedAt, observationId) };
}

export const writeUserdataWithHistory = async (taikoId: string, payload: UserdataPayload, source: string) => withDomainScoreWrite(taikoId, async () => {
  if (!/^[a-z0-9-]{1,64}$/.test(source)) throw createError({ statusCode: 400, statusMessage: "成绩来源无效" });
  const current = JSON.stringify(payload, null, 4);
  await stageScoreText(taikoId, "current", current);
  // Keep the existing clock point and allocation lifetime: serialize H only
  // after the current pipe request has finished, rather than retaining it there.
  const prepared = prepareUserdataHistory(payload, source, (currentScoreScope(taikoId)!.lease.view?.sequence || 0) + 1);
  await stageScoreText(taikoId, prepared.historyKey, prepared.history);
});

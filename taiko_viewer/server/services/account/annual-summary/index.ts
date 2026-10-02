import { getAccountDb, type DbRow } from "~/server/utils/account-db";
import { botAnnualPaths, readBotAnnualSummary } from "./bot-store";
import { readAnnualPolicy } from './policy';
import { annualImportState, annualImportNeedsRefresh } from './import-refresh';
import { annualManualEditTime, annualCorrectionsAreCurrent } from './manual-corrections';
import { assertAnnualTaskAllowed } from './policy';
import { annualAdmission, MAX_CONCURRENT_ANNUAL_BUILDS } from './admission';
import { trackBetaUser } from "~/server/services/annual-beta/events";
import { annualBuildInputRevision, canReuseAnnualFailure, canReuseAnnualSummary } from "./build-recovery";
import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { access, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { readdir } from "node:fs/promises";
import { createError } from "h3";
import type { H3Event } from "h3";
import {
  enrichBindingWithCurrentTitle,
  getCurrentBindingRow,
  sanitizeBinding,
  readUserdata,
  getRuntimePaths,
  type BindingRow
} from "~/server/internal/account/shared";
import { getMyDonImageBuffer } from "~/server/utils/account/my-don";
import {
  ANNUAL_ALGORITHM_VERSION,
  ANNUAL_MAX_EVENT_PAGE_SIZE,
  ANNUAL_POSTER_COOLDOWN_MS,
  ANNUAL_POSTER_HEIGHT,
  ANNUAL_POSTER_WIDTH,
  ANNUAL_PRODUCER_REVISION,
  ANNUAL_SCHEMA_VERSION,
  ANNUAL_SHARE_CARD_HEIGHT,
  ANNUAL_SHARE_CARD_PROMO_URL,
  ANNUAL_SHARE_CARD_RENDERER_REVISION,
  ANNUAL_SHARE_CARD_WIDTH,
  ANNUAL_SHARE_TTL_MS,
  ANNUAL_VERSION_KEY,
  getAnnualVersion,
  resolveAnnualVersion
} from "./constants";
import { createAnnualQrCodeDataUrl, createAnnualShareCardPromoQrCodeDataUrl, renderAnnualPoster, renderAnnualShareCard } from "./poster";
import { enrichAnnualSummary } from "./presentation";
import { enrichAnnualRatingDistributionAtRead, enrichAnnualRatingRank } from "./ratings";
import {
  countRecentAnnualJobs,
  admitAnnualBuildJob,
  AnnualQueueCapacityError,
  claimNextAnnualBuild,
  completeLeasedAnnualBuild,
  deleteAnnualSummaryForGc,
  deleteAnnualSummaryForAdmin,
  listAnnualSummariesForAdmin,
  listAnnualBindingsForAdmin,
  deleteOldAnnualJobs,
  deleteAnnualPostersForShare,
  expireAnnualShare,
  expireAnnualShares,
  expireQueuedAnnualJobs,
  failLeasedAnnualBuild,
  findActiveAnnualJob,
  findLatestFailedAnnualBuild,
  findActiveAnnualShare,
  findAnnualBinding,
  findAnnualJobById,
  findAnnualPosterById,
  findAnnualPosterForShare,
  findAnnualShareById,
  findAnnualShareCard,
  findAnnualSummaryById,
  findOwnerAnnualShareCard,
  findLatestAnnualSummary,
  findOwnerAnnualJob,
  findOwnerAnnualShare,
  findOwnerAnnualSummary,
  insertAnnualJob,
  insertAnnualShare,
  insertAnnualShareCard,
  insertAnnualSummary,
  listActiveAnnualShares,
  listAnnualSharesNeedingPosterCleanup,
  listAnnualSummaryGcCandidates,
  listAnnualPosterPathsForShare,
  markAnnualJobCompleted,
  markAnnualJobFailed,
  markAnnualJobRunning,
  markAnnualShareCardForumSync,
  heartbeatAnnualBuild,
  pruneSupersededAnnualSummaries,
  recoverInterruptedAnnualJobs,
  renewAnnualShare,
  revokeAnnualShare,
  serializeAnnualJob,
  updateAnnualJobProgress,
  upsertAnnualPoster
} from "./repository";
import {
  atomicWriteFile,
  atomicWriteJson,
  getAnnualPosterPath,
  getAnnualSummaryPaths,
  getAnnualInputFingerprint,
  readAnnualDiskState,
  readAnnualEvents,
  readAnnualSummary,
  removeAnnualPath,
  runAnnualSummaryCli,
  withAnnualFileLock
} from "./runtime";
import {
  ANNUAL_BUILD_HEARTBEAT_SECONDS,
  estimateAnnualBuildCost
} from "./hardening";
import { recordAnnualOperationalEvent } from './telemetry';
import {
  syncAnnualShareCardToCommunity,
  type CommunitySyncOutcome,
  type CommunitySyncReason,
  type CommunitySyncStatus
} from "./forum-sync";
import {
  buildAnnualPosterPublicUrl,
  buildAnnualShareUrl,
  createAnnualShareCardRenderToken,
  createAnnualShareToken,
  hashAnnualToken,
  normalizeAnnualLocale,
  parseAndVerifyAnnualShareToken,
  toAdminAnnualEvent,
  toPublicAnnualSummary,
  verifyAnnualRenderToken,
  verifyAnnualShareCardRenderToken
} from "./security";
import type {
  AnnualJobParameters,
  AnnualJobRow,
  AnnualJobType,
  AnnualLocale,
  AnnualPosterRow,
  AnnualShareCardRow,
  AnnualShareRow,
  AnnualSummaryRow,
  AnnualSummaryV4
} from "./types";

const queueState: Record<AnnualJobType, { pending: string[]; queued: Set<string>; running: number; limit: number }> = {
  build: { pending: [], queued: new Set(), running: 0, limit: 0 },
  poster: { pending: [], queued: new Set(), running: 0, limit: 1 }
};

const requireCurrentAnnualBinding = async (userId: number) => {
  const binding = await getCurrentBindingRow(userId);
  if (!binding) throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  return binding;
};

const safeReadSummary = async (row: AnnualSummaryRow | null) => {
  if (!row || Number(row.schema_version) !== ANNUAL_SCHEMA_VERSION) return null;
  try {
    const summary = await readAnnualSummary(row.summary_path);
    if (!canReuseAnnualSummary(summary, ANNUAL_ALGORITHM_VERSION)) return null;
    const binding = await findAnnualBinding(row.binding_id, row.user_id);
    if (!binding) return null;
    const latestEdit = await annualManualEditTime(getRuntimePaths().userdataDir, binding.taiko_id);
    if (!annualCorrectionsAreCurrent(summary.provenance?.algorithmVersion, summary.generatedAt, latestEdit)) return null;
    const version = summary.version as Record<string, unknown>;
    const canonical = getAnnualVersion();
    if (
      version.startDate !== canonical.startDate
      || version.endDate !== canonical.endDate
      || version.effectiveEndDate !== canonical.effectiveEndDate
      || version.timezone !== canonical.timezone
    ) return null;
    return summary;
  } catch (error) {
    console.warn("[annual-summary] cached summary is unavailable", row?.id, error);
    return null;
  }
};

const withOwnerAssets = async (summary: AnnualSummaryV4, locale: AnnualLocale) => {
  const enriched = await enrichAnnualSummary(summary, locale);
  const withRating = await enrichAnnualRatingDistributionAtRead(enriched);
  return {
    ...withRating,
    profileCard: {
      ...(withRating.profileCard || {}),
      myDonUrl: `/api/account/annual-summaries/${encodeURIComponent(withRating.summaryId)}/my-don`
    }
  };
};

// Admin previews render someone else's summary in the operator's browser. The
// owner-scoped account route cannot serve that operator (and the client fallback
// would then show the operator's own MyDon), so admin payloads point at an
// operator-gated route that always serves the summary owner's asset.
const withAdminAssets = async (summary: AnnualSummaryV4, locale: AnnualLocale) => {
  const enriched = await withOwnerAssets(summary, locale);
  return {
    ...enriched,
    profileCard: {
      ...(enriched.profileCard || {}),
      myDonUrl: `/api/admin/annual-summaries/${encodeURIComponent(enriched.summaryId)}/my-don`
    }
  };
};

const getSummaryMyDonPath = (row: AnnualSummaryRow) => `${dirname(row.summary_path)}/my-don.png`;

const buildPosterDto = (poster: AnnualPosterRow) => ({
  id: poster.id,
  summaryId: poster.summary_id,
  locale: poster.locale,
  width: Number(poster.width),
  height: Number(poster.height),
  url: `/api/account/annual-posters/${encodeURIComponent(poster.id)}`,
  createdAt: new Date(poster.created_at).toISOString(),
  updatedAt: new Date(poster.updated_at).toISOString()
});

const buildShareDto = async (share: AnnualShareRow, locale: AnnualLocale = share.locale) => {
  const token = createAnnualShareToken(share.id, share.summary_id);
  const poster = await findAnnualPosterForShare(share.id, locale);
  return {
    id: share.id,
    summaryId: share.summary_id,
    locale,
    url: buildAnnualShareUrl(token, locale),
    expiresAt: new Date(share.expires_at).toISOString(),
    posterUrl: poster ? buildAnnualPosterPublicUrl(token, locale) : null
  };
};

const getOwnerSummaryPayload = async (row: AnnualSummaryRow, locale: AnnualLocale) => {
  const summary = await safeReadSummary(row);
  if (!summary) return null;
  const share = await findActiveAnnualShare(row.id, row.user_id);
  return {
    summary: await withOwnerAssets(summary, locale),
    share: share ? await buildShareDto(share, locale) : null
  };
};

export const getAccountAnnualSummaryEnvelope = async (userId: number, versionInput: unknown, localeInput?: unknown) => {
  const version = resolveAnnualVersion(versionInput);
  if (!version) throw createError({ statusCode: 404, statusMessage: "年度总结版本不存在" });
  const binding = await requireCurrentAnnualBinding(userId);
  const latestRow = await findLatestAnnualSummary(userId, binding.id, version.key);
  const locale = normalizeAnnualLocale(localeInput);
  const cachedSummary = latestRow ? await safeReadSummary(latestRow) : null;
  const payload = latestRow && canReuseAnnualSummary(cachedSummary, ANNUAL_ALGORITHM_VERSION)
    ? await getOwnerSummaryPayload(latestRow, locale)
    : null;
  const activeJob = await findActiveAnnualJob({
    userId,
    bindingId: binding.id,
    versionKey: version.key,
    type: "build"
  });
  const policy = await readAnnualPolicy();
  const importState = await annualImportState(getRuntimePaths().userdataDir, binding.taiko_id);
  const refreshAvailable = Boolean(payload && policy.refreshImports && cachedSummary && annualImportNeedsRefresh(cachedSummary, importState));
  let terminalJob = null;
  if ((!payload || refreshAvailable) && !activeJob) {
    const failed = await findLatestFailedAnnualBuild(userId, binding.id, version.key);
    if (failed) {
      const revision = await annualBuildInputRevision(getRuntimePaths().userdataDir, binding.taiko_id, ANNUAL_PRODUCER_REVISION + (policy.archiveFallback ? ":archive-v1" : ""));
      if (canReuseAnnualFailure(failed, revision)) terminalJob = failed;
    }
  }
  return {
    availableVersions: [version],
    selectedVersion: version,
    currentBinding: await enrichBindingWithCurrentTitle(sanitizeBinding(binding)),
    state: payload ? "ready" : "missing",
    refreshAvailable,
    inputFingerprint: payload ? latestRow?.input_fingerprint || "" : "",
    summary: payload?.summary || null,
    share: payload?.share || null,
    buildJob: activeJob ? serializeAnnualJob(activeJob) : terminalJob ? serializeAnnualJob(terminalJob) : null
  };
};

export const getAccountAnnualSummaryById = async (userId: number, summaryId: string, localeInput?: unknown) => {
  const row = await findOwnerAnnualSummary(summaryId, userId);
  if (!row) throw createError({ statusCode: 404, statusMessage: "年度总结不存在" });
  const payload = await getOwnerSummaryPayload(row, normalizeAnnualLocale(localeInput));
  if (!payload) throw createError({ statusCode: 410, statusMessage: "年度回顾文件暂不可用，请联系管理员" });
  return payload;
};

const normalizeJobError = (type: AnnualJobType, error: unknown) => {
  const capacity = error as { code?: string; statusMessage?: string };
  if (capacity?.code === 'ANNUAL_INPUT_SUPERSEDED') return {
    code: 'ANNUAL_INPUT_SUPERSEDED', message: capacity.statusMessage || '数据已更新，请重新生成年度总结'
  };
  if (/^ANNUAL_(?:WORKER_OOM|LAUNCH_FAILED|LEASE_LOST|DB_FAILURE)/.test(String(capacity?.code || ''))) return {
    code: String(capacity.code), message: capacity.statusMessage || '年度服务暂时不可用，请稍后重试'
  };
  if (/^ANNUAL_(QUEUE|RUN|ADMISSION)/.test(String(capacity?.code || ''))) return {
    code: String(capacity.code), message: capacity.statusMessage || '年度服务繁忙，请稍后重试'
  };
  const value = error as { statusCode?: number; statusMessage?: string } | null;
  const statusCode = Number(value?.statusCode || 0);
  if (type === "build" && statusCode === 422) return { code: "INSUFFICIENT_DATA", message: "当前年度记录不足，暂时无法生成年度报告。" };
  if ([400, 404, 409, 422, 429, 503].includes(statusCode) && value?.statusMessage) {
    return { code: `HTTP_${statusCode}`, message: String(value.statusMessage) };
  }
  return {
    code: type === "poster" ? "POSTER_FAILED" : "BUILD_FAILED",
    message: type === "poster" ? "年度总结海报生成失败，请稍后重试" : "年度总结生成失败，请稍后重试"
  };
};

const buildAnnualSummaryJob = async (job: AnnualJobRow, onRunning: () => Promise<void>) => {
  const admission = JSON.parse(job.parameters_json || "{}") as AnnualJobParameters;
  const binding = await findAnnualBinding(job.binding_id, job.user_id);
  if (!binding) throw createError({ statusCode: 404, statusMessage: "当前绑定已不存在" });
  if (Number(binding.is_current) !== 1) {
    throw createError({ statusCode: 409, statusMessage: "当前绑定已切换，请重新创建年度总结任务" });
  }
  return withAnnualFileLock(`build:${job.user_id}:${job.binding_id}:${job.version_key}`, async () => {
    const envelope = await runAnnualSummaryCli(binding.taiko_id, async ({ stage, percent, detail }) => {
      const parts = [
        detail?.snapshotCount ? `${detail.snapshotCount} 份历史记录` : "",
        detail?.eventCount ? `${detail.eventCount} 条变化` : ""
      ].filter(Boolean);
      await updateAnnualJobProgress(job.id, stage, percent, parts.join(" · ") || null);
    }, { key: admission.admissionKey, ticket: admission.admissionTicket, onRunning }, Boolean(admission.allowCurrentArchive));
    await updateAnnualJobProgress(job.id, "rating", 84, "读取全站排名缓存");
    const fingerprint = String(envelope.summary.provenance?.inputFingerprint || "");
    const summaryId = String(envelope.summary.summaryId);
    const publishFingerprint = await getAnnualInputFingerprint(binding.taiko_id);
    if (!job.input_fingerprint || publishFingerprint !== job.input_fingerprint) {
      throw Object.assign(new Error("annual input changed while queued or running"), {
        code: "ANNUAL_INPUT_SUPERSEDED",
        statusCode: 409,
        statusMessage: "数据已更新，请重新生成年度总结"
      });
    }
    const existingById = await findAnnualSummaryById(summaryId);
    if (existingById) {
      if (
        existingById.user_id !== job.user_id ||
        existingById.binding_id !== job.binding_id ||
        existingById.input_fingerprint !== fingerprint
      ) {
        throw new Error("annual summary identifier collision");
      }
      return existingById;
    }
    const paths = getAnnualSummaryPaths(job.user_id, job.binding_id, summaryId);
    const generatedAt = new Date(envelope.summary.generatedAt || Date.now()).toISOString();
    const mode = envelope.summary.mode === "version_observed" ? "version_observed" : "current_archive";
    const rawSummary: AnnualSummaryV4 = {
      ...envelope.summary,
      schemaVersion: ANNUAL_SCHEMA_VERSION,
      summaryId,
      generatedAt,
      mode,
      version: getAnnualVersion(),
      profileCard: { ...(envelope.summary.profileCard || {}) }
    };
    const summary = await enrichAnnualRatingRank(rawSummary);
    summary.provenance.warnings = [...(summary.provenance.warnings || []).filter(w => !w.startsWith("kinoko_revision:")), `kinoko_revision:${admission.kinokoRevision || ""}`];
    await updateAnnualJobProgress(job.id, "assets", 90, "保存年度故事与小咚形象");

    let row: AnnualSummaryRow | null = null;
    try {
      const myDon = await getMyDonImageBuffer(job.user_id).catch((error) => {
        const errorName = error && typeof error === "object" && "name" in error
          ? String(error.name || "Error")
          : "Error";
        console.warn("[annual-summary] my-don snapshot unavailable", errorName);
        return null;
      });
      await Promise.all([
        atomicWriteJson(paths.summaryPath, summary),
        atomicWriteJson(paths.eventsPath, envelope.events),
        ...(myDon ? [atomicWriteFile(`${paths.dir}/my-don.png`, myDon)] : [])
      ]);
      row = await insertAnnualSummary({
        id: summaryId,
        userId: job.user_id,
        bindingId: job.binding_id,
        versionKey: ANNUAL_VERSION_KEY,
        mode,
        fingerprint,
        summaryPath: paths.summaryPath,
        eventsPath: paths.eventsPath,
        eventCount: envelope.events.length,
        generatedAt
      });
      if (!row) throw new Error("summary metadata was not persisted");
    } catch (error) {
      if (!row) await removeAnnualPath(paths.dir).catch(() => undefined);
      throw error;
    }
    const pruned = admission.refreshExisting ? [] : await pruneSupersededAnnualSummaries(job.user_id, job.binding_id, job.version_key)
      .catch((error) => { console.error('[annual-summary] superseded summary cleanup failed', error); return []; });
    for (const stale of pruned) {
      await removeAnnualPath(dirname(stale.summary_path)).catch(() => undefined);
    }
    return row;
  });
};

const buildAnnualPosterJob = async (job: AnnualJobRow, parameters: AnnualJobParameters, onRunning: () => Promise<void>) => {
  const summaryId = String(job.summary_id || "");
  const shareId = String(parameters.shareId || "");
  const locale = normalizeAnnualLocale(parameters.locale);
  const summary = await findOwnerAnnualSummary(summaryId, job.user_id);
  const share = await findOwnerAnnualShare(shareId, job.user_id);
  if (!summary || !share || share.summary_id !== summaryId || share.status !== "active" || new Date(share.expires_at).getTime() <= Date.now()) {
    throw createError({ statusCode: 409, statusMessage: "公开分享已失效，请重新创建后再生成海报" });
  }
  const posterId = String(job.poster_id || randomUUID());
  const fingerprint = createHash("sha256")
    .update(`${summary.input_fingerprint}:${share.id}:${locale}:${ANNUAL_POSTER_WIDTH}x${ANNUAL_POSTER_HEIGHT}`)
    .digest("hex");
  const existing = await findAnnualPosterForShare(share.id, locale);
  if (existing?.fingerprint === fingerprint && await access(existing.file_path).then(() => true, () => false)) {
    await onRunning();
    if (parameters.admissionTicket) await annualAdmission.cancel('renderer', parameters.admissionTicket);
    return existing;
  }
  const outputPath = getAnnualPosterPath(share.id, posterId, locale);
  try {
    const dimensions = await renderAnnualPoster({ summaryId, posterId, shareId: share.id, locale, outputPath, admissionTicket: parameters.admissionTicket, onRunning });
    const poster = await upsertAnnualPoster({
      id: posterId,
      summaryId,
      shareId: share.id,
      userId: job.user_id,
      locale,
      fingerprint,
      filePath: outputPath,
      ...dimensions
    });
    if (!poster) throw new Error("poster metadata was not persisted");
    if (existing && existing.file_path !== poster.file_path) {
      await removeAnnualPath(existing.file_path).catch(() => undefined);
    }
    return poster;
  } catch (error) {
    await removeAnnualPath(outputPath).catch(() => undefined);
    throw error;
  }
};

const durableLeaseOwner = `${hostname()}:${process.pid}:${randomUUID()}`;
const runningDurableBuilds = new Set<string>();
let durablePumpRunning = false;
let durablePumpTimer: ReturnType<typeof setInterval> | null = null;
let circuitOpenUntil = 0;
const infrastructureFailures: number[] = [];

const noteInfrastructureFailure = (code: string) => {
  if (!/OOM|ADMISSION|LAUNCH|LEASE|DB|DISK|RUN_TIMEOUT/.test(code)) return;
  const now = Date.now();
  infrastructureFailures.push(now);
  while (infrastructureFailures.length && infrastructureFailures[0] < now - 5 * 60_000) infrastructureFailures.shift();
  if (infrastructureFailures.length >= 3) {
    circuitOpenUntil = Math.max(circuitOpenUntil, now + 5 * 60_000);
    console.error('[annual-summary] durable build circuit opened', { code, failures: infrastructureFailures.length });
  }
};

const executeLeasedAnnualBuild = async (job: AnnualJobRow) => {
  const startedAt = Date.now();
  let heartbeatLost = false;
  const heartbeat = setInterval(() => {
    void heartbeatAnnualBuild(job.id, durableLeaseOwner).then((ok) => {
      if (!ok) heartbeatLost = true;
    }).catch(() => {
      heartbeatLost = true;
      noteInfrastructureFailure('ANNUAL_DB_HEARTBEAT');
    });
  }, ANNUAL_BUILD_HEARTBEAT_SECONDS * 1000);
  heartbeat.unref();
  try {
    const binding = await findAnnualBinding(job.binding_id, job.user_id);
    if (!binding) throw createError({ statusCode: 404, statusMessage: '当前绑定已不存在' });
    const currentFingerprint = await getAnnualInputFingerprint(binding.taiko_id);
    if (!job.input_fingerprint || currentFingerprint !== job.input_fingerprint) {
      throw Object.assign(new Error('annual input changed before worker launch'), {
        code: 'ANNUAL_INPUT_SUPERSEDED', statusCode: 409, statusMessage: '数据已更新，请重新生成年度总结'
      });
    }
    await trackBetaUser(job.user_id, 'annual_build_start', { job_id: job.id }, `build_start:${job.id}`);
    const summary = await buildAnnualSummaryJob(job, async () => undefined);
    const completed = await completeLeasedAnnualBuild(job.id, durableLeaseOwner, summary.id);
    if (!completed) {
      throw Object.assign(new Error('annual build lease was lost before completion'), { code: 'ANNUAL_LEASE_LOST' });
    }
    if (heartbeatLost) console.warn('[annual-summary] heartbeat recovered before completion', job.id);
    infrastructureFailures.length = 0;
    await trackBetaUser(job.user_id, 'annual_build_success', {
      job_id: job.id, duration_ms: Date.now() - startedAt
    }, `build_success:${job.id}`);
  } catch (error) {
    const safe = normalizeJobError('build', error);
    const superseded = safe.code === 'ANNUAL_INPUT_SUPERSEDED';
    if (!superseded && safe.code !== 'INSUFFICIENT_DATA') {
      console.error('[annual-summary] leased build failed', job.id, error);
    }
    noteInfrastructureFailure(safe.code);
    if (safe.code === 'ANNUAL_WORKER_OOM') void recordAnnualOperationalEvent('worker_oom');
    if (safe.code === 'ANNUAL_LAUNCH_FAILED') void recordAnnualOperationalEvent('launcher_failure');
    await failLeasedAnnualBuild(
      job.id,
      durableLeaseOwner,
      safe.code,
      safe.message,
      superseded ? 'expired' : 'failed'
    ).catch(() => noteInfrastructureFailure('ANNUAL_DB_FAILURE'));
    await trackBetaUser(job.user_id, safe.code === 'INSUFFICIENT_DATA' ? 'annual_unavailable' : 'annual_build_failure', {
      job_id: job.id,
      reason: safe.code === 'INSUFFICIENT_DATA' ? 'insufficient_data' : safe.code,
      duration_ms: Date.now() - startedAt
    }, `build_result:${job.id}`);
  } finally {
    clearInterval(heartbeat);
    runningDurableBuilds.delete(job.id);
    queueMicrotask(() => { void pumpDurableBuildQueue(); });
  }
};

const pumpDurableBuildQueue = async () => {
  if (durablePumpRunning || circuitOpenUntil > Date.now()) return;
  durablePumpRunning = true;
  try {
    while (runningDurableBuilds.size < MAX_CONCURRENT_ANNUAL_BUILDS) {
      const disk = await readAnnualDiskState();
      if (!disk.acceptsNewBuilds) {
        noteInfrastructureFailure('ANNUAL_DISK_CRITICAL');
        break;
      }
      if (!(await annualAdmission.hasHeadroom())) break;
      const job = await claimNextAnnualBuild(durableLeaseOwner);
      if (!job) break;
      runningDurableBuilds.add(job.id);
      void executeLeasedAnnualBuild(job);
    }
  } catch (error) {
    noteInfrastructureFailure('ANNUAL_DB_QUEUE_FAILURE');
    void recordAnnualOperationalEvent('db_queue_failure');
    console.error('[annual-summary] durable queue dispatch failed', error);
  } finally {
    durablePumpRunning = false;
  }
};

const wakeDurableBuildQueue = () => queueMicrotask(() => { void pumpDurableBuildQueue(); });

const executeAnnualJob = async (jobId: string) => withAnnualFileLock(`execute:${jobId}`, async () => {
  const job = await findAnnualJobById(jobId);
  if (!job || job.status !== "queued") return;
  let betaStartedAt = Date.now();
  const onRunning = async () => {
    if (!(await markAnnualJobRunning(job.id))) throw new Error('annual job was already claimed');
    betaStartedAt = Date.now();
    if (job.job_type === 'build') await trackBetaUser(job.user_id, 'annual_build_start', {job_id:job.id}, 'build_start:'+job.id);
  };
  let parameters: AnnualJobParameters = {};
  try {
    parameters = job.parameters_json ? (JSON.parse(job.parameters_json) as AnnualJobParameters) : {};
  } catch {}
  try {
    if (job.job_type === "build") {
      const summary = await buildAnnualSummaryJob(job, onRunning);
      await markAnnualJobCompleted(job.id, { summaryId: summary.id });
      await trackBetaUser(job.user_id,"annual_build_success",{job_id:job.id,duration_ms:Date.now()-betaStartedAt},"build_success:"+job.id);
    } else {
      const poster = await buildAnnualPosterJob(job, parameters, onRunning);
      await markAnnualJobCompleted(job.id, { posterId: poster.id, summaryId: poster.summary_id });
    }
  } catch (error) {
    if (parameters.admissionTicket) await annualAdmission.cancel(job.job_type === 'build' ? 'generator' : 'renderer', parameters.admissionTicket);
    const current = await findAnnualJobById(job.id);
    if (current?.status === 'failed' && current.error_code === 'ANNUAL_QUEUE_TIMEOUT') return;
    const safe = normalizeJobError(job.job_type, error);
    if (safe.code !== "INSUFFICIENT_DATA") console.error(`[annual-summary] ${job.job_type} job failed`, job.id, error);
    await markAnnualJobFailed(job.id, safe.code, safe.message);
    if (job.job_type === "build") await trackBetaUser(job.user_id,safe.code === "INSUFFICIENT_DATA"?"annual_unavailable":"annual_build_failure",{job_id:job.id,reason:safe.code === "INSUFFICIENT_DATA"?"insufficient_data":safe.code,duration_ms:Date.now()-betaStartedAt},"build_result:"+job.id);
  }
});

const pumpQueue = (type: AnnualJobType) => {
  const state = queueState[type];
  while (state.running < state.limit && state.pending.length) {
    const jobId = state.pending.shift()!;
    state.queued.delete(jobId);
    state.running += 1;
    void executeAnnualJob(jobId).catch(() => console.error("[annual-summary] job dispatch failed", jobId)).finally(() => {
      state.running -= 1;
      queueMicrotask(() => pumpQueue(type));
    });
  }
};

export const enqueueAnnualJob = (job: Pick<AnnualJobRow, "id" | "job_type">) => {
  if (job.job_type === 'build') {
    wakeDurableBuildQueue();
    return;
  }
  const state = queueState[job.job_type];
  if (state.queued.has(job.id)) return;
  state.queued.add(job.id);
  state.pending.push(job.id);
  queueMicrotask(() => pumpQueue(job.job_type));
};

export const maintainAnnualStorage = async () => {
  await expireAnnualShares();
  const staleShares = await listAnnualSharesNeedingPosterCleanup();
  await Promise.all(staleShares.map((shareId) => cleanupSharePosters(shareId)));
  const staleSummaries = await listAnnualSummaryGcCandidates();
  for (const summary of staleSummaries) {
    if (await deleteAnnualSummaryForGc(summary.id)) {
      await removeAnnualPath(dirname(summary.summary_path)).catch(() => undefined);
    }
  }
  await deleteOldAnnualJobs();
};

let queueExpiryTimer: ReturnType<typeof setInterval> | null = null;
let queueExpiryRunning = false;
const expireAnnualQueue = async () => {
  if (queueExpiryRunning) return;
  queueExpiryRunning = true;
  try {
    for (const job of await expireQueuedAnnualJobs()) {
      const parameters = JSON.parse(job.parameters_json || '{}') as AnnualJobParameters;
      if (parameters.admissionTicket) await annualAdmission.cancel(job.job_type === 'build' ? 'generator' : 'renderer', parameters.admissionTicket);
      console.info('[annual-admission]', JSON.stringify({ resource: job.job_type, state: 'timeout', code: 'ANNUAL_QUEUE_TIMEOUT', id: job.id }));
      if (job.job_type === 'build') await trackBetaUser(job.user_id, 'annual_build_failure', { job_id: job.id, reason: 'ANNUAL_QUEUE_TIMEOUT' }, 'build_result:'+job.id);
      if (job.job_type === 'build') void recordAnnualOperationalEvent('expired');
    }
  } catch { console.error('[annual-summary] queue expiration check failed'); }
  finally { queueExpiryRunning = false; }
};

export const recoverAnnualJobs = async () => {
  if (!queueExpiryTimer) {
    queueExpiryTimer = setInterval(() => { void expireAnnualQueue(); }, 10_000);
    queueExpiryTimer.unref();
  }
  await maintainAnnualStorage();
  await expireAnnualQueue();
  const jobs = await recoverInterruptedAnnualJobs();
  for (const job of jobs) enqueueAnnualJob(job);
  if (!durablePumpTimer) {
    durablePumpTimer = setInterval(wakeDurableBuildQueue, 1_000);
    durablePumpTimer.unref();
  }
  wakeDurableBuildQueue();
};

export const queueAccountAnnualSummaryBuild = async (
  userId: number,
  versionInput: unknown,
  options: { locale?: unknown; bindingId?: number; retryFailed?: boolean } = {}
) => {
  const version = resolveAnnualVersion(versionInput);
  if (!version) throw createError({ statusCode: 404, statusMessage: "年度总结版本不存在" });
  const binding = options.bindingId ? await findAnnualBinding(options.bindingId, userId) : await requireCurrentAnnualBinding(userId);
  if (!binding) throw createError({ statusCode: 400, statusMessage: "目标绑定不存在" });
  return withAnnualFileLock(`queue:build:${userId}:${binding.id}:${version.key}`, async () => {
    const policy = await readAnnualPolicy();
    const importState = await annualImportState(getRuntimePaths().userdataDir, binding.taiko_id);
    const existing = await findLatestAnnualSummary(userId, binding.id, version.key);
    if (existing) {
      const cached = await safeReadSummary(existing);
      if (canReuseAnnualSummary(cached, ANNUAL_ALGORITHM_VERSION) && !(policy.refreshImports && cached && annualImportNeedsRefresh(cached, importState))) {
        const completed = await insertAnnualJob({
          id: randomUUID(),
          userId,
          bindingId: binding.id,
          versionKey: version.key,
          type: "build",
          summaryId: existing.id,
          parameters: {},
          completed: true
        });
        return { job: serializeAnnualJob(completed!), summary: await withAdminAssets(cached, normalizeAnnualLocale(options.locale)) };
      }
    }

    await assertAnnualTaskAllowed('generation');
    if (circuitOpenUntil > Date.now()) {
      void recordAnnualOperationalEvent('rejected');
      throw Object.assign(createError({ statusCode: 503, statusMessage: '年度服务暂时降级，请稍后重试' }),
        { retryAfter: Math.max(30, Math.ceil((circuitOpenUntil - Date.now()) / 1000)) });
    }
    const disk = await readAnnualDiskState();
    if (!disk.acceptsNewBuilds) {
      noteInfrastructureFailure('ANNUAL_DISK_CRITICAL');
      void recordAnnualOperationalEvent('rejected');
      throw Object.assign(createError({ statusCode: 503, statusMessage: '年度服务空间不足，请稍后重试' }),
        { retryAfter: 120 });
    }
    const [inputRevision, inputFingerprint, cost] = await Promise.all([
      annualBuildInputRevision(getRuntimePaths().userdataDir, binding.taiko_id, ANNUAL_PRODUCER_REVISION + (policy.archiveFallback ? ":archive-v1" : "")),
      getAnnualInputFingerprint(binding.taiko_id),
      estimateAnnualBuildCost(getRuntimePaths().userdataDir, binding.taiko_id)
    ]);
    const failed = await findLatestFailedAnnualBuild(userId, binding.id, version.key);
    if (!options.retryFailed && canReuseAnnualFailure(failed, inputRevision)) {
      return { job: serializeAnnualJob(failed!), summary: null };
    }
    const jobKey = createHash('sha256').update(JSON.stringify([
      userId, binding.id, version.key, ANNUAL_PRODUCER_REVISION, inputFingerprint, inputRevision
    ])).digest('hex');
    try {
      const admitted = await admitAnnualBuildJob({
        id: randomUUID(), userId, bindingId: binding.id, versionKey: version.key, jobKey,
        algorithmVersion: ANNUAL_ALGORITHM_VERSION,
        inputFingerprint,
        sourceRevision: inputRevision,
        estimatedServiceSeconds: cost.estimatedServiceSeconds,
        parameters: {
          inputRevision,
          allowCurrentArchive: policy.archiveFallback,
          kinokoRevision: importState.revision,
          refreshExisting: Boolean(existing),
          sourceRevision: inputRevision,
          inputFingerprint,
          estimatedServiceSeconds: cost.estimatedServiceSeconds,
          algorithmVersion: ANNUAL_ALGORITHM_VERSION
        }
      });
      wakeDurableBuildQueue();
      return { job: serializeAnnualJob(admitted.job), summary: null };
    } catch (error) {
      if (error instanceof AnnualQueueCapacityError) {
        void recordAnnualOperationalEvent('rejected');
        throw Object.assign(createError({ statusCode: error.statusCode, statusMessage: error.statusMessage }),
          { retryAfter: error.retryAfter });
      }
      throw error;
    }
  });
};

export const getAccountAnnualJob = async (userId: number, jobId: string, type: AnnualJobType, localeInput?: unknown) => {
  const job = await findOwnerAnnualJob(jobId, userId, type);
  if (!job) throw createError({ statusCode: 404, statusMessage: "任务不存在" });
  const response: Record<string, unknown> = { job: serializeAnnualJob(job) };
  if (job.status === "completed" && job.summary_id) {
    const row = await findOwnerAnnualSummary(job.summary_id, userId);
    const summary = await safeReadSummary(row);
    if (summary) response.summary = await withOwnerAssets(summary, normalizeAnnualLocale(localeInput));
  }
  if (job.status === "completed" && job.poster_id) {
    const poster = await findAnnualPosterById(job.poster_id);
    if (poster && poster.user_id === userId) response.poster = buildPosterDto(poster);
  }
  return response;
};

const cleanupSharePosters = async (shareId: string) => {
  const paths = await listAnnualPosterPathsForShare(shareId);
  await deleteAnnualPostersForShare(shareId);
  await Promise.all(paths.map((path) => removeAnnualPath(path).catch(() => undefined)));
};

export const createAccountAnnualShare = async (userId: number, summaryId: string, localeInput: unknown) => {
  const summary = await findOwnerAnnualSummary(summaryId, userId);
  if (!summary) throw createError({ statusCode: 404, statusMessage: "年度总结不存在" });
  if (!(await safeReadSummary(summary))) {
    throw createError({ statusCode: 410, statusMessage: "年度回顾文件暂不可用，请联系管理员" });
  }
  return withAnnualFileLock(`share:${userId}:${summaryId}`, async () => {
    const locale = normalizeAnnualLocale(localeInput);
    const oldShares = await listActiveAnnualShares(summaryId, userId);
    const shareId = randomUUID();
    const token = createAnnualShareToken(shareId, summaryId);
    const share = await insertAnnualShare({
      id: shareId,
      summaryId,
      userId,
      locale,
      tokenHash: hashAnnualToken(token),
      expiresAt: new Date(Date.now() + ANNUAL_SHARE_TTL_MS)
    });
    await Promise.all(oldShares.map((item) => cleanupSharePosters(item.id)));
    if (!share) throw createError({ statusCode: 500, statusMessage: "公开分享创建失败" });
    return { share: await buildShareDto(share) };
  });
};

export const renewAccountAnnualShare = async (userId: number, shareId: string) => {
  const share = await renewAnnualShare(shareId, userId, new Date(Date.now() + ANNUAL_SHARE_TTL_MS));
  if (!share) throw createError({ statusCode: 404, statusMessage: "公开分享不存在或已撤销" });
  return { share: await buildShareDto(share) };
};

export const revokeAccountAnnualShare = async (userId: number, shareId: string) => {
  const share = await findOwnerAnnualShare(shareId, userId);
  if (!share) throw createError({ statusCode: 404, statusMessage: "公开分享不存在" });
  await revokeAnnualShare(shareId, userId);
  await cleanupSharePosters(shareId);
  return { ok: true };
};

export const queueAccountAnnualPoster = async (
  userId: number,
  summaryId: string,
  input: { shareId?: unknown; locale?: unknown }
) => {
  const summary = await findOwnerAnnualSummary(summaryId, userId);
  if (!summary) throw createError({ statusCode: 404, statusMessage: "年度总结不存在" });
  return withAnnualFileLock(`queue:poster:${userId}:${summaryId}`, async () => {
    const shareId = String(input.shareId || "").trim();
    const share = await findOwnerAnnualShare(shareId, userId);
    if (!share || share.summary_id !== summaryId || share.status !== "active" || new Date(share.expires_at).getTime() <= Date.now()) {
      throw createError({ statusCode: 409, statusMessage: "请先创建有效期 30 天的公开分享" });
    }
    const active = await findActiveAnnualJob({
      userId,
      bindingId: summary.binding_id,
      versionKey: summary.version_key,
      type: "poster",
      summaryId
    });
    if (active) return { job: serializeAnnualJob(active) };
    const recent = await countRecentAnnualJobs({
      userId,
      type: "poster",
      since: new Date(Date.now() - ANNUAL_POSTER_COOLDOWN_MS)
    });
    if (recent > 0) throw createError({ statusCode: 429, statusMessage: "海报每分钟仅可生成一次" });
    const posterId = randomUUID();
    const locale = normalizeAnnualLocale(input.locale || share.locale);
    const outputPath = getAnnualPosterPath(shareId, posterId, locale);
    await assertAnnualTaskAllowed('rendering');
    const admissionTicket = await annualAdmission.reserve('renderer', `legacy:${summaryId}:${locale}:${outputPath}`);
    const job = await insertAnnualJob({
      id: randomUUID(),
      userId,
      bindingId: summary.binding_id,
      versionKey: summary.version_key,
      type: "poster",
      summaryId,
      posterId,
      parameters: { shareId, locale, admissionTicket }
    }).catch(async error => { await annualAdmission.cancel('renderer', admissionTicket); throw error; });
    if (!job) await annualAdmission.cancel('renderer', admissionTicket);
    if (!job) throw createError({ statusCode: 500, statusMessage: "无法创建海报任务" });
    enqueueAnnualJob(job);
    return { job: serializeAnnualJob(job) };
  });
};

const requirePublicShare = async (tokenInput: unknown) => {
  const token = String(tokenInput || "").trim();
  const shareId = token.slice(0, token.indexOf("."));
  if (!/^[0-9a-f-]{36}$/i.test(shareId)) throw createError({ statusCode: 404, statusMessage: "分享不存在" });
  const share = await findAnnualShareById(shareId);
  if (share && new Date(share.expires_at).getTime() <= Date.now()) {
    await expireAnnualShare(share.id);
    await cleanupSharePosters(share.id);
  }
  if (
    !share ||
    share.status !== "active" ||
    new Date(share.expires_at).getTime() <= Date.now() ||
    !parseAndVerifyAnnualShareToken(token, share)
  ) {
    throw createError({ statusCode: 404, statusMessage: "分享不存在或已失效" });
  }
  return { share, token };
};

export const getPublicAnnualShare = async (tokenInput: unknown, localeInput?: unknown) => {
  const { share, token } = await requirePublicShare(tokenInput);
  const row = await findAnnualSummaryById(share.summary_id);
  const summary = await safeReadSummary(row);
  if (!row || !summary) throw createError({ statusCode: 410, statusMessage: "分享内容已失效" });
  const locale = localeInput == null ? share.locale : normalizeAnnualLocale(localeInput);
  const enriched = await enrichAnnualSummary(summary, locale);
  const publicSummary = toPublicAnnualSummary(enriched) as Record<string, unknown>;
  publicSummary.profileCard = {
    ...((publicSummary.profileCard || {}) as Record<string, unknown>),
    myDonUrl: `/api/annual/shares/${encodeURIComponent(token)}/my-don`
  };
  const poster = await findAnnualPosterForShare(share.id, locale);
  return {
    summary: publicSummary,
    share: {
      expiresAt: new Date(share.expires_at).toISOString(),
      locale,
      posterUrl: poster ? buildAnnualPosterPublicUrl(token, locale) : null
    }
  };
};

export const getPublicAnnualPosterPath = async (tokenInput: unknown, localeInput?: unknown) => {
  const { share } = await requirePublicShare(tokenInput);
  const locale = localeInput == null ? share.locale : normalizeAnnualLocale(localeInput);
  const poster = await findAnnualPosterForShare(share.id, locale);
  if (!poster) throw createError({ statusCode: 404, statusMessage: "海报尚未生成" });
  await access(poster.file_path).catch(() => {
    throw createError({ statusCode: 410, statusMessage: "海报文件已失效" });
  });
  return poster.file_path;
};

export const getOwnerAnnualPosterPath = async (userId: number, posterId: string) => {
  const poster = await findAnnualPosterById(posterId);
  if (!poster || poster.user_id !== userId) throw createError({ statusCode: 404, statusMessage: "海报不存在" });
  await access(poster.file_path).catch(() => {
    throw createError({ statusCode: 410, statusMessage: "海报文件已失效" });
  });
  return poster.file_path;
};

export const getOwnerAnnualMyDonPath = async (userId: number, summaryId: string) => {
  const summary = await findOwnerAnnualSummary(summaryId, userId);
  if (!summary) throw createError({ statusCode: 404, statusMessage: "年度总结不存在" });
  const path = getSummaryMyDonPath(summary);
  await access(path).catch(() => {
    throw createError({ statusCode: 404, statusMessage: "小咚形象不可用" });
  });
  return path;
};

export const getPublicAnnualMyDonPath = async (tokenInput: unknown) => {
  const { share } = await requirePublicShare(tokenInput);
  const summary = await findAnnualSummaryById(share.summary_id);
  if (!summary) throw createError({ statusCode: 404, statusMessage: "分享不存在" });
  const path = getSummaryMyDonPath(summary);
  await access(path).catch(() => {
    throw createError({ statusCode: 404, statusMessage: "小咚形象不可用" });
  });
  return path;
};

export const getInternalAnnualPosterPayload = async (summaryId: string, tokenInput: unknown, localeInput?: unknown) => {
  const verified = verifyAnnualRenderToken(tokenInput, summaryId);
  if (!verified) throw createError({ statusCode: 403, statusMessage: "海报渲染凭据无效" });
  const summaryRow = await findAnnualSummaryById(summaryId);
  const summary = await safeReadSummary(summaryRow);
  if (!summaryRow || !summary) throw createError({ statusCode: 404, statusMessage: "年度总结不存在" });
  const share = await findAnnualShareById(verified.shareId);
  if (!share || share.summary_id !== summaryId || share.user_id !== summaryRow.user_id || share.status !== "active" || new Date(share.expires_at).getTime() <= Date.now()) {
    throw createError({ statusCode: 409, statusMessage: "公开分享已失效" });
  }
  const shareToken = createAnnualShareToken(share.id, summaryId);
  const locale = normalizeAnnualLocale(localeInput || share.locale);
  const shareUrl = buildAnnualShareUrl(shareToken, locale);
  const enriched = await enrichAnnualSummary(summary, locale);
  return {
    summary: {
      ...enriched,
      profileCard: {
        ...(enriched.profileCard || {}),
        myDonUrl: `/api/internal/annual-posters/${encodeURIComponent(summaryId)}/my-don?token=${encodeURIComponent(String(tokenInput))}`
      },
      poster: {
        ...(enriched.poster || {}),
        shareUrl,
        qrCodeDataUrl: await createAnnualQrCodeDataUrl(shareUrl)
      }
    },
    share: { url: shareUrl, expiresAt: new Date(share.expires_at).toISOString(), locale }
  };
};

export const getInternalAnnualMyDonPath = async (summaryId: string, tokenInput: unknown) => {
  const verified = verifyAnnualRenderToken(tokenInput, summaryId);
  if (!verified) {
    throw createError({ statusCode: 403, statusMessage: "海报渲染凭据无效" });
  }
  const row = await findAnnualSummaryById(summaryId);
  if (!row) throw createError({ statusCode: 404, statusMessage: "年度总结不存在" });
  const share = await findAnnualShareById(verified.shareId);
  if (!share || share.summary_id !== summaryId || share.user_id !== row.user_id || share.status !== "active" || new Date(share.expires_at).getTime() <= Date.now()) {
    throw createError({ statusCode: 409, statusMessage: "公开分享已失效" });
  }
  const path = getSummaryMyDonPath(row);
  await access(path).catch(() => {
    throw createError({ statusCode: 404, statusMessage: "小咚形象不可用" });
  });
  return path;
};

/**
 * Share card: the AnnualShareGrid four-tile image the Poster page lets the owner
 * save. It reuses the existing Playwright renderer and the existing annual cache,
 * and deliberately has no relationship with the 30-day public share or the
 * legacy poster job.
 */
const getAnnualShareCardPath = (row: AnnualSummaryRow, fingerprint: string) =>
  `${dirname(row.summary_path)}/share-cards/${fingerprint}.png`;

const buildShareCardDto = (row: AnnualShareCardRow) => ({
  id: row.id,
  imageUrl: `/api/account/annual-share-cards/${encodeURIComponent(row.id)}/image`,
  width: Number(row.width),
  height: Number(row.height)
});

const getShareCardFingerprint = (row: AnnualSummaryRow, locale: AnnualLocale) =>
  createHash("sha256")
    .update(`${row.input_fingerprint}:${locale}:${ANNUAL_SHARE_CARD_WIDTH}x${ANNUAL_SHARE_CARD_HEIGHT}:${ANNUAL_SHARE_CARD_RENDERER_REVISION}`)
    .digest("hex");

const buildShareCardSyncDto = (
  card: AnnualShareCardRow,
  outcome: { status: CommunitySyncStatus; reason: CommunitySyncReason; message: string; threadId?: number; imageUrl?: string } | null,
  requested: boolean
) => ({
  requested,
  status: outcome?.status || (card.forum_thread_id ? "synced" : "skipped"),
  reason: outcome?.reason || (card.forum_thread_id ? "synced" : "not-requested"),
  threadId: outcome?.threadId ?? card.forum_thread_id ?? null,
  imageUrl: outcome?.imageUrl ?? card.forum_image_url ?? null,
  message: outcome?.message || (card.forum_thread_id ? "分享图片已保存，已同步到社区" : "分享图片已保存")
});

export const createAccountAnnualShareCard = async (
  event: H3Event,
  userId: number,
  summaryId: string,
  options: { locale?: unknown; syncCommunity?: unknown; actorUsername: string }
) => {
  const row = await findOwnerAnnualSummary(summaryId, userId);
  if (!row) throw createError({ statusCode: 404, statusMessage: "年度总结不存在" });
  const summary = await safeReadSummary(row);
  if (!summary) throw createError({ statusCode: 410, statusMessage: "年度回顾文件暂不可用，请联系管理员" });
  const locale = normalizeAnnualLocale(options.locale);
  const fingerprint = getShareCardFingerprint(row, locale);
  const cached = await findAnnualShareCard(summaryId, locale, fingerprint);
  const cachedUsable = Boolean(cached && (await access(cached.file_path).then(() => true).catch(() => false)));
  let card = cachedUsable ? cached! : null;
  if (!card) {
    const outputPath = getAnnualShareCardPath(row, fingerprint);
    await renderAnnualShareCard({ summaryId, locale, outputPath });
    const stored = await insertAnnualShareCard({
      id: cached?.id || randomUUID(),
      summaryId,
      userId,
      locale,
      fingerprint,
      filePath: outputPath,
      width: ANNUAL_SHARE_CARD_WIDTH,
      height: ANNUAL_SHARE_CARD_HEIGHT
    });
    if (!stored) throw createError({ statusCode: 500, statusMessage: "分享图片保存失败" });
    card = stored;
  }
  const shareCard = buildShareCardDto(card);

  // Saving the image is the primary operation; the Forum sync is an optional side
  // effect that can only downgrade its own status, never the saved share card.
  if (options.syncCommunity !== true) {
    const dto = buildShareCardSyncDto(card, null, false);
    return {
      shareCard,
      cached: cachedUsable,
      // This request did not ask for a community sync, so report that even when an
      // earlier save already synced the same card; the thread stays informational.
      communitySync: { ...dto, status: "skipped", reason: "not-requested", message: "分享图片已保存" }
    };
  }
  if (card.forum_thread_id) {
    return { shareCard, cached: cachedUsable, communitySync: buildShareCardSyncDto(card, null, true) };
  }

  let outcome: (CommunitySyncOutcome & { imageUrl?: string }) | null = null;
  try {
    // The share-card row is the idempotency anchor: the lock plus the re-read inside
    // it means repeated or concurrent saves of the same card cannot post twice.
    outcome = await withAnnualFileLock(`annual-share-card-forum-sync:${card.id}`, async () => {
      const fresh = await findOwnerAnnualShareCard(card.id, userId);
      if (fresh?.forum_thread_id) {
        return { status: "synced" as const, reason: "synced" as const, threadId: fresh.forum_thread_id, imageUrl: fresh.forum_image_url || undefined, message: "分享图片已保存，已同步到社区" };
      }
      const imageData = await readAnnualImage(card.file_path);
      const result = await syncAnnualShareCardToCommunity({
        event,
        actorUserId: userId,
        actorUsername: options.actorUsername,
        imageData
      });
      if (result.status === "synced" && result.threadId && result.imageUrl) {
        await markAnnualShareCardForumSync({ cardId: card.id, imageUrl: result.imageUrl, threadId: result.threadId });
      }
      return result;
    });
  } catch (error) {
    console.warn("[annual-share-card] forum sync aborted", card.id, (error as { statusMessage?: string })?.statusMessage || error);
    outcome = { status: "failed", reason: "failed", message: "分享图片已保存，但同步社区失败" };
  }
  const refreshed = (await findOwnerAnnualShareCard(card.id, userId)) || card;
  return { shareCard, cached: cachedUsable, communitySync: buildShareCardSyncDto(refreshed, outcome, true) };
};

export const getOwnerAnnualShareCardPath = async (userId: number, cardId: string) => {
  const row = await findOwnerAnnualShareCard(cardId, userId);
  if (!row) throw createError({ statusCode: 404, statusMessage: "分享图片不存在" });
  await access(row.file_path).catch(() => {
    throw createError({ statusCode: 404, statusMessage: "分享图片不存在" });
  });
  return row.file_path;
};

export const getInternalAnnualShareCardPayload = async (summaryId: string, tokenInput: unknown, localeInput?: unknown) => {
  if (!verifyAnnualShareCardRenderToken(tokenInput, summaryId)) {
    throw createError({ statusCode: 403, statusMessage: "分享图片渲染凭据无效" });
  }
  const row = summaryId.startsWith("bot_") ? null : await findAnnualSummaryById(summaryId);
  const summary = summaryId.startsWith("bot_") ? await readBotAnnualSummary(summaryId) : await safeReadSummary(row);
  if (!summary) throw createError({ statusCode: 404, statusMessage: "年度总结不存在" });
  const promoQrCodeDataUrl = await createAnnualShareCardPromoQrCodeDataUrl(ANNUAL_SHARE_CARD_PROMO_URL);
  if (!promoQrCodeDataUrl) {
    throw createError({ statusCode: 500, statusMessage: "年度分享图片二维码生成失败" });
  }
  const enriched = await withOwnerAssets(summary, normalizeAnnualLocale(localeInput));
  return {
    promoQrCodeDataUrl,
    promoUrl: ANNUAL_SHARE_CARD_PROMO_URL,
    summary: {
      ...enriched,
      profileCard: {
        ...(enriched.profileCard || {}),
        myDonUrl: `/api/internal/annual-share-cards/${encodeURIComponent(summaryId)}/my-don?token=${encodeURIComponent(String(tokenInput))}`
      }
    }
  };
};

// Shared MyDon resolution order: stored snapshot first, then the owner's live MyDon
// rendered server-side (never the browser owner session). Used by the internal
// share-card renderer and by the operator-gated admin preview.
const resolveSummaryMyDon = async (row: AnnualSummaryRow, summaryId: string) => {
  const snapshot = getSummaryMyDonPath(row);
  if (await access(snapshot).then(() => true).catch(() => false)) {
    return { kind: "snapshot" as const, path: snapshot };
  }
  const buffer = await getMyDonImageBuffer(row.user_id).catch((error) => {
    console.warn("[annual-summary] live MyDon unavailable", summaryId, (error as { statusMessage?: string })?.statusMessage || error);
    return null;
  });
  if (!buffer) throw createError({ statusCode: 404, statusMessage: "小咚形象不可用" });
  return { kind: "live" as const, buffer };
};

export const getInternalAnnualShareCardMyDon = async (summaryId: string, tokenInput: unknown) => {
  if (!verifyAnnualShareCardRenderToken(tokenInput, summaryId)) {
    throw createError({ statusCode: 403, statusMessage: "分享图片渲染凭据无效" });
  }
  if (summaryId.startsWith("bot_")) {
    return { kind: "snapshot" as const, path: botAnnualPaths(summaryId).myDon };
  }
  const row = await findAnnualSummaryById(summaryId);
  if (!row) throw createError({ statusCode: 404, statusMessage: "年度总结不存在" });
  return await resolveSummaryMyDon(row, summaryId);
};

export const getAdminAnnualMyDon = async (summaryId: string) => {
  const row = await findAnnualSummaryById(summaryId);
  if (!row) throw createError({ statusCode: 404, statusMessage: "年度总结不存在" });
  return await resolveSummaryMyDon(row, summaryId);
};

export const getAdminAnnualEvents = async (
  summaryId: string,
  query: { page?: unknown; pageSize?: unknown; type?: unknown }
) => {
  const row = await findAnnualSummaryById(summaryId);
  if (!row) throw createError({ statusCode: 404, statusMessage: "年度总结不存在" });
  const allEvents = await readAnnualEvents(row.events_path).catch(() => {
    throw createError({ statusCode: 410, statusMessage: "事件缓存已失效" });
  });
  const type = String(query.type || "").trim();
  const filtered = type ? allEvents.filter((event) => event.type === type) : allEvents;
  const pageSize = Math.max(1, Math.min(ANNUAL_MAX_EVENT_PAGE_SIZE, Math.floor(Number(query.pageSize) || 50)));
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const offset = (page - 1) * pageSize;
  return {
    summaryId: row.id,
    schemaVersion: row.schema_version,
    mode: row.data_mode,
    total: filtered.length,
    page,
    pageSize,
    events: filtered.slice(offset, offset + pageSize).map((event) => toAdminAnnualEvent(event))
  };
};

export const getAdminAnnualSummaries = async (targetInput: unknown) => {
  const target = String(targetInput || "").trim();
  if (!target) throw createError({ statusCode: 400, statusMessage: "请输入用户 ID 或昵称" });
  const rows = await listAnnualSummariesForAdmin(target);
  const items = await Promise.all(rows.map(async (row) => {
    const summary = await safeReadSummary(row);
    const nickname = String((summary?.profileCard as { nickname?: unknown } | undefined)?.nickname || "").trim();
    if (![row.username, row.taiko_id, nickname].some((value) => String(value || "").toLowerCase().includes(target.toLowerCase()))) return null;
    return { id: row.id, username: row.username, taikoId: row.taiko_id, nickname, versionKey: row.version_key, generatedAt: new Date(row.generated_at).toISOString(), dataMode: row.data_mode };
  }));
  return items.filter(Boolean);
};

export const getAdminAnnualTargets = async (targetInput: unknown) => {
  const target = String(targetInput || "").trim();
  if (target.length < 1) throw createError({ statusCode: 400, statusMessage: "请输入用户 ID、昵称或用户名" });
  const rows = await listAnnualBindingsForAdmin();
  const byTaikoId = new Map(rows.map((row) => [String(row.taiko_id), row]));
  const files = await readdir(getRuntimePaths().userdataDir, { withFileTypes: true }).catch(() => []);
  const taikoIds = new Set<string>();
  for (const entry of files) {
    if (entry.isFile() && entry.name.endsWith("data.json") && !entry.name.startsWith("data_")) taikoIds.add(entry.name.slice(0, -"data.json".length));
  }
  const items = await Promise.all([...taikoIds].map(async (taikoId) => {
    const row = byTaikoId.get(taikoId);
    let nickname = "";
    try { const userdata = await readUserdata(taikoId); const profile = userdata.profile as Record<string, unknown> | undefined; const costume = profile?.gameCostume as Record<string, unknown> | undefined; nickname = String(profile?.mydon_name || costume?.mydon_name || "").trim(); } catch { /* malformed or concurrently removed data */ }
    const haystack = [taikoId, row?.username || "", nickname].join(" ").toLowerCase();
    if (!haystack.includes(target.toLowerCase())) return null;
    const summary = row
      ? await findLatestAnnualSummary(row.user_id, row.id, ANNUAL_VERSION_KEY)
      : null;
    return {
      userId: row?.user_id ?? null,
      bindingId: row?.id ?? null,
      taikoId,
      username: row?.username || "",
      nickname,
      hasViewerAccount: Boolean(row),
      summaryId: summary?.id || null,
      summaryGeneratedAt: summary ? new Date(summary.generated_at).toISOString() : null
    };
  }));
  return items.filter(Boolean);
};

export const queueAdminAnnualSummaryBuild = async (userId: number, versionInput: unknown, options: { locale?: unknown; force?: boolean } = {}) => {
  const version = resolveAnnualVersion(versionInput);
  if (!version) throw createError({ statusCode: 404, statusMessage: "年度总结版本不存在" });
  const binding = await requireCurrentAnnualBinding(userId);
  if (options.force) {
    await assertAnnualTaskAllowed('generation');
    const existing = await findLatestAnnualSummary(userId, binding.id, version.key);
    if (existing) { await deleteAnnualSummaryForAdmin(existing.id); await removeAnnualPath(dirname(existing.summary_path)).catch(() => undefined); }
  }
  return queueAccountAnnualSummaryBuild(userId, version.key, { ...options, bindingId: binding.id, retryFailed: options.force });
};

export const queueAdminAnnualSummaryBuildForBinding = async (userId: number, bindingId: number, versionInput: unknown, options: { locale?: unknown; force?: boolean } = {}) => {
  const version = resolveAnnualVersion(versionInput);
  if (!version) throw createError({ statusCode: 404, statusMessage: "年度总结版本不存在" });
  const binding = await findAnnualBinding(bindingId, userId);
  if (!binding) throw createError({ statusCode: 404, statusMessage: "目标绑定不存在" });
  if (options.force) {
    await assertAnnualTaskAllowed('generation');
    const existing = await findLatestAnnualSummary(userId, binding.id, version.key);
    if (existing) { await deleteAnnualSummaryForAdmin(existing.id); await removeAnnualPath(dirname(existing.summary_path)).catch(() => undefined); }
  }
  return queueAccountAnnualSummaryBuild(userId, version.key, { ...options, bindingId, retryFailed: options.force });
};

export const buildAdminAnnualPreview = async (taikoIdInput: unknown) => {
  await assertAnnualTaskAllowed('generation');
  const taikoId = String(taikoIdInput || "").trim();
  if (!/^\d+$/.test(taikoId)) throw createError({ statusCode: 400, statusMessage: "目标鼓众 ID 无效" });
  const envelope = await runAnnualSummaryCli(taikoId);
  const summary = await enrichAnnualRatingRank({ ...envelope.summary, schemaVersion: ANNUAL_SCHEMA_VERSION, version: getAnnualVersion() });
  return { summary, generatedFor: taikoId, persisted: false };
};

export const getAdminAnnualSummaryById = async (summaryId: string, localeInput?: unknown) => {
  const row = await findAnnualSummaryById(summaryId);
  if (!row) throw createError({ statusCode: 404, statusMessage: "年度总结不存在" });
  const summary = await safeReadSummary(row);
  if (!summary) throw createError({ statusCode: 410, statusMessage: "年度总结文件不可用" });
  return withAdminAssets(summary, normalizeAnnualLocale(localeInput));
};

export const getAdminAnnualJob = async (jobId: string, localeInput?: unknown) => {
  const job = await findAnnualJobById(String(jobId || ""));
  if (!job || job.job_type !== "build") throw createError({ statusCode: 404, statusMessage: "任务不存在" });
  const response: Record<string, unknown> = { job: serializeAnnualJob(job) };
  if (job.status === "completed" && job.summary_id) {
    const row = await findAnnualSummaryById(job.summary_id);
    const summary = await safeReadSummary(row);
    if (summary) response.summary = await withAdminAssets(summary, normalizeAnnualLocale(localeInput));
  }
  return response;
};

export const removeAdminAnnualSummary = async (summaryId: string) => {
  const row = await findAnnualSummaryById(summaryId);
  if (!row) throw createError({ statusCode: 404, statusMessage: "年度总结不存在" });
  const deleted = await deleteAnnualSummaryForAdmin(summaryId);
  if (deleted) await removeAnnualPath(dirname(row.summary_path)).catch(() => undefined);
  return { deleted };
};

export const readAnnualImage = (filePath: string) => readFile(filePath);

export const getReusableBotAnnualSummary = async (taikoId: string) => {
  const [rows] = await getAccountDb().execute<DbRow<AnnualSummaryRow>[]>(
    `SELECT s.* FROM web_annual_summaries s JOIN web_taiko_bindings b ON b.id=s.binding_id
     WHERE b.taiko_id=? AND s.version_key=? ORDER BY s.created_at DESC LIMIT 1`, [taikoId, ANNUAL_VERSION_KEY]);
  const row = rows[0];
  const summary = await safeReadSummary(row || null);
  if (!row || !summary) return null;
  const policy = await readAnnualPolicy();
  const imports = await annualImportState(getRuntimePaths().userdataDir, taikoId);
  if (policy.refreshImports && annualImportNeedsRefresh(summary, imports)) return null;
  return { row, summary };
};

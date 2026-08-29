import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { H3Event } from "h3";
import { createError, getRequestIP } from "h3";
import type { AnnualLocale, AnnualShareRow, AnnualSummaryV4 } from "./types";
import { createMemoryRateLimiter } from "~/server/utils/rate-limit";

const SHARE_TOKEN_CONTEXT = "taiko-annual-share-v1";
const RENDER_TOKEN_CONTEXT = "taiko-annual-render-v1";
const PUBLIC_RATE_WINDOW_MS = 60 * 1000;
const PUBLIC_RATE_LIMIT = 120;
const PUBLIC_RATE_MAX_BUCKETS = 5000;

const enforceAnnualPublicRequestRate = createMemoryRateLimiter({
  windowMs: PUBLIC_RATE_WINDOW_MS,
  limit: PUBLIC_RATE_LIMIT,
  maxBuckets: PUBLIC_RATE_MAX_BUCKETS,
  message: "请求过于频繁，请稍后重试"
});

const requireSecret = (name: "share" | "render") => {
  const runtimeConfig = useRuntimeConfig();
  const value = String(
    name === "share"
      ? runtimeConfig.annualShareSecret || process.env.TAIKO_ANNUAL_SHARE_SECRET || ""
      : runtimeConfig.annualRenderSecret || process.env.TAIKO_ANNUAL_RENDER_SECRET || ""
  );
  if (Buffer.byteLength(value, "utf-8") < 32) {
    throw createError({ statusCode: 503, statusMessage: "年度总结分享服务尚未配置" });
  }
  return value;
};

const sign = (secret: string, context: string, payload: string) =>
  createHmac("sha256", secret).update(`${context}\0${payload}`).digest("base64url");

const safeEqualText = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

export const hashAnnualToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const createAnnualShareToken = (shareId: string, summaryId: string) => {
  const signature = sign(requireSecret("share"), SHARE_TOKEN_CONTEXT, `${shareId}:${summaryId}`);
  return `${shareId}.${signature}`;
};

export const parseAndVerifyAnnualShareToken = (tokenInput: unknown, row: AnnualShareRow) => {
  const token = String(tokenInput || "").trim();
  const separator = token.indexOf(".");
  if (separator <= 0) return false;
  const shareId = token.slice(0, separator);
  const providedSignature = token.slice(separator + 1);
  if (shareId !== row.id || !providedSignature) return false;
  const expectedSignature = sign(requireSecret("share"), SHARE_TOKEN_CONTEXT, `${row.id}:${row.summary_id}`);
  return safeEqualText(providedSignature, expectedSignature) && safeEqualText(hashAnnualToken(token), row.token_hash);
};

export const createAnnualRenderToken = (summaryId: string, posterId: string, shareId: string, expiresAt: number) => {
  const payload = `${summaryId}:${posterId}:${shareId}:${expiresAt}`;
  return `${expiresAt}.${posterId}.${shareId}.${sign(requireSecret("render"), RENDER_TOKEN_CONTEXT, payload)}`;
};

export const verifyAnnualRenderToken = (tokenInput: unknown, summaryId: string) => {
  const token = String(tokenInput || "").trim();
  const [expiresRaw, posterId, shareId, providedSignature, extra] = token.split(".");
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now() || expiresAt > Date.now() + 5 * 60 * 1000) return null;
  if (!posterId || !shareId || !providedSignature || extra) return null;
  const expected = sign(requireSecret("render"), RENDER_TOKEN_CONTEXT, `${summaryId}:${posterId}:${shareId}:${expiresAt}`);
  return safeEqualText(providedSignature, expected) ? { posterId, shareId, expiresAt } : null;
};

export const getAnnualPublicBaseUrl = () => {
  const runtimeConfig = useRuntimeConfig();
  return String(runtimeConfig.annualPublicBaseUrl || process.env.TAIKO_ANNUAL_PUBLIC_BASE_URL || "https://viewer.sakura-bot.cn")
    .trim()
    .replace(/\/+$/, "");
};

export const buildAnnualShareUrl = (token: string, locale?: AnnualLocale) => {
  const prefix = locale === "ja" ? "/ja" : "";
  return `${getAnnualPublicBaseUrl()}${prefix}/annual/share/${encodeURIComponent(token)}`;
};

export const buildAnnualPosterPublicUrl = (token: string, locale?: AnnualLocale) =>
  `${getAnnualPublicBaseUrl()}/api/annual/shares/${encodeURIComponent(token)}/poster${locale ? `?locale=${locale}` : ""}`;

export const enforceAnnualPublicRateLimit = (event: H3Event) => {
  const address = getRequestIP(event, { xForwardedFor: true }) || "unknown";
  enforceAnnualPublicRequestRate(event, address);
};

const PRIVATE_KEYS = new Set([
  "taikoid",
  "summaryid",
  "userid",
  "bindingid",
  "sourceaccount",
  "sourceref",
  "snapshotref",
  "snapshotpath",
  "sourcesnapshotrange",
  "inputfingerprint",
  "inputfiles",
  "warnings",
  "internalwarnings",
  "debug"
]);

const scrubPublicValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(scrubPublicValue);
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.replace(/[_-]/g, "").toLowerCase();
    if (PRIVATE_KEYS.has(normalized)) continue;
    if (/^(?:absolute)?(?:file)?path$/i.test(key)) continue;
    output[key] = scrubPublicValue(child);
  }
  return output;
};

const resolvePublicRankTier = (section: Record<string, unknown>) => {
  const direct = String(section.tier || (section.data as Record<string, unknown> | undefined)?.tier || "").trim();
  if (["top1", "top5", "top20", "top50", "growing"].includes(direct)) return direct;
  const data = (section.data && typeof section.data === "object" ? section.data : section) as Record<string, unknown>;
  const rank = Number(data.rank || 0);
  const sampleSize = Number(data.sampleSize || 0);
  if (rank > 0 && sampleSize >= rank) {
    const topPercent = (rank / sampleSize) * 100;
    if (topPercent <= 1) return "top1";
    if (topPercent <= 5) return "top5";
    if (topPercent <= 20) return "top20";
    if (topPercent <= 50) return "top50";
  }
  return "growing";
};

export const toPublicAnnualSummary = (summary: AnnualSummaryV4) => {
  const scrubbed = scrubPublicValue(summary) as Record<string, unknown>;
  delete scrubbed.summaryId;
  const profileCard = (scrubbed.profileCard || {}) as Record<string, unknown>;
  for (const key of ["id", "playerId", "accountId", "userCode"]) delete profileCard[key];
  scrubbed.profileCard = profileCard;
  const sections = (scrubbed.sections || {}) as Record<string, Record<string, unknown>>;
  const rank = sections.ratingRank;
  if (rank && rank.status !== "unavailable") {
    sections.ratingRank = {
      status: rank.status,
      data: { tier: resolvePublicRankTier(rank) }
    };
  }
  return scrubbed;
};

export const toAdminAnnualEvent = (event: Record<string, unknown>) => {
  const sourceRef = event.sourceRef;
  const warnings = Array.isArray(event.warnings) ? event.warnings.map((item) => String(item).slice(0, 200)) : [];
  const scrubbed = scrubPublicValue({ ...event, sourceRef: undefined }) as Record<string, unknown>;
  scrubbed.warnings = warnings;
  if (sourceRef != null) {
    scrubbed.sourceTrace = createHash("sha256").update(JSON.stringify(sourceRef)).digest("hex").slice(0, 16);
  }
  return scrubbed;
};

export const normalizeAnnualLocale = (input: unknown): AnnualLocale => (String(input || "").toLowerCase().startsWith("ja") ? "ja" : "zh");

export const assertAnnualSecurityConfiguration = () => {
  if (process.env.NODE_ENV !== "production") return;
  requireSecret("share");
  requireSecret("render");
};

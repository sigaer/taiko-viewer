import QRCode from "qrcode";
import { ensureWithinAnnualCache } from "./runtime";
import { access } from "node:fs/promises";
import { annualAdmission, AdmissionError } from "./admission";
import { spawnAnnualWorker } from "./isolated-worker";
import { createError } from "h3";
import {
  ANNUAL_POSTER_HEIGHT,
  ANNUAL_POSTER_TIMEOUT_MS,
  ANNUAL_POSTER_WIDTH,
  ANNUAL_SHARE_CARD_HEIGHT,
  ANNUAL_SHARE_CARD_RENDERER_REVISION,
  ANNUAL_SHARE_CARD_WIDTH
} from "./constants";
import { createAnnualRenderToken, createAnnualShareCardRenderToken } from "./security";
import type { AnnualLocale } from "./types";

const safePosterError = (error: unknown) => {
  const name = error && typeof error === "object" && "name" in error ? String(error.name || "Error") : "Error";
  const message = error && typeof error === "object" && "message" in error
    ? String(error.message || "")
    : String(error || "");
  return `${name}: ${message}`
    .replace(/([?&]renderToken=)[^&\s"']+/gi, "$1<redacted>")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 800);
};

const getPosterRuntime = () => {
  const runtimeConfig = useRuntimeConfig();
  return {
    chromiumPath: String(
      runtimeConfig.annualChromiumPath || process.env.TAIKO_ANNUAL_CHROMIUM_PATH || "/usr/bin/chromium"
    ),
    internalBaseUrl: String(
      runtimeConfig.annualInternalBaseUrl ||
        process.env.TAIKO_ANNUAL_INTERNAL_BASE_URL ||
        "http://127.0.0.1:3100"
    ).replace(/\/+$/, "")
  };
};

export const createAnnualQrCodeDataUrl = async (url: string) => {
  try {
    return await QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 320,
      color: { dark: "#17365D", light: "#F7FBFF" }
    });
  } catch (error) {
    console.warn("[annual-summary] failed to generate QR code", error);
    return null;
  }
};

const screenshotAnnualPage = async (input: {
  url: URL;
  locale: AnnualLocale;
  width: number;
  height: number;
  readyFlag: string;
  outputPath: string;
  failureMessage: string;
  admissionId: string;
}) => {
  const runtime = getPosterRuntime();
  const started = Date.now();
  try {
    const child = await spawnAnnualWorker('renderer', input.admissionId, {
      ...input, url: input.url.toString(), chromiumPath: runtime.chromiumPath, timeoutMs: ANNUAL_POSTER_TIMEOUT_MS
    }, ANNUAL_POSTER_TIMEOUT_MS + 5_000);
    let diagnostics = '';
    await new Promise<void>((resolveRun, rejectRun) => {
      child.stdout.on('data', chunk => { if (diagnostics.length < 4096) diagnostics += String(chunk).slice(0, 4096 - diagnostics.length); });
      child.stderr.resume();
      child.on('error', rejectRun);
      child.on('close', code => code === 0 ? resolveRun() : rejectRun(Date.now() - started >= ANNUAL_POSTER_TIMEOUT_MS - 1000 ? new AdmissionError('ANNUAL_RUN_TIMEOUT') : new Error('isolated renderer failed')));
    });
    try {
      const result = JSON.parse(diagnostics);
      console.info('[annual-render]', JSON.stringify({ id: input.admissionId, width: input.width, height: input.height, images: result.assets?.images, broken: result.assets?.broken, fonts: result.assets?.fonts }));
    } catch { /* Diagnostics never change the existing capture contract. */ }
    return { width: input.width, height: input.height };
  } catch (error) {
    if (error instanceof AdmissionError) throw error;
    console.error('[annual-summary] render failed', input.readyFlag, safePosterError(error));
    throw createError({ statusCode: 500, statusMessage: input.failureMessage });
  }
};

const renderOnce = async (key: string, outputPath: string, width: number, height: number, render: (id: string) => Promise<{width: number; height: number}>, options?: { ticket?: string; onRunning?: () => Promise<void> }) => {
  ensureWithinAnnualCache(outputPath);
  if (await access(outputPath).then(() => true, () => false)) {
    await options?.onRunning?.();
    if (options?.ticket) await annualAdmission.cancel('renderer', options.ticket);
    return { width, height };
  }
  return annualAdmission.run('renderer', key, ANNUAL_POSTER_TIMEOUT_MS + 5_000, async id => {
    if (await access(outputPath).then(() => true, () => false)) return { width, height };
    return render(id);
  }, options);
};

export const renderAnnualPoster = async (input: {
  summaryId: string;
  posterId: string;
  shareId: string;
  locale: AnnualLocale;
  outputPath: string;
  admissionTicket?: string;
  onRunning?: () => Promise<void>;
}) => renderOnce(`legacy:${input.summaryId}:${input.locale}:${input.outputPath}`, input.outputPath, ANNUAL_POSTER_WIDTH, ANNUAL_POSTER_HEIGHT, async admissionId => {
  const runtime = getPosterRuntime();
  const expiresAt = Date.now() + Math.min(ANNUAL_POSTER_TIMEOUT_MS + 30_000, 2 * 60 * 1000);
  const renderToken = createAnnualRenderToken(input.summaryId, input.posterId, input.shareId, expiresAt);
  const localePrefix = input.locale === "ja" ? "/ja" : "";
  const url = new URL(`${localePrefix}/account/annual-poster/${encodeURIComponent(input.summaryId)}`, runtime.internalBaseUrl);
  url.searchParams.set("locale", input.locale);
  url.searchParams.set("renderToken", renderToken);

  return await screenshotAnnualPage({
    admissionId,
    url,
    locale: input.locale,
    width: ANNUAL_POSTER_WIDTH,
    height: ANNUAL_POSTER_HEIGHT,
    readyFlag: "__ANNUAL_POSTER_READY__",
    outputPath: input.outputPath,
    failureMessage: "年度总结海报生成失败，请稍后重试"
  });
}, { ticket: input.admissionTicket, onRunning: input.onRunning });

export const renderAnnualShareCard = async (input: {
  summaryId: string;
  locale: AnnualLocale;
  outputPath: string;
}) => renderOnce(`${ANNUAL_SHARE_CARD_RENDERER_REVISION}:${input.summaryId}:${input.locale}:${input.outputPath}`, input.outputPath, ANNUAL_SHARE_CARD_WIDTH, ANNUAL_SHARE_CARD_HEIGHT, async admissionId => {
  const runtime = getPosterRuntime();
  const expiresAt = Date.now() + Math.min(ANNUAL_POSTER_TIMEOUT_MS + 30_000, 2 * 60 * 1000);
  const renderToken = createAnnualShareCardRenderToken(input.summaryId, expiresAt);
  const localePrefix = input.locale === "ja" ? "/ja" : "";
  const url = new URL(`${localePrefix}/account/annual-share-card/${encodeURIComponent(input.summaryId)}`, runtime.internalBaseUrl);
  url.searchParams.set("locale", input.locale);
  url.searchParams.set("renderToken", renderToken);

  return await screenshotAnnualPage({
    admissionId,
    url,
    locale: input.locale,
    width: ANNUAL_SHARE_CARD_WIDTH,
    height: ANNUAL_SHARE_CARD_HEIGHT,
    readyFlag: "__ANNUAL_SHARE_CARD_READY__",
    outputPath: input.outputPath,
    failureMessage: "年度分享图片生成失败，请稍后重试"
  });
});

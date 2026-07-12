import QRCode from "qrcode";
import { chromium } from "playwright-core";
import { createError } from "h3";
import {
  ANNUAL_POSTER_HEIGHT,
  ANNUAL_POSTER_TIMEOUT_MS,
  ANNUAL_POSTER_WIDTH
} from "./constants";
import { atomicWriteFile } from "./runtime";
import { createAnnualRenderToken } from "./security";
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

export const renderAnnualPoster = async (input: {
  summaryId: string;
  posterId: string;
  shareId: string;
  locale: AnnualLocale;
  outputPath: string;
}) => {
  const runtime = getPosterRuntime();
  const expiresAt = Date.now() + Math.min(ANNUAL_POSTER_TIMEOUT_MS + 30_000, 2 * 60 * 1000);
  const renderToken = createAnnualRenderToken(input.summaryId, input.posterId, input.shareId, expiresAt);
  const localePrefix = input.locale === "ja" ? "/ja" : "";
  const url = new URL(`${localePrefix}/account/annual-poster/${encodeURIComponent(input.summaryId)}`, runtime.internalBaseUrl);
  url.searchParams.set("locale", input.locale);
  url.searchParams.set("renderToken", renderToken);

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  try {
    browser = await chromium.launch({
      executablePath: runtime.chromiumPath,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--font-render-hinting=none"]
    });
    const context = await browser.newContext({
      viewport: { width: ANNUAL_POSTER_WIDTH, height: ANNUAL_POSTER_HEIGHT },
      deviceScaleFactor: 1,
      locale: input.locale === "ja" ? "ja-JP" : "zh-CN",
      timezoneId: "Asia/Shanghai",
      reducedMotion: "reduce"
    });
    const page = await context.newPage();
    page.setDefaultTimeout(ANNUAL_POSTER_TIMEOUT_MS);
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: ANNUAL_POSTER_TIMEOUT_MS });
    await page.waitForFunction(
      () => (window as typeof window & { __ANNUAL_POSTER_READY__?: boolean }).__ANNUAL_POSTER_READY__ === true,
      undefined,
      { timeout: ANNUAL_POSTER_TIMEOUT_MS }
    );
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images).map((image) =>
          image.complete ? Promise.resolve() : image.decode().catch(() => undefined)
        )
      );
    });
    const buffer = await page.screenshot({
      type: "png",
      animations: "disabled",
      caret: "hide",
      clip: { x: 0, y: 0, width: ANNUAL_POSTER_WIDTH, height: ANNUAL_POSTER_HEIGHT }
    });
    await atomicWriteFile(input.outputPath, buffer);
    await context.close();
    return { width: ANNUAL_POSTER_WIDTH, height: ANNUAL_POSTER_HEIGHT };
  } catch (error) {
    console.error("[annual-summary] poster rendering failed", safePosterError(error));
    throw createError({ statusCode: 500, statusMessage: "年度总结海报生成失败，请稍后重试" });
  } finally {
    await browser?.close().catch(() => undefined);
  }
};

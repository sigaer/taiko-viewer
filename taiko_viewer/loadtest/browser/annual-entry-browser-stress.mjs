import { chromium, devices } from "playwright-core";

const base = (process.env.BASE || "http://127.0.0.1:3100").replace(/\/$/, "");
const concurrency = Math.min(2, Math.max(1, Number(process.env.CONCURRENCY || 1)));
const cookie = String(process.env.COOKIE || "").trim();
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined;
const viewports = [[390, 844], [414, 896], [430, 932]];

async function run(worker) {
  const browser = await chromium.launch({ executablePath });
  const results = [];
  for (const [width, height] of viewports) {
    const context = await browser.newContext({ ...devices["iPhone 12"], viewport: { width, height }, extraHTTPHeaders: cookie ? { Cookie: cookie } : {} });
    const page = await context.newPage();
    const started = Date.now();
    const resources = new Map();
    const errors = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("requestfailed", (request) => errors.push(`requestfailed: ${request.url()}`));
    page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
    page.on("response", async (response) => {
      const request = response.request();
      if (request.resourceType() === "image" && response.status() === 404) errors.push(`image 404: ${response.url()}`);
      if (response.status() >= 500) errors.push(`5xx: ${response.status()} ${response.url()}`);
      const headers = response.headers();
      const length = Number(headers["content-length"] || 0);
      resources.set(response.url(), { status: response.status(), type: request.resourceType(), bytes: length, cache: headers["cache-control"] || "" });
    });
    const homepage = await page.goto(`${base}/`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const firstPaint = Date.now() - started;
    await page.goto(`${base}/account/version-summary`, { waitUntil: "networkidle", timeout: 30_000 }).catch((error) => errors.push(`navigation: ${error.message}`));
    const networkIdle = Date.now() - started;
    results.push({ worker, viewport: `${width}x${height}`, firstPaintMs: firstPaint, networkIdleMs: networkIdle, homepageStatus: homepage?.status() || 0, resources: resources.size, images: [...resources.values()].filter((item) => item.type === "image").length, bytes: [...resources.values()].reduce((sum, item) => sum + item.bytes, 0), noStore: [...resources.values()].filter((item) => /no-store/i.test(item.cache)).length, errors });
    await context.close();
  }
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
  if (results.some((result) => result.errors.length)) throw new Error(`worker ${worker} observed browser errors`);
}

await Promise.all(Array.from({ length: concurrency }, (_, index) => run(index + 1)));

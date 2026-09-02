import { chromium, devices } from "playwright";

const base = (process.env.BASE || "http://127.0.0.1:3100").replace(/\/$/, "");
const concurrency = Number(process.env.CONCURRENCY || 2);
const rounds = Number(process.env.ROUNDS || 10);
const token = process.env.TOKEN || "";
if (!token) throw new Error("TOKEN is required (use a token from loadtest/tokens.txt)");
const target = `${base}/annual/share/${encodeURIComponent(token)}/`;
const mobile = { ...devices["iPhone 12"], viewport: { width: 414, height: 896 }, isMobile: true };

async function run(worker) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...mobile, reducedMotion: process.env.REDUCED_MOTION === "1" ? "reduce" : "no-preference" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => errors.push(`requestfailed: ${request.url()} (${request.failure()?.errorText || "unknown"})`));
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  await page.goto(target, { waitUntil: "networkidle" });
  for (let index = 0; index < rounds; index += 1) {
    await page.keyboard.press(index % 2 ? "ArrowLeft" : "ArrowRight");
    await page.waitForTimeout(Number(process.env.PAUSE_MS || 250));
  }
  console.log(JSON.stringify({ worker, rounds, errors }, null, 2));
  await browser.close();
  if (errors.length) throw new Error(`worker ${worker} observed ${errors.length} browser errors`);
}

await Promise.all(Array.from({ length: concurrency }, (_, index) => run(index + 1)));

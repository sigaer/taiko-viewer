import http from "k6/http";
import { check } from "k6";
import { Rate, Trend } from "k6/metrics";

const base = (__ENV.BASE || "http://127.0.0.1:3100").replace(/\/$/, "");
const defaults = [
  "/_nuxt/", "/monthly/monthly.png", "/weekday/038_key.png", "/lateNight/", "/favoriteShift/cover_bg_7.png",
  "/obsession/", "/annual/", "/assets/cover/", "/Calendar.png", "/Overview.png", "/2026_autumn.png",
];
const assets = (__ENV.ASSETS ? __ENV.ASSETS.split(",") : defaults).map((v) => v.trim()).filter(Boolean);
export const options = { vus: Number(__ENV.VUS || 5), duration: __ENV.DURATION || "30s" };
const duration = new Trend("static_asset_duration");
const failures = new Rate("static_asset_failures");

export default function () {
  const path = assets[(__VU - 1 + __ITER) % assets.length];
  const response = http.get(`${base}${path}`, { tags: { asset: path } });
  duration.add(response.timings.duration, { asset: path });
  failures.add(response.status >= 400, { asset: path });
  check(response, { "asset status < 400": (value) => value.status >= 200 && value.status < 400 });
}

export function handleSummary(data) {
  const values = data.metrics.static_asset_duration?.values || {};
  return { stdout: `static assets p95=${(values["p(95)"] || 0).toFixed(1)}ms p99=${(values["p(99)"] || 0).toFixed(1)}ms\nfailed rate=${((data.metrics.static_asset_failures?.values?.rate || 0) * 100).toFixed(2)}%\n` };
}

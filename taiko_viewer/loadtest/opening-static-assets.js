import http from "k6/http";
import { check } from "k6";
import { Counter, Trend } from "k6/metrics";

const base = (__ENV.BASE || "http://127.0.0.1:3100").replace(/\/$/, "");
const assets = (__ENV.ASSETS || [
  "/_nuxt/Cnx4mmAK.js",
  "/_nuxt/index.pyZ7quO9.css",
  "/_nuxt/arG6RtbU.js",
  "/optimized/logo-168.webp",
  "/optimized/2026-autumn-800.webp",
  "/optimized/nijiiro-2026-640.webp",
  "/kantan.png",
  "/futsuu.png",
  "/muzukashii.png",
  "/oni.png"
].join(",")).split(",").map((value) => value.trim()).filter(Boolean);
export const options = { vus: Number(__ENV.VUS || 3), duration: __ENV.DURATION || "30s" };
const duration = new Trend("opening_asset_duration");
const size = new Trend("opening_asset_bytes");
const statuses = new Counter("opening_asset_status");
const notFound = new Counter("opening_asset_404");

export default function () {
  const path = assets[(__VU - 1 + __ITER) % assets.length];
  const response = http.get(`${base}${path}`, { tags: { asset: path } });
  duration.add(response.timings.duration, { asset: path });
  size.add(Number(response.headers["Content-Length"] || response.body?.byteLength || 0), { asset: path });
  statuses.add(1, { asset: path, status: String(response.status) });
  if (response.status === 404) notFound.add(1, { asset: path });
  check(response, { "asset is not 404/5xx": (value) => value.status >= 200 && value.status < 400 });
}

export function handleSummary(data) {
  const values = data.metrics.opening_asset_duration?.values || {};
  return { stdout: `opening assets p95=${(values["p(95)"] || 0).toFixed(1)}ms p99=${(values["p(99)"] || 0).toFixed(1)}ms\n404=${data.metrics.opening_asset_404?.values?.count || 0}\nper-asset status/size metrics are tagged opening_asset_status{asset,status} and opening_asset_bytes{asset}; inspect response Cache-Control headers during browser capture\n` };
}

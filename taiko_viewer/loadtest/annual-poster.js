import http from "k6/http";
import { check } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const base = (__ENV.BASE || "http://127.0.0.1:3100").replace(/\/$/, "");
const tokens = open("tokens.txt").split(/\r?\n/).map((v) => v.trim()).filter((v) => v && !v.startsWith("#"));
if (!tokens.length) throw new Error("loadtest/tokens.txt has no usable tokens");

export const options = { vus: Number(__ENV.VUS || 3), duration: __ENV.DURATION || "30s" };
const duration = new Trend("annual_poster_duration");
const bytes = new Trend("annual_poster_bytes");
const errors = new Rate("annual_poster_errors");
const statuses = new Counter("annual_poster_status");
const status200 = new Counter("annual_poster_status_200");
const status429 = new Counter("annual_poster_status_429");
const status5xx = new Counter("annual_poster_status_5xx");

export default function () {
  const token = tokens[(__VU - 1 + __ITER) % tokens.length];
  const response = http.get(`${base}/api/annual/shares/${encodeURIComponent(token)}/poster?locale=zh`);
  const status = String(response.status);
  statuses.add(1, { status });
  if (response.status === 200) status200.add(1);
  if (response.status === 429) status429.add(1);
  if (response.status >= 500 && response.status < 600) status5xx.add(1);
  duration.add(response.timings.duration);
  bytes.add(response.body ? response.body.byteLength : 0);
  errors.add(response.status >= 400);
  check(response, {
    "poster is 200": (value) => value.status === 200,
    "poster Content-Type is image/png": (value) => (value.headers["Content-Type"] || "").toLowerCase().split(";")[0] === "image/png",
  });
}

export function handleSummary(data) {
  const values = data.metrics.annual_poster_duration?.values || {};
  return { stdout: `poster p95=${(values["p(95)"] || 0).toFixed(1)}ms p99=${(values["p(99)"] || 0).toFixed(1)}ms\nerror rate=${((data.metrics.annual_poster_errors?.values?.rate || 0) * 100).toFixed(2)}%\ntransfer bytes p95=${(data.metrics.annual_poster_bytes?.values?.["p(95)"] || 0).toFixed(0)}\nstatus counts: 200=${data.metrics.annual_poster_status_200?.values?.count || 0} 429=${data.metrics.annual_poster_status_429?.values?.count || 0} 5xx=${data.metrics.annual_poster_status_5xx?.values?.count || 0}\n429 may be rate limiting, not a server fault\n` };
}

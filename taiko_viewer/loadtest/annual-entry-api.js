import http from "k6/http";
import { check } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const base = (__ENV.BASE || "http://127.0.0.1:3100").replace(/\/$/, "");
const cookie = String(__ENV.COOKIE || "").trim();
export const options = { vus: Number(__ENV.VUS || 3), duration: __ENV.DURATION || "30s" };
const duration = new Trend("entry_duration");
const failures = new Rate("entry_failures");
const statuses = new Counter("entry_status");
const statusCounters = Object.fromEntries([200, 302, 401, 403, 404, 429].map((status) => [status, new Counter(`entry_status_${status}`)]));
const status5xx = new Counter("entry_status_5xx");
const paths = ["/", "/account/version-summary", "/api/account/auth/me", "/api/account/annual-summaries/annual_2026"];

export default function () {
  for (const path of paths) {
    const response = http.get(`${base}${path}`, { headers: cookie ? { Cookie: cookie } : {}, tags: { path } });
    const status = response.status;
    duration.add(response.timings.duration, { path });
    statuses.add(1, { path, status: String(status) });
    if (statusCounters[status]) statusCounters[status].add(1, { path });
    if (status >= 500 && status < 600) status5xx.add(1, { path });
    failures.add(status >= 400, { path });
    check(response, { [`${path} status is expected`]: (value) => [200, 302, 401, 403, 404, 429].includes(value.status) || (value.status >= 500 && value.status < 600) });
  }
}

export function handleSummary(data) {
  const values = data.metrics.entry_duration?.values || {};
  return { stdout: `entry p95=${(values["p(95)"] || 0).toFixed(1)}ms p99=${(values["p(99)"] || 0).toFixed(1)}ms\nerror rate=${((data.metrics.entry_failures?.values?.rate || 0) * 100).toFixed(2)}%\nstatus: 200=${data.metrics.entry_status_200?.values?.count || 0} 302=${data.metrics.entry_status_302?.values?.count || 0} 401=${data.metrics.entry_status_401?.values?.count || 0} 403=${data.metrics.entry_status_403?.values?.count || 0} 404=${data.metrics.entry_status_404?.values?.count || 0} 429=${data.metrics.entry_status_429?.values?.count || 0} 5xx=${data.metrics.entry_status_5xx?.values?.count || 0}\n` };
}

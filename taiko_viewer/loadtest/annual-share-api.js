import http from "k6/http";
import { check } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const base = (__ENV.BASE || "http://127.0.0.1:3100").replace(/\/$/, "");
const tokens = open("tokens.txt")
  .split(/\r?\n/)
  .map((value) => value.trim())
  .filter((value) => value && !value.startsWith("#"));

if (!tokens.length) throw new Error("loadtest/tokens.txt has no usable tokens");

export const options = {
  vus: Number(__ENV.VUS || 5),
  duration: __ENV.DURATION || "30s",
  thresholds: { http_req_failed: ["rate<0.01"] },
};

const errors = new Rate("annual_errors");
const statuses = new Counter("annual_status");
const status200 = new Counter("annual_status_200");
const status429 = new Counter("annual_status_429");
const status5xx = new Counter("annual_status_5xx");
const htmlDuration = new Trend("annual_html_duration");
const summaryDuration = new Trend("annual_summary_duration");

function request(path, label) {
  const response = http.get(`${base}${path}`, { tags: { endpoint: label } });
  const status = String(response.status);
  statuses.add(1, { endpoint: label, status });
  if (response.status === 200) status200.add(1, { endpoint: label });
  if (response.status === 429) status429.add(1, { endpoint: label });
  if (response.status >= 500 && response.status < 600) status5xx.add(1, { endpoint: label });
  errors.add(response.status >= 400, { endpoint: label });
  check(response, { [`${label} is 200`]: (value) => value.status === 200 });
  return response;
}

export default function () {
  const token = tokens[(__VU - 1 + __ITER) % tokens.length];
  const html = request(`/annual/share/${encodeURIComponent(token)}/`, "html");
  const summary = request(`/api/annual/shares/${encodeURIComponent(token)}?locale=zh`, "summary");
  htmlDuration.add(html.timings.duration);
  summaryDuration.add(summary.timings.duration);
}

export function handleSummary(data) {
  const metrics = data.metrics;
  const format = (name) => {
    const values = metrics[name]?.values || {};
    return `${name}: p95=${(values["p(95)"] || 0).toFixed(1)}ms p99=${(values["p(99)"] || 0).toFixed(1)}ms`;
  };
  return {
    stdout: [
      "Annual share API baseline (429 can mean rate limiting, not a server fault)",
      format("annual_html_duration"),
      format("annual_summary_duration"),
      `error rate: ${((metrics.annual_errors?.values?.rate || 0) * 100).toFixed(2)}%`,
      "status counts are available as annual_status{endpoint,status} in the k6 summary",
      `status counts: 200=${metrics.annual_status_200?.values?.count || 0} 429=${metrics.annual_status_429?.values?.count || 0} 5xx=${metrics.annual_status_5xx?.values?.count || 0}`,
    ].join("\n") + "\n",
  };
}

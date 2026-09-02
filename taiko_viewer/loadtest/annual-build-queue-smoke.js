import http from "k6/http";
import { check } from "k6";

const base = (__ENV.BASE || "http://127.0.0.1:3100").replace(/\/$/, "");
const cookie = String(__ENV.COOKIE || "").trim();
export const options = { vus: 1, iterations: 1 };

export default function () {
  if (__ENV.ALLOW_BUILD_TEST !== "1") {
    console.log("dry-run: set ALLOW_BUILD_TEST=1 explicitly to POST one build job");
    return;
  }
  const response = http.post(`${base}/api/account/annual-summaries/annual_2026/build`, "{}", { headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) } });
  check(response, { "build request is accepted": (value) => [200, 202].includes(value.status) });
}

#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const parseEnv = async (path) => {
  const values = {};
  try {
    for (const raw of (await readFile(path, "utf8")).split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#") || !line.includes("=")) continue;
      const index = line.indexOf("=");
      values[line.slice(0, index)] = line.slice(index + 1).trim().replace(/^"|"$/g, "");
    }
  } catch {}
  return values;
};

const fileEnv = await parseEnv(process.env.TAIKO_VIEWER_ENV_FILE || "/etc/taiko-viewer.env");
const env = { ...fileEnv, ...process.env };
const base = (env.BASE || "http://127.0.0.1:3100").replace(/\/$/, "");
const output = env.OUTPUT || "loadtest/tokens.txt";
const count = Math.max(1, Number(env.TOKEN_COUNT || 10));
const locale = env.LOCALE === "ja" ? "ja" : "zh";
const sessionToken = String(env.SESSION_TOKEN || "").trim();
const targetEnvironment = String(env.LOADTEST_ENV || "production").toLowerCase();
const isProduction = targetEnvironment === "production" || /(^|\/\/)viewer\.sakura-bot\.cn\/?$/i.test(base);

if (isProduction && env.LOADTEST_ALLOW_PRODUCTION !== "1") {
  throw new Error("production seed blocked; set LOADTEST_ALLOW_PRODUCTION=1 explicitly (localhost may still be the production systemd service)");
}
if (!isProduction && !["local", "staging", "test"].includes(targetEnvironment)) throw new Error("LOADTEST_ENV must be local, staging, test, or production");
if (!sessionToken) throw new Error("SESSION_TOKEN is required; seed uses the existing authenticated share API");

const db = await mysql.createConnection({
  host: env.TAIKO_DB_HOST,
  port: Number(env.TAIKO_DB_PORT || 3306),
  user: env.TAIKO_DB_USER,
  password: env.TAIKO_DB_PASSWORD,
  database: env.TAIKO_DB_NAME || "taiko"
});
const [sessions] = await db.execute("SELECT user_id FROM web_user_sessions WHERE session_token = ? AND expires_at > NOW() LIMIT 1", [sessionToken]);
const userId = sessions[0]?.user_id;
if (!userId) throw new Error("SESSION_TOKEN is missing, expired, or not found");
const [summaries] = await db.execute(
  `SELECT id FROM web_annual_summaries WHERE user_id = ? ORDER BY created_at DESC LIMIT ${count}`,
  [userId]
);
if (!summaries.length) throw new Error("没有可用年度总结 summary，请先生成至少一个年度总结 summary。");

const request = async (summaryId) => {
  const response = await fetch(`${base}/api/account/annual-summaries/${encodeURIComponent(summaryId)}/shares`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: `stv_session=${sessionToken}` },
    body: JSON.stringify({ locale })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.share?.url) throw new Error(`share creation failed for ${summaryId}: HTTP ${response.status}`);
  return decodeURIComponent(new URL(body.share.url).pathname.split("/").at(-1));
};

const tokens = [];
for (const row of summaries) {
  const token = await request(String(row.id));
  tokens.push(token);
  console.log(`generated ${token.slice(0, 8)}... for summary ${String(row.id).slice(0, 12)}...`);
}
await writeFile(output, `${tokens.join("\n")}\n`, { mode: 0o600 });
console.log(`wrote ${tokens.length} token(s) to ${output}`);
if (tokens.length < count) console.log(`only ${tokens.length} distinct summary token(s) available; same-summary duplication would revoke the previous active share under current logic`);
await db.end();

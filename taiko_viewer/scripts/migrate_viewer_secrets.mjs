#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import mysql from "mysql2/promise";

const execFileAsync = promisify(execFile);

const SERVICE_FILE = process.env.TAIKO_VIEWER_SERVICE_FILE || "/etc/systemd/system/taiko-viewer.service";
const DROP_IN_FILE = process.env.TAIKO_VIEWER_SECRET_DROP_IN
  || "/etc/systemd/system/taiko-viewer.service.d/secrets.conf";
const ENV_FILE = process.env.TAIKO_VIEWER_ENV_FILE || "/etc/taiko-viewer.env";
const RUNTIME_ENV_FILE = process.env.TAIKO_RUNTIME_ENV_FILE || "/etc/taiko-runtime.env";
const APP_DB_USER = process.env.TAIKO_VIEWER_DB_USER || "taiko_viewer";
const APP_DB_HOST = process.env.TAIKO_VIEWER_DB_HOST || "127.0.0.1";
const APP_DB_NAME = process.env.TAIKO_VIEWER_DB_NAME || "taiko";
const RUNTIME_DB_USER = process.env.TAIKO_RUNTIME_DB_USER || "taiko_runtime";
const RUNTIME_DB_HOST = process.env.TAIKO_RUNTIME_DB_HOST || "127.0.0.1";
const METHOD_CALLS_DB_NAME = process.env.METHOD_CALLS_DB_NAME || "bot";

const sensitiveKeys = new Set([
  "TAIKO_DB_HOST",
  "TAIKO_DB_PORT",
  "TAIKO_DB_USER",
  "TAIKO_DB_PASSWORD",
  "TAIKO_DB_NAME",
  "TAIKO_ANNUAL_SHARE_SECRET",
  "TAIKO_ANNUAL_RENDER_SECRET",
  "TAIKO_ANNUAL_PUBLIC_BASE_URL",
  "METHOD_CALLS_DB_HOST",
  "METHOD_CALLS_DB_PORT",
  "METHOD_CALLS_DB_USER",
  "METHOD_CALLS_DB_PASSWORD",
  "METHOD_CALLS_DB_NAME",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM"
]);

const parseAssignment = (raw) => {
  let value = String(raw || "").trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      value = JSON.parse(value);
    } catch {
      value = value.slice(1, -1);
    }
  }
  const separator = value.indexOf("=");
  if (separator <= 0) return null;
  return [value.slice(0, separator), value.slice(separator + 1)];
};

const parseUnitEnvironment = (contents) => {
  const values = new Map();
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("Environment=")) continue;
    const entry = parseAssignment(trimmed.slice("Environment=".length));
    if (entry) values.set(entry[0], entry[1]);
  }
  return values;
};

const parseEnvironmentFile = (contents) => {
  const values = new Map();
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const entry = parseAssignment(trimmed);
    if (entry) values.set(entry[0], entry[1]);
  }
  return values;
};

const readOptional = async (path) => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
};

const writeAtomic = async (path, contents, mode) => {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, contents, { encoding: "utf8", mode });
  await chmod(temporary, mode);
  await rename(temporary, path);
  await chmod(path, mode);
};

const quoteEnvironmentValue = (value) => JSON.stringify(String(value ?? ""));
const freshSecret = () => randomBytes(48).toString("base64url");

const main = async () => {
  if (typeof process.getuid === "function" && process.getuid() !== 0) {
    throw new Error("must run as root");
  }

  const adminPassword = String(process.env.MYSQL_ADMIN_PASSWORD || "");
  if (!adminPassword) {
    throw new Error("MYSQL_ADMIN_PASSWORD is required; it is never written or printed");
  }

  const unitContents = await readFile(SERVICE_FILE, "utf8");
  const existingEnvContents = await readOptional(ENV_FILE);
  const existingRuntimeEnvContents = await readOptional(RUNTIME_ENV_FILE);
  const unitValues = parseUnitEnvironment(unitContents);
  const existingValues = parseEnvironmentFile(existingEnvContents);
  const existingRuntimeValues = parseEnvironmentFile(existingRuntimeEnvContents);
  const valueFor = (key, fallback = "") => String(
    process.env[key]
      || existingValues.get(key)
      || unitValues.get(key)
      || fallback
  );

  const smtpPass = String(process.env.NEW_SMTP_PASS || valueFor("SMTP_PASS"));
  if (!smtpPass) {
    throw new Error("SMTP_PASS is unavailable; provide NEW_SMTP_PASS for the migrated service");
  }

  const dbPassword = existingValues.get("TAIKO_DB_USER") === APP_DB_USER
    && existingValues.get("TAIKO_DB_PASSWORD")
    ? existingValues.get("TAIKO_DB_PASSWORD")
    : freshSecret();
  const shareSecret = valueFor("TAIKO_ANNUAL_SHARE_SECRET") || freshSecret();
  const renderSecret = valueFor("TAIKO_ANNUAL_RENDER_SECRET") || freshSecret();
  const runtimeDbPassword = existingRuntimeValues.get("TAIKO_DB_USER") === RUNTIME_DB_USER
    && existingRuntimeValues.get("TAIKO_DB_PASSWORD")
    ? existingRuntimeValues.get("TAIKO_DB_PASSWORD")
    : freshSecret();

  const adminSocket = String(process.env.MYSQL_ADMIN_SOCKET || "").trim();
  const admin = await mysql.createConnection({
    ...(adminSocket ? { socketPath: adminSocket } : { host: String(process.env.MYSQL_ADMIN_HOST || "127.0.0.1") }),
    port: Number(process.env.MYSQL_ADMIN_PORT || 3306),
    user: String(process.env.MYSQL_ADMIN_USER || "root"),
    password: adminPassword,
    multipleStatements: false
  });
  try {
    await admin.query(
      `CREATE USER IF NOT EXISTS \`${APP_DB_USER}\`@\`${APP_DB_HOST}\` IDENTIFIED BY ?`,
      [dbPassword]
    );
    await admin.query(
      `ALTER USER \`${APP_DB_USER}\`@\`${APP_DB_HOST}\` IDENTIFIED BY ?`,
      [dbPassword]
    );
    await admin.query(
      `GRANT ALL PRIVILEGES ON \`${APP_DB_NAME}\`.* TO \`${APP_DB_USER}\`@\`${APP_DB_HOST}\``
    );
    await admin.query(
      `CREATE USER IF NOT EXISTS \`${RUNTIME_DB_USER}\`@\`${RUNTIME_DB_HOST}\` IDENTIFIED BY ?`,
      [runtimeDbPassword]
    );
    await admin.query(
      `ALTER USER \`${RUNTIME_DB_USER}\`@\`${RUNTIME_DB_HOST}\` IDENTIFIED BY ?`,
      [runtimeDbPassword]
    );
    await admin.query(
      `GRANT ALL PRIVILEGES ON \`${APP_DB_NAME}\`.* TO \`${RUNTIME_DB_USER}\`@\`${RUNTIME_DB_HOST}\``
    );
    await admin.query(
      `GRANT ALL PRIVILEGES ON \`${METHOD_CALLS_DB_NAME}\`.* TO \`${RUNTIME_DB_USER}\`@\`${RUNTIME_DB_HOST}\``
    );
  } finally {
    await admin.end();
  }

  const runtimeConnection = await mysql.createConnection({
    host: RUNTIME_DB_HOST,
    port: 3306,
    user: RUNTIME_DB_USER,
    password: runtimeDbPassword,
    database: APP_DB_NAME
  });
  try {
    await runtimeConnection.query("SELECT 1");
  } finally {
    await runtimeConnection.end();
  }

  const appConnection = await mysql.createConnection({
    host: APP_DB_HOST,
    port: 3306,
    user: APP_DB_USER,
    password: dbPassword,
    database: APP_DB_NAME
  });
  try {
    await appConnection.query("SELECT 1");
  } finally {
    await appConnection.end();
  }

  const migratedValues = {
    TAIKO_DB_HOST: APP_DB_HOST,
    TAIKO_DB_PORT: "3306",
    TAIKO_DB_USER: APP_DB_USER,
    TAIKO_DB_PASSWORD: dbPassword,
    TAIKO_DB_NAME: APP_DB_NAME,
    TAIKO_ANNUAL_SHARE_SECRET: shareSecret,
    TAIKO_ANNUAL_RENDER_SECRET: renderSecret,
    TAIKO_ANNUAL_CHROMIUM_PATH: valueFor("TAIKO_ANNUAL_CHROMIUM_PATH", "/usr/bin/chromium"),
    TAIKO_ANNUAL_INTERNAL_BASE_URL: valueFor(
      "TAIKO_ANNUAL_INTERNAL_BASE_URL",
      "http://127.0.0.1:3100"
    ),
    TAIKO_ANNUAL_PUBLIC_BASE_URL: valueFor(
      "TAIKO_ANNUAL_PUBLIC_BASE_URL",
      "https://viewer.sakura-bot.cn"
    ),
    SMTP_HOST: valueFor("SMTP_HOST", "smtp.qq.com"),
    SMTP_PORT: valueFor("SMTP_PORT", "465"),
    SMTP_USER: valueFor("SMTP_USER"),
    SMTP_PASS: smtpPass,
    SMTP_FROM: valueFor("SMTP_FROM")
  };

  const envBody = [
    "# Managed by scripts/migrate_viewer_secrets.mjs. Mode must remain 0600.",
    ...Object.entries(migratedValues).map(
      ([key, value]) => `${key}=${quoteEnvironmentValue(value)}`
    ),
    ""
  ].join("\n");
  await writeAtomic(ENV_FILE, envBody, 0o600);

  const runtimeEnvBody = [
    "# Managed by scripts/migrate_viewer_secrets.mjs. Mode must remain 0600.",
    `TAIKO_DB_HOST=${quoteEnvironmentValue(RUNTIME_DB_HOST)}`,
    "TAIKO_DB_PORT=\"3306\"",
    `TAIKO_DB_USER=${quoteEnvironmentValue(RUNTIME_DB_USER)}`,
    `TAIKO_DB_PASSWORD=${quoteEnvironmentValue(runtimeDbPassword)}`,
    `TAIKO_DB_NAME=${quoteEnvironmentValue(APP_DB_NAME)}`,
    `METHOD_CALLS_DB_HOST=${quoteEnvironmentValue(RUNTIME_DB_HOST)}`,
    "METHOD_CALLS_DB_PORT=\"3306\"",
    `METHOD_CALLS_DB_USER=${quoteEnvironmentValue(RUNTIME_DB_USER)}`,
    `METHOD_CALLS_DB_PASSWORD=${quoteEnvironmentValue(runtimeDbPassword)}`,
    `METHOD_CALLS_DB_NAME=${quoteEnvironmentValue(METHOD_CALLS_DB_NAME)}`,
    ""
  ].join("\n");
  await writeAtomic(RUNTIME_ENV_FILE, runtimeEnvBody, 0o600);

  const cleanedUnit = unitContents
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("Environment=")) return true;
      const entry = parseAssignment(trimmed.slice("Environment=".length));
      return !entry || !sensitiveKeys.has(entry[0]);
    })
    .join("\n")
    .replace(/\n*$/, "\n");
  await writeAtomic(SERVICE_FILE, cleanedUnit, 0o644);
  await writeAtomic(
    DROP_IN_FILE,
    `[Service]\nEnvironmentFile=${ENV_FILE}\n`,
    0o644
  );

  await execFileAsync("systemctl", ["daemon-reload"]);
  process.stdout.write(JSON.stringify({
    ok: true,
    service: "taiko-viewer.service",
    databaseUser: APP_DB_USER,
    environmentFile: ENV_FILE,
    runtimeDatabaseUser: RUNTIME_DB_USER,
    runtimeEnvironmentFile: RUNTIME_ENV_FILE,
    smtpCredentialRotated: Boolean(process.env.NEW_SMTP_PASS)
  }) + "\n");
};

main().catch((error) => {
  process.stderr.write(`viewer secret migration failed: ${String(error?.message || error)}\n`);
  process.exitCode = 1;
});

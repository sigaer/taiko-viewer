import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import { createError } from "h3";
import type { Pool } from "mysql2/promise";
import { getAccountDbNativeConfig } from "../../utils/account-db";
import { getRuntimePaths } from "../runtime-paths.ts";

export type SyncWorkerRequest = {
  requestId: string; requestHash: string; userId: number;
  binding: { id: string; taiko_id: string; source: string | null; manual_account_id?: string | null };
  targetIds: string[];
};
export type SyncWorkerResult = { requestId: string; userId: number; taikoId: string; logId: number; logHash: string };
const unavailable = () => createError({ statusCode: 503, statusMessage: "同步服务暂不可用，请稍后重试。" });
// One current Viewer process. All account-sync requests share this bounded
// admission; a multi-replica rollout requires a host admission gate first.
let active = 0;
const queue: Array<() => void> = [];
async function enter() {
  if (active < 2) { active++; return; }
  if (queue.length >= 8) throw unavailable();
  await new Promise<void>((resolve, reject) => {
    const ready = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(() => { const index = queue.indexOf(ready); if (index >= 0) queue.splice(index, 1); reject(unavailable()); }, 30_000);
    queue.push(ready);
  });
}
function leave() { const next = queue.shift(); if (next) next(); else active--; }

export function createAccountSyncWorkerRunner(launch: typeof spawn = spawn) {
  return async (request: SyncWorkerRequest, db: Pool): Promise<SyncWorkerResult> => {
    const input = JSON.stringify(request);
    if (Buffer.byteLength(input) > 16_384) throw unavailable();
    const config = getAccountDbNativeConfig(db), paths = getRuntimePaths();
    // Only the worker's required environment crosses this private boundary.
    // /proc/self cannot contain this user-created pathname; the existing loader
    // marks explicit absent input as loaded without consulting global secrets.
    const env: NodeJS.ProcessEnv = {};
    for (const key of ["PATH", "HOME", "LANG", "LC_ALL", "TZ", "SSL_CERT_FILE", "SSL_CERT_DIR", "REQUESTS_CA_BUNDLE", "CURL_CA_BUNDLE", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "all_proxy", "no_proxy", "TAIKO_SYNC_RECEIVER_NAME"]) {
      if (process.env[key] !== undefined) env[key] = process.env[key];
    }
    Object.assign(env, { TAIKO_DB_HOST: config.host, TAIKO_DB_PORT: String(config.port), TAIKO_DB_USER: config.user,
      TAIKO_DB_PASSWORD: config.password, TAIKO_DB_NAME: config.database, TAIKO_RUNTIME_ENV_FILE: "/proc/self/taiko-account-sync-no-env",
      TAIKO_USERDATA_DIR: paths.userdataDir, TAIKO_WAHLAP_CONFIG_PATH: paths.configPath, PYTHONDONTWRITEBYTECODE: "1" });
    await enter();
    try {
      return await new Promise<SyncWorkerResult>((resolve, reject) => {
        let child: ReturnType<typeof spawn>;
        try { child = launch("python3", ["-m", "scripts.account_sync_cli"], { cwd: paths.repoRoot, env, stdio: ["pipe", "pipe", "pipe"] }); }
        catch { reject(unavailable()); return; }
        let output = "", bytes = 0, stderrBytes = 0, failed = false;
        const decoder = new StringDecoder("utf8");
        let killTimer: ReturnType<typeof setTimeout> | undefined;
        const stop = () => { failed = true; child.kill("SIGTERM"); killTimer ??= setTimeout(() => child.kill("SIGKILL"), 1500); };
        const timer = setTimeout(stop, 180_000);
        child.stdout!.on("data", (chunk: Buffer) => { bytes += chunk.length; if (bytes > 65_536) stop(); else output += decoder.write(chunk); });
        child.stderr!.on("data", (chunk: Buffer) => { stderrBytes += chunk.length; if (stderrBytes > 8192) stop(); });
        child.stdin!.on("error", stop);
        child.once("error", () => { failed = true; });
        child.once("close", code => {
          clearTimeout(timer); if (killTimer) clearTimeout(killTimer);
          if (failed || code !== 0) { reject(unavailable()); return; }
          try {
            const payload = JSON.parse(output + decoder.end());
            if (payload?.ok === false) {
              const messages: Record<string, [number, string]> = {
                profile_changed: [409, "绑定已变更，请重新加载。"], request_conflict: [409, "同步请求已变更，请重试。"],
                manual_source: [400, "手动账号无需拉取同步。"], invalid_request: [400, "同步请求标识无效。"],
                invalid_targets: [400, "同步目标无效。"], owner_required: [403, "账号归属无效。"],
                wahlap_user_not_found: [404, "未找到该鼓众 ID 的成绩，请确认绑定账号。"],
                wahlap_sync_failed: [502, "从鼓众广场拉取成绩失败，请稍后重试。"],
                sync_unavailable: [503, "同步服务暂不可用，请稍后重试。"]
              };
              if (payload.error === "sync_cooldown" && payload.status === 429 && Number.isSafeInteger(payload.data?.remainingSeconds) &&
                payload.data.remainingSeconds > 0 && payload.data.remainingSeconds <= 1800 && typeof payload.data.availableAt === "string" &&
                payload.data.availableAt.length < 64 && Number.isFinite(new Date(payload.data.availableAt).getTime())) {
                const remainingSeconds = payload.data.remainingSeconds;
                reject(createError({ statusCode: 429, statusMessage: `同步冷却中，请在 ${remainingSeconds} 秒后重试`,
                  data: { remainingSeconds, availableAt: new Date(payload.data.availableAt).toISOString() } })); return;
              }
              const message = messages[payload.error];
              reject(message && payload.status === message[0] ? createError({ statusCode: message[0], statusMessage: message[1] }) : unavailable()); return;
            }
            const result = payload?.result;
            if (payload?.ok !== true || result?.requestId !== request.requestId || result?.userId !== request.userId || result?.taikoId !== request.binding.taiko_id ||
              !Number.isSafeInteger(result?.logId) || result.logId <= 0 || typeof result?.logHash !== "string" || !/^[a-f0-9]{64}$/.test(result.logHash)) throw unavailable();
            resolve({ requestId: result.requestId, userId: result.userId, taikoId: result.taikoId, logId: result.logId, logHash: result.logHash });
          } catch { reject(unavailable()); }
        });
        child.stdin!.end(input);
      });
    } finally { leave(); }
  };
}

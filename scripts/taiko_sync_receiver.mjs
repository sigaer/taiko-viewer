import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { zstdDecompressSync } from "node:zlib";

const HOST = String(process.env.TAIKO_SYNC_RECEIVER_HOST || "127.0.0.1").trim() || "127.0.0.1";
const PORT = Number(process.env.TAIKO_SYNC_RECEIVER_PORT || 3102) || 3102;
const RECEIVER_NAME = String(process.env.TAIKO_SYNC_RECEIVER_NAME || "Sakura bot").trim() || "Sakura bot";
const USERDATA_DIR =
  String(process.env.TAIKO_USERDATA_DIR || "/home/sigaer/taiko/userdata").trim() || "/home/sigaer/taiko/userdata";
const MAX_BODY_BYTES = Number(process.env.TAIKO_SYNC_RECEIVER_MAX_BODY_BYTES || 64 * 1024 * 1024) || 64 * 1024 * 1024;

const json = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
};

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

const readRequestBody = async (request) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    request.on("data", (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        reject(new Error(`payload_too_large:${MAX_BODY_BYTES}`));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
    request.on("aborted", () => reject(new Error("request_aborted")));
  });

const sanitizeUserid = (value) => {
  const userid = String(value || "").trim();
  return userid.replace(/[^0-9A-Za-z_-]/g, "") || "unknown";
};

const pad = (value, length = 2) => String(value).padStart(length, "0");

const getSnapshotTimestamp = () => {
  const now = new Date();
  return [
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`,
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`,
    `${pad(now.getMilliseconds(), 3)}000`
  ].join("_");
};

const readJsonFile = async (filePath) => {
  try {
    return JSON.parse(await readFile(filePath, "utf-8"));
  } catch {
    return null;
  }
};

const buildSongKey = (song) => `${Number(song?.song_no || 0) || 0}:${Number(song?.level || 0) || 0}`;

const buildSongMap = (songs) => {
  const songMap = new Map();
  for (const song of Array.isArray(songs) ? songs : []) {
    songMap.set(buildSongKey(song), song);
  }
  return songMap;
};

const hasFullSnapshot = async (userHistoryDir) => {
  try {
    const files = await readdir(userHistoryDir);
    for (const fileName of files) {
      if (!fileName.startsWith("data_") || !fileName.endsWith(".json")) continue;
      const snapshot = await readJsonFile(join(userHistoryDir, fileName));
      if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) continue;
      const meta = snapshot._meta && typeof snapshot._meta === "object" ? snapshot._meta : {};
      if (meta.full) return true;
      if ("songs" in snapshot && "profile" in snapshot && "achievement" in snapshot && !Object.keys(meta).length) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
};

const buildDeltaSnapshot = async (savePath, userHistoryDir, payload, snapshotTs) => {
  const profile = payload.profile && typeof payload.profile === "object" ? payload.profile : {};
  const achievement = payload.achievement && typeof payload.achievement === "object" ? payload.achievement : {};
  const songs = Array.isArray(payload.songs) ? payload.songs : [];
  const prevData = await readJsonFile(savePath);

  if (!prevData || typeof prevData !== "object" || Array.isArray(prevData)) {
    return {
      _meta: { full: true, ts: snapshotTs, source: "sakura-bot-sync" },
      profile,
      achievement,
      songs
    };
  }

  if (!(await hasFullSnapshot(userHistoryDir))) {
    return {
      _meta: { full: true, ts: snapshotTs, source: "sakura-bot-sync" },
      profile,
      achievement,
      songs
    };
  }

  const deltaSnapshot = {
    _meta: { full: false, ts: snapshotTs, source: "sakura-bot-sync" }
  };

  if (JSON.stringify(prevData.profile || {}) !== JSON.stringify(profile)) {
    deltaSnapshot.profile = profile;
  }
  if (JSON.stringify(prevData.achievement || {}) !== JSON.stringify(achievement)) {
    deltaSnapshot.achievement = achievement;
  }

  const prevMap = buildSongMap(prevData.songs);
  const nextMap = buildSongMap(songs);
  const changedSongs = [];
  for (const [songKey, nextSong] of nextMap.entries()) {
    const prevSong = prevMap.get(songKey);
    if (JSON.stringify(prevSong || null) !== JSON.stringify(nextSong || null)) {
      changedSongs.push(nextSong);
    }
  }
  deltaSnapshot.songs = changedSongs;

  const removedSongs = [];
  for (const songKey of prevMap.keys()) {
    if (!nextMap.has(songKey)) {
      const [songNo, level] = songKey.split(":");
      removedSongs.push([Number(songNo), Number(level)]);
    }
  }
  if (removedSongs.length) {
    deltaSnapshot.songs_removed = removedSongs;
  }

  return deltaSnapshot;
};

const persistPayload = async ({ userid, compressedBuffer, decompressedBuffer, parsed, payloadSha256 }) => {
  const sanitizedUserid = sanitizeUserid(userid);
  const savePath = join(USERDATA_DIR, `${sanitizedUserid}data.json`);
  const userHistoryDir = join(USERDATA_DIR, sanitizedUserid);
  const snapshotTs = getSnapshotTimestamp();
  const historyPath = join(userHistoryDir, `data_${snapshotTs}.json`);

  await mkdir(USERDATA_DIR, { recursive: true });
  await mkdir(userHistoryDir, { recursive: true });

  const deltaSnapshot = await buildDeltaSnapshot(savePath, userHistoryDir, parsed, snapshotTs);
  const payloadText = `${JSON.stringify(parsed, null, 4)}\n`;
  const deltaText = `${JSON.stringify(deltaSnapshot, null, 4)}\n`;

  const songs = Array.isArray(parsed?.songs) ? parsed.songs : [];
  const metadata = {
    receiver: RECEIVER_NAME,
    userid: sanitizedUserid,
    payloadSha256,
    receivedBytes: compressedBuffer.byteLength,
    decompressedBytes: decompressedBuffer.byteLength,
    songCount: songs.length,
    receivedAt: new Date().toISOString(),
    savePath,
    historyPath
  };

  await Promise.all([
    writeFile(savePath, payloadText, "utf-8"),
    writeFile(historyPath, deltaText, "utf-8")
  ]);

  return metadata;
};

const handleReceive = async (request, response) => {
  if (request.method !== "POST") {
    json(response, 405, { ok: false, message: "仅支持 POST" });
    return;
  }

  const contentType = String(request.headers["content-type"] || "").toLowerCase();
  if (!contentType.includes("application/zstd")) {
    json(response, 415, { ok: false, message: "仅接受 application/zstd" });
    return;
  }

  const userid = sanitizeUserid(request.headers["x-taiko-userid"]);
  if (!userid || userid === "unknown") {
    json(response, 400, { ok: false, message: "缺少 x-taiko-userid" });
    return;
  }

  let compressedBuffer;
  try {
    compressedBuffer = await readRequestBody(request);
  } catch (error) {
    const message = String(error?.message || "request_failed");
    if (message.startsWith("payload_too_large:")) {
      json(response, 413, { ok: false, message: `请求体超过上限 ${MAX_BODY_BYTES} bytes` });
      return;
    }
    json(response, 400, { ok: false, message: "读取请求体失败" });
    return;
  }

  if (!compressedBuffer.byteLength) {
    json(response, 400, { ok: false, message: "未收到同步数据" });
    return;
  }

  const expectedSha = String(request.headers["x-taiko-payload-sha256"] || "").trim().toLowerCase();
  const actualSha = sha256(compressedBuffer);
  if (expectedSha && expectedSha !== actualSha) {
    json(response, 400, { ok: false, message: "压缩数据 sha256 校验失败" });
    return;
  }

  let decompressedBuffer;
  try {
    decompressedBuffer = zstdDecompressSync(compressedBuffer);
  } catch {
    json(response, 400, { ok: false, message: "zstd 解压失败" });
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(decompressedBuffer.toString("utf-8"));
  } catch {
    json(response, 400, { ok: false, message: "解压后 JSON 解析失败" });
    return;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    json(response, 400, { ok: false, message: "解压后 JSON 顶层必须为对象" });
    return;
  }

  const metadata = await persistPayload({
    userid,
    compressedBuffer,
    decompressedBuffer,
    parsed,
    payloadSha256: actualSha
  });

  json(response, 200, {
    ok: true,
    receiver: RECEIVER_NAME,
    userid: metadata.userid,
    receivedBytes: metadata.receivedBytes,
    decompressedBytes: metadata.decompressedBytes,
    songCount: metadata.songCount,
    message: `${RECEIVER_NAME} 已收到 ${metadata.songCount} 条成绩记录`
  });
};

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || `${HOST}:${PORT}`}`);
  if (requestUrl.pathname === "/health") {
    json(response, 200, {
      ok: true,
      receiver: RECEIVER_NAME,
      host: HOST,
      port: PORT,
      userdataDir: USERDATA_DIR
    });
    return;
  }
  if (requestUrl.pathname === "/" || requestUrl.pathname === "/receive") {
    try {
      await handleReceive(request, response);
    } catch (error) {
      console.error("[taiko-sync-receiver] 未处理异常", error);
      json(response, 500, { ok: false, message: "接收服务内部错误" });
    }
    return;
  }
  json(response, 404, { ok: false, message: "未找到请求路径" });
});

server.listen(PORT, HOST, () => {
  console.log(`[taiko-sync-receiver] ${RECEIVER_NAME} listening on http://${HOST}:${PORT}`);
});

const shutdown = (signal) => {
  console.log(`[taiko-sync-receiver] 收到 ${signal}，准备退出`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

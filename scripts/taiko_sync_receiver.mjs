import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { zstdCompressSync } from "node:zlib";

const HOST = String(process.env.TAIKO_SYNC_RECEIVER_HOST || "127.0.0.1").trim() || "127.0.0.1";
const PORT = Number(process.env.TAIKO_SYNC_RECEIVER_PORT || 3102) || 3102;
const RECEIVER_NAME = String(process.env.TAIKO_SYNC_RECEIVER_NAME || "Sakura bot").trim() || "Sakura bot";
const USERDATA_DIR =
  String(process.env.TAIKO_USERDATA_DIR || "/home/sigaer/taiko/userdata").trim() || "/home/sigaer/taiko/userdata";
const MAX_BODY_BYTES = Number(process.env.TAIKO_SYNC_RECEIVER_MAX_BODY_BYTES || 64 * 1024 * 1024) || 64 * 1024 * 1024;
const DEFAULT_FORWARD_TARGETS = [
  {
    id: "sakura-bot",
    label: "Sakura bot",
    description: "Sakura bot 在服务端读取 userdata 并刷新本地快照。",
    kind: "local",
    endpoint: ""
  },
  {
    id: "mock-service-b",
    label: "站内 mock 接收器",
    description: "将 zstd 压缩成绩转发到论坛 mock 接口，验证服务端分发链路。",
    kind: "http",
    endpoint: "http://127.0.0.1:3101/api/account/sync/mock/mock-service-b"
  }
];

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
  return userid.replace(/[^0-9A-Za-z_-]/g, "") || "";
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

const parseForwardTarget = (input) => {
  if (!input || typeof input !== "object") return null;
  const payload = input;
  const id = String(payload.id || "").trim();
  const label = String(payload.label || "").trim();
  const description = String(payload.description || "").trim();
  const kind = String(payload.kind || (payload.endpoint ? "http" : "local"))
    .trim()
    .toLowerCase();
  const endpoint = String(payload.endpoint || payload.url || "").trim();
  if (!id || !label) return null;
  if (kind === "http" && !endpoint) return null;
  return {
    id,
    label,
    description,
    kind: kind === "local" ? "local" : "http",
    endpoint
  };
};

const loadForwardTargets = () => {
  const raw = String(process.env.TAIKO_SYNC_FORWARD_TARGETS_JSON || "").trim();
  if (!raw) {
    return DEFAULT_FORWARD_TARGETS;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("sync forward target config must be an array");
    }
    const targets = parsed.map(parseForwardTarget).filter(Boolean);
    if (!targets.length) {
      throw new Error("sync forward target config is empty");
    }
    return targets;
  } catch (error) {
    console.error("[taiko-sync-receiver] 解析同步分发配置失败，已回退到默认配置", error);
    return DEFAULT_FORWARD_TARGETS;
  }
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

const readLocalUserdata = async (userid) => {
  const sanitizedUserid = sanitizeUserid(userid);
  if (!sanitizedUserid) {
    throw new Error("invalid_userid");
  }
  const savePath = join(USERDATA_DIR, `${sanitizedUserid}data.json`);
  let rawBuffer;
  try {
    rawBuffer = await readFile(savePath);
  } catch {
    throw new Error("userdata_not_found");
  }
  let parsed;
  try {
    parsed = JSON.parse(rawBuffer.toString("utf-8"));
  } catch {
    throw new Error("userdata_invalid_json");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("userdata_invalid_payload");
  }
  return {
    userid: sanitizedUserid,
    savePath,
    rawBuffer,
    parsed,
    compressedBuffer: zstdCompressSync(rawBuffer)
  };
};

const writeLocalSnapshot = async (userid, parsed) => {
  const savePath = join(USERDATA_DIR, `${userid}data.json`);
  const userHistoryDir = join(USERDATA_DIR, userid);
  const snapshotTs = getSnapshotTimestamp();
  const historyPath = join(userHistoryDir, `data_${snapshotTs}.json`);

  await mkdir(USERDATA_DIR, { recursive: true });
  await mkdir(userHistoryDir, { recursive: true });

  const deltaSnapshot = await buildDeltaSnapshot(savePath, userHistoryDir, parsed, snapshotTs);
  const payloadText = `${JSON.stringify(parsed, null, 4)}\n`;
  const deltaText = `${JSON.stringify(deltaSnapshot, null, 4)}\n`;

  await Promise.all([
    writeFile(savePath, payloadText, "utf-8"),
    writeFile(historyPath, deltaText, "utf-8")
  ]);

  return {
    savePath,
    historyPath
  };
};

const readResponsePayload = async (response) => {
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    try {
      const payload = await response.json();
      return {
        message: String(payload.message || payload.statusMessage || "").trim() || `HTTP ${response.status}`,
        receivedBytes: Number(payload.receivedBytes || 0) || 0,
        decompressedBytes: Number(payload.decompressedBytes || 0) || 0,
        songCount: payload.songCount === null || payload.songCount === undefined ? null : Number(payload.songCount || 0)
      };
    } catch {
      return {
        message: `HTTP ${response.status}`,
        receivedBytes: 0,
        decompressedBytes: 0,
        songCount: null
      };
    }
  }
  const text = await response.text();
  return {
    message: text.trim() || `HTTP ${response.status}`,
    receivedBytes: 0,
    decompressedBytes: 0,
    songCount: null
  };
};

const forwardCompressedPayload = async (target, userid, compressedBuffer) => {
  const response = await fetch(target.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/zstd",
      "X-Taiko-Userid": userid,
      "X-Taiko-Compression": "zstd",
      "X-Taiko-Payload-Sha256": sha256(compressedBuffer)
    },
    body: compressedBuffer
  });
  const payload = await readResponsePayload(response);
  return {
    targetId: target.id,
    label: target.label,
    ok: response.ok,
    statusCode: response.status,
    message: payload.message,
    receivedBytes: payload.receivedBytes || compressedBuffer.byteLength,
    decompressedBytes: payload.decompressedBytes,
    songCount: payload.songCount
  };
};

const dispatchToTarget = async (target, userdata) => {
  const songs = Array.isArray(userdata.parsed?.songs) ? userdata.parsed.songs : [];
  if (target.kind === "local") {
    await writeLocalSnapshot(userdata.userid, userdata.parsed);
    return {
      targetId: target.id,
      label: target.label,
      ok: true,
      statusCode: 200,
      message: `${target.label} 已刷新 userdata 与历史快照`,
      receivedBytes: userdata.compressedBuffer.byteLength,
      decompressedBytes: userdata.rawBuffer.byteLength,
      songCount: songs.length
    };
  }

  return forwardCompressedPayload(target, userdata.userid, userdata.compressedBuffer);
};

const parseDispatchBody = async (request) => {
  const rawBody = await readRequestBody(request);
  if (!rawBody.byteLength) {
    throw new Error("empty_body");
  }
  let parsed;
  try {
    parsed = JSON.parse(rawBody.toString("utf-8"));
  } catch {
    throw new Error("invalid_json");
  }
  const userid = sanitizeUserid(parsed?.userid);
  const targetIds = Array.from(
    new Set(
      (Array.isArray(parsed?.targetIds) ? parsed.targetIds : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
  if (!userid) {
    throw new Error("missing_userid");
  }
  if (!targetIds.length) {
    throw new Error("missing_targets");
  }
  return {
    userid,
    targetIds
  };
};

const handleTargets = (response) => {
  const targets = loadForwardTargets().map(({ id, label, description }) => ({ id, label, description }));
  json(response, 200, {
    ok: true,
    receiver: RECEIVER_NAME,
    targets
  });
};

const handleDispatch = async (request, response) => {
  if (request.method !== "POST") {
    json(response, 405, { ok: false, message: "仅支持 POST" });
    return;
  }

  let dispatchRequest;
  try {
    dispatchRequest = await parseDispatchBody(request);
  } catch (error) {
    const code = String(error?.message || "invalid_request");
    const messageMap = {
      payload_too_large: `请求体超过上限 ${MAX_BODY_BYTES} bytes`,
      request_aborted: "请求已中断",
      empty_body: "未收到同步请求内容",
      invalid_json: "同步请求 JSON 无法解析",
      missing_userid: "请提供 userid",
      missing_targets: "请至少选择一个同步目标"
    };
    const prefix = code.split(":")[0];
    json(response, prefix === "payload_too_large" ? 413 : 400, {
      ok: false,
      message: messageMap[prefix] || "同步请求无效"
    });
    return;
  }

  const allTargets = loadForwardTargets();
  const targetMap = new Map(allTargets.map((target) => [target.id, target]));
  const selectedTargets = dispatchRequest.targetIds.map((id) => targetMap.get(id)).filter(Boolean);
  if (selectedTargets.length !== dispatchRequest.targetIds.length) {
    json(response, 400, { ok: false, message: "包含无效的同步目标" });
    return;
  }

  let userdata;
  try {
    userdata = await readLocalUserdata(dispatchRequest.userid);
  } catch (error) {
    const code = String(error?.message || "userdata_read_failed");
    if (code === "userdata_not_found") {
      json(response, 404, { ok: false, message: "未找到对应 userid 的 userdata" });
      return;
    }
    if (code === "userdata_invalid_json" || code === "userdata_invalid_payload") {
      json(response, 500, { ok: false, message: "本地 userdata 已损坏" });
      return;
    }
    json(response, 500, { ok: false, message: "读取本地 userdata 失败" });
    return;
  }

  const results = await Promise.all(
    selectedTargets.map(async (target) => {
      try {
        return await dispatchToTarget(target, userdata);
      } catch (error) {
        return {
          targetId: target.id,
          label: target.label,
          ok: false,
          statusCode: 500,
          message: String(error?.message || "服务端分发失败"),
          receivedBytes: userdata.compressedBuffer.byteLength,
          decompressedBytes: 0,
          songCount: null
        };
      }
    })
  );

  json(response, 200, {
    ok: results.every((item) => item.ok),
    receiver: RECEIVER_NAME,
    userid: userdata.userid,
    originalBytes: userdata.rawBuffer.byteLength,
    compressedBytes: userdata.compressedBuffer.byteLength,
    results,
    message: `${RECEIVER_NAME} 已在服务端完成 ${results.length} 个目标的同步请求`
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
      userdataDir: USERDATA_DIR,
      targetCount: loadForwardTargets().length
    });
    return;
  }
  if (requestUrl.pathname === "/targets") {
    try {
      handleTargets(response);
    } catch (error) {
      console.error("[taiko-sync-receiver] 读取同步目标失败", error);
      json(response, 500, { ok: false, message: "读取同步目标失败" });
    }
    return;
  }
  if (requestUrl.pathname === "/dispatch") {
    try {
      await handleDispatch(request, response);
    } catch (error) {
      console.error("[taiko-sync-receiver] 分发请求未处理异常", error);
      json(response, 500, { ok: false, message: "同步网关内部错误" });
    }
    return;
  }
  if (requestUrl.pathname === "/" || requestUrl.pathname === "/receive") {
    json(response, 410, {
      ok: false,
      message: "直接上传 zstd 数据已停用，请改为向 /dispatch 发送服务端同步请求"
    });
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

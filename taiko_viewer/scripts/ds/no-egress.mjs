// Preload for local self-check servers: refuse every outbound TCP connection that is not to the loopback interface.
//
//   NODE_OPTIONS="--import ./scripts/ds/no-egress.mjs" npx nuxt dev ...
//
// Pages rendered during the existing-page capture make server-side requests (song data, guides, Bot APIs, Bilibili,
// static.sakura-bot.cn …). With this preload those requests fail fast inside the dev server instead of reaching any
// production or third-party host, and fail the same way for the baseline and the current tree. Database hosts are
// covered too (mysql2 uses net sockets). Every refused destination is logged once to stderr.
import net from "node:net";

const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost", "::ffff:127.0.0.1"]);
const seen = new Set();
const original = net.Socket.prototype.connect;

net.Socket.prototype.connect = function connect(...args) {
  // net.connect() passes a normalized [options, callback] array as the single argument
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  let host;
  let port;
  if (first && typeof first === "object") {
    if (first.path) return original.apply(this, args); // IPC / named pipe
    host = first.host ?? "localhost";
    port = first.port;
  } else if (typeof first === "number" || (typeof first === "string" && /^\d+$/.test(first))) {
    port = first;
    host = typeof args[1] === "string" ? args[1] : "localhost";
  } else return original.apply(this, args); // path string (IPC)
  if (LOOPBACK.has(String(host).toLowerCase())) return original.apply(this, args);
  const key = `${host}:${port}`;
  if (!seen.has(key)) {
    seen.add(key);
    process.stderr.write(`[no-egress] refused outbound connection to ${key}\n`);
  }
  const error = Object.assign(new Error(`no-egress: connection to ${key} refused`), { code: "ECONNREFUSED" });
  process.nextTick(() => this.destroy(error));
  return this;
};
